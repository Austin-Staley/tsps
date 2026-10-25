/**
 * The Volcanic Mine on Fossil Island (https://oldschool.runescape.wiki/w/Volcanic_Mine), from
 * plugins/minigames/data/volcanic-mine.json and the rsprox recordings 1858 and 1854: Petrified
 * Pete and the fee, one game a world in an instance of the mine, its vents, chambers, gas holes and
 * lava, the boulder down the central channel, and the reward on the way out. Each part lives in
 * ./volcanicmine/. The hazards (lava beasts, stalactites, meteors) and Pete's item retrieval are
 * still to come.
 */
const Common = require("./volcanicmine/Common.VolcanicMine");

module.exports = {
  name: "VolcanicMine",
  members: true,
  register(api) {
    Common.init(api);
    require("./volcanicmine/Game.VolcanicMine").attachGame(api);
    require("./volcanicmine/Entry.VolcanicMine").attachEntry(api);
    require("./volcanicmine/Mine.VolcanicMine").attachMine(api);
    require("./volcanicmine/Boulder.VolcanicMine").attachBoulder(api);
  },
};
