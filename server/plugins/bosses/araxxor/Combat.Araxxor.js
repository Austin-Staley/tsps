/**
 * Araxxor's combat method: melee/magic/ranged standards, the every-seventh-attack special,
 * enrage at 25% (cleave replaces melee) and the prayer caps and on-hit drains.
 *
 * Shape follows the Vorkath method: start() chooses and performs (animations and
 * projectiles only), hits() builds the PendingHits, handleAfterHitEffects() lands the
 * side-effects when the hit does. Counters live on NPC attributes (the method is rebuilt
 * every attack); the ticking fight engine (hatch timing, pools, the ball) is in
 * Specials.Araxxor.js.
 *
 * As captured: standards every 6 ticks, the special replaces every 7th attack (first at
 * attack 7), ranged fires projectile 2924 from the middle, magic has none, and no hit lands
 * through Protect from Melee for more than 5 (Wiki).
 */
const Shared = require("./Shared.Araxxor");
const Specials = require("./Specials.Araxxor");

const BOSS_ANIMATIONS = Object.freeze({ melee: 11480, magic: 11479, ranged: 11478, cleave: 11487, enrage: 11488, enraged: 11489 });

let api = null;
let core = null;
let PrayerHandler = null;

function afterTicks(ticks, target, execFunc) {
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

function alive(entity) {
  return !!entity?.isRegistered?.() && (entity.getHitpoints?.() ?? 1) > 0;
}

function isAdjacent(npc, target) {
  const base = npc.getLocation();
  const pos = target.getLocation();
  return Shared.edgeDistance(base.getX(), base.getY(), pos.getX(), pos.getY()) <= 1
    && !Shared.underBoss(base.getX(), base.getY(), pos.getX(), pos.getY());
}

/** Protect prayers currently up on the target. */
function protections(target) {
  if (!target?.isPlayer?.()) return { melee: false, ranged: false, magic: false };
  const player = target.getAsPlayer();
  return {
    melee: PrayerHandler.isActivated(player, PrayerHandler.PROTECT_FROM_MELEE),
    ranged: PrayerHandler.isActivated(player, PrayerHandler.PROTECT_FROM_MISSILES),
    magic: PrayerHandler.isActivated(player, PrayerHandler.PROTECT_FROM_MAGIC),
  };
}

/** Range when the player's ranged defence is the lower of the two, magic otherwise (Near-Reality). */
function chooseDistantAttack(player) {
  const BonusManager = api.getBonusManager();
  const defence = core.AccuracyFormulasDpsCalc.defenceBonus;
  const rangedDefence = defence(player, BonusManager.DEFENCE_RANGE);
  const magicDefence = defence(player, BonusManager.DEFENCE_MAGIC);
  return rangedDefence < magicDefence ? Shared.Attack.RANGED : Shared.Attack.MAGIC;
}

/** Captured flight for the ranged blob: a 30-cycle wind-up, then about a tick per tile. */
function sendBlob(npc, target) {
  const from = core.Projectile.centreOf(npc);
  const to = target.getLocation();
  const distance = Math.max(1, from.getDistance(to));
  const duration = 30 + 30 * distance;
  new core.Projectile(
    from, to, target, Shared.ACID_PROJECTILE, 30, duration, 35, 20, npc.getPrivateArea(),
  ).sendProjectile();
  return Math.ceil(duration / 30);
}

function drainSkill(player, skill, factor) {
  const skills = player?.getSkillManager?.();
  if (!skills) return;
  const current = skills.getCurrentLevel?.(skill);
  if (!Number.isFinite(current) || current <= 0) return;
  skills.setCurrentLevels?.(skill, Math.max(0, current - Math.ceil(current * factor)));
}

/** Hits that would take Araxxor past the threshold flip her into the enrage. */
function checkEnrage(npc) {
  if (!alive(npc) || npc.getAttribute?.(Shared.ATTR_DYING) === true) return;
  if (npc.getAttribute?.(Shared.ATTR_ENRAGED) === true) return;
  const hp = npc.getHitpoints?.() ?? 0;
  if (hp > Math.floor(Shared.MAX_HITPOINTS * Shared.ENRAGE_THRESHOLD)) return;
  npc.setAttribute(Shared.ATTR_ENRAGED, true);
  npc.performAnimation(new core.Animation(BOSS_ANIMATIONS.enrage));
  npc.getMovementQueue?.().setBlockMovement?.(true);
  afterTicks(2, npc, () => {
    if (!alive(npc)) return;
    npc.performAnimation(new core.Animation(BOSS_ANIMATIONS.enraged));
    npc.getMovementQueue?.().setBlockMovement?.(false);
  });
}

/**
 * The enraged melee: "Skree!", a 1-tick wind-up, then the crush on the tile the target stood
 * on (step away to dodge), with a line of acid pools either side of the blow.
 */
function startCleave(npc, target) {
  const tile = { x: target.getLocation().getX(), y: target.getLocation().getY() };
  npc.performAnimation(new core.Animation(BOSS_ANIMATIONS.cleave));
  npc.forceChat?.("Skree!");
  // Captured with the say: spotanim 1542 at height 92 on the boss.
  const cleaveGfx = new core.Graphic(1542);
  cleaveGfx.height = 92;
  npc.performGraphic(cleaveGfx);
  npc.getMovementQueue?.().setBlockMovement?.(true);
  const base = npc.getLocation();
  const dx = Math.sign(tile.x - (base.getX() + 3));
  const dy = Math.sign(tile.y - (base.getY() + 3));
  afterTicks(1, target, () => {
    npc.getMovementQueue?.().setBlockMovement?.(false);
    if (!alive(npc)) return;
    if (alive(target)) {
      const now = target.getLocation();
      if (now.getX() === tile.x && now.getY() === tile.y) {
        const protect = protections(target).melee;
        const rolled = core.Misc.getRandom(Shared.MELEE_MAX);
        const damage = protect ? Math.min(rolled, Shared.PROTECT_MELEE_CAP) : rolled;
        if (damage > 0) {
          target.getCombat().getHitQueue().addPendingDamage([new core.HitDamage(damage, core.HitMask.RED)]);
        }
      }
    }
    for (const [x, y] of Shared.cleavePoolTiles(tile.x, tile.y, dx, dy)) {
      Specials.spawnPool(npc, x, y);
    }
  });
}

function combatClass() {
  const { CombatMethod, CombatType } = core;

  return class AraxxorCombat extends CombatMethod {
    start(character, target) {
      this.attack = null;
      const npc = character?.getAsNpc?.();
      this.npc = npc ?? null;
      if (!npc || npc.getId() !== Shared.BOSS_ID || !target) return;
      if (npc.getAttribute?.(Shared.ATTR_DYING) === true) {
        character.getCombat().setAttackDelay(1);
        return;
      }
      if (core.World.getProcessCycle() < (npc.getAttribute?.(Shared.ATTR_ARMED_AT) ?? 0)) {
        character.getCombat().setAttackDelay(1);
        return;
      }
      const attacks = (npc.getAttribute?.(Shared.ATTR_ATTACKS) ?? 0) + 1;
      npc.setAttribute(Shared.ATTR_ATTACKS, attacks);
      if (attacks % Shared.SPECIAL_EVERY_ATTACKS === 0) {
        Specials.startSpecial(npc, target);
        return;
      }
      if (npc.getAttribute?.(Shared.ATTR_ENRAGED) === true && isAdjacent(npc, target)) {
        this.attack = Shared.Attack.CLEAVE;
        startCleave(npc, target);
        return;
      }
      this.attack = isAdjacent(npc, target)
        ? Shared.Attack.MELEE
        : chooseDistantAttack(target.getAsPlayer());
      if (this.attack === Shared.Attack.MELEE) {
        npc.performAnimation(new core.Animation(BOSS_ANIMATIONS.melee));
      } else {
        npc.performAnimation(new core.Animation(
          this.attack === Shared.Attack.RANGED ? BOSS_ANIMATIONS.ranged : BOSS_ANIMATIONS.magic,
        ));
        this.shotDelay = this.attack === Shared.Attack.RANGED ? sendBlob(npc, target) : 1;
      }
    }

    hits(character, target) {
      if (!character || !target) return [];
      if (!this.attack || this.attack === Shared.Attack.CLEAVE) return [];
      const protect = protections(target);
      if (this.attack === Shared.Attack.MELEE) {
        const hit = new core.PendingHit(character, target, this, 0);
        const rolled = Math.min(Shared.MELEE_MAX, hit.getTotalDamage());
        hit.setTotalDamage(protect.melee ? Math.min(rolled, Shared.PROTECT_MELEE_CAP) : rolled);
        return [hit];
      }
      const ranged = this.attack === Shared.Attack.RANGED;
      const delay = this.shotDelay ?? 1;
      const hit = new core.PendingHit(character, target, this, { delay });
      const rolled = Math.min(ranged ? Shared.RANGED_MAX : Shared.MAGIC_MAX, hit.getTotalDamage());
      const factor = ranged ? protect.ranged : protect.magic;
      const prayerReduced = ranged ? Shared.PROTECT_RANGED_FACTOR : Shared.PROTECT_MAGIC_FACTOR;
      hit.setTotalDamage(factor ? Math.floor(rolled * prayerReduced) : rolled);
      hit.araxxorKind = this.attack;
      return [hit];
    }

    handleAfterHitEffects(hit) {
      const target = hit?.getTarget?.();
      if (!target?.isPlayer?.()) return;
      const player = target.getAsPlayer();
      if (hit.araxxorKind === Shared.Attack.RANGED) drainSkill(player, core.Skill.DEFENCE, Shared.DRAIN_RANGED_DEFENCE);
      else if (hit.araxxorKind === Shared.Attack.MAGIC) drainSkill(player, core.Skill.PRAYER, Shared.DRAIN_MAGIC_PRAYER);
    }

    attackDistance() {
      return Shared.ATTACK_DISTANCE;
    }

    attackSpeed() {
      return this.npc?.getAttribute?.(Shared.ATTR_ENRAGED) === true
        ? Shared.ENRAGED_SPEED_TICKS
        : Shared.ATTACK_SPEED_TICKS;
    }

    /**
     * The engine asks type() before start() picks this cycle's attack, so it must read the
     * distance itself: melee reach next to the player, magic/ranged from further out. With
     * the stale last-attack type the boss would only ever walk in for melee.
     */
    type() {
      const npc = this.npc;
      const target = npc?.getCombat?.().getTarget?.() ?? null;
      if (npc && target) {
        if (isAdjacent(npc, target)) return CombatType.MELEE;
        return target.isPlayer?.() && chooseDistantAttack(target.getAsPlayer()) === Shared.Attack.RANGED
          ? CombatType.RANGED
          : CombatType.MAGIC;
      }
      if (this.attack === Shared.Attack.MELEE || this.attack === Shared.Attack.CLEAVE) return CombatType.MELEE;
      if (this.attack === Shared.Attack.RANGED) return CombatType.RANGED;
      return CombatType.MAGIC;
    }
  };
}

/**
 * Damage rules for everything hitting Araxxor: venom immunity, hits during the death
 * sequence are discarded, and the enrage flips when the threshold is crossed.
 */
function modifyHit(event) {
  const { npc, hit } = event;
  if (!npc || npc.getId?.() !== Shared.BOSS_ID) return;
  if (npc.isVenomed?.() || npc.isPoisoned?.()) {
    npc.setVenomed?.(false);
    npc.setPoisonDamage?.(0);
  }
  if (npc.getAttribute?.(Shared.ATTR_DYING) === true) {
    const hits = hit.getHits?.() ?? [];
    for (const part of hits) part.setDamage(0);
    hit.updateTotalDamage?.();
    return;
  }
  checkEnrage(npc);
}

function attach(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
  PrayerHandler = pluginApi.getPrayerHandler();
  pluginApi.onNpcHitModify(modifyHit);
  pluginApi.registerNpcCombatMethodProvider(
    [core.NpcIdentifiers.ARAXXOR],
    combatClass(),
    { singleton: false },
  );
}

module.exports = {
  attach,
  modifyHit,
  combatClass,
  isAdjacent,
  protections,
  chooseDistantAttack,
  checkEnrage,
  startCleave,
  drainSkill,
  _test: { isAdjacent, protections, chooseDistantAttack },
};
