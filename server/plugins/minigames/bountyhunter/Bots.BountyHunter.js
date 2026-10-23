"use strict";

/**
 * Bounty Hunter bots. A real player arriving in an empty crater is asked which bots should
 * populate it (Novice / Intermediate / Veteran / None, as in Castle Wars). The bots are the
 * PlayerBots runtime's own PvP bots on its "pvp" brain activity, so they fight exactly as
 * they do in the Wilderness (specs, switches, prayers, freezes, eating, retaliation); this
 * unit only adds what Bounty Hunter needs on top:
 *
 *   - gear and profile from the chosen tier, at combat levels the player can be matched with;
 *   - the crater's matchmaking picks their fights: an assigned target becomes the bot's PvP
 *     target, a cleared one is dropped (the engine's own Wilderness seek finds nothing here);
 *   - with no target they roam the arena;
 *   - they respawn at their sigil (the runtime's respawn resolver keeps the spawn tile) and
 *     log out a minute after the last real player leaves the crater.
 */

const { getActiveBotRuntime } = require("../../bots/runtime/RuntimeRegistry.PlayerBots");
const { startActivity } = require("../../bots/brain/BrainActivities.PlayerBots");
const { setModePvp } = require("../../bots/behaviours/state/State.PlayerBots");
const { buildRoamingPvpMetadata } = require("../../bots/behaviours/pvp/PvpAssignment.PlayerBots");
const { applyGeneratedPvpLoadout } = require("../../bots/behaviours/policies/PvpLoadoutPolicy.PlayerBots");
const { TIER_OPTIONS, TIER_PROFILE_IDS, TIER_BANDS, pickTierChoice } = require("../../bots/behaviours/pvp/PvpTierLoadouts.PlayerBots");
const Targets = require("./Targets.BountyHunter");
const Entry = require("./Entry.BountyHunter");

const BOT_COUNT = 12;
const BOT_ATTRIBUTE = "bounty-hunter:bot";
const PVP_ACTIVITY = "pvp";
const TARGET_HOLD_MS = 30 * 60 * 1000; // the target is the crater's to clear, not the engine's timer
const WANDER_RADIUS = 8;
const WANDER_MIN_MS = 6000;
const WANDER_JITTER_MS = 10000;
const DESPAWN_AFTER_TICKS = 100; // a minute with no real player in the crater

let api;
let core;
let bh;

/** The live bot players. */
const bots = new Set();
const nextWanderAt = new WeakMap();
let emptyTicks = 0;

function isBot(player) {
  return player?.getAttribute?.(BOT_ATTRIBUTE) === true;
}

function stateOf(player) {
  return getActiveBotRuntime().runtime?.botStatesByName?.get(player.getUsername()) ?? null;
}

function realPlayersInCrater() {
  return [...bh.lobby, ...bh.arena].filter((player) => !isBot(player));
}

// --- Population ----------------------------------------------------------------------------

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

/** The tier's profile and loadout replace the runtime's random pick, then the bot regears. */
function applyTier(bot, state, tier, band, index) {
  const choice = pickTierChoice(tier, { index, band });
  Object.assign(state.pvp, buildRoamingPvpMetadata({
    excludeF2p: false,
    config: choice
      ? { pvp: { loadoutWeights: [{ value: choice.loadoutId, weight: 1 }], profileWeights: [{ value: TIER_PROFILE_IDS[tier], weight: 1 }] } }
      : {},
  }), {
    combatLevelRange: band,
    generatedArchetypeId: choice?.archetypeId ?? null,
  });
  applyGeneratedPvpLoadout(bot, state, { api });
}

function spawnBot(runtime, behaviorMode, index, tier, band) {
  const spawn = Entry.spawnTile();
  const bot = runtime.spawnPvpBot(spawn, { username: `BHBot${index + 1}`, mode: behaviorMode.PVP });
  const state = bot && stateOf(bot);
  if (!state?.pvp) return;
  bot.setAttribute(BOT_ATTRIBUTE, true);
  applyTier(bot, state, tier, band, index);
  startActivity(bot, PVP_ACTIVITY, { home: { x: spawn.getX(), y: spawn.getY(), z: spawn.getZ() } });
  bots.add(bot);
}

function populate(player, tier) {
  const { runtime, behaviorMode } = getActiveBotRuntime();
  if (!runtime) {
    player.sendMessage("Bots are unavailable on this world.");
    return;
  }
  const band = botLevelBand(player, tier);
  for (let index = 0; index < BOT_COUNT; index++) spawnBot(runtime, behaviorMode, index, tier, band);
}

/** A real player arriving in an empty crater picks the bots, or None. */
function offerBots({ player }) {
  if (isBot(player) || bots.size > 0 || realPlayersInCrater().some((other) => other !== player)) return;
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
}

// --- Bounty Hunter on top of the PvP brain -------------------------------------------------

/** The crater's matchmaking gave a bot its target: that is the bot's next fight. */
function huntTarget({ player, target }) {
  if (!isBot(player)) return;
  const state = stateOf(player);
  if (!state?.pvp) return;
  const { behaviorMode } = getActiveBotRuntime();
  setModePvp(player, state, target, Date.now(), TARGET_HOLD_MS, behaviorMode, { allowInCombatTransition: true });
}

/** Target gone: drop it; the engine's validation resets the bot to seeking next tick. */
function dropTarget({ player }) {
  if (!isBot(player)) return;
  const pvp = stateOf(player)?.pvp;
  if (!pvp) return;
  pvp.targetUsername = null;
  pvp.targetPlayer = null;
}

function idle(player) {
  const combat = player.getCombat();
  return !combat.getTarget?.() && !combat.getAttacker?.() && !bh.targetOf(player) &&
    player.getMovementQueue().size() === 0;
}

/** The PvP engine only roams the Wilderness; a bot with no target roams the arena instead. */
function wander(player, nowMs) {
  if (nowMs < (nextWanderAt.get(player) ?? 0) || !idle(player)) return;
  nextWanderAt.set(player, nowMs + WANDER_MIN_MS + Math.floor(Math.random() * WANDER_JITTER_MS));
  const here = player.getLocation();
  const x = here.getX() + core.Misc.random(WANDER_RADIUS * 2) - WANDER_RADIUS;
  const y = here.getY() + core.Misc.random(WANDER_RADIUS * 2) - WANDER_RADIUS;
  if (bh.isArenaTile({ x, y, z: 0 })) core.PathFinder.calculateWalkRoute(player, x, y);
}

function tick() {
  if (bots.size === 0) return;
  emptyTicks = realPlayersInCrater().length > 0 ? 0 : emptyTicks + 1;
  if (emptyTicks >= DESPAWN_AFTER_TICKS) {
    emptyTicks = 0;
    despawnAll();
    return;
  }
  const nowMs = Date.now();
  for (const player of bots) {
    if (player.getHitpoints() <= 0 || player.isDyingReturn?.() === true) continue;
    if (!bh.inCrater(player)) player.moveTo(Entry.spawnTile());
    else if (bh.inArena(player)) wander(player, nowMs);
  }
}

function forgetBot({ player }) {
  bots.delete(player);
}

function startTask() {
  const task = new core.Task(1);
  task.execute = tick;
  api.getTaskManager?.()?.submit?.(task);
}

module.exports = function attachBots(pluginApi, state) {
  api = pluginApi;
  core = pluginApi.core;
  bh = state;
  api.onCustomEvent("bounty-hunter:entered-lobby", offerBots);
  api.onCustomEvent("bounty-hunter:target-assigned", huntTarget);
  api.onCustomEvent("bounty-hunter:target-cleared", dropTarget);
  api.onPlayerLogout(forgetBot);
  api.onServerStartup(startTask);
};

Object.assign(module.exports, { _test: { botLevelBand, offerBots, huntTarget, dropTarget, BOT_COUNT } });
