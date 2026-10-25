// Run after `yarn build`: node --test tests/hallowed-sepulchre.test.cjs
//
// The Hallowed Sepulchre against rsprox 1862 and 3299 (and the Wiki for the loot and levels):
// the entry, the floors' instances and layouts, the timer, the obstacles, the coffins and leaving.
const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { TaskManager } = require('../dist/game/task/TaskManager');
const { Location } = require('../dist/game/model/Location');

let Common, Run, hooks;

/** Whether the test player has done Sins of the Father (the Sepulchre's quest). */
let questDone = true;

before(() => {
  CachePipeline.initialize();
  RegionManager.init();
  hooks = { objects: new Map(), npcs: new Map(), items: {}, login: [], prompts: [] };
  const key = (ids, click) => (Array.isArray(ids) ? ids : [ids]).map((id) => `${id}:${click}`);
  const api = {
    core: PluginManager.getCoreApi(),
    persistAttribute() {},
    onObjectClick: (ids, click, handler) => { for (const k of key(ids, click)) hooks.objects.set(k, handler); },
    onNpcClick: (ids, click, handler) => { for (const k of key(ids, click)) hooks.npcs.set(k, handler); },
    onItemAction: (name, actions) => { hooks.items[name] = actions; },
    onPlayerLogin: (handler) => hooks.login.push(handler),
    onPlayerLogout: (handler) => (hooks.logout ??= []).push(handler),
    onObjectRoute: (handler) => { hooks.route = handler; },
    sendMultiChatboxPrompt: (player, title, ...args) => hooks.prompts.push({ player, title, args }),
    emitCustomEvent: (name, request) => {
      if (name === 'quest:is-complete' && request.key === 'sins_of_the_father') request.complete = questDone;
    },
  };
  require('../plugins/minigames/HallowedSepulchre.plugin').register(api);
  Common = require('../plugins/minigames/hallowedsepulchre/Common.HallowedSepulchre');
  Run = require('../plugins/minigames/hallowedsepulchre/Run.HallowedSepulchre');
});

let random;
beforeEach(() => {
  random = Math.random;
  hooks.prompts.length = 0;
});

function container() {
  const slots = [];
  return {
    slots,
    adds(id, amount = 1) { const slot = slots.find((s) => s.id === id); if (slot) slot.amount += amount; else slots.push({ id, amount }); },
    delete(id, amount = 1) { const slot = slots.find((s) => s.id === id); if (slot) slot.amount -= amount; },
    contains: (id) => slots.some((s) => s.id === id && s.amount > 0),
    getAmount: (id) => slots.filter((s) => s.id === id).reduce((sum, s) => sum + s.amount, 0),
    getAddableAmount: (item) => item.getAmount(),
    getItems: () => [],
  };
}

function fakePlayer({ agility = 99, thieving = 99 } = {}) {
  const attributes = new Map();
  const p = {
    location: new Location(2387, 5982, 0), area: null, messages: [], spam: [], boxes: [], anims: [], graphics: [],
    varbits: new Map(), scripts: [], subs: [], xp: {}, songs: [], forced: [], registered: true,
    inventory: container(),
    getIndex: () => 1, getUsername: () => 'Tester',
    isPlayer: () => true, isNpc: () => false, getAsPlayer: () => p, isRegistered: () => p.registered,
    getLocation: () => p.location,
    moveTo(location) { p.location = location; },
    setLocation(location) { p.location = location; },
    getArea: () => p.area, setArea(area) { p.area = area; },
    getAttribute: (k) => attributes.get(k), setAttribute: (k, v) => attributes.set(k, v),
    getInventory: () => p.inventory,
    getEquipment: () => ({ getItems: () => [] }),
    sendMessage: (m) => p.messages.push(m),
    performAnimation: (a) => p.anims.push(a.getId()),
    performGraphic: (g) => p.graphics.push(g.getId()),
    setRunEnergy() {},
    getMovementQueue: () => ({ reset() {} }),
    getCombat: () => ({ reset() {} }),
    setForceMovement: (f) => { if (f) p.forced.push(f); },
    getForceMovement: () => null,
    getSkillManager: () => ({
      addExperience: (skill, amount) => { const name = String(skill.getName?.() ?? skill); p.xp[name] = (p.xp[name] ?? 0) + amount; },
      getCurrentLevel: (skill) => (String(skill.getName?.() ?? skill).toUpperCase().includes('THIEV') ? thieving : agility),
    }),
    getDialogueManager: () => ({ startDialogues: (chain) => p.boxes.push(chain), reset() {} }),
    getPacketSender() {
      const sender = {
        sendVarbit: (id, value) => { p.varbits.set(id, value); return sender; },
        sendClientScript: (id, ...args) => { p.scripts.push([id, ...args]); return sender; },
        sendSubInterface: (uid, id) => { p.subs.push(id); return sender; },
        closeSubInterface: (uid) => { p.subs.push(-uid); return sender; },
        sendTypedMessage: (type, text) => { p.spam.push(text); return sender; },
        sendSong: (id) => { p.songs.push(id); return sender; },
        sendJingle: () => sender,
        sendSound: () => sender,
        sendObjectAnimation: () => sender,
        sendInterfaceRemoval: () => sender,
      };
      return sender;
    },
  };
  return p;
}

const varbit = (p, name) => p.varbits.get(Common.data.varbits[name]) ?? 0;
const boxText = (chain) => [...chain.dialogues.values()][0].text;

function ticks(count) {
  for (let i = 0; i < count; i++) {
    TaskManager.process();
    for (const run of [...runs()]) if (run.area) run.tick(run.area);
  }
}

const live = new Set();
function* runs() { for (const p of live) { const run = Run.runOf(p); if (run) yield run; } }

/** Into a run past the entry, on floor 1 with layout `variant`. */
function startRun(p, variant = 0) {
  live.add(p);
  p.setAttribute(Common.data.attributes.tutorial, true);
  p.setAttribute(Common.data.attributes.entryCheck, true);
  Math.random = () => (variant + 0.5) / Common.data.floors[0].variants.length;
  click(p, Common.data.lobby.stairs, 1);
  const run = Run.runOf(p);
  for (let i = 0; i < 20 && !p.subs.includes(668); i++) ticks(1);
  Math.random = random;
  return run;
}

function click(p, id, option = 1, object = null) {
  const handler = hooks.objects.get(`${id}:${option}`);
  return handler({ player: p, object, objectId: id, clickType: option });
}

/** The instance copy of template loc `id` at `tile`. */
function locOf(run, id, tile) {
  const object = run.area.getTemplateObjects(run.area.at(tile)).find((o) => o.getId() === id);
  assert.ok(object, `loc ${id} at ${tile}`);
  return object;
}

test('the stairs: the Stranger first, then the recorded warning box and its menu', () => {
  const p = fakePlayer();
  click(p, Common.data.lobby.stairs);
  assert.equal(p.boxes.length, 1, 'the Stranger stops you before his tutorial');
  assert.equal(Run.runOf(p), null);
  p.setAttribute(Common.data.attributes.tutorial, true);
  click(p, Common.data.lobby.stairs);
  assert.equal(boxText(p.boxes[1]), 'You are about to enter the Hallowed Sepulchre. Dying during this activity will not be considered a safe death. Are you sure you wish to enter?');
  [...p.boxes[1].dialogues.values()][1].action.execute();
  const prompt = hooks.prompts.at(-1);
  assert.equal(prompt.title, 'Are you sure you wish to enter?');
  assert.deepEqual(prompt.args.filter((a) => typeof a === 'string'), ['Yes.', "Yes, and don't ask again.", 'No.']);
  live.add(p);
  prompt.args[3]();
  assert.equal(varbit(p, 'hallowed_entry_check'), 1, "don't ask again is saved");
  assert.ok(Run.runOf(p));
  Run.runOf(p).finish();
});

test('without Sins of the Father neither the stairs nor a shard lets you in', () => {
  const p = fakePlayer();
  p.setAttribute(Common.data.attributes.tutorial, true);
  p.setAttribute(Common.data.attributes.entryCheck, true);
  p.inventory.adds(Common.data.items.shard, 1);
  questDone = false;
  try {
    click(p, Common.data.lobby.stairs);
    assert.equal(Run.runOf(p), null);
    assert.equal(p.messages.at(-1), 'You need to have completed Sins of the Father to enter the Hallowed Sepulchre.');
    hooks.items['Hallowed crystal shard'].Activate({ player: p });
    assert.equal(p.inventory.getAmount(Common.data.items.shard), 1, 'the shard is kept');
    assert.equal(p.messages.at(-1), 'You need to have completed Sins of the Father to enter the Hallowed Sepulchre.');
  } finally {
    questDone = true;
  }
});

test('below 52 Agility the stairs refuse', () => {
  const p = fakePlayer({ agility: 51 });
  p.setAttribute(Common.data.attributes.tutorial, true);
  click(p, Common.data.lobby.stairs);
  assert.equal(Run.runOf(p), null);
  assert.match(p.messages.at(-1), /Agility level of 52/);
});

test('floor 1: an instance of its source, the start tile, the layout varbits, 202 ticks', () => {
  const p = fakePlayer();
  const run = startRun(p, 0);
  assert.equal(run.floorNumber, 1);
  assert.deepEqual(run.area.templateOf(p.getLocation()), [2253, 6018, 2]);
  assert.equal(varbit(p, 'hallowed_ranged_state'), 1);
  assert.ok(p.messages.includes('You venture down into the Hallowed Sepulchre.'));
  assert.ok(p.songs.includes(674));
  assert.ok(p.subs.includes(668), 'the timer HUD');
  // The cache map's own locs are in the copy, at their template tiles.
  locOf(run, 39622, [2274, 5983, 1]);
  assert.equal(varbit(p, 'hallowed_time_remaining'), 202);
  run.finish();
});

test('the timer: one a tick, the recorded warnings, sealed at 1 with the door line', () => {
  const p = fakePlayer();
  const run = startRun(p);
  ticks(1);
  assert.equal(varbit(p, 'hallowed_time_remaining'), 201);
  assert.deepEqual(p.scripts.at(-1), [3442, 201]);
  run.remaining = 102;
  ticks(1);
  assert.ok(p.messages.includes('<col=ef1020>Time remaining: 1:00'));
  run.remaining = 2;
  ticks(1);
  assert.equal(run.remaining, 1);
  assert.equal(run.expired, false);
  ticks(1);
  assert.equal(run.expired, true);
  assert.equal(p.messages.at(-1), '<col=ef1020>You hear a loud rumbling noise as the door to the next floor closes.');
  ticks(3);
  assert.equal(run.remaining, 1, 'it stays at 1');
  run.finish();
});

test('a drop: the jump-down, the landing a plane lower the next tick, 25 Agility XP', () => {
  const p = fakePlayer();
  const run = startRun(p, 0);
  const object = locOf(run, 38462, [2281, 5988, 2]);
  click(p, 38462, 1, object);
  assert.equal(p.anims.at(-1), Common.seq('jumpDown'));
  ticks(1);
  assert.deepEqual(run.area.templateOf(p.getLocation()), [2282, 5985, 1]);
  ticks(1);
  assert.equal(p.xp.Agility ?? p.xp.AGILITY, 25);
  run.finish();
});

test('a platform: two hops two ticks apart, the line and the timer stopped; back is refused', () => {
  const p = fakePlayer();
  const run = startRun(p, 0);
  const object = locOf(run, 38458, [2279, 5984, 1]);
  p.moveTo(run.area.at([2281, 5984, 1]));
  click(p, 38458, 1, object);
  assert.ok(p.spam.includes('You jump across the platform.'));
  assert.equal(run.paused, true);
  assert.equal(varbit(p, 'hallowed_block_climbover'), 1);
  assert.deepEqual(p.scripts.at(-1), [3443, run.remaining]);
  const first = p.forced.at(-1);
  assert.equal(first.getEnd().getX(), -2);
  assert.equal(first.getReverseSpeed(), 27);
  assert.equal(first.getDirection(), 3, 'facing west');
  const remaining = run.remaining;
  ticks(2);
  assert.equal(p.forced.length, 2);
  ticks(2);
  assert.equal(run.remaining, remaining, 'the timer has stopped');
  p.moveTo(run.area.at([2277, 5984, 1]));
  click(p, 38458, 1, object);
  assert.equal(p.messages.at(-1), "You don't see any reason to go back that way.");
  run.finish();
});

test('the floor stairs: the completion, time and PB lines, the XP, and floor 2 with 200 more ticks', () => {
  const p = fakePlayer();
  const run = startRun(p, 0);
  run.floorSpent = 80;
  run.pause();
  const remaining = run.remaining;
  click(p, 39622, 1, locOf(run, 39622, [2274, 5983, 1]));
  ticks(2);
  assert.ok(p.messages.includes('You have completed Floor 1 of the Hallowed Sepulchre! Total completions: <col=ff0000>1</col>.'));
  assert.ok(p.messages.includes('Floor 1 time: <col=ff0000>0:48</col> (new personal best)'), p.messages.join('|'));
  assert.equal(p.varbits.get(10406), 80);
  ticks(4);
  assert.equal(run.floorNumber, 2);
  assert.equal(run.remaining, remaining + 200);
  assert.ok(p.messages.includes('You venture further down into the Hallowed Sepulchre.'));
  run.finish();
});

test('the obelisk: Exit asks, credits a finished floor and resets to the lobby', () => {
  const p = fakePlayer();
  const run = startRun(p, 0);
  run.pause();
  const obelisk = locOf(run, 38451, [2277, 5982, 1]);
  click(p, 38451, 2, obelisk);
  const prompt = hooks.prompts.at(-1);
  assert.equal(prompt.title, 'Are you sure you wish to leave?');
  prompt.args[1]();
  assert.match(p.messages.at(-1), /completed Floor 1/);
  ticks(2);
  assert.equal(p.messages.at(-1), 'The obelisk teleports you back to the lobby of the Hallowed Sepulchre.');
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [2400, 5982, 0]);
  assert.equal(Run.runOf(p), null);
  assert.equal(varbit(p, 'hallowed_time_remaining'), 0);
});

test('a coffin: the picklock, the disarm with Thieving XP, the lid, then the Wiki loot once', () => {
  const p = fakePlayer();
  const run = startRun(p, 2);
  const coffin = locOf(run, 39544, [2272, 5972, 1]);
  Math.random = () => 0;
  click(p, 39544, 1, coffin);
  ticks(5);
  assert.ok(p.spam.includes('You successfully disarm the trap on the coffin!'));
  ticks(1);
  assert.ok(p.spam.includes('You push the coffin lid aside.'));
  ticks(2);
  Math.random = random;
  assert.equal(p.inventory.getAmount(24711), 1, 'floor 1: one Hallowed mark');
  assert.ok(p.messages.includes('<col=005f00>Tester received a drop: Hallowed mark</col>'));
  assert.equal(varbit(p, 'hallowed_current_floor_looted'), 1);
  click(p, 39544, 1, coffin);
  assert.equal(p.messages.at(-1), 'You have already looted this coffin.');
  run.finish();
});

test('the loot tables: marks by floor and one tier roll from the Wiki tables', () => {
  const Coffins = require('../plugins/minigames/hallowedsepulchre/Coffins.HallowedSepulchre');
  for (let floor = 1; floor <= 5; floor++) {
    for (let i = 0; i < 50; i++) {
      const drops = Coffins.coffinLoot(floor);
      const [min, max] = Common.data.loot.marks[floor];
      assert.equal(drops[0][0], 24711);
      assert.ok(drops[0][1] >= min && drops[0][1] <= max);
      const all = [...Common.data.loot.low, ...Common.data.loot.mid, ...Common.data.loot.high].map(([id]) => id);
      assert.ok(all.includes(drops[1][0]));
    }
  }
});

test('a crystal shard ends the run in the lobby; a token adds a minute, not outside', () => {
  const p = fakePlayer();
  p.inventory.adds(24719, 2);
  hooks.items['Hallowed token'].Activate({ player: p });
  assert.equal(p.messages.at(-1), 'The Hallowed token can only be used inside the Hallowed Sepulchre minigame.');
  const run = startRun(p);
  const before = run.remaining;
  hooks.items['Hallowed token'].Activate({ player: p });
  assert.equal(run.remaining, before + 100);
  p.inventory.adds(24709, 1);
  hooks.items['Hallowed crystal shard'].Activate({ player: p });
  ticks(3);
  assert.equal(Run.runOf(p), null);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2399, 5981]);
});

test('logging out mid-run puts the player in the lobby', () => {
  const p = fakePlayer();
  const run = startRun(p);
  run.area.leave(p, true);
  assert.equal(Run.runOf(p), null);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [2400, 5982]);
});

/** Puts the run on `floor` with layout `variant`, the player at template `tile`. */
function onFloor(run, p, floor, variant, tile) {
  const spec = Common.data.floors[floor - 1];
  run.move(spec, spec.variants[variant]);
  run.states = {};
  p.moveTo(run.area.at(tile));
}

const moves = (p, run, from) => p.forced.slice(from).map((f) => {
  const start = run.area.templateOf(f.getStart());
  return [start[0], start[1], start[0] + f.getEnd().getX(), start[1] + f.getEnd().getY()];
});

test('the grapple pillars reproduce the recorded F3 swing: 2413 -> 2408 -> 2403 at y 5868', () => {
  const p = fakePlayer();
  const run = startRun(p);
  onFloor(run, p, 3, 0, [2413, 5868, 2]);
  p.inventory.adds(24721, 1);
  const before = p.forced.length;
  click(p, 39524, 1, locOf(run, 39524, [2408, 5869, 2]));
  ticks(3);
  assert.ok(p.spam.includes('You fire your grapple at the pillar...'));
  ticks(6);
  assert.deepEqual(moves(p, run, before), [[2413, 5868, 2408, 5868], [2408, 5868, 2403, 5868]]);
  assert.ok(p.spam.includes('...and swing safely to the other side.'));
  assert.equal(varbit(p, 'hallowed_ranged_xp_earned'), 1);
  run.finish();
});

test('the bridge reproduces the recorded F1 crossing: 5981 -> 5975 at x 2262, after the repair', () => {
  const p = fakePlayer();
  const run = startRun(p, 2);
  onFloor(run, p, 1, 2, [2262, 5981, 1]);
  click(p, 39527, 1, locOf(run, 39527, [2262, 5980, 1]));
  assert.match(p.messages.at(-1), /two planks, five nails/);
  p.inventory.adds(960, 2);
  p.inventory.adds(1539, 5);
  p.inventory.adds(8794, 1);
  p.inventory.adds(2347, 1);
  click(p, 39527, 1, locOf(run, 39527, [2262, 5980, 1]));
  ticks(2);
  assert.ok(p.spam.includes('You repair the broken bridge.'));
  assert.equal(varbit(p, 'hallowed_construction_state'), 2);
  assert.equal(p.inventory.getAmount(1539), 0);
  const before = p.forced.length;
  click(p, 39527, 1, locOf(run, 39527, [2262, 5980, 1]));
  assert.deepEqual(moves(p, run, before), [[2262, 5981, 2262, 5975]]);
  assert.equal(p.forced.at(-1).getReverseSpeed(), 115);
  ticks(4);
  assert.ok(p.spam.includes('You rapidly make your way across the bridge.'));
  run.finish();
});

test('the portal reproduces the recorded F3 pass: x 2386, 5839 -> 5843, once powered', () => {
  const p = fakePlayer();
  const run = startRun(p);
  onFloor(run, p, 3, 1, [2386, 5839, 2]);
  run.states.hallowed_magic_state = 2;
  const before = p.forced.length;
  click(p, 39533, 1, locOf(run, 39533, [2384, 5841, 2]));
  assert.equal(p.anims.at(-1), Common.seq('floatUp'));
  ticks(1);
  assert.deepEqual(moves(p, run, before), [[2386, 5839, 2386, 5843]]);
  assert.ok(p.spam.includes('You pass through the portal and end up on the other side.'));
  run.finish();
});

test("every drop lands by its face, the rule the unrecorded F4 north drop's landing comes from", () => {
  const { getTemplateRegion } = require('../dist/game/collision/TemplateRegionData');
  const byFace = { 0: [1, -3], 1: [-3, 1], 2: [1, 3], 3: [3, 1] };
  for (const [key, to] of Object.entries(Common.data.drops)) {
    if (key.startsWith('_')) continue;
    const [x, y, z] = key.split(',').map(Number);
    const region = getTemplateRegion(((x >> 6) << 8) | (y >> 6));
    const loc = region.chunks.flat().find((l) => l && l.localX === (x & 63) && l.localY === (y & 63) && l.plane === z && Common.data.dropIds.includes(l.id));
    assert.ok(loc, `a drop at ${key}`);
    assert.deepEqual(to, [x + byFace[loc.face][0], y + byFace[loc.face][1], z - 1], `drop ${loc.id} at ${key}`);
  }
});

test('a second click on the floor stairs, or an Exit meanwhile, credits nothing more', () => {
  const p = fakePlayer();
  const run = startRun(p, 0);
  run.pause();
  const stairs = locOf(run, 39622, [2274, 5983, 1]);
  click(p, 39622, 1, stairs);
  click(p, 39622, 1, stairs);
  click(p, 38451, 3, locOf(run, 38451, [2277, 5982, 1]));
  ticks(10);
  assert.equal(p.messages.filter((m) => m.startsWith('You have completed Floor')).length, 1);
  assert.equal(run.floorNumber, 2);
  assert.equal(run.ended, false);
  run.finish();
});

test('leaving clears the fade and the minimap, even in the middle of one', () => {
  const p = fakePlayer();
  const run = startRun(p);
  click(p, 39622, 1, locOf(run, 39622, [2274, 5983, 1]));
  run.pause();
  run.finish();
  assert.equal(varbit(p, 'minimap_state'), 0);
  assert.ok(p.subs.includes(-((161 << 16) | 1)), 'the fade closed');
});

test('teleporting away before floor 1 ends the run instead of pulling the player in', () => {
  const p = fakePlayer();
  live.add(p);
  p.setAttribute(Common.data.attributes.tutorial, true);
  p.setAttribute(Common.data.attributes.entryCheck, true);
  click(p, Common.data.lobby.stairs, 1);
  p.moveTo(new Location(3222, 3218, 0));
  ticks(8);
  assert.equal(Run.runOf(p), null);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [3222, 3218]);
});

test("from floor 3's layout A start the pillars are used from the recorded end (2413), the one that can be walked to", () => {
  const p = fakePlayer();
  const run = startRun(p);
  onFloor(run, p, 3, 0, [2404, 5856, 2]);
  const event = { player: p, object: locOf(run, 39524, [2408, 5869, 2]), objectId: 39524, destination: null };
  hooks.route(event);
  const dest = run.area.templateOf(new Location(event.destination.x, event.destination.y, event.destination.z));
  assert.deepEqual(dest, [2413, 5868, 2]);
  run.finish();
});

test('floor 5: the barriers by the Grand Hallowed Coffin let the player through until the timer runs out', () => {
  const { RegionManager } = PluginManager.getCoreApi();
  const p = fakePlayer();
  const run = startRun(p);
  const spec = Common.data.floors[4];
  run.move(spec, spec.variants[0]);
  run.setBarriers(false);
  const from = run.area.at([2272, 5857, 0]);
  const through = () => RegionManager.canMove(from.getX(), from.getY(), from.getX(), from.getY() - 1, 0, 1, 1, run.area);
  assert.equal(through(), true, 'inactive: walk on to the coffin');
  run.expire();
  assert.equal(through(), false, 'active once the barrier activates');
  run.finish();
});
