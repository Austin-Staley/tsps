// From server/: node --test tests/eagle-transport.test.cjs (after yarn build).
//
// The eagle transport system against the OSRS Wiki (Eagle_transport_system, the three far eagles,
// Growing_vine): the hub network, the quest and rope gates, the caves, the Feldip vine and the
// Uzer boulder.
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, beforeEach, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const core = PluginManager.getCoreApi();

let Common, Flight, Eyries, QuestRuntime, tasks, cycle, questDone;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  Common = require('../plugins/world/eagletransport/Common.EagleTransport');
  Flight = require('../plugins/world/eagletransport/Flight.EagleTransport');
  Eyries = require('../plugins/world/eagletransport/Eyries.EagleTransport');
  QuestRuntime = require('../plugins/quests/QuestRuntime');
  const api = new Proxy({
    core: {
      ...core,
      TaskManager: { submit: (task) => tasks.push(task) },
      World: { ...core.World, getProcessCycle: () => cycle },
    },
    persistAttribute: () => {},
  }, { get: (target, key) => target[key] ?? (() => {}) });
  Common.init(api);
  // The quest's completion, as QuestRuntime answers it.
  const original = QuestRuntime.getRegisteredQuests;
  QuestRuntime.getRegisteredQuests = () => [{ name: "Eagles' Peak", isComplete: () => questDone }, ...original()];
});

beforeEach(() => {
  tasks = [];
  cycle = 1000;
  questDone = true;
});

function flush() {
  for (let i = 0; i < 5 && tasks.length; i++) {
    const due = tasks;
    tasks = [];
    for (const task of due) task.execute();
  }
}

const loc = (x, y, z = 0) => new core.Location(x, y, z);

function fakePlayer(x = 2022, y = 4960, z = 3, { rope = true, strength = 99 } = {}) {
  let tile = loc(x, y, z);
  const items = new Map(rope ? [[954, 1]] : []);
  const player = {
    messages: [], boxes: [], attributes: {}, varbits: {}, anims: [], blocked: false,
    getLocation: () => tile,
    moveTo: (to) => { tile = to; },
    isRegistered: () => true,
    sendMessage: (m) => player.messages.push(m),
    getAttribute: (k) => player.attributes[k],
    setAttribute: (k, v) => { player.attributes[k] = v; },
    performAnimation: (a) => player.anims.push(a.getId?.() ?? a),
    setPositionToFace: () => {},
    getSkillManager: () => ({ getCurrentLevel: () => strength }),
    getMovementQueue: () => ({ setBlockMovement: (b) => { player.blocked = b; }, reset: () => {} }),
    getDialogueManager: () => ({ startDialogues: (chain) => player.boxes.push(chain) }),
    getPacketSender: () => ({
      sendVarbit: (id, v) => { player.varbits[id] = v; },
      sendSubInterface: () => {},
      closeSubInterface: () => {},
    }),
    getInventory: () => ({
      contains: (id) => (items.get(id) ?? 0) > 0,
      delete: (id, n) => items.set(id, (items.get(id) ?? 0) - n),
    }),
    items,
  };
  return player;
}

const at = (player) => { const l = player.getLocation(); return [l.getX(), l.getY(), l.getZ()]; };
const npc = (id, x, y, z = 0) => ({ getId: () => id, getLocation: () => loc(x, y, z) });

test('every id resolves from the cache', () => {
  const { npcs, locs, objs, varbits, seqs } = Common.ids;
  assert.deepEqual([npcs.peakDesert, npcs.peakJungle, npcs.peakPolar], [1487, 1488, 1489]);
  assert.deepEqual([npcs.desert, npcs.jungle, npcs.polar, npcs.boulder], [1491, 1492, 1493, 1496]);
  assert.deepEqual([locs.feldipEnter, locs.feldipExit, locs.rellekkaEnter, locs.rellekkaExit, locs.uzerEnter, locs.uzerExit, locs.vine],
    [19753, 19759, 19762, 19764, 19798, 19791, 19993]);
  assert.equal(objs.rope, 954);
  assert.equal(varbits.quest, 2780);
  assert.equal(seqs.lasso, 2910);
  // The far eyries' eagles show (as the Peak's three, with Quick-travel) at eaglepeak_quest 40 only.
  for (const id of [1491, 1492, 1493]) {
    const def = core.CacheDefinitions.getNpc(id);
    assert.equal(def.transformVarbit, 2780);
    assert.equal(def.transforms.indexOf(def.transforms.find((t) => t !== -1)), Common.data.questCompleteVarbit);
  }
});

test('the Peak eyrie\'s eagles fly out to their eyrie; the far ones only fly back to the Peak', () => {
  const cases = [
    [npc(1487, 2019, 4957, 3), [3425, 9569, 0]],
    [npc(1488, 2023, 4961, 3), [2520, 9325, 0]],
    [npc(1489, 2026, 4963, 3), [2724, 10214, 0]],
    [npc(1491, 3422, 9568), [2022, 4960, 3]],
    [npc(1492, 2516, 9322), [2022, 4960, 3]],
    [npc(1493, 2727, 10217), [2022, 4960, 3]],
  ];
  for (const [eagle, to] of cases) {
    const player = fakePlayer();
    assert.equal(Flight.fly(player, eagle), true);
    assert.deepEqual(player.anims, [Common.ids.seqs.lasso]);
    assert.equal(player.blocked, true, 'no walking off mid-flight');
    flush();
    assert.deepEqual(at(player), to);
    assert.equal(player.blocked, false);
    assert.equal(player.items.get(954), 1, 'the rope is kept');
  }
  assert.equal(Flight.destination(npc(1487, 3200, 3200)), null, 'a Desert eagle elsewhere is not the Peak\'s');
});

test('the quest must be complete, and a rope carried', () => {
  const player = fakePlayer();
  questDone = false;
  Flight.fly(player, npc(1488, 2023, 4961, 3));
  assert.equal(player.boxes.length, 1, 'the transcript\'s message box');
  assert.equal(Common.message('questIncomplete'), "You must have completed the Eagles' Peak quest before you can try to lasso a giant eagle.");
  questDone = true;
  const noRope = fakePlayer(2022, 4960, 3, { rope: false });
  Flight.fly(noRope, npc(1488, 2023, 4961, 3));
  assert.equal(noRope.messages.at(-1), Common.message('noRope'));
  assert.equal(tasks.length, 0);

  const used = { player: fakePlayer(), itemId: 954, target: npc(1489, 2026, 4963, 3), handled: false };
  Flight.ropeOnEagle(used);
  assert.equal(used.handled, true, 'a rope used on the eagle works too');
  const elsewhere = { player: fakePlayer(), itemId: 954, target: npc(1, 0, 0), handled: false };
  Flight.ropeOnEagle(elsewhere);
  assert.equal(elsewhere.handled, false);
});

test('each eyrie\'s cave: in from outside, out to outside', () => {
  const { locs } = Common.ids;
  for (const [enter, exit, inside, outside] of [
    [locs.uzerEnter, locs.uzerExit, [3420, 9562, 0], [3405, 3159, 0]],
    [locs.feldipEnter, locs.feldipExit, [2525, 9324, 0], [2513, 2926, 0]],
    [locs.rellekkaEnter, locs.rellekkaExit, [2708, 10206, 0], [2744, 3830, 1]],
  ]) {
    const player = fakePlayer();
    assert.equal(Eyries.enterCave({ player, objectId: enter }), true);
    flush();
    assert.deepEqual(at(player), inside);
    assert.equal(Eyries.exitCave({ player, objectId: exit }), true);
    flush();
    assert.deepEqual(at(player), outside);
  }
  assert.equal(Eyries.enterCave({ player: fakePlayer(), objectId: 1 }), false, 'other caves are not these');
});

test('the Feldip vine: a cane guides it, it grows in game ticks, and climbs only once tall', () => {
  const player = fakePlayer(2513, 2926, 0);
  const vine = Common.ids.locs.vine;
  assert.equal(Eyries.climbVine({ player, objectId: vine }), true);
  assert.equal(player.messages.at(-1), "The vine isn't strong enough to climb yet.");
  player.items.set(Common.ids.objs.gardenCane, 1);
  const use = { player, objectId: vine, itemId: Common.ids.objs.gardenCane, handled: false };
  Eyries.guideVine(use);
  assert.equal(use.handled, true);
  assert.equal(player.items.get(Common.ids.objs.gardenCane), 0, 'stuck in the ground');
  assert.equal(player.varbits[3109], 1);
  Eyries.guideVine({ player, objectId: vine, itemId: Common.ids.objs.teasingStick, handled: false });
  assert.equal(player.messages.at(-1), Common.message('vineAlready'));
  cycle += Common.data.vine.growingTicks;
  Eyries.tendVine({ player });
  assert.equal(player.varbits[3109], 2, 'growing');
  // Half the time online, then a logout: the growth so far is kept, and counts on after login.
  cycle += 1000;
  Eyries.vineLogout({ player });
  cycle += 100000;
  Eyries.vineLogin({ player });
  assert.equal(Eyries.vineStage(player), 2, 'it does not grow while logged out');
  cycle += Common.data.vine.tallTicks;
  Eyries.tendVine({ player });
  assert.equal(player.varbits[3109], 3);
  assert.equal(player.messages.at(-1), 'Those vines should be worth checking on now.');
  const said = player.messages.length;
  Eyries.tendVine({ player });
  assert.equal(player.messages.length, said, 'said once');
  Eyries.climbVine({ player, objectId: vine });
  flush();
  assert.deepEqual(at(player), [2525, 9324, 0], 'up into the jungle eyrie');
});

test('the Uzer boulder: 45 Strength pushes past it, either way', () => {
  const boulder = { getId: () => 1496 };
  const weak = fakePlayer(3420, 9563, 0, { strength: 44 });
  Eyries.pushBoulder({ player: weak, npc: boulder });
  assert.equal(weak.messages.at(-1), Common.message('boulderWeak'));
  flush();
  assert.deepEqual(at(weak), [3420, 9563, 0]);
  const player = fakePlayer(3420, 9563, 0, { strength: 45 });
  Eyries.pushBoulder({ player, npc: boulder });
  flush();
  assert.deepEqual(at(player), [3420, 9567, 0]);
  assert.equal(player.varbits[3088], 1);
  Eyries.pushBoulder({ player, npc: boulder });
  flush();
  assert.deepEqual(at(player), [3420, 9563, 0], 'and back');
  assert.equal(Eyries.pushBoulder({ player, npc: { getId: () => 1 } }), false);
});

test("Eagles' Peak sends 40 for complete on eaglepeak_quest, its own stages before it", () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, '..', 'plugins', 'quests', 'quests', 'EaglesPeak.Quest.js'), 'utf8');
  assert.match(source, /varbitValue: \(stage\) => \(stage >= STAGE_COMPLETE \? VARBIT_COMPLETE_VALUE : stage\)/);
  assert.match(source, /const VARBIT_COMPLETE_VALUE = 40;/);
});
