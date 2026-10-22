"use strict";

/**
 * Xarth (section 3, east), a fire demon that never moves. First it burns down the rubble the
 * party shelters behind; then the arena catches fire and corpses walk in to feed it.
 *
 * Captured as a spectator in four fights (docs/fractured-archive.md):
 * - Xarth (16684, 3x3) at 4190,5534, facing west; 2,600/3,770/4,860/5,950 hitpoints for two to
 *   five. Three rubble heaps (2x2) at 4193,5530, 4196,5536 and 4193,5540. Music 896.
 * - Phase one is three cycles of 31 ticks:
 *   - five magic attacks four ticks apart (fireball 4034 at a player);
 *   - an AoE (aoe_01): projanim 4378 at each player's tile, with a shadow and its hit 120 cycles
 *     later;
 *   - the flame blast (flame_blast_01). Three ticks later a fire wave rolls out from him
 *     (ennius_fire_explosion, delays by distance): a 90-degree wedge in the first two cycles,
 *     all round in the third.
 *   - A heap collapses in the same tick (the rubble NPC destroyed, collapse anim and graphic,
 *     hit for 100). The wave leaves out the tiles behind that heap.
 * - Phase two (the heaps gone):
 *   - seven arena fires and the eight corpse piles on the edge burning;
 *   - every 21 ticks four ranged attacks (projectile 4374 at a player), then two magic attacks
 *     (three for five players) at edge tiles;
 *   - three ticks after each magic attack a Corpse (16687, 62 hitpoints) rises on that tile and
 *     walks a tile a tick towards him. One that reaches him is absorbed and heals him twice the
 *     hitpoints it had left;
 *   - three more fires every cycle.
 * - At 0: death_01 with its graphic, gone six ticks later, and the room is won.
 * Estimates (a spectator sees no damage on players): every damage figure, what the fires do
 * (a burn each tick), which heap goes when and which way the wedge points (at that heap), where
 * the fires and corpses appear.
 */

const Shared = require("./Shared.FracturedArchive");
const Raid = require("./RaidState.FracturedArchive");

const { named, anim, spot } = Shared;

const LAYOUT = {
  boss: { x: 4190, y: 5534, z: 0 },
  arena: { minX: 4183, maxX: 4199, minY: 5527, maxY: 5543 },
  rubble: [{ x: 4193, y: 5530 }, { x: 4196, y: 5536 }, { x: 4193, y: 5540 }],
  /** The corpse piles round the edge (the map's tfa_xarth01_corpse_pile01-08). */
  piles: [[4191, 5545], [4201, 5535], [4191, 5524], [4181, 5535], [4180, 5544], [4200, 5544], [4200, 5524], [4180, 5524]],
};
const HITPOINTS = { 2: 2600, 3: 3770, 4: 4860, 5: 5950 };

const TIME = {
  CYCLE_ONE: 31,
  MAGIC_GAP: 4,
  MAGICS: 5,
  BLAST_WAVE: 3,
  CYCLE_TWO: 21,
  RANGED_GAP: 3,
  CORPSE_RISES: 3,
  HEAP_GONE: 3,
  DEATH: 6,
};
const DAMAGE = { MAGIC: 30, AOE: 35, WAVE: 45, RANGED: 25, FIRE: 6 };
const FIRES_AT_START = 7;
const FIRES_PER_CYCLE = 3;
const CORPSE_HP = 62;

class XarthRoom extends Raid.Room {
  onBuild() {
    this.boss = this.spawn(named("npc", "tfa_xarth"), LAYOUT.boss, { scripted: true, face: Shared.core().Direction.WEST.getId() });
    const blocker = named("loc", "invisible_type8_blocking");
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) this.placeObject(blocker, { x: LAYOUT.boss.x + x, y: LAYOUT.boss.y + y, z: 0 });
    this.heaps = LAYOUT.rubble.map((tile) => ({ tile, npc: this.spawn(named("npc", "tfa_xarth_rubble_npc"), { ...tile, z: 0 }, { scripted: true }), down: false }));
    this.fires = new Map();
    this.corpses = new Set();
    this.cycles = 0;
    this.dead = false;
  }

  onStart() {
    this.setHitpoints(this.boss, this.scaled(HITPOINTS));
    this.showBar(this.boss.getId(), this.boss.getMaxHitpoints());
    this.phaseOneCycle();
  }

  tick() {
    if (!this.isStarted() || this.dead) return;
    this.barTo(this.boss.getHitpoints());
    this.burn();
    this.walkCorpses();
  }

  // ---------------------------------------------------------------- phase one

  phaseOneCycle() {
    if (this.dead) return;
    const cycle = this.cycles++;
    for (let i = 0; i < TIME.MAGICS; i++) this.later(i * TIME.MAGIC_GAP, () => this.magic());
    const aoeAt = TIME.MAGICS * TIME.MAGIC_GAP;
    this.later(aoeAt, () => this.aoe());
    this.later(aoeAt + 4, () => this.blast(cycle));
    this.later(TIME.CYCLE_ONE, () => (this.heaps.every((heap) => heap.down) ? this.startPhaseTwo() : this.phaseOneCycle()));
  }

  magic() {
    const player = Shared.randomOf(this.fighters());
    if (!player || this.dead) return;
    this.boss.setPositionToFace(player.getLocation());
    this.boss.performAnimation(anim("xarth_attack_magic_01"));
    Shared.projectile(this.area, this.boss, player, named("spotanim", "luc2_undead_demon_fireball_proj_big"), { delay: 30, end: 90, angle: 0, progress: 160, startHeight: 470, endHeight: 120 });
    this.strike(this.boss, player, "magic", DAMAGE.MAGIC, 3, { prayerMultiplier: 0 });
  }

  aoe() {
    if (this.dead) return;
    this.boss.performAnimation(anim("xarth_attack_aoe_01"));
    for (const player of this.fighters()) {
      const tile = Shared.tileOf(player);
      Shared.projectile(this.area, this.boss, tile, named("spotanim", "vfx_xarth_aoe_projanim_01"), { delay: 60, end: 120, angle: 30, progress: 128, startHeight: 470, endHeight: 0 });
      Shared.graphicAt(this.area, named("spotanim", "gargboss_debris_shadow_90"), tile, { delay: 30 });
      Shared.graphicAt(this.area, named("spotanim", "vfx_xarth_aoe_hitanim_01"), tile, { delay: 120 });
      this.later(4, () => this.hitOn([tile], DAMAGE.AOE));
    }
  }

  /** The flame blast: a wave out from him (a wedge at the heap he burns, then all round). */
  blast(cycle) {
    if (this.dead) return;
    this.boss.performAnimation(anim("xarth_attack_flame_blast_01"));
    this.boss.performGraphic(spot("vfx_xarth_attack_flame_blast_01"));
    const heap = this.heaps.find((candidate) => !candidate.down) ?? null;
    this.later(TIME.BLAST_WAVE, () => {
      if (this.dead) return;
      const centre = { x: LAYOUT.boss.x + 1, y: LAYOUT.boss.y + 1 };
      const all = cycle >= 2;
      const aim = heap ? Math.atan2(heap.tile.y - centre.y, heap.tile.x - centre.x) : 0;
      const tiles = [];
      const { arena } = LAYOUT;
      for (let x = arena.minX; x <= arena.maxX; x++) {
        for (let y = arena.minY; y <= arena.maxY; y++) {
          const tile = { x, y, z: 0 };
          if (Shared.distanceTo(this.boss, tile) === 0) continue;
          if (!all && Math.abs(angleBetween(Math.atan2(y - centre.y, x - centre.x), aim)) > Math.PI / 4) continue;
          if (heap && behind(centre, heap.tile, tile)) continue;
          tiles.push(tile);
        }
      }
      for (const tile of tiles) {
        const distance = Math.max(Math.abs(tile.x - centre.x), Math.abs(tile.y - centre.y));
        Shared.graphicAt(this.area, named("spotanim", "vfx_vmq4_ennius_fire_explosion"), tile, { delay: Math.min(7, distance) * 6 });
      }
      Shared.areaSound(this.area, this.boss, 10579);
      this.hitOn(tiles, DAMAGE.WAVE);
      if (heap) this.collapse(heap);
    });
  }

  /**
   * A heap collapsing (captured): the heap NPC goes, a destroyed one plays the collapse with its
   * graphic and goes three ticks later, and the heap's loc is replaced by an invisible one, so
   * the 2x2 is clear and walkable.
   */
  collapse(heap) {
    heap.down = true;
    const tile = { ...heap.tile, z: 0 };
    if (heap.npc) this.despawn(heap.npc);
    const destroyed = this.spawn(named("npc", "tfa_xarth_rubble_npc_destroyed"), tile, { scripted: true });
    if (destroyed) {
      destroyed.performAnimation(anim("loc_xarth_rubble_collapse_01"));
      destroyed.performGraphic(spot("vfx_xarth_rubble_collapse_01"));
      this.later(TIME.HEAP_GONE, () => this.despawn(destroyed));
    }
    this.placeObject(named("loc", "invisible_type8_nonblocking"), tile);
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) this.area.setClip(Shared.loc({ x: tile.x + dx, y: tile.y + dy, z: 0 }), 0);
  }

  // ---------------------------------------------------------------- phase two

  startPhaseTwo() {
    if (this.dead) return;
    this.phaseTwo = true;
    for (let i = 0; i < FIRES_AT_START; i++) this.addFire();
    LAYOUT.piles.forEach(([x, y], index) => this.placeObject(named("loc", `tfa_xarth01_corpse_pile_fire0${index + 1}`), { x, y, z: 0 }));
    this.phaseTwoCycle();
  }

  phaseTwoCycle() {
    if (this.dead) return;
    for (let i = 0; i < 4; i++) this.later(i * TIME.RANGED_GAP, () => this.ranged());
    const magics = this.size >= 5 ? 3 : 2;
    for (let i = 0; i < magics; i++) this.later(4 * TIME.RANGED_GAP + i * 2, () => this.summon());
    this.later(TIME.CYCLE_TWO - 1, () => {
      for (let i = 0; i < FIRES_PER_CYCLE; i++) this.addFire();
    });
    this.later(TIME.CYCLE_TWO, () => this.phaseTwoCycle());
  }

  ranged() {
    const player = Shared.randomOf(this.fighters());
    if (!player || this.dead) return;
    this.boss.setPositionToFace(player.getLocation());
    this.boss.performAnimation(anim("xarth_attack_ranged_01"));
    this.boss.performGraphic(spot("vfx_xarth_attack_ranged_spotanim_01"));
    Shared.projectile(this.area, this.boss, player, named("spotanim", "vfx_xarth_attack_ranged_projectile_01"), { delay: 60, end: 120, angle: 10, progress: 200, startHeight: 470, endHeight: 120 });
    this.strike(this.boss, player, "ranged", DAMAGE.RANGED, 4, { prayerMultiplier: 0 });
  }

  /** A magic attack at an edge tile, where a corpse rises three ticks later. */
  summon() {
    if (this.dead) return;
    const tile = edgeTile();
    this.boss.performAnimation(anim("xarth_attack_magic_01"));
    Shared.projectile(this.area, this.boss, tile, named("spotanim", "luc2_undead_demon_fireball_proj_big"), { delay: 30, end: 90, angle: 0, progress: 160, startHeight: 470, endHeight: 50 });
    this.later(TIME.CORPSE_RISES, () => {
      if (this.dead) return;
      const corpse = this.spawn(named("npc", "tfa_xarth_corpse"), tile, { scripted: true, fadeIn: 30 });
      if (!corpse) return;
      this.setHitpoints(corpse, CORPSE_HP);
      corpse.performGraphic(spot("vfx_xarth_corpse_walk_fire_01"));
      this.corpses.add(corpse);
    });
  }

  walkCorpses() {
    for (const corpse of [...this.corpses]) {
      if (corpse.__dying) continue;
      if (Shared.distanceTo(this.boss, corpse.getLocation()) <= 1) {
        this.absorb(corpse);
        continue;
      }
      const at = corpse.getLocation();
      const step = Shared.loc({ x: at.getX() + Math.sign(LAYOUT.boss.x + 1 - at.getX()), y: at.getY() + Math.sign(LAYOUT.boss.y + 1 - at.getY()), z: 0 });
      corpse.getMovementQueue().reset().addSteps(step);
    }
  }

  absorb(corpse) {
    corpse.__dying = true;
    corpse.performAnimation(anim("xarth_corpse_absorbed_01"));
    corpse.performGraphic(spot("vfx_xarth_corpse_absorbed_01"));
    this.boss.performGraphic(spot("vfx_xarth_absorb_corpse_fire_01"));
    const heal = corpse.getHitpoints() * 2;
    this.boss.setHitpoints(Math.min(this.boss.getMaxHitpoints(), this.boss.getHitpoints() + heal));
    this.later(2, () => {
      this.corpses.delete(corpse);
      this.despawn(corpse);
    });
  }

  addFire() {
    const { arena } = LAYOUT;
    for (let tries = 0; tries < 20; tries++) {
      const tile = { x: Shared.random(arena.minX, arena.maxX), y: Shared.random(arena.minY, arena.maxY), z: 0 };
      const key = `${tile.x},${tile.y}`;
      if (this.fires.has(key) || Shared.distanceTo(this.boss, tile) <= 1 || !Shared.floorFree(this.area, tile)) continue;
      this.fires.set(key, this.placeObject(named("loc", "tfa_xarth_arenafire"), tile));
      return;
    }
  }

  burn() {
    if (this.fires.size === 0) return;
    for (const player of this.fighters()) {
      const at = player.getLocation();
      if (this.fires.has(`${at.getX()},${at.getY()}`)) Shared.damage(player, DAMAGE.FIRE);
    }
  }

  hitOn(tiles, damage) {
    for (const player of this.fighters()) {
      const at = Shared.tileOf(player);
      if (tiles.some((tile) => tile.x === at.x && tile.y === at.y)) Shared.damage(player, Shared.random(Math.floor(damage / 2), damage));
    }
  }

  // ---------------------------------------------------------------- deaths

  holdsOn(npc) {
    if (npc === this.boss) {
      this.fall();
      return true;
    }
    if (this.corpses.has(npc)) {
      npc.__dying = true;
      npc.performAnimation(anim("xarth_corpse_death_01"));
      npc.performGraphic(spot("vfx_xarth_corpse_death_01"));
      this.later(2, () => {
        this.corpses.delete(npc);
        this.despawn(npc);
      });
      return true;
    }
    return this.heaps.some((heap) => heap.npc === npc);
  }

  fall() {
    if (this.dead) return;
    this.dead = true;
    this.boss.setHitpoints(1);
    this.boss.performAnimation(anim("xarth_death_01"));
    this.boss.performGraphic(spot("vfx_xarth_death_01"));
    this.hideBars();
    for (const corpse of [...this.corpses]) this.despawn(corpse);
    this.corpses.clear();
    this.later(TIME.DEATH, () => {
      this.despawn(this.boss);
      this.complete();
    });
  }

  canAttack(attacker, target) {
    if (attacker?.isPlayer?.() && (target?.__dying || (target === this.boss && this.dead))) return false;
    return null;
  }
}

/** A tile on the arena's edge (estimate: where the corpses were seen rising). */
function edgeTile() {
  const { arena } = LAYOUT;
  const side = Shared.random(0, 3);
  if (side === 0) return { x: Shared.random(arena.minX, arena.maxX), y: arena.minY, z: 0 };
  if (side === 1) return { x: Shared.random(arena.minX, arena.maxX), y: arena.maxY, z: 0 };
  if (side === 2) return { x: arena.minX, y: Shared.random(arena.minY, arena.maxY), z: 0 };
  return { x: arena.maxX, y: Shared.random(arena.minY, arena.maxY), z: 0 };
}

function angleBetween(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Whether a tile is behind a 2x2 heap, seen from the boss's centre. */
function behind(centre, heap, tile) {
  const heapCentre = { x: heap.x + 0.5, y: heap.y + 0.5 };
  const toHeap = Math.hypot(heapCentre.x - centre.x, heapCentre.y - centre.y);
  const toTile = Math.hypot(tile.x - centre.x, tile.y - centre.y);
  if (toTile <= toHeap) return false;
  const spread = Math.atan2(1.2, toHeap);
  return Math.abs(angleBetween(Math.atan2(tile.y - centre.y, tile.x - centre.x), Math.atan2(heapCentre.y - centre.y, heapCentre.x - centre.x))) <= spread;
}

module.exports = function registerXarth(api) {
  Shared.bind(api);
  Raid.registerRoom("XARTH", XarthRoom);
};

Object.assign(module.exports, { XarthRoom, LAYOUT, HITPOINTS, TIME, DAMAGE });
