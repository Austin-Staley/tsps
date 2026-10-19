"use strict";

/**
 * Construction tables from ./data: rooms (template chunks, costs, hotspots), hotspots, the
 * furniture that can be built on each, and the house viewer's furniture rows.
 * Chunk coordinates are tile-chunk coordinates, not map-square coordinates.
 */
const CONSTRUCTION_ROOMS = require("./data/rooms.json");
/** Blank/floor/roof chunks used when no saved room occupies a grid square. */
const HOUSE_TEMPLATE_CHUNKS = require("./data/template-chunks.json");
/** Construction hotspot object ids. Multiple ids are separate cache variants of one space. */
const CONSTRUCTION_HOTSPOTS = require("./data/hotspots.json");
const CONSTRUCTION_BUILDABLES = require("./data/furniture.json");
/** Furniture row choices in house-viewer slot order, by room id. */
const CONSTRUCTION_VIEWER_FURNITURE = require("./data/viewer-furniture.json");

const ROOM_BY_KEY = new Map(CONSTRUCTION_ROOMS.map((room) => [room.key, room]));
const HOTSPOT_BY_OBJECT_ID = new Map(CONSTRUCTION_HOTSPOTS.flatMap((hotspot) => hotspot.objectIds.map((id) => [id, hotspot])));
const BUILDABLE_BY_KEY = new Map(CONSTRUCTION_BUILDABLES.map((buildable) => [buildable.key, buildable]));
const HOTSPOT_BY_KEY = new Map(CONSTRUCTION_HOTSPOTS.map((hotspot) => [hotspot.key, hotspot]));
// Some hotspot locs are shared between rooms (the hall and dungeon stair spaces), so a room's own
// hotspots decide what a loc is there.
const HOTSPOTS_BY_ROOM = new Map(CONSTRUCTION_ROOMS.map((room) => [room.key, new Map(
  room.hotspots.map((key) => HOTSPOT_BY_KEY.get(key)).filter(Boolean)
    .flatMap((hotspot) => hotspot.objectIds.map((id) => [id, hotspot])).reverse(),
)]));

/** The hotspot `objectId` is in a room of type `roomKey`, or null. */
function hotspotIn(roomKey, objectId) {
  return HOTSPOTS_BY_ROOM.get(roomKey)?.get(objectId) ?? null;
}

Object.assign(module.exports, { CONSTRUCTION_ROOMS, HOUSE_TEMPLATE_CHUNKS, CONSTRUCTION_HOTSPOTS, CONSTRUCTION_BUILDABLES, ROOM_BY_KEY, HOTSPOT_BY_OBJECT_ID, HOTSPOT_BY_KEY, BUILDABLE_BY_KEY, CONSTRUCTION_VIEWER_FURNITURE, hotspotIn });
