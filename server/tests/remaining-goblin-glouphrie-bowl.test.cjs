// Real PluginManager + shipped cache/map regression for the shared "Singing bowl" name.
// Run after yarn build: node --test tests/remaining-goblin-glouphrie-bowl.test.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const ROOT = path.resolve(__dirname, '..');
const POG_STAGE = 'quest.the_path_of_glouphrie.stage';
const POG_BITS = 'quest.the_path_of_glouphrie.bits';
const BOWL = { raw: 49910, inspect: 49610, sing: 49611, eyes: 17239 };
const ITEM = { seed: 28575, chime: 28577, redCircle: 9597 };
const BOWL_TILE = { x: 2793, y: 4256 };

let PluginManager, core, Player, CacheDefinitions, ObjectDefinition, MapObjects;

before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(ROOT);
  ({ PluginManager } = require('../dist/plugins/PluginManager'));
  ({ CacheDefinitions } = require('../dist/game/cache/CacheDefinitions'));
  ({ ObjectDefinition } = require('../dist/game/definition/ObjectDefinition'));
  ({ MapObjects } = require('../dist/game/entity/impl/object/MapObjects'));
  PluginManager.loadPluginSwitches = () => ({ switches: new Map() });
  const quiet = [console.log, console.info, console.debug, console.warn];
  console.log = console.info = console.debug = console.warn = () => {};
  try {
    PluginManager.loadFromDirectory(path.join(ROOT, 'plugins'));
    core = PluginManager.getCoreApi();
    core.RegionManager.init();
    try { PluginManager.emitServerStartup({ timestamp: Date.now() }); } catch {}
  } finally {
    [console.log, console.info, console.debug, console.warn] = quiet;
  }
  ({ Player } = require('../dist/game/entity/impl/player/Player'));
  core.RegionManager.loadMapFiles(BOWL_TILE.x, BOWL_TILE.y);
});

after(() => setImmediate(() => process.exit()));

function player(stage = 14, bits = (1 << 8) | (1 << 9) | (1 << 10)) {
  const p = new Player(null);
  p.setUsername(`bowl${stage}${Math.random().toString(36).slice(2, 6)}`);
  p.setLocation(new core.Location(2793, 4255, 0));
  const sent = { messages: [], varbits: new Map(), varps: new Map() };
  const sender = {
    sendVarbit(id, value) {
      sent.varbits.set(id, value);
      const bit = CacheDefinitions.getVarbit(id);
      if (bit) {
        const mask = (1 << (bit.endBit - bit.startBit + 1)) - 1;
        const current = sent.varps.get(bit.baseVar) ?? 0;
        sent.varps.set(bit.baseVar, (current & ~(mask << bit.startBit)) | ((value & mask) << bit.startBit));
      }
      return sender;
    },
    getVarbit(id) {
      const bit = CacheDefinitions.getVarbit(id);
      if (!bit) return 0;
      const mask = (1 << (bit.endBit - bit.startBit + 1)) - 1;
      return ((sent.varps.get(bit.baseVar) ?? 0) >> bit.startBit) & mask;
    },
    getVarp(id) { return sent.varps.get(id) ?? 0; },
  };
  const packet = new Proxy(sender, {
    get: (target, key) => (key in target ? target[key] : (...args) => packet),
  });
  p.getPacketSender = () => packet;
  p.sendMessage = (text) => sent.messages.push(text);
  p.isRegistered = () => true;
  p.setAttribute(POG_STAGE, stage);
  p.setAttribute(POG_BITS, bits);
  return { p, sent };
}

/** The real map raw loc, and the child definition the server resolves for this player. */
function realBowlObject(p) {
  const raw = MapObjects.getPrivateArea(p, BOWL.raw, new core.Location(BOWL_TILE.x, BOWL_TILE.y, 0));
  assert.ok(raw, 'raw 49910 exists on the shipped map');
  assert.equal(raw.getId(), BOWL.raw, 'listener passes the placed parent id');
  const definition = ObjectDefinition.forPlayer(raw.getId(), p);
  assert.equal(definition.getName(), 'Singing bowl');
  return { raw, definition };
}

function objectEvent(p) {
  const { raw, definition } = realBowlObject(p);
  return {
    player: p, object: raw, objectId: raw.getId(), definition,
    clickType: 1, handled: false,
  };
}

function itemEvent(p, itemId) {
  const { raw } = realBowlObject(p);
  return {
    player: p, object: raw, objectId: raw.getId(), item: { getId: () => itemId },
    itemId, itemSlot: 0, handled: false,
  };
}

test('real raw 49910 resolves to the player bowl, makes the chime and keeps Eyes 17239 separate', () => {
  const { p, sent } = player();
  p.getInventory().adds(ITEM.seed, 1);

  const inspect = objectEvent(p);
  assert.equal(inspect.definition.getInteractions()[0], 'Inspect');
  assert.equal(PluginManager.emitObjectInteraction(inspect), true);
  assert.equal(p.getAttribute(POG_BITS) & (1 << 0), 1 << 0);
  assert.equal(sent.varbits.get(15289), 1);
  assert.equal(ObjectDefinition.forPlayer(BOWL.raw, p).id, BOWL.sing, 'current definition follows per-player varbit');

  PluginManager.emitItemOnObject(itemEvent(p, ITEM.redCircle));
  assert.equal(p.getInventory().getAmount(ITEM.chime), 0, 'wrong disc does not make the chime');

  assert.equal(PluginManager.emitItemOnObject(itemEvent(p, ITEM.seed)), true);
  assert.equal(p.getInventory().getAmount(ITEM.seed), 0);
  assert.equal(p.getInventory().getAmount(ITEM.chime), 1);
  assert.equal(sent.varbits.get(15290), 1);
  assert.equal(Number(p.getAttribute(POG_STAGE)), 16, 'chime + diary reaches machine-ready');

  PluginManager.emitItemOnObject(itemEvent(p, ITEM.seed));
  assert.equal(p.getInventory().getAmount(ITEM.chime), 1, 'repeated use does not duplicate the chime');

  const eyes = (() => {
    const raw = MapObjects.getPrivateArea(p, BOWL.eyes, new core.Location(2793, 4252, 0));
    if (!raw) return null;
    return { player: p, object: raw, objectId: raw.getId(), definition: ObjectDefinition.forPlayer(raw.getId(), p), clickType: 1, handled: false };
  })();
  if (eyes) assert.equal(PluginManager.emitObjectInteraction(eyes), true, 'Eyes bowl still handled');
});

test('two players keep independent bowl bits, and making the chime early cannot skip diary stages', () => {
  const a = player(14);
  const b = player(6, 0);
  assert.equal(ObjectDefinition.forPlayer(BOWL.raw, a.p).id, BOWL.inspect);
  assert.equal(ObjectDefinition.forPlayer(BOWL.raw, b.p).id, BOWL.inspect);

  PluginManager.emitObjectInteraction(objectEvent(a.p));
  assert.equal(a.sent.varbits.get(15289), 1);
  assert.equal(ObjectDefinition.forPlayer(BOWL.raw, a.p).id, BOWL.sing);
  assert.equal(ObjectDefinition.forPlayer(BOWL.raw, b.p).id, BOWL.inspect, 'player B bowl is unchanged');

  b.p.getInventory().adds(ITEM.seed, 1);
  PluginManager.emitItemOnObject(itemEvent(b.p, ITEM.seed));
  assert.equal(b.p.getInventory().getAmount(ITEM.chime), 1);
  assert.equal(Number(b.p.getAttribute(POG_STAGE)), 6, 'early chime does not skip diary stages');
});
