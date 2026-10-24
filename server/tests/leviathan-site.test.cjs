const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const H = require('./helpers/leviathan.cjs');
before(H.initialize);
test('island view includes all five distant tails through native NPC visibility and restores the previous radius on exit', t => {
  const h = H.harness(t), Site = require('../plugins/bosses/leviathan/Site.Leviathan');
  h.p.setNpcViewDistance(17);
  h.api.onCustomEvent('quest:is-complete', request => { request.complete = true; });
  Site.travel({ player: h.p, objectId: 49212 });
  const session = Site.sessionOf(h.p);
  t.after(() => session.end());
  const byIndex = new Map();
  for (let i = 0; i < session.tails.length; i++) {
    const tail = session.tails[i];
    tail.setIndex(100 + i); tail.setNeedsPlacement(false); byIndex.set(tail.getIndex(), tail);
  }
  t.mock.method(h.core.World, 'getNpcs', () => ({ get: index => byIndex.get(index) }));
  for (const at of [[2072,6370], [2072,6364], [2090,6364], [2072,6380], [2090,6380]]) {
    h.p.setLocation(session.tile(at));
    h.core.World.updateLocalNpcs(h.p, session.tails);
    assert.equal(h.p.getLocalNpcs().length, 5, `native visibility from ${at}`);
  }
  Site.leave(h.p);
  assert.equal(h.p.getNpcViewDistance(), 17);
});
test('the five recorded tail actors belong to the island and survive fight replacement until exit', t => {
  const h = H.harness(t), Site = require('../plugins/bosses/leviathan/Site.Leviathan');
  h.api.onCustomEvent('quest:is-complete', request => { request.complete = true; });
  Site.travel({ player: h.p, objectId: 49212 });
  const session = Site.sessionOf(h.p);
  t.after(() => session.end());
  assert.equal(session.tails?.length, 5);
  assert.deepEqual(session.tails.map(n => [n.getId(), session.sourceTile(n.getLocation()), n.getFace().getDirection().getId()]), [
    [12216, [2053,6355,0], 2], [12217, [2079,6346,0], 1], [12216, [2075,6393,0], 6],
    [12216, [2095,6357,0], 0], [12218, [2096,6389,0], 5],
  ]);
  for (const tail of session.tails) {
    assert.equal(tail.getPrivateArea(), session.area);
    assert.equal(tail.getOwner(), h.p);
    assert.equal(tail.isOwnerOnly(), true);
    assert.ok(tail.getLocation().getX() >= session.area.getBaseX(), 'western tail is inside copied chunks');
  }
  const tails = [...session.tails];
  Site.climb({ player: h.p, objectId: 47593 });
  session.fight.fell(); session.start();
  assert.deepEqual(session.tails, tails);
  assert.ok(tails.every(n => n.isRegistered()));
  Site.leave(h.p);
  assert.equal(session.tails.length, 0);
  assert.ok(tails.every(n => !n.isRegistered()));
});
test('boss bites animate every native tail using its recorded variant', t => {
  const h = H.harness(t), Site = require('../plugins/bosses/leviathan/Site.Leviathan'), animations = [];
  h.api.onCustomEvent('quest:is-complete', request => { request.complete = true; });
  Site.travel({ player: h.p, objectId: 49212 });
  const session = Site.sessionOf(h.p);
  t.after(() => session.end());
  assert.equal(session.tails?.length, 5);
  for (const tail of session.tails) t.mock.method(tail, 'performAnimation', animation => animations.push(animation.getId()));
  Site.climb({ player: h.p, objectId: 47593 });
  h.p.setLocation(session.tile([2076,6372]));
  session.fight.nextAttack = 0;
  session.fight.process();
  assert.deepEqual(animations, [10301,10302,10301,10301,10303]);
});
test('postquest Scar stones connect the two walkable shores in both directions only at their cache locations', t => {
  const h = H.harness(t), Site = require('../plugins/bosses/leviathan/Site.Leviathan');
  h.api.onCustomEvent('quest:is-complete', request => { request.complete = true; });
  h.p.setLocation(new h.core.Location(2029, 6430, 0));
  assert.equal(Site.cross({ player: h.p, objectId: 49209, location: { x: 2031, y: 6430, z: 0 } }), true);
  assert.equal(h.p.getLocation().getX(), 2035);
  assert.equal(Site.cross({ player: h.p, objectId: 49209, location: { x: 2033, y: 6430, z: 0 } }), true);
  assert.equal(h.p.getLocation().getX(), 2029);
  assert.equal(Site.cross({ player: h.p, objectId: 49209, location: { x: 10, y: 10, z: 0 } }), false);
  for (const x of [2029, 2035]) assert.equal(h.core.RegionManager.getClipping(x, 6430, 0, null) & 0x200100, 0);
});
test('the public grave/recovery shore and Guardian arrival are cache-walkable', t => {
  const h = H.harness(t);
  for (const tile of [h.Common.data.site.campReturn, h.Common.data.site.guardianArrival])
    assert.equal(h.core.RegionManager.getClipping(...tile, null) & 0x200100, 0, tile.join(','));
});
test('quest-complete player reaches island, climbs into private fight and leaves safely', t => {
  const h = H.harness(t), Site = require('../plugins/bosses/leviathan/Site.Leviathan');
  Site.attach(h.api);
  h.api.onCustomEvent('quest:is-complete', request => { request.complete = true; });
  h.p.setLocation(h.Common.location(h.Common.data.site.campReturn));
  assert.equal(Site.travel({ player: h.p, objectId: 49212 }), true);
  const session = Site.sessionOf(h.p);
  assert.ok(session);
  assert.equal(session.fight, null);
  assert.deepEqual(session.sourceTile(h.p.getLocation()), h.Common.data.site.islandArrival);
  assert.equal(Site.climb({ player: h.p, objectId: 47593 }), true);
  assert.equal(session.fight.boss.getHitpoints(), 900);
  assert.equal(h.p.getAttribute(h.Common.INSIDE_ATTRIBUTE), true);
  const grave = { player: h.p };
  h.api.emitCustomEvent('gravestones:grave-location', grave);
  assert.deepEqual(grave.tile, { x: 2063, y: 6435, z: 0 });
  assert.equal(grave.feeMultiplier, 0.25);
  Site.leave(h.p);
  assert.equal(session.ended, true);
  assert.equal(session.fight.stopped, true);
  assert.equal(session.area.isDestroyed(), true);
  assert.equal(h.p.getPrivateArea(), null);
  assert.equal(Site.sessionOf(h.p), null);
  assert.deepEqual([h.p.getLocation().getX(), h.p.getLocation().getY()], [2063, 6435]);
});
test('incomplete quests do not create sessions; persisted inside flags recover outside', t => {
  const h = H.harness(t), Site = require('../plugins/bosses/leviathan/Site.Leviathan');
  Site.attach(h.api);
  assert.equal(Site.travel({ player: h.p, objectId: 49212 }), false);
  assert.equal(Site.sessionOf(h.p), null);
  h.p.setAttribute(h.Common.INSIDE_ATTRIBUTE, true);
  h.dispatch('onPlayerLogin', { player: h.p });
  assert.equal(h.p.getAttribute(h.Common.INSIDE_ATTRIBUTE), false);
  assert.equal(h.p.getLocation().getX(), 2063);
});

test('actual kill respawns a fresh normal fight in the same instance and logout ends it', t => {
  const h = H.harness(t), Site = require('../plugins/bosses/leviathan/Site.Leviathan');
  Site.attach(h.api);
  require('../plugins/bosses/leviathan/Rewards.Leviathan').attach(h.api);
  h.api.onCustomEvent('quest:is-complete', request => { request.complete = true; });
  t.mock.method(Math, 'random', () => 0);
  Site.travel({ player: h.p, objectId: 49212 });
  const session = Site.sessionOf(h.p);
  t.after(() => session.end());
  Site.climb({ player: h.p, objectId: 47593 });
  const first = session.fight;
  first.boss.getCombat().addDamage(h.p, 1); first.boss.setHitpoints(0);
  h.step(8 + h.Common.data.inferred.respawnTicks);
  assert.notEqual(session.fight, first);
  assert.equal(first.stopped, true);
  assert.equal(session.fight.perfect, true);
  assert.equal(session.fight.boss.getHitpoints(), 900);
  assert.equal(session.perfectKills, 1);
  session.area.leave(h.p, true);
  assert.equal(session.ended, true);
  assert.equal(session.fight.stopped, true);
  assert.equal(h.p.getLocation().getX(), 2063);
  assert.equal(h.p.getAttribute(h.Common.INSIDE_ATTRIBUTE), false);
});
