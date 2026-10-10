// Run with: node --test server/tests/vorkath-combat.test.cjs
// Pure Vorkath combat math: no server boot needed.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const Shared = require("../plugins/bosses/vorkath/Shared.Vorkath");
const Area = require("../plugins/bosses/vorkath/Area.Vorkath");

test("crater bounds cover the arena but not the wall line", () => {
  const at = (x, y, z = 0) => ({ getX: () => x, getY: () => y, getZ: () => z });
  assert.equal(Area.insideCrater(at(2272, 4054)), true);
  assert.equal(Area.insideCrater(at(2269, 4062)), true);
  assert.equal(Area.insideCrater(at(2282, 4075)), true);
  assert.equal(Area.insideCrater(at(2272, 4053)), false);
  assert.equal(Area.insideCrater(at(2272, 4052)), false);
  assert.equal(Area.insideCrater(at(2272, 4054, 1)), false);
  assert.equal(Area.insideCrater(null), false);
});

test("standard attacks follow the triangulated weights", () => {
  // Adjacent table: melee 1, ranged 4, magic 3, dragonfire 1, venom 1, prayer 1, fireball 1.
  const adjacent = (roll) => Shared.chooseStandard({ adjacent: true, roll: () => roll });
  assert.equal(adjacent(0), "melee");
  assert.equal(adjacent(1), "ranged");
  assert.equal(adjacent(4), "ranged");
  assert.equal(adjacent(5), "magic");
  assert.equal(adjacent(7), "magic");
  assert.equal(adjacent(8), "dragonfire");
  assert.equal(adjacent(9), "venom");
  assert.equal(adjacent(10), "prayer");
  assert.equal(adjacent(11), "fireball");
  // Away: no melee; ranged 4, magic 3, then the unit faces.
  const away = (roll) => Shared.chooseStandard({ adjacent: false, roll: () => roll });
  assert.equal(away(0), "ranged");
  assert.equal(away(3), "ranged");
  assert.equal(away(4), "magic");
  assert.equal(away(6), "magic");
  assert.equal(away(7), "dragonfire");
  assert.equal(away(8), "venom");
  assert.equal(away(9), "prayer");
  assert.equal(away(10), "fireball");
});

test("dragonfire caps follow the shield/prayer/potion pipeline", () => {
  const caps = (shield, prayer, potion, variant) =>
    Shared.dragonfireCaps({ shield, prayer, potion, variant });
  assert.deepEqual(caps(false, false, "none", "normal"), { cap: 80, resistedCap: 50, reduction: 0, variantPenalty: 0 });
  assert.deepEqual(caps(false, true, "none", "normal").cap, 30);
  assert.deepEqual(caps(true, false, "none", "normal"), { cap: 20, resistedCap: 20, reduction: 0, variantPenalty: 0 });
  assert.deepEqual(caps(false, false, "super", "normal").reduction, 20);
  assert.deepEqual(caps(false, false, "antifire", "normal").reduction, 10);
  assert.deepEqual(caps(true, true, "super", "venom").variantPenalty, 5);
  // Shield + super antifire fully absorbs every variant.
  for (const variant of ["normal", "venom", "prayer"]) {
    const c = caps(true, true, "super", variant);
    assert.ok(c.cap - c.reduction - c.variantPenalty <= 0, variant);
  }
});

test("fireball damage falls off with distance", () => {
  assert.equal(Shared.fireballDamage(121, 0), 121);
  assert.equal(Shared.fireballDamage(121, 1), 60);
  assert.equal(Shared.fireballDamage(121, 2), 0);
  assert.equal(Shared.fireballDamage(0, 0), 0);
});

test("spawn explosion scales with remaining hitpoints", () => {
  assert.equal(Shared.spawnExplosionDamage(38), 60);
  assert.equal(Shared.spawnExplosionDamage(19), 30);
  assert.equal(Shared.spawnExplosionDamage(1), 1);
  assert.equal(Shared.spawnExplosionDamage(0), 0);
  assert.equal(Shared.spawnExplosionDamage(999), 60);
  assert.equal(Shared.spawnExplosionDamage(-5), 0);
});

test("acid pools cover the grid, the player tile, and never the boss", () => {
  const walkable = () => true;
  const pools = Shared.acidPoolTiles(2269, 4062, 2272, 4058, walkable, () => 0);
  // 48 cells plus edge tiles plus the player's tile; edge tiles may coincide with a
  // cell pick and dedupe, so the total varies (the oracle asserts 56..57 the same way).
  assert.ok(pools.length >= 48 + 1 && pools.length <= 48 + 8 + 1, `count ${pools.length}`);
  const keys = new Set(pools.map(([x, y]) => `${x},${y}`));
  assert.equal(keys.size, pools.length);
  assert.ok(keys.has("2272,4058"));
  for (const [x, y] of pools) {
    assert.ok(!Shared.underBoss(2269, 4062, x, y), `pool under boss at ${x},${y}`);
  }
});

test("spawn landing needs a clear straight path around her body", () => {
  const walkable = () => true;
  // South of her, same corridor as the observed live landing: clear.
  assert.equal(Shared.hasClearPath(2262, 4062, 2272, 4061, 2269, 4062, walkable), true);
  // Through her body: blocked.
  assert.equal(Shared.hasClearPath(2272, 4071, 2272, 4061, 2269, 4062, walkable), false);
  // Blocked tile on the way: rejected.
  assert.equal(Shared.hasClearPath(2262, 4062, 2272, 4061, 2269, 4062, (x) => x < 2268), false);
});

test("acid pools skip unwalkable tiles", () => {
  const walkable = (x, y) => (x + y) % 2 === 0;
  const pools = Shared.acidPoolTiles(2269, 4062, 2272, 4058, walkable, () => 0);
  for (const [x, y] of pools) {
    assert.ok((x + y) % 2 === 0, `pool on blocked tile ${x},${y}`);
    assert.ok(!Shared.underBoss(2269, 4062, x, y));
  }
});
