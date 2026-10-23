"use strict";

/**
 * Bounty Hunter bots. A real player arriving in an empty crater is asked which bots should
 * populate it (Novice / Intermediate / Veteran / None, as in Castle Wars). The bots spawn at
 * the arena sigils, geared from the PvP presets at combat levels the player can be matched
 * with, and the crater's own matchmaking hands out their targets. Each bot then:
 *
 *   - eats when low (the PvP bots' eat node, at the tier profile's threshold);
 *   - keeps a fight going, else hunts its Bounty Hunter target;
 *   - otherwise roams the arena near where it stands.
 *
 * A bot that dies respawns outside like anyone else and is put back at a sigil, regeared.
 * Once no real player has been in the crater for a minute, the bots log out.
 */

const { ActionNode, BotController, SelectorNode } = require("../../../src/main/typescript/elvarg/game/bot/BehaviorTree");
const { createBotPlayer } = require("../../bots/behaviours/spawn/PlayerFactory.PlayerBots");
const { ATTR_SKIP_PERSISTENCE } = require("../../bots/runtime/PersistenceConstants.PlayerBots");
const { buildRoamingPvpMetadata } = require("../../bots/behaviours/pvp/PvpAssignment.PlayerBots");
const { applyGeneratedPvpLoadout } = require("../../bots/behaviours/policies/PvpLoadoutPolicy.PlayerBots");
const { EatFoodActionNode } = require("../../bots/behaviours/nodes/actions/EatFoodActionNode.PlayerBots");
const { TIER_OPTIONS, TIER_PROFILE_IDS, TIER_BANDS, pickTierChoice } = require("../../bots/behaviours/pvp/PvpTierLoadouts.PlayerBots");
const Targets = require("./Targets.BountyHunter");
const Entry = require("./Entry.BountyHunter");

const BOT_COUNT = 12;
const BOT_ATTRIBUTE = "bounty-hunter:bot";
const LOADOUT_RETRY_MS = 5000;
const WANDER_RADIUS = 8;
const WANDER_MIN_MS = 6000;
const WANDER_JITTER_MS = 10000;
const DESPAWN_AFTER_TICKS = 100; // a minute with no real player in the crater

let api;
let core;
let bh;

/** username -> bot state; the shape EatFoodActionNode reads ({ mode, pvp: { profileId, loadoutId } }). */
const botStates = new Map();
/** The live bot players. */
const bots = new Set();
const controllers = new Map();
let eatNode;
let emptyTicks = 0;

// --- Population ----------------------------------------------------------------------------

function isBot(player) {
  return player.getAttribute(BOT_ATTRIBUTE) === true;
}

function realPlayersInCrater() {
  return [...bh.lobby, ...bh.arena].filter((player) => !isBot(player));
}

/**
 * The levels a bot can be matched with `player` at: the player's own range (15 below to their
 * band above), and the bot's default band of 5 means it must be at most 5 below the player.
 * Inside that, the tier's band when they overlap; a Veteran crater for a level 60 player
 * keeps the levels and takes the tier's behaviour profile only.
 */
function botLevelBand(player, tier) {
  const level = player.getSkillManager().getCombatLevel();
  const match = { min: Math.max(3, level - 5), max: Math.min(126, level + Targets.bandOf(player)) };
  const tierBand = TIER_BANDS[tier];
  const min = Math.max(match.min, tierBand.min);
  const max = Math.min(match.max, tierBand.max);
  return min <= max ? { min, max } : match;
}

function spawnBot(index, tier, band) {
  const username = `BHBot${index + 1}`;
  if (botStates.has(username)) return;
  const bot = createBotPlayer(username, Entry.spawnTile(), { api, loadPersistence: false, saveRandomizedAppearance: false });
  if (!bot) return;
  bot.setPlayerBot(true);
  bot.setAttribute(ATTR_SKIP_PERSISTENCE, true);
  bot.setAttribute(BOT_ATTRIBUTE, true);
  const choice = pickTierChoice(tier, { index, band });
  botStates.set(username, {
    mode: "pvp",
    tier,
    band,
    choice,
    equipped: false,
    nextLoadoutAt: Date.now() + Math.floor(Math.random() * 1500),
    nextWanderAt: 0,
    pvp: {},
  });
  bots.add(bot);
  api.emitPlayerLogin({ player: bot, username });
}

function populate(player, tier) {
  const band = botLevelBand(player, tier);
  for (let index = 0; index < BOT_COUNT; index++) spawnBot(index, tier, band);
}

/** A real player arriving in an empty crater picks the bots, or None. */
function offerBots({ player }) {
  if (isBot(player) || botStates.size > 0 || realPlayersInCrater().some((other) => other !== player)) return;
  const options = TIER_OPTIONS.flatMap(([label, tier]) => [label, () => populate(player, tier)]);
  api.sendMultiChatboxPrompt(player, "The Bounty Hunter crater is empty. Which bots should populate it?",
    ...options,
    "None", () => {});
}

function despawnAll() {
  for (const player of bots) {
    player.getForcedLogoutTimer().start(0);
    player.requestLogout();
  }
  bots.clear();
  botStates.clear();
  controllers.clear();
}

// --- Behaviour -----------------------------------------------------------------------------

function ensureLoadout(player, state, nowMs) {
  if (state.equipped || nowMs < state.nextLoadoutAt) return;
  state.nextLoadoutAt = nowMs + LOADOUT_RETRY_MS;
  const { choice, tier, band } = state;
  state.pvp = {
    ...buildRoamingPvpMetadata({
      excludeF2p: false,
      config: choice
        ? { pvp: { loadoutWeights: [{ value: choice.loadoutId, weight: 1 }], profileWeights: [{ value: TIER_PROFILE_IDS[tier], weight: 1 }] } }
        : {},
    }),
    combatLevelRange: band,
    ...(choice ? { generatedArchetypeId: choice.archetypeId } : {}),
  };
  state.equipped = applyGeneratedPvpLoadout(player, state, { api }) === true;
}

function alive(mobile) {
  return Boolean(mobile) && mobile.isRegistered?.() !== false && mobile.getHitpoints() > 0;
}

/** Keep the current fight, else go for the Bounty Hunter target. */
function fight({ player }) {
  const combat = player.getCombat();
  if (alive(combat.getTarget?.()) || alive(combat.getAttacker?.())) return "running";
  const target = bh.targetOf(player);
  if (!alive(target) || !bh.inArena(target)) return "failure";
  const method = core.CombatFactory.getMethod(player);
  if (core.CombatFactory.canAttackPermission(player, target, false, method) !== core.CanAttackResponse.CAN_ATTACK) {
    return "failure";
  }
  combat.attack(target);
  return "running";
}

/** Drift to a random arena tile nearby now and then. */
function wander({ player, nowMs }) {
  const state = botStates.get(player.getUsername());
  if (nowMs < state.nextWanderAt || player.getMovementQueue().size() > 0) return "running";
  state.nextWanderAt = nowMs + WANDER_MIN_MS + Math.floor(Math.random() * WANDER_JITTER_MS);
  const here = player.getLocation();
  const x = here.getX() + core.Misc.random(WANDER_RADIUS * 2) - WANDER_RADIUS;
  const y = here.getY() + core.Misc.random(WANDER_RADIUS * 2) - WANDER_RADIUS;
  if (bh.isArenaTile({ x, y, z: 0 })) core.PathFinder.calculateWalkRoute(player, x, y);
  return "running";
}

function controllerFor(player) {
  let controller = controllers.get(player);
  if (!controller) {
    const at = player.getLocation();
    controller = new BotController(player, at.getX(), at.getY(), at.getZ(), new SelectorNode([
      eatNode,
      new ActionNode(fight),
      new ActionNode(wander),
    ]));
    controllers.set(player, controller);
  }
  return controller;
}

function processBot(player, nowMs) {
  const state = botStates.get(player.getUsername());
  if (!state || player.getHitpoints() <= 0) {
    if (state) state.equipped = false; // death strips the gear: regear on respawn
    return;
  }
  if (!bh.inCrater(player)) {
    // Respawned outside after a death: back to a sigil.
    player.moveTo(Entry.spawnTile());
    return;
  }
  ensureLoadout(player, state, nowMs);
  controllerFor(player).tick(nowMs);
}

function tick() {
  if (botStates.size === 0) return;
  emptyTicks = realPlayersInCrater().length > 0 ? 0 : emptyTicks + 1;
  if (emptyTicks >= DESPAWN_AFTER_TICKS) {
    emptyTicks = 0;
    despawnAll();
    return;
  }
  const nowMs = Date.now();
  for (const player of bots) processBot(player, nowMs);
}

function forgetBot({ player }) {
  if (!isBot(player)) return;
  bots.delete(player);
  botStates.delete(player.getUsername());
  controllers.delete(player);
}

function startTask() {
  // A dedicated task: the world strides idle player bots, far too slowly for a fight.
  const task = new core.Task(1);
  task.execute = tick;
  api.getTaskManager?.()?.submit?.(task);
}

module.exports = function attachBots(pluginApi, state) {
  api = pluginApi;
  core = pluginApi.core;
  bh = state;
  eatNode = new EatFoodActionNode(botStates, api);
  api.onCustomEvent("bounty-hunter:entered-lobby", offerBots);
  api.onPlayerLogout(forgetBot);
  api.onServerStartup(startTask);
};

Object.assign(module.exports, { _test: { botLevelBand, offerBots, botStates, BOT_COUNT } });
