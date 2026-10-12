"use strict";

/**
 * The Crabs room: an energy focus (a floating orb) travels the room, turning at every jewelled
 * crab and taking its colour; brought to the small crystal of its colour, it lights it. Four
 * lit crystals shatter the dark crystal blocking the way on.
 *
 * Wiki (Jewelled Crab; Chambers of Xeric/Strategies, Crab puzzle; Gaining points):
 * - The crabs can't be hurt; striking one turns it red (melee), blue (magic) or green (ranged),
 *   and a player's attack doesn't repeat after changing its colour. "Smash" with a hammer or a
 *   blunt weapon turns it red and stuns it: 50-60 ticks solo, 30-40 for 2-3 raiders, 20-30
 *   for 4-5, 10-20 for 6+.
 * - Points come with each crystal lit, to whoever's crab sent the orb there.
 * Near-Reality: the tiles; the orb leaves its spot every 5 ticks and moves a tile a tick,
 *   starting in the room's direction and turning clockwise at each crab it meets (two crabs at
 *   once fizzle it); a player in its way takes 25% of their hitpoints (and anyone beside them)
 *   and it fizzles; the crystals by index need white, blue, green, red orbs; a crab's colour
 *   lasts 5 seconds; crabs bite for up to 10 every 4 ticks (sound 718); smashing anim 401,
 *   crab anim 1313, gfx 245, sounds 556 and 2727; each lit crystal gives 1,600 points; the
 *   dark crystal brightens a step per crystal and, all four lit, shatters (gfx 1326).
 */

const Shared = require("./CoxShared");
const Raid = require("./CoxRaid");

const CRAB = { WHITE: 7576, RED: 7577, GREEN: 7578, BLUE: 7579 };
const FOCUS = { WHITE: 7580, RED: 7581, GREEN: 7582, BLUE: 7583 };
const OBJECT = { DARK: 29753, LIT: 29762 };
const HAMMER = 2347;
const COLOUR_TICKS = 8;
const POINTS_PER_CRYSTAL = 1600;
const FOCUS_DELAY = 5;
/** The orb each small crystal (by index) needs. */
const NEEDS = [FOCUS.WHITE, FOCUS.BLUE, FOCUS.GREEN, FOCUS.RED];
/** East, south, west, north: clockwise. */
const DIRECTIONS = [[1, 0], [0, -1], [-1, 0], [0, 1]];

/** Cache tiles by version. */
const FOCUS_TILES = [{ x: 3277, y: 5353 }, { x: 3318, y: 5363 }, { x: 3346, y: 5358 }];
const CRAB_TILES = [
  [{ x: 3286, y: 5354 }, { x: 3280, y: 5358 }, { x: 3281, y: 5365 }, { x: 3287, y: 5361 }],
  [{ x: 3306, y: 5358 }, { x: 3311, y: 5353 }, { x: 3313, y: 5361 }, { x: 3318, y: 5356 }],
  [{ x: 3337, y: 5356 }, { x: 3335, y: 5362 }, { x: 3341, y: 5366 }, { x: 3344, y: 5361 }],
];
const DARK_CRYSTAL_TILES = [{ x: 3272, y: 5365 }, { x: 3308, y: 5366 }, { x: 3349, y: 5366 }];
const SMALL_CRYSTAL_TILES = [
  [{ x: 3283, y: 5356 }, { x: 3279, y: 5366 }, { x: 3282, y: 5362 }, { x: 3287, y: 5359 }],
  [{ x: 3311, y: 5356 }, { x: 3320, y: 5360 }, { x: 3306, y: 5361 }, { x: 3305, y: 5356 }],
  [{ x: 3341, y: 5355 }, { x: 3337, y: 5354 }, { x: 3340, y: 5363 }, { x: 3340, y: 5367 }],
];
/**
 * Splash graphics by orb colour, small (fizzling) and large (bursting on a player): Near-Reality's
 * spell hits - wind bolt/wave, fire bolt/wave, wind bolt/earth wave, water bolt/wave.
 */
const BURST = { [FOCUS.WHITE]: [119, 160], [FOCUS.RED]: [128, 157], [FOCUS.GREEN]: [119, 166], [FOCUS.BLUE]: [122, 163] };

/** Wiki (Mod Ash): the stun by party size. */
function stunTicks(raiders) {
  if (raiders <= 1) return Shared.random(50, 60);
  if (raiders <= 3) return Shared.random(30, 40);
  if (raiders <= 5) return Shared.random(20, 30);
  return Shared.random(10, 20);
}

function isHammer(id) {
  if (id == null || id < 0) return false;
  const name = Shared.core().ItemDefinition.forId(id)?.getName?.()?.toLowerCase() ?? "";
  return /hammer|maul|bludgeon|frying pan|meat tenderiser/.test(name);
}

class CrabsRoom extends Raid.Room {
  constructor(raid, record) {
    super(raid, record);
    this.crabs = [];
    this.lit = [false, false, false, false];
    this.focus = null;
  }

  load() {
    const variant = this.record.variant;
    for (const spot of CRAB_TILES[variant]) {
      const crab = this.spawnNpc(CRAB.WHITE, this.tile(spot.x, spot.y), { scale: false, wanderRadius: 3 });
      if (crab) this.crabs.push(crab);
    }
    this.crystalTiles = SMALL_CRYSTAL_TILES[variant].map((spot) => this.tile(spot.x, spot.y));
    const dark = DARK_CRYSTAL_TILES[variant];
    const { GameObject, ObjectManager } = Shared.core();
    this.dark = new GameObject(OBJECT.DARK, this.tile(dark.x, dark.y, 2), 10, this.record.rotation, this.map);
    ObjectManager.register(this.dark, true);
    this.nextFocusAt = this.raid.ticks + FOCUS_DELAY;
  }

  tick() {
    if (this.completed) return;
    for (const crab of this.crabs) {
      if (crab.__coxColourUntil != null && this.raid.ticks >= crab.__coxColourUntil) {
        crab.__coxColourUntil = null;
        crab.setNpcTransformationId(-1);
      }
    }
    // Near-Reality: the crabs go for anyone within 3 tiles.
    for (const crab of this.crabs) {
      if (crab.__coxColourUntil != null || crab.getCombat().getTarget()) continue;
      const near = this.raiders().find((player) => player.getLocation().getDistance(crab.getLocation()) <= 3);
      if (near) crab.getCombat().attack(near);
    }
    if (!this.focus && this.raid.ticks >= this.nextFocusAt) this.sendFocus();
    else if (this.focus) this.moveFocus();
  }

  sendFocus() {
    const spot = FOCUS_TILES[this.record.variant];
    this.focus = this.spawnNpc(FOCUS.WHITE, this.tile(spot.x, spot.y), { scale: false });
    if (!this.focus) return;
    this.focus.__coxColour = FOCUS.WHITE;
    this.direction = (this.record.variant + this.record.rotation) & 3;
    this.sender = null;
  }

  /** The orb is gone (fizzled, burst or used): the next one comes 5 ticks later. */
  endFocus(graphicSize) {
    const focus = this.focus;
    this.focus = null;
    this.nextFocusAt = this.raid.ticks + 1;
    if (!focus) return;
    if (graphicSize != null) {
      const viewers = this.raiders();
      Shared.graphicAt(viewers, BURST[focus.__coxColour][graphicSize], focus.getLocation(), { height: 100 });
      for (const player of viewers) Shared.sound(player, 219);
    }
    this.removeNpc(focus);
  }

  crabAt(x, y) {
    return this.crabs.find((crab) => crab.isRegistered() && crab.getLocation().getX() === x && crab.getLocation().getY() === y) ?? null;
  }

  playerAt(location) {
    return this.raiders().find((player) => player.getHitpoints() > 0 && player.getLocation().equals(location)) ?? null;
  }

  moveFocus() {
    const focus = this.focus;
    const here = focus.getLocation();
    const crystal = this.crystalTiles.findIndex((tile) => tile.getX() === here.getX() && tile.getY() === here.getY());
    if (crystal >= 0) {
      this.reachCrystal(crystal);
      return;
    }
    if (this.burstOn(here)) return;
    let turns = 0;
    for (;;) {
      const [dx, dy] = DIRECTIONS[this.direction];
      const x = here.getX() + dx;
      const y = here.getY() + dy;
      const crab = this.crabAt(x, y);
      if (crab) {
        const crabColour = crab.getNpcTransformationId() > 0 ? crab.getNpcTransformationId() : crab.getId();
        if (crabColour !== CRAB.WHITE) {
          focus.__coxColour = FOCUS.WHITE + (crabColour - CRAB.WHITE);
          focus.setNpcTransformationId(focus.__coxColour);
        }
        const target = crab.getCombat().getTarget();
        this.sender = target?.isPlayer?.() ? target.getAsPlayer() : this.sender;
        if (++turns >= 2) {
          this.endFocus(0);
          return;
        }
        this.direction = (this.direction + 1) & 3;
        continue;
      }
      const { Location, RegionManager } = Shared.core();
      const next = new Location(x, y, here.getZ());
      const atCrystal = this.crystalTiles.some((tile) => tile.equals(next));
      if (!atCrystal && RegionManager.blocked(next, this.map)) {
        this.endFocus(0);
        return;
      }
      Shared.walkStraight(focus, next);
      return;
    }
  }

  /** A player in the orb's way: a quarter of their hitpoints, to them and anyone beside them. */
  burstOn(location) {
    const player = this.playerAt(location);
    if (!player) return false;
    const damage = Math.ceil(Math.min(99, player.getHitpoints()) * 0.25);
    for (const raider of this.raiders()) {
      if (raider.getLocation().getDistance(player.getLocation()) <= 1) Shared.damage(raider, damage);
    }
    this.endFocus(1);
    return true;
  }

  reachCrystal(index) {
    const colour = this.focus.__coxColour;
    if (this.lit[index] || colour !== NEEDS[index]) {
      this.endFocus(0);
      return;
    }
    this.lit[index] = true;
    const tile = this.crystalTiles[index];
    const small = this.map.getTemplateObjects(tile).find((object) => object.getType() === 10);
    if (small) Shared.replaceObject(this.map, small, OBJECT.LIT);
    if (this.sender && this.raid.players.has(this.sender)) this.raid.addPoints(this.sender, POINTS_PER_CRYSTAL);
    this.endFocus(0);
    const litCount = this.lit.filter(Boolean).length;
    this.dark = Shared.replaceObject(this.map, this.dark, OBJECT.DARK + litCount);
    if (litCount < 4) return;
    this.completed = true;
    Shared.later(this.raid, 1, () => {
      for (const crab of this.crabs) this.removeNpc(crab);
    });
    Shared.later(this.raid, 2, () => {
      Shared.graphicAt(this.raiders(), 1326, this.dark.getLocation());
      Shared.core().ObjectManager.deregister(this.dark, true);
    });
  }

  /** The crabs take no damage; a hit changes their colour by the attack's style. */
  modifyHit(npc, hit) {
    if (!this.crabs.includes(npc)) return;
    for (const part of hit.getHits()) part.setDamage(0);
    hit.updateTotalDamage();
    const { CombatType } = Shared.core();
    const type = hit.getCombatType?.();
    const colour = type === CombatType.MAGIC ? CRAB.BLUE : type === CombatType.RANGED ? CRAB.GREEN : CRAB.RED;
    this.colour(npc, colour);
    const attacker = hit.getAttacker?.();
    if (attacker?.isPlayer?.()) attacker.getCombat().reset();
  }

  colour(crab, id, ticks = COLOUR_TICKS) {
    crab.setNpcTransformationId(id);
    crab.__coxColourUntil = this.raid.ticks + ticks;
  }

  smash(player, crab) {
    const { Equipment } = Shared.core();
    const weapon = player.getEquipment().getItems()[Equipment.WEAPON_SLOT]?.getId?.();
    if (!isHammer(weapon) && !Shared.has(player, HAMMER)) {
      player.sendMessage("You don't have a suitable weapon equipped for hammering the crab.");
      return;
    }
    Shared.animate(player, 401);
    for (const viewer of this.raiders()) {
      Shared.sound(viewer, 556);
      Shared.sound(viewer, 2727);
    }
    const ticks = stunTicks(this.raid.scale);
    this.colour(crab, CRAB.RED, ticks);
    crab.performGraphic(Shared.gfx(245, { height: 140 }));
    Shared.animate(crab, 1313);
    crab.getCombat().reset();
    crab.getMovementQueue().reset();
    crab.getMovementQueue().setBlockMovement?.(true);
    Shared.later(this.raid, ticks, () => crab.getMovementQueue().setBlockMovement?.(false));
  }
}

Raid.registerRoom("CRAB_PUZZLE", CrabsRoom);

function smashCrab(event) {
  const crab = event.npc;
  const room = crab?.__coxRoom;
  if (!(room instanceof CrabsRoom)) return false;
  room.smash(event.player, crab);
  return true;
}

/** Crabs nip at whoever's near for up to 10 every 4 ticks. */
function crabCombat(api) {
  const { CombatMethod, CombatType, Animation } = api.core;
  return class JewelledCrabCombat extends CombatMethod {
    type() {
      return CombatType.MELEE;
    }

    attackSpeed() {
      return 4;
    }

    start(npc, target) {
      npc.performAnimation(new Animation(1312));
      if (target?.isPlayer?.()) {
        Shared.sound(target.getAsPlayer(), 718);
        Shared.strike(npc, target.getAsPlayer(), "melee", 10, 0);
      }
    }

    hits() {
      return [];
    }
  };
}

module.exports = function registerCoxCrabs(api) {
  Shared.bind(api);
  for (const name of ["Jewelled Crab", "Jewelled Crab (red)", "Jewelled Crab (green)", "Jewelled Crab (blue)"]) {
    api.onNpcInteraction(name, { Smash: smashCrab });
  }
  api.registerNpcCombatMethodProvider(Object.values(CRAB), crabCombat(api));
};

Object.assign(module.exports, { CrabsRoom, stunTicks, NEEDS });
