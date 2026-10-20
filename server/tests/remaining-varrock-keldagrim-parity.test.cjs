// From server/: node --test tests/remaining-varrock-keldagrim-parity.test.cjs (after yarn build).
// Route source: pinned Quest Helper (Zoinkwiz/quest-helper 06da90f) DefenderOfVarrock and
// TheGiantDwarf, plus the recorded transcript variants in npc-dialogues.json.
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const path = require('node:path');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { DialogueManager } = require('../dist/game/model/dialogues/DialogueManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const runtime = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
const I = core.ItemIdentifiers, N = core.NpcIdentifiers, O = core.ObjectIdentifiers;
let nextIndex = 1;
const noop = () => {};
before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  new NpcDefinitionLoader().load();
  require('../plugins/items/ItemDefinitionLoader.plugin').register({ log() {}, onPlayerLogin() {}, registerContentEndpoint() {} });
});

function harness(name) {
  const hooks = {}, events = {}, tasks = [], npcs = [], removed = [], ground = [], objects = [], npcActions = new Map(), completedQuests = new Set();
  const api = new Proxy({
    core: {
      ...core,
      World: { ...core.World, getNpcsNear: () => npcs },
      TaskManager: {
        submit(task) { task.setRunning(true); tasks.push(task); },
        cancelTasks(key) { tasks.filter(task => task.key === key).forEach(task => task.stop()); },
      },
      ObjectManager: { register: object => objects.push(object), deregister: object => { const i = objects.indexOf(object); if (i >= 0) objects.splice(i, 1); } },
      MapObjects: { ...core.MapObjects, get: () => null },
    },
    persistAttribute: noop,
    onNpcInteraction: (target, actions) => {
      if (typeof target === 'function') (hooks.onNpcInteraction ??= []).push(target);
      else npcActions.set(target, actions);
    },
    onNpcsInteraction: (names, actions) => {
      for (const name of names) npcActions.set(name, actions);
    },
    onCustomEvent: (key, fn) => (events[key] ??= []).push(fn),
    emitCustomEvent: (key, event) => {
      if (key === "quest:is-complete") event.complete = completedQuests.has(event.key);
      else if (key === "quest:is-started") event.started = completedQuests.has(event.key);
      else (events[key] ?? []).forEach(fn => fn(event));
    },
    getObjectManager: () => ({ register: object => objects.push(object), deregister: object => { const i = objects.indexOf(object); if (i >= 0) objects.splice(i, 1); } }),
    getItemOnGroundManager: () => ({ registerLocation: (...args) => ground.push(args) }),
    sendMultiChatboxPrompt(p, title, ...pairs) {
      p.prompt = { title, options: pairs.filter((_, i) => i % 2 === 0), pairs };
      return true;
    },
    spawnNpc(definition) {
      const location = new core.Location(definition.x, definition.y, definition.z);
      const npc = { ...definition, getId: () => definition.id, getLocation: () => location, isRegistered: () => true, remove: noop };
      npcs.push(npc);
      return npc;
    },
    removeNpc: npc => { npc.removed = true; removed.push(npc); },
  }, { get: (target, key) => target[key] ?? ((...args) => (hooks[key] ??= []).push(args.find(x => typeof x === 'function'))) });
  for (const questName of (Array.isArray(name) ? name : [name])) require(`../plugins/quests/quests/${questName}.Quest`)(api);
  PluginManager.emitNpcDialogueCondition = event => {
    for (const fn of hooks.onNpcDialogueCondition ?? []) { const answer = fn(event); if (answer !== null && answer !== undefined) return answer; }
    return null;
  };
  const h = {
    api, hooks, events, tasks, npcs, removed, ground, objects, npcActions, completedQuests,
    quest: Array.isArray(name) ? runtime.getRegisteredQuests().find(q => q.key === 'defender_of_varrock') : runtime.getRegisteredQuests().at(-1),
    quests: runtime.getRegisteredQuests(),
    emit: (name, event) => (events[name] ?? []).forEach(fn => fn(event)),
    line(p, npcId, text) { const event = { player: p, npcId, text }; h.emit('npc-dialogue:line', event); return event; },
    action(p, npcId, stepId) { const event = { player: p, npcId, stepId }; h.emit('npc-dialogue:action', event); return event; },
    tick(count) { while (count-- > 0) [...tasks].forEach(task => task.tick()); },
    choose(p, text) {
      const prompt = p.prompt; assert.ok(prompt, `no menu for ${text}`);
      const index = prompt.options.findIndex(label => label === text);
      assert.ok(index >= 0, `missing ${text} in ${prompt.options}`);
      p.prompt = null; prompt.pairs[index * 2 + 1]();
    },
    continueUntil(p, predicate, limit = 120) {
      while (!predicate()) {
        assert.ok(limit-- > 0, `dialogue stalled at ${p.text}`);
        assert.ok(p.manager.getCurrent(), `dialogue ended at ${p.text}`);
        p.manager.advance();
      }
    },
    variant(p, npcId) {
      const choice = (hooks.onNpcDialogueVariant ?? []).map(fn => fn({ player: p, npcId })).find(Boolean);
      assert.ok(choice);
      runtime.startTranscript(api, p, npcId, name === 'GiantDwarf' ? 'The Giant Dwarf' : name, choice);
      return choice;
    },
    object(p, objectId, option = 'Inspect', x = 0, y = 0) {
      const event = { player: p, objectId, option, definition: { getId: () => objectId, getInteractions: () => [option] }, location: { x, y, z: 0 }, handled: false };
      for (const fn of hooks.onObjectInteraction ?? []) { fn(event); if (event.handled) break; }
      return event;
    },
  };
  return h;
}

function player() {
  const attrs = new Map(), items = new Map(), configs = new Map(), varbits = new Map(), log = [], xp = [], levels = new Map();
  let location = new core.Location(3210, 3220, 0);
  const inv = {
    getAmount: id => items.get(id) ?? 0,
    getFreeSlots: () => (p.full ? 0 : 28),
    isFull: () => Boolean(p.full),
    getItems: () => [...items].filter(([, amount]) => amount > 0).map(([id, amount]) => ({ getId: () => id, getAmount: () => amount, getDefinition: () => core.ItemDefinition.forId(id) })),
    adds(id, amount) { items.set(id, (items.get(id) ?? 0) + amount); },
    deleteNumber(id, amount) { assert.ok((items.get(id) ?? 0) >= amount, `missing item ${id}`); items.set(id, items.get(id) - amount); },
  };
  const packet = new Proxy({
    sendConfig(id, value) { configs.set(id, value); return packet; },
    sendVarbit(id, value) { varbits.set(id, value); return packet; },
    sendString(text, uid) { if ([6, 3, 2].some(child => [217, 231, 229, 193].some(group => uid === (group << 16 | child)))) p.text = text; log.push(['text', uid, text]); return packet; },
    sendInterfaceRemoval() { p.manager.reset(); p.prompt = null; return packet; },
  }, { get: (t, key) => t[key] ?? ((...args) => { log.push([key, ...args]); return packet; }) });
  const p = {
    attrs, items, configs, varbits, log, xp, levels, messages: [], prompt: null, text: '', index: nextIndex++,
    getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => inv,
    getEquipment: () => ({ getItems: () => [], get: () => null }),
    getPacketSender: () => packet, getDialogueManager: () => p.manager,
    getSkillManager: () => ({
      addExperiences: (skill, amount) => xp.push([skill.getIndex(), amount]),
      getCurrentLevel: skill => levels.get(skill.getIndex()) ?? 99,
      getMaxLevel: skill => levels.get(skill.getIndex()) ?? 99,
    }),
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement: noop }),
    getLocation: () => location, moveTo: to => { location = to; },
    getArea: () => null, getPrivateArea: () => null, setArea: noop, getIndex: () => p.index, getSpellbook: () => p.spellbook ?? core.MagicSpellbook.NORMAL,
    isPlayer: () => true, isNpc: () => false, getAsPlayer: () => p, isRegistered: () => true,
    getUsername: () => 'Parity', getAppearance: () => ({ isMale: () => true }),
    setPositionToFace: noop, forceChat: noop, sendMessage: text => p.messages.push(text),
  };
  p.manager = new DialogueManager(p);
  return p;
}

// ---------------------------------------------------------------- Giant Dwarf

function giantDwarfRequirements(p, overrides = {}) {
  const levels = { CRAFTING: 12, FIREMAKING: 16, MAGIC: 33, THIEVING: 14, ...overrides };
  for (const [skill, level] of Object.entries(levels)) p.levels.set(core.Skill[skill].getIndex(), level);
  p.spellbook = core.MagicSpellbook.NORMAL;
}

test('Giant Dwarf start moves the boat ride to Blasidar and refuses to rewind', () => {
  const h = harness('GiantDwarf'), p = player();
  giantDwarfRequirements(p);
  assert.equal(h.variant(p, N.DWARVEN_BOATMAN_3), 'starting-off-talking-to-dwarven-boatman');
  h.emit('npc-dialogue:choice', { player: p, npcId: N.DWARVEN_BOATMAN_3, option: 'Yes.' });
  assert.equal(h.quest.getStage(p), 5);
  h.emit('npc-dialogue:choice', { player: p, npcId: N.DWARVEN_BOATMAN_3, option: 'Yes, I will do this.' });
  assert.equal(h.quest.getStage(p), 10);
  p.log.length = 0;
  h.action(p, N.DWARVEN_BOATMAN_3, 'TWPrRb');
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2827, 10214], 'the boat arrives at the Black Guard');
  assert.ok(p.log.some(row => row[0] === 'sendSubInterface' && row[2] === 174), 'arrival closes the boat fade');
  assert.equal(h.variant(p, N.BLASIDAR_THE_SCULPTOR), 'starting-off-talking-to-blasidar-the-sculptor');
  h.emit('npc-dialogue:choice', { player: p, npcId: N.BLASIDAR_THE_SCULPTOR, option: 'Yes, I will do this.' });
  assert.equal(h.quest.getStage(p), 20);
  h.emit('npc-dialogue:choice', { player: p, npcId: N.DWARVEN_BOATMAN_3, option: 'Yes.' });
  assert.equal(h.quest.getStage(p), 20, 'the start choice must not rewind progress');
});

test('Giant Dwarf clothes chain requires the book, fuel and 200 coins without eating them early', () => {
  const h = harness('GiantDwarf'), p = player();
  h.quest.setStage(p, 20);
  h.emit('npc-dialogue:choice', { player: p, npcId: N.VERMUNDI, option: "Yes, I'm looking for some special clothes." });
  h.emit('npc-dialogue:choice', { player: p, npcId: N.LIBRARIAN, option: "Do you know anything about King Alvis' clothes?" });
  const shelf = h.object(p, O.BOOKCASE_19, 'Climb');
  assert.equal(shelf.handled, true);
  h.action(p, N.LIBRARIAN, '3nitJs');
  assert.equal(p.items.get(I.BOOK_ON_COSTUMES), 1);
  h.action(p, N.VERMUNDI, 'pJyVnt');
  assert.equal(p.items.get(I.BOOK_ON_COSTUMES), 0);
  assert.equal(p.varbits.get(584), 1);
  const machine = id => (h.hooks.onItemOnObject ?? []).forEach(fn => fn({ player: p, itemId: id, objectId: O.SPINNING_MACHINE }));
  p.items.set(I.COAL, 1);
  p.items.set(I.TINDERBOX, 1);
  machine(I.COAL);
  assert.equal(p.attrs.get('quest.giant_dwarf.machine'), undefined, 'coal without logs must not fuel the machine');
  p.items.set(I.LOGS, 1);
  machine(I.COAL);
  assert.equal(p.attrs.get('quest.giant_dwarf.machine'), 1);
  p.levels.set(core.Skill.FIREMAKING.getIndex(), 15);
  machine(I.TINDERBOX);
  assert.notEqual(p.attrs.get('quest.giant_dwarf.machine'), 2, 'Firemaking 15 must not light the machine');
  p.levels.set(core.Skill.FIREMAKING.getIndex(), 16);
  machine(I.TINDERBOX);
  assert.equal(p.attrs.get('quest.giant_dwarf.machine'), 2);
  h.action(p, N.VERMUNDI, 'xcf363');
  assert.equal(p.items.get(I.EXQUISITE_CLOTHES), undefined, 'no clothes without payment');
  p.items.set(I.COINS, 200);
  h.action(p, N.VERMUNDI, 'xcf363');
  assert.equal(p.items.get(I.COINS), 0);
  assert.equal(p.items.get(I.EXQUISITE_CLOTHES), 1);
});

test('Giant Dwarf boots need Thieving, support Telekinetic Grab and combine once', () => {
  const h = harness('GiantDwarf'), p = player();
  h.quest.setStage(p, 20);
  h.emit('npc-dialogue:choice', { player: p, npcId: N.SARO, option: "Yes, I'm looking for a pair of special boots." });
  const pickup = id => { const event = { player: p, groundItemId: id, handled: false }; (h.hooks.onGroundItemPickup ?? []).forEach(fn => fn(event)); return event; };
  p.levels.set(core.Skill.THIEVING.getIndex(), 13);
  const blocked = pickup(I.LEFT_BOOT);
  assert.equal(blocked.handled, true);
  assert.ok(p.messages.some(message => message.includes('Thieving level of 14')));
  p.levels.set(core.Skill.THIEVING.getIndex(), 14);
  const originalRandom = Math.random;
  Math.random = () => 0.9;
  try {
    assert.equal(pickup(I.LEFT_BOOT).handled, false);
    p.items.set(I.LEFT_BOOT, 1);
    p.items.set(I.RIGHT_BOOT, 1);
    const grab = { player: p, itemId: I.RIGHT_BOOT };
    h.emit('magic:telekinetic-grab', grab);
    assert.equal(p.items.get(I.RIGHT_BOOT), 1, 'a successful grab keeps the boot');
  } finally { Math.random = originalRandom; }
  h.action(p, N.DROMUND, 'TtgU-I');
  assert.equal(p.items.get(I.LEFT_BOOT), 0);
  assert.equal(p.items.get(I.RIGHT_BOOT), 0);
  assert.equal(p.items.get(I.EXQUISITE_BOOTS), 1);
  assert.equal(p.varbits.get(2782), 1);
});

test('Giant Dwarf start rejects missing skills and a non-standard spellbook', () => {
  const h = harness('GiantDwarf'), p = player();
  giantDwarfRequirements(p, { CRAFTING: 11 });
  h.variant(p, N.DWARVEN_BOATMAN_3);
  h.emit('npc-dialogue:choice', { player: p, npcId: N.DWARVEN_BOATMAN_3, option: 'Yes.' });
  assert.equal(h.quest.getStage(p), 0);
  assert.ok(p.messages.some(message => message.includes('12 Crafting')));
  giantDwarfRequirements(p);
  p.spellbook = core.MagicSpellbook.ANCIENT;
  h.emit('npc-dialogue:choice', { player: p, npcId: N.DWARVEN_BOATMAN_3, option: 'Yes.' });
  assert.equal(h.quest.getStage(p), 0);
  assert.ok(p.messages.some(message => message.includes('standard spellbook')));
  p.spellbook = core.MagicSpellbook.NORMAL;
  h.emit('npc-dialogue:choice', { player: p, npcId: N.DWARVEN_BOATMAN_3, option: 'Yes.' });
  assert.equal(h.quest.getStage(p), 5);
});

test('Giant Dwarf telegrab hands back early, duplicate and spotted grabs so the boot stays reclaimable', () => {
  const h = harness('GiantDwarf'), p = player();
  const grab = () => { p.items.set(I.RIGHT_BOOT, (p.items.get(I.RIGHT_BOOT) ?? 0) + 1); h.emit('magic:telekinetic-grab', { player: p, itemId: I.RIGHT_BOOT }); };
  grab();
  assert.equal(p.items.get(I.RIGHT_BOOT), 0, 'the pre-quest grab is removed');
  assert.equal(h.ground.length, 1, 'the pre-quest boot is put back on the ground');
  h.quest.setStage(p, 20);
  h.emit('npc-dialogue:choice', { player: p, npcId: N.SARO, option: "Yes, I'm looking for a pair of special boots." });
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    grab();
    assert.equal(p.items.get(I.RIGHT_BOOT), 0, 'Dromund takes a spotted boot back');
    assert.equal(h.ground.length, 2, 'a spotted grab restores the ground item');
    Math.random = () => 0.9;
    grab();
    assert.equal(p.items.get(I.RIGHT_BOOT), 1, 'an unseen grab keeps one boot');
    assert.equal(h.ground.length, 2, 'a successful grab does not duplicate the ground item');
    grab();
    assert.equal(p.items.get(I.RIGHT_BOOT), 1, 'a second grab cannot duplicate the boot');
    assert.equal(h.ground.length, 3, 'the duplicate is restored to the ground');
  } finally { Math.random = originalRandom; }
});

test('Giant Dwarf axe needs sapphires, iron and the full model hand-in', () => {
  const h = harness('GiantDwarf'), p = player();
  h.quest.setStage(p, 20);
  h.line(p, N.SANTIRI, "I will entrust you with King Alvis' battleaxe.");
  assert.equal(p.items.get(I.DWARVEN_BATTLEAXE), 1);
  const useSapphires = () => (h.hooks.onItemOnItem ?? []).forEach(fn => fn({ player: p, usedItemId: I.SAPPHIRE, usedWithItemId: I.DWARVEN_BATTLEAXE }));
  p.levels.set(core.Skill.CRAFTING.getIndex(), 11);
  useSapphires();
  assert.equal(p.items.get(I.DWARVEN_BATTLEAXE), 1);
  p.levels.set(core.Skill.CRAFTING.getIndex(), 12);
  p.items.set(I.SAPPHIRE, 2);
  useSapphires();
  assert.equal(p.items.get(I.DWARVEN_BATTLEAXE), 1);
  p.items.set(I.SAPPHIRE, 3);
  useSapphires();
  assert.equal(p.items.get(I.DWARVEN_BATTLEAXE_3), 1);
  assert.equal(p.items.get(I.SAPPHIRE), 0);
  p.items.set(I.IRON_BAR, 1);
  h.action(p, N.THURGO, 'zNGGt4');
  assert.equal(p.items.get(I.DWARVEN_BATTLEAXE_4), 1);
  assert.equal(p.items.get(I.IRON_BAR), 0);
  for (const [step, item] of [['n9xSMg', I.EXQUISITE_CLOTHES], ['LnIhkv', I.EXQUISITE_BOOTS], ['JeBfp-', I.DWARVEN_BATTLEAXE_4]]) {
    p.items.set(item, 1);
    h.action(p, N.RIKI_THE_SCULPTORS_MODEL, step);
    assert.equal(p.items.get(item), 0);
  }
  assert.equal(p.attrs.get('quest.giant_dwarf.model'), 7);
  assert.equal(p.varbits.get(576), 7);
});

test('Giant Dwarf consortium tasks, joining and the meeting reward exactly once', () => {
  const h = harness('GiantDwarf'), p = player();
  h.quest.setStage(p, 30);
  const secretary = N.PURPLE_PEWTER_SECRETARY;
  const talk = (npcId, actions = ['Talk-to']) => (h.hooks.onNpcInteraction ?? []).forEach(fn => fn({ player: p, npcId, clickType: 1, definition: { getActions: () => actions } }));
  talk(secretary);
  assert.equal(p.attrs.get('quest.giant_dwarf.company'), undefined, 'company is chosen when a task is taken');
  h.line(p, secretary, 'We need 3 copper ore in the next [number] minutes.');
  h.emit('npc-dialogue:choice', { player: p, npcId: secretary, option: "I'll take it." });
  assert.equal(p.attrs.get('quest.giant_dwarf.company'), 1);
  assert.equal(p.attrs.get('quest.giant_dwarf.task-active'), true);
  const ore = Number(p.attrs.get('quest.giant_dwarf.task-item'));
  const amount = Number(p.attrs.get('quest.giant_dwarf.task-amount'));
  p.items.set(ore, amount);
  h.line(p, secretary, "I've completed your task! Here is your ore!");
  assert.equal(p.attrs.get('quest.giant_dwarf.points'), 20);
  assert.equal(p.items.get(ore), 0);
  p.attrs.set('quest.giant_dwarf.points', 100);
  h.emit('npc-dialogue:choice', { player: p, npcId: N.PURPLE_PEWTER_DIRECTOR_3, option: "I'd like to officially join your company." });
  assert.equal(p.attrs.get('quest.giant_dwarf.joined'), true);
  h.action(p, N.COMMANDER_VELDABAN, 'hp1hc7');
  assert.equal(h.quest.getStage(p), 40);
  assert.equal(h.variant(p, N.COMMANDER_VELDABAN), 'art-by-committee-talking-to-commander-veldaban');
  h.action(p, N.COMMANDER_VELDABAN, 'lEFN0h');
  assert.equal(h.quest.getStage(p), 50);
  assert.deepEqual(p.xp.map(([id]) => id).sort(), [core.Skill.CRAFTING.getIndex(), core.Skill.FIREMAKING.getIndex(), core.Skill.MAGIC.getIndex(), core.Skill.MINING.getIndex(), core.Skill.SMITHING.getIndex(), core.Skill.THIEVING.getIndex()].sort());
  h.action(p, N.COMMANDER_VELDABAN, 'lEFN0h');
  assert.equal(p.xp.length, 6, 'completion reward must not repeat');
});

test('Giant Dwarf current Reldo, grams weight gate and director dispatch use registered hooks', () => {
  const h = harness('GiantDwarf'), p = player();
  h.quest.setStage(p, 20);
  p.attrs.set('quest.giant_dwarf.axe-librarian', true);
  const reldo = h.hooks.onNpcDialogueVariant.map(fn => fn({ player: p, npcId: 22428 })).find(Boolean);
  assert.equal(reldo, 'an-axe-fit-for-a-king-talking-to-reldo-with-the-knight-s-sword-incomplete', 'current Varrock Reldo id is dispatched');

  p.attrs.set('quest.giant_dwarf.librarian', true);
  for (const [id, amount] of [[1511,1],[453,1],[2351,1],[1607,3],[2325,1],[590,1]]) p.items.set(id, amount);
  const drain = () => { for (let i = 0; i < 30 && p.manager.getCurrent(); i++) p.manager.advance(); };
  h.object(p, 6092, 'Climb', 2859, 10228); drain();
  assert.equal(p.items.get(I.BOOK_ON_COSTUMES), 1, 'ordinary under-30kg supplies allow the book');

  const heavy = player();
  h.quest.setStage(heavy, 20);
  heavy.attrs.set('quest.giant_dwarf.librarian', true);
  heavy.items.set(2359, 25); // mithril bars, over 30kg in cache grams
  h.object(heavy, 6092, 'Climb', 2859, 10228);
  for (let i = 0; i < 30 && heavy.manager.getCurrent(); i++) heavy.manager.advance();
  assert.equal(heavy.items.get(I.BOOK_ON_COSTUMES), undefined);
  assert.match(heavy.text, /flimsy/);

});

test('Giant Dwarf director named dispatch handles company3 tasks and join, and defers inactive/other companies', () => {
  const h = harness('GiantDwarf');
  const directorEvent = (p) => ({
    player: p, npc: { getContentId: () => N.BLUE_OPAL_DIRECTOR_2 },
    npcId: N.BLUE_OPAL_DIRECTOR_2, clickType: 1, handled: false,
    definition: { getName: () => 'Blue Opal Director', getActions: () => ['Talk-to'] },
  });
  const talk = h.npcActions.get('Blue Opal Director')['Talk-to'];

  const inactive = player(); h.quest.setStage(inactive, 20); inactive.attrs.set('quest.giant_dwarf.company', 3);
  const inactiveEvent = directorEvent(inactive);
  talk(inactiveEvent);
  assert.equal(inactiveEvent.handled, false, 'inactive stage defers to normal dialogue');

  const other = player(); h.quest.setStage(other, 30); other.attrs.set('quest.giant_dwarf.company', 2); other.attrs.set('quest.giant_dwarf.points', 80);
  const otherEvent = directorEvent(other);
  talk(otherEvent);
  assert.equal(otherEvent.handled, false, 'a different company director defers');

  const task = player(); h.quest.setStage(task, 30);
  task.attrs.set('quest.giant_dwarf.company', 3);
  task.attrs.set('quest.giant_dwarf.points', 80);
  const taskEvent = directorEvent(task);
  talk(taskEvent);
  assert.equal(taskEvent.handled, true);
  h.continueUntil(task, () => Boolean(task.prompt));
  h.choose(task, 'Do you have any more tasks for me?');
  h.continueUntil(task, () => Boolean(task.prompt));
  h.choose(task, "I'll take it.");
  assert.equal(task.attrs.get('quest.giant_dwarf.task-active'), true, 'director task accepted');
  const itemId = Number(task.attrs.get('quest.giant_dwarf.task-item'));
  const amount = Number(task.attrs.get('quest.giant_dwarf.task-amount'));
  task.items.set(itemId, amount);
  h.line(task, N.BLUE_OPAL_DIRECTOR_2, "I've completed your task! Here are your bars!");
  assert.equal(task.attrs.get('quest.giant_dwarf.points'), 92);

  const join = player(); h.quest.setStage(join, 30);
  join.attrs.set('quest.giant_dwarf.company', 3);
  join.attrs.set('quest.giant_dwarf.points', 100);
  const joinEvent = directorEvent(join);
  talk(joinEvent);
  h.continueUntil(join, () => Boolean(join.prompt));
  h.choose(join, "I'd like to officially join your company.");
  h.continueUntil(join, () => Boolean(join.prompt));
  assert.equal(join.attrs.get('quest.giant_dwarf.joined'), true, 'director join is recorded');
  h.choose(join, 'Blasidar the sculptor has sent me.');
  h.continueUntil(join, () => Boolean(join.prompt));
  h.choose(join, 'I would support you.');
  h.continueUntil(join, () => Boolean(join.prompt));
  h.choose(join, 'Yes! Long live the [company name]!');
  h.continueUntil(join, () => h.quest.getStage(join) === 40);
  assert.equal(h.quest.getStage(join), 40, 'director support advances to the meeting stage');
});

test('Giant Dwarf declined Veldaban task can be accepted on the next talk', () => {
  const h = harness('GiantDwarf'), p = player();
  h.quest.setStage(p, 5);
  const veldaban = h.npcActions.get('Commander Veldaban')['Talk-to'];
  const event = { player: p, npcId: N.COMMANDER_VELDABAN, clickType: 1, definition: { getActions: () => ['Talk-to'] }, handled: false };
  assert.equal(veldaban(event), true);
  assert.equal(event.handled, true);
  h.continueUntil(p, () => Boolean(p.prompt));
  h.choose(p, 'Yes, I will do this.');
  assert.equal(h.quest.getStage(p), 10);
});

// --------------------------------------------------------- Defender of Varrock

const DOV_PLANT_START = 50662;
const DOV_BOULDER = 50664;
const DOV_PLANT_KEY = 50669;
const DOV_BUSH_SOUTH = 50670;
const DOV_BUSH_GATE = 50667;
const DOV_BUSH_EAST = 50668;
const DOV_TRAPDOOR = 50689;
const DOV_GATE_1 = O.GATE_290, DOV_GATE_2 = O.GATE_291;
const DOV_BALCONY_1 = O.BALCONY, DOV_BALCONY_2 = O.BALCONY_5;
const ARRAV_LINE = "I'm sorry, he calls to me";
const BALCONY_LINE = "Very well. I'll meet you in the palace";

function defenderRequirements(h, p, { missingQuest, smithing = 55, hunter = 52 } = {}) {
  p.levels.set(core.Skill.SMITHING.getIndex(), smithing);
  p.levels.set(core.Skill.HUNTER.getIndex(), hunter);
  for (const key of ['temple_of_ikov', 'below_ice_mountain', 'family_crest', 'garden_of_tranquillity', 'what_lies_below', 'romeo_and_juliet', 'demon_slayer']) h.completedQuests.add(key);
  h.completedQuests.add('shield_of_arrav');
  p.attrs.set('shield-of-arrav.gang', 2);
  if (missingQuest) h.completedQuests.delete(missingQuest);
}

test('Defender of Varrock starts through Elias and keeps the talking trail order', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  defenderRequirements(h, p);
  const elias = h.npcActions.get('Elias White')['Talk-to'];
  assert.equal(elias({ player: p, npcId: N.ELIAS_WHITE, npc: { getLocation: () => new core.Location(3283, 3501, 0) } }), true);
  h.continueUntil(p, () => Boolean(p.prompt));
  h.choose(p, 'Yes.');
  assert.equal(h.quest.getStage(p), 2);
  h.action(p, N.ELIAS_WHITE, 'SH3bFy');
  assert.equal(h.quest.getStage(p), 4);
  const inspect = (id, x, y) => h.object(p, id, 'Inspect', x, y);
  assert.equal(inspect(50094, 3280, 3516).handled, true, 'initial plant child id');
  assert.equal(h.quest.getStage(p), 6);
  inspect(50090, 3325, 3470);
  assert.equal(h.quest.getStage(p), 6, 'a later clue must not skip the trail');
  inspect(50084, 3260, 3514);
  inspect(50094, 3269, 3480); // same child id, key-plant tile
  inspect(50096, 3293, 3463);
  assert.equal(h.quest.getStage(p), 8, 'fourth clue');
  inspect(50090, 3325, 3470);
  inspect(50092, 3349, 3495);
  assert.equal(h.quest.getStage(p), 10, 'all six clues are needed before the trapdoor');
  for (const bit of [9659, 9660, 9661, 9662, 9663, 9664]) assert.equal(p.varbits.get(bit), 1);
});

test('Defender of Varrock trapdoor is gated by all six child-loc clues and enters the base once', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 6);
  assert.equal(h.object(p, DOV_TRAPDOOR, 'Open', 3343, 3515).handled, true);
  assert.ok(p.messages.some(message => message.includes('reason to go down there')));
  for (const [id, x, y] of [[50094,3280,3516],[50084,3260,3514],[50094,3269,3480],[50096,3293,3463],[50090,3325,3470]]) {
    h.object(p, id, 'Inspect', x, y);
  }
  assert.equal(h.quest.getStage(p), 8);
  p.messages.length = 0;
  h.object(p, DOV_TRAPDOOR, 'Open', 3343, 3515);
  assert.ok(p.messages.some(message => message.includes('reason to go down there')), 'five clues are not enough');
  h.object(p, 50092, 'Inspect', 3349, 3495);
  assert.equal(h.quest.getStage(p), 10);
  p.attrs.set('quest.defender_of_varrock.key', 'player');
  p.items.set(I.GRUBBY_KEY_4, 1);
  h.object(p, DOV_TRAPDOOR, 'Open', 3343, 3515);
  h.continueUntil(p, () => Boolean(p.prompt));
  assert.equal(p.items.get(I.GRUBBY_KEY_4), 0, 'the trapdoor consumes the grubby key once');
  h.choose(p, "Let's do it.");
  assert.equal(h.quest.getStage(p), 14);
  assert.equal(p.attrs.get('quest.defender_of_varrock.bits') & (1 << 7), 1 << 7, 'unlock flag persisted');
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3560, 4551]);
  h.tick(1);
  assert.equal(h.quest.getStage(p), 14, 'base entry is not repeated on a second zone event');
  h.object(p, DOV_TRAPDOOR, 'Enter', 3343, 3515);
  assert.equal(h.quest.getStage(p), 14, 're-entering the open trapdoor keeps stage 14');
  h.hooks.onPlayerLogin[0]({ player: p });
  assert.equal(h.quest.getStage(p), 14, 'relog preserves the base checkpoint');
});

test('Defender of Varrock trapdoor refuses a keyless full trail, recovers the key, and honors Elias', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 10);
  for (let i = 0; i < 6; i++) p.attrs.set(`quest.defender_of_varrock.trail.${[9659,9660,9661,9662,9663,9664][i]}`, 1);
  p.moveTo(new core.Location(3342, 3515, 0));
  h.object(p, DOV_TRAPDOOR, 'Open', 3343, 3515);
  assert.ok(!p.manager.getCurrent(), 'no key means no Let us do it dialogue');
  assert.equal(h.quest.getStage(p), 12);
  assert.ok(p.messages.some(message => message.includes('grubby key')));
  p.moveTo(new core.Location(3560, 4551, 0));
  h.hooks.onZoneEnter[0]({ player: p });
  assert.equal(h.quest.getStage(p), 12, 'a keyless zone teleport cannot unlock the base either');
  p.moveTo(new core.Location(3342, 3515, 0));

  // Genuine recovery: re-search the key plant; its transcript action hands the key back.
  h.object(p, 50094, 'Inspect', 3269, 3480);
  for (let i = 0; i < 30 && p.manager.getCurrent(); i++) p.manager.advance();
  assert.equal(p.items.get(I.GRUBBY_KEY_4), 1);
  assert.equal(p.attrs.get('quest.defender_of_varrock.key'), 'player');
  h.object(p, DOV_TRAPDOOR, 'Open', 3343, 3515);
  h.continueUntil(p, () => Boolean(p.prompt));
  assert.equal(p.items.get(I.GRUBBY_KEY_4), 0, 'unlocking consumes the recovered key');
  h.choose(p, "Let's do it.");
  assert.equal(h.quest.getStage(p), 14);

  const elias = player();
  h.quest.setStage(elias, 12);
  for (let i = 0; i < 6; i++) elias.attrs.set(`quest.defender_of_varrock.trail.${[9659,9660,9661,9662,9663,9664][i]}`, 1);
  elias.attrs.set('quest.defender_of_varrock.key', 'elias');
  elias.moveTo(new core.Location(3342, 3515, 0));
  h.object(elias, DOV_TRAPDOOR, 'Open', 3343, 3515);
  h.continueUntil(elias, () => Boolean(elias.prompt));
  h.choose(elias, "Let's do it.");
  assert.equal(h.quest.getStage(elias), 14, 'Elias holding the key is enough');
  assert.equal(elias.items.get(I.GRUBBY_KEY_4), undefined);
});

test('Defender of Varrock forged stale trapdoor choice cannot descend without the key', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 12);
  for (let i = 0; i < 6; i++) p.attrs.set(`quest.defender_of_varrock.trail.${[9659,9660,9661,9662,9663,9664][i]}`, 1);
  p.attrs.set('quest.defender_of_varrock.key', 'player');
  p.items.set(I.GRUBBY_KEY_4, 1);
  p.moveTo(new core.Location(3342, 3515, 0));
  h.object(p, DOV_TRAPDOOR, 'Open', 3343, 3515);
  // Simulate a forged/stale menu selection before the unlock action: drop the key.
  p.items.set(I.GRUBBY_KEY_4, 0);
  p.attrs.set('quest.defender_of_varrock.key', '');
  h.emit('npc-dialogue:choice', { player: p, npcId: N.ELIAS_WHITE, option: "Let's do it." });
  assert.equal(h.quest.getStage(p), 12);
  assert.notDeepEqual([p.getLocation().getX(), p.getLocation().getY()], [3560, 4551]);
});

test('Defender of Varrock persisted unlock flag allows keyless re-entry after relog', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 12);
  for (let i = 0; i < 6; i++) p.attrs.set(`quest.defender_of_varrock.trail.${[9659,9660,9661,9662,9663,9664][i]}`, 1);
  p.attrs.set('quest.defender_of_varrock.bits', 1 << 7);
  h.hooks.onPlayerLogin[0]({ player: p });
  p.moveTo(new core.Location(3342, 3515, 0));
  h.object(p, DOV_TRAPDOOR, 'Enter', 3343, 3515);
  assert.equal(h.quest.getStage(p), 14, 'the persisted unlock flag needs no key');
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3560, 4551]);
});

test('Defender of Varrock base-zone entry unlocks only a fully inspected trail', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 10);
  p.moveTo(new core.Location(3560, 4551, 0));
  h.hooks.onZoneEnter[0]({ player: p });
  assert.equal(h.quest.getStage(p), 10, 'an incomplete trail cannot unlock the base');
  assert.equal(p.attrs.get('quest.defender_of_varrock.bits') & 1, 0);

  const q = player();
  h.quest.setStage(q, 6);
  for (const [id, x, y] of [[50094,3280,3516],[50084,3260,3514],[50094,3269,3480],[50096,3293,3463],[50090,3325,3470],[50092,3349,3495]]) {
    h.object(q, id, 'Inspect', x, y);
  }
  assert.equal(h.quest.getStage(q), 10);
  q.moveTo(new core.Location(3560, 4551, 0));
  h.hooks.onZoneEnter[0]({ player: q });
  assert.equal(h.quest.getStage(q), 14, 'the full trail unlocks base entry even when Curse teleports first');
  assert.deepEqual([q.getLocation().getX(), q.getLocation().getY()], [3560, 4551]);
});

test('Defender of Varrock keeps an owner-only Elias at the base landing', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 14);
  h.hooks.onPlayerLogin[0]({ player: p });
  const elias = h.npcs.find(npc => npc.id === N.ELIAS_WHITE);
  assert.ok(elias, 'Elias must exist in the dungeon');
  assert.deepEqual([elias.getLocation().getX(), elias.getLocation().getY()], [3560, 4551]);
  assert.equal(elias.owner, p);
});

test('Defender of Varrock balcony, mist bottles and the two gated crossings', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 14);
  p.moveTo(new core.Location(3564, 4569, 0));
  h.object(p, DOV_BALCONY_1, 'Look-over');
  assert.ok(h.quest.getStage(p) >= 16);
  h.line(p, N.ELIAS_WHITE, BALCONY_LINE);
  assert.ok(h.quest.getStage(p) >= 18);
  assert.equal(h.ground.length, 1, 'three bottles are placed on the ground');
  assert.deepEqual(p.log.filter(row => row[0] === 'sendCameraMoveTo').at(-1).slice(1, 3), [3563, 4570], 'first balcony camera');
  assert.deepEqual(p.log.filter(row => row[0] === 'sendCameraLookAt').at(-1).slice(1, 3), [3569, 4572], 'first balcony look-at');
  h.hooks.onNpcDeath[0]({ npcId: N.ARMOURED_ZOMBIE, killer: p, npc: { getLocation: () => new core.Location(3540, 4571, 0) } });
  const mist = h.objects.find(object => object.getId() === 50690);
  assert.ok(mist, 'the dying zombie leaves a red-mist object');
  p.items.set(I.BOTTLE, 1);
  h.hooks.onItemOnObject[0]({ player: p, object: mist, objectId: 50146, itemId: I.BOTTLE, location: { x: 3540, y: 4571, z: 0 } });
  assert.equal(p.items.get(I.BOTTLE), 0);
  assert.equal(p.items.get(I.BOTTLE_OF_MIST), 1);
  assert.ok(!h.objects.includes(mist), 'a filled mist source is removed');
  p.moveTo(new core.Location(3537, 4571, 0));
  const gate = id => h.object(p, id, 'Open', 3536, 4571);
  gate(DOV_GATE_1);
  assert.equal(h.quest.getStage(p), 18, 'one mist is not enough');
  p.items.set(I.BOTTLE_OF_MIST, 3);
  gate(DOV_GATE_1);
  assert.equal(p.items.get(I.BOTTLE_OF_MIST), 0);
  h.tick(1);
  assert.equal(h.quest.getStage(p), 24, 'the Arrav transcript itself places the second bottles');
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3539, 4571], 'gate 1 lands on the captured east tile');
  assert.equal(p.attrs.get('quest.defender_of_varrock.bits') & (1 << 6), 1 << 6);
  assert.equal(h.ground.length, 2, 'both bottle hand-outs happened');
  assert.equal(h.ground.at(-1)[1].getId(), I.BOTTLE);
  assert.equal(h.ground.at(-1)[1].getAmount(), 3);
  p.items.set(I.BOTTLE_OF_MIST, 3);
  gate(DOV_GATE_2);
  h.tick(1);
  assert.equal(h.quest.getStage(p), 26);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3544, 4598], 'gate 2 lands on the captured east tile');
  h.object(p, DOV_BALCONY_2, 'Look-over');
  assert.equal(h.quest.getStage(p), 26);
});

test('Defender of Varrock palace, forge and shield hand-over stay in order', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 26);
  h.emit('ladders:climb', { player: p, objectId: O.LADDER_445, handled: false, location: {} });
  assert.equal(h.quest.getStage(p), 28);
  const elias = h.npcActions.get('Elias White')['Talk-to'];
  elias({ player: p, npcId: N.ELIAS_WHITE, npc: { getLocation: () => new core.Location(3208, 3475, 0) } });
  h.action(p, N.ELIAS_WHITE, 'BebI-p');
  assert.equal(h.quest.getStage(p), 30);
  const ramarno = h.npcActions.get('Ramarno')['Talk-to'];
  ramarno({ player: p, npcId: N.RAMARNO_2 });
  assert.equal(h.quest.getStage(p), 30, 'Ramarno must be asked before he helps');
  h.emit('npc-dialogue:choice', { player: p, npcId: N.RAMARNO_2, option: 'I need your help with a shield.' });
  assert.equal(h.quest.getStage(p), 32);
  p.items.set(I.BARRONITE_DEPOSIT, 1);
  p.items.set(I.CHAOS_CORE, 1);
  h.hooks.onItemOnItem[0]({ player: p, usedItemId: I.CHAOS_CORE, usedWithItemId: I.BARRONITE_DEPOSIT });
  assert.equal(p.items.get(I.IMBUED_BARRONITE), 1);
  h.hooks.onItemOnObject[0]({ player: p, itemId: I.IMBUED_BARRONITE, objectId: 41411, definition: { getId: () => O.SACRED_FORGE } });
  assert.equal(p.items.get(I.IMBUED_BARRONITE), 0);
  assert.deepEqual(p.log.filter(row => row[0] === 'sendCameraMoveTo').at(-1).slice(1, 3), [2081, 5344], 'forge dream camera');
  h.action(p, N.ARRAV, 'f7q7yU');
  assert.equal(h.quest.getStage(p), 36);
  const rovin = h.npcActions.get('Captain Rovin')['Talk-to'];
  rovin({ player: p, npcId: N.CAPTAIN_ROVIN });
  h.action(p, N.CAPTAIN_ROVIN, 'dC8HMf');
  assert.equal(h.quest.getStage(p), 40);
  assert.equal(p.items.get(I.SHIELD_OF_ARRAV), 1);
});

test('Defender of Varrock enforces its quest, gang and skill requirements', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  defenderRequirements(h, p, { missingQuest: 'temple_of_ikov' });
  const elias = h.npcActions.get('Elias White')['Talk-to'];
  elias({ player: p, npcId: N.ELIAS_WHITE, npc: { getLocation: () => new core.Location(3283, 3501, 0) } });
  while (p.manager.getCurrent()) p.manager.advance();
  assert.equal(h.quest.getStage(p), 0);
  assert.ok(p.text.includes('not in need'));
  defenderRequirements(h, p);
  p.attrs.set('shield-of-arrav.gang', 1);
  elias({ player: p, npcId: N.ELIAS_WHITE, npc: { getLocation: () => new core.Location(3283, 3501, 0) } });
  while (p.manager.getCurrent()) p.manager.advance();
  assert.equal(h.quest.getStage(p), 0, 'Phoenix Gang saves do not satisfy the Black Arm requirement');
  defenderRequirements(h, p);
  elias({ player: p, npcId: N.ELIAS_WHITE, npc: { getLocation: () => new core.Location(3283, 3501, 0) } });
  h.continueUntil(p, () => Boolean(p.prompt));
  h.choose(p, 'Yes.');
  assert.equal(h.quest.getStage(p), 2);
});

test('Defender of Varrock migrates old stage values once and never repeats rewards', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 42);
  h.hooks.onPlayerLogin[0]({ player: p });
  assert.equal(h.quest.getStage(p), 44, 'old list-found saves move to the new list stage');
  assert.equal(Number(p.attrs.get('quest.defender_of_varrock.schema')), 3);
  h.quest.setStage(p, 42);
  h.hooks.onPlayerLogin[0]({ player: p });
  assert.equal(h.quest.getStage(p), 42, 'an already-migrated Reldo stage is not moved again');
  const old = player();
  h.quest.setStage(old, 34);
  h.hooks.onPlayerLogin[0]({ player: old });
  assert.equal(h.quest.getStage(old), 36);
  const finished = player();
  h.quest.setStage(finished, 56);
  h.hooks.onPlayerLogin[0]({ player: finished });
  assert.equal(h.quest.getStage(finished), 56);
  assert.equal(finished.xp.length, 0, 'a completed relog cannot grant the reward again');
});

test('Defender of Varrock invasion camera resets on logout and the cutscene resumes', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 50);
  h.action(p, N.ARRAV, 'eUroT0');
  p.manager.reset();
  h.tick(1);
  const resets = () => p.log.filter(row => row[0] === 'sendCameraReset').length;
  const before = resets();
  h.hooks.onPlayerLogout[0]({ player: p });
  assert.equal(resets(), before + 1, 'logging out cannot leave the scene camera locked');
  assert.equal(h.quest.getStage(p), 50);
  h.hooks.onPlayerLogin[0]({ player: p });
  const dimintheis = h.npcActions.get('Dimintheis')['Talk-to'];
  dimintheis({ player: p, npcId: N.DIMINTHEIS });
  h.action(p, N.DIMINTHEIS, '8eNIjz');
  assert.equal(h.quest.getStage(p), 50, 'the interrupted cutscene restarts without skipping the stage');
});

test('Defender and Curse of Arrav share the placed trapdoor without skipping the key route', () => {
  const h = harness(['CurseOfArrav', 'DefenderOfVarrock']), p = player();
  h.quest.setStage(p, 6);
  for (const [id, x, y] of [[50094,3280,3516],[50084,3260,3514],[50094,3269,3480],[50096,3293,3463],[50090,3325,3470],[50092,3349,3495]]) {
    h.object(p, id, 'Inspect', x, y);
  }
  p.attrs.set('quest.defender_of_varrock.key', 'player');
  p.items.set(I.GRUBBY_KEY_4, 1);
  p.moveTo(new core.Location(3342, 3515, 0));
  const opened = h.object(p, DOV_TRAPDOOR, 'Open', 3343, 3515);
  assert.equal(opened.handled, true);
  h.continueUntil(p, () => Boolean(p.prompt));
  assert.equal(p.items.get(I.GRUBBY_KEY_4), 0, 'Defender, not Curse, consumes the key');
  h.choose(p, "Let's do it.");
  assert.equal(h.quest.getStage(p), 14);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3560, 4551]);

  const inactive = player();
  const curse = h.quests.find(q => q.key === 'curse_of_arrav');
  curse.setStage(inactive, 20);
  const curseOpen = h.object(inactive, DOV_TRAPDOOR, 'Open', 3343, 3515);
  assert.equal(curseOpen.handled, true, 'Curse still owns the trapdoor when Defender is inactive');

  const done = player();
  h.quest.setStage(done, 56);
  curse.setStage(done, 20);
  const curseDone = h.object(done, DOV_TRAPDOOR, 'Open', 3343, 3515);
  assert.equal(curseDone.handled, true, 'Curse resumes ownership after Defender completion');
});

test('Defender of Varrock library list, census, descendant and single completion', () => {
  const h = harness('DefenderOfVarrock'), p = player();
  h.quest.setStage(p, 40);
  const reldo = h.npcActions.get('Reldo')['Talk-to'];
  reldo({ player: p, npcId: N.RELDO });
  h.continueUntil(p, () => p.text.includes('desk in the corner'));
  assert.equal(h.quest.getStage(p), 42, 'Reldo points at the scrolls but does not hand over the list');
  p.full = true;
  h.object(p, O.SCROLLS_5, 'Search');
  assert.equal(p.items.get(I.LIST_OF_ELDERS), undefined);
  assert.equal(h.quest.getStage(p), 42, 'a full inventory leaves the scrolls retryable');
  p.full = false;
  h.object(p, O.SCROLLS_5, 'Search');
  h.continueUntil(p, () => Boolean(p.items.get(I.LIST_OF_ELDERS)));
  assert.equal(p.items.get(I.LIST_OF_ELDERS), 1);
  assert.equal(h.quest.getStage(p), 44);
  h.object(p, O.VARROCK_CENSUS, 'Read');
  assert.equal(h.quest.getStage(p), 46);
  const keys = ['prysin', 'aeonisig', 'horvik', 'romeo', 'haig'];
  p.attrs.set('quest.defender_of_varrock.descendant', 'horvik');
  const rolled = p.attrs.get('quest.defender_of_varrock.descendant');
  assert.ok(keys.includes(rolled));
  const conditionStep = { prysin: 'DZqAWt', aeonisig: 'eyo5lV', horvik: '1UENq_', romeo: 'PKPnSn', haig: 'vGNLNb' };
  for (const key of keys) {
    assert.equal(h.hooks.onNpcDialogueCondition[0]({ player: p, stepId: conditionStep[key] }), key === rolled);
  }
  const candidateNpc = { prysin: N.SIR_PRYSIN, aeonisig: N.AEONISIG_RAISPHER, horvik: N.HORVIK, romeo: N.ROMEO, haig: N.CURATOR_HAIG_HALEN }[rolled];
  const candidateName = { prysin: 'Sir Prysin', aeonisig: 'Aeonisig Raispher', horvik: 'Horvik', romeo: 'Romeo', haig: 'Curator Haig Halen' }[rolled];
  h.npcActions.get(candidateName)['Talk-to']({ player: p, npcId: candidateNpc });
  assert.equal(h.quest.getStage(p), 48);
  p.items.set(I.SHIELD_OF_ARRAV, 1);
  const dimintheis = h.npcActions.get('Dimintheis')['Talk-to'];
  dimintheis({ player: p, npcId: N.DIMINTHEIS });
  h.emit('npc-dialogue:choice', { player: p, npcId: N.DIMINTHEIS, option: 'I need your help with the zombie invasion.' });
  h.action(p, N.DIMINTHEIS, 'eRxQvK');
  assert.equal(p.items.get(I.SHIELD_OF_ARRAV), 0, 'the shield is passed to Dimintheis');
  h.action(p, N.ARRAV, 'eUroT0');
  assert.equal(h.quest.getStage(p), 50);
  const moves = () => p.log.filter(row => row[0] === 'sendCameraMoveTo');
  const looks = () => p.log.filter(row => row[0] === 'sendCameraLookAt');
  const resetStart = p.log.filter(row => row[0] === 'sendCameraReset').length;
  p.manager.reset();
  h.tick(1);
  while (p.manager.getCurrent()) p.manager.advance();
  assert.deepEqual(moves().slice(-4).map(row => row.slice(1, 3)), [[3925, 4938], [3924, 4946], [3937, 4953], [3915, 4996]], 'four captured invasion cuts');
  assert.deepEqual(looks().slice(-4).map(row => row.slice(1, 3)), [[3914, 4928], [3919, 4946], [3933, 4950], [3915, 4985]], 'four captured invasion look-ats');
  assert.equal(h.quest.getStage(p), 52);
  assert.equal(p.log.filter(row => row[0] === 'sendCameraReset').length, resetStart + 1, 'camera resets once after the last cut');
  const rovin = h.npcActions.get('Captain Rovin')['Talk-to'];
  rovin({ player: p, npcId: N.CAPTAIN_ROVIN });
  h.action(p, N.CAPTAIN_ROVIN, '_NZz-1');
  assert.equal(h.quest.getStage(p), 56);
  assert.equal(h.quest.isComplete(p), true);
  assert.deepEqual(p.xp.map(([id]) => id).sort(), [core.Skill.HUNTER.getIndex(), core.Skill.SMITHING.getIndex()].sort());
  h.action(p, N.CAPTAIN_ROVIN, '_NZz-1');
  assert.equal(p.xp.length, 2, 'completion reward must not repeat');
});
