const Common = require("./Common.Leviathan");
const Model = require("./Model.Leviathan");
const ADJACENT = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, -1], [-1, 1]];

class Hazards {
  constructor(fight) {
    this.fight = fight;
    this.session = fight.session;
    this.blockers = new Set();
    this.objects = new Map();
    this.originalClip = new Map();
    this.floor = new Set();
    this.pathfinder = null;
    this.tornado = null;
    this.pathCentre = null;
    this.pathNext = null;
    const { west, east, south, north } = Common.data.arena;
    for (let x = west; x <= east; x++) for (let y = south; y <= north; y++) {
      if ((this.session.area.getClip(this.session.tile([x, y])) & 0x200100) === 0) this.floor.add(Model.key([x, y]));
    }
  }
  playerTile() { return this.session.sourceTile(this.fight.player.getLocation()).slice(0, 2); }
  open(tile) { return this.floor.has(Model.key(tile)) && !this.blockers.has(Model.key(tile)); }
  nearPool() {
    const at = this.playerTile();
    return Model.distance(at, Common.data.arena.centre) <= 6 && ADJACENT.some(([dx, dy]) =>
      !this.floor.has(Model.key([at[0] + dx, at[1] + dy])));
  }
  graphic(tile, name) { Common.tileGraphic(this.fight.player, this.session.area, tile, name); }
  place(tile) {
    const key = Model.key(tile);
    if (!this.floor.has(key) || this.blockers.has(key)) return;
    const { GameObject, ObjectManager, RegionManager } = Common.core;
    const at = this.session.tile(tile);
    const before = this.session.area.getClip(at);
    this.originalClip.set(key, before);
    const object = new GameObject(Common.ids.locs.debris, at, 10, 0, this.session.area);
    ObjectManager.register(object, true);
    RegionManager.addClipping(at.getX(), at.getY(), at.getZ(), RegionManager.BLOCKED_TILE, this.session.area);
    this.objects.set(key, object);
    this.blockers.add(key);
  }
  drop(tile, permanent = true, delay = Common.data.inferred.debrisFlightTicks) {
    if (!this.floor.has(Model.key(tile))) return;
    const target = [...tile];
    this.graphic(target, "debris");
    this.fight.at(delay, () => {
      if (!this.fight.alive()) return;
      this.graphic(target, "debrisImpact");
      if (Model.key(this.playerTile()) === Model.key(target)) Common.damage(this.fight, Common.random(0, Common.data.damage.debris));
      if (permanent) this.place(target);
    });
  }
  roar() {
    const tile = this.playerTile();
    this.drop(tile);
    if (this.fight.awakened) for (const [dx, dy] of ADJACENT.slice(0, 4)) this.drop([tile[0] + dx, tile[1] + dy]);
    // The first roar's side debris previews which alternating special comes first.
    const [cx, cy] = Common.data.arena.centre;
    const sides = this.fight.nextSpecial === "lightning" ? [[cx - 6, cy], [cx + 6, cy]] : [[cx, cy - 6], [cx, cy + 7]];
    for (const at of sides) this.drop(at, false);
  }
  lightning() {
    const fight = this.fight, { inferred } = Common.data;
    Common.animate(fight.boss, "lightning");
    for (let tick = 1; tick <= inferred.lightningDurationTicks; tick++) fight.at(tick, () => {
      if (!fight.alive() || fight.special !== "lightning") return;
      const target = this.playerTile();
      this.graphic(target, "lightningGround");
      const delay = fight.player.getHitpoints() <= 25 ? Math.max(1, inferred.lightningDelayTicks - 1) : inferred.lightningDelayTicks;
      fight.at(delay, () => {
        if (!fight.alive()) return;
        this.graphic(target, "lightning");
        if (Model.key(this.playerTile()) === Model.key(target)) Common.damage(fight, Common.random(0, Common.data.damage.lightning));
      });
      // The side bolts never target the tiles immediately surrounding the pool.
      const tiles = [...this.floor].map(key => key.split(',').map(Number)).filter(at => Model.distance(at, Common.data.arena.centre) > 6);
      if (tiles.length) this.drop(Common.pick(tiles), false, delay);
    });
    fight.at(inferred.lightningDurationTicks + inferred.lightningDelayTicks + 1, () => {
      if (fight.special === "lightning") { Common.animate(fight.boss, "lightningEnd"); fight.endSpecial(); }
    });
  }
  smoke() {
    const fight = this.fight;
    Common.animate(fight.boss, "smoke");
    // Ten aimed rocks, one per tick, taking two ticks to reach the marked tile.
    for (let tick = 1; tick <= 10; tick++) fight.at(tick, () => {
      if (fight.alive()) { Common.animate(fight.boss, "smokeLoop"); this.drop(this.playerTile()); }
    });
    fight.at(13, () => {
      if (!fight.alive()) return;
      Common.animate(fight.boss, "smokeBlast");
      this.graphic(Common.data.arena.centre, "smoke");
      if (!Model.covered(Common.data.arena.centre, this.playerTile(), this.blockers))
        Common.damage(fight, Common.random(0, fight.stats.smokeMax));
      fight.endSpecial();
    });
  }
  spawnPathfinder() {
    const corners = Common.data.arena.pathCorners;
    this.pathIndex = corners.findIndex(tile => this.open(tile));
    if (this.pathIndex < 0) this.pathIndex = 0;
    this.pathCentre = [...corners[this.pathIndex]];
    this.pathfinder = this.session.spawn(Common.ids.npcs.pathfinder, [this.pathCentre[0] - 1, this.pathCentre[1] - 1]);
    this.pathfinder?.setScriptedMovement(true);
    this.pathfinder?.setFlag(Common.core.NPC.WALK_THROUGH_ENTITIES_FLAG, true);
    this.pathNext = null;
    this.pathDestination = (this.pathIndex + 1) % corners.length;
    this.pathfinder?.performGraphic(Common.graphic("aura"));
  }
  pathReady() { return !!this.pathfinder?.isRegistered?.(); }
  inAura() { return this.pathReady() && Model.inAura(this.pathCentre, this.playerTile(), this.fight.awakened); }
  stepToward(from, to) {
    if (Model.key(from) === Model.key(to) || !this.open(to)) return from;
    const visited = new Set([Model.key(from)]), queue = [{ tile: from, first: null }];
    // Every queued tile is in the finite arena floor (plus the starting tile),
    // so a sealed route terminates without an arbitrary search limit.
    for (let index = 0; index < queue.length; index++) {
      const { tile, first } = queue[index];
      const dx = Math.sign(to[0] - tile[0]), dy = Math.sign(to[1] - tile[1]);
      for (const [x, y] of [[dx, dy], [dx, 0], [0, dy], ...ADJACENT]) {
        if (!x && !y) continue;
        const next = [tile[0] + x, tile[1] + y], key = Model.key(next);
        if (visited.has(key) || !this.open(next)) continue;
        if (x && y && (!this.open([tile[0] + x, tile[1]]) || !this.open([tile[0], tile[1] + y]))) continue;
        const start = this.session.tile(tile), end = this.session.tile(next);
        if (!Common.core.RegionManager.canMove(start.getX(), start.getY(), end.getX(), end.getY(),
          start.getZ(), 1, 1, this.session.area)) continue;
        const step = first ?? next;
        if (key === Model.key(to)) return step;
        visited.add(key);
        queue.push({ tile: next, first: step });
      }
    }
    return from;
  }
  spawnTornado() {
    if (this.tornado) return;
    this.tornadoTile = [...Common.data.arena.pathCorners[2]];
    this.tornado = this.session.spawn(Common.ids.npcs.tornado, this.tornadoTile);
    this.tornado?.setScriptedMovement(true);
    this.tornado?.performGraphic(Common.graphic("tornado"));
    this.tornadoNext = this.fight.tick + Common.data.inferred.tornadoStepTicks;
    this.tornadoHitAt = 0;
  }
  process() {
    const fight = this.fight;
    if (this.pathReady()) {
      if (this.pathNext === null) this.pathNext = fight.tick + Common.data.inferred.pathStepTicks;
      if (fight.tick >= this.pathNext) {
        const target = Common.data.arena.pathCorners[this.pathDestination];
        this.pathCentre = this.stepToward(this.pathCentre, target);
        if (Model.key(this.pathCentre) === Model.key(target)) this.pathDestination = (this.pathDestination + 1) % 4;
        this.pathfinder.exactMove(this.session.tile([this.pathCentre[0] - 1, this.pathCentre[1] - 1]));
        this.pathNext = fight.tick + Common.data.inferred.pathStepTicks;
      }
    }
    if (fight.awakened && fight.boss.getHitpoints() <= fight.stats.hitpoints / 2) this.spawnTornado();
    if (this.tornado && fight.tick >= this.tornadoNext) {
      this.tornadoTile = this.stepToward(this.tornadoTile, this.playerTile());
      this.tornado.exactMove(this.session.tile(this.tornadoTile));
      this.tornadoNext = fight.tick + Common.data.inferred.tornadoStepTicks;
    }
    if (this.tornado && Model.key(this.tornadoTile) === Model.key(this.playerTile()) && fight.tick >= this.tornadoHitAt) {
      Common.damage(fight, Common.data.damage.tornado);
      this.tornadoHitAt = fight.tick + Common.data.inferred.tornadoStepTicks;
    }
  }
  clear() {
    for (const [key, object] of this.objects) {
      Common.core.ObjectManager.deregister(object, true);
      this.session.area.setClip(object.getLocation(), this.originalClip.get(key));
    }
    this.objects.clear(); this.originalClip.clear(); this.blockers.clear();
    for (const npc of [this.pathfinder, this.tornado]) if (npc) {
      if (npc.getPrivateArea() === this.session.area) this.session.area.remove(npc);
      Common.api.removeNpc(npc);
    }
    this.pathfinder = null; this.pathCentre = null; this.tornado = null;
    this.pathNext = null;
  }
}
module.exports = { Hazards };
