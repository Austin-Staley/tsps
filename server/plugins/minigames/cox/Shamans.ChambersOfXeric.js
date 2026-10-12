"use strict";

/**
 * The Lizardman Shamans' room: shamans with their surface cousins' attacks - ranged, a poison
 * blob, a crushing jump and exploding spawns - and two spawns blocking the way on until the
 * shamans are dead.
 *
 * Wiki (Lizardman shaman (Chambers of Xeric); Lizardman shaman):
 * - Their attacks are the surface shamans', the poison blob ~25% stronger: up to 39 without
 *   Shayzien armour.
 * - Two shamans for solo and small teams, up to five in large ones.
 * Not on the Wiki (to check against a capture): the tiles; counts (2, 3 at 4+, 4 at 8+); the spirit tendrils (29768) and the
 *   exit's two blocking spawns (7575) appear when someone comes within 6 tiles; attacks every
 *   4 ticks: ranged anim 7193 with projectile 1291 (base 24), the blob (projectile 1293,
 *   splash 1294, 20-35 within 2 tiles, poison 1 in 4), melee anim 7158 (base 24, crush), the
 *   jump (anim 7152, landing 6946 4 ticks later beside its target, 20-25 within a tile, then a
 *   pause); now and then (1 in 61 a tick, at most every 20 seconds) three spawns by the target
 *   that explode; the blocking spawns explode (anim 7159, gfx 1295) once the shamans are dead.
 * Not from a source: the spawns explode 6 ticks after appearing for up to 10 within a tile
 *   (the surface shaman's).
 */

const Shared = require("./CoxShared");
const Raid = require("./CoxRaid");
const Monsters = require("./CoxMonsters");

const NPC = { SHAMANS: [7573, 7574], SPAWN: 7575 };
const OBJECT = { TENDRIL: 29768 };
const BASE = { RANGED: 24, MELEE: 24 };
const ANIM = { RANGED: 7193, MELEE: 7158, JUMP: 7152, LAND: 6946, SPAWN_EXPLODE: 7159 };
/** Shayzien armour (5): gloves, boots, helm, greaves, body. */
const SHAYZIEN = [13377, 13378, 13379, 13380, 13381];

/** Cache tiles by version. */
const SHAMAN_TILES = [
  [{ x: 3273, y: 5270 }, { x: 3281, y: 5269 }, { x: 3278, y: 5262 }, { x: 3273, y: 5255 }],
  [{ x: 3306, y: 5260 }, { x: 3306, y: 5267 }, { x: 3315, y: 5267 }, { x: 3316, y: 5259 }],
  [{ x: 3340, y: 5258 }, { x: 3346, y: 5259 }, { x: 3341, y: 5268 }, { x: 3347, y: 5270 }],
];
const TENDRIL_TILES = [[{ x: 3279, y: 5249 }, { x: 3280, y: 5249 }, { x: 3289, y: 5262 }, { x: 3289, y: 5261 }], [{ x: 3311, y: 5251 }, { x: 3310, y: 5251 }], [{ x: 3342, y: 5251 }, { x: 3343, y: 5251 }]];
const BLOCKER_TILES = [
  [[{ x: 3268, y: 5263 }, { x: 3269, y: 5263 }], [{ x: 3268, y: 5264 }, { x: 3269, y: 5264 }]],
  [[{ x: 3311, y: 5275 }, { x: 3311, y: 5274 }], [{ x: 3312, y: 5275 }, { x: 3312, y: 5274 }]],
  [[{ x: 3353, y: 5265 }, { x: 3352, y: 5265 }], [{ x: 3353, y: 5264 }, { x: 3352, y: 5264 }]],
];

function shamanCount(raiders) {
  return raiders < 4 ? 2 : raiders < 8 ? 3 : 4;
}

/** The share of the blob a player takes: less for each Shayzien piece of the top tier worn. */
function blobShare(player) {
  const worn = player.getEquipment().getItems().filter((item) => SHAYZIEN.includes(item?.getId?.())).length;
  return worn >= 5 ? 0 : 1 - worn * 0.2;
}

class ShamansRoom extends Raid.Room {
  constructor(raid, record) {
    super(raid, record);
    this.shamans = [];
    this.blockers = [];
    this.tendrils = [];
    this.woken = false;
  }

  load() {
    const variant = this.record.variant;
    for (const spot of Shared.shuffle(SHAMAN_TILES[variant]).slice(0, shamanCount(this.raid.scale))) {
      const shaman = this.spawnNpc(Shared.randomOf(NPC.SHAMANS), this.tile(spot.x, spot.y, 3), { wanderRadius: 3 });
      if (shaman) this.shamans.push(shaman);
    }
    this.tendrilTiles = TENDRIL_TILES[variant].map((spot) => this.tile(spot.x, spot.y));
  }

  combatPoints() {
    return Math.floor(5 * this.shamans.reduce((sum, npc) => sum + npc.getMaxHitpoints(), 0) * 1.05);
  }

  living() {
    return this.shamans.filter((npc) => npc.isRegistered() && npc.getHitpoints() > 0);
  }

  tick() {
    if (!this.woken && this.raiders().some((player) => player.getLocation().getDistance(this.tendrilTiles[0]) <= 6)) this.wake();
    for (const shaman of this.living()) {
      if (!shaman.__coxJumping) this.engage(shaman);
      const target = shaman.getCombat().getTarget();
      if (target?.isPlayer?.() && !shaman.__coxJumping && Shared.random(0, 60) === 0 && !(shaman.__coxSpawnsAt > this.raid.ticks)) {
        shaman.__coxSpawnsAt = this.raid.ticks + 33;
        this.spawns(target.getAsPlayer());
      }
    }
  }

  wake() {
    this.woken = true;
    const { GameObject, ObjectManager } = Shared.core();
    this.tendrils = this.tendrilTiles.map((tile) => {
      const tendril = new GameObject(OBJECT.TENDRIL, tile, 10, 0, this.map);
      ObjectManager.register(tendril, true);
      return tendril;
    });
    for (const [at, face] of BLOCKER_TILES[this.record.variant]) {
      const blocker = this.spawnNpc(NPC.SPAWN, this.tile(at.x, at.y), { scale: false });
      if (!blocker) continue;
      blocker.getMovementQueue().setBlockMovement?.(true);
      blocker.setPositionToFace(this.tile(face.x, face.y));
      this.blockers.push(blocker);
    }
    this.blockerClip(true);
  }

  blockerClip(on) {
    const { RegionManager } = Shared.core();
    for (const blocker of this.blockers) {
      const at = blocker.getLocation();
      const args = [at.getX(), at.getY(), at.getZ(), RegionManager.BLOCKED_TILE, this.map];
      if (on) RegionManager.addClipping(...args);
      else RegionManager.removeClipping(...args);
    }
  }

  /** Three spawns by the target that explode. */
  spawns(player) {
    const { Location, RegionManager } = Shared.core();
    const at = player.getLocation();
    for (let i = 0; i < 3; i++) {
      let tile = at.clone();
      for (let tries = 0; tries < 20; tries++) {
        const candidate = new Location(at.getX() + Shared.random(-2, 2), at.getY() + Shared.random(-2, 2), at.getZ());
        if (!RegionManager.blocked(candidate, this.map)) {
          tile = candidate;
          break;
        }
      }
      const spawn = this.spawnNpc(NPC.SPAWN, tile, { scale: false });
      if (!spawn) continue;
      spawn.setPositionToFace(at);
      Shared.later(this.raid, 6, () => this.explode(spawn, 10));
    }
  }

  explode(spawn, max) {
    if (!spawn.isRegistered()) return;
    Shared.animate(spawn, ANIM.SPAWN_EXPLODE);
    for (const player of this.raiders()) Shared.sound(player, 665);
    Shared.later(this.raid, 2, () => {
      if (!spawn.isRegistered()) return;
      Shared.graphicAt(this.raiders(), 1295, spawn.getLocation());
      for (const player of this.raiders()) {
        if (player.getLocation().getDistance(spawn.getLocation()) <= 1) Shared.damage(player, Shared.random(0, max));
      }
      this.removeNpc(spawn);
    });
  }

  adjacent(npc, player) {
    const at = npc.getLocation();
    const x = player.getLocation().getX() - at.getX();
    const y = player.getLocation().getY() - at.getY();
    const inX = x >= 0 && x < 3;
    const inY = y >= 0 && y < 3;
    return (inX && (y === -1 || y === 3)) || (inY && (x === -1 || x === 3));
  }

  attack(npc, player) {
    let style = Shared.random(0, this.adjacent(npc, player) ? 6 : 5);
    if (style === 5 && !this.jump(npc, player)) style = this.adjacent(npc, player) ? 6 : 4;
    if (style === 5) return;
    Shared.sound(player, style === 6 ? 1695 : 385);
    if (style === 6) {
      Shared.animate(npc, ANIM.MELEE);
      Shared.strike(npc, player, "melee", Monsters.maxHitFor(npc, BASE.MELEE, Monsters.LEVELS.STRENGTH), 0);
      return;
    }
    Shared.animate(npc, ANIM.RANGED);
    if (style === 4) {
      const tile = player.getLocation().clone();
      const delay = Shared.projectile(this.map, npc, tile, 1293, { delay: 15, duration: 60, startHeight: 70, endHeight: 15 });
      Shared.later(this.raid, delay, () => {
        if (!npc.isRegistered()) return;
        Shared.graphicAt(this.raiders(), 1294, tile);
        const { CombatFactory } = Shared.core();
        for (const raider of this.raiders()) {
          if (raider.getLocation().getDistance(tile) > 2) continue;
          Shared.damage(raider, Math.floor(Shared.random(20, 39) * blobShare(raider)));
          if (Shared.random(0, 3) === 0) CombatFactory.poisonEntity(raider, 10);
        }
      });
      return;
    }
    const delay = Shared.projectile(this.map, npc, player, 1291, { delay: 15, duration: 60, startHeight: 70, endHeight: 15 });
    Shared.strike(npc, player, "ranged", Monsters.maxHitFor(npc, BASE.RANGED, Monsters.LEVELS.RANGED), delay);
  }

  /** The jump: up, then down beside the target 4 ticks later, crushing those around. */
  jump(npc, player) {
    const { Location, RegionManager } = Shared.core();
    const at = player.getLocation();
    const landing = new Location(at.getX() - 1, at.getY() - 1, at.getZ());
    for (let dx = 0; dx < 3; dx++) {
      for (let dy = 0; dy < 3; dy++) {
        if (RegionManager.blocked(new Location(landing.getX() + dx, landing.getY() + dy, landing.getZ()), this.map)) return false;
      }
    }
    npc.__coxJumping = true;
    npc.getCombat().reset();
    Shared.animate(npc, ANIM.JUMP);
    Shared.later(this.raid, 4, () => {
      if (!npc.isRegistered()) return;
      npc.moveTo(landing);
      Shared.animate(npc, ANIM.LAND);
      for (const viewer of this.raiders()) Shared.sound(viewer, 1695);
    });
    Shared.later(this.raid, 5, () => {
      if (!npc.isRegistered()) return;
      for (const raider of this.raiders()) {
        if (raider.getLocation().getDistance(at) <= 1) Shared.damage(raider, Shared.random(20, 25));
      }
    });
    Shared.later(this.raid, 6, () => {
      npc.__coxJumping = false;
      if (npc.isRegistered()) npc.getCombat().attack(player);
    });
    return true;
  }

  onNpcDeath(npc) {
    if (!this.shamans.includes(npc) || this.living().some((other) => other !== npc)) return;
    this.completed = true;
    Shared.later(this.raid, 2, () => this.tendrils.forEach((tendril) => Shared.core().ObjectManager.deregister(tendril, true)));
    Shared.later(this.raid, 6, () => {
      this.blockerClip(false);
      for (const blocker of this.blockers) this.explode(blocker, 1);
    });
  }
}

Raid.registerRoom("LIZARDMEN_SHAMAN", ShamansRoom);

function shamanCombat(api) {
  const { CombatMethod, CombatType } = api.core;
  return class LizardmanShamanCombat extends CombatMethod {
    type() {
      return CombatType.RANGED;
    }

    attackDistance() {
      return 8;
    }

    attackSpeed() {
      return 4;
    }

    canAttack(npc) {
      return !npc.__coxJumping;
    }

    start(npc, target) {
      const room = npc.__coxRoom;
      if (room instanceof ShamansRoom && target?.isPlayer?.()) room.attack(npc, target.getAsPlayer());
    }

    hits() {
      return [];
    }
  };
}

module.exports = function registerCoxShamans(api) {
  Shared.bind(api);
  api.registerNpcCombatMethodProvider(NPC.SHAMANS, shamanCombat(api));
};

Object.assign(module.exports, { ShamansRoom, shamanCount });
