const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const H = require('./helpers/leviathan.cjs');
before(H.initialize);

test('cache-backed normal boss and bridge-correct arena are usable', t => {
  const h = H.harness(t);
  assert.equal(h.fight.boss.getId(), 12214);
  assert.equal(h.fight.boss.getHitpoints(), 900);
  assert.equal(h.fight.boss.getSize(), 7);
  assert.equal(h.area.getChunk(1, 0, 0).sourcePlane, 1);
  assert.equal(h.area.getClip(h.session.tile([2072, 6370, 0])) & 0x200100, 0);
  assert.equal(h.Common.ids.gfx.magic, 2489);
  assert.equal(h.Common.ids.awakenerOrb, 28334);
});

test('orbs check protection on impact and actual avoidable HP loss spoils perfection', t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity;
  h.fight.orb('magic', 2);
  h.prayer('magic');
  h.step(2);
  assert.equal(h.p.getHitpoints(), 99);
  assert.equal(h.fight.perfect, true);
  h.fight.orb('ranged', 2);
  h.prayer('magic');
  t.mock.method(Math, 'random', () => 0.999);
  h.step(2);
  assert.equal(h.p.getHitpoints(), 75);
  assert.equal(h.fight.perfect, false);
});

test('roar chip does not spoil perfection; debris can be dodged and blocks its tile', t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity;
  t.mock.method(Math, 'random', () => 0.999);
  h.fight.roar();
  h.apply();
  assert.equal(h.p.getHitpoints(), 92);
  assert.equal(h.fight.perfect, true);
  const old = h.session.sourceTile(h.p.getLocation());
  h.move([old[0], old[1] + 1]);
  h.step(h.Common.data.inferred.debrisFlightTicks);
  assert.equal(h.p.getHitpoints(), 92);
  assert.ok(h.fight.hazards.blockers.has(old.slice(0, 2).join(',')));
  assert.ok(h.area.getClip(h.session.tile(old)) & h.core.RegionManager.BLOCKED_TILE);
});

test('shadow stuns are spell-ID based, front cap and ranged rear punishment lead to alternating specials', t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity;
  const spell = h.core.CombatSpells.SHADOW_RUSH.getSpell();
  h.api.emitCustomEvent('magic:hit-effects', { attacker: h.p, target: h.fight.boss, spell });
  assert.equal(h.fight.stuns, 1);
  assert.equal(h.fight.stunnedUntil - h.fight.tick, 15);
  const front = h.hit(40);
  h.dispatch('onNpcHitModify', { npc: h.fight.boss, hit: front });
  assert.equal(front.getTotalDamage(), 10);
  h.move([2090, 6371]);
  const rear = h.hit(0);
  t.mock.method(h.core.DamageFormulas, 'sourceMaxHit', () => 40);
  h.dispatch('onNpcHitModify', { npc: h.fight.boss, hit: rear });
  assert.equal(rear.getTotalDamage(), 26);
  h.applyBoss(rear);
  assert.equal(h.fight.stunnedUntil, 0);
  assert.ok(['lightning', 'smoke'].includes(h.fight.special));
  const first = h.fight.special;
  h.fight.endSpecial();
  h.fight.beginSpecial();
  assert.notEqual(h.fight.special, first);
});

test('enrage has a moving 5x5 aura, impact prayer piercing outside and no shadow restun', t => {
  const h = H.harness(t);
  let random = 0;
  t.mock.method(Math, 'random', () => random);
  h.fight.nextAttack = Infinity;
  h.fight.boss.setHitpoints(180);
  h.step();
  h.fight.nextAttack = Infinity;
  assert.equal(h.fight.enraged, true);
  assert.ok(h.fight.hazards.pathfinder);
  h.api.emitCustomEvent('magic:hit-effects', { attacker: h.p, target: h.fight.boss, spell: h.core.CombatSpells.SHADOW_BARRAGE.getSpell() });
  assert.equal(h.fight.stuns, 0);
  const centre = h.fight.hazards.pathCentre;
  h.move(centre);
  h.step(2);
  assert.equal(h.fight.hazards.inAura(), true);
  h.prayer('magic');
  h.fight.orb('magic', 1);
  h.step();
  assert.equal(h.p.getHitpoints(), 99);
  h.move([2089, 6365]);
  h.fight.orb('magic', 1);
  random = 0.999;
  h.step();
  assert.equal(h.p.getHitpoints(), 67);
  assert.equal(h.fight.perfect, false);
});

test('enrage maintains its two-tick cadence across debris volleys', t => {
  const h = H.harness(t);
  t.mock.method(Math, 'random', () => 0);
  h.fight.boss.setHitpoints(180);
  h.step();
  h.move([2074, 6379]);
  const launches = [];
  t.mock.method(h.fight, 'orb', () => launches.push(h.fight.tick));
  h.step(22);
  assert.ok(launches.length >= 10);
  for (let i = 1; i < launches.length; i++) assert.equal(launches[i] - launches[i - 1], 2);
});

test('lethal boss damage freezes grade; post-death impacts and stale fights cannot change it', t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity;
  h.fight.orb('magic', 2);
  h.kill();
  assert.equal(h.fight.over, true, 'actual NPC lethal transition dispatches before-death hook');
  h.step(3);
  assert.equal(h.p.getHitpoints(), 99);
  assert.equal(h.fight.perfect, true);
  assert.equal(h.fight.hazards.blockers.size, 0);
});

test('already queued boss damage is cancelled on lethal transition or departure before draining', t => {
  const h = H.harness(t);
  h.Common.damage(h.fight, 30);
  assert.equal(h.p.getCombat().getHitQueue().getQueuedDamage(), 30);
  h.kill();
  h.apply();
  assert.equal(h.p.getHitpoints(), 99);
});
test('departure cancels already queued damage and detaches hazard NPCs', t => {
  const h = H.harness(t);
  h.fight.hazards.spawnPathfinder();
  const pathfinder = h.fight.hazards.pathfinder;
  h.Common.damage(h.fight, 30);
  h.fight.stop(); h.apply();
  assert.equal(h.p.getHitpoints(), 99);
  assert.equal(pathfinder.getPrivateArea(), null);
  assert.equal(h.area.entities.includes(pathfinder), false);
});

test('real PendingHit traverses NPC manipulation, rear accuracy and applied-damage stun break', t => {
  const h = H.harness(t);
  h.fight.stun();
  h.step();
  const method = new (class extends h.core.CombatMethod { type() { return h.core.CombatType.RANGED; } })();
  const front = new h.core.PendingHit(h.p, h.fight.boss, method, { damage: 40, rollAccuracy: false, experience: false, handleAfterHitEffects: false });
  h.core.CombatFactory.addPendingHit(front);
  h.step(2);
  assert.equal(h.fight.boss.getHitpoints(), 890);
  h.move([2090, 6371]); h.step();
  t.mock.method(h.core.DamageFormulas, 'sourceMaxHit', () => 40);
  const rear = new h.core.PendingHit(h.p, h.fight.boss, method, { damage: 0, experience: false, handleAfterHitEffects: false });
  assert.equal(rear.isAccurate(), true);
  h.core.CombatFactory.addPendingHit(rear);
  h.step(2);
  assert.equal(h.fight.boss.getHitpoints(), 864);
  assert.equal(h.fight.stunnedUntil, 0);
  assert.ok(h.fight.special);
});
