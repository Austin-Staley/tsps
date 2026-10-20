// Quest Helper parity for The Restless Ghost, Rune Mysteries and X Marks the Spot.
// Run from server/: node --test tests/qh-f2p-lumbridge-parity.test.cjs
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
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
  const hooks = new Map(), variants = [], conditions = [], custom = new Map(), tasks = [];
  const api = new Proxy({
    core: { ...core, TaskManager: {
      submit: (task) => { task.setRunning(true); tasks.push(task); },
      cancelTasks: (key) => tasks.filter((task) => task.key === key).forEach((task) => task.stop()),
    } },
    persistAttribute() {},
    onNpcDialogueVariant: (fn) => variants.push(fn),
    onNpcDialogueCondition: (fn) => conditions.push(fn),
    onCustomEvent: (event, fn) => { if (!custom.has(event)) custom.set(event, []); custom.get(event).push(fn); },
    emitCustomEvent: (event, payload) => { for (const fn of custom.get(event) || []) fn(payload); },
  }, { get(target, prop) {
    if (prop in target) return target[prop];
    return (...args) => {
      const fn = args.findLast((arg) => typeof arg === 'function');
      if (fn) { if (!hooks.has(prop)) hooks.set(prop, []); hooks.get(prop).push(fn); }
    };
  } });
  require(`../plugins/quests/quests/${name}.Quest`)(api);
  return {
    quest: getRegisteredQuests().findLast((quest) => quest.key === key),
    variant: (event) => variants.map((fn) => fn(event)).find(Boolean) ?? null,
    condition: (event) => conditions.map((fn) => fn(event)).find((answer) => answer !== null && answer !== undefined) ?? null,
    emit: (event, payload) => api.emitCustomEvent(event, payload),
    call: (event, payload) => { for (const fn of hooks.get(event) || []) fn(payload); },
  };
}

function player() {
  const attributes = new Map(), items = new Map(), bank = new Map(), packets = [];
  let location = new core.Location(3228, 3242, 0);
  const p = {
    attributes, items, bank, packets, amulet: undefined, full: false, varbits: new Map(), messages: [], xp: [],
    getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => items.get(id) ?? 0, isFull: () => p.full, getFreeSlots: () => p.full ? 0 : 28,
      adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
    }),
    getBanks: () => [{ getAmount: (id) => bank.get(id) ?? 0 }],
    getEquipment: () => ({ get: () => p.amulet === undefined ? null : { getId: () => p.amulet } }),
    getPacketSender: () => new Proxy({ getVarbit: (id) => p.varbits.get(id) ?? 0 }, {
      get: (target, key) => key in target ? target[key] : (...args) => { packets.push([key, ...args]); return proxy; },
    }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getSkillManager: () => ({ getCombatLevel: () => 20, addExperiences: (skill, amount) => p.xp.push([skill.getIndex(), amount]) }),
    getLocation: () => location, moveTo: (value) => { location = value; },
    getUsername: () => 'QhParity', sendMessage: (text) => p.messages.push(text),
    performAnimation: () => {}, isRegistered: () => true,
  };
  const proxy = p.getPacketSender();
  p.getPacketSender = () => proxy;
  return p;
}

test('Restless Ghost dispatches the QH pre-quest, amulet-recovery and post-quest branches', () => {
  const q = register('RestlessGhost', 'the_restless_ghost'), p = player();
  const variant = (npcId) => q.variant({ player: p, npcId });

  q.quest.setStage(p, 0);
  assert.deepEqual(variant(N.FATHER_AERECK), { page: 'The Restless Ghost', variant: 'starting-out' });
  assert.deepEqual(variant(N.FATHER_URHNEY), { page: 'Father Urhney', variant: 'before-the-restless-ghost' });

  q.quest.setStage(p, 1);
  assert.deepEqual(variant(N.FATHER_AERECK), { page: 'The Restless Ghost', variant: 'starting-out-talking-to-father-aereck-again' });
  assert.deepEqual(variant(N.FATHER_URHNEY), { page: 'The Restless Ghost', variant: 'talking-to-father-urhney' });

  q.quest.setStage(p, 2);
  assert.deepEqual(variant(N.FATHER_URHNEY), { page: 'The Restless Ghost', variant: 'talking-to-father-urhney-if-the-ghostspeak-amulet-is-ever-lost' });
  assert.deepEqual(variant(N.RESTLESS_GHOST), { page: 'The Restless Ghost', variant: 'talking-to-the-restless-ghost-without-wearing-the-amulet-of-ghostspeak' });
  p.amulet = I.GHOSTSPEAK_AMULET;
  assert.deepEqual(variant(N.RESTLESS_GHOST), { page: 'The Restless Ghost', variant: 'talking-to-the-restless-ghost-while-wearing-the-amulet-of-ghostspeak' });

  q.quest.setStage(p, 3);
  assert.deepEqual(variant(N.FATHER_AERECK), { page: 'The Restless Ghost', variant: 'talking-to-the-restless-ghost-talking-to-father-aereck' });
  assert.deepEqual(variant(N.RESTLESS_GHOST), { page: 'The Restless Ghost', variant: 'talking-to-the-restless-ghost-talking-to-the-restless-ghost-again-with-the-amulet-of-ghostspeak' });

  q.quest.setStage(p, 4);
  assert.deepEqual(variant(N.FATHER_AERECK), { page: 'The Restless Ghost', variant: 'after-retrieving-the-skull-talking-to-father-aereck-with-the-skull' });
  assert.deepEqual(variant(N.FATHER_URHNEY), { page: 'The Restless Ghost', variant: 'talking-to-father-urhney-if-the-ghostspeak-amulet-is-ever-lost' });

  q.quest.setStage(p, 5);
  assert.deepEqual(variant(N.FATHER_URHNEY), { page: 'Father Urhney', variant: 'after-the-restless-ghost' });

  p.items.clear(); p.amulet = undefined; p.full = false;
  const condition = (text) => q.condition({ player: p, npcId: N.FATHER_URHNEY, text });
  assert.equal(condition("If they player currently has it in their inventory:"), false);
  p.items.set(I.GHOSTSPEAK_AMULET, 1);
  assert.equal(condition("If they player currently has it in their inventory:"), true);
  p.items.clear(); p.bank.set(I.GHOSTSPEAK_AMULET, 1);
  assert.equal(condition("If the amulet if stored in a bank, Death's Office, Item Retrieval Service:"), true);
  p.bank.clear(); p.full = true;
  assert.equal(condition('If the player does not have inventory space:'), true);
  assert.equal(condition('If the player has inventory space:'), false);
});

test('Rune Mysteries dispatches every QH stage branch and its item conditions', () => {
  const q = register('RuneMysteries', 'rune_mysteries'), p = player();
  const variant = (npcId) => q.variant({ player: p, npcId });
  const sedridor = N.ARCHMAGE_SEDRIDOR, aubury = N.AUBURY_2, duke = N.DUKE_HORACIO;

  q.quest.setStage(p, 0);
  assert.deepEqual(variant(duke), { page: 'Rune Mysteries', variant: 'starting-off-talking-to-duke-horacio' });
  assert.deepEqual(variant(sedridor), { page: 'Archmage Sedridor', variant: 'standard-dialogue-before-rune-mysteries' });
  assert.deepEqual(variant(aubury), { page: 'Aubury', variant: 'standard-dialogue-if-the-player-isn-t-carrying-a-combat-path-voucher-or-is-carrying-a-combat-path-voucher-and-has-received-all-possible-rewards-already' });

  q.quest.setStage(p, 1);
  assert.deepEqual(variant(duke), { page: 'Rune Mysteries', variant: 'starting-off-talking-to-duke-horacio-talking-to-duke-horacio-again' });
  assert.deepEqual(variant(sedridor), { page: 'Rune Mysteries', variant: 'delivering-the-talisman-talking-to-archmage-sedridor-talking-to-sedridor-again-after-not-having-the-talisman-when-first-going-through-the-dialogue' });
  p.items.set(I.AIR_TALISMAN, 1);
  assert.deepEqual(variant(sedridor), { page: 'Rune Mysteries', variant: 'delivering-the-talisman-talking-to-archmage-sedridor' });

  q.quest.setStage(p, 2);
  assert.deepEqual(variant(sedridor), { page: 'Rune Mysteries', variant: 'delivering-the-talisman-talking-to-archmage-sedridor-talking-to-sedridor-after-giving-him-the-talisman-but-before-agreeing-to-go-see-aubury' });

  q.quest.setStage(p, 3);
  assert.deepEqual(variant(sedridor), { page: 'Rune Mysteries', variant: 'delivering-the-talisman-talking-to-archmage-sedridor-talking-to-sedridor-after-agreeing-to-go-see-aubury-but-before-receiving-the-package' });
  assert.deepEqual(variant(aubury), { page: 'Rune Mysteries', variant: 'delivering-the-research-package-talking-to-aubury' });
  p.setAttribute('rune-mysteries:package-issued', 1);
  assert.deepEqual(variant(sedridor), { page: 'Rune Mysteries', variant: 'delivering-the-talisman-talking-to-archmage-sedridor-talking-to-sedridor-again' });

  q.quest.setStage(p, 4);
  assert.deepEqual(variant(aubury), { page: 'Rune Mysteries', variant: 'delivering-the-research-package-talking-to-aubury-talking-to-aubury-after-giving-him-the-package-but-before-he-goes-through-it' });

  q.quest.setStage(p, 5);
  assert.deepEqual(variant(sedridor), { page: 'Rune Mysteries', variant: 'delivering-the-research-notes-talking-to-sedridor' });
  assert.deepEqual(variant(aubury), { page: 'Rune Mysteries', variant: 'delivering-the-research-package-talking-to-aubury-talking-to-aubury-after-he-looked-through-the-package-but-before-he-hands-you-the-research-notes' });
  p.items.set(I.RESEARCH_NOTES_4, 1);
  assert.deepEqual(variant(aubury), { page: 'Rune Mysteries', variant: 'delivering-the-research-package-talking-to-aubury-talking-to-aubury-again' });

  q.quest.setStage(p, 6);
  assert.equal(variant(duke), null);
  assert.deepEqual(variant(sedridor), { page: 'Archmage Sedridor', variant: 'standard-dialogue-after-rune-mysteries' });

  const condition = (text) => q.condition({ player: p, npcId: sedridor, text });
  q.quest.setStage(p, 1); p.items.clear();
  assert.equal(condition('If the player lost the talisman:'), true);
  assert.equal(condition('If the player has the talisman:'), false);
  p.items.set(I.AIR_TALISMAN, 1);
  assert.equal(condition('If the player lost the talisman:'), false);
  assert.equal(condition('If the player has the talisman:'), true);
  q.quest.setStage(p, 3); p.items.clear();
  assert.equal(condition('If the player lost the package:'), true);
  assert.equal(condition('If the player has the package:'), false);
  q.quest.setStage(p, 5); p.items.clear();
  assert.equal(condition('If the player lost the notes:'), true);
  p.items.set(I.RESEARCH_NOTES_4, 1);
  assert.equal(condition('If the player has the notes:'), true);
  q.emit('npc-dialogue:choice', { player: p, npcId: sedridor, option: "No, I don't think you are Sedridor." });
  assert.equal(condition('If the player gave the talisman to him while doubting his identity:'), true);
  assert.equal(condition('If the player gave the talisman to him without doubting his identity:'), false);
});

test('X Marks dispatches the QH clue branches, recovers lost items, and re-digs a lost casket', () => {
  const q = register('XMarksTheSpot', 'x_marks_the_spot'), p = player();
  const variant = () => q.variant({ player: p, npcId: N.VEOS });

  q.quest.setStage(p, 0);
  assert.equal(variant(), 'starting-off-if-the-player-has-not-visited-great-kourend-before');
  p.varbits.set(4897, 1);
  assert.equal(variant(), 'starting-off-if-the-player-has-visited-great-kourend-before');
  p.setAttribute('x-marks-the-spot:awaiting-scroll', 1);
  assert.equal(variant(), 'starting-off-talking-to-veos-again-if-the-player-previously-did-not-have-inventory-space-for-the-treasure-scroll');

  q.quest.setStage(p, 1);
  assert.equal(variant(), 'talking-to-veos-after-losing-an-item');
  p.items.set(23067, 1);
  assert.equal(variant(), 'talking-to-veos-after-receiving-the-first-clue');

  q.quest.setStage(p, 5);
  assert.equal(variant(), 'talking-to-veos-after-receiving-the-fourth-clue');
  p.items.set(23071, 1);
  assert.deepEqual(variant(), { page: 'X Marks the Spot', variant: 'finishing-up' });
  p.items.delete(23071); p.setAttribute('x-marks-the-spot:handed-casket', 1);
  assert.deepEqual(variant(), { page: 'X Marks the Spot', variant: 'finishing-up' });

  q.quest.setStage(p, 6);
  assert.equal(variant(), 'standard-dialogue-at-port-sarim-subsequent-dialogue');

  q.quest.setStage(p, 0); p.full = true;
  const condition = (text, npc) => q.condition({ player: p, npcId: N.VEOS, npc, text });
  assert.equal(condition('If the player does not have any free inventory space:'), true);
  assert.equal(condition('If the player has a free inventory space:'), false);
  p.full = false;
  assert.equal(condition('If the player talks to Veos in Lumbridge:', { getLocation: () => new core.Location(3228, 3242, 0) }), true);
  assert.equal(condition('If the player talks to Veos in Port Sarim:', { getLocation: () => new core.Location(3054, 3245, 0) }), true);

  const lost = register('XMarksTheSpot', 'x_marks_the_spot'), digger = player();
  lost.quest.setStage(digger, 5);
  digger.moveTo(new core.Location(3078, 3259, 0));
  const dig = { player: digger, itemId: I.SPADE, option: 'Dig' };
  lost.call('onCanUseItem', dig);
  assert.equal(dig.allow, false);
  assert.equal(digger.items.get(23071), 1, 'the lost casket is re-dug at the fourth clue');
  assert.equal(lost.quest.getStage(digger), 5);
});
