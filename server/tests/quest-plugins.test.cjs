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

test('Dragon Slayer II reforging requires three distinct dragon-head casts and consumes the right runes', () => {
  const spells = [];
  const objectInteractions = [];
  const { api: base } = mockApi();
  const core = Object.assign({}, base.core, {
    CacheDefinitions: { getSpellName: () => 'Fire Wave' },
  });
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'core') return core;
      if (prop === 'onSpellOnObject') return (handler) => spells.push(handler);
      if (prop === 'onObjectInteraction') return (handler) => objectInteractions.push(handler);
      return target[prop];
    },
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 7]]);
  const counts = new Map([
    [core.ItemIdentifiers.DRAGON_KEY_PIECE, 1], [core.ItemIdentifiers.DRAGON_KEY_PIECE_2, 1],
    [core.ItemIdentifiers.DRAGON_KEY_PIECE_3, 1], [core.ItemIdentifiers.DRAGON_KEY_PIECE_4, 1],
    [core.ItemIdentifiers.ANCIENT_KEY, 1], [core.ItemIdentifiers.HAMMER, 1],
    [core.ItemIdentifiers.FIRE_RUNE, 21], [core.ItemIdentifiers.AIR_RUNE, 15],
    [core.ItemIdentifiers.BLOOD_RUNE, 3],
  ]);
  const packet = new Proxy({}, { get: (_target, key) => (..._args) => packet });
  const player = {
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => counts.get(id) ?? 0,
      deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
      adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      getFreeSlots: () => 20,
    }),
    getPacketSender: () => packet,
    sendMessage: () => {},
  };
  const cast = (objectId, x, y) => {
    const event = { player, objectId, location: { x, y, z: 1 }, spellWidget: 1, spellItemId: 0 };
    spells[0](event);
    return event;
  };
  cast(core.ObjectIdentifiers.DRAGON_HEAD_2, 1616, 5284);
  cast(core.ObjectIdentifiers.DRAGON_HEAD_3, 1622, 5279);
  assert.equal(attrs.get('dragon-slayer-ii:forge-heads') ?? 0, 3, 'two distinct heads only set two bits');
  const wrongHead = cast(core.ObjectIdentifiers.DRAGON_HEAD_3, 1744, 5284);
  assert.equal(wrongHead.handled, true, 'the spell interaction is consumed');
  assert.equal(counts.get(core.ItemIdentifiers.FIRE_RUNE), 7, 'wrong room head does not charge runes');
  cast(core.ObjectIdentifiers.DRAGON_HEAD_3, 1626, 5284);
  assert.equal(attrs.get('dragon-slayer-ii:forge-heads'), 7, 'the third distinct head lights the forge');
  assert.equal(counts.get(core.ItemIdentifiers.FIRE_RUNE), 0);
  assert.equal(counts.get(core.ItemIdentifiers.AIR_RUNE), 0);
  assert.equal(counts.get(core.ItemIdentifiers.BLOOD_RUNE), 0);
  objectInteractions[0]({ player, objectId: core.ObjectIdentifiers.ANVIL });
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 8, 'anvil advances only after the forge is lit');
  assert.equal(counts.get(core.ItemIdentifiers.DRAGON_KEY), 1);
  assert.equal(counts.get(core.ItemIdentifiers.ANCIENT_KEY), 0);
  assert.equal(counts.get(core.ItemIdentifiers.DRAGON_KEY_PIECE_4), 0);
});

test('Desert Treasure II requires and solves the real eight-cell golem grid', () => {
  const itemOnObject = [];
  const interactions = [];
  const widgetActions = [];
  const dialogueActions = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onItemOnObject') return (handler) => itemOnObject.push(handler);
      if (prop === 'onNpcInteraction') return (name, options) => interactions.push({ name, options });
      if (prop === 'onCustomEvent') return (name, handler) => {
        if (name === 'player:widget-action') widgetActions.push(handler);
        if (name === 'npc-dialogue:action') dialogueActions.push(handler);
      };
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, ObjectIdentifiers: O } = api.core;
    const attrs = new Map();
    const counts = new Map([[I.UNCHARGED_CELL_2, 8]]);
    const packetCalls = [];
    const packet = new Proxy({}, { get: (_target, name) => (...args) => packetCalls.push([name, ...args]) });
    const messages = [];
    const damages = [];
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }),
      getPacketSender: () => packet, sendMessage: (message) => messages.push(message),
      setEnteredSyntaxAction(action) { this.syntaxAction = action; },
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => damages.push(...hits) }) }),
    };
    quest.setStage(player, 6);
    attrs.set('desert-treasure-ii:golem-inspected', true);
    attrs.set('desert-treasure-ii:altar-inspected', true);
    attrs.set('desert-treasure-ii:totems-charged', true);
    attrs.set('desert-treasure-ii:war-room', {
      getBaseX: () => 8192, getBaseY: () => 1600, isDestroyed: () => false,
    });
    const altar = { x: 8205, y: 1618, z: 0 };
    const golem = { x: 8215, y: 1620, z: 0 };
    const apply = (itemId, objectId, location) => itemOnObject[0]({ player, itemId, objectId, location });
    for (let i = 0; i < 7; i++) apply(I.UNCHARGED_CELL_2, O.ALTAR_93, altar);
    assert.equal(counts.get(I.UNCHARGED_CELL_2), 1);
    assert.equal(counts.get(I.CHARGED_CELL), 7);
    apply(I.CHARGED_CELL, O.GOLEM, golem);
    assert.equal(counts.get(I.CHARGED_CELL), 7, 'the grid cannot be started with fewer than eight cells');
    apply(I.UNCHARGED_CELL_2, O.ALTAR_93, altar);
    assert.equal(counts.get(I.CHARGED_CELL), 8);
    apply(I.CHARGED_CELL, O.GOLEM, golem);
    assert.equal(counts.get(I.CHARGED_CELL), 0);
    assert.equal(attrs.get('desert-treasure-ii:cells-inserted'), true);
    dialogueActions[0]({ player, stepId: 'EDEdng' });
    assert.equal(attrs.get('desert-treasure-ii:cells-inserted'), true);
    assert.ok(packetCalls.some(([name, id]) => name === 'sendInterface' && id === 838));
    let positions = attrs.get('desert-treasure-ii:cell-positions');
    const solution = [16, 10, 27, 33, 52, 5, 62, 47];
    const groupWidget = (838 << 16) | 32;
    const wrongPowerOn = { player, packet: { type: 'widget_action', groupId: 838, childId: 4, option: 'Power-on' }, handled: false };
    widgetActions[0](wrongPowerOn);
    assert.equal(wrongPowerOn.handled, true);
    assert.equal(damages.length, 1, 'a wrong arrangement shocks the player instead of advancing the quest');
    for (let cell = 0; cell < 8; cell++) {
      let current = attrs.get('desert-treasure-ii:cell-positions');
      const target = solution[cell];
      if (current.includes(target)) {
        const empty = Array.from({ length: 64 }, (_, i) => i).find((i) => !current.includes(i));
        widgetActions[0]({ player, packet: { type: 'widget_drag', sourceWidgetId: groupWidget, targetWidgetId: groupWidget, sourceSlot: target, targetSlot: empty }, handled: false });
        current = attrs.get('desert-treasure-ii:cell-positions');
      }
      const source = current[cell];
      widgetActions[0]({ player, packet: { type: 'widget_drag', sourceWidgetId: groupWidget, targetWidgetId: groupWidget, sourceSlot: source, targetSlot: target }, handled: false });
    }
    positions = attrs.get('desert-treasure-ii:cell-positions');
    assert.deepEqual(positions, solution);
    const powerOn = { player, packet: { type: 'widget_action', groupId: 838, childId: 4, option: 'Power-on' }, handled: false };
    widgetActions[0](powerOn);
    assert.equal(powerOn.handled, true);
    assert.equal(attrs.get('desert-treasure-ii:golem-solved'), true);
    assert.equal(quest.getStage(player), 6, 'solving the grid opens the next search stage, rather than skipping straight to a boss');
    assert.ok(player.syntaxAction);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II starts the Vardorvis trail through Elissa, Barus, the botanist note and potion', () => {
  const npcInteractions = [];
  const objectInteractions = [];
  const itemActions = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => npcInteractions.push({ name, options });
      if (prop === 'onObjectInteraction') return (handler) => objectInteractions.push(handler);
      if (prop === 'onItemAction') return (handler) => itemActions.push(handler);
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, ObjectIdentifiers: O } = api.core;
    const attrs = new Map();
    const noteId = I.POTION_NOTE;
    const potionId = I.STRANGE_POTION_3;
    assert.equal(noteId, 28382, 'the note uses the cache item id');
    assert.equal(potionId, 28383, 'the potion uses the cache item id');
    const counts = new Map([[potionId, 1]]);
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; },
      sendMessage() {},
    };
    quest.setStage(player, 7);
    const talkTo = (name) => npcInteractions.find((entry) => entry.name === name).options['Talk-to']({ player, npcId: 1 });
    talkTo('Elissa');
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 1);
    talkTo('Barus');
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 2);
    const searchDesk = objectInteractions[0]({ player, objectId: 49490, location: { x: 1781, y: 3619, z: 0 } });
    assert.equal(searchDesk, true);
    assert.equal(counts.get(noteId), 1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 3);
    assert.equal(itemActions[0]({ player, itemId: potionId, option: 'Drink' }), true);
    assert.equal(counts.get(potionId), 1, 'the potion cannot be used before reading the note');
    itemActions[0]({ player, itemId: noteId, option: 'Read' });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 4);
    itemActions[0]({ player, itemId: potionId, option: 'Drink' });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 5);
    assert.equal(counts.get(potionId), 0);
    const boat = objectInteractions[0]({ player, objectId: 49491, location: { x: 1227, y: 3469, z: 0 } });
    assert.equal(boat, true);
    assert.deepEqual([player.location.getX(), player.location.getY(), player.location.getZ()], [1196, 3450, 0]);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 6);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II requires Kasonde dialogue and the full 400-tick hideout defence', () => {
  const { api: base } = mockApi();
  const interactions = [], objectHooks = [], chunks = [];
  let cycle = 0;
  const queues = { add: [], remove: [] };
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    GameObject: class TestGameObject {
      constructor(id, location, type, face, privateArea) { Object.assign(this, { id, location, type, face, privateArea }); }
      getId() { return this.id; }
      getLocation() { return this.location; }
    },
    NPC: { create: (id, location) => ({
      id, location, setOwner() {}, setOwnerOnly() {}, setMaxHitpoints() {}, setHitpoints(value) { this.hp = value; },
      getHitpoints() { return this.hp ?? 10; }, isRegistered() { return true; }, getCombat() { return { attack() {} }; },
    }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove, getProcessCycle: () => cycle++ },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 5]]);
    const messages = [];
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-defence-test', getAsPlayer() { return this; }, isPlayer: () => true,
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage: (message) => messages.push(message),
    };
    quest.setStage(p, 7);
    assert.equal(objectHooks[0]({ player: p, objectId: 49491, location: { x: 1227, y: 3469, z: 0 } }), true);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 6);
    const kasonde = interactions.find((entry) => entry.name === 'Kasonde').options['Talk-to'];
    kasonde({ player: p, npcId: core.NpcIdentifiers.KASONDE });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 7);
    kasonde({ player: p, npcId: core.NpcIdentifiers.KASONDE });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 8);
    assert.equal(objectHooks[0]({ player: p, objectId: core.ObjectIdentifiers.ENTRY_20, location: { x: 1191, y: 3411, z: 0 } }), true);
    const area = attrs.get('desert-treasure-ii:stranglewood-hideout');
    assert.equal(area.width, 7);
    assert.equal(area.height, 5);
    assert.deepEqual([p.location.x, p.location.y], [8223, 1620]);
    assert.equal(chunks.filter(([plane, , , chunk]) => plane === 0 && chunk !== null).length, 35);
    for (let tick = 0; tick < 399; tick++) area.process(p);
    assert.equal(area.defended, undefined, 'the horde defence cannot be skipped by a short wait');
    area.process(p);
    assert.equal(area.defended, true, 'Kasonde survives the documented 400-tick holdout');
    assert.equal(objectHooks[0]({ player: p, objectId: core.ObjectIdentifiers.LADDER_439, location: area.tile(27, 24, 0) }), true);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 9);
    assert.deepEqual([p.location.getX(), p.location.getY(), p.location.getZ()], [1187, 3411, 0]);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II makes the Strangler serum with the two real ingredients and requires Kasonde dialogue', () => {
  const { api: base } = mockApi();
  let combine, itemAction;
  const interactions = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemOnItem' ? (handler) => { combine = handler; }
      : prop === 'onItemAction' ? (handler) => { itemAction = handler; }
        : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, NpcIdentifiers: N } = api.core;
    const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 14]]);
    const counts = new Map([[I.UNFINISHED_SERUM, 1], [I.KORBAL_HERB, 1], [I.ARGIAN_BERRIES, 1]]);
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }), getPacketSender: () => new Proxy({}, { get: () => () => {} }), sendMessage() {},
    };
    quest.setStage(p, 7);
    assert.equal(combine({ player: p, usedItemId: I.UNFINISHED_SERUM, usedWithItemId: I.KORBAL_HERB }), true);
    assert.equal(counts.get(I.UNFINISHED_SERUM_2), 1);
    assert.equal(combine({ player: p, usedItemId: I.UNFINISHED_SERUM_2, usedWithItemId: I.ARGIAN_BERRIES }), true);
    assert.equal(counts.get(I.STRANGLER_SERUM), 1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 15);
    assert.equal(itemAction({ player: p, itemId: I.STRANGLER_SERUM, option: 'Drink' }), undefined,
      'Kasonde must explain the completed serum before it can be drunk');
    interactions.find((entry) => entry.name === 'Kasonde').options['Talk-to']({ player: p, npcId: N.KASONDE });
    assert.equal(attrs.get('desert-treasure-ii:kasonde-serum-discussed'), true);
    assert.equal(itemAction({ player: p, itemId: I.STRANGLER_SERUM, option: 'Drink' }), true);
    assert.equal(counts.get(I.STRANGLER_SERUM), 0);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 16);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II requires both Stranglewood ingredients and defeating temple Strangled before Kasonde gives serum', () => {
  const { api: base } = mockApi();
  const objectHooks = [], deathHooks = [], interactions = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const queues = { add: [], remove: [] };
  const core = {
    ...base.core, TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({
      id, location, setOwner() {}, setOwnerOnly() {}, getRealId() { return this.id; },
      isNpc() { return true; }, getAsNpc() { return this; },
    }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
            : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, ObjectIdentifiers: O, NpcIdentifiers: N } = core;
    const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 11]]);
    const counts = new Map();
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-temple-test', moveTo(location) { this.location = location; },
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }), sendMessage() {},
    };
    quest.setStage(p, 7);
    const interact = (objectId, x, y) => objectHooks[0]({ player: p, objectId, location: { x, y, z: 0 } });
    assert.equal(interact(O.ENTRY_21, 1174, 3428), undefined, 'the temple refuses entry before both ingredients are found');
    interact(O.KORBAL_HERBS, 1155, 3447);
    assert.equal(counts.get(I.KORBAL_HERB), 1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 11);
    interact(O.ARGIAN_BUSH, 1126, 3323);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 12);
    assert.equal(interact(O.ENTRY_21, 1174, 3428), true);
    const area = attrs.get('desert-treasure-ii:stranglewood-temple');
    assert.equal(area.width, 2);
    assert.equal(area.height, 5);
    assert.deepEqual([p.location.x, p.location.y], [8198, 1616]);
    const attackers = area.entities.filter((npc) => npc.__dt2TempleEnemy);
    assert.equal(attackers.length, 3);
    attackers.forEach((npc) => deathHooks[0]({ killer: p, npc }));
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 13);
    assert.ok(area.entities.some((npc) => npc.getRealId?.() === N.KASONDE), 'Kasonde appears after the attackers are defeated');
    interactions.find((entry) => entry.name === 'Kasonde').options['Talk-to']({ player: p, npcId: N.KASONDE });
    assert.equal(counts.get(I.UNFINISHED_SERUM), 1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 14);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II enters a private copy of the real war room from the cleared Digsite hole', () => {
  const { api: base } = mockApi();
  const handlers = [];
  const chunks = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const queues = { add: [], remove: [] };
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {} }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => handlers.push(handler)
        : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const p = {
      attrs: new Map(),
      getAttribute(key) { return this.attrs.get(key); },
      setAttribute(key, value) { this.attrs.set(key, value); },
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      getUsername: () => 'dt2-room-test',
      moveTo(location) { this.location = location; },
    };
    quest.setStage(p, 5);
    const { ObjectIdentifiers: O, NpcIdentifiers: N } = core;
    assert.equal(handlers[0]({ player: p, objectId: O.CREVICE_45, location: { x: 3411, y: 9811, z: 0 } }), true);
    const room = p.getAttribute('desert-treasure-ii:war-room');
    assert.equal(room.width, 6);
    assert.equal(room.height, 5);
    assert.deepEqual(p.location, { x: 8215, y: 1607, z: 0 });
    assert.deepEqual(chunks.filter(([plane, , , chunk]) => plane === 0).map(([, x, y, chunk]) => [x, y, chunk.sourceChunkX, chunk.sourceChunkY]),
      Array.from({ length: 30 }, (_, i) => [Math.floor(i / 5), i % 5, 345 + Math.floor(i / 5), 803 + i % 5]));
    assert.equal(room.entities[0].id, N.ANCIENT_GUARDIAN_3);
    assert.deepEqual(queues.add, [room.entities[0]]);
    assert.equal(handlers[0]({ player: p, objectId: O.CREVICE_45, location: { x: 3412, y: 9811, z: 0 } }), false,
      'only the real excavation hole opens the room');
    quest.setStage(p, 6);
    assert.equal(handlers[0]({ player: p, objectId: O.RUBBLE_74, location: { x: 8215, y: 1601, z: 0 } }), true,
      'the cache Climb-up rubble is the return route');
    assert.deepEqual([p.location.getX(), p.location.getY(), p.location.getZ()], [3411, 9811, 0]);
    assert.equal(p.getAttribute('desert-treasure-ii:war-room'), null);
    assert.equal(room.destroyed, true);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II requires the four matching ancient combat spells to charge its totems', () => {
  const { api: base } = mockApi();
  const objectHooks = [], deathHooks = [], accuracyHooks = [], damageHooks = [], magicHooks = [];
  const chunks = [], addQueue = [], removeQueue = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({
      id, location, owner: null, transform: -1,
      setOwner(owner) { this.owner = owner; }, getOwner() { return this.owner; },
      setOwnerOnly() {}, setNpcTransformationId(id) { this.transform = id; },
      getRealId() { return this.id; }, isNpc() { return true; }, getAsNpc() { return this; },
    }) },
    World: { getAddNPCQueue: () => addQueue, getRemoveNPCQueue: () => removeQueue },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : prop === 'onCombatHitRoll' ? (handler) => accuracyHooks.push(handler)
            : prop === 'onNpcHitModify' ? (handler) => damageHooks.push(handler)
              : prop === 'onCustomEvent' ? (name, handler) => { if (name === 'magic:hit-effects') magicHooks.push(handler); }
                : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const messages = [];
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-totem-test', moveTo(location) { this.location = location; },
      getPacketSender: () => new Proxy({}, { get: () => () => {} }), sendMessage(message) { messages.push(message); },
    };
    const O = core.ObjectIdentifiers;
    quest.setStage(p, 5);
    assert.equal(objectHooks[0]({ player: p, objectId: O.CREVICE_45, location: { x: 3411, y: 9811, z: 0 } }), true);
    const area = attrs.get('desert-treasure-ii:war-room');
    assert.equal(p.getAttribute('desert-treasure-ii:war-room'), area);
    const guardian = area.entities[0];
    deathHooks[0]({ killer: p, npc: guardian });
    assert.equal(quest.getStage(p), 6);
    assert.equal(area.entities.filter((npc) => npc.__dt2Totem).length, 4);
    const onRoomObject = (id, x, y) => objectHooks[0]({ player: p, objectId: id, location: area.tile(x - 2760, y - 6424, 0) });
    onRoomObject(O.GOLEM, 2783, 6444);
    onRoomObject(O.ALTAR_93, 2773, 6442);
    const spells = core.CombatSpells;
    const entries = [
      ['blood', 12344, 'BLOOD_BURST'], ['shadow', 12342, 'SHADOW_BURST'],
      ['smoke', 12340, 'SMOKE_BURST'], ['ice', 12346, 'ICE_BURST'],
    ];
    for (const [kind, activeId, spellName] of entries) {
      const target = area.entities.find((npc) => npc.__dt2Totem === kind);
      const spell = spells[spellName];
      assert.equal(target.getOwner(), p);
      assert.equal(area.entities.includes(target), true);
      assert.equal(attrs.get('desert-treasure-ii:golem-inspected'), true);
      assert.equal(attrs.get('desert-treasure-ii:altar-inspected'), true);
      p.isPlayer = () => true;
      p.getCombat = () => ({ getSelectedSpell: () => spell });
      const attacker = p;
      const roll = { attacker, target, combatType: core.CombatType.MAGIC, forceAccurate: false };
      accuracyHooks[0](roll);
      assert.equal(roll.forceAccurate, true, `${kind} activation casts are accurate`);
      magicHooks[0]({ attacker, target, spell, allowed: true, hit: { isAccurate: () => true } });
      assert.equal(target.__dt2TotemCharged, true, `${kind} matching hit activates its totem (messages: ${messages.join(' | ')})`);
      assert.equal(target.transform, activeId);
      const damage = { setDamage(value) { this.value = value; } };
      damageHooks[0]({ npc: target, hit: { isAccurate: () => true, getHits: () => [damage], updateTotalDamage() {} } });
      assert.equal(damage.value, 0, 'totem activation does not damage the target');
    }
    assert.equal(attrs.get('desert-treasure-ii:totems-charged'), true);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II enters the cache Ancient Vault and requires the four statues plus plaque', () => {
  const interactions = [];
  const objectInteractions = [];
  const { api: base } = mockApi();
  const chunks = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const queues = { add: [], remove: [] };
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {} }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
        : prop === 'onObjectInteraction' ? (handler) => objectInteractions.push(handler)
          : prop === 'emitCustomEvent' ? (_name, event) => { event.complete = true; }
            : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ObjectIdentifiers: O } = core;
    const attrs = new Map();
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'vault-test',
      getSkillManager: () => ({ getMaxLevel: () => 99 }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; },
      sendMessage() {},
    };
    const outerDoor = { player, objectId: O.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } };
    assert.equal(objectInteractions[0](outerDoor), true);
    assert.equal(quest.getStage(player), 1);
    const area = attrs.get('desert-treasure-ii:ancient-vault');
    assert.equal(area.width, 4);
    assert.equal(area.height, 4);
    assert.equal(player.location.x, 8207);
    assert.equal(player.location.y, 1606);
    assert.equal(queues.add[0].id, 12401, 'the room receives the cache initial Asgarnia Smith variant');
    assert.equal(chunks.filter(([plane, , , chunk]) => plane === 1 && chunk !== null).length, 16);
    const inspect = (id, x, y) => objectInteractions[0]({
      player, objectId: id, location: area.tile(x - 3920, y - 9616, 1),
    });
    assert.equal(inspect(49499, 3941, 9635), true);
    assert.equal(interactions.find((entry) => entry.name === 'Asgarnia Smith').options['Talk-to']({ player, npcId: 1 }), undefined);
    assert.equal(quest.getStage(player), 1, 'the NPC sends the player to inspect the remaining objects');
    inspect(49501, 3931, 9635);
    inspect(49503, 3931, 9625);
    inspect(49505, 3941, 9625);
    inspect(O.PLAQUE_35, 3944, 9631);
    interactions.find((entry) => entry.name === 'Asgarnia Smith').options['Talk-to']({ player, npcId: 1 });
    assert.equal(quest.getStage(player), 2, 'only the four statues and plaque advance the vault step');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II requires each medallion on its matching Vault statue and returns the Vardorvis trail to Persten', () => {
  const { api: base } = mockApi();
  const objectHooks = [], itemHooks = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {}, isNpc() { return true; }, getAsNpc() { return this; } }) },
    World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [] },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onItemOnObject' ? (handler) => itemHooks.push(handler)
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const { ItemIdentifiers: I, ObjectIdentifiers: O } = core;
  const attrs = new Map();
  const counts = new Map([[I.VARDORVIS_MEDALLION, 1]]);
  const p = {
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'dt2-medallion-test', getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getInventory: () => ({
      getAmount: (id) => counts.get(id) ?? 0,
      deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
      adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
    }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    moveTo(location) { this.location = location; }, sendMessage() {},
  };
  quest.setStage(p, 7);
  attrs.set('desert-treasure-ii:vardorvis-progress', 22);
  attrs.set('desert-treasure-ii:first-medallion-meeting', true);
  assert.equal(objectHooks[0]({ player: p, objectId: O.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } }), true);
  const area = attrs.get('desert-treasure-ii:ancient-vault');
  const location = area.tile(21, 19, 1);
  assert.equal(itemHooks[0]({ player: p, itemId: I.VARDORVIS_MEDALLION, objectId: 49501, location }), undefined,
    'a medallion cannot be placed on another general’s statue');
  assert.equal(counts.get(I.VARDORVIS_MEDALLION), 1);
  assert.equal(itemHooks[0]({ player: p, itemId: I.VARDORVIS_MEDALLION, objectId: 49499, location }), true);
  assert.equal(counts.get(I.VARDORVIS_MEDALLION), 0);
  assert.equal(quest.getStage(p), 8);
  assert.equal(attrs.get('desert-treasure-ii:medallions-placed'), 1);
});

test('Desert Treasure II plays the first-medallion ambush before re-entering the Ancient Vault', () => {
  const { api: base } = mockApi();
  const objectHooks = [], customEvents = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = { ...base.core, TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {} }) },
    World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [] } };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onCustomEvent' ? (name, handler) => customEvents.push({ name, handler })
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (_api, _player, npcId, page, variant) => { transcripts.push({ npcId, page, variant }); };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const counts = new Map([[core.ItemIdentifiers.VARDORVIS_MEDALLION, 1]]);
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-first-medallion-test',
      getSkillManager: () => ({ getMaxLevel: () => 99 }),
      getInventory: () => ({ getAmount: (id) => counts.get(id) ?? 0 }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage() {},
    };
    quest.setStage(player, 7);
    const door = { player, objectId: core.ObjectIdentifiers.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } };
    assert.equal(objectHooks[0](door), true);
    assert.equal(transcripts[0].variant, 'carnifex-maximus-vardorvis-returning-the-first-medallion');
    assert.equal(attrs.get('desert-treasure-ii:ancient-vault'), undefined,
      'the scene does not skip the Mysterious Figure dialogue');
    customEvents.find(({ name }) => name === 'npc-dialogue:action').handler({ player, stepId: 'NoRYcT' });
    assert.ok(attrs.get('desert-treasure-ii:ancient-vault'), 'the dialogue action resumes the vault scene');
    assert.equal(player.location.x, 8207);
    assert.equal(player.location.y, 1606);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II last medallion route traps the player, requires solving the cell lock, then makes the Figure fight reclaimable', () => {
  const { api: base } = mockApi();
  const objectHooks = [], customEvents = [], deathHooks = [], npcHitHooks = [], prompts = [];
  let spawnedFigure;
  const core = { ...base.core,
    NPC: { create: (id, location) => ({ id, location }), },
    World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [] },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onCustomEvent' ? (name, handler) => customEvents.push({ name, handler })
          : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
            : prop === 'onNpcHitModify' ? (handler) => npcHitHooks.push(handler)
            : prop === 'sendMultiChatboxPrompt' ? (player, prompt, ...options) => prompts.push({ player, prompt, options })
              : prop === 'spawnNpc' ? (args) => (spawnedFigure = { id: args.id, args, setMaxHitpoints(value) { this.maxHitpoints = value; }, setHitpoints(value) { this.hitpoints = value; } })
                : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (_api, _player, npcId, page, variant) => { transcripts.push({ npcId, page, variant }); };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const inventoryItems = Array.from({ length: 28 }, (_, index) => index === 0
      ? new core.Item(core.ItemIdentifiers.WHISPERERS_MEDALLION, 1) : index === 1
        ? new core.Item(995, 200) : new core.Item(-1, 0));
    const equipmentItems = Array.from({ length: 14 }, (_, index) => index === 0 ? new core.Item(1275, 1) : new core.Item(-1, 0));
    const container = (items) => ({ getItems: () => items, setItems(value) { items.splice(0, items.length, ...value); },
      capacity: () => items.length, refreshItems() {},
      getAmount(id) { return items.reduce((sum, item) => sum + (item.getId() === id ? item.getAmount() : 0), 0); },
      adds(id, amount) { const free = items.findIndex((item) => item.getId() <= 0); if (free >= 0) items[free] = new core.Item(id, amount); },
      deleteNumber(id, amount) { for (const item of items) { if (item.getId() !== id || amount <= 0) continue; const taken = Math.min(amount, item.getAmount()); item.setAmount?.(item.getAmount() - taken); if (!item.setAmount) item.amount -= taken; amount -= taken; if (item.getAmount() <= 0) { item.id = -1; item.amount = 0; } } },
    });
    const inventory = container(inventoryItems), equipment = container(equipmentItems);
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-final-cell-test',
      getSkillManager: () => ({ getMaxLevel: () => 99 }),
      getInventory: () => inventory, getEquipment: () => equipment,
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage() {},
    };
    quest.setStage(p, 10);
    assert.equal(objectHooks[0]({ player: p, objectId: core.ObjectIdentifiers.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } }), true);
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-entering-the-ancient-vault-with-the-last-medallion');
    customEvents.find(({ name }) => name === 'npc-dialogue:action').handler({ player: p, stepId: 'qEMxBM' });
    assert.equal(p.location.x, 3103);
    assert.equal(inventory.getAmount(995), 0, 'equipment is secured outside the prison cell');
    assert.equal(equipment.getAmount(1275), 0, 'worn equipment is secured outside the prison cell');
    assert.equal(objectHooks[0]({ player: p, objectId: 48777, option: 'Search', location: { x: 3103, y: 9246, z: 0 } }), true);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.HAIR_CLIP_3), 1);
    attrs.set('desert-treasure-ii:final-cell-solution', '1,2,3,4');
    assert.equal(objectHooks[0]({ player: p, objectId: 48774, option: 'Open', location: { x: 3107, y: 9248, z: 0 } }), true);
    for (const digit of [1, 2, 3, 4]) {
      let prompt = prompts.at(-1);
      let optionIndex = prompt.options.findIndex((entry, index) => index % 2 === 0 && entry === String(digit));
      if (optionIndex === -1) {
        const moreIndex = prompt.options.findIndex((entry, index) => index % 2 === 0 && entry === 'More...');
        assert.notEqual(moreIndex, -1, `lock offers another digit page for ${digit}`);
        prompt.options[moreIndex + 1]();
        prompt = prompts.at(-1);
        optionIndex = prompt.options.findIndex((entry, index) => index % 2 === 0 && entry === String(digit));
      }
      assert.notEqual(optionIndex, -1, `lock exposes digit ${digit}`);
      prompt.options[optionIndex + 1]();
    }
    assert.equal(attrs.get('desert-treasure-ii:final-cell-open'), true);
    assert.equal(objectHooks[0]({ player: p, objectId: 48771, option: 'Search', location: { x: 3115, y: 9263, z: 0 } }), true);
    assert.equal(attrs.get('desert-treasure-ii:final-cell-chest'), true);
    assert.equal(inventory.getAmount(995), 200, 'the chest restores the stored inventory');
    assert.equal(equipment.getAmount(1275), 1, 'the chest restores worn equipment');
    assert.equal(objectHooks[0]({ player: p, objectId: 37633, option: 'Inspect', location: { x: 3086, y: 9260, z: 0 } }), true);
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-inspecting-the-altar-in-the-temple');
    const line = { player: p, npcId: core.NpcIdentifiers.MYSTERIOUS_FIGURE_2, text: 'Very well...' };
    customEvents.find(({ name }) => name === 'npc-dialogue:line').handler(line);
    line.after();
    assert.equal(spawnedFigure.id, core.NpcIdentifiers.MYSTERIOUS_FIGURE_4);
    assert.equal(spawnedFigure.maxHitpoints, 450);
    let attackStyle = 1;
    p.isPlayer = () => true; p.getAsPlayer = () => p;
    p.getFightType = () => ({ getBonusType: () => attackStyle });
    const hitFor = (style) => {
      attackStyle = style;
      const part = { damage: 10, setDamage(value) { this.damage = value; } };
      const hit = { getAttacker: () => p, getHits: () => [part], getTotalDamage: () => part.damage, updateTotalDamage() {} };
      npcHitHooks.at(-1)({ npc: spawnedFigure, hit });
      return part.damage;
    };
    assert.equal(hitFor(1), 10);
    assert.equal(hitFor(1), 10);
    assert.equal(hitFor(1), 10, 'the third attack lands before the Figure changes her prayer');
    assert.equal(hitFor(1), 0, 'the Figure blocks the attack style she prayed against');
    assert.equal(hitFor(4), 10, 'switching from melee to ranged bypasses her current protection');
    deathHooks[0]({ killer: p, npc: spawnedFigure });
    assert.equal(attrs.get('desert-treasure-ii:final-figure-defeated'), true);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.WHISPERERS_MEDALLION), 1);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II descends into the copied Elder Vault, chains all four wights, and grants the ending rewards', () => {
  const { api: base } = mockApi();
  const interactions = [], deaths = [], objects = [], actions = new Map(), queue = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; this.chunks = []; this.destroyed = false; }
    setChunk(plane, x, y, chunk) { this.chunks.push([plane, x, y, chunk]); }
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create(id, location) { return { id, location, setOwner(owner) { this.owner = owner; }, setOwnerOnly() {}, setNpcTransformationId(id) { this.transformedTo = id; }, isNpc() { return true; }, getAsNpc() { return this; }, isRegistered() { return true; }, getOwner() { return this.owner; } }; } },
    World: { getAddNPCQueue: () => queue, getRemoveNPCQueue: () => [] },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
        : prop === 'onNpcDeath' ? (handler) => deaths.push(handler)
          : prop === 'onObjectInteraction' ? (handler) => objects.push(handler)
          : prop === 'onCustomEvent' ? (name, handler) => actions.set(name, handler)
            : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (_api, player, npcId, page, variant) => (transcripts.push({ npcId, page, variant }), true);
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    class Container {
      constructor() { this.counts = new Map(); }
      getAmount(id) { return this.counts.get(id) ?? 0; }
      adds(id, amount) { this.counts.set(id, this.getAmount(id) + amount); }
      deleteNumber(id, amount) { this.counts.set(id, Math.max(0, this.getAmount(id) - amount)); }
    }
    const inventory = new Container(), equipment = new Container();
    inventory.adds(core.ItemIdentifiers.RING_OF_VISIBILITY, 1);
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-final-room-test', getInventory: () => inventory, getEquipment: () => equipment,
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage() {}, isRegistered: () => false,
    };
    quest.setStage(p, 11);
    const talkSmith = interactions.find(({ name }) => name === 'Asgarnia Smith').options['Talk-to'];
    talkSmith({ player: p, npcId: core.NpcIdentifiers.ASGARNIA_SMITH });
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-disputes-of-the-mahjarrat');
    const dialogueAction = actions.get('npc-dialogue:action');
    dialogueAction({ player: p, stepId: 'lnBBaf' });
    const area = attrs.get('desert-treasure-ii:final-room');
    assert.equal(area.width, 7);
    assert.equal(area.height, 8);
    assert.equal(area.chunks.filter(([plane, , , chunk]) => plane === 0 && chunk).length, 56);
    assert.deepEqual(area.getName(), 'Elder Vault (Desert Treasure II)');
    for (const stepId of ['2ucP4K', 's3g1xZ', 'CQXcy8', 'F2TgOo', 't8wSqb', 'fknd65']) dialogueAction({ player: p, stepId });
    const sliske = queue.find((npc) => npc.id === core.NpcIdentifiers.SLISKE);
    assert.ok(sliske, 'the Mahjarrat scene reveals Sliske in the copied chamber');
    dialogueAction({ player: p, stepId: '2at3Ae' });
    for (const id of [core.NpcIdentifiers.THE_FORSAKEN_ASSASSIN, core.NpcIdentifiers.KETLA_THE_UNWORTHY,
      core.NpcIdentifiers.KASONDE_THE_CRAVEN, core.NpcIdentifiers.PERSTEN_THE_DECEITFUL]) {
      const wight = queue.findLast((npc) => npc.id === id);
      assert.ok(wight, `quest spawns wight ${id}`);
      assert.equal(wight.owner, p, 'the fight belongs to this player');
      deaths[0]({ killer: p, npc: wight });
    }
    assert.equal(attrs.get('desert-treasure-ii:final-wights-complete'), true);
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-aftermath');
    dialogueAction({ player: p, stepId: 'xGIiPZ' });
    assert.equal(quest.isComplete(p), true);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.RING_OF_VISIBILITY), 0);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.RING_OF_SHADOWS), 1);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.ANCIENT_LAMP), 3);
    assert.equal(objects[0]({ player: p, objectId: 48890, option: 'Climb', location: area.tile(30, 11, 0) }), true,
      'the cache staircase returns the player to the upper Ancient Vault');
    assert.equal(attrs.get('desert-treasure-ii:final-room'), null);
    assert.equal(p.location.x, 8207, 'the player is back in the private upper vault');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II opens the ritual site after the serum and grants the Temple key only after Vardorvis dies', () => {
  const { api: base } = mockApi();
  const objectHooks = [], deathHooks = [];
  const queues = { add: [], remove: [] };
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, owner: null, setOwner(value) { this.owner = value; }, setOwnerOnly() {}, isNpc() { return true; }, getAsNpc() { return this; }, isRegistered() { return true; } }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
      : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const { ItemIdentifiers: I } = api.core;
  const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 16]]);
  const counts = new Map();
  const p = {
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'dt2-vardorvis-test',
    getInventory: () => ({ getAmount: (id) => counts.get(id) ?? 0, adds: (id, n) => counts.set(id, (counts.get(id) ?? 0) + n) }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    moveTo(location) { this.location = location; }, sendMessage() {},
  };
  quest.setStage(p, 7);
  assert.equal(objectHooks[0]({ player: p, objectId: 49495, location: { x: 1118, y: 3428, z: 0 } }), true);
  const area = attrs.get('desert-treasure-ii:vardorvis-area');
  const boss = queues.add[0];
  assert.equal(boss.id, api.core.NpcIdentifiers.VARDORVIS_2, 'the quest form spawns at the documented ritual site');
  assert.equal(boss.owner, p);
  assert.equal(boss.location.x, 8209, 'Vardorvis is placed at source coordinate 1129,3419 inside the copied ritual site');
  assert.equal(boss.location.y, 1619);
  const rocks = { x: area.tile(6, 28, 0).x, y: area.tile(6, 28, 0).y, z: 0 };
  deathHooks[0]({ killer: p, npc: boss });
  assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 17);
  assert.equal(counts.get(I.VARDORVIS_MEDALLION) ?? 0, 0, 'Vardorvis does not skip the Temple key and Kasonde aftermath');
  assert.equal(objectHooks[0]({ player: p, objectId: api.core.ObjectIdentifiers.ROCKS_139, location: rocks }), true);
  assert.equal(counts.get(I.TEMPLE_KEY_3), 1);
  assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 18);
});

test('Desert Treasure II enters the Scar through the Catalytic Guardian and requires the six opening demons', () => {
  const { api: base } = mockApi();
  const objectHooks = [], objectRouteHooks = [], deathHooks = [], itemOnItemHooks = [], itemOnNpcHooks = [], itemOnObjectHooks = [], itemActionHooks = [], hitModifyHooks = [], lineHooks = [], actionHooks = [], interactions = [];
  const transcripts = [], queues = { add: [], remove: [] }, varbits = new Map(), inventoryCounts = new Map();
  const routes = [];
  let processCycle = 0;
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z, getX() { return this.x; }, getY() { return this.y; } }; }
    add(npc) { this.entities.push(npc); }
    remove(npc) { this.entities = this.entities.filter((entity) => entity !== npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, owner: null, setOwner(value) { this.owner = value; }, getOwner() { return this.owner; }, setOwnerOnly() {}, setScriptedMovement() {}, getMovementQueue() { return this.movement ??= { steps: [], addSteps(tile) { this.steps.push(tile); }, setBlockMovement(blocked) { this.blocked = blocked; } }; }, getLocation() { return { getX: () => this.location.x, getY: () => this.location.y }; }, isNpc() { return true; }, getAsNpc() { return this; }, isRegistered() { return true; }, getHitpoints() { return 100; } }) },
    PathFinder: { calculateWalkRoute: (npc, x, y) => { routes.push([x, y]); npc.getMovementQueue().addSteps({ x, y }); } },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove, getProcessCycle: () => processCycle++ },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onObjectRoute' ? (handler) => objectRouteHooks.push(handler)
        : prop === 'onItemOnItem' ? (handler) => itemOnItemHooks.push(handler)
        : prop === 'onItemOnNpc' ? (handler) => itemOnNpcHooks.push(handler)
          : prop === 'onItemOnObject' ? (handler) => itemOnObjectHooks.push(handler)
            : prop === 'onItemAction' ? (handler) => itemActionHooks.push(handler)
                : prop === 'onNpcHitModify' ? (handler) => hitModifyHooks.push(handler)
        : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : prop === 'onCustomEvent' ? (name, handler) => ({ 'npc-dialogue:line': lineHooks, 'npc-dialogue:action': actionHooks }[name]?.push(handler))
            : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
              : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = (_api, _player, _npcId, _page, variant) => (transcripts.push(variant), true);
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-scar-test',
      isPlayer: () => true, getAsPlayer() { return this; },
      getLocation() { return { getX: () => this.location.x, getY: () => this.location.y }; },
      getInventory: () => ({
        getAmount: (id) => inventoryCounts.get(id) ?? 0,
        adds: (id, amount) => inventoryCounts.set(id, (inventoryCounts.get(id) ?? 0) + amount),
        deleteNumber: (id, amount) => inventoryCounts.set(id, Math.max(0, (inventoryCounts.get(id) ?? 0) - amount)),
      }),
      getPacketSender: () => new Proxy({}, { get: (_target, prop) => prop === 'sendVarbit' ? (id, value) => varbits.set(id, value) : () => {} }),
      moveTo(location) { this.location = location; }, sendMessage(message) { (this.messages ??= []).push(message); },
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pendingAirHits.push(...hits) }) }),
    };
    quest.setStage(player, 8);
    const guardian = interactions.find((entry) => entry.name === 'Catalytic Guardian').options['Talk-to'];
    guardian({ player, npcId: core.NpcIdentifiers.CATALYTIC_GUARDIAN });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-the-catalytic-guardian');
    const afterYes = { player, npcId: core.NpcIdentifiers.CATALYTIC_GUARDIAN, text: 'Yes.' };
    lineHooks[0](afterYes);
    afterYes.after();
    assert.equal(varbits.get(15128), 6, 'entering the Scar advances the canonical quest varbit');
    const area = attrs.get('desert-treasure-ii:scar-area');
    assert.equal(area.width, 9);
    assert.equal(area.height, 8);
    assert.equal(player.location.x, 8213);
    assert.equal(player.location.y, 1633);
    assert.equal(queues.add.length, 6);
    assert.ok(queues.add.every((npc) => npc.owner === player));
    for (const npc of [...queues.add]) deathHooks[0]({ killer: player, npc });
    assert.equal(attrs.get('desert-treasure-ii:scar-demons-defeated'), true);
    assert.equal(varbits.get(15128), 8);
    const firstStone = area.tile(31, 30, 0);
    player.location = area.tile(29, 30, 0);
    const firstRoute = { player, objectId: 49209, clickType: 1, object: { getLocation: () => firstStone } };
    objectRouteHooks[0](firstRoute);
    assert.deepEqual(firstRoute.destination, { x: area.tile(29, 30, 0).x, y: area.tile(29, 30, 0).y, z: 0 },
      'the first crossing routes to a walkable near-bank approach tile');
    assert.equal(objectHooks[0]({ player, objectId: 49209, location: firstStone }), true);
    assert.deepEqual([player.location.x, player.location.y], [area.tile(32, 30, 0).x, area.tile(32, 30, 0).y],
      'crossing the first stone moves only to the next safe tile');
    const secondStone = area.tile(33, 30, 0);
    const secondRoute = { player, objectId: 49209, clickType: 1, object: { getLocation: () => secondStone } };
    objectRouteHooks[0](secondRoute);
    assert.deepEqual(secondRoute.destination, { x: area.tile(32, 30, 0).x, y: area.tile(32, 30, 0).y, z: 0 },
      'the second crossing uses the approach from the near side');
    assert.equal(objectHooks[0]({ player, objectId: 49209, location: secondStone }), true);
    assert.deepEqual([player.location.x, player.location.y], [area.tile(34, 30, 0).x, area.tile(34, 30, 0).y]);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.ROWBOAT_19, location: area.tile(65, 35, 0) }), true,
      'the map boat is usable after naturally crossing the Scar fight');
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-attempting-to-board-the-rowboat-in-the-scar');
    actionHooks[0]({ player, stepId: '4b6oDl' });
    assert.equal(player.location.x, 8243);
    assert.equal(player.location.y, 1643);
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({ player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5 });
    assert.equal(attrs.get('desert-treasure-ii:scar-persten-talked'), true);
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten');
    assert.equal(varbits.get(15128), 14);
    assert.equal(area.scarMazeEntry.id, 49205,
      'Persten opens the canonical cache passage at its real Scar entrance');
    assert.deepEqual([area.scarMazeEntry.location.x, area.scarMazeEntry.location.y], [8235, 1641]);
    assert.equal(objectHooks[0]({ player, objectId: 49526, definition: { id: 49206 }, location: area.tile(43, 41, 0) }), false,
      'the closed cache morph cannot be entered');
    assert.equal(objectHooks[0]({ player, objectId: 49526, definition: { id: 49205 }, location: area.tile(43, 41, 0) }), true,
      'the north-west cache passage is available after Persten explains the ship plan');
    const maze = attrs.get('desert-treasure-ii:scar-maze-one');
    assert.equal(maze.width, 11);
    assert.equal(maze.height, 9);
    assert.equal(player.location.x, 8228, 'the maze entry lands at the real pathfinder-room entrance tile');
    assert.equal(player.location.y, 1654);
    assert.equal(varbits.get(15128), 16);
    let runner = queues.add.at(-1);
    assert.equal(runner.id, core.NpcIdentifiers.CEREBRAL_PATHFINDER,
      'the first cache pathfinder is moved with the documented Move interaction');
    const movePathfinder = interactions.find((entry) => entry.name === 'Cerebral pathfinder').options.Move;
    const movePathbreaker = interactions.find((entry) => entry.name === 'Cerebral pathbreaker').options.Move;
    const push = (npc, handler) => handler({ player, npc, npcId: npc.id, clickType: 1,
      definition: { getActions: () => ['Move', 'Reset-room'] }, handled: false });
    const firstMoveEvent = { player, npc: runner, npcId: runner.id, clickType: 1,
      definition: { getActions: () => ['Move', 'Reset-room'] }, handled: false };
    player.location = maze.tile(36, 50, 0);
    movePathfinder(firstMoveEvent);
    assert.equal(firstMoveEvent.handled, true);
    assert.equal(runner.getMovementQueue().steps.length, 0, 'pushing from the wrong side does not move an orb');
    assert.match(player.messages.at(-1), /Stand north/);
    player.location = maze.tile(35, 51, 0);
    push(runner, movePathfinder);
    assert.deepEqual(routes.at(-1), [8227, 1644], 'a green orb follows the documented north push to its first waypoint');
    runner.location = maze.tile(35, 44, 0);
    maze.process(player);
    assert.deepEqual(routes.at(-1), [8229, 1644], 'the pathfinder follows the second cache waypoint without another push');
    runner.location = maze.tile(37, 44, 0);
    player.location = maze.tile(37, 44, 0);
    maze.process(player);
    assert.equal(maze.pathIndex, 1, 'the next pathbreaker appears after the first orb reaches both Wiki waypoints');
    assert.ok(queues.remove.includes(runner), 'each orb leaves after reaching its waypoint');
    for (let pathIndex = 1; pathIndex < 6; pathIndex++) {
      runner = maze.pathRunner;
      const handler = runner.id === core.NpcIdentifiers.CEREBRAL_PATHFINDER ? movePathfinder : movePathbreaker;
      const path = [
        { points: [[2199, 6444], [2202, 6444], [2202, 6442]], side: [ -1, 0 ] },
        { points: [[2202, 6440], [2201, 6439], [2198, 6438]], side: [0, 1] },
        { points: [[2197, 6438], [2196, 6435]], side: [-1, 0] },
        { points: [[2196, 6435], [2207, 6436]], side: [1, 0] },
        { points: [[2207, 6436], [2207, 6433], [2209, 6433]], side: [0, -1] },
      ][pathIndex - 1];
      const source = path.points[0];
      player.location = maze.tile(source[0] - 2160 + path.side[0], source[1] - 6400 + path.side[1], 0);
      push(runner, handler);
      assert.deepEqual([runner.location.x, runner.location.y], [source[0] - 2160 + 8192, source[1] - 6400 + 1600]);
      for (const [pointX, pointY] of path.points.slice(1)) {
        runner.location = maze.tile(pointX - 2160, pointY - 6400, 0);
        maze.process(player);
      }
      player.location = runner.location;
      maze.process(player);
      assert.equal(queues.remove.includes(runner), true, 'each completed orb is cleaned up before the next step');
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-pathfinder-complete'), true);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.ABYSSAL_TETHER, location: maze.tile(50, 33, 0) }), true);
    assert.equal(attrs.get('desert-treasure-ii:scar-tether-destroyed'), true);
    assert.equal(attrs.get('desert-treasure-ii:scar-tether-destroyed'), true,
      'the tether completion is saved independently from the reused passage challenge varbits');
    assert.equal(objectHooks[0]({ player, objectId: 49415, location: maze.tile(73, 61, 0) }), true,
      'the green neural teleporter is usable only after severing the tether');
    assert.equal(player.location.x, 8223);
    assert.equal(objectHooks[0]({ player, objectId: 49411, location: maze.tile(30, 12, 0) }), true,
      'the catalyst room is entered through its real cache passage');
    assert.equal(attrs.get('desert-treasure-ii:scar-rift-live-nerves'), true);
    assert.equal(objectHooks[0]({ player, objectId: 49183, location: maze.tile(35, 18, 0) }), true,
      'breaking the mapped air nerve ending awards a nerve item');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.AIR_NERVE), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49182, location: maze.tile(38, 11, 0) }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.EARTH_NERVE), 1);
    assert.equal(itemOnItemHooks[0]({ player, usedItemId: core.ItemIdentifiers.AIR_NERVE,
      usedWithItemId: core.ItemIdentifiers.EARTH_NERVE }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.AIR_NERVE), 0);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.EARTH_NERVE), 0);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DUST_NERVE), 1,
      'the documented air + earth recipe makes dust nerve');
    for (const id of attrs.get('desert-treasure-ii:scar-catalyst-order')) inventoryCounts.set(id, 1);
    const catalystId = core.NpcIdentifiers.DT2_SCAR_MAZE_1_RITUAL_CATALYST;
    inventoryCounts.delete(core.ItemIdentifiers.DUST_NERVE);
    assert.equal(itemOnNpcHooks[0]({ player, npcId: catalystId, itemId: core.ItemIdentifiers.DUST_NERVE }), true,
      'a mismatched nerve is handled without advancing or consuming it');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DUST_NERVE), undefined);
    const catalystOrder = attrs.get('desert-treasure-ii:scar-catalyst-order');
    const catalystParts = new Map([
      [core.ItemIdentifiers.SMOKE_NERVE, [core.ItemIdentifiers.FIRE_NERVE, core.ItemIdentifiers.AIR_NERVE]],
      [core.ItemIdentifiers.BLOOD_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.WATER_NERVE]],
      [core.ItemIdentifiers.SOUL_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.MIND_NERVE]],
      [core.ItemIdentifiers.NATURE_NERVE, [core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.EARTH_NERVE]],
      [core.ItemIdentifiers.COSMIC_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.EARTH_NERVE]],
      [core.ItemIdentifiers.ASTRAL_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.EARTH_NERVE, core.ItemIdentifiers.EARTH_NERVE]],
    ]);
    const firstCatalystPart = catalystParts.get(catalystOrder[0])[0];
    inventoryCounts.set(firstCatalystPart, 1);
    assert.equal(itemOnNpcHooks[0]({ player, npcId: catalystId, itemId: firstCatalystPart }), true,
      'a matching elemental nerve can damage the Catalyst without finishing its symbol');
    assert.equal(Number(attrs.get('desert-treasure-ii:scar-catalyst-progress')) || 0, 0);
    assert.equal(inventoryCounts.get(firstCatalystPart), 0);
    for (const nerve of catalystOrder) {
      assert.equal(itemOnNpcHooks[0]({ player, npcId: catalystId, itemId: nerve }), true);
    }
    assert.equal(Number(attrs.get('desert-treasure-ii:scar-catalyst-progress')), 6,
      'the Catalyst only completes after all matching nerves are used');
    assert.equal(objectHooks[0]({ player, objectId: 49414, location: maze.tile(21, 24, 0) }), true,
      'the blue teleporter becomes reachable after the Catalyst is disrupted');
    assert.equal(objectHooks[0]({ player, objectId: 49412, location: maze.tile(65, 21, 0) }), true,
      'the damaged growth room has its own cache entrance');
    const takeLure = interactions.find((entry) => entry.name === 'Light leech').options['Take-lure'];
    const random = Math.random;
    Math.random = () => 0;
    try {
      for (const leech of queues.add.filter((npc) => npc.id === core.NpcIdentifiers.DT2_SCAR_MAZE_LIGHT_LEECH)) takeLure({ player, npc: leech });
    } finally {
      Math.random = random;
    }
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.ILLUMINATING_LURE), 4,
      'each real light leech can yield a lure');
    for (const [x, y] of [[2219, 6435], [2220, 6423], [2231, 6423], [2232, 6435]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49436, itemId: core.ItemIdentifiers.ILLUMINATING_LURE,
        location: maze.tile(x - 2160, y - 6400, 0) }), true);
    }
    assert.equal(varbits.get(15210), 4, 'repairing all four growths reveals the rune sequence');
    const energies = new Map([[1, [49520, 49189, [2227, 6430]]], [2, [49521, 49190, [2224, 6433]]],
      [3, [49522, 49191, [2227, 6433]]], [4, [49523, 49192, [2224, 6427]]],
      [5, [49524, 49193, [2227, 6427]]], [6, [49525, 49194, [2224, 6430]]]]);
    const order = attrs.get('desert-treasure-ii:scar-growth-order');
    const wrong = energies.get(order[0] === 1 ? 2 : 1);
    assert.equal(objectHooks[0]({ player, objectId: wrong[0], definition: { id: wrong[1] },
      location: maze.tile(wrong[2][0] - 2160, wrong[2][1] - 6400, 0) }), true);
    assert.equal(varbits.get(15209), 0, 'touching the wrong energy preserves the current puzzle step');
    for (const rune of order) {
      const [baseId, visibleId, [x, y]] = energies.get(rune);
      assert.equal(objectHooks[0]({ player, objectId: baseId, definition: { id: visibleId },
        location: maze.tile(x - 2160, y - 6400, 0) }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-growth-complete'), true,
      'the exact six-energy order completes the growth challenge');
    assert.equal(objectHooks[0]({ player, objectId: 49418, location: maze.tile(60, 2, 0) }), true,
      'the southern shipwreck passage opens only after restoring the six-energy sequence');
    assert.equal(objectHooks[0]({ player, objectId: 49425, location: maze.tile(76, 2, 0) }), true,
      'searching the mapped crate provides the tinderbox');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.TINDERBOX), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49426, location: maze.tile(61, 14, 0) }), true,
      'the north-west skeleton contains the slimy key');
    assert.equal(objectHooks[0]({ player, objectId: 49427, location: maze.tile(63, 2, 0) }), true,
      'the south-west skeleton contains gunpowder');
    assert.equal(objectHooks[0]({ player, objectId: 49420, location: maze.tile(71, 13, 0) }), true,
      'the slimy key opens the actual cache chest for the old tablet');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.OLD_TABLET), 1);
    const readTablet = { player, itemId: core.ItemIdentifiers.OLD_TABLET, option: 'Read' };
    assert.equal(itemActionHooks[0](readTablet), true);
    assert.equal(readTablet.handled, true);
    assert.equal(itemOnObjectHooks[0]({ player, objectId: 49423, itemId: core.ItemIdentifiers.TINDERBOX,
      location: maze.tile(75, 9, 0) }), true, 'the tinderbox lights gunpowder around the wreck after reading the tablet');
    assert.equal(attrs.get('desert-treasure-ii:scar-boat-burned'), true);
    assert.equal(varbits.get(15128), 20);
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({
      player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5,
    });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-first-passage');
    assert.equal(attrs.get('desert-treasure-ii:scar-persten-room1-talked'), true);
    assert.equal(varbits.get(15128), 22, 'Persten advances the quest only after the boat room is complete');
    assert.equal(area.scarMazeTwoEntry.id, core.ObjectIdentifiers.PASSAGE_15,
      'Persten opens the cache passage to the middle level after the first ship is destroyed');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_15, location: area.tile(51, 34, 0) }), true);
    const middle = attrs.get('desert-treasure-ii:scar-maze-two');
    assert.equal(middle.width, 12);
    assert.equal(middle.height, 8);
    assert.equal(varbits.get(15128), 24);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_18, location: middle.tile(60, 20, 0) }), true,
      'the cache doorway starts the four-axon terminal puzzle');
    let axons = queues.add.filter((npc) => npc.__dt2ScarAxon);
    assert.equal(axons.length, 4);
    const firstMove = axons[0].__dt2AxonPath.points[1];
    const firstStart = axons[0].__dt2AxonPath.points[0];
    const firstDx = Math.sign(firstMove[0] - firstStart[0]), firstDy = Math.sign(firstMove[1] - firstStart[1]);
    player.moveTo(middle.tile(firstStart[0] - 1696 + firstDx, firstStart[1] - 6400 + firstDy, 0));
    const wrongSideHit = { getAttacker: () => player, isAccurate: () => true,
      getHits: () => [{ setDamage(value) { this.damage = value; } }], updateTotalDamage() {} };
    hitModifyHooks.find((handler) => handler.name === 'handleScarAxonHit')({ npc: axons[0], hit: wrongSideHit });
    assert.equal(axons[0].__dt2AxonIndex, 0, 'hitting an axon from the wrong side does not push it away from its terminal');
    for (const axon of axons) {
      while (axon.__dt2AxonIndex < axon.__dt2AxonPath.points.length - 1) {
        const current = axon.__dt2AxonPath.points[axon.__dt2AxonIndex];
        const next = axon.__dt2AxonPath.points[axon.__dt2AxonIndex + 1];
        const dx = Math.sign(next[0] - current[0]), dy = Math.sign(next[1] - current[1]);
        player.moveTo(middle.tile(current[0] - 1696 - dx, current[1] - 6400 - dy, 0));
        const hit = { getAttacker: () => player, isAccurate: () => true,
          getHits: () => [{ setDamage(value) { this.damage = value; } }], updateTotalDamage() {} };
        hitModifyHooks.find((handler) => handler.name === 'handleScarAxonHit')({ npc: axon, hit });
        axon.location = middle.tile(next[0] - 1696, next[1] - 6400, 0);
      }
      assert.equal(axon.__dt2AxonComplete, true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-axon-room-complete'), true);
    assert.equal(varbits.get(15258), 1, 'all four axons must reach their matching terminals');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_19, location: middle.tile(86, 20, 0) }), true,
      'the broken nerve chamber opens after all axon terminals activate');
    assert.equal(attrs.get('desert-treasure-ii:scar-nerve-room-two-active'), true);
    assert.equal(varbits.get(15211), 100, 'the underwater room starts with full oxygen');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.AIR_BUBBLE, location: middle.tile(84, 25, 0) }), true);
    assert.equal(varbits.get(15211), 100, 'air bubbles restore oxygen while underwater');
    const roomNerves = [
      [core.ObjectIdentifiers.NERVE_ENDING_EARTH_, 1784, 6423, core.ItemIdentifiers.EARTH_NERVE],
      [core.ObjectIdentifiers.NERVE_ENDING_AIR_, 1789, 6429, core.ItemIdentifiers.AIR_NERVE],
      [core.ObjectIdentifiers.NERVE_ENDING_WATER_, 1775, 6426, core.ItemIdentifiers.WATER_NERVE],
      [core.ObjectIdentifiers.NERVE_ENDING_FIRE_, 1777, 6422, core.ItemIdentifiers.FIRE_NERVE],
    ];
    for (const [objectId, x, y, itemId] of roomNerves) {
      assert.equal(objectHooks[0]({ player, objectId, location: middle.tile(x - 1696, y - 6400, 0) }), true);
      assert.equal(inventoryCounts.get(itemId), 1);
    }
    for (const [ingredients, result] of [
      [[core.ItemIdentifiers.AIR_NERVE, core.ItemIdentifiers.EARTH_NERVE], core.ItemIdentifiers.DUST_NERVE],
      [[core.ItemIdentifiers.EARTH_NERVE, core.ItemIdentifiers.FIRE_NERVE], core.ItemIdentifiers.LAVA_NERVE],
      [[core.ItemIdentifiers.FIRE_NERVE, core.ItemIdentifiers.AIR_NERVE], core.ItemIdentifiers.SMOKE_NERVE],
      [[core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.FIRE_NERVE], core.ItemIdentifiers.STEAM_NERVE],
    ]) {
      inventoryCounts.set(ingredients[0], 2);
      inventoryCounts.set(ingredients[1], 2);
      assert.equal(itemOnItemHooks[0]({ player, usedItemId: ingredients[0], usedWithItemId: ingredients[1] }), true);
      assert.equal(inventoryCounts.get(result), 1);
    }
    const repairs = [
      [49445, 1778, 6431, core.ItemIdentifiers.SMOKE_NERVE],
      [49446, 1783, 6430, core.ItemIdentifiers.STEAM_NERVE],
      [49447, 1784, 6433, core.ItemIdentifiers.DUST_NERVE],
      [49448, 1779, 6435, core.ItemIdentifiers.LAVA_NERVE],
    ];
    for (const [objectId, x, y, itemId] of repairs) {
      const location = middle.tile(x - 1696, y - 6400, 0);
      const wrong = { player, itemId: core.ItemIdentifiers.DUST_NERVE, objectId, location };
      assert.equal(itemOnObjectHooks[0](wrong), true);
      assert.equal(wrong.handled, true);
      const repair = { player, itemId, objectId, location };
      assert.equal(itemOnObjectHooks[0](repair), true);
      assert.equal(repair.handled, true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-nerve-room-two-complete'), true);
    assert.equal(varbits.get(15259), 1);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_20, location: middle.tile(48, 57, 0) }), true);
    let imps = queues.add.filter((npc) => npc.__dt2SummonImp);
    let demons = queues.add.filter((npc) => npc.__dt2SummonDemon);
    assert.equal(imps.length, 3);
    assert.equal(demons.length, 2);
    const protectedHits = [{ setDamage(value) { this.damage = value; } }];
    const protectedHit = { isAccurate: () => true, getHits: () => protectedHits, updateTotalDamage() {} };
    hitModifyHooks.find((handler) => handler.name === 'preventScarSummonProtection')({ npc: demons[0], hit: protectedHit });
    assert.equal(protectedHits[0].damage, 0, 'the imps protect the lesser demons until they die');
    for (const imp of imps) deathHooks[0]({ killer: player, npc: imp });
    assert.equal(attrs.get('desert-treasure-ii:scar-summoning-imps'), 0);
    for (const demon of demons) deathHooks[0]({ killer: player, npc: demon });
    assert.equal(attrs.get('desert-treasure-ii:scar-summoning-room-complete'), true);
    assert.equal(varbits.get(15260), 1);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_23, location: middle.tile(75, 59, 0) }), true);
    for (const [objectId, x, y] of [[49425, 1774, 6448], [49427, 1779, 6448], [49426, 1789, 6449]]) {
      assert.equal(objectHooks[0]({ player, objectId, location: middle.tile(x - 1696, y - 6400, 0) }), true);
    }
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.TINDERBOX), 1);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.GUNPOWDER_2), 1);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.SLIMY_KEY), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49420, location: middle.tile(79, 60, 0) }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DAMP_TABLET), 1);
    const readDamp = { player, itemId: core.ItemIdentifiers.DAMP_TABLET, option: 'Read' };
    assert.equal(itemActionHooks[0](readDamp), true);
    assert.equal(readDamp.handled, true);
    const burnSecondWreck = { player, itemId: core.ItemIdentifiers.TINDERBOX, objectId: core.ObjectIdentifiers.SHIPWRECK,
      location: middle.tile(90, 53, 0) };
    assert.equal(itemOnObjectHooks[0](burnSecondWreck), true);
    assert.equal(burnSecondWreck.handled, true);
    assert.equal(attrs.get('desert-treasure-ii:scar-boat2-burned'), true);
    assert.equal(varbits.get(15128), 28);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_17, location: middle.tile(94, 5, 0) }), true,
      'the real passage exit returns the player to Persten after the second ship');
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({
      player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5,
    });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-second-passage');
    assert.equal(attrs.get('desert-treasure-ii:scar-persten-room2-talked'), true);
    assert.equal(varbits.get(15128), 30);
    assert.equal(area.scarMazeTwoEntry.id, 49410, 'Persten reveals the third passage after the second boat is burned');
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: area.tile(51, 34, 0) }), true);
    const finalPassage = attrs.get('desert-treasure-ii:scar-maze-three');
    assert.equal(finalPassage.width, 9);
    assert.equal(finalPassage.height, 9);
    assert.equal(varbits.get(15128), 32);
    const pendingAirHits = [];
    attrs.set('desert-treasure-ii:scar-maze-three-air', 2);
    finalPassage.process(player);
    assert.equal(varbits.get(15211), 1, 'the third passage drains oxygen once per world cycle');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.AIR_BUBBLE,
      location: finalPassage.tile(1900 - 1856, 6430 - 6400, 0) }), true);
    assert.equal(varbits.get(15211), 100, 'the correct cache air bubble restores oxygen');
    attrs.set('desert-treasure-ii:scar-maze-three-air', 0);
    finalPassage.process(player);
    assert.equal(pendingAirHits.length, 1, 'running out of air forces the player back and causes damage');
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: finalPassage.tile(41, 36, 0) }), true,
      'the Abyssal Stem starts the final passage memory puzzle');
    const memory = attrs.get('desert-treasure-ii:scar-memory-order');
    assert.equal(memory.length, 4);
    assert.equal(new Set(memory).size, 4);
    const wrongStep = memory[0] === 0 ? 1 : 0;
    const [wx, wy] = [[1903, 6431], [1900, 6442], [1909, 6441], [1914, 6434]][wrongStep];
    assert.equal(objectHooks[0]({ player, objectId: 49391, location: finalPassage.tile(wx - 1856, wy - 6400, 0) }), true);
    assert.equal(varbits.get(15212), 0, 'a wrong memory growth resets the sequence');
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: finalPassage.tile(41, 36, 0) }), true,
      'touching the stem shows the same stored sequence again');
    for (const growth of memory) {
      const [x, y] = [[1903, 6431], [1900, 6442], [1909, 6441], [1914, 6434]][growth];
      assert.equal(objectHooks[0]({ player, objectId: 49391, location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-memory-complete'), true);
    assert.equal(varbits.get(15258), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49412, location: finalPassage.tile(46, 11, 0) }), true,
      'the Brain Pillar room only opens after solving the memory puzzle');
    for (let wave = 0; wave < 4; wave++) {
      const enemies = queues.add.filter((npc) => npc.__dt2ScarTreeEnemy === true);
      assert.equal(enemies.length, 2);
      for (const enemy of enemies) deathHooks[0]({ killer: player, npc: enemy });
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-tree-complete'), true,
      'the Brain Pillar heals after the player clears four actual enemy waves');
    assert.equal(varbits.get(15260), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49416, location: finalPassage.tile(35, 57, 0) }), true,
      'the north neural teleporter leads to the Unlit Veins');
    const takeMazeThreeLure = interactions.find((entry) => entry.name === 'Light leech').options['Take-lure'];
    const oldRandom = Math.random;
    Math.random = () => 0;
    try {
      for (const leech of queues.add.filter((npc) => npc.__dt2ScarMazeThreeLeech)) takeMazeThreeLure({ player, npc: leech });
    } finally { Math.random = oldRandom; }
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.ILLUMINATING_LURE), 4);
    for (const [x, y] of [[1862, 6432], [1869, 6423], [1869, 6440], [1876, 6432]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49436, itemId: core.ItemIdentifiers.ILLUMINATING_LURE,
        location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(varbits.get(15210), 4);
    for (const cell of queues.add.filter((npc) => npc.__dt2ScarBloodCell)) deathHooks[0]({ killer: player, npc: cell });
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.CRIMSON_FIBRE), 3);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.RADIANT_FIBRE), 3);
    for (const [x, y] of [[1865, 6438], [1874, 6429], [1874, 6434]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49537, itemId: core.ItemIdentifiers.CRIMSON_FIBRE,
        location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    for (const [x, y] of [[1867, 6427], [1867, 6433], [1874, 6425]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49536, itemId: core.ItemIdentifiers.RADIANT_FIBRE,
        location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-leech-complete'), true);
    assert.equal(varbits.get(15259), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49419, location: finalPassage.tile(43, 56, 0) }), true);
    for (const [objectId, x, y] of [[49425, 1915, 6460], [49427, 1912, 6446], [49426, 1902, 6459]]) {
      assert.equal(objectHooks[0]({ player, objectId, location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(objectHooks[0]({ player, objectId: 49420, location: finalPassage.tile(53, 49, 0) }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DAMP_TABLET_2), 1);
    const readThirdTablet = { player, itemId: core.ItemIdentifiers.DAMP_TABLET_2, option: 'Read' };
    assert.equal(itemActionHooks[0](readThirdTablet), true);
    assert.equal(readThirdTablet.handled, true);
    const burnThirdWreck = { player, itemId: core.ItemIdentifiers.TINDERBOX, objectId: core.ObjectIdentifiers.SHIPWRECK,
      location: finalPassage.tile(58, 55, 0) };
    assert.equal(itemOnObjectHooks[0](burnThirdWreck), true);
    assert.equal(burnThirdWreck.handled, true);
    assert.equal(attrs.get('desert-treasure-ii:scar-boat3-burned'), true);
    assert.equal(varbits.get(15128), 34);
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: finalPassage.tile(41, 36, 0) }), true,
      'the passage exit returns to camp after the third ship burns');
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({ player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5 });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-third-passage');
    assert.equal(varbits.get(15128), 36);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Dragon Slayer II Torfinn starts both ordered dragon waves before Galvek', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const { api: base } = mockApi();
  const interactions = [];
  const deaths = [];
  const playerDeaths = [];
  const dialogueActions = [];
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => interactions.push({ name, options });
      if (prop === 'onNpcDeath') return (handler) => deaths.push(handler);
      if (prop === 'onPlayerDeath') return (handler) => playerDeaths.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => {
        if (name === 'npc-dialogue:action') dialogueActions.push(handler);
      };
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
    const core = api.core;
    const attributes = new Map([['quest.dragon_slayer_ii.stage', 10]]);
    let at = new core.Location(1456, 2968, 0);
    const messages = [];
    const pendingHits = [];
    const packet = new Proxy({}, { get: (_target, _key) => (..._args) => packet });
    const player = {
      isPlayer: () => true, getAsPlayer: () => player, getIndex: () => 987654, getUsername: () => 'quest-wave-test',
      getArea: () => null, setArea: () => {}, getLocation: () => at, moveTo: (location) => { at = location; },
      getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
      getPacketSender: () => packet, sendMessage: (message) => messages.push(message),
      getInventory: () => ({ adds: () => {} }),
      getHitpoints: () => 99, getRunEnergy: () => 100, setRunEnergy: () => {},
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pendingHits.push(...hits) }) }),
      getSkillManager: () => ({ decreaseCurrentLevel: () => {} }),
    };
    const torfinn = interactions.find(({ name }) => name === 'Torfinn').options['Talk-to'];
    torfinn({ player, npcId: core.NpcIdentifiers.TORFINN });
    const wave = [core.NpcIdentifiers.BLACK_DRAGON, core.NpcIdentifiers.STEEL_DRAGON,
      core.NpcIdentifiers.BRUTAL_RED_DRAGON, core.NpcIdentifiers.MITHRIL_DRAGON,
      core.NpcIdentifiers.ADAMANT_DRAGON, core.NpcIdentifiers.RUNE_DRAGON];
    for (let index = 0; index < 3; index++) {
      const dragon = attributes.get('dragon-slayer-ii:instance-boss');
      assert.equal(dragon.getId(), wave[index], `wave opponent ${index + 1}`);
      deaths[0]({ killer: player, npc: dragon });
    }
    assert.equal(attributes.get('dragon-slayer-ii:assault-checkpoint'), 3);
    playerDeaths[0]({ player });
    torfinn({ player, npcId: core.NpcIdentifiers.TORFINN });
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getId(), wave[3], 'death resumes at wave two checkpoint');
    for (let index = 3; index < wave.length; index++) {
      const dragon = attributes.get('dragon-slayer-ii:instance-boss');
      assert.equal(dragon.getId(), wave[index], `wave opponent ${index + 1}`);
      deaths[0]({ killer: player, npc: dragon });
    }
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 11);
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getId(), core.NpcIdentifiers.GALVEK_2);
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getMaxHitpoints(), 1200);
    const area = attributes.get('dragon-slayer-ii:instance-area');
    for (let tick = 0; tick < 7; tick++) area.process(player);
    assert.ok(messages.some((message) => message.includes('launches a fireball')));
    at = new core.Location(at.getX() + 2, at.getY(), 0);
    for (let tick = 0; tick < 3; tick++) area.process(player);
    assert.equal(pendingHits.length, 0, 'moving two tiles avoids Galvek’s lethal fireball');
    const galvek = attributes.get('dragon-slayer-ii:instance-boss');
    deaths[0]({ killer: player, npc: galvek });
    assert.equal(attributes.get('dragon-slayer-ii:galvek-defeated'), true,
      'only Galvek’s death marks the final boss as defeated');
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 11,
      'the quest remains active until Alec receives the report');
    dialogueActions.forEach((handler) => handler({ player, stepId: 'b5j1wa' }));
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 12,
      'Alec’s final transcript action completes the quest');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Dragon Slayer II Ungael notes require all six real pieces before combining', () => {
  const handlers = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemOnItem' ? (handler) => handlers.push(handler) : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { ItemIdentifiers: I } = api.core;
  const notes = [I.OLD_NOTES, I.OLD_NOTES_2, I.OLD_NOTES_3, I.OLD_NOTES_4, I.OLD_NOTES_5, I.OLD_NOTES_6];
  const counts = new Map(notes.slice(0, 5).map((id) => [id, 1]));
  const player = {
    getInventory: () => ({
      getAmount: (id) => counts.get(id) ?? 0,
      getFreeSlots: () => 28 - [...counts.values()].reduce((sum, amount) => sum + amount, 0),
      deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
      adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
    }),
    sendMessage: () => {},
  };
  assert.equal(handlers[0]({ player, usedItemId: notes[0], usedWithItemId: notes[1] }), true);
  assert.equal(counts.get(notes[0]), 1, 'incomplete notes are not consumed');
  counts.set(notes[5], 1);
  assert.equal(handlers[0]({ player, usedItemId: notes[0], usedWithItemId: notes[1] }), true);
  assert.ok(notes.every((id) => counts.get(id) === 0));
  assert.equal(counts.get(I.UNGAEL_LAB_NOTES), 1);
});

test('Dragon Slayer II rowboat build consumes the Wiki supplies and uses the ready dialogue to travel', () => {
  const objects = new Map();
  const objectHandlers = [];
  const custom = new Map();
  const { api: base } = mockApi();
  const objectManager = base.core.ObjectManager;
  const register = objectManager.register;
  const deregister = objectManager.deregister;
  objectManager.register = () => {};
  objectManager.deregister = () => {};
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onObjectInteraction') return (handler, actions) => {
        if (typeof handler === 'function') objectHandlers.push(handler);
        else if (typeof handler === 'string' && actions) objects.set(handler, actions);
      };
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    objectManager.register = register;
    objectManager.deregister = deregister;
  }
  const { ItemIdentifiers: I, ObjectIdentifiers: O } = api.core;
  const attributes = new Map([['quest.dragon_slayer_ii.stage', 6]]);
  const amounts = new Map([[I.HAMMER, 1], [I.SAW, 1], [I.OAK_PLANK, 8], [I.SWAMP_PASTE, 10], [I.BRONZE_NAILS, 7], [I.IRON_NAILS, 5], [I.DRAGON_KEY, 1]]);
  const messages = [];
  let destination;
  const packet = new Proxy({}, { get: () => () => packet });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getMaxLevel: () => 50 }),
    getPacketSender: () => packet,
    getInventory: () => ({
      getAmount: (id) => amounts.get(id) ?? 0,
      deleteNumber: (id, count) => amounts.set(id, (amounts.get(id) ?? 0) - count),
    }),
    sendMessage: (message) => messages.push(message),
    moveTo: (location) => { destination = [location.getX(), location.getY(), location.getZ()]; },
  };
  const buildEvent = {
    player, objectId: O.ROWBOAT_SPACE, clickType: 1,
    definition: { getInteractions: () => ['Build'] },
    location: { x: 3661, y: 3847, z: 0 },
  };
  assert.equal(objectHandlers[0](buildEvent), true);
  assert.equal(attributes.get('dragon-slayer-ii:lithkren-rowboat-built'), true);
  assert.deepEqual([I.OAK_PLANK, I.SWAMP_PASTE, I.BRONZE_NAILS, I.IRON_NAILS].map((id) => amounts.get(id)), [0, 0, 0, 0]);
  assert.equal(objectHandlers[0]({
    player, objectId: O.ROWBOAT_SPACE, clickType: 1,
    definition: { getInteractions: () => ['Build'] },
    location: { x: 3661, y: 3847, z: 0 },
  }), true);
  assert.deepEqual(destination, [3760, 3869, 0]);
  destination = undefined;
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: 'wKz-eF' });
  assert.deepEqual(destination, [3760, 3869, 0]);
  assert.equal(attributes.get('dragon-slayer-ii:lithkren-arrived'), true);
  assert.equal(objectHandlers[0]({
    player, objectId: O.ANCIENT_DOORS, location: { x: 3760, y: 3869, z: 0 },
  }), true);
  assert.equal(amounts.get(I.DRAGON_KEY), 0);
  assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 9);
  assert.ok(messages.includes('You successfully build the boat.'));
});

test('Desert Treasure II shadow spells interrupt the private Leviathan encounter', () => {
  const { api: base } = mockApi();
  const custom = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onCustomEvent'
      ? (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler])
      : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const messages = [];
  const attacker = { isPlayer: () => true, sendMessage: (message) => messages.push(message) };
  const target = { __dt2Leviathan: true, getOwner: () => attacker };
  custom.get('magic:hit-effects').at(-1)({ attacker, target, spell: { getName: () => 'Shadow Barrage' } });
  assert.ok(target.__dt2LeviathanStunnedUntil > api.core.World.getProcessCycle());
  assert.match(messages[0], /stuns the Leviathan/);
});

test('Desert Treasure II prison escape leads to the cache Duke arena and requires two real poisons', () => {
  const { api: base } = mockApi();
  const objects = [], itemItems = [], itemObjects = [], itemNpcs = [], itemActions = [], deaths = [], groundPickups = [];
  const queues = { add: [], remove: [] };
  let cycle = 0, hasPillarCover = true;
  const pendingHits = [];
  class TestArea {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 5000; }
    getBaseY() { return 6000; }
    tile(x, y, z) { return { x: 5000 + x, y: 6000 + y, z, getX() { return this.x; }, getY() { return this.y; }, getZ() { return this.z; } }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestArea,
    RegionManager: { canProjectileAttackBounds: () => !hasPillarCover },
    NPC: { create: (id, location) => ({
      id, location, owner: null, hp: 500,
      setOwner(value) { this.owner = value; }, getOwner() { return this.owner; }, setOwnerOnly() {},
      setScriptedMovement() {}, setMaxHitpoints(value) { this.hp = value; }, setHitpoints(value) { this.hp = value; },
      getHitpoints() { return this.hp; }, getLocation() { return this.location; }, getSize() { return 7; }, forceChat() {},
      getCombat() { return { getLastAttack: () => ({ reset() {} }) }; },
      isRegistered() { return true; }, isNpc() { return true; }, getAsNpc() { return this; },
    }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove, getProcessCycle: () => cycle++ },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objects.push(handler)
        : prop === 'onItemOnItem' ? (handler) => itemItems.push(handler)
          : prop === 'onItemOnObject' ? (handler) => itemObjects.push(handler)
            : prop === 'onItemOnNpc' ? (handler) => itemNpcs.push(handler)
                : prop === 'onGroundItemPickup' ? (handler) => groundPickups.push(handler)
              : prop === 'onNpcDeath' ? (handler) => deaths.push(handler)
                : prop === 'onItemAction' ? (handler) => itemActions.push(handler)
                : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = runtime.getRegisteredQuests().at(-1);
  const attrs = new Map(), inventory = new Map(), messages = [];
  const player = {
    isPlayer: () => true, getAsPlayer() { return this; }, getUsername: () => 'dt2-sucellus-test',
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    moveTo(location) { this.location = location; }, getLocation() { return this.location; }, sendMessage: (message) => messages.push(message),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pendingHits.push(...hits) }) }),
    getSize: () => 1,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getInventory: () => ({ getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)) }),
  };
  const I = core.ItemIdentifiers, O = core.ObjectIdentifiers;
  const sourceLocation = (x, y, z = 0) => ({ x: 5000 + x - 2872, y: 6000 + y - 6336, z });
  const interactObject = (id, x, y, option = 'Search') => objects.at(-1)({ player, objectId: id, option, location: sourceLocation(x, y) });
  quest.setStage(player, 9);
  assert.equal(objects.at(-1)({ player, objectId: 49513, location: { x: 2926, y: 10354, z: 0 } }), true, 'enter through the prison entrance');
  assert.equal(attrs.get('desert-treasure-ii:sucellus-area') instanceof TestArea, true);
  const area = attrs.get('desert-treasure-ii:sucellus-area');
  player.moveTo(area.tile(40, 12, 2));
  area.process(player);
  assert.equal(attrs.get('desert-treasure-ii:sucellus-cell-entered'), true, 'the prison guard knocks the player out at the cell passage');
  assert.deepEqual([player.location.x, player.location.y, player.location.z], [sourceLocation(3040, 6370).x, sourceLocation(3040, 6370).y, 0]);
  interactObject(49099, 3040, 6370, 'Inspect');
  interactObject(49094, 3042, 6369);
  assert.equal(inventory.get(I.PRISONERS_LETTER), 1);
  itemActions.at(-1)({ player, itemId: I.PRISONERS_LETTER, option: 'Read' });
  interactObject(49095, 3039, 6367);
  assert.equal(inventory.get(I.KNIFE_5), 1);
  itemObjects.at(-1)({ player, itemId: I.KNIFE_5, objectId: 49099, location: sourceLocation(3040, 6370) });
  assert.equal(inventory.get(I.KNIFE_5), 0);
  assert.equal(inventory.get(I.CHISEL_5), 1);
  interactObject(49514, 3041, 6367);
  assert.equal(inventory.get(I.LOCKPICK_4), 1);
  itemObjects.at(-1)({ player, itemId: I.LOCKPICK_4, objectId: 49099, location: sourceLocation(3040, 6370) });
  assert.equal(attrs.get('desert-treasure-ii:sucellus-cell-escaped'), true);
  assert.equal(area.entities.some((npc) => npc.id === core.NpcIdentifiers.ASSASSIN_7), true, 'the cell guard is present after the escape');
  objects.at(-1)({ player, objectId: 49120, option: 'Pick-lock', location: sourceLocation(2945, 6389, 2) });
  assert.equal(attrs.get('desert-treasure-ii:sucellus-assassin-gone'), true);
  assert.equal(objects.at(-1)({ player, objectId: 49138, location: sourceLocation(3039, 6433) }), false, 'the asylum gate leads from the real prison into Duke’s chamber');
  const boss = attrs.get('desert-treasure-ii:boss');
  assert.equal(boss.__dt2SucellusAwake, false);
  assert.equal(boss.hp, 440, 'the quest Duke uses the documented normal 440 hitpoints');
  interactObject(O.PESTLE_AND_MORTAR_2, 3034, 6434);
  interactObject(O.PICKAXE_3, 3044, 6434);
  for (let i = 0; i < 3; i++) interactObject(O.MUSCA_MUSHROOMS_2, 3048, 6453);
  for (let i = 0; i < 3; i++) interactObject(O.ARDER_MUSHROOMS_2, 3030, 6453);
  for (let i = 0; i < 12; i++) interactObject(O.SALT_DEPOSIT_2, 3033, 6448, 'Mine');
  for (const id of [I.MUSCA_MUSHROOM, I.MUSCA_MUSHROOM, I.MUSCA_MUSHROOM, I.ARDER_MUSHROOM, I.ARDER_MUSHROOM, I.ARDER_MUSHROOM]) {
    itemItems.at(-1)({ player, usedItemId: I.PESTLE_AND_MORTAR, usedWithItemId: id });
  }
  assert.equal(inventory.get(I.MUSCA_POWDER), 3);
  assert.equal(inventory.get(I.ARDER_POWDER), 3);
  for (const [vat, x] of [[47537, 3034], [47537, 3043]]) {
    for (const powder of [I.MUSCA_POWDER, I.ARDER_POWDER]) {
      itemObjects.at(-1)({ player, itemId: powder, objectId: vat, location: sourceLocation(x, 6438) });
    }
    for (let i = 0; i < 6; i++) itemObjects.at(-1)({ player, itemId: I.SALAX_SALT, objectId: vat, location: sourceLocation(x, 6438) });
    interactObject(vat, x, 6438, 'Empty');
  }
  assert.equal(inventory.get(I.ARDER_MUSCA_POISON), 2);
  itemNpcs.at(-1)({ player, npc: boss, itemId: I.ARDER_MUSCA_POISON });
  assert.equal(boss.__dt2SucellusAwake, false);
  itemNpcs.at(-1)({ player, npc: boss, itemId: I.ARDER_MUSCA_POISON });
  assert.equal(boss.__dt2SucellusAwake, true);
  assert.equal(inventory.get(I.ARDER_MUSCA_POISON), 0);
  player.moveTo(area.tile(167, 97, 0));
  for (let i = 0; i < 31; i++) area.process(player);
  assert.ok(messages.some((message) => message.includes('turns his gaze upon you')));
  assert.ok(messages.some((message) => message.includes('avoid Duke Sucellus')));
  assert.equal(pendingHits.length, 0, 'the cached pillar collision protects against the freezing gaze');
  hasPillarCover = false;
  for (let i = 0; i < 30; i++) area.process(player);
  assert.equal(pendingHits.length, 1, 'the exposed freezing gaze queues its real hit');
  assert.ok(pendingHits[0].getDamage() > 0 && pendingHits[0].getDamage() <= 101);
  deaths.at(-1)({ killer: player, npc: boss });
  groundPickups.at(-1)({ player, groundItemId: I.ODD_KEY, location: sourceLocation(3039, 6454) });
  inventory.set(I.ODD_KEY, 1);
  interactObject(49140, 3023, 6425, 'Open');
  interactObject(49116, 3021, 6420, 'Open');
  assert.equal(inventory.get(I.SUCELLUS_MEDALLION), 1);
  assert.equal(quest.getStage(player), 10);
});


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
