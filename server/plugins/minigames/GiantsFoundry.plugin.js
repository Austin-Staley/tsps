"use strict";

/**
 * Giants' Foundry: Kovac's sword-smithing minigame in the cave under the Giants' Plateau,
 * opened by Sleeping Giants. Each unit lives in ./giantsfoundry/; add one line per unit.
 *
 * Wiki: https://oldschool.runescape.wiki/w/Giants%27_Foundry (docs/giants-foundry.md)
 */
module.exports = {
  name: "GiantsFoundry",
  members: true,
  register(api) {
    require("./giantsfoundry/Shared.GiantsFoundry").bind(api);
    require("./giantsfoundry/State.GiantsFoundry")(api);
    require("./giantsfoundry/Area.GiantsFoundry")(api);
    require("./giantsfoundry/Preform.GiantsFoundry")(api);
  },
};
