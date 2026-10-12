const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const runtime = require('../plugins/quests/QuestRuntime');
const helper = require('../plugins/quests/QuestHelper.plugin')._test;
const noop = () => {};
const api = new Proxy({ core: PluginManager.getCoreApi() }, { get: (target, key) => target[key] ?? noop });
require('../plugins/quests/Quests.plugin').register(api);

function makePlayer() {
  const attributes = new Map();
  const items = new Map();
  const sent = [];
  const messages = [];
  const inventory = { getAmount: (id) => items.get(id) ?? 0, contains: (id) => items.has(id), isFull: () => false };
  const sender = new Proxy({ sendContentData: (source, datasets) => sent.push({ source, datasets }) }, { get: (target, key) => target[key] ?? noop });
  const player = {
    getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getEquipment: () => ({ ...inventory, getItems: () => [], get: () => null, getSlot: () => -1 }),
    getSkillManager: () => ({ getCurrentLevel: () => 99, getMaxLevel: () => 99, getSkills: () => [] }),
    getLocation: () => ({ getX: () => 3200, getY: () => 3200, getZ: () => 0 }),
    getPacketSender: () => sender, isPlayerBot: () => false,
    sendMessage: (message) => messages.push(message),
  };
  return { player, attributes, items, sent, messages };
}

test('catalog comes from exactly the quests registered for this world', () => {
  const { player, sent } = makePlayer();
  helper.sendCatalog({ player });
  const catalog = sent[0].datasets[0].rows[0];
  assert.deepEqual(catalog.quests.map((quest) => quest.key).sort(), runtime.getRegisteredQuests().map((quest) => quest.key).sort());
  assert.ok(catalog.quests.length > 100);
  assert.ok(catalog.quests.every((quest) => quest.status === 1));
});

test('tracking reads real stages and journals; inventory changes refresh without resending unchanged snapshots', () => {
  const { player, attributes, items, sent } = makePlayer();
  const cook = runtime.getRegisteredQuests().find((quest) => quest.key === 'cooks_assistant');
  helper.helperCommand({ player, parts: ['questhelper', cook.key] });
  assert.equal(sent.at(-1).datasets[0].rows[0].stage, 0);
  assert.ok(sent.at(-1).datasets[0].rows[0].journal.join(' ').includes('Cook'));
  helper.updateTracked({ player });
  assert.equal(sent.length, 1);
  attributes.set('quest.cooks_assistant.stage', 1);
  helper.updateTracked({ player });
  assert.equal(sent.at(-1).datasets[0].rows[0].status, 0);
  items.set(api.core.ItemIdentifiers.EGG, 1);
  helper.updateTracked({ player });
  assert.ok(sent.at(-1).datasets[0].rows[0].journal.some((line) => line.includes('<str>an egg')));
  attributes.set('windmill:hopper', true);
  helper.updateTracked({ player });
  assert.equal(sent.at(-1).datasets[0].rows[0].facts.hopper, true);
  attributes.set('quest.cooks_assistant.stage', 2);
  helper.updateTracked({ player });
  assert.equal(sent.at(-1).datasets[0].rows[0].status, 2);
  helper.helperCommand({ player, parts: ['questhelper', 'stop'] });
  const count = sent.length;
  helper.updateTracked({ player });
  assert.equal(sent.length, count);
});

test('helper never changes progress, awards rewards or accepts unknown quest keys', () => {
  const { player, attributes, sent, messages } = makePlayer();
  helper.helperCommand({ player, parts: ['questhelper', 'missing_key'] });
  assert.equal(sent.length, 0);
  assert.equal(messages.length, 1);
  helper.helperCommand({ player, parts: ['questhelper', 'sheep_shearer'] });
  assert.equal(attributes.size, 0);
  helper.clearTracked({ player });
  const count = sent.length;
  helper.updateTracked({ player });
  assert.equal(sent.length, count, 'logout stops tracking');
});

test('every registered quest supplies a valid live journal at start, in progress and completion', () => {
  const { player, attributes } = makePlayer();
  for (const quest of runtime.getRegisteredQuests()) {
    for (const stage of [0, quest.startedValue ?? 1, quest.completionValue ?? 2]) {
      attributes.set(`quest.${quest.key}.stage`, stage);
      const row = helper.snapshot(player, quest);
      assert.ok(Array.isArray(row.journal), `${quest.key}/${stage} journal must be an array`);
      assert.ok(row.journal.every((line) => typeof line === 'string'), `${quest.key}/${stage} journal lines must be strings`);
    }
  }
});
