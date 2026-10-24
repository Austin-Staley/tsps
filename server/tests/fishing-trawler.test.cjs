// From server/: node --test tests/fishing-trawler.test.cjs (after yarn build).
//
// Fishing Trawler against the OSRS Wiki (Fishing_Trawler, /Strategies): the contribution points,
// leaks and water, the net and the Kraken, sinking and returning, each player's share of the
// catch (trawler_overlay's x1 at 100 to x1.5 at 255), the reward rules and the lobby.
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const core = PluginManager.getCoreApi();

let Shared, Voyage, Rewards, Lobby, Sea;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  Shared = require('../plugins/minigames/fishingtrawler/Shared.FishingTrawler');
  Shared.bind({ core });
  ({ Voyage } = require('../plugins/minigames/fishingtrawler/Voyage.FishingTrawler'));
  Rewards = require('../plugins/minigames/fishingtrawler/Rewards.FishingTrawler');
  Lobby = require('../plugins/minigames/fishingtrawler/Lobby.FishingTrawler');
  Sea = require('../plugins/minigames/fishingtrawler/Sea.FishingTrawler');
});

function fakePlayer({ fishing = 99 } = {}) {
  const attributes = new Map();
  const player = {
    messages: [],
    sendMessage: (text) => player.messages.push(text),
    isRegistered: () => true,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getMaxLevel: () => fishing, getCurrentLevel: () => fishing }),
    getInventory: () => ({ contains: () => false }),
    getEquipment: () => ({ contains: () => false }),
    getBank: () => ({ contains: () => false, getAmount: () => 0, getFreeSlots: () => 800 }),
    getCurrentBankTab: () => 0,
  };
  return player;
}

/** A random source that plays back `values`, then `fallback`. */
function sequence(values, fallback = 0.99) {
  let i = 0;
  return () => (i < values.length ? values[i++] : fallback);
}

test('every id resolves from the cache', () => {
  const ids = Shared.ids();
  assert.equal(ids.interfaces.overlay, 366);
  assert.equal(ids.varbits.hull.length, 16);
  assert.deepEqual([ids.items.bucket, ids.items.bucketFull, ids.items.swampPaste], [583, 585, 1941]);
  assert.equal(ids.fish.length, 10);
  assert.equal(ids.junk.length, 8);
});

test('the Wiki contribution points, capped at 255', () => {
  const player = fakePlayer();
  const voyage = new Voyage([player], () => 0.99);
  voyage.leaks[3] = 2;
  assert.equal(voyage.patch(player, 3), true);
  assert.equal(voyage.contribution.get(player), 5);
  assert.equal(voyage.patch(player, 3), false, 'a patched leak is not patched again');
  voyage.water = 10;
  voyage.bail(player);
  assert.equal(voyage.contribution.get(player), 7);
  voyage.netRipped = true;
  voyage.mendNet(player);
  assert.equal(voyage.contribution.get(player), 14);
  voyage.rails.port = 2;
  voyage.fixRail(player, 'port');
  assert.equal(voyage.contribution.get(player), 24);
  for (let i = 0; i < 50; i++) voyage.addPoints(player, 10);
  assert.equal(voyage.contribution.get(player), 255);
});

test('open leaks let water in, bailing takes it out, a full hull sinks the trawler', () => {
  const player = fakePlayer();
  const voyage = new Voyage([player], () => 0.99);
  voyage.leaks.fill(2, 0, 4);
  voyage.tick();
  assert.ok(Math.abs(voyage.water - 4 * Shared.DATA.timing.waterPerLeakTick) < 1e-9);
  voyage.water = 5;
  voyage.bail(player);
  assert.equal(voyage.water, 2);
  voyage.water = 99.99;
  voyage.tick();
  assert.equal(voyage.ended, true);
  assert.equal(voyage.result, 'sunk');
});

test('leaks spring every 5 ticks when the roll allows, on a hull spot not already leaking', () => {
  const player = fakePlayer();
  const voyage = new Voyage([player], () => 0);
  for (let i = 0; i < 4; i++) voyage.tick();
  assert.equal(voyage.openLeaks(), 0);
  voyage.tick();
  assert.equal(voyage.openLeaks(), 1);
  assert.ok(player.messages.includes(Shared.message('leak')));
});

test('a torn net catches nothing; an attacking tentacle halves the catch', () => {
  const player = fakePlayer();
  const voyage = new Voyage([player], () => 0.99);
  voyage.tickCatch();
  const whole = voyage.catch;
  assert.ok(whole > 0);
  voyage.netRipped = true;
  voyage.tickCatch();
  assert.equal(voyage.catch, whole);
  voyage.netRipped = false;
  voyage.tentacles.port.state = Shared.DATA.values.tentacle.attacking;
  voyage.tickCatch();
  assert.ok(Math.abs(voyage.catch - whole * 1.5) < 1e-9);
});

test('a tentacle left alone rips the net and breaks its rail; three chops drive it off', () => {
  const player = fakePlayer();
  const { timing, values } = Shared.DATA;
  const voyage = new Voyage([player], () => 0.99);
  voyage.tickCount = timing.tentacleEvery - 1;
  voyage.tickTentacles();
  voyage.tickCount += 1;
  voyage.tickTentacles();
  assert.equal(voyage.tentacles.port.state, values.tentacle.rising);
  voyage.tickCount += timing.tentacleRiseTicks;
  voyage.tickTentacles();
  assert.equal(voyage.tentacles.port.state, values.tentacle.attacking);
  voyage.tickCount += timing.tentacleWreckTicks;
  voyage.tickTentacles();
  assert.equal(voyage.rails.port, values.rail.broken);
  assert.equal(voyage.netRipped, true);
  assert.equal(voyage.tentacles.port.state, values.tentacle.leaving);

  voyage.tentacles.starboard = { state: values.tentacle.attacking, since: voyage.tickCount, chops: 0 };
  assert.equal(voyage.chop(player, 'starboard'), 'hit');
  assert.equal(voyage.chop(player, 'starboard'), 'hit');
  assert.equal(voyage.chop(player, 'starboard'), 'drove');
  assert.equal(voyage.tentacles.starboard.state, values.tentacle.leaving);
  assert.equal(voyage.chop(player, 'starboard'), null);
});

test('the trip comes back after five minutes, and the share follows the HUD meter', () => {
  const player = fakePlayer();
  const voyage = new Voyage([player], () => 0.99);
  for (let i = 0; i < Shared.DATA.timing.trawlTicks; i++) {
    voyage.leaks.fill(0);
    voyage.tick();
  }
  assert.equal(voyage.result, 'returned');
  voyage.catch = 20;
  voyage.contribution.set(player, 80);
  assert.equal(voyage.shareFor(player), 20);
  voyage.contribution.set(player, 255);
  assert.equal(voyage.shareFor(player), 30);
  voyage.contribution.set(player, 178);
  assert.equal(voyage.shareFor(player), 25);
});

test('a bigger crew catches less each, down to the floor', () => {
  const solo = new Voyage([fakePlayer()], () => 0.99);
  const crew = new Voyage(Array.from({ length: 10 }, () => fakePlayer()), () => 0.99);
  const big = new Voyage(Array.from({ length: 30 }, () => fakePlayer()), () => 0.99);
  solo.tickCatch();
  crew.tickCatch();
  big.tickCatch();
  assert.ok(crew.catch < solo.catch);
  assert.ok(Math.abs(big.catch - solo.catch * Shared.DATA.catch.crewFloor) < 1e-9);
});

test('the catch only holds fish the player can catch, up to two junk, and missing angler pieces', () => {
  const ids = Shared.ids();
  const reward = Rewards.rollCatch(40, 40, sequence([], 0.5));
  const levels = new Map(ids.fish.map((fish) => [fish.id, fish.level]));
  const fishCount = reward.items.filter(([id]) => levels.has(id)).reduce((sum, [, n]) => sum + n, 0);
  assert.equal(fishCount, 40);
  for (const [id] of reward.items) if (levels.has(id)) assert.ok(levels.get(id) <= 40);
  const junk = reward.items.filter(([id]) => ids.junk.includes(id)).reduce((sum, [, n]) => sum + n, 0);
  assert.ok(junk <= 2);
  // A roll of 0 gives every angler piece but the owned hat.
  const lucky = Rewards.rollCatch(1, 99, () => 0, (id) => id === ids.items.anglerHat);
  assert.deepEqual(lucky.angler, [ids.items.anglerTop, ids.items.anglerLegs, ids.items.anglerBoots]);
});

test('a share needs 50 contribution and 15 Fishing', () => {
  const low = fakePlayer({ fishing: 10 });
  const idle = fakePlayer();
  const busy = fakePlayer();
  const voyage = new Voyage([low, idle, busy], () => 0.99);
  voyage.catch = 10;
  voyage.contribution.set(low, 200);
  voyage.contribution.set(idle, 49);
  voyage.contribution.set(busy, 50);
  assert.equal(Rewards.award(low, voyage, () => 0.5), null);
  assert.equal(low.messages.at(-1), Shared.message('lowLevel'));
  assert.equal(Rewards.award(idle, voyage, () => 0.5), null);
  assert.equal(idle.messages.at(-1), Shared.message('tooLittle'));
  assert.ok(Rewards.award(busy, voyage, () => 0.5));
  assert.ok(busy.getAttribute(Shared.REWARD_ATTRIBUTE).items.length > 0);
});

test('sailing again throws back a catch left in the net', () => {
  const player = fakePlayer();
  player.setAttribute(Shared.REWARD_ATTRIBUTE, { items: [[317, 3]], xp: 2 });
  const launch = Sea.launch;
  let launched = null;
  require('../plugins/minigames/fishingtrawler/Sea.FishingTrawler').launch = (players) => { launched = players; };
  try {
    // Lobby.depart calls Sea.launch through the module it imported.
    Lobby.depart([player]);
  } finally {
    require('../plugins/minigames/fishingtrawler/Sea.FishingTrawler').launch = launch;
  }
  assert.equal(player.getAttribute(Shared.REWARD_ATTRIBUTE), null);
  assert.equal(player.messages.at(-1), Shared.message('destroyedReward'));
  assert.deepEqual(launched, [player]);
});

test("the crates only answer for the trawler's own: other Hammers crates fall through", () => {
  const Actions = require('../plugins/minigames/fishingtrawler/Actions.FishingTrawler');
  const ids = Shared.ids();
  const added = [];
  const player = { getInventory: () => ({ getFreeSlots: () => 28, addItem: (item) => added.push(item.getId()) }) };
  const take = Actions._crates;
  assert.equal(take.takeHammer({ player, objectId: 45497 }), false);
  assert.deepEqual(added, []);
  assert.equal(take.takeHammer({ player, objectId: ids.locs.crateHammers }), true);
  assert.deepEqual(added, [ids.items.hammer]);
});

test('a full bank keeps the rest of the catch in the net', () => {
  const player = fakePlayer();
  const banked = [];
  player.getBank = () => ({ contains: () => false, getAmount: () => 0, getFreeSlots: () => 1, add: (item) => banked.push(item.getId()) });
  player.getSkillManager = () => ({ getMaxLevel: () => 99, getCurrentLevel: () => 99, addExperiences: () => {} });
  player.setAttribute(Shared.REWARD_ATTRIBUTE, { items: [[317, 3], [321, 2]], xp: 10 });
  Rewards.inspectNet({ player });
  assert.deepEqual(banked, [317]);
  assert.deepEqual(player.getAttribute(Shared.REWARD_ATTRIBUTE).items, [[321, 2]]);
  assert.equal(player.messages.at(-1), Shared.message('bankFull'));
});
