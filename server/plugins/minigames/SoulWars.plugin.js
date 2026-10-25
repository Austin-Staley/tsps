/**
 * Soul Wars (https://oldschool.runescape.wiki/w/Soul_Wars), built from rsprox recordings
 * (plugins/minigames/data/soul-wars.json). The units are in ./soulwars/:
 * - Lobby: the portals, the waiting area, the queue and countdown;
 * - Match: the instanced arena, teams, HUD, time, the end and Zeal;
 * - Death: graveyards, ghosts, barriers and who may fight whom;
 * - Avatars: strength, defeats and returns;
 * - Control: the obelisk and graveyards changing hands;
 * - Souls: Forgotten Souls, wolves, fragments and the obelisk;
 * - Supplies: the tables, potions, bandages, bones and the activity bar.
 */
const Common = require("./soulwars/Common.SoulWars");
const Lobby = require("./soulwars/Lobby.SoulWars");
const Death = require("./soulwars/Death.SoulWars");
const Avatars = require("./soulwars/Avatars.SoulWars");
const Control = require("./soulwars/Control.SoulWars");
const Souls = require("./soulwars/Souls.SoulWars");
const Supplies = require("./soulwars/Supplies.SoulWars");
const Stats = require("./soulwars/Stats.SoulWars");

module.exports = {
  name: "Soul Wars",
  members: true,
  register(api) {
    Common.init(api);
    Stats.attachStats(api);
    Lobby.attachLobby(api);
    Death.attachDeath(api);
    Avatars.attachAvatars(api);
    Control.attachControl(api);
    Souls.attachSouls(api);
    Supplies.attachSupplies(api);
  },
};
