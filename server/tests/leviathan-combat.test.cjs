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

for (const effect of ['recoil', 'vengeance']) test(`the real normal bite supports ${effect} retaliation`, t => {
  const h = H.harness(t);
  t.mock.method(Math, 'random', () => 0.999);
  if (effect === 'recoil') h.p.getEquipment().set(h.core.Equipment.RING_SLOT, new h.core.Item(h.core.ItemIdentifiers.RING_OF_RECOIL));
  else h.p.setHasVengeance(true);
  h.move([2076, 6372]); h.fight.nextAttack = 1;
  h.step(2);
  assert.equal(h.p.getHitpoints(), 49);
  assert.equal(h.fight.boss.getHitpoints(), effect === 'recoil' ? 894 : 863);
  assert.equal(h.fight.perfect, false);
  if (effect === 'recoil') assert.equal(h.p.getAttribute(h.core.CombatFactory.RECOIL_DAMAGE_ATTRIBUTE), 6);
  else assert.equal(h.p.hasVengeanceReturn(), false);
});

test('a protected normal bite neither damages nor consumes recoil or Vengeance', t => {
  const h = H.harness(t);
  t.mock.method(Math, 'random', () => 0.999);
  h.p.getEquipment().set(h.core.Equipment.RING_SLOT, new h.core.Item(h.core.ItemIdentifiers.RING_OF_RECOIL));
  h.p.setHasVengeance(true); h.prayer('melee');
  h.move([2076, 6372]); h.fight.nextAttack = 1; h.step(2);
  assert.equal(h.p.getHitpoints(), 99);
  assert.equal(h.fight.boss.getHitpoints(), 900);
  assert.equal(h.p.hasVengeanceReturn(), true);
  assert.equal(h.p.getAttribute(h.core.CombatFactory.RECOIL_DAMAGE_ATTRIBUTE), undefined);
  assert.equal(h.fight.perfect, true);
});

test('normal orbs damage the player without reflecting or consuming Vengeance', t => {
  const h = H.harness(t);
  t.mock.method(Math, 'random', () => 0.999);
  h.p.getEquipment().set(h.core.Equipment.RING_SLOT, new h.core.Item(h.core.ItemIdentifiers.RING_OF_RECOIL));
  h.p.setHasVengeance(true); h.fight.nextAttack = Infinity;
  h.fight.orb('magic', 1); h.step(2);
  assert.equal(h.p.getHitpoints(), 67);
  assert.equal(h.fight.boss.getHitpoints(), 900);
  assert.equal(h.p.hasVengeanceReturn(), true);
  assert.equal(h.p.getAttribute(h.core.CombatFactory.RECOIL_DAMAGE_ATTRIBUTE), undefined);
});

for (const terminal of ['lethal', 'departure']) test(`queued normal bite keeps its source and is cancelled on ${terminal}`, t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity; h.step();
  h.p.getEquipment().set(h.core.Equipment.RING_SLOT, new h.core.Item(h.core.ItemIdentifiers.RING_OF_RECOIL));
  h.p.setHasVengeance(true);
  h.Common.biteDamage(h.fight, 30);
  assert.equal(h.p.getCombat().getHitQueue().getAccumulatedDamage(), 30);
  assert.equal([...h.fight.pendingDamage][0].getSource(), h.fight.boss);
  if (terminal === 'lethal') h.kill();
  else h.fight.stop();
  h.apply();
  assert.equal(h.p.getHitpoints(), 99);
  assert.equal(h.fight.perfect, true);
  assert.equal(h.p.hasVengeanceReturn(), true);
  assert.equal(h.p.getAttribute(h.core.CombatFactory.RECOIL_DAMAGE_ATTRIBUTE), undefined);
});

test('a reflected bite can kill the boss and freezes the already-imperfect fight at that lethal boundary', t => {
  const h = H.harness(t);
  t.mock.method(Math, 'random', () => 0.999);
  h.p.getEquipment().set(h.core.Equipment.RING_SLOT, new h.core.Item(h.core.ItemIdentifiers.RING_OF_RECOIL));
  h.fight.boss.setHitpoints(6);
  // Hold enrage entry to exercise the physical bite's lethal reflection itself.
  h.fight.enraged = true; h.fight.nextEnrageDebris = Infinity;
  h.move([2076, 6372]); h.fight.nextAttack = 1;
  h.step();
  assert.equal(h.p.getHitpoints(), 49);
  assert.equal(h.fight.perfect, false);
  h.step();
  assert.equal(h.fight.boss.getHitpoints(), 0);
  assert.equal(h.fight.over, true);
  assert.equal(h.fight.finishedTicks, 2);
  h.step(4);
  assert.equal(h.p.getHitpoints(), 49);
  assert.equal(h.fight.perfect, false);
});

test('a bite queued after the player turn applies HP before lethal reflection on the next NPC turn', t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity; h.step();
  h.p.getEquipment().set(h.core.Equipment.RING_SLOT, new h.core.Item(h.core.ItemIdentifiers.RING_OF_RECOIL));
  h.fight.boss.setHitpoints(6);
  h.fight.enraged = true; h.fight.nextEnrageDebris = Infinity;
  // Player.process already drained its queue before Area.process schedules the
  // bite. The next world turn processes the NPC before processing the player.
  h.Common.biteDamage(h.fight, 50);
  assert.equal(h.p.getHitpoints(), 99);
  h.step();
  assert.equal(h.p.getHitpoints(), 49);
  assert.equal(h.fight.boss.getHitpoints(), 6);
  assert.equal(h.fight.perfect, false);
  assert.equal(h.fight.over, false);
  h.step();
  assert.equal(h.fight.boss.getHitpoints(), 0);
  assert.equal(h.fight.over, true);
  assert.equal(h.fight.finishedTicks, 3);
  assert.equal(h.fight.perfect, false);
});

test('roar chip does not spoil perfection; debris can be dodged and blocks its tile', t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity;
  t.mock.method(Math, 'random', () => 0.999);
  h.fight.roar();
  h.step();
  assert.equal(h.p.getHitpoints(), 92);
  assert.equal(h.fight.perfect, true);
  const old = h.session.sourceTile(h.p.getLocation());
  h.move([old[0], old[1] + 1]);
  h.step(h.Common.data.roar.flightTicks - 1);
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

test('a shadow stun holds the native stunned idle after the three-tick reaction and releases at fifteen ticks', t => {
  const h = H.harness(t);
  h.fight.nextAttack = Infinity;
  h.fight.stun();
  assert.equal(h.fight.boss.getAnimation().getId(), 10282);
  h.step(2);
  assert.equal(h.fight.boss.getAnimation().getId(), 10282);
  h.step();
  assert.equal(h.fight.boss.getAnimation().getId(), 10294);
  h.step(11);
  assert.equal(h.fight.stunnedUntil > h.fight.tick, true);
  h.step();
  assert.equal(h.fight.stunnedUntil, 0);
  assert.equal(h.fight.boss.getAnimation().getId(), 65535);
});

test('a rear punishment before the stun reaction ends cannot be overwritten by its queued idle', t => {
  const h = H.harness(t);
  t.mock.method(Math, 'random', () => 0);
  h.fight.nextSpecial = 'lightning';
  h.fight.stun();
  h.fight.boss.setHitpoints(899);
  h.fight.afterDamage(1, true);
  h.step(3);
  assert.equal(h.fight.boss.getAnimation().getId(), 10286);
  assert.equal(h.fight.special, 'lightning');
});

test('enrage has a moving 5x5 aura, impact prayer piercing outside and no shadow restun', t => {
  const h = H.harness(t);
  let random = 0;
  t.mock.method(Math, 'random', () => random);
  h.fight.nextAttack = Infinity;
  h.fight.boss.setHitpoints(180);
  h.step(4);
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
  h.step(26);
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
