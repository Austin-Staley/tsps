"use strict";

/**
 * Where Kraken loot lands (see ../Kraken.plugin.js for behaviour and sources).
 *
 * The Kraken's body sits in deep water, so the default loot tile (its own location)
 * is unreachable. Loot goes to a fixed verified shore tile just south of the pool
 * (stood on in testing), as with Zulrah and Vorkath moving loot off the boss.
 */

const Shared = require("./Shared.Kraken");

/** Shore tile south of the boss pool, verified walkable (stood on in testing). */
const LOOT_TILE = [2280, 10031];

function placeLoot(where) {
  if (!where || where.npcId !== Shared.ids().BOSS) return;
  const z = where.npc?.getLocation?.()?.getZ?.() ?? 0;
  const { Location } = Shared.core();
  where.location = new Location(LOOT_TILE[0], LOOT_TILE[1], z);
}

function attach(api) {
  api.onCustomEvent("npc-drops:location", placeLoot);
}

module.exports = { attach, placeLoot, LOOT_TILE };
