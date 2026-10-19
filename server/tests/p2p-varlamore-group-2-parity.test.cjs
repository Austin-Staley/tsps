// From server/: node --test tests/p2p-varlamore-group-2-parity.test.cjs (after yarn build).
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
const I = core.ItemIdentifiers, N = core.NpcIdentifiers;
let nextIndex = 1;
const noop = () => {};
before(async () => { await CachePipeline.initialize(path.resolve(__dirname, '..')); new NpcDefinitionLoader().load(); });

function harness(name) {
  const hooks = {}, events = {}, tasks = [], areas = [], npcs = [], removed = [], objects = [], ground = [], clicks = new Map(), buttons = new Map(), namedNpcs = new Map(), namedObjects = new Map(), itemActions = new Map();
  const objectManager = {register: object => objects.push(object), deregister: object => { const i=objects.indexOf(object); if(i>=0)objects.splice(i,1); }};
  const taskManager = {
    submit(task) { task.setRunning(true); tasks.push(task); },
    cancelTasks(key) { tasks.filter(task => task.key === key).forEach(task => task.stop()); },
  };
  const api = new Proxy({ core: { ...core, World: { ...core.World, getNpcsNear: () => npcs }, TaskManager: taskManager,
    MultiChatboxPrompt: { getPending: p => p.prompt }, ObjectManager: { register: object => objects.push(object), deregister: noop } },
    getTaskManager: () => taskManager,
    onNpcsInteraction: (names, actions) => names.forEach(name => namedNpcs.set(name, actions)),
    onItemAction: (name, actions) => itemActions.set(name, actions),
    registerArea: area => areas.push(area),
    getObjectManager: () => objectManager,
    getItemOnGroundManager: () => ({ registerLocation: (...args) => ground.push(args) }),
    onInterfaceActionButton: (ids, fn) => [].concat(ids).forEach(id => { const callbacks=buttons.get(id) ?? []; callbacks.push(fn); buttons.set(id,callbacks); }),
    onObjectClick: (ids, click, fn) => [].concat(ids).forEach(id => clicks.set(id, fn)),
    onNpcInteraction: (name, actions) => namedNpcs.set(name, actions),
    onObjectInteraction: (name, actions) => { if (typeof name === 'function') (hooks.onObjectInteraction ??= []).push(name); else namedObjects.set(name, actions); },
    onObjectFirstClick: (ids, fn) => [].concat(ids).forEach(id => clicks.set(id, fn)),
    persistAttribute: noop,
    onCustomEvent: (key, fn) => (events[key] ??= []).push(fn),
    emitCustomEvent: (key, event) => (events[key] ?? []).forEach(fn => fn(event)),
    sendMultiChatboxPrompt(p, title, ...pairs) { p.prompt = { title, options: pairs.filter((_, i) => i % 2 === 0), pairs }; return true; },
    spawnNpc(definition) {
      let location = new core.Location(definition.x, definition.y, definition.z), area = null;
      const npc = { ...definition, animations: [], graphics: [], getId: () => definition.id, getIndex: () => npc.index,
        index: nextIndex++, setForceMovement: movement => {p.forceMovement=movement;}, getLocation: () => location, moveTo: to => { location = to; },
        getArea: () => area, setArea: value => { area = value; }, isNpc: () => true, isPlayer: () => false, getAsNpc: () => npc,
        isRegistered: () => !npc.removed, setPositionToFace: noop, forceChat: text => { npc.said = text; },
        performAnimation: animation => npc.animations.push(animation.getId()), performGraphic: graphic => npc.graphics.push(graphic.id),
        getMovementQueue: () => ({ reset() { return this; }, addSteps: to => { npc.walkingTo = to; } }),
        exactMove: (to, options) => { npc.exact = options; location = to; },
        setFollowing: target => { npc.following = target; }, setMobileInteraction: noop, setNpcTransformationId: noop,
        setPet: noop, setOwner: noop, getOwner: () => definition.owner,
        setCombatXpMultiplier: value => { npc.multiplier = value; },
        getCombat: () => ({ attack: player => { npc.target = player; } }),
      }; npcs.push(npc); return npc;
    }, removeNpc: npc => { npc.removed = true; removed.push(npc); },
  }, { get: (target, key) => target[key] ?? ((...args) => (hooks[key] ??= []).push(args.find(x => typeof x === 'function'))) });
  require(`../plugins/quests/quests/${name}.Quest`)(api);
  PluginManager.emitNpcDialogueCondition = event => {
    for (const fn of hooks.onNpcDialogueCondition ?? []) { const answer = fn(event); if (answer !== null && answer !== undefined) return answer; }
    return null;
  };
  const h = { api, hooks, events, tasks, areas, npcs, removed, objects, ground, clicks, buttons, namedNpcs, namedObjects, itemActions, quest: runtime.getRegisteredQuests().at(-1),
    emit: (name, event) => (events[name] ?? []).forEach(fn => fn(event)),
    line(p, npcId, text) { const event = { player: p, npcId, text }; h.emit('npc-dialogue:line', event); return event; },
    action(p, npcId, stepId) { const event = { player: p, npcId, stepId }; h.emit('npc-dialogue:action', event); return event; },
    talk(p, npcId) { const choice = (hooks.onNpcDialogueVariant ?? []).map(fn => fn({ player: p, npcId })).find(Boolean); assert.ok(choice); runtime.startTranscript(api, p, npcId, typeof choice === 'string' ? h.quest.name : choice.page, typeof choice === 'string' ? choice : choice.variant); },
    tick(count) { while (count-- > 0) [...tasks].forEach(task => task.tick()); },
    choose(p, text) { const prompt = p.prompt; assert.ok(prompt, `no menu for ${text}`); const index = prompt.options.findIndex(label => label === text); assert.ok(index >= 0, `missing ${text} in ${prompt.options}`); p.prompt = null; prompt.pairs[index * 2 + 1](); },
    continueUntil(p, predicate, limit = 80) { while (!predicate()) { assert.ok(limit-- > 0, `dialogue stalled at ${p.text}`); assert.ok(p.manager.getCurrent(), `dialogue ended at ${p.text}`); p.manager.advance(); } },
  }; return h;
}
function player() {
  const attrs = new Map(), items = new Map(), configs = new Map(), varbits = new Map(), log = [], xp = [];
  let location = new core.Location(3210, 3220, 0), area = null;
  const inv = { getAmount: id => items.get(id) ?? 0, isFull: () => Boolean(p.full), getFreeSlots: () => p.full ? 0 : 28, contains: id => (items.get(id)??0)>0,
    adds(id, amount) { items.set(id, (items.get(id) ?? 0) + amount); },
    deleteNumber(id, amount) { assert.ok((items.get(id) ?? 0) >= amount); items.set(id, items.get(id) - amount); },
  };
  const packet = new Proxy({
    sendConfig(id, value) { configs.set(id, value); return packet; }, sendVarbit(id, value) { varbits.set(id, value); return packet; },
    sendString(text, uid) { if ([6,3,2].some(child => [217,231,229,193].some(group => uid === (group << 16 | child)))) p.text = text; log.push(['text',uid,text]); return packet; },
    sendInterfaceRemoval() { p.manager.reset(); p.prompt = null; return packet; },
  }, { get: (t, key) => t[key] ?? ((...args) => { log.push([key, ...args]); return packet; }) });
  const p = { setEnteredAmountAction: action => { p.amountAction = action; }, attrs, items, configs, varbits, log, xp, messages: [], animations: [], prompt: null, text: '', index: nextIndex++,
    getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value), getInventory: () => inv,
    getBanks: () => [{ getAmount: id => p.bank?.get(id) ?? 0 }], getEquipment: () => ({ get: () => p.amulet ? { getId: () => p.amulet } : null }),
    getSession: () => ({ sendClientPacket: frame => { log.push(['frame',Buffer.from(frame)]); return true; } }), getPacketSender: () => packet, getDialogueManager: () => p.manager, getUpdateFlag: () => ({ flag: noop }),
    getSkillManager: () => ({ addExperiences: (skill, amount) => xp.push([skill.getIndex(),amount]), getCombatLevel: () => p.combat ?? 3, getCurrentLevel: () => p.magic ?? 99, getMaxLevel: () => p.level ?? 99 }),
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement(value) { p.blocked = value; return this; }, addSteps(to) { location = to; return this; }, isBlockMovement: () => Boolean(p.blocked) }),
    setUntargetable: value => { p.untargetable = value; }, setForceMovement: movement => {p.forceMovement=movement;}, getLocation: () => location, moveTo: to => { location = to; },
    getArea: () => area, getPrivateArea: () => area, setArea: value => { area = value; }, getIndex: () => p.index,
    isPlayer: () => true, isNpc: () => false, getAsPlayer: () => p, isRegistered: () => true,
    getCombat: () => ({getHitQueue:()=>({addPendingDamage: damage=>{p.damage=damage;}})}),
    getUsername: () => 'Parity', getAppearance: () => ({ isMale: () => true }), setPositionToFace: noop, forceChat: noop,
    performAnimation: a => p.animations.push(a.getId()), sendMessage: text => p.messages.push(text),
  }; p.manager = new DialogueManager(p); return p;
}
const continueToMenu = (h,p) => h.continueUntil(p, () => Boolean(p.prompt));

// ---------------------------------------------------------------------------
// Ethically Acquired Antiquities (RSProx 1695, ticks 7114-7934)
// ---------------------------------------------------------------------------
const EAA_STAGE = 'quest.ethically_acquired_antiquities.stage';
const at = (p, x, y) => p.moveTo(new core.Location(x, y, 0));
function eaa() {
  const h = harness('EthicallyAcquiredAntiquities'), p = player();
  (h.events['quest:is-complete'] ??= []).push(event => { if (['children_of_the_sun', 'shield_of_arrav', 'one_small_favour'].includes(event.key)) event.complete = true; });
  return { h, p };
}
const talkName = (h, p, name, npcId) => h.namedNpcs.get(name)['Talk-to']({ player: p, npcId, npc: null });

test('EAA starts from the display notice, then Herminius, the tools and the display move it through 2, 4 and 6 as captured', () => {
  const { h, p } = eaa(); at(p, 1720, 3165);
  h.namedObjects.get('Empty display').Inspect({ player: p, definition: { id: core.ObjectIdentifiers.EMPTY_DISPLAY_5 } });
  assert.ok(p.log.some(row => row[0] === 'sendInterface' && row[1] === 873));
  const notice = p.log.find(row => row[0] === 'sendClientScript' && row[1] === 5006);
  assert.equal(notice[2], "Xerna's Diadem"); assert.equal(notice[3], 53130);
  h.tick(3); assert.equal(p.text, '');
  h.tick(1); assert.match(p.text, /somewhat of an expert/);
  continueToMenu(h, p); h.choose(p, 'Yes.'); assert.equal(h.quest.getStage(p), 2);
  assert.ok(p.messages.includes("You've started a new quest: <col=081190>Ethically Acquired Antiquities</col>"));
  p.manager.reset();
  h.talk(p, N.CURATOR_HERMINIUS); continueToMenu(h, p); h.choose(p, 'Could you tell me more about that empty display?');
  h.continueUntil(p, () => p.text.startsWith('I was starting to consider')); assert.equal(h.quest.getStage(p), 2);
  p.manager.advance(); assert.match(p.text, /^Perhaps you'll have better luck/); assert.equal(h.quest.getStage(p), 4);
  h.continueUntil(p, () => !p.manager.getCurrent());
  h.namedObjects.get('Tools').Investigate({ player: p, definition: { id: core.ObjectIdentifiers.TOOLS_13 } });
  assert.equal(p.varbits.get(11195), 1); assert.match(p.text, /specialist tools/);
  assert.ok(p.log.some(row => row.includes(29908)), 'the tools box shows the eaa_tools model');
  p.manager.advance();
  h.namedObjects.get('Empty display').Inspect({ player: p, definition: { id: core.ObjectIdentifiers.EMPTY_DISPLAY_5 } });
  assert.equal(p.varbits.get(11194), 1); assert.match(p.text, /tampered/); assert.equal(h.quest.getStage(p), 4);
  p.manager.advance(); assert.match(p.text, /find much more just lying/); assert.equal(h.quest.getStage(p), 6);
});

test('EAA visitors: any museum Citizen/Tourist/Academic answers by kind; the informant alone moves the quest to 8', () => {
  const { h, p } = eaa(); at(p, 1712, 3162); h.quest.setStage(p, 6); p.attrs.set('quest.ethically_acquired_antiquities.informant', 'citizen');
  talkName(h, p, 'Tourist', N.TOURIST); assert.equal(p.text, 'Hello there.'); p.manager.advance(); assert.equal(p.text, 'Hi! Can I help you?');
  h.continueUntil(p, () => /^(No, I don't think so|Oh\.\.\. Sorry)/.test(p.text));
  assert.equal(p.varbits.get(11197), 1); assert.equal(h.quest.getStage(p), 6);
  h.continueUntil(p, () => !p.manager.getCurrent());
  talkName(h, p, 'Citizen', 13200); p.manager.advance(); assert.equal(p.text, 'Nilsal! Can I help you?');
  h.continueUntil(p, () => p.text.startsWith('You did?')); assert.equal(h.quest.getStage(p), 6);
  p.manager.advance(); assert.match(p.text, /towards the quetzal landing site/); assert.equal(h.quest.getStage(p), 8); assert.equal(p.varbits.get(11196), 1);
  at(p, 1690, 3160); h.quest.setStage(p, 6); p.manager.reset();
  assert.equal(talkName(h, p, 'Citizen', 13200), false, 'outside the Grand Museum visitors are ordinary');
});

test('EAA charter crews and Artima follow the capture: favour flag, sails boxes, timed stitching, Port Sarim Trader Stan', () => {
  const { h, p } = eaa(); h.quest.setStage(p, 8);
  h.talk(p, N.REGULUS_CENTO_3); continueToMenu(h, p); h.choose(p, 'Have you seen anybody suspicious around?');
  h.continueUntil(p, () => p.text.startsWith('He asked if he could')); assert.equal(h.quest.getStage(p), 8);
  p.manager.advance(); assert.match(p.text, /towards the Cothon/); assert.equal(h.quest.getStage(p), 10);
  h.continueUntil(p, () => !p.manager.getCurrent());
  at(p, 1741, 3135);
  assert.equal(talkName(h, p, 'Trader Crewmember', 9371), true); continueToMenu(h, p); h.choose(p, 'Have you seen a man with a case?');
  h.continueUntil(p, () => p.text.startsWith('Although, we could use a hand')); assert.equal(p.varbits.get(11200), 1);
  continueToMenu(h, p); h.choose(p, 'As long as it is just the one favour...');
  h.continueUntil(p, () => /tattered sails/.test(p.text)); assert.equal(h.quest.getStage(p), 12); assert.equal(p.items.get(I.TATTERED_SAILS), 1);
  assert.ok(p.log.some(row => row.includes(I.TATTERED_SAILS)));
  p.manager.reset(); at(p, 1767, 3103);
  const artima = { performAnimation: a => (artima.animations ??= []).push(a.getId()) };
  const choice = (h.hooks.onNpcDialogueVariant ?? []).map(fn => fn({ player: p, npcId: N.ARTIMA })).find(Boolean);
  h.events['npc-dialogue:line'].unshift(event => { event.npc = artima; });
  runtime.startTranscript(h.api, p, N.ARTIMA, h.quest.name, choice);
  continueToMenu(h, p); h.choose(p, 'I was hoping for some help.');
  h.continueUntil(p, () => p.text.startsWith('Oh, in that case')); assert.equal(p.varbits.get(11201), 1);
  continueToMenu(h, p); h.choose(p, 'Go on then.');
  h.continueUntil(p, () => p.text === 'Here you go.'); assert.equal(p.items.get(I.TATTERED_SAILS), 1);
  p.manager.advance(); assert.match(p.text, /^Let's see/); assert.equal(p.items.get(I.TATTERED_SAILS), 0);
  assert.deepEqual(artima.animations, [10794]);
  h.tick(3); assert.match(p.text, /^Let's see/); h.tick(1); assert.match(p.text, /^Grab some of that/);
  h.tick(4); assert.match(p.text, /^Tie off/); assert.equal(p.items.get(I.SAILS) ?? 0, 0);
  h.tick(4); assert.match(p.text, /^There we have it/); assert.equal(p.items.get(I.SAILS), 1); assert.equal(p.varbits.get(11205), 1);
  assert.deepEqual(artima.animations, [10794, 10794, 10794]);
  h.events['npc-dialogue:line'].shift(); p.manager.reset(); at(p, 1738, 3137);
  talkName(h, p, 'Trader Crewmember', 9371); continueToMenu(h, p); h.choose(p, 'So, about that man with the case.');
  h.continueUntil(p, () => /newly fixed sails/.test(p.text)); assert.equal(h.quest.getStage(p), 14); assert.equal(p.items.get(I.SAILS), 0);
  h.continueUntil(p, () => p.text.startsWith('Well, we explained')); assert.equal(h.quest.getStage(p), 16);
  p.manager.reset(); at(p, 3039, 3193);
  talkName(h, p, 'Trader Stan', N.TRADER_STAN); assert.equal(p.text, 'Can I help you?');
  assert.ok(p.log.some(row => row[0] === 'text' && row[2] === 'Trader Stan'), 'Trader Stan keeps his own name and head');
  continueToMenu(h, p); h.choose(p, 'Have you seen a grey-haired man with a case?');
  h.continueUntil(p, () => p.text.startsWith('Wandered up north')); assert.equal(h.quest.getStage(p), 18);
});

test("EAA Betty's notes open interface 291 and the Varrock storeroom runs pickpocket, pass-through door and crate as captured", () => {
  const { h, p } = eaa(); h.quest.setStage(p, 18);
  h.talk(p, N.BETTY); continueToMenu(h, p); h.choose(p, 'Have you seen a grey-haired man with a case?');
  h.continueUntil(p, () => p.text.startsWith('I did take some notes')); assert.equal(h.quest.getStage(p), 20);
  h.continueUntil(p, () => /Betty hands you the notes/.test(p.text)); assert.equal(p.items.get(I.BETTYS_NOTES), 1);
  assert.equal(p.varbits.get(11206), 1); assert.notEqual(p.varbits.get(11202), 1, 'the capture never sets betty_told_about_note');
  p.manager.reset();
  h.itemActions.get("Betty's notes").Read({ player: p, itemId: I.BETTYS_NOTES });
  assert.equal(h.quest.getStage(p), 22);
  assert.ok(p.log.some(row => row[0] === 'sendInterface' && row[1] === 291));
  assert.ok(p.log.some(row => row[0] === 'text' && row[1] === ((291 << 16) | 8) && row[2] === 'One that lets me travel, but not fight.'));
  h.emit('interface:closed', { player: p, interfaceId: 291 }); assert.equal(p.text, 'What could this mean?');
  p.manager.reset(); at(p, 3258, 3449);
  const haig = h.namedNpcs.get('Curator Haig Halen');
  haig['Talk-to']({ player: p, npcId: N.CURATOR_HAIG_HALEN }); continueToMenu(h, p); h.choose(p, "I'm looking for Xerna's Diadem.");
  h.continueUntil(p, () => p.text.startsWith('What awful news')); assert.equal(h.quest.getStage(p), 24);
  h.continueUntil(p, () => !p.manager.getCurrent());
  haig.Pickpocket({ player: p, npcId: N.CURATOR_HAIG_HALEN }); assert.equal(p.items.get(I.STOREROOM_KEY_3), 1);
  assert.deepEqual(p.animations, [881]); assert.match(p.text, /steal a key/); assert.equal(h.quest.getStage(p), 24, 'pickpocketing does not advance the stage');
  p.manager.reset();
  const door = { getLocation: () => new core.Location(3266, 3456, 0), getType: () => 0, getFace: () => 3 };
  at(p, 3266, 3455); h.emit('door:toggle', { player: p, object: door, objectId: core.ObjectIdentifiers.DOOR_746 });
  assert.ok(p.messages.includes('You use the key to unlock the door.'));
  h.namedObjects.get('Crate').Search({ player: p, definition: { id: core.ObjectIdentifiers.CRATE_340 } });
  assert.equal(h.quest.getStage(p), 28); assert.match(p.text, /find Xerna's Diadem/); assert.ok(p.log.some(row => row.includes(29907)));
  assert.notEqual(p.varbits.get(11207), 1, 'the display stays empty until after completion');
});

// The Wiki's "increase shame" options.
const SHAMING = new Set([
  "A real historian would never steal!",
  "Are you even a real historian, or just a petty criminal?",
  "Aren't you embarrassed to have stolen items in your collection?",
  "Did you know Varlamore sends thieves to the Colosseum?",
  "Do you really think you did the right thing?",
  "Do your colleagues know what you've done? What do they think?",
  "Hand that artefact back this instant!",
  "How will Varlamorians learn their history now?",
  "How would you feel if someone came in here and stole all your stuff?",
  "I guess you were just in it for the glory, were you?",
  "I thought archaeology was cool. I didn't realise it was just thieving!",
  "If you're looking for stolen goods, I can get my hands on plenty.",
  "Is everything here stolen from other museums?",
  "Just give it back already!",
  "Look me in the eye and tell me you did the right thing.",
  "Nobody wants to see stolen goods on display!",
  "So can anyone just go around stealing and call it archaeology?",
  "Stealing is against the law!",
  "Stealing is stealing, no matter how you try to justify it.",
  "Think of the Varlamorian children who won't get to see this artefact.",
  "This is stealing! Thieving! Taking what's not yours!",
  "Varlamore might close their lands again after this.",
  "Varlamore might never let you and your colleagues visit again!",
  "You can't justify theft by saying it's for preservation.",
  "You could have damaged the artefact!",
  "You ought to be ashamed.",
  "You should give Varlamore a chance before stealing their stuff.",
  "You're a disgrace to your entire profession!",
  "You're a loose cannon.",
  "You're hoarding artefacts, but you should be sharing them!",
  "You're not above the law! You stole this stuff!",
  "You're setting a terrible example.",
  "You're supposed to protect history, not steal it!",
  "You've betrayed the trust of Varlamore.",
  "You've committed a crime.",
]);
function confront(h, p) {
  at(p, 3256, 3447); h.quest.setStage(p, 28);
  h.namedNpcs.get('Curator Haig Halen')['Talk-to']({ player: p, npcId: N.CURATOR_HAIG_HALEN });
  continueToMenu(h, p); h.choose(p, "I found Xerna's Diadem...");
  h.continueUntil(p, () => p.text === 'Ah...'); p.manager.advance();
}
const shameOf = p => p.varbits.get(11199);
const lastTurn = p => p.log.findLast(row => row[0] === 'sendCameraRotateBy')?.slice(1);

test('EAA interrogation: private museum, Haig actor, meter at 50, captured -4/+4 opening, three-option rounds and speaker turns', () => {
  const { h, p } = eaa(); confront(h, p);
  assert.equal(p.blocked, true); assert.equal(p.varbits.get(542), 1); assert.equal(p.varbits.get(6719), 2);
  h.tick(2); assert.equal(p.getLocation().getX(), 3258); assert.equal(p.getLocation().getY(), 3449); assert.ok(p.getArea());
  const actor = h.npcs.find(npc => npc.id === N.CURATOR_HAIG_HALEN_2); assert.ok(actor); assert.deepEqual([actor.x, actor.y], [3256, 3449]);
  h.tick(1); assert.deepEqual(p.log.findLast(row => row[0] === 'sendCameraLookAt').slice(1), [3256, 3449, 220, { rate: 232, rate2: 100 }]);
  h.tick(3); assert.equal(shameOf(p), 50); assert.match(p.text, /^So you found the diadem/);
  h.continueUntil(p, () => p.text === "I don't know what you're talking about!"); assert.equal(h.quest.getStage(p), 30);
  p.manager.advance(); assert.ok(p.log.some(row => row[0] === 'sendSubInterface' && row[2] === 881));
  p.manager.advance(); assert.match(p.text, /^Steal\?!/); assert.equal(shameOf(p), 46); assert.deepEqual(lastTurn(p), [0, 1024, 5, 'linear']);
  p.manager.advance(); assert.deepEqual(lastTurn(p), [0, -1024, 5, 'linear']);
  p.manager.advance(); assert.match(p.text, /^They'd understand/); assert.equal(shameOf(p), 50); assert.deepEqual(lastTurn(p), [0, 1024, 5, 'linear']);
  p.manager.advance(); assert.ok(p.prompt); assert.deepEqual(lastTurn(p), [0, -1024, 5, 'linear'], 'the menu turns back to the player');
  const seen = new Set();
  for (let round = 0; round < 30 && h.quest.getStage(p) === 30; round++) {
    if (!p.prompt) { p.manager.advance(); continue; }
    assert.equal(p.prompt.options.length, 3);
    const menu = p.prompt.options.join('|'); assert.ok(!seen.has(menu), 'each group of three appears once'); seen.add(menu);
    const before = shameOf(p), pick = p.prompt.options.find(option => SHAMING.has(option));
    assert.ok(pick, `every captured menu offers a shaming option: ${menu}`);
    h.choose(p, pick); p.manager.advance();
    const rise = shameOf(p) - before; assert.ok(rise >= 4 && rise <= 9 || shameOf(p) === 100, `rise ${rise}`);
    p.manager.advance();
  }
  assert.equal(shameOf(p), 100); assert.equal(h.quest.getStage(p), 32);
  assert.match(p.text, /^You can't just keep claiming/); assert.ok(p.log.some(row => row[0] === 'closeSubInterface' && row[1] === ((161 << 16) | 1)));
  p.manager.advance(); assert.match(p.text, /^I didn't steal anything!/);
  assert.deepEqual(p.log.findLast(row => row[0] === 'sendCameraLookAt').slice(1), [3256, 3449, 220, { rate: 232, rate2: 100 }]);
});

test('EAA flashback replays the Grand Museum scene and returns to Haig; the hand-off sets 36 and Herminius completes at 38', () => {
  const { h, p } = eaa(); p.items.set(I.BETTYS_NOTES, 1); confront(h, p); h.tick(6);
  for (let step = 0; step < 200 && h.quest.getStage(p) < 32; step++) {
    if (p.prompt) h.choose(p, p.prompt.options.find(option => SHAMING.has(option))); else p.manager.advance();
  }
  h.continueUntil(p, () => p.text === 'Well...'); p.manager.advance(); h.tick(2);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1712, 3167]);
  const haig = h.npcs.findLast(npc => npc.id === N.CURATOR_HAIG_HALEN_2 && !npc.removed), thief = h.npcs.find(npc => npc.id === N.THIEF_18);
  assert.deepEqual([haig.x, haig.y, thief.x, thief.y], [1704, 3165, 1720, 3164]);
  assert.ok(h.npcs.filter(npc => npc.id === N.CURATOR_HAIG_HALEN_2).every(npc => npc === haig || npc.removed), 'the confrontation actor is gone');
  h.tick(4); assert.match(p.text, /^Naturally/); assert.deepEqual(haig.animations, [857]);
  p.manager.advance(); p.manager.advance(); assert.match(p.text, /^All of a sudden/); p.manager.advance();
  assert.deepEqual([haig.walkingTo.getX(), thief.walkingTo.getX()], [1710, 1714]);
  h.tick(1); assert.deepEqual(p.log.findLast(row => row[0] === 'sendCameraMoveTo').slice(1), [1712, 3160, 300, { cycles: 210, easing: 'ease_out_sine', ignoreTerrain: true }]);
  h.tick(6); assert.match(p.text, /^It was a thief!/); p.manager.advance(); p.manager.advance();
  h.tick(4); assert.deepEqual(haig.animations, [857, 11736, 11737, 11736]); assert.deepEqual(thief.animations, [11738, 9101]);
  h.tick(1); assert.match(p.text, /^He went down easily/); p.manager.advance(); p.manager.advance();
  assert.deepEqual(haig.animations.at(-1), 827);
  h.tick(4); assert.equal(h.quest.getStage(p), 34); h.tick(2);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3258, 3447]); assert.equal(p.getArea(), null);
  assert.equal(p.blocked, false); assert.equal(p.varbits.get(542), 0); assert.ok(h.npcs.filter(npc => npc.id >= 13816).every(npc => npc.removed));
  h.tick(4); assert.equal(p.text, "Now I don't know what to do...");
  h.continueUntil(p, () => p.text.startsWith('Okay...')); assert.equal(h.quest.getStage(p), 36);
  h.continueUntil(p, () => !p.manager.getCurrent());
  at(p, 1712, 3162); h.talk(p, N.CURATOR_HERMINIUS); continueToMenu(h, p); h.choose(p, 'About that empty display...');
  h.continueUntil(p, () => h.quest.isComplete(p));
  assert.equal(h.quest.getStage(p), 38); assert.deepEqual(p.xp, [[core.Skill.THIEVING.getIndex(), 6000]]);
  assert.equal(p.items.get(I.COINS), 5000); assert.equal(p.items.get(I.BETTYS_NOTES), 0);
  assert.ok(p.messages.includes("Congratulations, you've completed a quest: <col=081190>Ethically Acquired Antiquities</col>"));
  h.tick(63); assert.notEqual(p.varbits.get(11207), 1); h.tick(1); assert.equal(p.varbits.get(11207), 1);
});

test('EAA failed interrogation and logout both return the player to Haig with controls back; talking again starts over', () => {
  const { h, p } = eaa(); confront(h, p); h.tick(6);
  for (let step = 0; step < 200 && shameOf(p) > 0; step++) {
    if (p.prompt) h.choose(p, p.prompt.options.find(option => !SHAMING.has(option)) ?? p.prompt.options[0]); else p.manager.advance();
  }
  h.continueUntil(p, () => p.text.startsWith('Oh, pish posh!')); p.manager.advance(); h.tick(2);
  assert.equal(h.quest.getStage(p), 30); assert.equal(p.getArea(), null); assert.equal(p.blocked, false);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3258, 3447]);
  p.manager.reset(); h.namedNpcs.get('Curator Haig Halen')['Talk-to']({ player: p, npcId: N.CURATOR_HAIG_HALEN });
  continueToMenu(h, p); assert.ok(p.prompt.options.includes("I found Xerna's Diadem..."));
  const q = eaa(); confront(q.h, q.p); q.h.tick(6); q.p.manager.advance();
  q.h.hooks.onPlayerLogout[0]({ player: q.p });
  assert.equal(q.p.blocked, false); assert.equal(q.p.getArea(), null); assert.deepEqual([q.p.getLocation().getX(), q.p.getLocation().getY()], [3258, 3447]);
  const cameras = q.p.log.length; q.h.tick(20); assert.equal(q.p.log.filter(row => String(row[0]).startsWith('sendCamera')).length, q.p.log.slice(0, cameras).filter(row => String(row[0]).startsWith('sendCamera')).length);
});

test('EAA closing the scene dialogue (Escape) brings the line or menu back instead of stranding the player', () => {
  const { h, p } = eaa(); confront(h, p); h.tick(6);
  assert.match(p.text, /^So you found/); p.manager.reset(); p.text = ''; h.tick(1); assert.match(p.text, /^So you found/);
  for (let step = 0; step < 20 && !p.prompt; step++) p.manager.advance();
  const menu = p.prompt.options; p.prompt = null; h.tick(1); assert.deepEqual(p.prompt.options, menu);
});

// ---------------------------------------------------------------------------
// Meat and Greet (RSProx 1695, ticks 7980-8789)
// ---------------------------------------------------------------------------
function mag() {
  const h = harness('MeatAndGreet'), p = player();
  (h.events['quest:is-complete'] ??= []).push(event => { if (event.key === 'children_of_the_sun') event.complete = true; });
  p.attrs.set('meat-and-greet:stage-version', 1);
  return { h, p };
}
const talkMag = (h, p, name, npcId, npc = null) => h.namedNpcs.get(name)['Talk-to']({ player: p, npcId, npc });
const hp = (npc, current, max) => { npc.getHitpoints = () => current; npc.getMaxHitpoints = () => max; };

test('MAG starts at 2, sets the deliveries at 4 and the spice box keypad takes the captured code', () => {
  const { h, p } = mag();
  talkMag(h, p, 'Emelio', N.EMELIO); continueToMenu(h, p); h.choose(p, 'Yes.');
  assert.equal(h.quest.getStage(p), 2); assert.ok(p.messages.includes("You've started a new quest: <col=081190>Meat and Greet</col>"));
  h.continueUntil(p, () => p.text.startsWith("Okay, I guess I can go see")); assert.equal(h.quest.getStage(p), 4);
  assert.equal(p.varbits.get(11183), 1); assert.equal(p.varbits.get(11184), 1);
  h.continueUntil(p, () => !p.manager.getCurrent());
  talkMag(h, p, 'Spice Merchant', N.SPICE_MERCHANT); continueToMenu(h, p); h.choose(p, "I'm here about a missing delivery.");
  h.continueUntil(p, () => p.text === 'Sure thing!'); assert.equal(p.varbits.get(11183), 2);
  p.manager.advance(); h.tick(1);
  assert.ok(p.log.some(row => row[0] === 'sendInterface' && row[1] === 888));
  assert.deepEqual(p.log.find(row => row[0] === 'sendClientScript' && row[1] === 7374).slice(2), [(888 << 16) | 6, (888 << 16) | 5, 2, 5, 4, 6, 2]);
  p.amountAction.execute(1234); assert.equal(p.varbits.get(11183), 2);
  talkMag(h, p, 'Spice Merchant', N.SPICE_MERCHANT); continueToMenu(h, p); h.choose(p, 'Could I have a look at that locked box?');
  h.continueUntil(p, () => p.text === 'Sure thing!'); p.manager.advance(); h.tick(1);
  p.amountAction.execute(2546); assert.equal(p.varbits.get(11183), 3); assert.match(p.text, /You unlock the box/);
  p.manager.advance(); assert.match(p.text, /^Kuani! You did it/); assert.equal(p.varbits.get(11183), 4); assert.equal(h.quest.getStage(p), 4);
});

test('MAG wolf den: private den with the alpha, one pack call, the exit opening on the kill, and Alba sorting the meat (stage 6)', () => {
  const { h, p } = mag(); h.quest.setStage(p, 4); p.attrs.set('meat-and-greet:vars', 4 << 7 | 1 << 11);
  talkMag(h, p, 'Alba', N.ALBA); h.continueUntil(p, () => p.text.startsWith("Okay, I'll head over there")); assert.equal(p.varbits.get(11184), 2);
  h.continueUntil(p, () => !p.manager.getCurrent());
  at(p, 1497, 3130); h.namedObjects.get('Wolf Den').Enter({ player: p });
  assert.deepEqual(p.animations, [11580]); assert.equal(p.blocked, true);
  h.tick(2); assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [1486, 9502, 1]);
  const alpha = h.npcs.find(npc => npc.id === N.DIRE_WOLF_ALPHA); assert.deepEqual([alpha.x, alpha.y, alpha.z], [1477, 9501, 1]);
  const exitFrame = () => p.log.filter(row => row[0] === 'sendObject' && row[1].getId() === 54691).at(-1)?.[1];
  assert.equal(exitFrame().getOpFlags(), 0, 'no way out while the alpha lives');
  h.tick(1); assert.equal(p.blocked, false); h.tick(1); assert.equal(alpha.said, 'Grrr!');
  const resolved = target => h.hooks.onCombatHitResolved[0]({ target, attacker: p, hit: {} });
  hp(alpha, 70, 100); resolved(alpha); assert.equal(h.npcs.some(npc => npc.id === 13813), false);
  hp(alpha, 66, 100); resolved(alpha);
  const pack = h.npcs.find(npc => npc.id === 13813); assert.ok(pack); assert.equal(pack.target, p); assert.equal(alpha.said, 'Aarrooooo!');
  assert.ok(p.messages.includes('<col=e00a19>The dire wolf calls to its pack!'));
  hp(alpha, 30, 100); resolved(alpha); assert.equal(h.npcs.filter(npc => npc.id === 13813).length, 1, 'one call');
  h.namedObjects.get('Cave').Exit({ player: p }); assert.equal(p.getLocation().getZ(), 1, 'the exit stays shut');
  hp(alpha, 0, 100); resolved(alpha); assert.equal(p.varbits.get(11184), 3); assert.equal(exitFrame().getOpFlags(), 1);
  assert.equal(pack.said, 'Aarrooooo!'); h.tick(3); assert.equal(pack.removed, true);
  h.namedObjects.get('Cave').Exit({ player: p }); h.tick(2);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [1499, 3130, 0]); assert.equal(p.getArea(), null);
  h.tick(1); assert.equal(p.blocked, false);
  talkMag(h, p, 'Alba', N.ALBA); h.continueUntil(p, () => p.text.startsWith('Kuani! Thank you so much'));
  assert.equal(p.varbits.get(11184), 4); assert.equal(h.quest.getStage(p), 6);
});

test('MAG recipe: Emelio sends the player to the connoisseurs (8), native portion menus, test kebab, Renata loves 4/2/1/3 (10)', () => {
  const { h, p } = mag(); h.quest.setStage(p, 6); p.attrs.set('meat-and-greet:vars', 4 << 7 | 4 << 11);
  talkMag(h, p, 'Emelio', N.EMELIO); h.continueUntil(p, () => p.text.startsWith('Head on out there')); assert.equal(h.quest.getStage(p), 8);
  h.continueUntil(p, () => !p.manager.getCurrent());
  talkMag(h, p, 'Emelio', N.EMELIO); continueToMenu(h, p); h.choose(p, 'I think so.');
  assert.equal(p.text, 'I think so.'); p.manager.advance();
  assert.match(p.text, /one portion each of meat/); for (const id of [11185, 11186, 11187, 11188]) assert.equal(p.varbits.get(id), 1);
  continueToMenu(h, p);
  assert.deepEqual(p.prompt.options, ['Adjust meat (currently at one portion).', 'Adjust salad (currently at one portion).',
    'Adjust spice (currently at one portion).', 'Adjust sauce (currently at one portion).', "I think that's perfect!"]);
  const pick = (ingredient, count) => {
    h.choose(p, p.prompt.options.find(option => option.startsWith(`Adjust ${ingredient}`)));
    assert.equal(p.prompt.title, `Adjust number of ${ingredient} portions to:`);
    h.choose(p, p.prompt.options.find(option => option.startsWith(count)));
    p.manager.advance(); continueToMenu(h, p);
  };
  pick('meat', 'Four'); assert.equal(p.varbits.get(11185), 4);
  assert.equal(p.prompt.options[0], 'Adjust meat (currently at four portions).');
  h.choose(p, 'Adjust meat (currently at four portions).'); assert.deepEqual(p.prompt.options, ['One.', 'Two.', 'Three.', 'Four (current).', 'Cancel.']);
  h.choose(p, 'Cancel.'); continueToMenu(h, p);
  pick('salad', 'Two'); pick('sauce', 'Three');
  h.choose(p, "I think that's perfect!"); p.manager.advance();
  assert.equal(p.text.replace(/<br>/g, '').replace(/\s+/g, ' '), 'Kuani! That gives us four portions of meat, two portions of salad, one portion of spice and three portions of sauce. Definitely happy with that?');
  continueToMenu(h, p); h.choose(p, 'Sounds good to me.');
  h.continueUntil(p, () => /Emelio gives you a kebab/.test(p.text)); assert.equal(p.items.get(I.TEST_KEBAB), 1); assert.equal(p.varbits.get(11189), 1);
  assert.ok(p.log.some(row => row.includes(I.TEST_KEBAB)));
  p.manager.reset();
  const renata = { performAnimation: a => { renata.animation = a.getId(); } };
  talkMag(h, p, 'Renata', N.RENATA, renata); assert.equal(p.text, 'What do you make of this?');
  p.manager.advance(); assert.equal(h.quest.getStage(p), 10); assert.equal(p.items.get(I.TEST_KEBAB), 0); assert.equal(renata.animation, 829);
  assert.equal(p.text, 'This is brilliant! Amazing stuff!');
});

test('MAG a wrong recipe fails the taste test and Emelio reopens the portion menu with the current portions', () => {
  const { h, p } = mag(); h.quest.setStage(p, 8); p.attrs.set('meat-and-greet:vars', (4 << 7 | 4 << 11 | 1 << 15 | 1 << 18 | 1 << 21 | 1 << 24) >>> 0);
  p.items.set(I.TEST_KEBAB, 1);
  talkMag(h, p, 'Lucas', N.LUCAS); p.manager.advance(); assert.equal(p.text, 'Eww! This is awful.'); assert.equal(h.quest.getStage(p), 8);
  h.continueUntil(p, () => !p.manager.getCurrent());
  talkMag(h, p, 'Emelio', N.EMELIO); h.continueUntil(p, () => p.text.startsWith('Tatamo!'));
  assert.match(p.text.replace(/\s*<br>\s*/g, ' '), /one portion of meat/); continueToMenu(h, p); assert.equal(p.prompt.options[0], 'Adjust meat (currently at one portion).');
});

test('MAG marketing and the Colosseum: kebabs (12/14), Lelia eats one (16/18), the advert, the minotaur fight (20) and the reward at 26', () => {
  const { h, p } = mag(); h.quest.setStage(p, 10); p.attrs.set('meat-and-greet:vars', 4 << 7 | 4 << 11);
  talkMag(h, p, 'Emelio', N.EMELIO); h.continueUntil(p, () => p.text.startsWith('You must visit Lelia')); assert.equal(h.quest.getStage(p), 12);
  p.manager.advance(); assert.match(p.text, /some kebabs/); assert.equal(h.quest.getStage(p), 14); assert.equal(p.items.get(I.TEST_KEBAB_2), 2);
  p.manager.reset(); at(p, 1820, 9485);
  const lelia = { performAnimation: a => { lelia.animation = a.getId(); } };
  talkMag(h, p, 'Lelia', N.LELIA, lelia); h.continueUntil(p, () => /Lelia eats the kebab/.test(p.text));
  assert.equal(h.quest.getStage(p), 16); assert.equal(p.items.get(I.TEST_KEBAB_2), 1); assert.equal(lelia.animation, 829);
  h.continueUntil(p, () => p.text.startsWith('Yup.')); assert.equal(h.quest.getStage(p), 18);
  continueToMenu(h, p); assert.deepEqual(p.prompt.options, ['I think so.', 'I need to prepare first.']);
  h.choose(p, 'I think so.'); h.continueUntil(p, () => p.text === 'Right, get to it then.');
  p.manager.advance(); h.tick(2);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1824, 3098]); assert.equal(p.varbits.get(542), 1);
  const cutscene = h.npcs.find(npc => npc.id === N.MINOTAUR_6); assert.deepEqual([cutscene.x, cutscene.y], [1824, 3111]);
  h.tick(1); assert.deepEqual(p.log.findLast(row => row[0] === 'sendCameraMoveTo').slice(1), [1819, 3099, 600, { rate: 232, rate2: 100 }]);
  h.tick(3); assert.match(p.text, /^Welcome, one and all/);
  h.continueUntil(p, () => p.text.startsWith('Indeed, observe')); p.manager.advance(); assert.ok(p.animations.includes(829));
  assert.equal(p.text, 'Huh? Human... eat... friend?');
  h.continueUntil(p, () => p.text === 'Oh boy...'); p.manager.advance();
  assert.equal(h.quest.getStage(p), 20); assert.equal(p.items.get(I.TEST_KEBAB_2), 0);
  h.tick(2); assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1824, 3105]);
  const minotaur = h.npcs.find(npc => npc.id === N.MINOTAUR_7); assert.deepEqual([minotaur.x, minotaur.y], [1824, 3113]); assert.equal(cutscene.removed, true);
  assert.ok(p.log.some(row => row[0] === 'sendObject' && row[1].getId() === 54689));
  h.tick(2); assert.equal(p.blocked, false);
  h.hooks.onNpcDeath[0]({ npc: minotaur, npcId: N.MINOTAUR_7, killer: p });
  h.tick(1); assert.equal(h.quest.getStage(p), 22); h.tick(2);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1820, 9484]); assert.equal(p.getArea(), null);
  h.tick(4); assert.match(p.text, /^You put on a good performance in there/);
  h.continueUntil(p, () => p.text.startsWith('Now, I need to get things ready')); assert.equal(h.quest.getStage(p), 24);
  h.continueUntil(p, () => !p.manager.getCurrent());
  talkMag(h, p, 'Emelio', N.EMELIO); h.continueUntil(p, () => p.text === 'Right...'); assert.equal(h.quest.isComplete(p), false);
  p.manager.advance(); assert.equal(h.quest.getStage(p), 26); assert.deepEqual(p.xp, [[core.Skill.COOKING.getIndex(), 8000]]);
});

test("MAG minotaur: three melee swings then the Moo! magic, and each threshold's Moooooo! shout makes it a tick faster", () => {
  const { h } = mag();
  const Method = h.hooks.registerNpcCombatMethodProvider[0];
  const minotaur = { animations: [], graphics: [], performAnimation: a => minotaur.animations.push(a.getId()), performGraphic: g => minotaur.graphics.push(g.id), forceChat: text => { minotaur.said = text; }, isPlayer: () => false };
  const target = player();
  // A fresh method per swing, as the provider builds them: the fight state stays on the NPC.
  const swing = () => { const method = new Method(minotaur); const speed = method.attackSpeed(minotaur); method.start(minotaur, target); return speed; };
  assert.deepEqual([swing(), swing(), swing()], [5, 5, 5]); assert.deepEqual(minotaur.animations, [11584, 11584, 11584]);
  h.tick(2); assert.equal(minotaur.said, undefined); h.tick(1); assert.equal(minotaur.said, 'Moo!', 'the warning half a cycle before the magic swing');
  assert.equal(swing(), 5); assert.equal(minotaur.animations.at(-1), 11585); assert.deepEqual(minotaur.graphics, [2950]);
  minotaur.__minotaurFight.shouts++; assert.equal(swing(), 3); assert.equal(minotaur.animations.at(-1), 11586); assert.equal(minotaur.said, 'Moooooo!');
  assert.equal(target.log.filter(row => row[0] === 'sendCameraShake').length, 3);
  assert.equal(swing(), 4, 'a tick faster after the shout');
});

test('MAG migrates the old 0-7 stage saves onto the captured stages once', () => {
  const { h } = mag();
  const old = (stage, bits = 0) => { const p = player(); p.attrs.set('quest.meat_and_greet.stage', stage); p.attrs.set('quest.meat_and_greet.bits', bits); h.emit('player:bootstrap-complete', { player: p }); return p; };
  assert.equal(h.quest.getStage(old(1, 1 << 1)), 4);
  const delivering = old(1, (1 << 1) | (1 << 3)); assert.equal(delivering.varbits.get(11183), 4); assert.equal(delivering.varbits.get(11184), 3);
  assert.equal(h.quest.getStage(old(2)), 6); assert.equal(h.quest.getStage(old(5, 1 << 5)), 18); assert.equal(h.quest.getStage(old(5, 1 << 6)), 20);
  const done = old(7); assert.equal(h.quest.getStage(done), 26);
  h.emit('player:bootstrap-complete', { player: done }); assert.equal(h.quest.getStage(done), 26, 'only once');
});

// ---------------------------------------------------------------------------
// At First Light (RSProx 1695, ticks 5134-5763)
// ---------------------------------------------------------------------------
function afl() {
  const h = harness('AtFirstLight'), p = player();
  (h.events['quest:is-complete'] ??= []).push(event => { if (['children_of_the_sun', 'eagles_peak'].includes(event.key)) event.complete = true; });
  p.attrs.set('at-first-light:stage-version', 1);
  return { h, p };
}
const talkAfl = (h, p, name, npcId) => h.namedNpcs.get(name)['Talk-to']({ player: p, npcId, npc: null });
const objectClick = (h, p, id, clickType = 1) => (h.hooks.onObjectInteraction ?? []).forEach(fn => fn({ player: p, objectId: id, clickType,
  definition: { id, getActions: () => ({ 53020: ['Pick'], 53022: ['Pick'], 53011: ['Check'], 50880: ['Set-up'] })[id] ?? [] } }));

test('AFL stages 1-4 as captured: Verity names Wolf (2), the mouse (3), Kiko distracted, the bed checked, the pyre fox hint (4)', () => {
  const { h, p } = afl();
  h.talk(p, N.GUILDMASTER_APATURA); continueToMenu(h, p); h.choose(p, 'Can I help you with anything?');
  continueToMenu(h, p); h.choose(p, 'Yes.'); assert.equal(h.quest.getStage(p), 1); assert.equal(p.varbits.get(9841), 1);
  assert.ok(p.messages.includes("You've started a new quest: <col=081190>At First Light</col>"));
  p.manager.reset();
  talkAfl(h, p, 'Guild Scribe Verity', N.GUILD_SCRIBE_VERITY); h.continueUntil(p, () => p.text.startsWith('If anyone did'));
  assert.equal(h.quest.getStage(p), 2); h.continueUntil(p, () => !p.manager.getCurrent());
  talkAfl(h, p, 'Guild Hunter Wolf (Master)', N.GUILD_HUNTER_WOLF_MASTER_); h.continueUntil(p, () => p.text.startsWith("He's very easy to distract"));
  assert.equal(h.quest.getStage(p), 3);
  h.continueUntil(p, () => /small toy mouse/.test(p.text)); assert.equal(p.items.get(I.TOY_MOUSE), 1); assert.equal(p.varbits.get(9843), 1);
  p.manager.reset();
  h.itemActions.get('Toy mouse').Wind({ player: p, itemId: I.TOY_MOUSE }); assert.equal(p.items.get(I.TOY_MOUSE_WOUND_), 1);
  assert.ok(p.messages.includes('You wind up the mouse.'));
  h.hooks.onItemOnNpc[0]({ player: p, itemId: I.TOY_MOUSE_WOUND_, npcId: N.GUILD_HUNTER_KIKO });
  assert.equal(p.items.get(I.TOY_MOUSE_WOUND_), 0); assert.equal(p.varbits.get(9839), 1); assert.equal(p.text, 'Here you go, little guy.');
  p.manager.advance(); assert.equal(p.text, 'A mouse? Fantastic!'); p.manager.reset();
  objectClick(h, p, 53011); assert.match(p.text, /You check the cat's bed/); assert.equal(p.varbits.get(9837), 1); assert.equal(h.quest.getStage(p), 3);
  p.manager.reset();
  talkAfl(h, p, 'Guild Hunter Wolf (Master)', N.GUILD_HUNTER_WOLF_MASTER_); h.continueUntil(p, () => p.text.startsWith('Why not?'));
  assert.equal(h.quest.getStage(p), 3); p.manager.advance(); assert.equal(h.quest.getStage(p), 4);
  assert.ok(h.npcs.some(npc => npc.id === N.GUILD_HUNTER_FOX && !npc.removed), 'the injured Fox waits in the savannah');
});

test('AFL Fox: found at 5 (bushes pickable then), poultice 6, sample 7, Atza 8 with the pile, trimmed fur 9, report 10', () => {
  const { h, p } = afl(); h.quest.setStage(p, 4); p.items.set(I.JERBOA_TAIL, 2); p.items.set(I.HAMMER, 1);
  talkAfl(h, p, 'Guild Hunter Fox', N.GUILD_HUNTER_FOX); h.continueUntil(p, () => p.text.startsWith("Don't forget"));
  assert.equal(h.quest.getStage(p), 5); p.manager.reset();
  objectClick(h, p, 53020); assert.ok(p.animations.includes(10094)); assert.equal(p.items.get(I.SMOOTH_LEAF) ?? 0, 0);
  h.tick(2); assert.equal(p.items.get(I.SMOOTH_LEAF), 1); assert.match(p.text, /smooth leaf/); p.manager.reset();
  objectClick(h, p, 53022); h.tick(2); assert.equal(p.items.get(I.STICKY_LEAF), 1); p.manager.reset();
  h.hooks.onItemOnItem[0]({ player: p, usedItemId: I.SMOOTH_LEAF, usedWithItemId: I.JERBOA_TAIL });
  assert.equal(p.items.get(I.MAKESHIFT_POULTICE), 1); assert.equal(p.items.get(I.JERBOA_TAIL), 1); assert.ok(p.animations.includes(10097));
  assert.match(p.text, /makeshift poultice/); p.manager.reset();
  talkAfl(h, p, 'Guild Hunter Fox', N.GUILD_HUNTER_FOX); h.continueUntil(p, () => /give the poultice/.test(p.text));
  assert.equal(h.quest.getStage(p), 6); assert.equal(p.items.get(I.MAKESHIFT_POULTICE), 0);
  h.continueUntil(p, () => p.text.startsWith("Well it's your lucky day! Take")); assert.equal(h.quest.getStage(p), 7);
  h.continueUntil(p, () => /fur sample/.test(p.text)); assert.equal(p.items.get(I.FUR_SAMPLE), 1); assert.equal(p.varbits.get(9842), 1);
  p.manager.reset();
  h.namedNpcs.get('Atza')['Talk-to']({ player: p, npcId: N.ATZA }); h.continueUntil(p, () => /give the fur sample/.test(p.text));
  assert.equal(h.quest.getStage(p), 8); h.continueUntil(p, () => p.text.startsWith("It's all in that pile")); assert.equal(p.varbits.get(9840), 1);
  p.manager.reset();
  objectClick(h, p, 50880); assert.ok(p.animations.includes(3676)); h.tick(2); assert.match(p.text, /^So anyway/);
  h.continueUntil(p, () => p.text === 'All done!'); assert.equal(p.varbits.get(9840), 2);
  h.continueUntil(p, () => /trimmed fur/.test(p.text)); assert.equal(h.quest.getStage(p), 9); assert.equal(p.items.get(I.TRIMMED_FUR), 1);
  p.manager.reset();
  talkAfl(h, p, 'Guild Hunter Fox', N.GUILD_HUNTER_FOX); h.continueUntil(p, () => /gives you a report/.test(p.text));
  assert.equal(h.quest.getStage(p), 10); assert.equal(p.items.get(I.FOXS_REPORT), 1);
});

test('AFL report to Verity keeps 10, the tail on the bed repairs it (11) and Apatura completes at 12 after her last line', () => {
  const { h, p } = afl(); h.quest.setStage(p, 10); p.items.set(I.FOXS_REPORT, 1); p.items.set(I.TRIMMED_FUR, 1); p.items.set(I.JERBOA_TAIL, 1); p.items.set(I.NEEDLE, 1);
  talkAfl(h, p, 'Guild Scribe Verity', N.GUILD_SCRIBE_VERITY); assert.match(p.text, /give Fox's report/);
  assert.equal(p.varbits.get(9836), 1); assert.equal(h.quest.getStage(p), 10); assert.equal(p.items.get(I.FOXS_REPORT), 0);
  p.manager.reset();
  h.hooks.onItemOnObject[0]({ player: p, itemId: I.JERBOA_TAIL, objectId: 53011 });
  assert.match(p.text, /carefully fix up/); assert.equal(h.quest.getStage(p), 11); assert.equal(p.varbits.get(9838), 1);
  assert.ok(p.animations.includes(10794)); assert.deepEqual(p.xp, [[core.Skill.CRAFTING.getIndex(), 10]]);
  assert.equal(p.items.get(I.JERBOA_TAIL), 0); assert.equal(p.items.get(I.TRIMMED_FUR), 0);
  p.manager.reset();
  h.talk(p, N.GUILDMASTER_APATURA); h.continueUntil(p, () => p.text.startsWith('Actually...')); assert.equal(h.quest.isComplete(p), false);
  p.manager.advance(); assert.equal(h.quest.getStage(p), 12);
});

test('AFL migrates the old stage model once (bed check, poultice and report steps)', () => {
  const { h } = afl();
  const old = (stage, flags = 0, items = {}) => { const p = player(); p.attrs.set('quest.at_first_light.stage', stage); p.attrs.set('quest.at_first_light.flags', flags);
    for (const [id, n] of Object.entries(items)) p.items.set(Number(id), n); h.emit('player:bootstrap-complete', { player: p }); return p; };
  const bed = old(4); assert.equal(h.quest.getStage(bed), 3); assert.equal(bed.varbits.get(9837), 1);
  assert.equal(h.quest.getStage(old(5)), 4); assert.equal(h.quest.getStage(old(6)), 5);
  assert.equal(h.quest.getStage(old(7)), 6); assert.equal(h.quest.getStage(old(7, 0, { [I.FUR_SAMPLE]: 1 })), 7);
  const delivered = old(11); assert.equal(h.quest.getStage(delivered), 10); assert.equal(delivered.varbits.get(9836), 1);
  assert.equal(h.quest.getStage(old(11, 1)), 11);
});

test('EAA favour menu offers the acceptance beside "Not right now." with or without One Small Favour', () => {
  for (const osf of [true, false]) {
    const h = harness('EthicallyAcquiredAntiquities'), p = player();
    (h.events['quest:is-complete'] ??= []).push(event => { if (event.key === 'one_small_favour') event.complete = osf; });
    h.quest.setStage(p, 10); at(p, 1741, 3135);
    h.namedNpcs.get('Trader Crewmember')['Talk-to']({ player: p, npcId: 9371 }); continueToMenu(h, p); h.choose(p, 'Have you seen a man with a case?');
    continueToMenu(h, p);
    const accept = osf ? 'As long as it is just the one favour...' : 'Sure. What do you need?';
    assert.deepEqual(p.prompt.options, [accept, 'Not right now.']);
    h.choose(p, accept); h.continueUntil(p, () => /tattered sails/.test(p.text)); assert.equal(h.quest.getStage(p), 12);
  }
});

test("AFL keeps its line hooks when The Corsair Curse's line handler runs after it", () => {
  const { h, p } = afl();
  require('../plugins/quests/quests/CorsairCurse.Quest')(h.api);
  const quest = runtime.getRegisteredQuests().find(q => q.key === 'at_first_light');
  quest.setStage(p, 1);
  const line = h.line(p, N.GUILD_SCRIBE_VERITY, "If anyone did, it would've been Wolf. She's always getting Fox into some kind of trouble.");
  line.before(); assert.equal(quest.getStage(p), 2);
});
