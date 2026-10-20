// Fallen From Grace: the shipped golem Investigation runs at captured stage 13
// (11 -> 13 on Mortimer's rockfall, 13 -> 14 on the golem condition).
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { DialogueManager } = require('../dist/game/model/dialogues/DialogueManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const runtime = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
const I = core.ItemIdentifiers;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  new NpcDefinitionLoader().load();
});

function setup() {
  const hooks = { conditions: [], named: new Map(), custom: new Map() };
  const api = new Proxy({
    core,
    persistAttribute() {},
    onNpcDialogueVariant() {}, onNpcDialogueCondition(fn) { hooks.conditions.push(fn); },
    onNpcInteraction(target, actions) { if (typeof target === 'string') hooks.named.set(target, actions); },
    onCustomEvent(name, fn) { const list = hooks.custom.get(name) ?? []; list.push(fn); hooks.custom.set(name, list); },
    emitCustomEvent(name, event) { for (const fn of hooks.custom.get(name) ?? []) fn(event); },
    onObjectInteraction() {}, onItemOnItem() {}, onItemOnNpc() {}, onItemAction() {},
    onGroundItemClick() {}, onGroundItemPickup() {}, onNpcDeath() {}, onZoneEnter() {},
    onPlayerLogin() {}, onPlayerLogout() {},
  }, { get: (target, key) => target[key] ?? (() => {}) });
  require('../plugins/quests/quests/FallenFromGrace.Quest')(api);
  PluginManager.emitNpcDialogueCondition = (event) => {
    for (const fn of hooks.conditions) {
      const answer = fn(event);
      if (answer !== null && answer !== undefined) return answer;
    }
    return null;
  };
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'fallen_from_grace').at(-1);
  const attrs = new Map(), items = new Map(), messages = [];
  const sender = new Proxy({
    sendVarbit() { return sender; }, sendSubInterface() { return sender; },
    sendInterface() { return sender; }, sendInterfaceScript() { return sender; },
    sendInterfaceRemoval() { return sender; }, sendConfig() { return sender; },
  }, { get: (target, key) => target[key] ?? (() => sender) });
  const player = {
    attrs, items, messages,
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getPacketSender: () => sender, sendMessage: (text) => messages.push(text),
    getInventory: () => ({
      getAmount: (id) => items.get(id) ?? 0, getFreeSlots: () => 28, isFull: () => false,
      adds: (id, amount = 1) => items.set(id, (items.get(id) ?? 0) + amount),
      deleteNumber: (id, amount = 1) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
    }),
    getEquipment: () => ({ get: () => null, getItems: () => [] }),
    getSkillManager: () => ({ getMaxLevel: () => 99, getCurrentLevel: () => 99, addExperiences() {} }),
    getLocation: () => new core.Location(2573, 8651, 0), moveTo() {},
    getUsername: () => 'GolemStage', getIndex: () => 1,
    isPlayer: () => true, isRegistered: () => true, isPlayerBot: () => false,
    setPositionToFace() {}, performAnimation() {},
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement() { return this; } }),
    getArea: () => null, setArea() {}, getPrivateArea: () => null,
  };
  player.manager = new DialogueManager(player);
  player.getDialogueManager = () => player.manager;
  return { hooks, quest, player };
}

function investigate(h) {
  const action = h.hooks.named.get('Broken golem')?.Investigate;
  assert.equal(typeof action, 'function', 'Broken golem Investigate handler is registered');
  const event = { player: h.player, npcId: 16321, handled: false };
  action(event);
  assert.equal(event.handled, true);
  while (h.player.manager.getCurrent()) h.player.manager.advance();
}

test('stage 13 golem investigation opens the shipped condition, grants core once and advances to 14', () => {
  const h = setup();
  h.quest.setStage(h.player, 13);
  investigate(h);
  assert.equal(h.quest.getStage(h.player), 14);
  assert.equal(h.player.items.get(I.DULL_SUNSTONE_CORE), 1);

  // A repeat at the same stage cannot duplicate the core.
  investigate(h);
  assert.equal(h.player.items.get(I.DULL_SUNSTONE_CORE), 1);
  assert.equal(h.quest.getStage(h.player), 14);
});
