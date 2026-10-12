// Run after `yarn build`: node --test tests/quest-plugins.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { PluginManager } = require('../dist/plugins/PluginManager');

// A stand-in for the live PluginApi: real core, every hook a no-op. Quests must
// register cleanly through it and hand back their variant/condition resolvers.
function mockApi() {
  const handlers = {
    variant: [],
    condition: [],
    custom: new Map(),
    object: [],
    route: [],
    itemOnNpc: [],
  };
  const noop = () => {};
  const base = {
    core: PluginManager.getCoreApi(),
    onNpcDialogueVariant: (h) => handlers.variant.push(h),
    onNpcDialogueCondition: (h) => handlers.condition.push(h),
    onCustomEvent: (name, h) => {
      const list = handlers.custom.get(name) ?? [];
      list.push(h);
      handlers.custom.set(name, list);
    },
    persistAttribute: noop,
    onObjectInteraction: (handler) => { if (typeof handler === 'function') handlers.object.push(handler); },
    onObjectRoute: (handler) => handlers.route.push(handler),
    onItemOnNpc: (handler) => handlers.itemOnNpc.push(handler),
  };
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return noop;
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
