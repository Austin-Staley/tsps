"use strict";

/**
 * The Sisterhood Sanctuary's two scoreboards, both interface nightmare_scoreboard:
 * - nightmare_scoreboard, slightly before the lair: The Nightmare's.
 * - nightmare_challenge_scoreboard, by Sister Senga: Phosani's Nightmare's.
 *
 * rsprox 231/00392 (Phosani's board): Read opens nightmare_scoreboard with the title "Phosani's
 * Nightmare Statistics" (title_text), then the player's kill count (ms2), deaths (ms4) and best
 * time (ms6), and the world's kill count (ms8), deaths (ms10) and best time (ms12): "10", "0",
 * "7:51.00", "24,494,091", "4,277,498", "4:06.00". The cache labels the odd rows (Personal
 * Killcount ... Global Best Time) and titles the interface "The Nightmare Statistics", the title
 * the Nightmare's own board keeps (Wiki, Scoreboard (The Nightmare): total kills, deaths and the
 * global best time). The kills and best times are the kill messages' own (Fight.Nightmare.js); a
 * death counts when it wakes the player by the Pool (Dream.Nightmare.js).
 *
 * rsprox 234/03284 writes "3:45" and "-" for the world rows (an event world, it seems); the
 * Wiki's figures and 231/00392 show the world's numbers and m:ss.cc times, which this follows.
 */

const fs = require("node:fs");
const path = require("node:path");
const Common = require("./Common.Nightmare");

/** Cache names: each board's loc, with its title and the version's own attributes. */
const BOARDS = {
  nightmare: {
    loc: "nightmare_scoreboard", title: "The Nightmare Statistics",
    kills: Common.KILLS_ATTRIBUTE, best: Common.BEST_ATTRIBUTE, deaths: "nightmare:deaths",
  },
  phosani: {
    loc: "nightmare_challenge_scoreboard", title: "Phosani's Nightmare Statistics",
    kills: Common.PHOSANI_KILLS_ATTRIBUTE, best: Common.PHOSANI_BEST_ATTRIBUTE, deaths: "nightmare:phosani-deaths",
  },
};
const DEATHS_ATTRIBUTE = BOARDS.nightmare.deaths;
const PHOSANI_DEATHS_ATTRIBUTE = BOARDS.phosani.deaths;
const INTERFACE_NAME = "nightmare_scoreboard";
const COMPONENT = {
  title: "title_text", kills: "ms2", deaths: "ms4", best: "ms6",
  worldKills: "ms8", worldDeaths: "ms10", worldBest: "ms12",
};

let FILE = path.join(process.cwd(), "data", "saves", "nightmare-scoreboard.json");
let world = null;

const count = (value) => (Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0);
const cache = () => Common.core.CacheDefinitions;
const uid = (component) => cache().getComponentId(`${INTERFACE_NAME}:${component}`);
const versionOf = (phosani) => (phosani ? "phosani" : "nightmare");

function records() {
  if (world) return world;
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    saved = null;
  }
  world = {};
  for (const version of Object.keys(BOARDS)) {
    const entry = saved?.[version];
    world[version] = { kills: count(entry?.kills), deaths: count(entry?.deaths), bestTicks: count(entry?.bestTicks) };
  }
  return world;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(records()));
    fs.renameSync(`${FILE}.tmp`, FILE);
  } catch (error) {
    console.warn(`[nightmare] scoreboard could not be saved: ${error.message}`);
  }
}

/** A player's kill in `ticks`, from Fight.Nightmare.js once it has counted their own. */
function won(phosani, ticks) {
  const totals = records()[versionOf(phosani)];
  totals.kills++;
  const time = count(ticks);
  if (time && (!totals.bestTicks || time < totals.bestTicks)) totals.bestTicks = time;
  save();
}

/** A death in a dream, from Dream.Nightmare.js. */
function died(player, phosani) {
  const version = versionOf(phosani);
  const key = BOARDS[version].deaths;
  player.setAttribute(key, Common.count(player, key) + 1);
  records()[version].deaths++;
  save();
}

const number = (value) => count(value).toLocaleString("en-US");

/** m:ss.cc, as the board shows times (rsprox 231/00392); "-" with none. */
function formatTicks(ticks) {
  const centis = count(ticks) * 60;
  if (!centis) return "-";
  const minutes = Math.floor(centis / 6000);
  const seconds = Math.floor((centis % 6000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centis % 100).padStart(2, "0")}`;
}

function lines(player, version) {
  const board = BOARDS[version];
  const totals = records()[version];
  return new Map([
    [COMPONENT.title, board.title],
    [COMPONENT.kills, number(player.getAttribute(board.kills))],
    [COMPONENT.deaths, number(player.getAttribute(board.deaths))],
    [COMPONENT.best, formatTicks(player.getAttribute(board.best))],
    [COMPONENT.worldKills, number(totals.kills)],
    [COMPONENT.worldDeaths, number(totals.deaths)],
    [COMPONENT.worldBest, formatTicks(totals.bestTicks)],
  ]);
}

/** "Scoreboard" is many bosses' name: only these two locs are ours. */
function read(event) {
  const version = Object.keys(BOARDS).find((key) => cache().getLocId(BOARDS[key].loc) === event.objectId);
  if (!version) return false;
  const sender = event.player.getPacketSender();
  sender.sendInterface(cache().getInterfaceId(INTERFACE_NAME));
  for (const [component, text] of lines(event.player, version)) sender.sendString(text, uid(component));
  return true;
}

function attachScoreboard(api) {
  api.persistAttribute(DEATHS_ATTRIBUTE, 0);
  api.persistAttribute(PHOSANI_DEATHS_ATTRIBUTE, 0);
  api.onObjectInteraction("Scoreboard", { Read: read });
}

module.exports = {
  attachScoreboard, won, died, read, lines, formatTicks,
  BOARDS, INTERFACE_NAME, COMPONENT, DEATHS_ATTRIBUTE, PHOSANI_DEATHS_ATTRIBUTE,
  /** Tests: read and write the world records at `file` instead, from scratch. */
  _useFile(file) { FILE = file; world = null; },
};
