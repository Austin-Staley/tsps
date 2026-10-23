// Run after `yarn build`: node --test tests/blast-furnace.test.cjs
const assert = require("node:assert/strict");
const { test, before, beforeEach } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { PluginManager } = require("../dist/plugins/PluginManager");
const { Equipment } = require("../dist/game/model/container/impl/Equipment");
const { ItemIds, NpcIds } = require("../dist/util/IdEnums");

const spawned = [];
const BlastFurnace = require("../plugins/minigames/BlastFurnace.plugin");
const Machinery = require("../plugins/minigames/blastfurnace/Machinery.BlastFurnace");
const { Location } = require("../dist/game/model/Location");
let giantDwarfStarted = false;
let dwarfOperated = true;
let playerIndex = 0;
const storedCoal = new Map();
const prompts = [];
const { init, tick, stateOf, putOre, takeBars, take, foremanCondition, foremanPaid, coolWithWater, stairs } = BlastFurnace._test;
before(async () => {
 await require("../dist/game/cache/CachePipeline").CachePipeline.initialize(process.cwd());
 PluginManager.getCoreApi().RegionManager.init();
 init({
  core: { ...PluginManager.getCoreApi(), WorldDefinition: { hasGlobalWorldTag: () => dwarfOperated } },
  spawnNpc: ({ id }) => {
    const npc = { id, removed: false, moveTo() {}, performAnimation() {}, setScriptedMovement() {} };
    spawned.push(npc);
    return npc;
  },
  removeNpc: (npc) => { npc.removed = true; },
  emitCustomEvent(name, request) {
    if (name === "quest:is-started") request.started = giantDwarfStarted;
    if (name === "storage:amount") request.amount += storedCoal.get(request.player) ?? 0;
    if (name === "storage:take") {
      request.taken = Math.min(request.amount, storedCoal.get(request.player) ?? 0);
      storedCoal.set(request.player, storedCoal.get(request.player) - request.taken);
    }
  },
  getTaskManager: () => ({ submit: (task) => task.setRunning(true) }),
  sendMultiChatboxPrompt: (player, title, ...choices) => prompts.push({ player, title, choices }),
 });
});

const DISPENSER = 936;

function player({ smithing = 99, items = {}, hands = -1 } = {}) {
  const attributes = new Map();
  const inventory = new Map(Object.entries(items).map(([id, amount]) => [Number(id), amount]));
  const equipment = new Array(14).fill(null);
  if (hands !== -1) equipment[Equipment.HANDS_SLOT] = { getId: () => hands };
  const p = {
    messages: [], xp: 0, varbits: new Map(), dialogues: 0, menu: null, inventory,
    index: ++playerIndex, location: new Location(1940, 4960, 0), energy: 100, moving: false,
    getIndex: () => p.index,
    getLocation: () => p.location,
    isRegistered: () => true,
    isPlayer: () => true,
    getHitpoints: () => 99,
    getNpcTransformationId: () => -1,
    getMovementQueue: () => ({ size: () => p.moving ? 1 : 0 }),
    getForceMovement: () => null,
    getRunEnergy: () => p.energy,
    setRunEnergy: (energy) => { p.energy = energy; },
    setPositionToFace() {},
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      contains: (id) => (inventory.get(id) ?? 0) > 0,
      getFreeSlots: () => 28 - [...inventory.values()].reduce((sum, n) => sum + n, 0),
      deleteNumber: (id, n) => inventory.set(id, inventory.get(id) - n),
      addItem: (item) => inventory.set(item.getId(), (inventory.get(item.getId()) ?? 0) + item.getAmount()),
    }),
    getEquipment: () => ({ getItems: () => equipment }),
    getSkillManager: () => ({ getCurrentLevel: () => smithing, getMaxLevel: () => smithing, addExperiences: (_, xp) => { p.xp += xp; } }),
    getPacketSender() {
      const sender = new Proxy({}, { get: (_, name) => {
        if (name === "getVarbit") return (id) => p.varbits.get(id) ?? 0;
        return (...args) => {
          if (name === "sendVarbit") p.varbits.set(args[0], args[1]);
          if (name === "sendCreationMenu") p.menu = args[0];
          return sender;
        };
      } });
      return sender;
    },
    getDialogueManager: () => ({ startDialogues: () => { p.dialogues++; } }),
    sendMessage: (message) => p.messages.push(message),
    performAnimation() {},
  };
  return p;
}

function ticks(count) {
  for (let i = 0; i < count; i++) tick();
}

beforeEach(() => {
  dwarfOperated = true;
  Machinery._test.reset();
  storedCoal.clear();
  ticks(10); // let anything a previous test left on the belt or pouring finish
  spawned.length = 0;
});

function manualTicks(count) {
  for (let i = 0; i < count; i++) {
    for (const operation of [...Machinery._test.snapshot().operators.values()]) operation.task.execute();
    tick();
  }
}

const station = (player) => ({ player, object: { getLocation: () => player.getLocation() } });

test("the belt loads a carried coal bag after inventory coal without exceeding the pot limit", () => {
  const p = player({ items: { [ItemIds.COAL]: 10, [ItemIds.MITHRIL_ORE]: 1 } });
  stateOf(p).coffer = 1000;
  stateOf(p).ores[ItemIds.COAL] = 240;
  storedCoal.set(p, 27);
  putOre(p);
  assert.equal(stateOf(p).ores[ItemIds.COAL], 254);
  assert.equal(storedCoal.get(p), 23);
  assert.equal(p.inventory.get(ItemIds.COAL), 0);
  assert.equal(stateOf(p).ores[ItemIds.MITHRIL_ORE], 1);
});

test("manual worlds require pedals and heat, not a coffer deposit", (t) => {
  dwarfOperated = false;
  t.mock.method(Math, "random", () => 1);
  const loader = player({ items: { [ItemIds.IRON_ORE]: 3, [ItemIds.SPADE]: 1 } });
  BlastFurnace._test.enterRoom({ player: loader });
  putOre(loader);
  ticks(5);
  assert.equal(stateOf(loader).bars[ItemIds.IRON_BAR], undefined, "stationary conveyor");
  Machinery._test.pedal(station(loader));
  manualTicks(4);
  assert.equal(stateOf(loader).bars[ItemIds.IRON_BAR], undefined, "cold furnace");
  assert.equal(loader.energy, 98);
  Machinery.leave(loader);
  Machinery._test.collectCoke({ player: loader });
  Machinery._test.refuel({ player: loader });
  assert.equal(loader.inventory.get(ItemIds.SPADE), 1, "refueling returns the spade");
  const pumper = player();
  Machinery._test.pump(station(pumper));
  manualTicks(40);
  assert.equal(stateOf(loader).bars[ItemIds.IRON_BAR], 3);
  assert.equal(pumper.xp, 40 * 2 + 1.5, "Strength plus contribution XP");
  assert.equal(stateOf(loader).coffer, 0);
  BlastFurnace._test.leaveRoom({ player: loader });
});

test("lead and cupronickel use their shared recipes and nickel cannot fill the pot", () => {
  const lead = player({ items: { [ItemIds.LEAD_ORE]: 4 } });
  stateOf(lead).coffer = 1000;
  putOre(lead);
  ticks(4);
  assert.equal(stateOf(lead).bars[ItemIds.LEAD_BAR], 2);
  assert.equal(lead.xp, 31);
  const nickel = player({ items: { [ItemIds.NICKEL_ORE]: 28 } });
  stateOf(nickel).coffer = 1000;
  putOre(nickel);
  ticks(4);
  assert.equal(stateOf(nickel).ores[ItemIds.NICKEL_ORE], 9, "space remains for copper");
  nickel.inventory.set(ItemIds.COPPER_ORE, 18);
  putOre(nickel);
  ticks(4);
  assert.equal(stateOf(nickel).bars[ItemIds.CUPRONICKEL_BAR], 9);
  assert.equal(nickel.xp, 9 * 42);
});

test("emptying requires confirmation, destroys only owned ore and clears its conveyor NPCs", () => {
  const p = player({ items: { [ItemIds.IRON_ORE]: 5 } }), other = player({ items: { [ItemIds.GOLD_ORE]: 2 } });
  stateOf(p).coffer = stateOf(other).coffer = 1000;
  putOre(p); putOre(other);
  BlastFurnace._test.checkPot({ player: p });
  prompts.at(-1).choices[3]();
  assert.equal(stateOf(p).ores[ItemIds.IRON_ORE], 5, "selecting Empty alone destroys nothing");
  prompts.at(-1).choices[1]();
  ticks(4);
  assert.deepEqual(stateOf(p).ores, {});
  assert.equal(stateOf(p).bars[ItemIds.IRON_BAR], undefined);
  assert.equal(stateOf(other).bars[ItemIds.GOLD_BAR], 2);
});

test("the dispenser holds at most 28 bars per metal", () => {
  const p = player({ items: { [ItemIds.IRON_ORE]: 28 } });
  stateOf(p).coffer = 1000;
  stateOf(p).bars[ItemIds.GOLD_BAR] = 27;
  putOre(p);
  ticks(4);
  assert.equal(stateOf(p).bars[ItemIds.IRON_BAR], 28);
  assert.equal(stateOf(p).ores[ItemIds.IRON_ORE], 0);
  p.inventory.set(ItemIds.IRON_ORE, 1);
  putOre(p);
  ticks(4);
  assert.equal(stateOf(p).bars[ItemIds.IRON_BAR], 28);
  assert.equal(stateOf(p).ores[ItemIds.IRON_ORE], 1, "ore waits when this metal's dispenser is full");
});

test("manual machine actions stop for movement, exhaustion and logout", () => {
  dwarfOperated = false;
  const p = player();
  Machinery._test.pedal(station(p));
  p.moving = true;
  manualTicks(1);
  assert.equal(Machinery._test.snapshot().operators.size, 0);
  p.moving = false;
  p.energy = 0;
  Machinery._test.pedal(station(p));
  manualTicks(1);
  assert.equal(Machinery._test.snapshot().operators.size, 0);
  Machinery._test.pump(station(p));
  BlastFurnace._test.logout({ player: p });
  assert.equal(Machinery._test.snapshot().operators.size, 0);
});

test("manual actions cannot be used outside the furnace", () => {
  dwarfOperated = false;
  const p = player({ items: { [ItemIds.SPADE]: 1 } });
  p.location = new Location(3222, 3218, 0);
  Machinery._test.collectCoke({ player: p });
  Machinery._test.pedal(station(p));
  assert.equal(p.inventory.get(ItemIds.SPADE), 1);
  assert.equal(Machinery._test.snapshot().operators.size, 0);
});

test("manual contribution is 1.5 XP per pour, has a ten-tick cooldown and expires", () => {
  dwarfOperated = false;
  const p = player();
  Machinery.contribute(p);
  Machinery.contribution();
  Machinery.contribution();
  assert.equal(p.xp, 1.5);
  manualTicks(10);
  Machinery.contribution();
  assert.equal(p.xp, 3);
  manualTicks(101);
  Machinery.contribution();
  assert.equal(p.xp, 3);
});

test("pouring bars and a stale hot-bar menu cannot bypass cooling", () => {
  const p = player();
  stateOf(p).bars[ItemIds.IRON_BAR] = 5;
  p.varbits.set(DISPENSER, 1);
  takeBars({ player: p });
  take(p, ItemIds.IRON_BAR, 5);
  assert.equal(p.menu, null);
  assert.equal(p.inventory.get(ItemIds.IRON_BAR), undefined);
  p.varbits.set(DISPENSER, 2);
  take(p, ItemIds.IRON_BAR, 5);
  assert.equal(stateOf(p).bars[ItemIds.IRON_BAR], 5);
});

test("water cools other hot bars within five tiles", () => {
  const p = player({ items: { [ItemIds.BUCKET_OF_WATER]: 1 } }), nearby = player(), distant = player();
  distant.location = new Location(1955, 4975, 0);
  for (const actor of [p, nearby, distant]) {
    stateOf(actor).bars[ItemIds.IRON_BAR] = 1;
    BlastFurnace._test.enterRoom({ player: actor });
    actor.varbits.set(DISPENSER, 2);
  }
  coolWithWater({ player: p, objectId: 9092, itemId: ItemIds.BUCKET_OF_WATER });
  assert.equal(nearby.varbits.get(DISPENSER), 3);
  assert.equal(distant.varbits.get(DISPENSER), 2);
  for (const actor of [p, nearby, distant]) BlastFurnace._test.leaveRoom({ player: actor });
});

test("overheating breaks parts without damage; hammer repairs award XP only once", (t) => {
  dwarfOperated = false;
  t.mock.method(Math, "random", () => 1);
  Machinery._test.startup();
  const stoker = player({ items: { [ItemIds.SPADE]: 1, [ItemIds.HAMMER]: 1 } });
  for (let i = 0; i < 3; i++) {
    Machinery._test.collectCoke({ player: stoker });
    Machinery._test.refuel({ player: stoker });
  }
  Machinery._test.pump(station(stoker));
  manualTicks(100);
  const state = Machinery._test.snapshot();
  assert.equal(state.heat, 0);
  assert.equal(state.operators.size, 0);
  assert.equal(state.parts.length, 4);
  assert.ok(state.parts.every((part) => part.broken));
  const xp = stoker.xp;
  const event = { player: stoker, object: state.parts[0].object };
  Machinery._test.repair(event);
  Machinery._test.repair(event);
  assert.equal(stoker.xp, xp + 50);
  assert.equal(state.parts[0].broken, false);
});

test("ore needs coins in the coffer and, under 60 Smithing, the foreman's permit", () => {
  const p = player({ smithing: 50, items: { [ItemIds.IRON_ORE]: 5 } });
  putOre(p);
  assert.equal(p.inventory.get(ItemIds.IRON_ORE), 5, "empty coffer");
  stateOf(p).coffer = 1000;
  putOre(p);
  assert.equal(p.inventory.get(ItemIds.IRON_ORE), 5, "no permit");
  stateOf(p).permitUntil = Date.now() + 60_000;
  putOre(p);
  assert.equal(p.inventory.get(ItemIds.IRON_ORE), 0);
  assert.equal(stateOf(p).ores[ItemIds.IRON_ORE], 5);
});

test("iron with coal smelts into steel with half the coal; the rest is iron", () => {
  const p = player({ items: { [ItemIds.IRON_ORE]: 10, [ItemIds.COAL]: 6 } });
  stateOf(p).coffer = 1000;
  putOre(p);
  assert.equal(spawned.length, 2, "one ore npc per type");
  ticks(3);
  assert.equal(stateOf(p).bars[ItemIds.STEEL_BAR], undefined, "still on the belt");
  ticks(1);
  assert.deepEqual([stateOf(p).bars[ItemIds.STEEL_BAR], stateOf(p).bars[ItemIds.IRON_BAR]], [6, 4]);
  assert.equal(stateOf(p).ores[ItemIds.COAL], 0);
  assert.ok(Math.abs(p.xp - (6 * 17.5 + 4 * 12.5)) < 1e-9);
  assert.equal(p.varbits.get(943), 6, "steel bar varbit");
  assert.equal(p.varbits.get(DISPENSER), 1, "pouring");
});

test("mithril waits in the pot for its coal, and primary ore is capped at 28", () => {
  const p = player({ items: { [ItemIds.MITHRIL_ORE]: 30 } });
  stateOf(p).coffer = 1000;
  stateOf(p).ores[ItemIds.MITHRIL_ORE] = 10;
  putOre(p);
  assert.equal(stateOf(p).ores[ItemIds.MITHRIL_ORE], 28);
  assert.equal(p.inventory.get(ItemIds.MITHRIL_ORE), 12);
  ticks(4);
  assert.equal(stateOf(p).bars[ItemIds.MITHRIL_BAR], undefined);
  p.inventory.set(ItemIds.COAL, 20);
  putOre(p);
  ticks(4);
  assert.equal(stateOf(p).bars[ItemIds.MITHRIL_BAR], 10, "two coal a bar");
});

test("goldsmith gauntlets add 33.7 XP a gold bar", () => {
  const p = player({ hands: ItemIds.GOLDSMITH_GAUNTLETS, items: { [ItemIds.GOLD_ORE]: 2 } });
  stateOf(p).coffer = 1000;
  putOre(p);
  ticks(4);
  assert.ok(Math.abs(p.xp - 2 * 56.2) < 1e-9);
});

test("molten bars need ice gloves or water; cooled bars are taken into free slots", () => {
  const p = player({ items: { [ItemIds.IRON_ORE]: 3 } });
  stateOf(p).coffer = 1000;
  putOre(p);
  ticks(4 + 2);
  assert.equal(p.varbits.get(DISPENSER), 2, "hot");
  takeBars({ player: p });
  assert.equal(p.menu, null, "no gloves");
  const event = { player: p, objectId: 9092, itemId: ItemIds.BUCKET_OF_WATER, itemSlot: 0, handled: false };
  p.inventory.set(ItemIds.BUCKET_OF_WATER, 1);
  coolWithWater(event);
  assert.equal(event.handled, true);
  assert.equal(p.varbits.get(DISPENSER), 3, "cooled");
  assert.equal(p.inventory.get(ItemIds.BUCKET), 1);
  takeBars({ player: p });
  assert.deepEqual(p.menu.getItems(), [ItemIds.IRON_BAR]);
  take(p, ItemIds.IRON_BAR, 28);
  assert.equal(p.inventory.get(ItemIds.IRON_BAR), 3);
  assert.equal(p.varbits.get(DISPENSER), 0, "empty");
});

test("bars cool by themselves after 16 ticks", () => {
  const p = player({ items: { [ItemIds.SILVER_ORE]: 1 } });
  stateOf(p).coffer = 1000;
  putOre(p);
  ticks(4 + 17);
  assert.equal(p.varbits.get(DISPENSER), 2);
  ticks(1);
  assert.equal(p.varbits.get(DISPENSER), 3);
});

test("the foreman's conditions and fee", () => {
  const p = player({ smithing: 40, items: { [ItemIds.COINS]: 3000 } });
  const ask = (text, stepId) => foremanCondition({ player: p, npcId: NpcIds.BLAST_FURNACE_FOREMAN, text, stepId });
  assert.equal(ask("If the player has less than 60 Smithing:"), true);
  assert.equal(ask("If the player has 2,500 or more coins on them:"), true);
  assert.equal(ask("If the player is wearing the Ring of Charos(a):"), false);
  assert.equal(ask("If the player has discovered how to smith chromium ingots:"), false);
  assert.equal(ask("Something else:"), null);
  foremanPaid({ player: p, npcId: NpcIds.BLAST_FURNACE_FOREMAN, text: "Okay, you can use the furnace for ten minutes. Remember, you only need half as much coal as with a regular furnace." });
  assert.equal(p.inventory.get(ItemIds.COINS), 500);
  assert.ok(stateOf(p).permitUntil > Date.now());
});

test("the Furnace stairs gate entry but always allow the exit", () => {
  const locations = [];
  const messages = [];
  const p = { moveTo: (location) => locations.push([location.getX(), location.getY()]), sendMessage: (message) => messages.push(message) };
  giantDwarfStarted = false;
  stairs({ player: p, objectId: 9084 });
  assert.deepEqual(locations, [], "unstarted players cannot enter the Furnace");
  assert.match(messages[0], /start The Giant Dwarf/);

  stairs({ player: p, objectId: 9138 });
  assert.deepEqual(locations, [[2931, 10196]], "players can leave the Furnace without the quest");
  giantDwarfStarted = true;
  stairs({ player: p, objectId: 9084 });
  assert.deepEqual(locations.at(-1), [1939, 4958], "starting The Giant Dwarf permits entry");
  giantDwarfStarted = false;
});
