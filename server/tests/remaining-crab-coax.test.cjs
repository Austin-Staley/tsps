const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const runtime = require('../plugins/quests/QuestRuntime');

const CACHE = path.resolve(__dirname, '..');
const SIT_SLOT = 54;
const SIT_LOOP = 10061; // emote_sit_loop, interface 216 child 54 (cache enum 1001 -> 5248)

before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(CACHE);
  require('../dist/game/definition/ObjectDefinition').ObjectDefinition.init();
});

function setup() {
  const hooks = { custom: new Map(), objects: [], login: [], npcs: [] };
  const attrs = new Map();
  const inventory = new Map();
  const messages = [];
  const persistentKeys = new Map();
  const placed = [];
  const spawned = [];
  const removed = [];
  const tasks = [];
  const xp = [];
  let area = null;
  let currentDialogue = null;
  let location = { x: 3041, y: 2638, z: 0 };
  const core = {
    ...PluginManager.getCoreApi(),
    ObjectManager: {
      register(object) { placed.push({ id: object.getId(), x: object.getLocation().getX(), y: object.getLocation().getY() }); },
      deregister() {},
    },
    TaskManager: {
      submit(task) { task.setRunning?.(true); tasks.push(task); },
      cancelTasks(key) { for (const task of tasks) if (task.key === key) task.stop?.(); },
    },
  };
  const api = new Proxy({
    core,
    persistAttribute(key, defaultValue) { persistentKeys.set(key, defaultValue); },
    onCustomEvent(name, fn) { const list = hooks.custom.get(name) ?? []; list.push(fn); hooks.custom.set(name, list); },
    emitCustomEvent(name, event) { for (const fn of hooks.custom.get(name) ?? []) fn({ player, ...event }); },
    onNpcDialogueCondition() {},
    onNpcInteraction(fn) { hooks.npcs.push(fn); },
    onObjectInteraction(fn) { hooks.objects.push(fn); },
    onItemOnItem() {},
    onGroundItemPickup() {},
    onPlayerLogin(fn) { hooks.login.push(fn); },
    onPlayerLogout() {},
    onNpcDialogueVariant() {},
    spawnNpc(definition) {
      const npc = {
        definition,
        registered: true,
        getIndex: () => 100 + spawned.length,
        getId: () => definition.id,
        getLocation: () => new core.Location(definition.x ?? 0, definition.y ?? 0, definition.z ?? 0),
        getArea: () => npc.__area,
        setArea: (value) => { npc.__area = value; },
        getPrivateArea: () => npc.__area,
        isRegistered: () => npc.registered,
        isOwnerOnly: () => definition.ownerOnly,
        getOwner: () => definition.owner,
        setPositionToFace() {},
        performAnimation() {},
        moveTo() {},
      };
      spawned.push(npc);
      return npc;
    },
    removeNpc(npc) { npc.registered = false; removed.push(npc); },
    getItemOnGroundManager() { return { getGroundItem: () => undefined, registerLocation: () => {} }; },
  }, { get(target, key) { return target[key] ?? (() => {}); } });
  const sender = new Proxy({
    sendVarbit() { return sender; },
    sendInterface() { return sender; },
    sendInterfaceScript() { return sender; },
    sendInterfaceRemoval() { return sender; },
  }, { get(target, key) { return target[key] ?? (() => sender); } });
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute(key, value) { attrs.set(key, value); },
    getPacketSender: () => sender,
    sendMessage(message) { messages.push(message); },
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      adds(id, count) { inventory.set(id, (inventory.get(id) ?? 0) + count); },
      deleteNumber(id, count) { inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - count)); },
      getFreeSlots: () => 28,
    }),
    getSkillManager: () => ({ getMaxLevel: () => 99, getCurrentLevel: () => 99, addExperiences(skill, amount) { xp.push([skill, amount]); } }),
    getLocation: () => location.getX ? location : new core.Location(location.x, location.y, location.z),
    moveTo(value) { location = value; },
    getDialogueManager: () => ({
      isActive: () => currentDialogue !== null,
      startDialogues(chain) { currentDialogue = chain; },
      getCurrent: () => currentDialogue,
      reset() { currentDialogue = null; },
    }),
    getArea: () => area,
    setArea: (value) => { area = value; },
    getPrivateArea: () => area instanceof core.PrivateArea ? area : null,
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement() { return this; } }),
    setUntargetable() {},
    getEquipment: () => ({ getItems: () => [] }),
    getUsername: () => 'crab-coax-test',
    getIndex: () => 1,
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer() { return player; },
    isPlayerBot: () => false,
  };
  const loadQuest = () => {
    const file = path.join(__dirname, '..', 'plugins', 'quests', 'quests', 'CrabQuest.Quest.js');
    delete require.cache[require.resolve(file)];
    require(file)(api);
    return runtime.getRegisteredQuests().filter((quest) => quest.key === 'crab_quest').at(-1);
  };
  const emit = (name, event) => api.emitCustomEvent(name, event);
  const investigate = (objectId, x, y) => {
    const definition = core.ObjectDefinition.forId(objectId);
    const location = { x, y, z: 0 };
    for (const fn of hooks.objects) fn({ player, objectId, clickType: 1, location, definition });
  };
  const tick = (count = 1) => { while (count-- > 0) for (const task of [...tasks]) task.tick?.(); };
  const sit = (x, y, slot = SIT_SLOT) => {
    player.moveTo({ x, y, z: 0 });
    emit('player:emote', { slot, sequence: SIT_LOOP });
  };
  return { core, hooks, attrs, inventory, messages, persistentKeys, placed, spawned, removed, tasks, xp, player, loadQuest, emit, investigate, sit, tick, setLocation(x, y) { location = { x, y, z: 0 }; }, get area() { return area; }, get currentDialogue() { return currentDialogue; } };
}

// `bit` is the spot-array index bit used by SCARED/MET (join bits differ).
const SIT_SPOTS = [
  { id: 62473, x: 3043, y: 2640, sit: [3042, 2640], bit: 1 << 0 },
  { id: 62470, x: 3042, y: 2637, sit: [3041, 2638], bit: 1 << 1 },
  { id: 62475, x: 3037, y: 2644, sit: [3037, 2643], bit: 1 << 3 },
  { id: 62475, x: 3047, y: 2656, sit: [3046, 2655], bit: 1 << 9 },
];

test('Crab coax needs the real Sit emote after the too-scared investigate', () => {
  const h = setup();
  const quest = h.loadQuest();
  quest.setStage(h.player, 47);
  for (const spot of SIT_SPOTS) {
    h.setLocation(spot.sit[0], spot.sit[1]);
    h.investigate(spot.id, spot.x, spot.y);
    assert.ok((h.attrs.get('quest.crab_quest.scared') & spot.bit) !== 0, `spot ${spot.id} set scared`);
    assert.equal(h.attrs.get('quest.crab_quest.met') & spot.bit, 0, `spot ${spot.id} not coaxed by investigate`);

    h.investigate(spot.id, spot.x, spot.y);
    assert.equal(h.attrs.get('quest.crab_quest.met') & spot.bit, 0, `second investigate does not coax ${spot.id}`);

    h.sit(spot.sit[0], spot.sit[1], 12);
    assert.equal(h.attrs.get('quest.crab_quest.met') & spot.bit, 0, 'a different emote does not coax');

    h.sit(spot.sit[0] + 1, spot.sit[1] + 1);
    assert.equal(h.attrs.get('quest.crab_quest.met') & spot.bit, 0, 'Sit on the wrong tile does not coax');

    h.sit(spot.sit[0], spot.sit[1]);
    assert.ok((h.attrs.get('quest.crab_quest.met') & spot.bit) !== 0, `Sit at ${spot.sit} coaxes ${spot.id}`);
    assert.ok(h.messages.includes('And now, you wait...'));
  }
  // The captured crab chathead is crab_bandcrab 16483; its join action must count.
  h.emit('npc-dialogue:action', { npcId: 16483, stepId: '5WiO-g' });
  assert.ok((h.attrs.get('quest.crab_quest.recruited') & (1 << 0)) !== 0, 'bandcrab chathead action sets the join bit');
});

test('Crab does not place the solid flavor palm that sealed the recruit pocket', () => {
  const h = setup();
  h.loadQuest();
  for (const fn of h.hooks.login) fn({ player: h.player });
  assert.ok(h.placed.some((entry) => entry.id === 62473 && entry.x === 3043 && entry.y === 2640), 'magic tree placed');
  assert.ok(h.placed.some((entry) => entry.id === 62470 && entry.x === 3042 && entry.y === 2637), 'palm south placed');
  assert.ok(!h.placed.some((entry) => entry.id === 62470 && entry.x === 3039 && entry.y === 2644), 'the 3039,2644 flavor palm must not be placed');
  assert.equal(h.persistentKeys.get('crab-quest:shy-met'), false, 'shy-met defaults false');
});

test('Crab recruit pocket is reachable once the 3039,2644 flavor palm is skipped (real cache pathfinder)', () => {
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { ObjectDefinition } = require('../dist/game/definition/ObjectDefinition');
  const { GameObject } = require('../dist/game/entity/impl/object/GameObject');
  const { Location } = require('../dist/game/model/Location');
  const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
  ObjectDefinition.init();
  RegionManager.init();

  const spots = [
    [62473, 3043, 2640], [62470, 3042, 2637], [62470, 3039, 2644], [62475, 3037, 2644],
    [62470, 3037, 2647], [62470, 3039, 2647], [62470, 3040, 2649], [62470, 3048, 2658],
    [62470, 3040, 2636], [62475, 3047, 2656], [62475, 3063, 2653], [62477, 3054, 2656],
    [62478, 3050, 2636], [62478, 3057, 2640],
  ];
  const objects = spots.map(([id, x, y]) => new GameObject(id, new Location(x, y, 0), 10, 0, null));
  for (const object of objects) MapObjects.add(object);

  const reachable = () => {
    const start = [3039, 2645];
    const seen = new Set([start.join(',')]);
    const queue = [start];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || RegionManager.getClipping(nx, ny, 0, null) !== 0) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    return seen;
  };

  const sealed = reachable();
  assert.equal(sealed.has('3042,2640'), false, 'solid 3039,2644 palm seals the magic tree');
  assert.equal(sealed.has('3041,2637'), false, 'solid 3039,2644 palm seals the palm south');

  const flavor = objects[2];
  MapObjects.remove(flavor);
  RegionManager.removeObjectClipping(flavor);
  const open = reachable();
  assert.equal(open.has('3042,2640'), true, 'magic tree reachable once the flavor palm is skipped');
  assert.equal(open.has('3041,2637'), true, 'palm south reachable once the flavor palm is skipped');
});

test('Crab tree NW sits at 3037,2643; the 2x2 tree refuses 3038,2644', () => {
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  const { ObjectDefinition } = require('../dist/game/definition/ObjectDefinition');
  const { GameObject } = require('../dist/game/entity/impl/object/GameObject');
  const { Location } = require('../dist/game/model/Location');
  const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
  ObjectDefinition.init();
  RegionManager.init();
  MapObjects.add(new GameObject(62475, new Location(3037, 2644, 0), 10, 0, null));
  assert.notEqual(RegionManager.getClipping(3038, 2644, 0, null), 0, '3038,2644 is inside the 2x2 tree');
  assert.equal(RegionManager.getClipping(3037, 2643, 0, null), 0, '3037,2643 is walkable');

  const h = setup();
  const quest = h.loadQuest();
  quest.setStage(h.player, 47);
  h.setLocation(3037, 2643);
  h.investigate(62475, 3037, 2644);
  assert.ok((h.attrs.get('quest.crab_quest.scared') & (1 << 3)) !== 0, 'tree NW scared bit 3');
  assert.equal(h.attrs.get('quest.crab_quest.met') & (1 << 3), 0, 'no auto-coax');
  h.investigate(62475, 3037, 2644);
  assert.equal(h.attrs.get('quest.crab_quest.met') & (1 << 3), 0, 'second investigate does not coax');
  h.sit(3038, 2644);
  assert.equal(h.attrs.get('quest.crab_quest.met') & (1 << 3), 0, 'Sit on the tree/NPC-spawn tile is refused');
  h.sit(3037, 2643);
  assert.ok((h.attrs.get('quest.crab_quest.met') & (1 << 3)) !== 0, 'captured Sit tile 3037,2643 coaxes');
});

test('Crab dance and ceremony use the captured talkable main crab end and complete once', () => {
  const h = setup();
  const quest = h.loadQuest();
  quest.setStage(h.player, 50);
  h.emit('npc-dialogue:action', { npcId: 16471, stepId: 'uZozUI' });
  assert.equal(quest.getStage(h.player), 55, 'dance scene starts at 55');

  const endDefinition = h.core.NpcDefinition.forId(16474);
  assert.deepEqual(endDefinition.getActions().filter(Boolean), ['Talk-to'], 'cache 16474 is talkable');
  const danceNpc = h.spawned.find((npc) => npc.getId() === 16474);
  assert.ok(danceNpc, 'crab_maincrab_end 16474 spawned in the dance scene');
  assert.deepEqual([danceNpc.getLocation().getX(), danceNpc.getLocation().getY()], [3062, 2641], 'captured dance NPC tile');
  assert.ok(danceNpc.getArea(), 'dance NPC attached to the private scene area');
  assert.ok(h.placed.some((entry) => entry.id === 62479 && entry.x === 3062 && entry.y === 2641), 'crab circle 62479');
  assert.ok(h.placed.some((entry) => entry.id === 62480 && entry.x === 3062 && entry.y === 2642), 'human circle 62480');
  assert.deepEqual([h.player.getLocation().getX(), h.player.getLocation().getY()], [3062, 2642], 'captured player tile');

  // Real NPC option dispatch: Talk-to on the scene NPC starts the stage-55 transcript.
  h.hooks.npcs.at(-1)({ player: h.player, npcId: 16474, clickType: 1, definition: endDefinition });
  assert.ok(h.currentDialogue, 'stage-55 transcript started');
  h.emit('npc-dialogue:action', { npcId: 16474, stepId: 'UOa-Sd' });
  assert.equal(quest.getStage(h.player), 60, 'dance transcript ends at 60');

  // Talking again opens the ceremony scene and spawns its own talkable 16474.
  h.hooks.npcs.at(-1)({ player: h.player, npcId: 16474, clickType: 1, definition: endDefinition });
  h.tick(1);
  const ceremonyNpc = h.spawned.filter((npc) => npc.getId() === 16474).at(-1);
  assert.deepEqual([ceremonyNpc.getLocation().getX(), ceremonyNpc.getLocation().getY()], [3062, 2643], 'captured ceremony NPC tile');
  assert.ok(ceremonyNpc.getArea(), 'ceremony NPC attached to the private scene area');
  assert.equal(danceNpc.isRegistered(), false, 'dance scene actor removed, not left as a ghost');

  h.emit('npc-dialogue:action', { npcId: 16474, stepId: 'twF4TG' });
  h.emit('npc-dialogue:action', { npcId: 16474, stepId: 'Wk9imR' });
  assert.equal(quest.getStage(h.player), 63);
  assert.equal(quest.isComplete(h.player), true);
  assert.equal(h.inventory.get(34589), 1, 'Shell collection once');
  assert.deepEqual(h.xp.map(([, amount]) => amount).sort((a, b) => a - b), [3000, 10000], 'Sailing/Fishing rewards once');
  assert.equal(ceremonyNpc.isRegistered(), false, 'ceremony actor removed on completion');
  const sceneSpawns = h.spawned.filter((npc) => [16480, 16482, 16474].includes(npc.getId()));
  assert.ok(sceneSpawns.every((npc) => !npc.isRegistered()), 'no phantom scene NPCs after cleanup');

  // A repeated completion action cannot grant the reward twice.
  h.emit('npc-dialogue:action', { npcId: 16474, stepId: 'Wk9imR' });
  assert.equal(h.inventory.get(34589), 1);
  assert.equal(h.xp.length, 2);
});

test('Crab login at 55 and 60 restores the real scene actors', () => {
  const dance = setup();
  const danceQuest = dance.loadQuest();
  danceQuest.setStage(dance.player, 55);
  dance.player.moveTo(new dance.core.Location(3062, 2642, 0));
  for (const fn of dance.hooks.login) fn({ player: dance.player });
  assert.ok(dance.player.getPrivateArea(), 'stage-55 login restored the private scene');
  assert.ok(dance.spawned.some((npc) => npc.getId() === 16474), 'stage-55 login restored the main crab end');
  assert.ok(dance.placed.some((entry) => entry.id === 62480));

  const ceremony = setup();
  const ceremonyQuest = ceremony.loadQuest();
  ceremonyQuest.setStage(ceremony.player, 60);
  ceremony.player.moveTo(new ceremony.core.Location(3062, 2642, 0));
  for (const fn of ceremony.hooks.login) fn({ player: ceremony.player });
  ceremony.tick(1);
  assert.ok(ceremony.player.getPrivateArea(), 'stage-60 login restored the private scene');
  const endNpc = ceremony.spawned.find((npc) => npc.getId() === 16474);
  assert.deepEqual([endNpc.getLocation().getX(), endNpc.getLocation().getY()], [3062, 2643], 'stage-60 main crab end restored');
});

test('Crab Sit uses the real cached slot 54 loop', () => {
  const Emotes = require('../plugins/interface/Emotes.plugin');
  const player = { getEquipment: () => ({ getItems: () => [] }) };
  assert.deepEqual(Emotes._test.resolveEmote(player, SIT_SLOT, 1, {}), { sequence: SIT_LOOP });
});
