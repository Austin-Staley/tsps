"use strict";

/**
 * Daimon's Crater as two areas (https://oldschool.runescape.wiki/w/Bounty_Hunter#Fighting):
 *
 * - Fort Daimon, the lobby: safe. A player keeps their target there for 2:00 in all
 *   (bh_lobby_timer), and gets 15 seconds of it back on each return to the arena (1 June 2023).
 * - The arena, the rest of the island: single-way PvP. Teleports are blocked (Teleport to Target
 *   moves the player itself, past these checks), protection prayers can't be used, binding
 *   spells don't stop movement, and fights with players give no combat experience. A player
 *   entering it is immune to rogues for 6 seconds, until they attack someone (1 June 2023).
 *   Bounty Hunter weapons work here.
 *
 * The level range for rogues (15 either way, as on PvP worlds) has no Wiki source; targets are
 * always inside it. Phoenix necklaces (29 January 2025) need nothing: the server has no
 * phoenix necklace effect. Messages are our wording.
 */

const Hud = require("./Hud.BountyHunter");
const Targets = require("./Targets.BountyHunter");

const LOBBY_ALLOWANCE_TICKS = 200; // 2:00
const LOBBY_REFUND_TICKS = 25; // 15 seconds
const ROGUE_IMMUNITY_TICKS = 10; // 6 seconds
const ROGUE_LEVEL_RANGE = 15;
// Prayer head icons of Protect from Melee, Missiles and Magic.
const PROTECTION_HEAD_ICONS = [0, 1, 2];
const COMBAT_SKILLS = ["ATTACK", "STRENGTH", "DEFENCE", "RANGED", "MAGIC", "HITPOINTS"];
// Combat asks canAttack several times per swing, so a refusal is said at most this often.
const REFUSAL_MESSAGE_MS = 1200;

let api;
let core;
let bh;
const refusalSaidAt = new WeakMap();

function isPlayer(mobile) {
  return mobile?.isPlayer?.() === true;
}

function cycle() {
  return core.World.getProcessCycle();
}

function boundary(box) {
  return new core.Boundary(box.minX, box.maxX, box.minY, box.maxY, 0);
}

function refuseTeleport(player) {
  player.sendMessage("You can't teleport out of Bounty Hunter.");
  return false;
}

/** Leaving the crater altogether - not just stepping between lobby and arena - ends the pair. */
function leftCrater(player, logout) {
  if (logout) {
    Targets.clearTarget(player, "logout");
    return;
  }
  Targets.clearTarget(player, "left");
  Hud.sync(player);
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function enterLobby(player) {
  bh.lobby.add(player);
  Hud.sendLobbyTimer(player, bh.lobbyTicks.get(player) ?? 0);
  api.emitCustomEvent("bounty-hunter:entered-lobby", { player });
  Hud.sync(player);
}

function leaveLobby(player, logout) {
  bh.lobby.delete(player);
  if (logout || !bh.isArenaTile(player.getLocation())) leftCrater(player, logout);
}

function lobbyTick(player) {
  if (bh.targetOf(player)) {
    const ticks = (bh.lobbyTicks.get(player) ?? 0) + 1;
    bh.lobbyTicks.set(player, ticks);
    if (ticks >= LOBBY_ALLOWANCE_TICKS) {
      Targets.clearTarget(player, "left");
      player.sendMessage("You spent too long in the lobby and lost your target.");
    }
  }
  Hud.sync(player);
}

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------

function enterArena(player) {
  bh.arena.add(player);
  bh.immuneUntil.set(player, cycle() + ROGUE_IMMUNITY_TICKS);
  Hud.sendImmunity(player, ROGUE_IMMUNITY_TICKS);
  const ticks = Math.max(0, (bh.lobbyTicks.get(player) ?? 0) - LOBBY_REFUND_TICKS);
  bh.lobbyTicks.set(player, ticks);
  Hud.sendLobbyTimer(player, ticks);
  for (const prayer of core.PrayerHandler.PROTECTION_PRAYERS) core.PrayerHandler.deactivatePrayer(player, prayer);
  if (player.isPlayerBot?.() !== true) player.getPacketSender().sendInteractionOption("Attack", 2, true);
  Targets.remindPenalty(player);
  api.emitCustomEvent("bounty-hunter:entered-arena", { player });
  Hud.sync(player);
}

function leaveArena(player, logout) {
  bh.arena.delete(player);
  bh.immuneUntil.delete(player);
  api.emitCustomEvent("bounty-hunter:left-arena", { player });
  if (logout) {
    leftCrater(player, true);
    return;
  }
  if (player.isPlayerBot?.() !== true) player.getPacketSender().sendInteractionOption("null", 2, true);
  Hud.sendImmunity(player, 0);
  Targets.remindPenalty(player);
  if (!bh.isLobbyTile(player.getLocation())) leftCrater(player, false);
}

function arenaTick(player) {
  // ponytail: a bind is lifted on the arena's next tick rather than never landing, so a frozen
  // player stops for up to a tick; a generic "can freeze" core hook would make it exact.
  const timers = player.getTimers();
  if (timers.has(core.TimerKey.FREEZE)) timers.cancel(core.TimerKey.FREEZE);
  const immuneUntil = bh.immuneUntil.get(player);
  if (immuneUntil !== undefined && cycle() >= immuneUntil) {
    bh.immuneUntil.delete(player);
    Hud.sendImmunity(player, 0);
  }
  Hud.sync(player);
}

function refuse(attacker, message) {
  const now = Date.now();
  if (now - (refusalSaidAt.get(attacker) ?? 0) >= REFUSAL_MESSAGE_MS) {
    refusalSaidAt.set(attacker, now);
    attacker.sendMessage(message);
  }
  return false;
}

function canAttackInArena(attacker, target) {
  if (!isPlayer(attacker) || !isPlayer(target)) return null;
  if (!bh.inArena(attacker) || !bh.inArena(target)) return false;
  const levels = Math.abs(attacker.getSkillManager().getCombatLevel() - target.getSkillManager().getCombatLevel());
  if (levels > ROGUE_LEVEL_RANGE) return refuse(attacker, "Your level difference is too great.");
  if (bh.targetOf(target) !== attacker && cycle() < (bh.immuneUntil.get(target) ?? 0)) {
    return refuse(attacker, "That player has only just entered the arena.");
  }
  if (bh.immuneUntil.delete(attacker)) Hud.sendImmunity(attacker, 0);
  return true;
}

function createAreas() {
  class BountyHunterLobby extends core.Area {
    postEnter(mobile) {
      if (isPlayer(mobile)) enterLobby(mobile);
    }

    postLeave(mobile, logout) {
      if (isPlayer(mobile)) leaveLobby(mobile, logout);
    }

    process(mobile) {
      if (isPlayer(mobile)) lobbyTick(mobile);
    }

    canAttack(attacker, target) {
      return isPlayer(attacker) && isPlayer(target) ? false : null;
    }

    canTeleport(player) {
      return refuseTeleport(player);
    }
  }

  class BountyHunterArena extends core.Area {
    postEnter(mobile) {
      if (isPlayer(mobile)) enterArena(mobile);
    }

    postLeave(mobile, logout) {
      if (isPlayer(mobile)) leaveArena(mobile, logout);
    }

    process(mobile) {
      if (isPlayer(mobile)) arenaTick(mobile);
    }

    canAttack(attacker, target) {
      return canAttackInArena(attacker, target);
    }

    canTeleport(player) {
      return refuseTeleport(player);
    }
  }

  // The lobby first: an actor holds the first area that matches, and the arena's box covers it.
  return [new BountyHunterLobby([boundary(bh.CRATER.lobby)]), new BountyHunterArena([boundary(bh.CRATER.arena)])];
}

// ---------------------------------------------------------------------------
// Rules that core asks of everyone; each is one set lookup for players elsewhere.
// ---------------------------------------------------------------------------

function disableProtectionPrayers(event) {
  if (!bh.inArena(event.player) || !PROTECTION_HEAD_ICONS.includes(event.prayer?.hint)) return;
  event.disabled = true;
  event.message = "You can't use protection prayers in Bounty Hunter.";
}

function noPvpCombatExperience(event) {
  if (!bh.inArena(event.player) || !COMBAT_SKILLS.some((name) => core.Skill[name] === event.skill)) return;
  if (isPlayer(event.player.getCombat().getTarget())) event.allow = false;
}

/** Noted for the exit gates: a player can't leave right after a special attack (7 June 2023). */
function noteSpecialAttack({ attacker, target }) {
  if (isPlayer(target) && bh.inArena(attacker) && attacker.isSpecialActivated?.()) bh.lastSpecialAt.set(attacker, cycle());
}

function allowWeapons(request) {
  if (bh.inArena(request.attacker) && bh.inArena(request.target)) request.allowed = true;
}

function registerAreas() {
  for (const area of createAreas()) api.registerArea(area);
}

module.exports = function attachArea(pluginApi, state) {
  api = pluginApi;
  core = pluginApi.core;
  bh = state;
  registerAreas();
  api.onPrayerDisabled(disableProtectionPrayers);
  api.onCanGainExperience(noPvpCombatExperience);
  api.onAttackTiming(noteSpecialAttack);
  api.onCustomEvent("bounty-hunter:weapon-area", allowWeapons);
};

Object.assign(module.exports, { _test: { canAttackInArena, lobbyTick, LOBBY_ALLOWANCE_TICKS } });
