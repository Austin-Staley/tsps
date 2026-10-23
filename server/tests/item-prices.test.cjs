// Run after `yarn build`: node --test tests/item-prices.test.cjs
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { ItemDefinition } = require("../dist/game/definition/ItemDefinition");
const ItemDefinitionLoader = require("../plugins/items/ItemDefinitionLoader.plugin");
const PRICES = require("../data/definitions/item-prices.json").data;

const TEAM_6 = 4325;
const WHIP = 4151;

function quote(id) {
  const value = PRICES[String(id)];
  assert.ok(value, `item ${id} is in the price table`);
  const quoted = [value.high, value.low].filter((price) => Number.isSafeInteger(price) && price > 0);
  assert.ok(quoted.length, `item ${id} has a live quote`);
  return { ...value, buy: Math.max(...quoted), sell: Math.min(...quoted) };
}

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  ItemDefinitionLoader._test.loadItemPrices();
});

test("buy is the higher guide price and sell the lower", () => {
  const live = quote(TEAM_6);
  const definition = ItemDefinition.forId(TEAM_6);
  assert.equal(definition.getGrandExchangeValue(), live.buy);
  assert.equal(definition.getGrandExchangeSellValue(), live.sell);
  assert.ok(definition.getGrandExchangeValue() >= definition.getGrandExchangeSellValue());
});

test("24h volume and 4h buy limit come from the live data", () => {
  const live = quote(TEAM_6);
  const definition = ItemDefinition.forId(TEAM_6);
  assert.equal(definition.getGrandExchangeVolume(), live.highVolume + live.lowVolume);
  assert.equal(definition.getGrandExchangeBuyLimit(), live.limit ?? 0);
});

test("mapping alch values override the export", () => {
  const live = quote(WHIP);
  assert.ok(Number.isSafeInteger(live.highAlch) && live.highAlch > 0);
  const definition = ItemDefinition.forId(WHIP);
  assert.equal(definition.getHighAlchValue(), live.highAlch);
  assert.equal(definition.getLowAlchValue(), live.lowAlch);
});

test("mapping alch fills items the old export skipped", () => {
  const live = quote(2);
  assert.ok(Number.isSafeInteger(live.highAlch) && live.highAlch > 0);
  const definition = ItemDefinition.forId(2);
  assert.equal(definition.getHighAlchValue(), live.highAlch);
  assert.equal(definition.getLowAlchValue(), live.lowAlch);
});

test("the noted copy mirrors buy, sell, volume and limit", () => {
  const live = quote(WHIP);
  const definition = ItemDefinition.forId(WHIP);
  assert.equal(definition.isNoted(), false);
  const note = ItemDefinition.forId(definition.getNoteId());
  assert.ok(note.isNoted());
  assert.equal(note.getNoteId(), WHIP);
  assert.equal(note.getGrandExchangeValue(), live.buy);
  assert.equal(note.getGrandExchangeSellValue(), live.sell);
  assert.equal(note.getGrandExchangeVolume(), live.highVolume + live.lowVolume);
  assert.equal(note.getGrandExchangeBuyLimit(), live.limit ?? 0);
});
