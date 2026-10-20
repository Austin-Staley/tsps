/**
 * Fletching (docs/fletching.md): every recipe on the Wiki's Fletching page, from
 * data/fletching.json, with menus, messages and animations from rsprox captures.
 */
const Shared = require("./fletching/Shared.Fletching");

module.exports = {
  name: "Fletching",
  members: true,
  register(api) {
    Shared.init(api);
    require("./fletching/Recipes.Fletching")(api);
    require("./fletching/Spool.Fletching")(api);
    require("./fletching/Diaries.Fletching")(api);
  },
};
