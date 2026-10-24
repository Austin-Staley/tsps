// From server/: node --test tests/shellbane-gryphon.test.cjs (after yarn build).
//
// The Shellbane gryphon against the OSRS Wiki (Shellbane_gryphon, /Strategies, Whirlwind,
// Shellbane_Gryphon_Cave, Elder_Nama): the cave's gate, the knockback and its 40 kg counter,
// the corrosive spit, the whirlwinds, the shield rule and the kill.
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const core = PluginManager.getCoreApi();

let Common, Fight, Cave, Kills, Combat, tasks, events, questDone, onTask;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  Common = require('../plugins/bosses/shellbane/Common.ShellbaneGryphon');
  ({ Fight } = require('../plugins/bosses/shellbane/Fight.ShellbaneGryphon'));
  Cave = require('../plugins/bosses/shellbane/Cave.ShellbaneGryphon');
  Kills = require('../plugins/bosses/shellbane/Kills.ShellbaneGryphon');
  Combat = require('../plugins/bosses/shellbane/Combat.ShellbaneGryphon');
  tasks = [];
  events = [];
  questDone = true;
  onTask = true;
  const api = new Proxy({
    core: { ...core, TaskManager: { submit: (task) => tasks.push(task) } },
    persistAttribute: () => {},
    emitCustomEvent(name, event) {
      events.push([name, event]);
      if (name === 'quest:is-complete') event.complete = questDone;
      if (name === 'slayer:on-task') event.onTask = onTask;
    },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  Common.init(api);
});

const loc = (x, y) => new core.Location(x, y, 0);

function flush() {
  const due = tasks;
  tasks = [];
  for (const task of due) task.execute();
}

/** A player wearing `worn` (item ids by slot) at a tile. */
function fakePlayer(x = 3174, y = 8873, worn = {}) {
  let tile = loc(x, y);
  const items = Array.from({ length: 14 }, (_, slot) => (worn[slot] !== undefined ? new core.Item(worn[slot], 1) : new core.Item(-1)));
  const player = {
    damage: [], messages: [], attributes: {}, varps: {}, slayer: 99, rangedDefence: 0,
    getLocation: () => tile,
    moveTo: (to) => { tile = to; },
    isRegistered: () => true,
    isPlayer: () => true,
    getAsPlayer: () => player,
    sendMessage: (m) => player.messages.push(m),
    getAttribute: (k) => player.attributes[k],
    setAttribute: (k, v) => { player.attributes[k] = v; },
    getSkillManager: () => ({ getCurrentLevel: () => player.slayer }),
    getPacketSender: () => ({ sendGraphic() {}, sendConfig: (id, v) => { player.varps[id] = v; } }),
    getEquipment: () => ({ getItems: () => items, get: (slot) => items[slot] }),
    getBonusManager: () => ({ getDefenceBonus: () => [0, 0, 0, 0, player.rangedDefence] }),
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => player.damage.push(...hits.map((h) => h.getDamage())) }) }),
    items,
  };
  return player;
}

function fakeBoss(x = 3176, y = 8873) {
  const boss = {
    anims: [], attackDelay: 0,
    getId: () => Common.ids.npcs.boss,
    getLocation: () => loc(x, y),
    getSize: () => 4,
    getHitpoints: () => 400,
    performAnimation: (a) => boss.anims.push(a.getId?.() ?? a),
    getCombat: () => ({ setAttackDelay: (t) => { boss.attackDelay = t; } }),
    getPrivateArea: () => null,
  };
  return boss;
}

function fakeCave(player) {
  const placed = [];
  return {
    placed,
    players: () => [player],
    contains: (l) => Common.inBox(l, Common.data.cave.floor),
    world: {
      placeObject: (id, tile) => { const o = { id, tile }; placed.push(o); return o; },
      removeObject: (o) => { const i = placed.indexOf(o); if (i >= 0) placed.splice(i, 1); },
    },
  };
}

function newFight(player, random = () => 0) {
  const cave = fakeCave(player);
  return { fight: new Fight(cave, fakeBoss(), random), cave };
}

/** Rune full helm, platebody, kiteshield, granite legs and the tortugan shield: about 44 kg. */
const HEAVY = { 0: 1163, 1: 31398, 4: 1127, 5: 1201, 7: 6809 };

const ticks = (fight, n) => { for (let i = 0; i < n; i++) fight.tick(); };

test('every id resolves from the cache', () => {
  const { npcs, locs, items, varps } = Common.ids;
  assert.equal(npcs.boss, 14860);
  assert.equal(locs.entrance, 58439, 'the multiloc parent is what a click carries');
  assert.equal(locs.exit, 58442);
  assert.equal(items.shield, 31398);
  assert.equal(varps.kills, 4945);
  assert.deepEqual([locs.whirlwind1, locs.whirlwindActive1, locs.whirlwind5, locs.whirlwindActive5], [57917, 57918, 57925, 57926]);
});

test('the cave takes only a player with Troubled Tortugans, 51 Slayer and a gryphon task', () => {
  const player = fakePlayer(3176, 2476);
  const objectId = Common.ids.locs.entrance;
  questDone = false;
  Cave.enter({ player, objectId });
  assert.equal(player.messages.at(-1), Common.message('noQuest'));
  questDone = true;
  player.slayer = 50;
  Cave.enter({ player, objectId });
  assert.equal(player.messages.at(-1), Common.message('noLevel'));
  player.slayer = 51;
  onTask = false;
  Cave.enter({ player, objectId });
  assert.equal(player.messages.at(-1), Common.message('noTask'));
  assert.equal(player.getLocation().getY(), 2476);
  onTask = true;
  assert.equal(Cave.enter({ player, objectId: 1 }), false);
});

test('weight worn counts in kilograms, from equipped items only', () => {
  const light = fakePlayer(3174, 8873, { 1: 31398 });
  assert.equal(Common.wornWeight(light), 10, 'the shield is 10 kg');
  assert.equal(Common.wearingShield(light), true);
  const bare = fakePlayer();
  assert.equal(Common.wornWeight(bare), 0);
  assert.equal(Common.wearingShield(bare), false);
});

test('knockback: a light player is thrown back for up to 30; 40 kg worn stops it and stuns the gryphon', () => {
  const light = fakePlayer(3175, 8873);
  const { fight } = newFight(light);
  fight.special(light, 'knockback');
  ticks(fight, Common.data.knockback.warnTicks);
  assert.equal(light.damage.length, 1);
  assert.ok(light.damage[0] <= 30);
  assert.ok(light.getLocation().getX() < 3175, 'pushed away from the gryphon');

  const heavy = fakePlayer(3175, 8873, HEAVY);
  assert.ok(Common.wornWeight(heavy) >= 40);
  const { fight: second } = newFight(heavy);
  second.special(heavy, 'knockback');
  ticks(second, Common.data.knockback.warnTicks);
  assert.deepEqual(heavy.damage, []);
  assert.equal(heavy.messages.at(-1), Common.message('heavyEquipment'));
  assert.equal(second.boss.attackDelay, Common.data.knockback.stunTicks);
});

test('a player at 40 kg or more never gets the knockback chosen', () => {
  const heavy = fakePlayer(3175, 8873, HEAVY);
  const fight = newFight(heavy, () => 0).fight;
  for (const r of [0, 0.4, 0.9]) {
    fight.random = () => r;
    assert.notEqual(fight.chooseSpecial(heavy), 'knockback');
  }
  const light = fakePlayer();
  fight.random = () => 0;
  assert.equal(fight.chooseSpecial(light), 'knockback');
});

test('the spit lands where the player stood: still there, their armour corrodes 6 times over 32 ticks', () => {
  const player = fakePlayer(3174, 8873, { 4: 1127 });
  const { fight } = newFight(player);
  fight.special(player, 'spit');
  ticks(fight, Common.data.spit.landTicks);
  assert.equal(player.messages.at(-1), Common.message('corroding'));
  ticks(fight, Common.data.spit.totalTicks);
  assert.equal(player.damage.length, 6);
  assert.ok(player.damage.every((d) => d >= 3 && d <= 12));
  assert.equal(fight.corrosion, null);
});

test('stepping off the tile dodges the spit; taking everything off stops the corrosion', () => {
  const player = fakePlayer(3174, 8873, { 4: 1127 });
  const { fight } = newFight(player);
  fight.special(player, 'spit');
  player.moveTo(loc(3173, 8873));
  ticks(fight, Common.data.spit.landTicks);
  assert.equal(fight.corrosion, null);
  assert.deepEqual(player.damage, []);
  player.moveTo(loc(3174, 8873));
  fight.special(player, 'spit');
  ticks(fight, Common.data.spit.landTicks);
  assert.ok(fight.corrosion);
  player.items[4] = new core.Item(-1);
  fight.tick();
  assert.equal(fight.corrosion, null);
  assert.equal(player.messages.at(-1), Common.message('stopsCorroding'));
});

test('more ranged defence means smaller corrosion splats (+125 brings them to 3)', () => {
  const player = fakePlayer();
  const { fight } = newFight(player);
  player.rangedDefence = 125;
  for (let i = 0; i < 20; i++) assert.equal(fight.corrosionHit(player), 3);
  player.rangedDefence = 0;
  const hits = Array.from({ length: 200 }, () => fight.corrosionHit(player));
  assert.ok(Math.max(...hits) > 3);
});

test('whirlwinds form on the player every 3 ticks; one landing on another makes it stronger', () => {
  const player = fakePlayer(3174, 8873);
  const { fight, cave } = newFight(player);
  fight.special(player, 'whirlwind');
  assert.equal(player.messages.at(-1), Common.message('whirlwind'));
  fight.tick();
  player.moveTo(loc(3172, 8873));
  ticks(fight, 3);
  player.moveTo(loc(3172, 8873));
  ticks(fight, 3);
  assert.equal(fight.whirlwinds.length, 2);
  assert.equal(fight.whirlwindAt(loc(3172, 8873)).strength, 2);
  assert.equal(cave.placed.find((o) => o.tile.getX() === 3172).id, Common.ids.locs.whirlwind2);
});

test('armed whirlwinds hurt whoever stands in them each tick, then burst, the strongest the widest', () => {
  const player = fakePlayer(3174, 8873);
  const { fight, cave } = newFight(player);
  fight.special(player, 'whirlwind');
  ticks(fight, 1 + 3 * 4);
  assert.equal(fight.whirlwinds.length, 1);
  assert.equal(fight.whirlwinds[0].strength, 5, 'standing still stacks all five');
  ticks(fight, Common.data.whirlwind.armTicks);
  assert.ok(cave.placed.every((o) => o.id === Common.ids.locs.whirlwindActive5));
  fight.tick();
  const [min, max] = Common.data.whirlwind.perTick[4];
  assert.ok(player.damage.at(-1) >= min && player.damage.at(-1) <= max);
  player.moveTo(loc(3188, 8880));
  ticks(fight, Common.data.whirlwind.burstTicks);
  assert.equal(player.messages.at(-1), Common.message('burst'));
  assert.ok(player.damage.at(-1) >= 50, 'strength 5 reaches the whole cave');
  assert.equal(cave.placed.length, 0);
  assert.equal(fight.whirling, null);
});

test('without the tortugan shield its melee goes through Protect from Melee, with a warning', () => {
  const { GryphonCombat } = Combat.methods();
  const player = fakePlayer(3175, 8873);
  const boss = fakeBoss();
  const { fight } = newFight(player, () => 0.9);
  boss.__sgCave = { fight };
  fight.attacks = 0;
  const method = new GryphonCombat();
  const npc = { ...boss, getAsNpc: () => boss };
  method.start(npc, player);
  assert.equal(player.messages.at(-1), Common.message('devastating'));
  assert.equal(method.plan.typeless, true);
  method.hits(npc, player);
  assert.equal(player.damage.length, 1);
  assert.ok(player.damage[0] <= 22);
  const shielded = fakePlayer(3175, 8873, { 1: 31398 });
  const second = new GryphonCombat();
  second.start(npc, shielded);
  assert.equal(second.plan.typeless, false, 'with the shield the prayer works as usual');
});

test('every fourth attack is a special', () => {
  const { GryphonCombat } = Combat.methods();
  const player = fakePlayer(3175, 8873, { 1: 31398 });
  const boss = fakeBoss();
  const { fight } = newFight(player, () => 0.9);
  boss.__sgCave = { fight };
  const npc = { ...boss, getAsNpc: () => boss };
  const kinds = [];
  for (let i = 0; i < 8; i++) {
    const method = new GryphonCombat();
    method.start(npc, player);
    kinds.push(method.plan ? method.style : 'special');
  }
  assert.deepEqual(kinds.map((k) => k === 'special'), [false, false, false, true, false, false, false, true]);
});

test('the kill: its kill count and a second main-table roll', () => {
  const player = fakePlayer();
  const npc = fakeBoss();
  let respawned = 0;
  npc.__sgCave = { bossDied: () => { respawned += 1; } };
  Kills.bossDied({ npc, killer: player });
  flush();
  assert.equal(respawned, 1);
  assert.equal(player.attributes[Common.KILLS_ATTRIBUTE], 1);
  assert.equal(player.varps[Common.ids.varps.kills], 1);
  assert.equal(player.messages.at(-1), Common.message('killCount', { kills: 1 }));
  events = [];
  const roll = { player, npc, npcId: Common.ids.npcs.boss, drops: [] };
  Kills.secondRoll(roll);
  Kills.secondRoll(roll);
  const extra = events.filter(([name]) => name === 'npc-drops:extra-rolls');
  assert.equal(extra.length, 1);
  assert.equal(extra[0][1].rolls, 1);
});
