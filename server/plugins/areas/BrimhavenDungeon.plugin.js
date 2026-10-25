/**
 * The Brimhaven Dungeon's way in: Saniboch's entry fee and the dungeon entrance.
 *
 * - The entry: Entry.BrimhavenDungeon.js (Saniboch's Talk-to conditions and payments, his Pay
 *   option and the entrance's, and Enter).
 *
 * The exit is a loc teleport (plugins/world/data/loc-teleports.json, karam_dungeon_exit).
 */
const Entry = require("./brimhavendungeon/Entry.BrimhavenDungeon");

module.exports = {
  name: "BrimhavenDungeon",
  members: true,
  _test: { Entry },
  register(api) {
    Entry.attach(api);
  },
};
