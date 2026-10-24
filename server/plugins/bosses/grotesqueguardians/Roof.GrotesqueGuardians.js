/**
 * The Slayer Tower roof (Wiki: Grotesque Guardians/Strategies), a private copy per player
 * (the engine's PrivateArea pattern, as Vorkath's crater):
 * - the Roof Entrance on the tower's top floor is locked until a brittle key (slayer_roof_key)
 *   opens it for good (varbit gargboss_unlocked_roof); then it takes the player up;
 * - ringing the Cloister Bell (Ring / Quick-start) wakes the statues: Dusk and Dawn come down from
 *   their plinths, for a player on a gargoyle or Guardians task; ringing again mid-fight:
 *   "Concentrate on your fight!";
 * - the Roof Exit (Escape / Quick-escape), a teleport, death or logging out ends the copy, and a
 *   player logging out on the roof comes back by the entrance;
 * - weapons: Dusk only takes melee, Dawn only ranged, magic or a halberd's melee; neither can be
 *   hurt while the fight says so (Fight.GrotesqueGuardians.js).
 */
const Common = require("./Common.GrotesqueGuardians");
const { Fight } = require("./Fight.GrotesqueGuardians");

const ROOF_ATTRIBUTE = "grotesque-guardians:roof";

let RoofClass = null;

class Roof {
  constructor(player) {
    this.player = player;
    const [minX, maxX, minY, maxY] = Common.data.roof.floor;
    this.floor = { minX, maxX, minY, maxY };
    this.area = new RoofClass(this);
    this.fight = null;
    this.dusk = null;
    this.dawn = null;
  }

  /** Whether a tile is on the walkable roof (where hazards can fall). */
  contains(location) {
    const { minX, maxX, minY, maxY } = this.floor;
    const x = location.getX();
    const y = location.getY();
    return location.getZ() === 0 && x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  players() {
    return this.player.isRegistered?.() !== false && this.area.getPlayers().includes(this.player) ? [this.player] : [];
  }

  spawn(id, tile) {
    const { NPC, World } = Common.core;
    const npc = NPC.create(id, Common.toLocation(tile));
    npc.__skipDefaultRespawn = true;
    npc.__ggRoof = this;
    npc.setFlag?.("combat:no-regen");
    npc.getMovementCoordinator?.().setRadius?.(10);
    this.area.add(npc);
    World.getAddNPCQueue().push(npc);
    return npc;
  }

  /** The bell: both statues come down and the fight starts. */
  start() {
    const { ids, data } = Common;
    const sender = this.player.getPacketSender();
    sender.sendVarbit(ids.varbits.duskStatueHidden, 1);
    sender.sendVarbit(ids.varbits.dawnStatueHidden, 1);
    this.dusk = this.spawn(ids.npcs.duskPhase1, data.roof.dusk);
    this.dawn = this.spawn(ids.npcs.dawnPhase1, data.roof.dawn);
    this.dusk.performAnimation(new Common.core.Animation(ids.seqs.duskSpawn));
    this.dawn.performAnimation(new Common.core.Animation(ids.seqs.dawnSpawn));
    this.fight = new Fight(this, this.dusk, this.dawn);
  }

  fighting() {
    return Boolean(this.fight && !this.fight.stopped);
  }

  /** Both Guardians gone and the statues back (a refused bell, or after the kill). */
  clearGuardians() {
    const addQueue = Common.core.World.getAddNPCQueue();
    const removeQueue = Common.core.World.getRemoveNPCQueue();
    for (const npc of [this.dusk, this.dawn]) {
      if (!npc) continue;
      // Spawned this tick (a refused bell): still waiting to be added.
      for (let index = addQueue.indexOf(npc); index !== -1; index = addQueue.indexOf(npc)) addQueue.splice(index, 1);
      if (npc.isRegistered?.() && !removeQueue.includes(npc)) removeQueue.push(npc);
      this.area.detach?.(npc);
    }
    this.dusk = null;
    this.dawn = null;
    this.reset();
  }

  /** After the kill: the statues back on their plinths, ready for the bell. */
  reset() {
    this.fight?.stop();
    this.fight = null;
    const sender = this.player.getPacketSender();
    sender.sendVarbit(Common.ids.varbits.duskStatueHidden, 0);
    sender.sendVarbit(Common.ids.varbits.dawnStatueHidden, 0);
  }

  destroy() {
    this.fight?.stop();
    this.fight = null;
    this.area.destroy();
  }
}

function defineAreaClass() {
  const { PrivateArea, Boundary } = Common.core;
  RoofClass = class GuardiansRoof extends PrivateArea {
    constructor(roof) {
      const [minX, maxX, minY, maxY] = Common.data.roof.bounds;
      super([new Boundary(minX, maxX, minY, maxY, 0)]);
      this.roof = roof;
    }

    getName() {
      return "Grotesque Guardians";
    }

    destroy() {
      if (this.isDestroyed?.() === true) return;
      const addQueue = Common.core.World.getAddNPCQueue();
      const removeQueue = Common.core.World.getRemoveNPCQueue();
      for (const entity of this.entities ?? []) {
        if (!entity?.isNpc?.()) continue;
        const npc = entity.getAsNpc();
        for (let index = addQueue.indexOf(npc); index !== -1; index = addQueue.indexOf(npc)) addQueue.splice(index, 1);
        if (npc.isRegistered?.() && !removeQueue.includes(npc)) removeQueue.push(npc);
      }
      super.destroy();
    }

    process(mobile) {
      const roof = this.roof;
      // The fight runs on the player's tick: an idle NPC isn't processed until something wakes it.
      if (mobile !== roof.player || !roof.fighting()) return;
      const players = roof.players();
      for (const guardian of [roof.dusk, roof.dawn]) {
        // Dawn in the sky (phase 2) doesn't chase the player round the roof.
        if (guardian === roof.dawn && roof.fight.phase === 2) continue;
        if (guardian && players[0] && guardian.getHitpoints() > 0 && guardian.getCombat().getTarget() !== players[0]) guardian.getCombat().attack(players[0]);
      }
      roof.fight.tick(players);
    }

    postLeave(mobile, logout) {
      if (mobile?.isPlayer?.() && mobile === this.roof.player) {
        if (logout) mobile.moveTo(Common.toLocation(Common.data.roof.outside));
        leaveRoof(mobile);
      }
      super.postLeave(mobile, logout);
    }

    isMulti() {
      return true;
    }
  };
}

function roofOf(player) {
  const roof = player.getAttribute?.(ROOF_ATTRIBUTE);
  return roof instanceof Roof && roof.area.isDestroyed?.() !== true ? roof : null;
}

function leaveRoof(player) {
  const roof = player.getAttribute?.(ROOF_ATTRIBUTE);
  player.setAttribute?.(ROOF_ATTRIBUTE, null);
  if (roof instanceof Roof) roof.destroy();
}

function goUp(player) {
  leaveRoof(player);
  const roof = new Roof(player);
  player.setAttribute(ROOF_ATTRIBUTE, roof);
  player.moveTo(Common.toLocation(Common.data.roof.arrive));
  const current = player.getArea?.();
  if (current && current !== roof.area) current.leave(player, false);
  roof.area.enter(player);
  return roof;
}

// --- The tower's top floor

function unlocked(player) {
  return player.getAttribute(Common.UNLOCKED_ATTRIBUTE) === true;
}

function sendUnlocked(player) {
  player.getPacketSender().sendVarbit(Common.ids.varbits.unlocked, unlocked(player) ? 1 : 0);
}

/** The Roof Entrance: Unlock with the brittle key, then Go-through. */
function entrance({ player, objectId }) {
  if (objectId !== Common.ids.locs.entrance) return false;
  if (!unlocked(player)) {
    const key = Common.ids.items.key;
    if (!player.getInventory().contains(key)) {
      player.sendMessage(Common.message("locked"));
      return true;
    }
    player.getInventory().deleteNumber(key, 1);
    player.setAttribute(Common.UNLOCKED_ATTRIBUTE, true);
    sendUnlocked(player);
    player.sendMessage(Common.message("unlocked"));
    return true;
  }
  goUp(player);
  return true;
}

// --- The roof

function ringBell({ player, objectId }) {
  if (!Common.ids.locs.bell.includes(objectId)) return false;
  const roof = roofOf(player);
  if (!roof) return true;
  if (roof.fighting()) {
    player.sendMessage(Common.message("concentrate"));
    return true;
  }
  roof.start();
  // The task is asked about the Guardian itself (its Slayer category is the gargoyles').
  if (!Common.onTask(player, roof.dusk)) {
    roof.clearGuardians();
    player.sendMessage(Common.message("noTask"));
    return true;
  }
  player.performAnimation?.(new Common.core.Animation(Common.ids.seqs.bell));
  return true;
}

function escape({ player, objectId }) {
  if (objectId !== Common.ids.locs.exit) return false;
  player.moveTo(Common.toLocation(Common.data.roof.outside));
  leaveRoof(player);
  return true;
}

// --- Hits

function isHalberd(player) {
  const { WeaponInterfaces } = Common.core;
  return Boolean(WeaponInterfaces) && player.getWeapon?.() === WeaponInterfaces.HALBERD;
}

/** Dusk: melee only; Dawn: ranged, magic or a halberd; neither while the fight protects it. */
function guardianHit({ npc, hit }) {
  const dusk = Common.isDusk(npc);
  const dawn = Common.isDawn(npc);
  if (!dusk && !dawn) return;
  const fight = npc.__ggFight;
  const attacker = hit.getAttacker?.();
  const type = hit.getCombatType?.();
  const { CombatType } = Common.core;
  let blocked = !fight || !fight.vulnerable(npc);
  if (attacker?.isPlayer?.()) {
    const player = attacker.getAsPlayer();
    if (dusk && type !== CombatType.MELEE) blocked = true;
    if (dawn && type === CombatType.MELEE && !isHalberd(player)) blocked = true;
  }
  const parts = hit.getHits?.() ?? [];
  if (blocked) {
    for (const part of parts) part.setDamage(0);
    hit.updateTotalDamage?.();
    return;
  }
  // A hit stops at the phase's threshold: Dawn flies up, or Dusk turns defensive, at 225.
  const floor = (dawn && fight.phase === 1) || (dusk && fight.phase === 2) ? Common.data.phases.dawnFliesBelow : 0;
  if (floor <= 0) return;
  let over = parts.reduce((sum, part) => sum + part.getDamage(), 0) - Math.max(0, npc.getHitpoints() - floor);
  for (const part of [...parts].reverse()) {
    if (over <= 0) break;
    const cut = Math.min(over, part.getDamage());
    part.setDamage(part.getDamage() - cut);
    over -= cut;
  }
  hit.updateTotalDamage?.();
}

/** The world's own Dusk on the roof stays out: each player gets theirs. */
function blockWorldSpawn(event) {
  if (!Common.isDusk({ getId: () => event.npcId }) || !event.location) return;
  const [minX, maxX, minY, maxY] = Common.data.roof.bounds;
  const x = event.location.getX?.() ?? event.location.x;
  const y = event.location.getY?.() ?? event.location.y;
  if (x >= minX && x <= maxX && y >= minY && y <= maxY) event.allow = false;
}

function leaveWorld({ player }) {
  if (roofOf(player)) player.moveTo(Common.toLocation(Common.data.roof.outside));
  leaveRoof(player);
}

function onLogin({ player }) {
  sendUnlocked(player);
}

function attach(api) {
  defineAreaClass();
  api.persistAttribute(Common.UNLOCKED_ATTRIBUTE, false);
  api.onObjectInteraction("Roof Entrance", { Unlock: entrance, "Go-through": entrance });
  api.onObjectInteraction("The Cloister Bell", { Ring: ringBell, "Quick-start": ringBell });
  api.onObjectInteraction("Roof Exit", { Escape: escape, "Quick-escape": escape });
  api.onNpcHitModify(guardianHit);
  api.onCanSpawnNpc(blockWorldSpawn);
  api.onPlayerLogin(onLogin);
  api.onPlayerLogout(leaveWorld);
  api.onPlayerDisconnect(leaveWorld);
}

module.exports = { attach, Roof, roofOf, goUp, leaveRoof, entrance, ringBell, escape, guardianHit, blockWorldSpawn, isHalberd, ROOF_ATTRIBUTE };
