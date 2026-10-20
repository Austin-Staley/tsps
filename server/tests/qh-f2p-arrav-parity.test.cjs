// Run after yarn build: node --test tests/qh-f2p-arrav-parity.test.cjs
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
});
let actorIndex = 1;
let worldNpcs = [];
function register() {
  const hooks = new Map(), custom = new Map(), namedNpc = new Map(), buttons = new Map();
  const spawned = [], removed = [], ground = [], prompts = [], areas = [], tasks = [];
  const api = new Proxy({
    core: { ...core, TaskManager: {
      submit: (task) => { task.setRunning(true); tasks.push(task); },
      cancelTasks: (key) => tasks.filter((task) => task.key === key).forEach((task) => task.stop()),
    } }, persistAttribute() {}, registerArea: (area) => areas.push(area),
    onCustomEvent: (event, fn) => { if (!custom.has(event)) custom.set(event, []); custom.get(event).push(fn); },
    emitCustomEvent: (event, payload) => { for (const fn of custom.get(event) || []) fn(payload); },
    onInterfaceActionButton: (ids, fn) => { for (const id of [].concat(ids)) buttons.set(id, fn); },
    onNpcInteraction: (nameOrFn, actions) => {
      if (typeof nameOrFn === 'function') hooks.set('onNpcInteraction', [nameOrFn]);
      else for (const [action, fn] of Object.entries(actions)) namedNpc.set(`${nameOrFn}:${action}`, fn);
    },
    getItemOnGroundManager: () => ({
      registerLocation: (owner, item, location) => { ground.push({ owner, item, location }); }, getGroundItem: () => null,
    }),
    getWorld: () => ({ getNpcs: () => worldNpcs }),
    sendMultiChatboxPrompt: (player, title, ...options) => prompts.push({ player, title, options }),
  }, { get(target, prop) {
    if (prop in target) return target[prop];
    return (...args) => {
      const fn = args.findLast((arg) => typeof arg === 'function')
        || Object.values(args.at(-1) || {}).find((value) => typeof value === 'function');
      if (fn) { if (!hooks.has(prop)) hooks.set(prop, []); hooks.get(prop).push(fn); }
    };
  } });
  require('../plugins/quests/quests/ShieldOfArrav.Quest')(api);
  return { api, hooks, buttons, namedNpc, spawned, removed, ground, prompts, areas,
    quest: getRegisteredQuests().findLast((quest) => quest.key === 'shield_of_arrav'),
    emit: (event, payload) => api.emitCustomEvent(event, payload),
    call: (event, payload) => { for (const fn of hooks.get(event) || []) fn(payload); },
    tick: (count) => { while (count-- > 0) [...tasks].forEach((task) => task.tick()); },
  };
}
function player() {
  const attributes = new Map(), items = new Map(), bank = new Map(), packets = [], messages = [];
  let location = new core.Location(3228, 3369, 0);
  const index = actorIndex++;
  const inventory = {
    getAmount: (id) => items.get(id) || 0,
    adds: (id, amount) => items.set(id, (items.get(id) || 0) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) || 0) - amount)),
    getFreeSlots: () => 28 - [...items].reduce((sum, [id, amount]) => sum + (id === 995 ? Number(amount > 0) : amount), 0),
    isFull: () => inventory.getFreeSlots() <= 0,
  };
  let packet;
  packet = new Proxy({}, { get: (_, method) => (...args) => { packets.push([method, ...args]); return packet; } });
  const p = { attributes, items, bank, packets, messages,
    getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory, getBanks: () => [{ getAmount: (id) => bank.get(id) || 0 }],
    getLocation: () => location, getUsername: () => 'QuestTester', getPacketSender: () => packet,
    getSkillManager: () => ({ getCombatLevel: () => 20, addExperiences() {} }),
    sendMessage: (message) => messages.push(message), isPlayer: () => true, isNpc: () => false,
    getAsPlayer: () => p, getIndex: () => index,
    moveTo: (value) => { location = value; },
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement() {}, addSteps: (value) => { location = value; } }),
  };
  return p;
}
const sentVarbit = (p, id) => p.packets.filter(([method, packetId]) => method === 'sendVarbit' && packetId === id).map(([, , value]) => value);
const lastVarbit = (p, id) => sentVarbit(p, id).at(-1);
const variantFor = (q, p, npcId) => q.hooks.get('onNpcDialogueVariant')[0]({ player: p, npcId });
const condition = (q, p, npcId, text) => q.hooks.get('onNpcDialogueCondition')[0]({ player: p, npcId, text, pages: [{ page: 'Shield of Arrav' }] });
const interact = (q, p, objectId, action = 'Open') => q.call('onObjectInteraction', {
  player: p, objectId, clickType: 1, definition: { getInteractions: () => [action] },
});

test('Reldo dispatches both half-of-shield transcript branches', () => {
  const q = register(), reldo = core.NpcIdentifiers.RELDO;
  const phoenix = player(); phoenix.attributes.set('shield-of-arrav.gang', 1); q.quest.setStage(phoenix, 4); phoenix.items.set(763, 1);
  assert.equal(variantFor(q, phoenix, reldo).variant, 'phoenix-gang-talking-to-reldo-with-half-of-the-shield');
  const blackArm = player(); blackArm.attributes.set('shield-of-arrav.gang', 2); q.quest.setStage(blackArm, 4); blackArm.items.set(765, 1);
  assert.equal(variantFor(q, blackArm, reldo).variant, 'black-arm-gang-talking-to-reldo-with-half-of-the-shield');
  q.quest.setStage(blackArm, 7);
  assert.equal(variantFor(q, blackArm, reldo), null);
});

test('Charlie first-ask and payment conditions do not leak the location after five coins', () => {
  const q = register(), charlie = core.NpcIdentifiers.CHARLIE_THE_TRAMP;
  const p = player(); q.quest.setStage(p, 2); p.attributes.set('shield-of-arrav:reldo-directions', true);
  assert.equal(q.hooks.get('onNpcDialogueCondition')[0]({
    player: p, npcId: charlie, text: 'If asking for the first time:', pages: [{ page: 'Charlie the Tramp' }],
  }), null, 'conditions on other Charlie pages defer to their owner');
  assert.equal(variantFor(q, p, charlie).variant, 'black-arm-gang-talking-to-charlie-the-tramp');
  assert.equal(condition(q, p, charlie, 'If asking for the first time:'), true);
  variantFor(q, p, charlie);
  assert.equal(condition(q, p, charlie, 'If asking for the first time:'), false);
  assert.equal(condition(q, p, charlie, 'Otherwise:'), true);
  assert.equal(lastVarbit(p, 11510), 1);

  const paid = player(); q.quest.setStage(paid, 3); paid.attributes.set('shield-of-arrav:black-arm-task', true); paid.items.set(995, 10);
  q.emit('npc-dialogue:action', { player: paid, npcId: charlie, stepId: '24Nlqb' });
  assert.equal(paid.items.get(995), 5);
  assert.equal(condition(q, paid, charlie, "If you haven't yet paid Charlie for the information:"), true);
  assert.equal(condition(q, paid, charlie, 'Asking again after already paying Charlie for the information:'), false);
  assert.equal(lastVarbit(paid, 11511), 0);
  q.emit('npc-dialogue:action', { player: paid, npcId: charlie, stepId: 'Fo_zeD' });
  assert.equal(paid.items.get(995), 0);
  assert.equal(condition(q, paid, charlie, "If you haven't yet paid Charlie for the information:"), false);
  assert.equal(condition(q, paid, charlie, 'Asking again after already paying Charlie for the information:'), true);
  assert.equal(lastVarbit(paid, 11511), 1);
});

test('quest start and completion mirror the current-cache quest-state varbit', () => {
  const q = register(), p = player();
  q.emit('npc-dialogue:hook', { player: p, hook: 'quest:shield-of-arrav:start' });
  assert.equal(q.quest.getStage(p), 1); assert.equal(lastVarbit(p, 13716), 1);
  q.quest.setStage(p, 6); p.items.set(769, 1);
  q.emit('npc-dialogue:action', { player: p, npcId: core.NpcIdentifiers.KING_ROALD_3, stepId: '25_j1f' });
  assert.equal(q.quest.getStage(p), 7); assert.equal(lastVarbit(p, 13716), 2);
  assert.equal(p.items.get(995), 600);
});

test('gang doors use the transcript lock messages', () => {
  const q = register(), p = player();
  q.emit('door:toggle', { player: p, objectId: core.ObjectIdentifiers.DOOR_71, object: null, handled: false });
  assert.ok(p.messages.includes('This door seems to be locked from the inside.'));
  p.attributes.set('shield-of-arrav.gang', 1); q.quest.setStage(p, 4);
  q.emit('door:toggle', { player: p, objectId: core.ObjectIdentifiers.DOOR_71, object: null, handled: false });
  assert.ok(p.messages.includes('The door is securely locked.'));
  q.emit('door:toggle', { player: p, objectId: core.ObjectIdentifiers.DOOR_69, object: null, handled: false });
  assert.ok(p.messages.includes('The door is securely locked.'));
});

test('shield caches use the chest or cupboard transcript messages', () => {
  const q = register();
  const phoenix = player(); phoenix.attributes.set('shield-of-arrav.gang', 1); q.quest.setStage(phoenix, 4);
  interact(q, phoenix, core.ObjectIdentifiers.CHEST_11);
  assert.ok(phoenix.messages.includes('You search the chest.'));
  assert.ok(phoenix.messages.includes('You open the chest and find half of a shield inside.'));
  assert.equal(phoenix.items.get(763), 1);
  interact(q, phoenix, core.ObjectIdentifiers.CHEST_12);
  assert.ok(phoenix.messages.includes("You open the chest, but don't find anything of interest inside."));

  const blackArm = player(); blackArm.attributes.set('shield-of-arrav.gang', 2); q.quest.setStage(blackArm, 4);
  interact(q, blackArm, core.ObjectIdentifiers.CUPBOARD_12);
  assert.ok(blackArm.messages.includes('You open the cupboard and find half of a shield inside.'));
  assert.equal(blackArm.items.get(765), 1);
  interact(q, blackArm, core.ObjectIdentifiers.CUPBOARD_13);
  assert.ok(blackArm.messages.includes("You open the cupboard, but don't find anything of interest inside."));
});

test('crossbow pickup protection uses the weaponsmaster transcript lines', () => {
  const q = register(), p = player();
  const chat = [], attacks = [];
  worldNpcs = [{ getId: () => core.NpcIdentifiers.WEAPONSMASTER, getHitpoints: () => 30, isDyingFunction: () => false,
    forceChat: (text) => chat.push(text), getCombat: () => ({ attack: (target) => attacks.push(target) }) }];
  const event = () => ({ player: p, handled: false,
    groundItem: { getItem: () => ({ getId: () => core.ItemIdentifiers.PHOENIX_CROSSBOW }),
      getPosition: () => ({ getZ: () => 1, getX: () => 3245, getY: () => 3385 }) } });
  p.attributes.set('shield-of-arrav.gang', 1); q.quest.setStage(p, 4);
  const phoenix = event(); q.call('onGroundItemPickup', phoenix);
  assert.equal(phoenix.handled, true); assert.deepEqual(chat, ["Hey! That's Straven's! He won't like you messing with that!"]); assert.equal(attacks.length, 0);
  chat.length = 0; p.attributes.set('shield-of-arrav.gang', 2);
  const blackArm = event(); q.call('onGroundItemPickup', blackArm);
  assert.equal(blackArm.handled, true); assert.deepEqual(chat, ['Stop! Thief!']); assert.deepEqual(attacks, [p]);
});

test('the weaponsmaster transcript action starts combat for non-Phoenix players', () => {
  const q = register(), p = player();
  const attacks = [];
  const npc = { getCombat: () => ({ attack: (target) => attacks.push(target) }) };
  const event = { player: p, npcId: core.NpcIdentifiers.WEAPONSMASTER, npc, stepId: '12WBZW', handled: false };
  q.emit('npc-dialogue:action', event);
  assert.equal(event.handled, true); assert.deepEqual(attacks, [p]);
  p.attributes.set('shield-of-arrav.gang', 1); q.quest.setStage(p, 4);
  const phoenix = { player: p, npcId: core.NpcIdentifiers.WEAPONSMASTER, npc, stepId: '12WBZW', handled: false };
  q.emit('npc-dialogue:action', phoenix);
  assert.deepEqual(attacks, [p]);
});

test('12WBZW reaches the quest handler through real NpcDialogues with event.npc', () => {
  const q = register(), p = player();
  const attacks = [];
  const npc = { getId: () => core.NpcIdentifiers.WEAPONSMASTER, getCombat: () => ({ attack: (target) => attacks.push(target) }) };
  let chain;
  p.getDialogueManager = () => ({ startDialogues: (builder) => { chain = builder; }, reset() {}, isActive: () => false, getCurrent: () => null });
  const { startDialogue } = require('../plugins/npcs/NpcDialogues.plugin');
  startDialogue(q.api, {
    player: p, npc, npcId: npc.getId(), definition: core.NpcDefinition.forId(npc.getId()),
  }, [{ type: 'action', id: '12WBZW', text: 'The Weaponsmaster starts attacking the player.' }], {},
  { pages: [{ page: 'Shield of Arrav' }] });
  for (const dialogue of chain.getDialogues().values()) dialogue.send(p);
  assert.deepEqual(attacks, [p]);
});
