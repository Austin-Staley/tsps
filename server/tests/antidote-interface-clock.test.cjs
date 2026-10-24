const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { SecondsTimer } = require('../dist/game/model/SecondsTimer');
const { Player } = require('../dist/game/entity/impl/player/Player');
const { PluginManager } = require('../dist/plugins/PluginManager');
const plugin = require('../plugins/interface/PoisonTimer.plugin');

function clock(t) {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  return ms => { now += ms; };
}

function fixture(t) {
  const advance = clock(t), events = [], hooks = {};
  plugin.register({
    onPlayerLogin: fn => { hooks.login = fn; },
    onPlayerProcess: fn => { hooks.process = fn; },
    onPlayerLogout: fn => { hooks.logout = fn; },
    onCustomEvent: (name, fn) => { hooks[name] = fn; },
  });
  const player = new Player(null), configs = [];
  t.mock.method(player.getPacketSender(), 'sendConfig', (...args) => configs.push(args));
  t.mock.method(PluginManager, 'emitCustomEvent', (name, event) => {
    events.push({ name, previousId: event.previousId, interfaceId: event.interfaceId,
      actualId: player.getInterfaceId() });
    hooks[name]?.(event);
  });
  player.setInterfaceId(-1);
  hooks.login({ player });
  events.length = 0;
  return { advance, player, timer: player.getCombat().getPoisonImmunityTimer(), events, hooks, configs };
}

test('native player interface transitions hold antidote immunity without pausing unrelated timers', t => {
  const f = fixture(t), other = new SecondsTimer();
  f.timer.start(90); other.start(90);
  f.advance(2000); f.player.setInterfaceId(12); f.advance(30000);
  assert.equal(f.timer.secondsRemaining(), 88);
  assert.equal(other.secondsRemaining(), 58);
  f.player.setInterfaceId(-1); f.advance(1000);
  assert.equal(f.timer.secondsRemaining(), 87);
});

test('generic pause/resume retains fractional elapsed time and cannot grant time through toggles', t => {
  const advance = clock(t), timer = new SecondsTimer();
  timer.start(90); advance(350); timer.pause(); advance(30000); timer.pause(); timer.resume();
  advance(649); assert.equal(timer.secondsRemaining(), 90);
  advance(1); assert.equal(timer.secondsRemaining(), 89);
  for (let i = 0; i < 10; i++) { timer.pause(); advance(5000); timer.resume(); advance(100); }
  assert.equal(timer.secondsRemaining(), 88);
  timer.resume(); advance(1000); assert.equal(timer.secondsRemaining(), 87);
});

test('an idle or stopped timer can be restarted while its pause policy remains active', t => {
  const advance = clock(t), timer = new SecondsTimer();
  timer.pause(); advance(20000); timer.start(90); advance(30000);
  assert.equal(timer.secondsRemaining(), 90); assert.equal(timer.isRunning(), true);
  timer.stop(); timer.resume(); advance(10000);
  assert.equal(timer.secondsRemaining(), 0); assert.equal(timer.isRunning(), false);
  timer.pause(); timer.start(120); advance(40000); timer.start(60); advance(30000);
  assert.equal(timer.secondsRemaining(), 60);
  timer.resume(); advance(60000); assert.equal(timer.finished(), true);
});

test('replacing an open interface never resumes immunity, and changed hooks see the assigned id', t => {
  const f = fixture(t); f.timer.start(90); f.player.setInterfaceId(12); f.advance(30000);
  f.player.setInterfaceId(100); f.advance(30000); f.player.setInterfaceId(100);
  assert.equal(f.timer.secondsRemaining(), 90);
  const changes = f.events.filter(e => e.name === 'interface:changed');
  assert.deepEqual(changes.map(e => [e.previousId, e.interfaceId, e.actualId]), [[-1, 12, 12], [12, 100, 100]]);
  assert.deepEqual(f.events.filter(e => e.name === 'interface:closed').map(e => [e.interfaceId, e.actualId]), [[12, 12]]);
  f.player.setInterfaceId(-1); f.advance(1000); assert.equal(f.timer.secondsRemaining(), 89);
});

test('login reconciles an already-open interface; normal processing preserves config caching', t => {
  const f = fixture(t); f.player.setInterfaceId(12); f.timer.start(90);
  f.hooks.logout({ player: f.player }); f.hooks.login({ player: f.player }); f.advance(30000);
  assert.equal(f.timer.secondsRemaining(), 90);
  const packets = f.configs.length;
  for (let i = 0; i < 20; i++) f.hooks.process({ player: f.player });
  assert.equal(f.configs.length, packets);
  f.player.setInterfaceId(0); f.advance(1000); assert.equal(f.timer.secondsRemaining(), 89);
});

test('actual potion effects started while held retain stronger protection and still cure', t => {
  const f = fixture(t), { ItemIdentifiers: I } = PluginManager.getCoreApi();
  const potions = require('../plugins/items/Potions.plugin');
  const drink = id => potions._test.findPotionEntry(id).potion.effect(f.player);
  t.mock.method(f.player, 'sendMessage', () => {});
  f.player.setInterfaceId(12); f.player.setPoisonDamage(30);
  drink(I.SUPERANTIPOISON_4_); f.advance(30000);
  assert.equal(f.player.getPoisonDamage(), 0);
  assert.equal(f.timer.secondsRemaining(), 360);
  drink(I.ANTIPOISON_4_); f.advance(30000);
  assert.equal(f.timer.secondsRemaining(), 360, 'weaker doses cannot shorten protection');
  f.player.setInterfaceId(-1); f.advance(1000);
  assert.equal(f.timer.secondsRemaining(), 359);
});

test('player save/load keeps the held remainder without persisting an interface pause', t => {
  const { PlayerSave } = require('../dist/game/entity/impl/player/persistence/PlayerSave');
  const f = fixture(t); f.timer.start(90); f.advance(2000); f.player.setInterfaceId(12); f.advance(30000);
  const save = PlayerSave.fromPlayer(f.player);
  assert.equal(save.getPoisonImmunityTimer(), 88);
  const loaded = new Player(null); save.applyToPlayer(loaded);
  t.mock.method(loaded.getPacketSender(), 'sendConfig', () => {});
  loaded.setInterfaceId(-1); f.hooks.login({ player: loaded }); f.advance(1000);
  assert.equal(loaded.getCombat().getPoisonImmunityTimer().secondsRemaining(), 87);
});
