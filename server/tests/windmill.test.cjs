// Run after `yarn build`: node --test tests/windmill.test.cjs
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { CacheDefinitions } = require('../dist/game/cache/CacheDefinitions');
const { PacketSender } = require('../dist/net/packet/PacketSender');
const { GameObject } = require('../dist/game/entity/impl/object/GameObject');
const { Location } = require('../dist/game/model/Location');
const { ItemIdentifiers: Item } = require('../dist/util/ItemIdentifiers');
const Windmill = require('../plugins/objects/Windmill.plugin');
const hooks = {};
let login;
let flourVarbit, showFlourVarbit;

before(async () => {
  await CachePipeline.initialize();
  flourVarbit = CacheDefinitions.getVarbitId('mill_flour');
  showFlourVarbit = CacheDefinitions.getVarbitId('mill_showflour');
  assert.equal(flourVarbit, 4920);
  assert.equal(showFlourVarbit, 5325);
  Windmill.register({
    persistAttribute() {},
    onObjectInteraction: (name, actions) => { hooks[name] = actions; },
    onPlayerLogin: (handler) => { login = handler; },
  });
});

function miller(flour = 0, grain = 0, pots = 1) {
  const attributes = new Map([['windmill:flour', flour]]);
  const items = new Map([[Item.GRAIN, grain], [Item.POT, pots]]);
  const packets = [];
  const inventory = {
    containsNumber: (id) => (items.get(id) ?? 0) > 0,
    deleteNumber: (id, amount) => items.set(id, (items.get(id) ?? 0) - amount),
    adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getSession: () => ({ sendClientPacket: (packet) => packets.push(packet) }),
    sendMessage() {},
  };
  const sender = new PacketSender(player);
  player.getPacketSender = () => sender;
  const event = { player, location: { x: 3166, y: 3305, z: 2 },
    object: new GameObject(5792, new Location(3166, 3306, 0), 10, 0) };
  return { player, sender, items, attributes, packets, event };
}

test('operating grain updates the native flour count; collecting the last pot clears it', () => {
  const m = miller(0, 1);
  hooks.Hopper.Fill(m.event);
  assert.equal(m.items.get(Item.GRAIN), 0);
  assert.equal(m.sender.getVarbit(flourVarbit), 0);
  hooks['Hopper controls'].Operate(m.event);
  assert.equal(m.sender.getVarbit(flourVarbit), 1, 'RuneLite reads MILL_FLOUR, not the bin appearance flag');
  assert.equal(m.sender.getVarbit(showFlourVarbit), 1);
  hooks['Flour bin'].Empty(m.event);
  assert.equal(m.items.get(Item.POT_OF_FLOUR), 1);
  assert.equal(m.sender.getVarbit(flourVarbit), 0);
  assert.equal(m.sender.getVarbit(showFlourVarbit), 0);
});

test('the flour count holds multiple pots and stops at the bin capacity', () => {
  const m = miller(29, 2);
  hooks.Hopper.Fill(m.event);
  hooks['Hopper controls'].Operate(m.event);
  assert.equal(m.sender.getVarbit(flourVarbit), 30);
  hooks.Hopper.Fill(m.event);
  hooks['Hopper controls'].Operate(m.event);
  assert.equal(m.sender.getVarbit(flourVarbit), 30);
  assert.equal(m.attributes.get('windmill:hopper'), true, 'A full bin does not discard the hopper grain');
  hooks['Flour bin'].Empty(m.event);
  assert.equal(m.sender.getVarbit(flourVarbit), 29);
  assert.equal(m.sender.getVarbit(showFlourVarbit), 1);
});

test('an empty hopper and a missing pot cannot change the flour count', () => {
  const m = miller(1, 0, 0);
  hooks['Hopper controls'].Operate(m.event);
  hooks['Flour bin'].Empty(m.event);
  assert.equal(m.attributes.get('windmill:flour'), 1);
  assert.equal(m.packets.length, 0);
});

test('login restores both native vars from saved flour, including bins filled before this fix', () => {
  for (const amount of [0, 1, 2, 30]) {
    const m = miller(amount);
    login({ player: m.player });
    assert.equal(m.sender.getVarbit(flourVarbit), amount);
    assert.equal(m.sender.getVarbit(showFlourVarbit), amount > 0 ? 1 : 0);
  }
});
