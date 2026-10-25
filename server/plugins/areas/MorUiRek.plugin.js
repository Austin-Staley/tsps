/**
 * Mor Ul Rek (TzHaar city) area interactions.
 *
 * Cave exit at 2479,5176 > Enter: back into the Karamja volcano dungeon at 2862,9572, beside its
 * cave entrance (rsprox captures, the move on the tick). The rocks up to the surface are
 * Karamja's.
 *
 * Hot vent doors > Pass: the player steps through to the far side in one 2-tile step, as a walk
 * or run (rsprox 224/01437, 235/03870-03891, 236/03958: (2436,5121) -> (2436,5119) through the
 * door at (2436,5120)). The city's music follows from the area as usual.
 */
const CAVE_EXIT_POSITION = { x: 2479, y: 5176, z: 0 };
const VOLCANO_DUNGEON_LANDING = [2862, 9572, 0];

const IGNORE_CLIPPING_FLAG = "movement:ignore-clipping";
const PASS_TICKS = 2;

let core;

/** Rotation 0 and 2 doors are passed north-south, 1 and 3 east-west (the cache's placements). */
function passVentDoor({ player, object }) {
  const door = object.getLocation();
  const at = player.getLocation();
  const northSouth = object.getFace() % 2 === 0;
  const side = Math.sign(northSouth ? at.getY() - door.getY() : at.getX() - door.getX()) || 1;
  const near = northSouth
    ? new core.Location(door.getX(), door.getY() + side, door.getZ())
    : new core.Location(door.getX() + side, door.getY(), door.getZ());
  const movement = player.getMovementQueue();
  movement.reset();
  if (!at.equals(near)) player.moveTo(near);
  // The door blocks its own tile: the step goes straight through it, then clipping is back.
  player.setFlag(IGNORE_CLIPPING_FLAG, true);
  movement.walkStep(northSouth ? 0 : -2 * side, northSouth ? -2 * side : 0);
  core.TaskManager.submit(new (class extends core.Task {
    constructor() { super(PASS_TICKS, player, false); }
    execute() { this.stop(); }
    stop() { player.removeFlag(IGNORE_CLIPPING_FLAG); super.stop(); }
  })());
  return true;
}

function isAt(location, position) {
  return location.x === position.x && location.y === position.y && (location.z ?? 0) === position.z;
}

function exitToVolcano(event) {
  const { player, location } = event;
  if (!isAt(location, CAVE_EXIT_POSITION)) return false;
  player.moveTo(new core.Location(...VOLCANO_DUNGEON_LANDING));
  event.handled = true;
}

module.exports = {
  name: "MorUiRek",
  members: true,
  passVentDoor,
  register(api) {
    core = api.core;
    api.onObjectInteraction("Cave exit", { Enter: exitToVolcano });
    api.onObjectInteraction("Hot vent door", { Pass: passVentDoor });
  },
};
