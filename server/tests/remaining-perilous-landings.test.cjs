// From server/: node --test tests/remaining-perilous-landings.test.cjs
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const path = require('node:path');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { DialogueManager } = require('../dist/game/model/dialogues/DialogueManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');
const runtime = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
const O = core.ObjectIdentifiers;
let next = 1;
before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  new NpcDefinitionLoader().load();
  RegionManager.init();
  RegionManager.loadMapFiles(1440, 9640);
});

function harness() {
  const hooks = {}, events = {}, tasks = [], npcs = [], removed = [], objects = [];
  const api = new Proxy({ core: { ...core, World: { ...core.World, getNpcsNear: () => npcs }, TaskManager: {
    submit(task) { task.setRunning?.(true); tasks.push(task); }, cancelTasks(key) { tasks.filter(t => t.key === key).forEach(t => t.stop?.()); },
  }, ObjectManager: { register: o => objects.push(o), deregister: () => {} } },
    getObjectManager: () => ({ register: () => {}, deregister: () => {} }),
    getItemOnGroundManager: () => ({ registerLocation: () => {} }),
    persistAttribute() {}, onCustomEvent(k, fn) { (events[k] ??= []).push(fn); },
    emitCustomEvent(k, e) { for (const fn of events[k] ?? []) fn(e); },
    onObjectInteraction(fn) { (hooks.object ??= []).push(fn); },
    spawnNpc(def) { let loc = new core.Location(def.x, def.y, def.z); const npc = { ...def, getLocation: () => loc, moveTo: to => { loc = to; }, remove: () => {}, isRegistered: () => true, isNpc: () => true, getAsNpc: () => npc, getIndex: () => next++, setOwner() {}, setMobileInteraction() {}, setPositionToFace() {}, getMovementQueue: () => ({ reset() { return this; }, setBlockMovement() { return this; } }) }; npcs.push(npc); return npc; },
    removeNpc(npc) { npc.removed = true; removed.push(npc); },
  }, { get: (t, k) => t[k] ?? ((...args) => (hooks[k] ??= []).push(args.find(x => typeof x === 'function'))) });
  require('../plugins/quests/quests/PerilousMoons.Quest')(api);
  return { api, hooks, tasks, npcs, removed, objects, quest: runtime.getRegisteredQuests().at(-1) };
}
function player() {
  const attrs = new Map(), items = new Map();
  let loc = new core.Location(1440, 9620, 1);
  const inv = { getAmount: id => items.get(id) ?? 0, getFreeSlots: () => 28, adds(id, n) { items.set(id, (items.get(id) ?? 0) + n); }, deleteNumber(id, n) { items.set(id, (items.get(id) ?? 0) - n); } };
  const sender = new Proxy({ sendVarbit() { return sender; }, sendConfig() { return sender; }, sendInterfaceRemoval() { return sender; } }, { get: (t, k) => t[k] ?? (() => sender) });
  const p = { attrs, items, messages: [], getAttribute: k => attrs.get(k), setAttribute: (k, v) => attrs.set(k, v), getInventory: () => inv,
    getLocation: () => loc, moveTo: to => { loc = to; }, sendMessage: m => p.messages.push(m), getPacketSender: () => sender,
    getSkillManager: () => ({ getMaxLevel: () => 99 }), getEquipment: () => ({ get: () => null }),
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement() { return this; } }), setUntargetable() {}, isRegistered: () => true,
    getDialogueManager: () => p.manager, getIndex: () => next++, isPlayer: () => true, isNpc: () => false };
  p.manager = new DialogueManager(p);
  return p;
}
function gate(h, p, id, x, y, z = 0) {
  const event = { player: p, objectId: id, location: new core.Location(x, y, z), clickType: 1, definition: { getInteractions: () => ['Pass-through'] } };
  for (const fn of h.hooks.object ?? []) fn(event);
  return event;
}
const pos = p => [p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()];

test('every captured mandatory entrance lands on its real destination', () => {
  const h = harness(), p = player();
  h.quest.setStage(p, 5); gate(h, p, O.ENTRANCE_15, 1435, 3129); assert.deepEqual(pos(p), [1439, 9509, 1]);
  h.quest.setStage(p, 7); gate(h, p, O.ENTRANCE_15, 1439, 9600, 1); assert.deepEqual(pos(p), [1440, 9615, 1]);
  h.quest.setStage(p, 27);
  gate(h, p, O.ENTRANCE_16, 1421, 9613, 1); assert.deepEqual(pos(p), [1388, 9575, 0]);
  gate(h, p, O.ENTRANCE_16, 1421, 9650, 1); assert.deepEqual(pos(p), [1403, 9717, 0]);
  gate(h, p, O.ENTRANCE_16, 1458, 9650, 1); assert.deepEqual(pos(p), [1481, 9669, 0]);
  gate(h, p, O.ENTRANCE_17, 1439, 9612, 1); assert.deepEqual(pos(p), [1439, 9599, 1]);
  gate(h, p, O.ENTRANCE_18, 1389, 9674); assert.deepEqual(pos(p), [1522, 9719, 0]);
  gate(h, p, O.ENTRANCE_18, 1521, 9720); assert.deepEqual(pos(p), [1522, 9719, 0]);
  gate(h, p, O.ENTRANCE_17, 1527, 9670); assert.deepEqual(pos(p), [1513, 9596, 0]);
  gate(h, p, O.ENTRANCE_17, 1512, 9560); assert.deepEqual(pos(p), [1355, 9538, 0]);
  gate(h, p, O.ENTRANCE_17, 1404, 9703); assert.deepEqual(pos(p), [1441, 9676, 0]);
  gate(h, p, O.ENTRANCE_15, 1388, 9589); assert.deepEqual(pos(p), [1418, 9632, 0]);
  gate(h, p, O.ENTRANCE_15, 1509, 9673); assert.deepEqual(pos(p), [1461, 9632, 0]);
});

test('wrong-stage entrances do not move the player and 1493,9579 remains walk-through', () => {
  const h = harness(), p = player();
  h.quest.setStage(p, 6); gate(h, p, O.ENTRANCE_15, 1439, 9600, 1); assert.deepEqual(pos(p), [1440, 9620, 1]);
  h.quest.setStage(p, 27); gate(h, p, O.ENTRANCE_17, 1493, 9579); assert.deepEqual(pos(p), [1440, 9620, 1]);
});

test('cache placements, boss visibility areas and PathFinder show every arena is reachable and returnable', () => {
  const moons = require('../plugins/bosses/data/moons-of-peril.json').moons;
  const landings = { blue: [1441, 9676], blood: [1418, 9632], eclipse: [1461, 9632] };
  // Quest Helper's arena zones (PerilousMoon.java:266-268): landings are inside them.
  const qhZones = { blue: [1417, 1463, 9647, 9699], blood: [1373, 1421, 9614, 9650], eclipse: [1457, 1506, 9614, 9650] };
  const shipped = require('../data/definitions/npc-dialogues.json');
  const index = require('../data/definitions/npc-dialogue-index.json');
  for (const id of [12861, 12862, 12869]) assert.ok(index[String(id)]?.some(e => e.page === 'Transcript:Perilous Moons'));
  assert.ok(shipped['Perilous Moons'].variants['remnants-of-the-old-ones-talking-to-eyatlalli-with-the-items']);
  const queue = () => ({ reset() {}, setRoute() {}, syncDestinationFlagToRoute() {}, setPathX() { return this; }, setPathY() { return this; }, addCheckpoint() {}, hasRoute: () => false });
  const walker = (x, y) => ({ isPlayer: () => true, getAsPlayer: () => ({ getUsername: () => 'PerilousRoute' }), getLocation: () => new core.Location(x, y, 0), getSize: () => 1, getPrivateArea: () => null, getMovementQueue: queue });
  for (const [moon, spec] of Object.entries(moons)) {
    const [lx, ly] = landings[moon];
    const [bx, by] = spec.tile;
    const [z1, z2, z3, z4] = qhZones[moon];
    assert.ok(lx >= z1 && lx <= z2 && ly >= z3 && ly <= z4, `${moon} landing inside QH arena zone`);
    RegionManager.loadMapFiles(bx, by);
    const gateId = moon === 'blue' ? [O.ENTRANCE_17, 1404, 9703] : moon === 'blood' ? [O.ENTRANCE_15, 1388, 9589] : [O.ENTRANCE_15, 1509, 9673];
    const object = MapObjects.get(gateId[0], new core.Location(gateId[1], gateId[2], 0), null);
    assert.ok(object, `${moon} gate is in the cache`);
    assert.equal(object.getDefinition().getInteractions()[0], 'Pass-through');
    assert.equal(RegionManager.blocked(new core.Location(lx, ly, 0), null), false, `${moon} landing walkable`);
    assert.equal(RegionManager.blocked(new core.Location(bx, by, 0), null), false, `${moon} boss tile walkable`);
    const approach = moon === 'blue' ? [bx, by] : moon === 'blood' ? [1412, 9632] : [1468, 9632];
    assert.ok(PathFinder.calculateWalkRoute(walker(lx, ly), approach[0], approach[1]) > 0, `${moon} arena approach`);
    const statue = moon === 'blue' ? [51373, 1439, 9659] : moon === 'blood' ? [51372, 1410, 9631] : [51374, 1467, 9631];
    const statueObject = MapObjects.get(statue[0], new core.Location(statue[1], statue[2], 0), null);
    assert.ok(statueObject, `${moon} statue is in the cache`);
    assert.ok(statueObject.getDefinition().getInteractions().includes('Use'));
    assert.equal(core.NpcDefinition.forId(moon === 'blue' ? 13013 : moon === 'blood' ? 13011 : 13012)?.getName?.(), spec.name);
  }
});
