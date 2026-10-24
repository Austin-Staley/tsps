// From server/: node --test tests/zalcano.test.cjs (after yarn build).
//
// Zalcano against the OSRS Wiki (Zalcano, /Strategies, Tephra, Imbued_tephra, Golem_(Zalcano),
// Demonic_Symbol, Zalcano_shard): the quest gate, who can hurt her and how, her fall and rise,
// the hazards, the throw and mining max hits, and the contribution rewards.
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const core = PluginManager.getCoreApi();

let Common, Fight, Tephra, Rewards, Prison, tasks, events, questDone;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  Common = require('../plugins/bosses/zalcano/Common.Zalcano');
  ({ Fight } = require('../plugins/bosses/zalcano/Fight.Zalcano'));
  Tephra = require('../plugins/bosses/zalcano/Tephra.Zalcano');
  Rewards = require('../plugins/bosses/zalcano/Rewards.Zalcano');
  Prison = require('../plugins/bosses/zalcano/Prison.Zalcano');
  tasks = [];
  events = [];
  questDone = true;
  const api = new Proxy({
    core: { ...core, TaskManager: { submit: (task) => tasks.push(task) } },
    persistAttribute: () => {},
    emitCustomEvent(name, event) {
      events.push([name, event]);
      if (name === 'quest:is-complete') event.complete = questDone;
      if (name === 'mining:best-pickaxe') event.pickaxe = { id: 1275, requiredLevel: 41, attemptIntervalTicks: 3 };
      if (name === 'npc-drops:roll-table') {
        const entries = [
          { item_id: 2353, quantity: [16, 699], weight: 3 },
          { item_id: 23962, quantity: [1, 3] },
        ];
        const tertiary = [
          { item_id: 23953, quantity: [1, 1], weight: 39 },
          { item_id: 23760, quantity: [1, 1], weight: 1 },
        ];
        const keep = (e) => (event.entryFilter ? event.entryFilter(e) : true);
        const kept = [...entries.filter(keep), ...tertiary.filter(keep)];
        event.drops.push(...kept.map((e) => ({ itemId: e.item_id, amount: e.quantity[0] })));
      }
    },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  Common.init(api);
});

const loc = (x, y) => new core.Location(x, y, 0);

function fakeNpc(id, x, y, hp, size = 5) {
  let transform = -1;
  const npc = {
    hp, anims: [], removed: false,
    getId: () => (transform !== -1 ? transform : id),
    setNpcTransformationId: (to) => { transform = to; },
    getLocation: () => loc(x, y),
    moveTo(to) { x = to.getX(); y = to.getY(); },
    getSize: () => size,
    getHitpoints: () => npc.hp,
    setHitpoints: (v) => { npc.hp = v; },
    getMaxHitpoints: () => (id === 9051 ? 14 : 1000),
    performAnimation: (a) => npc.anims.push(a.getId?.() ?? a),
    setScriptedMovement() {},
    isRegistered: () => !npc.removed,
    getMovementQueue: () => ({ walkStep: (dx, dy) => { x += dx; y += dy; } }),
  };
  return npc;
}

function fakeWorld() {
  const world = {
    npcs: [], objects: [],
    spawnNpc(id, tile) {
      const npc = fakeNpc(id, tile[0], tile[1], id === Common.ids.npcs.golem ? 14 : 1000, id === Common.ids.npcs.golem ? 1 : 5);
      world.npcs.push(npc);
      return npc;
    },
    removeNpc(npc) { if (npc) npc.removed = true; },
    placeObject(id, tile) { const o = { id, tile }; world.objects.push(o); return o; },
    removeObject(o) { world.objects = world.objects.filter((x) => x !== o); },
  };
  return world;
}

function fakePlayer(x = 3028, y = 6050) {
  let tile = loc(x, y);
  const items = new Map();
  const player = {
    damage: [], messages: [], chat: [], attributes: {}, varps: {}, run: 100, blocked: false,
    getLocation: () => tile,
    moveTo: (to) => { tile = to; },
    isRegistered: () => true,
    isPlayer: () => true,
    getAsPlayer: () => player,
    sendMessage: (m) => player.messages.push(m),
    forceChat: (m) => player.chat.push(m),
    getRunEnergy: () => player.run,
    setRunEnergy: (v) => { player.run = v; },
    getAttribute: (k) => player.attributes[k],
    setAttribute: (k, v) => { player.attributes[k] = v; },
    getPacketSender: () => ({ sendGraphic() {}, sendConfig: (id, v) => { player.varps[id] = v; } }),
    getInventory: () => ({
      getAmount: (id) => items.get(id) ?? 0,
      contains: (id) => (items.get(id) ?? 0) > 0,
      deleteNumber: (id, n) => items.set(id, (items.get(id) ?? 0) - n),
      adds: (id, n) => items.set(id, (items.get(id) ?? 0) + n),
      getFreeSlots: () => 20,
    }),
    getEquipment: () => ({ get: () => null }),
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => player.damage.push(...hits.map((h) => h.getDamage())) }), getTarget: () => player.target ?? null }),
    getMovementQueue: () => ({ reset() {}, setBlockMovement: (v) => { player.blocked = v; } }),
    items,
  };
  return player;
}

function newFight(players = [fakePlayer()]) {
  const world = fakeWorld();
  const fight = new Fight(world, () => players, () => 0);
  fight.start();
  return { fight, world, players };
}

function flush() {
  const due = tasks;
  tasks = [];
  for (const task of due) task.execute();
}

test('every id resolves from the cache', () => {
  const { npcs, locs, items, varps } = Common.ids;
  assert.deepEqual([npcs.armoured, npcs.weakened, npcs.golem], [9049, 9050, 9051]);
  assert.deepEqual([locs.rockGlowing, locs.rock, locs.rockDepleted, locs.furnace, locs.altar], [36192, 36193, 36194, 36195, 36196]);
  assert.deepEqual([locs.entrance, locs.exit, locs.barrier], [36198, 36197, 36201]);
  assert.deepEqual([items.tephra, items.refined, items.imbued, items.pet, items.shard], [23905, 23906, 23907, 23760, 23908]);
  assert.equal(varps.kills, 2352);
});

test('the platform down needs Song of the Elves; the one inside takes players back up', () => {
  const player = fakePlayer(3281, 6057);
  questDone = false;
  Prison.platform({ player, objectId: Common.ids.locs.entrance });
  assert.equal(player.messages.at(-1), Common.message('needQuest'));
  assert.equal(player.getLocation().getX(), 3281);
  questDone = true;
  Prison.platform({ player, objectId: Common.ids.locs.entrance });
  assert.deepEqual([player.getLocation().getX(), player.getLocation().getY()], Common.data.prison.platform);
  Prison.platform({ player, objectId: Common.ids.locs.exit });
  assert.deepEqual([player.getLocation().getX(), player.getLocation().getY()], Common.data.prison.outside);
});

test('she comes with 300 armour; one rock glows, the others are ordinary', () => {
  const { fight, world } = newFight();
  assert.equal(fight.npc.getHitpoints(), 300);
  const ids = world.objects.map((o) => o.id);
  assert.equal(ids.filter((id) => id === Common.ids.locs.rockGlowing).length, 1);
  assert.equal(ids.filter((id) => id === Common.ids.locs.rock).length, 3);
});

test('blasting the glowing rock hurts whoever is beside it and lights another corner', () => {
  const [nx, ny] = Common.data.prison.rocks[0];
  const player = fakePlayer(nx + 1, ny - 1);
  const { fight } = newFight([player]);
  fight.glowing = 0;
  fight.setRocks();
  fight.blastRock();
  assert.notEqual(fight.glowing, 0);
  for (let i = 0; i < 3; i++) fight.tick();
  assert.equal(player.damage.length, 1);
  assert.ok(player.damage[0] >= 21 && player.damage[0] <= Common.data.attacks.rockBlast.max);
});

test('only imbued tephra hurts her armour; at 0 she falls, and only mining hurts her then', () => {
  const { fight } = newFight();
  const player = fakePlayer();
  fight.npc.__zalFight = fight;
  const hit = (method, damage) => {
    let value = damage;
    const part = { getDamage: () => value, setDamage: (v) => { value = v; } };
    return { part, getAttacker: () => player, getCombatMethod: () => method, getHits: () => [part], updateTotalDamage() {} };
  };
  const melee = hit({}, 20);
  Prison.hitModify({ npc: fight.npc, hit: melee });
  assert.equal(melee.part.getDamage(), 0);
  const thrown = hit(Tephra.resolveMethod({ isPlayer: () => true, getAsPlayer: () => ({ ...player, getInventory: () => ({ getAmount: () => 5 }) }), getCombat: () => ({ getTarget: () => ({ isNpc: () => true, getAsNpc: () => fight.npc }) }) }), 20);
  Prison.hitModify({ npc: fight.npc, hit: thrown });
  assert.equal(thrown.part.getDamage(), 20);
  assert.equal(fight.contribution(player).shield, 20);
  assert.equal(fight.hp, 280);

  fight.setHp(0);
  const event = { npc: fight.npc, preventDeath: false };
  Prison.beforeDeath(event);
  assert.equal(event.preventDeath, true);
  assert.equal(fight.phase, 'down');
  assert.equal(fight.npc.getId(), Common.ids.npcs.weakened);
  assert.equal(fight.npc.getHitpoints(), 1000);
  const thrownDown = hit(thrown.getCombatMethod(), 20);
  Prison.hitModify({ npc: fight.npc, hit: thrownDown });
  assert.equal(thrownDown.part.getDamage(), 0, 'tephra does nothing once she is down');
  const mined = hit(Tephra.miningMethod(), 31);
  Prison.hitModify({ npc: fight.npc, hit: mined });
  assert.equal(mined.part.getDamage(), 31);
  assert.equal(fight.contribution(player).health, 31);
});

test('when she rises her armour is whole, all tephra crumbles and those beside her are pushed back', () => {
  const beside = fakePlayer(3030, 6050);
  const away = fakePlayer(3040, 6040);
  for (const p of [beside, away]) for (const id of [Common.ids.items.tephra, Common.ids.items.refined, Common.ids.items.imbued]) p.items.set(id, 4);
  const { fight } = newFight([beside, away]);
  fight.fall();
  fight.setHp(700);
  while (fight.phase === 'down') fight.tick();
  assert.equal(fight.health, 700);
  assert.equal(fight.npc.getHitpoints(), 300);
  assert.equal(fight.npc.getId(), Common.ids.npcs.armoured);
  for (const p of [beside, away]) for (const id of [Common.ids.items.tephra, Common.ids.items.refined, Common.ids.items.imbued]) assert.equal(p.items.get(id), 0);
  assert.ok(beside.damage.includes(Common.data.zalcano.shockwave.damage));
  assert.ok(beside.getLocation().getX() < 3030, 'pushed west, away from her');
  assert.equal(beside.blocked, true);
  flush();
  assert.equal(beside.blocked, false);
  assert.equal(away.damage.length, 0);
});

test('a golem that reaches her gives back armour for the health it has left', () => {
  const { fight } = newFight();
  fight.setHp(200);
  fight.sendGolem();
  const golem = fight.golems[0].npc;
  golem.moveTo(loc(3030, 6050));
  golem.hp = 7;
  fight.tickGolems();
  assert.equal(fight.npc.getHitpoints(), 225);
  assert.equal(fight.golems.length, 0);
  assert.equal(golem.removed, true);
});

test('a golem walks towards her, and its tephra goes to whoever hurt it most', () => {
  const { fight } = newFight();
  fight.sendGolem();
  const golem = fight.golems[0].npc;
  const start = golem.getLocation();
  for (let i = 0; i < 4; i++) { fight.tickCount += 1; fight.tickGolems(); }
  assert.ok(Common.distanceToNpc(golem.getLocation(), fight.npc) < Common.distanceToNpc(start, fight.npc));
  const a = fakePlayer();
  const b = fakePlayer();
  fight.recordGolem(golem, a, 4);
  fight.recordGolem(golem, b, 9);
  assert.equal(fight.golemKiller(golem), b);
});

test('an orange symbol is safe for 3 ticks, then hurts more each tick; blue empowers tephra', () => {
  const player = fakePlayer(3024, 6039);
  const { fight, world } = newFight([player]);
  const object = world.placeObject(Common.ids.locs.symbolDamage, [3023, 6038]);
  fight.symbols = [{ tile: loc(3023, 6038), empower: false, until: fight.tickCount + 20, object, standing: new Map() }];
  for (let i = 0; i < 5; i++) fight.tickSymbols([player]);
  const { step } = Common.data.attacks.symbols;
  assert.deepEqual(player.damage, [step, step * 2]);
  assert.deepEqual(player.chat, [Common.message('agh')]);
  assert.ok(player.run < 100);
  fight.symbols = [{ tile: loc(3023, 6038), empower: true, until: fight.tickCount + 20, object, standing: new Map() }];
  assert.equal(fight.empowered(player), true);
});

test('symbols never cover her and fade after their time', () => {
  const { fight } = newFight();
  fight.drawSymbols();
  assert.ok(fight.symbols.length >= 1);
  for (const symbol of fight.symbols) {
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) assert.ok(Common.distanceToNpc(symbol.tile.transform(dx, dy), fight.npc) > 0);
  }
  fight.tickCount = fight.symbols[0].until;
  fight.tickSymbols([]);
  assert.equal(fight.symbols.length, 0);
});

test('a boulder lands where the player stood when it fell', () => {
  const player = fakePlayer(3040, 6045);
  const { fight } = newFight([player]);
  fight.dropBoulders([player]);
  for (let i = 0; i < Common.data.attacks.boulders.warnTicks; i++) fight.tick();
  assert.equal(player.damage.length, 1);
  assert.ok(player.damage[0] >= 30 && player.damage[0] <= 40);
});

test('throw max hit: 5 + (Smithing + Runecraft) / 14, half again on blue; mining by level and pickaxe', () => {
  assert.equal(Tephra.throwMaxHit(99, 99, false), 19);
  assert.equal(Tephra.throwMaxHit(70, 70, false), 15);
  assert.equal(Tephra.throwMaxHit(99, 99, true), 28);
  assert.equal(Tephra.miningMaxHit(99, { requiredLevel: 41 }), 33);
  assert.equal(Tephra.miningMaxHit(80, { requiredLevel: 61 }), 32);
  assert.equal(Tephra.miningMaxHit(70, { requiredLevel: 71 }), 32);
  assert.equal(Tephra.miningMaxHit(50, { requiredLevel: 1 }), 30);
});

test('attacking without imbued tephra does nothing', () => {
  const player = fakePlayer();
  const zalcano = fakeNpc(Common.ids.npcs.armoured, 3031, 6048, 300);
  let reset = false;
  const combat = { reset: () => { reset = true; }, getTarget: () => ({ isNpc: () => true, getAsNpc: () => zalcano }) };
  const attacker = { isPlayer: () => true, getAsPlayer: () => player, getCombat: () => combat };
  const method = Tephra.resolveMethod(attacker);
  assert.equal(method.canPursue(attacker, zalcano), true, 'the engine reaches canAttack');
  assert.equal(method.canAttack(attacker), false);
  assert.equal(player.messages.at(-1), Common.message('noImbued'));
  assert.equal(reset, true, 'the attack ends instead of hanging on her');
  assert.equal(Tephra.isThrow(method), false);
  zalcano.setNpcTransformationId(Common.ids.npcs.weakened);
  const fallen = Tephra.resolveMethod(attacker);
  fallen.canAttack(attacker);
  assert.equal(player.messages.at(-1), Common.message('mineHer'));
});

test('refining and imbuing turn one tephra a tick, with their experience', () => {
  const player = fakePlayer();
  const xp = [];
  player.getSkillManager = () => ({ addExperiences: (skill, amount) => xp.push(amount), getCurrentLevel: () => 99 });
  player.performAnimation = () => {};
  player.items.set(Common.ids.items.tephra, 2);
  const prisonState = { tickCount: 0, fight: null };
  Tephra.refine(prisonState, { player, objectId: Common.ids.locs.furnace });
  for (let i = 0; i < 3; i++) { prisonState.tickCount += 1; Tephra.tickActions(prisonState, [player]); }
  assert.equal(player.items.get(Common.ids.items.refined), 2);
  Tephra.imbue(prisonState, { player, objectId: Common.ids.locs.altar });
  for (let i = 0; i < 3; i++) { prisonState.tickCount += 1; Tephra.tickActions(prisonState, [player]); }
  assert.equal(player.items.get(Common.ids.items.imbued), 2);
  assert.deepEqual(xp, [10, 10, 5, 5]);
  assert.equal(Tephra.refine(prisonState, { player, objectId: 1 }), false, 'another furnace is not hers');
});

test('the glowing rock gives tephra far faster than an ordinary one', () => {
  const run = (glowing) => {
    const [x, y] = Common.data.prison.rocks[0];
    const player = fakePlayer(x - 1, y);
    player.getSkillManager = () => ({ addExperiences() {}, getCurrentLevel: () => 99 });
    player.performAnimation = () => {};
    const prisonState = { tickCount: 0, fight: { glowing: glowing ? 0 : 1, phase: 'armoured' } };
    Tephra.mineRock(prisonState, { player, objectId: glowing ? Common.ids.locs.rockGlowing : Common.ids.locs.rock });
    let seed = 1;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 300; i++) { prisonState.tickCount += 1; Tephra.tickActions(prisonState, [player], random); }
    Tephra.actions.delete(player);
    return player.items.get(Common.ids.items.tephra) ?? 0;
  };
  assert.ok(run(true) > run(false) * 3);
});

test('points: health + 2 x armour for the table, capped at 1,000 for the rest', () => {
  assert.deepEqual(Rewards.points({ shield: 100, health: 300 }), { main: 500, tertiary: 500 });
  assert.deepEqual(Rewards.points({ shield: 400, health: 900 }), { main: 1700, tertiary: 1000 });
  assert.equal(Rewards.eligible({ shield: 4, health: 900 }), false);
  assert.equal(Rewards.eligible({ shield: 5, health: 0 }), true);
  assert.equal(Rewards.uniqueEligible({ shield: 5, health: 25 }), false);
  assert.equal(Rewards.uniqueEligible({ shield: 5, health: 26 }), true);
});

test('quantities grow with points; the shard chance runs from 1/1500 to 1/750', () => {
  const full = Common.data.rewards.fullPoints;
  assert.equal(Rewards.scaledAmount([16, 699], 0), 16);
  assert.equal(Rewards.scaledAmount([16, 699], full), 699);
  assert.equal(Rewards.scaledAmount([16, 699], full * 4), 699);
  assert.ok(Math.abs(Rewards.shardChance(0) - 1 / 1500) < 1e-12);
  assert.ok(Math.abs(Rewards.shardChance(1000) - 1 / 750) < 1e-12);
});

test('the kill: shards by contribution, the MVP\'s ashes and 10%, nothing under 5 armour damage', () => {
  const mvp = fakePlayer();
  const helper = fakePlayer();
  const tiny = fakePlayer();
  const contributions = new Map([
    [mvp, { shield: 150, health: 600 }],
    [helper, { shield: 20, health: 5 }],
    [tiny, { shield: 3, health: 200 }],
  ]);
  events = [];
  const loot = Rewards.share(contributions, () => 0.99);
  const item = (player, id) => loot.get(player)?.find((d) => d.itemId === id)?.amount;
  const { items } = Common.ids;
  assert.equal(item(mvp, items.crystalShard), 3);
  assert.equal(item(mvp, items.infernalAshes), 1);
  assert.equal(item(helper, items.crystalShard), 1, 'under 31 damage: one shard');
  assert.equal(item(helper, items.infernalAshes), undefined);
  assert.equal(loot.has(tiny), false);
  assert.equal(tiny.messages.at(-1), Common.message('tooLittle'));
  const helperBars = item(helper, 2353);
  const mvpBars = item(mvp, 2353);
  assert.equal(helperBars, Rewards.scaledAmount([16, 699], 45));
  assert.equal(mvpBars, Math.ceil(Rewards.scaledAmount([16, 699], 900) * 1.1));
  assert.equal(item(mvp, 23962), 3, 'the always-shards are not rolled again from the table');
  for (const p of [mvp, helper]) {
    assert.equal(item(p, Common.ids.items.toolSeed), undefined, 'the table\'s own unique rows are not rolled again');
    assert.equal(item(p, Common.ids.items.pet), undefined);
  }
  assert.ok(events.some(([name, e]) => name === 'npc-drops:roll' && e.player === mvp && e.drops.some((d) => d.itemId === 2353)), 'the kill goes through npc-drops:roll');
  assert.equal(mvp.attributes[Common.KILLS_ATTRIBUTE], 1);
  assert.equal(mvp.varps[Common.ids.varps.kills], 1);
  assert.equal(mvp.messages.at(-1), Common.message('killCount', { kills: 1 }));
  assert.equal(tiny.attributes[Common.KILLS_ATTRIBUTE], undefined);
  assert.ok(events.some(([name, e]) => name === 'npc-drops:place' && e.player === mvp));
});

test('the unique goes to one unique-eligible player; the pet goes through Pets', () => {
  const a = fakePlayer();
  const b = fakePlayer();
  const contributions = new Map([[a, { shield: 50, health: 100 }], [b, { shield: 100, health: 400 }]]);
  events = [];
  const loot = Rewards.share(contributions, () => 0);
  const uniques = [a, b].flatMap((p) => loot.get(p).filter((d) => [Common.ids.items.toolSeed, Common.ids.items.uncutOnyx].includes(d.itemId)));
  assert.equal(uniques.length, 1);
  assert.equal(uniques[0].itemId, Common.ids.items.toolSeed);
  const pets = events.filter(([name, e]) => name === 'npc-drops:roll' && e.drops.some((d) => d.itemId === Common.ids.items.pet));
  assert.equal(pets.length, 2, 'each eligible player rolls the pet, handed to Pets on npc-drops:roll');
  assert.ok(loot.get(a).some((d) => d.itemId === Common.ids.items.shard));
});

test("her world spawn is kept out of the prison; elsewhere spawns are untouched", () => {
  const inside = { npcId: Common.ids.npcs.armoured, location: loc(3031, 6048), allow: true };
  Prison.blockWorldSpawn(inside);
  assert.equal(inside.allow, false);
  const outside = { npcId: Common.ids.npcs.armoured, location: loc(3200, 3200), allow: true };
  Prison.blockWorldSpawn(outside);
  assert.equal(outside.allow, true);
});

test('the barrier crosses either way; another barrier is not hers', () => {
  const player = fakePlayer(3034, 6063);
  Prison.pass({ player, objectId: Common.ids.locs.barrier });
  assert.deepEqual([player.getLocation().getX(), player.getLocation().getY()], Common.data.prison.barrierSouth);
  Prison.pass({ player, objectId: Common.ids.locs.barrier });
  assert.deepEqual([player.getLocation().getX(), player.getLocation().getY()], Common.data.prison.barrierNorth);
  assert.equal(Prison.pass({ player, objectId: 1 }), false);
});

test('throws landing on one tick share what armour she has left; the rest does nothing', () => {
  const { fight } = newFight();
  fight.npc.__zalFight = fight;
  fight.setHp(10);
  const a = fakePlayer();
  const b = fakePlayer();
  const method = Tephra.resolveMethod({ isPlayer: () => true, getAsPlayer: () => ({ ...a, getInventory: () => ({ getAmount: () => 5 }) }), getCombat: () => ({ getTarget: () => ({ isNpc: () => true, getAsNpc: () => fight.npc }) }) });
  const hit = (player, damage) => {
    let value = damage;
    const part = { getDamage: () => value, setDamage: (v) => { value = v; } };
    return { part, getAttacker: () => player, getCombatMethod: () => method, getHits: () => [part], updateTotalDamage() {} };
  };
  const first = hit(a, 7);
  const second = hit(b, 15);
  Prison.hitModify({ npc: fight.npc, hit: first });
  Prison.hitModify({ npc: fight.npc, hit: second });
  assert.equal(first.part.getDamage(), 7);
  assert.equal(second.part.getDamage(), 3);
  assert.equal(fight.contribution(a).shield + fight.contribution(b).shield, 10);
});

test('damage from anything but tephra and mining is put back, and never makes her fall or die', () => {
  const { fight } = newFight();
  fight.npc.__zalFight = fight;
  fight.npc.setHitpoints(250);
  fight.npc.getPoisonDamage = () => 6;
  let poison = 6;
  fight.npc.setPoisonDamage = (v) => { poison = v; };
  fight.tick();
  assert.equal(fight.npc.getHitpoints(), 300);
  assert.equal(poison, 0);
  fight.npc.setHitpoints(0);
  const event = { npc: fight.npc, preventDeath: false };
  Prison.beforeDeath(event);
  assert.equal(event.preventDeath, true);
  assert.equal(fight.phase, 'armoured');
  assert.equal(fight.npc.getHitpoints(), 300);
  fight.fall();
  fight.setHp(0);
  const death = { npc: fight.npc, preventDeath: false };
  Prison.beforeDeath(death);
  assert.equal(death.preventDeath, false, 'mined to 0 she dies');
});

test('dying she does nothing more: no rise, no attacks', () => {
  const player = fakePlayer(3030, 6050);
  const { fight } = newFight([player]);
  fight.fall();
  fight.setHp(0);
  fight.downUntil = fight.tickCount + 1;
  for (let i = 0; i < 5; i++) fight.tick();
  assert.equal(fight.phase, 'down');
  assert.equal(player.damage.length, 0);
});

test('tephra never leaves the prison, carried or wielded', () => {
  const player = fakePlayer();
  for (const id of [Common.ids.items.tephra, Common.ids.items.refined, Common.ids.items.imbued]) player.items.set(id, 3);
  let weapon = new core.Item(Common.ids.items.imbued, 12);
  player.getEquipment = () => ({ get: () => weapon, set: (_slot, item) => { weapon = item; }, refreshItems() {} });
  assert.equal(Tephra.removeTephra(player), 21);
  assert.equal(weapon.getId(), -1);
  for (const id of [Common.ids.items.tephra, Common.ids.items.refined, Common.ids.items.imbued]) assert.equal(player.items.get(id), 0);
});

test('symbols are never drawn over a rock', () => {
  for (let i = 0; i < 20; i++) {
    const { fight } = newFight();
    let seed = i + 1;
    fight.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    fight.drawSymbols();
    for (const symbol of fight.symbols) {
      for (const [rx, ry] of Common.data.prison.rocks) {
        assert.ok(Math.abs(symbol.tile.getX() - rx) >= 3 || Math.abs(symbol.tile.getY() - ry) >= 3);
      }
    }
  }
});
