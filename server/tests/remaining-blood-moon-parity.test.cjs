// Focused parity checks for The Blood Moon Rises (Quest Helper pinned
// 06da90f982518a093f2fe1c9cfac5547fa7053d3 + RSProx captures).
// Run from server/: node --test tests/remaining-blood-moon-parity.test.cjs
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const path = require('node:path');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { DialogueManager } = require('../dist/game/model/dialogues/DialogueManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const runtime = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
const I = core.ItemIdentifiers, N = core.NpcIdentifiers;
let nextIndex = 1;
const noop = () => {};

before(async () => { await CachePipeline.initialize(path.resolve(__dirname, '..')); });

function harness() {
  const events = {}, tasks = [], npcs = [], removed = [], objects = [], variants = [], npcInteractions = new Map(), objectInteractions = new Map(), anyNpcHooks = [];
  let failSpawnId = null, failSpawnCount = 0;
  const api = new Proxy({
    core: { ...core, ObjectManager: { register: o => objects.push(o), deregister: noop },
      CountdownTask: class { constructor(key, ticks, run) { Object.assign(this, { key, ticks, run, stopped: false }); } },
      TaskManager: { submit(task) { tasks.push(task); }, cancelTasks(key) { for (const task of tasks) if (task.key === key) task.stopped = true; } } },
    registerArea: noop,
    getObjectManager: () => ({ register: o => objects.push(o), deregister: noop }),
    getItemOnGroundManager: () => ({ registerLocation: noop }),
    onNpcDialogueVariant(fn) { variants.push(fn); },
    onNpcDialogueCondition() {},
    onNpcInteraction(name, actions) { npcInteractions.set(name, actions); },
    onAnyNpcInteraction(actions) { anyNpcHooks.push(actions); },
    onObjectInteraction(target, actions) { if (typeof target === 'string') objectInteractions.set(target, actions); },
    onObjectRoute() {},
    onItemOnObject() {},
    onItemOnItem() {},
    onItemOnNpc() {},
    onItemAction() {},
    onGroundItemPickup() {},
    onPlayerProcess(fn) { (events['player:process'] ??= []).push(fn); },
    onPlayerLogin() {},
    onPlayerLogout() {},
    onPlayerMapSquareChange() {},
    onPlayerBeforeDeath() {},
    onCombatHitRoll() {},
    onNpcHitModify() {},
    onNpcBeforeDeath(fn) { (events['npc-before-death'] ??= []).push(fn); },
    onNpcHitModify(fn) { (events['npc-hit-modify'] ??= []).push(fn); },
    onPlayerLogin(fn) { (events['player:login'] ??= []).push(fn); },
    onPlayerLogout(fn) { (events['player:logout'] ??= []).push(fn); },
    onNpcDeath() {},
    onWalkRoute() {},
    registerCommand() {},
    persistAttribute: noop,
    sendMultiChatboxPrompt(target, title, ...pairs) { target.prompt = { title, options: pairs.filter((_, i) => i % 2 === 0), pairs }; return true; },
    onCustomEvent(key, fn) { (events[key] ??= []).push(fn); },
    emitCustomEvent(key, event) { for (const fn of events[key] ?? []) fn(event); },
    spawnNpc(definition) {
      if (failSpawnId === definition.id && failSpawnCount > 0) { failSpawnCount--; return null; }
      const npc = { ...definition, getId: () => definition.id, getIndex: () => nextIndex++, isNpc: () => true,
        isPlayer: () => false, getAsNpc() { return npc; }, getLocation: () => new core.Location(definition.x, definition.y, definition.z),
        getHitpoints: () => npc.hp ?? 1, setHitpoints(value) { npc.hp = value; }, getArea: () => npc.area ?? null, setArea(value) { npc.area = value; }, getOwner: () => definition.owner,
        getMovementQueue: () => ({ reset() { return this; }, setBlockMovement: noop, addFirstStep: noop }),
        getCombat: () => ({ attack: noop, getLastAttack: () => ({ reset: noop }) }), remove: noop,
        setMaxHitpoints: noop, setScriptedMovement: noop, setMultiCombat: noop,
        setFlag: noop, performAnimation: noop, performGraphic: noop, forceChat: noop,
        setPositionToFace: noop, exactMove: noop, setFollowing: noop };
      npcs.push(npc); return npc;
    },
    removeNpc: npc => removed.push(npc),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  return { api, events, tasks, npcs, removed, objects, variants, npcInteractions, objectInteractions, anyNpcHooks, quest: runtime.getRegisteredQuests().at(-1),
    emit: (name, event) => { for (const fn of events[name] ?? []) fn(event); },
    tick(count) { while (count-- > 0) for (const task of [...tasks]) if (!task.stopped && !task.done) { task.done = true; task.run(); } },
    failNextSpawns(id, count = 1) { failSpawnId = id; failSpawnCount = count; } };
}

function player(name = 'Parity') {
  const attrs = new Map(), items = new Map(), varbits = new Map(), varbitHistory = [], configs = new Map(), messages = [], xp = [], equipment = new Map();
  let location = new core.Location(3210, 3220, 0), area = null;
  const packets = { interfaces: [], closes: [], cameras: [], varbits: [] };
  const inv = { getAmount: id => items.get(id) ?? 0, contains: id => (items.get(id) ?? 0) > 0,
    getFreeSlots: () => 28, adds(id, n = 1) { items.set(id, (items.get(id) ?? 0) + n); },
    deleteNumber(id, n = 1) { items.set(id, (items.get(id) ?? 0) - n); } };
  const packet = new Proxy({
    sendVarbit(id, value) { varbits.set(id, value); varbitHistory.push([id, value]); packets.varbits.push([id, value]); return packet; },
    sendSubInterface(...args) { packets.interfaces.push(args); return packet; },
    closeSubInterface(...args) { packets.closes.push(args); return packet; },
    sendCameraMoveTo(...args) { packets.cameras.push(['move', ...args]); return packet; },
    sendCameraLookAt(...args) { packets.cameras.push(['look', ...args]); return packet; },
    sendCameraReset() { packets.cameras.push(['reset']); return packet; },
    sendConfig(id, value) { configs.set(id, value); return packet; },
    sendInterfaceRemoval() { p.manager.reset(); return packet; },
  }, { get: (t, key) => t[key] ?? (() => packet) });
  const p = {
    attrs, items, varbits, varbitHistory, configs, messages, xp, equipment, packets, index: nextIndex++,
    getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => inv, getEquipment: () => ({ get: slot => equipment.get(slot), contains: id => [...equipment.values()].some(e => e?.getId() === id) }),
    getPacketSender: () => packet, getDialogueManager: () => p.manager,
    getSkillManager: () => ({ getMaxLevel: () => p.skillLevel ?? 99, getCurrentLevel: () => 99, addExperiences: (s, a) => xp.push([s, a]) }),
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement(value) { p.movementBlocked = value; return this; }, isBlockMovement: () => Boolean(p.movementBlocked), addSteps: to => { location = to; } }),
    getLocation: () => location, moveTo: to => { location = to; },
    getArea: () => area, getPrivateArea: () => area, setArea: value => { area = value; },
    isPlayer: () => true, isNpc: () => false, getAsPlayer: () => p, isRegistered: () => true,
    getIndex: () => p.index, getUsername: () => name, getAppearance: () => ({ isMale: () => true }), sendMessage: text => messages.push(text),
    setPositionToFace: noop, forceChat: noop, performAnimation: noop, setUntargetable: noop, getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: noop }) }),
  };
  p.manager = new DialogueManager(p);
  return p;
}

function continueUntil(p, predicate, limit = 200) {
  while (!predicate()) {
    assert.ok(limit-- > 0, `dialogue stalled at ${p.manager.getCurrent()?.getText?.()}`);
    assert.ok(p.manager.getCurrent(), 'dialogue ended before the expected step');
    p.manager.advance();
  }
}

function choose(p, text) {
  const prompt = p.prompt;
  assert.ok(prompt, `no prompt for ${text}`);
  const index = prompt.options.findIndex(label => label === text);
  assert.ok(index >= 0, `missing ${text} in ${prompt.options}`);
  p.prompt = null;
  prompt.pairs[index * 2 + 1]();
}

const PREREQS = ['sins_of_the_father', 'a_night_at_the_theatre'];

function enablePrereqs(h, completed) {
  (h.events['quest:is-complete'] ??= []).push(event => {
    if (completed.has(event.key)) event.complete = true;
  });
}

test('Sarius starts the quest only with prereqs, then the recorded Yes choice marks stage 4', () => {
  const h = harness(), p = player(), completed = new Set(PREREQS);
  enablePrereqs(h, completed);
  p.skillLevel = 99;
  const sarius = { npcId: N.SARIUS_GUILE_4, definition: { getName: () => 'Sarius Guile' },
    pages: [{ page: 'The Blood Moon Rises', variants: ['starting-out', 'starting-out-in-the-myreque-hideout'] }] };
  const variant = who => h.variants.map(fn => fn({ player: who, ...sarius })).find(Boolean) ?? null;
  assert.equal(variant(p)?.variant, 'starting-out');

  const weak = player(); weak.skillLevel = 99;
  completed.clear();
  assert.equal(variant(weak), null, 'missing prereqs must not offer the start');
  completed.add('sins_of_the_father');
  assert.equal(variant(weak), null, 'both prereqs are required');
  completed.add('a_night_at_the_theatre');
  weak.skillLevel = 50;
  assert.equal(variant(weak), null, 'skill requirements gate the transcript');
  weak.skillLevel = 99;
  assert.equal(variant(weak)?.variant, 'starting-out');

  h.emit('npc-dialogue:choice', { player: p, option: 'No.', definition: { getName: () => 'Sarius Guile' } });
  assert.equal(h.quest.getStage(p), 0, 'declining must not start the quest');
  h.emit('npc-dialogue:choice', { player: p, option: 'Yes.', definition: { getName: () => 'Sarius Guile' } });
  assert.equal(h.quest.getStage(p), 10);
  assert.equal(p.varbits.get(15464), 2, 'accepting Sarius sets captured native stage 2');
});

test('hideout shrine is only inspectable in the hideout and outfit gates departure', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS)); h.quest.setStage(p, 10);
  const shrine = { objectId: 61174, location: new core.Location(3601, 9614, 0) };
  p.moveTo(shrine.location);
  const far = { ...shrine, location: new core.Location(3200, 3200, 0) };
  p.moveTo(far.location);
  h.emit('world:object-examine', { player: p, ...far });
  p.moveTo(shrine.location);
  assert.equal(p.attrs.get('quest.the_blood_moon_rises.hideout-shrine-inspected'), undefined);
  p.varbitHistory.length = 0;
  h.emit('world:object-examine', { player: p, ...shrine });
  assert.equal(p.attrs.get('quest.the_blood_moon_rises.hideout-shrine-inspected'), true);
  const shrineStages = p.varbitHistory.filter(([id]) => id === 15464).map(([, value]) => value);
  assert.ok(shrineStages.includes(6), 'shrine objectbox opens at native stage 6');
  assert.equal(p.varbits.get(15464), 8, 'first shrine line sets native stage 8');

  h.emit('npc-dialogue:choice', { player: p, option: "I'm ready.", definition: { getName: () => 'Ivan Strom' } });
  assert.equal(h.quest.getStage(p), 10, 'cannot leave without wearing the vyre outfit');
  for (const [slot, item] of [[core.Equipment.BODY_SLOT, I.VYRE_NOBLE_TOP], [core.Equipment.LEG_SLOT, I.VYRE_NOBLE_LEGS], [core.Equipment.FEET_SLOT, I.VYRE_NOBLE_SHOES]])
    p.equipment.set(slot, { getId: () => item });
  h.emit('npc-dialogue:choice', { player: p, option: "I'm ready.", definition: { getName: () => 'Ivan Strom' } });
  assert.equal(h.quest.getStage(p), 20);
  assert.equal(p.varbits.get(15464), 10, 'Ivan arms the trip at native stage 10');
  p.attrs.set('the-blood-moon-rises:hideout-cutscene-started', true);
  assert.equal(h.quest.varbitValue(20, p), 12, 'Lowerniel cutscene sets native stage 12');
});

test('final council scene completes once, awards 4 QP and a single Tome', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS)); h.quest.setStage(p, 100);
  p.attrs.set('quest.the_blood_moon_rises.drakan-defeated', true);
  const end = { player: p, stepId: 'BzMe5D' };
  h.emit('npc-dialogue:action', end);
  assert.equal(h.quest.getStage(p), 110);
  assert.equal(p.attrs.get('quest.points'), 4);
  assert.equal(p.items.get(I.TOME_OF_EXPERIENCE_3), 1);
  assert.ok(p.messages.some(line => line.includes('Congratulations')));
  h.emit('npc-dialogue:action', end);
  assert.equal(p.items.get(I.TOME_OF_EXPERIENCE_3), 1, 'replaying the scene must not duplicate the reward');
  assert.equal(p.attrs.get('quest.points'), 4);
});

test('the ending scene cannot complete from an earlier chapter', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS)); h.quest.setStage(p, 70);
  p.attrs.set('quest.the_blood_moon_rises.drakan-defeated', true);
  h.emit('npc-dialogue:action', { player: p, stepId: 'BzMe5D' });
  assert.equal(h.quest.getStage(p), 70);
  assert.equal(p.items.get(I.TOME_OF_EXPERIENCE_3), undefined);
});

test('Slepe/Paterdomus chapters mirror Quest Helper native stages and defer to the refinery', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS));
  const STORY = 'quest.the_blood_moon_rises.slepe-story';
  h.quest.setStage(p, 30);
  const run = () => h.emit('player:process', { player: p });
  run(); assert.equal(p.varbits.get(15464), 16, 'Ivan outside Slepe church');
  p.attrs.set(STORY, { royClue: true }); run(); assert.equal(p.varbits.get(15464), 18);
  p.attrs.set(STORY, { royClue: true, manorEntered: true }); run(); assert.equal(p.varbits.get(15464), 20);
  p.attrs.set(STORY, { manorEnemiesDefeated: true }); run(); assert.equal(p.varbits.get(15464), 22);
  p.attrs.set(STORY, { manorComplete: true }); run(); assert.equal(p.varbits.get(15464), 24);
  p.attrs.set(STORY, { manorComplete: true, journalGiven: true }); run(); assert.equal(p.varbits.get(15464), 26);
  p.attrs.set(STORY, { journalGiven: true, journalRead: true }); run(); assert.equal(p.varbits.get(15464), 28);
  p.attrs.set(STORY, { journalRead: true, upstairsTalked: true }); run(); assert.equal(p.varbits.get(15464), 30);
  p.attrs.set(STORY, { upstairsTalked: true, monksRequested: true }); run(); assert.equal(p.varbits.get(15464), 32);
  p.attrs.set(STORY, { monksRequested: true, monkKills: ['one'] }); run(); assert.equal(p.varbits.get(15464), 34);
  p.attrs.set(STORY, { monksCleared: true }); run(); assert.equal(p.varbits.get(15464), 36);
  p.attrs.set(STORY, { booksPlaced: true }); run(); assert.equal(p.varbits.get(15464), 38);
  p.attrs.set(STORY, { writingsGiven: true }); run(); assert.equal(p.varbits.get(15464), 40);
  p.attrs.set(STORY, { writingsRead: true }); run(); assert.equal(p.varbits.get(15464), 42);
  p.attrs.set(STORY, { tombRouteStarted: true }); run(); assert.equal(p.varbits.get(15464), 44);
  assert.equal(h.quest.varbitValue(30, p), 44, 'relog resends the granular Slepe stage');
  p.attrs.set('the-blood-moon-rises:refinery-progress', { phase: 'mined' });
  p.varbits.set(15464, 54); run();
  assert.equal(p.varbits.get(15464), 54, 'refinery native stage is not overwritten by the story mirror');
  assert.equal(h.quest.varbitValue(30, p), 54, 'relog during the refinery resumes its stage');
});

test('post-Theatre recorded stages 138/140/142/144 advance in order', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 80);
  p.attrs.set('quest.the_blood_moon_rises.tob-challenge', { started: true, completed: false });
  p.varbitHistory.length = 0;
  h.emit('tob:bmr-completed', { player: p });
  assert.equal(h.quest.getStage(p), 80, 'ToB completion keeps the Theatre chapter open');
  const stages = p.varbitHistory.filter(([id]) => id === 15464).map(([, value]) => value);
  assert.ok(stages.includes(138), 'Sugadinti scene starts at 138');
  assert.equal(p.varbits.get(15464), 140, 'leaving the scene sets 140');
  h.emit('npc-dialogue:action', { player: p, stepId: '4G5OZg' });
  assert.equal(h.quest.getStage(p), 90, 'entering the ruins starts the Wyrd chapter');
  assert.equal(p.varbits.get(15464), 144, 'Wyrd fight stage 144');
});

test('Blood Moon gathering replaces the premature jump to the final chapter', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 96);
  p.attrs.set('quest.the_blood_moon_rises.wyrd-defeated', true);
  p.varbitHistory.length = 0;
  h.emit('npc-dialogue:action', { player: p, stepId: '2QgFZA', kind: 'action' });
  assert.equal(h.quest.getStage(p), 96, 'still in the Wyrd chapter for the gathering conversations');
  assert.ok(p.varbitHistory.some(([id, value]) => id === 15464 && value === 152), 'gathering starts at native 152');
  const sceneLine = { player: p, text: "I suppose we're about to find out...", pages: [{ page: "The Blood Moon Rises", variants: ["night-of-the-blood-moon"] }], step: { speaker: "Sugadinti Vitur" } };
  h.emit('npc-dialogue:line', sceneLine); sceneLine.after();
  assert.equal(p.varbits.get(15464), 154, 'the gathering fight starts at 154');
  const boss = h.npcs.find(npc => npc.id === core.NpcIdentifiers.LOWERNIEL_DRAKAN_18);
  assert.ok(boss, 'spawns the captured combat_3 Lowerniel');
  p.varbitHistory.length = 0;
  h.emit('npc-before-death', { npc: boss, killer: p });
  assert.ok(p.varbitHistory.some(([id, value]) => id === 15464 && value === 156), 'Safalaan intervention sets 156');
  assert.equal(h.quest.getStage(p), 96, 'the final chapter is not entered until Efaritay is met');
});

test('captured native 14 spans the hideout conversation until "What is it?"', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 20);
  p.attrs.set('quest.the_blood_moon_rises.hideout-defense-complete', true);
  h.emit('npc-dialogue:action', { player: p, stepId: 'fiqzZ7', kind: 'action' });
  assert.equal(h.quest.getStage(p), 25, 'post-escape hideout stage');
  assert.equal(p.varbits.get(15464), 14, 'captured native 14');
  h.emit('npc-dialogue:line', { player: p, text: 'What is it?', pages: [{ page: 'The Blood Moon Rises', variants: ['starting-out-back-at-the-hideout'] }], step: { } });
  assert.equal(h.quest.getStage(p), 30);
  assert.equal(p.varbits.get(15464), 16, 'native 16 at the Veliaf discussion');
});

test('gathering fight uses the captured 900 HP intervention and fires once', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 96);
  p.attrs.set('quest.the_blood_moon_rises.wyrd-defeated', true);
  h.emit('npc-dialogue:action', { player: p, stepId: '2QgFZA', kind: 'action' });
  const sceneLine = { player: p, text: "I suppose we're about to find out...", pages: [{ page: "The Blood Moon Rises", variants: ["night-of-the-blood-moon"] }], step: { speaker: "Sugadinti Vitur" } };
  h.emit('npc-dialogue:line', sceneLine); sceneLine.after();
  const boss = h.npcs.find(npc => npc.id === core.NpcIdentifiers.LOWERNIEL_DRAKAN_18);
  assert.ok(boss);
  const fight = p.attrs.get('the-blood-moon-rises:gathering-fight');
  assert.equal(fight.boss, boss);
  boss.setHitpoints(950);
  assert.equal(boss.getHitpoints(), 950);
  p.varbitHistory.length = 0;
  const part = { getDamage: () => 100, setDamage(value) { this.value = value; } };
  const hit = { getHits: () => [part], updateTotalDamage: noop };
  h.emit('npc-hit-modify', { npc: boss, hit });
  assert.equal(part.value, 50, 'damage is clamped at the 900 HP story threshold');
  assert.equal(p.varbits.get(15464), 156);
  assert.equal(h.removed.filter(npc => npc === boss).length, 1, 'boss removed once');
  h.emit('npc-hit-modify', { npc: boss, hit: { getHits: () => [{ getDamage: () => 50, setDamage: noop }], updateTotalDamage: noop } });
  const interventions = p.varbitHistory.filter(([id, value]) => id === 15464 && value === 156).length;
  assert.equal(interventions, 1, 'repeated hits do not replay the intervention');
});

test('final victory resumes at 172 after death and cannot be confirmed twice', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 100);
  p.attrs.set('quest.the_blood_moon_rises.drakan-death-confirmed', true);
  p.attrs.set('quest.the_blood_moon_rises.final-native-stage', 170);
  h.emit('player:login', { player: p });
  assert.equal(p.varbits.get(15464), 172, 'relog after death resumes the 172 cutscene');
  p.attrs.set('quest.the_blood_moon_rises.drakan-defeated', true);
  h.emit('npc-dialogue:action', { player: p, stepId: 'BzMe5D' });
  assert.equal(h.quest.getStage(p), 110);
  const once = h.removed.length;
  h.emit('npc-dialogue:action', { player: p, stepId: 'BzMe5D' });
  assert.equal(p.items.get(I.TOME_OF_EXPERIENCE_3), 1, 'final reward stays one-shot');
  assert.equal(h.removed.length, once);
});

test('repeated gather input spawns one boss and logout cleans every actor', () => {
  const h = harness(), p = player();
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 96);
  p.attrs.set('quest.the_blood_moon_rises.wyrd-defeated', true);
  h.emit('npc-dialogue:action', { player: p, stepId: '2QgFZA', kind: 'action' });
  const line = { player: p, text: "I suppose we're about to find out...", pages: [{ page: "The Blood Moon Rises", variants: ["night-of-the-blood-moon"] }], step: { speaker: "Sugadinti Vitur" } };
  h.emit('npc-dialogue:line', line); line.after();
  const bosses = () => h.npcs.filter(npc => npc.id === core.NpcIdentifiers.LOWERNIEL_DRAKAN_18);
  assert.equal(bosses().length, 1);
  line.after();
  assert.equal(bosses().length, 1, 'replaying the cutscene line does not spawn a second boss');
  const gathering = [bosses()[0], ...h.npcs.filter(npc => [core.NpcIdentifiers.IVAN_STROM_23, core.NpcIdentifiers.SUGADINTI_VITUR_6, core.NpcIdentifiers.ARANEI_92].includes(npc.id))];
  assert.ok(gathering.length >= 2);
  h.emit('player:logout', { player: p });
  for (const npc of gathering) assert.ok(h.removed.includes(npc), 'gathering actor removed on logout');
});

function startTranscript(h, p, npcId, variant) {
  assert.equal(runtime.startTranscript(h.api, p, npcId, 'The Blood Moon Rises', variant), true);
}

test('real starting-out transcript keys on placeholders for two different players', () => {
  for (const name of ['Alice', 'ZezimaTwo']) {
    const h = harness(), p = player(name);
    enablePrereqs(h, new Set(PREREQS));
    startTranscript(h, p, N.SARIUS_GUILE_4, 'starting-out');
    continueUntil(p, () => Boolean(p.prompt));
    choose(p, 'Yes.');
    assert.equal(h.quest.getStage(p), 10, `${name}: quest accepted`);
    assert.equal(p.varbits.get(15464), 4, `${name}: closing Sarius line reaches native 4`);
  }
});

test('real shrine transcript advances on the substituted line for two different players', () => {
  for (const name of ['Alice', 'ZezimaTwo']) {
    const h = harness(), p = player(name);
    enablePrereqs(h, new Set(PREREQS));
    h.quest.setStage(p, 10);
    p.attrs.set('quest.the_blood_moon_rises.hideout-shrine-inspected', true);
    p.varbits.set(15464, 6);
    startTranscript(h, p, N.IVAN_STROM_4, 'starting-out-inspecting-the-shrine');
    continueUntil(p, () => p.manager.getCurrent()?.getText?.() === `${name}.`);
    assert.equal(p.varbits.get(15464), 8, `${name}: substituted shrine line reaches native 8`);
  }
});

test('same raw line on another quest page cannot advance Blood Moon state', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 10);
  p.attrs.set('quest.the_blood_moon_rises.hideout-shrine-inspected', true);
  h.emit('npc-dialogue:line', { player: p, text: 'Good luck, [player name].',
    pages: [{ page: 'Another Quest', variants: ['starting-out'] }], step: { speaker: 'Sarius Guile' } });
  assert.equal(p.attrs.get('the-blood-moon-rises:start-dialogue-complete'), undefined);
});

test('hideout departure runs the captured fade and hideout camera, then resets', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 20);
  p.attrs.set('quest.the_blood_moon_rises.hideout-shrine-inspected', true);
  for (const [slot, item] of [[core.Equipment.BODY_SLOT, I.VYRE_NOBLE_TOP], [core.Equipment.LEG_SLOT, I.VYRE_NOBLE_LEGS], [core.Equipment.FEET_SLOT, I.VYRE_NOBLE_SHOES]])
    p.equipment.set(slot, { getId: () => item });
  const talk = h.npcInteractions.get('Ivan Strom')['Talk-to'];
  assert.ok(talk({ player: p, npcId: N.IVAN_STROM_13, definition: { getName: () => 'Ivan Strom' } }));
  choose(p, "I'm ready.");
  assert.ok(p.packets.interfaces.some(args => args[0] === ((161 << 16) | 1)), 'fade overlay opened');
  assert.ok(p.packets.cameras.some(args => args[0] === 'move' && args[1] === 3597 && args[2] === 9617 && args[3] === 370));
  assert.ok(p.packets.cameras.some(args => args[0] === 'look' && args[1] === 3602 && args[2] === 9610 && args[3] === 369));
  h.tick(2);
  assert.ok(p.packets.interfaces.some(args => args[3]?.postScripts?.[0]?.args?.[1] === 0), 'fade back in scheduled');
  p.packets.cameras.length = 0;
  h.emit('npc-dialogue:action', { player: p, stepId: 'fiqzZ7', kind: 'action' });
  assert.ok(p.packets.cameras.some(args => args[0] === 'reset'), 'escape restores the camera');
});

test('gathering scene plays the captured crowd camera and fade, and relog resets it', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 96);
  p.attrs.set('quest.the_blood_moon_rises.wyrd-defeated', true);
  h.emit('npc-dialogue:action', { player: p, stepId: '2QgFZA', kind: 'action' });
  const line = { player: p, text: 'Myreque prevail.', pages: [{ page: 'The Blood Moon Rises', variants: ['fighting-wyrds-inspecting-the-broken-fence'] }], step: {} };
  h.emit('npc-dialogue:line', line); line.after();
  assert.ok(p.packets.cameras.some(args => args[0] === 'move' && args[1] === 3594 && args[2] === 3358 && args[3] === 120));
  assert.ok(p.packets.cameras.some(args => args[0] === 'look' && args[1] === 3566 && args[2] === 3355 && args[3] === 180));
  h.tick(6);
  assert.ok(p.packets.cameras.some(args => args[0] === 'move' && args[1] === 3571 && args[2] === 3350 && args[3] === 360));
  p.packets.cameras.length = 0;
  h.emit('player:login', { player: p });
  assert.ok(p.packets.cameras.some(args => args[0] === 'reset'), 'relog clears the cutscene camera');
  assert.equal(p.varbits.get(6719), 0, 'minimap restored');
});

test('post-Drakan graveyard camera, actors and fade clean up at 176 and completion', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 100);
  p.attrs.set('quest.the_blood_moon_rises.drakan-death-confirmed', true);
  h.emit('npc-dialogue:action', { player: p, stepId: 'HNA3XS' });
  assert.equal(p.varbits.get(15464), 174);
  assert.ok(p.packets.cameras.some(args => args[0] === 'move' && args[1] === 3715 && args[2] === 3210 && args[3] === 345));
  assert.ok(p.packets.cameras.some(args => args[0] === 'look' && args[1] === 3707 && args[2] === 3211 && args[3] === 65));
  const actors = h.npcs.filter(npc => [core.NpcIdentifiers.EFARITAY_HALLOW_3, core.NpcIdentifiers.WYRD_4, core.NpcIdentifiers.EFARITAY_HALLOW_5].includes(npc.id));
  assert.ok(actors.length >= 2, 'Efaritay and Wyrd actors spawned for the scene');
  p.packets.cameras.length = 0;
  h.emit('npc-dialogue:action', { player: p, stepId: 'I_SfUV' });
  h.tick(1);
  assert.equal(p.varbits.get(15464), 176);
  assert.ok(actors.every(npc => h.removed.includes(npc)), 'graveyard actors removed at 176');
  assert.ok(p.packets.cameras.some(args => args[0] === 'reset'));
  h.emit('npc-dialogue:action', { player: p, stepId: 'BzMe5D' });
  h.tick(2);
  assert.equal(h.quest.getStage(p), 110);
  assert.equal(p.items.get(I.TOME_OF_EXPERIENCE_3), 1);
  assert.ok(p.packets.cameras.some(args => args[0] === 'reset'), 'camera reset on completion');
});

test('shipped index resolves world Sarius 15839 to the real starting-out dispatch', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  const def = core.NpcDefinition.forId(15839);
  assert.equal(def?.getName?.(), 'Sarius Guile');
  const index = require('../data/definitions/npc-dialogue-index.json');
  assert.deepEqual(index['15839'], [{ page: 'Transcript:The Blood Moon Rises', variants: ['pre-release-dialogue', 'starting-out'] }]);

  const dialogueHooks = [];
  const api2 = new Proxy({}, { get: (_, key) => key === 'onAnyNpcInteraction'
    ? actions => dialogueHooks.push(actions) : h.api[key] });
  require('../plugins/npcs/NpcDialogues.plugin').register(api2);
  const talk = dialogueHooks[0]['Talk-to'];
  const npc = { getId: () => 15839 };
  talk({ player: p, npc, npcId: 15839, definition: def });
  assert.ok(p.manager.getCurrent(), 'NPC dialogue started from the shipped index');
  assert.notEqual(p.manager.getCurrent().getText?.(), "Sorry, i've nothing interesting to talk about yet");
  continueUntil(p, () => p.manager.getCurrent()?.getText?.() === "I was hoping I'd find you here.");
  assert.equal(p.manager.getCurrent().getText(), "I was hoping I'd find you here.");
});

test('shipped Makeshift shrine 61177 Inspect follows the normal object hook to stage 6', () => {
  const { CacheDefinitions } = require('../dist/game/cache/CacheDefinitions');
  const loc = CacheDefinitions.getObject(61177);
  assert.equal(loc?.name, 'Makeshift shrine');
  assert.equal(loc?.actions?.[0], 'Inspect');
  assert.equal(loc?.actions?.filter(Boolean).length, 1);

  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 10);
  p.moveTo(new core.Location(3600, 9614, 0));
  const actions = h.objectInteractions.get('Makeshift shrine');
  assert.ok(actions?.Inspect, 'registered named Inspect hook');
  const event = { player: p, objectId: 61177, option: 'inspect', handled: false,
    definition: { getId: () => 61177, getName: () => 'Makeshift shrine' },
    location: new core.Location(3601, 9614, 0) };
  actions.Inspect(event);
  assert.equal(event.handled, true);
  assert.equal(p.attrs.get('quest.the_blood_moon_rises.hideout-shrine-inspected'), true);
  const stages = p.varbitHistory.filter(([id]) => id === 15464).map(([, value]) => value);
  assert.ok(stages.includes(6), 'Inspect sends the captured stage 6');
  assert.equal(p.varbits.get(15464), 8, 'real shrine transcript advances to 8');
});

test('shipped Fence 61269 Inspect follows the named object hook at the broken fence', () => {
  const { CacheDefinitions } = require('../dist/game/cache/CacheDefinitions');
  const loc = CacheDefinitions.getObject(61269);
  assert.equal(loc?.name, 'Fence');
  assert.equal(loc?.actions?.[0], 'Inspect');

  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  p.attrs.set('quest.the_blood_moon_rises.wyrd-defeated', true);
  p.moveTo(new core.Location(3562, 3322, 0));
  const actions = h.objectInteractions.get('Fence');
  assert.ok(actions?.Inspect, 'registered named Fence Inspect hook');
  const event = { player: p, objectId: 61269, option: 'inspect', handled: false,
    definition: { getId: () => 61269, getName: () => 'Fence' },
    location: new core.Location(3562, 3323, 0) };
  assert.equal(actions.Inspect(event), true);
  assert.equal(event.handled, true);
  assert.ok(p.manager.getCurrent(), 'inspection transcript started');
});

test('real Lowerniel speech releases departure controls before the defence fight', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 20);
  p.attrs.set('quest.the_blood_moon_rises.hideout-shrine-inspected', true);
  for (const [slot, item] of [[core.Equipment.BODY_SLOT, I.VYRE_NOBLE_TOP], [core.Equipment.LEG_SLOT, I.VYRE_NOBLE_LEGS], [core.Equipment.FEET_SLOT, I.VYRE_NOBLE_SHOES]])
    p.equipment.set(slot, { getId: () => item });

  const talk = h.npcInteractions.get('Ivan Strom')['Talk-to'];
  assert.ok(talk({ player: p, npcId: N.IVAN_STROM_13, definition: { getName: () => 'Ivan Strom' } }));
  choose(p, "I'm ready.");
  assert.equal(h.quest.getStage(p), 20);
  assert.equal(p.movementBlocked, true, 'departure holds the player during the speech');
  assert.equal(p.varbits.get(542), 1);

  // Real transcript: advance to the final Lowerniel line, then continue past it.
  continueUntil(p, () => p.manager.getCurrent()?.getText?.()?.startsWith('As a starting point'));
  p.manager.advance();
  h.tick(2);

  assert.equal(p.movementBlocked, false, 'controls released before the fight starts');
  assert.equal(p.varbits.get(542), 0);
  assert.equal(p.varbits.get(6719), 0);
  const area = p.attrs.get('quest.the_blood_moon_rises.hideout-defense-area');
  assert.ok(area && area.name === undefined && typeof area.canAttack === 'function', 'real defence area created');
  const enemies = h.npcs.filter(npc => [3717, 3718, 3719].includes(npc.id));
  assert.equal(enemies.length, 3, 'opening vyrewatch spawned');
  for (const npc of enemies) {
    assert.equal(npc.getArea(), area);
    assert.equal(area.canAttack(p, npc), true, 'defence NPCs are targetable after release');
  }
});

test('real gathering scene releases held controls before the combat encounter', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 96);
  p.attrs.set('quest.the_blood_moon_rises.wyrd-defeated', true);
  h.quest.setStage(p, 96);
  h.emit('npc-dialogue:action', { player: p, stepId: '2QgFZA', kind: 'action' });
  const line = { player: p, text: 'Myreque prevail.', pages: [{ page: 'The Blood Moon Rises', variants: ['fighting-wyrds-inspecting-the-broken-fence'] }], step: {} };
  h.emit('npc-dialogue:line', line); line.after();
  assert.equal(p.movementBlocked, true, 'gathering holds the player during the scene');
  // Real night-of-the-blood-moon transcript is already running; drive to the fight line.
  continueUntil(p, () => p.manager.getCurrent()?.getText?.() === "I suppose we're about to find out...");
  p.manager.advance();
  assert.equal(p.movementBlocked, false, 'controls released before the gathering fight');
  assert.ok(h.npcs.some(npc => npc.id === core.NpcIdentifiers.LOWERNIEL_DRAKAN_18), 'combat_3 Lowerniel spawned');
});

function runFenceToGathering(h, p) {
  startTranscript(h, p, 0, 'fighting-wyrds-inspecting-the-broken-fence');
  continueUntil(p, () => Boolean(p.prompt));
  choose(p, "I'm ready.");
  continueUntil(p, () => p.manager.getCurrent()?.getText?.() === "I suppose we're about to find out...");
  p.manager.advance();
}

test('gathering spawn failure clears the scene and the real fence route retries', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 96);
  p.attrs.set('quest.the_blood_moon_rises.wyrd-defeated', true);
  h.failNextSpawns(core.NpcIdentifiers.LOWERNIEL_DRAKAN_18, 1);
  runFenceToGathering(h, p);
  assert.equal(p.attrs.get('the-blood-moon-rises:gathering-scene-started'), null,
    'scene marker cleared after spawn failure');
  assert.equal(p.movementBlocked, false);
  assert.ok(p.packets.cameras.some(args => args[0] === 'reset'));
  assert.equal(p.getLocation().getX(), 3490);
  assert.equal(p.getLocation().getY(), 9631);
  assert.ok(p.messages.some(m => m.includes('Inspect the broken fence again')));

  h.failNextSpawns(core.NpcIdentifiers.LOWERNIEL_DRAKAN_18, 0);
  runFenceToGathering(h, p);
  const bosses = h.npcs.filter(npc => npc.id === core.NpcIdentifiers.LOWERNIEL_DRAKAN_18);
  assert.equal(bosses.length, 1, 'real fence rerun spawns exactly one boss');
  assert.equal(p.varbits.get(15464), 154);
  p.attrs.set('quest.the_blood_moon_rises.final-native-stage', 152);
  const again = { player: p, text: "I suppose we're about to find out...", pages: [{ page: 'The Blood Moon Rises', variants: ['night-of-the-blood-moon'] }], step: { speaker: 'Sugadinti Vitur' } };
  h.emit('npc-dialogue:line', again); again.after();
  assert.equal(h.npcs.filter(npc => npc.id === core.NpcIdentifiers.LOWERNIEL_DRAKAN_18).length, 1,
    'replaying the fight line keeps a single live boss');
});

test('relog at FENCE_FOUND clears a stale gathering scene without a live fight', () => {
  const h = harness(), p = player('Alice');
  enablePrereqs(h, new Set(PREREQS));
  h.quest.setStage(p, 96);
  p.attrs.set('the-blood-moon-rises:gathering-scene-started', true);
  p.attrs.set('quest.the_blood_moon_rises.final-native-stage', 152);
  p.moveTo(new core.Location(3570, 3351, 0));
  h.emit('player:login', { player: p });
  assert.equal(p.attrs.get('the-blood-moon-rises:gathering-scene-started'), null);
  assert.equal(p.getLocation().getX(), 3490);
  assert.equal(p.getLocation().getY(), 9631);
  assert.equal(p.movementBlocked, false);
  assert.ok(p.packets.cameras.some(args => args[0] === 'reset'));
});
