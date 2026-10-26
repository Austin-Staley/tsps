"use strict";

/**
 * The Emir's Arena scoreboards (pvpa_scoreboard, "Scoreboard": View), interface
 * pvp_arena_scoreboard. Wiki (Scoreboard (Emir's Arena)): "Records how many fights you've been
 * in"; away from the PvP Arena world it shows the reader's Legacy Duels record. This server has
 * the legacy duels only (DuelArena.plugin.js), so the board shows those: a duel fought to a
 * finish counts a win for one player and a loss for the other. A duel declined before the fight,
 * or one that ends with nobody beaten, counts for neither.
 *
 * Not from a recording or the Wiki: the board's wording. The cache's onLoad writes the title
 * ("Arena Scoreboard"); the text line under it is the server's, "Legacy Duels", then the wins
 * and losses.
 */

const SCOREBOARD_LOC = "pvpa_scoreboard";
const INTERFACE_NAME = "pvp_arena_scoreboard";
const TEXT_COMPONENT = "text";
const WINS_ATTRIBUTE = "duel-arena:legacy-wins";
const LOSSES_ATTRIBUTE = "duel-arena:legacy-losses";

let cache = null;

const count = (value) => (Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0);
const number = (value) => count(value).toLocaleString("en-US");

function bump(player, attribute) {
  player.setAttribute(attribute, count(player.getAttribute(attribute)) + 1);
}

/** A legacy duel fought to a finish, from DuelArena.plugin.js's duelarena:duel-won event. */
function duelWon({ winner, loser }) {
  if (!winner || !loser || winner === loser) return;
  bump(winner, WINS_ATTRIBUTE);
  bump(loser, LOSSES_ATTRIBUTE);
}

function text(player) {
  return `Legacy Duels<br><br>Wins: ${number(player.getAttribute(WINS_ATTRIBUTE))}<br>Losses: ${number(player.getAttribute(LOSSES_ATTRIBUTE))}`;
}

/** "Scoreboard" is many places' name: only this loc is ours. */
function view(event) {
  if (event.objectId !== cache.getLocId(SCOREBOARD_LOC)) return false;
  const sender = event.player.getPacketSender();
  sender.sendInterface(cache.getInterfaceId(INTERFACE_NAME));
  sender.sendString(text(event.player), cache.getComponentId(`${INTERFACE_NAME}:${TEXT_COMPONENT}`));
  return true;
}

function attach(api) {
  cache = api.core.CacheDefinitions;
  api.persistAttribute(WINS_ATTRIBUTE, 0);
  api.persistAttribute(LOSSES_ATTRIBUTE, 0);
  api.onCustomEvent("duelarena:duel-won", duelWon);
  api.onObjectInteraction("Scoreboard", { View: view });
}

module.exports = { attach, duelWon, view, text, SCOREBOARD_LOC, INTERFACE_NAME, WINS_ATTRIBUTE, LOSSES_ATTRIBUTE };
