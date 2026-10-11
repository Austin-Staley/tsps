/**
 * Eggs and the three araxytes: hatching, minion attacks, the Mirrorback's damage reflection
 * and the Ruptura's burst.
 *
 * As captured / Near-Reality: eggs settle with 11506, hatch on the fight's 42-tick beat
 * (first at +21) into a fresh minion at the egg's tile (hatch mark 2927/2928/2929 + 11503),
 * which walks to the centre and starts attacking 3 ticks later. Acidic spits (11498,
 * projectile 2925), Mirrorback melees (11500) and reflects half of every non-halberd,
 * non-ranged, non-magic hit back at its attacker, Ruptura never attacks: it runs at its
 * target and bursts (11510) for up to 49, hurting Araxxor 80/64 by distance as well
 * (captured: the boss took an 80 from a burst).
 *
 * Eggs and araxytes die to a noxious halberd, a crossbow or a ballista instantly (damage
 * equals their remaining hitpoints, Near-Reality); eggs keep their remaining health when
 * they hatch (Wiki strategy: hitting the eggs weakens the spiders).
 */
const Shared = require("./Shared.Araxxor");

let api = null;
let core = null;

const HATCH_ANIMATION = 11503;
const EGG_ANIMATION = 11506;
const EGG_DEATH_ANIMATION = 11508;
const RUPTURA_ANIMATION = 11510;
const RUPTURA_BURST_ATTRIBUTE = "araxxor:ruptura-burst";
const INSTANT_KILL_WEAPONS = ["noxious halberd", "crossbow", "ballista"];
const RUPTURA_BOSS_RANGE = 5;
const RUPTURA_BOSS_RANGE_FAR = 6;

function alive(entity) {
  return !!entity?.isRegistered?.() && (entity.getHitpoints?.() ?? 1) > 0;
}

function later(ticks, target, execFunc) {
  class DelayedTask extends core.Task {
    constructor() {
      super(Math.max(1, ticks), target, false);
    }

    execute() {
      this.stop();
      execFunc();
    }
  }
  core.TaskManager.submit(new DelayedTask());
}

function sessionOf(npc) {
  return npc?.getAttribute?.(Shared.ATTR_ENCOUNTER) ?? null;
}

/** The nine eggs of the fight, one per pattern tile. */
function spawnEggs(session) {
  const area = session.npc.getPrivateArea?.() ?? null;
  for (let index = 0; index < session.pattern.length; index++) {
    const type = session.pattern[index];
    const [x, y] = Shared.EGG_TILES[index];
    const egg = core.NPC.create(Shared.EGG_ID[type], new core.Location(x, y, 0));
    egg.__skipDefaultRespawn = true;
    egg.setHitpoints?.(Shared.EGG_HITPOINTS);
    egg.performAnimation(new core.Animation(EGG_ANIMATION));
    egg.setAttribute?.(Shared.ATTR_ENCOUNTER, session);
    area?.add?.(egg);
    core.World.getAddNPCQueue().push(egg);
    session.eggs.push({ type, x, y, npc: egg });
  }
}

/** Hatches the next living egg in the pattern on the fight's hatch beat. */
function hatchNext(bossNpc) {
  const session = sessionOf(bossNpc);
  if (!session || bossNpc.getAttribute?.(Shared.ATTR_DYING) === true) return;
  const entry = session.eggs.find((egg) => alive(egg.npc) && egg.npc.getId() === Shared.EGG_ID[egg.type]);
  if (!entry) return;
  const remaining = entry.npc.getHitpoints?.() ?? Shared.EGG_HITPOINTS;
  core.World.getRemoveNPCQueue().push(entry.npc);
  const area = bossNpc.getPrivateArea?.() ?? null;
  if (area?.isDestroyed?.() === true) return;
  const minion = core.NPC.create(Shared.MINION_ID[entry.type], new core.Location(entry.x, entry.y, 0));
  minion.__skipDefaultRespawn = true;
  minion.setHitpoints?.(Math.max(1, remaining));
  minion.performAnimation(new core.Animation(HATCH_ANIMATION));
  minion.performGraphic(new core.Graphic(Shared.HATCH_GFX[entry.type]));
  minion.setAttribute?.(Shared.ATTR_ENCOUNTER, session);
  minion.setFlag?.(core.NPC.WALK_THROUGH_ENTITIES_FLAG, true);
  // Like Vorkath's spawn: a roaming radius, so the engine's pursuit actually walks it in.
  minion.getMovementCoordinator?.().setRadius?.(30);
  minion.setMultiCombat?.(true);
  area?.add?.(minion);
  core.World.getAddNPCQueue().push(minion);
  session.minions.push(minion);
  const target = session.fighter ?? null;
  if (target) {
    // Captured: the hatchling holds for three ticks, then goes for the player; the engine's
    // own pursuit walks it in (through bodies, flag above), like Vorkath's spawn.
    later(3, minion, () => {
      if (!alive(minion) || !alive(target)) return;
      minion.setTarget?.(target);
      minion.getCombat?.().attack?.(target);
    });
  }
}

/** Everything still standing crumbles when the boss dies: eggs (11508) and minions go. */
function crumbleAll(bossNpc) {
  const session = sessionOf(bossNpc);
  if (!session) return;
  for (const entry of session.eggs) {
    if (!alive(entry.npc)) continue;
    entry.npc.performAnimation(new core.Animation(EGG_DEATH_ANIMATION));
    core.World.getRemoveNPCQueue().push(entry.npc);
  }
  for (const minion of session.minions) {
    if (alive(minion)) core.World.getRemoveNPCQueue().push(minion);
  }
  session.minions.length = 0;
}

/** The Ruptura's burst: 11510, then 2 ticks later the spider and boss both take it. */
function explodeRuptura(npc, target) {
  if (npc.getAttribute?.(RUPTURA_BURST_ATTRIBUTE) === true) return;
  npc.setAttribute?.(RUPTURA_BURST_ATTRIBUTE, true);
  npc.getMovementQueue?.().setBlockMovement?.(true);
  npc.performAnimation(new core.Animation(RUPTURA_ANIMATION));
  const location = { x: npc.getLocation().getX(), y: npc.getLocation().getY() };
  later(2, npc, () => {
    const session = sessionOf(npc);
    const boss = session?.npc ?? null;
    if (alive(boss)) {
      const centre = core.Projectile.centreOf(boss);
      const distance = Math.max(
        Math.abs(centre.getX() - location.x),
        Math.abs(centre.getY() - location.y),
      );
      if (distance <= RUPTURA_BOSS_RANGE) {
        boss.getCombat().getHitQueue().addPendingDamage([
          new core.HitDamage(Shared.RUPTURA_BOSS_DAMAGE_CLOSE, core.HitMask.BLUE),
        ]);
      } else if (distance <= RUPTURA_BOSS_RANGE_FAR) {
        boss.getCombat().getHitQueue().addPendingDamage([
          new core.HitDamage(Shared.RUPTURA_BOSS_DAMAGE_FAR, core.HitMask.BLUE),
        ]);
      }
    }
    if (alive(target)) {
      const pos = target.getLocation();
      const distance = Math.max(Math.abs(pos.getX() - location.x), Math.abs(pos.getY() - location.y));
      if (distance <= 4) {
        const damage = Shared.RUPTURA_PLAYER_DAMAGE[Math.max(0, Math.min(2, distance - 2))];
        target.getCombat().getHitQueue().addPendingDamage([new core.HitDamage(damage, core.HitMask.RED)]);
      }
    }
    core.World.getRemoveNPCQueue().push(npc);
  });
}

/** Weapon names that one-shot araxytes and eggs (Near-Reality; the Wiki lists the halberd). */
function instantKillWeapon(player) {
  const weapon = player?.getEquipment?.().getWeapon?.();
  const name = weapon && weapon.getId?.() >= 0 ? weapon.getDefinition?.()?.getName?.() ?? "" : "";
  const lowered = name.toLowerCase();
  return INSTANT_KILL_WEAPONS.some((entry) => lowered.includes(entry));
}

/** One-shots, then the Mirrorback's reflection: half back at melee attackers. */
function modifyHit(event) {
  const { npc, hit } = event;
  const id = npc?.getId?.();
  if (!id) return;
  const isEgg = id === Shared.EGG_ID.mirrorback || id === Shared.EGG_ID.ruptura || id === Shared.EGG_ID.acidic;
  const isMinion = id === Shared.MINION_ID.mirrorback || id === Shared.MINION_ID.ruptura || id === Shared.MINION_ID.acidic;
  if (!isEgg && !isMinion) return;
  const attacker = hit.getAttacker?.();
  const hits = hit.getHits?.() ?? [];
  if (hits.length === 0) return;
  if (attacker?.isPlayer?.() && instantKillWeapon(attacker.getAsPlayer())) {
    const hp = npc.getHitpoints?.() ?? 0;
    for (let index = 0; index < hits.length; index++) {
      hits[index].setDamage(index === 0 ? Math.max(1, hp) : 0);
    }
    hit.updateTotalDamage?.();
  }
  if (id !== Shared.MINION_ID.mirrorback || !attacker?.isPlayer?.()) return;
  const player = attacker.getAsPlayer();
  if (instantKillWeapon(player)) return;
  const type = hit.getCombatType?.();
  if (type === core.CombatType.MAGIC || type === core.CombatType.RANGED) return;
  const damage = hits.reduce((total, part) => total + (part.getDamage?.() ?? 0), 0);
  if (damage <= 1) return;
  player.getCombat().getHitQueue().addPendingDamage([
    new core.HitDamage(Math.floor(damage / 2), core.HitMask.RED),
  ]);
}

/** The eggs themselves are inert: no attacks, no retaliation. */
function eggClass() {
  const { CombatMethod, CombatType } = core;
  return class AraxyteEggCombat extends CombatMethod {
    start() {}

    hits() {
      return [];
    }

    attackDistance() {
      return 1;
    }

    attackSpeed() {
      return 1;
    }

    type() {
      return CombatType.MELEE;
    }
  };
}

function minionClass() {
  const { CombatMethod, CombatType } = core;
  return class AraxyteCombat extends CombatMethod {
    start(character, target) {
      const npc = character?.getAsNpc?.();
      this.npc = npc ?? null;
      if (!npc || !target) return;
      const id = npc.getId();
      if (id === Shared.MINION_ID.ruptura) {
        const pos = target.getLocation();
        const base = npc.getLocation();
        const distance = Math.max(Math.abs(pos.getX() - base.getX()), Math.abs(pos.getY() - base.getY()));
        if (distance <= 2) {
          this.attack = "burst";
          explodeRuptura(npc, target);
        }
        return;
      }
      if (id === Shared.MINION_ID.acidic) {
        this.attack = "ranged";
        npc.performAnimation(new core.Animation(11498));
        const from = npc.getLocation();
        const to = target.getLocation();
        const flight = 30 + 20 * Math.max(1, from.getDistance(to));
        new core.Projectile(
          from, to, target, Shared.MINION_PROJECTILE, 30, flight, 30, 0, npc.getPrivateArea(),
        ).sendProjectile();
        this.shotDelay = Math.ceil(flight / 30);
        return;
      }
      this.attack = "melee";
      npc.performAnimation(new core.Animation(11500));
    }

    hits(character, target) {
      if (!character || !target || !this.attack || this.attack === "burst") return [];
      const ranged = this.attack === "ranged";
      const hit = new core.PendingHit(character, target, this, ranged ? { delay: this.shotDelay ?? 1 } : 0);
      hit.setTotalDamage(Math.min(Shared.MINION_MAX, hit.getTotalDamage()));
      return [hit];
    }

    attackDistance() {
      return this.npc?.getId?.() === Shared.MINION_ID.acidic ? 7 : 2;
    }

    attackSpeed() {
      return this.npc?.getId?.() === Shared.MINION_ID.ruptura ? 2 : 6;
    }

    type() {
      return this.attack === "ranged" ? CombatType.RANGED : CombatType.MELEE;
    }
  };
}

function attach(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
  pluginApi.onNpcHitModify(modifyHit);
  pluginApi.registerNpcCombatMethodProvider(
    [core.NpcIdentifiers.EGG_10, core.NpcIdentifiers.EGG_11, core.NpcIdentifiers.EGG_12],
    eggClass(),
    { singleton: true },
  );
  pluginApi.registerNpcCombatMethodProvider(
    [core.NpcIdentifiers.MIRRORBACK_ARAXYTE, core.NpcIdentifiers.RUPTURA_ARAXYTE, core.NpcIdentifiers.ACIDIC_ARAXYTE],
    minionClass(),
    { singleton: false },
  );
}

module.exports = {
  attach,
  spawnEggs,
  hatchNext,
  crumbleAll,
  explodeRuptura,
  modifyHit,
  instantKillWeapon,
  minionClass,
  eggClass,
  _test: { instantKillWeapon },
};
