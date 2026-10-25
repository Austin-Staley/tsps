// Run after `yarn build`: node --test tests/shades-of-mortton.test.cjs
//
// Shades of Mort'ton's minigame against the rsprox recordings (232/03119: shadows rising and sinking,
// their remains; 227/01858: the catacombs' entrance, a tomb door and a chest) and the Wiki (the
// chests' loot and coins).
const assert = require('node:assert/strict');
const { test, before } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { TaskManager } = require('../dist/game/task/TaskManager');
const { Location } = require('../dist/game/model/Location');

let Common, Shades, Catacombs, hooks, core;

function chain(map, key, fn) {
  const prior = map.get(key);
  map.set(key, prior ? (event) => prior(event) || fn(event) : fn);
}

before(() => {
  CachePipeline.initialize();
  RegionManager.init();
  core = PluginManager.getCoreApi();
  hooks = { objects: new Map(), events: {}, npcHit: [], npcDeath: [] };
  const api = {
    core,
    onObjectInteraction: (name, actions) => { for (const [op, fn] of Object.entries(actions)) chain(hooks.objects, `${name}:${op}`, fn); },
    onNpcHitModify: (fn) => hooks.npcHit.push(fn),
    onNpcDeath: (fn) => hooks.npcDeath.push(fn),
    onCustomEvent: (name, fn) => { hooks.events[name] = fn; },
  };
  require('../plugins/minigames/ShadesOfMortton.plugin').register(api);
  Common = require('../plugins/minigames/shadesofmortton/Common.ShadesOfMortton');
  Shades = require('../plugins/minigames/shadesofmortton/Shades.ShadesOfMortton');
  Catacombs = require('../plugins/minigames/shadesofmortton/Catacombs.ShadesOfMortton');
});

function ticks(count) {
  for (let i = 0; i < count; i++) TaskManager.process();
}

function container(capacity = 28) {
  const slots = [];
  return {
    slots,
    add(item) { slots.push({ id: item.getId(), amount: item.getAmount() }); },
    delete(id, amount = 1) { for (const s of slots) { if (s.id !== id || amount <= 0) continue; const n = Math.min(s.amount, amount); s.amount -= n; amount -= n; } },
    getAmount: (id) => slots.filter((s) => s.id === id).reduce((sum, s) => sum + s.amount, 0),
    getFreeSlots: () => capacity - slots.filter((s) => s.amount > 0).length,
    getValidItems: () => slots.filter((s) => s.amount > 0).map((s) => ({ getId: () => s.id, getAmount: () => s.amount })),
    refreshItems() {},
  };
}

function fakePlayer(at = new Location(3485, 3321, 0)) {
  const p = {
    location: at, messages: [], pages: [], inventory: container(),
    getLocation: () => p.location, moveTo(l) { p.location = l; },
    getInventory: () => p.inventory, sendMessage: (m) => p.messages.push(m), performAnimation() {},
    getPacketSender: () => ({ sendSound() {}, sendInterfaceRemoval() {} }),
    getDialogueManager: () => ({
      startDialogues(builder) { for (const page of builder.getDialogues().values()) if (page.getText) p.pages.push(page.getText()); },
      reset() {},
    }),
  };
  return p;
}

const key = (metal, colour) => Common.objId(`shadekey_${metal}_${colour}`);
const loc = (name, x, y, face = 0) => new core.GameObject(Common.locId(name), new Location(x, y, 0), 0, face, null);

function fakeShadow(id) {
  const npc = { id, transform: null, anims: [], target: null, hp: 38,
    getId: () => id, setNpcTransformationId(t) { npc.transform = t; }, performAnimation(a) { npc.anims.push(a.getId()); },
    getCombat: () => ({ getTarget: () => npc.target }), getHitpoints: () => npc.hp };
  return npc;
}

test('every shade drops its own remains, and only them (Loar remains from a Loar shadow or shade)', () => {
  const roll = (npcId) => { const event = { npcId, drops: [{ itemId: 526, amount: 1 }] }; hooks.events['npc-drops:roll'](event); return event.drops; };
  assert.deepEqual(roll(Common.npcId('shadeshadow_level1')), [{ itemId: Common.objId('shade_bones1'), amount: 1 }]);
  assert.deepEqual(roll(Common.npcId('shade_level3')), [{ itemId: Common.objId('shade_bones3'), amount: 1 }]);
  assert.deepEqual(roll(Common.npcId('shadeshadow_level6')), [{ itemId: Common.objId('shade_bones6'), amount: 1 }]);
});

test('a shadow rises into its shade when hit or fighting (shade_rise), and sinks back 68 ticks after its last fight', () => {
  const hit = fakeShadow(Common.npcId('shadeshadow_level1'));
  for (const fn of hooks.npcHit) fn({ npc: hit });
  assert.equal(hit.transform, Common.npcId('shade_level1'));
  assert.deepEqual(hit.anims, [1288]);
  const fighter = fakeShadow(Common.npcId('shadeshadow_level2'));
  fighter.target = {};
  Shades.watch([fighter]);
  Shades.process();
  assert.equal(fighter.transform, Common.npcId('shade_level2'), 'it rose to fight');
  fighter.target = null;
  for (let i = 0; i < 67; i++) Shades.process();
  assert.equal(fighter.transform, Common.npcId('shade_level2'));
  Shades.process();
  assert.equal(fighter.transform, -1, 'back to its shadow');
});

test("the hillside's wooden doors: refused without a key; with one, \"You use your Shade key...\" and inside 2 ticks on", () => {
  const door = loc('shadelairentrancel', 3485, 3320);
  const p = fakePlayer();
  hooks.objects.get('Wooden doors:Open')({ player: p, object: door });
  assert.ok(p.messages.includes('You need a key to open this door.'));
  p.inventory.add(new core.Item(key('bronze', 'bloodred'), 1));
  hooks.objects.get('Wooden doors:Open')({ player: p, object: door });
  assert.ok(p.messages.includes('You use your Shade key to unlock the door.'));
  ticks(2);
  assert.deepEqual([p.location.getX(), p.location.getY()], [3493, 9725]);
  assert.equal(p.inventory.getAmount(key('bronze', 'bloodred')), 1, 'the key is kept');
});

test('tomb doors: a key of the metal or better takes you through; back needs none; a lesser key is refused', () => {
  const bronze = loc('shadelair_bronzedoor', 3504, 9723, 2);
  const p = fakePlayer(new Location(3504, 9723, 0));
  p.inventory.add(new core.Item(key('steel', 'brown'), 1));
  hooks.objects.get('Solid bronze door:Open')({ player: p, object: bronze });
  assert.ok(p.messages.includes('You open the ominous tomb door.'));
  assert.deepEqual([p.location.getX(), p.location.getY()], [3505, 9723]);
  hooks.objects.get('Solid bronze door:Open')({ player: p, object: bronze });
  assert.ok(p.messages.includes('You walk back through the ominous door.'));
  assert.deepEqual([p.location.getX(), p.location.getY()], [3504, 9723]);
  const black = loc('shadelair_blackdoor', 3504, 9723, 2);
  hooks.objects.get('Solid black door:Open')({ player: p, object: black });
  assert.equal(p.messages.at(-1), 'You need a key to open this door.');
});

test("chests: another key is refused with the recorded line; its own key dissolves into treasure, coins and swamp paste", () => {
  const p = fakePlayer(new Location(3510, 9723, 0));
  p.inventory.add(new core.Item(key('bronze', 'bloodred'), 1));
  hooks.objects.get('Bronze Chest:Open')({ player: p, object: loc('shadechest_bronze_brown', 3511, 9723) });
  assert.equal(p.messages.at(-1), "You don't have the correct key.<br>You need a bronze key with a brown trim to open this chest.");
  const random = Math.random;
  Math.random = () => 0.99;
  try {
    hooks.objects.get('Bronze Chest:Open')({ player: p, object: loc('shadechest_bronze_bloodred', 3511, 9724) });
  } finally {
    Math.random = random;
  }
  assert.equal(p.inventory.getAmount(key('bronze', 'bloodred')), 0, 'the key dissolves');
  assert.equal(p.inventory.getAmount(Common.objId('swamppaste')), 10);
  assert.ok(p.inventory.getAmount(995) > 0);
  assert.match(p.pages[0], /^You find some treasure and \d+ gold coins\. The key strangely dissolves into the chest lock\.$/);
  assert.equal(p.pages[1], 'You find 10 doses of swamp paste at the bottom of the chest.');
});

test("coins are a third of what the roll leaves over the loot's value (Wiki)", () => {
  const random = Math.random;
  Math.random = () => 0;
  try {
    assert.equal(Catacombs.coinsFor('bronze', null), Math.floor(400 / 3));
    const gold = core.CacheDefinitions.getItem(2357).price;
    assert.equal(Catacombs.coinsFor('bronze', { id: 2357, amount: 1 }), Math.max(0, Math.floor((400 - gold) / 3)));
  } finally {
    Math.random = random;
  }
});

test('a chest without room for all its treasure (3 mithril bars, coins, paste) keeps the key and gives nothing', () => {
  const p = fakePlayer(new Location(3510, 9723, 0));
  for (let i = 0; i < 25; i++) p.inventory.add(new core.Item(1511, 1));
  p.inventory.add(new core.Item(key('bronze', 'bloodred'), 1));
  const open = () => hooks.objects.get('Bronze Chest:Open')({ player: p, object: loc('shadechest_bronze_bloodred', 3511, 9724) });
  const random = Math.random;
  Math.random = () => 0.43; // the mithril bars on the bronze table
  try {
    open();
    assert.equal(p.messages.at(-1), Common.message('noRoom'));
    assert.equal(p.inventory.getAmount(key('bronze', 'bloodred')), 1, 'the key is kept');
    assert.equal(p.inventory.getAmount(2359), 0);
    for (let i = 0; i < 3; i++) p.inventory.delete(1511, 1);
    open();
  } finally {
    Math.random = random;
  }
  assert.equal(p.inventory.getAmount(key('bronze', 'bloodred')), 0, 'with room, the key dissolves');
  assert.equal(p.inventory.getAmount(2359), 3);
  assert.ok(p.inventory.getAmount(Common.objId('swamppaste')) > 0);
});
