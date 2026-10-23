"use strict";

/**
 * Risk skulls (https://oldschool.runescape.wiki/w/Bounty_Hunter#Skulls): in Daimon's Crater every
 * player wears a skull for what they would lose on death - bronze up to 200,000 coins, iron to
 * 800,000, green to 2,000,000, blue to 8,000,000, red above - with golden eyes while skulled.
 * Like live, untradeables are not counted (the Wiki's bug note). Sprites from cache sprite group
 * headicons_pk: 21-25 plain, 28-32 golden-eyed (bronze, iron, green, blue, red).
 */

const { CRATER } = require("./Fort.BountyHunter");

const PLAIN_SKULLS = 21;
const GOLDEN_SKULLS = 28;
const TIER_LIMITS = [200_000, 800_000, 2_000_000, 8_000_000];
const KEPT_UNSKULLED = 3;
// ponytail: a sweep every 2 ticks over crater players; hook inventory/equipment changes if it shows up in ::pluginperf.
const SWEEP_TICKS = 2;

let core;
let pluginApi;
const inCrater = new Set();

/** Coins lost on death: tradeables minus the most valuable kept items (ItemsKeptOnDeath's rules). */
function riskOf(player) {
  const items = [];
  for (const item of [...player.getInventory().getItems(), ...player.getEquipment().getItems()]) {
    if (!item || item.getId() <= 0 || item.getAmount() <= 0 || !item.isTradeable()) continue;
    if (pluginApi.emitShouldKeepItemOnDeath(player, item) === true) continue;
    items.push({ value: Math.max(0, Number(item.getDefinition().getValue()) || 0), amount: item.getAmount() });
  }
  items.sort((a, b) => b.value - a.value);
  let keep = keptOnDeath(player);
  let risk = 0;
  for (const { value, amount } of items) {
    const kept = Math.min(keep, amount);
    keep -= kept;
    risk += value * (amount - kept);
  }
  return Math.min(risk, Number.MAX_SAFE_INTEGER);
}

function keptOnDeath(player) {
  const skulled = player.isSkulled();
  if (skulled && player.getSkullType() === core.SkullType.RED_SKULL) return 0;
  const prayers = pluginApi.getPrayerHandler();
  return (skulled ? 0 : KEPT_UNSKULLED) + (prayers.isActivated(player, prayers.PROTECT_ITEM) ? 1 : 0);
}

function skullIcon(risk, skulled) {
  const tier = TIER_LIMITS.findIndex((limit) => risk <= limit);
  return (skulled ? GOLDEN_SKULLS : PLAIN_SKULLS) + (tier === -1 ? TIER_LIMITS.length : tier);
}

function showSkull(player) {
  player.setSkullIconOverride(skullIcon(riskOf(player), player.isSkulled()), true);
}

/** "bounty-hunter:risk" query: fills `value` with what the player would lose on death. */
function answerRisk(event) {
  event.value = riskOf(event.player);
}

function enterCrater({ player }) {
  inCrater.add(player);
  showSkull(player);
}

function leaveCrater({ player }) {
  inCrater.delete(player);
  player.setSkullIconOverride(null);
}

function forget({ player }) {
  inCrater.delete(player);
}

function sweep() {
  for (const player of inCrater) {
    if (player.isRegistered?.() === false) inCrater.delete(player);
    else showSkull(player);
  }
}

function startSweep() {
  core.TaskManager.submit(new (class extends core.Task {
    constructor() {
      super(SWEEP_TICKS, false);
    }

    execute() {
      sweep();
    }
  })());
}

module.exports = function attachRiskSkulls(api) {
  core = api.core;
  pluginApi = api;
  api.onZoneEnter(CRATER, enterCrater);
  api.onZoneExit(CRATER, leaveCrater);
  api.onPlayerLogout(forget);
  api.onServerStartup(startSweep);
  api.onCustomEvent("bounty-hunter:risk", answerRisk);
};

Object.assign(module.exports, { _test: { riskOf, skullIcon, keptOnDeath, enterCrater, leaveCrater, sweep, inCrater } });
