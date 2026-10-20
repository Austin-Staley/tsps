// Quest Helper parity for Below Ice Mountain and The Ides of Milk.
// Run from server/: node --test tests/qh-f2p-new-parity.test.cjs
const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const path = require('node:path');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
const I = core.ItemIdentifiers, N = core.NpcIdentifiers;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  new NpcDefinitionLoader().load();
});

function register(name, key) {
  const variants = [], conditions = [], custom = new Map(), packets = [];
  const api = new Proxy({
    core,
    persistAttribute() {},
    onNpcDialogueVariant: (fn) => variants.push(fn),
    onNpcDialogueCondition: (fn) => conditions.push(fn),
    onCustomEvent: (event, fn) => {
      if (!custom.has(event)) custom.set(event, []);
      custom.get(event).push(fn);
    },
    emitCustomEvent: (event, payload) => { for (const fn of custom.get(event) ?? []) fn(payload); },
  }, { get: (target, prop) => prop in target ? target[prop] : () => {} });
  require(`../plugins/quests/quests/${name}.Quest`)(api);
  return {
    quest: getRegisteredQuests().findLast((quest) => quest.key === key),
    variant: (npcId, player) => variants.map((fn) => fn({ player, npcId })).find(Boolean) ?? null,
    condition: (event) => conditions.map((fn) => fn(event)).find((answer) => answer !== null && answer !== undefined) ?? null,
    emit: (event, payload) => api.emitCustomEvent(event, payload),
    packets,
  };
}

function talkWorld(key) {
  const variants = [], conditions = [], custom = new Map(), interactions = {}, spoken = [], messages = [];
  const installed = { variants: 0, conditions: 0 };
  const api = new Proxy({
    core,
    persistAttribute() {}, registerArea() {}, registerNpcCombatMethodProvider() {},
    onNpcDialogueVariant: (fn) => {
      variants.push(fn);
      PluginManager.npcDialogueVariantHooks.push({ pluginName: 'qh-f2p-new-test', handler: fn });
      installed.variants++;
    },
    onNpcDialogueCondition: (fn) => {
      conditions.push(fn);
      PluginManager.npcDialogueConditionHooks.push({ pluginName: 'qh-f2p-new-test', handler: fn });
      installed.conditions++;
    },
    onCustomEvent: (event, fn) => {
      if (!custom.has(event)) custom.set(event, []);
      custom.get(event).push(fn);
    },
    emitCustomEvent: (event, payload) => { for (const fn of custom.get(event) ?? []) fn(payload); },
    onAnyNpcInteraction: (actions) => Object.assign(interactions, actions),
    sendMultiChatboxPrompt: (_player, _prompt, ...pairs) => {
      const options = [];
      for (let i = 0; i < pairs.length; i += 2) options.push({ text: String(pairs[i]), select: pairs[i + 1] });
      (options.find((option) => /fine|goodbye/i.test(option.text)) ?? options.at(-1))?.select();
      return true;
    },
  }, { get: (target, prop) => prop in target ? target[prop] : () => {} });
  require(`../plugins/quests/quests/${key === 'the_ides_of_milk' ? 'IdesOfMilk' : 'BelowIceMountain'}.Quest`)(api);
  const quest = getRegisteredQuests().findLast((entry) => entry.key === key);
  require('../plugins/npcs/NpcDialogues.plugin').register(api);

  function dialogueManager(p) {
    let generation = 0;
    const manager = {
      entries: [], index: -1,
      reset() { this.entries = []; this.index = -1; },
      getCurrent() { return this.entries[this.index]; },
      isActive() { return false; },
      advance() {},
      startDialogues(chain) {
        const entries = [...chain.getDialogues().values()].sort((a, b) => a.getIndex() - b.getIndex());
        const mine = ++generation;
        this.entries = entries; this.index = 0;
        while (generation === mine && this.index < entries.length) {
          const entry = entries[this.index++];
          if (typeof entry.getText === 'function') spoken.push(entry.getText());
          entry.send(p);
        }
        if (generation === mine) this.reset();
      },
    };
    return manager;
  }

  function player() {
    const attributes = new Map(), items = new Map(), varbits = new Map(), packets = [];
    let free = 28, manager, location = new core.Location(3254, 3274, 0);
    const sender = new Proxy({ sendVarbit: (id, value) => { varbits.set(id, value); return sender; } }, {
      get: (target, key) => key in target ? target[key] : (...args) => { packets.push([key, ...args]); return sender; },
    });
    const inventory = {
      getAmount: (id) => items.get(id) ?? 0, getFreeSlots: () => free, isFull: () => free <= 0,
      adds(id, amount = 1) {
        assert.ok(free >= amount, `no inventory space for ${id}`);
        items.set(id, (items.get(id) ?? 0) + amount); free -= amount;
      },
      deleteNumber(id, amount = 1) {
        assert.ok((items.get(id) ?? 0) >= amount, `missing ${id}`);
        const left = (items.get(id) ?? 0) - amount;
        if (left) items.set(id, left); else items.delete(id);
        free += amount;
      },
    };
    const p = {
      attributes, items, varbits, packets, getFreeSlots: () => free,
      getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
      getInventory: () => inventory,
      getEquipment: () => ({ get: () => null, getAmount: () => 0, getItems: () => [], refreshItems() {} }),
      getPacketSender: () => sender,
      getDialogueManager: () => manager,
      getSkillManager: () => ({ getCurrentLevel: () => 99, getMaxLevel: () => 10, getCombatLevel: () => 20 }),
      getLocation: () => location, moveTo: (value) => { location = value; },
      getUsername: () => 'QhParity', getAppearance: () => ({ isMale: () => true }), isIronman: () => false,
      sendMessage: (text) => messages.push(text), isRegistered: () => true,
      getMovementQueue: () => ({ reset() { return this; }, setBlockMovement() { return this; } }),
      getCombat: () => ({ reset() {} }), setUntargetable() {}, performAnimation() {},
    };
    manager = dialogueManager(p);
    return p;
  }

  return {
    quest, player, interactions, spoken, messages,
    talk(p, npcId) {
      const definition = core.NpcDefinition.forId(npcId);
      return interactions['Talk-to']({ player: p, npc: { getId: () => npcId, getName: () => definition.getName() }, npcId, definition });
    },
    cleanup() {
      if (installed.variants) PluginManager.npcDialogueVariantHooks.splice(-installed.variants);
      if (installed.conditions) PluginManager.npcDialogueConditionHooks.splice(-installed.conditions);
    },
  };
}

function player() {
  const attributes = new Map(), items = new Map();
  let location = new core.Location(3200, 3400, 0), free = 28, strength = 99, ironman = false;
  const sender = new Proxy({ sendVarbit: (id, value) => { p.varbits.set(id, value); return sender; } }, {
    get: (target, key) => key in target ? target[key] : () => sender,
  });
  const p = {
    attributes, items, varbits: new Map(), messages: [],
    getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => items.get(id) ?? 0, isFull: () => free <= 0, getFreeSlots: () => free,
      adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
    }),
    getEquipment: () => ({ get: () => null, getAmount: () => 0 }),
    getSkillManager: () => ({ getCurrentLevel: () => strength, getMaxLevel: () => 10, getCombatLevel: () => 20 }),
    getLocation: () => location, moveTo: (value) => { location = value; },
    getPacketSender: () => sender, isIronman: () => ironman,
    sendMessage: (text) => p.messages.push(text),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    setFreeSlots(value) { free = value; }, setStrength(value) { strength = value; }, setIronman(value) { ironman = value; },
  };
  return p;
}

test('Below Ice Mountain covers every QH recruitment state and its last-member branches', () => {
  const q = register('BelowIceMountain', 'below_ice_mountain'), p = player();
  const C = 'quest.below_ice_mountain.checkal', M = 'quest.below_ice_mountain.marley', B = 'quest.below_ice_mountain.burntof';
  const progress = (value) => p.setAttribute('below-ice-mountain:progress', value);
  const variant = (npcId) => q.variant(npcId, p);

  q.quest.setStage(p, 0);
  assert.equal(variant(N.WILLOW), 'willow-the-archaeologist-talking-to-willow');

  q.quest.setStage(p, 1);
  progress(5); assert.equal(variant(N.WILLOW), 'willow-the-archaeologist-talking-to-willow');
  progress(7); assert.equal(variant(N.WILLOW), 'willow-the-archaeologist-talking-to-willow');
  progress(10); assert.equal(variant(N.WILLOW), 'willow-the-archaeologist-talking-to-willow-again');

  p.setAttribute(C, 5);
  assert.equal(variant(N.CHECKAL), 'checkal-the-strongman-talking-to-checkal-talking-to-checkal-again');
  p.setAttribute('quest.below_ice_mountain.atlas-sessions', 1); p.setAttribute(C, 15);
  assert.equal(variant(N.CHECKAL), 'checkal-the-strongman-talking-to-checkal-after-completing-atlas-training');
  p.setAttribute(C, 20);
  assert.equal(variant(N.CHECKAL), 'checkal-the-strongman-talking-to-checkal-again-before-showing-muscles');
  p.setAttribute(C, 40);
  assert.equal(variant(N.CHECKAL), 'checkal-the-strongman-talking-to-checkal-again-before-showing-muscles-talking-to-checkal-at-ice-mountain');

  p.setAttribute(M, 5);
  assert.equal(variant(N.MARLEY), 'marley-the-thief-talking-to-marley-talking-to-marley-again');
  p.setAttribute(M, 35);
  assert.equal(variant(N.MARLEY), 'marley-the-thief-returning-to-marley');
  p.setAttribute(M, 40);
  assert.equal(variant(N.MARLEY), 'marley-the-thief-returning-to-marley-talking-to-marley-at-ice-mountain');

  p.setAttribute(B, 5);
  assert.equal(variant(N.BURNTOF), 'burntof-master-of-explosives-talking-to-burntof-again-before-he-gets-a-beer');
  p.setAttribute(B, 10);
  assert.equal(variant(N.BURNTOF), 'burntof-master-of-explosives-rock-paper-scissors');
  p.setAttribute(B, 15);
  assert.equal(variant(N.BURNTOF_2), 'burntof-master-of-explosives-rock-paper-scissors');
  p.setAttribute(B, 40);
  assert.equal(variant(N.BURNTOF), 'burntof-master-of-explosives-talking-to-burntof-at-ice-mountain');

  q.quest.setStage(p, 2);
  progress(20); assert.equal(variant(N.WILLOW), 'the-ruins-of-camdozaal-talking-to-willow');
  progress(25); assert.equal(variant(N.WILLOW), 'the-ruins-of-camdozaal-talking-to-willow-talking-to-willow-again-if-the-player-chose-no');

  // Each crew member's line checks the *other* two, so the final recruit sees the
  // QH "this was the last member" branch even though its own state is not 40 yet.
  const last = (npcId, current, drop, lastId, otherId) => {
    p.setAttribute(C, 40); p.setAttribute(M, 40); p.setAttribute(B, 40); p.setAttribute(current, 20);
    assert.equal(q.condition({ player: p, npcId, stepId: lastId }), true);
    assert.equal(q.condition({ player: p, npcId, stepId: otherId }), false);
    p.setAttribute(drop, 0);
    assert.equal(q.condition({ player: p, npcId, stepId: lastId }), false);
    assert.equal(q.condition({ player: p, npcId, stepId: otherId }), true);
  };
  last(N.CHECKAL, C, M, 'RPjNZ9', 'p3MZVl');
  last(N.BURNTOF, B, C, '_wuChA', 'h3U6R5');
  last(N.BURNTOF_2, B, C, '_wuChA', 'h3U6R5');
  last(N.MARLEY, M, C, 'mVCBES', 'Yky2FJ');

  const condition = (stepId) => q.condition({ player: p, npcId: N.ATLAS, stepId });
  p.setStrength(98); assert.equal(condition('CdEohS'), false); assert.equal(condition('YEdgkU'), true);
  p.setStrength(99); assert.equal(condition('CdEohS'), true); assert.equal(condition('YEdgkU'), false);
  p.items.set(I.COINS, 24999); assert.equal(condition('-zuNtr'), false); assert.equal(condition('Z_TXng'), true);
  p.items.set(I.COINS, 25000); assert.equal(condition('-zuNtr'), true); assert.equal(condition('Z_TXng'), false);
  p.items.clear(); assert.equal(condition('EX9T0U'), true); assert.equal(condition('L2PHG2'), false);
  p.items.set(I.ASGARNIAN_ALE, 1); assert.equal(condition('EX9T0U'), false); assert.equal(condition('L2PHG2'), true);
});

test('The Ides of Milk covers every QH stage branch and condition', () => {
  const q = register('IdesOfMilk', 'the_ides_of_milk'), p = player();
  const variant = (npcId) => q.variant(npcId, p);
  const stage = (value) => q.quest.setStage(p, value);

  stage(3);
  assert.equal(variant(N.CASSIUS_2), 'starting-off-talking-to-cassius-again-before-talking-to-both-gillie-and-seth');
  assert.equal(variant(N.GILLIE_GROATS), 'starting-off-talking-to-gillie');
  assert.equal(variant(N.SETH_GROATS), 'starting-off-talking-to-seth');
  p.setAttribute('quest.the_ides_of_milk.seth', 1);
  assert.equal(variant(N.SETH_GROATS), 'starting-off-talking-to-seth-again');

  stage(4); assert.equal(variant(N.CASSIUS_2), 'returning-to-cassius');
  stage(5); assert.equal(variant(N.CASSIUS_2), 'returning-to-cassius-reclaiming-the-milk-sample');
  stage(6);
  assert.equal(variant(N.CASSIUS_2), 'returning-to-cassius-reclaiming-the-milk-sample');
  p.items.set(I.MILK_SAMPLE, 1);
  assert.equal(variant(N.CASSIUS_2), 'returning-to-cassius-talking-to-cassius-before-sampling-the-milk');
  stage(8); assert.equal(variant(N.CASSIUS_2), 'returning-to-cassius-after-sampling-the-milk-resume');
  stage(10);
  assert.equal(variant(N.CASSIUS_2), 'returning-to-cassius-talking-to-cassius-again');
  assert.equal(variant(N.DUKE_HORACIO), 'talking-to-the-duke');
  assert.equal(variant(N.GILLIE_GROATS), null);
  stage(12);
  assert.equal(variant(N.DUKE_HORACIO), 'talking-to-the-duke-talking-to-the-duke-again');
  assert.equal(variant(N.GILLIE_GROATS), 'talking-to-the-duke-talking-to-gillie');
  stage(14); assert.equal(variant(N.GILLIE_GROATS), 'talking-to-the-duke-talking-to-gillie-again');
  stage(16); assert.equal(variant(N.GILLIE_GROATS), 'talking-to-the-duke-drinking-the-second-sample');
  stage(18); assert.equal(variant(N.GILLIE_GROATS), 'talking-to-the-duke-talking-to-gillie-again-2');
  stage(20); assert.equal(variant(N.GILLIE_GROATS), 'facing-the-bull-talking-to-gillie');
  stage(21);
  assert.equal(variant(N.GILLIE_GROATS), 'facing-the-bull-talking-to-gillie-again');
  assert.equal(variant(N.CASSIUS_2), 'facing-the-bull-returning-to-cassius');
  stage(22);
  assert.equal(variant(N.CASSIUS_2), 'post-quest-talking-to-cassius');
  assert.equal(variant(N.GILLIE_GROATS), 'post-quest-talking-to-gillie');

  const condition = (stepId) => q.condition({ player: p, npcId: N.GILLIE_GROATS, stepId });
  p.setAttribute('quest.the_ides_of_milk.seth', 0);
  assert.equal(condition('UGwoXz'), true); assert.equal(condition('P1dfHS'), false);
  p.setAttribute('quest.the_ides_of_milk.seth', 1);
  assert.equal(condition('UGwoXz'), false); assert.equal(condition('P1dfHS'), true);
  p.setIronman(true); assert.equal(condition('iRWhJf'), true); assert.equal(condition('3dp-G-'), false);
  p.setIronman(false); assert.equal(condition('iRWhJf'), false); assert.equal(condition('3dp-G-'), true);

  // QH inventories: the amulet is handed over before the lamp's space check.
  p.items.clear(); p.setFreeSlots(0);
  assert.equal(condition('rQeSSv'), true); assert.equal(condition('m2cjiq'), true); assert.equal(condition('0MczJn'), false);
  p.setFreeSlots(1);
  assert.equal(condition('rQeSSv'), false); assert.equal(condition('m2cjiq'), true); assert.equal(condition('0MczJn'), false);
  p.setFreeSlots(2);
  assert.equal(condition('m2cjiq'), false); assert.equal(condition('0MczJn'), true);
  p.items.set(I.COWBELL_AMULET, 1);
  assert.equal(condition('m2cjiq'), false); assert.equal(condition('0MczJn'), true);

  // The condition registry must advance the Groats information varbit, not just
  // expose a plausible helper.
  q.emit('npc-dialogue:condition', { player: p, stepId: 'UGwoXz' });
  assert.equal(p.getAttribute('quest.the_ides_of_milk.gillie'), 1);
  assert.equal(p.varbits.get(20107), 1);
});

test('real post-quest Gillie Talk-to hands the amulet, then exactly one unused lamp', () => {
  const w = talkWorld('the_ides_of_milk');
  try {
    const p = w.player(), inventory = p.getInventory();
    w.quest.setStage(p, 22);
    inventory.adds(I.SHARK, 27); // 27 non-stackable fillers: one free slot
    assert.equal(p.getFreeSlots(), 1);

    assert.equal(w.talk(p, N.GILLIE_GROATS), true);
    assert.equal(inventory.getAmount(I.COWBELL_AMULET), 1);
    assert.equal(inventory.getAmount(I.MAGIC_LAMP), 0);
    assert.equal(p.getFreeSlots(), 0);
    assert.equal(p.getAttribute('quest.the_ides_of_milk.reward'), 1);
    assert.equal(p.varbits.get(20109), 1);
    assert.ok(w.spoken.some((line) => /inventory is full/i.test(line)), 'the make-room branch must play');
    assert.ok(!w.spoken.some((line) => /Gillie hands you a magical lamp/i.test(line)));

    inventory.deleteNumber(I.SHARK, 1); // make room
    assert.equal(p.getFreeSlots(), 1);
    assert.equal(w.talk(p, N.GILLIE_GROATS), true);
    assert.equal(inventory.getAmount(I.COWBELL_AMULET), 1);
    assert.equal(inventory.getAmount(I.MAGIC_LAMP), 1);
    assert.equal(p.getFreeSlots(), 0);

    const before = [inventory.getAmount(I.COWBELL_AMULET), inventory.getAmount(I.MAGIC_LAMP), p.getFreeSlots()];
    assert.equal(w.talk(p, N.GILLIE_GROATS), true);
    assert.deepEqual([inventory.getAmount(I.COWBELL_AMULET), inventory.getAmount(I.MAGIC_LAMP), p.getFreeSlots()], before);
  } finally {
    w.cleanup();
  }
});
