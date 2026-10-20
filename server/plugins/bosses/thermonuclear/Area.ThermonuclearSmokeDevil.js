"use strict";

/**
 * The Thermonuclear boss room (see ../ThermonuclearSmokeDevil.plugin.js for behaviour
 * and sources).
 *
 * Wiki: the boss "can be fought with another player" (like the Kraken), so the room is
 * multicombat throughout the Slayer-area box. The boss walks through other
 * monsters/players (Wiki), so it never gets stuck on the room's smoke devils.
 */
const Common = require("./Common.ThermonuclearSmokeDevil");

/** [minX, minY, maxX, maxY] from the boss room polygon. */
const ROOM = [2351, 9438, 2378, 9461];

function areaClass() {
  const { Area, Boundary } = Common.core;
  return class ThermonuclearSmokeDevilArea extends Area {
    constructor() {
      super([new Boundary(ROOM[0], ROOM[2], ROOM[1], ROOM[3], 0)]);
    }

    getName() {
      return "Thermonuclear Smoke Devil";
    }

    isMulti() {
      return true;
    }
  };
}

/** Wiki: the boss walks through other monsters/players, so it never sticks on them. */
function ensureWalkThrough(npc) {
  try {
    npc.setFlag?.(Common.core.NPC.WALK_THROUGH_ENTITIES_FLAG, true);
  } catch {
    // The flag is best-effort; the fight works without it.
  }
}

function attach(api) {
  api.registerArea(new (areaClass())());
}

module.exports = { attach, areaClass, ensureWalkThrough, ROOM };
