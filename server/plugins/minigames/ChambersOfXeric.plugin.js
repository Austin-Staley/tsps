"use strict";

/**
 * Chambers of Xeric: Mount Quidamortem's recruiting board and parties, the raid's randomly
 * laid-out chambers (or Challenge Mode's fixed ones), and later its rooms and the Great Olm.
 * Each unit lives in ./cox/; add one line per unit.
 */
module.exports = {
  name: "ChambersOfXeric",
  members: true,
  register(api) {
    require("./cox/Lobby.Cox")(api);
    require("./cox/Raid.Cox")(api);
    require("./cox/Storage.Cox")(api);
    require("./cox/Resources.Cox")(api);
    require("./cox/Herblore.Cox")(api);
    require("./cox/Supplies.Cox")(api);
    require("./cox/IceDemon.Cox")(api);
    require("./cox/Thieving.Cox")(api);
    require("./cox/Tightrope.Cox")(api);
    require("./cox/Crabs.Cox")(api);
    require("./cox/Tekton.Cox")(api);
    require("./cox/Muttadiles.Cox")(api);
    require("./cox/Vanguards.Cox")(api);
    require("./cox/Vasa.Cox")(api);
    require("./cox/Scavengers.Cox")(api);
    require("./cox/Mystics.Cox")(api);
    require("./cox/Shamans.Cox")(api);
    require("./cox/Guardians.Cox")(api);
    require("./cox/Vespula.Cox")(api);
    require("./cox/Olm.Cox")(api);
    require("./cox/Rewards.Cox")(api);
    require("./cox/Commands.Cox")(api);
  },
};
