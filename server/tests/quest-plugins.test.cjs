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
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 28, deleteNumber: () => {}, adds: () => {} }),
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
  const treeHook = npcHooks.find(([handler]) => typeof handler === 'function')?.[0];
  assert.equal(typeof treeHook, 'function');
  treeHook({ player, npcId: api.core.NpcIdentifiers.LORD_PIQUAN_CRWYS_2, clickType: 1,
    location: { x: 2176, y: 3211 }, definition: { getName: () => 'Lord Piquan Crwys', getActions: () => ['Chop down'] } });
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-finding-lord-crwys');
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'UNrb5z' });
  choice({ player, option: 'How do I find Lady Hefin?', definition: { getName: () => 'Baxtorian' } });
  assert.equal(attributes.get('quest.song_of_the_elves.hefin-clue-heard'), true);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'K9K0W4' });
  assert.equal(quest.getStage(player), 150, 'both clan leaders keep the quest in the orb chapter');
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.crwys-clue-heard'));
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.hefin-clue-heard'));
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
          ? 35222 : api.core.ObjectIdentifiers.PILLAR_OF_LIGHT_41 }]
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

test("Mourning's End I teleport crystals consume a charge and take the player to Lletya", () => {
  const { api: base } = mockApi();
  const itemActions = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemAction'
      ? (name, actions) => itemActions.set(name, actions)
      : target[prop],
  });
  require('../plugins/quests/quests/MourningsEndPartI.Quest')(api);
  const items = new Map([[6099, 1]]);
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
  const event = { player, itemId: 6099, handled: false };
  itemActions.get('Teleport crystal (4)').Lletya(event);
  assert.equal(event.handled, true);
  assert.equal(items.get(6099), undefined);
  assert.equal(items.get(6100), 1);
  assert.deepEqual(moved, [[2352, 3170, 0]]);
  assert.equal(messages.length, 1);
});
