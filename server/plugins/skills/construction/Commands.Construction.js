"use strict";

const { CacheDefinitions } = require("./Core.Construction");
const Data = require("./Data.Construction");
const Instance = require("./Instance.Construction");

/** ::hotspots - every build hotspot of the room you stand in, with its tile. */
function listHotspots({ player }) {
  const house = player.getPrivateArea();
  const position = house instanceof Instance.PlayerHouseInstance ? house.getRoomPositionAt(player.getLocation()) : null;
  const room = position && house.getRoom(position);
  if (!room) {
    player.sendMessage("Stand in a room of a house first.");
    return;
  }
  player.sendMessage(`${room.roomKey} at ${position.x},${position.y} plane ${position.plane}, rotation ${room.rotation}:`);
  for (const tile of house.hotspotTiles(position)) {
    const name = CacheDefinitions.getObject(tile.id)?.name ?? "";
    if (!/space|hotspot/i.test(name)) continue;
    const key = Data.hotspotIn(room.roomKey, tile.id)?.key ?? "(not in this room's hotspots)";
    player.sendMessage(`${key} ${tile.id} "${name}" at ${tile.x} ${tile.y} ${tile.plane}`);
  }
}

Object.assign(module.exports, { listHotspots });
