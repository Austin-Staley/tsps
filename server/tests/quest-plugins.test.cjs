// Run after `yarn build`: node --test tests/quest-plugins.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { PluginManager } = require('../dist/plugins/PluginManager');
const apiMethods = new Set(Object.keys(PluginManager.createApi('QuestTest')));

// A stand-in for the live PluginApi: real core, every hook a no-op. Quests must
// register cleanly through it and hand back their variant/condition resolvers.
function mockApi() {
  const objects = [];
  const routes = [];
  const handlers = {
    variant: [],
    condition: [],
    custom: new Map(),
    npcInteractions: new Map(),
    objects,
    object: objects,
    itemOnItem: [],
    itemOnNpc: [],
    itemOnObject: [],
    itemAction: [],
    routes,
    route: routes,
    walkRoutes: [],
    playerProcess: [],
    npcHitModify: [],
  };
  const noop = () => {};
  const base = {
    core: PluginManager.getCoreApi(),
    onNpcDialogueVariant: (h) => handlers.variant.push(h),
    onNpcDialogueCondition: (h) => handlers.condition.push(h),
    onObjectInteraction: (target, actions) => {
      if (typeof target === 'function') return handlers.objects.push(target);
      for (const [option, handler] of Object.entries(actions)) handlers.objects.push(event => {
        if (event.definition?.getName?.() === target && event.option === option) return handler(event);
        return false;
      });
    },
    onNpcInteraction: (target, actions) => handlers.npcInteractions.set(target, actions),
    onObjectRoute: (h) => handlers.routes.push(h),
    onWalkRoute: (h) => handlers.walkRoutes.push(h),
    onPlayerProcess: (h) => handlers.playerProcess.push(h),
    onNpcHitModify: (h) => handlers.npcHitModify.push(h),
    onItemOnItem: (h) => handlers.itemOnItem.push(h),
    onItemOnNpc: (h) => handlers.itemOnNpc.push(h),
    onItemOnObject: (h) => handlers.itemOnObject.push(h),
    onItemAction: (...args) => handlers.itemAction.push(args.at(-1)),
    onCustomEvent: (name, h) => {
      const list = handlers.custom.get(name) ?? [];
      list.push(h);
      handlers.custom.set(name, list);
    },
    emitCustomEvent: (name, event) => {
      for (const handler of handlers.custom.get(name) ?? []) handler(event);
    },
    persistAttribute: noop,
  };
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (apiMethods.has(prop)) return noop;
      throw Error('Unknown PluginApi member: ' + String(prop));
    },
  });
  return { api, handlers };
}

test('Quests.plugin registers every quest through api.core without throwing', () => {
  const { api } = mockApi();
  const plugin = require('../plugins/quests/Quests.plugin');
  assert.equal(plugin.name, 'Quests');
  assert.doesNotThrow(() => plugin.register(api));
});

test('walk route hooks can claim a map-click path before collision pathfinding', () => {
  const calls = [];
  PluginManager.createApi('WalkRouteTest').onWalkRoute((event) => {
    calls.push([event.player, event.destination]);
    event.handled = true;
  });
  const player = {};
  const destination = { x: 10, y: 20, z: 0 };
  const event = { player, destination, handled: false };
  assert.equal(PluginManager.emitWalkRoute(event), true);
  assert.equal(event.handled, true);
  assert.deepEqual(calls, [[player, destination]]);
});

test('quest keys, names and varps are unique', () => {
  const { api } = mockApi();
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const before = getRegisteredQuests().length;
  require('../plugins/quests/Quests.plugin').register(api);
  const quests = getRegisteredQuests().slice(before);
  const seen = { key: new Map(), name: new Map(), varpId: new Map() };
  for (const quest of quests) {
    for (const field of ['key', 'name', 'varpId']) {
      const value = quest[field];
      if (seen[field].has(value)) {
        assert.fail(`duplicate quest ${field} "${value}" (${seen[field].get(value)}, ${quest.name})`);
      }
      seen[field].set(value, quest.name);
    }
  }
  assert.ok(quests.length > 0, 'no quests registered');
});

test('Quests.plugin lists every quest file on disk', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { QUESTS } = require('../plugins/quests/Quests.plugin');
  const dir = path.join(__dirname, '../plugins/quests/quests');
  const onDisk = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.Quest.js'))
    .map((f) => f.replace(/\.Quest\.js$/, ''))
    .sort();
  assert.deepEqual([...QUESTS].sort(), onDisk, 'Quests.plugin must register every quests/*.Quest.js');
});

test('each quest varp is sent again on login, so quest-gated locs show after a relog', () => {
  // The Grand Exchange spirit tree only has Travel once varp 111 (Tree Gnome Village) is 9.
  const { api } = mockApi();
  const { getRegisteredQuests, sendQuestVarps } = require('../plugins/quests/QuestRuntime');
  if (!getRegisteredQuests().some((quest) => quest.name === 'Tree Gnome Village')) require('../plugins/quests/Quests.plugin').register(api);
  const village = getRegisteredQuests().find((quest) => quest.name === 'Tree Gnome Village');
  const attributes = new Map();
  const varps = new Map();
  const varbits = new Map();
  const sender = new Proxy({}, {
    get: (t, key) => {
      if (key === 'sendConfig') return (id, value) => (varps.set(id, value), sender);
      if (key === 'sendVarbit') return (id, value) => (varbits.set(id, value), sender);
      return () => sender;
    },
  });
  const player = { getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), getPacketSender: () => sender };
  village.setStage(player, village.completionValue);
  varps.clear();
  varbits.clear();
  sendQuestVarps({ player });
  if (village.varbitId !== undefined) {
    assert.equal(varbits.get(village.varbitId), village.completionValue);
  } else {
    assert.equal(varps.get(village.varpId), village.completionValue);
  }
  // Unstarted quests are sent as 0 too: the login bootstrap clobbers shared varps (QuestRuntime).
  // Quests with a bitfield stage write their varbit instead, so sibling bits survive.
  // Earlier tests register the list more than once, so skip every Tree Gnome
  // Village registration (same stage attribute) rather than just this instance.
  const others = getRegisteredQuests().filter((quest) => quest.key !== village.key);
  const sent = (quest) => (quest.varbitId !== undefined ? varbits.get(quest.varbitId) : varps.get(quest.varpId));
  const offenders = others.filter((quest) => sent(quest) !== 0).map((quest) => `${quest.name}:${quest.varpId}/${quest.varbitId}=${sent(quest)}`);
  assert.ok(offenders.length === 0, `unstarted quests are reset to 0 (${offenders.slice(0, 5).join(', ')})`);
});

test("Tree Gnome Village sends King Bolren's orbs (varbit 598): the village's spirit tree has Travel at 2", () => {
  const custom = new Map();
  const logins = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onPlayerLogin') return (h) => logins.push(h);
      if (prop === 'onCustomEvent') return (name, h) => custom.set(name, [...(custom.get(name) ?? []), h]);
      if (prop === 'emitCustomEvent') return (name, payload) => (custom.get(name) ?? []).forEach((h) => h(payload));
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/TreeGnomeVillage.Quest')];
  require('../plugins/quests/quests/TreeGnomeVillage.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const village = getRegisteredQuests().filter((quest) => quest.name === 'Tree Gnome Village').at(-1);
  const attributes = new Map();
  const varbits = new Map();
  const sender = new Proxy({}, { get: (t, key) => (key === 'sendVarbit' ? (id, value) => (varbits.set(id, value), sender) : () => sender) });
  const player = { getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), getPacketSender: () => sender };
  village.setStage(player, village.completionValue);
  assert.equal(varbits.get(598), 2, "on completing it");
  varbits.clear();
  for (const login of logins) {
    try { login({ player }); } catch (error) { /* other login hooks want a real player */ }
  }
  assert.equal(varbits.get(598), 2, "and on every login");
});

test('Current Affairs and Prying Times start gates require every registered prerequisite', () => {
  const conditions = [];
  const completeQuests = new Set();
  let hasPortTaskSlot = false;
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcDialogueCondition') return (handler) => conditions.push(handler);
      if (prop === 'emitCustomEvent') return (name, request) => {
        if (name === 'quest:is-complete') request.complete = completeQuests.has(request.key);
        if (name === 'sailing:has-port-task-slot') request.available = hasPortTaskSlot;
      };
      return target[prop];
    },
  });
  require('../plugins/quests/quests/CurrentAffairs.Quest')(api);
  require('../plugins/quests/quests/PryingTimes.Quest')(api);
  const [currentAffairs, pryingTimes] = conditions;
  const player = { getSkillManager: () => ({ getMaxLevel: () => 99, getCurrentLevel: () => 99 }) };
  assert.equal(currentAffairs({ npcId: api.core.NpcIdentifiers.ARHEIN, player, stepId: 'mNhEI-' }), true,
    'missing Pandemonium blocks Current Affairs');
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'aifq0J' }), true,
    'missing quests and an unavailable task slot block Prying Times');
  completeQuests.add('pandemonium');
  assert.equal(currentAffairs({ npcId: api.core.NpcIdentifiers.ARHEIN, player, stepId: 'mNhEI-' }), false);
  completeQuests.add('the_knights_sword');
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'aifq0J' }), false,
    'high skills and both required quests satisfy the quest prerequisites');
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'PSw89b' }), true,
    'a full task ledger blocks starting Prying Times');
  hasPortTaskSlot = true;
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'PSw89b' }), false,
    'an available task slot clears the full-ledger condition');
});

test('The Blood Moon Rises starts only after Sarius accepts the yes choice and requirements pass', () => {
  const { api, handlers } = mockApi();
  const npcHooks = [];
  const prompts = [];
  let reclaimed = 0;
  let nightComplete = true;
  api.emitCustomEvent = (name, event) => {
    if (name === 'quest:is-complete') event.complete = event.key === 'a_night_at_the_theatre' ? nightComplete : true;
    if (name === 'night-at-the-theatre:claim-lamps') { reclaimed++; event.handled = true; }
  };
  api.onAnyNpcInteraction = (hook) => npcHooks.push(hook);
  api.sendMultiChatboxPrompt = (_player, title, ...options) => prompts.push({ title, options });
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  let skillLevel = 70;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getMaxLevel: () => skillLevel }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  const choose = handlers.custom.get('npc-dialogue:choice').at(-1);
  const event = { player, option: 'Yes.', definition: { getName: () => 'Sarius Guile' } };
  choose(event);
  assert.equal(quest.getStage(player), 0, 'the skill gate blocks the start');
  skillLevel = 99;
  choose(event);
  assert.equal(quest.getStage(player), 10, 'accepting Sarius’s invitation starts the quest');
  choose({ ...event, definition: { getName: () => 'Ivan Strom' } });
  assert.equal(quest.getStage(player), 10, 'another NPC’s yes choice cannot start this quest');
  nightComplete = false;
  const stranger = npcHooks.at(-1)['Talk-to'];
  const interaction = { player, definition: { getName: () => 'Mysterious Stranger' }, handled: false };
  assert.equal(stranger(interaction), false, 'Night at the Theatre retains the Stranger until it is complete');
  nightComplete = true;
  quest.setStage(player, 10);
  assert.equal(stranger(interaction), true, 'Blood Moon preserves the lamp service without swallowing Night dialogue');
  assert.equal(interaction.handled, true);
  assert.match(prompts.at(-1).options[0], /Claim unused Hallowed lamps/);
  assert.equal(reclaimed, 0, 'opening the menu does not reclaim lamps before the player chooses');
  prompts.at(-1).options[1]();
  assert.equal(reclaimed, 1, 'the explicit option delegates to Night at the Theatre’s inventory-safe reclaim event');
});

test('Blood Moon portal entry starts the Castle Drakan chapter where the physical puzzle handlers become active', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
  };
  quest.setStage(player, 30);
  const enter = handlers.objects.find((handler) => handler.name === 'enterVampyriumCastle');
  enter({ player, definition: { getName: () => 'Ominous red portal' }, location: { x: 3161, y: 7710, z: 0 }, handled: false });
  assert.equal(quest.getStage(player), 40);
});

test('Blood Moon Hallowed preparations make the stew, upgraded flail and stakes before the siege stage', () => {
  const { api, handlers } = mockApi();
  const originalForId = api.core.NpcDefinition.forId;
  api.core.NpcDefinition.forId = () => ({ getName: () => 'Safalaan Hallow' });
  const messages = [];
  api.emitCustomEvent = (name, event) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(event);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    getFreeSlots: () => 0,
    contains: (id) => (counts.get(id) ?? 0) > 0,
    getAmount: (id) => counts.get(id) ?? 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getEquipment: () => ({ contains: () => false }),
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage: (text) => messages.push(text),
  };
  quest.setStage(player, 60);
  const object = handlers.objects.find((handler) => handler.name === 'handlePrepObject');
  const itemOnItem = handlers.itemOnItem.find((handler) => handler.name === 'handlePrepItemOnItem');
  const itemOnNpc = handlers.itemOnNpc.at(-1);
  const ids = api.core.ItemIdentifiers;
  const use = (a, b) => itemOnItem({ player, usedItemId: a, usedWithItemId: b, handled: false });
  const interact = (name, x = 0, y = 0, z = 1) => object({ player, definition: { getName: () => name }, option: 'Search', location: { x, y, z }, handled: false });

  interact('Amitire plant', 2982, 7679, 0);
  interact('Shelves', 3159, 7824);
  interact('Sink', 3157, 7825);
  interact('Cupboard', 3155, 7832);
  use(ids.BOWL_OF_WATER, ids.POTATO);
  interact('Cupboard', 3155, 7832);
  interact('Range', 3160, 7826);
  use(ids.INCOMPLETE_STEW, ids.COOKED_MEAT);
  interact('Range', 3160, 7826);
  use(ids.STEW, ids.AMITIRE_LEAVES);
  assert.equal(inventory.contains(ids.AMITIRE_STEW), true, 'the ordered ingredients create the quest stew');
  const feeding = { player, target: { getName: () => 'Safalaan Hallow' }, npcId: api.core.NpcIdentifiers.SAFALAAN_HALLOW, itemId: ids.AMITIRE_STEW, handled: false };
  itemOnNpc(feeding);
  assert.equal(feeding.handled, true);
  assert.equal(inventory.contains(ids.HALLOWED_MARKS), true, 'feeding Safalaan grants the hallowed marks');

  interact('Workbench', 3176, 7841); interact('Workbench', 3176, 7841); interact('Workbench', 3176, 7841);
  interact('Crate', 3177, 7843);
  interact('Crate', 3181, 7841);
  interact('Chest', 3181, 7835);
  use(ids.SILVER_SICKLE_B_, ids.DIAMOND);
  interact('Chest', 3175, 7836);
  use(ids.DIAMOND_SICKLE_B_, ids.ENCHANT_DIAMOND);
  use(ids.ENCHANTED_DIAMOND_SICKLE_B_, ids.BLISTERWOOD_LOGS);
  inventory.adds(ids.BLISTERWOOD_FLAIL, 1);
  interact('Anvil', 3179, 7842);
  assert.equal(inventory.contains(ids.HALLOWED_FLAIL), true, 'the anvil consumes the sickle/marks/flail and makes a hallowed flail');
  interact('Crate', 3177, 7843);
  use(ids.BLISTERWOOD_LOGS, ids.KNIFE);
  const action = handlers.custom.get('npc-dialogue:action').at(-1);
  action({ player, stepId: 'Sut83Q' });
  assert.equal(quest.getStage(player), 70, 'the siege starts after the player crafts both required defence items');
  assert.ok(messages.length > 0, 'interactions give feedback while ingredients and equipment are prepared');
  api.core.NpcDefinition.forId = originalForId;
});

test('Blood Moon Castle Drakan throne opens only after the ordered bust mechanism and awards its key', () => {
  const { api, handlers } = mockApi();
  const messages = [];
  api.emitCustomEvent = (name, event) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(event);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage: (text) => messages.push(text),
  };
  quest.setStage(player, 40);
  const interact = (name, x, y, option) => {
    const event = { player, definition: { getName: () => name }, location: { x, y, z: 0 }, option, handled: false };
    for (const handler of handlers.objects) {
      handler(event);
      if (event.handled) break;
    }
    return event;
  };
  const action = handlers.custom.get('npc-dialogue:action').at(-1);
  action({ player, stepId: 'XqVfhB' });
  assert.equal(quest.getStage(player), 40, 'the escape transcript cannot bypass the throne puzzle');
  interact('Throne', 2313, 7392, 'Search');
  interact('Bust with lever', 2317, 7393, 'Pull');
  assert.ok(messages.some((message) => message.includes('reset')), 'the wrong first lever resets the mechanism');
  for (const y of [7391, 7390, 7393, 7392]) interact('Bust with lever', 2317, y, 'Pull');
  interact('Throne', 2313, 7392, 'Search');
  assert.equal(inventory.contains(api.core.ItemIdentifiers.HALF_MOON_KEY), true);
  action({ player, stepId: 'XqVfhB' });
  assert.equal(quest.getStage(player), 45, 'the escape chapter advances only after claiming the key');
});

test('Blood Moon Castle basin puzzle requires all four correct potions before revealing the ancient symbol', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const objects = handlers.objects;
  const shelves = objects.find((handler) => handler.name === 'handleCastleBasinPuzzle');
  const altar = objects.find((handler) => handler.name === 'handleBasinAltar');
  shelves({ player, definition: { getName: () => 'Shelves' }, location: { x: 2380, y: 7396, z: 0 }, handled: false });
  const I = api.core.ItemIdentifiers;
  for (const id of [I.CLOUDY_GREY_POTION, I.WEIGHTLESS_BLACK_POTION, I.THICK_RED_POTION, I.COLD_BLUISH_WHITE_POTION]) {
    assert.equal(inventory.contains(id), true, 'searching the shelves gives each distinct potion');
  }
  const pour = (itemId, objectId, x, y) => {
    const event = { player, itemId, objectId, location: { x, y, z: 0 }, handled: false };
    handlers.itemOnObject.find((handler) => handler.name === 'handleBasinPotion')(event);
    return event;
  };
  assert.equal(pour(I.CLOUDY_GREY_POTION, 61704, 2380, 7389).handled, true);
  assert.equal(inventory.contains(I.CLOUDY_GREY_POTION), true, 'a wrong basin keeps the potion');
  pour(I.THICK_RED_POTION, 61704, 2380, 7389);
  pour(I.WEIGHTLESS_BLACK_POTION, 61703, 2387, 7389);
  pour(I.CLOUDY_GREY_POTION, 61702, 2380, 7384);
  pour(I.COLD_BLUISH_WHITE_POTION, 61705, 2387, 7384);
  altar({ player, definition: { getName: () => 'Altar' }, location: { x: 2382, y: 7393, z: 0 }, handled: false });
  assert.equal(inventory.contains(I.ANCIENT_SYMBOL), true, 'all four correctly poured potions reveal the symbol');
});

test('Blood Moon solid key requires the symbol, shield assembly, and southern wall mount', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map([
    ['quest.the_blood_moon_rises.castle-basin-puzzle', { basins: { one: true, two: true, three: true, four: true }, symbol: true }],
  ]);
  const counts = new Map([[api.core.ItemIdentifiers.ANCIENT_SYMBOL, 1]]);
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const I = api.core.ItemIdentifiers;
  const object = handlers.objects.find((handler) => handler.name === 'handleSolidKeyObjects');
  object({ player, definition: { getName: () => 'Crate' }, location: { x: 2439, y: 7378, z: 0 }, handled: false });
  assert.equal(inventory.contains(I.ANCIENT_SHIELD), true, 'the room crate supplies the ancient shield after the symbol is found');
  handlers.itemOnItem.find((handler) => handler.name === 'handleAncientShieldAssembly')({
    player, usedItemId: I.ANCIENT_SYMBOL, usedWithItemId: I.ANCIENT_SHIELD, handled: false,
  });
  assert.equal(inventory.contains(I.SHIELD_WITH_SYMBOL), true);
  const mount = handlers.itemOnObject.find((handler) => handler.name === 'handleMountShield');
  mount({ player, itemId: I.SHIELD_WITH_SYMBOL, location: { x: 2543, y: 7361, z: 0 }, handled: false });
  object({ player, definition: { getName: () => 'Shield' }, location: { x: 2543, y: 7361, z: 0 }, handled: false });
  assert.equal(inventory.contains(I.SOLID_KEY), true, 'searching the mounted shield yields the solid key');
});

test('Blood Moon clocks require the proper hands and both poem times before the fireplace gives an emblem', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const interact = handlers.objects.find((handler) => handler.name === 'handleCastleClocks');
  interact({ player, objectId: 61752, location: { x: 2323, y: 7386, z: 0 }, handled: false });
  interact({ player, objectId: 61751, location: { x: 2466, y: 7370, z: 0 }, handled: false });
  const hand = handlers.itemOnObject.find((handler) => handler.name === 'handleClockHandOnClock');
  hand({ player, objectId: 61656, itemId: api.core.ItemIdentifiers.SMALL_CLOCK_HAND, location: { x: 2344, y: 7372, z: 0 }, handled: false });
  hand({ player, objectId: 61657, itemId: api.core.ItemIdentifiers.LARGE_CLOCK_HAND, location: { x: 2350, y: 7372, z: 0 }, handled: false });
  const adjusted = { west: 0, east: 0 };
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => {
    if (title.startsWith('Adjust the')) {
      const side = title.includes('west') ? 'west' : 'east';
      pairs[adjusted[side]++ === 0 ? 1 : 3]();
    } else if (title.startsWith('Set the')) {
      const target = title.includes('large') ? (title.includes('west') ? 11 : 0) : (title.includes('west') ? 9 : 4);
      pairs[target * 2 + 1]();
    }
  };
  interact({ player, objectId: 61656, location: { x: 2344, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61656, location: { x: 2344, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61657, location: { x: 2350, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61657, location: { x: 2350, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61662, location: { x: 2346, y: 7372, z: 0 }, handled: false });
  assert.equal(inventory.contains(api.core.ItemIdentifiers.DRAKAN_EMBLEM_2), true);
});

test('Blood Moon gallery chest arrow puzzle resets mistakes and gives the crescent key after the right sequence', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const chest = handlers.objects.find((handler) => handler.name === 'handleGalleryChest');
  const interact = () => chest({ player, objectId: 61681, location: { x: 2379, y: 7372, z: 0 }, handled: false });
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[1]();
  interact();
  assert.equal(attributes.get('quest.the_blood_moon_rises.gallery-chest').step, 0, 'an incorrect first arrow resets the sequence');
  const correct = [1, 2, 1, 3, 3];
  let currentStep = 0;
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[correct[currentStep++] * 2 + 1]();
  interact();
  assert.equal(attributes.get('quest.the_blood_moon_rises.gallery-chest').solved, true);
  interact();
  assert.equal(inventory.contains(api.core.ItemIdentifiers.CRESCENT_MOON_KEY), true);
});

test('Blood Moon hunt requires the crank, bookcase key and TOOLS shed code before yielding bolt cutters', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 50);
  const route = handlers.routes.find((handler) => handler.name === 'routeBloodHuntObjects');
  const bookcaseRoute = { player, objectId: 61818, object: { getLocation: () => ({}) }, destination: null };
  bookcaseRoute.object.getLocation = () => ({ getX: () => 2585, getY: () => 7861, getZ: () => 0 });
  route(bookcaseRoute);
  assert.deepEqual(bookcaseRoute.destination, { x: 2584, y: 7862, z: 0 }, 'the bookcase is approached from its reachable southern side');
  let spawned = null;
  api.getItemOnGroundManager = () => ({
    getGroundItem: () => null,
    registerLocation: (_who, item, tile) => { spawned = { item, tile }; },
  });
  player.getUsername = () => 'BloodHuntFixture';
  player.isPlayerBot = () => false;
  player.getPrivateArea = () => null;
  handlers.playerProcess.find((handler) => handler.name === 'syncHuntGroundItems')({ player });
  assert.equal(spawned.item.id, api.core.ItemIdentifiers.CRANK_WHEEL, 'the crank wheel spawns at the mapped hunt tile');
  assert.deepEqual([spawned.tile.getX(), spawned.tile.getY(), spawned.tile.getZ()], [2603, 7847, 0]);
  const hunt = handlers.objects.find((handler) => handler.name === 'handleBloodHuntObjects');
  const interact = (x, y) => hunt({ player, location: { x, y, z: 0 }, handled: false });
  const ids = api.core.ItemIdentifiers;
  inventory.adds(ids.CRANK_WHEEL, 1);
  interact(2588, 7855);
  interact(2585, 7861);
  assert.equal(inventory.contains(ids.DUSTY_BOOK), true, 'the crank chase unlocks the bookcase');
  const read = handlers.itemAction.find((actions) => actions.Read)?.Read;
  read({ player, itemId: ids.DUSTY_BOOK, handled: false });
  assert.equal(inventory.contains(ids.VITUR_KEY), true, 'reading the dusty book gives the Vitur key');
  let digit = 0;
  const sequence = [0, 1, 1, 2, 3];
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[sequence[digit++] * 2 + 1]();
  interact(2616, 7855);
  assert.equal(attributes.get('quest.the_blood_moon_rises.blood-hunt').shedOpen, true);
  interact(2616, 7855);
  assert.equal(inventory.contains(ids.BOLT_CUTTERS), true, 'the opened shed provides the bolt cutters');
  interact(2600, 7845);
  interact(2590, 7818);
  interact(2588, 7816);
  assert.equal(inventory.contains(ids.TOOTH_HALF_OF_KEY_6), true);
  assert.equal(inventory.contains(ids.LOOP_HALF_OF_KEY_6), true);
  const combine = handlers.itemOnItem.find((handler) => handler.name === 'handleBloodHuntItemOnItem');
  combine({ player, usedItemId: ids.LOOP_HALF_OF_KEY_6, usedWithItemId: ids.TOOTH_HALF_OF_KEY_6, handled: false });
  assert.equal(inventory.contains(ids.MYRMEL_KEY), true, 'both halves combine into the pub key');
  interact(2596, 7833);
  const useOnObject = handlers.itemOnObject.find((handler) => handler.name === 'handleBloodHuntItemOnObject');
  useOnObject({ player, itemId: ids.BUCKET, objectId: 1, location: { x: 2592, y: 7825, z: 0 }, handled: false });
  useOnObject({ player, itemId: ids.BUCKET_OF_WATER, objectId: 1, location: { x: 2592, y: 7833, z: 0 }, handled: false });
  assert.equal(inventory.contains(ids.SHADUM_KEY), true, 'water on the northern barrel reveals the Shadum key');
  interact(2619, 7812);
  assert.equal(inventory.contains(ids.TRAPDOOR_KEY), true, 'the Shadum house contains the trapdoor key');
  interact(2580, 7835);
  interact(2582, 7834);
  assert.equal(attributes.get('quest.the_blood_moon_rises.blood-hunt').bankCrank, true);
  interact(2579, 7830);
  let chestDigit = 0;
  const chestCode = [2, 4, 0, 4, 7];
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[chestCode[chestDigit++] * 2 + 1]();
  interact(2576, 7846);
  assert.equal(inventory.contains(ids.JOVKAI_KEY), true, 'the altar chest code yields the Jovkai key');
  interact(2582, 7817);
  assert.equal(inventory.contains(ids.OLD_COG), true, 'the smithy provides the old cog after the key');
});

test('Blood Moon refiner requires the four correct chemical vials totalling 53 before destroying the stockpile', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    getAmount: (id) => counts.get(id) ?? 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const interact = handlers.objects.find((handler) => handler.name === 'handleRefiner');
  const shelves = { player, definition: { getName: () => 'Shelves' }, location: { x: 2513, y: 7387, z: 0 }, handled: false };
  interact(shelves);
  const I = api.core.ItemIdentifiers;
  const makeVial = (itemId) => handlers.itemOnObject.find((handler) => handler.name === 'handleRefinerMixture')({
    player, itemId, objectId: 61709, location: { x: 2520, y: 7385, z: 0 }, handled: false,
  });
  makeVial(I.VIAL_OF_BLOOD_5);
  makeVial(I.VIAL_OF_BLOOD_5);
  makeVial(I.VIAL_OF_BLOOD_5);
  makeVial(I.PURE_ESSENCE_4);
  const vial = handlers.itemOnObject.find((handler) => handler.name === 'handleRefinerVial');
  for (let i = 0; i < 4; i++) {
    const event = { player, itemId: I.CHEMICAL_VIAL, objectId: 61707, location: { x: 2518, y: 7389, z: 0 }, handled: false };
    vial(event);
    assert.equal(event.handled, true);
  }
  const stockpile = { player, definition: { getName: () => 'Blood stockpile' }, location: { x: 2535, y: 7385, z: 0 }, handled: false };
  interact(stockpile);
  assert.equal(attributes.get('quest.the_blood_moon_rises.castle-refiner').destroyed, true);
});

test('The Wyrd transcript action starts a private encounter with the cache-mapped boss', () => {
  const { api, handlers } = mockApi();
  const attributes = new Map();
  const spawns = [];
  let bossArea = null;
  const boss = {
    isNpc: () => true,
    isPlayer: () => false,
    getAsNpc: () => boss,
    getIndex: () => 200,
    getArea: () => bossArea,
    setArea: (area) => { bossArea = area; },
    setMultiCombat() {},
    setMaxHitpoints(value) { this.maxHitpoints = value; },
    setHitpoints(value) { this.hitpoints = value; },
  };
  api.spawnNpc = (definition) => (spawns.push(definition), boss);
  api.emitCustomEvent = (name, request) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(request);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const player = {
    getUsername: () => 'WyrdFightTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => player,
    getIndex: () => 100,
    getArea: () => player.area,
    setArea: (area) => { player.area = area; },
    moveTo: (location) => { player.destination = [location.getX(), location.getY(), location.getZ()]; },
    sendMessage() {},
  };
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: '4G5OZg' });
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.WYRD_8, x: 2976, y: 7456, z: 0, ownerOnly: true },
  ]);
  assert.deepEqual(player.destination, [2976, 7452, 0]);
  assert.equal(player.getArea(), bossArea, 'the player and owner-only Wyrd share a private combat area');
  assert.equal(boss.getArea(), bossArea);
  assert.equal(boss.hitpoints, 1100);
});

test('Blood Moon northern-door transcript starts the private Lowerniel encounter', () => {
  const { api, handlers } = mockApi();
  const attributes = new Map();
  const spawns = [];
  let bossArea = null;
  const boss = {
    isNpc: () => true,
    isPlayer: () => false,
    getAsNpc: () => boss,
    getIndex: () => 201,
    getArea: () => bossArea,
    setArea: (area) => { bossArea = area; },
    setMultiCombat() {},
    setMaxHitpoints(value) { this.maxHitpoints = value; },
    setHitpoints(value) { this.hitpoints = value; },
  };
  api.spawnNpc = (definition) => (spawns.push(definition), boss);
  api.emitCustomEvent = (name, request) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(request);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const player = {
    getUsername: () => 'DrakanFightTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => player,
    getIndex: () => 101,
    getArea: () => player.area,
    setArea: (area) => { player.area = area; },
    moveTo: (location) => { player.destination = [location.getX(), location.getY(), location.getZ()]; },
    sendMessage() {},
  };
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: 't7FMNM' });
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.LOWERNIEL_DRAKAN_17, x: 2505, y: 7838, z: 3, ownerOnly: true },
  ]);
  assert.deepEqual(player.destination, [2502, 7838, 3]);
  assert.equal(player.getArea(), bossArea, 'the player and Lowerniel share an owner-only final arena');
  assert.equal(boss.getArea(), bossArea);
  assert.equal(boss.hitpoints, 1600);
});

test('Blood Moon siege barrier action starts the second private Lowerniel fight and caps damage at the 58% cutscene', () => {
  const { api, handlers } = mockApi();
  const attributes = new Map();
  const spawns = [];
  let bossArea = null;
  const boss = {
    isNpc: () => true,
    isPlayer: () => false,
    getAsNpc: () => boss,
    getIndex: () => 202,
    getArea: () => bossArea,
    setArea: (area) => { bossArea = area; },
    setMultiCombat() {},
    setMaxHitpoints(value) { this.maxHitpoints = value; },
    setHitpoints(value) { this.hitpoints = value; },
    getHitpoints() { return this.hitpoints; },
    getId: () => api.core.NpcIdentifiers.LOWERNIEL_DRAKAN_19,
  };
  api.spawnNpc = (definition) => (spawns.push(definition), boss);
  api.emitCustomEvent = (name, request) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(request);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const player = {
    getUsername: () => 'SiegeDrakanTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => player,
    getIndex: () => 102,
    getArea: () => player.area,
    setArea: (area) => { player.area = area; },
    sendMessage() {},
  };
  quest.setStage(player, 70);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: 'Xz7d4O' });
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.LOWERNIEL_DRAKAN_19, x: 3168, y: 7853, z: 1, ownerOnly: true },
  ]);
  assert.equal(boss.maxHitpoints, 3000, 'the second fight begins at 85% of the boss’s 3,000 HP');
  assert.equal(boss.hitpoints, 2550);
  assert.equal(player.getArea(), bossArea);
  assert.equal(boss.getArea(), bossArea);
  let total = 900;
  const parts = [{ damage: 400, getDamage() { return this.damage; }, setDamage(value) { this.damage = value; } },
    { damage: 500, getDamage() { return this.damage; }, setDamage(value) { this.damage = value; } }];
  handlers.npcHitModify.at(-1)({ npc: boss, hit: { getHits: () => parts, updateTotalDamage() { total = parts.reduce((sum, part) => sum + part.damage, 0); } } });
  assert.equal(total, 810, 'the lethal multi-hit is capped at 58% so the escape cutscene cannot be skipped');
});

test('Blood Moon hall defence supplies hammers and potions, records repairs and heals a fallen Aranei', () => {
  const { api, handlers } = mockApi();
  let cycle = 0;
  const originalGetProcessCycle = api.core.World.getProcessCycle;
  api.core.World.getProcessCycle = () => cycle;
  const spawns = [];
  const injured = {
    getId: () => api.core.NpcIdentifiers.ARANEI_112,
    getIndex: () => 800,
    getLocation: () => new api.core.Location(3173, 7855, 1),
    getHitpoints: () => 30,
    isRegistered: () => true,
    setNpcTransformationId(id) { this.transformedId = id; },
  };
  api.spawnNpc = (definition) => (spawns.push(definition), injured);
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getUsername: () => 'SiegeHallTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 70);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: 'vqg4qO' });
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.ARANEI_112, x: 3173, y: 7855, z: 1, ownerOnly: true },
  ]);
  const objectManager = api.core.ObjectManager;
  const replaced = [];
  const originalDeregister = objectManager.deregister;
  const originalRegister = objectManager.register;
  objectManager.deregister = (object) => replaced.push(['remove', object]);
  objectManager.register = (object) => replaced.push(['add', object]);
  const interact = handlers.objects.find((handler) => handler.name === 'handleSiegeHallObject');
  const objectEvent = (id, x, y, option = 'Repair') => {
    const location = new api.core.Location(x, y, 1);
    const object = { getLocation: () => location, getType: () => 10, getFace: () => 0, getPrivateArea: () => null };
    const event = { player, object, objectId: id, definition: { id }, location: { x, y, z: 1 }, option, handled: false };
    interact(event);
    return event;
  };
  const ids = api.core.ObjectIdentifiers;
  objectEvent(ids.CRATE_OF_HAMMERS_2, 3177, 7843, 'Take-from');
  objectEvent(ids.CRATE_OF_POTIONS, 3177, 7846, 'Take-from');
  assert.equal(inventory.contains(api.core.ItemIdentifiers.HAMMER), true);
  assert.equal(inventory.contains(api.core.ItemIdentifiers.HEALING_POTION), true);
  const npc = {
    getId: () => api.core.NpcIdentifiers.ARANEI_108,
    getIndex: () => 800,
    getLocation: () => new api.core.Location(3173, 7855, 1),
    setNpcTransformationId(id) { this.transformedId = id; },
  };
  const heal = handlers.npcInteractions.get(api.core.NpcIdentifiers.ARANEI_108).Heal;
  const healEvent = { player, npc, npcId: npc.getId(), handled: false };
  heal(healEvent);
  assert.equal(healEvent.handled, true);
  assert.equal(npc.transformedId, api.core.NpcIdentifiers.ARANEI_106);
  objectEvent(ids.DAMAGED_PILLAR_2, 3174, 7855);
  objectEvent(ids.DAMAGED_PILLAR_2, 3162, 7855);
  objectEvent(ids.DAMAGED_WINDOW, 3176, 7858);
  const state = attributes.get('quest.the_blood_moon_rises.siege-defence');
  assert.equal(state.repaired.length, 3);
  assert.equal(state.healed.length, 1);
  assert.equal(state.integrity, 100, 'repairs and healing support the integrity hold instead of completing it directly');
  assert.equal(replaced.filter(([kind]) => kind === 'add').length, 3, 'each fixed cache loc is replaced with its repaired variant');
  const process = handlers.playerProcess.find((handler) => handler.name === 'processSiegeDefence');
  attributes.set('quest.the_blood_moon_rises.siege-defence', { ...state, integrity: 51, participation: 0, nextIntegrityLossCycle: 20 });
  cycle = 20;
  const npcDefinition = api.core.NpcDefinition;
  const originalForId = npcDefinition.forId;
  npcDefinition.forId = (id) => ({ getId: () => id, getName: () => 'Lowerniel Drakan' });
  try {
    process({ player });
    assert.equal(attributes.get('quest.the_blood_moon_rises.siege-defence').phase, 'hall',
      'integrity alone cannot end the defence without the required participation');
    attributes.set('quest.the_blood_moon_rises.siege-defence', {
      ...attributes.get('quest.the_blood_moon_rises.siege-defence'), integrity: 51, participation: 3,
    });
    cycle = 40;
    process({ player });
  } finally {
    npcDefinition.forId = originalForId;
  }
  assert.equal(attributes.get('quest.the_blood_moon_rises.siege-defence').phase, 'breach',
    'the barricade cutscene begins at the 50% hideout-integrity threshold');
  objectManager.deregister = originalDeregister;
  objectManager.register = originalRegister;
  api.core.World.getProcessCycle = originalGetProcessCycle;
});

test('Blood Moon starts the scoped Theatre encounter and advances after Vasilias', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 80);
  let started = 0;
  api.onCustomEvent('tob:bmr:start', ({ player: eventPlayer }) => {
    assert.equal(eventPlayer, player);
    started++;
  });
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: '1Z5SGt' });
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: '1Z5SGt' });
  assert.equal(started, 1, 'the ready dialogue enters the shared scoped raid instead of starting a duplicate arena');
  assert.equal(attributes.get('quest.the_blood_moon_rises.tob-challenge').started, true);
  const npcDefinition = api.core.NpcDefinition;
  const originalForId = npcDefinition.forId;
  npcDefinition.forId = (id) => ({ getId: () => id, getName: () => 'Sugadinti Vitur' });
  try {
    api.emitCustomEvent('tob:bmr:completed', { player });
  } finally {
    npcDefinition.forId = originalForId;
  }
  assert.equal(quest.getStage(player), 90, 'the Vasilias clear advances to the Wyrd chapter');
  assert.equal(attributes.get('quest.the_blood_moon_rises.tob-challenge').completed, true);
});

test('Priest in Peril unlocks the mausoleum Holy barrier only after completion', () => {
  const { api: base } = mockApi();
  const objects = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (name, actions) => objects.set(name, actions)
      : target[prop],
  });
  require('../plugins/quests/quests/PriestInPeril.Quest')(api);
  const pass = objects.get('Holy barrier')?.['Pass-through'];
  assert.equal(typeof pass, 'function');
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const moves = [];
  const messages = [];
  let stage = 0;
  const player = {
    getAttribute: () => stage,
    moveTo: (location) => moves.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage: (text) => messages.push(text),
  };
  for (stage of [0, 10, 50, quest.completionValue - 1]) {
    assert.equal(pass({ player, objectId: api.core.ObjectIdentifiers.HOLY_BARRIER }), true);
    assert.deepEqual(moves, [], 'unfinished quests cannot cross');
    assert.match(messages.at(-1), /complete Priest in Peril/);
  }
  for (stage of [quest.completionValue, quest.completionValue + 1]) {
    assert.equal(pass({ player, objectId: api.core.ObjectIdentifiers.HOLY_BARRIER }), true);
    assert.deepEqual(moves.at(-1), [3423, 3485, 0]);
    assert.equal(messages.at(-1), 'You pass through the holy barrier.');
  }
  const before = [moves.length, messages.length];
  assert.equal(pass({ player, objectId: api.core.ObjectIdentifiers.HOLY_BARRIER_2 }), false,
    'the Hallowed Sepulchre barrier is handled by its own content');
  assert.deepEqual([moves.length, messages.length], before);
});

test('Song of the Elves rubs the seed to the Enchanted Valley and returns to Lletya', () => {
  const { api: base } = mockApi();
  const itemActions = [];
  const custom = new Map();
  const spawns = [];
  const locations = [];
  const started = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onItemAction') return (handler) => itemActions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, handler);
      if (prop === 'spawnNpc') return (spawn) => (spawns.push(spawn), null);
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  try {
    require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }

  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const player = {
    getUsername: () => 'SoteTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 28 }),
    getEquipment: () => ({ get: () => null }),
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getArea: () => null,
    moveTo: (location) => locations.push(location),
    sendMessage() {},
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
  };
  quest.setStage(player, 120);

  const itemEvent = { player, itemId: api.core.ItemIdentifiers.CRYSTAL_SEED_3, handled: false };
  itemActions.at(-1)(itemEvent);
  assert.equal(itemEvent.handled, true);
  assert.equal(started.at(-1)[3], 'preparing-to-enter-prifddinas-a-mysterious-figure');

  custom.get('npc-dialogue:action')({ player, stepId: 'UeAKgA' });
  assert.deepEqual([locations.at(-1).getX(), locations.at(-1).getY()], [2440, 6090]);
  assert.equal(spawns.at(-1).id, api.core.NpcIdentifiers.MYSTERIOUS_FIGURE);
  assert.equal(spawns.at(-1).owner, player);

  custom.get('npc-dialogue:action')({ player, stepId: 'D1wXY6' });
  assert.deepEqual([locations.at(-1).getX(), locations.at(-1).getY()], [2353, 3172]);
  assert.equal(attributes.get('quest.song_of_the_elves.valley-figure'), false);
});

test('Song of the Elves follows the cached Hefin stepping stones from the Poison Waste shore', () => {
  const { api: base, handlers } = mockApi();
  class ImmediateTask {
    constructor(_key, _ticks, onComplete) { this.onComplete = onComplete; }
  }
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return {
        ...target.core,
        CountdownTask: ImmediateTask,
        TaskManager: { submit: (task) => task.onComplete() },
      };
      return target[prop];
    },
  });
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map([['quest.song_of_the_elves.hefin-clue-heard', true]]);
  const moved = [];
  const faced = [];
  const requested = [];
  const location = { x: 2299, y: 3114, z: 0 };
  const movement = {
    reset() {}, walkToReset() {}, setBlockMovement() {},
    requestWalk: (destination) => requested.push(destination),
  };
  const player = {
    getUsername: () => 'HefinStoneTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => location.x, getY: () => location.y, getZ: () => location.z }),
    getMovementQueue: () => movement,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isRegistered: () => true,
    getHitpoints: () => 99,
    moveTo: (tile) => {
      location.x = tile.getX(); location.y = tile.getY(); location.z = tile.getZ();
      moved.push([location.x, location.y, location.z]);
    },
    setPositionToFace: (tile) => faced.push([tile.getX(), tile.getY()]),
    performAnimation() {},
  };
  quest.setStage(player, 150);
  const destination = { x: 2276, y: 3094, z: 0 };
  const event = { player, destination, handled: false };
  handlers.walkRoutes.at(-1)(event);
  assert.equal(event.handled, true);
  assert.ok(moved.length > 10, 'the crossing follows the intermediate cache stones');
  assert.deepEqual(moved.at(-1), [2280, 3092, 0]);
  assert.deepEqual(requested.map((tile) => [tile.getX(), tile.getY(), tile.getZ()]), [[2276, 3094, 0]],
    'normal pathfinding resumes after reaching the island shore');
  assert.equal(attributes.get('quest.song_of_the_elves.hefin-crossing'), false);
});

test('Song of the Elves exposes the post-library meeting through a talkable Arianwyn variant', () => {
  const { api } = mockApi();
  const areas = [];
  const spawns = [];
  api.registerArea = (area) => areas.push(area);
  api.spawnNpc = (definition) => (spawns.push(definition), { isRegistered: () => true });
  api.removeNpc = () => {};
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const player = {
    getUsername: () => 'PostLibraryMeetingTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    getAsPlayer: () => player,
  };
  quest.setStage(player, 140);
  const lletya = areas[0];
  lletya.process(player);
  lletya.process(player);
  assert.equal(spawns.length, 1, 'the owner-only meeting NPC is spawned once per chapter visit');
  assert.equal(spawns[0].id, api.core.NpcIdentifiers.ARIANWYN_6);
  assert.deepEqual([spawns[0].x, spawns[0].y, spawns[0].z], [2354, 3172, 0]);
  assert.equal(spawns[0].owner, player);
  assert.equal(spawns[0].ownerOnly, true);
});

test('Song of the Elves starts the post-library council and switches Baxtorian after it', () => {
  const { api, handlers } = mockApi();
  const hooks = [];
  const npcHooks = [];
  const started = [];
  const persistedAttributes = [];
  api.persistAttribute = (key) => persistedAttributes.push(key);
  api.onAnyNpcInteraction = (hook) => hooks.push(hook);
  api.onNpcInteraction = (...args) => npcHooks.push(args);
  const runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  try { require('../plugins/quests/quests/SongOfTheElves.Quest')(api); }
  finally { runtime.startTranscript = original; }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.revelations-meeting-started'));
  const attributes = new Map();
  const sentVarbits = [];
  let hasAxe = false;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({ sendVarbit: (id, value) => sentVarbits.push([id, value]) }, {
      get: (target, prop) => prop in target ? target[prop] : () => {},
    }),
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 28, deleteNumber: () => {}, adds: () => {}, contains: (id) => hasAxe && id === api.core.ItemIdentifiers.BRONZE_AXE }),
    getEquipment: () => ({ getItems: () => [] }),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    sendMessage() {},
  };
  quest.setStage(player, 140);
  const talk = hooks.at(-1)['Talk-to'];
  const interact = (name) => talk({ player, npcId: api.core.NpcIdentifiers.ARIANWYN_6, definition: { getName: () => name } });
  assert.equal(interact('Arianwyn'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-the-curse-of-seren');
  assert.equal(interact('Baxtorian'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-dialogue-with-npcs-post-library-visit-talking-to-baxtorian');
  const handoff = { player, npcId: api.core.NpcIdentifiers.ARIANWYN_6, handled: false };
  handlers.custom.get('quest-song-of-the-elves:claim-arianwyn').at(-1)(handoff);
  assert.equal(handoff.handled, true, 'the completed Mourning’s End handler can hand the NPC to SOTE');
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-the-curse-of-seren');
  quest.setStage(player, 160);
  attributes.set('quest.song_of_the_elves.lletya-traitor-revealed', true);
  const lletyaHandoff = { player, npcId: api.core.NpcIdentifiers.ARIANWYN_6, handled: false };
  handlers.custom.get('quest-song-of-the-elves:claim-arianwyn').at(-1)(lletyaHandoff);
  assert.equal(lletyaHandoff.handled, true, 'ME2 hands Arianwyn to SOTE during the Lletya attack');
  assert.equal(started.at(-1)[3], 'attack-on-lletya-confronting-the-traitor');
  handlers.custom.get('npc-dialogue:line').at(-1)({
    player, text: 'So be it.', step: { player: 'So be it.' },
    definition: { getName: () => 'Arianwyn' },
  });
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-arianwyn-confronted'), true,
    'the final player line starts the encounter even though this wiki step has no NPC speaker field');
  quest.setStage(player, 140);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'koxQh3' });
  assert.equal(attributes.get('quest.song_of_the_elves.revelations-meeting-started'), true);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'J6osYV' });
  assert.equal(quest.getStage(player), 140, 'closing the revelations meeting waits for Baxtorian’s follow-up');
  assert.equal(interact('Baxtorian'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-talking-to-baxtorian-after-the-meeting');
  assert.equal(quest.getStage(player), 150, 'Baxtorian’s follow-up opens the clan-leader chapter');
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'FoLVmk' });
  assert.equal(quest.getStage(player), 150, 'the meeting ending advances into the clan-leader chapter');
  assert.equal(interact('Baxtorian'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-talking-to-baxtorian-after-the-meeting',
    'players who closed the council dialogue can still ask for both elder clues');

  const choice = handlers.custom.get('npc-dialogue:choice').at(-1);
  choice({ player, option: 'How do I find Lord Crwys?', definition: { getName: () => 'Baxtorian' } });
  assert.equal(attributes.get('quest.song_of_the_elves.crwys-clue-heard'), true);
  assert.deepEqual(sentVarbits.at(-1), [9022, 1], 'the clue selects the cache tree variant with Chop down');
  const treeHook = npcHooks.find(([handler]) => typeof handler === 'function')?.[0];
  assert.equal(typeof treeHook, 'function');
  const chopTree = (extra = {}) => {
    const event = { player, npcId: api.core.NpcIdentifiers.LORD_PIQUAN_CRWYS_2, clickType: 1,
      npc: { getContentId: () => api.core.NpcIdentifiers.COL_00FFFF_TREE_COL_2, getSpawnPosition: () => ({ getX: () => 2176, getY: () => 3211 }) },
      location: { x: 2176, y: 3211 }, definition: { getName: () => '<col=00ffff>Tree</col>', getActions: () => ['Chop down'] }, ...extra };
    treeHook(event);
    return event;
  };
  const noAxe = chopTree();
  assert.equal(noAxe.handled, true, 'a missing axe is handled by the quest instead of starting woodcutting');
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-talking-to-baxtorian-after-the-meeting',
    'the disguised leader cannot be revealed without a usable axe');
  hasAxe = true;
  chopTree();
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-finding-lord-crwys');
  assert.deepEqual(sentVarbits.at(-1), [9022, 2], 'chopping reveals Lord Crwys');
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'UNrb5z' });
  choice({ player, option: 'How do I find Lady Hefin?', definition: { getName: () => 'Baxtorian' } });
  assert.equal(attributes.get('quest.song_of_the_elves.hefin-clue-heard'), true);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'K9K0W4' });
  assert.equal(quest.getStage(player), 150, 'both clan leaders keep the quest in the orb chapter');
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.crwys-clue-heard'));
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.hefin-clue-heard'));
});

test('Song of the Elves keeps Arianwyn engaged so ranged hits are not erased by generic NPC regeneration', () => {
  class TestPrivateArea {
    enter(mobile) { mobile.area = this; }
    leave(mobile) { mobile.area = null; }
    isDestroyed() { return false; }
  }
  const { api, handlers } = mockApi();
  api.core = { ...api.core, PrivateArea: TestPrivateArea, World: { getProcessCycle: () => 100 } };
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const started = [];
  const runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  let engagementResets = 0;
  const boss = {
    hitpoints: 300,
    getHitpoints() { return this.hitpoints; },
    getMaxHitpoints() { return 300; },
    setMultiCombat() {},
    setScriptedMovement() {},
    getCombat() {
      return {
        attack() {},
        getLastAttack: () => ({ reset: () => engagementResets++ }),
      };
    },
  };
  api.spawnNpc = () => boss;
  try { require('../plugins/quests/quests/SongOfTheElves.Quest')(api); }
  finally { runtime.startTranscript = original; }
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map([['quest.song_of_the_elves.lletya-traitor-revealed', true]]);
  const player = {
    area: null,
    getUsername: () => 'ArianwynEngagementTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => 2351, getY: () => 3172, getZ: () => 0 }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    moveTo() {},
    sendMessage() {},
  };
  quest.setStage(player, 160);
  handlers.custom.get('npc-dialogue:line').at(-1)({
    player, text: 'So be it.', step: { player: 'So be it.' },
    definition: { getName: () => 'Arianwyn' },
  });
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-boss') instanceof TestPrivateArea, true);
  assert.equal(started.length, 0, 'the final challenge line enters combat rather than leaving a queued dialogue over it');
  attributes.get('quest.song_of_the_elves.lletya-boss').process(player);
  assert.equal(engagementResets, 1, 'private-area ticks refresh the boss combat timer so real hit queues can damage it');
});

test('Song of the Elves tracks Ysgawyn clues in order through normal object examine packets', () => {
  const { api, handlers } = mockApi();
  const areas = [];
  const spawns = [];
  api.registerArea = (area) => areas.push(area);
  api.spawnNpc = (definition) => (spawns.push(definition), { isRegistered: () => true });
  api.removeNpc = () => {};
  const persistedAttributes = [];
  api.persistAttribute = (key) => persistedAttributes.push(key);
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const messages = [];
  let tile = { x: 2306, y: 3194, z: 0 };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({ getAmount: (id) => id === api.core.ItemIdentifiers.ORB_OF_LIGHT_5 ? 1 : 0 }),
    getLocation: () => ({ getX: () => tile.x, getY: () => tile.y, getZ: () => tile.z }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage: (message) => messages.push(message),
    isPlayer: () => true,
    getAsPlayer: () => player,
  };
  quest.setStage(player, 150);
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.ysgawyn-track-step'));
  const examine = handlers.custom.get('world:object-examine').at(-1);
  const outOfOrder = { player, objectId: 37297, handled: false };
  examine(outOfOrder);
  assert.equal(outOfOrder.handled, false);
  assert.equal(attributes.has('quest.song_of_the_elves.ysgawyn-track-step'), false);
  const mushroom = { player, objectId: 37292, handled: false };
  examine(mushroom);
  assert.equal(mushroom.handled, true);
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 1);
  assert.match(messages.at(-1), /mushrooms/);
  tile = { x: 2294, y: 3189, z: 0 };
  examine({ player, objectId: 37297, handled: false });
  tile = { x: 2279, y: 3186, z: 0 };
  examine({ player, objectId: 37296, handled: false });
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 3);
  const route = {
    player, objectId: 3923, clickType: 1, destination: null,
    definition: { getInteractions: () => ['Jump'] },
    sourceLocation: { x: 2274, y: 3177, z: 0 },
  };
  for (const hook of handlers.routes) hook(route);
  assert.deepEqual(route.destination, route.sourceLocation,
    'the natural Regicide Jump handler keeps the original approach edge before it applies Agility');
  for (const [id, x, y] of [[3918, 2272, 3168], [3916, 2259, 3159], [37297, 2244, 3170]]) {
    tile = { x, y, z: 0 };
    examine({ player, objectId: id, handled: false });
  }
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 6);
  tile = { x: 2254, y: 3168, z: 0 };
  for (const process of handlers.playerProcess) process({ player });
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 7,
    'the tripwire clearing is required after all six clues');
  const clearing = areas.find((area) => area.constructor.name === 'YsgawynClearingArea');
  clearing.process(player);
  assert.deepEqual(spawns.at(-1), { id: api.core.NpcIdentifiers.YSGAWYN, x: 2256, y: 3168, z: 0,
    wanderRadius: 0, owner: player, ownerOnly: true });
});

test('Song of the Elves rescue searches require the east table before Iona and preserve both rescues', () => {
  const { api, handlers } = mockApi();
  const started = [];
  const runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  try { require('../plugins/quests/quests/SongOfTheElves.Quest')(api); }
  finally { runtime.startTranscript = original; }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  let playerLocation = { x: 2340, y: 3158, z: 0 };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({}),
    moveTo() {},
    getLocation: () => ({ getX: () => playerLocation.x, getY: () => playerLocation.y, getZ: () => playerLocation.z }),
    getPrivateArea: () => null,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 150);
  handlers.custom.get('npc-dialogue:action').at(-1)({
    player, kind: 'message', stepId: 'XhOxpi', npcId: api.core.NpcIdentifiers.ARIANWYN_6,
  });
  assert.equal(quest.getStage(player), 160);
  assert.equal(started.at(-1)[3], 'attack-on-lletya-a-village-on-fire');
  const mapObjects = api.core.MapObjects;
  const originalGet = mapObjects.get;
  mapObjects.get = (id) => ({ getId: () => id });
  const examine = (objectId) => {
    const event = { player, objectId, handled: false };
    for (const hook of handlers.custom.get('world:object-examine') ?? []) hook(event);
    return event.handled;
  };
  playerLocation = { x: 2338, y: 3157, z: 1 };
  assert.equal(examine(api.core.ObjectIdentifiers.COOKING_POTS_2), true);
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-children'), undefined,
    'Iona cannot be rescued before finding Eoin');
  playerLocation = { x: 2340, y: 3158, z: 0 };
  assert.equal(examine(api.core.ObjectIdentifiers.TABLE_75), true);
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-children').eoin, true);
  assert.equal(started.at(-1)[3], 'attack-on-lletya-a-village-on-fire-finding-eoin');
  playerLocation = { x: 2338, y: 3157, z: 1 };
  assert.equal(examine(api.core.ObjectIdentifiers.COOKING_POTS_2), true);
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-children').iona, true);
  assert.equal(started.at(-1)[3], 'attack-on-lletya-a-village-on-fire-finding-iona');
  mapObjects.get = originalGet;
});

test('Song of the Elves spawns Baxtorian in Lletya for the post-attack clan clues', () => {
  const { api } = mockApi();
  const areas = [];
  const spawns = [];
  api.registerArea = (area) => areas.push(area);
  api.spawnNpc = (definition) => (spawns.push(definition), { isRegistered: () => true });
  api.removeNpc = () => {};
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const player = {
    getUsername: () => 'PostAttackCluesTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    getAsPlayer: () => player,
  };
  quest.setStage(player, 170);
  const lletya = areas.find((area) => area.constructor.name === 'LletyaStoryArea');
  lletya.process(player);
  assert.deepEqual(spawns.at(-1), { id: api.core.NpcIdentifiers.BAXTORIAN, x: 2352, y: 3170, z: 0,
    wanderRadius: 0, owner: player, ownerOnly: true });
});

test('Song of the Elves chapter 16 requires the real Ithell symbols, statue, clue digs and spin', () => {
  const { api: base, handlers } = mockApi();
  const custom = handlers.custom;
  const areas = [];
  const npcHooks = [];
  const spawned = [];
  const started = [];
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  apiSetup();
  function apiSetup() {
    base.registerArea = (area) => areas.push(area);
    base.spawnNpc = (definition) => {
      spawned.push(definition);
      return { isRegistered: () => true };
    };
    base.removeNpc = () => {};
    base.onAnyNpcInteraction = (hook) => npcHooks.push(hook);
    require('../plugins/quests/quests/SongOfTheElves.Quest')(base);
  }
  runtime.startTranscript = originalStartTranscript;

  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map([['quest.song_of_the_elves.recruited-elders', 7]]);
  const inventory = new Map();
  const varbits = new Map();
  const location = { x: 2352, y: 3170, z: 0 };
  const player = {
    getUsername: () => 'SoteChapter16Test',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - [...inventory.values()].filter((amount) => amount > 0).length,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    getPacketSender: () => new Proxy({}, { get: (_, key) => key === 'sendVarbit' ? (id, value) => varbits.set(id, value) : () => {} }),
    getLocation: () => ({ getX: () => location.x, getY: () => location.y, getZ: () => location.z }),
    getEquipment: () => ({ getItems: () => [] }),
    getArea: () => areas[0],
    isPlayer: () => true,
    getAsPlayer: () => player,
    moveTo() {}, sendMessage() {}, performAnimation() {},
  };
  quest.setStage(player, 170);

  const choices = custom.get('npc-dialogue:choice');
  choices.at(-1)({ player, option: "What's Lady Ithell's clue?", definition: { getName: () => 'Baxtorian' } });
  assert.equal(varbits.get(9035), 1);
  const examineSymbol = custom.get('world:object-examine')[1];
  location.x = 2322; location.y = 3163; location.z = 0;
  const examined = { player, objectId: 37305, handled: false };
  examineSymbol(examined);
  assert.equal(examined.handled, true, 'missing cache actions use the current-tile wall Examine fallback');
  const remoteExamine = { player, objectId: 37306, handled: false };
  examineSymbol(remoteExamine);
  assert.equal(remoteExamine.handled, false, 'an Examine packet cannot claim a different symbol across Lletya');
  for (const symbol of [
    { id: 37307, x: 2349, y: 3161, z: 0 }, { id: 37306, x: 2340, y: 3181, z: 0 },
    { id: 37304, x: 2334, y: 3183, z: 1 }, { id: 37303, x: 2351, y: 3172, z: 1 },
  ]) {
    const event = { player, objectId: symbol.id, location: symbol, option: 'Touch', handled: false };
    for (const handler of handlers.objects) if (handler(event) === true) break;
    assert.equal(event.handled, true);
  }
  assert.equal(attributes.get('quest.song_of_the_elves.ithell-clue-stage'), 2);
  assert.equal(varbits.get(9035), 2);
  inventory.set(base.core.ItemIdentifiers.LIMESTONE_BRICK, 8);
  inventory.set(base.core.ItemIdentifiers.SAW, 1);
  inventory.set(base.core.ItemIdentifiers.HAMMER, 1);
  const statue = { player, objectId: 37308, location: { x: 2337, y: 3171, z: 0 }, option: 'Build', handled: false };
  for (const handler of handlers.objects) if (handler(statue) === true) break;
  assert.equal(attributes.get('quest.song_of_the_elves.ithell-statue'), true);
  assert.equal(inventory.get(base.core.ItemIdentifiers.LIMESTONE_BRICK), 0);
  attributes.set('quest.song_of_the_elves.ithell-clue-stage', 0);
  areas[0].process(player);
  attributes.set('quest.song_of_the_elves.ithell-clue-stage', 2);
  assert.equal(spawned.at(-1).id, base.core.NpcIdentifiers.LADY_KELYN_ITHELL);

  choices.at(-1)({ player, option: "What's Lady Meilyr's clue?", definition: { getName: () => 'Baxtorian' } });
  assert.equal(inventory.get(base.core.ItemIdentifiers.CLUE_SCROLL_HARD_), 1);
  const dig = handlers.itemAction.find((actions) => actions?.Dig)?.Dig;
  assert.ok(dig);
  for (const spot of [{ x: 2225, y: 3133 }, { x: 2203, y: 3061 }, { x: 2240, y: 3269 }]) {
    location.x = spot.x; location.y = spot.y; location.z = 0;
    const event = { player, itemId: base.core.ItemIdentifiers.SPADE, handled: false };
    assert.equal(dig(event), true);
    assert.equal(event.handled, true);
  }
  assert.equal(varbits.get(9036), 4);
  location.x = 2309; location.y = 3215; location.z = 0;
  custom.get('player:emote').at(-1)({ player, sequence: 2107 });
  assert.equal(varbits.get(9036), 5);
  assert.equal(spawned.at(-1).id, base.core.NpcIdentifiers.LADY_FFION_MEILYR);
  const talk = npcHooks.at(-1)['Talk-to'];
  assert.equal(talk({ player, npcId: base.core.NpcIdentifiers.LADY_FFION_MEILYR,
    definition: { getName: () => 'Lady Ffion Meilyr' } }), true);
  assert.equal(started.at(-1)[3], 'after-the-attack-finding-lady-meilyr');
  custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'S3ME_F' });
  assert.equal(inventory.get(base.core.ItemIdentifiers.CLUE_SCROLL_HARD_), 0);
  assert.equal(quest.getStage(player), 180);
});

test('Song of the Elves Iorwerth scroll lands on the walkable camp tile', () => {
  const { api: base, handlers } = mockApi();
  let destination;
  let consumed;
  const core = {
    ...base.core,
    TeleportHandler: {
      checkReqs: () => true,
      teleport: (player, location) => player.moveTo(location),
    },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core : target[prop],
  });
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const player = {
    getInventory: () => ({ deleteNumber: (id, amount) => { consumed = [id, amount]; } }),
    moveTo: (location) => { destination = [location.getX(), location.getY(), location.getZ()]; },
  };
  const event = {
    player,
    itemId: core.ItemIdentifiers.IORWERTH_CAMP_TELEPORT,
    option: 'Teleport',
    handled: false,
  };
  handlers.itemAction.at(-1)(event);
  assert.equal(event.handled, true);
  assert.deepEqual(consumed, [core.ItemIdentifiers.IORWERTH_CAMP_TELEPORT, 1]);
  assert.deepEqual(destination, [2194, 3258, 0]);
});

test('Song of the Elves library mirrors must follow the previous beam direction', () => {
  class TestPrivateArea {
    constructor() { this.objects = []; }
    enter(player) { player.area = this; }
    getObjects() { return this.objects; }
    getTemplateObjects(tile) {
      return [[2609, 6158, 1], [2623, 6158, 1], [2623, 6159, 1], [2623, 6158, 0], [2623, 6130, 0],
        [2609, 6130, 0], [2609, 6116, 0], [2609, 6102, 0], [2623, 6102, 0], [2581, 6130, 0]]
        .some(([x, y, z]) => tile?.getX?.() === x && tile?.getY?.() === y && tile?.getZ?.() === z)
        ? [{ getId: () => tile.getX() === 2609 && tile.getY() === 6158
          ? 35222 : base.core.ObjectIdentifiers.PILLAR_OF_LIGHT_41 }]
        : [];
    }
  }
  const itemObjects = new Map();
  const objectInteractions = [];
  const custom = new Map();
  const prompts = [];
  const base = { core: {
    ...PluginManager.getCoreApi(), PrivateArea: TestPrivateArea,
    ObjectDefinition: { forId: (id) => id === 35222 ? { name: 'Pillar of Light' } : null },
  } };
  base.core.ObjectDefinition.forPlayer = (id) => [35222, 35259, 35194].includes(id)
    ? { id: id === 35259 ? 35194 : id, name: 'Pillar of Light', getName: () => 'Pillar of Light' }
    : null;
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'onItemOnObject') return (itemName, objectName, handler) => itemObjects.set(itemName, handler);
      if (prop === 'onObjectInteraction') return (...args) => {
        if (typeof args[0] === 'function') objectInteractions.push(args[0]);
        else if (args[0] === 'Floating Book') objectInteractions.push(args[1].Climb);
      };
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, handler);
      if (prop === 'sendMultiChatboxPrompt') return (player, prompt, ...choices) => prompts.push(choices);
      if (prop === 'spawnNpc') return () => null;
      return () => {};
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const amounts = new Map();
  const messages = [];
  const inventory = {
    getAmount: (id) => amounts.get(id) ?? 0,
    getFreeSlots: () => 28,
    adds: (id, amount) => amounts.set(id, (amounts.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => amounts.set(id, Math.max(0, (amounts.get(id) ?? 0) - amount)),
  };
  const player = {
    getUsername: () => 'SoteLibraryTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getArea: () => player.area ?? null,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getEquipment: () => ({ get: () => null }),
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    sendMessage: (message) => messages.push(message),
    moveTo(location) { player.destination = [location.getX(), location.getY(), location.getZ()]; },
  };
  quest.setStage(player, 130);
  custom.get('npc-dialogue:choice')({
    player, option: 'Yes', definition: { getName: () => 'Lord Ieuan Amlodd' },
  });
  const climbFloatingBooks = objectInteractions.at(-1);
  const bookCrossing = { player, objectId: api.core.ObjectIdentifiers.FLOATING_BOOK, location: { x: 2598, y: 6173, z: 2 }, handled: false };
  assert.equal(climbFloatingBooks(bookCrossing), true);
  assert.equal(bookCrossing.handled, true);
  assert.deepEqual(player.destination, [2606, 6173, 2]);
  const returnCrossing = { player, objectId: api.core.ObjectIdentifiers.FLOATING_BOOK + 1,
    location: { x: 2606, y: 6173, z: 2 }, handled: false };
  assert.equal(climbFloatingBooks(returnCrossing), true,
    'the far-end cache variant also routes back across the book handhold');
  assert.equal(returnCrossing.handled, true);
  assert.deepEqual(player.destination, [2598, 6173, 2]);
  custom.get('npc-dialogue:choice')({
    player, option: 'Yes please.', definition: { getName: () => 'Memory of Seren' },
  });
  assert.deepEqual(player.destination, [2623, 6144, 0],
    'the memory transport returns the player to the Grand Library entrance chamber');

  const useObject = objectInteractions.find((handler) => handler({
    player, objectId: api.core.ObjectIdentifiers.SEAL_OF_THE_FORGOTTEN,
  }) === true);
  assert.ok(useObject, 'the central seal interaction is registered');
  attributes.set('quest.song_of_the_elves.library-seals', 3);
  useObject({ player, objectId: api.core.ObjectIdentifiers.CRYSTAL_DISPENSER_3, handled: false });
  const useMirror = itemObjects.get('Hand mirror');
  const place = (x, y, direction, z = 0, overrideId = null) => {
    const objectId = overrideId ?? (x === 2609 && y === 6158
      ? 35222 : api.core.ObjectIdentifiers.PILLAR_OF_LIGHT_41);
    useMirror({
      player, itemId: api.core.ItemIdentifiers.HAND_MIRROR_2,
      objectId,
      location: { x, y, z }, handled: false,
    });
    let options = prompts.at(-1);
    let choice = options.findIndex((value) => value === `Reflect ${direction}`);
    if (choice === -1) {
      const more = options.findIndex((value) => value === 'More directions...');
      assert.notEqual(more, -1);
      options[more + 1]();
      options = prompts.at(-1);
      choice = options.findIndex((value) => value === `Reflect ${direction}`);
    }
    assert.notEqual(choice, -1);
    options[choice + 1]();
  };
  place(2609, 6158, 'east', 1);
  place(2623, 6158, 'south', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:0');
  assert.ok(messages.some((message) => message.includes('sequence has reset')));
  useObject({ player, objectId: api.core.ObjectIdentifiers.CRYSTAL_DISPENSER_3, handled: false });
  place(2609, 6158, 'east', 1);
  place(2623, 6159, 'down', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:0');
  assert.ok(messages.some((message) => message.includes('different pillar')));
  useObject({ player, objectId: api.core.ObjectIdentifiers.CRYSTAL_DISPENSER_3, handled: false });
  place(2609, 6158, 'east', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:1');
  place(2623, 6158, 'down', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:2');

  attributes.set('quest.song_of_the_elves.library-seals', 14);
  attributes.set('quest.song_of_the_elves.library-puzzle', '3:18');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2595,6186,0': { operation: 'S', direction: 'south', x: 2595, y: 6186, z: 0, step: 7 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2595, 6172, 'east', 0, 35259);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '3:19');

  attributes.set('quest.song_of_the_elves.library-seals', 62);
  attributes.set('quest.song_of_the_elves.library-puzzle', '5:14');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2581,6116,0': { operation: 'U', direction: 'up', x: 2581, y: 6116, z: 0, step: 13 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2581, 6130, 'north', 0);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '5:15',
    `Hefin’s blue beam branches north from the shared floor-zero pillar while the green beam rises: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-puzzle', '5:19');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2581,6130,2': { operation: 'W', direction: 'west', x: 2581, y: 6130, z: 2, step: 18 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2567, 6144, 'south', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '5:20',
    `Hefin’s final blue beam has its own north-west source: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-seals', 255);
  attributes.set('quest.song_of_the_elves.library-puzzle', '7:16');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2651,6200,1': { operation: 'S', direction: 'south', x: 2651, y: 6200, z: 1, step: 15 },
  }));
  amounts.set(api.core.ItemIdentifiers.MAGENTA_CRYSTAL_2, 1);
  itemObjects.get('Magenta crystal')({
    player, itemId: api.core.ItemIdentifiers.MAGENTA_CRYSTAL_2,
    objectId: api.core.ObjectIdentifiers.PILLAR_OF_LIGHT_41,
    location: { x: 2637, y: 6200, z: 1 }, handled: false,
  });
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '7:17',
    `Iorwerth’s magenta crystal follows the cyan beam beside mirror 12, independently of mirror 12’s south branch: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-puzzle', '7:30');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2665,6186,2': { operation: 'D', direction: 'down', x: 2665, y: 6186, z: 2, step: 29 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 2);
  place(2637, 6200, 'south', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '7:31',
    `Iorwerth’s final blue ray starts at the cache-mapped F7 pillar on floor two: ${messages.slice(-2).join(' | ')}`);
  place(2637, 6186, 'down', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '7:32',
    `Iorwerth’s final mirror sends the branch down toward the seal: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-seals', 127);
  attributes.set('quest.song_of_the_elves.library-puzzle', '6:6');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2581,6116,0': { operation: 'U', direction: 'up', x: 2581, y: 6116, z: 0, step: 5 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2581, 6116, 'north', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '6:7',
    `Trahaearn’s vertical beam travels through an unmirrored middle floor: ${messages.slice(-2).join(' | ')}`);
  const beforeReplay = messages.length;
  useObject({ player, objectId: 36726, handled: false });
  assert.ok(!messages.slice(beforeReplay).some((message) => message.includes('seal remains dark')),
    'touching a completed seal replays its memory so its return transport stays available');
});

test('Regicide tripwires use the Agility success roll and apply the dart hit and poison on failure', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  assert.equal(typeof interact, 'function');

  const location = { x: 2285, y: 3187, z: 0 };
  const object = { getFace: () => 3 };
  const createPlayer = (agility) => {
    const state = { moves: [], hits: [], poison: 0 };
    const position = { x: 2286, y: 3188, z: 0 };
    const player = {
      getLocation: () => ({ getX: () => position.x, getY: () => position.y, getZ: () => position.z }),
      getSkillManager: () => ({ getCurrentLevel: () => agility }),
      getCombat: () => ({
        getHitQueue: () => ({ addPendingDamage: (damage) => state.hits.push(damage) }),
        getPoisonImmunityTimer: () => ({ finished: () => true }),
      }),
      isPoisoned: () => false,
      setPoisonDamage: (amount) => { state.poison = amount; },
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
    };
    return { player, state };
  };
  const interactWith = (player) => ({
    player, object, objectId: api.core.ObjectIdentifiers.TRIPWIRE_3, clickType: 1,
    location, definition: { getActions: () => ['Step-over'] }, handled: false,
  });

  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const safe = createPlayer(99);
    const success = interactWith(safe.player);
    interact(success);
    assert.equal(success.handled, true);
    assert.deepEqual(safe.state.moves, [[2284, 3188, 0]], 'a successful westward crossing reaches the opposite side');

    Math.random = () => 0.12;
    const levelOne = createPlayer(1);
    const lowLevelSuccess = interactWith(levelOne.player);
    interact(lowLevelSuccess);
    assert.deepEqual(levelOne.state.moves, [[2284, 3188, 0]], 'the 31/256 level-one success rate is preserved');

    Math.random = () => 0.99;
    const caught = createPlayer(99);
    const failure = interactWith(caught.player);
    interact(failure);
    assert.equal(failure.handled, true);
    assert.equal(caught.state.hits[0][0].getDamage(), 10);
    assert.equal(caught.state.poison, 2);
    assert.deepEqual(caught.state.moves, [], 'a triggered tripwire leaves the player on the near side');
  } finally {
    Math.random = originalRandom;
  }
});

test('Regicide Huge Gate passes the player to the far side from either approach', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  const run = (sourceY, id, objectY) => {
    const attributes = new Map([['quest.regicide.stage', 13]]);
    const state = { moves: [], messages: [] };
    const position = { x: 2386, y: sourceY, z: 0 };
    const player = {
      getAttribute: (key) => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      getLocation: () => ({ getX: () => position.x, getY: () => position.y, getZ: () => position.z }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      sendMessage: (message) => state.messages.push(message),
    };
    const event = { player, objectId: id, location: { x: 2386, y: objectY, z: 0 }, sourceLocation: { x: 2386, y: sourceY, z: 0 }, handled: false };
    interact(event);
    assert.equal(event.handled, true);
    assert.match(state.messages[0], /guards recognise Lord Iorwerth's seal/);
    return state.moves;
  };
  assert.deepEqual(run(3335, api.core.ObjectIdentifiers.HUGE_GATE, 3334), [[2386, 3332, 0]], 'south approach crosses north');
  assert.deepEqual(run(3333, api.core.ObjectIdentifiers.HUGE_GATE_2, 3334), [[2386, 3336, 0]], 'north approach crosses south');
});

test('Regicide dense forest crossing checks Agility and clears the full rotated cache footprint', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const attributes = new Map([['quest.regicide.stage', 15]]);
  const state = { moves: [], messages: [] };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    getLocation: () => ({ getX: () => 2274, getY: () => 3191, getZ: () => 0 }),
    moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
    sendMessage: (message) => state.messages.push(message),
  };
  const event = {
    player,
    object: { getFace: () => 1 },
    objectId: api.core.ObjectIdentifiers.DENSE_FOREST,
    clickType: 1,
    location: { x: 2272, y: 3191, z: 0 },
    definition: { getSizeX: () => 3, getSizeY: () => 2 },
    handled: false,
  };
  objectHooks[0](event);
  assert.equal(event.handled, true);
  assert.deepEqual(state.moves, [[2271, 3191, 0]], 'crosses from the east edge to the west edge of the rotated 2×3 obstacle');
});

test('Regicide routes the Meilyr dense forest from outside its footprint in both directions', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const routeHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : prop === 'onObjectRoute'
        ? (handler) => routeHooks.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const forest = {
    getLocation: () => ({ getX: () => 2302, getY: () => 3214, getZ: () => 0 }),
    getFace: () => 0,
  };
  const route = (source) => {
    const event = {
      object: forest,
      objectId: api.core.ObjectIdentifiers.DENSE_FOREST,
      sourceLocation: source,
      destination: null,
    };
    routeHooks.at(-1)(event);
    return event.destination;
  };
  assert.deepEqual(route({ x: 2299, y: 3215, z: 0 }), { x: 2301, y: 3215, z: 0 });
  assert.deepEqual(route({ x: 2307, y: 3215, z: 0 }), { x: 2305, y: 3213, z: 0 });

  const attributes = new Map([['quest.regicide.stage', 15]]);
  const cross = (x, y) => {
    const state = { moves: [] };
    const player = {
      getAttribute: (key) => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      getSkillManager: () => ({ getCurrentLevel: () => 99 }),
      getLocation: () => ({ getX: () => x, getY: () => y, getZ: () => 0 }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      sendMessage() {},
    };
    objectHooks.at(-1)({
      player,
      object: forest,
      objectId: api.core.ObjectIdentifiers.DENSE_FOREST,
      location: { x: 2302, y: 3214, z: 0 },
      definition: { getSizeX: () => 3, getSizeY: () => 2 },
      handled: false,
    });
    return state.moves;
  };
  assert.deepEqual(cross(2301, 3215), [[2305, 3213, 0]], 'west-to-east lands beyond the full forest footprint');
  assert.deepEqual(cross(2305, 3213), [[2301, 3215, 0]], 'east-to-west lands west of the footprint');
});

test('Regicide keeps the approach side clear when routing to the Isafdar leaf trap', () => {
  const { api: base } = mockApi();
  const routeHooks = [];
  const leaves = new Set([
    '2273,3173', '2274,3173', '2275,3173',
    '2273,3174', '2274,3174', '2275,3174',
    '2273,3175', '2274,3175', '2275,3175',
  ]);
  const core = { ...base.core };
  core.ObjectManager = {
    objectsAt: (location) => leaves.has(`${location.getX()},${location.getY()}`)
      ? [{ getId: () => core.ObjectIdentifiers.LEAVES }]
      : [],
  };
  core.MapObjects = { mapObjects: new Map(), getHash: () => 0 };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core'
      ? core
      : prop === 'onObjectRoute'
        ? (handler) => routeHooks.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const event = {
    objectId: core.ObjectIdentifiers.LEAVES,
    object: { getLocation: () => ({ getX: () => 2273, getY: () => 3175, getZ: () => 0 }) },
    sourceLocation: { x: 2274, y: 3176, z: 0 },
    destination: null,
  };
  routeHooks.at(-1)(event);
  assert.deepEqual(event.destination, { x: 2274, y: 3176, z: 0 }, 'north approach remains outside the whole 3×3 trap');
});

test('Regicide supports both cache Log balance endpoints on the Isafdar bridge', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  const run = (objectX, sourceX) => {
    const state = { moves: [], animations: [] };
    const player = {
      getLocation: () => ({ getX: () => sourceX, getY: () => 3250, getZ: () => 0 }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      performAnimation: (animation) => state.animations.push(animation.getId()),
    };
    const event = {
      player, objectId: api.core.ObjectIdentifiers.LOG_BALANCE_10, option: 'Cross',
      location: { x: objectX, y: 3250, z: 0 }, sourceLocation: { x: sourceX, y: 3250, z: 0 }, handled: false,
    };
    interact(event);
    assert.equal(event.handled, true);
    assert.deepEqual(state.animations, [762]);
    return state.moves;
  };
  assert.deepEqual(run(2259, 2258), [[2259, 3250, 0]], 'western endpoint steps onto the balance');
  assert.deepEqual(run(2259, 2260), [[2258, 3250, 0]], 'western endpoint returns to the west bank');
  assert.deepEqual(run(2263, 2262), [[2264, 3250, 0]], 'eastern endpoint steps onto the east bank');
  assert.deepEqual(run(2263, 2264), [[2262, 3250, 0]], 'eastern endpoint returns to the balance');
  const unrelated = { player: {}, objectId: api.core.ObjectIdentifiers.LOG_BALANCE_10,
    option: 'Cross', location: { x: 2259, y: 3251, z: 0 }, handled: false };
  interact(unrelated);
  assert.equal(unrelated.handled, false, 'the handler is limited to the verified bridge placements');
});

test('Regicide leaves completed Well of Voyage crossings to the shared loc route', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const attributes = new Map([['quest.regicide.stage', 15]]);
  const moves = [];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => 2340, getY: () => 9623, getZ: () => 0 }),
    moveTo: (destination) => moves.push([destination.getX(), destination.getY(), destination.getZ()]),
    sendMessage() {},
  };
  const event = {
    player,
    objectId: api.core.ObjectIdentifiers.WELL_9,
    location: { x: 2341, y: 9622, z: 0 },
    handled: false,
  };

  for (const handler of handlers.objects) handler(event);

  assert.equal(event.handled, false, 'the native Well of Voyage route can handle the completed-quest traversal');
  assert.deepEqual(moves, []);
});

test('completed Underground Pass leaves Iban temple doors to normal door handling', () => {
  const { api, handlers, quest, player } = questScene('UndergroundPass');
  quest.setStage(player, 10);
  const event = { player, objectId: api.core.ObjectIdentifiers.DOOR_109, handled: false };

  handlers.custom.get('door:toggle').forEach((handler) => handler(event));

  assert.equal(event.handled, false, 'completed players do not need the unsaved history bit');
});

test('Regicide leaf and stick traps use Agility checks and cross from the approached side', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const leaves = new Set();
  for (let x = 2273; x <= 2275; x++) for (let y = 3173; y <= 3175; y++) leaves.add(`${x},${y}`);
  const core = { ...base.core, ObjectManager: { objectsAt: (location) =>
    leaves.has(`${location.getX()},${location.getY()}`) ? [{ getId: () => 3923 }] : [] } };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core : prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  const createPlayer = (agility, position) => {
    const state = { moves: [], hits: [] };
    const player = {
      getLocation: () => ({ getX: () => position.x, getY: () => position.y, getZ: () => 0 }),
      getSkillManager: () => ({ getCurrentLevel: () => agility }),
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => state.hits.push(hits) }) }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      sendMessage() {},
    };
    return { player, state };
  };
  const event = (player, objectId, option, location, sourceLocation) => ({ player, objectId,
    clickType: 1, location, sourceLocation, definition: { getActions: () => [option] }, handled: false });
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const leafRunner = createPlayer(99, { x: 2274, y: 3176 });
    const leafCrossing = event(leafRunner.player, 3923, 'Jump', { x: 2274, y: 3175, z: 0 }, { x: 2274, y: 3176, z: 0 });
    interact(leafCrossing);
    assert.equal(leafCrossing.handled, true);
    assert.deepEqual(leafRunner.state.moves, [[2274, 3172, 0]], 'the full 3×3 leaf pit is crossed southward');

    Math.random = () => 0.99;
    const stickRunner = createPlayer(99, { x: 2301, y: 3190 });
    const stickCrossing = event(stickRunner.player, 3922, 'Pass', { x: 2300, y: 3190, z: 0 }, { x: 2301, y: 3190, z: 0 });
    interact(stickCrossing);
    assert.equal(stickCrossing.handled, true);
    assert.equal(stickRunner.state.hits[0][0].getDamage(), 8);
    assert.deepEqual(stickRunner.state.moves, [[2302, 3190, 0]], 'a failed stick pass knocks the player back');
  } finally {
    Math.random = originalRandom;
  }
});

test("Mourning's End I last teleport crystal charge becomes a saveable seed", () => {
  const { api: base } = mockApi();
  const itemActions = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemAction'
      ? (name, actions) => itemActions.set(name, actions)
      : target[prop],
  });
  require('../plugins/quests/quests/MourningsEndPartI.Quest')(api);
  const items = new Map([[6102, 1]]);
  const moved = [];
  const messages = [];
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    deleteNumber(id, amount) {
      const left = (items.get(id) ?? 0) - amount;
      if (left > 0) items.set(id, left); else items.delete(id);
      return true;
    },
    adds(id, amount) { items.set(id, (items.get(id) ?? 0) + amount); return true; },
  };
  const player = {
    getInventory: () => inventory,
    moveTo: (location) => moved.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage: (message) => messages.push(message),
  };
  const event = { player, itemId: 6102, handled: false };
  itemActions.get('Teleport crystal (1)').Lletya(event);
  assert.equal(event.handled, true);
  assert.equal(items.get(6102), undefined);
  assert.equal(items.get(6103), 1);
  assert.equal(items.has(undefined), false, 'a depleted crystal must not add an undefined item id');
  assert.ok([...items.keys()].every(Number.isFinite));
  assert.deepEqual(moved, [[2352, 3170, 0]]);
  assert.equal(messages.length, 1);
});

function questScene(name) {
  const { api, handlers } = mockApi();
  require(`../plugins/quests/quests/${name}.Quest`)(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const attributes = new Map();
  const items = new Map();
  const messages = [];
  let location;
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    isFull: () => false,
    adds: (id, amount) => items.set(id, inventory.getAmount(id) + amount),
    deleteNumber: (id, amount) => items.set(id, inventory.getAmount(id) - amount),
  };
  const sender = new Proxy({}, { get: () => () => sender });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => sender,
    getLocation: () => location,
    moveTo: (tile) => { location = tile; },
    sendMessage: (text) => messages.push(text),
  };
  const tile = (x, y, z = 0) => new api.core.Location(x, y, z);
  return { api, handlers, quest, player, items, messages, tile };
}

test('manor front doors close after entry and the back door crosses both ways', () => {
  const { api, handlers, player, tile, messages } = questScene('ErnestTheChicken');
  const { ObjectIdentifiers: O, GameObject } = api.core;
  const open = (id, x, y, face, from) => {
    player.moveTo(from);
    const object = new GameObject(id, tile(x, y), 0, face);
    const route = { player, object, objectId: id, sourceLocation: { x: from.getX(), y: from.getY(), z: 0 } };
    handlers.route.forEach((h) => h(route));
    assert.ok(route.destination);
    player.moveTo(tile(route.destination.x, route.destination.y));
    const event = { player, object, objectId: id, location: { x, y, z: 0 }, clickType: 1,
      definition: { getInteractions: () => ['Open'] } };
    handlers.custom.get('door:toggle').forEach((h) => h(event));
    if (!event.handled) handlers.object.forEach((h) => h(event));
    assert.equal(event.handled, true);
    return [player.getLocation().getX(), player.getLocation().getY()];
  };
  for (const [id, x] of [[O.LARGE_DOOR_5, 3108], [O.LARGE_DOOR_6, 3109]]) {
    assert.deepEqual(open(id, x, 3353, 1, tile(x, 3353)), [x, 3354]);
    assert.match(messages.at(-1), /slam shut/);
    assert.deepEqual(open(id, x, 3353, 1, tile(x, 3354)), [x, 3354]);
    assert.match(messages.at(-1), /another way out/);
  }
  assert.deepEqual(open(O.DOOR_15, 3123, 3361, 3, tile(3123, 3360)), [3123, 3362]);
  assert.deepEqual(open(O.DOOR_15, 3123, 3361, 3, tile(3123, 3361)), [3123, 3360]);
});

test('fortress sturdy doors and secret walls can be crossed and recrossed from their own tile', () => {
  const { api, handlers, quest, player, tile } = questScene('BlackKnightsFortress');
  const { ObjectIdentifiers: O, GameObject } = api.core;
  for (const stage of [1, 2, 3]) {
    quest.setStage(player, stage);
    for (const [id, x, y, face, option] of [
      [O.STURDY_DOOR_2, 3025, 3511, 2, 'Open'],
      [O.WALL_8, 3016, 3517, 3, 'Push'],
      [O.WALL_8, 3030, 3510, 3, 'Push'],
    ]) {
      const object = new GameObject(id, tile(x, y, 1), 0, face);
      const axis = face === 2 ? 'x' : 'y';
      for (const side of [-1, 0, 1]) {
        const from = { x, y, z: 1, [axis]: (axis === 'x' ? x : y) + side };
        player.moveTo(tile(from.x, from.y, from.z));
        const route = { player, object, objectId: id, sourceLocation: from };
        handlers.route.forEach((h) => h(route));
        player.moveTo(tile(route.destination.x, route.destination.y, 1));
        const event = { player, object, objectId: id, location: { x, y, z: 1 }, clickType: 1,
          definition: { getInteractions: () => [option] } };
        handlers.object.forEach((h) => h(event));
        const direction = side || (face === 2 ? -1 : 1);
        assert.equal(player.getLocation()[axis === 'x' ? 'getX' : 'getY'](), (axis === 'x' ? x : y) - direction);
        assert.equal(event.handled, true);
      }
    }
  }
});

test('Prince Ali key print and bronze bar go to Osman, then Leela gives the key', () => {
  const { api, handlers, quest, player, items } = questScene('PrinceAliRescue');
  const { ItemIdentifiers: I, NpcIdentifiers: N } = api.core;
  quest.setStage(player, 20);
  items.set(I.KEY_PRINT, 1);
  const give = () => handlers.itemOnNpc.forEach((h) => h({ player, npcId: N.OSMAN_9, itemId: I.KEY_PRINT }));
  give();
  assert.equal(items.get(I.KEY_PRINT), 1, 'missing bronze must not consume the print');
  assert.equal(quest.getStage(player), 20);
  items.set(I.BRONZE_BAR, 1);
  give();
  assert.equal(quest.getStage(player), 21);
  assert.equal(items.get(I.KEY_PRINT), 0);
  assert.equal(items.get(I.BRONZE_BAR), 0);
  assert.match(quest.buildJournal(player, quest).join('\n'), /collect the bronze key from.*Leela/);
  const event = { player, npcId: N.LEELA, stepId: 'NVdPNU' };
  handlers.custom.get('npc-dialogue:action').forEach((h) => h(event));
  assert.equal(quest.getStage(player), 22);
  assert.equal(items.get(I.BRONZE_KEY), 1);
  handlers.custom.get('npc-dialogue:action').forEach((h) => h(event));
  assert.equal(items.get(I.BRONZE_KEY), 1, 'replaying the handoff must not duplicate the key');
});
function bloodBridgeFixture() {
 const {api}=mockApi(),attrs=new Map(),items=new Map(),eq=[];let tick=0,progress=70,allowed=true,free=28;const scenes=[];
 api.core={...api.core,World:{getProcessCycle:()=>tick},PrivateArea:class{enter(m){m.area=this;}leave(m,logout){this.postLeave(m,logout);m.area=null;}postLeave(){}}};
 const player={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),getInventory:()=>({contains:id=>items.has(id),getFreeSlots:()=>free,adds:(id,n)=>items.set(id,n)}),getEquipment:()=>({contains:id=>eq.some(i=>i?.getId()===id),getItems:()=>eq}),getCombat:()=>({reset(){}}),moveTo:l=>player.position=l,sendMessage(){},getDialogueManager:()=>({isActive:()=>false})};
 api.spawnNpc=spec=>({getOwner:()=>spec.owner,getHitpoints:()=>1,setMaxHitpoints(){return this;},setHitpoints(){return this;},setScriptedMovement(){},getMovementQueue:()=>({setBlockMovement(){}})});api.removeNpc=()=>{};
 const f=require('../plugins/quests/bmr/Bridge.TheBloodMoonRises')({api,stage:()=>progress,attribute:'bridge',ready:()=>allowed,play:(...args)=>scenes.push(args)});
 return {api,player,f,attrs,items,eq,scenes,advance:n=>tick+=n,setStage:n=>progress=n,setReady:v=>allowed=v,setFree:v=>free=v};
}

test('bridge handoff checks quest readiness and inventory before creating the encounter',()=>{
 const t=bloodBridgeFixture();t.setStage(60);assert.equal(t.f.start(t.player),false);t.setStage(70);t.setReady(false);assert.equal(t.f.start(t.player),false);t.setReady(true);t.setFree(1);assert.equal(t.f.start(t.player),false);assert.equal(t.items.size,0);assert.equal(t.attrs.size,0);
 t.setFree(2);assert.equal(t.f.start(t.player),true);assert.equal(t.items.get(t.api.core.ItemIdentifiers.SILVTHRILL_BALLISTA),1);assert.equal(t.items.get(t.api.core.ItemIdentifiers.SILVTHRILL_JAVELIN),100);assert.equal(t.f.start(t.player),false);
});

test('bridge portals require the owned silvthrill ranged hit; passive defence retries',()=>{
 const t=bloodBridgeFixture();t.f.start(t.player);const area=t.f.sessions.get(t.player);t.advance(5);area.process(t.player);const npc=[...area.cast][0];let damage=42,type=t.api.core.CombatType.RANGED;
 const hit={getAttacker:()=>t.player,getCombatType:()=>type,setTotalDamage:n=>damage=n};t.f.hit({npc,hit});assert.equal(damage,0);
 t.eq[t.api.core.Equipment.WEAPON_SLOT]=new t.api.core.Item(t.api.core.ItemIdentifiers.SILVTHRILL_BALLISTA);t.f.hit({npc,hit});assert.equal(damage,1);type=t.api.core.CombatType.MAGIC;t.f.hit({npc,hit});assert.equal(damage,0);
 const event={target:npc,attacker:t.player};t.f.roll(event);assert.equal(event.forceAccurate,true);
 t.attrs.set('bridge',{phase:'bridge',integrity:60,shots:0});area.process(t.player);assert.equal(t.attrs.get('bridge').integrity,100);assert.equal(t.scenes.length,0);
});

test('bridge qualification falls back only at zero and portal kills cannot count twice',()=>{
 const t=bloodBridgeFixture();t.f.start(t.player);const area=t.f.sessions.get(t.player);
 for(let i=0;i<3;i++){t.advance(10);area.process(t.player);const npc=[...area.cast][0];t.f.death({npc,killer:t.player});t.f.death({npc,killer:t.player});}
 assert.equal(t.attrs.get('bridge').shots,3);t.attrs.get('bridge').integrity=60;area.process(t.player);assert.equal(t.attrs.get('bridge').qualified,true);assert.equal(t.scenes.length,0);t.attrs.get('bridge').integrity=0;area.process(t.player);assert.equal(t.scenes.length,1);assert.equal(t.scenes[0][2],'drakan-s-siege-upon-reaching-0-defender-integrity');assert.equal(t.f.finish(t.player),true);assert.equal(t.f.sessions.has(t.player),false);assert.deepEqual([t.player.position.getX(),t.player.position.getY(),t.player.position.getZ()],[3168,7855,1]);
});

test('silvthrill ballista uses its actual javelins through the shared ranged checks',()=>{
 const {RangedWeapon,Ammunition}=require('../dist/game/content/combat/ranged/RangedData');const {Item,Equipment,ItemIdentifiers:I}=PluginManager.getCoreApi(),eq=[];eq[Equipment.WEAPON_SLOT]=new Item(I.SILVTHRILL_BALLISTA);eq[Equipment.AMMUNITION_SLOT]=new Item(I.SILVTHRILL_JAVELIN,100);const p={getEquipment:()=>({getItems:()=>eq})};
 assert.deepEqual(RangedWeapon.getFor(p).getAmmunitionData(),[Ammunition.getFor(p)]);assert.equal(Ammunition.getFor(p).getItemId(),I.SILVTHRILL_JAVELIN);
});

test('Blood Moon palace spawns usable preparation NPCs once and removes them on departure',()=>{
 const {api}=mockApi(),cast=[],removed=[],attrs=new Map();let progress=60;
 api.spawnNpc=spec=>{const npc={...spec,transformed:spec.id,getId:()=>spec.id,setScriptedMovement(){},getMovementQueue:()=>({setBlockMovement(){}}),setNpcTransformationId(id){npc.transformed=id;}};cast.push(npc);return npc;};api.removeNpc=n=>removed.push(n);
 const player={getAttribute:k=>attrs.get(k)};const f=require('../plugins/quests/bmr/Palace.TheBloodMoonRises')({api,stage:()=>progress,preparationAttribute:'prep'});
 f.sync(player);f.sync(player);assert.equal(cast.length,4);assert.ok(cast.every(n=>n.owner===player&&n.ownerOnly&&n.z===1));assert.deepEqual(cast.map(n=>[n.x,n.y]),[[3157,7841],[3157,7839],[3175,7834],[3168,7828]]);
 attrs.set('prep',{stewFed:true});f.sync(player);assert.equal(cast[0].transformed,api.core.NpcIdentifiers.SAFALAAN_HALLOW_12);progress=70;f.sync(player);assert.equal(removed.length,4);assert.equal(f.residents.has(player),false);
});

test('bridge uses the actual cache palace exit and lets a full-inventory handoff retry',()=>{
 const t=bloodBridgeFixture();t.setFree(0);assert.equal(t.f.start(t.player),false);t.setFree(2);assert.equal(t.f.doors({player:t.player,objectId:t.api.core.ObjectIdentifiers.DOORS_46,location:{x:3167,y:7860,z:1}}),true);assert.ok(t.f.sessions.has(t.player));
});

test('Blood Moon native bitfield mapping reveals preparations and survives relog without changing quest stage',()=>{
 const {api}=mockApi();require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);const runtime=require('../plugins/quests/QuestRuntime'),quest=runtime.getRegisteredQuests().filter(q=>q.key==='the_blood_moon_rises').at(-1),attrs=new Map(),bits=new Map();const sender=new Proxy({}, {get:(_,key)=>key==='sendVarbit'?(id,n)=>bits.set(id,n):()=>sender});const player={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),getPacketSender:()=>sender};
 quest.setStage(player,60);assert.equal(quest.getStage(player),60);assert.equal(bits.get(15464),102);bits.clear();runtime.sendQuestVarps({player});assert.equal(bits.get(15464),102);quest.setStage(player,70);assert.equal(bits.get(15464),116);quest.setStage(player,110);assert.equal(bits.get(15464),176);assert.equal(quest.isComplete(player),true);
});

test('Blood Moon preparation exit allows gathering leaves before the defence is ready',()=>{
 const t=bloodBridgeFixture();t.setStage(60);t.setReady(false);assert.equal(t.f.doors({player:t.player,objectId:t.api.core.ObjectIdentifiers.DOORS_46,location:{x:3167,y:7860,z:1}}),true);assert.deepEqual([t.player.position.getX(),t.player.position.getY(),t.player.position.getZ()],[2975,7683,0]);assert.equal(t.scenes.length,0);
});
