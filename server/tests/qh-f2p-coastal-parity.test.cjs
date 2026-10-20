// Run from server after yarn build: node --test tests/qh-f2p-coastal-parity.test.cjs
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { getRegisteredQuests, startTranscript } = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();

before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
});

function register(moduleName, key) {
  const hooks = new Map(), custom = new Map(), said = [];
  const add = (name, handler) => {
    if (!hooks.has(name)) hooks.set(name, []);
    hooks.get(name).push(handler);
  };
  const api = new Proxy({
    core,
    persistAttribute() {},
    registerArea() {},
    onCustomEvent(name, handler) { if (!custom.has(name)) custom.set(name, []); custom.get(name).push(handler); },
    emitCustomEvent(name, payload) { for (const handler of custom.get(name) || []) handler(payload); },
    onNpcDialogueCondition(handler) { add('onNpcDialogueCondition', handler); },
    onItemOnObject(handler) { add('onItemOnObject', handler); },
    onObjectInteraction(handler) { add('onObjectInteraction', handler); },
    sendMultiChatboxPrompt() {},
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => {
        const handler = args.findLast((arg) => typeof arg === 'function')
          || Object.values(args.at(-1) || {}).find((value) => typeof value === 'function');
        if (handler) add(prop, handler);
      };
    },
  });
  require(`../plugins/quests/quests/${moduleName}.Quest`)(api);
  return { api, hooks, said, quest: getRegisteredQuests().findLast((quest) => quest.key === key) };
}

function player() {
  const attributes = new Map(), items = new Map(), equipment = new Map(), messages = [], said = [];
  const inventory = {
    getAmount: (id) => items.get(id) || 0,
    adds: (id, amount) => items.set(id, (items.get(id) || 0) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) || 0) - amount)),
    isFull: () => false,
    getFreeSlots: () => 28,
  };
  let current = null;
  const manager = {
    reset() {},
    advance() {},
    isActive: () => false,
    getCurrent: () => current,
    startDialogues(chain) {
      current = chain;
      for (const entry of [...chain.getDialogues().values()].sort((a, b) => a.getIndex() - b.getIndex())) {
        if (current !== chain) break;
        const text = entry.getText?.();
        if (text) said.push(String(text));
        if (entry.constructor.name === 'ActionDialogue') entry.send(p);
      }
    },
  };
  const p = {
    attributes, items, equipment, messages, said,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getEquipment: () => ({ get: (slot) => equipment.has(slot) ? { getId: () => equipment.get(slot) } : null }),
    getLocation: () => new core.Location(3228, 3369, 0),
    getPacketSender: () => new Proxy({}, { get: () => () => undefined }),
    getDialogueManager: () => manager,
    getUsername: () => 'QuestTester',
    getAppearance: () => ({ isMale: () => true }),
    getSkillManager: () => ({ getCombatLevel: () => 20 }),
    sendMessage: (message) => messages.push(message),
    isRegistered: () => true,
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => p,
    getMovementQueue: () => ({ reset() {}, setBlockMovement() {} }),
    performAnimation() {},
    performGraphic() {},
  };
  return p;
}

test('Black Knights treats a Draynor cabbage like any item before the witch is overheard', () => {
  const { hooks, quest } = register('BlackKnightsFortress', 'black_knights_fortress');
  const p = player();
  quest.setStage(p, 1);
  p.items.set(core.ItemIdentifiers.CABBAGE_3, 1);
  for (const handler of hooks.get('onItemOnObject') || []) {
    handler({ player: p, objectId: core.ObjectIdentifiers.HOLE_2, itemId: core.ItemIdentifiers.CABBAGE_3 });
  }
  assert.ok(p.said.includes('Why exactly would I want to do that?'),
    'the pre-witch any-item transcript must play instead of an ad-hoc message');
  assert.equal(p.items.get(core.ItemIdentifiers.CABBAGE_3), 1);
  assert.equal(quest.getStage(p), 1);
});

test('Prince Ali Lady Keli reports tied-up, not not-ready, after the rope has been used', () => {
  const { api, hooks, quest } = register('PrinceAliRescue', 'prince_ali_rescue');
  const condition = hooks.get('onNpcDialogueCondition')[0];
  const previous = [...PluginManager.npcDialogueConditionHooks];
  PluginManager.npcDialogueConditionHooks.splice(0, previous.length, { pluginName: 'qh-test', handler: condition });
  try {
    const p = player();
    quest.setStage(p, 50);
    startTranscript(api, p, core.NpcIdentifiers.LADY_KELI, 'Prince Ali Rescue', 'executing-the-rescue-dealing-with-lady-keli');
    assert.ok(p.messages.includes('You overpower Keli, tie her up, and put her in a cupboard.'));
    assert.ok(!p.messages.includes('You cannot tie Keli up until you have all equipment and disabled the guard!'));

    const waiting = player();
    quest.setStage(waiting, 40);
    startTranscript(api, waiting, core.NpcIdentifiers.LADY_KELI, 'Prince Ali Rescue', 'executing-the-rescue-dealing-with-lady-keli');
    assert.ok(waiting.messages.includes('You cannot tie Keli up until you have all equipment and disabled the guard!'));
    assert.ok(!waiting.messages.includes('You overpower Keli, tie her up, and put her in a cupboard.'));
  } finally {
    PluginManager.npcDialogueConditionHooks.splice(0, PluginManager.npcDialogueConditionHooks.length, ...previous);
  }
});

test("Pirate's Treasure stock-room crate needs the white apron worn before it gives the rum", () => {
  const { hooks, quest } = register('PiratesTreasure', 'pirates_treasure');
  const search = hooks.get('onObjectInteraction')[0];
  const p = player();
  quest.setStage(p, 1);
  p.attributes.set('pirates-treasure.employment', 2);
  p.attributes.set('pirates-treasure.rum', 2);
  const crate = {
    player: p,
    objectId: core.ObjectIdentifiers.CRATE_14,
    clickType: 1,
    definition: { getInteractions: () => ['Search'] },
  };
  search(crate);
  assert.equal(p.items.get(core.ItemIdentifiers.KARAMJAN_RUM), undefined);
  assert.ok(p.messages.includes('You need to put your white apron on first.'));

  p.messages.length = 0;
  p.equipment.set(core.Equipment.BODY_SLOT, core.ItemIdentifiers.WHITE_APRON);
  search(crate);
  assert.equal(p.items.get(core.ItemIdentifiers.KARAMJAN_RUM), 1);
  assert.equal(p.attributes.get('pirates-treasure.rum'), 0);
  assert.ok(p.messages.includes('You find your bottle of rum in amongst the bananas.'));
});
