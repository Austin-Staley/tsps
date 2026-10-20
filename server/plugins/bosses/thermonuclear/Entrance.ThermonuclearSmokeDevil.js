"use strict";

/**
 * Getting to the Thermonuclear smoke devil (see ../ThermonuclearSmokeDevil.plugin.js
 * for behaviour and sources).
 *
 * Wiki: north-west after entering the Smoke Devil Dungeon to find the crevice leading
 * to the boss. NR walks through crevice 535 outside to (2376, 9452) inside and back
 * through 536; Peek counts the room. Private instances (100k, NR) are a follow-up and
 * are not implemented here.
 */
const Common = require("./Common.ThermonuclearSmokeDevil");

/** Only crevices by the boss room take players through; every other crevice is untouched. */
function isBossCrevice(event) {
  const id = event?.objectId;
  if (id !== Common.CREVICE_OUTSIDE_ID && id !== Common.CREVICE_INSIDE_ID) return false;
  const at = event?.location;
  if (!at) return false;
  const dx = at.x - Common.OUTSIDE_TILE[0];
  const dy = at.y - Common.OUTSIDE_TILE[1];
  return dx * dx + dy * dy <= 30 * 30;
}

function through({ player, location, objectId }) {
  if (!isBossCrevice({ location, objectId })) return false;
  const inside = Common.inLair(player.getLocation());
  player.moveTo(Common.location(inside ? Common.OUTSIDE_TILE : Common.INSIDE_TILE));
  return true;
}

function peekText(count) {
  if (count === 0) return "You peek through the crevice and see no adventurers inside.";
  if (count === 1) return "You peek through the crevice and see 1 adventurer inside.";
  return `You peek through the crevice and see ${count} adventurers inside.`;
}

function peek({ player, location, objectId }) {
  if (!isBossCrevice({ location, objectId })) return false;
  const { World } = Common.core;
  let count = 0;
  try {
    for (const other of World?.getPlayers?.() ?? []) {
      if (other?.getPrivateArea?.() === player.getPrivateArea?.() && Common.inLair(other.getLocation())) count++;
    }
  } catch {
    count = 0;
  }
  player.sendMessage(peekText(count));
  return true;
}

function attach(api) {
  api.onObjectInteraction("Crevice", {
    Peek: peek,
    Use: through,
    Enter: through,
    "Climb-through": through,
    Climb: through,
    Pass: through,
    Squeeze: through,
    "Squeeze-through": through,
  });
}

module.exports = { attach, through, peek, isBossCrevice };
