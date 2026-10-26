"use strict";

/**
 * The lobby scoreboard (soul_wars_scoreboard, "Scoreboard": View), interface soul_wars_stats.
 *
 * Wiki (Scoreboard (Soul Wars)): "See your scores here." It shows stats from the reader's own
 * games and the minigame's global ones: games played, players killed and Avatars killed. The
 * interface is one text box (soul_wars_stats:scroll_text) that no cache script fills, so the
 * server writes it. The reader's lines are the game's own lifetime counters (Stats.SoulWars.js:
 * soul_wars_total_games / _wins / _kills / _deaths). The world's are counted here: a real game
 * when it ends (both sides had players, as its Zeal needs), each enemy player killed
 * (Death.SoulWars.js) and each Avatar killed (Avatars.SoulWars.js), and kept in
 * data/saves/soul-wars-scoreboard.json.
 */

const fs = require("node:fs");
const path = require("node:path");
const Common = require("./Common.SoulWars");
const Match = require("./Match.SoulWars");

const SCOREBOARD_LOC = "soul_wars_scoreboard";
const INTERFACE_NAME = "soul_wars_stats";
const TEXT_COMPONENT = "soul_wars_stats:scroll_text";

let FILE = path.join(process.cwd(), "data", "saves", "soul-wars-scoreboard.json");
let world = null;

const count = (value) => (Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0);
const number = (value) => count(value).toLocaleString("en-US");

function records() {
  if (world) return world;
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    saved = null;
  }
  world = { games: count(saved?.games), playersKilled: count(saved?.playersKilled), avatarsKilled: count(saved?.avatarsKilled) };
  return world;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(records()));
    fs.renameSync(`${FILE}.tmp`, FILE);
  } catch (error) {
    console.warn(`[soul-wars] scoreboard could not be saved: ${error.message}`);
  }
}

function bump(key) {
  records()[key]++;
  save();
}

/** An enemy player killed in a game (Death.SoulWars.js). */
function playerKilled() {
  bump("playersKilled");
}

/** An Avatar killed (Avatars.SoulWars.js). */
function avatarKilled() {
  bump("avatarsKilled");
}

/** A game ended: it counts when both sides started with players, as Match.finish pays Zeal. */
function gameEnded(game) {
  if (!(game?.starters?.blue > 0 && game?.starters?.red > 0)) return;
  bump("games");
}

function text(player) {
  const totals = records();
  return [
    "Your Soul Wars statistics",
    `Games played: ${number(Common.getVarp(player, "total_games"))}`,
    `Games won: ${number(Common.getVarp(player, "total_wins"))}`,
    `Players killed: ${number(Common.getVarp(player, "total_kills"))}`,
    `Deaths: ${number(Common.getVarp(player, "total_deaths"))}`,
    "",
    "Global statistics",
    `Games played: ${number(totals.games)}`,
    `Players killed: ${number(totals.playersKilled)}`,
    `Avatars killed: ${number(totals.avatarsKilled)}`,
  ].join("<br>");
}

function view(event) {
  if (event.objectId !== Common.core.CacheDefinitions.getLocId(SCOREBOARD_LOC)) return false;
  const sender = event.player.getPacketSender();
  sender.sendInterface(Common.core.CacheDefinitions.getInterfaceId(INTERFACE_NAME));
  sender.sendString(text(event.player), Common.component(TEXT_COMPONENT));
  return true;
}

function attachScoreboard(api) {
  Match.onEnd(gameEnded);
  api.onObjectInteraction("Scoreboard", { View: view });
}

module.exports = {
  attachScoreboard, playerKilled, avatarKilled, gameEnded, view, text,
  SCOREBOARD_LOC, INTERFACE_NAME, TEXT_COMPONENT,
  /** Tests: read and write the world's records at `file` instead, from scratch. */
  _useFile(file) { FILE = file; world = null; },
};
