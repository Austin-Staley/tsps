// From server/: node --test tests/remaining-shadows-handover.test.cjs (after yarn build).
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
const noop = () => {};
let nextIndex = 1;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  new NpcDefinitionLoader().load();
});

function harness() {
  const hooks = {}, events = {}, tasks = [], npcs = [], objects = [], areas = [];
  const api = new Proxy({
    core: {
      ...core,
      TaskManager: { submit(task) { task.setRunning(true); tasks.push(task); }, cancelTasks() {} },
      World: { ...core.World, getNpcs: () => npcs },
      ObjectManager: { register: object => objects.push(object), deregister: noop },
    },
    persistAttribute: noop,
    registerArea: area => areas.push(area),
    onCustomEvent: (key, fn) => (events[key] ??= []).push(fn),
    emitCustomEvent: (key, event) => (events[key] ?? []).forEach(fn => fn(event)),
    onObjectInteraction: fn => (hooks.onObjectInteraction ??= []).push(fn),
    onItemOnObject: fn => (hooks.onItemOnObject ??= []).push(fn),
    onItemOnNpc: fn => (hooks.onItemOnNpc ??= []).push(fn),
    onNpcDialogueCondition: fn => (hooks.onNpcDialogueCondition ??= []).push(fn),
    onNpcDialogueVariant: fn => (hooks.onNpcDialogueVariant ??= []).push(fn),
    onNpcDeath: fn => (hooks.onNpcDeath ??= []).push(fn),
    onZoneEnter: (zone, fn) => (hooks.onZoneEnter ??= []).push(fn),
    onPlayerLogin: fn => (hooks.onPlayerLogin ??= []).push(fn),
    onPlayerLogout: fn => (hooks.onPlayerLogout ??= []).push(fn),
    getWorld: () => ({ getNpcs: () => npcs }),
    getItemOnGroundManager: () => ({ registerLocation: noop, getGroundItem: noop }),
    spawnNpc(definition) {
      let area = null;
      const npc = {
        ...definition, index: nextIndex++, getId: () => definition.id,
        isRegistered: () => !npc.removed, getOwner: () => definition.owner,
        isDyingFunction: () => false, getHitpoints: () => 1,
        getLocation: () => new core.Location(definition.x, definition.y, definition.z),
        getArea: () => area, setArea: value => { area = value; }, setPositionToFace: noop,
      };
      npcs.push(npc);
      return npc;
    },
    removeNpc: npc => { npc.removed = true; },
  }, { get: (target, key) => target[key] ?? ((...args) => (hooks[key] ??= []).push(args.find(x => typeof x === 'function'))) });
  require('../plugins/quests/quests/ShadowsOfCustodia.Quest')(api);
  PluginManager.emitNpcDialogueCondition = event => {
    for (const fn of hooks.onNpcDialogueCondition ?? []) {
      const answer = fn(event);
      if (answer !== null && answer !== undefined) return answer;
    }
    return null;
  };
  return {
    api, hooks, events, tasks, npcs, objects, areas,
    quest: runtime.getRegisteredQuests().at(-1),
    emit: (name, event) => (events[name] ?? []).forEach(fn => fn(event)),
    tick(count = 1) { while (count-- > 0) for (const task of [...tasks]) task.tick(); },
    object(player, objectId, location) {
      const event = { player, objectId, clickType: 2, location, definition: { getInteractions: () => ['', 'Enter'] } };
      for (const fn of hooks.onObjectInteraction ?? []) fn(event);
      return event;
    },
  };
}

function player() {
  const attrs = new Map(), items = new Map(), varbits = new Map();
  let location = new core.Location(1296, 9767, 0), area = null;
  const packet = new Proxy({
    sendVarbit: (id, value) => { varbits.set(id, value); return packet; },
    sendConfig: () => packet, sendInterfaceRemoval: () => packet,
    sendChatboxInterface: () => packet, closeSubInterface: () => packet,
  }, { get: (t, key) => t[key] ?? (() => packet) });
  const p = {
    attrs, items, varbits, messages: [],
    getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: id => items.get(id) ?? 0, contains: id => (items.get(id) ?? 0) > 0,
      getFreeSlots: () => 28, adds(id, amount) { items.set(id, (items.get(id) ?? 0) + amount); },
      deleteNumber(id, amount) { assert.ok((items.get(id) ?? 0) >= amount); items.set(id, items.get(id) - amount); },
    }),
    getSkillManager: () => ({ getMaxLevel: () => 99, addExperiences: noop }),
    getPacketSender: () => packet, getDialogueManager: () => p.manager,
    getLocation: () => location, moveTo: to => { location = to; },
    getArea: () => area, setArea: value => { area = value; },
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement(value) { p.blocked = value; return this; } }),
    setUntargetable: value => { p.untargetable = value; },
    getIndex: () => 1, getAsPlayer: () => p, getUsername: () => 'ShadowsTest',
    isPlayer: () => true, isPlayerBot: () => false, isRegistered: () => true,
    sendMessage: text => p.messages.push(text),
  };
  p.manager = new DialogueManager(p);
  return p;
}

function drain(player, limit = 120) {
  for (let i = 0; i < limit; i++) {
    if (!player.manager.getCurrent()) return;
    player.manager.advance();
  }
}

test('Ariadna bow hand-in sets the durable guard flag and stays idempotent', () => {
  const h = harness(), p = player();
  h.quest.setStage(p, 15);
  p.items.set(I.WILLOW_LONGBOW, 4);
  runtime.startTranscript(h.api, p, N.CAPTAIN_ARIADNA, 'Shadows of Custodia', 'helping-around-town-talking-to-captain-ariadna');
  drain(p);
  assert.equal(p.varbits.get(16641), 2);
  assert.equal(p.varbits.get(16654), 1);
  assert.equal(p.items.get(I.WILLOW_LONGBOW), 0);

  runtime.startTranscript(h.api, p, N.CAPTAIN_ARIADNA, 'Shadows of Custodia', 'helping-around-town-talking-to-captain-ariadna-talking-to-her-again');
  drain(p);
  assert.equal(p.varbits.get(16654), 1);
  assert.equal(p.items.get(I.WILLOW_LONGBOW) ?? 0, 0);
});

test('Old bowsMade=2 save recovers guard and advances to stage 16 without consuming bows', () => {
  const h = harness(), p = player();
  h.quest.setStage(p, 15);
  p.setAttribute('quest.shadows_of_custodia.bows', 2);
  p.setAttribute('quest.shadows_of_custodia.flags', 1 << 4); // wall already reinforced
  runtime.startTranscript(h.api, p, N.CAPTAIN_ARIADNA, 'Shadows of Custodia', 'helping-around-town-talking-to-captain-ariadna-talking-to-her-again');
  drain(p);
  assert.equal(p.varbits.get(16654), 1);
  assert.equal(p.varbits.get(16641), 2);
  assert.equal(p.items.get(I.WILLOW_LONGBOW) ?? 0, 0);
  assert.equal(h.quest.getStage(p), 16);
});

test('Den entry scene ends at the captured boundary and leaves owner NPCs visible without relog', () => {
  const h = harness(), p = player();
  h.quest.setStage(p, 10);
  h.object(p, 56439, new core.Location(1295, 3373, 0));
  h.tick(4);
  const boy = h.npcs.find(npc => npc.id === N.INJURED_BOY && !npc.removed);
  assert.ok(boy, 'injured boy spawned');
  assert.equal(p.getArea(), null, 'private den scene has ended');
  assert.equal(boy.getArea(), null, 'owner NPC is in the normal world');
  const count = h.npcs.filter(npc => npc.id === N.INJURED_BOY && !npc.removed).length;
  for (const fn of h.hooks.onPlayerLogin) fn({ player: p });
  assert.equal(h.npcs.filter(npc => npc.id === N.INJURED_BOY && !npc.removed).length, count);
});

test('One real Antos rescue transcript completes Ariadna and the quest at stage 22', () => {
  const h = harness(), p = player();
  h.quest.setStage(p, 20);
  p.setAttribute('quest.shadows_of_custodia.flags', 1 << 8); // creatures already slain
  const lines = [];
  (h.events['npc-dialogue:line'] ??= []).push(event => lines.push({ text: event.text, stage: h.quest.getStage(p), npc: event.npcId }));
  runtime.startTranscript(h.api, p, N.ANTOS, 'Shadows of Custodia', 'rescuing-antos-talking-to-antos-after-killing-the-strange-creatures');
  drain(p, 300);
  assert.equal(h.quest.getStage(p), 24);
});
