// Run with: node --test server/tests/araxxor-combat.test.cjs
// Pure Araxxor combat math: no server boot needed.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const Shared = require("../plugins/bosses/araxxor/Shared.Araxxor");
const Area = require("../plugins/bosses/araxxor/Area.Araxxor");
const Minions = require("../plugins/bosses/araxxor/Minions.Araxxor");

test("lair bounds cover the arena but not the tunnel approach", () => {
  const at = (x, y, z = 0) => ({ getX: () => x, getY: () => y, getZ: () => z });
  assert.equal(Area.insideLair(at(3631, 9812)), true, "boss tile");
  assert.equal(Area.insideLair(at(3643, 9806)), true, "egg tile");
  assert.equal(Area.insideLair(at(3633, 9821)), true, "teleport tile");
  assert.equal(Area.insideLair(at(3615, 9797)), true, "corner");
  assert.equal(Area.insideLair(at(3614, 9812)), false, "west of the lair");
  assert.equal(Area.insideLair(at(3680, 9830)), false, "the webbed-tunnel approach");
  assert.equal(Area.insideLair(at(3633, 9821, 1)), false, "wrong plane");
  assert.equal(Area.insideLair(null), false);
});

test("edge distance measures to the 7x7 body, not its corner", () => {
  assert.equal(Shared.edgeDistance(3631, 9812, 3638, 9812), 1);
  assert.equal(Shared.edgeDistance(3631, 9812, 3637, 9818), 0, "under the body");
  assert.equal(Shared.edgeDistance(3631, 9812, 3631 - 4, 9812), 4);
  assert.equal(Shared.edgeDistance(3631, 9812, 3633, 9812 + 7), 1);
  assert.equal(Shared.underBoss(3631, 9812, 3633, 9815), true);
  assert.equal(Shared.underBoss(3631, 9812, 3638, 9815), false);
});

test("egg patterns are three full sets of three colours", () => {
  assert.equal(Shared.PATTERNS.length, 3);
  for (const pattern of Shared.PATTERNS) {
    assert.equal(pattern.length, Shared.EGG_TILES.length, "one egg per tile");
    for (const type of ["acidic", "mirrorback", "ruptura"]) {
      assert.equal(pattern.filter((entry) => entry === type).length, 3, `${type} x3`);
    }
    assert.ok(Shared.SPECIAL_FOR_PRIMARY[pattern[0]], "the first egg picks the special");
  }
  assert.equal(Shared.SPECIAL_FOR_PRIMARY.acidic, "ball");
  assert.equal(Shared.SPECIAL_FOR_PRIMARY.mirrorback, "splatter");
  assert.equal(Shared.SPECIAL_FOR_PRIMARY.ruptura, "drip");
});

test("the splatter scatters nine blobs around a tile within three", () => {
  for (let run = 0; run < 50; run++) {
    const tiles = Shared.splatterTiles(3633, 9816);
    assert.equal(tiles.length, 9);
    for (const [x, y] of tiles) {
      assert.ok(Math.abs(x - 3633) <= 3 && Math.abs(y - 9816) <= 3, "within the capture spread");
      assert.ok(x !== 3633 || y !== 9816, "never the caster's own tile untouched");
    }
  }
});

test("the spray fans outward along the boss-to-player direction", () => {
  for (let run = 0; run < 50; run++) {
    const tiles = Shared.splatterTiles(3633, 9816, null, { x: 10, y: 0 });
    assert.equal(tiles.length, 9);
    for (const [x, y] of tiles) {
      assert.ok(x - 3633 >= -1 && x - 3633 <= 3, "along the direction, mostly outward");
      assert.ok(Math.abs(y - 9816) <= 3, "lateral spread");
      assert.ok(x !== 3633 || y !== 9816, "never the caster's own tile untouched");
    }
  }
});

test("cleave pools run perpendicular to the blow", () => {
  assert.deepEqual(Shared.cleavePoolTiles(10, 10, 0, -1), [[10, 10], [9, 10], [11, 10]]);
  assert.deepEqual(Shared.cleavePoolTiles(10, 10, 1, 0), [[10, 10], [10, 9], [10, 11]]);
  assert.deepEqual(Shared.cleavePoolTiles(10, 10, 0, 0), [[10, 10], [9, 10], [11, 10]]);
});

test("pool damage ramps to the Wiki's cap", () => {
  assert.equal(Shared.poolDamage(1), 4);
  assert.equal(Shared.poolDamage(2), 6);
  assert.equal(Shared.poolDamage(5), 12);
  assert.equal(Shared.poolDamage(9), 20);
  assert.equal(Shared.poolDamage(30), 20, "capped");
});

test("captured attack schedule: special on every seventh attack", () => {
  const specials = [];
  for (let attack = 1; attack <= 21; attack++) {
    if (attack % Shared.SPECIAL_EVERY_ATTACKS === 0) specials.push(attack);
  }
  assert.deepEqual(specials, [7, 14, 21], "first special at attack 7, then every 7");
});

test("captured hatch schedule: +21 ticks, then every +42", () => {
  let next = 0 + Shared.FIRST_HATCH_TICKS;
  const hatches = [];
  for (let i = 0; i < 3; i++) {
    hatches.push(next);
    next += Shared.HATCH_INTERVAL_TICKS;
  }
  assert.deepEqual(hatches, [21, 63, 105], "interleaved with the 42-tick specials");
});

test("instant-kill weapons are the halberd, crossbows and ballistas", () => {
  const player = (name) => ({
    getEquipment: () => ({
      getWeapon: () => ({
        getId: () => 1,
        getDefinition: () => ({ getName: () => name }),
      }),
    }),
  });
  assert.equal(Minions.instantKillWeapon(player("Noxious halberd")), true);
  assert.equal(Minions.instantKillWeapon(player("Rune crossbow")), true);
  assert.equal(Minions.instantKillWeapon(player("Dragon ballista")), true);
  assert.equal(Minions.instantKillWeapon(player("Abyssal whip")), false);
  assert.equal(Minions.instantKillWeapon(null), false);
});

test("captured line-of-sight stepping is diagonal-first", () => {
  const open = () => true;
  assert.equal(Shared.hasClearPath(0, 0, 3, 3, open), true);
  assert.equal(Shared.hasClearPath(0, 0, 0, 0, open), true);
  const blocked = (x, y) => !(x === 1 && y === 1);
  assert.equal(Shared.hasClearPath(0, 0, 3, 3, blocked), false);
  assert.equal(Shared.hasClearPath(0, 0, 0, 3, blocked), true, "straight line misses the block");
});
