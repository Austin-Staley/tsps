/**
 * NPC ferries (Wiki: Transportation#Boats) with no other home: the Monks of Entrana, the Void
 * Knight squires, Veos's ship to Great Kourend (Veos, Cabin Boy Herbert, Captain Magoro), the
 * Rellekka boats (Jarvald, the Sailor, Lokar Searunner, Mord and Maria Gunnars, Torfinn), Captain
 * Bentley's galleon, the Fossil Island barge's Quick-Travel and Jeb's rowing boat. Each route's
 * travel style, timings, landing and lines are in plugins/world/data/ferries.json, as rsprox
 * recordings play them; ./ferries/ holds the units:
 *
 * - Voyages.Ferries.js: the five travel styles and landing on logout or shutdown;
 * - Routes.Ferries.js: what starts each route, the Entrana search and `ferries:travel`.
 *
 * Quest plugins keep their own crossings and hand ordinary ones over with `ferries:travel`.
 * Not here: Veos and the Port Sarim Cabin Boy Herbert have no spawn in the generated
 * npc-spawns.json, so the Port Sarim side of Veos's ship has nobody to talk to yet.
 */
const Common = require("./ferries/Common.Ferries");
const Voyages = require("./ferries/Voyages.Ferries");
const Routes = require("./ferries/Routes.Ferries");

module.exports = {
  name: "Ferries",
  members: true,
  _test: { Common, Voyages, Routes },
  register(api) {
    Common.init(api);
    api.onPlayerLogout(Voyages.landNow);
    api.onServerShutdown(Voyages.landEveryone);
    Routes.attach(api);
  },
};
