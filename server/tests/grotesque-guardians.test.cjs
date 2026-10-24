// From server/: node --test tests/grotesque-guardians.test.cjs (after yarn build).
//
// The Grotesque Guardians against the OSRS Wiki (Grotesque_Guardians, /Strategies, Dusk, Dawn):
// the roof's key and bell, who can be hurt by what in each phase, the phase changes at half
// health, the rockfall, spheres and prison, enraged Dusk's style switches, and the kill.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const core = PluginManager.getCoreApi();

let Common, Fight, Roof, Combat, Kills, tasks, onTaskAnswer, prayers, killTotal;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  Common = require('../plugins/bosses/grotesqueguardians/Common.GrotesqueGuardians');
  ({ Fight } = require('../plugins/bosses/grotesqueguardians/Fight.GrotesqueGuardians'));
  Roof = require('../plugins/bosses/grotesqueguardians/Roof.GrotesqueGuardians');
  Combat = require('../plugins/bosses/grotesqueguardians/Combat.GrotesqueGuardians');
  Kills = require('../plugins/bosses/grotesqueguardians/Kills.GrotesqueGuardians');
  tasks = [];
  onTaskAnswer = () => true;
  prayers = new Set();
  killTotal = undefined;
  const api = new Proxy({
    core: { ...core, TaskManager: { submit: (task) => tasks.push(task) } },
    persistAttribute: () => {},
    getPrayerHandler: () => ({
      PROTECT_FROM_MELEE: 'melee', PROTECT_FROM_MISSILES: 'missiles',
      isActivated: (_player, prayer) => prayers.has(prayer),
    }),
    emitCustomEvent(name, event) {
      if (name === 'slayer:on-task') event.onTask = onTaskAnswer(event);
      if (name === 'combat-achievements:count') event.total = killTotal;
    },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  Common.init(api);
});

/** Runs every queued one-shot task. */
function flush() {
  const due = tasks;
  tasks = [];
  for (const task of due) task.execute();
}

const loc = (x, y) => new core.Location(x, y, 0);

function fakeGuardian(id, x, y, hp = 450) {
  let transform = -1;
  const npc = {
    hitpoints: hp, anims: [], locked: false, dying: false,
    setHitpointsLocked: (locked) => { npc.locked = locked; },
    isDyingFunction: () => npc.dying,
    getId: () => (transform !== -1 ? transform : id),
    setNpcTransformationId: (to) => { transform = to; },
    getLocation: () => loc(x, y),
    getSize: () => 4,
    getHitpoints: () => npc.hitpoints,
    setHitpoints: (value) => { npc.hitpoints = value; },
    getMaxHitpoints: () => 450,
    performAnimation: (anim) => npc.anims.push(anim.getId?.() ?? anim),
    getCombat: () => ({ reset: () => {}, setAttackDelay: () => {} }),
  };
  return npc;
}

function fakePlayer(x = 1695, y = 4575) {
  let tile = loc(x, y);
  const player = {
    damage: [], messages: [], blocked: false, attributes: {}, varbits: {}, items: new Map(),
    getLocation: () => tile,
    moveTo: (to) => { tile = to; },
    isRegistered: () => true,
    isPlayer: () => true,
    getAsPlayer: () => player,
    getHitpoints: () => 99,
    sendMessage: (m) => player.messages.push(m),
    getAttribute: (key) => player.attributes[key],
    setAttribute: (key, value) => { player.attributes[key] = value; },
    getPacketSender: () => ({ sendGraphic: () => {}, sendVarbit: (id, value) => { player.varbits[id] = value; } }),
    getInventory: () => ({
      contains: (id) => (player.items.get(id) ?? 0) > 0,
      deleteNumber: (id, n) => player.items.set(id, (player.items.get(id) ?? 0) - n),
    }),
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => player.damage.push(...hits.map((h) => h.getDamage())) }) }),
    getMovementQueue: () => ({ reset: () => {}, setBlockMovement: (value) => { player.blocked = value; } }),
  };
  return player;
}

function fakeRoof(player) {
  const [minX, maxX, minY, maxY] = Common.data.roof.floor;
  return {
    players: () => (player ? [player] : []),
    contains: (l) => l.getX() >= minX && l.getX() <= maxX && l.getY() >= minY && l.getY() <= maxY,
  };
}

function newFight(player = fakePlayer()) {
  const { npcs } = Common.ids;
  const dusk = fakeGuardian(npcs.duskPhase1, 1689, 4573);
  const dawn = fakeGuardian(npcs.dawnPhase1, 1701, 4573);
  return { fight: new Fight(fakeRoof(player), dusk, dawn, () => 0), dusk, dawn, player };
}

/** A PendingHit-shaped hit from the player of `type`, with `damages` per splat. */
function fakeHit(attacker, type, damages) {
  const parts = damages.map((value) => {
    let damage = value;
    return { getDamage: () => damage, setDamage: (v) => { damage = v; } };
  });
  return { parts, getAttacker: () => attacker, getCombatType: () => type, getHits: () => parts, updateTotalDamage: () => {} };
}

test('every id resolves from the cache', () => {
  const { npcs, locs, items, varbits } = Common.ids;
  assert.deepEqual(Common.duskForms(), [7851, 7854, 7882, 7883, 7887, 7888, 7889]);
  assert.deepEqual(Common.dawnForms(), [7852, 7853, 7884, 7885]);
  assert.equal(npcs.duskPhase4, 7888);
  assert.equal(locs.entrance, 31681);
  assert.equal(locs.exit, 31674);
  assert.ok(locs.bell.includes(31669), 'the bell is clicked as its multiloc parent');
  assert.equal(items.key, 21724);
  assert.equal(varbits.unlocked, 2468);
});

test('phase 1: only Dawn can be hurt; at half health she flies up and Dusk fights alone', () => {
  const { fight, dusk, dawn } = newFight();
  assert.equal(fight.vulnerable(dawn), true);
  assert.equal(fight.vulnerable(dusk), false);
  dawn.hitpoints = 225;
  assert.equal(fight.checkPhase(), true);
  assert.equal(fight.phase, 2);
  assert.equal(dawn.getId(), Common.ids.npcs.dawnFlying);
  assert.equal(dusk.getId(), Common.ids.npcs.duskPhase2);
  assert.equal(fight.vulnerable(dawn), false);
  assert.equal(fight.vulnerable(dusk), true);
});

test('phase 3 at half Dusk: Dawn comes down, safe until the lightning ends, then the spheres', () => {
  const { fight, dusk, dawn, player } = newFight();
  fight.phase = 2;
  dusk.hitpoints = 220;
  fight.tick([player]);
  assert.equal(fight.phase, 3);
  assert.equal(dusk.getId(), Common.ids.npcs.duskPhase3);
  assert.equal(dawn.getId(), Common.ids.npcs.dawnPhase3);
  assert.equal(fight.vulnerable(dawn), false);
  assert.equal(fight.vulnerable(dusk), false);
  while (fight.tickCount < fight.lightningUntil) fight.tick([player]);
  assert.equal(fight.vulnerable(dawn), true);
  assert.equal(fight.spheres.length, Common.data.spheres.count);
  assert.ok(player.damage.length > 0, 'a vortex always falls on the player');
});

test('a sphere left alone heals Dawn 90; one walked into is taken', () => {
  const { fight, dawn, player } = newFight(fakePlayer(1690, 4570));
  fight.phase = 3;
  dawn.hitpoints = 100;
  fight.spheres = [
    { tile: loc(1690, 4570), arrives: 5 },
    { tile: loc(1700, 4580), arrives: 5 },
  ];
  fight.tick([player]);
  assert.equal(fight.spheres.length, 1);
  fight.tickCount = 5;
  fight.tickSpheres([player]);
  assert.equal(dawn.hitpoints, 190);
  assert.equal(fight.spheres.length, 0);
});

test('Dawn finished: Dusk takes her essence, enrages and opens with a prison', () => {
  const { fight, dusk, dawn, player } = newFight();
  fight.phase = 3;
  dawn.hitpoints = 0;
  fight.tick([player]);
  assert.equal(fight.phase, 3, 'at 0 she waits for the rock hammer');
  dawn.dying = true;
  fight.tick([player]);
  assert.equal(fight.phase, 4);
  assert.equal(dusk.getId(), Common.ids.npcs.duskPhase4Spawn);
  flush();
  assert.equal(dusk.getId(), Common.ids.npcs.duskPhase4);
  assert.ok(fight.prison, 'the prison closes round the player');
  assert.equal(fight.vulnerable(dusk), false, 'Dusk cannot be hurt during the first prison');
  fight.dawnDied();
  assert.equal(fight.prisons, 1, 'a second death report changes nothing');
});

test('the prison hits whoever is still inside when it closes, and heals Dusk by as much', () => {
  const player = fakePlayer(1695, 4575);
  const { fight, dusk } = newFight(player);
  fight.phase = 4;
  dusk.hitpoints = 200;
  fight.imprison(player);
  for (let i = 0; i < Common.data.prison.escapeTicks; i++) fight.tick([player]);
  assert.equal(fight.prison, null);
  const hit = player.damage.at(-1);
  assert.ok(hit >= 0 && hit <= Common.data.prison.max);
  assert.equal(dusk.hitpoints, 200 + hit);
  assert.equal(fight.vulnerable(dusk), true, 'after the first prison Dusk can be hurt');
});

test('stepping onto the gap escapes the prison', () => {
  const player = fakePlayer(1695, 4575);
  const { fight, dusk } = newFight(player);
  fight.phase = 4;
  fight.imprison(player);
  player.moveTo(fight.prison.gap);
  const before = player.damage.length;
  for (let i = 0; i < Common.data.prison.escapeTicks; i++) fight.tick([player]);
  assert.equal(player.damage.length, before);
  assert.equal(dusk.hitpoints, 450);
});

test('phase 2 rocks fall on the floor only; a direct hit stuns', () => {
  const { fight, player } = newFight();
  fight.phase = 2;
  fight.dropRocks(player);
  assert.ok(fight.rocks.length > 1);
  assert.ok(fight.rocks.every((rock) => fakeRoof(null).contains(rock.tile)));
  for (let i = 0; i < Common.data.rockfall.warnTicks; i++) fight.tick([player]);
  assert.equal(player.blocked, true);
  assert.ok(player.damage.length >= 1);
});

test('Dusk only takes melee; Dawn takes ranged or a halberd, never other melee', () => {
  const { fight, dusk, dawn } = newFight();
  const player = fakePlayer();
  player.getWeapon = () => core.WeaponInterfaces.WHIP;
  fight.phase = 2;
  const ranged = fakeHit(player, core.CombatType.RANGED, [20]);
  Roof.guardianHit({ npc: dusk, hit: ranged });
  assert.equal(ranged.parts[0].getDamage(), 0);
  const melee = fakeHit(player, core.CombatType.MELEE, [20]);
  Roof.guardianHit({ npc: dusk, hit: melee });
  assert.equal(melee.parts[0].getDamage(), 20);

  fight.phase = 1;
  const whip = fakeHit(player, core.CombatType.MELEE, [20]);
  Roof.guardianHit({ npc: dawn, hit: whip });
  assert.equal(whip.parts[0].getDamage(), 0);
  player.getWeapon = () => core.WeaponInterfaces.HALBERD;
  const halberd = fakeHit(player, core.CombatType.MELEE, [20]);
  Roof.guardianHit({ npc: dawn, hit: halberd });
  assert.equal(halberd.parts[0].getDamage(), 20);
  const bow = fakeHit(player, core.CombatType.RANGED, [20]);
  Roof.guardianHit({ npc: dawn, hit: bow });
  assert.equal(bow.parts[0].getDamage(), 20);
});

test('a hit stops at half health, so the phase change comes before any more damage', () => {
  const { dawn } = newFight();
  const player = fakePlayer();
  dawn.hitpoints = 240;
  const hit = fakeHit(player, core.CombatType.RANGED, [10, 10]);
  Roof.guardianHit({ npc: dawn, hit });
  assert.deepEqual(hit.parts.map((p) => p.getDamage()), [10, 5]);
});

test('neither Guardian takes anything outside a fight', () => {
  const dusk = fakeGuardian(Common.ids.npcs.duskPhase2, 1689, 4573);
  const hit = fakeHit(fakePlayer(), core.CombatType.MELEE, [30]);
  Roof.guardianHit({ npc: dusk, hit });
  assert.equal(hit.parts[0].getDamage(), 0);
});

test('enraged Dusk opens on the style the player is not praying against, then mostly keeps it', () => {
  const npc = {};
  const target = fakePlayer();
  prayers = new Set(['melee']);
  assert.equal(Combat.nextEnragedStyle(npc, target, () => 0.1), 'ranged');
  assert.equal(Combat.nextEnragedStyle(npc, target, () => 0.5), 'ranged', 'no switch above 1 in 6');
  prayers = new Set(['missiles']);
  assert.equal(Combat.nextEnragedStyle(npc, target, () => 0.3), 'melee', 'praying against it: 1 in 3');
  prayers = new Set();
});

test('the Roof Entrance takes the brittle key once and stays open', () => {
  const player = fakePlayer(3427, 3541);
  const { entrance } = Common.ids.locs;
  Roof.entrance({ player, objectId: entrance });
  assert.equal(player.messages.at(-1), Common.message('locked'));
  player.items.set(Common.ids.items.key, 1);
  Roof.entrance({ player, objectId: entrance });
  assert.equal(player.getAttribute(Common.UNLOCKED_ATTRIBUTE), true);
  assert.equal(player.varbits[Common.ids.varbits.unlocked], 1);
  assert.equal(player.items.get(Common.ids.items.key), 0);
  assert.equal(Roof.entrance({ player, objectId: 1 }), false);
});

test("the world's own Dusk on the roof is kept out; elsewhere spawns are untouched", () => {
  const roofSpawn = { npcId: Common.ids.npcs.duskPhase2, location: loc(1695, 4573), allow: true };
  Roof.blockWorldSpawn(roofSpawn);
  assert.equal(roofSpawn.allow, false);
  const elsewhere = { npcId: Common.ids.npcs.duskPhase2, location: loc(3200, 3200), allow: true };
  Roof.blockWorldSpawn(elsewhere);
  assert.equal(elsewhere.allow, true);
});

test('the kill: Dusk gives the pair 1,350 Slayer XP and the kill count; Dawn gives none', () => {
  const dusk = fakeGuardian(Common.ids.npcs.duskPhase4, 1689, 4573);
  const dawn = fakeGuardian(Common.ids.npcs.dawnPhase3, 1701, 4573);
  const duskKill = { npc: dusk, xp: 450 };
  Kills.slayerXp(duskKill);
  assert.equal(duskKill.xp, 1350);
  // The pair is one kill on the task: Dawn's death isn't eligible, Dawn alive still is (helmet).
  const alive = { npc: dawn, eligible: true };
  Kills.dawnKillEligible(alive);
  assert.equal(alive.eligible, true);
  dawn.hitpoints = 0;
  const dead = { npc: dawn, eligible: true };
  Kills.dawnKillEligible(dead);
  assert.equal(dead.eligible, false);
  const duskQuery = { npc: dusk, eligible: true };
  dusk.hitpoints = 0;
  Kills.dawnKillEligible(duskQuery);
  assert.equal(duskQuery.eligible, true);

  const player = fakePlayer();
  killTotal = 4;
  Kills.guardianDeath({ npc: dusk, killer: player });
  flush();
  assert.equal(player.getAttribute(Common.KILLS_ATTRIBUTE), 1);
  assert.equal(player.messages.at(-1), Common.message('killCount', { kills: 4 }));
  killTotal = undefined;
});

test('both are finished with a rock hammer at 9 or below, like the gargoyles', () => {
  const file = path.join(__dirname, '..', 'plugins', 'skills', 'data', 'slayer-finishers.json');
  const finishers = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(finishers) ? finishers : finishers.finishers;
  const entry = list.find((f) => f.names?.includes('Dusk'));
  const gargoyle = list.find((f) => f.names?.includes('Gargoyle'));
  assert.ok(entry);
  assert.deepEqual(entry.names, ['Dusk', 'Dawn']);
  assert.equal(entry.threshold, Common.data.phases.finishThreshold);
  assert.deepEqual(entry.items, gargoyle.items);
});

test('a stun ends after its ticks; a shorter one inside a longer one leaves the longer release', () => {
  const { bind } = require('../plugins/bosses/grotesqueguardians/Fight.GrotesqueGuardians');
  const player = fakePlayer();
  bind(player, 10);
  bind(player, 3);
  assert.equal(player.blocked, true);
  assert.equal(tasks.length, 1, 'only the longer stun schedules a release');
  flush();
  assert.equal(player.blocked, false);
});

test('a Guardian that cannot be hurt keeps its hitpoints against any damage', () => {
  const { fight, dusk, dawn, player } = newFight();
  assert.equal(dusk.locked, true);
  assert.equal(dawn.locked, false);
  dawn.hitpoints = 225;
  fight.tick([player]);
  assert.equal(dusk.locked, false);
  assert.equal(dawn.locked, true, 'Dawn in the sky');
  fight.stop();
  assert.equal(dusk.locked, false);
  assert.equal(dawn.locked, false);
});

test('Dusk down to the hammer takes nothing back from a prison', () => {
  const player = fakePlayer(1695, 4575);
  const { fight, dusk } = newFight(player);
  fight.phase = 4;
  fight.imprison(player);
  dusk.hitpoints = 0;
  for (let i = 0; i < Common.data.prison.escapeTicks; i++) fight.tick([player]);
  assert.equal(dusk.hitpoints, 0);
});

test('a bell rung straight after the kill keeps its new fight', () => {
  const dusk = fakeGuardian(Common.ids.npcs.duskPhase4, 1689, 4573);
  const old = { stop: () => {} };
  let cleared = 0;
  const roof = { fight: old, clearGuardians: () => { cleared += 1; } };
  dusk.__ggFight = old;
  dusk.__ggRoof = roof;
  Kills.guardianDeath({ npc: dusk, killer: null });
  roof.fight = { stop: () => {} };
  flush();
  assert.equal(cleared, 0);
  roof.fight = old;
  dusk.__ggFight = old;
  Kills.guardianDeath({ npc: dusk, killer: null });
  flush();
  assert.equal(cleared, 1);
});
