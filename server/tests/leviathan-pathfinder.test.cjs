const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const H = require('./helpers/leviathan.cjs');
const M = require('../plugins/bosses/leviathan/Model.Leviathan');
before(H.initialize);

test('pathfinder takes a deterministic cache-valid detour when its first step cannot get closer', t => {
  const h = H.harness(t), hazards = h.fight.hazards;
  for (let y = 6378; y <= 6380; y++) hazards.place([2075, y]);
  let at = [2074, 6379], destination = [2089, 6379];
  const first = hazards.stepToward(at, destination);
  assert.notDeepEqual(first, at, 'an open route exists around the debris');
  assert.deepEqual(hazards.stepToward(at, destination), first, 'tie-breaking is deterministic');
  for (let count = 0; count < hazards.floor.size && M.key(at) !== M.key(destination); count++) {
    const next = hazards.stepToward(at, destination);
    assert.equal(M.distance(at, next), 1);
    assert.ok(hazards.open(next));
    const a = h.session.tile(at), b = h.session.tile(next);
    assert.ok(h.core.RegionManager.canMove(a.getX(), a.getY(), b.getX(), b.getY(), 0, 1, 1, h.area));
    at = next;
  }
  assert.deepEqual(at, destination);
});

test('a diagonal-only gap cannot cut between blocked orthogonal neighbors', t => {
  const h = H.harness(t), hazards = h.fight.hazards;
  const from = [2073, 6378], destination = [2074, 6379];
  assert.ok(hazards.open(from) && hazards.open(destination));
  hazards.floor = new Set([M.key(from), M.key(destination)]);
  assert.deepEqual(hazards.stepToward(from, destination), from);
});

test('directional cache wall clipping is respected even when both floor tiles are open', t => {
  const h = H.harness(t), hazards = h.fight.hazards;
  const from = [2074, 6379], destination = [2075, 6379];
  hazards.floor = new Set([M.key(from), M.key(destination)]);
  const at = h.session.tile(destination);
  h.area.setClip(at, h.area.getClip(at) | 0x80);
  assert.deepEqual(hazards.stepToward(from, destination), from);
});

test('sealed routes, blocked destinations and an already reached destination remain stationary', t => {
  const h = H.harness(t), hazards = h.fight.hazards;
  const from = [2074, 6379], destination = [2089, 6379];
  assert.deepEqual(hazards.stepToward(from, from), from);
  hazards.place(destination);
  assert.deepEqual(hazards.stepToward(from, destination), from);
  hazards.blockers.clear();
  hazards.floor = new Set([M.key(from), M.key(destination)]);
  assert.deepEqual(hazards.stepToward(from, destination), from);
});

test('aura and enrage prayer piercing start with registered spawn, with no extra activation delay', t => {
  const h = H.harness(t), fight = h.fight, hazards = fight.hazards;
  fight.enraged = true; fight.nextAttack = Infinity;
  hazards.spawnPathfinder();
  h.move(hazards.pathCentre);
  assert.equal(hazards.pathfinder.isRegistered(), true);
  assert.equal(hazards.pathReady(), true);
  assert.equal(hazards.inAura(), true);
  h.prayer('magic');
  t.mock.method(Math, 'random', () => 0.999);
  fight.orb('magic', 1); h.step();
  assert.equal(h.p.getHitpoints(), 99, 'correct impact protection works inside registered aura');
  h.move([2089, 6365]);
  fight.orb('magic', 1); h.step();
  assert.equal(h.p.getHitpoints(), 67, 'outside registered aura protection is pierced immediately');
});

test('unregistered pathfinder grants no aura, preserves protection and does not move before registration', t => {
  const h = H.harness(t), fight = h.fight, hazards = fight.hazards;
  fight.enraged = true; fight.nextAttack = Infinity;
  hazards.spawnPathfinder();
  hazards.pathfinder.__testRemoved = true;
  const initial = [...hazards.pathCentre];
  h.move(initial); h.prayer('magic');
  t.mock.method(Math, 'random', () => 0.999);
  const accurate = () => {
    const event = { attacker: h.p, target: fight.boss, combatType: h.core.CombatType.RANGED, forceAccurate: false };
    h.dispatch('onCombatHitRoll', event);
    return event.forceAccurate;
  };
  assert.equal(hazards.inAura(), false);
  assert.equal(accurate(), false, 'unregistered aura does not grant ranged accuracy');
  fight.orb('magic', 1); h.step(6);
  assert.equal(h.p.getHitpoints(), 99);
  assert.deepEqual(hazards.pathCentre, initial, 'invisible NPC must not advance');
  hazards.pathfinder.__testRemoved = false;
  assert.equal(hazards.inAura(), true, 'registration activates the existing aura immediately');
  assert.equal(accurate(), true);
  h.step();
  assert.deepEqual(hazards.pathCentre, initial);
  h.step(h.Common.data.inferred.pathStartTicks);
  assert.notDeepEqual(hazards.pathCentre, initial);
});

test('registered movement retains clockwise corner order and authored step cadence', t => {
  const h = H.harness(t), fight = h.fight, hazards = fight.hazards;
  fight.nextAttack = Infinity;
  hazards.spawnPathfinder();
  const corners = h.Common.data.arena.pathCorners;
  const initial = [...hazards.pathCentre];
  const interval = h.Common.data.inferred.pathStepTicks;
  h.step();
  assert.deepEqual(hazards.pathCentre, initial);
  h.step(h.Common.data.inferred.pathStartTicks - 1);
  assert.notDeepEqual(hazards.pathCentre, initial);
  let previous = [...hazards.pathCentre], lastMove = fight.tick;
  for (let count = 0; count < 45 && hazards.pathDestination === 1; count++) {
    h.step();
    if (M.key(previous) !== M.key(hazards.pathCentre)) {
      assert.equal(fight.tick - lastMove, interval);
      lastMove = fight.tick; previous = [...hazards.pathCentre];
    }
  }
  assert.deepEqual(hazards.pathCentre, corners[1]);
  assert.equal(hazards.pathDestination, 2, 'north-east advances clockwise toward south-east');
});

test('recorded pathfinder bases, footprint-blocked spawn and three-tick first step match normal mode', t => {
  const h = H.harness(t), hazards = h.fight.hazards;
  h.fight.nextAttack = Infinity;
  hazards.place([2076, 6378]);
  hazards.spawnPathfinder();
  assert.deepEqual(h.session.sourceTile(hazards.pathfinder.getLocation()), [2086, 6377, 0]);
  h.step(2);
  assert.deepEqual(h.session.sourceTile(hazards.pathfinder.getLocation()), [2086, 6377, 0]);
  h.step();
  assert.deepEqual(h.session.sourceTile(hazards.pathfinder.getLocation()), [2086, 6376, 0]);
  h.step();
  assert.deepEqual(h.session.sourceTile(hazards.pathfinder.getLocation()), [2086, 6375, 0]);
});

test('recorded ethereal pathfinder crosses debris in its route without a collision detour', t => {
  const h = H.harness(t), hazards = h.fight.hazards;
  h.fight.nextAttack = Infinity;
  hazards.place([2077, 6378]);
  hazards.spawnPathfinder();
  assert.deepEqual(h.session.sourceTile(hazards.pathfinder.getLocation()), [2074, 6377, 0]);
  h.step(4);
  assert.deepEqual(hazards.pathCentre, [2077, 6378]);
});
