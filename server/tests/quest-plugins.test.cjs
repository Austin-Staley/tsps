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

test('completed Lunar Diplomacy players can replace a lost Seal of Passage from Brundt', () => {
  const { api: base } = mockApi();
  let talkToBrundt;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcInteraction'
      ? (handler) => { if (typeof handler === 'function') talkToBrundt = handler; }
      : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  let transcript;
  runtime.startTranscript = (...args) => { transcript = args.slice(3, 5); return true; };
  try {
    delete require.cache[require.resolve('../plugins/quests/quests/LunarDiplomacy.Quest')];
    require('../plugins/quests/quests/LunarDiplomacy.Quest')(api);
    const player = {
      getAttribute: (key) => key === 'quest.lunar_diplomacy.stage' ? 190 : 0,
      getInventory: () => ({ getAmount: () => 0 }),
    };
    const event = { player, npcId: api.core.NpcIdentifiers.BRUNDT_THE_CHIEFTAIN_6, clickType: 1, handled: false };
    assert.equal(talkToBrundt(event), true);
    assert.deepEqual(transcript, [
      'Lunar Diplomacy',
      'getting-started-talking-to-brundt-the-chieftain-after-losing-the-seal-of-passage',
    ]);
    assert.equal(event.handled, true);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
});

test('Fremennik Exiles yields Longhall Brundt to Lunar Seal recovery before its start menu', () => {
  const { api: base } = mockApi();
  let brundtTalk;
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => {
        if (name === 'Brundt the Chieftain') brundtTalk = options['Talk-to'];
      };
      if (prop === 'emitCustomEvent') return (name, request) => {
        if (name === 'quest:is-complete') request.complete = request.key === 'lunar_diplomacy';
      };
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/TheFremennikExiles.Quest')];
  require('../plugins/quests/quests/TheFremennikExiles.Quest')(api);
  const player = {
    getAttribute: () => 0,
    getInventory: () => ({ getAmount: () => 0 }),
  };
  const event = { player, npcId: api.core.NpcIdentifiers.BRUNDT_THE_CHIEFTAIN_6, clickType: 1, handled: false };
  assert.equal(brundtTalk(event), false);
  assert.equal(event.handled, false, 'the later Lunar Diplomacy hook can play its replacement transcript');
});

test('Quests.plugin registers every quest through api.core without throwing', () => {
  const { api } = mockApi();
  const plugin = require('../plugins/quests/Quests.plugin');
  assert.equal(plugin.name, 'Quests');
  assert.doesNotThrow(() => plugin.register(api));
});

test('Tenzing charges 12 coins for climbing boots on the accepted shop choice', () => {
  const { api: base } = mockApi();
  const custom = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onCustomEvent'
      ? (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler])
      : target[prop],
  });
  delete require.cache[require.resolve('../plugins/quests/quests/DeathPlateau.Quest')];
  require('../plugins/quests/quests/DeathPlateau.Quest')(api);
  const inventory = new Map([[api.core.ItemIdentifiers.COINS, 20]]);
  const player = {
    getAttribute: (key) => key === 'quest.death_plateau.stage' ? 80 : 0,
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
  };
  const [handleChoice] = custom.get('npc-dialogue:choice');
  handleChoice({ player, npcId: api.core.NpcIdentifiers.TENZING, option: 'OK, sounds good.' });
  assert.equal(inventory.get(api.core.ItemIdentifiers.COINS), 8);
  assert.equal(inventory.get(api.core.ItemIdentifiers.CLIMBING_BOOTS), 1);

  handleChoice({ player, npcId: api.core.NpcIdentifiers.TENZING, option: 'OK, sounds good.' });
  assert.equal(inventory.get(api.core.ItemIdentifiers.COINS), 8, 'do not charge twice when the boots are already held');
});

test('an unlocked Troll Stronghold storeroom door falls through to the shared door toggler', () => {
  const { api: base } = mockApi();
  let objectHandler;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => { objectHandler = handler; }
      : target[prop],
  });
  delete require.cache[require.resolve('../plugins/quests/quests/EadgarsRuse.Quest')];
  require('../plugins/quests/quests/EadgarsRuse.Quest')(api);
  const player = { getAttribute: (key) => key === 'quest.eadgars_ruse.stage' ? 110 : 0 };
  const event = { player, objectId: api.core.ObjectIdentifiers.STOREROOM_DOOR, handled: false };
  objectHandler(event);
  assert.equal(event.handled, false, 'the quest plugin leaves an unlocked door for Doors.plugin.js to open');
});

test('the Sphinx replaces a lost normal catspeak amulet for a cat guardian after Icthlarin’s Little Helper', () => {
  const handlers = { conditions: [], custom: new Map() };
  const { api: base } = mockApi();
  let cats = [];
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcDialogueCondition') return (handler) => handlers.conditions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => handlers.custom.set(name, [...(handlers.custom.get(name) ?? []), handler]);
      if (prop === 'getWorld') return () => ({ getNpcs: () => cats });
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/TailOfTwoCats.Quest')];
  require('../plugins/quests/quests/TailOfTwoCats.Quest')(api);
  const attrs = new Map([['quest.ictlharins_little_helper.stage', 70]]);
  const inventory = new Map();
  const messages = [];
  let wornAmulet = null;
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - inventory.size,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getEquipment: () => ({ get: () => wornAmulet }),
    sendMessage: (message) => messages.push(message),
  };
  cats = [{ getOwner: () => player, getId: () => api.core.NpcIdentifiers.CAT }];
  const lostCondition = {
    npcId: api.core.NpcIdentifiers.SPHINX,
    player,
    text: 'If the player lost the amulet of catspeak:',
  };
  const resolve = () => handlers.conditions.map((handler) => handler(lostCondition)).find((value) => value !== null);

  assert.equal(resolve(), true, 'a cat guardian who finished the prerequisite can recover the amulet');
  const wornCondition = { npcId: api.core.NpcIdentifiers.SPHINX, player, text: 'If a catspeak amulet is worn:' };
  const notWornCondition = { ...wornCondition, text: 'If a catspeak amulet is not worn:' };
  const answer = (condition) => handlers.conditions.map((handler) => handler(condition)).find((value) => value !== null);
  assert.equal(answer(wornCondition), false);
  assert.equal(answer(notWornCondition), true);
  wornAmulet = { getId: () => api.core.ItemIdentifiers.CATSPEAK_AMULET };
  assert.equal(answer(wornCondition), true);
  assert.equal(answer(notWornCondition), false);
  wornAmulet = null;
  inventory.set(api.core.ItemIdentifiers.CATSPEAK_AMULET_E_, 1);
  assert.equal(resolve(), false, 'the recovery choice is hidden while either catspeak amulet is held');
  inventory.clear();
  cats = [];
  assert.equal(resolve(), false, 'the Sphinx requires a cat follower');
  cats = [{ getOwner: () => player, getId: () => api.core.NpcIdentifiers.CAT }];
  attrs.set('quest.ictlharins_little_helper.stage', 0);
  assert.equal(resolve(), false, 'the Sphinx recovery is gated on the completed prerequisite');
  attrs.set('quest.ictlharins_little_helper.stage', 70);

  for (const handler of handlers.custom.get('npc-dialogue:action') ?? []) {
    const event = { kind: 'message', player, stepId: 'vA_xBM', text: 'The Sphinx hands you an amulet of catspeak.', handled: false };
    handler(event);
    assert.equal(event.handled, true);
  }
  assert.equal(inventory.get(api.core.ItemIdentifiers.CATSPEAK_AMULET), 1, 'the transcript action grants the normal amulet');
  assert.match(messages.at(-1), /hands you an amulet of catspeak/);
});

test('Gertrude sells a replacement kitten for 100 coins after her quest', () => {
  const handlers = { conditions: [], custom: new Map() };
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcDialogueCondition') return (handler) => handlers.conditions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => handlers.custom.set(name, [...(handlers.custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/GertrudesCat.Quest')];
  require('../plugins/quests/quests/GertrudesCat.Quest')(api);
  const attrs = new Map([['quest.gertrudes_cat.stage', 6]]);
  const inventory = new Map([[api.core.ItemIdentifiers.COINS, 123]]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      isFull: () => inventory.size >= 28,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    sendMessage() {},
  };
  const gertrude = { npcId: api.core.NpcIdentifiers.GERTRUDE, player, text: 'If the player has at least 100 coins:' };
  assert.equal(handlers.conditions.map((handler) => handler(gertrude)).find((value) => value !== null), true);
  const event = { player, npcId: api.core.NpcIdentifiers.GERTRUDE, stepId: 'Q44J0B', handled: false };
  for (const handler of handlers.custom.get('npc-dialogue:action') ?? []) handler(event);
  assert.equal(event.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.COINS), 23);
  assert.equal(inventory.get(api.core.ItemIdentifiers.PET_KITTEN), 1);
});

test('Ratcatchers restores the missing kitten menu branch from Gertrude’s transcript', () => {
  const { restoreGertrudeKittenOption } = require('../plugins/quests/quests/Ratcatchers.Quest')._test;
  const transcripts = require('../data/definitions/npc-dialogues.json');
  const source = transcripts.Ratcatchers.variants['talking-to-gertrude-talking-to-gertrude-again-after-starting-the-quest'];
  const find = (steps) => {
    for (const step of steps ?? []) {
      const option = (step.options ?? []).find((entry) => entry.text === 'Do you have any more kittens?');
      if (option) return option;
      for (const nested of step.options ?? []) {
        const match = find(nested.steps);
        if (match) return match;
      }
      const match = find(step.steps);
      if (match) return match;
    }
    return null;
  };
  const before = find(source);
  assert.equal(before.steps, undefined, 'the Ratcatchers export omits this option branch');
  const restored = restoreGertrudeKittenOption(source);
  const option = find(restored);
  assert.ok(option.steps.some((step) => step.player === 'Do you have any more kittens?'));
  assert.ok(option.steps.some((step) => step.type === 'condition' && step.text.includes('at least 100 coins')));
  assert.equal(JSON.stringify(option.steps).includes('Q44J0B'), true, 'the purchase keeps Gertrude’s canonical hand-out action');
  assert.equal(before.steps, undefined, 'the canonical transcript data remains untouched');
});

test('Dragon Slayer II lets a cat guardian reach the Sphinx’s general amulet-recovery dialogue', () => {
  const { restoreSphinxGeneralTopic } = require('../plugins/quests/quests/DragonSlayerII.Quest')._test;
  const transcripts = require('../data/definitions/npc-dialogues.json');
  const source = transcripts['Dragon Slayer II'].variants['bob-the-cat-talking-to-the-sphinx'];
  const locate = (steps) => {
    for (const step of steps ?? []) {
      const option = (step.options ?? []).find((entry) => entry.text === 'Talk about something else.');
      if (option) return option;
      for (const nested of step.options ?? []) {
        const match = locate(nested.steps);
        if (match) return match;
      }
      const match = locate(step.steps);
      if (match) return match;
    }
    return null;
  };
  assert.equal(locate(source).steps, undefined, 'the DS2 export leaves the general-topic jump empty');
  const restored = restoreSphinxGeneralTopic(source);
  const option = locate(restored);
  const text = JSON.stringify(option.steps);
  assert.match(text, /Do you have a spare amulet of catspeak\?/);
  assert.match(text, /vA_xBM/);
});

test('Dragon Slayer II selects the Oneiromancer’s Robert-memory transcript only after the Sphinx sends Bob', () => {
  const { oneiromancerDialogueVariant } = require('../plugins/quests/quests/DragonSlayerII.Quest')._test;
  const before = { npcId: 3835, stage: 7, dreamProgress: 1, hasDreamPotion: false };
  assert.equal(oneiromancerDialogueVariant(before), null, 'the Oneiromancer transcript stays gated before the Sphinx completes her memory step');
  assert.equal(oneiromancerDialogueVariant({ ...before, dreamProgress: 2 }),
    'robert-the-strong-talking-to-the-oneiromancer-before-making-the-dream-potion');
  assert.equal(oneiromancerDialogueVariant({ ...before, dreamProgress: 2, hasDreamPotion: true }),
    'robert-the-strong-talking-to-the-oneiromancer-before-making-the-dream-potion-talking-to-her-after-making-the-dream-potion');
  assert.equal(oneiromancerDialogueVariant({ ...before, npcId: 12345, dreamProgress: 2 }), null);
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

test('Dragon Slayer II mirrors compact stages to the cache quest milestones in varbit 6104', () => {
  const { api } = mockApi();
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { getRegisteredQuests, sendQuestVarps } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((row) => row.key === 'dragon_slayer_ii').at(-1);
  const attributes = new Map();
  const varbits = new Map();
  const sender = new Proxy({}, { get: (_t, key) => (key === 'sendVarbit'
    ? (id, value) => (varbits.set(id, value), sender)
    : () => sender) });
  const player = { getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), getPacketSender: () => sender };

  quest.setStage(player, 1);
  assert.equal(varbits.get(6104), 5, 'after Alec, native stage 5 keeps Dallas visible at Musa Point');
  varbits.clear();
  sendQuestVarps({ player });
  assert.equal(varbits.get(6104), 5, 'the same native value is restored at login');
  quest.setStage(player, quest.completionValue);
  assert.equal(varbits.get(6104), 210, 'completion follows the native QuestHelper terminal stage');
});

test('Dragon Slayer II Brundt handler yields before the leader council stage', () => {
  const { api: base } = mockApi();
  let brundtTalk;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcInteraction'
      ? (name, options) => { if (name === 'Brundt the Chieftain') brundtTalk = options['Talk-to']; }
      : target[prop],
  });
  delete require.cache[require.resolve('../plugins/quests/quests/DragonSlayerII.Quest')];
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const player = { getAttribute: (key) => key === 'quest.dragon_slayer_ii.stage' ? 7 : 0 };
  const event = {
    player,
    npcId: api.core.NpcIdentifiers.BRUNDT_THE_CHIEFTAIN_6,
    definition: { getName: () => 'Brundt the Chieftain' },
  };
  assert.equal(brundtTalk(event), false, 'other quests may handle Longhall Brundt before the leader chapter');
});

test('Dragon Slayer II follows the cache blockage Investigate → Mine → Enter morphs', () => {
  const objectHandlers = [];
  const logins = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction' ? (handler) => objectHandlers.push(handler)
      : prop === 'onPlayerLogin' ? (handler) => logins.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((row) => row.key === 'dragon_slayer_ii').at(-1);
  const attributes = new Map();
  const varbits = new Map();
  const messages = [];
  const sender = new Proxy({}, { get: (_t, key) => (key === 'sendVarbit'
    ? (id, value) => (varbits.set(id, value), sender)
    : () => sender) });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => sender,
    getInventory: () => ({ getAmount: (id) => id === 1265 ? 1 : 0 }),
    moveTo() {},
    sendMessage: (message) => messages.push(message),
  };
  quest.setStage(player, 3);
  const handle = objectHandlers[0];
  const atBlockage = { x: 2860, y: 9648, z: 0 };
  const click = (id, action) => handle({
    player, objectId: 29873, location: atBlockage, clickType: 1,
    definition: { id, getInteractions: () => [action] },
  });
  assert.equal(click(32165, 'Investigate'), true);
  assert.equal(varbits.get(6104), 16);
  assert.equal(click(32167, 'Mine'), true);
  assert.equal(varbits.get(6104), 17);
  assert.equal(click(32169, 'Enter'), true);
  assert.equal(quest.getStage(player), 4);
  assert.equal(varbits.get(6104), 17, 'native varbit 17 keeps the mural room at the correct quest stage');
  attributes.set('dragon-slayer-ii:crandor-blockage-progress', 25);
  quest.setStage(player, 3);
  varbits.clear();
  for (const login of logins) login({ player });
  assert.equal(varbits.get(6104), 17, 'the current transformed object state is restored at login');
  assert.equal(messages.length, 3);
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
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 9]]);
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
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 10, 'anvil advances only after the forge is lit');
  assert.equal(counts.get(core.ItemIdentifiers.DRAGON_KEY), 1);
  assert.equal(counts.get(core.ItemIdentifiers.ANCIENT_KEY), 0);
  assert.equal(counts.get(core.ItemIdentifiers.DRAGON_KEY_PIECE_4), 0);
});

test('Dragon Slayer II registers the Ungael Cave Enter action with a cache ID guard', () => {
  const { api: base } = mockApi();
  let caveActions;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (name, actions) => { if (name === 'Cave') caveActions = actions; }
      : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  assert.equal(typeof caveActions?.Enter, 'function');

  const messages = [];
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 8]]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    sendMessage: (message) => messages.push(message),
  };
  const wrongCave = caveActions.Enter({
    player, objectId: api.core.ObjectIdentifiers.CAVE_62,
    definition: { id: api.core.ObjectIdentifiers.CAVE_62 + 1 },
    location: { x: 2248, y: 4077, z: 0 },
  });
  assert.equal(wrongCave, false, 'another Cave with Enter must fall through');

  const blocked = caveActions.Enter({
    player, objectId: api.core.ObjectIdentifiers.CAVE_62,
    definition: { id: api.core.ObjectIdentifiers.CAVE_62 },
    location: { x: 2248, y: 4077, z: 0 },
  });
  assert.equal(blocked, true, 'the actual Ungael cave consumes its locked entrance action');
  assert.match(messages.at(-1), /Vorkath blocks the way/);
});

test('Dragon Slayer II completes Veos boat travel after the narrated destination is chosen', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 8]]);
  let movedTo;
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    moveTo: (location) => { movedTo = [location.getX(), location.getY(), location.getZ()]; },
  };
  const choose = (option) => handlers.custom.get('npc-dialogue:choice').forEach((handler) =>
    handler({ player, npcId: api.core.NpcIdentifiers.VEOS_4, option }));
  const line = () => {
    const event = { player, npcId: api.core.NpcIdentifiers.VEOS_4, text: "As you wish, I hope you don't get seasick, it is a  long voyage." };
    handlers.custom.get('npc-dialogue:line').forEach((handler) => handler(event));
    event.after?.();
  };

  choose("I'd like to travel to Port Piscarilius, please.");
  line();
  assert.deepEqual(movedTo, [1825, 3691, 0]);
  assert.equal(attrs.get('dragon-slayer-ii:veos-travel-destination'), null);

  movedTo = undefined;
  choose("I'd like to travel to Land's End, please.");
  line();
  assert.deepEqual(movedTo, [1504, 3401, 0]);
});

test('Dragon Slayer II handles Veos direct cache travel options by their visible action', () => {
  const { api: base } = mockApi();
  const actions = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcInteraction'
      ? (name, options) => { if (name === 'Veos') actions.push(options); }
      : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 8]]);
  let movedTo;
  const player = {
    getAttribute: (key) => attrs.get(key),
    moveTo: (location) => { movedTo = [location.getX(), location.getY(), location.getZ()]; },
    sendMessage: () => {},
  };
  const handler = actions[0]["Land's End"];
  assert.equal(typeof handler, 'function');
  const event = {
    player, npcId: api.core.NpcIdentifiers.VEOS_5, clickType: 3, handled: false,
    definition: { getActions: () => ['Talk-to', 'Port Piscarilius', "Land's End"] },
  };
  assert.equal(handler(event), true);
  assert.deepEqual(movedTo, [1504, 3401, 0]);
  assert.equal(handler({ ...event, npcId: api.core.NpcIdentifiers.VEOS_5 + 100 }), false);
  attrs.set('quest.dragon_slayer_ii.stage', 7);
  assert.equal(handler(event), false, 'the voyage is scoped to the DS2 key chapters');
});

test('Port Piscarilius spawns the cache-active Veos with both onward boat options', async () => {
  const spawn = require('../data/definitions/npc-spawns.json')
    .find(({ x, y, name }) => name === 'Veos' && x === 1825 && y === 3691);
  assert.equal(spawn?.id, 10724, '2147 is a null transform parent with no interaction options');
  const { CachePipeline } = require('../dist/game/cache/CachePipeline');
  const { CacheDefinitions } = require('../dist/game/cache/CacheDefinitions');
  await CachePipeline.initialize();
  const actions = CacheDefinitions.getNpc(spawn.id).actions;
  assert.equal(actions[0], 'Talk-to');
  assert.equal(actions[2], 'Port Piscarilius');
  assert.equal(actions[3], "Land's End");
});

test('Dragon Slayer II unlocks the northern Ungael exit when either awake Vorkath form dies', () => {
  const deaths = [];
  const logins = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcDeath' ? (handler) => deaths.push(handler)
      : prop === 'onPlayerLogin' ? (handler) => logins.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const values = [];
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:ungael-trip', true],
  ]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getPacketSender: () => ({ sendVarbit: (id, value) => values.push([id, value]) }),
    sendMessage() {},
  };
  for (const id of [api.core.NpcIdentifiers.VORKATH_4, api.core.NpcIdentifiers.VORKATH_5]) {
    attrs.set('dragon-slayer-ii:vorkath-defeated', false);
    deaths[0]({ killer: player, npc: { getId: () => id } });
    assert.equal(attrs.get('dragon-slayer-ii:vorkath-defeated'), true, `Vorkath form ${id} records the victory`);
    assert.deepEqual(values.at(-1), [6108, 30], 'the cache morph exposes the northern climb-over after Vorkath dies');
  }
  attrs.set('dragon-slayer-ii:vorkath-defeated', false);
  deaths[0]({ killer: player, npc: { getId: () => api.core.NpcIdentifiers.VORKATH_4 + 20 } });
  assert.equal(attrs.get('dragon-slayer-ii:vorkath-defeated'), false, 'an unrelated NPC cannot unlock the cave');
  attrs.set('dragon-slayer-ii:vorkath-defeated', true);
  values.length = 0;
  logins.forEach((handler) => handler({ player }));
  assert.deepEqual(values, [[6108, 30]], 'the climb-over stays open after relogging');
  attrs.set('dragon-slayer-ii:vorkath-defeated', false);
  logins.forEach((handler) => handler({ player }));
  assert.deepEqual(values.at(-1), [6108, 0], 'unfinished players see the blocked cache morph');
});

test('Dragon Slayer II locator orb points on eight compass directions and cannot kill its user', () => {
  const actions = new Map();
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemAction'
      ? (name, handlers) => actions.set(name, handlers)
      : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:morytania-step', 5],
    ['dragon-slayer-ii:locator-target', [10, 10]],
  ]);
  const inventory = new Map([[api.core.ItemIdentifiers.LOCATOR_ORB, 1], [api.core.ItemIdentifiers.SPADE, 1]]);
  const pending = [];
  const messages = [];
  let hitpoints = 99;
  const player = {
    getAttribute: (key) => attrs.get(key),
    getInventory: () => ({ getAmount: (id) => inventory.get(id) ?? 0, getFreeSlots: () => 20, adds: () => {} }),
    getLocation: () => ({ x: 0, y: 0, getX: () => 0, getY: () => 0 }),
    getHitpoints: () => hitpoints,
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pending.push(...hits) }) }),
    sendMessage: (message) => messages.push(message),
  };
  const orbAction = { player, handled: false };
  actions.get('Locator orb').Feel(orbAction);
  assert.equal(orbAction.handled, true, 'the quest action suppresses the item fallback');
  assert.match(messages.at(-1), /north-east/);
  assert.equal(pending.at(-1).getDamage(), 10);

  hitpoints = 4;
  actions.get('Locator orb').Feel({ player, handled: false });
  assert.equal(pending.at(-1).getDamage(), 3, 'orb damage stops at 1 hitpoint');
  const before = pending.length;
  hitpoints = 1;
  const lastOrbAction = { player, handled: false };
  actions.get('Locator orb').Feel(lastOrbAction);
  assert.equal(lastOrbAction.handled, true);
  assert.equal(pending.length, before, 'the orb never queues lethal damage');

  const digAction = { player, handled: false };
  actions.get('Spade').Dig(digAction);
  assert.equal(digAction.handled, true, 'wrong dig spots are handled by the quest');
});

test('Dragon Slayer II Fossil Island map caches yield all 24 distinct, reclaimable pieces', () => {
  const firstClicks = [];
  const interfaceClicks = [];
  const { api: base, handlers } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectFirstClick'
      ? (_objects, handler) => firstClicks.push(handler)
      : prop === 'onInterfaceActionClick' ? (handler) => interfaceClicks.push(handler)
      : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  runtime.startTranscript = originalStartTranscript;
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 5]]);
  const amounts = new Map();
  const messages = [];
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => amounts.get(id) ?? 0,
      adds: (id, count) => amounts.set(id, (amounts.get(id) ?? 0) + count),
      deleteNumber: (id, count) => amounts.set(id, Math.max(0, (amounts.get(id) ?? 0) - count)),
      getFreeSlots: () => 28,
    }),
    sendMessage: (message) => messages.push(message),
  };
  const search = firstClicks.find((handler) => handler.toString().includes('MAP_SOURCES.find'));
  assert.equal(typeof search, 'function');
  const sources = [
    [29911, 3764, 3872, 0], [29912, 3766, 3873, 1], [29913, 3755, 3873, 0],
    [29914, 3764, 3861, 0], [29915, 3790, 3876, 0],
  ];
  for (const [objectId, x, y, z] of sources) assert.equal(search({ player, objectId, location: { x, y, z } }), true);
  const pieces = Array.from({ length: 24 }, (_, i) => (i === 0 ? api.core.ItemIdentifiers.MAP_PIECE : api.core.ItemIdentifiers[`MAP_PIECE_${i + 1}`]));
  assert.equal(pieces.reduce((sum, id) => sum + (amounts.get(id) ?? 0), 0), 24);
  assert.ok(pieces.every((id) => amounts.get(id) === 1), 'each source contributes its own distinct map scraps');
  search({ player, objectId: 29911, location: { x: 3764, y: 3872, z: 0 } });
  assert.equal(pieces.reduce((sum, id) => sum + (amounts.get(id) ?? 0), 0), 24, 'completed source does not duplicate pieces');
  amounts.set(pieces[0], 0);
  search({ player, objectId: 29911, location: { x: 3764, y: 3872, z: 0 } });
  assert.equal(amounts.get(pieces[0]), 1, 'a lost piece can be recovered before Dallas takes it');

  attrs.set('dragon-slayer-ii:fossil-map-handed-in', 0xffffff);
  const sentVarbits = new Map();
  const packet = new Proxy({}, { get: (_target, key) => (...args) => {
    if (key === 'sendVarbit') sentVarbits.set(args[0], args[1]);
    return packet;
  } });
  player.getPacketSender = () => packet;
  const mapCondition = handlers.condition.find((handler) => handler.toString().includes('rs8Q9u'));
  assert.equal(mapCondition({ player, stepId: 'rs8Q9u' }), false, 'handed-in pieces continue through the positive dialogue branch');
  assert.equal(mapCondition({ player, stepId: 'nJTruP' }), false, 'all 24 pieces suppress the incomplete branch');
  assert.equal(mapCondition({ player, stepId: 'LkwLY1' }), true, 'all 24 handed-in pieces unlock the map-completion choice');
  const mapAction = handlers.custom.get('npc-dialogue:action').find((handler) => handler.toString().includes('ACTION_MAP_COMPLETE'));
  const mapActionEvent = { player, stepId: 'dragon-slayer-ii:fossil-map-complete', handled: false, end: false };
  mapAction(mapActionEvent);
  assert.equal(attrs.get('dragon-slayer-ii:fossil-map-puzzle-ready'), true, 'the affirmative dialogue choice starts the puzzle');
  assert.equal(mapActionEvent.handled, true);
  assert.equal(mapActionEvent.end, true);
  assert.equal(sentVarbits.get(6104), 45, 'the native map loc morphs to its puzzle option after the choice');
    const openMap = firstClicks.find((handler) => handler.name === 'interactWithFossilMap');
    assert.equal(openMap({ player, objectId: 29910, definition: { id: 32443 }, location: { x: 3764, y: 3869, z: 0 } }), true,
      'the cache placement opens the map puzzle after the canonical completion choice morph');
    assert.equal(sentVarbits.get(6156), 2, 'the cache receives a shuffled tile position');
    assert.equal(sentVarbits.get(6166), 1, 'the cache receives a non-solved tile rotation');
    const clickPuzzle = interfaceClicks.at(-1);
    const encodeArgs = (values) => Buffer.from(values.flatMap((value) => {
      let encoded = (value << 1) ^ (value >> 31);
      const bytes = [];
      while (encoded > 0x7f) { bytes.push((encoded & 0x7f) | 0x80); encoded >>>= 7; }
      bytes.push(encoded);
      return bytes;
    }));
    const grid = (305 << 16) | 1;
    const editable = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35];
    const positions = attrs.get('dragon-slayer-ii:fossil-map-positions');
    const rotations = attrs.get('dragon-slayer-ii:fossil-map-rotations');
    for (const index of editable) {
      const target = editable.indexOf(index) + 1;
      if (positions[index] === target) continue;
      const from = positions.indexOf(target);
      clickPuzzle({ player, groupId: 305, action: 0, scriptTrigger: true, argsData: encodeArgs([grid, index, grid, from]) });
    }
    for (const index of editable) {
      while (rotations[index] !== 0) {
        clickPuzzle({ player, groupId: 305, action: 0, scriptTrigger: true, argsData: encodeArgs([2, grid, index]) });
      }
    }
  assert.equal(attrs.get('dragon-slayer-ii:fossil-map-solved'), true);
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 6, 'solving the native position/rotation puzzle unlocks the boat chapter');
});

test('Dragon Slayer II restores the Karamja plinth when its key piece was lost', () => {
  const objectHandlers = [];
  const objects = [];
  const { api: base } = mockApi();
  const objectManager = { register() {}, deregister() {} };
  const core = Object.assign({}, base.core, {
    ObjectManager: objectManager,
    TemplatedInstanceArea: class {
      constructor(width, height) { this.width = width; this.height = height; this.objects = []; }
      setChunk() {}
      enter() {}
      tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
      getBaseX() { return 8192; }
      getBaseY() { return 1600; }
      add(object) { this.objects.push(object); objects.push(object); }
      remove(object) { this.objects = this.objects.filter((entry) => entry !== object); }
      getName() { return 'Karamja test'; }
    },
  });
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'spawnNpc' ? () => null
        : prop === 'onObjectFirstClick' ? (...args) => {
          const handler = args.find((arg) => typeof arg === 'function');
          if (handler) objectHandlers.push(handler);
        }
          : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const items = new Map();
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 9],
    ['dragon-slayer-ii:key-parts', 15],
  ]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'Karamja recovery test',
    getInventory: () => ({
      getAmount: (id) => items.get(id) ?? 0,
      getFreeSlots: () => 28 - [...items.values()].reduce((sum, amount) => sum + amount, 0),
      adds: (id) => items.set(id, (items.get(id) ?? 0) + 1),
    }),
    moveTo() {},
    sendMessage() {},
  };
  const enter = objectHandlers.find((handler) => handler.toString().includes('KARAMJA_START'));
  assert.equal(typeof enter, 'function');
  enter({ player, objectId: core.ObjectIdentifiers.CAVE_63, location: { x: 2943, y: 2894, z: 0 } });
  assert.equal(attrs.get('dragon-slayer-ii:key-parts'), 14, 'a stale possession bit cannot strand the player after reaching the forge');
  assert.equal(objects.at(-1).getId(), core.ObjectIdentifiers.PLINTH_17, 'the piece becomes available again');
  const recover = objectHandlers.find((handler) => handler.name === 'handleKaramjaPlinth');
  assert.equal(recover({
    player,
    objectId: core.ObjectIdentifiers.PLINTH_17,
    location: { x: 8224, y: 1648, z: 0 },
  }), true);
  assert.equal(items.get(core.ItemIdentifiers.DRAGON_KEY_PIECE), 1, 'the piece can be reclaimed before forging');
});

test('Dragon Slayer II laboratory copies every cache chunk containing its six notes', () => {
  const objectHandlers = [];
  const chunks = [];
  let dimensions;
  let spawn;
  const { api: base } = mockApi();
  const core = Object.assign({}, base.core, {
    TemplatedInstanceArea: class {
      constructor(width, height) { dimensions = [width, height]; }
      setChunk(plane, chunkX, chunkY, template) {
        if (plane === 0) chunks.push({ chunkX, chunkY, ...template });
      }
      enter() {}
      getBaseX() { return 8192; }
      getBaseY() { return 1600; }
      tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
      getName() { return 'Ungael lab test'; }
    },
  });
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (...args) => {
        const handler = args.find((arg) => typeof arg === 'function');
        if (handler) objectHandlers.push(handler);
      }
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:vorkath-defeated', true],
  ]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'Lab map test',
    moveTo: (location) => { spawn = location; },
    sendMessage() {},
  };
  const enter = objectHandlers[0];
  assert.equal(typeof enter, 'function');
  enter({ player, objectId: core.ObjectIdentifiers.CAVE_62, location: { x: 2248, y: 4077, z: 0 } });
  assert.deepEqual(dimensions, [6, 4]);
  assert.deepEqual(chunks[0], { chunkX: 0, chunkY: 0, sourceChunkX: 281, sourceChunkY: 1306, sourcePlane: 0, rotation: 0 });
  assert.deepEqual(chunks.at(-1), { chunkX: 5, chunkY: 3, sourceChunkX: 286, sourceChunkY: 1309, sourcePlane: 0, rotation: 0 });
  assert.deepEqual(spawn, { x: 8204, y: 1616, z: 0 }, 'the entrance lands at the cache lever and inside the expanded template');
});

test('Dragon Slayer II Ungael lever limits the key chest to its 30-tick window', () => {
  const objectHandlers = [];
  let cycle = 100;
  const { api: base } = mockApi();
  const core = Object.assign({}, base.core, {
    World: Object.assign({}, base.core.World, { getProcessCycle: () => cycle }),
    TemplatedInstanceArea: class {
      constructor() { this.x = 8192; this.y = 1600; }
      setChunk() {}
      enter() {}
      getBaseX() { return this.x; }
      getBaseY() { return this.y; }
      tile(x, y, z) { return { x: this.x + x, y: this.y + y, z }; }
      getName() { return 'Ungael lab test'; }
    },
  });
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (...args) => {
        const handler = args.find((arg) => typeof arg === 'function');
        if (handler) objectHandlers.push(handler);
      }
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { ItemIdentifiers: I, ObjectIdentifiers: O } = core;
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:vorkath-defeated', true],
  ]);
  const items = new Map();
  const freeSlotResults = [];
  const messages = [];
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    getFreeSlots: () => freeSlotResults.length ? freeSlotResults.shift()
      : 28 - [...items.values()].reduce((sum, amount) => sum + amount, 0),
    adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'Ungael lever test',
    getRunEnergy: () => 20,
    getInventory: () => inventory,
    moveTo() {},
    sendMessage: (message) => messages.push(message),
  };
  const generic = objectHandlers[0];
  assert.equal(typeof generic, 'function');
  generic({ player, objectId: O.CAVE_62, location: { x: 2248, y: 4077, z: 0 } });
  const lab = attrs.get('dragon-slayer-ii:instance-area');
  assert.ok(lab, 'the cave creates the player’s laboratory instance');
  const use = (objectId, x, y, option) => generic({
    player, objectId, location: { x, y, z: 0 }, clickType: 1,
    definition: { getInteractions: () => [option] },
  });
  use(O.LEVER_55, 8204, 1616, 'Pull');
  assert.ok(messages.includes('You pull the lever. A door opens somewhere to the east!'));
  cycle = 131;
  use(O.STONE_CHEST_3, 8236, 1618, 'Search');
  assert.equal(inventory.getAmount(I.DRAGON_KEY_PIECE_3), 0, 'an expired door cannot be looted');
  cycle = 200;
  use(O.LEVER_55, 8204, 1616, 'Pull');
  cycle = 203;
  freeSlotResults.push(2, 0); // the chest's capacity check passes, but the item handout fails
  use(O.STONE_CHEST_3, 8236, 1618, 'Search');
  assert.equal(attrs.get('dragon-slayer-ii:key-parts') ?? 0, 0, 'a failed handout cannot set the earned-piece bit');
  assert.equal(inventory.getAmount(I.DRAGON_KEY_PIECE_3), 0);
  assert.equal(inventory.getAmount(I.ANCIENT_KEY), 0);
  use(O.STONE_CHEST_3, 8236, 1618, 'Search');
  assert.equal(inventory.getAmount(I.DRAGON_KEY_PIECE_3), 1);
  assert.equal(inventory.getAmount(I.ANCIENT_KEY), 1);
  assert.equal(attrs.get('dragon-slayer-ii:key-parts'), 4);
});

test('Dragon Slayer II Torfinn runs the cache quest dragons, checkpoints the waves, and changes Galvek phase', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const { api: base } = mockApi();
  const interactions = [];
  const deaths = [];
  const playerDeaths = [];
  const dialogueActions = [];
  const objectHandlers = [];
  const emittedRewards = [];
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => interactions.push({ name, options });
      if (prop === 'onNpcDeath') return (handler) => deaths.push(handler);
      if (prop === 'onPlayerDeath') return (handler) => playerDeaths.push(handler);
      if (prop === 'onObjectInteraction') return (handler) => { if (typeof handler === 'function') objectHandlers.push(handler); };
      if (prop === 'emitCustomEvent') return (name, payload) => { if (name === 'xpreward:open') emittedRewards.push(payload); };
      if (prop === 'onCustomEvent') return (name, handler) => {
        if (name === 'npc-dialogue:action') dialogueActions.push(handler);
      };
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcriptRequests = [];
  runtime.startTranscript = (...args) => { transcriptRequests.push(args[4]); return true; };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
    const core = api.core;
    const attributes = new Map([['quest.dragon_slayer_ii.stage', 12]]);
    let at = new core.Location(1456, 2968, 0);
    const messages = [];
    const pendingHits = [];
    const supplies = new Map();
    const rewardXp = new Map();
    let inventoryCapacity = 28;
    const packet = new Proxy({}, { get: (_target, _key) => (..._args) => packet });
    const player = {
      isPlayer: () => true, getAsPlayer: () => player, getIndex: () => 987654, getUsername: () => 'quest-wave-test',
      getArea: () => null, setArea: () => {}, getLocation: () => at, moveTo: (location) => { at = location; },
      getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
      getPacketSender: () => packet, sendMessage: (message) => messages.push(message),
      getInventory: () => ({
        getAmount: (id) => supplies.get(id) ?? 0,
        getFreeSlots: () => inventoryCapacity - [...supplies.values()].filter((amount) => amount > 0).length,
        adds: (id, amount = 1) => supplies.set(id, (supplies.get(id) ?? 0) + amount),
        deleteNumber: (id, amount = 1) => supplies.set(id, Math.max(0, (supplies.get(id) ?? 0) - amount)),
      }),
      getHitpoints: () => 99, getRunEnergy: () => 100, setRunEnergy: () => {},
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pendingHits.push(...hits) }) }),
      getSkillManager: () => ({
        decreaseCurrentLevel: () => {},
        addExperiences: (skill, amount) => rewardXp.set(skill, (rewardXp.get(skill) ?? 0) + amount),
        getExperience: (skill) => rewardXp.get(skill) ?? 0,
        addExperience: (skill, amount) => rewardXp.set(skill, (rewardXp.get(skill) ?? 0) + amount),
      }),
    };
    const torfinn = interactions.find(({ name }) => name === 'Torfinn').options['Talk-to'];
    torfinn({ player, npcId: core.NpcIdentifiers.TORFINN });
    dialogueActions.forEach((handler) => handler({ player, stepId: 'lXAPbM' }));
    assert.equal(attributes.get('dragon-slayer-ii:assault-defense-active'), true,
      'Torfinn’s yes response begins the ship-defense part');
    assert.deepEqual([at.getX(), at.getY(), at.getZ()], [1702, 5543, 1], 'the player boards Brundt’s ship');
    const area = attributes.get('dragon-slayer-ii:instance-area');
    const suppliesByObject = new Map([
      [core.ObjectIdentifiers.HAMMERS, core.ItemIdentifiers.HAMMER],
      [core.ObjectIdentifiers.WATER_CONTAINERS, core.ItemIdentifiers.WATER_CONTAINER],
      [core.ObjectIdentifiers.SWAMP_PASTE, core.ItemIdentifiers.SWAMP_PASTE_2],
      [core.ObjectIdentifiers.POTIONS, core.ItemIdentifiers.REVITALISATION_POTION],
    ]);
    const object = (objectId, location, option = 'Take') => objectHandlers[0]({
      player, objectId, location: { x: location.getX?.() ?? location.x, y: location.getY?.() ?? location.y, z: location.getZ?.() ?? location.z },
      clickType: 1, definition: { getInteractions: () => [option] },
    });
    for (const [objectId, itemId] of suppliesByObject) {
      object(objectId, { x: 1700, y: 5530, z: 1 });
      assert.equal(supplies.get(itemId), 1, `ship crate supplies item ${itemId}`);
    }
    for (let tick = 0; tick < 400; tick++) {
      area.process(player);
      for (const [key, damage] of [...area.assaultDamage]) {
        const [x, y, z] = key.split(',').map(Number);
        if (supplies.get(damage.item) === 0) {
          const crateId = [...suppliesByObject].find(([, itemId]) => itemId === damage.item)[0];
          object(crateId, { x: 1700, y: 5530, z: 1 });
        }
        object(damage.id, { x, y, z }, damage.action);
      }
    }
    assert.equal(attributes.get('dragon-slayer-ii:assault-defense-active'), false);
    assert.equal(attributes.get('dragon-slayer-ii:assault-ship-defended'), true);
    const wave = [core.NpcIdentifiers.RED_DRAGON_8, core.NpcIdentifiers.IRON_DRAGON_4,
      core.NpcIdentifiers.BRUTAL_GREEN_DRAGON_2, core.NpcIdentifiers.BLUE_DRAGON_12,
      core.NpcIdentifiers.GREEN_DRAGON_9, core.NpcIdentifiers.BLUE_DRAGON_13,
      core.NpcIdentifiers.GREEN_DRAGON_10, core.NpcIdentifiers.BLACK_DRAGON_12,
      core.NpcIdentifiers.STEEL_DRAGON_5, core.NpcIdentifiers.BRUTAL_RED_DRAGON_2,
      core.NpcIdentifiers.MITHRIL_DRAGON_2, core.NpcIdentifiers.ADAMANT_DRAGON_2,
      core.NpcIdentifiers.RUNE_DRAGON_3];
    for (let index = 0; index < 7; index++) {
      const dragon = attributes.get('dragon-slayer-ii:instance-boss');
      assert.equal(dragon.getId(), wave[index], `route opponent ${index + 1}`);
      deaths[0]({ killer: player, npc: dragon });
    }
    assert.equal(attributes.get('dragon-slayer-ii:assault-checkpoint'), 7);
    playerDeaths[0]({ player });
    torfinn({ player, npcId: core.NpcIdentifiers.TORFINN });
    dialogueActions.forEach((handler) => handler({ player, stepId: 'lXAPbM' }));
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getId(), wave[7], 'death resumes at the first grand-ship wave');
    for (let index = 7; index < wave.length; index++) {
      const dragon = attributes.get('dragon-slayer-ii:instance-boss');
      assert.equal(dragon.getId(), wave[index], `wave opponent ${index + 1}`);
      deaths[0]({ killer: player, npc: dragon });
    }
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 13);
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getId(), core.NpcIdentifiers.GALVEK_2);
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getMaxHitpoints(), 1200);
    const battleArea = attributes.get('dragon-slayer-ii:instance-area');
    for (let tick = 0; tick < 7; tick++) battleArea.process(player);
    const galvek = attributes.get('dragon-slayer-ii:instance-boss');
    assert.equal(galvek.getNpcTransformationId(), core.NpcIdentifiers.GALVEK_2, 'phase one uses the fire form');
    assert.ok(messages.some((message) => message.includes('launches a fireball')));
    at = new core.Location(at.getX() + 2, at.getY(), at.getZ());
    for (let tick = 0; tick < 3; tick++) battleArea.process(player);
    assert.equal(pendingHits.length, 0, 'moving two tiles avoids Galvek’s lethal fireball');
    for (const [hitpoints, expected] of [[899, core.NpcIdentifiers.GALVEK_4], [599, core.NpcIdentifiers.GALVEK_3], [299, core.NpcIdentifiers.GALVEK_5]]) {
      galvek.setHitpoints(hitpoints);
      battleArea.process(player);
      assert.equal(galvek.getNpcTransformationId(), expected, `Galvek changes phase at ${hitpoints} hitpoints`);
    }
    deaths[0]({ killer: player, npc: galvek });
    assert.equal(attributes.get('dragon-slayer-ii:galvek-defeated'), true,
      'only Galvek’s death marks the final boss as defeated');
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 13,
      'the quest remains active until Alec receives the report');
    inventoryCapacity = [...supplies.values()].filter((amount) => amount > 0).length;
    dialogueActions.forEach((handler) => handler({ player, stepId: 'b5j1wa' }));
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 13,
      'Alec does not complete the quest if the Locator Orb will not fit');
    inventoryCapacity++;
    dialogueActions.forEach((handler) => handler({ player, stepId: 'b5j1wa' }));
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 14,
      'Alec’s final transcript action completes the quest');
    assert.equal(supplies.get(core.ItemIdentifiers.LOCATOR_ORB), 1,
      'completion returns the locator orb');
    assert.deepEqual([...rewardXp.entries()], [
      [core.Skill.SMITHING, 80000], [core.Skill.MINING, 60000],
      [core.Skill.AGILITY, 50000], [core.Skill.THIEVING, 50000],
    ], 'completion directly grants the fixed skill XP alongside the lamps');
    const ellen = interactions.find(({ name }) => name === 'Ellen').options['Talk-to'];
    const trainingAction = dialogueActions.find((handler) => handler.name === 'handleEllenTrainingAction');
    ellen({ player, npcId: core.NpcIdentifiers.ELLEN });
    assert.equal(transcriptRequests.at(-1), 'standard-dialogue', 'Ellen offers combat training after completion');
    for (let count = 0; count < 4; count++) {
      const training = { player, npcId: core.NpcIdentifiers.ELLEN, stepId: 'P2tord', handled: false };
      trainingAction(training);
      assert.equal(training.handled, true);
      assert.deepEqual(emittedRewards.at(-1).skills, [
        core.Skill.ATTACK, core.Skill.STRENGTH, core.Skill.DEFENCE, core.Skill.HITPOINTS,
        core.Skill.RANGED, core.Skill.MAGIC,
      ]);
      assert.match(emittedRewards.at(-1).onConfirm(core.Skill.RANGED, 'Ranged'), /25,000 Ranged XP/);
    }
    assert.equal(attributes.get('dragon-slayer-ii:ellen-training-rewards'), 4,
      'Ellen grants the four combat XP rewards one at a time');
    assert.equal(rewardXp.get(core.Skill.RANGED), 100000,
      'four Ellen training claims award 25,000 XP each');
    ellen({ player, npcId: core.NpcIdentifiers.ELLEN });
    assert.equal(transcriptRequests.at(-1), 'after-claiming-experience-rewards', 'Ellen retires after four rewards');
    const fifthTraining = { player, npcId: core.NpcIdentifiers.ELLEN, stepId: 'P2tord', handled: false };
    trainingAction(fifthTraining);
    assert.equal(fifthTraining.handled, false, 'a fifth training interface cannot be opened');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Dragon Slayer II crypt uses canonical template locs and reachable native-varbit bust puzzle', async (t) => {
  const { CachePipeline } = require('../dist/game/cache/CachePipeline');
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  await CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  RegionManager.init();
  const { api: baseApi } = mockApi();
  let login;
  const api = new Proxy(baseApi, {
    get: (target, prop) => prop === 'onPlayerLogin' ? (handler) => { login = handler; } : target[prop],
  });
  const register = require('../plugins/quests/quests/DragonSlayerII.Quest');
  register(api);
  const { cryptPuzzle } = register._test;
  const area = cryptPuzzle.createArea('crypt-puzzle-test');
  t.after(() => area.destroy());
  const { ItemIdentifiers: I, ObjectIdentifiers: O } = api.core;
  const attributes = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:instance-area', area],
    ['dragon-slayer-ii:kourend-crypt-order', [I.AIVAS_BUST, I.TRISTAN_BUST, I.CAMORRA_BUST, I.ROBERT_BUST]],
    ['dragon-slayer-ii:kourend-crypt-placed', { south: I.TRISTAN_BUST }],
    ['dragon-slayer-ii:kourend-crypt-inspected', true],
    ['dragon-slayer-ii:key-parts', 7],
  ]);
  const inventoryItems = new Map();
  const varbits = new Map();
  const messages = [];
  const inventory = {
    getAmount: (id) => inventoryItems.get(id) ?? 0,
    getFreeSlots: () => 28 - [...inventoryItems.values()].reduce((sum, amount) => sum + amount, 0),
    adds: (id, amount = 1) => inventoryItems.set(id, (inventoryItems.get(id) ?? 0) + amount),
    deleteNumber: (id, amount = 1) => inventoryItems.set(id, Math.max(0, (inventoryItems.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => ({
      sendVarbit: (id, value) => { varbits.set(id, value); },
      sendConfig: () => {},
      sendQuestList: () => {},
      sendInterfaceFlagsRange: () => {},
    }),
    sendMessage: (message) => messages.push(message),
    moveTo: (location) => { player.location = location; },
    location: null,
  };
  const sourceLocation = (x, y, z = 1) => area.tile(x - cryptPuzzle.source.x, y - cryptPuzzle.source.y, z);
  const eventLocation = (x, y, z = 1) => {
    const location = sourceLocation(x, y, z);
    return { x: location.getX(), y: location.getY(), z: location.getZ() };
  };
  const cacheObjects = [
    [cryptPuzzle.tomb.id, cryptPuzzle.tomb.x, cryptPuzzle.tomb.y],
    ...cryptPuzzle.busts.map((bust) => [bust.templateObject, bust.location[0], bust.location[1]]),
    ...Object.values(cryptPuzzle.plinths).map((plinth) => [plinth.id, plinth.x, plinth.y]),
  ];
  for (const [id, x, y] of cacheObjects) {
    const tile = sourceLocation(x, y);
    assert.ok(area.getTemplateObjects(tile).some((object) => object.getId() === id),
      `template object ${id} exists at source ${x},${y},1`);
  }

  // The crypt creates only overlays at the real bust locs. Plinths and tomb
  // stay on their cache locs and use their native DS2 child transforms.
  inventory.adds(I.AIVAS_BUST);
  cryptPuzzle.reset(player, area, false, false);
  assert.equal(area.puzzleObjects.length, 4);
  for (const bust of cryptPuzzle.busts) {
    const object = area.puzzleObjects.find((entry) => {
      const location = entry.getLocation();
      return location.equals(sourceLocation(bust.location[0], bust.location[1]));
    });
    assert.ok(object, `dynamic bust overlay ${bust.label} stays on its real cache tile`);
    assert.equal(object.getType(), 11, `${bust.label} overlay retains the cache shape`);
    assert.equal(object.getFace(), bust.face, `${bust.label} overlay retains the cache rotation`);
    assert.equal(object.getId(), bust.item === I.AIVAS_BUST || bust.item === I.TRISTAN_BUST
      ? bust.emptyObject : bust.object, `${bust.label} overlay follows held/placed state`);
  }
  assert.deepEqual([...varbits.entries()].sort(([a], [b]) => a - b), [[6105, 25], [6152, 0], [6153, 1], [6154, 0], [6155, 0]]);

  // The tomb room sits beyond the crypt's two cache double-door thresholds.
  // Open them through the same shared door plugin players use before testing
  // puzzle-object reachability from the lower stair.
  const doorActions = new Map();
  const doorCore = {
    ...api.core,
    Sounds: { sendSound: () => {} },
    TaskManager: { cancelTasks: () => {}, submit: () => {} },
  };
  const doorApi = {
    core: doorCore,
    emitCustomEvent: () => {},
    onObjectInteraction: (name, actions) => doorActions.set(name, actions),
    onRegionLoaded: () => {},
    onPlayerProcess: () => {},
  };
  const doorPluginPath = require.resolve('../plugins/objects/Doors.plugin');
  delete require.cache[doorPluginPath];
  require(doorPluginPath).register(doorApi);
  const doorPlayer = { getPrivateArea: () => area, getUsername: () => 'crypt-puzzle-test' };
  for (const [id, x, y] of [[32406, 1503, 9956], [32405, 1503, 9944]]) {
    const door = area.resolveObject(id, sourceLocation(x, y));
    assert.ok(door, `cache double door ${id} exists at source ${x},${y},1`);
    doorActions.get('Large doors').Open({ player: doorPlayer, object: door, objectId: id, location: door.getLocation() });
  }

  // The real lower-floor landing is the west ladder at source (1479, 9950).
  // Check for at least one reachable approach tile per object; perimeter tiles
  // behind walls are expected to be unreachable and are not interaction routes.
  const start = [1479, 9950];
  const targets = [];
  const addApproaches = (label, { x, y, width, height }) => {
    const approaches = new Set();
    for (let px = x - 1; px <= x + width; px++) {
      for (let py = y - 1; py <= y + height; py++) {
        if (px >= x && px < x + width && py >= y && py < y + height) continue;
        approaches.add(`${px},${py}`);
      }
    }
    targets.push({ label, approaches });
  };
  addApproaches('Camorra tomb', cryptPuzzle.tomb);
  cryptPuzzle.busts.forEach((bust) => addApproaches(`${bust.label} bust`, { x: bust.location[0], y: bust.location[1], width: 1, height: 1 }));
  Object.entries(cryptPuzzle.plinths).forEach(([direction, plinth]) => addApproaches(`${direction} plinth`, plinth));
  const queue = [start];
  const seen = new Set([start.join(',')]);
  const directions = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    const from = sourceLocation(x, y);
    for (const [dx, dy] of directions) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (nx < 1472 || nx >= 1568 || ny < 9920 || ny >= 9984 || seen.has(key)) continue;
      const to = sourceLocation(nx, ny);
      if (!RegionManager.canMove(from.getX(), from.getY(), to.getX(), to.getY(), 1, 1, 1, area)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  const unreachableObjects = targets.filter(({ approaches }) => ![...approaches].some((tile) => seen.has(tile)));
  assert.deepEqual(unreachableObjects.map(({ label }) => label), [],
    `each puzzle object has a reachable interaction tile from the real lower stair; reached ${seen.size} tiles`);

  // Continue a real item-on-cache-plinth sequence after migration.
  const bustByItem = new Map(cryptPuzzle.busts.map((bust) => [bust.item, bust]));
  for (const item of [I.CAMORRA_BUST, I.ROBERT_BUST]) {
    const bust = bustByItem.get(item);
    assert.equal(cryptPuzzle.takeObject({ player, objectId: bust.object, location: eventLocation(...bust.location) }), true);
  }
  for (const [direction, item] of [['north', I.AIVAS_BUST], ['west', I.CAMORRA_BUST], ['east', I.ROBERT_BUST]]) {
    const plinth = cryptPuzzle.plinths[direction];
    const [x, y] = plinth.click;
    const event = { player, itemId: item, objectId: plinth.id, location: eventLocation(x, y), handled: false };
    assert.equal(cryptPuzzle.placeBust(event), true);
    assert.equal(event.handled, true);
  }
  assert.deepEqual(attributes.get('dragon-slayer-ii:kourend-crypt-placed'), {
    south: I.TRISTAN_BUST, north: I.AIVAS_BUST, west: I.CAMORRA_BUST, east: I.ROBERT_BUST,
  });
  assert.deepEqual([6105, 6152, 6153, 6154, 6155].map((id) => varbits.get(id)), [30, 3, 1, 4, 2]);
  const tomb = eventLocation(...cryptPuzzle.tomb.click);
  assert.equal(cryptPuzzle.takeObject({ player, objectId: O.TOMB_7, location: tomb }), true);
  assert.equal(inventory.getAmount(I.DRAGON_KEY_PIECE_4), 1);
  assert.equal(attributes.get('dragon-slayer-ii:kourend-crypt-key-collected'), true);
  assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 9);
  assert.equal(varbits.get(6105), 36, 'native cache tomb and bust transforms advance after the key is taken');
  attributes.set('dragon-slayer-ii:instance-area', null);
  varbits.clear();
  login({ player });
  assert.deepEqual([...varbits.entries()].filter(([id]) => [6105, 6152, 6153, 6154, 6155].includes(id)).sort(([a], [b]) => a - b),
    [[6105, 36], [6152, 3], [6153, 1], [6154, 4], [6155, 2]],
    'native crypt transforms are restored from earned placements and key on login');
  inventory.deleteNumber(I.DRAGON_KEY_PIECE_4);
  attributes.set('dragon-slayer-ii:instance-area', area);
  assert.equal(cryptPuzzle.takeObject({ player, objectId: O.TOMB_7, location: tomb }), true,
    'the completed tomb can replace a lost piece while the player is preparing the forge');
  assert.equal(inventory.getAmount(I.DRAGON_KEY_PIECE_4), 1);
  assert.ok(messages.some((message) => message.includes('dragon key piece')));
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

test('Dragon Slayer II follows Reldo to the cache-marked red bookcase in Varrock Library', () => {
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const objectInteractions = new Map();
  const actionHandlers = [];
  const transcriptVariants = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (name, actions) => { if (typeof name === 'string') objectInteractions.set(name, actions); }
      : prop === 'onCustomEvent'
        ? (name, handler) => { if (name === 'npc-dialogue:action') actionHandlers.push(handler); }
      : target[prop],
  });
  runtime.startTranscript = (_api, _player, _npcId, _page, variant) => {
    transcriptVariants.push(variant);
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:morytania-step', 1],
  ]);
  const items = new Map();
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    getFreeSlots: () => 28 - [...items.values()].reduce((sum, amount) => sum + amount, 0),
    adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => inventory,
    sendMessage() {},
  };
  const search = objectInteractions.get('Bookcase').Search;
  const wrongShelf = { player, objectId: 7181, location: { x: 3207, y: 3491, z: 0 }, handled: false };
  assert.equal(search(wrongShelf), false, 'an ordinary shelf does not substitute for the red census book');
  const markedShelf = { player, objectId: 32462, location: { x: 3211, y: 3495, z: 0 }, handled: false };
  search(markedShelf);
  assert.equal(markedShelf.handled, true);
  assert.equal(attrs.get('dragon-slayer-ii:morytania-step'), 2);
  assert.deepEqual(transcriptVariants, ['tristan-s-key-piece-finding-the-book']);
  const foundBook = { player, stepId: 'mF7UO1', handled: false };
  actionHandlers.forEach((handler) => handler(foundBook));
  assert.equal(foundBook.handled, true);
  assert.equal(inventory.getAmount(api.core.ItemIdentifiers.VARROCK_CENSUS_RECORDS), 1);
  const handBookToReldo = { player, stepId: '0ordv0', handled: false };
  actionHandlers.forEach((handler) => handler(handBookToReldo));
  assert.equal(handBookToReldo.handled, true);
  assert.equal(inventory.getAmount(api.core.ItemIdentifiers.VARROCK_CENSUS_RECORDS), 0);
});

test('Dragon Slayer II Robert death plays Bob’s memories before unlocking the key hunt', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const custom = new Map();
  const itemObjectHandlers = [];
  let deathHandler;
  let transcript;
  const api = new Proxy(mockApi().api, {
    get: (target, prop) => {
      if (prop === 'onNpcDeath') return (handler) => { deathHandler = handler; };
      if (prop === 'onItemOnObject') return (handler) => itemObjectHandlers.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      if (prop === 'emitCustomEvent') return () => {};
      return target[prop];
    },
  });
  runtime.startTranscript = (_api, _player, _npcId, _page, variant, select) => {
    const raw = require('../data/definitions/npc-dialogues.json')['Dragon Slayer II'].variants[variant];
    transcript = { variant, steps: select ? select(raw) : raw };
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 7],
    ['dragon-slayer-ii:dream-progress', 2],
  ]);
  let brazierLit = 0;
  const packet = new Proxy({}, { get: (_target, property) => property === 'getVarbit' ? () => brazierLit : () => packet });
  let currentArea = null;
  const moves = [];
  const messages = [];
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getPacketSender: () => packet,
    getLocation: () => new api.core.Location(1761, 3850, 0),
    getArea: () => currentArea,
    setArea: (area) => { currentArea = area; },
    getIndex: () => 1,
    isPlayer: () => true,
    getAsPlayer: () => player,
    moveTo(location) { moves.push([location.getX(), location.getY(), location.getZ()]); },
    getUsername: () => 'BobMemoryTest',
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      getFreeSlots: () => 20,
    }),
    sendMessage: (message) => messages.push(message),
  };
  const inventory = new Map([[api.core.ItemIdentifiers.DREAM_POTION, 1]]);
  const usePotion = {
    player,
    itemId: api.core.ItemIdentifiers.DREAM_POTION,
    // This is the actual Lunar Isle ceremonial brazier cache multiloc.
    objectId: 17025,
    handled: false,
  };
  itemObjectHandlers[0](usePotion);
  assert.equal(usePotion.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.DREAM_POTION), 1, 'an unlit brazier does not consume the potion');
  assert.equal(attrs.get('dragon-slayer-ii:instance-boss'), undefined);
  assert.match(messages.at(-1), /light the ceremonial brazier/i);
  brazierLit = 1;
  usePotion.handled = false;
  itemObjectHandlers[0](usePotion);
  assert.equal(usePotion.handled, true, 'the quest suppresses the generic Nothing interesting fallback');
  assert.equal(inventory.get(api.core.ItemIdentifiers.DREAM_POTION), 0);
  assert.equal(attrs.get('dragon-slayer-ii:instance-boss'), undefined, 'the dream starts only after the Yes choice');
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: 'z9kHar' });
  const dreamBoss = attrs.get('dragon-slayer-ii:instance-boss');
  assert.ok(dreamBoss, 'the transcript Yes action enters the dream');
  deathHandler({
    killer: player,
    npc: dreamBoss,
  });
  assert.equal(transcript.variant, 'robert-the-strong-robert-s-memories');
  assert.equal(transcript.steps.at(-1).id, 'dragon-slayer-ii:bob-memories-complete');
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 7, 'the next chapter waits for Bob’s memory scene');
  for (const handler of custom.get('npc-dialogue:action')) {
    handler({ player, stepId: 'dragon-slayer-ii:bob-memories-complete' });
  }
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 8, 'the key hunt opens after the scene finishes');
  assert.deepEqual(moves.at(-1), [2074, 3912, 0], 'the player returns to Bob beside Lunar Isle’s brazier');
});

test('Dragon Slayer II routes the roaming Bob and Sphinx dialogues before Lunar Isle', () => {
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const custom = new Map();
  const npcActions = new Map();
  const conditions = [];
  const varbits = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, actions) => npcActions.set(name, actions);
      if (prop === 'onNpcDialogueCondition') return (handler) => conditions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  const transcripts = [];
  runtime.startTranscript = (_api, _player, _npcId, _page, variant, select) => {
    const raw = require('../data/definitions/npc-dialogues.json')['Dragon Slayer II'].variants[variant];
    transcripts.push({ variant, steps: select ? select(raw) : raw });
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'dragon_slayer_ii').at(-1);

  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 7],
    ['dragon-slayer-ii:dream-progress', 0],
    ['dragon-slayer-ii:aivas-diary', true],
  ]);
  let equipped = new Set();
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getEquipment: () => ({ getAmount: (id) => equipped.has(id) ? 1 : 0 }),
    getPacketSender: () => ({ sendVarbit: (id, value) => varbits.push([id, value]) }),
    getInventory: () => ({ getAmount: () => 0 }),
  };
  assert.match(quest.buildJournal(player)[0], /Find Bob the Cat/);
  const bob = npcActions.get('Bob')['Talk-to'];
  const sphinx = npcActions.get('Sphinx')['Talk-to'];
  const invokeAction = (stepId) => custom.get('npc-dialogue:action').forEach((handler) => handler({ player, stepId }));

  assert.equal(attrs.get('dragon-slayer-ii:dream-progress'), 0);
  bob({ player, npcId: 1 });
  assert.equal(transcripts.at(-1).variant, 'bob-the-cat-talking-to-bob');
  assert.equal(transcripts.at(-1).steps.at(-1).id, 'dragon-slayer-ii:bob-first-talk-complete');
  invokeAction('dragon-slayer-ii:bob-first-talk-complete');
  assert.equal(attrs.get('dragon-slayer-ii:dream-progress'), 1);
  assert.match(quest.buildJournal(player)[0], /Sphinx in Sophanem/);

  equipped.add(api.core.ItemIdentifiers.CATSPEAK_AMULET_E_);
  assert.equal(conditions.flatMap((handler) => [
    handler({ player, stepId: 'i7XI9Q' }), handler({ player, stepId: 'gQ21dn' }),
  ]).filter(Boolean).length, 1, 'the transcript chooses the worn-amulet branch');
  sphinx({ player, npcId: 2 });
  assert.equal(transcripts.at(-1).variant, 'bob-the-cat-talking-to-the-sphinx');
  const sphinxChoice = transcripts.at(-1).steps.find((step) => step.type === 'choice');
  assert.equal(sphinxChoice.options[0].steps.at(-1).id, 'dragon-slayer-ii:sphinx-dream-complete');
  invokeAction('dragon-slayer-ii:sphinx-dream-complete');
  assert.equal(attrs.get('dragon-slayer-ii:dream-progress'), 2);
  assert.match(quest.buildJournal(player)[0], /Oneiromancer on Lunar Isle/);
  assert.deepEqual(varbits, [[6144, 1], [6145, 0]]);
  bob({ player, npcId: 1 });
  assert.equal(transcripts.at(-1).variant, 'robert-the-strong-talking-to-bob-on-lunar-isle');
});

test('Dragon Slayer II registers the cache-named roaming Bob through the live singular NPC hook', () => {
  const names = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcsInteraction') return undefined;
      if (prop === 'onNpcInteraction') return (name) => names.push(name);
      return target[prop];
    },
  });
  assert.doesNotThrow(() => require('../plugins/quests/quests/DragonSlayerII.Quest')(api));
  assert.ok(names.includes('Bob'), 'npc-spawns.json calls the roaming cat Bob');
  assert.ok(names.includes('Bob the Cat'), 'retain support for descriptive cache name variants');
  assert.ok(names.includes('Istoria') && names.includes('Jonathan'));
  assert.ok(names.includes('Sir Amik Varze') && names.includes('King Roald'));
});

test('Dragon Slayer II rowboat build consumes the Wiki supplies and uses the ready dialogue to travel', () => {
  const objects = new Map();
  const objectHandlers = [];
  const playerProcesses = [];
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
      if (prop === 'onPlayerProcess') return (handler) => playerProcesses.push(handler);
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
  const attributes = new Map([
    ['quest.dragon_slayer_ii.stage', 6],
    ['dragon-slayer-ii:jardric-talked-about-lithkren', true],
  ]);
  const amounts = new Map([[I.HAMMER, 1], [I.SAW, 1], [I.OAK_PLANK, 8], [I.SWAMP_PASTE, 10], [I.STEEL_NAILS, 7], [I.IRON_NAILS, 5], [I.DRAGON_KEY, 1]]);
  const messages = [];
  const sentVarbits = [];
  let destination;
  let playerLocation = { x: 3659, y: 3849, z: 0 };
  const packet = new Proxy({ sendVarbit: (id, value) => sentVarbits.push([id, value]) }, { get: (target, key) => target[key] ?? (() => packet) });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getMaxLevel: () => 50 }),
    getLocation: () => ({ getX: () => playerLocation.x, getY: () => playerLocation.y, getZ: () => playerLocation.z }),
    getPacketSender: () => packet,
    getInventory: () => ({
      getAmount: (id) => amounts.get(id) ?? 0,
      deleteNumber: (id, count) => amounts.set(id, (amounts.get(id) ?? 0) - count),
    }),
    sendMessage: (message) => messages.push(message),
    moveTo: (location) => { destination = [location.getX(), location.getY(), location.getZ()]; playerLocation = { x: destination[0], y: destination[1], z: destination[2] }; },
  };
  const buildEvent = {
    player, objectId: 29916, clickType: 1,
    definition: { id: O.ROWBOAT_SPACE, getInteractions: () => ['Build'] },
    location: { x: 3658, y: 3848, z: 0 },
  };
  assert.equal(objectHandlers[0](buildEvent), true);
  assert.equal(attributes.get('dragon-slayer-ii:lithkren-rowboat-built'), true);
  assert.deepEqual(sentVarbits, [[6104, 65]], 'the cache loc morphs from Build to Travel after construction');
  assert.deepEqual([I.OAK_PLANK, I.SWAMP_PASTE, I.STEEL_NAILS, I.IRON_NAILS].map((id) => amounts.get(id)), [0, 0, 0, 0]);
  assert.equal(objectHandlers[0](buildEvent), true);
  assert.equal(destination, undefined, 'a stale Build action cannot skip Dallas\u2019 departure conversation');
  assert.match(messages.at(-1), /Speak to Dallas Jones/);
  destination = undefined;
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: 'wKz-eF' });
  assert.deepEqual(destination, [3559, 4004, 0]);
  assert.deepEqual(sentVarbits, [[6104, 65], [6104, 70]], 'Dallas\u2019 departure dialogue updates the native Lithkren quest milestone');
  assert.equal(attributes.get('dragon-slayer-ii:lithkren-arrived'), true);
  playerLocation = { x: 3549, y: 10448, z: 0 };
  for (const handler of playerProcesses) handler({ player });
  assert.equal(sentVarbits.at(-1)[1], 75, 'entering the underground hallway reveals the canonical Dallas and vault door transforms');
  assert.equal(objectHandlers[0]({
    player, objectId: O.BROKEN_DOORS, clickType: 1,
    definition: { getInteractions: () => ['Enter'] },
    location: { x: 3547, y: 10482, z: 0 },
  }), true, 'the deep-lab entrance cannot bypass the diary and dragon-key steps');
  assert.match(messages.at(-1), /completed dragon key/);
  assert.deepEqual(destination, [3559, 4004, 0], 'a premature Enter leaves the player in the key-vault corridor');
  for (const handler of custom.get('ladders:climb')) {
    const climb = { player, objectId: O.STAIRCASE_169,
      object: { getLocation: () => ({ getX: () => 3549, getY: () => 10469, getZ: () => 0 }) }, handled: false };
    handler(climb);
    assert.equal(climb.handled, true, 'the unpaired cache staircase is handled by the quest route');
  }
  assert.deepEqual(destination, [3549, 10419, 0], 'the northern stair route reaches Dallas and Aivas’ skeleton');
  attributes.set('quest.dragon_slayer_ii.stage', 8);
  assert.equal(objectHandlers[0]({
    player, objectId: O.ANCIENT_DOORS, location: { x: 3550, y: 10425, z: 0 },
  }), true);
  assert.equal(amounts.get(I.DRAGON_KEY), 0);
  assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 11);
  assert.ok(messages.includes('You successfully build the boat.'));
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

test('Dragon Slayer II Lithkren diary chapter follows Dallas, the skeleton, and the read diary milestone', () => {
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const custom = new Map();
  const npcInteractions = new Map();
  const objectClicks = [];
  const itemActions = [];
  let transcript;
  const base = mockApi().api;
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => npcInteractions.set(name, options);
      if (prop === 'onObjectFirstClick') return (ids, handler) => objectClicks.push({ ids: Array.isArray(ids) ? ids : [ids], handler });
      if (prop === 'onItemAction') return (name, actions) => itemActions.push({ name, actions });
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  runtime.startTranscript = (_api, _player, _npcId, _page, variant, select) => {
    const raw = require('../data/definitions/npc-dialogues.json')['Dragon Slayer II'].variants[variant];
    transcript = { variant, steps: select ? select(raw) : raw };
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }

  const { ItemIdentifiers: I, NpcIdentifiers: N, ObjectIdentifiers: O, Location } = api.core;
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 6],
    ['dragon-slayer-ii:lithkren-arrived', false],
  ]);
  const inventory = new Map();
  const varbits = [];
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getLocation: () => new Location(3549, 10419, 0),
    getPacketSender: () => new Proxy({ sendVarbit: (id, value) => varbits.push([id, value]) }, {
      get: (target, key) => target[key] ?? (() => {}),
    }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - [...inventory.values()].reduce((sum, amount) => sum + amount, 0),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    sendMessage() {},
  };
  npcInteractions.get('Jardric')['Talk-to']({
    player, npcId: N.JARDRIC, location: new Location(3659, 3849, 0),
  });
  assert.equal(attrs.get('dragon-slayer-ii:jardric-talked-about-lithkren'), true);
  assert.deepEqual(varbits.at(-1), [6104, 60], 'Jardric reveals the canonical rowboat Build transform');
  attrs.set('dragon-slayer-ii:lithkren-arrived', true);
  player.getLocation = () => new Location(3549, 10419, 0);
  npcInteractions.get('Dallas Jones')['Talk-to']({ player, npcId: N.DALLAS_JONES_2 });
  assert.equal(transcript.variant, 'to-lithkren-talking-to-dallas-at-the-ancient-doors');
  assert.equal(transcript.steps.at(-1).id, 'dragon-slayer-ii:lithkren-dallas-complete');
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: transcript.steps.at(-1).id });
  assert.equal(attrs.get('dragon-slayer-ii:lithkren-dallas-talked'), true);
  assert.deepEqual(varbits.at(-1), [6104, 80], 'Dallas dialogue unlocks the native Search skeleton milestone');

  const skeleton = objectClicks.find(({ ids }) => ids.includes(O.SKELETON_82)).handler;
  assert.equal(skeleton({ player, objectId: O.SKELETON_82, location: { x: 3555, y: 10419, z: 0 } }), true);
  assert.equal(inventory.get(I.AIVAS_DIARY), 1);
  const read = itemActions.find(({ name }) => name === "Aivas' diary").actions.Read;
  assert.equal(read({ player, itemId: I.AIVAS_DIARY }), true);
  assert.equal(attrs.get('dragon-slayer-ii:aivas-diary'), true);
  assert.deepEqual(varbits.at(-1), [6104, 85], 'reading the diary unlocks Dallas’ follow-up milestone');
  npcInteractions.get('Dallas Jones')['Talk-to']({ player, npcId: N.DALLAS_JONES_2 });
  assert.equal(transcript.variant, 'to-lithkren-talking-to-dallas-after-finding-aivas-diary');
  assert.equal(transcript.steps.at(-1).id, 'dragon-slayer-ii:lithkren-diary-complete');
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: transcript.steps.at(-1).id });
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 7, 'the Bob-memory chapter starts only after the diary is read');
});

test('Dragon Slayer II resolves both Alec prerequisite transcript branches', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const { api: base, handlers } = mockApi();
  const interactions = [];
  const completed = new Map([
    ['legends_quest', true], ['dream_mentor', true], ['a_tail_of_two_cats', true],
    ['animal_magnetism', true], ['ghosts_ahoy', true], ['bone_voyage', true], ['client_of_kourend', true],
  ]);
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => interactions.push({ name, options });
      if (prop === 'emitCustomEvent') return (name, payload) => {
        if (name === 'quest:is-complete') payload.complete = completed.get(payload.key) === true;
        for (const handler of handlers.custom.get(name) ?? []) handler(payload);
      };
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const oldStartTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
    const attributes = new Map([['quest.points', 200]]);
    const messages = [];
    let magicLevel = 99;
    const player = {
      getAttribute: (key) => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      getSkillManager: () => ({ getMaxLevel: (skill) => skill === api.core.Skill.MAGIC ? magicLevel : 99 }),
      getPacketSender: () => new Proxy({}, { get: () => () => ({}) }),
      sendMessage: (message) => messages.push(message),
      getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 28, adds: () => {} }),
    };
    const alec = interactions.find(({ name }) => name === 'Alec Kincade').options['Talk-to'];
    const conditions = handlers.condition.filter((handler) => handler.name === 'answerAlecStartRequirements');
    assert.equal(conditions.length, 1);
    completed.set('dream_mentor', false);
    alec({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE });
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), undefined, 'Alec cannot start DS2 with a missing prerequisite quest');
    assert.match(messages.at(-1), /Dream Mentor/);
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '7iH3Yl' }), false);
    completed.set('dream_mentor', true);
    alec({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE });
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 1);
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '7iH3Yl' }), true,
      'the qualifying transcript branch is shown');
    magicLevel = 74;
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '7iH3Yl' }), false);
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '5wzysS' }), true,
      'the unmet-requirements branch appears when a required skill is short');
  } finally {
    runtime.startTranscript = oldStartTranscript;
  }
});
