"use strict";

/**
 * The Muttadiles' room: past the noxious tendrils a small muttadile fights while the large one
 * lurks in the water; once the small one dies the large one comes out. Both eat from the meat
 * tree to heal unless it's chopped down.
 *
 * Wiki (Muttadile; Meat tree):
 * - The submerged large muttadile is unattackable and fires erratic Magic: each player it sees
 *   has a 1 in 3 chance of being targeted.
 * - The small one uses Ranged at a distance and Melee up close. The large one uses all three;
 *   up close it stomps everyone in melee range for up to 50% more than its melee max (crush);
 *   at a distance it keeps one style for at least three attacks.
 * - At about half health they go to the meat tree and eat up to half their health, at most
 *   three times, giving up after about 15 seconds if they can't reach it.
 * - The meat tree has 5 x the party's total Woodcutting (at least 100). A chop succeeds 20% at
 *   Woodcutting 1 to 78% at 99 and takes off (level / 2) -7 to +3; the axe doesn't matter.
 *   Cutting it gives points.
 * Near-Reality: the tiles; the tendrils (29767) appear and the muttadiles rise when someone
 *   comes within 6 tiles, and passing them again costs 22.5% of your hitpoints; the submerged
 *   one fires every 5 ticks (projectile 393, gfx 157, base 25); emerging anim 7423, 5 tiles
 *   out, form 7563 after 4 ticks, attackable at 5; attacks: small melee anim 7420 (sound 2548),
 *   ranged 7421 with projectile 1291 (base 30); large ranged 7421 / 1291 (base 30), magic 7422
 *   / 393 (base 25, its path splashing those beside it), stomp 7424; Ranged and Magic prayers
 *   let a third through; eating: 2 bites (3 under 40%) of 10% every 3 ticks; chopping every 4
 *   ticks, 45 XP and 2 points a success; the felled tree 30013; the exit crystal.
 */

const Shared = require("./CoxShared");
const Raid = require("./CoxRaid");
const Monsters = require("./CoxMonsters");

const NPC = { SUBMERGED: 7561, SMALL: 7562, LARGE: 7563, TREE: 7564 };
const OBJECT = { TENDRILS: 29767, ROCKS: 30012, FELLED_TREE: 30013 };
const BASE = { SUBMERGED_MAGIC: 25, RANGED: 30, MAGIC: 25 };
const ANIM = { EMERGE: 7423, BITE: 7420, RANGED: 7421, MAGIC: 7422, STOMP: 7424, SMALL_MELEE: 7420 };
const PROJECTILE = { RANGED: 1291, MAGIC: 393 };
const EAT = { TIMES: 3, GIVE_UP: 25, BITE_TICKS: 3, SHARE: 0.1 };

/** Cache tiles by version. */
const TREE_TILES = [{ x: 3269, y: 5320 }, { x: 3301, y: 5320 }, { x: 3350, y: 5317 }];
const TENDRIL_TILES = [[{ x: 3279, y: 5314 }, { x: 3280, y: 5314 }], [{ x: 3311, y: 5314 }, { x: 3312, y: 5314 }], [{ x: 3343, y: 5313 }, { x: 3344, y: 5313 }]];
const CRYSTAL_TILES = [{ x: 3270, y: 5328 }, { x: 3308, y: 5335 }, { x: 3352, y: 5327 }];
const LARGE_TILES = [{ x: 3282, y: 5332 }, { x: 3314, y: 5330 }, { x: 3336, y: 5330 }];
const SMALL_TILES = [{ x: 3276, y: 5328 }, { x: 3307, y: 5325 }, { x: 3344, y: 5323 }];

/** Wiki (Mod Ash): 20% at Woodcutting 1 to 78% at 99. */
function chopChance(level) {
  return 0.2 + ((Math.min(99, Math.max(1, level)) - 1) * 0.58) / 98;
}

/** Wiki (Mod Ash): level / 2, -7 to +3. */
function chopDamage(level) {
  return Math.max(1, Math.floor(level / 2) + Shared.random(-7, 3));
}

class MuttadileRoom extends Raid.Room {
  constructor(raid, record) {
    super(raid, record);
    this.woken = false;
    this.tendrilCrossers = new Set();
  }

  load() {
    const variant = this.record.variant;
    const tree = TREE_TILES[variant];
    const { GameObject, ObjectManager } = Shared.core();
    this.treeTile = this.tile(tree.x, tree.y, 2);
    this.treeBase = new GameObject(OBJECT.ROCKS, this.treeTile.clone(), 10, 0, this.map);
    ObjectManager.register(this.treeBase, true);
    this.tree = this.spawnNpc(NPC.TREE, this.treeTile.clone(), { scale: false });
    if (this.tree) {
      const woodcutting = [...this.raid.players].reduce((sum, player) => sum + Shared.baseLevel(player, "WOODCUTTING"), 0);
      const health = Math.max(100, 5 * woodcutting);
      this.tree.setMaxHitpoints(health);
      this.tree.setHitpoints(health);
    }
    this.blockExit(CRYSTAL_TILES);
    this.tendrilTiles = TENDRIL_TILES[variant].map((spot) => this.tile(spot.x, spot.y));
  }

  combatPoints() {
    return Number.MAX_SAFE_INTEGER;
  }

  tick() {
    if (!this.woken) return this.watch();
    if (this.completed) return undefined;
    const ticks = this.raid.ticks;
    if (this.large && this.largeState === "submerged" && this.small?.isRegistered() && ticks % 5 === 0) this.erratic();
    for (const npc of [this.small, this.large]) {
      if (!npc?.isRegistered() || npc.getHitpoints() <= 0) continue;
      if (npc.__coxEating) this.eat(npc);
      else if (npc === this.small || this.largeState === "out") {
        this.considerEating(npc);
        if (!npc.__coxEating) this.engage(npc);
      }
    }
    return undefined;
  }

  /** Someone within 6 tiles of the tendrils wakes the room. */
  watch() {
    const near = this.raiders().some((player) => player.getLocation().getDistance(this.tendrilTiles[0]) <= 6);
    if (!near) return;
    this.woken = true;
    const { GameObject, ObjectManager } = Shared.core();
    this.tendrils = this.tendrilTiles.map((tile) => {
      const tendril = new GameObject(OBJECT.TENDRILS, tile, 10, 0, this.map);
      ObjectManager.register(tendril, true);
      return tendril;
    });
    const variant = this.record.variant;
    this.small = this.spawnNpc(NPC.SMALL, this.tile(SMALL_TILES[variant].x, SMALL_TILES[variant].y, 3));
    this.large = this.spawnNpc(NPC.SUBMERGED, this.tile(LARGE_TILES[variant].x, LARGE_TILES[variant].y, 8));
    this.largeState = "submerged";
    for (const npc of [this.small, this.large]) {
      if (npc) npc.__coxMeals = 0;
    }
  }

  /** Wiki (Mod Ash): each raider it can see has a 1 in 3 chance of being hit. */
  erratic() {
    const large = this.large;
    for (const player of this.raiders()) {
      if (player.getHitpoints() <= 0 || Shared.random(1, 3) !== 1) continue;
      const delay = Shared.projectile(this.map, large, player, PROJECTILE.MAGIC, { delay: 20, duration: 25, startHeight: 10, endHeight: 15 });
      Shared.later(this.raid, delay, () => player.performGraphic(Shared.gfx(157, { height: 96 })));
      Shared.strike(large, player, "magic", Monsters.maxHitFor(large, BASE.SUBMERGED_MAGIC, Monsters.LEVELS.MAGIC), delay, { prayerMultiplier: 1 / 3 });
    }
  }

  /** Wiki: below half health, up to three meals from the meat tree while it stands. */
  considerEating(npc) {
    if (!this.tree?.isRegistered() || this.tree.getHitpoints() <= 0) return;
    if (npc.__coxMeals >= EAT.TIMES || npc.getHitpoints() >= npc.getMaxHitpoints() / 2 || Shared.random(0, 2) !== 0) return;
    npc.__coxEating = { since: this.raid.ticks, bites: npc.getHitpoints() < npc.getMaxHitpoints() * 0.4 ? 3 : 2, wait: 0 };
    npc.__coxMeals++;
    npc.getCombat().reset();
    npc.setPositionToFace(this.treeTile);
    Shared.core().PathFinder.calculateEntityRoute(npc, this.tree);
  }

  eat(npc) {
    const meal = npc.__coxEating;
    if (!this.tree?.isRegistered() || this.tree.getHitpoints() <= 0 || this.raid.ticks - meal.since > EAT.GIVE_UP && meal.bitten !== true) {
      npc.__coxEating = null;
      return;
    }
    const reach = npc.getLocation().getDistance(this.treeTile) <= npc.getSize() + 1;
    if (!reach) {
      if (!npc.getMovementQueue().isMovings()) Shared.core().PathFinder.calculateEntityRoute(npc, this.tree);
      return;
    }
    if (meal.wait-- > 0) return;
    meal.bitten = true;
    Shared.animate(npc, ANIM.BITE);
    npc.heal(Math.floor(npc.getMaxHitpoints() * EAT.SHARE));
    meal.wait = EAT.BITE_TICKS;
    if (--meal.bites <= 0) npc.__coxEating = null;
  }

  /** The small one is dead: the large one comes out of the water. */
  emerge() {
    const large = this.large;
    if (!large?.isRegistered()) return;
    this.largeState = "emerging";
    Shared.animate(large, ANIM.EMERGE);
    const { Location } = Shared.core();
    const from = large.getLocation();
    const towards = this.small?.getLocation() ?? this.tendrilTiles[0];
    const dx = towards.getX() - from.getX();
    const dy = towards.getY() - from.getY();
    const step = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx) * 5, 0] : [0, Math.sign(dy) * 5];
    Shared.walkStraight(large, new Location(from.getX() + step[0], from.getY() + step[1], from.getZ()));
    Shared.later(this.raid, 4, () => large.isRegistered() && large.setNpcTransformationId(NPC.LARGE));
    Shared.later(this.raid, 5, () => {
      this.largeState = "out";
    });
  }

  modifyHit(npc, hit) {
    if (npc !== this.large || this.largeState === "out") return;
    for (const part of hit.getHits()) part.setDamage(0);
    hit.updateTotalDamage();
  }

  onNpcDeath(npc) {
    if (npc === this.small) {
      Shared.later(this.raid, 1, () => this.emerge());
      return;
    }
    if (npc === this.tree) {
      Shared.replaceObject(this.map, this.treeBase, OBJECT.FELLED_TREE);
      return;
    }
    if (npc !== this.large) return;
    this.clearExit();
    const tendrils = this.tendrils ?? [];
    Shared.later(this.raid, 2, () => tendrils.forEach((tendril) => Shared.core().ObjectManager.deregister(tendril, true)));
  }

  /** Passing the tendrils (Near-Reality): two tiles on, 22.5% of your hitpoints after the first time. */
  passTendrils(player, tendril) {
    if (this.completed) {
      player.sendMessage("The tendril is about to collapse!");
      return;
    }
    if (player.__coxBalancing) return;
    const name = player.getUsername();
    if (this.tendrilCrossers.has(name)) Shared.damage(player, Math.floor(player.getHitpoints() * 0.225));
    this.tendrilCrossers.add(name);
    const at = tendril.getLocation();
    const here = player.getLocation();
    const { Location } = Shared.core();
    const dx = Math.sign(at.getX() - here.getX());
    const dy = dx === 0 ? Math.sign(at.getY() - here.getY()) : 0;
    Shared.balanceWalk(player, new Location(here.getX() + dx * 2, here.getY() + dy * 2, here.getZ()), -1, null);
  }

  chop(player) {
    const axe = Shared.axeOf(player);
    if (!axe) {
      player.sendMessage("You do not have an axe which you have the woodcutting level to use.");
      return;
    }
    if (!this.tree?.isRegistered() || this.tree.getHitpoints() <= 0) {
      player.sendMessage("The tree has died.");
      return;
    }
    player.sendMessage("You swing your hatchet at the meat tree...");
    let ticks = 0;
    Shared.action(player, {
      first: 1,
      interval: 1,
      step: () => {
        if (!this.tree?.isRegistered() || this.tree.getHitpoints() <= 0) return false;
        if (ticks % 4 === 0) Shared.animate(player, axe.animation);
        if (++ticks < 3 || (ticks - 3) % 4 !== 0) return true;
        const level = Shared.level(player, "WOODCUTTING");
        if (Math.random() >= chopChance(level)) return true;
        Shared.addXp(player, "WOODCUTTING", 45);
        this.raid.addPoints(player, 2);
        const left = this.tree.getHitpoints() - chopDamage(level);
        if (left <= 0) {
          for (const viewer of this.raiders()) Shared.sound(viewer, 2734);
          player.sendMessage("You hack away the final pieces of meat.");
          this.tree.setHitpoints(0);
          this.removeNpc(this.tree);
          this.onNpcDeath(this.tree);
          return false;
        }
        this.tree.setHitpoints(left);
        Shared.sound(player, 2070);
        player.sendMessage("You hack away some of the meat.");
        return true;
      },
      stop: () => Shared.animate(player, -1),
    });
  }
}

Raid.registerRoom("MUTTADILES", MuttadileRoom);

function roomOf(player) {
  const room = Raid.raidOf(player)?.roomAt(player.getLocation());
  return room instanceof MuttadileRoom ? room : null;
}

/** Their attacks: the small one's melee and ranged, the large one's stomp, ranged and magic. */
function muttadileCombat(api) {
  const { CombatMethod, CombatType } = api.core;
  return class MuttadileCombat extends CombatMethod {
    type() {
      return CombatType.RANGED;
    }

    attackDistance() {
      return 6;
    }

    attackSpeed() {
      return 4;
    }

    canAttack(npc) {
      return !npc.__coxEating && !(npc.getId() === NPC.SUBMERGED && npc.getNpcTransformationId() !== NPC.LARGE);
    }

    start(npc, target) {
      const room = npc.__coxRoom;
      if (!(room instanceof MuttadileRoom) || !target?.isPlayer?.()) return;
      const player = target.getAsPlayer();
      const large = npc === room.large;
      if (room.reachableBy(npc, player)) {
        if (large) {
          // Its definition's max hit is the stomp's (Wiki: 72, half again its melee).
          Shared.animate(npc, ANIM.STOMP);
          const max = npc.getDefinition().getMaxHit();
          for (const raider of room.raiders()) {
            if (room.reachableBy(npc, raider)) Shared.strike(npc, raider, "melee", max, 0);
          }
        } else {
          Shared.animate(npc, ANIM.SMALL_MELEE);
          Shared.sound(player, 2548);
          Shared.strike(npc, player, "melee", npc.getDefinition().getMaxHit(), 0);
        }
        return;
      }
      let style = "ranged";
      if (large) {
        if (!npc.__coxStyle || npc.__coxStyleLeft <= 0) {
          npc.__coxStyle = Shared.random(1, 5) <= 4 ? "ranged" : "magic";
          npc.__coxStyleLeft = 3;
        }
        npc.__coxStyleLeft--;
        style = npc.__coxStyle;
      }
      if (style === "ranged") {
        Shared.animate(npc, ANIM.RANGED);
        const delay = Shared.projectile(room.map, npc, player, PROJECTILE.RANGED, { delay: 25, duration: 15, startHeight: 25, endHeight: 15 });
        Shared.strike(npc, player, "ranged", Monsters.maxHitFor(npc, BASE.RANGED, Monsters.LEVELS.RANGED), delay, { prayerMultiplier: 1 / 3 });
        return;
      }
      Shared.animate(npc, ANIM.MAGIC);
      const delay = Shared.projectile(room.map, npc, player, PROJECTILE.MAGIC, { delay: 25, duration: 40, startHeight: 25, endHeight: 15 });
      const max = Monsters.maxHitFor(npc, BASE.MAGIC, Monsters.LEVELS.MAGIC);
      Shared.strike(npc, player, "magic", max, delay, { prayerMultiplier: 1 / 3 });
      // Near-Reality: the magic splashes anyone beside its path.
      const from = npc.getLocation();
      const to = player.getLocation();
      for (const raider of room.raiders()) {
        if (raider === player) continue;
        if (distanceToSegment(raider.getLocation(), from, to) <= 2) Shared.strike(npc, raider, "magic", max, delay, { prayerMultiplier: 1 / 3 });
      }
    }

    hits() {
      return [];
    }
  };
}

function distanceToSegment(point, a, b) {
  const ax = a.getX();
  const ay = a.getY();
  const dx = b.getX() - ax;
  const dy = b.getY() - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.getX() - ax) * dx + (point.getY() - ay) * dy) / length));
  return Math.max(Math.abs(point.getX() - (ax + t * dx)), Math.abs(point.getY() - (ay + t * dy)));
}

MuttadileRoom.prototype.reachableBy = function reachableBy(npc, player) {
  const at = npc.getLocation();
  const size = npc.getSize();
  const x = player.getLocation().getX() - at.getX();
  const y = player.getLocation().getY() - at.getY();
  const inX = x >= 0 && x < size;
  const inY = y >= 0 && y < size;
  return (inX && (y === -1 || y === size)) || (inY && (x === -1 || x === size));
};

function passTendrils(event) {
  const room = roomOf(event.player);
  if (!room) return false;
  room.passTendrils(event.player, event.object);
  return true;
}

function cutTree(event) {
  const room = event.npc?.__coxRoom;
  if (!(room instanceof MuttadileRoom)) return false;
  room.chop(event.player);
  return true;
}

module.exports = function registerCoxMuttadiles(api) {
  Shared.bind(api);
  api.registerNpcCombatMethodProvider([NPC.SUBMERGED, NPC.SMALL, NPC.LARGE], muttadileCombat(api), { singleton: true });
  Shared.onObjectIds(api, [OBJECT.TENDRILS], passTendrils);
  api.onNpcInteraction("Meat tree", { Cut: cutTree });
};

Object.assign(module.exports, { MuttadileRoom, chopChance, chopDamage });
