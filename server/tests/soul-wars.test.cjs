// Run after `yarn build`: node --test tests/soul-wars.test.cjs
//
// Soul Wars against the rsprox recordings (227/00079, 234/03277, 229/00668) and the Wiki: the
// lobby and countdown, the start, avatars, the obelisk, area control, deaths and barriers,
// supplies, bones, activity and the end with Zeal.
const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const { TaskManager } = require('../dist/game/task/TaskManager');
const { Location } = require('../dist/game/model/Location');

let Common, Lobby, Match, Avatars, Control, Souls, Death, Supplies, hooks, core;
const online = [];
let config = {};

before(() => {
  CachePipeline.initialize();
  RegionManager.init();
  new NpcDefinitionLoader().load();
  core = PluginManager.getCoreApi();
  hooks = { objects: new Map(), items: new Map(), prompts: [], death: [], drops: [] };
  const api = {
    core,
    persistAttribute() {},
    getPluginConfig: (key, fallback) => config[key] ?? fallback,
    onObjectInteraction: (name, actions) => { for (const [op, fn] of Object.entries(actions)) hooks.objects.set(`${name}:${op}`, fn); },
    onItemAction: (name, actions) => { for (const [op, fn] of Object.entries(actions)) hooks.items.set(`${name}:${op}`, fn); },
    onNpcHitModify: (fn) => { hooks.hit = fn; },
    onNpcDeath: (fn) => { (hooks.npcDeath ??= []).push(fn); },
    onPlayerDeath: (fn) => hooks.death.push(fn),
    onPlayerBeforeDeath: (fn) => { hooks.beforeDeath = fn; },
    registerArea: (area) => { hooks.lobbyArea = area; },
    onShouldDropItemsOnDeath: (fn) => hooks.drops.push(fn),
    onPlayerLogin() {},
    onPlayerLogout() {},
    onCustomEvent: (name, fn) => { (hooks.events ??= {})[name] = fn; },
    sendMultiChatboxPrompt: (player, title, ...args) => hooks.prompts.push({ player, title, args }),
  };
  require('../plugins/minigames/SoulWars.plugin').register(api);
  Common = require('../plugins/minigames/soulwars/Common.SoulWars');
  Lobby = require('../plugins/minigames/soulwars/Lobby.SoulWars');
  Match = require('../plugins/minigames/soulwars/Match.SoulWars');
  Avatars = require('../plugins/minigames/soulwars/Avatars.SoulWars');
  Control = require('../plugins/minigames/soulwars/Control.SoulWars');
  Souls = require('../plugins/minigames/soulwars/Souls.SoulWars');
  Death = require('../plugins/minigames/soulwars/Death.SoulWars');
  Supplies = require('../plugins/minigames/soulwars/Supplies.SoulWars');
  Lobby.source.players = () => online;
});

beforeEach(() => {
  Match.reset();
  online.length = 0;
  config = {};
  hooks.prompts.length = 0;
  ticks(2);
});

function container(capacity = 28) {
  const slots = [];
  return {
    slots,
    add(item) { const slot = slots.find((s) => s.id === item.getId() && core.ItemDefinition.forId(item.getId()).isStackable()); if (slot) slot.amount += item.getAmount(); else slots.push({ id: item.getId(), amount: item.getAmount() }); },
    delete(id, amount = 1) { for (const s of slots) { if (s.id !== id || amount <= 0) continue; const n = Math.min(s.amount, amount); s.amount -= n; amount -= n; } },
    contains: (id) => slots.some((s) => s.id === id && s.amount > 0),
    getAmount: (id) => slots.filter((s) => s.id === id).reduce((sum, s) => sum + s.amount, 0),
    getFreeSlots: () => capacity - slots.filter((s) => s.amount > 0).length,
    getValidItems: () => slots.filter((s) => s.amount > 0).map((s) => ({ getId: () => s.id, getAmount: () => s.amount })),
    refreshItems() {}, full() {},
  };
}

let index = 0;
function fakePlayer({ combat = 100, total = 1500, at = new Location(2192, 2842, 0) } = {}) {
  const id = ++index;
  const attributes = new Map();
  const levels = {};
  const p = {
    location: at, messages: [], varbits: new Map(), varps: new Map(), texts: new Map(), subs: [], scripts: [], anims: [], graphics: [], hp: 99,
    inventory: container(), worn: [],
    getIndex: () => id, getUsername: () => `Soul${id}`, isPlayer: () => true, isNpc: () => false, getAsPlayer: () => p, isRegistered: () => true,
    getLocation: () => p.location, moveTo(l) { p.location = l; }, setLocation(l) { p.location = l; }, getArea: () => p.area, setArea(a) { p.area = a; },
    getPrivateArea: () => null,
    getAttribute: (k) => attributes.get(k), setAttribute: (k, v) => attributes.set(k, v),
    getInventory: () => p.inventory,
    getEquipment: () => ({ getItems: () => p.worn, setItem(slot, item) { p.worn[slot] = item.getId() > 0 ? item : null; }, refreshItems() {} }),
    getUpdateFlag: () => ({ flag() {} }),
    sendMessage: (m) => p.messages.push(m),
    performAnimation: (a) => p.anims.push(a.getId()),
    performGraphic: (g) => p.graphics.push(g.getId()),
    getHitpoints: () => p.hp, setHitpoints(v) { p.hp = v; },
    getRunEnergy: () => p.run ?? 100, setRunEnergy(v) { p.run = v; },
    getPoisonDamage: () => p.poison ?? 0, setPoisonDamage(v) { p.poison = v; },
    setEnteredAmountAction(action) { p.amountAction = action; },
    getSkillManager: () => ({
      getCombatLevel: () => combat, getTotalLevel: () => total,
      getCurrentLevel: (skill) => levels[skill.getName?.() ?? skill] ?? 99, getMaxLevel: () => 99,
      setCurrentLevel(skill, level) { levels[skill.getName?.() ?? skill] = level; return this; },
    }),
    getPacketSender() {
      const sender = {
        sendVarbit: (vid, value) => { p.varbits.set(vid, value); return sender; },
        sendConfig: (vid, value) => { p.varps.set(vid, value); return sender; },
        sendString: (text, cid) => { p.texts.set(cid, text); return sender; },
        sendSubInterface: (uid, iid) => { p.subs.push(iid); return sender; },
        closeSubInterface: () => sender,
        sendInterfaceScript: (sid, args) => { p.scripts.push([sid, args]); return sender; },
        sendSong: () => sender, sendEnterAmountPrompt: () => sender,
      };
      return sender;
    },
  };
  return p;
}

function ticks(count) {
  for (let i = 0; i < count; i++) TaskManager.process();
}

const varbit = (p, name) => p.varbits.get(Common.varbitId(name));
const text = (p, name) => p.texts.get(Common.component(name));

/** A game under way with `count` players. */
function startGame(count = 4) {
  const players = Array.from({ length: count }, (_, i) => fakePlayer({ combat: 120 - i * 10 }));
  const game = new Match.Game(players);
  game.start();
  return { game, players };
}

/** Puts `player` on template tile [x, y] in the game's arena. */
function place(game, player, x, y) {
  player.location = game.area.at([x, y, 0]);
}

// ------------------------------------------------------------------ lobby

test('lobby: "N/20" below the minimum; the countdown runs 290 ticks once met, "shortly" 20 before', () => {
  const players = [fakePlayer(), fakePlayer()];
  online.push(...players);
  ticks(1);
  assert.equal(text(players[0], 'soul_wars_lobby:players_text'), '2/20');
  assert.equal(text(players[0], 'soul_wars_lobby:time_text'), '-');
  config['SoulWars:minPlayers'] = 2;
  ticks(1);
  assert.equal(text(players[0], 'soul_wars_lobby:players_text'), '2');
  assert.equal(text(players[0], 'soul_wars_lobby:time_text'), '3 minutes');
  ticks(269);
  assert.ok(players[0].messages.includes('The next Soul Wars game will start shortly.'));
  assert.equal(Match.current, null);
  ticks(20);
  assert.ok(Match.current, 'the game starts at 290');
  assert.ok(players.every((p) => Match.gameOf(p)));
});

test('the waiting-area barrier: refusals, in, and out after asking', () => {
  const p = fakePlayer({ at: new Location(2200, 2842, 0) });
  const barrier = { getId: () => core.CacheDefinitions.getLocId('soul_wars_main_waiting_area_barrier') };
  p.worn[1] = new core.Item(1007, 1);
  hooks.objects.get('Barrier:Pass')({ player: p, object: barrier });
  assert.equal(p.messages.at(-1), "You can't enter a waiting area while wearing something on your back.");
  p.worn[1] = null;
  p.inventory.add(new core.Item(379, 1));
  hooks.objects.get('Barrier:Pass')({ player: p, object: barrier });
  assert.equal(p.messages.at(-1), 'Food, potions, capes, followers and non-combat items are all restricted.');
  p.inventory.delete(379, 1);
  hooks.objects.get('Barrier:Pass')({ player: p, object: barrier });
  assert.deepEqual([p.location.getX(), p.location.getY()], [2198, 2842]);
  hooks.objects.get('Barrier:Pass')({ player: p, object: barrier });
  assert.equal(hooks.prompts.at(-1).title, 'Are you sure you want to leave?');
  hooks.prompts.at(-1).args[1]();
  assert.deepEqual([p.location.getX(), p.location.getY()], [2199, 2842]);
  const weak = fakePlayer({ combat: 30, at: new Location(2200, 2842, 0) });
  hooks.objects.get('Barrier:Pass')({ player: weak, object: barrier });
  assert.equal(weak.messages.at(-1), 'You need a total level of 500 and a combat level of 40 to play Soul Wars.');
});

// ------------------------------------------------------------------ the start

test('the start: balanced teams in their bases, the varbits, capes, HUD and lines', () => {
  const { game, players } = startGame(4);
  assert.equal(game.members.blue.size, 2);
  assert.equal(game.members.red.size, 2);
  for (const p of players) {
    const team = game.teamOf(p);
    assert.equal(varbit(p, 'soul_wars_team'), team === 'blue' ? 1 : 2);
    assert.equal(varbit(p, 'soul_wars_obelisk_alignment'), 60);
    assert.equal(p.worn[1].getId(), Common.data.items.capes[team]);
    const [x, y] = game.area.templateOf(p.location);
    const [bx, by] = Common.data.bases[team];
    assert.ok(Math.abs(x - bx) <= 1 && Math.abs(y - by) <= 1, 'in its base');
    assert.ok(p.messages.includes('The game of Soul Wars has begun!'));
    assert.deepEqual(p.scripts.find(([id]) => id === 370), [370, [1501]]);
  }
  ticks(1);
  assert.equal(text(players[0], 'soul_wars_game:blue_kills'), '0/5');
  assert.equal(text(players[0], 'soul_wars_game:red_strength'), '100%');
});

// ------------------------------------------------------------------ avatars

function hitOn(npc, attacker, damage) {
  const parts = [{ d: damage, getDamage() { return this.d; }, setDamage(v) { this.d = v; } }];
  return { getAttacker: () => attacker, getHits: () => parts, updateTotalDamage() {}, getTotalDamage: () => parts[0].d, parts };
}

test('avatar strength blocks its share of each hit; at 100% nothing lands, with the line', () => {
  const { game, players } = startGame(2);
  const red = players.find((p) => game.teamOf(p) === 'red');
  const blueAvatar = game.avatars.blue.npc;
  const hit = hitOn(blueAvatar, red, 40);
  hooks.hit({ npc: blueAvatar, hit });
  assert.equal(hit.parts[0].d, 0);
  assert.equal(red.messages.at(-1), 'Your attacks seem to have no effect on the avatar.');
  Avatars.adjust(game, 'blue', -48);
  const second = hitOn(blueAvatar, red, 40);
  hooks.hit({ npc: blueAvatar, hit: second });
  assert.equal(second.parts[0].d, 19, '52% blocked, rounded down');
  assert.equal(game.statsOf(red).damage, 19);
});

test('a defeated avatar: the line, a kill, and its return 35 ticks later at full strength', () => {
  const { game, players } = startGame(2);
  const npc = game.avatars.blue.npc;
  Avatars.adjust(game, 'blue', -60);
  for (const fn of hooks.npcDeath) fn({ npc, killer: players[0], location: { x: 0, y: 0, z: 0 } });
  assert.ok(players[0].messages.includes('<col=ff3232>The red team has defeated the Avatar of Creation!</col>'));
  assert.equal(game.kills.red, 1);
  assert.equal(game.avatars.blue.alive, false);
  ticks(34);
  assert.equal(game.avatars.blue.alive, false);
  ticks(1);
  assert.equal(game.avatars.blue.alive, true);
  assert.equal(game.avatars.blue.strength, 100);
  assert.ok(players[0].messages.includes('<col=3366ff>The Avatar of Creation has returned!</col>'));
});

// ------------------------------------------------------------------ the obelisk

test('the obelisk: 2% a fragment when held, 0.5% when not (with the hint), and the refusals', () => {
  const { game, players } = startGame(2);
  const red = players.find((p) => game.teamOf(p) === 'red');
  const sacrifice = () => hooks.objects.get('Soul Obelisk:Sacrifice-fragments')({ player: red, object: null });
  sacrifice();
  assert.equal(red.messages.at(-1), "You don't have any soul fragments to sacrifice.");
  red.inventory.add(new core.Item(25201, 2));
  sacrifice();
  assert.equal(game.avatars.blue.strength, 99);
  assert.deepEqual(red.messages.slice(-2), ['You charge the Soul Obelisk with soul fragments and weaken the enemy avatar.', 'Your soul fragments will have a greater effect if your team controls the Soul Obelisk.']);
  game.control.obelisk.holder = 'red';
  red.inventory.add(new core.Item(25201, 4));
  sacrifice();
  assert.equal(game.avatars.blue.strength, 91);
  assert.equal(game.statsOf(red).fragments, 6);
  Avatars.adjust(game, 'blue', -100);
  red.inventory.add(new core.Item(25201, 1));
  sacrifice();
  assert.equal(red.messages.at(-1), "You don't need to do that as the enemy avatar has already been fully weakened.");
});

test("the arena's creatures: souls drop 2 fragments, wolves bones, in place of their tables", () => {
  const { game } = startGame(2);
  const souls = [...Souls.CREATURE_OF].filter(([, c]) => c.game === game);
  const counts = { weak: 0, strong: 0, wolf: 0 };
  for (const [, c] of souls) counts[c.kind]++;
  assert.deepEqual(counts, { weak: 8, strong: 4, wolf: 4 });
  const [soul] = souls.find(([, c]) => c.kind === 'weak');
  const roll = { npc: soul, drops: [{ itemId: 25196, amount: 2 }] };
  hooks.events['npc-drops:roll'](roll);
  assert.deepEqual(roll.drops, [{ itemId: 25201, amount: 2 }]);
  const [wolf] = souls.find(([, c]) => c.kind === 'wolf');
  const wolfRoll = { npc: wolf, drops: [] };
  hooks.events['npc-drops:roll'](wolfRoll);
  assert.deepEqual(wolfRoll.drops, [{ itemId: 25199, amount: 1 }]);
});

// ------------------------------------------------------------------ control

test('control: a majority moves the alignment, captures at the end with the line, drifts back', () => {
  const { game, players } = startGame(4);
  const reds = players.filter((p) => game.teamOf(p) === 'red');
  for (const p of reds) place(game, p, 2206, 2908);
  ticks(1);
  assert.equal(game.control.obelisk.alignment, 64, '2 a player of majority');
  assert.equal(varbit(players[0], 'soul_wars_obelisk_contested'), 2);
  ticks(14);
  assert.equal(game.control.obelisk.holder, 'red');
  assert.ok(players[0].messages.includes('<col=ff3232>The red team has taken control of the Soul Obelisk!</col>'));
  assert.equal(varbit(players[0], 'soul_wars_obelisk_holder'), 2);
  assert.equal(game.statsOf(reds[0]).areas, 1);
  const blues = players.filter((p) => game.teamOf(p) === 'blue');
  for (const p of reds) place(game, p, 2141, 2908);
  place(game, blues[0], 2206, 2908);
  ticks(3);
  assert.equal(game.control.obelisk.alignment, 114);
  place(game, blues[0], 2141, 2908);
  ticks(3);
  assert.equal(game.control.obelisk.alignment, 120, 'drifts back to its holder');
});

// ------------------------------------------------------------------ deaths

test("a death: no items lost, bones dropped, back in the team's graveyard as a ghost", () => {
  const { game, players } = startGame(2);
  const [a, b] = players;
  const team = game.teamOf(a);
  const event = { player: a, killer: b, handled: false };
  for (const fn of hooks.death) fn(event);
  assert.equal(event.handled, true);
  const keep = { player: a, shouldDrop: true };
  for (const fn of hooks.drops) fn(keep);
  assert.equal(keep.shouldDrop, false);
  const [x, y] = game.area.templateOf(a.location);
  assert.deepEqual([x, y], Common.data.bases[team].slice(0, 2), 'no graveyard held: the base');
  assert.equal(varbit(a, 'soul_wars_recent_death'), 1);
  assert.equal(game.statsOf(b).kills, 1);
  assert.equal(game.isGhost(a), true);
  ticks(17);
  assert.equal(game.isGhost(a), false);
  assert.equal(varbit(a, 'soul_wars_recent_death'), 0);

  game.control.east.holder = team;
  for (const fn of hooks.death) fn({ player: a, killer: null, handled: false });
  const [gx, gy] = game.area.templateOf(a.location);
  assert.ok(Common.data.graveyards.east.respawn.some(([rx, ry]) => rx === gx && ry === gy), 'the held graveyard');
});

test('a sanctuary lets the living out only; the ghost waits', () => {
  const { game, players } = startGame(2);
  const [a] = players;
  game.control.east.holder = game.teamOf(a);
  for (const fn of hooks.death) fn({ player: a, killer: null, handled: false });
  const barrier = { getLocation: () => game.area.at([2253, 2923, 0]), getId: () => 40458 };
  hooks.objects.get('Neutral Barrier:Pass')({ player: a, object: barrier });
  assert.match(a.messages.at(-1), /^You must wait for another \d+ seconds? before you rejoin the battle\.$/);
  ticks(17);
  place(game, a, 2253, 2924);
  hooks.objects.get('Neutral Barrier:Pass')({ player: a, object: barrier });
  assert.deepEqual(game.area.templateOf(a.location).slice(0, 2), [2253, 2922]);
  assert.equal(game.isImmune(a), true);
  hooks.objects.get('Neutral Barrier:Pass')({ player: a, object: barrier });
  assert.equal(a.messages.at(-1), 'You can only exit this sanctuary, not enter it.');
});

test("teammates can't fight; enemies can", () => {
  const { game, players } = startGame(4);
  const [a, b] = [...game.members.blue];
  const [c] = [...game.members.red];
  assert.equal(game.canAttack(a, b), false);
  assert.equal(a.messages.at(-1), "You can't attack your teammates!");
  assert.equal(game.canAttack(a, c), true);
  assert.equal(game.canAttack(a, game.avatars.blue.npc), false, 'nor their own avatar');
  assert.equal(game.canAttack(a, game.avatars.red.npc), true);
  assert.ok(players.length === 4);
});

// ------------------------------------------------------------------ supplies, bones, activity

test('tables give 1, 5, 10 or X; a potion boosts by 5 + 15%; a bandage heals 1 + 15%', () => {
  const { game, players } = startGame(2);
  const [a] = players;
  const table = { getId: () => 40463 };
  hooks.objects.get('Bandage table:Take-5')({ player: a, object: table });
  assert.equal(a.inventory.getAmount(25202), 5);
  const potions = { getId: () => 40469 };
  hooks.objects.get('Potion of power table:Take-1')({ player: a, object: potions });
  assert.equal(a.inventory.getAmount(25203), 1);
  hooks.items.get('Potion of power(4):Drink')({ player: a, itemId: 25203 });
  assert.equal(a.messages.at(-1), 'You use a potion to boost yourself.');
  assert.equal(a.inventory.getAmount(25204), 1, 'three doses left');
  assert.equal(a.getSkillManager().getCurrentLevel(core.Skill.ATTACK), 99 + 5 + 14);
  hooks.items.get('Bandages:Heal')({ player: a, itemId: 25202 });
  assert.equal(a.messages.at(-1), 'You do not currently need bandaging.');
  a.hp = 50;
  hooks.items.get('Bandages:Heal')({ player: a, itemId: 25202 });
  assert.equal(a.hp, 50 + 1 + 14);
  assert.equal(a.inventory.getAmount(25202), 4);
  assert.ok(game);
});

test("bones buried in the base restore the team's avatar 1%; ordinary bones are left alone", () => {
  const { game, players } = startGame(2);
  const [a] = players;
  const team = game.teamOf(a);
  Avatars.adjust(game, team, -10);
  a.inventory.add(new core.Item(25199, 1));
  hooks.items.get('Bones:Bury')({ player: a, itemId: 25199 });
  assert.equal(game.avatars[team].strength, 91);
  assert.equal(game.statsOf(a).bones, 1);
  assert.equal(hooks.items.get('Bones:Bury')({ player: a, itemId: 526 }), false, 'normal bones fall through');
});

test('the activity bar falls 3 a tick from 18 ticks in; an empty one removes the player', () => {
  const { game, players } = startGame(2);
  const [a] = players;
  ticks(17);
  assert.equal(game.activity.get(a), 800);
  ticks(1);
  assert.equal(game.activity.get(a), 797);
  game.active(a);
  assert.equal(game.activity.get(a), 800);
  game.activity.set(a, 3);
  ticks(1);
  assert.equal(Match.gameOf(a), null);
  assert.equal(a.messages.at(-1), 'You have been removed from the game for inactivity.');
  assert.equal(Supplies.banned(a), true);
});

// ------------------------------------------------------------------ the end

test('five kills end it two ticks on: the winners, Zeal, the stats and the end screen', () => {
  const { game, players } = startGame(2);
  for (let i = 0; i < 5; i++) game.scored('red');
  ticks(2);
  assert.equal(game.over, true);
  for (const p of players) {
    assert.ok(p.messages.includes('<col=ff3232>The red team was victorious!</col>'));
    assert.equal(varbit(p, 'soul_wars_team'), 0);
    assert.equal(p.worn[1], null, 'the cape is gone');
    assert.ok(p.messages.some((m) => /^You earned \d+ Zeal\.$/.test(m)));
    assert.equal(text(p, 'soul_wars_game_end:red_score_text'), '5');
    assert.deepEqual([p.location.getX(), p.location.getY()], Common.data.lobby.afterGame.slice(0, 2));
  }
  const winner = players.find((p) => Common.getVarp(p, 'total_wins') === 1);
  assert.ok(winner, 'the red player counts a win');
});

test('on time, equal kills is a draw', () => {
  const { game, players } = startGame(2);
  game.scored('blue');
  game.scored('red');
  const drain = Common.data.activity.drain;
  Common.data.activity.drain = 0;
  ticks(1500);
  Common.data.activity.drain = drain;
  assert.equal(game.over, true);
  assert.ok(players[0].messages.includes('The game has ended in a draw!'));
  assert.ok(players[0].messages.includes('Time remaining: 12:30'));
});

test('a side with nobody left concedes', () => {
  const { game, players } = startGame(2);
  const red = players.find((p) => game.teamOf(p) === 'red');
  const blue = players.find((p) => game.teamOf(p) === 'blue');
  game.remove(red);
  ticks(1);
  assert.equal(game.over, true);
  assert.ok(blue.messages.includes('<col=3366ff>The blue team was victorious!</col>'));
});

// ------------------------------------------------------------------ review fixes

test('logging out mid-game saves the player in the lobby, not on the instance', () => {
  const { game, players } = startGame(4);
  const [a] = players;
  game.area.leave(a, true);
  assert.deepEqual([a.location.getX(), a.location.getY()], Common.data.lobby.afterGame.slice(0, 2));
  assert.equal(Match.gameOf(a), null);
  assert.equal(a.worn[1], null, 'the team cape went with the game');
});

test('a death that began in the game ends there, even if the game ends meanwhile', () => {
  const { game, players } = startGame(2);
  const [a] = players;
  hooks.beforeDeath({ player: a });
  game.finish('red');
  const keep = { player: a, shouldDrop: true };
  for (const fn of hooks.drops) fn(keep);
  assert.equal(keep.shouldDrop, false, 'nothing is lost');
  const event = { player: a, killer: null, handled: false };
  for (const fn of hooks.death) fn(event);
  assert.equal(event.handled, true, 'not to Lumbridge');
  assert.deepEqual([a.location.getX(), a.location.getY()], Common.data.lobby.afterGame.slice(0, 2));
});

test('a cape put on while waiting keeps that player out of the game, and the cape on them', () => {
  config['SoulWars:minPlayers'] = 2;
  const players = [fakePlayer(), fakePlayer(), fakePlayer()];
  online.push(...players);
  ticks(2);
  players[2].worn[1] = new core.Item(6570, 1);
  ticks(290);
  assert.ok(Match.current);
  assert.equal(Match.gameOf(players[2]), null);
  assert.equal(players[2].worn[1].getId(), 6570);
  assert.equal(players[2].messages.at(-1), "You can't enter a waiting area while wearing something on your back.");
});

test('a finished game lets go of its avatars and creatures', () => {
  const { game } = startGame(2);
  assert.ok([...Avatars.AVATAR_OF.values()].some((f) => f.game === game));
  game.finish(null);
  assert.equal([...Avatars.AVATAR_OF.values()].some((f) => f.game === game), false);
  assert.equal([...Souls.CREATURE_OF.values()].some((f) => f.game === game), false);
});

test('the minimum is never under 2, and one category alone does not make full Zeal', () => {
  config['SoulWars:minPlayers'] = 1;
  assert.equal(Lobby.minPlayers(), 2);
  const { game, players } = startGame(2);
  const [a] = players;
  game.elapsed = 2000;
  game.statsOf(a).bones = 15;
  assert.ok(game.zealFor(a, 'win') < 60);
  Object.assign(game.statsOf(a), { fragments: 30, areas: 6, damage: 260 });
  assert.equal(game.zealFor(a, 'win'), 60);
});

test('a ghost cannot charge the obelisk; an unheld, uncontested place drifts back to neutral', () => {
  const { game, players } = startGame(2);
  const [a] = players;
  for (const fn of hooks.death) fn({ player: a, killer: null, handled: false });
  a.inventory.add(new core.Item(25201, 2));
  hooks.objects.get('Soul Obelisk:Sacrifice-fragments')({ player: a, object: null });
  assert.equal(a.inventory.getAmount(25201), 2);
  game.control.obelisk.alignment = 70;
  ticks(5);
  assert.equal(game.control.obelisk.alignment, 60);
});
