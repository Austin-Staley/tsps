"use strict";

/**
 * The Skeletal Mystics' room (the dark altar): mystics casting fire and a damaging
 * Vulnerability, or meleeing those in reach; the Mark of Power blocks the way on until they're
 * all dead. Portals carry raiders between the room's start, middle and end.
 *
 * Wiki (Skeletal Mystic):
 * - Two Magic attacks (a standard one and a damaging Vulnerability) and Melee. They answer
 *   overhead prayers: one that can reach its target who prays against Magic melees it; one
 *   that can't keeps casting.
 * Not on the Wiki (to check against a capture): the tiles; counts by raiders (3, 4 at 3+, 5 at 5+, 6 at 8+); fire 1 in 5 is a
 *   Vulnerability (gfx 1321, projectile 168, impact 169, Defence drained 4-8), else fire (gfx
 *   1322, projectile 130, impact 157, base 25 + raiders / 4); melee anim 5485 (base 25); casting
 *   anim 5523; splash 339; protection prayers let half through; the Mark of Power (29741) and
 *   the portals (49996 start, 49997 middle, 49998 end).
 */

const Shared = require("./CoxShared");
const Raid = require("./CoxRaid");
const Monsters = require("./CoxMonsters");

const NPC = { MYSTICS: [7604, 7605, 7606] };
const OBJECT = { MARK: 29741, PORTAL_END: 49996, PORTAL_MIDDLE: 49997, PORTAL_START: 49998 };
const BASE = { MELEE: 25, FIRE: 25 };

/** Cache tiles by version. */
const SPAWNS = [
  [{ x: 3278, y: 5261 }, { x: 3286, y: 5265 }, { x: 3284, y: 5271 }, { x: 3277, y: 5273 }, { x: 3273, y: 5265 }, { x: 3278, y: 5270 }],
  [{ x: 3315, y: 5262 }, { x: 3318, y: 5259 }, { x: 3309, y: 5258 }, { x: 3301, y: 5256 }, { x: 3306, y: 5264 }, { x: 3312, y: 5259 }],
  [{ x: 3342, y: 5262 }, { x: 3342, y: 5266 }, { x: 3340, y: 5268 }, { x: 3338, y: 5274 }, { x: 3337, y: 5268 }, { x: 3338, y: 5260 }],
];
const MARK_TILES = [{ x: 3270, y: 5264 }, { x: 3309, y: 5272 }, { x: 3348, y: 5268 }];
/** Start, middle, end. */
const PORTAL_TILES = [
  [{ x: 3278, y: 5250 }, { x: 3283, y: 5266 }, { x: 3272, y: 5267 }],
  [{ x: 3311, y: 5250 }, { x: 3308, y: 5260 }, { x: 3307, y: 5270 }],
  [{ x: 3341, y: 5255 }, { x: 3342, y: 5268 }, { x: 3348, y: 5271 }],
];

function mysticCount(raiders) {
  return raiders < 3 ? 3 : raiders < 5 ? 4 : raiders < 8 ? 5 : 6;
}

class MysticsRoom extends Raid.Room {
  constructor(raid, record) {
    super(raid, record);
    this.mystics = [];
  }

  load() {
    const variant = this.record.variant;
    for (const spot of Shared.shuffle(SPAWNS[variant]).slice(0, mysticCount(this.raid.scale))) {
      const mystic = this.spawnNpc(Shared.randomOf(NPC.MYSTICS), this.tile(spot.x, spot.y, 2), { wanderRadius: 2 });
      if (mystic) this.mystics.push(mystic);
    }
    const { GameObject, ObjectManager } = Shared.core();
    const portals = [OBJECT.PORTAL_START, OBJECT.PORTAL_MIDDLE, OBJECT.PORTAL_END];
    this.portalTiles = PORTAL_TILES[variant].map((spot) => this.tile(spot.x, spot.y));
    this.portalTiles.forEach((tile, index) => {
      ObjectManager.register(new GameObject(portals[index], tile, 10, this.record.rotation, this.map), true);
    });
    const mark = MARK_TILES[variant];
    this.mark = new GameObject(OBJECT.MARK, this.tile(mark.x, mark.y, 2), 10, this.record.rotation, this.map);
    ObjectManager.register(this.mark, true);
  }

  combatPoints() {
    return Math.floor(5 * this.mystics.reduce((sum, npc) => sum + npc.getMaxHitpoints(), 0) * 1.05);
  }

  tick() {
    for (const mystic of this.mystics) {
      if (mystic.isRegistered() && mystic.getHitpoints() > 0) this.engage(mystic);
    }
  }

  onNpcDeath(npc) {
    if (!this.mystics.includes(npc)) return;
    if (this.mystics.some((other) => other !== npc && other.isRegistered() && other.getHitpoints() > 0)) return;
    this.completed = true;
    if (this.mark) Shared.core().ObjectManager.deregister(this.mark, true);
    this.mark = null;
  }

  adjacent(npc, player) {
    const at = npc.getLocation();
    const x = player.getLocation().getX() - at.getX();
    const y = player.getLocation().getY() - at.getY();
    const inX = x >= 0 && x < 2;
    const inY = y >= 0 && y < 2;
    return (inX && (y === -1 || y === 2)) || (inY && (x === -1 || x === 2));
  }

  attack(npc, player) {
    if (this.adjacent(npc, player) && (Shared.isProtected(player, "magic") || Shared.random(0, 1) === 0)) {
      Shared.animate(npc, 5485);
      Shared.sound(player, 511);
      Shared.strike(npc, player, "melee", Monsters.maxHitFor(npc, BASE.MELEE, Monsters.LEVELS.STRENGTH), 0, { prayerMultiplier: 0.5 });
      return;
    }
    Shared.animate(npc, 5523);
    const max = Monsters.maxHitFor(npc, BASE.FIRE + Math.floor(this.raid.scale / 4), Monsters.LEVELS.MAGIC);
    if (Shared.random(0, 4) === 0) {
      npc.performGraphic(Shared.gfx(1321, { height: 96 }));
      Shared.sound(player, 127);
      const delay = Shared.projectile(this.map, npc, player, 168, { delay: 50, duration: 25, startHeight: 45, endHeight: 15 });
      const hit = Shared.strike(npc, player, "magic", max, delay, { prayerMultiplier: 0.5 });
      Shared.later(this.raid, delay, () => {
        if (hit.getTotalDamage() <= 0) {
          player.performGraphic(Shared.gfx(339, { height: 60 }));
          return;
        }
        player.performGraphic(Shared.gfx(169, { height: 90 }));
        const { Skill } = Shared.core();
        const skills = player.getSkillManager();
        skills.setCurrentLevel(Skill.DEFENCE, Math.max(0, skills.getCurrentLevel(Skill.DEFENCE) - Shared.random(4, 8)), true);
      });
      return;
    }
    npc.performGraphic(Shared.gfx(1322, { height: 96 }));
    Shared.sound(player, 155);
    const delay = Shared.projectile(this.map, npc, player, 130, { delay: 50, duration: 25, startHeight: 45, endHeight: 15 });
    const hit = Shared.strike(npc, player, "magic", max, delay, { prayerMultiplier: 0.5 });
    Shared.later(this.raid, delay, () => player.performGraphic(Shared.gfx(hit.getTotalDamage() > 0 ? 157 : 339, { height: 90 })));
  }

  /** The portals: Travel-Start, Travel-End, or from the middle either way. */
  travel(player, option) {
    if (option === "Travel") {
      Shared.options(player, "Where would you like to go?",
        "Start", () => player.moveTo(this.portalTiles[0].clone()),
        "End", () => player.moveTo(this.portalTiles[2].clone()),
        "Cancel.", () => {});
      return;
    }
    player.moveTo(this.portalTiles[option === "Travel-Start" ? 0 : 2].clone());
  }
}

Raid.registerRoom("DARK_ALTAR_ROOM", MysticsRoom);

function usePortal(event) {
  const room = Raid.raidOf(event.player)?.roomAt(event.player.getLocation());
  if (!(room instanceof MysticsRoom)) return false;
  room.travel(event.player, event.option);
  return true;
}

function mysticCombat(api) {
  const { CombatMethod, CombatType } = api.core;
  return class SkeletalMysticCombat extends CombatMethod {
    type() {
      return CombatType.MAGIC;
    }

    attackDistance() {
      return 7;
    }

    attackSpeed() {
      return 4;
    }

    start(npc, target) {
      const room = npc.__coxRoom;
      if (room instanceof MysticsRoom && target?.isPlayer?.()) room.attack(npc, target.getAsPlayer());
    }

    hits() {
      return [];
    }
  };
}

module.exports = function registerCoxMystics(api) {
  Shared.bind(api);
  api.registerNpcCombatMethodProvider(NPC.MYSTICS, mysticCombat(api));
  Shared.onObjectIds(api, [OBJECT.PORTAL_START, OBJECT.PORTAL_MIDDLE, OBJECT.PORTAL_END], usePortal);
};

Object.assign(module.exports, { MysticsRoom, mysticCount });
