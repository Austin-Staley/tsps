// Run after yarn build: node --test tests/qh-f2p-varrock-parity.test.cjs
const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const runtime = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
const { ItemIdentifiers: I, ObjectIdentifiers: O } = core;

before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
});

function setup(module) {
  const itemOnObject = [], custom = new Map(), tasks = [];
  const api = new Proxy({
    core: { ...core, TaskManager: { submit: (task) => tasks.push(task), cancelTasks() {} } },
    persistAttribute() {},
    getItemOnGroundManager: () => ({ registerLocation() {}, getGroundItem: () => null }),
    onCustomEvent(name, fn) { const list = custom.get(name) ?? []; list.push(fn); custom.set(name, list); },
    emitCustomEvent(name, event) { for (const fn of custom.get(name) ?? []) fn(event); },
    onItemOnObject(fn) { itemOnObject.push(fn); },
    spawnNpc: () => null,
    removeNpc() {},
  }, { get: (target, key) => target[key] ?? (() => {}) });
  require('../plugins/quests/quests/' + module + '.Quest')(api);
  const quest = runtime.getRegisteredQuests().findLast((entry) => entry.key === questKey(module));

  const attributes = new Map(), items = new Map(), varbits = new Map(), messages = [];
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    adds(id, amount) { items.set(id, (items.get(id) ?? 0) + amount); },
    deleteNumber(id, amount) { assert.ok((items.get(id) ?? 0) >= amount, 'cannot consume missing ' + id); items.set(id, items.get(id) - amount); },
    isFull: () => false,
  };
  const sender = new Proxy({ sendVarbit: (id, value) => { varbits.set(id, value); return sender; } },
    { get: (target, key) => target[key] ?? (() => sender) });
  const player = {
    attributes, items, varbits, messages,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getBanks: () => [],
    getEquipment: () => ({ get: () => null, getItems: () => [] }),
    getLocation: () => new core.Location(3200, 3400, 0),
    getPacketSender: () => sender,
    getDialogueManager: () => ({ startDialogues() {}, reset() {}, getCurrent: () => null, isActive: () => false }),
    getSkillManager: () => ({ getCurrentLevel: () => 99, getCombatLevel: () => 99, addExperiences() {} }),
    sendMessage: (message) => messages.push(message),
    isPlayer: () => true, isNpc: () => false, isRegistered: () => true,
    getUsername: () => 'QH parity',
  };
  return { api, quest, player, items, attributes, varbits, messages, itemOnObject };
}

function questKey(module) {
  return { DemonSlayer: 'demon_slayer', GoblinDiplomacy: 'goblin_diplomacy', KnightsSword: 'the_knights_sword' }[module];
}

/** Mirrors the core item-on-object event; the core validates the slot item before dispatch. */
function itemOnObjectEvent(h, water, objectId) {
  return { player: h.player, object: {}, objectId, item: { getId: () => water }, itemId: water,
    itemSlot: 0, interfaceType: 0, location: { x: 3225, y: 3496, z: 0 }, handled: false };
}

test('Demon Slayer flushes the real drains with the single-volume water containers the Wiki allows', () => {
  const containers = [
    [I.BUCKET_OF_WATER, I.BUCKET],
    [I.JUG_OF_WATER, I.JUG],
    [I.BOWL_OF_WATER, I.BOWL],
    [I.VIAL_OF_WATER, I.VIAL],
  ];
  const drains = [O.DRAIN_6, O.DRAIN_7, 2843];
  for (let index = 0; index < containers.length; index++) {
    const [water, empty] = containers[index];
    const h = setup('DemonSlayer');
    h.quest.setStage(h.player, 2);
    h.items.set(water, 1);
    const event = itemOnObjectEvent(h, water, drains[index % drains.length]);
    h.itemOnObject[0](event);
    assert.equal(event.handled, true, 'handled for ' + water);
    assert.equal(h.items.get(water) ?? 0, 0, 'water ' + water + ' consumed');
    assert.equal(h.items.get(empty), 1, 'empty container returned for ' + water);
    assert.equal(h.attributes.get('demon_slayer.drain'), 2, 'drain flushed for ' + water);
    assert.equal(h.varbits.get(2568), 1, 'drain varbit for ' + water);
    assert.equal(h.quest.getStage(h.player), 2);
  }
});

test('Demon Slayer ignores foreign objects, foreign items, noted water and missing inventory', () => {
  const cases = [
    ['foreign object', I.BUCKET_OF_WATER, O.SINK],
    ['foreign item', I.BONES, O.DRAIN_6],
    ['noted water', I.BUCKET_OF_WATER_2, O.DRAIN_6],
    ['missing inventory', I.BUCKET_OF_WATER, O.DRAIN_6],
  ];
  for (const [name, itemId, objectId] of cases) {
    const h = setup('DemonSlayer');
    h.quest.setStage(h.player, 2);
    if (name !== 'missing inventory') h.items.set(itemId, 1);
    const event = itemOnObjectEvent(h, itemId, objectId);
    h.itemOnObject[0](event);
    assert.ok(!event.handled, name + ' is not handled');
    assert.equal(h.items.get(itemId) ?? 0, name === 'missing inventory' ? 0 : 1, name + ' is not consumed');
    assert.equal(h.attributes.get('demon_slayer.drain'), undefined, name + ' does not flush');
    assert.equal(h.varbits.get(2568), undefined, name + ' sends no varbit');
  }
});

test('Demon Slayer refuses water after Silverlight without consuming the container', () => {
  const h = setup('DemonSlayer');
  h.quest.setStage(h.player, 29);
  h.items.set(I.BUCKET_OF_WATER, 1);
  const event = itemOnObjectEvent(h, I.BUCKET_OF_WATER, O.DRAIN_6);
  h.itemOnObject[0](event);
  assert.equal(event.handled, true);
  assert.equal(h.items.get(I.BUCKET_OF_WATER), 1);
  assert.equal(h.items.get(I.BUCKET) ?? 0, 0);
  assert.match(h.messages.at(-1), /no reason/);
});
