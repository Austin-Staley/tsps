// Run after `npx tsc --build`: node --test tests/tai-bwo-wannai-cleanup.test.cjs
//
// Tai Bwo Wannai Cleanup through the real plugins: every plugin loaded, the map's own jungle and
// fence locs, clicks dispatched by PluginManager, real tasks ticked, on a real Player with only the
// network stubbed. The world clock is counted here so the 149- and 1000-tick restores can be crossed.
const assert = require('node:assert/strict');
const path = require('node:path');
const { test, before, beforeEach, afterEach } = require('node:test');

const ROOT = path.join(__dirname, '..');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

let PluginManager, core, MapObjects, ObjectDefinition, Location, Player, Item, Equipment, jungleQuest;
let Common, Locs, Jungle, Fence, Favour, Villagers;
let cycle = 0;
let index = 3000;

const LIGHT = [2770, 3061, 0];
const MEDIUM = [2766, 3057, 0];
const DENSE = [2771, 3075, 0];
const FENCE = [2772, 3064, 0];

before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(ROOT);
  ({ PluginManager } = require('../dist/plugins/PluginManager'));
  ({ MapObjects } = require('../dist/game/entity/impl/object/MapObjects'));
  ({ ObjectDefinition } = require('../dist/game/definition/ObjectDefinition'));
  ({ Location } = require('../dist/game/model/Location'));
  PluginManager.loadPluginSwitches = () => ({ switches: new Map() });
  const quiet = [console.log, console.info, console.debug, console.warn];
  console.log = console.info = console.debug = console.warn = () => {};
  try {
    PluginManager.loadFromDirectory(path.join(ROOT, 'plugins'));
    core = PluginManager.getCoreApi();
    core.RegionManager.init();
  } finally {
    [console.log, console.info, console.debug, console.warn] = quiet;
  }
  ({ Player } = require('../dist/game/entity/impl/player/Player'));
  ({ Item, Equipment } = core);
  core.World.getProcessCycle = () => cycle;
  for (const [x, y] of [[2760, 3020], [2840, 3020], [2760, 3100], [2840, 3100]]) core.RegionManager.loadMapFiles(x, y);
  const dir = '../plugins/minigames/taibwowannaicleanup/';
  Common = require(`${dir}Common.TaiBwoWannaiCleanup`);
  Locs = require(`${dir}Locs.TaiBwoWannaiCleanup`);
  Jungle = require(`${dir}Jungle.TaiBwoWannaiCleanup`);
  Fence = require(`${dir}Fence.TaiBwoWannaiCleanup`);
  Favour = require(`${dir}Favour.TaiBwoWannaiCleanup`);
  Villagers = require(`${dir}Villagers.TaiBwoWannaiCleanup`);
  jungleQuest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().find((q) => q.key === 'jungle_potion');
});

beforeEach(() => {
  // Every map loc back as the cache placed it.
  for (const entry of [...Locs._changed.values()]) entry.due = -1;
  Locs.process();
});

afterEach(() => {
  for (const player of [...Jungle._sessions.keys(), ...Fence._sessions.keys()]) {
    Jungle._sessions.delete(player);
    Fence._sessions.delete(player);
  }
});

const id = (kind, name) => core.CacheDefinitions[`get${kind}Id`](name);
const obj = (name) => id('Obj', name);
const loc = (name) => id('Loc', name);
const tick = (n = 1) => { for (let i = 0; i < n; i++) { cycle++; core.TaskManager.process(); } };
const at = ([x, y, z]) => new Location(x, y, z);

/** A real player by the jungle, past Jungle Potion and told of the cleanup, with a red topaz machete. */
function villager(t, { told = true, machete = 'machette_redtopaz', woodcutting = 99 } = {}) {
  const p = new Player(null);
  p.setIndex(index++);
  p.setUsername(`tbwc${p.getIndex()}`);
  p.setRegistered(true);
  p.getSession = () => ({ sendClientPacket: () => true, write: () => true });
  p.messages = [];
  t.mock.method(p, 'sendMessage', (text) => p.messages.push(text));
  const sender = p.getPacketSender();
  const spam = sender.sendTypedMessage;
  t.mock.method(sender, 'sendTypedMessage', function (type, text) { p.messages.push(text); return spam.apply(this, arguments); });
  p.varbits = new Map();
  const send = sender.sendVarbit;
  t.mock.method(sender, 'sendVarbit', function (vid, value) { p.varbits.set(vid, value); return send.apply(this, arguments); });
  p.setLocation(new Location(2771, 3062, 0));
  jungleQuest.setStage(p, jungleQuest.completionValue);
  if (told) Common.advance(p, 1);
  if (machete) p.getEquipment().setItem(Equipment.WEAPON_SLOT, new Item(obj(machete), 1));
  const skill = p.getSkillManager();
  skill.setMaxLevel(core.Skill.WOODCUTTING, woodcutting).setCurrentLevel(core.Skill.WOODCUTTING, woodcutting);
  return p;
}

/** A login as the login packet sends it (hooks need the username). */
const login = (p) => PluginManager.emitPlayerLogin({ player: p, username: p.getUsername() });
const varbit = (p, name) => p.varbits.get(id('Varbit', name));
const xp = (p) => p.getSkillManager().getExperience(core.Skill.WOODCUTTING);

const CLEANUP_LOCS = () => [...Common.data.jungle.flatMap((jungle) => jungle.locs), ...Common.data.fence.locs].map(loc);

/** The option clicked on arrival: the player stands on the tile east of the loc, as walking there would. */
function click(p, tile, option) {
  const object = Locs.find(CLEANUP_LOCS(), at(tile));
  if (!p.getLocation().isWithinInteractionDistance(at(tile))) p.setLocation(new Location(tile[0] + 1, tile[1], tile[2]));
  assert.ok(object, `a loc at ${tile}`);
  const definition = ObjectDefinition.forPlayer(object.getId(), p);
  const clickType = definition.getInteractions().indexOf(option) + 1;
  assert.ok(clickType > 0, `${definition.getName()} has ${option}`);
  const event = { player: p, object, objectId: object.getId(), definition, clickType, location: { x: tile[0], y: tile[1], z: tile[2] }, handled: false };
  PluginManager.emitObjectInteraction(event);
  return event;
}

const locAt = (tile) => Locs.find(CLEANUP_LOCS(), at(tile))?.getId();

test('hacking needs Murcaily first, a wielded machete and the Woodcutting level', (t) => {
  const untold = villager(t, { told: false });
  assert.equal(click(untold, LIGHT, 'Hack').handled, true);
  assert.equal(untold.getDialogueManager().isActive(), true, 'the recorded mesbox');
  assert.equal(Jungle._sessions.has(untold), false);

  const bare = villager(t, { machete: null });
  click(bare, LIGHT, 'Hack');
  assert.deepEqual(bare.messages, ['You need to be holding a machete to cut away this jungle.']);

  const low = villager(t, { woodcutting: 30 });
  click(low, DENSE, 'Hack');
  assert.deepEqual(low.messages, ['You need a Woodcutting level of 35 to hack this jungle.']);
  assert.equal(Jungle._sessions.has(low), false);
});

test('a hack: the result 7 ticks after the click (01858), the jungle one stage down in place, its spar, XP, then favour 3 ticks on', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0);
  const before = xp(p);
  const original = MapObjects.get(loc('tai_bwo_jungle_vegetation_easy_1'), at(LIGHT), null);
  click(p, LIGHT, 'Hack');
  tick(7);
  assert.equal(locAt(LIGHT), loc('tai_bwo_jungle_vegetation_easy_2'));
  const after = MapObjects.get(loc('tai_bwo_jungle_vegetation_easy_2'), at(LIGHT), null);
  assert.equal(after.getType(), original.getType());
  assert.equal(after.getFace(), original.getFace());
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_light')), 1);
  assert.equal(xp(p) - before, 32);
  assert.equal(varbit(p, 'cleanup_progress'), 2);
  assert.equal(Favour.points(p), 3, 'kept at once');
  assert.equal(varbit(p, 'vill_comm_points') ?? 0, 0, 'shown 3 ticks later');
  tick(3);
  assert.equal(varbit(p, 'vill_comm_points'), 3);
  assert.equal(varbit(p, 'favour_percentage'), 0);
  assert.equal(varbit(p, 'tbw_overlayopen'), 1, 'the overlay is up in the village');
  tick(6);
  assert.equal(locAt(LIGHT), loc('tai_bwo_jungle_vegetation_easy_3'), 'the next result, 9 ticks after the first');
});

test('a miss gives 1 XP and leaves the jungle', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0.999);
  const before = xp(p);
  click(p, MEDIUM, 'Hack');
  tick(7);
  assert.equal(locAt(MEDIUM), loc('tai_bwo_jungle_vegetation_med_1'));
  assert.equal(xp(p) - before, 1);
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_med')), 0);
});

test('cut to the ground: stage 5 ends the hack with the message, and the jungle grows back 149 ticks after its last change', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0);
  click(p, DENSE, 'Hack');
  tick(9 * 3 + 7);
  assert.equal(locAt(DENSE), loc('tai_bwo_jungle_vegetation_hard_5'));
  assert.equal(Jungle._sessions.has(p), false);
  tick(3);
  assert.ok(p.messages.includes('This jungle has been cut back to the ground.'));
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_dense')), 4);
  tick(149 - 4);
  assert.equal(locAt(DENSE), loc('tai_bwo_jungle_vegetation_hard_5'));
  tick(1);
  assert.equal(locAt(DENSE), loc('tai_bwo_jungle_vegetation_hard_1'));
});

test('the last free slot gets its spar, then the hack stops with the recorded message', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0);
  p.getInventory().add(new Item(obj('bones'), 27));
  click(p, LIGHT, 'Hack');
  tick(7);
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_light')), 1);
  assert.equal(Jungle._sessions.has(p), false);
  tick(3);
  assert.ok(p.messages.includes('You have no space in your inventory for any further thatching spars.'));
  p.messages.length = 0;
  click(p, LIGHT, 'Hack');
  assert.deepEqual(p.messages, ['You have no space in your inventory for any further thatching spars.']);
});

test('walking away stops the hack and keeps a favour gain already due', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0);
  click(p, LIGHT, 'Hack');
  tick(7);
  p.getMovementQueue().addSteps(new Location(2771, 3063, 0));
  assert.ok(p.getMovementQueue().size() > 0, 'a step queued');
  tick(3);
  assert.equal(Jungle._sessions.has(p), false);
  assert.equal(Favour.points(p), 3);
});

test('the fence: a spar a stage on the 10th tick, every 13, to the finished fence; then back to rotten 1000 ticks on', (t) => {
  const p = villager(t);
  p.getInventory().add(new Item(obj('thatching_spar_light'), 2));
  p.getInventory().add(new Item(obj('thatching_spar_dense'), 3));
  const before = xp(p);
  assert.equal(click(p, FENCE, 'Repair').handled, true);
  tick(9);
  assert.equal(locAt(FENCE), loc('village_fence_rotten'));
  tick(1);
  assert.equal(locAt(FENCE), loc('village_fence_fixed1'));
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_light')), 1);
  assert.equal(Math.floor(xp(p) - before), 28, 'a light spar: 28.1 (whole experience at 99)');
  assert.equal(Favour.points(p), 1);
  assert.equal(varbit(p, 'cleanup_progress'), 4);
  tick(13 * 3);
  assert.equal(locAt(FENCE), loc('village_fence_fixedcomplete'));
  assert.equal(Fence._sessions.has(p), false, 'a finished fence ends the repair');
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_dense')), 1);
  assert.equal(Favour.points(p), 1 + 1 + 5 + 5);
  tick(1000 - 1);
  assert.equal(locAt(FENCE), loc('village_fence_fixedcomplete'));
  tick(1);
  assert.equal(locAt(FENCE), loc('village_fence_rotten'));
});

test('Reinforce puts one spar into the finished fence and restarts its decay', (t) => {
  const p = villager(t);
  p.getInventory().add(new Item(obj('thatching_spar_med'), 6));
  click(p, FENCE, 'Repair');
  tick(10 + 13 * 3);
  assert.equal(locAt(FENCE), loc('village_fence_fixedcomplete'));
  tick(500);
  click(p, FENCE, 'Reinforce');
  tick(10);
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_med')), 1);
  assert.equal(Fence._sessions.has(p), false);
  tick(999);
  assert.equal(locAt(FENCE), loc('village_fence_fixedcomplete'), 'the reinforce restarted the 1000');
  tick(1);
  assert.equal(locAt(FENCE), loc('village_fence_rotten'));
});

test('no spars, or no machete, and the fence is left alone', (t) => {
  const p = villager(t);
  click(p, FENCE, 'Repair');
  assert.deepEqual(p.messages, ['You need some thatching spars in order to repair this fence.']);
  const q = villager(t, { machete: null });
  q.getInventory().add(new Item(obj('thatching_spar_light'), 1));
  click(q, FENCE, 'Repair');
  assert.deepEqual(q.messages, ['You need a machete to repair this fence.']);
  assert.equal(Fence._sessions.size, 0);
});

test('favour stops at 100%, with the recorded message', (t) => {
  const p = villager(t);
  Favour.gain(p, 998);
  assert.equal(p.messages.length, 0);
  Favour.gain(p, 3);
  assert.equal(Favour.points(p), 1000);
  assert.equal(varbit(p, 'favour_percentage'), 100);
  assert.deepEqual(p.messages, ['Your Favour total is now full, you cannot gain any more.<br>Talk to the villagers to get favour converted to trading sticks.']);
});

test('sticks: the fit passes through the three recorded claims', () => {
  assert.equal(Villagers.sticksFor(419), 23);
  assert.equal(Villagers.sticksFor(1000), 79);
  assert.ok(Math.abs(Villagers.sticksFor(921) - 71) <= 2, `${Villagers.sticksFor(921)} at 921`);
  assert.equal(Villagers.sticksFor(0), 0);
  assert.equal(Villagers.sticksFor(12), 1, 'any favour left gives a stick');
});

/** Talk-to as the click packet sends it, on a villager's multinpc as the player sees it. */
function talk(p, name) {
  const villagerData = Common.data.villagers.find((v) => v.name === name);
  const npc = new core.NPC(id('Npc', `${villagerData.npc.replace('tbwcu_', 'tbwcu_')}_multinpc`), new Location(2800, 3080, 0));
  const event = { player: p, npc, npcId: npc.getContentId(p), definition: npc.getCurrentDefinition(p), npcIndex: 1, clickType: 1, location: { x: 2800, y: 3080, z: 0 }, handled: false };
  PluginManager.emitNpcInteraction(event);
  return event;
}

function continueAll(p) {
  for (let i = 0; i < 6 && p.getDialogueManager().isActive(); i++) p.getDialogueManager().advance();
}

test('the first sticks come from Murcaily after a repair; then the others give; each waits 1800 ticks', (t) => {
  const p = villager(t);
  // Logged in: every villager is due (1), so the client shows them holding sticks.
  login(p);
  assert.equal(varbit(p, 'chat_murc'), 1);
  Favour.gain(p, 600);
  // Before a repair nobody gives sticks: Murcaily's own transcript plays instead.
  assert.equal(Villagers.canClaim(p, Common.data.villagers.find((v) => v.name === 'Murcaily')), false);
  Common.advance(p, 4);
  assert.equal(Villagers.canClaim(p, Common.data.villagers.find((v) => v.name === 'Layleen')), false, 'not before Murcaily');
  const event = talk(p, 'Murcaily');
  assert.equal(event.handled, true);
  assert.equal(p.getDialogueManager().getCurrent().constructor.name, 'NpcDialogue');
  const sticks = Villagers.sticksFor(600);
  continueAll(p);
  assert.equal(p.getInventory().getAmount(obj('village_trade_sticks')), sticks);
  assert.equal(Favour.points(p), 600 - sticks);
  assert.equal(varbit(p, 'chat_murc'), 7);
  assert.equal(varbit(p, 'cleanup_progress'), 5);
  // Murcaily has nothing more for a while; Layleen now gives.
  assert.equal(Villagers.canClaim(p, Common.data.villagers.find((v) => v.name === 'Murcaily')), false);
  assert.equal(talk(p, 'Layleen').handled, true);
  continueAll(p);
  assert.equal(varbit(p, 'chat_layleen'), 7);
  tick(300);
  assert.equal(varbit(p, 'chat_murc'), 6);
  tick(300 * 5);
  assert.equal(varbit(p, 'chat_murc'), 1);
  assert.equal(Villagers.canClaim(p, Common.data.villagers.find((v) => v.name === 'Murcaily')), true);
});

test("Murcaily's transcript: his explanation tells the player, and his conditions follow the progress", (t) => {
  const p = villager(t, { told: false });
  const definition = { getName: () => 'Murcaily' };
  assert.equal(Villagers.answerCondition({ player: p, definition, text: 'First time after completing Jungle Potion:' }), true);
  const line = { player: p, definition, text: "Well Bwana, if you're stuck for something to do, you could always do a bit of handymanship about the village and cut away the jungle that lies here about." };
  Villagers.toldOnLine(line);
  assert.equal(Common.progress(p), 0, 'not until the page is reached');
  line.before();
  assert.equal(Common.progress(p), 1);
  const ask = (text) => Villagers.answerCondition({ player: p, definition, text });
  assert.equal(ask('First time after completing Jungle Potion:'), false, 'his welcome back is said until he has told them');
  assert.equal(ask("If the player hasn't hacked away at jungle:"), true);
  Common.advance(p, 2);
  assert.equal(ask('If the player has hacked away at jungle:'), true);
  assert.equal(ask("First time after hacking away at jungle if the fence hasn't been repaired yet:"), true);
  assert.equal(ask("First time after hacking away at jungle if the fence hasn't been repaired yet:"), true, 'asking is not saying it');
  const hacked = { player: p, definition, text: "I see that you've been hacking away at the jungle...good, now if you have some thatching spars you can go and fix the fence." };
  Villagers.toldOnLine(hacked);
  hacked.before();
  assert.equal(ask("First time after hacking away at jungle if the fence hasn't been repaired yet:"), false, 'only the first time it is said');
  assert.equal(ask('First time after repairing the fence:'), false, 'the claim is its own Talk-to');
});

test('a machete on a spar makes 5 skewers; a skewer on a spider carcass makes a spider on stick', (t) => {
  const p = villager(t);
  p.getInventory().add(new Item(obj('machette'), 1));
  p.getInventory().add(new Item(obj('thatching_spar_light'), 1));
  p.getInventory().add(new Item(obj('village_spider_carcass'), 1));
  const use = (a, b) => PluginManager.emitItemOnItem({ player: p, usedItemId: obj(a), usedWithItemId: obj(b), usedItem: new Item(obj(a), 1), usedWithItem: new Item(obj(b), 1), handled: false });
  use('machette', 'thatching_spar_light');
  assert.equal(p.getInventory().getAmount(obj('tbw_skewer_stick')), 5);
  assert.equal(p.getInventory().getAmount(obj('thatching_spar_light')), 0);
  assert.ok(p.messages.includes('You hack the spar into skewers.'));
  use('village_spider_carcass', 'tbw_skewer_stick');
  assert.equal(p.getInventory().getAmount(obj('tbw_skewer_stick')), 4);
  assert.equal(p.getInventory().getAmount(obj('tbw_spider_on_stick_raw')), 1);
});

test('repairing the fence ends a hack, and hacking ends a repair', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0.999);
  p.getInventory().add(new Item(obj('thatching_spar_light'), 3));
  click(p, LIGHT, 'Hack');
  tick(2);
  click(p, FENCE, 'Repair');
  assert.equal(Jungle._sessions.has(p), false);
  assert.equal(Fence._sessions.has(p), true);
  tick(2);
  click(p, LIGHT, 'Hack');
  assert.equal(Fence._sessions.has(p), false);
  assert.equal(Jungle._sessions.has(p), true);
});

test('two players on one fence: the one who finds it finished stops without spending a spar', (t) => {
  const a = villager(t);
  const b = villager(t);
  a.getInventory().add(new Item(obj('thatching_spar_light'), 4));
  b.getInventory().add(new Item(obj('thatching_spar_light'), 4));
  click(a, FENCE, 'Repair');
  tick(5);
  click(b, FENCE, 'Repair');
  tick(10 + 13 * 3);
  assert.equal(locAt(FENCE), loc('village_fence_fixedcomplete'));
  tick(13 * 3);
  assert.equal(locAt(FENCE), loc('village_fence_fixedcomplete'), 'never past finished');
  assert.equal(Fence._sessions.size, 0);
  const left = a.getInventory().getAmount(obj('thatching_spar_light')) + b.getInventory().getAmount(obj('thatching_spar_light'));
  assert.equal(8 - left, 4, 'one spar a stage, between them');
});

test('a teleport away ends a hack and a repair', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0.999);
  click(p, LIGHT, 'Hack');
  tick(2);
  p.setLocation(new Location(3222, 3218, 0));
  tick(1);
  assert.equal(Jungle._sessions.has(p), false);
  const q = villager(t);
  q.getInventory().add(new Item(obj('thatching_spar_light'), 1));
  click(q, FENCE, 'Repair');
  tick(2);
  q.setLocation(new Location(3222, 3218, 0));
  tick(10);
  assert.equal(Fence._sessions.has(q), false);
  assert.equal(q.getInventory().getAmount(obj('thatching_spar_light')), 1);
  assert.equal(locAt(FENCE), loc('village_fence_rotten'));
});

test('a level-up pop-up holds the hack until it is continued', (t) => {
  const p = villager(t);
  t.mock.method(Math, 'random', () => 0);
  click(p, LIGHT, 'Hack');
  let resume = null;
  PluginManager.emitCustomEvent('level-up:popup-opened', { player: p, skill: core.Skill.WOODCUTTING, pause: (session, onResume) => { resume = onResume; } });
  tick(20);
  assert.equal(locAt(LIGHT), loc('tai_bwo_jungle_vegetation_easy_1'), 'held');
  resume();
  tick(7);
  assert.equal(locAt(LIGHT), loc('tai_bwo_jungle_vegetation_easy_2'));
});

test('the fence, like the jungle, waits for Jungle Potion and Murcaily', (t) => {
  const p = villager(t, { told: false });
  p.getInventory().add(new Item(obj('thatching_spar_light'), 1));
  assert.equal(click(p, FENCE, 'Repair').handled, true);
  assert.equal(Fence._sessions.has(p), false);
  assert.equal(p.getDialogueManager().isActive(), true);
  assert.equal(Common.progress(p), 0);
});

test('a claim with a full inventory and no sticks held is refused, and the villager stays due', (t) => {
  const p = villager(t);
  login(p); // the villagers' chat_ varbits, so Murcaily resolves as the player sees him
  Common.advance(p, 4);
  Favour.gain(p, 500);
  p.getInventory().add(new Item(obj('bones'), 28));
  talk(p, 'Murcaily');
  continueAll(p);
  assert.ok(p.messages.includes("You don't have enough inventory space."));
  assert.equal(Favour.points(p), 500);
  assert.equal(Villagers.cooldownOf(p, Common.data.villagers.find((v) => v.name === 'Murcaily')), 1);
});

test("My Arm's Big Adventure reads, spends and hands over favour through the cleanup's events", (t) => {
  const p = villager(t);
  Favour.gain(p, 650);
  const ask = { player: p, percentage: 0 };
  PluginManager.emitCustomEvent('tai-bwo-wannai-cleanup:favour', ask);
  assert.equal(ask.percentage, 65);
  PluginManager.emitCustomEvent('tai-bwo-wannai-cleanup:spend-favour', { player: p, percentage: 60 });
  assert.equal(Favour.points(p), 50);
  // Favour the quest granted itself before the minigame existed moves over once at login.
  p.setAttribute('my-arms-big-adventure:tai-bwo-favour', 60);
  login(p);
  assert.equal(Favour.points(p), 650);
  assert.equal(p.getAttribute('my-arms-big-adventure:tai-bwo-favour'), 0);
  login(p);
  assert.equal(Favour.points(p), 650, 'only once');
  assert.equal(varbit(p, 'favour_percentage'), 65, 'one owner of the varbit');
});

test('logged in inside the village, the overlay waits for the welcome screen, then comes back', (t) => {
  const p = villager(t);
  Favour.gain(p, 10);
  assert.equal(varbit(p, 'tbw_overlayopen'), 1);
  login(p);
  const mounts = [];
  const sender = p.getPacketSender();
  const sub = sender.sendSubInterface;
  t.mock.method(sender, 'sendSubInterface', function (uid, id) { mounts.push(id); return sub.apply(this, arguments); });
  // The welcome screen's Play, as the button packet dispatches it: the overlay goes on its gameframe.
  PluginManager.emitInterfaceActionClick({ player: p, buttonId: (378 << 16) | 72, action: 1, handled: false });
  assert.deepEqual(mounts, [core.CacheDefinitions.getInterfaceId('village_community_score')]);
  assert.equal(varbit(p, 'tbw_overlayopen'), 1);
});
