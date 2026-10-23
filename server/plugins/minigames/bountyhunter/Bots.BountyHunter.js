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
 *     target and the bot runs across the arena to it (the engine's own Wilderness seek finds
 *     nothing here);
 *   - with no target they go rogue on the nearest player they may attack, bot or not;
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
const ROGUE_HOLD_MS = 2 * 60 * 1000; // the engine extends it while the fight goes on
const DECIDE_MS = 1800;
const ENGAGE_DISTANCE = 12; // closer than this, the engine's own combat pathing takes over
const CHASE_STEP = 20; // tiles per walk order towards a far quarry
const WANDER_RADIUS = 8;
const DESPAWN_AFTER_TICKS = 100; // a minute with no real player in the crater

let api;
let core;
let bh;

/** The live bot players. */
const bots = new Set();
const nextDecisionAt = new WeakMap();
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

function fighting(player) {
  const combat = player.getCombat();
  return alive(combat.getTarget?.()) || alive(combat.getAttacker?.());
}

function alive(mobile) {
  return Boolean(mobile) && mobile.isRegistered?.() !== false && mobile.getHitpoints() > 0;
}

function distance(a, b) {
  const p = a.getLocation();
  const q = b.getLocation();
  return Math.max(Math.abs(p.getX() - q.getX()), Math.abs(p.getY() - q.getY()));
}

/** Single-way arena: someone already fighting another player is not up for grabs. */
function engagedElsewhere(other, bot) {
  const combat = other.getCombat();
  return [combat.getTarget?.(), combat.getAttacker?.()].some((mobile) => mobile !== bot && alive(mobile));
}

function mayAttack(bot, other) {
  const method = core.CombatFactory.getMethod(bot);
  return core.CombatFactory.canAttackPermission(bot, other, false, method) === core.CanAttackResponse.CAN_ATTACK;
}

/** The nearest arena player the bot may attack and who is free: a rogue fight. */
function nearestRogueTarget(bot) {
  let best = null;
  for (const other of bh.arena) {
    if (other === bot || !alive(other) || engagedElsewhere(other, bot)) continue;
    if (best && distance(bot, other) >= distance(bot, best)) continue;
    if (mayAttack(bot, other)) best = other;
  }
  return best;
}

/** Its Bounty Hunter target when it has one in the arena, else a rogue fight. */
function quarryOf(bot) {
  const target = bh.targetOf(bot);
  return target && bh.inArena(target) && alive(target) ? target : nearestRogueTarget(bot);
}

/** One walk order up to CHASE_STEP tiles towards `to`; the engine's pathing does the last stretch. */
function chase(bot, to) {
  const from = bot.getLocation();
  const dx = to.getLocation().getX() - from.getX();
  const dy = to.getLocation().getY() - from.getY();
  const scale = Math.min(1, CHASE_STEP / Math.max(Math.abs(dx), Math.abs(dy), 1));
  bot.setRunning?.(true);
  core.PathFinder.calculateWalkRoute(bot, from.getX() + Math.round(dx * scale), from.getY() + Math.round(dy * scale));
}

function wander(bot) {
  const here = bot.getLocation();
  const x = here.getX() + core.Misc.random(WANDER_RADIUS * 2) - WANDER_RADIUS;
  const y = here.getY() + core.Misc.random(WANDER_RADIUS * 2) - WANDER_RADIUS;
  if (bh.isArenaTile({ x, y, z: 0 })) core.PathFinder.calculateWalkRoute(bot, x, y);
}

/**
 * Out of a fight: hand the quarry to the PvP engine and close the distance; the engine
 * attacks, specs, eats and switches once it is in reach.
 */
function hunt(bot, nowMs) {
  if (nowMs < (nextDecisionAt.get(bot) ?? 0) || fighting(bot)) return;
  nextDecisionAt.set(bot, nowMs + DECIDE_MS);
  const state = stateOf(bot);
  const quarry = quarryOf(bot);
  if (!state?.pvp || !quarry) {
    if (bot.getMovementQueue().size() === 0) wander(bot);
    return;
  }
  if (state.pvp.targetPlayer !== quarry) {
    const hold = bh.targetOf(bot) === quarry ? TARGET_HOLD_MS : ROGUE_HOLD_MS;
    setModePvp(bot, state, quarry, nowMs, hold, getActiveBotRuntime().behaviorMode, { allowInCombatTransition: true });
  }
  if (distance(bot, quarry) > ENGAGE_DISTANCE) chase(bot, quarry);
}

/** Where the bot stands, not area membership: bots are area-processed every third tick. */
function onCraterTile(bot) {
  const location = bot.getLocation();
  return bh.isArenaTile(location) || bh.isLobbyTile(location);
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
    if (!onCraterTile(player)) player.moveTo(Entry.spawnTile());
    else if (bh.inArena(player)) hunt(player, nowMs);
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
