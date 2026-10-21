// From server/: node --test tests/haunted-mine-terrain.test.cjs (after yarn build).
const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const path = require('node:path');

before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(path.resolve(__dirname, '..'));
  require('../dist/game/collision/RegionManager').RegionManager.init();
  require('../dist/game/definition/ObjectDefinition').ObjectDefinition.init();
});

const REGION = 10821;
const TILE = { x: 2725, y: 4453 };

function terrainTiles(data) {
  const buffer = Buffer.from(data);
  let offset = 0;
  const readU16 = () => { const value = buffer.readUInt16BE(offset); offset += 2; return value; };
  const tiles = [];
  for (let z = 0; z < 4; z++) {
    for (let x = 0; x < 64; x++) {
      for (let y = 0; y < 64; y++) {
        const ops = [];
        for (;;) {
          const op = readU16();
          if (op === 0) break;
          if (op === 1) { ops.push({ op, payload: buffer[offset++] }); break; }
          if (op <= 49) { ops.push({ op, payload: readU16() }); }
          else if (op <= 81) { ops.push({ op }); }
          // RegionManager treats other opcodes as payload-less markers.
        }
        tiles.push({ z, x, y, ops });
      }
    }
  }
  assert.ok(offset <= buffer.length && buffer.length - offset <= 1, 'terrain stream consumed with optional trailing byte');
  return tiles;
}

function terrainSettingOffsets(data, plane, localX, localY) {
  const buffer = Buffer.from(data);
  let offset = 0;
  for (let z = 0; z < 4; z++) {
    for (let x = 0; x < 64; x++) {
      for (let y = 0; y < 64; y++) {
        const target = z === plane && x === localX && y === localY;
        const offsets = [];
        for (;;) {
          const start = offset;
          const op = buffer.readUInt16BE(offset);
          offset += 2;
          if (op === 0) break;
          if (op === 1) { offset += 1; break; }
          if (op <= 49) { offset += 2; }
          else if (op <= 81 && target) offsets.push({ start, opcode: op });
        }
        if (target) return offsets;
      }
    }
  }
  throw new Error('target terrain tile not found');
}

function loadQuestRegistration() {
  const calls = [];
  const events = {};
  const api = new Proxy({
    core: require('../dist/plugins/PluginManager').PluginManager.getCoreApi(),
    persistAttribute() {},
    onCustomEvent(key, fn) { (events[key] ??= []).push(fn); },
    emitCustomEvent(key, event) { for (const fn of events[key] ?? []) fn(event); },
    clearMapTerrainBlockAt(x, y, plane) { calls.push([x, y, plane]); },
  }, { get: (target, key) => target[key] ?? ((...args) => {
    const fn = args.find((arg) => typeof arg === 'function');
    if (fn) (events[key] ??= []).push(fn);
  }) });
  require('../plugins/quests/quests/HauntedMine.Quest')(api);
  for (const fn of events.onServerStartup ?? []) fn({ timestamp: 0 });
  return calls;
}

function routeSteps(from, to) {
  const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');
  const { Location } = require('../dist/game/model/Location');
  const queue = { points: [], reset() { return queue; }, setRoute() { return queue; }, setPathX() { return queue; },
    setPathY() { return queue; }, addCheckpoint(tile) { queue.points.push([tile.getX(), tile.getY()]); return queue; },
    syncDestinationFlagToRoute() { return queue; } };
  const entity = { isPlayer: () => false, getAsPlayer: () => ({ getUsername: () => '' }),
    getLocation: () => new Location(from.x, from.y, 0), getSize: () => 1, getPrivateArea: () => null, getMovementQueue: () => queue };
  return PathFinder.calculateRoute(entity, 0, to.x, to.y, 0, 0, 0, 0, false);
}

test('Haunted Mine registers the flooded-tile runtime correction on server startup', () => {
  assert.deepEqual(loadQuestRegistration(), [[2725, 4453, 0]]);
});

test('raw cache clips the flooded crossing and the intended route fails', () => {
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { MapRegionReplacementManager } = require('../dist/game/collision/MapRegionReplacementManager');
  assert.equal(MapRegionReplacementManager.getReplacementMapData(REGION), null, 'no static/runtime replacement preloaded');
  RegionManager.loadMapFiles(TILE.x, TILE.y);
  const blocked = (x, y) => RegionManager.blocked({ getX: () => x, getY: () => y, getZ: () => 0 }, null);
  assert.equal(blocked(TILE.x, TILE.y), true, 'cache 241 blocks the captured crossing');
  assert.equal(routeSteps({ x: 2725, y: 4456 }, { x: 2744, y: 4436 }), 0, 'lift landing cannot path to the east-stairs approach');
});

test('runtime terrain fix clears only BLOCKED_TILE, preserves objects/neighbours, and streams the client bytes', () => {
  const { CacheMaps } = require('../dist/game/cache/CacheMaps');
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { MapRegionReplacementManager } = require('../dist/game/collision/MapRegionReplacementManager');
  const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
  const base = CacheMaps.getRegion(REGION);
  assert.ok(base?.terrainData && base?.objectData, 'base cache map exists');

  const { PluginManager } = require('../dist/plugins/PluginManager');
  PluginManager.createApi('HauntedMineRuntimeTest').clearMapTerrainBlockAt(TILE.x, TILE.y, 0);
  const replacement = MapRegionReplacementManager.getReplacementMapData(REGION);
  assert.ok(replacement?.terrainData && replacement?.objectData, 'runtime replacement exists');
  assert.equal(replacement.terrainData.length, base.terrainData.length - 2, 'only the 2-byte setting op is removed');
  assert.deepEqual(Buffer.from(replacement.objectData), Buffer.from(base.objectData), 'objects byte-identical');

  const before = terrainTiles(base.terrainData);
  const after = terrainTiles(replacement.terrainData);
  const changed = after.filter((entry, index) => JSON.stringify(entry.ops) !== JSON.stringify(before[index].ops));
  assert.equal(changed.length, 1, 'only one tile changes');
  assert.deepEqual([changed[0].z, changed[0].x, changed[0].y], [0, 37, 37]);
  const oldOps = before.find((entry) => entry.z === 0 && entry.x === 37 && entry.y === 37).ops;
  assert.ok(oldOps.some((op) => op.op === 50), 'base has BLOCKED_TILE setting op 50');
  assert.ok(!changed[0].ops.some((op) => op.op === 50), 'runtime bytes remove only the blocked setting');
  assert.ok(changed[0].ops.some((op) => op.op === 2 && op.payload === 156), 'water overlay 156 preserved');
  assert.ok(changed[0].ops.some((op) => op.op === 1 && op.payload === 10), 'other tile op preserved');

  const blocked = (x, y) => RegionManager.blocked({ getX: () => x, getY: () => y, getZ: () => 0 }, null);
  assert.equal(blocked(TILE.x, TILE.y), false, 'captured crossing is walkable');
  assert.equal(blocked(2724, 4453), true, 'west neighbour stays blocked');
  assert.equal(blocked(2726, 4453), true, 'east neighbour stays blocked');
  assert.ok(routeSteps({ x: 2725, y: 4456 }, { x: 2744, y: 4436 }) > 0, 'lift landing -> east-stairs approach 2744,4436');
  assert.ok(routeSteps({ x: 2725, y: 4456 }, { x: 2748, y: 4434 }) > 0, 'lift landing -> east-stairs approach');

  const door = (MapObjects.mapObjects.get(MapObjects.getHash(2799, 4453, 0)) ?? []).find((object) => object.getId() === 4962);
  assert.ok(door, 'boss door 4962 remains present');

  const packets = [];
  const sent = MapRegionReplacementManager.sendVisibleReplacementsToPlayer({
    getSession: () => ({ sendClientPacket: (packet) => { packets.push(packet); return true; } }),
  }, TILE.x, TILE.y);
  assert.equal(sent, 1, 'runtime replacement is streamed as a client region packet');
  const packet = packets[0];
  assert.ok(packet.includes(Buffer.from(replacement.terrainData)), 'client packet carries the runtime terrain bytes');
  assert.ok(!packet.includes(Buffer.from(base.terrainData)), 'client packet does not carry the blocked base terrain');
  assert.equal(RegionManager.reloadRegion(REGION), true);
  assert.equal(blocked(TILE.x, TILE.y), false, 'runtime correction survives a later region reload');
});

test('combined blocked+bridge+roof setting keeps its other bits and reaches the client', () => {
  const { CacheMaps } = require('../dist/game/cache/CacheMaps');
  const { MapRegionReplacementManager } = require('../dist/game/collision/MapRegionReplacementManager');
  const base = CacheMaps.getRegion(REGION);
  const good = MapRegionReplacementManager.getReplacementMapData(REGION);
  assert.ok(good?.terrainData && base?.terrainData, 'runtime replacement is present');

  const synthetic = Buffer.from(base.terrainData);
  const offsets = terrainSettingOffsets(synthetic, 0, 37, 37);
  assert.equal(offsets.length, 1, 'one setting node at the target tile');
  synthetic.writeUInt16BE(56, offsets[0].start); // setting 7 = blocked+bridge+roof
  MapRegionReplacementManager.replaceMapRegionData(REGION, synthetic, base.objectData, 'combined-setting test');

  MapRegionReplacementManager.clearTerrainBlockTile(REGION, 0, 37, 37);
  const combined = MapRegionReplacementManager.getReplacementMapData(REGION);
  const after = terrainSettingOffsets(combined.terrainData, 0, 37, 37);
  assert.equal(after.length, 1);
  assert.equal(after[0].opcode, 55, 'setting 7 -> 6, not removed');
  const beforeTiles = terrainTiles(synthetic);
  const afterTiles = terrainTiles(combined.terrainData);
  const changed = afterTiles.filter((entry, index) => JSON.stringify(entry.ops) !== JSON.stringify(beforeTiles[index].ops));
  assert.equal(changed.length, 1, 'only the target tile changes');
  assert.equal(changed[0].ops.find((op) => op.op >= 50 && op.op <= 81).op, 55, 'other setting bits preserved');

  const packets = [];
  const sent = MapRegionReplacementManager.sendVisibleReplacementsToPlayer({
    getSession: () => ({ sendClientPacket: (packet) => { packets.push(packet); return true; } }),
  }, TILE.x, TILE.y);
  assert.equal(sent, 1);
  assert.ok(packets[0].includes(Buffer.from(combined.terrainData)), 'client payload carries the rewritten opcode');
  assert.ok(!packets[0].includes(Buffer.from(synthetic)), 'client payload is not the pre-clear terrain');
  MapRegionReplacementManager.replaceMapRegionData(REGION, good.terrainData, good.objectData, 'restore runtime fix');
});

test('invalid, truncated and repeated terrain clears do not silently succeed', () => {
  const { MapRegionReplacementManager } = require('../dist/game/collision/MapRegionReplacementManager');
  const good = MapRegionReplacementManager.getReplacementMapData(REGION);
  assert.ok(good?.terrainData, 'runtime replacement is present');

  for (const args of [[-1, 0, 37, 37], [0x10000, 0, 37, 37], [REGION, 4, 37, 37], [REGION, 0, 64, 37], [REGION, 0, 37, -1], [REGION, 0, 1.5, 37]]) {
    assert.throws(() => MapRegionReplacementManager.clearTerrainBlockTile(...args));
    assert.deepEqual(MapRegionReplacementManager.getReplacementMapData(REGION), good, 'invalid input leaves registry unchanged');
  }

  const truncated = good.terrainData.slice(0, good.terrainData.length - 10);
  MapRegionReplacementManager.replaceMapRegionData(REGION, truncated, good.objectData, 'truncated test');
  const before = MapRegionReplacementManager.getReplacementMapData(REGION);
  assert.throws(() => MapRegionReplacementManager.clearTerrainBlockTile(REGION, 0, 37, 37));
  assert.deepEqual(MapRegionReplacementManager.getReplacementMapData(REGION), before, 'truncated terrain is not replaced with a partial result');
  MapRegionReplacementManager.replaceMapRegionData(REGION, good.terrainData, good.objectData, 'restore runtime fix');

  const first = MapRegionReplacementManager.clearTerrainBlockTile(REGION, 0, 37, 37);
  const firstData = MapRegionReplacementManager.getReplacementMapData(REGION);
  const second = MapRegionReplacementManager.clearTerrainBlockTile(REGION, 0, 37, 37);
  const secondData = MapRegionReplacementManager.getReplacementMapData(REGION);
  assert.deepEqual(secondData.terrainData, firstData.terrainData, 'second clear is idempotent');
  assert.equal(second.terrainBytes, first.terrainBytes);
});
