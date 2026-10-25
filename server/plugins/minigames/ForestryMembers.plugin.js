/**
 * Forestry's members events (https://oldschool.runescape.wiki/w/Forestry), as rsprox records them
 * (plugins/minigames/data/forestry.json). They join the free-to-play ones in Forestry.plugin.js's
 * event table, on members worlds only:
 * - Pheasant: Pheasant Control;
 * - Poachers: the frightened fox;
 * - Ritual: the Enchantment Ritual.
 */
const Pheasant = require("./forestry/Pheasant.Forestry");
const Poachers = require("./forestry/Poachers.Forestry");
const Ritual = require("./forestry/Ritual.Forestry");

module.exports = {
  name: "Forestry (members)",
  members: true,
  register(api) {
    Pheasant.attachPheasant(api);
    Poachers.attachPoachers(api);
    Ritual.attachRitual(api);
  },
};
