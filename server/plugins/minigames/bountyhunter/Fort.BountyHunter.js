"use strict";

/**
 * Fort Daimon's facilities (https://oldschool.runescape.wiki/w/Daimon%27s_Crater):
 * - the two bank chests are plain "Bank chest" locs, already opened by BankBooths/GrandExchange;
 * - the Pools of Refreshment are the Ferox loc (39651), drunk by Pool.FeroxEnclave.js; the crater's
 *   also restore special attack energy (Pool_of_Refreshment, 24 May 2023 hotfix), answered here;
 * - the Emblem Trader and Corrupted Warriors stand where the Wiki maps them (data/npc-spawns.json).
 * The coffer is the Points unit's.
 */

const SPAWNS = require("./data/npc-spawns.json");

/** The crater island's map squares (52-54, 62-64): reached only through its portal. */
const CRATER = require("./data/crater.json").arena;

let core;
let pluginApi;

function inCrater(at) {
  const location = at?.getLocation?.() ?? at;
  if (!location) return false;
  const x = location.getX?.() ?? location.x;
  const y = location.getY?.() ?? location.y;
  return x >= CRATER.minX && x <= CRATER.maxX && y >= CRATER.minY && y <= CRATER.maxY;
}

function spawnNpcs() {
  for (const spawn of SPAWNS) {
    pluginApi.spawnNpc({ id: spawn.id, x: spawn.x, y: spawn.y, z: spawn.level, wanderRadius: spawn.wanderRadius });
  }
}

function restoreSpecialAttack(player) {
  player.setSpecialActivated?.(false);
  player.setRecoveringSpecialAttack?.(false);
  player.setSpecialPercentage(100);
  player.getSpecialAttackRestore?.().stop?.();
  core.CombatSpecial.updateBar(player);
}

/** Pool.FeroxEnclave.js has restored everything else by now. */
function poolDrunk({ player, object }) {
  if (inCrater(object ?? player)) restoreSpecialAttack(player);
}

module.exports = function attachFort(api) {
  core = api.core;
  pluginApi = api;
  api.onServerStartup(spawnNpcs);
  api.onCustomEvent("pool-of-refreshment:drunk", poolDrunk);
};

Object.assign(module.exports, { CRATER, inCrater, _test: { poolDrunk, spawnNpcs } });
