"use strict";

/**
 * The ways through a room:
 * - **Speartrap** (Pass): a Thieving roll to disarm it (10 XP), stepping the player across; a
 *   failed roll and the spears hit for 1-4. It re-arms behind them. The trap loc doesn't block,
 *   so walking onto it while armed springs it (Session pushes the player back).
 * - **Tomb doors** (ntk_tomb_door1..4; ntk_doorN_state 0 locked, 1 open): Pick-lock, easier with
 *   a lockpick, which halves the XP. One door per room leads on (drawn when the run starts);
 *   after three dead ends the fourth always leads on. The
 *   next room needs its Thieving level. In room 8 the doors lead out, after a confirmation.
 * - **Tomb door exits** (ntk_tomb_door_exit, Leave Tomb / Quick-leave) end the run outside, and
 *   the antechamber exits (ntk_antechamber_exit) take the player out of a lobby.
 *
 * Wiki: https://oldschool.runescape.wiki/w/Speartrap, https://oldschool.runescape.wiki/w/Tomb_Door
 */

const Common = require("./Common.PyramidPlunder");

const TRAP_XP = 10;
/** Ticks a disarm or a lock pick takes. */
const ACTION_TICKS = 2;
const LAST_ROOM_PROMPT = "Leave the Tomb?";

function runIn(player, location) {
  const run = Common.sessionOf(player);
  if (!run || Common.roomAt(location.x, location.y, location.z) !== run.room) return null;
  return run;
}

// --- The speartrap

/** The tile across the 2x2 trap from the player. */
function crossingTile(trap, at) {
  if (trap.horizontal) {
    const y = Math.max(trap.y, Math.min(trap.y + 1, at.y));
    return { x: at.x < trap.x ? trap.x + 2 : trap.x - 1, y };
  }
  const x = Math.max(trap.x, Math.min(trap.x + 1, at.x));
  return { x, y: at.y < trap.y ? trap.y + 2 : trap.y - 1 };
}

/** The trap covers 2x2 tiles from its south-west corner. */
function onTrap(trap, x, y) {
  return x >= trap.x && x <= trap.x + 1 && y >= trap.y && y <= trap.y + 1;
}

/** Walking onto an armed trap: the spears hit and the player is pushed back where they came from. */
function springTrap(player, run, random = Math.random) {
  player.sendMessage(Common.MESSAGES.trapFail);
  Common.hit(player, Common.rollHit(random));
  const back = run.lastSafe ?? Common.roomData(run.room).entry;
  player.moveTo(Common.location(back));
}

function passTrap(event, random = Math.random) {
  const player = event.player;
  const run = runIn(player, event.location);
  if (!run) return true;
  if (!Common.takeAction(run, ACTION_TICKS)) return true;
  const room = Common.roomData(run.room);
  const v = Common.ids().varbit;
  player.performAnimation(new (Common.getCore().Animation)(Common.ids().anim.pick));
  if (!Common.roll(Common.chanceOf("speartrap", Common.thievingLevel(player), run.room), random)) {
    player.sendMessage(Common.MESSAGES.trapFail);
    Common.hit(player, Common.rollHit(random));
    return true;
  }
  const at = player.getLocation();
  const tile = crossingTile(room.trap, { x: at.getX(), y: at.getY() });
  Common.send(player, v.trap, 1);
  player.sendMessage(Common.MESSAGES.trapDisarmed);
  Common.later(1, () => {
    if (Common.sessionOf(player) !== run) return;
    player.moveTo(Common.location(tile));
    Common.addXp(player, "THIEVING", TRAP_XP);
    Common.send(player, v.trap, 0);
  });
  return true;
}

// --- Tomb doors

function doorNumber(objectId) {
  return Common.ids().tombDoors.get(objectId);
}

/** Leads on: this room's exit for everyone, or the fourth door once the other three failed. */
function leadsOn(player, run, door) {
  if (run.exits[run.room - 1] === door) return true;
  const opened = Common.ids().varbit.doors.filter((id, i) => i + 1 !== door && Common.varbitOf(player, id) === 1);
  return opened.length === 3;
}

function nextRoom(player, run) {
  const next = run.room + 1;
  Common.later(1, () => {
    if (Common.sessionOf(player) === run) Common.enterRoom(player, run, next);
  });
}

function pickLock(event, random = Math.random) {
  const door = doorNumber(event.objectId);
  if (door === undefined) return false;
  const player = event.player;
  const run = runIn(player, event.location);
  if (!run) return true;
  if (run.room >= Common.LAST_ROOM) {
    Common.getApi().sendMultiChatboxPrompt(player, LAST_ROOM_PROMPT,
      "Yes, I'm out of here.", () => Common.endRun(player),
      "Ah, I think I'll stay a little longer here.", () => {});
    return true;
  }
  const next = Common.roomData(run.room + 1);
  if (Common.baseThievingLevel(player) < next.level) {
    player.sendMessage(Common.MESSAGES.level(next.level));
    return true;
  }
  const varbit = Common.ids().varbit.doors[door - 1];
  if (Common.varbitOf(player, varbit) === 1) {
    if (leadsOn(player, run, door)) nextRoom(player, run);
    else player.sendMessage(Common.MESSAGES.deadEnd);
    return true;
  }
  if (!Common.takeAction(run, ACTION_TICKS)) return true;
  const lockpick = player.getInventory().getAmount(Common.ids().item.lockpick) > 0;
  player.sendMessage(lockpick ? Common.MESSAGES.lockpick : Common.MESSAGES.noLockpick);
  player.performAnimation(new (Common.getCore().Animation)(Common.ids().anim.pick));
  const chance = Common.chanceOf(lockpick ? "doorLockpick" : "door", Common.thievingLevel(player), run.room);
  if (!Common.roll(chance, random)) {
    player.sendMessage(Common.MESSAGES.doorFail);
    return true;
  }
  Common.send(player, varbit, 1);
  const xp = Common.roomData(run.room).doorXp;
  Common.addXp(player, "THIEVING", lockpick ? xp / 2 : xp);
  if (leadsOn(player, run, door)) nextRoom(player, run);
  else player.sendMessage(Common.MESSAGES.deadEnd);
  return true;
}

// --- Exits

function leaveTomb(event) {
  if (event.objectId === Common.ids().tombExit) {
    if (!Common.endRun(event.player)) event.player.moveTo(Common.location(Common.DATA.outside));
    return true;
  }
  if (event.objectId === Common.ids().antechamberExit) {
    event.player.moveTo(Common.location(Common.DATA.outside));
    return true;
  }
  return false;
}

module.exports = function registerPassages(api) {
  Common.bind(api);
  api.onObjectInteraction("Speartrap", { Pass: passTrap });
  api.onObjectInteraction("Tomb Door", {
    "Pick-lock": pickLock,
    Enter: pickLock,
    "Leave Tomb": leaveTomb,
    "Quick-leave": leaveTomb,
  });
};

module.exports.onTrap = onTrap;
module.exports.springTrap = springTrap;
module.exports._test = { TRAP_XP, ACTION_TICKS, crossingTile, onTrap, springTrap, passTrap, leadsOn, pickLock, leaveTomb };
