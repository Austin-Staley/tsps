/**
 * Herblore (https://oldschool.runescape.wiki/w/Herblore): cleaning grimy herbs, mixing potions
 * and grinding secondaries with a pestle and mortar, from plugins/skills/data/herblore.json and rsprox captures. See docs/herblore.md.
 *
 * Other plugins ask through custom events:
 *   api.emitCustomEvent("herblore:unfinished", { herbId, potion: null })
 *     -> sets `potion` to the unfinished potion a clean herb makes with a vial of water (Zahur).
 */
const Common = require("./herblore/Common.Herblore");

module.exports = {
  name: "Herblore",
  members: true,
  register(api) {
    Common.init(api);
    api.onCustomEvent("herblore:unfinished", Common.answerUnfinished);
    require("./herblore/Cleaning.Herblore")(api);
    require("./herblore/Mixing.Herblore")(api);
    require("./herblore/Grinding.Herblore")(api);
  },
};
