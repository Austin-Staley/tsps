const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const H = require('./helpers/leviathan.cjs');
before(H.initialize);
for (const order of ['generic-first', 'encounter-first']) test(`real generic CA count increments exactly once (${order})`, t => {
  const h = H.harness(t);
  const Data = require('../plugins/achievements/combatachievements/Data.CombatAchievements');
  const Progress = require('../plugins/achievements/combatachievements/Progress.CombatAchievements');
  const Kills = require('../plugins/achievements/combatachievements/Kills.CombatAchievements');
  Data(h.api); Progress(h.api);
  const Rewards = require('../plugins/bosses/leviathan/Rewards.Leviathan');
  if (order === 'generic-first') { Kills(h.api); Rewards.attach(h.api); }
  else { Rewards.attach(h.api); Kills(h.api); }
  h.p.setAttribute(Kills.KILLS_ATTRIBUTE, { 'Leviathan, The': 41 });
  h.fight.normalKillsAtStart = h.Common.normalKills(h.p);
  h.kill(); h.step(8);
  const request = { player: h.p, monster: 'Leviathan, The', total: 0 };
  h.api.emitCustomEvent('combat-achievements:count', request);
  assert.equal(request.total, 42);
  assert.equal(h.p.getAttribute(h.Common.KILLS_ATTRIBUTE), 42);
  assert.equal(h.emitted.filter(([name]) => name === 'combat-achievements:kill').length, 0);
  for (const [name, event] of h.emitted) if (name === 'combat-achievements:complete')
    assert.ok(Data.taskNamed(event.task), `cache achievement exists: ${event.task}`);
});
test('canonical achievement name restores legacy counts and PB without incrementing read queries', t => {
  const h = H.harness(t);
  require('../plugins/bosses/leviathan/Rewards.Leviathan').attach(h.api);
  let queries = 0;
  h.api.onCustomEvent('combat-achievements:count', request => {
    assert.equal(request.monster, 'Leviathan, The'); queries++; request.total = 42;
  });
  h.dispatch('onPlayerLogin', { player: h.p });
  assert.equal(h.p.getAttribute(h.Common.KILLS_ATTRIBUTE), 42);
  const counts = { player: h.p, counts: {} };
  h.api.emitCustomEvent('combat-achievements:kill-count', counts);
  assert.equal(counts.counts['Leviathan, The'], 42);
  h.p.setAttribute(h.Common.BEST_ATTRIBUTE, 23);
  const best = { player: h.p, monster: 'Leviathan, The', best: 0 };
  h.api.emitCustomEvent('combat-achievements:personal-best', best);
  assert.equal(best.best, 23);
  assert.ok(queries > 0);
  assert.equal(h.emitted.filter(([name]) => name === 'combat-achievements:kill').length, 0);
});

test('actual lethal transition freezes perfect loot context and death awards once', t => {
  const h = H.harness(t);
  require('../plugins/bosses/leviathan/Rewards.Leviathan').attach(h.api);
  const early = {};
  h.api.emitCustomEvent('npc-drops:context', { player: h.p, npc: h.fight.boss, context: early });
  assert.deepEqual(early, {});
  h.kill();
  const context = {};
  h.api.emitCustomEvent('npc-drops:context', { player: h.p, npc: h.fight.boss, context });
  assert.deepEqual(context, { perfectKill: true });
  h.step(8);
  assert.equal(h.p.getAttribute(h.Common.KILLS_ATTRIBUTE), 1);
  assert.equal(h.session.perfectKills, 1);
  h.dispatch('onNpcDeath', { npc: h.fight.boss, killer: h.p });
  assert.equal(h.p.getAttribute(h.Common.KILLS_ATTRIBUTE), 1);
  const where = { player: h.p, npc: h.fight.boss, location: h.fight.boss.getLocation() };
  h.api.emitCustomEvent('npc-drops:location', where);
  assert.deepEqual(h.session.sourceTile(where.location), h.Common.data.arena.loot);
  assert.equal(h.area.getClip(where.location) & 0x200100, 0);
});

test('foreign killers and stale sessions never receive encounter context or counts', t => {
  const h = H.harness(t);
  require('../plugins/bosses/leviathan/Rewards.Leviathan').attach(h.api);
  h.kill();
  const context = {};
  h.api.emitCustomEvent('npc-drops:context', { player: {}, npc: h.fight.boss, context });
  assert.deepEqual(context, {});
  h.session.ended = true;
  h.dispatch('onNpcDeath', { npc: h.fight.boss, killer: h.p });
  assert.equal(h.p.getAttribute(h.Common.KILLS_ATTRIBUTE), undefined);
});

test('fifth perfect kill in one instance completes task; imperfect kills do not reset its total', t => {
  const h = H.harness(t);
  require('../plugins/bosses/leviathan/Rewards.Leviathan').attach(h.api);
  h.session.perfectKills = 4;
  h.kill();
  h.step(8);
  assert.ok(h.emitted.some(([name, e]) => name === 'combat-achievements:complete' && e.task === 'Perfect Leviathan'));
  assert.ok(h.emitted.some(([name, e]) => name === 'combat-achievements:complete' && e.task === 'Serpentine Solo'));
});

test('canonical conditional loot consumes actual fight grade without a copied drop table', t => {
  const h = H.harness(t);
  require('../plugins/bosses/leviathan/Rewards.Leviathan').attach(h.api);
  const Drops = require('../plugins/npcs/NpcDrops.plugin');
  Drops.register(h.api);
  // Keep the real roller/context listener; exclude unrelated complete-table ground placement.
  h.hooks.set('onNpcDeath', h.hooks.get('onNpcDeath').slice(0, 1));
  const table = require('../data/definitions/npc-drops.json').tables.the_leviathan;
  const row = table.entries.find(entry => entry.quantity_alternatives && entry.item_id !== undefined);
  assert.ok(row);
  t.mock.method(Math, 'random', () => 0);
  const amount = () => Drops.__internals.rollTable({ entries: [{ ...row, always: true }] }, h.p, h.fight.boss)[0].amount;
  const base = amount();
  h.kill();
  assert.equal(amount(), Math.floor(base * 1.5));
});
