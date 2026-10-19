"use strict";

const { api, Location, Skill, DialogueChainBuilder, StatementDialogue } = require("./Core.Construction");
const Data = require("./Data.Construction");
const House = require("./House.Construction");

// Floors: plane 0 is the basement, 1 the ground floor, 2 the upper floor. Staircases join a hall
// to the hall above or below it, and the garden's dungeon entrance or a hall's spiral staircase
// to the dungeon stairs room. Messages are from rsprox captures.
const BASEMENT = 0;
const TOP_FLOOR = 2;
const COINS = 995;

// What each piece of stair furniture connects to, and the down/up staircase it pairs with when
// building a room through it.
const STAIRS = {
  OAK_STAIRCASE_UP: { up: true, pair: "OAK_STAIRCASE_DOWN" },
  TEAK_STAIRCASE_UP: { up: true, pair: "TEAK_STAIRCASE_DOWN" },
  MARBLE_STAIRCASE_UP: { up: true, pair: "MARBLE_STAIRCASE_DOWN" },
  OAK_STAIRCASE_DOWN: { down: true, pair: "OAK_STAIRCASE_UP" },
  TEAK_STAIRCASE_DOWN: { down: true, pair: "TEAK_STAIRCASE_UP" },
  MARBLE_STAIRCASE_DOWN: { down: true, pair: "MARBLE_STAIRCASE_UP" },
  SPIRAL_STAIRCASE: { up: true, down: true, pair: "SPIRAL_STAIRCASE" },
  MARBLE_SPIRAL_STAIRCASE: { up: true, down: true, pair: "MARBLE_SPIRAL_STAIRCASE" },
  DUNGEON_ENTRANCE: { down: true },
};
// The room a staircase leads to when there is none yet, by the room it starts in.
const ROOM_ABOVE = { SKILL_HALL_UP: "SKILL_HALL_DOWN", QUEST_HALL_UP: "QUEST_HALL_DOWN", DUNGEON_STAIRS: "SKILL_HALL_DOWN" };
const ROOM_BELOW = { SKILL_HALL_DOWN: "SKILL_HALL_UP", QUEST_HALL_DOWN: "QUEST_HALL_UP", SKILL_HALL_UP: "DUNGEON_STAIRS", QUEST_HALL_UP: "DUNGEON_STAIRS", GARDEN: "DUNGEON_STAIRS" };
// A dungeon stairs room takes the up-going staircases; any of them will do below an entrance.
const DUNGEON_STAIRCASES = ["OAK_STAIRCASE_UP", "TEAK_STAIRCASE_UP", "SPIRAL_STAIRCASE", "MARBLE_STAIRCASE_UP", "MARBLE_SPIRAL_STAIRCASE"];

function say(player, text) {
  player.getDialogueManager().startDialogues(new DialogueChainBuilder().add(new StatementDialogue(0, text)));
}

/** The stair furniture in a room, or null. */
function stairsIn(room) {
  return Object.values(room?.furnitureByLocation ?? {}).find(furniture => STAIRS[furniture.buildableKey]) ?? null;
}

function climb(event, direction) {
  const player = event.player;
  const house = House.houseFor(player);
  if (!house) return false;
  const position = house.getRoomPositionAt(event.location);
  const room = position && house.getRoom(position);
  const furniture = room && house.getFurnitureAt(event.location, event.objectId, event.object?.getType() ?? 10);
  const stairs = furniture && STAIRS[furniture.buildableKey];
  if (!stairs?.[direction]) return false;
  const up = direction === "up";
  const where = up ? "top" : "bottom";
  if (up && position.plane >= TOP_FLOOR) {
    say(player, "You are on the highest possible level so you cannot add a room above here.");
    return true;
  }
  if (!up && position.plane <= BASEMENT) return false;
  const next = { ...position, plane: position.plane + (up ? 1 : -1) };
  const nextRoom = house.getRoom(next);
  if (!nextRoom) {
    if (!House.isBuildingMode(player)) say(player, `These stairs do not lead anywhere. Enter building mode to build a room at the ${where}.`);
    else offerRoom(player, house, room, furniture, next, up);
    return true;
  }
  const nextFurniture = stairsIn(nextRoom);
  const nextStairs = STAIRS[nextFurniture?.buildableKey];
  const canHoldStairs = Data.ROOM_BY_KEY.get(nextRoom.roomKey)?.hotspots.some(key => key.includes("STAIRS"));
  if (!nextStairs && canHoldStairs) {
    say(player, `There are no stairs in the room ${up ? "above" : "below"}. Enter building mode to build some.`);
    return true;
  }
  // Two halls' staircases only meet when the rooms face the same way.
  const halls = nextFurniture?.buildableKey !== "DUNGEON_ENTRANCE" && furniture.buildableKey !== "DUNGEON_ENTRANCE";
  if (!nextStairs || !(up ? nextStairs.down : nextStairs.up) || (halls && nextRoom.rotation !== room.rotation)) {
    say(player, `These stairs cannot connect to the room ${up ? "above" : "below"}.`);
    return true;
  }
  const at = player.getLocation();
  player.moveTo(new Location(at.getX(), at.getY(), next.plane));
  return true;
}

/** Building mode: build the matching room (and its staircase) at the other end of the stairs. */
function offerRoom(player, house, room, furniture, next, up) {
  const roomKey = (up ? ROOM_ABOVE : ROOM_BELOW)[room.roomKey];
  const template = roomKey && Data.ROOM_BY_KEY.get(roomKey);
  if (!template) {
    say(player, `These stairs cannot connect to the room ${up ? "above" : "below"}.`);
    return;
  }
  api.sendMultiChatboxPrompt(player, `These stairs do not lead anywhere. Do you want to build a room at the ${up ? "top" : "bottom"}?`,
    "Yes", () => buildRoomThrough(player, house, room, furniture, next, template),
    "No", () => {});
}

function buildRoomThrough(player, house, room, furniture, next, template) {
  if (House.houseFor(player) !== house || !House.isBuildingMode(player)) return;
  const problem = house.canPlaceRoom(template, next, House.constructionLevel(player));
  if (problem) return player.sendMessage(problem);
  if (player.getInventory().getAmount(COINS) < template.cost) return player.sendMessage("You don't have enough coins to build that room.");
  // Place the room to test its stair space, and take it back out if no staircase can be built.
  house.placeRoom(next, template, room.rotation);
  const hotspot = template.hotspots.find(key => key.includes("STAIRS"));
  const placement = hotspot && house.hotspotPlacements(template.key, hotspot)[0];
  const target = placement && { position: next, hotspotKey: hotspot, sourceObjectId: placement.id, localX: placement.localX, localY: placement.localY, type: placement.type, face: placement.face };
  const candidates = STAIRS[furniture.buildableKey].pair ? [STAIRS[furniture.buildableKey].pair] : DUNGEON_STAIRCASES;
  const staircase = target && candidates.map(key => Data.BUILDABLE_BY_KEY.get(key))
    .find(buildable => buildable && typeof House.getBuildMaterials(player, house, target, buildable) !== "string");
  if (!staircase) {
    house.removeRoom(next);
    say(player, `You don't have the right materials to build any staircase in the room ${next.plane > room.plane ? "above" : "below"}.`);
    return;
  }
  for (const [itemId, amount] of House.getBuildMaterials(player, house, target, staircase)) House.useMaterial(player, itemId, amount);
  player.getInventory().delete(COINS, template.cost);
  house.setFurniture(target, staircase);
  player.getSkillManager().addExperiences(Skill.CONSTRUCTION, staircase.experience);
  House.rebuildHouse(player, house);
  player.sendMessage(`You build ${House.withArticle(template.name)}.`);
}

function climbUp(event) { return climb(event, "up"); }
function climbDown(event) { return climb(event, "down"); }

function climbEither(event) {
  if (!House.houseFor(event.player)) return false;
  api.sendMultiChatboxPrompt(event.player, "Climb up or down the stairs?", "Climb up.", () => climbUp(event), "Climb down.", () => climbDown(event));
  return true;
}

function attachStairs(api) {
  api.onObjectInteraction("Staircase", { "Climb-up": climbUp, "Climb-down": climbDown, Climb: climbEither });
  api.onObjectInteraction("Dungeon entrance", { Enter: climbDown });
}

Object.assign(module.exports, { attachStairs });
