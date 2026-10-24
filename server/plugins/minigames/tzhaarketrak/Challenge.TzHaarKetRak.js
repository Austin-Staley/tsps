/**
 * A challenge (Wiki: TzHaar-Ket-Rak's_Challenges): a private copy of the Inferno arena with as many
 * JalTok-Jads as the challenge's number, fought alone.
 * - Challenges 1 and 2 are open to anyone; 3 and up need TzKal-Zuk beaten, and each needs the one
 *   before it completed.
 * - The Jads fight as the Inferno's (Monsters.Inferno.js), their first attacks a few ticks apart.
 *   Each brings Yt-HurKot at half health (Wiki Yt-HurKot): they walk to it and heal it until drawn
 *   off, and do not come again.
 * - Killing every Jad completes it: the player is back by TzHaar-Ket-Rak for the reward
 *   (Rewards.TzHaarKetRak.js). Dying, the cave exit, teleporting or logging out fails it. It is a
 *   safe activity: nothing is lost on death.
 */
const Common = require("./Common.TzHaarKetRak");

const CHALLENGE_ATTRIBUTE = "tzhaar-ket-rak:challenge";

let ChallengeArea = null;
let hooks = { completed() {}, failed() {}, refused() {} };

class Challenge {
  constructor(player, number) {
    this.player = player;
    this.number = number;
    this.area = new ChallengeArea(this);
    this.jads = [];
    this.spawned = [];
    this.startTick = Common.cycle();
    this.endAt = -1;
    this.over = false;
    /** For Combat Achievements: styles dealt, per Jad and overall, and the inventory kept empty. */
    this.styles = new Map();
    this.nonMelee = false;
    this.emptyInventory = true;
  }

  spawnJads() {
    const { api, data, ids } = Common;
    for (let index = 0; index < this.number; index++) {
      const [x, y] = data.arena.jads[index];
      const npc = api.spawnNpc({ id: ids.npcs.jad, x, y, z: 0, owner: this.player, wanderRadius: 0 });
      if (!npc) continue;
      npc.__skipDefaultRespawn = true;
      npc.__tkrChallenge = this;
      this.spawned.push(npc);
      this.area.add(npc);
      npc.getCombat().setAttackDelay(data.jadFirstAttackTicks + index * data.jadStaggerTicks);
      npc.getCombat().attack(this.player);
      this.jads.push({ npc, healers: [], called: false });
    }
  }

  spawnHealers(entry) {
    const { api, data, ids } = Common;
    const at = entry.npc.getLocation();
    const size = entry.npc.getSize?.() ?? 5;
    const ring = [[-1, -1], [size, -1], [-1, size], [size, size], [Math.floor(size / 2), -1]];
    for (let index = 0; index < data.healers.perJad; index++) {
      const [dx, dy] = ring[index % ring.length];
      const healer = api.spawnNpc({ id: ids.npcs.healer, x: at.getX() + dx, y: at.getY() + dy, z: 0, owner: this.player, wanderRadius: 0 });
      if (!healer) continue;
      healer.__skipDefaultRespawn = true;
      healer.__tkrChallenge = this;
      this.spawned.push(healer);
      this.area.add(healer);
      entry.healers.push(healer);
    }
  }

  /** Yt-HurKot: at half health, once; they heal in melee reach (or a few tiles while fighting). */
  tendHealers(entry) {
    const { core, data } = Common;
    const { npc: jad } = entry;
    entry.healers = entry.healers.filter((healer) => healer.getHitpoints() > 0 && healer.isRegistered());
    const max = jad.getDefinition().getHitpoints();
    if (!entry.called && jad.getHitpoints() <= max / 2) {
      entry.called = true;
      this.spawnHealers(entry);
    }
    const now = Common.cycle();
    for (const healer of entry.healers) {
      const fighting = healer.getCombat().getTarget() != null;
      const distance = healer.calculateDistance(jad);
      if (distance <= data.healers.reach || (fighting && distance <= data.healers.fightReach)) {
        if (now % data.healers.healTicks === 0 && jad.getHitpoints() < max) {
          healer.setMobileInteraction(jad);
          healer.performAnimation(new core.Animation(data.healers.healAnim));
          jad.performGraphic(new core.Graphic(data.healers.healGraphic));
          jad.heal(Math.min(max - jad.getHitpoints(), Common.randomInt(data.healers.healMin, data.healers.healMax)));
        }
      } else if (!fighting) {
        core.PathFinder.calculateWalkRoute(healer, jad.getLocation().getX(), jad.getLocation().getY());
      }
    }
  }

  tick() {
    if (this.over) return;
    const player = this.player;
    if (!inventoryEmpty(player)) this.emptyInventory = false;
    for (const entry of [...this.jads]) {
      if (entry.npc.getHitpoints() <= 0 || !entry.npc.isRegistered()) {
        entry.healers.forEach((healer) => removeNpc(healer));
        this.jads = this.jads.filter((other) => other !== entry);
        continue;
      }
      if (entry.npc.getCombat().getTarget() !== player) entry.npc.getCombat().attack(player);
      this.tendHealers(entry);
    }
    if (this.jads.length === 0 && this.endAt === -1) this.endAt = Common.cycle() + Common.data.endTicks;
    // A player going down to a last hit in flight is left to the death path, which counts the win.
    if (dying(player)) return;
    if (this.endAt !== -1 && Common.cycle() >= this.endAt) complete(player);
  }

  /** Ticks from the start to the last Jad's death. */
  elapsedTicks() {
    return (this.endAt === -1 ? Common.cycle() : this.endAt - Common.data.endTicks) - this.startTick;
  }

  dealt(target, style) {
    if (style !== "MELEE") this.nonMelee = true;
    if (!target?.__tkrChallenge || target.getId?.() !== Common.ids.npcs.jad) return;
    if (!this.styles.has(target)) this.styles.set(target, new Set());
    this.styles.get(target).add(style);
  }

  /** Every Jad and healer it spawned, its hits still in flight cancelled with it. */
  destroy() {
    this.over = true;
    const { TaskManager } = Common.core;
    for (const npc of this.spawned) TaskManager.cancelTasks(npc);
    for (const entry of this.jads) entry.healers.forEach((healer) => removeNpc(healer));
    this.area.destroy();
  }

  /** The arena copy without the Inferno's rocky supports (none in the challenges). */
  clearSupports() {
    const { GameObject, ObjectManager } = Common.core;
    for (const [id, x, y] of Common.data.arena.supports) {
      ObjectManager.deregister(new GameObject(id, Common.toLocation([x, y]), 10, 0, this.area), true);
    }
  }
}

function dying(player) {
  return player.isDyingReturn?.() === true || player.getHitpoints?.() <= 0;
}

function inventoryEmpty(player) {
  const items = player.getInventory?.()?.getItems?.() ?? [];
  return items.every((item) => !item || (item.getId?.() ?? -1) < 0 || (item.getAmount?.() ?? 0) <= 0);
}

function removeNpc(npc) {
  if (npc?.isRegistered?.()) Common.api.removeNpc(npc);
}

function defineArea() {
  const { PrivateArea, Boundary } = Common.core;
  const [minX, maxX, minY, maxY] = Common.data.arena.bounds;
  ChallengeArea = class TzHaarKetRakChallenge extends PrivateArea {
    constructor(challenge) {
      super([new Boundary(minX, maxX, minY, maxY, 0)]);
      this.challenge = challenge;
    }

    getName() {
      return "TzHaar-Ket-Rak's Challenge";
    }

    destroy() {
      if (this.isDestroyed?.() === true) return;
      const { World } = Common.core;
      const addQueue = World.getAddNPCQueue();
      const removeQueue = World.getRemoveNPCQueue();
      for (const entity of this.entities ?? []) {
        if (!entity?.isNpc?.()) continue;
        const npc = entity.getAsNpc();
        for (let i = addQueue.indexOf(npc); i !== -1; i = addQueue.indexOf(npc)) addQueue.splice(i, 1);
        if (npc.isRegistered?.() && !removeQueue.includes(npc)) removeQueue.push(npc);
      }
      super.destroy();
    }

    /** The challenge runs on the player's tick. */
    process(mobile) {
      if (mobile === this.challenge.player) this.challenge.tick();
    }

    postLeave(mobile, logout) {
      if (mobile?.isPlayer?.() && mobile === this.challenge.player && !this.challenge.over) {
        fail(mobile, { logout });
      }
      super.postLeave(mobile, logout);
    }

    canTeleport() {
      return null;
    }

    isMulti() {
      return true;
    }
  };
}

function challengeOf(player) {
  const challenge = player?.getAttribute?.(CHALLENGE_ATTRIBUTE);
  return challenge instanceof Challenge && !challenge.over ? challenge : null;
}

/** Out by TzHaar-Ket-Rak, the copy gone. */
function end(player) {
  const challenge = player.getAttribute?.(CHALLENGE_ATTRIBUTE);
  player.setAttribute?.(CHALLENGE_ATTRIBUTE, null);
  if (!(challenge instanceof Challenge)) return null;
  challenge.over = true;
  if (player.getArea?.() === challenge.area) {
    challenge.area.leave(player, false);
    if (player.getArea?.() === challenge.area) player.setArea(null);
  }
  challenge.destroy();
  player.getCombat?.().reset?.();
  player.moveTo(Common.toLocation(Common.data.outside));
  return challenge;
}

function complete(player) {
  const challenge = end(player);
  if (challenge) hooks.completed(player, challenge);
}

function fail(player, { logout = false } = {}) {
  const challenge = end(player);
  if (challenge) hooks.failed(player, challenge, { logout });
}

/** Why the player can't take on challenge n, or null. */
function refusal(player, number) {
  if (number > 1 && Common.completions(player, number - 1) === 0) return "needPrevious";
  if (number >= Common.data.infernoChallenge && !Common.defeatedZuk(player)) return "needZuk";
  return null;
}

function start(player, number) {
  if (challengeOf(player)) return null;
  const reason = refusal(player, number);
  if (reason) {
    hooks.refused(player, number, reason);
    return null;
  }
  const challenge = new Challenge(player, number);
  player.setAttribute(CHALLENGE_ATTRIBUTE, challenge);
  player.moveTo(Common.toLocation(Common.data.arena.player));
  const current = player.getArea?.();
  if (current && current !== challenge.area) current.leave(player, false);
  challenge.area.enter(player);
  challenge.clearSupports();
  challenge.spawnJads();
  return challenge;
}

// --- Hooks ---------------------------------------------------------------------------------------

/**
 * Death: nothing lost, back outside with the failure line - unless every Jad was already down,
 * which still counts as the win (as the Inferno counts falling after TzKal-Zuk).
 */
function onDeath(event) {
  const challenge = challengeOf(event.player);
  if (!challenge) return;
  event.handled = true;
  if (challenge.jads.length === 0 && challenge.endAt !== -1) complete(event.player);
  else fail(event.player);
}

function keepItems(event) {
  if (challengeOf(event.player)) event.shouldDrop = false;
}

function noTeleport(event) {
  if (!challengeOf(event.player)) return;
  event.player.sendMessage(Common.data.messages.noTeleport);
  event.allow = false;
}

/** The arena's cave exit (the Inferno's own handler steps aside outside an Inferno run). */
function exitCave({ player }) {
  if (!challengeOf(player)) return false;
  fail(player);
  return true;
}

function leaveWorld({ player }) {
  if (challengeOf(player)) fail(player, { logout: true });
}

function dealt({ player, target, hit }) {
  const challenge = challengeOf(player);
  // CombatType is a numeric enum: its reverse mapping gives the name.
  if (challenge) challenge.dealt(target, String(Common.core.CombatType[hit?.getCombatType?.()] ?? ""));
}

function attach(api, handlers) {
  hooks = { ...hooks, ...handlers };
  defineArea();
  api.onPlayerDeath(onDeath);
  api.onShouldDropItemsOnDeath(keepItems);
  api.onCanTeleport(noTeleport);
  api.onObjectFirstClick(Common.ids.locs.exit, exitCave);
  api.onObjectSecondClick(Common.ids.locs.exit, exitCave);
  api.onPlayerLogout(leaveWorld);
  api.onPlayerDisconnect(leaveWorld);
  api.onPlayerDealtDamage(dealt);
}

module.exports = {
  attach, start, refusal, challengeOf, complete, fail, end, Challenge, inventoryEmpty, CHALLENGE_ATTRIBUTE,
  onDeath, keepItems, noTeleport, exitCave, leaveWorld, dealt,
  _defineArea: defineArea,
};
