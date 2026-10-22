const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const core = PluginManager.getCoreApi();
let gate;
const consumers = [];
const api = new Proxy({ core,
  onCanAttack: (handler) => { gate ??= handler; },
  onCustomEvent: (name, handler) => { if (name === "bounty-hunter:weapon-area") consumers.push(handler); },
  emitCustomEvent: (_name, event) => consumers.forEach((handler) => handler(event)),
}, { get: (object, name) => object[name] ?? (() => {}) });
require("../plugins/items/BountyHunterWeapons.plugin").register(api);

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
});

function player(weapon = core.ItemIdentifiers.DARK_BOW_BH_) {
  const player = { isPlayer: () => true, getAsPlayer: () => player,
    getEquipment: () => ({ get: () => ({ getId: () => weapon }) }), sendMessage() {},
    getArea: () => null, getPrivateArea: () => null, getLocation: () => new core.Location(3200, 3200, 0),
  };
  return player;
}

function canAttack(attacker, target = player()) {
  const event = { attacker, target, allow: null };
  gate(event);
  return event.allow;
}

test("BH darkbow refuses the wilderness and unsupported PvP areas; ordinary darkbow is unaffected", () => {
  assert.equal(canAttack(player()), false);
  assert.equal(canAttack(player(core.ItemIdentifiers.DARK_BOW)), null);
});

test("Castle Wars and the Fight Pit approve only their canonical game areas", () => {
  const data = require("../plugins/minigames/castlewars/Data.CastleWars")(core);
  const game = { data, getTeamData: (team) => data.TEAM_DATA[team] };
  require("../plugins/minigames/castlewars/Areas.CastleWars")(api, game);
  const attacker = player(), target = player();
  attacker.getArea = () => game.gameArea;
  target.getArea = () => game.gameArea;
  assert.equal(canAttack(attacker, target), null);
  target.getArea = () => game.lobbyArea;
  assert.equal(canAttack(attacker, target), false);
  target.getArea = () => null;
  attacker.getArea = () => null;
  require("../plugins/minigames/TzhaarFightPits.plugin").register(api);
  attacker.getLocation = () => new core.Location(2399, 5160, 0);
  target.getLocation = () => new core.Location(2398, 5160, 0);
  assert.equal(canAttack(attacker, target), null);
  target.getLocation = () => new core.Location(2399, 5170, 0);
  assert.equal(canAttack(attacker, target), false, "the waiting room cannot approve the bow");
});

test("a POH approves only two opponents in the same actual combat ring", (t) => {
  require("../plugins/skills/construction/Core.Construction").init(api);
  const House = require("../plugins/skills/construction/House.Construction");
  const Rings = require("../plugins/skills/construction/CombatRings.Construction");
  Rings.attachCombatRings(api);
  const { CacheDefinitions } = require("../dist/game/cache/CacheDefinitions");
  const matId = CacheDefinitions.getLocId("poh_combat_mat_middle");
  assert.ok(matId >= 0);
  const house = { furnitureObjects: [
    { getId: () => matId, getLocation: () => new core.Location(100, 100, 0) },
    { getId: () => matId, getLocation: () => new core.Location(101, 100, 0) },
  ], getRoomPositionAt: () => ({ x: 4, y: 4, plane: 1 }) };
  const attacker = player(), target = player();
  t.mock.method(House, "houseFor", () => house);
  attacker.getLocation = () => new core.Location(100, 100, 0);
  target.getLocation = () => new core.Location(101, 100, 0);
  assert.equal(canAttack(attacker, target), null);
  target.getLocation = () => new core.Location(102, 100, 0);
  assert.equal(canAttack(attacker, target), false);
});
