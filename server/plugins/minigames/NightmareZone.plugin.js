/**
 * Nightmare Zone (https://oldschool.runescape.wiki/w/Nightmare_Zone), built from rsprox recordings
 * of the lobby (234/03279) and a dream's start (224/01512) and the Wiki for the fights
 * (plugins/minigames/data/nightmare-zone.json). The units are in ./nightmarezone/:
 * - Dominic: his talk, the dream menus and prices, cancelling;
 * - Coffer: Dominic's coffer (deposit, withdraw) and the barrels' Check;
 * - Dream: the enclosure, the vial, the dream's arena, bosses, points and waking up.
 */
const Common = require("./nightmarezone/Common.NightmareZone");
const Dominic = require("./nightmarezone/Dominic.NightmareZone");
const Coffer = require("./nightmarezone/Coffer.NightmareZone");
const Dream = require("./nightmarezone/Dream.NightmareZone");

module.exports = {
  name: "Nightmare Zone",
  members: true,
  register(api) {
    Common.init(api);
    Dominic.attachDominic(api);
    Coffer.attachCoffer(api);
    Dream.attachDream(api);
  },
};
