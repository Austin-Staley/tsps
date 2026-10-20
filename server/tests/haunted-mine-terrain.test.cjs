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

test('10821 pack changes only one terrain setting and keeps objects identical', () => {
  const { CacheMaps } = require('../dist/game/cache/CacheMaps');
  const { MapRegionReplacementManager } = require('../dist/game/collision/MapRegionReplacementManager');
  const base = CacheMaps.getRegion(REGION);
  const replacement = MapRegionReplacementManager.getReplacementMapData(REGION);
  assert.ok(base?.terrainData && replacement?.terrainData, 'base and replacement terrain exist');
  assert.ok(replacement.objectData, 'replacement keeps object data');
  assert.deepEqual(Buffer.from(replacement.objectData), Buffer.from(base.objectData), 'object data byte-identical');

  const before = terrainTiles(base.terrainData);
  const after = terrainTiles(replacement.terrainData);
  assert.equal(after.length, before.length);
  const changed = [];
  for (let i = 0; i < before.length; i++) {
    if (JSON.stringify(before[i].ops) !== JSON.stringify(after[i].ops)) changed.push(after[i]);
  }
  assert.equal(changed.length, 1, 'only the captured crossing tile changes');
  const tile = changed[0];
  assert.deepEqual([tile.z, tile.x, tile.y], [0, TILE.x - (REGION >> 8) * 64, TILE.y - (REGION & 0xff) * 64]);
  const oldTile = before.find((entry) => entry.z === tile.z && entry.x === tile.x && entry.y === tile.y);
  assert.ok(oldTile.ops.some((op) => op.op === 50), 'base has blocked setting 1');
  assert.ok(!tile.ops.some((op) => op.op >= 50 && op.op <= 81), 'replacement removes only the setting opcode');
  assert.ok(tile.ops.some((op) => op.op <= 49 && op.payload === 156), 'water overlay 156 preserved');
});

test('loaded region opens the mandatory flooded route and leaves neighbours blocked', () => {
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');
  const { Location } = require('../dist/game/model/Location');
  const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
  RegionManager.loadMapFiles(TILE.x, TILE.y);
  const blocked = (x, y) => RegionManager.blocked({ getX: () => x, getY: () => y, getZ: () => 0 }, null);
  assert.equal(blocked(TILE.x, TILE.y), false, 'single captured crossing tile is walkable');
  assert.equal(blocked(2721, 4453), true, 'west water row remains blocked');
  assert.equal(blocked(2726, 4453), true, 'east water row remains blocked');

  const queue = { points: [], reset() { return queue; }, setRoute() { return queue; }, setPathX() { return queue; },
    setPathY() { return queue; }, addCheckpoint(tile) { queue.points.push([tile.getX(), tile.getY()]); return queue; },
    syncDestinationFlagToRoute() { return queue; } };
  const entity = { isPlayer: () => false, getAsPlayer: () => ({ getUsername: () => '' }),
    getLocation: () => new Location(2725, 4456, 0), getSize: () => 1, getPrivateArea: () => null, getMovementQueue: () => queue };
  for (const [x, y] of [[2748, 4434], [2744, 4436]]) {
    const steps = PathFinder.calculateRoute(entity, 0, x, y, 0, 0, 0, 0, false);
    assert.ok(steps > 0, `PathFinder lift landing -> ${x},${y}`);
  }

  const door = (MapObjects.mapObjects.get(MapObjects.getHash(2799, 4453, 0)) ?? []).find((object) => object.getId() === 4962);
  assert.ok(door, 'boss door 4962 still present and must be opened normally');
});
