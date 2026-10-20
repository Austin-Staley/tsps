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
const Mining = require('../plugins/minigames/guardiansoftherift/Mining.GuardiansOfTheRift');
const Workbench = require('../plugins/minigames/guardiansoftherift/Workbench.GuardiansOfTheRift');
const Portals = require('../plugins/minigames/guardiansoftherift/Portals.GuardiansOfTheRift');
const DepositPool = require('../plugins/minigames/guardiansoftherift/DepositPool.GuardiansOfTheRift');
const Pouches = require('../plugins/skills/runecrafting/Pouches.Runecrafting');
const Altars = require('../plugins/minigames/guardiansoftherift/Altars.GuardiansOfTheRift');
const Cells = require('../plugins/minigames/guardiansoftherift/Cells.GuardiansOfTheRift');
const RiftGuardians = require('../plugins/minigames/guardiansoftherift/RiftGuardians.GuardiansOfTheRift');

const hooks = {
  objects: {}, npcs: {}, items: {}, clicks: {}, custom: {}, login: [], logout: [], conditions: [], areas: [], prompts: [],
  dialogues: [], canBankItem: [], itemOnObject: {}, drops: [], npcsSpawned: [], npcsRemoved: [],
};

/** Enough of an NPC for barriers and guardians: hitpoints, transforms, a movement queue. */
function fakeNpc(definition) {
  const npc = {
    id: definition.id, transform: -1, hp: 0, x: definition.x, y: definition.y, registered: true,
    getId: () => npc.id,
    getLocation: () => new Location(npc.x, npc.y, 0),
    isRegistered: () => npc.registered,
    getMaxHitpoints: () => Shared.core().NpcDefinition.forId(npc.transform !== -1 ? npc.transform : npc.id).getHitpoints(),
    getHitpoints: () => npc.hp,
    setHitpoints: (hp) => { npc.hp = hp; return npc; },
    heal: (amount) => { npc.hp = Math.min(npc.getMaxHitpoints(), npc.hp + amount); },
    setNpcTransformationId: (id) => { npc.transform = id; return npc; },
    getMovementQueue: () => ({ setBlockMovement() {}, reset() {} }),
    performAnimation() {},
    forceChat() {},
  };
  npc.hp = npc.getMaxHitpoints();
  return npc;
}
const QUESTS_DONE = new Set(['temple_of_the_eye']);

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
      if (name === 'quest:is-complete') payload.complete = payload.player.questDone && (payload.key === 'temple_of_the_eye' || QUESTS_DONE.has(payload.key));
      if (name === 'runecrafting:altar-rune') payload.rune = { runeId: 557, level: 9, xp: 6.5, amount: 4, petBase: 1 };
      if (name === 'npc-dialogue:start') { hooks.dialogues.push(payload.variant); payload.handled = true; }
      if (name === 'mining:best-pickaxe') payload.pickaxe = payload.player.pickaxe ?? null;
      if (name === 'skillcape:has-perk') payload.result = payload.player.cape === true;
      for (const handler of hooks.custom[name] ?? []) handler(payload);
    },
    sendMultiChatboxPrompt: (player, title, ...args) => hooks.prompts.push({ player, title, args }),
    onItemAction: (name, actions) => { hooks.items[name] = actions; },
    onObjectClick: (ids, clickType, handler) => { hooks.clicks[`${ids}:${clickType}`] = handler; },
    onCanBankItem: (handler) => hooks.canBankItem.push(handler),
    onItemOnObject: (item, object, handler) => { hooks.itemOnObject[`${item}|${object}`] = handler; },
    getTaskManager: () => TaskManager,
    onItemDropPolicy: (handler) => hooks.drops.push(handler),
    spawnNpc: (definition) => { const npc = fakeNpc(definition); hooks.npcsSpawned.push(npc); return npc; },
    removeNpc: (npc) => { npc.registered = false; hooks.npcsRemoved.push(npc); },
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
    /** Like ItemContainer.adds: stackables pile up, anything else takes a slot each. */
    adds(id, amount = 1) {
      if (STACKABLE.has(id)) return self.add(id, amount);
      for (let i = 0; i < amount && slots.includes(null); i++) slots[slots.indexOf(null)] = { id, amount: 1 };
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

const STACKABLE = new Set();

function fakePlayer(name = 'Tester', { runecraft = 99, questDone = true, x = 3615, y = 9480 } = {}) {
  const varbits = new Map();
  const attributes = new Map();
  const p = {
    name, questDone, messages: [], statements: [], scripts: [], interfaces: [], animations: [], jingles: [],
    xpBySkill: {}, runEnergy: 50, special: 100, levels: {}, sounds: [],
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
    getInventory: () => Object.assign(p.inventory, { full() { p.messages.push("You don't have enough inventory space."); } }),
    performAnimation: (animation) => p.animations.push(animation.getId?.() ?? animation.id),
    performGraphic() {},
    getSpecialPercentage: () => p.special,
    getRunEnergy: () => p.runEnergy,
    setRunEnergy: (value) => { p.runEnergy = Math.min(100, value); },
    getSkillManager: () => ({
      getMaxLevel: (skill) => (skill?.getName?.() === 'Runecrafting' ? runecraft : p.levels[skill?.getName?.()] ?? 99),
      getCurrentLevel: () => 99,
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
        sendSound: (id) => { p.sounds.push(id); return sender; },
        sendSoundEffect: (id) => { p.sounds.push(id); return sender; },
        sendCameraShake: () => sender,
        sendCameraReset: () => sender,
        sendRunEnergy: () => sender,
        sendProjectile: () => sender,
        sendObjectAnimation: () => sender,
        sendSoundEffect: (id) => { p.sounds.push(id); return sender; },
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
  Cells.reset();
  RiftGuardians.dismissAll();
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
  Mining.attach(api);
  Workbench.attach(api);
  Portals.attach(api);
  DepositPool.attach(api);
  Pouches.attach(api);
  Altars.attach(api);
  Cells.attach(api);
  RiftGuardians.attach(api);
  Shared.core().PathFinder.calculateWalkRoute = () => true;
  for (const name of Shared.GAME_ITEMS) if (Shared.core().ItemDefinition.forId(Shared.obj(name)).isStackable()) STACKABLE.add(Shared.obj(name));
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

// ------------------------------------------------------------------ phase 2: essence

const DRAGON_PICKAXE = { attemptIntervalTicks: 3, animation: { getId: () => 7139 } };

function mine(player, loc) {
  const name = { gotr_essence_tier_1: 'Guardian parts', gotr_essence_tier_2: 'Large guardian remains', gotr_essence_tier_3: 'Huge guardian remains' }[loc];
  return hooks.objects[name].Mine({ player, objectId: Shared.loc(loc) });
}

test('mining waits for the rift and needs a pickaxe', () => {
  const player = fakePlayer('Miner');
  barrier(player, 'Quick-pass');
  mine(player, 'gotr_essence_tier_1');
  assert.equal(player.messages.at(-1), "There's no need to do that right now.");
  Game.skip();
  ticks(1);
  mine(player, 'gotr_essence_tier_1');
  assert.match(statementText(player), /You need a pickaxe to mine this rock/);
});

test('large remains give 2-4 fragments a success, 5 XP each, and the count stops paying at 250', () => {
  const player = fakePlayer('Miner');
  player.pickaxe = DRAGON_PICKAXE;
  openGame(player);
  mine(player, 'gotr_essence_tier_2');
  assert.equal(player.messages.at(-1), 'You swing your pick at the rock.');
  ticks(2);
  const first = player.inventory.getAmount(Shared.obj(Shared.ITEM.FRAGMENTS));
  assert.ok(first >= 2 && first <= 4, `2-4 fragments, got ${first}`);
  assert.equal(player.xpBySkill.Mining, 5);
  assert.equal(player.varbit(Shared.VARBIT.MINING_COUNT), first);
  ticks(3);
  assert.equal(player.xpBySkill.Mining, 10, 'one success every 3 ticks with a dragon pickaxe');
  Game.stateOf(player).mined = 249;
  ticks(3);
  assert.equal(player.varbit(Shared.VARBIT.MINING_COUNT), 250);
  assert.match(player.messages.at(-1), /limit of 250 resources mined/);
  ticks(3);
  assert.equal(player.xpBySkill.Mining, 15, 'no XP past 250');
  Shared.stopAction(player);
});

test('huge remains give 4-6 essence until the inventory is full', () => {
  const player = fakePlayer('Miner');
  player.pickaxe = DRAGON_PICKAXE;
  openGame(player);
  player.inventory.adds(995, 1);
  STACKABLE.add(995);
  for (let i = 0; i < 20; i++) player.inventory.adds(1, 1);
  mine(player, 'gotr_essence_tier_3');
  ticks(2);
  const essence = player.inventory.getAmount(Shared.obj(Shared.ITEM.ESSENCE));
  assert.ok(essence >= 4 && essence <= 6);
  ticks(3);
  assert.equal(player.inventory.getFreeSlots(), 0);
  assert.match(statementText(player), /too full to hold any more guardian essence/);
  assert.ok(player.sounds.includes(2277));
});

test('the workbench turns a fragment into essence each tick for level/10 Crafting XP', () => {
  const player = fakePlayer('Crafter');
  player.levels.Crafting = 37;
  openGame(player);
  player.inventory.add(Shared.obj(Shared.ITEM.FRAGMENTS), 3);
  hooks.objects.Workbench['Work-at']({ player, objectId: Shared.loc('gotr_workbench') });
  ticks(3);
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.ESSENCE)), 3);
  assert.equal(player.xpBySkill.Crafting, 9, '3 XP each at level 37');
  ticks(1);
  assert.equal(player.messages.at(-1), 'You have no more guardian fragments to combine.');
  const empty = fakePlayer('Empty');
  hooks.objects.Workbench['Work-at']({ player: empty, objectId: Shared.loc('gotr_workbench') });
  assert.match(statementText(empty), /at least one guardian fragment/);
  assert.equal(Workbench.craftingXp({ getSkillManager: () => ({ getMaxLevel: () => 5 }) }), 1);
  assert.equal(Workbench.craftingXp({ getSkillManager: () => ({ getMaxLevel: () => 99 }) }), 5);
});

test('a huge-remains portal opens at the captured tiles with its message', () => {
  const player = fakePlayer();
  openGame(player);
  Game._game.phase = Game.PHASE.ATTACK;
  Game._game.portal.opensIn = 1;
  ticks(1);
  const direction = Game.portal().direction;
  assert.ok(direction >= 1 && direction <= 4);
  assert.equal(player.messages.at(-1), `<col=ef1020>A portal to the huge guardian fragment mine has opened to the ${Portals.PORTALS[direction].name}!</col>`);
  ticks(44);
  assert.equal(Game.portal().direction, 0, 'open 44 ticks');
});

test('game items are refused by the bank', () => {
  const player = fakePlayer();
  const event = { player, item: { getId: () => Shared.obj(Shared.ITEM.ESSENCE) }, allow: null };
  for (const handler of hooks.canBankItem) handler(event);
  assert.equal(event.allow, false);
  assert.equal(player.messages.at(-1), 'A magical force prevents you from banking this item!');
});

// ------------------------------------------------------------------ essence pouches

function pouch(player, option, name = 'Colossal pouch') {
  const id = Shared.core().CacheDefinitions.getObjId({ 'Colossal pouch': 'rcu_pouch_colossal', 'Giant pouch': 'rcu_pouch_giant', 'Small pouch': 'rcu_pouch_small' }[name]);
  return hooks.items[name][option]({ player, itemId: id });
}

test('pouches hold one kind of essence, shown on their varbits; Fill empties a full pouch', () => {
  const player = fakePlayer('Pouch', { runecraft: 85 });
  const colossal = Shared.core().CacheDefinitions.getObjId('rcu_pouch_colossal');
  player.inventory.adds(colossal, 1);
  player.inventory.adds(Shared.obj(Shared.ITEM.ESSENCE), 24);
  pouch(player, 'Fill');
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.ESSENCE)), 0);
  assert.equal(player.varbit('colossal_essence_pouch'), 24);
  assert.equal(player.varbit('colossal_essence_pouch_type'), 4, 'guardian essence');
  pouch(player, 'Check');
  assert.equal(player.messages.at(-1), 'There are twenty-four guardian essences in this pouch.');

  player.inventory.adds(7936, 3);
  pouch(player, 'Fill');
  assert.equal(player.messages.at(-1), 'The pouch contains guardian essence, so you can fill it only with more guardian essence.');
  player.inventory.delete(7936, 3);

  pouch(player, 'Fill');
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.ESSENCE)), 24, 'nothing to fill with: Fill empties');
  assert.equal(player.varbit('colossal_essence_pouch'), 0);
  assert.equal(player.varbit('colossal_essence_pouch_type'), 0);
  pouch(player, 'Empty');
  assert.equal(player.messages.at(-1), 'There is no essence in this pouch.');
  pouch(player, 'Fill');
  assert.equal(player.varbit('colossal_essence_pouch'), 24);
  for (const handler of hooks.custom['runecrafting:remove-guardian-essence']) handler({ player });
  assert.equal(player.varbit('colossal_essence_pouch'), 0, 'guardian essence never leaves the game');
});

test('the colossal pouch holds 8/16/27/40 by Runecraft level, and pouches decay with use', () => {
  const capacity = (level) => Pouches._test.capacity(fakePlayer('L', { runecraft: level }), Pouches._test.pouchFor(Shared.core().CacheDefinitions.getObjId('rcu_pouch_colossal')));
  assert.deepEqual([24, 25, 50, 75, 85, 99].map(capacity), [0, 8, 16, 27, 40, 40]);

  const player = fakePlayer('Decay', { runecraft: 99 });
  const giant = Shared.core().CacheDefinitions.getObjId('rcu_pouch_giant');
  const degraded = Shared.core().CacheDefinitions.getObjId('rcu_pouch_giant_degrade');
  player.inventory.adds(giant, 1);
  for (let use = 0; use < 10; use++) {
    player.inventory.adds(7936, 12);
    pouch(player, 'Fill', 'Giant pouch');
    pouch(player, 'Empty', 'Giant pouch');
    player.inventory.delete(7936, 12);
  }
  assert.equal(player.inventory.getAmount(degraded), 1, 'Wiki: about 120 essence');
  assert.equal(player.messages.at(-1), 'Your pouch has decayed through use.');
  const request = { player, repaired: 0 };
  for (const handler of hooks.custom['runecrafting:repair-pouches']) handler(request);
  assert.equal(request.repaired, 1);
  assert.equal(player.inventory.getAmount(giant), 1);

  const caped = fakePlayer('Caped', { runecraft: 99 });
  caped.cape = true;
  caped.inventory.adds(giant, 1);
  for (let use = 0; use < 12; use++) {
    caped.inventory.adds(7936, 12);
    pouch(caped, 'Fill', 'Giant pouch');
    pouch(caped, 'Empty', 'Giant pouch');
    caped.inventory.delete(7936, 12);
  }
  assert.equal(caped.inventory.getAmount(giant), 1, 'a Runecraft cape stops decay');
});

test('old saves load: rune and pure essence keep their counts', () => {
  const player = fakePlayer('Old');
  player.setAttribute(Pouches.POUCHES_ATTRIBUTE, [
    { pouch: { itemId: Shared.core().CacheDefinitions.getObjId('rcu_pouch_small') }, runeEssenceAmt: 0, pureEssenceAmt: 3 },
  ]);
  pouch(player, 'Check', 'Small pouch');
  assert.equal(player.messages.at(-1), 'There are three pure essences in this pouch.');
});

// ------------------------------------------------------------------ phase 3: Portal Guardians and altars

const EARTH = Altars.ALTARS.find((altar) => altar.key === 'earth');
const BLOOD = Altars.ALTARS.find((altar) => altar.key === 'blood');

function attackPhase(player) {
  openGame(player);
  Game._game.phase = Game.PHASE.ATTACK;
  Game._game.altars = { elemental: EARTH.index, catalytic: BLOOD.index, changesIn: 33 };
}

function enter(player, altar) {
  return hooks.objects[`Guardian of ${altar.name}`].Enter({ player, objectId: Shared.loc(altar.guardian) });
}

test('a dormant Guardian, held stones and a missing quest keep the rift shut', () => {
  const player = fakePlayer();
  attackPhase(player);
  enter(player, Altars.ALTARS.find((altar) => altar.key === 'air'));
  assert.match(statementText(player), /The Guardian is dormant\. Its energy might return soon\./);
  enter(player, BLOOD);
  assert.match(statementText(player), /You must complete Sins of the Father before you can enter this rift\./);
  player.inventory.add(Shared.obj(Shared.ITEM.ELEMENTAL_STONE), 3);
  enter(player, EARTH);
  assert.match(hooks.dialogues.at(-1), /entering-a-portal-guardian-with-any-type-of-guardian-stone/);
  assert.equal(player.location.getY(), 9484, 'still in the temple');
});

test('an active Guardian takes the player to its altar and stays in the game; the portal brings them back', () => {
  const player = fakePlayer();
  attackPhase(player);
  enter(player, EARTH);
  ticks(2);
  assert.equal(player.messages.at(-1), 'You step through the rift and find yourself at the Earth Altar.');
  assert.deepEqual([player.location.getX(), player.location.getY()], [2655, 4830]);
  ticks(6);
  assert.equal(Game.isPlaying(player), true, 'an altar trip keeps the game');
  hooks.objects.Portal.Use({ player, objectId: Shared.loc(EARTH.exit) });
  ticks(2);
  assert.equal(player.messages.at(-1), 'You step through the portal and find yourself back in the temple.');
  assert.deepEqual([player.location.getX(), player.location.getY()], [3615, 9491]);

  enter(player, EARTH);
  ticks(2);
  player.location = new Location(3222, 3218, 0);
  ticks(6);
  assert.equal(Game.isPlaying(player), false, 'teleporting away from the altar leaves the game');
});

test('crafting guardian essence makes runes, a stone each, the XP and charges one cell to the altar tier', () => {
  const player = fakePlayer();
  attackPhase(player);
  player.inventory.adds(Shared.obj(Shared.ITEM.ESSENCE), 10);
  player.inventory.add(Shared.obj(Shared.ITEM.UNCHARGED_CELL), 3);
  STACKABLE.add(557);
  hooks.objects.Altar['Craft-rune']({ player, objectId: Shared.loc(EARTH.altar) });
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.ESSENCE)), 0);
  assert.equal(player.inventory.getAmount(557), 40);
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.ELEMENTAL_STONE)), 10);
  assert.equal(player.inventory.getAmount(Shared.obj('gotr_cell_tier3')), 1, 'earth charges strong cells');
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.UNCHARGED_CELL)), 2);
  assert.ok(player.messages.includes('Your cell absorbs a high amount of excess energy.'));
  assert.equal(player.xpBySkill.Runecrafting, 65);

  player.inventory.adds(Shared.obj(Shared.ITEM.ESSENCE), 5);
  hooks.objects.Altar['Craft-rune']({ player, objectId: Shared.loc(EARTH.altar) });
  assert.equal(player.inventory.getAmount(Shared.obj('gotr_cell_tier3')), 1, 'one charged cell at a time');
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.UNCHARGED_CELL)), 2);

  const outsider = fakePlayer('Outsider');
  outsider.inventory.adds(Shared.obj(Shared.ITEM.ESSENCE), 1);
  assert.equal(hooks.objects.Altar['Craft-rune']({ player: outsider, objectId: Shared.loc(EARTH.altar) }), false, 'outside a game it is plain Runecraft');
});

test('a portal talisman opens its dormant Guardian and shatters; Toggle-talisman flips its varbit', () => {
  const player = fakePlayer();
  attackPhase(player);
  const air = Altars.ALTARS.find((altar) => altar.key === 'air');
  player.inventory.add(Shared.obj(air.talisman), 1);
  hooks.itemOnObject['Portal talisman (air)|Guardian of Air']({ player, objectId: Shared.loc(air.guardian), itemId: Shared.obj(air.talisman) });
  assert.equal(player.inventory.getAmount(Shared.obj(air.talisman)), 0);
  assert.equal(player.messages.at(-1), 'The portal talisman shatters and you find yourself at the altar it originated from.');
  ticks(2);
  assert.deepEqual([player.location.getX(), player.location.getY()], [2841, 4829]);

  hooks.objects['Guardian of Air']['Toggle-talisman']({ player: fakePlayer('Toggler'), objectId: Shared.loc(air.guardian) });
  const toggler = fakePlayer('Toggler2');
  hooks.objects['Guardian of Air']['Toggle-talisman']({ player: toggler, objectId: Shared.loc(air.guardian) });
  assert.equal(toggler.varbit(air.toggle), 1);
  assert.equal(Records.setting(toggler, air.toggle), 1);
});

// ------------------------------------------------------------------ phase 4: cells, barriers, rift guardians

const UNCHARGED = () => Shared.obj(Shared.ITEM.UNCHARGED_CELL);
const CELL = (tier) => Shared.obj(Shared.ITEM.CELLS[tier - 1]);

function place(player, tile) {
  const name = tile.broken ? 'Cell tile (broken)' : ['Inactive cell tile', 'Weak cell tile', 'Medium cell tile', 'Strong cell tile', 'Overpowered cell tile'][tile.tier];
  const option = tile.broken ? 'Repair' : 'Place-cell';
  return hooks.objects[name][option]({ player, location: { x: tile.x, y: tile.y, z: 0 } });
}

test('the cell tables: ten uncharged at most, one weak cell, a chisel; dropped cells are destroyed', () => {
  const player = fakePlayer();
  openGame(player);
  const uncharged = { player, objectId: Shared.loc('gotr_uncharged_cells') };
  hooks.objects['Uncharged cells']['Take-1'](uncharged);
  assert.equal(player.inventory.getAmount(UNCHARGED()), 1);
  hooks.objects['Uncharged cells']['Take-10'](uncharged);
  assert.equal(player.inventory.getAmount(UNCHARGED()), 10);
  hooks.objects['Uncharged cells']['Take-1'](uncharged);
  assert.match(statementText(player), /You can only carry ten of these at a time\./);
  const weak = { player, objectId: Shared.loc('gotr_weak_cells') };
  hooks.objects['Weak cells'].Take(weak);
  assert.equal(player.inventory.getAmount(CELL(1)), 1);
  hooks.objects['Weak cells']['Take-chisel'](weak);
  assert.equal(player.inventory.getAmount(Shared.obj('chisel')), 1);
  const drop = { player, itemId: UNCHARGED(), handled: false };
  for (const handler of hooks.drops) handler(drop);
  assert.equal(drop.handled, true);
  assert.equal(player.inventory.getAmount(UNCHARGED()), 0);
  assert.equal(player.messages.at(-1), 'The Uncharged cell is destroyed as you drop it.');
});

test('cells raise, strengthen and recharge barriers with the captured messages, energy and XP', () => {
  const player = fakePlayer();
  openGame(player);
  const tile = Cells.tiles[0];
  player.inventory.add(CELL(1), 1);
  place(player, tile);
  assert.equal(tile.tier, 1);
  assert.equal(tile.npc.getId(), Shared.npc('gotr_barrier_npc_tier1_large'));
  assert.equal(tile.npc.getHitpoints(), 50);
  assert.equal(player.varbit(Shared.VARBIT.ELEMENTAL_EARNED), 17, 'placing a weak cell: 17 of both');
  assert.equal(player.varbit(Shared.VARBIT.CATALYTIC_EARNED), 17);
  assert.equal(player.xpBySkill.Runecrafting, 30);

  player.inventory.add(CELL(3), 1);
  place(player, tile);
  assert.equal(tile.tier, 3);
  assert.equal(tile.npc.transform, Shared.npc('gotr_barrier_npc_tier3_large'));
  assert.equal(tile.npc.getHitpoints(), 200);
  assert.equal(player.messages.at(-1), 'The strong cell is consumed as it <col=ff0000>strengthens</col> the barrier.');
  assert.equal(player.varbit(Shared.VARBIT.ELEMENTAL_EARNED), 30, '+13');
  assert.equal(player.xpBySkill.Runecrafting, 30 + 190);

  tile.npc.setHitpoints(150);
  player.inventory.add(CELL(2), 1);
  place(player, tile);
  assert.equal(player.messages.at(-1), 'The medium cell is consumed as it <col=ff0000>recharges</col> the barrier.');
  assert.equal(tile.npc.getHitpoints(), 175);
  assert.equal(player.varbit(Shared.VARBIT.ELEMENTAL_EARNED), 35, '+5');
});

test('the surge hits every barrier for 50; a broken tile takes 12 fragments to repair', () => {
  const player = fakePlayer();
  openGame(player);
  const tile = Cells.tiles[1];
  player.inventory.add(CELL(1), 1);
  place(player, tile);
  Game.setPower(60);
  assert.equal(tile.broken, true, '50 health: the surge breaks a weak barrier');
  assert.ok(player.messages.includes('<col=ef1020>A barrier has been destroyed!</col>'));
  assert.equal(tile.npc, null);
  place(player, tile);
  assert.match(statementText(player), /12 guardian fragments/);
  player.inventory.add(Shared.obj(Shared.ITEM.FRAGMENTS), 15);
  const before = player.varbit(Shared.VARBIT.ELEMENTAL_EARNED);
  place(player, tile);
  assert.equal(tile.broken, false);
  assert.equal(player.inventory.getAmount(Shared.obj(Shared.ITEM.FRAGMENTS)), 3);
  assert.equal(player.varbit(Shared.VARBIT.ELEMENTAL_EARNED), before + 25);
});

test('assembling a guardian: the captured steps, the pile energy, and nothing past ten', () => {
  const player = fakePlayer();
  openGame(player);
  const pile = { player, objectId: Shared.loc('gotr_guardian_spawn_east') };
  hooks.objects['Essence pile (elemental)'].Assemble(pile);
  assert.match(statementText(player), /chisel/);
  player.inventory.add(Shared.obj('chisel'), 1);
  hooks.objects['Essence pile (elemental)'].Assemble(pile);
  assert.match(statementText(player), /You will need a charged cell to power any rift guardians/);
  player.inventory.add(CELL(4), 1);
  hooks.objects['Essence pile (elemental)'].Assemble(pile);
  assert.equal(player.messages.at(-1), 'You scrape together what usable components you can find.');
  ticks(2);
  assert.equal(player.messages.at(-1), 'You carve out a place for the cell and carefully place it inside the guardian.');
  ticks(3);
  assert.equal(player.messages.at(-1), 'The powers of the overcharged cell extend into the essence. A Guardian comes to life.');
  assert.equal(hooks.npcsSpawned.at(-1).id, Shared.npc('gotr_guardian_fire'));
  assert.equal(player.varbit(Shared.VARBIT.ELEMENTAL_EARNED), 45);
  assert.equal(player.varbit(Shared.VARBIT.CATALYTIC_EARNED), 0, 'only the pile type');
  assert.equal(player.xpBySkill.Crafting, 80);
  assert.equal(player.xpBySkill.Runecrafting, 250);
  assert.equal(player.inventory.getAmount(CELL(4)), 0);

  for (let i = 0; i < 9; i++) RiftGuardians.guardians.add(fakeNpc({ id: Shared.npc('gotr_guardian_air'), x: 0, y: 0 }));
  player.inventory.add(CELL(1), 1);
  hooks.objects['Essence pile (elemental)'].Assemble(pile);
  ticks(5);
  assert.equal(player.messages.at(-1), 'The powers of the cell extend into the essence, but no guardian forms.');
  assert.equal(Game.stateOf(player).elemental, 45 + 6, 'the energy still comes');
});

test('at full power every rift guardian goes, and the close resets the tiles', () => {
  const player = fakePlayer();
  openGame(player);
  player.inventory.add(CELL(2), 1);
  place(player, Cells.tiles[3]);
  RiftGuardians.guardians.add(fakeNpc({ id: Shared.npc('gotr_guardian_air'), x: 0, y: 0 }));
  Game.setPower(100);
  assert.equal(RiftGuardians.alive(), 0);
  ticks(32);
  assert.ok(Cells.tiles.every((tile) => tile.tier === 0 && !tile.npc && !tile.broken));
});
