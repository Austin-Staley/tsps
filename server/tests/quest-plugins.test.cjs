// Run after `yarn build`: node --test tests/quest-plugins.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { PluginManager } = require('../dist/plugins/PluginManager');

test('RFD M\'speak amulet and quest greegrees have usable equipment slots', () => {
  const gameplay = require('../data/definitions/item-gameplay.json');
  const byId = new Map(gameplay.map((item) => [item.id, item]));
  for (const id of [4022, 17926, 17927]) assert.equal(byId.get(id)?.equipmentType, 'AMULET', `item ${id}`);
  for (const id of [...Array.from({ length: 8 }, (_, i) => 4024 + i),
    ...Array.from({ length: 8 }, (_, i) => 17929 + i), 19526]) {
    assert.equal(byId.get(id)?.equipmentType, 'WEAPON', `item ${id}`);
  }
});

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

test('the Lumbridge Guide egg quiz asks three questions and consumes the egg only after three correct answers', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const menus = [];
  let pendingBuilder = null;
  let currentQuestion = '';
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onNpcInteraction') return (...args) => interactions.push(args);
      if (prop === 'sendMultiChatboxPrompt') return (_player, title, ...pairs) => menus.push({ title, pairs });
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const traiborn = interactions.find(([name]) => name === 'Wizard Traiborn')[1]['Talk-to'];

  const itemId = api.core.ItemIdentifiers.EGG;
  const inventory = new Map([[itemId, 1]]);
  const attributes = new Map();
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    isPlayer: () => true,
    getAsPlayer: () => player,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      getFreeSlots: () => 27,
    }),
    getPacketSender: () => packetSender,
    getDialogueManager: () => ({
      reset() {},
      startDialogues(builder) {
        pendingBuilder = builder;
        for (const dialogue of builder.getDialogues().values()) {
          if (dialogue.getText?.().endsWith('?')) currentQuestion = dialogue.getText();
        }
      },
    }),
    sendMessage() {},
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  quest.setStage(player, 4);
  traiborn({ player, npcId: api.core.NpcIdentifiers.WIZARD_TRAIBORN, clickType: 1,
    definition: { getActions: () => ['Talk-to'] } });

  const answers = new Map([
    ['A vision shows a ghostly woman in white. Who is she?', 'Velorina'],
    ['A vision shows an elf with long blond hair. Who is he?', 'Islwyn'],
    ['A vision shows a man wearing a crown in East Ardougne. Who is he?', 'King Lathas'],
    ['A vision shows a man in a blue shirt with a book. Who is he?', 'Reldo'],
    ['A vision shows a woman in a pink top. Who is she?', 'Gertrude'],
    ['A vision shows a witch in a pointed hat. Who is she?', 'Hetty'],
    ['A vision shows a pirate in a bandana. Who is he?', 'Pirate Pete'],
    ['A vision shows a man in ordinary clothes from a nearby farm. Who is he?', 'Unferth'],
    ['A vision shows a desert merchant with a white beard. Who is he?', 'Ali Morrisane'],
    ['A vision shows a man in a brown vest. Who is he?', 'Professor Gronigen'],
  ]);
  const advance = () => {
    const last = [...pendingBuilder.getDialogues().values()].at(-1);
    last.send(player);
  };
  while (menus.length < 3) {
    if (menus.length > 0 && menus.at(-1).used) {
      advance();
      continue;
    }
    if (menus.length > 0) {
      const menu = menus.at(-1);
      const answer = answers.get(currentQuestion);
      assert.ok(answer, `no fixture answer for ${currentQuestion}`);
      const optionIndex = menu.pairs.indexOf(answer);
      assert.notEqual(optionIndex, -1, `quiz omitted correct answer ${answer}`);
      menu.used = true;
      menu.pairs[optionIndex + 1]();
      continue;
    }
    advance();
  }
  const last = menus.at(-1);
  const answer = answers.get(currentQuestion);
  last.used = true;
  last.pairs[last.pairs.indexOf(answer) + 1]();
  advance();
  advance();

  assert.equal(menus.length, 3);
  assert.equal(inventory.get(itemId), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.ENCHANTED_EGG), 1);
  assert.equal(player.getAttribute('recipe-for-disaster:guide-state') & 1, 1);
});

test('RFD Sir Amik cornflour uses sweetcorn in the windmill before mixing the recipe', () => {
  const { api: base } = mockApi();
  const objectActions = [];
  const itemObjects = [];
  const itemItems = [];
  const core = Object.create(base.core);
  Object.defineProperty(core, 'ObjectDefinition', { value: {
    ...base.core.ObjectDefinition,
    forPlayer: () => ({ getName: () => 'Hopper' }),
  } });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (...args) => objectActions.push(args);
      if (prop === 'onItemOnObject') return (handler) => itemObjects.push(handler);
      if (prop === 'onItemOnItem') return (handler) => itemItems.push(handler);
      if (prop === 'core') return core;
      return target[prop];
    },
  });
  require('../plugins/objects/Windmill.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const fillCorn = itemObjects.findLast((handler) => handler.name !== 'handleGoblinIngredients'
    && handler.name !== 'handleSkrachItemOnObject' && handler.name !== 'handleEvilChickenShrine'
    && handler.name !== 'handleAwowogeiObjects' && handler.name !== 'handlePirateRange'
    && handler.name !== 'handleGuideRange');
  const operate = objectActions.findLast(([name, actions]) => name === 'Hopper controls' && actions.Operate)?.[1].Operate;
  const emptyBin = objectActions.findLast(([name, actions]) => name === 'Flour bin' && actions.Empty)?.[1].Empty;
  const ingredients = itemItems.findLast((handler) => handler.name === 'handleAmikItems');
  assert.ok(fillCorn && operate && emptyBin && ingredients);

  const attributes = new Map();
  const inventory = new Map([
    [api.core.ItemIdentifiers.SWEETCORN, 1],
    [api.core.ItemIdentifiers.POT, 1],
    [api.core.ItemIdentifiers.MILKY_MIXTURE, 1],
  ]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    sendMessage() {},
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      containsNumber: (id) => (inventory.get(id) ?? 0) > 0,
      getFreeSlots: () => 20,
      deleteNumber: (id, count) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - count)),
      adds: (id, count) => inventory.set(id, (inventory.get(id) ?? 0) + count),
    }),
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);

  const { MapObjects } = require('../src/main/typescript/elvarg/game/entity/impl/object/MapObjects');
  const loadedObjects = new Map(MapObjects.mapObjects);
  MapObjects.mapObjects.clear();

  const hopper = { player, objectId: api.core.ObjectIdentifiers.HOPPER_24,
    itemId: api.core.ItemIdentifiers.SWEETCORN, handled: false };
  fillCorn(hopper);
  assert.equal(hopper.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.SWEETCORN), 0);

  operate({ player, location: { x: 3166, y: 3305, z: 2 }, handled: false });

  emptyBin({ player, objectId: 1781, handled: false });
  MapObjects.mapObjects.clear();
  for (const [key, value] of loadedObjects) MapObjects.mapObjects.set(key, value);
  assert.equal(inventory.get(api.core.ItemIdentifiers.POT), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.POT_OF_CORNFLOUR), 1);

  const mix = { player, usedItemId: api.core.ItemIdentifiers.POT_OF_CORNFLOUR,
    usedWithItemId: api.core.ItemIdentifiers.MILKY_MIXTURE, handled: false };
  ingredients(mix);
  assert.equal(mix.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.POT_OF_CORNFLOUR), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.MILKY_MIXTURE), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.CORNFLOUR_MIXTURE), 1);
});

test('RFD Amik shrine requires the Wise Old Man clue, enters the mapped lair and drops the real quest egg', () => {
  const { api: base } = mockApi();
  const itemObjects = [];
  const deaths = [];
  let spawn = null;
  let spawned = null;
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onItemOnObject') return (handler) => itemObjects.push(handler);
      if (prop === 'onNpcDeath') return (handler) => deaths.push(handler);
      if (prop === 'spawnNpc') return (config) => { spawned = config; return spawn; };
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const shrine = itemObjects.find((handler) => handler.name === 'handleEvilChickenShrine');
  const death = deaths.find((handler) => handler.name === 'handleAmikCombatDrop');
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const inventory = new Map([[api.core.ItemIdentifiers.RAW_CHICKEN, 1]]);
  const moves = [];
  const player = {
    isPlayer: () => true,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    moveTo: (location) => moves.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage() {},
    getPacketSender: () => new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => {} : undefined }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 20,
      deleteNumber: (id, count) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - count)),
      adds: (id, count) => inventory.set(id, (inventory.get(id) ?? 0) + count),
    }),
  };
  quest.setStage(player, 4);
  const event = { player, objectId: api.core.ObjectIdentifiers.CHICKEN_SHRINE,
    itemId: api.core.ItemIdentifiers.RAW_CHICKEN, handled: false };
  shrine(event);
  assert.equal(event.handled, false, 'the shrine remains inactive until Aris and the Wise Old Man give the clue');
  assert.equal(inventory.get(api.core.ItemIdentifiers.RAW_CHICKEN), 1);

  attributes.set('recipe-for-disaster:amik-state', 1);
  spawn = null;
  const failed = { ...event, handled: false };
  shrine(failed);
  assert.equal(failed.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.RAW_CHICKEN), 1, 'a failed spawn never consumes the offering');

  const chicken = {};
  spawn = chicken;
  const entered = { ...event, handled: false };
  shrine(entered);
  assert.equal(entered.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.RAW_CHICKEN), 0);
  assert.deepEqual(spawned, {
    id: api.core.NpcIdentifiers.EVIL_CHICKEN,
    x: 2455,
    y: 4399,
    z: 0,
    wanderRadius: 0,
    owner: player,
    ownerOnly: true,
  });
  assert.deepEqual(moves, [[2455, 4398, 0]]);

  death({ killer: player, npc: chicken, npcId: api.core.NpcIdentifiers.EVIL_CHICKEN });
  assert.equal(inventory.get(api.core.ItemIdentifiers.EVIL_CHICKENS_EGG), 1);
});

test('RFD council interactions read requirements through the SkillManager before starting a rescue', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onNpcInteraction') return (...args) => interactions.push(args);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const council = interactions.findLast(([handler]) => typeof handler === 'function')[0];
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const messages = [];
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    getPacketSender: () => packetSender,
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 27 }),
    sendMessage: (message) => messages.push(message),
  };
  quest.setStage(player, 4);

  assert.doesNotThrow(() => council({
    player,
    npcId: api.core.NpcIdentifiers.PIRATE_PETE_3,
    clickType: 1,
    definition: { getActions: () => ['Talk-to'] },
  }));
  assert.match(messages.at(-1), /Speak to Aris about freeing Pirate Pete/);
});

test('RFD only frees the Guide for a Cake of Guidance and consumes it on a valid hand-in', () => {
  const { api: base } = mockApi();
  const itemNpcHandlers = [];
  const npcDefinitions = Object.create(base.core.NpcDefinition);
  npcDefinitions.forId = () => ({ getId: () => 3393, getName: () => 'Lumbridge Guide' });
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: npcDefinitions });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return core;
      if (prop === 'onItemOnNpc') return (handler) => itemNpcHandlers.push(handler);
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  itemNpcHandlers.length = 0;
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handIn = itemNpcHandlers[0];
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quests = getRegisteredQuests();
  const quest = quests.findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const inventory = new Map([[api.core.ItemIdentifiers.CAKE, 1], [api.core.ItemIdentifiers.CAKE_OF_GUIDANCE, 1]]);
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const skillManager = { getCurrentLevel: () => 99, addExperiences() {} };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => skillManager,
    getPacketSender: () => packetSender,
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 27,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getEquipment: () => ({ get: () => null }),
    getDialogueManager: () => ({ startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 4);
  for (const key of ['big_chompy_bird_hunting', 'biohazard', 'demon_slayer', 'murder_mystery', 'nature_spirit', 'witchs_house']) {
    const prerequisite = quests.findLast((entry) => entry.key === key);
    assert.ok(prerequisite, `missing prerequisite quest ${key}`);
    prerequisite.setStage(player, prerequisite.completionValue);
  }

  const wrongDish = { player, npcId: api.core.NpcIdentifiers.LUMBRIDGE_GUIDE_4, itemId: api.core.ItemIdentifiers.CAKE, handled: false };
  handIn(wrongDish);
  assert.equal(wrongDish.handled, false);
  assert.equal(inventory.get(api.core.ItemIdentifiers.CAKE), 1);
  assert.equal(attributes.get('recipe-for-disaster:rescues') ?? 0, 0);

  const rightDish = { player, npcId: api.core.NpcIdentifiers.LUMBRIDGE_GUIDE_4, itemId: api.core.ItemIdentifiers.CAKE_OF_GUIDANCE, handled: false };
  handIn(rightDish);
  assert.equal(rightDish.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.CAKE_OF_GUIDANCE), 0);
  assert.equal(attributes.get('recipe-for-disaster:rescues'), 8);
  assert.equal(attributes.get('quest.points'), 1);
});

test('RFD fishcake recipe preserves incomplete ingredients and consumes all four only when combined', () => {
  const { api: base } = mockApi();
  const itemHandlers = [];
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: { forId: () => ({ getActions: () => ['Talk-to'] }) } });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return core;
      if (prop === 'onItemOnItem') return (handler) => itemHandlers.push(handler);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const recipe = itemHandlers.findLast((handler) => handler.toString().includes('GROUND_COD'));
  assert.ok(recipe);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const items = api.core.ItemIdentifiers;
  const inventory = new Map([[items.GROUND_COD, 1], [items.GROUND_KELP, 1],
    [items.BREAD, 1], [items.KNIFE, 1]]);
  const attributes = new Map();
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getPacketSender: () => packetSender,
    getDialogueManager: () => ({ startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 4);

  recipe({ player, usedItemId: items.BREAD, usedWithItemId: items.KNIFE, handled: false });
  assert.equal(inventory.get(items.BREAD), 0);
  assert.equal(inventory.get(items.KNIFE), 1);
  assert.equal(inventory.get(items.BREADCRUMBS), 1);

  recipe({ player, usedItemId: items.GROUND_COD, usedWithItemId: items.GROUND_KELP, handled: false });
  assert.equal(inventory.get(items.GROUND_COD), 1);
  assert.equal(inventory.get(items.GROUND_KELP), 1);
  assert.equal(inventory.get(items.RAW_FISHCAKE) ?? 0, 0);

  for (const id of [items.GROUND_GIANT_CRAB_MEAT, items.BREADCRUMBS]) inventory.set(id, 1);
  const complete = { player, usedItemId: items.GROUND_COD, usedWithItemId: items.GROUND_KELP, handled: false };
  recipe(complete);
  assert.equal(complete.handled, true);
  for (const id of [items.GROUND_COD, items.GROUND_KELP, items.GROUND_GIANT_CRAB_MEAT, items.BREADCRUMBS]) {
    assert.equal(inventory.get(id), 0);
  }
  assert.equal(inventory.get(items.RAW_FISHCAKE), 1);
});

test('RFD K\'klik flambe consumes the token and creme brulee after the protected success line', () => {
  const { api, handlers } = mockApi();
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const items = api.core.ItemIdentifiers;
  const attributes = new Map();
  const inventory = new Map([[items.DRAGON_TOKEN, 1], [items.BRULEE_3, 1]]);
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      getFreeSlots: () => 27,
    }),
    getPacketSender: () => packetSender,
    getEquipment: () => ({ get: (slot) => slot === api.core.Equipment.HANDS_SLOT ? { getId: () => items.ICE_GLOVES } : null }),
  };
  quest.setStage(player, 4);

  const line = { player, npcId: api.core.NpcIdentifiers.KKLIK, text: "Sure, that's easy." };
  handlers.custom.get('npc-dialogue:line').at(-1)(line);
  assert.equal(typeof line.after, 'function');
  line.after();

  assert.equal(inventory.get(items.DRAGON_TOKEN), 0);
  assert.equal(inventory.get(items.BRULEE_3), 0);
  assert.equal(inventory.get(items.BRULEE_SUPREME), 1);
});

test('Below Ice Mountain yields knife-and-bread interactions outside its sandwich errand', () => {
  const { api: base } = mockApi();
  const itemHandlers = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onItemOnItem') return (...args) => itemHandlers.push(args);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/BelowIceMountain.Quest')];
  require('../plugins/quests/quests/BelowIceMountain.Quest')(api);
  const sandwich = itemHandlers.find(([first, second]) => first === 'Knife' && second === 'Bread')?.[2];
  assert.equal(typeof sandwich, 'function');
  const attributes = new Map();
  const inventory = new Map([[api.core.ItemIdentifiers.KNIFE, 1], [api.core.ItemIdentifiers.BREAD, 1]]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    getInventory: () => ({ getAmount: (id) => inventory.get(id) ?? 0 }),
  };

  assert.equal(sandwich({ player, usedItemId: api.core.ItemIdentifiers.KNIFE,
    usedWithItemId: api.core.ItemIdentifiers.BREAD, handled: false }), false);
  assert.equal(inventory.get(api.core.ItemIdentifiers.BREAD), 1);
});

test('RFD Awowogei banana gathering waits for the King, all three monkeys and both recipe clues', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const gather = objectHandlers.find((handler) => handler.name === 'handleAwowogeiObjects');
  assert.equal(typeof gather, 'function');
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const messages = [];
  const inventory = new Map([[api.core.ItemIdentifiers.ROPE, 1]]);
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 27,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    getEquipment: () => ({ get: () => null }),
    getPacketSender: () => packetSender,
    sendMessage: (message) => messages.push(message),
  };
  quest.setStage(player, 4);

  const event = { player, objectId: api.core.ObjectIdentifiers.RED_BANANA_TREE,
    itemId: api.core.ItemIdentifiers.ROPE, handled: false };
  gather(event);
  assert.equal(event.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.RED_BANANA), undefined);
  assert.match(messages.at(-1), /three wise monkeys/);
});

test('RFD Awowogei Tchiki route needs base Agility and an equipped ninja greegree before the rope swing', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const moves = [];
  const messages = [];
  const experiences = [];
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      if (prop === 'core') return base.core;
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handler = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCourse');
  assert.ok(handler);
  const attributes = new Map([['recipe-for-disaster:awowogei-state', 63]]);
  let agility = 47;
  let weapon = -1;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getCurrentLevel: () => agility, getMaxLevel: () => agility,
      addExperiences: (skill, amount) => experiences.push([skill, amount]) }),
    getEquipment: () => ({ get: (slot) => slot === api.core.Equipment.WEAPON_SLOT
      ? { getId: () => weapon } : null }),
    getInventory: () => ({ getItems: () => [] }),
    getPacketSender: () => packetSender,
    moveTo: (location) => moves.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage: (message) => messages.push(message),
  };
  const swing = () => ({ player, objectId: api.core.ObjectIdentifiers.ROPE_20, clickType: 1,
    definition: { getActions: () => ['Swing'] }, handled: false });
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);

  const belowLevel = swing();
  handler(belowLevel);
  assert.equal(belowLevel.handled, true);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63);
  assert.match(messages.at(-1), /level 48 Agility/);

  agility = 48;
  const human = swing();
  handler(human);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63);
  assert.match(messages.at(-1), /ninja monkey greegree/);

  weapon = api.core.ItemIdentifiers.NINJA_MONKEY_GREEGREE;
  const monkey = swing();
  handler(monkey);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63 | 256);
  assert.deepEqual(moves, [[2756, 2731, 0]]);
  assert.deepEqual(experiences, [[api.core.Skill.AGILITY, 100]]);
});

test('RFD Awowogei hole, mapped Tchiki cave, exit rope and final course tree use the real world route', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const moves = [];
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      if (prop === 'core') return base.core;
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const course = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCourse');
  const cave = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCaveObject');
  const courseExit = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCourseExit');
  const attributes = new Map([['recipe-for-disaster:awowogei-state', 63]]);
  let loc = [2758, 2729, 0];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => loc[0], getY: () => loc[1], getZ: () => loc[2] }),
    moveTo: (location) => { loc = [location.getX(), location.getY(), location.getZ()]; moves.push(loc); },
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 27, adds: () => {} }),
    getEquipment: () => ({ get: () => null }),
    getPacketSender: () => packetSender,
    sendMessage: () => {},
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);
  attributes.set('recipe-for-disaster:awowogei-state', 63 | 256);

  const hole = { player, objectId: base.core.ObjectIdentifiers.HOLE_18, clickType: 1,
    definition: { getActions: () => ['Enter'] }, handled: false };
  course(hole);
  assert.equal(hole.handled, true);
  assert.deepEqual(loc, [3020, 5457, 0]);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63 | 256 | 512);

  const rope = { player, objectId: 16060, clickType: 1,
    definition: { getActions: () => ['Climb-up'] }, handled: false };
  cave(rope);
  assert.equal(rope.handled, true);
  assert.deepEqual(loc, [2757, 2734, 0]);

  const tree = { player, objectId: 16062, clickType: 1,
    definition: { getActions: () => ['Climb-down'] }, handled: false };
  courseExit(tree);
  assert.equal(tree.handled, true);
  assert.deepEqual(loc, [2757, 2726, 0]);
});

test('RFD Awowogei enters the mapped hot-coal chamber and cooks only on the long hot rock', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const itemObjectHandlers = [];
  const itemNpcHandlers = [];
  const routes = [];
  const moves = [];
  const npcDefinitions = Object.create(base.core.NpcDefinition);
  npcDefinitions.forId = () => ({ getId: () => base.core.NpcIdentifiers.AWOWOGEI, getName: () => 'Awowogei', getActions: () => ['Talk-to'] });
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: npcDefinitions });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      if (prop === 'onItemOnObject') return (handler) => itemObjectHandlers.push(handler);
      if (prop === 'onItemOnNpc') return (handler) => itemNpcHandlers.push(handler);
      if (prop === 'onObjectRoute') return (handler) => routes.push(handler);
      if (prop === 'core') return core;
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const dungeon = objectHandlers.findLast((handler) => handler.name === 'handleAwowogeiDungeon');
  const cook = itemObjectHandlers.findLast((handler) => handler.name === 'handleAwowogeiObjects');
  const rescue = itemNpcHandlers.findLast((handler) => handler.name === 'rescueByItem');
  const route = routes.findLast((handler) => handler.name === 'routeRedBananaTree');
  assert.ok(dungeon && cook && rescue && route);

  const attributes = new Map([['recipe-for-disaster:awowogei-state', 63]]);
  const inventory = new Map([[core.ItemIdentifiers.RAW_STUFFED_SNAKE, 1]]);
  let loc = [2808, 9200, 0];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => loc[0], getY: () => loc[1], getZ: () => loc[2] }),
    moveTo: (location) => { loc = [location.getX(), location.getY(), location.getZ()]; moves.push(loc); },
    getEquipment: () => ({ get: (slot) => slot === base.core.Equipment.WEAPON_SLOT
      ? { getId: () => base.core.ItemIdentifiers.ZOMBIE_MONKEY_GREEGREE }
      : slot === base.core.Equipment.AMULET_SLOT ? { getId: () => base.core.ItemIdentifiers.MSPEAK_AMULET } : null }),
    getSkillManager: () => ({ getCurrentLevel: () => 99, addExperiences() {} }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 27,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getDialogueManager: () => ({ startDialogues() {} }),
    sendMessage: () => {},
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);

  const crack = { player, objectId: 16061, clickType: 1,
    definition: { getActions: () => ['Enter'] }, handled: false };
  dungeon(crack);
  assert.equal(crack.handled, true);
  assert.deepEqual(loc, [3055, 5484, 0]);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state') & 1024, 1024);

  const rock = { getLocation: () => ({ getX: () => 3056, getY: () => 5484 }),
    getDefinition: () => ({ getName: () => 'Rock', getExamine: () => "It's a long, hot rock." }) };
  loc = [3055, 5484, 0];
  const approach = { player, object: rock, objectId: 26175 };
  route(approach);
  assert.deepEqual(approach.destination, { x: 3055, y: 5484, z: 0 });
  const wrongObject = { player, object: { getDefinition: () => ({ getName: () => 'Crate', getExamine: () => 'A crate.' }) }, objectId: 123,
    itemId: base.core.ItemIdentifiers.RAW_STUFFED_SNAKE, handled: false };
  cook(wrongObject);
  assert.equal(wrongObject.handled, false);
  assert.equal(inventory.get(base.core.ItemIdentifiers.RAW_STUFFED_SNAKE), 1);

  const realRock = { player, object: rock, objectId: 26175,
    itemId: base.core.ItemIdentifiers.RAW_STUFFED_SNAKE, handled: false };
  cook(realRock);
  assert.equal(realRock.handled, true);
  assert.equal(inventory.get(base.core.ItemIdentifiers.RAW_STUFFED_SNAKE), 0);
  assert.equal(inventory.get(base.core.ItemIdentifiers.STUFFED_SNAKE), 1);

  const mm1 = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'monkey_madness_i');
  assert.ok(mm1);
  mm1.setStage(player, mm1.completionValue);
  const kingMeal = { player, npcId: base.core.NpcIdentifiers.AWOWOGEI,
    itemId: base.core.ItemIdentifiers.STUFFED_SNAKE, handled: false };
  rescue(kingMeal);
  assert.equal(kingMeal.handled, true);
  assert.equal(inventory.get(base.core.ItemIdentifiers.STUFFED_SNAKE), 0);
  assert.equal(attributes.get('recipe-for-disaster:rescues') & 128, 128);

  const returnCrack = { player, objectId: 16100, clickType: 1,
    definition: { getActions: () => ['Enter'] }, handled: false };
  dungeon(returnCrack);
  assert.equal(returnCrack.handled, true);
  assert.deepEqual(loc, [2808, 9200, 0]);
});

test('RFD goblin cellar ladders connect only the mapped village and cook-room ends', () => {
  const { api: base } = mockApi();
  const objectActions = [];
  const emitted = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (...args) => objectActions.push(args);
      if (prop === 'emitCustomEvent') return (name, event) => emitted.push({ name, event });
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const ladder = objectActions.find(([name]) => name === 'Ladder')?.[1];
  assert.ok(ladder);
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);
  emitted.length = 0;

  const down = { player, objectId: 12389, clickType: 1,
    definition: { getActions: () => ['Climb-down'] }, location: { x: 2960, y: 3507, z: 0 }, handled: false };
  ladder['Climb-down'](down);
  assert.equal(down.handled, true);
  assert.equal(emitted[0].name, 'ladders:climbDown');
  assert.deepEqual([emitted[0].event.destination.getX(), emitted[0].event.destination.getY(), emitted[0].event.destination.getZ()], [2980, 9871, 0]);

  const wrong = { player, objectId: 12389, clickType: 1,
    definition: { getActions: () => ['Climb-down'] }, location: { x: 2961, y: 3507, z: 0 }, handled: false };
  ladder['Climb-down'](wrong);
  assert.equal(wrong.handled, false);
  assert.equal(emitted.length, 1);

  const up = { player, objectId: 12391, clickType: 1,
    definition: { getActions: () => ['Climb-up'] }, location: { x: 2981, y: 9876, z: 0 }, handled: false };
  ladder['Climb-up'](up);
  assert.equal(up.handled, true);
  assert.equal(emitted[1].name, 'ladders:climbUp');
  assert.deepEqual([emitted[1].event.destination.getX(), emitted[1].event.destination.getY(), emitted[1].event.destination.getZ()], [2960, 3506, 0]);
});

test('RFD ogre boat charges the correct chompies and herbs for each route', () => {
  const { api: base, handlers } = mockApi();
  const routes = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onNpcRoute') return (handler) => routes.push(handler);
      return target[property];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const condition = handlers.condition.at(-1);
  const action = handlers.custom.get('npc-dialogue:action').at(-1);
  const items = api.core.ItemIdentifiers;
  const inventory = new Map([[items.RAW_CHOMPY, 2], [items.SNAKE_WEED, 1], [items.ROGUES_PURSE, 1]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
  ]);
  const sentVarbits = [];
  let destination;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    getPacketSender: () => ({ sendVarbit: (id, value) => sentVarbits.push([id, value]) }),
    moveTo: (location) => { destination = location; },
  };
  const choice = handlers.custom.get('npc-dialogue:choice').find((handler) => handler.toString().includes('SKRACH_STATE_ATTRIBUTE'));
  assert.ok(choice);
  choice({ player, npcId: api.core.NpcIdentifiers.RANTZ, option: "Ok, I'll do it." });
  assert.equal(attributes.get('recipe-for-disaster:skrach-state') & 1, 1);
  assert.deepEqual(sentVarbits.at(-1), [1908, 1]);
  const boatRoute = routes.at(-1);
  assert.ok(boatRoute);
  const route = { player, npcId: 6260, clickType: 1, definition: { getActions: () => ['Board'] }, range: 1 };
  boatRoute(route);
  assert.equal(route.range, 5);

  assert.equal(condition({ npcId: 6260, player, stepId: 'n8xiFU', text: 'If the player does not have two chompies:' }), false);
  assert.equal(condition({ npcId: 6260, player, stepId: '7ke2SD', text: 'If the player has sufficient payment:' }), true);
  action({ player, npcId: 6260, stepId: 'f2OXgM', action: 'teleport' });
  assert.equal(inventory.get(items.RAW_CHOMPY), 0);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2790, 3077, 0]);

  assert.equal(condition({ npcId: 6261, player, stepId: 'jx9b44', text: 'If the player does not have two snake weed or two Rogue\'s purse:' }), false);
  assert.equal(condition({ npcId: 6261, player, stepId: 'SN91cd', text: 'If the player has sufficient payment:' }), true);
  action({ player, npcId: 6261, stepId: 'Lt1Y5S', action: 'teleport' });
  assert.equal(inventory.get(items.SNAKE_WEED), 0);
  assert.equal(inventory.get(items.ROGUES_PURSE), 0);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2655, 2964, 0]);
});

test("RFD Skrach's cooked chompy summons the free return boat and arrival frees the paid Jubbly hunt", () => {
  const { api: base, handlers } = mockApi();
  const itemOnObject = [];
  const interactions = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onItemOnObject') return (handler) => itemOnObject.push(handler);
      if (property === 'onNpcInteraction') return (...args) => interactions.push(args);
      return target[property];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (...args) => { transcripts.push(args.slice(3, 5)); return true; };
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const cooking = itemOnObject.find((handler) => handler.toString().includes('SKEWERED_CHOMPY'));
  assert.ok(cooking);
  const inventory = new Map([[api.core.ItemIdentifiers.SKEWERED_CHOMPY, 1]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:skrach-state', 7],
  ]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => new api.core.Location(2790, 3077, 0),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
  };
  const event = { player, itemId: api.core.ItemIdentifiers.SKEWERED_CHOMPY,
    objectId: api.core.ObjectIdentifiers.FIRE, handled: false };
  const boatTalk = interactions.find(([handler]) => typeof handler === 'function'
    && handler.toString().includes('OGRE_BOAT_IDS'))?.[0];
  assert.ok(boatTalk);
  try {
    cooking(event);
    assert.equal(inventory.get(api.core.ItemIdentifiers.SKEWERED_CHOMPY), 0);
    assert.equal(inventory.get(api.core.ItemIdentifiers.COOKED_CHOMPY), 1);
    assert.equal(attributes.get('recipe-for-disaster:skrach-state') & 16, 16);
    assert.deepEqual(transcripts.at(-1), ['Recipe for Disaster/Freeing Skrach Uglogwee', 'ranting-with-rantz-after-cooking-the-chompy-on-the-beach']);

    boatTalk({ player, npcId: api.core.NpcIdentifiers.OGRE_BOAT, clickType: 1,
      definition: { getActions: () => ['Board'] }, handled: false });
    assert.deepEqual(transcripts.at(-1), ['Recipe for Disaster/Freeing Skrach Uglogwee', 'ranting-with-rantz-boarding-the-ogre-boat']);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  let destination;
  player.moveTo = (location) => { destination = location; };
  const transfer = handlers.custom.get('npc-dialogue:action').find((handler) => handler.toString().includes('tOD_lg'));
  assert.ok(transfer);
  transfer({ player, npcId: api.core.NpcIdentifiers.OGRE_BOAT, stepId: 'tOD_lg', handled: false });
  assert.equal(attributes.get('recipe-for-disaster:skrach-state') & 8, 8);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2655, 2964, 0]);
});

test("RFD Skrach's second bellows inflation consumes the toad, rock and wool together", () => {
  const { api: base } = mockApi();
  const itemOnItem = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onItemOnItem') return (handler) => itemOnItem.push(handler);
      return target[property];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const assemble = itemOnItem.find((handler) => handler.toString().includes('BALLOON_TOAD'));
  assert.ok(assemble);

  const ids = api.core.ItemIdentifiers;
  const inventory = new Map([[ids.OGRE_BELLOWS_2_, 1], [ids.BLOATED_TOAD, 1], [ids.ROCK, 1]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:skrach-state', 1],
  ]);
  const messages = [];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - [...inventory.values()].reduce((sum, amount) => sum + amount, 0),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    sendMessage: (message) => messages.push(message),
  };
  const combine = (usedItemId, usedWithItemId) => {
    const event = { player, usedItemId, usedWithItemId, handled: false };
    assemble(event);
    assert.equal(event.handled, true);
  };

  combine(ids.BLOATED_TOAD, ids.OGRE_BELLOWS_2_);
  assert.equal(inventory.get(ids.OGRE_BELLOWS_2_), 1);
  assert.equal(inventory.get(ids.BLOATED_TOAD), 1);
  assert.match(messages.at(-1), /rock and a ball of wool/);

  inventory.set(ids.BALL_OF_WOOL, 1);
  combine(ids.BLOATED_TOAD, ids.OGRE_BELLOWS_2_);
  assert.equal(inventory.get(ids.OGRE_BELLOWS_2_), 0);
  assert.equal(inventory.get(ids.BLOATED_TOAD), 0);
  assert.equal(inventory.get(ids.ROCK), 0);
  assert.equal(inventory.get(ids.BALL_OF_WOOL), 0);
  assert.equal(inventory.get(ids.BALLOON_TOAD), 1);
});

test('RFD recognizes the live White Wolf spawn as the Old Dwarf', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const variants = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onNpcInteraction') return (...args) => interactions.push(args);
      if (property === 'onNpcDialogueVariant') return (handler) => variants.push(handler);
      return target[property];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const transcripts = [];
  const selectedSteps = [];
  runtime.startTranscript = (...args) => {
    transcripts.push(args.slice(3, 5));
    if (typeof args[5] === 'function') selectedSteps.push(args[5](runtime.loadTranscripts(api)[args[3]].variants[args[4]]));
    return true;
  };
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handler = interactions.map(([first, actions]) => typeof first === 'function' ? first : actions?.['Talk-to'])
    .find((entry) => entry?.toString().includes('DWARF_NPCS'));
  const attributes = new Map([['quest.recipe_for_disaster.stage', 4]]);
  const inventory = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
  };
  try {
    assert.ok(handler);
    const event = { player, npcId: 4810, clickType: 1, handled: false,
      definition: { getName: () => 'An old Dwarf', getActions: () => ['Talk-to'] } };
    handler(event);
    assert.equal(event.handled, true);
    assert.deepEqual(transcripts.at(-1), [
      'Recipe for Disaster/Freeing the Mountain Dwarf',
      'below-white-wolf-mountain-talking-to-an-old-dwarf',
    ]);
    inventory.set(base.core.ItemIdentifiers.ASGOLDIAN_ALE, 2);
    const firstAle = { player, npcId: 4810, clickType: 1, handled: false,
      definition: { getName: () => 'An old Dwarf', getActions: () => ['Talk-to'] } };
    handler(firstAle);
    assert.equal(inventory.get(base.core.ItemIdentifiers.ASGOLDIAN_ALE), 1);
    assert.equal(attributes.get('recipe-for-disaster:dwarf-state') & 7, 1);
    assert.equal(transcripts.at(-1)[1], 'getting-the-recipe-talking-to-rohak-with-asgoldian-ale-in-inventory');
    const secondAle = { player, npcId: 4810, clickType: 1, handled: false,
      definition: { getName: () => 'An old Dwarf', getActions: () => ['Talk-to'] } };
    handler(secondAle);
    assert.equal(inventory.get(base.core.ItemIdentifiers.ASGOLDIAN_ALE), 0);
    assert.equal(attributes.get('recipe-for-disaster:dwarf-state') & 7, 2);
    assert.equal(transcripts.at(-1)[1], 'getting-the-recipe-talking-to-rohak-with-a-second-asgoldian-ale-in-inventory');
    assert.deepEqual(variants[0]({ npcId: 1316, player,
      pages: [{ page: 'Recipe for Disaster/Freeing the Mountain Dwarf' }] }), {
      page: 'Recipe for Disaster/Freeing the Mountain Dwarf',
      variant: 'the-golden-nectar-talking-to-kaylee',
    });
    const bartender = { player, npcId: 1316, clickType: 1, handled: false,
      definition: { getName: () => 'Kaylee', getActions: () => ['Talk-to'] } };
    handler(bartender);
    assert.equal(bartender.handled, true);
    const copiedBranch = JSON.stringify(selectedSteps.at(-1));
    assert.match(copiedBranch, /"speaker":"Kaylee"/);
    assert.doesNotMatch(copiedBranch, /"speaker":"Emily"/);
    assert.match(copiedBranch, /"id":"QrDkgJ"/);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
});

test('Biohazard does not swallow RFD ingredient conditions', () => {
  const { api: base, handlers } = mockApi();
  require('../plugins/quests/quests/Biohazard.Quest')(base);
  const inventory = { getAmount: () => 0 };
  const player = { getInventory: () => inventory, getEquipment: () => ({ get: () => null }) };
  const condition = handlers.condition[0];
  assert.equal(condition({ player, npcId: 4810, stepId: 'Hk2Tfl',
    text: 'If the player has all the items',
    pages: [{ page: 'Recipe for Disaster/Freeing the Mountain Dwarf' }] }), null);
  assert.equal(condition({ player, npcId: 1102, stepId: 'Biohazard-test',
    text: 'If the player has all the items', pages: [{ page: 'Biohazard' }] }), false);
});

test('RFD gives the Evil Chicken lead to the Wise Old Man only after choosing Sir Amik', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onNpcInteraction') return (...args) => interactions.push(args);
      return target[property];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (...args) => { transcripts.push(args.slice(3, 5)); return true; };
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const wiseOldMan = interactions.find(([name]) => name === 'Wise Old Man')[1]['Talk-to'];
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:rescues', 191],
  ]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
  };
  const event = {
    player,
    // The Draynor spawn uses cache variant 2109 rather than the base 2108 ID.
    npcId: 2109,
    clickType: 1,
    definition: { getActions: () => ['Talk-to'] },
  };
  try {
    assert.equal(wiseOldMan(event), false, 'ordinary Wise Old Man dialogue stays available before the quest lead');
    attributes.set('recipe-for-disaster:amik-state', 1);
    assert.equal(wiseOldMan(event), true);
    assert.deepEqual(transcripts.at(-1), [
      'Recipe for Disaster/Freeing Sir Amik Varze',
      'finding-the-lair-talking-to-the-wise-old-man',
    ]);
    attributes.set('recipe-for-disaster:rescues', 255);
    assert.equal(wiseOldMan(event), false, 'the rescue dialogue no longer intercepts after Sir Amik is freed');
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
});

test('RFD Jubbly hunting requires the Ogre bow and equipped Ogre arrows', () => {
  const { api: base } = mockApi();
  const itemActions = [];
  const attackRules = [];
  let spawnedBird;
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onItemAction') return (_name, actions) => itemActions.push(actions);
      if (property === 'onCanAttack') return (handler) => attackRules.push(handler);
      if (property === 'spawnNpc') return ({ id }) => (spawnedBird = { getId: () => id });
      return target[property];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const ids = api.core.ItemIdentifiers;
  const npcIds = api.core.NpcIdentifiers;
  const equipment = new Map([[api.core.Equipment.WEAPON_SLOT, ids.OGRE_BOW]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:skrach-state', 1],
  ]);
  const messages = [];
  const player = {
    isPlayer: () => true,
    getAttribute: (key) => attributes.get(key),
    getLocation: () => new api.core.Location(2648, 2963, 0),
    getEquipment: () => ({ get: (slot) => equipment.has(slot) ? { getId: () => equipment.get(slot) } : null }),
    getInventory: () => ({ deleteNumber() {} }),
    sendMessage: (message) => messages.push(message),
  };
  const drop = itemActions.find((actions) => actions.Drop)?.Drop;
  const attack = attackRules.find((handler) => handler.toString().includes('AMMUNITION_SLOT'));
  assert.ok(drop);
  assert.ok(attack);
  drop({ player, itemId: ids.BALLOON_TOAD, option: 'Drop', handled: false });
  const bird = spawnedBird;
  assert.ok(bird);
  const attempt = () => {
    const event = { attacker: player, target: bird, allow: true };
    attack(event);
    return event.allow;
  };
  assert.equal(attempt(), false);
  assert.match(messages.at(-1), /ogre bow and ogre arrows/);
  equipment.set(api.core.Equipment.AMMUNITION_SLOT, ids.OGRE_ARROW);
  assert.equal(attempt(), true);
});

test('RFD counts diving weight in grams and checks the apparatus in the cape slot', () => {
  const { api, handlers } = mockApi();
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const condition = handlers.condition.at(-1);
  const makeItem = (id, weight, amount = 1) => ({
    getId: () => id,
    getAmount: () => amount,
    getDefinition: () => ({ getWeight: () => weight }),
  });
  const inventoryItems = [makeItem(995, 0, 1000), makeItem(-1, 50000, 0)];
  const equipmentItems = new Array(14).fill(null).map(() => makeItem(-1, 50000, 0));
  equipmentItems[api.core.Equipment.HEAD_SLOT] = makeItem(api.core.ItemIdentifiers.FISHBOWL_HELMET, 5000);
  equipmentItems[api.core.Equipment.CAPE_SLOT] = makeItem(api.core.ItemIdentifiers.DIVING_APPARATUS, 10000);
  const equipment = {
    getItems: () => equipmentItems,
    get: (slot) => equipmentItems[slot],
  };
  const inventory = {
    getItems: () => inventoryItems,
    getAmount: () => 0,
  };
  const player = { getInventory: () => inventory, getEquipment: () => equipment };

  assert.equal(condition({ player, text: 'If the player weighs more than 27kg:' }), false);
  assert.equal(condition({ player, text: 'If the player has lost their diving apparatus:' }), false);
  inventoryItems.push(makeItem(231, 12999));
  assert.equal(condition({ player, text: 'If the player weighs more than 27kg:' }), false);
  inventoryItems.push(makeItem(232, 1));
  assert.equal(condition({ player, text: 'If the player weighs more than 27kg:' }), true);
  assert.equal(condition({ player, text: 'If the player is properly equipped:' }), false);
});

test('RFD Murphy distinguishes a cat follower from other pets', () => {
  const { api: base, handlers } = mockApi();
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: { forId: (id) => ({ getName: () => id === 5591 ? 'Pet kitten' : 'Pet' }) } });
  const api = new Proxy(base, { get: (target, prop) => prop === 'core' ? core : target[prop] });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const condition = handlers.condition.at(-1);
  const attributes = new Map();
  const player = { getAttribute: (key) => attributes.get(key), getInventory: () => ({ getAmount: () => 0 }) };
  const pet = { getId: () => 5591, isRegistered: () => true };
  const npcId = api.core.NpcIdentifiers.MURPHY;

  assert.equal(condition({ player, npcId, stepId: 'bPnGSr' }), false);
  assert.equal(condition({ player, npcId, stepId: 'V2XqCw' }), false);
  attributes.set('pets:current', pet);
  assert.equal(condition({ player, npcId, stepId: 'bPnGSr' }), false);
  assert.equal(condition({ player, npcId, stepId: 'V2XqCw' }), true);
});

test('RFD dive and finale actions move players with Location objects', () => {
  const { api, handlers } = mockApi();
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const actions = handlers.custom.get('npc-dialogue:action');
  const action = actions.find((handler) => handler.toString().includes('azBBMr'));
  assert.ok(action);
  const items = api.core.ItemIdentifiers;
  const equipment = new Map([
    [api.core.Equipment.HEAD_SLOT, items.FISHBOWL_HELMET],
    [api.core.Equipment.CAPE_SLOT, items.DIVING_APPARATUS],
  ]);
  let destination;
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({ getItems: () => [], getFreeSlots: () => 27 }),
    getEquipment: () => ({ get: (slot) => ({ getId: () => equipment.get(slot) }) }),
    moveTo: (location) => { destination = location; },
  };
  attributes.set('quest.recipe_for_disaster.stage', 4);
  action({ player, stepId: 'azBBMr' });
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2960, 9512, 1]);
});

test('RFD lets divers leave the mudskipper cave without surfacing', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handler = objectHandlers.find((entry) => entry.toString().includes('MUDSKIPPER_CAVE'));
  assert.ok(handler);
  let destination;
  const player = {
    getLocation: () => new api.core.Location(2948, 9524, 1),
    moveTo: (location) => { destination = location; },
  };
  const event = { player, objectId: api.core.ObjectIdentifiers.UNDERWATER_CAVERN_ENTRANCE_4,
    clickType: 1, definition: { getActions: () => ['Exit'] } };
  handler(event);
  assert.equal(event.handled, true);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2948, 9512, 1]);

  const attributes = new Map([['recipe-for-disaster:pirate-state', 8]]);
  const outside = {
    getAttribute: (key) => attributes.get(key),
    getLocation: () => new api.core.Location(2975, 9512, 1),
    getInventory: () => ({ getAmount: (id) => id === api.core.ItemIdentifiers.ROCK_7 ? 5 : 0 }),
    moveTo: (location) => { destination = location; },
  };
  const door = { player: outside, objectId: api.core.ObjectIdentifiers.PEN_DOOR,
    clickType: 1, definition: { getActions: () => ['Open'] } };
  handler(door);
  assert.equal(door.handled, true);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2975, 9518, 1]);
  outside.getLocation = () => new api.core.Location(2975, 9518, 1);
  handler(door);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2975, 9512, 1]);
});

test('RFD Mother cycles six weaknesses and the final room suppresses prayer and regeneration', (t) => {
  const { api: base } = mockApi();
  const loginHandlers = [];
  const prayerHandlers = [];
  const deathHandlers = [];
  const objectHandlers = [];
  const npcDeathHandlers = [];
  const combatHitHandlers = [];
  const npcHitModifyHandlers = [];
  const spawns = [];
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: { forId: () => ({ getActions: () => ['Talk-to'] }) } });
  Object.defineProperty(core, 'Boundary', { value: class Boundary { constructor(...values) { this.values = values; } } });
  Object.defineProperty(core, 'PrivateArea', { value: class PrivateArea {
    constructor(boundaries) { this.boundaries = boundaries; this.members = new Set(); this.destroyed = false; }
    enter(mobile) { this.members.add(mobile); mobile.setArea(this); }
    leave(mobile) { this.members.delete(mobile); mobile.setArea(null); if (!this.members.size) this.destroyed = true; }
    hasMember(mobile) { return this.members.has(mobile); }
    isDestroyed() { return this.destroyed; }
  } });
  Object.defineProperty(core, 'PrayerHandler', { value: { deactivatePrayers() {} } });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return core;
      if (prop === 'onPlayerLogin') return (handler) => loginHandlers.push(handler);
      if (prop === 'onPrayerDisabled') return (handler) => prayerHandlers.push(handler);
      if (prop === 'onPlayerDeath') return (handler) => deathHandlers.push(handler);
      if (prop === 'onObjectInteraction') return (...args) => objectHandlers.push(args);
      if (prop === 'onNpcDeath') return (handler) => npcDeathHandlers.push(handler);
      if (prop === 'onCombatHitResolved') return (handler) => combatHitHandlers.push(handler);
      if (prop === 'onNpcHitModify') return (handler) => npcHitModifyHandlers.push(handler);
      if (prop === 'spawnNpc') return (definition) => {
        let refreshes = 0;
        let area = null;
        const npc = { definition, refreshes: () => refreshes, getArea: () => area,
          setArea: (next) => { area = next; }, isRegistered: () => true, isNpc: () => true,
          setNpcTransformationId: (id) => { npc.transformation = id; },
          getCombat: () => ({ getLastAttack: () => ({ reset: () => refreshes++ }) }) };
        spawns.push(npc);
        return npc;
      };
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quests = getRegisteredQuests();
  const quest = quests.findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map([
    ['recipe-for-disaster:rescues', 255],
    ['recipe-for-disaster:culinaromancer-wave', 5],
    ['quest.points', 175],
  ]);
  const equipment = [];
  const { CombatSpells } = require('../dist/game/content/combat/magic/CombatSpells');
  const { PendingHit } = require('../dist/game/content/combat/hit/PendingHit');
  const { MagicCombatMethod } = require('../dist/game/content/combat/method/impl/MagicCombatMethod');
  t.mock.method(PendingHit.prototype, 'prepareHits', function () {
    this.accurate = true;
    this.totalDamage = 7;
    let damage = 7;
    return [{ getDamage: () => damage, setDamage: (value) => { damage = value; } }];
  });
  let selectedSpell = null;
  const player = {
    isPlayer: () => true,
    getAsPlayer: () => player,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getArea: () => area,
    setArea: (next) => { area = next; },
    getLocation: () => ({ getX: () => 1900, getY: () => 5355, getZ: () => 2 }),
    getSkillManager: () => ({ getCurrentLevel: () => 1 }),
    getPrayerActive: () => [],
    getEquipment: () => ({ getItems: () => equipment }),
    getCombat: () => ({ getSelectedSpell: () => selectedSpell }),
    moveTo: (location) => { player.destination = location; },
    getPacketSender: () => new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => {} : undefined }),
    messages: [], sendMessage(message) { this.messages.push(message); },
  };
  let area = null;
  quest.setStage(player, 4);
  for (const key of ['fishing_contest', 'goblin_diplomacy', 'big_chompy_bird_hunting', 'murder_mystery',
    'nature_spirit', 'witchs_house', 'gertrudes_cat', 'shadow_of_the_storm', 'monkey_madness_i',
    'family_crest', 'heroes_quest', 'lost_city', 'merlins_crystal', 'shield_of_arrav', 'dragon_slayer_i',
    'shilo_village', 'jungle_potion', 'druidic_ritual', 'underground_pass', 'biohazard', 'plague_city',
    'waterfall_quest', 'desert_treasure_i', 'horror_from_the_deep']) {
    const prerequisite = quests.findLast((entry) => entry.key === key);
    assert.ok(prerequisite, `missing prerequisite quest ${key}`);
    prerequisite.setStage(player, prerequisite.completionValue);
  }
  quests.findLast((entry) => entry.key === 'legends_quest')?.setStage(player, 5);

  loginHandlers.findLast(Boolean)({ player });
  const mother = spawns.at(-1);
  assert.equal(mother.definition.id, api.core.NpcIdentifiers.GELATINNOTH_MOTHER);
  assert.deepEqual(mother.definition, { id: api.core.NpcIdentifiers.GELATINNOTH_MOTHER,
    x: 1900, y: 5355, z: 2, wanderRadius: 0, owner: player, ownerOnly: true });
  assert.deepEqual(player.getArea().boundaries[0].values, [1889, 1910, 5345, 5366, 2]);
  assert.equal(mother.transformation, 4884);
  player.getArea().process(player);
  assert.equal(mother.refreshes(), 1);
  const handleMotherHit = npcHitModifyHandlers.findLast((handler) => handler.toString().includes('motherPhaseFor'));
  assert.equal(handleMotherHit.name, 'enforceMotherWeakness');
  const makeHit = (type, accurate = true, spell = null) => {
    let damage = 7;
    const hitDamage = { setDamage(value) { damage = value; }, getDamage() { return damage; } };
    return {
      getAttacker: () => player,
      getCombatType: () => type,
      getSpell: () => spell,
      isAccurate: () => accurate,
      getHits: () => [hitDamage],
      getTotalDamage: () => damage,
      setTotalDamage(value) { hitDamage.setDamage(value); },
    };
  };
  const wrongStyle = makeHit(api.core.CombatType.MELEE);
  const victim = { hitpoints: 100 };
  handleMotherHit({ npc: mother, hit: wrongStyle });
  victim.hitpoints -= wrongStyle.getTotalDamage();
  assert.equal(victim.hitpoints, 100, 'the pre-damage hook prevents an accurate wrong-style hit from reducing HP');
  assert.equal(wrongStyle.getTotalDamage(), 0, 'the white form blocks melee before damage is applied');
  selectedSpell = CombatSpells.WIND_BLAST;
  equipment[api.core.Equipment.WEAPON_SLOT] = { getId: () => api.core.ItemIdentifiers.STAFF_OF_AIR };
  const airHit = makeHit(api.core.CombatType.MAGIC, true, selectedSpell);
  handleMotherHit({ npc: mother, hit: airHit });
  assert.equal(airHit.getTotalDamage(), 7, 'the white form accepts an air spell');
  for (let tick = 0; tick < 29; tick++) player.getArea().process(player);
  assert.equal(mother.transformation, 4885, 'the Mother changes to blue after 30 ticks');
  selectedSpell = CombatSpells.WATER_BLAST;
  player.getLocation = () => new api.core.Location(1900, 5355, 2);
  mother.getLocation = () => new api.core.Location(1900, 5355, 2);
  mother.getSize = () => 1;
  const waterHit = new MagicCombatMethod().hits(player, mother)[0];
  selectedSpell = null; // MagicCombatMethod.finished clears the selected cast before impact.
  handleMotherHit({ npc: mother, hit: waterHit });
  assert.equal(waterHit.getTotalDamage(), 7, 'Water Blast remains water even when an air staff supplies its air runes');
  selectedSpell = CombatSpells.WIND_BLAST;
  const wrongAirHit = new MagicCombatMethod().hits(player, mother)[0];
  selectedSpell = null;
  handleMotherHit({ npc: mother, hit: wrongAirHit });
  assert.equal(wrongAirHit.getTotalDamage(), 0, 'the blue form blocks an air spell even with an air staff equipped');
  const phaseCases = [
    { type: api.core.CombatType.MELEE, spell: null, wrongType: api.core.CombatType.MAGIC },
    { type: api.core.CombatType.MAGIC, spell: CombatSpells.EARTH_BLAST, wrongSpell: CombatSpells.FIRE_BLAST },
    { type: api.core.CombatType.MAGIC, spell: CombatSpells.FIRE_BLAST, wrongSpell: CombatSpells.EARTH_BLAST },
    { type: api.core.CombatType.RANGED, spell: null, wrongType: api.core.CombatType.MELEE },
  ];
  for (let phase = 2; phase < 6; phase++) {
    for (let tick = 0; tick < 30; tick++) player.getArea().process(player);
    assert.equal(mother.transformation, 4884 + phase);
    const current = phaseCases[phase - 2];
    selectedSpell = current.spell;
    const valid = makeHit(current.type, true, current.spell);
    handleMotherHit({ npc: mother, hit: valid });
    assert.equal(valid.getTotalDamage(), 7, `phase ${phase} accepts its required combat style`);
    selectedSpell = current.wrongSpell ?? null;
    const invalid = makeHit(current.wrongType ?? api.core.CombatType.MAGIC, true, current.wrongSpell ?? null);
    handleMotherHit({ npc: mother, hit: invalid });
    assert.equal(invalid.getTotalDamage(), 0, `phase ${phase} rejects the wrong combat style`);
  }
  attributes.set('recipe-for-disaster:culinaromancer-wave', 3);
  const combatLevels = new Map([[api.core.Skill.ATTACK, 99], [api.core.Skill.STRENGTH, 99],
    [api.core.Skill.DEFENCE, 99], [api.core.Skill.RANGED, 99], [api.core.Skill.MAGIC, 99]]);
  player.getSkillManager = () => ({
    getCurrentLevel: (skill) => combatLevels.get(skill) ?? 1,
    setCurrentLevelCombat: (skill, value) => combatLevels.set(skill, value),
  });
  player.setRunEnergy = (value) => { player.runEnergy = value; };
  player.setSpecialPercentage = (value) => { player.special = value; };
  player.getPacketSender = () => new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => {} : undefined });
  player.getTimers = () => ({ has: () => false, registers() {} });
  player.getCombat = () => ({ reset() {} });
  player.getMovementQueue = () => ({ reset() {} });
  player.performGraphic = () => {};
  const karamel = { isNpc: () => true, getId: () => api.core.NpcIdentifiers.KARAMEL };
  const karamelHit = { getCombatType: () => api.core.CombatType.MAGIC, isAccurate: () => true,
    getTotalDamage: () => 5 };
  combatHitHandlers.findLast((handler) => handler.toString().includes('Karamel'))({ attacker: karamel, target: player, hit: karamelHit });
  assert.ok([...combatLevels.values()].some((level) => level < 99), 'Karamel lowers combat stats on a successful magic hit');
  assert.equal(player.runEnergy, 0);
  assert.equal(player.special, 0);
  const prayer = { player, disabled: null };
  prayerHandlers.at(-1)(prayer);
  assert.equal(prayer.disabled, true);
  assert.match(prayer.message, /cannot use Prayer/);
  player.setArea(null);
  const outsidePrayer = { player, disabled: null };
  prayerHandlers.at(-1)(outsidePrayer);
  assert.equal(outsidePrayer.disabled, null);
  attributes.set('recipe-for-disaster:culinaromancer-wave', 5);
  player.setArea(mother.getArea());
  const portal = objectHandlers.findLast(([name]) => name === 'Portal')?.[1];
  assert.equal(typeof portal?.Use, 'function');
  assert.equal(portal.Use({ player, action: 'Use', location: { x: 1900, y: 5345, z: 2 } }), true);
  assert.deepEqual([player.destination.getX(), player.destination.getY(), player.destination.getZ()], [3209, 3218, 0]);
  assert.equal(player.getArea(), null);
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), 5,
    'leaving the arena preserves the next wave checkpoint');
  assert.equal(portal.Use({ player, action: 'Use', location: { x: 3209, y: 3218, z: 0 } }), true);
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), 5);
  assert.equal(spawns.at(-1).definition.id, api.core.NpcIdentifiers.GELATINNOTH_MOTHER,
    're-entering resumes the saved wave');
  attributes.set('recipe-for-disaster:culinaromancer-wave', 1);
  loginHandlers.findLast(Boolean)({ player });
  deathHandlers.at(-1)({ player });
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), -1);
  assert.equal(player.getArea(), null);

  attributes.set('recipe-for-disaster:culinaromancer-wave', 5);
  assert.equal(portal.Use({ player, action: 'Use', location: { x: 3209, y: 3218, z: 0 } }), true);
  const transformedMother = spawns.at(-1);
  transformedMother.setNpcTransformationId(4889);
  const advanceFinale = npcDeathHandlers.findLast((handler) => handler.toString().includes('encounter.wave !== wave'));
  advanceFinale({ killer: player, npc: transformedMother, npcId: 4889 });
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), 6,
    'a transformed Mother reports its live cache id and still advances to the Culinaromancer');
  assert.equal(spawns.at(-1).definition.id, api.core.NpcIdentifiers.CULINAROMANCER_9);
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
