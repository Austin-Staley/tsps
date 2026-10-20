// Run after `yarn build`: node --test tests/guardians-of-the-rift.test.cjs
const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { TaskManager } = require('../dist/game/task/TaskManager');
const { Location } = require('../dist/game/model/Location');
const Shared = require('../plugins/minigames/guardiansoftherift/Shared.GuardiansOfTheRift');
const Game = require('../plugins/minigames/guardiansoftherift/Game.GuardiansOfTheRift');
const Records = require('../plugins/minigames/guardiansoftherift/Records.GuardiansOfTheRift');
const Temple = require('../plugins/minigames/guardiansoftherift/Temple.GuardiansOfTheRift');
const Barrier = require('../plugins/minigames/guardiansoftherift/Barrier.GuardiansOfTheRift');
const GreatGuardian = require('../plugins/minigames/guardiansoftherift/GreatGuardian.GuardiansOfTheRift');
const Rewards = require('../plugins/minigames/guardiansoftherift/Rewards.GuardiansOfTheRift');

const hooks = { objects: {}, npcs: {}, custom: {}, login: [], logout: [], conditions: [], areas: [], prompts: [], dialogues: [] };

function fakeApi() {
  return {
    core: PluginManager.getCoreApi(),
    persistAttribute() {},
    onServerStartup() {},
    registerCommand() {},
    registerArea: (area) => hooks.areas.push(area),
    onPlayerLogin: (handler) => hooks.login.push(handler),
    onPlayerLogout: (handler) => hooks.logout.push(handler),
    onObjectInteraction: (name, actions) => { hooks.objects[name] = actions; },
    onNpcInteraction: (name, actions) => { hooks.npcs[name] = actions; },
    onNpcDialogueCondition: (handler) => hooks.conditions.push(handler),
    onCustomEvent: (name, handler) => (hooks.custom[name] ??= []).push(handler),
    emitCustomEvent: (name, payload) => {
      if (name === 'quest:is-complete') payload.complete = payload.player.questDone;
      if (name === 'npc-dialogue:start') { hooks.dialogues.push(payload.variant); payload.handled = true; }
      for (const handler of hooks.custom[name] ?? []) handler(payload);
    },
    sendMultiChatboxPrompt: (player, title, ...args) => hooks.prompts.push({ player, title, args }),
  };
}

function container(size) {
  const slots = new Array(size).fill(null);
  const self = {
    slots,
    add(id, amount = 1) {
      const stack = slots.find((slot) => slot?.id === id);
      if (stack) stack.amount += amount;
      else slots[slots.indexOf(null)] = { id, amount };
      return self;
    },
    delete(id, amount = 1) {
      for (let i = 0; i < slots.length && amount > 0; i++) {
        if (slots[i]?.id !== id) continue;
        const taken = Math.min(amount, slots[i].amount);
        slots[i].amount -= taken;
        amount -= taken;
        if (slots[i].amount <= 0) slots[i] = null;
      }
      return self;
    },
    contains: (id) => slots.some((slot) => slot?.id === id),
    getAmount: (id) => slots.reduce((sum, slot) => sum + (slot?.id === id ? slot.amount : 0), 0),
    getFreeSlots: () => slots.filter((slot) => !slot).length,
    refreshItems() { return self; },
  };
  return self;
}

function fakePlayer(name = 'Tester', { runecraft = 99, questDone = true, x = 3615, y = 9480 } = {}) {
  const varbits = new Map();
  const attributes = new Map();
  const p = {
    name, questDone, messages: [], statements: [], scripts: [], interfaces: [], animations: [], jingles: [],
    xpBySkill: {}, runEnergy: 50, special: 100,
    location: new Location(x, y, 0),
    inventory: container(28),
    isRegistered: () => true,
    isPlayer: () => true,
    getAsPlayer: () => p,
    getUsername: () => name,
    getLocation: () => p.location,
    getSize: () => 1,
    getPrivateArea: () => null,
    getIndex: () => 1,
    moveTo(location) { p.location = location; },
    getMovementQueue: () => ({ reset() {} }),
    setPositionToFace() {},
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    sendMessage: (message) => p.messages.push(message),
    getInventory: () => p.inventory,
    performAnimation: (animation) => p.animations.push(animation.getId?.() ?? animation.id),
    performGraphic() {},
    getSpecialPercentage: () => p.special,
    getRunEnergy: () => p.runEnergy,
    setRunEnergy: (value) => { p.runEnergy = Math.min(100, value); },
    getSkillManager: () => ({
      getMaxLevel: () => runecraft,
      addExperiences(skill, amount) {
        const key = skill?.getName?.() ?? String(skill);
        p.xpBySkill[key] = (p.xpBySkill[key] ?? 0) + amount;
      },
    }),
    getDialogueManager: () => ({ startDialogues: (chain) => p.statements.push(chain) }),
    getPacketSender() {
      const sender = {
        sendVarbit: (id, value) => { varbits.set(id, value); return sender; },
        getVarbit: (id) => varbits.get(id) ?? 0,
        sendConfig: (id, value) => { varbits.set(`varp${id}`, value); return sender; },
        sendSubInterface: (uid, id) => { p.interfaces.push(id); return sender; },
        closeSubInterface: () => { p.interfaces.push(-1); return sender; },
        sendClientScript: (id, ...args) => { p.scripts.push([id, ...args]); return sender; },
        sendTypedMessage: (type, message) => { p.messages.push(message); return sender; },
        sendJingle: (id) => { p.jingles.push(id); return sender; },
        sendSound: () => sender,
        sendRunEnergy: () => sender,
        sendProjectile: () => sender,
      };
      return sender;
    },
    varbit: (name) => varbits.get(Shared.core().CacheDefinitions.getVarbitId(name)) ?? 0,
    varp: (name) => varbits.get(`varp${Shared.core().CacheDefinitions.getVarpId(name)}`) ?? 0,
    lastHud: () => p.scripts.filter((s) => s[0] === Shared.SCRIPT.HUD_UPDATE).at(-1)?.slice(1),
  };
  return p;
}

function ticks(count) {
  for (let i = 0; i < count; i++) {
    Game.tick();
    TaskManager.process();
  }
}

function barrier(player, option) {
  return hooks.objects.Barrier[option]({ player, objectId: Shared.loc(Shared.LOC.BARRIER) });
}

function statementText(player) {
  const chain = player.statements.at(-1);
  return JSON.stringify(chain ? [...chain.dialogues.values()] : null);
}

/** A game with this player in it, the rift open. */
function openGame(player) {
  barrier(player, 'Quick-pass');
  Game.skip();
  ticks(1);
}

function resetGame() {
  for (const player of Game.players()) Game.leave(player);
  const game = Game._game;
  Object.assign(game, { phase: Game.PHASE.LOBBY, timer: 100, elapsed: 0, power: 0, surged: false });
  game.altars = { elemental: 0, catalytic: 0, changesIn: 0 };
  game.portal = { direction: 0, closesIn: 0, opensIn: 0 };
}

before(() => {
  CachePipeline.initialize();
  RegionManager.init();
  const api = fakeApi();
  Shared.bind(api);
  Records.attach(api);
  Temple.attach(api);
  Barrier.attach(api);
  GreatGuardian.attach(api);
  Rewards.attach(api);
});

beforeEach(() => {
  resetGame();
  hooks.prompts.length = 0;
  hooks.dialogues.length = 0;
});

test('power follows the Wiki: 250 stones a player, 200 past the 20th (the captured maximums fit it)', () => {
  assert.equal(Game.maxPowerFor(0), 250);
  assert.equal(Game.maxPowerFor(1), 250);
  assert.equal(Game.maxPowerFor(20), 5000);
  assert.equal(Game.maxPowerFor(21), 5200);
  assert.equal(Game.maxPowerFor(454), 91800, 'rev 241 capture: 91,800 at the open');
});

test('points: one per 100 energy and the rest as a chance (the captured games: 165/407 -> 2/4)', () => {
  assert.equal(Rewards.pointsFor(165, () => 0.9), 1);
  assert.equal(Rewards.pointsFor(165, () => 0.5), 2);
  assert.equal(Rewards.pointsFor(407, () => 0.5), 4);
  assert.equal(Rewards.pointsFor(11, () => 0.5), 0);
  assert.equal(Rewards.pointsFor(300, () => 0), 3);
});

test('the barrier needs the quest and 27 Runecraft, and steps through two tiles', () => {
  const newcomer = fakePlayer('Newcomer', { questDone: false });
  barrier(newcomer, 'Quick-pass');
  assert.match(statementText(newcomer), /Temple of the Eye/);
  assert.equal(newcomer.location.getY(), 9480);
  const novice = fakePlayer('Novice', { runecraft: 26 });
  barrier(novice, 'Quick-pass');
  assert.match(statementText(novice), /27/);

  const player = fakePlayer();
  barrier(player, 'Quick-pass');
  assert.equal(player.location.getY(), 9484);
  assert.equal(player.varbit(Shared.VARBIT.IS_PLAYING), 1);
  assert.equal(player.varp(Shared.VARP.GAME_ID), 0, 'in the lobby the id comes with the open');
  assert.equal(player.interfaces.at(-1), Shared.iface(Shared.INTERFACE.HUD));
  assert.equal(Game.isPlaying(player), true);
});

test('the lobby counts down 30/10/5 seconds and 3, 2, 1, then the rift opens at 10% power', () => {
  const player = fakePlayer();
  barrier(player, 'Quick-pass');
  Game._game.timer = 51;
  ticks(51);
  assert.deepEqual(player.messages.slice(0, 7), [
    'The rift will become active in 30 seconds.',
    'The rift will become active in 10 seconds.',
    'The rift will become active in 5 seconds.',
    '3...', '2...', '1...',
    '<col=ef1020>The rift becomes active!',
  ]);
  assert.equal(Game.phase(), Game.PHASE.PREPARE);
  assert.notEqual(player.varp(Shared.VARP.GAME_ID), 0);
  assert.equal(player.varbit(Shared.VARBIT.FINISHED_GAME), 0);
  ticks(1);
  assert.ok(player.messages.includes('Creatures from the Abyss will attack in 120 seconds.'));
  ticks(1);
  const hud = player.lastHud();
  assert.deepEqual(hud.slice(0, 4), [0, 0, 25, 250], 'a solo game: 25 of 250');
  assert.equal(hud[9], 198, 'the timer counts to the attack');
});

test('the creatures attack at 200 ticks and the altars change every 33', () => {
  const player = fakePlayer();
  openGame(player);
  ticks(199);
  assert.equal(Game.phase(), Game.PHASE.PREPARE);
  ticks(1);
  assert.equal(Game.phase(), Game.PHASE.ATTACK);
  assert.equal(player.messages.at(-1), '<col=ef1020>Creatures from the Abyss begin their attack!</col>');
  const first = Game.activeAltars();
  assert.ok(first.elemental >= 1 && first.elemental <= 4 && first.catalytic >= 1 && first.catalytic <= 8);
  ticks(33);
  const next = Game.activeAltars();
  assert.notEqual(next.elemental, first.elemental);
  assert.notEqual(next.catalytic, first.catalytic);
});

test('Power-up takes every stone: 2 energy each (3 for poly stones), 5 XP each, one power each', () => {
  const player = fakePlayer();
  openGame(player);
  player.inventory.add(Shared.obj(Shared.ITEM.CATALYTIC_STONE), 64);
  player.inventory.add(Shared.obj(Shared.ITEM.POLYELEMENTAL_STONE), 10);
  const npcId = Shared.npc(Shared.NPC.GREAT_GUARDIAN);
  hooks.npcs['The Great Guardian']['Power-up']({ player, npcId, npc: { getLocation: () => new Location(3613, 9501, 0), getSize: () => 3, getPrivateArea: () => null } });
  ticks(4);
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.CATALYTIC_STONE)), 0);
  assert.equal(player.varbit(Shared.VARBIT.CATALYTIC_EARNED), 128, 'the capture: 64 stones gave 128');
  assert.equal(player.varbit(Shared.VARBIT.ELEMENTAL_EARNED), 30);
  assert.equal(player.xpBySkill.Runecrafting, 370);
  assert.equal(Game._game.power, 25 + 74);
  assert.ok(player.animations.includes(Shared.seq('human_runecraft_walkmerge')));
});

test('without stones the Great Guardian answers from its transcript; another Great Guardian is left alone', () => {
  const player = fakePlayer();
  const npcId = Shared.npc(Shared.NPC.GREAT_GUARDIAN);
  hooks.npcs['The Great Guardian']['Power-up']({ player, npcId, npc: {} });
  assert.match(hooks.dialogues.at(-1), /without-any-type-of-guardian-stone/);
  const answer = (stepId) => hooks.conditions.map((handler) => handler({ npcId, player, stepId })).find((value) => value !== null);
  assert.equal(answer('dKs1aF'), true, 'resting between games');
  assert.equal(hooks.npcs['The Great Guardian']['Power-up']({ player, npcId: npcId + 1, npc: {} }), false, 'the quest has its own');
});

test('full power closes the rift 32 ticks later with the captured messages, points and XP', () => {
  const player = fakePlayer();
  openGame(player);
  Records.setPoints(player, 3, 3);
  Game.stateOf(player).elemental = 165;
  Game.stateOf(player).catalytic = 407;
  Game.setPower(100);
  assert.equal(Game.phase(), Game.PHASE.CHARGED);
  assert.equal(player.messages.at(-1), '<col=06600c>The Great Guardian is fully charged.</col>');
  ticks(31);
  assert.equal(Game.phase(), Game.PHASE.CHARGED);
  const before = player.messages.length;
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    ticks(1);
  } finally {
    Math.random = random;
  }
  assert.deepEqual(player.messages.slice(before), [
    '<col=06600c>The Great Guardian successfully closed the rift!</col>',
    'Amount of rifts you have closed: <col=ff0000>1</col>.',
    'Elemental energy attuned: <col=ef1020>2</col>. Catalytic energy attuned: <col=ef1020>4</col>.',
    'Total elemental energy: <col=ef1020>5</col>. Total catalytic energy: <col=ef1020>7</col>.',
    "You've been awarded 4,455 bonus Runecraft XP for closing the rift.",
    'The Portal Guardians will keep their rifts open for another 30 seconds.',
  ]);
  assert.equal(player.varp(Shared.VARP.RIFTS_CLOSED), 1);
  assert.equal(player.varbit(Shared.VARBIT.FINISHED_GAME), 1);
  assert.deepEqual(player.jingles, [292]);
  assert.equal(player.lastHud()[2], 0, 'the HUD shows no power after the close');

  const late = fakePlayer('Late');
  barrier(late, 'Quick-pass');
  assert.match(statementText(late), /just finishing up/);
  assert.equal(late.location.getY(), 9480);

  ticks(51);
  assert.equal(player.messages.at(-1), 'The Portal Guardians close their rifts.');
  assert.equal(Game.phase(), Game.PHASE.LOBBY);
  assert.equal(Game._game.timer, 53, 'the next game opens 104 ticks after the close');
});

test('energy stops at 1,000 of a type and 1,200 in all', () => {
  const player = fakePlayer();
  openGame(player);
  assert.equal(Game.addEnergy(player, 'catalytic', 1100), 1000);
  assert.equal(Game.addEnergy(player, 'elemental', 300), 200);
  assert.equal(Game.addEnergy(player, 'elemental', 1), 0);
  assert.match(player.messages.at(-1), /fully attuned with runic energy/);
});

test("leaving takes the game's items and varbits; a login inside starts in the lobby", () => {
  const player = fakePlayer();
  openGame(player);
  player.inventory.add(Shared.obj(Shared.ITEM.FRAGMENTS), 40);
  player.inventory.add(Shared.obj(Shared.ITEM.ESSENCE), 10);
  player.inventory.add(995, 100);
  barrier(player, 'Quick-pass');
  assert.equal(player.location.getY(), 9482);
  assert.equal(Game.isPlaying(player), false);
  assert.equal(player.varbit(Shared.VARBIT.IS_PLAYING), 0);
  assert.equal(player.varp(Shared.VARP.GAME_ID), 0);
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.FRAGMENTS)), 0);
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.ESSENCE)), 0);
  assert.equal(player.inventory.getAmount(995), 100);
  assert.equal(player.interfaces.at(-1), -1);

  const sleeper = fakePlayer('Sleeper', { y: 9500 });
  for (const handler of hooks.login) handler({ player: sleeper });
  assert.equal(sleeper.location.getY(), Shared.LOBBY_TILE.y);
});

test('Peek reports the power mid-game and the adventurers inside', () => {
  const player = fakePlayer();
  openGame(player);
  const watcher = fakePlayer('Watcher');
  barrier(watcher, 'Peek');
  assert.match(statementText(watcher), /Creatures from the Abyss are coming through the rift\. There were 1 adventurer inside when it opened\. Great Guardian power: 10%/);
});
