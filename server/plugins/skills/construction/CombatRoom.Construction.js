"use strict";

const { Animation, PluginManager, encodeLocDel } = require("./Core.Construction");
const House = require("./House.Construction");

// Combat dummies (rsprox captures): Attach swaps the dummy for its NPC ("You attach the sand
// bag."), which takes hits and never falls; Detach swaps back. The NPC has the cache's 1,000
// hitpoints, topped up every tick, and never retaliates.
const DUMMY_NPCS = { COMBAT_DUMMY: 2668, UNDEAD_COMBAT_DUMMY: 7413 };
const PICK_UP = 832;
const NO_RETALIATE = "combat:no-retaliate";

/** house -> Map(npc -> furniture it stands in for) */
const attached = new WeakMap();

function dummiesIn(house) {
  let dummies = attached.get(house);
  if (!dummies) attached.set(house, dummies = new Map());
  return dummies;
}

function attach(event) {
  const player = event.player;
  const house = House.houseFor(player);
  const furniture = house?.getFurnitureAt(event.location, event.objectId, event.object?.getType() ?? 10);
  const npcId = furniture && DUMMY_NPCS[furniture.buildableKey];
  if (!npcId) return false;
  if (house.buildingMode) {
    player.sendMessage("You cannot set up the combat dummy in building mode.");
    return true;
  }
  const { x, y, z } = event.location;
  const npc = PluginManager.spawnNpc({ id: npcId, x, y, z, wanderRadius: 0 });
  if (!npc) return true;
  npc.setFlag?.(NO_RETALIATE, true);
  house.enter(npc);
  dummiesIn(house).set(npc, furniture);
  hideLoc(house, furniture, event.object);
  player.performAnimation(new Animation(PICK_UP));
  player.sendMessage("You attach the sand bag.");
  return true;
}

function hideLoc(house, furniture, object) {
  house.hiddenFurniture.add(furniture);
  house.furnitureObjects = house.furnitureObjects.filter(drawn => drawn !== object);
  const at = object.getLocation();
  for (const occupant of house.getPlayers()) {
    occupant.getSession().sendClientPacket(encodeLocDel(at.getX(), at.getY(), at.getZ(), object.getType(), object.getFace()));
  }
}

function detach(event) {
  const house = House.houseFor(event.player);
  const furniture = house && dummiesIn(house).get(event.npc);
  if (!furniture) return false;
  dummiesIn(house).delete(event.npc);
  house.leave(event.npc, false);
  PluginManager.removeNpc(event.npc);
  house.hiddenFurniture.delete(furniture);
  house.redrawFurniture();
  event.player.performAnimation(new Animation(PICK_UP));
  event.player.sendMessage("You detach the sand bag.");
  return true;
}

/** PlayerHouseInstance.process: dummies never fall. */
function tendDummies(house) {
  for (const npc of attached.get(house)?.keys() ?? []) {
    if (npc.getHitpoints() < npc.getDefinition().getHitpoints()) npc.setHitpoints(npc.getDefinition().getHitpoints());
  }
}

function attachCombatRoom(api) {
  api.onObjectInteraction("Combat dummy", { Attach: attach });
  api.onObjectInteraction("Undead combat dummy", { Attach: attach });
  // The cache names them in colour tags; match the plain names too.
  api.onNpcsInteraction(["<col=00ffff>Combat dummy</col>", "<col=00ffff>Undead Combat dummy</col>", "Combat dummy", "Undead Combat dummy"], { Detach: detach });
}

Object.assign(module.exports, { attachCombatRoom, tendDummies });
