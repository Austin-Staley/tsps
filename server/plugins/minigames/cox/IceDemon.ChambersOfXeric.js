"use strict";

/**
 * The Ice Demon's room: braziers lit with kindling thaw the ice storm around the demon; then
 * the demon is fought, and its death clears the way on.
 *
 * Wiki (Ice demon; Brazier (Chambers of Xeric); Kindling):
 * - Four braziers surround the demon, each with an icefiend by it (one per raider, at most
 *   four). Lighting needs kindling and a tinderbox and is a skill roll: 8% at Firemaking 1,
 *   rising linearly to 78% at 99. Lighting gives 32 points, each kindling 36.
 * - A lit brazier's icefiend tries every 3 or 4 ticks to take a charge from it, a 1 in 6
 *   chance.
 * - Thawed, the icefiends vanish and the demon attacks: a snow boulder (ranged) or Ice Burst
 *   (magic), each hitting the 3x3 around its target. Praying against one makes it use only
 *   that one.
 * - All damage to it is a third, but fire spells deal 250% and demonbane weapons aren't cut.
 * - It drops fiendish ashes, 7 stinkhorn mushrooms, 7 endarkened juice and 5 cicely for each
 *   raider.
 * Not on the Wiki (to check against a capture): the tiles; the storm's strength (250 per raider); each kindling is 5 charges,
 *   a brazier burns min(raiders, charges) a tick, each charge thawing 2; with nothing lit the
 *   storm regrows 2-5 a tick. A failed lighting tries again 2 ticks later (anim 3687, sound
 *   2066); fuelling anim 832; 5 Firemaking XP a kindling. Thawing: gfx 86 on the braziers,
 *   sound 1930, icefiends die (anim 1580, sound 532), the demon walks out and turns hostile
 *   7 ticks later. Its attacks: anim 69; boulder projectile 1324, impact gfx 1325, base 30;
 *   Ice Burst gfx 363 on the 3x3, base 25, freezing ~8 ticks; protection prayers let 50%
 *   (missiles) and 33% (magic) through. The storm stays until the demon dies.
 * Not like OSRS: the storm's progress isn't shown on the demon's health bar.
 */

const Shared = require("./CoxShared");
const Raid = require("./CoxRaid");

const NPC = { FROZEN: 7584, DEMON: 7585, ICEFIEND: 7586 };
const OBJECT = { BRAZIER: 29747, LIT_BRAZIER: 29748, STORM: 29876 };
const KINDLING = 20799;
const TINDERBOX = 590;
const KINDLING_CAP = 28;
const CHARGES_PER_KINDLING = 5;
const THAW_PER_CHARGE = 2;
const STORM_PER_RAIDER = 250;
const POINTS = { LIGHT: 32, KINDLING: 36, CAP: 6050 };
const FIRE_SPELLS = ["FIRE_STRIKE", "FIRE_BOLT", "FIRE_BLAST", "FIRE_WAVE", "FIRE_SURGE", "FLAMES_OF_ZAMORAK"];
const DEMONBANE = new Set([2402, 6746, 19675, 29577, 29589, 29591]);
const ATTACK = { ANIM: 69, BOULDER: 1324, BOULDER_HIT: 1325, BURST_HIT: 363, BOULDER_MAX: 30, BURST_MAX: 25 };

/** Cache tiles by the room's version (west, north, east). */
const DEMON_TILES = [
  [{ x: 3271, y: 5365 }, { x: 3272, y: 5365 }, { x: 3278, y: 5365 }],
  [{ x: 3310, y: 5368 }, { x: 3310, y: 5367 }, { x: 3310, y: 5361 }],
  [{ x: 3349, y: 5362 }, { x: 3348, y: 5362 }, { x: 3342, y: 5363 }],
];
const BRAZIER_TILES = [
  [{ x: 3272, y: 5362 }, { x: 3275, y: 5364 }, { x: 3275, y: 5367 }, { x: 3272, y: 5369 }],
  [{ x: 3307, y: 5368 }, { x: 3309, y: 5365 }, { x: 3312, y: 5365 }, { x: 3314, y: 5368 }],
  [{ x: 3349, y: 5366 }, { x: 3346, y: 5364 }, { x: 3346, y: 5361 }, { x: 3349, y: 5359 }],
];
const ICEFIEND_TILES = [
  [{ x: 3273, y: 5362 }, { x: 3275, y: 5365 }, { x: 3275, y: 5366 }, { x: 3273, y: 5369 }],
  [{ x: 3307, y: 5367 }, { x: 3310, y: 5365 }, { x: 3311, y: 5365 }, { x: 3314, y: 5367 }],
  [{ x: 3348, y: 5366 }, { x: 3346, y: 5363 }, { x: 3346, y: 5362 }, { x: 3348, y: 5359 }],
];

let fireSpells = null;

function isFireSpell(spell) {
  if (!spell) return false;
  if (!fireSpells) {
    const { CombatSpells } = Shared.core();
    fireSpells = new Set(FIRE_SPELLS.map((name) => CombatSpells[name]).filter(Boolean));
  }
  return fireSpells.has(spell);
}

/** Wiki (Mod Ash): a normal skill roll, 8% at level 1 to 78% at 99. */
function lightChance(level) {
  return 0.08 + ((Math.min(99, Math.max(1, level)) - 1) * 0.7) / 98;
}

class IceDemonRoom extends Raid.Room {
  constructor(raid, record) {
    super(raid, record);
    this.stage = "frozen";
    this.braziers = new Map();
    this.icefiends = new Map();
    this.kindlingPoints = 0;
  }

  load() {
    const variant = this.record.variant;
    const [stormAt, faceAt] = DEMON_TILES[variant];
    const { GameObject, ObjectManager } = Shared.core();
    this.storm = new GameObject(OBJECT.STORM, this.tile(stormAt.x, stormAt.y, 2), 10, 0, this.map);
    ObjectManager.register(this.storm, true);
    this.demon = this.spawnNpc(NPC.FROZEN, this.storm.getLocation().clone());
    this.demon?.setPositionToFace(this.tile(faceAt.x, faceAt.y, 2));
    this.stormMax = STORM_PER_RAIDER * this.raid.scale;
    this.stormLeft = this.stormMax;
    const count = Math.min(this.raid.scale, 4);
    for (const index of Shared.shuffle([0, 1, 2, 3]).slice(0, count)) {
      const spot = ICEFIEND_TILES[variant][index];
      const icefiend = this.spawnNpc(NPC.ICEFIEND, this.tile(spot.x, spot.y), { scale: false });
      if (!icefiend) continue;
      icefiend.getMovementQueue().setBlockMovement?.(true);
      const brazier = BRAZIER_TILES[variant][index];
      icefiend.setPositionToFace(this.tile(brazier.x, brazier.y));
      this.icefiends.set(index, { npc: icefiend, wait: Shared.random(3, 4) });
    }
  }

  combatPoints() {
    return this.demon ? Math.floor(5 * this.demon.getMaxHitpoints() * 1.05) : 0;
  }

  /** Which brazier (0-3) stands on a tile. */
  brazierIndex(location) {
    return BRAZIER_TILES[this.record.variant].findIndex((spot) => this.tile(spot.x, spot.y).equals(location));
  }

  tick() {
    if (this.stage === "frozen") this.thaw();
    else if (this.stage === "fighting" && this.demon?.isRegistered()) this.engage(this.demon);
  }

  thaw() {
    if (this.braziers.size === 0) {
      this.stormLeft = Math.min(this.stormMax, this.stormLeft + Shared.random(2, 5));
      return;
    }
    for (const [index, brazier] of [...this.braziers]) {
      const burnt = Math.min(this.raid.scale, brazier.charges);
      brazier.charges -= burnt;
      this.stormLeft -= burnt * THAW_PER_CHARGE;
      this.icefiendSteals(index, brazier);
      if (brazier.charges <= 0) this.extinguish(index);
    }
    if (this.stormLeft <= 0) this.defreeze();
  }

  /** Wiki (Mod Ash): every 3 or 4 ticks, a 1 in 6 chance to take a charge. */
  icefiendSteals(index, brazier) {
    const icefiend = this.icefiends.get(index);
    if (!icefiend || --icefiend.wait > 0) return;
    icefiend.wait = Shared.random(3, 4);
    Shared.animate(icefiend.npc, 1582);
    for (const player of this.raiders()) Shared.sound(player, 531);
    if (Shared.random(1, 6) === 1) brazier.charges = Math.max(0, brazier.charges - 1);
  }

  light(player, object, index) {
    const have = Math.min(KINDLING_CAP, player.getInventory().getAmount(KINDLING));
    player.getInventory().delete(KINDLING, player.getInventory().getAmount(KINDLING));
    const lit = Shared.replaceObject(this.map, object, OBJECT.LIT_BRAZIER);
    this.braziers.set(index, { object: lit, charges: have * CHARGES_PER_KINDLING });
    Shared.animate(player, 3687);
    Shared.sound(player, 2066);
    player.sendMessage("You put the kindling in the brazier and light it on fire.");
    Shared.addXp(player, "FIREMAKING", have * 5);
    this.kindlingRewards(player, have, POINTS.LIGHT);
  }

  fuel(player, index) {
    const brazier = this.braziers.get(index);
    const amount = player.getInventory().getAmount(KINDLING);
    if (!brazier || amount <= 0) return;
    player.getInventory().delete(KINDLING, amount);
    brazier.charges += amount * CHARGES_PER_KINDLING;
    Shared.animate(player, 832);
    player.sendMessage("You add the kindling to the fire in the brazier.");
    Shared.addXp(player, "FIREMAKING", amount * 5);
    this.kindlingRewards(player, amount, 0);
  }

  /** Wiki: 36 a kindling and 32 a lighting, up to about 6,050 in a normal raid. */
  kindlingRewards(player, kindling, bonus) {
    const points = Math.max(0, Math.min(POINTS.CAP - this.kindlingPoints, kindling * POINTS.KINDLING + bonus));
    this.kindlingPoints += points;
    this.raid.addPoints(player, points);
  }

  extinguish(index) {
    const brazier = this.braziers.get(index);
    this.braziers.delete(index);
    if (brazier) Shared.replaceObject(this.map, brazier.object, OBJECT.BRAZIER);
  }

  defreeze() {
    const { Animation } = Shared.core();
    this.stage = "thawing";
    const viewers = this.raiders();
    for (const index of [...this.braziers.keys()]) {
      const brazier = this.braziers.get(index);
      Shared.graphicAt(viewers, 86, brazier.object.getLocation(), { height: 90 });
      this.extinguish(index);
    }
    for (const player of viewers) Shared.sound(player, 1930);
    for (const { npc } of this.icefiends.values()) {
      npc.performAnimation(new Animation(1580));
      for (const player of viewers) Shared.sound(player, 532);
      Shared.later(this.raid, 1, () => this.removeNpc(npc));
    }
    this.icefiends.clear();
    const out = DEMON_TILES[this.record.variant][2];
    if (this.demon) Shared.walkStraight(this.demon, this.tile(out.x, out.y, 2));
    Shared.later(this.raid, 7, () => {
      if (!this.demon?.isRegistered()) return;
      this.demon.setNpcTransformationId(NPC.DEMON);
      this.stage = "fighting";
      this.engage(this.demon);
    });
  }

  /** Wiki: a third of all damage, except fire spells (250%) and demonbane weapons. */
  modifyHit(npc, hit) {
    if (npc !== this.demon) return;
    const attacker = hit.getAttacker?.();
    if (!attacker?.isPlayer?.()) return;
    const player = attacker.getAsPlayer();
    const spell = player.getCombat().getPreviousCast?.() ?? player.getCombat().getSelectedSpell?.();
    const magic = hit.getCombatType?.() === Shared.core().CombatType.MAGIC;
    const weapon = player.getEquipment().getItems()[Shared.core().Equipment.WEAPON_SLOT]?.getId?.();
    let factor = 1 / 3;
    if (magic && isFireSpell(spell)) factor = 2.5;
    else if (!magic && DEMONBANE.has(weapon)) factor = 1;
    for (const part of hit.getHits()) part.setDamage(Math.floor(part.getDamage() * factor));
    hit.updateTotalDamage();
  }

  /** It attacks with the style its target prays against, or either. */
  attack(target) {
    const style = Shared.isProtected(target, "ranged") ? "ranged"
      : Shared.isProtected(target, "magic") ? "magic" : Shared.randomOf(["ranged", "magic"]);
    const demon = this.demon;
    Shared.animate(demon, ATTACK.ANIM);
    const at = target.getLocation().clone();
    const viewers = this.raiders();
    const stats = demon.getDefinition().getStats();
    const scaled = (base, level) => Math.floor((base * (level + 9)) / (390 + 9));
    if (style === "ranged") {
      for (const player of viewers) Shared.sound(player, 1440);
      const delay = Shared.projectile(this.map, demon, at, ATTACK.BOULDER, { duration: 40, startHeight: 60, endHeight: 15 });
      Shared.later(this.raid, delay, () => {
        if (!demon.isRegistered()) return;
        Shared.graphicAt(this.raiders(), ATTACK.BOULDER_HIT, at);
        for (const player of this.raiders()) {
          if (player.getLocation().getDistance(at) <= 1) {
            Shared.strike(demon, player, "ranged", scaled(ATTACK.BOULDER_MAX, stats[3]), 0, { prayerMultiplier: 0.5 });
          }
        }
      });
      return;
    }
    for (const player of viewers) Shared.sound(player, 171);
    Shared.later(this.raid, 1, () => {
      if (!demon.isRegistered()) return;
      const { Location, CombatFactory } = Shared.core();
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          Shared.graphicAt(this.raiders(), ATTACK.BURST_HIT, new Location(at.getX() + dx, at.getY() + dy, at.getZ()));
        }
      }
      for (const player of this.raiders()) {
        if (player.getLocation().getDistance(at) > 1) continue;
        Shared.strike(demon, player, "magic", scaled(ATTACK.BURST_MAX, stats[4]), 0, { prayerMultiplier: 0.33 });
        CombatFactory.freeze(player, 5);
      }
    });
  }

  onNpcDeath(npc, killer) {
    if (npc !== this.demon) return;
    this.stage = "dead";
    if (this.storm) Shared.core().ObjectManager.deregister(this.storm, true);
    this.storm = null;
    this.completed = true;
    // Wiki: the drop is for each raider; the killer has theirs from its drop table.
    const { Item, ItemOnGroundManager } = Shared.core();
    const at = npc.getLocation().clone();
    for (const player of this.raiders()) {
      if (player === killer) continue;
      for (const [id, amount] of [[25766, 1], [20910, 7], [20911, 7], [20912, 5]]) {
        ItemOnGroundManager.registerLocation(player, new Item(id, amount), at);
      }
    }
  }
}

Raid.registerRoom("ICE_DEMON", IceDemonRoom);

function roomOf(player) {
  const room = Raid.raidOf(player)?.roomAt(player.getLocation());
  return room instanceof IceDemonRoom ? room : null;
}

/** Lighting tries until it catches; fuelling adds all the kindling held. */
function useBrazier(event) {
  const { player, object } = event;
  const room = roomOf(player);
  if (!room) return false;
  const index = room.brazierIndex(object.getLocation());
  if (index < 0) return true;
  if (room.stage !== "frozen") {
    player.sendMessage("That's not going to help now.");
    return true;
  }
  if (!Shared.has(player, KINDLING)) {
    player.sendMessage("You need some kindling to light the brazier.");
    return true;
  }
  if (object.getId() === OBJECT.LIT_BRAZIER) {
    room.fuel(player, index);
    return true;
  }
  if (!Shared.has(player, TINDERBOX)) {
    player.sendMessage("You need a tinderbox to light the brazier.");
    return true;
  }
  const attempt = () => {
    if (room.stage !== "frozen" || room.braziers.has(index)) return false;
    if (!Shared.has(player, KINDLING) || !Shared.has(player, TINDERBOX)) return false;
    if (Math.random() < lightChance(Shared.level(player, "FIREMAKING"))) {
      room.light(player, object, index);
      return false;
    }
    Shared.animate(player, 3687);
    Shared.sound(player, 2066);
    return true;
  };
  if (attempt()) Shared.action(player, { first: 2, interval: 2, step: attempt });
  return true;
}

/** The thawed demon's attacks, chosen by its room. */
function demonCombat(api) {
  const { CombatMethod, CombatType } = api.core;
  return class IceDemonCombat extends CombatMethod {
    type() {
      return CombatType.MAGIC;
    }

    attackDistance() {
      return 10;
    }

    attackSpeed() {
      return 3;
    }

    start(npc, target) {
      const room = npc.__coxRoom;
      if (room instanceof IceDemonRoom && target?.isPlayer?.()) room.attack(target.getAsPlayer());
    }

    hits() {
      return [];
    }
  };
}

function frozenDemon(event) {
  const target = event.target;
  if (target?.getId?.() !== NPC.FROZEN || !(target.__coxRoom instanceof IceDemonRoom)) return;
  event.allow = false;
  if (event.attacker?.isPlayer?.()) event.attacker.getAsPlayer().sendMessage("It's protected by the ice storm.");
}

module.exports = function registerCoxIceDemon(api) {
  Shared.bind(api);
  Shared.onObjectIds(api, [OBJECT.BRAZIER, OBJECT.LIT_BRAZIER], useBrazier);
  api.registerNpcCombatMethodProvider([NPC.DEMON], demonCombat(api));
  Raid.onRaidArea("canAttack", frozenDemon);
};

Object.assign(module.exports, { IceDemonRoom, lightChance });
