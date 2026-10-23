// Run after `yarn build`: node --test tests/grand-exchange.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { ItemDefinition } = require('../dist/game/definition/ItemDefinition');
const {
  price,
  sellPrice,
  fillDelayMs,
  remainingLimit,
  recordLimit,
  setMarketData,
  LIMITS_ATTRIBUTE,
  LIMIT_WINDOW_MS,
  OFFERS_ATTRIBUTE,
} = require('../plugins/interface/GrandExchange.plugin')._test;

const definitions = new Map();
const market = {};

function define(id, values = {}) {
  const definition = {
    id,
    unNote: () => id,
    isNoted: () => false,
    getName: () => `Item ${id}`,
    getGrandExchangeValue: () => 1,
    getGrandExchangeSellValue: () => 1,
    ...values,
  };
  definitions.set(id, definition);
  return definition;
}

ItemDefinition.forId = (id) => definitions.get(id) ?? define(id);

const INVERTED = 1001;
define(INVERTED, { getGrandExchangeValue: () => 67, getGrandExchangeSellValue: () => 18 });
const NO_SELL_QUOTE = 1002;
define(NO_SELL_QUOTE, { getGrandExchangeValue: () => 42, getGrandExchangeSellValue: undefined });

test('buy offers pay the high price and sell offers receive the low price', () => {
  assert.equal(price(INVERTED), 67);
  assert.equal(sellPrice(INVERTED), 18);
  assert.ok(price(INVERTED) > sellPrice(INVERTED));
  assert.ok(price(INVERTED) - sellPrice(INVERTED) > 0);
  assert.equal(sellPrice(NO_SELL_QUOTE), 42);
});

const HIGH_VOLUME = 2001;
define(HIGH_VOLUME);
market[HIGH_VOLUME] = { volume: 20_000_000 };
const SLOW = 2002;
define(SLOW);
market[SLOW] = { volume: 900 };
const ILLIQUID = 2003;
const BROKEN_VOLUME = 2004;
define(BROKEN_VOLUME);
market[BROKEN_VOLUME] = { volume: NaN };
const NEGATIVE_VOLUME = 2005;
define(NEGATIVE_VOLUME);
market[NEGATIVE_VOLUME] = { volume: -10 };
const half = () => 0.5;

test('fill delay follows volume and quantity', () => {
  assert.equal(fillDelayMs({ itemId: HIGH_VOLUME, quantity: 1 }, half), 5_000);
  assert.equal(fillDelayMs({ itemId: SLOW, quantity: 150 }, half), 10 * 60_000);
  const single = fillDelayMs({ itemId: SLOW, quantity: 1 }, half);
  assert.ok(single > 0 && single < 10 * 60_000);

  let previous = 0;
  for (const quantity of [1, 10, 100, 1_000, 100_000]) {
    const delay = fillDelayMs({ itemId: SLOW, quantity }, half);
    assert.ok(delay >= previous, `quantity ${quantity}: ${delay} < ${previous}`);
    previous = delay;
  }
});

test('unknown, zero, broken and negative volume is illiquid', () => {
  for (const itemId of [ILLIQUID, BROKEN_VOLUME, NEGATIVE_VOLUME]) {
    for (const random of [() => 0, half, () => 1]) {
      const delay = fillDelayMs({ itemId, quantity: 100 }, random);
      assert.ok(delay >= 60_000 && delay <= 5 * 60_000, `${itemId}: ${delay}`);
    }
  }
});

const LIMITED = 3001;
define(LIMITED);
market[LIMITED] = { limit: 150 };
const UNLIMITED = 3002;
define(UNLIMITED);
market[UNLIMITED] = { limit: 0 };
const NO_LIMIT_GETTER = 3003;
define(NO_LIMIT_GETTER);

function player() {
  const attributes = new Map();
  return {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
  };
}

test('buy and sell limits reset after four hours', () => {
  const p = player();
  const start = 1_000_000;
  assert.equal(remainingLimit(p, LIMITED, start), 150);
  recordLimit(p, LIMITED, 100, start);
  assert.equal(remainingLimit(p, LIMITED, start), 50);
  recordLimit(p, LIMITED, 60, start + 1_000);
  assert.equal(remainingLimit(p, LIMITED, start + 1_000), 0);
  assert.equal(remainingLimit(p, LIMITED, start + LIMIT_WINDOW_MS - 1), 0);
  assert.equal(remainingLimit(p, LIMITED, start + LIMIT_WINDOW_MS), 150);
  recordLimit(p, LIMITED, 20, start + LIMIT_WINDOW_MS);
  assert.equal(remainingLimit(p, LIMITED, start + LIMIT_WINDOW_MS), 130);
});

test('an unlimited item never runs out', () => {
  const p = player();
  assert.equal(remainingLimit(p, UNLIMITED, 0), Infinity);
  assert.equal(remainingLimit(p, NO_LIMIT_GETTER, 0), Infinity);
  recordLimit(p, UNLIMITED, 1_000_000, 0);
  assert.equal(remainingLimit(p, UNLIMITED, 0), Infinity);
});

test('buying and selling share the same item limit', () => {
  const p = player();
  const now = 5_000_000;
  recordLimit(p, LIMITED, 100, now);
  assert.equal(remainingLimit(p, LIMITED, now), 50);
  recordLimit(p, LIMITED, 30, now + 1);
  assert.equal(remainingLimit(p, LIMITED, now + 2), 20);
});

test('register persists both attributes', () => {
  const persisted = new Map();
  const api = new Proxy({}, {
    get: (_, key) => key === 'persistAttribute'
      ? (attribute, value) => persisted.set(attribute, value)
      : () => {},
  });
  const plugin = require('../plugins/interface/GrandExchange.plugin');
  plugin.register(api);
  assert.deepEqual([...persisted.keys()], [OFFERS_ATTRIBUTE, LIMITS_ATTRIBUTE]);
  assert.deepEqual(persisted.get(OFFERS_ATTRIBUTE), {});
  assert.deepEqual(persisted.get(LIMITS_ATTRIBUTE), {});
});

setMarketData(market);
