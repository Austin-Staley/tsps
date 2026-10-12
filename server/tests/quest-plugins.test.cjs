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
