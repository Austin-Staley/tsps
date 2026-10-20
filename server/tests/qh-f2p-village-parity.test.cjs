// Quest Helper parity for Romeo & Juliet, Witch's Potion and Vampyre Slayer.
// From server/: node --test tests/qh-f2p-village-parity.test.cjs (after yarn build).
const assert = require('node:assert/strict');
const path = require('node:path');
const { test, before } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
const transcripts = require('../data/definitions/npc-dialogues.json');
const core = PluginManager.getCoreApi();

before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(path.resolve(__dirname, '..'));
  require('../dist/game/definition/ObjectDefinition').ObjectDefinition.init();
});

function register(name, key) {
  const hooks = new Map(), custom = new Map(), ground = [], objects = [];
  const api = new Proxy({
    core: { ...core, ObjectManager: { register: (object) => objects.push(object), deregister() {} } },
    persistAttribute() {},
    getItemOnGroundManager: () => ({ registerLocation: (owner, item, location) => ground.push({ owner, item, location }) }),
    onCustomEvent(event, fn) { if (!custom.has(event)) custom.set(event, []); custom.get(event).push(fn); },
    emitCustomEvent(event, payload) { for (const fn of custom.get(event) ?? []) fn(payload); },
  }, { get(target, prop) {
    if (prop in target) return target[prop];
    return (...args) => {
      const fn = args.findLast((arg) => typeof arg === 'function');
      if (fn) { if (!hooks.has(prop)) hooks.set(prop, []); hooks.get(prop).push(fn); }
    };
  } });
  require(`../plugins/quests/quests/${name}.Quest`)(api);
  return { hooks, ground, objects,
    quest: getRegisteredQuests().findLast((quest) => quest.key === key),
    call: (event, payload) => {
      for (const fn of [...(custom.get(event) ?? []), ...(hooks.get(event) ?? [])]) fn(payload);
      return payload;
    },
  };
}

function player() {
  const attributes = new Map(), items = new Map();
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
    isFull: () => false,
    getFreeSlots: () => 28,
  };
  let packet;
  packet = new Proxy({}, { get: () => (...args) => packet });
  const p = { attributes, items, messages: [],
    getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory, getBanks: () => [{ getAmount: () => 0 }],
    getPacketSender: () => packet, getUsername: () => 'Parity',
    getLocation: () => new core.Location(3210, 3220, 0),
    getSkillManager: () => ({ getCombatLevel: () => 3, addExperiences() {} }),
    sendMessage: (message) => p.messages.push(message),
  };
  return p;
}

function conditions(page, variant) {
  const found = [];
  const walk = (steps) => {
    for (const step of steps ?? []) {
      if (step.type === 'condition') found.push(step);
      walk(step.steps);
      for (const option of step.options ?? []) walk(option.steps);
    }
  };
  walk(transcripts[page].variants[variant]);
  return found;
}

test("Witch's Potion drops the indoor rat's tail only while the quest is in progress", () => {
  const q = register('WitchsPotion', 'witchs_potion'), p = player();
  const RAT_INDOORS = 2855; // Quest Helper NpcID.RAT_INDOORS, cache NpcIdentifiers.RAT_7.
  const npc = { getLocation: () => new core.Location(2955, 3202, 0) };
  q.call('onNpcDeath', { killer: p, npc, npcId: RAT_INDOORS });
  assert.equal(q.ground.length, 0, 'no tail before the quest starts');
  q.quest.setStage(p, 1);
  q.call('onNpcDeath', { killer: p, npc, npcId: RAT_INDOORS });
  assert.equal(q.ground.length, 1);
  assert.equal(q.ground[0].item.getId(), core.ItemIdentifiers.RATS_TAIL);
  p.items.set(core.ItemIdentifiers.RATS_TAIL, 1);
  q.call('onNpcDeath', { killer: p, npc, npcId: RAT_INDOORS });
  assert.equal(q.ground.length, 1, 'carrying a tail does not produce another');
  p.items.delete(core.ItemIdentifiers.RATS_TAIL);
  q.quest.setStage(p, 3);
  q.call('onNpcDeath', { killer: p, npc, npcId: RAT_INDOORS });
  assert.equal(q.ground.length, 1, 'no tail after completion');
});

test('Witch\'s Potion maps every held ingredient combination to the real partial-item branches', () => {
  const q = register('WitchsPotion', 'witchs_potion'), p = player();
  const I = core.ItemIdentifiers, N = core.NpcIdentifiers;
  q.quest.setStage(p, 1);
  const hook = q.hooks.get('onNpcDialogueCondition')[0];
  const variant = () => q.hooks.get('onNpcDialogueVariant')[0]({ player: p, npcId: N.HETTY }).variant;
  const condition = conditions("Witch's Potion", 'acquiring-the-items-talking-to-hetty-with-some-of-the-items');

  const pair = condition.find((entry) => /rat's tail and burnt meat/.test(entry.text));
  assert.ok(pair, 'transcript still has the rat tail + burnt meat branch');
  p.items.set(I.RATS_TAIL, 1);
  assert.equal(hook({ player: p, npcId: N.HETTY, text: pair.text }), false);
  p.items.set(I.BURNT_MEAT, 1);
  assert.equal(hook({ player: p, npcId: N.HETTY, text: pair.text }), true);
  assert.equal(variant(), 'acquiring-the-items-talking-to-hetty-with-some-of-the-items');

  for (const id of [I.RATS_TAIL, I.BURNT_MEAT, I.ONION, I.EYE_OF_NEWT]) p.items.set(id, 1);
  assert.equal(variant(), 'acquiring-the-items-talking-to-hetty-with-all-the-items');
  p.items.clear();
  assert.equal(variant(), 'acquiring-the-items-talking-to-hetty-with-none-of-the-items');
});

test('Vampyre Slayer opens and searches the real 2612/2613 garlic cupboard', () => {
  const q = register('VampyreSlayer', 'vampyre_slayer'), p = player();
  const O = core.ObjectIdentifiers;
  assert.equal(O.CUPBOARD_18, 2612);
  assert.equal(O.CUPBOARD_19, 2613);
  const tile = new core.Location(3096, 3269, 1);
  const shut = new core.GameObject(O.CUPBOARD_18, tile, 10, 0);
  q.call('onObjectInteraction', { player: p, objectId: shut.getId(), object: shut, clickType: 1 });
  assert.equal(q.objects.at(-1)?.getId(), O.CUPBOARD_19);

  const open = new core.GameObject(O.CUPBOARD_19, tile, 10, 0);
  const search = open.getDefinition().getInteractions().indexOf('Search') + 1;
  assert.ok(search > 0, 'the open cupboard still offers Search');
  q.call('onObjectInteraction', { player: p, objectId: open.getId(), object: open, clickType: search });
  assert.equal(p.items.get(core.ItemIdentifiers.GARLIC), 1);
  assert.match(p.messages.at(-1), /cupboard contains garlic/);
});

test('Romeo & Juliet lets Juliet replace a lost message without advancing the stage', () => {
  const q = register('RomeoAndJuliet', 'romeo_and_juliet'), p = player();
  const N = core.NpcIdentifiers;
  q.quest.setStage(p, 20);
  const lost = conditions('Romeo & Juliet', 'finding-juliet-talking-to-juliet-again')
    .find((entry) => /lost the message/.test(entry.text));
  assert.ok(lost, 'transcript still has the lost-message branch');
  assert.equal(q.hooks.get('onNpcDialogueCondition')[0]({ player: p, npcId: N.JULIET, text: lost.text }), true);
  const action = q.call('npc-dialogue:action', { player: p, npcId: N.JULIET, stepId: 'KmL5hw' });
  assert.deepEqual(action.box.items, [core.ItemIdentifiers.MESSAGE]);
  assert.equal(p.items.get(core.ItemIdentifiers.MESSAGE), 1);
  assert.equal(q.quest.getStage(p), 20);
});
