/**
 * Death's Office: the Death's Domain entrances near the respawn points, a private copy of the
 * office per visit, Death, and his item retrieval for graves that collapsed. The items, fees and
 * Coffer balance are the Gravestones plugin's (plugins/world/Gravestones.plugin.js), reached
 * through `gravestones:*` events. See docs/gravestones.md.
 */
module.exports = {
  name: "DeathsOffice",
  register(api) {
    require("./deathsoffice/Instance.DeathsOffice").attach(api);
    require("./deathsoffice/Entrances.DeathsOffice").attach(api);
    require("./deathsoffice/Death.DeathsOffice").attach(api);
    require("./deathsoffice/Retrieval.DeathsOffice").attach(api);
  },
};
