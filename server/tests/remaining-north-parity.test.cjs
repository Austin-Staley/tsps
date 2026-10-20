// Secrets of the North route parity: server plugin + quest runtime + Wiki dialogue data.
// From server/: node --test tests/remaining-north-parity.test.cjs (after yarn build).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const runtime = require('../plugins/quests/QuestRuntime');
const sotnRecord = require('../data/definitions/npc-dialogues.json')['Secrets of the North'];
const dialogues = sotnRecord.variants;

function messageSteps(steps, out = []) {
  for (const step of steps ?? []) {
    if (step.type === 'message' && step.id) out.push(step);
    messageSteps(step.steps, out);
    for (const option of step.options ?? []) messageSteps(option.steps, out);
  }
  return out;
}
const falseWallMessages = messageSteps(dialogues['a-death-in-the-family-knocking-at-the-false-wall']);
const falseWallMessage = falseWallMessages.find(step => step.id === 'HJ2S0x') ?? falseWallMessages[0];
const core = PluginManager.getCoreApi();
const { NpcIdentifiers: N, ObjectIdentifiers: O, ItemIdentifiers: I, Skill } = core;
const PAGE = 'Secrets of the North';
const pages = [{ page: PAGE }];
const noop = () => {};

function harness({ completed = [] } = {}) {
  const events = {}, hooks = {}, tasks = [], transcripts = [], objects = [], npcs = [], prompts = [], persisted = [];
  const delayed = [];
  class FakeCountdown {
    constructor(key, ticks, callback) { this.key = key; this.ticks = ticks; this.remaining = ticks; this.callback = callback; }
  }
  const completedQuests = new Set(completed);
  const api = new Proxy({
    core: {
      ...core,
      CountdownTask: FakeCountdown,
      TaskManager: {
        submit: task => { if ((task.remaining ?? 1) <= 1) task.callback?.(); else delayed.push(task); },
        cancelTasks: key => {
          for (let i = delayed.length - 1; i >= 0; i--) if (delayed[i].key === key) delayed.splice(i, 1);
        },
      },
      MapObjects: { get: () => null },
      ObjectManager: { register: object => objects.push(object), deregister: noop },
    },
    persistAttribute: (key, value) => persisted.push([key, value]),
    sendMultiChatboxPrompt: (player, title, ...pairs) => { prompts.push({ player, title, pairs }); },
    onCustomEvent: (name, handler) => (events[name] ??= []).push(handler),
    onNpcInteraction: (name, actions) => (hooks.onNpcInteraction ??= []).push({ name, actions }),
    onZoneEnter: (zone, handler) => (hooks.onZoneEnter ??= []).push(handler),
    emitCustomEvent: (name, event) => {
      (events[name] ?? []).forEach(handler => handler(event));
      if (name === 'quest:is-complete' && event) event.complete = completedQuests.has(event.key);
      if (name === 'quest:is-started' && event) event.started = completedQuests.has(event.key);
    },
    spawnNpc: definition => {
      let removed = false, at = new core.Location(definition.x, definition.y, definition.z);
      const npc = {
        ...definition,
        getId: () => definition.id,
        getOwner: () => definition.owner,
        getLocation: () => at,
        isRegistered: () => !removed,
        getCombat: () => ({ attack: target => { npc.attacked = target; }, reset: noop }),
        setCombatXpMultiplier: noop, setPositionToFace: value => { npc.faced = value; },
        setNpcTransformationId: id => { npc.transformed = id; }, performAnimation: noop,
        performGraphic: noop, forceChat: noop,
        getArea: () => npc.area, setArea: value => { npc.area = value; },
        moveTo: value => { at = value; npc.movedTo = value; },
        isPlayer: () => false, isNpc: () => true, getIndex: () => 2, getAsNpc: () => npc,
      };
      npcs.push(npc);
      return npc;
    },
    removeNpc: npc => { npc.removed = true; },
    getWorld: () => ({ getNpcs: () => npcs }),
  }, {
    get: (target, key) => target[key] ?? ((...args) => {
      (hooks[key] ??= []).push(args[0]);
    }),
  });

  const original = runtime.startTranscript;
  runtime.startTranscript = (...args) => {
    const variant = args[4];
    assert.ok(variant === undefined || Object.hasOwn(dialogues, variant), `unknown variant ${variant}`);
    transcripts.push({ page: args[3], npcId: args[2], variant });
    return true;
  };
  try { require('../plugins/quests/quests/SecretsOfTheNorth.Quest')(api); }
  finally { runtime.startTranscript = original; }

  const quest = runtime.getRegisteredQuests().at(-1);
  function emit(name, event) { (events[name] ?? []).forEach(handler => handler(event)); }
  function interact(name, action, event) {
    for (const entry of hooks.onNpcInteraction ?? []) {
      if (entry.name === name) entry.actions[action](event);
    }
  }
  return {
    api, hooks, tasks, transcripts, objects, npcs, prompts, persisted, quest, events, completedQuests,
    emit,
    hook(name, event = {}) { emit(name, event); },
    interact,
    talk(name, player, npcId, action = 'Talk-to') {
      interact(name, action, { player, npcId, npc: npcs.find(n => n.id === npcId) });
    },
    object(player, objectId, location, option = 1) {
      const event = {
        player, objectId, clickType: option, location,
        definition: { id: objectId, getInteractions: () => ['Inspect'] },
      };
      hooks.onObjectInteraction[0](event);
      return event;
    },
    itemOnObject(player, itemId, objectId, location) {
      const event = {
        player, itemId, objectId, location,
        definition: { id: objectId, getInteractions: () => ['Use'] },
      };
      hooks.onItemOnObject[0](event);
      return event;
    },
    itemOnItem(player, usedItemId, usedWithItemId) {
      const event = { player, usedItemId, usedWithItemId };
      hooks.onItemOnItem[0](event);
      return event;
    },
    choose(player, label) {
      const prompt = prompts.filter(entry => entry.player === player).at(-1);
      assert.ok(prompt, 'no prompt open');
      const index = prompt.pairs.indexOf(label);
      assert.ok(index >= 0 && index % 2 === 0, `no option ${label}`);
      prompt.pairs[index + 1]();
    },
    item(player, itemId, option) {
      const event = { player, itemId, option };
      hooks.onItemAction[0](event);
      return event;
    },
    tick(count) {
      while (count-- > 0) {
        for (let i = delayed.length - 1; i >= 0; i--) {
          const task = delayed[i];
          if (--task.remaining <= 0) { delayed.splice(i, 1); task.callback?.(); }
        }
      }
    },
    line(player, text) {
      const event = { player, text };
      emit('npc-dialogue:line', event);
      return event;
    },
    action(player, stepId) {
      const event = { player, stepId };
      emit('npc-dialogue:action', event);
      return event;
    },
    condition(player, stepId, text = '') {
      const event = { player, stepId, text, pages };
      emit('npc-dialogue:condition', event);
      return event;
    },
    death(player, npc) { hooks.onNpcDeath[0]({ killer: player, npc }); },
    login(player) { (hooks.onPlayerLogin ?? []).forEach(handler => handler({ player })); },
    setStage(player, value) {
      quest.setStage(player, value);
      hooks.onPlayerLogin[0]({ player });
    },
    zone(player, handlerIndex = 0) { hooks.onZoneEnter[handlerIndex]({ player }); },
  };
}

function player() {
  const attributes = new Map(), items = new Map(), varbits = new Map(), messages = [], xp = new Map();
  let location = new core.Location(2570, 3276, 0), area = null;
  const songs = [], cameras = [], interfaces = [];
  let interfaceId = null;
  const packet = new Proxy({
    sendVarbit: (id, value) => { varbits.set(id, value); return packet; },
    sendConfig: () => packet,
    sendSong: id => { songs.push(id); return packet; },
    sendCameraMoveTo: (x, y, z) => { cameras.push(['move', x, y, z]); return packet; },
    sendCameraLookAt: (x, y, z) => { cameras.push(['look', x, y, z]); return packet; },
    sendCameraReset: () => { cameras.push(['reset']); return packet; },
    sendInterface: id => { interfaceId = id; interfaces.push(id); return packet; },
    sendInterfaceRemoval: () => { interfaceId = null; return packet; },
    sendInterfaceScript: () => packet,
  }, { get: (target, key) => target[key] ?? (() => packet) });
  const inventory = {
    getAmount: id => items.get(id) ?? 0,
    getFreeSlots: () => p.full ? 0 : 28,
    adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => {
      assert.ok((items.get(id) ?? 0) >= amount, `missing item ${id}`);
      items.set(id, (items.get(id) ?? 0) - amount);
    },
  };
  const p = {
    attributes, items, varbits, messages, xp, songs, cameras, interfaces,
    getInterfaceId: () => interfaceId,
    getAttribute: key => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => packet,
    getLocation: () => location,
    moveTo: value => { location = value; },
    getArea: () => area, setArea: value => { area = value; },
    isPlayer: () => true, isNpc: () => false, getIndex: () => 1, getAsPlayer: () => p,
    getDialogueManager: () => ({ isActive: () => false, reset: noop, startDialogues: noop }),
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement() { return this; } }),
    setUntargetable: noop,
    setEnteredAmountAction: action => { p.enterAction = action; },
    getEnteredAmountAction: () => p.enterAction,
    sendMessage: text => messages.push(text),
    isPlayerBot: () => false,
    getUsername: () => p.username ?? 'north-tester',
    getSkillManager: () => ({
      getMaxLevel: () => p.maxLevel ?? 99,
      getExperience: skill => xp.get(skill) ?? 0,
      addExperiences: (skill, amount) => xp.set(skill, (xp.get(skill) ?? 0) + amount),
    }),
  };
  return p;
}

function at(x, y, z = 0) { return new core.Location(x, y, z); }
function stage(h, p) { return h.quest.getStage(p); }
function variant(h) { return h.transcripts.at(-1)?.variant; }

function readyPlayer(h) {
  const p = player();
  h.completedQuests.add('making_friends_with_my_arm');
  h.completedQuests.add('devious_minds');
  h.completedQuests.add('hazeel_cult');
  return p;
}

function startQuest(h) {
  const p = readyPlayer(h);
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'a-death-in-the-family-talking-to-the-carnillean-guard');
  h.hook('npc-dialogue:hook', { player: p, hook: 'quest:secrets-of-the-north:start' });
  assert.equal(stage(h, p), 1);
  assert.equal(p.varbits.get(14769), 2);
  assert.equal(p.varbits.get(14739), 1);
  assert.equal(p.varbits.get(14740), 1);
  assert.match(p.messages.at(-1), /^You've started a new quest: .*Secrets of the North/);
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'a-death-in-the-family-talking-to-the-carnillean-guard-upstairs');
  assert.equal(stage(h, p), 2);
  return p;
}

test('start acceptance requires the listed quests and levels, and rejects an unqualified player', () => {
  const h = harness(), p = player();
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(h.transcripts.length, 0);
  assert.match(p.messages.at(-1), /^You do not meet all of the requirements to start the Secrets of the North quest\.$/);

  p.maxLevel = 68;
  h.completedQuests.add('making_friends_with_my_arm');
  h.completedQuests.add('devious_minds');
  h.completedQuests.add('hazeel_cult');
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(h.transcripts.length, 0);
  assert.equal(stage(h, p), 0);

  p.maxLevel = 99;
  p.username = 'qualified';
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'a-death-in-the-family-talking-to-the-carnillean-guard');
  h.hook('npc-dialogue:hook', { player: p, hook: 'quest:secrets-of-the-north:start' });
  assert.equal(stage(h, p), 1);
});

test('pre-quest family members use their real pre-quest transcripts', () => {
  const h = harness(), p = player();
  h.talk('Henryeta Carnillean', p, N.HENRYETA_CARNILLEAN);
  assert.equal(variant(h), 'pre-quest-talking-to-henryeta-carnillean');
  h.talk('Philipe Carnillean', p, N.PHILIPE_CARNILLEAN);
  assert.equal(variant(h), 'pre-quest-talking-to-philipe-carnillean');
  h.talk('Claus the Chef', p, N.CLAUS_THE_CHEF);
  assert.equal(variant(h), 'pre-quest-talking-to-claus-the-chef');
});

test('crime scene evidence needs all four finds and the third-find prompt is not premature', () => {
  const h = harness(), p = startQuest(h);
  const answerCondition = h.hooks.onNpcDialogueCondition[0];
  h.object(p, O.CERIL_CARNILLEAN, at(2564, 3268, 1));
  h.action(p, 'kSSea9');
  h.object(p, O.BROKEN_WINDOW, at(2569, 3268, 1));
  h.action(p, 'dEf_k3');
  const condition = { player: p, text: 'If this is the third piece of evidence observed:', pages };
  const replied = answerCondition(condition);
  assert.equal(replied, false, 'two pieces is not the third');
  assert.equal(p.attributes.get('secrets-of-the-north:evidence'), 3);

  h.object(p, O.WALL_169, at(2566, 3268, 1));
  h.action(p, 'HJ2S0x');
  assert.equal(answerCondition(condition), true, 'third piece');

  h.object(p, O.CHEST_161, at(2572, 3270, 2));
  h.action(p, 'iHp8Db');
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'a-death-in-the-family-talking-to-the-carnillean-guard-after-inspecting-the-crime-scene');
});

test('guard investigation explains the three findings and hands over the Evelot lead', () => {
  const h = harness(), p = startQuest(h);
  const findings = [
    [O.CERIL_CARNILLEAN, 'kSSea9'],
    [O.BROKEN_WINDOW, 'dEf_k3'],
    [O.WALL_169, 'HJ2S0x'],
    [O.CHEST_161, 'iHp8Db'],
  ];
  for (const [id, stepId] of findings) {
    h.object(p, id, at(2564, 3268, 1));
    h.action(p, stepId);
  }
  h.talk('Guard', p, N.GUARD_180);
  const condition = { player: p, text: 'If the player has gone through the three options:', pages };
  const answerCondition = h.hooks.onNpcDialogueCondition[0];
  assert.equal(answerCondition(condition), false);
  h.line(p, 'The window was broken from the outside.');
  h.line(p, 'Ceril was stabbed from behind.');
  h.line(p, 'A hidden room above us was broken into.');
  assert.equal(answerCondition(condition), true);
  h.action(p, 'w415Kw');
  assert.equal(stage(h, p), 3);
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'a-death-in-the-family-talking-to-the-carnillean-guard-after-he-mentions-the-bar');
});

test('barman bribe is paid once and cannot be paid without 100 coins', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 3);
  const answerCondition = h.hooks.onNpcDialogueCondition[0];
  assert.equal(answerCondition({ player: p, text: 'If the player has 100 coins:', pages }), false);
  p.items.set(I.COINS, 99);
  h.condition(p, '8h0Upv', 'If the player has 100 coins:');
  assert.equal(stage(h, p), 3);
  assert.equal(p.items.get(I.COINS), 99);
  p.items.set(I.COINS, 300);
  h.condition(p, '8h0Upv', 'If the player has 100 coins:');
  assert.equal(stage(h, p), 4);
  assert.equal(p.items.get(I.COINS), 200);
  h.action(p, '8Nhp3b');
  assert.match(p.messages.at(-1), /^You give 100 coins to the barman\.$/);
  h.talk('Khazard Barman', p, N.KHAZARD_BARMAN);
  assert.equal(variant(h), 'on-the-trail-talking-to-the-khazard-barman-after-giving-him-100-coins');
});

test('the six-step Evelot trail includes both bushes and only then spawns Evelot', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 4);
  const trail = [
    [O.BARRELS_8, 2568, 3152],
    [O.BOULDER_32, 2573, 3181],
    [O.BUSH_55, 2567, 3202],
    [O.TREE_STUMP_72, 2584, 3197],
    [O.BOULDER_34, 2605, 3188],
    [O.BUSH_55, 2621, 3193],
  ];
  for (const [id, x, y] of trail.slice(0, 5)) h.object(p, id, at(x, y));
  assert.equal(stage(h, p), 4, 'five finds is not the full trail');
  assert.equal(p.varbits.get(14733), 1);
  assert.equal(p.varbits.get(14737), 1);
  h.object(p, O.BUSH_55, at(2621, 3193));
  assert.equal(stage(h, p), 5);
  assert.equal(p.attributes.get('secrets-of-the-north:trail'), 63);
  assert.match(p.messages.at(-1), /^The bush has been disturbed recently. Someone came this way\.$/);
  for (const varbit of [14733, 14734, 14735, 14736, 14737, 14738]) {
    assert.equal(p.varbits.get(varbit), 0, `trail varbit ${varbit} cleared on completion`);
  }
  h.object(p, O.BUSH_55, at(2621, 3193));
  assert.match(p.messages.at(-1), /already searched/);
  assert.equal(stage(h, p), 5);
  assert.ok(h.npcs.some(n => n.id === N.EVELOT && !n.removed));
});

test('Evelot fight and death advance to the cult meeting, with interruption-safe stage', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 5);
  h.talk('Evelot', p, N.EVELOT);
  assert.equal(variant(h), 'on-the-trail-talking-to-evelot');
  h.action(p, 'ijqT1z');
  const evelot = h.npcs.find(n => n.id === N.EVELOT);
  assert.equal(evelot.attacked, p);
  h.death(p, evelot);
  assert.equal(stage(h, p), 6);
  assert.equal(variant(h), 'on-the-trail-talking-to-evelot-after-defeating-her');
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'on-the-trail-talking-to-the-carnillean-guard-after-the-conversation-with-evelot');
});

test('cult meeting spawns Hazeel only on the opposed side and advances through the guard', () => {
  const h = harness(), p = startQuest(h);
  p.attributes.set('quest.hazeel_cult.side', 0);
  h.setStage(p, 6);
  h.talk('Hazeel', p, N.HAZEEL_2);
  assert.equal(variant(h), 'on-the-trail-talking-to-hazeel-alomone');
  h.action(p, 'Ci5SW8');
  assert.equal(stage(h, p), 7);
  assert.ok(h.npcs.some(n => n.id === N.GENERAL_KHAZARD_2 && !n.removed));
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'the-mysterious-benefactor-talking-to-the-carnillean-guard');
  assert.equal(stage(h, p), 8);

  const helped = harness(), hp = startQuest(helped);
  hp.attributes.set('quest.hazeel_cult.side', 1);
  helped.setStage(hp, 6);
  helped.talk('Clivet', hp, N.CLIVET);
  assert.equal(variant(helped), 'on-the-trail-talking-to-hazeel-alomone');
  assert.equal(helped.npcs.some(n => n.id === N.HAZEEL_2 && !n.removed), false,
    'Hazeel must not be present before Alomone summons him');
  helped.action(hp, 'ZFwohZ');
  assert.ok(helped.npcs.some(n => n.id === N.HAZEEL_2 && !n.removed));
});

test('mansion follow-up: Claus kitchen spawn, shelves button, hidden door and scroll inspect', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 8);
  assert.ok(h.npcs.some(n => n.id === N.CLAUS_THE_CHEF && n.getLocation().getY() === 9699));
  h.talk('Claus the Chef', p, N.CLAUS_THE_CHEF);
  assert.equal(variant(h), 'the-mysterious-benefactor-talking-to-claus-the-chef');
  h.line(p, 'Well... I thought I saw this shadow in the room, just for a moment.');
  assert.equal(stage(h, p), 9);

  h.object(p, O.COOKING_SHELVES_11, at(2540, 9694));
  assert.equal(variant(h), 'the-mysterious-benefactor-searching-the-south-west-cooking-shelves');
  h.action(p, 'zJc3Yx');
  assert.equal(p.attributes.get('secrets-of-the-north:button'), true);

  // Wrong wall position before the button: no passage.
  h.setStage(p, 9);
  h.object(p, O.WALL_166, at(2544, 9698));
  assert.equal(variant(h), 'the-mysterious-benefactor-inspecting-the-wall-before-entering-the-hidden-room');
  h.action(p, '8QrPbp');
  assert.equal(stage(h, p), 10);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2535, 9620]);

  h.object(p, O.CHEST_162, at(2535, 9621));
  assert.equal(variant(h), 'the-mysterious-benefactor-picklocking-the-chest');
  h.action(p, 'z_T8BY');
  assert.equal(stage(h, p), 11);
  assert.equal(p.items.get(I.DUSTY_SCROLL_3), 1);
  // QH's Inspect step, not an automatic read:
  assert.notEqual(stage(h, p), 12);
  h.item(p, I.DUSTY_SCROLL_3, 'Inspect');
  assert.equal(stage(h, p), 12);
  assert.equal(variant(h), 'the-mysterious-benefactor-reading-the-scroll');

  h.talk('Hazeel', p, N.HAZEEL_2);
  assert.equal(variant(h), 'the-mysterious-benefactor-talking-to-hazeel-or-general-khazard-after-reading-the-dusty-scroll');
  h.action(p, 'tdT_B_');
  assert.equal(stage(h, p), 12);
  assert.equal(p.items.get(I.DUSTY_SCROLL_3) ?? 0, 0);
});

function loadMyArmHandler(modulePath, startTranscriptStub) {
  const found = {};
  const api = new Proxy({
    core: { ...core },
    persistAttribute: () => {},
    onCustomEvent: noop,
    emitCustomEvent: noop,
    onNpcInteraction: (name, actions) => { if (name === 'My Arm') found.myArm = actions; },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  // The shared plugin destructures startTranscript at require time, so install
  // the stub before loading it.
  const original = runtime.startTranscript;
  runtime.startTranscript = startTranscriptStub;
  try { require(modulePath)(api); } finally { runtime.startTranscript = original; }
  return found.myArm;
}

test('the shared My Arm handler yields to SOTN only during the Weiss step', () => {
  let started = 0;
  const handler = loadMyArmHandler('../plugins/quests/quests/MyArmsBigAdventure.Quest', () => { started++; return true; });
  assert.ok(handler?.['Talk-to'], 'My Arm handler registered');
  const attributes = new Map([
    ['quest.secrets_of_the_north.stage', 13],
    ['quest.my_arms_big_adventure.stage', 200],
  ]);
  const p = { getAttribute: key => attributes.get(key) ?? 0 };
  assert.equal(handler['Talk-to']({ player: p, npcId: N.MY_ARM_3 }), false,
    'SOTN stage 13 owns the Weiss My Arm');
  assert.equal(started, 0);
  attributes.set('quest.secrets_of_the_north.stage', 20);
  assert.equal(handler['Talk-to']({ player: p, npcId: N.MY_ARM_3 }), undefined,
    'outside the SOTN window My Arm\'s Big Adventure handles him');
  assert.equal(started, 1);
});

test('the captured Weiss My Arm is a real Talk-to speaker beside Snowflake', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 12);
  assert.ok(h.npcs.some(n => n.id === N.MY_ARM_3 && n.getLocation().getX() === 2874 && n.getLocation().getY() === 3934));
  assert.ok(h.npcs.some(n => n.id === N.SNOWFLAKE && n.getLocation().getX() === 2872 && n.getLocation().getY() === 3934));

  h.talk('My Arm', p, N.MY_ARM_3);
  assert.equal(variant(h), 'in-the-north-talking-to-my-arm-or-snowflake-before-contacting-the-mahjarrat');

  h.setStage(p, 13);
  h.talk('My Arm', p, N.MY_ARM_3);
  assert.equal(variant(h), 'in-the-north-talking-to-my-arm-or-snowflake');
  const text = JSON.stringify(dialogues[variant(h)]);
  assert.match(text, /"speaker":"My Arm"/, 'My Arm keeps his own head in the paired page');
  assert.match(text, /"speaker":"Snowflake"/, 'Snowflake keeps her own head');
  h.setStage(p, 14);
  h.talk('My Arm', p, N.MY_ARM_3);
  assert.equal(variant(h), 'in-the-north-talking-to-my-arm-or-snowflake-talking-to-my-arm-or-snowflake-again');
});

test('North information chain tracks both questions and advances only when both were asked', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 12);
  h.talk('Big Fish', p, N.BIG_FISH);
  assert.equal(variant(h), 'in-the-north-talking-to-big-fish-or-dead-wolf');
  h.line(p, 'Speak with their leader and find out if anything of note has occurred here recently.');
  assert.equal(stage(h, p), 13);

  h.talk('Snowflake', p, N.SNOWFLAKE);
  assert.equal(variant(h), 'in-the-north-talking-to-my-arm-or-snowflake');
  h.line(p, 'There was the cave-in recently down there as well.');
  assert.equal(stage(h, p), 14);

  h.talk('Big Fish', p, N.BIG_FISH);
  assert.equal(variant(h), 'in-the-north-talking-to-big-fish-or-dead-wolf-after-hearing-about-the-weirdness-in-the-mine');
  const asked = { player: p, text: 'If the player has asked both questions:', pages };
  const answerCondition = h.hooks.onNpcDialogueCondition[0];
  assert.equal(answerCondition(asked), false);
  h.line(p, 'Why would the killer come here?');
  assert.equal(answerCondition(asked), false);
  h.line(p, 'What is this ritual you keep talking about?');
  assert.equal(answerCondition(asked), true);
  h.action(p, 't1w8IH');
  assert.equal(stage(h, p), 15);
});

test('Weiss stairs and cave entrance are traversable in the mandatory route', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 15);
  // The throne-room stairs are the shared loc teleport to (2845,10351); entering
  // the salt-mine zone starts the captured cutscene.
  p.moveTo(at(2845, 10351));
  h.zone(p);
  assert.equal(variant(h), 'in-the-north-entering-the-salt-mine');
  h.object(p, O.CAVE_94, at(2845, 10332));
  assert.equal(variant(h), 'in-the-north-entering-the-salt-mine');
  h.action(p, 'qDWLCo');
  assert.equal(stage(h, p), 16);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2902, 10337]);
  assert.equal(p.varbits.get(6719), 2, 'minimap hidden in the cutscene');
  assert.equal(p.varbits.get(542), 1, 'cutscene_status set');
  assert.equal(p.songs.at(-1), 743, 'Secrets of the North theme');
  assert.ok(h.npcs.some(n => n.id === 12052 && n.getLocation().getX() === 2910), 'captured Hazeel actor');
  const khazardActor = h.npcs.find(n => n.id === 12057);
  assert.deepEqual([khazardActor.getLocation().getX(), khazardActor.getLocation().getY()], [2911, 10332]);
  h.tick(27);
  assert.equal(khazardActor.getLocation().getX(), 2912, 'Khazard starts the captured walk');
  h.tick(8);
  assert.deepEqual([khazardActor.getLocation().getX(), khazardActor.getLocation().getY()], [2920, 10334]);
  h.tick(1);
  assert.equal(khazardActor.removed, true, 'Khazard leaves the entrance scene');

  h.action(p, '2rSlND');
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2926, 10344]);
  assert.ok(h.npcs.some(n => n.id === N.ASSASSIN_5 && !n.removed), 'cutscene assassin 12061');
  h.tick(2);
  assert.equal(p.getArea(), null, 'control returns before the fight');
  assert.equal(p.varbits.get(542), 0);
  assert.equal(p.songs.at(-1), 744, 'In the Shadows');
  assert.equal(h.npcs.filter(n => n.id === N.ASSASSIN_5 && !n.removed).length, 0);
  const assassin = h.npcs.find(n => n.id === N.ASSASSIN_6);
  assert.equal(assassin.getLocation().getX(), 2927);
  assert.equal(assassin.getLocation().getY(), 10352);
  assert.deepEqual([assassin.faced.getX(), assassin.faced.getY()], [2927, 10357]);
  assert.ok(h.npcs.some(n => n.id === 12052 && n.getLocation().getX() === 2902), 'Hazeel waits west');
  assert.ok(h.npcs.some(n => n.id === 12058 && n.getLocation().getY() === 10347), 'Khazard waits by the fight room');
});

test('assassin death, Hazeel report and dungeon progress are recoverable', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 16);
  h.action(p, '2rSlND');
  const assassin = h.npcs.find(n => n.id === N.ASSASSIN_6);
  const khazard = h.npcs.find(n => n.id === N.GENERAL_KHAZARD_9 && !n.removed);
  h.death(p, assassin);
  assert.equal(stage(h, p), 17);
  assert.equal(khazard.transformed, 12055);
  assert.equal(variant(h), 'in-the-north-defeating-the-assassin');
  h.talk('Hazeel', p, N.HAZEEL_2);
  assert.equal(variant(h), 'in-the-north-talking-to-hazeel-after-defeating-the-assassin');
  h.line(p, 'This assassin must be found.');
  assert.equal(stage(h, p), 18);
});

test('dungeon codes open with their real gate ids, without optional lore items', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 18);
  h.object(p, O.GATE_248, at(2916, 10338));
  assert.equal(stage(h, p), 18, 'the gate asks for data');
  assert.ok(p.interfaces.includes(810), 'direction gate opens cache interface 810');
  p.enterAction.execute(1790);
  assert.equal(stage(h, p), 18, 'a wrong direction leaves it locked');
  h.object(p, O.GATE_248, at(2916, 10338));
  p.enterAction.execute(1794);
  assert.equal(stage(h, p), 19);

  h.object(p, O.GATE_249, at(2924, 10329));
  assert.ok(p.interfaces.includes(809), 'BLOOD gate opens cache interface 809');
  p.enterAction.execute(359471);
  assert.equal(stage(h, p), 19, 'a wrong word leaves it locked');
  h.object(p, O.GATE_249, at(2924, 10329));
  p.enterAction.execute(359470);
  assert.equal(stage(h, p), 24);

  h.object(p, O.GATE_250, at(2918, 10321));
  assert.match(p.messages.at(-1), /keyhole/);
  assert.equal(stage(h, p), 24);
});

test('lever handle from the barrel works without the optional strange list', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 18);
  h.object(p, O.BARREL_167, at(2923, 10322));
  assert.equal(p.items.get(I.LEVER_HANDLE), 1);
  h.itemOnObject(p, I.LEVER_HANDLE, O.LEVER_MECHANISM, at(2917, 10342));
  assert.equal(stage(h, p), 21);
  assert.equal(p.items.get(I.LEVER_HANDLE) ?? 0, 0);
  assert.equal(p.varbits.get(14753), 1);
  assert.ok(h.objects.some(object => object.getId() === O.LEVER_64 && object.getLocation().getX() === 2917));
  h.object(p, O.LEVER_64, at(2917, 10342));
  assert.equal(stage(h, p), 22);
  assert.equal(p.varbits.get(14753), 2);
  assert.match(p.messages.at(-1), /^As you pull the lever, you hear a strange click coming from the north east\.$/);
  h.object(p, O.PILLAR_103, at(2924, 10346));
  assert.equal(stage(h, p), 23);
  assert.equal(p.items.get(I.JEWEL_SHARD), 1);
  assert.equal(p.items.get(I.STRANGE_CIPHER), 1);
});

test('braziers enforce NW, SE, NE, SW and a wrong order resets', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 24);
  p.items.set(I.TINDERBOX, 1);
  const tiles = [[2916, 10331], [2922, 10325], [2922, 10331], [2916, 10325]];
  h.itemOnObject(p, I.TINDERBOX, O.BRAZIER_26, at(...tiles[1]));
  assert.equal(p.attributes.get('secrets-of-the-north:braziers'), 0);
  assert.match(p.messages.at(-1), /specific order/);
  for (const tile of tiles) h.itemOnObject(p, I.TINDERBOX, O.BRAZIER_26, at(...tile));
  assert.equal(stage(h, p), 25);
  assert.equal(p.varbits.get(14758), 1);
  for (const varbit of [14754, 14755, 14756, 14757]) assert.equal(p.varbits.get(varbit), 0);
});

test('the prison chest chain requires no optional clue items and yields the icy key once', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 25);
  p.items.set(I.JEWEL_SHARD, 1); // the pillar shard from the arranged checkpoint
  h.object(p, O.CHEST_168, at(2916, 10327));
  assert.equal(stage(h, p), 26);
  h.itemOnItem(p, I.JEWEL_SHARD, I.JEWEL_SHARD_2);
  assert.equal(stage(h, p), 27);
  assert.equal(p.items.get(I.ANCIENT_JEWEL), 1);
  h.object(p, O.CHEST_169, at(2919, 10331));
  assert.equal(stage(h, p), 27, 'the 7402 chest opens the four-dial lock');
  assert.ok(p.interfaces.includes(809));
  p.enterAction.execute(74020);
  assert.equal(stage(h, p), 27, 'a wrong code leaves it locked');
  h.object(p, O.CHEST_169, at(2919, 10331));
  p.enterAction.execute(740200);
  assert.equal(stage(h, p), 28, '7402 opens without settlements note/ancient map');
  h.itemOnItem(p, I.ANCIENT_JEWEL, I.ICY_CHEST);
  assert.equal(stage(h, p), 29);
  assert.equal(p.items.get(I.ICY_KEY), 1);
  h.object(p, O.GATE_250, at(2918, 10321));
  assert.equal(stage(h, p), 30);
});

test('creature entrance uses the east crevice; the west crevice is the dungeon exit', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 18);
  h.object(p, O.CREVICE_40, at(2908, 10316));
  assert.match(p.messages.at(-1), /too narrow/);
  h.setStage(p, 30);
  h.object(p, O.CREVICE_40, at(2908, 10316));
  assert.equal(variant(h), 'more-mahjarrat-more-problems-upon-entering-the-strange-creature-room');
  h.action(p, 'HWDQ6d');
  assert.equal(stage(h, p), 31);
  assert.equal(p.songs.at(-1), 742, 'More Than Meets the Eye');
  const creature = h.npcs.find(n => n.id === N.STRANGE_CREATURE_3);
  assert.equal(creature.attacked, p);
  h.setStage(p, 31);
  h.object(p, O.CREVICE_39, at(2901, 10338));
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2867, 3940]);
});

test('interrupted creature cutscene still allows the guard to finish, rewards once only', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 31);
  h.action(p, 'HWDQ6d');
  const creature = h.npcs.find(n => n.id === N.STRANGE_CREATURE_3);
  h.death(p, creature);
  assert.equal(stage(h, p), 32, 'stage advances even if the cutscene is interrupted');
  assert.equal(variant(h), 'more-mahjarrat-more-problems-defeating-the-creature');
  // The captured lair exit appears at (2860,4258) and returns to the dungeon.
  assert.equal(p.songs.at(-1), 743);
  assert.equal(p.varbits.get(6719), 2);
  h.object(p, O.CREVICE_41, at(2860, 4258));
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2908, 10317]);
  // And the guard can still finish the quest.
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'more-mahjarrat-more-problems-talking-to-the-guard');
  h.action(p, 'uUYIAn');
  assert.equal(stage(h, p), 34);
  assert.equal(p.attributes.get('quest.points'), 2);
  assert.equal(p.xp.get(Skill.AGILITY), 60000);
  h.action(p, 'uUYIAn');
  assert.equal(p.xp.get(Skill.AGILITY), 60000, 'completion rewards are not repeated');
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'post-quest-talking-to-the-guard-post-quest');
});

test('accepted Hazeel teleport lands in Ardougne and the guard still completes the quest', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 32);
  h.talk('Hazeel', p, N.HAZEEL_2);
  assert.equal(variant(h), 'more-mahjarrat-more-problems-talking-to-hazeel-or-general-khazard-after-declining-the-teleport');
  h.action(p, 'kQnPVV');
  assert.equal(stage(h, p), 33);
  assert.equal(p.varbits.get(14745), 1);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2570, 3276]);
  h.talk('Guard', p, N.GUARD_180);
  assert.equal(variant(h), 'more-mahjarrat-more-problems-talking-to-the-guard');
  h.action(p, 'uUYIAn');
  assert.equal(stage(h, p), 34);
});

test('every internal stage maps onto the captured native boundary and survives relog', () => {
  const h = harness(), p = player();
  const expected = [0, 2, 6, 14, 18, 24, 28, 36, 38, 40, 44, 48, 50, 56, 58, 62, 66, 68, 72, 74, 74, 74, 74, 74, 74, 74, 74, 74, 74, 76, 78, 80, 82, 88, 90];
  expected.forEach((varbit, stage) => {
    p.varbits.clear();
    h.quest.setStage(p, stage);
    assert.equal(p.varbits.get(14722), varbit, `stage ${stage}`);
  });

  // An old save keeps its internal stage and is re-sent as the matching native
  // varbit on login (the puzzle sub-steps all store 74).
  p.setAttribute('quest.secrets_of_the_north.stage', 25);
  p.varbits.clear();
  runtime.sendQuestVarps({ player: p });
  assert.equal(stage(h, p), 25);
  assert.equal(p.varbits.get(14722), 74);
  p.setAttribute('quest.secrets_of_the_north.stage', 12);
  p.varbits.clear();
  runtime.sendQuestVarps({ player: p });
  assert.equal(stage(h, p), 12);
  assert.equal(p.varbits.get(14722), 50);
});

test('the captured lair cutscene spawns its actors, camera and music, then returns to the dungeon', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 31);
  h.action(p, 'HWDQ6d');
  const creature = h.npcs.find(n => n.id === N.STRANGE_CREATURE_3);
  h.death(p, creature);

  // Captured lair vision: Jhallan 12064, exit 46598, theme 743, controls held.
  assert.equal(stage(h, p), 32);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2845, 4257]);
  assert.equal(p.songs.at(-1), 743);
  assert.equal(p.varbits.get(6719), 2);
  assert.equal(p.varbits.get(542), 1);
  assert.ok(h.npcs.some(n => n.id === N.JHALLAN && n.getLocation().getX() === 2846));
  assert.ok(h.objects.some(o => o.getId() === O.CREVICE_41 && o.getLocation().getX() === 2860));

  // Assassin appears: captured positions, camera move/look and the vision actors.
  h.action(p, '-gmPXV');
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2853, 4259]);
  assert.ok(h.npcs.some(n => n.id === N.JHALLAN_2 && n.getLocation().getX() === 2849));
  assert.ok(h.npcs.some(n => n.id === N.ASSASSIN_5 && n.getLocation().getX() === 2856));
  assert.deepEqual(p.cameras.slice(-2), [['move', 2853, 4251, 510], ['look', 2853, 4266, 310]]);
  assert.ok(h.objects.some(o => o.getId() === O.CREVICE_43 && o.getLocation().getX() === 2860));

  h.action(p, '1jsvX1');
  assert.equal(h.npcs.filter(n => (n.id === N.JHALLAN_2 || n.id === N.ASSASSIN_5) && !n.removed).length, 0);

  // Back in the dungeon: captured spot and camera, control restored.
  h.action(p, '0QH9r5');
  assert.equal(p.getArea(), null);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2927, 10344]);
  assert.deepEqual(p.cameras.slice(-2), [['move', 2927, 10341, 494], ['look', 2927, 10358, 294]]);
  h.action(p, 'BsyVHb');
  assert.ok(h.npcs.some(n => n.id === N.HAZEEL_4 && n.getLocation().getX() === 2925));
  assert.ok(h.npcs.some(n => n.id === N.GENERAL_KHAZARD_9 && n.getLocation().getX() === 2928));
});

test('relogging during the lair cutscene recovers in the dungeon with the final pair', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 31);
  h.action(p, 'HWDQ6d');
  h.death(p, h.npcs.find(n => n.id === N.STRANGE_CREATURE_3));
  assert.equal(p.getArea() !== null, true);
  h.login(p);
  assert.equal(p.getArea(), null);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2927, 10344]);
  assert.ok(h.npcs.some(n => n.id === N.HAZEEL_4 && !n.removed));
  assert.ok(h.npcs.some(n => n.id === N.GENERAL_KHAZARD_9 && !n.removed));
  assert.equal(p.cameras.at(-1)[0], 'reset');
});

test('rev-241 hidden-room route: false wall claim reaches the ladder landing and chest', async () => {
  const path = require('node:path');
  const { CachePipeline } = require('../dist/game/cache/CachePipeline');
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
  const { ObjectDefinition } = require('../dist/game/definition/ObjectDefinition');
  const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');
  await CachePipeline.initialize(path.resolve('.'));
  RegionManager.init();
  RegionManager.loadMapFiles(2572, 3270);

  const approach = new core.Location(2572, 3270, 1);
  const landing = new core.Location(2572, 3271, 2);
  const chestTile = new core.Location(2572, 3270, 2);
  const ladder = MapObjects.get(16683, new core.Location(2573, 3271, 1), null);
  assert.ok(ladder, 'cache ladder 16683 exists at the captured tile');
  const stand = location => ({ getLocation: () => location, getSize: () => 1, getPrivateArea: () => null });
  const stairsUp = MapObjects.get(46704, new core.Location(2568, 3268, 0), null);
  const stairsDown = MapObjects.get(46705, new core.Location(2568, 3268, 1), null);
  assert.ok(stairsUp && stairsDown, 'mansion staircase pair exists');
  const stairApproach = new core.Location(2568, 3271, 0);
  assert.equal(RegionManager.blocked(stairApproach, null), false, 'stair approach walkable');
  const upDef = ObjectDefinition.forId(46704);
  assert.equal(PathFinder.reachedObject(stand(stairApproach), 2568, 3268, upDef.getSizeX(), upDef.getSizeY(),
    stairsUp.getFace(), stairsUp.getType(), upDef.getBlockingMask()), true, 'up staircase reachable from its approach');
  assert.equal(RegionManager.blocked(new core.Location(2570, 3268, 1), null), false, 'z1 staircase landing walkable');
  assert.equal(RegionManager.blocked(approach, null), false, 'false-wall standing tile walkable');
  assert.equal(RegionManager.blocked(landing, null), false, 'z2 ladder landing walkable');
  assert.equal(RegionManager.blocked(chestTile, null), false, 'hidden chest tile walkable');
  const ladderDef = ObjectDefinition.forId(16683);
  assert.equal(PathFinder.reachedObject(stand(approach), 2573, 3271, ladderDef.getSizeX(), ladderDef.getSizeY(),
    ladder.getFace(), ladder.getType(), ladderDef.getBlockingMask()), false,
  'plain reach is blocked, so the route/claim is required');
  const chestDef = ObjectDefinition.forId(46572);
  assert.equal(PathFinder.reachedObject(stand(landing), 2572, 3270, 1, 1, 0, 10, chestDef.getBlockingMask()),
    true, 'landing reaches the hidden chest');

  assert.match(JSON.stringify(dialogues['a-death-in-the-family-knocking-at-the-false-wall']), /"Yes\."/,
    'shipped transcript carries the Push-against-the-wall Yes choice');
  const h = harness(), p = startQuest(h);
  assert.deepEqual(h.persisted.find(([key]) => key === 'secrets-of-the-north:hidden-passage'), ['secrets-of-the-north:hidden-passage', false]);
  assert.deepEqual(h.persisted.find(([key]) => key === 'secrets-of-the-north:explained'), ['secrets-of-the-north:explained', 0]);
  assert.deepEqual(h.persisted.find(([key]) => key === 'secrets-of-the-north:questions'), ['secrets-of-the-north:questions', 0]);
  assert.ok(h.events['npc-dialogue:choice']?.length, 'actual choice dispatch handler registered');
  h.setStage(p, 2);
  p.moveTo(approach);
  const route = { player: p, objectId: 16683 };
  h.hooks.onObjectRoute[0](route);
  assert.deepEqual(route.destination, { x: 2572, y: 3270, z: 1 });

  // The ladder is closed until the real false-wall "Yes." choice.
  let request = { player: p, objectId: 16683, handled: false };
  h.emit('ladders:climb', request);
  assert.equal(request.handled, true);
  assert.match(p.messages.at(-1), /wall is still closed/);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2572, 3270, 1]);

  assert.ok(falseWallMessage, 'shipped false-wall page carries a message step');
  h.object(p, O.WALL_169, approach);
  h.emit('npc-dialogue:action', {
    player: p, stepId: falseWallMessage.id, kind: 'message', text: falseWallMessage.text,
  });
  h.emit('npc-dialogue:choice', { player: p, option: 'Yes.' });
  assert.equal(p.attributes.get('secrets-of-the-north:hidden-passage'), true);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2572, 3270, 1]);

  request = { player: p, objectId: 16683, handled: false };
  h.emit('ladders:climb', request);
  assert.equal(request.handled, true);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2572, 3271, 2]);

  // Down ladder returns to the false-wall approach; the base wall is untouched.
  request = { player: p, objectId: 16679, handled: false };
  h.emit('ladders:climb', request);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2572, 3269, 1]);
  assert.ok(MapObjects.get(46902, approach, null), 'global false wall stays for other players');

  // A relog on the secret-door tile recovers into the room, not inside the wall.
  p.moveTo(new core.Location(2572, 3270, 1));
  h.login(p);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2572, 3269, 1]);
});

test('per-player false-wall tokens: concurrent Yes, canceled page and stale Yes', () => {
  const h = harness();
  const a = player(), b = player(), c = player();
  for (const p of [a, b, c]) {
    h.setStage(p, 2);
    p.moveTo(at(2572, 3269, 1));
  }
  const wallAction = p => h.emit('npc-dialogue:action', {
    player: p, stepId: falseWallMessage.id, kind: 'message', text: falseWallMessage.text,
  });

  // A and B both open the real false-wall page; their choices are independent.
  h.object(a, O.WALL_169, at(2572, 3270, 1));
  wallAction(a);
  h.object(b, O.WALL_169, at(2572, 3270, 1));
  wallAction(b);
  h.emit('npc-dialogue:choice', { player: a, option: 'Yes.' });
  assert.equal(a.attributes.get('secrets-of-the-north:hidden-passage'), true);
  assert.deepEqual([a.getLocation().getX(), a.getLocation().getY(), a.getLocation().getZ()], [2572, 3270, 1]);
  assert.equal(b.attributes.get('secrets-of-the-north:hidden-passage'), undefined, "A's Yes did not open B");
  h.emit('npc-dialogue:choice', { player: b, option: 'Yes.' });
  assert.equal(b.attributes.get('secrets-of-the-north:hidden-passage'), true);

  // A canceled/wrong dialogue after the wall line consumes the token.
  h.object(c, O.WALL_169, at(2572, 3270, 1));
  wallAction(c);
  h.line(c, 'Are you done looking around the crime scene?');
  h.emit('npc-dialogue:choice', { player: c, option: 'Yes.' });
  assert.equal(c.attributes.get('secrets-of-the-north:hidden-passage'), undefined);
  assert.notDeepEqual([c.getLocation().getX(), c.getLocation().getY(), c.getLocation().getZ()], [2572, 3270, 1]);

  // Closing the dialogue also clears it; an unrelated Yes near the house does nothing.
  h.object(c, O.WALL_169, at(2572, 3270, 1));
  wallAction(c);
  h.emit('interface:closed', { player: c, interfaceId: 217 });
  h.emit('npc-dialogue:choice', { player: c, option: 'Yes.' });
  assert.equal(c.attributes.get('secrets-of-the-north:hidden-passage'), undefined);
  h.emit('npc-dialogue:choice', { player: c, option: 'Yes.' });
  assert.equal(c.attributes.get('secrets-of-the-north:hidden-passage'), undefined);
});

test('real NpcDialogues: false-wall message action arms Yes/No through the actual DialogueManager', async () => {
  const path = require('node:path');
  const { CachePipeline } = require('../dist/game/cache/CachePipeline');
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
  const { ObjectDefinition } = require('../dist/game/definition/ObjectDefinition');
  const { Player } = require('../dist/game/entity/impl/player/Player');
  const { GameObject } = require('../dist/game/entity/impl/object/GameObject');
  const { MultiChatboxPrompt } = require('../dist/game/model/menu/MultiChatboxPrompt');
  const { PluginManager: PM } = require('../dist/plugins/PluginManager');
  const { TaskManager } = require('../dist/game/task/TaskManager');
  const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');
  await CachePipeline.initialize(path.resolve('.'));
  RegionManager.init();
  new NpcDefinitionLoader().load();

  const api = PM.createApi('remaining-north-real-dialogues');
  require('../plugins/npcs/NpcDialogues.plugin').register(api);
  require('../plugins/quests/quests/SecretsOfTheNorth.Quest')(api);
  require('../plugins/objects/Ladders.plugin').register(api);
  const north = runtime.getRegisteredQuests().filter(q => q.key === 'secrets_of_the_north').at(-1);

  function account() {
    const p = new Player(null);
    const sender = new Proxy({}, {
      get: (target, key) => {
        if (key === 'getVarbit') return () => 0;
        if (key === 'isSubInterfaceOpen') return () => false;
        if (key === 'isChatboxInterface') return () => true;
        if (key === 'closeInterruptibleInterfaces') return () => {};
        return () => sender;
      },
    });
    p.getPacketSender = () => sender;
    p.moveTo(new core.Location(2572, 3269, 1));
    p.setNeedsPlacement(false);
    north.setStage(p, 2);
    return p;
  }

  function emitObject(p, id, x, y, z) {
    const object = new GameObject(id, new core.Location(x, y, z), 10, 0, null);
    PM.emitObjectInteraction({
      player: p, object, objectId: id, definition: ObjectDefinition.forId(id),
      clickType: 1, location: object.getLocation(), handled: false,
    });
  }

  function openFalseWall(p) {
    emitObject(p, 46707, 2572, 3270, 1);
    assert.ok(p.getDialogueManager().isActive() || MultiChatboxPrompt.getPending(p), 'real NpcDialogues started');
  }

  function tickTasks(times = 2) {
    for (let i = 0; i < times; i++) TaskManager.process();
  }

  function reachOptions(p) {
    for (let i = 0; i < 100; i++) {
      const pending = MultiChatboxPrompt.getPending(p);
      if (pending) return pending;
      const current = p.getDialogueManager().getCurrent();
      if (!current) break;
      if (!p.getDialogueManager().handleResume(231 << 16 | 5, 1)) break;
    }
    throw new Error('false-wall options did not open');
  }

  function choose(p, text) {
    const pending = reachOptions(p);
    const index = pending.options.indexOf(text);
    assert.ok(index >= 0, `missing "${text}" in ${pending.options.join(' | ')}`);
    assert.equal(MultiChatboxPrompt.handleInterfaceActionClick({
      player: p, buttonId: MultiChatboxPrompt.OPTIONS_WIDGET_ID, groupId: 219,
      slot: index + 1, action: index + 1,
    }), true);
  }

  const yes = account();
  openFalseWall(yes);
  choose(yes, 'Yes.');
  assert.equal(yes.getAttribute('secrets-of-the-north:hidden-passage'), true);
  assert.deepEqual([yes.getLocation().getX(), yes.getLocation().getY(), yes.getLocation().getZ()], [2572, 3270, 1]);

  // Real ladder up to the walkable z2 landing, then the chest from that landing.
  emitObject(yes, 16683, 2573, 3271, 1);
  tickTasks();
  assert.deepEqual([yes.getLocation().getX(), yes.getLocation().getY(), yes.getLocation().getZ()], [2572, 3271, 2]);
  assert.equal(RegionManager.blocked(new core.Location(2572, 3271, 2), null), false, 'real z2 landing walkable');
  const chestDef = ObjectDefinition.forId(46572);
  const landingStand = { getLocation: () => yes.getLocation(), getSize: () => 1, getPrivateArea: () => null };
  assert.equal(PathFinder.reachedObject(landingStand, 2572, 3270, 1, 1, 0, 10, chestDef.getBlockingMask()),
    true, 'real landing reaches the hidden chest');
  emitObject(yes, 46572, 2572, 3270, 2);
  assert.equal((yes.getAttribute('secrets-of-the-north:evidence') ?? 0) & 8, 8, 'real chest message marked evidence');

  // Leave, then the persistent passage still lets the real wall page re-enter.
  emitObject(yes, 16679, 2573, 3271, 2);
  tickTasks();
  assert.deepEqual([yes.getLocation().getX(), yes.getLocation().getY(), yes.getLocation().getZ()], [2572, 3269, 1]);
  openFalseWall(yes);
  choose(yes, 'Yes.');
  assert.deepEqual([yes.getLocation().getX(), yes.getLocation().getY(), yes.getLocation().getZ()], [2572, 3270, 1],
    'already-true passage re-enters on a later real Yes');
  emitObject(yes, 16683, 2573, 3271, 1);
  tickTasks();
  assert.deepEqual([yes.getLocation().getX(), yes.getLocation().getY(), yes.getLocation().getZ()], [2572, 3271, 2],
    'real ladder works after re-entry');
  emitObject(yes, 46572, 2572, 3270, 2);
  assert.equal((yes.getAttribute('secrets-of-the-north:evidence') ?? 0) & 8, 8);

  // Simulate an already-true saved flag after relog.
  const after = account();
  after.setAttribute('secrets-of-the-north:hidden-passage', true);
  openFalseWall(after);
  choose(after, 'Yes.');
  assert.deepEqual([after.getLocation().getX(), after.getLocation().getY(), after.getLocation().getZ()], [2572, 3270, 1]);

  const no = account();
  openFalseWall(no);
  choose(no, 'No.');
  assert.notEqual(no.getAttribute('secrets-of-the-north:hidden-passage'), true);
  assert.deepEqual([no.getLocation().getX(), no.getLocation().getY(), no.getLocation().getZ()], [2572, 3269, 1]);

  const stale = account();
  openFalseWall(stale);
  reachOptions(stale);
  stale.getDialogueManager().reset();
  assert.notEqual(stale.getAttribute('secrets-of-the-north:hidden-passage'), true,
    'closing the real page leaves the passage shut');
  assert.deepEqual([stale.getLocation().getX(), stale.getLocation().getY(), stale.getLocation().getZ()], [2572, 3269, 1]);
});

test('Secrets North6 cult travel: real cave 2852 lands at the raft and boards to the hideout', async () => {
  const path = require('node:path');
  const { CachePipeline } = require('../dist/game/cache/CachePipeline');
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { Player } = require('../dist/game/entity/impl/player/Player');
  const { GameObject } = require('../dist/game/entity/impl/object/GameObject');
  const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
  const { ObjectDefinition } = require('../dist/game/definition/ObjectDefinition');
  const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');
  const { PluginManager: PM } = require('../dist/plugins/PluginManager');
  let cacheActive = true;
  try { CachePipeline.getActive(); } catch { cacheActive = false; }
  if (!cacheActive) await CachePipeline.initialize(path.resolve('.'));
  const sewerRegion = RegionManager.regionIdForTile(2570, 9682);
  if (!RegionManager.getRegionid(sewerRegion)) RegionManager.init();
  // A prior test may have left a region mid-load; clear the transient guard so
  // this real-cache regression can assert the actual loaded map.
  RegionManager.loadingRegions?.clear?.();
  const regionId = sewerRegion;
  RegionManager.loadMapFiles(2570, 9682, true);
  assert.ok(RegionManager.getRegionid(regionId)?.isLoaded(), 'real sewer map region loaded');
  assert.ok(MapObjects.get(2852, new core.Location(2585, 3233, 0), null), 'raw cave 2852 exists');
  const raft = MapObjects.get(2849, new core.Location(2567, 9679, 0), null);
  assert.ok(raft, 'raw raft 2849 exists');

  const api = PM.createApi('remaining-north-hazeel-route');
  require('../plugins/quests/quests/HazeelCult.Quest')(api);
  const hazeel = runtime.getRegisteredQuests().filter(q => q.key === 'hazeel_cult').at(-1);
  const p = new Player(null);
  const sender = new Proxy({}, { get: () => () => sender });
  p.getPacketSender = () => sender;
  p.moveTo(new core.Location(2587, 3237, 0));
  p.setNeedsPlacement(false);
  hazeel.setStage(p, 4); // chosen side; raft gate

  const click = (id, x, y) => {
    const object = new GameObject(id, new core.Location(x, y, 0), 10, 0, null);
    PM.emitObjectInteraction({
      player: p, object, objectId: id, definition: ObjectDefinition.forId(id),
      clickType: 1, location: object.getLocation(), handled: false,
    });
  };

  // Valve clicks are handler-level state setup, before the cave; they are not
  // a movement-route assertion. The route proof below starts at the landing.
  for (const [id, x, y] of [
    [2844, 2562, 3247], [2845, 2572, 3263], [2846, 2585, 3245],
    [2847, 2597, 3263], [2848, 2611, 3242],
  ]) click(id, x, y);
  assert.equal(Number(p.getAttribute('quest.hazeel_cult.valves')), 31, 'all five valves open');

  click(2852, 2585, 3233); // cave entrance
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2570, 9682, 0],
    'cave landing is beside the raft (capture 1694 tick [6564])');

  const standTile = new core.Location(2567, 9680, 0);
  assert.equal(RegionManager.blocked(standTile, null), false, 'raft approach tile walkable');
  const route = PathFinder.rsmodRouteFinding.findRoute({
    level: 0, srcX: 2570, srcY: 9682, srcSize: 1,
    destX: standTile.getX(), destY: standTile.getY(), destWidth: 1, destLength: 1,
    locShape: -1, privateArea: null, moveNear: false,
  });
  assert.equal(route.success, true, 'RSMOD exact route to raft approach succeeds');
  assert.deepEqual([route.endX, route.endY], [2567, 9680], 'RSMOD endpoint is the raft-adjacent tile');
  const raftDef = ObjectDefinition.forId(2849);
  assert.equal(PathFinder.reachedObject({
    getLocation: () => standTile, getSize: () => 1, getPrivateArea: () => null,
  }, 2567, 9679, raftDef.getSizeX(), raftDef.getSizeY(), raft.getFace(), raft.getType(), raftDef.getBlockingMask()),
  true, 'approach tile legally reaches the raw raft');

  click(2849, 2567, 9679); // raft Board
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2606, 9692, 0],
    'raft lands at the cult hideout');
});

test('login re-installs the exact SOTN objects at their real tiles', () => {
  const h = harness(), p = player();
  h.login(p);
  const placements = new Map(h.objects.map(object =>
    [`${object.getId()}@${object.getLocation().getX()},${object.getLocation().getY()},${object.getLocation().getZ()}`, object]));
  for (const key of [
    '46590@2544,9698,0', '46590@2533,9617,0', '46592@2535,9621,0',
    '46564@2573,3269,1', '46569@2575,3268,1', '46707@2572,3270,1', '46572@2572,3270,2',
    '46601@2916,10338,0', '46602@2924,10329,0', '46603@2918,10321,0',
    '46584@2621,3193,0', '46608@2916,10329,0', '46839@2845,10332,0', '46598@2860,4258,0',
  ]) assert.ok(placements.has(key), `missing placement ${key}`);
  // The second bush is the same object id at a different tile.
  assert.ok(h.objects.some(object => object.getId() === O.BUSH_55 && object.getLocation().getX() === 2567));
});

test('relogin while on the trail keeps progress and respawns the route NPCs', () => {
  const h = harness(), p = startQuest(h);
  h.setStage(p, 4);
  h.object(p, O.BARRELS_8, at(2568, 3152));
  h.setStage(p, 5);
  assert.ok(h.npcs.some(n => n.id === N.EVELOT && !n.removed));
  h.login(p);
  assert.ok(h.npcs.some(n => n.id === N.EVELOT && !n.removed));
  assert.equal(stage(h, p), 5);
});
