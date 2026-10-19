"use strict";

/**
 * The Kraken Cove crevice shortcut (see ../Kraken.plugin.js for behaviour and sources).
 *
 * Crevice 537 at (2280, 10017) Enter leads into the Kraken boss pool at (2280, 10022);
 * Crevice 538 at (2280, 10021) Use leads back out to (2280, 10016). Destinations follow
 * the cave's own layout (the out-landing is the tile players stand on at the crevice);
 * the boss-side landing mirrors the cove's other short hops. Plain moves: no squeeze
 * animation was captured, so none is played (estimate).
 * Private/Peek on 537 are not handled here (private instances are a follow-up).
 */

const Shared = require("./Shared.Kraken");

const CREVICE_IN_ID = 537;
const CREVICE_IN_TILE = [2280, 10017, 0];
const BOSS_SIDE_TILE = [2280, 10022, 0];
const CREVICE_OUT_ID = 538;
const CREVICE_OUT_TILE = [2280, 10021, 0];
const COVE_SIDE_TILE = [2280, 10016, 0];

function at(object, tile) {
  const location = object?.getLocation?.();
  return !!location
    && location.getX() === tile[0]
    && location.getY() === tile[1]
    && location.getZ() === tile[2];
}

function go(player, tile) {
  const { Location } = Shared.core();
  player.moveTo(new Location(tile[0], tile[1], tile[2]));
  return true;
}

function enter({ player, object }) {
  if (!object || !Shared.alive(player)) return false;
  if (object.getId?.() !== CREVICE_IN_ID || !at(object, CREVICE_IN_TILE)) return false;
  return go(player, BOSS_SIDE_TILE);
}

function use({ player, object }) {
  if (!object || !Shared.alive(player)) return false;
  if (object.getId?.() !== CREVICE_OUT_ID || !at(object, CREVICE_OUT_TILE)) return false;
  return go(player, COVE_SIDE_TILE);
}

function attach(api) {
  api.onObjectInteraction("Crevice", { Enter: enter, Use: use });
}

module.exports = { attach, enter, use };
