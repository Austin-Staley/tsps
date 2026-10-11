/**
 * Developer commands for testing Araxxor, following Commands.Zulrah / Commands.MadAngel:
 * ::araxxorkill finishes the player's active boss (to exercise the corpse, harvest and
 * destroy), and ::araxxorhp <hitpoints> sets its hitpoints (255 to see the enrage).
 */
const Shared = require("./Shared.Araxxor");
const Area = require("./Area.Araxxor");

let core = null;

function activeBoss(player) {
  const session = Area.sessions.get(player);
  const boss = session?.npc ?? null;
  return boss?.isRegistered?.() && boss.getHitpoints?.() > 0 ? boss : null;
}

function killAraxxor({ player }) {
  const boss = activeBoss(player);
  if (!boss) {
    player.sendMessage("You have no active Araxxor.");
    return true;
  }
  boss.getCombat().getHitQueue().addPendingDamage([
    new core.HitDamage((boss.getHitpoints() ?? 0) + 1, core.HitMask.RED),
  ]);
  player.sendMessage("Araxxor has been defeated.");
  return true;
}

function setAraxxorHitpoints({ player, parts }) {
  const boss = activeBoss(player);
  const hitpoints = Number(parts?.[1]);
  if (!boss) {
    player.sendMessage("You have no active Araxxor.");
    return true;
  }
  if (!Number.isInteger(hitpoints) || hitpoints < 1 || hitpoints > Shared.MAX_HITPOINTS) {
    player.sendMessage(`Use ::araxxorhp <hitpoints 1-${Shared.MAX_HITPOINTS}>.`);
    return true;
  }
  boss.setHitpoints(hitpoints);
  player.sendMessage(`Araxxor now has ${hitpoints} hitpoints.`);
  return true;
}

function debugAraxxor({ player }) {
  const session = Area.sessions.get(player);
  const boss = session?.npc ?? null;
  if (!boss) {
    player.sendMessage("You have no active Araxxor.");
    return true;
  }
  const combat = boss.getCombat?.();
  const target = combat?.getTarget?.() ?? null;
  const method = boss.getCombatMethod?.() ?? null;
  const me = player.getLocation();
  const at = boss.getLocation();
  player.sendMessage(
    `boss=${boss.getId()} at=${at.getX()},${at.getY()} area=${boss.getArea?.()?.constructor?.name ?? "null"}` +
    ` playerArea=${player.getArea?.()?.constructor?.name ?? "null"} privateSame=${boss.getPrivateArea?.() === player.getPrivateArea?.()}`,
  );
  player.sendMessage(
    `target=${target ? (target.isPlayer?.() ? target.getAsPlayer?.().getUsername?.() : "npc:" + target.getAsNpc?.().getId?.()) : "none"}` +
    ` underAttack=${combat?.getAttacker?.() ? "yes" : "no"} reach=${method?.attackDistance?.() ?? "?"} speed=${method?.attackSpeed?.() ?? "?"}` +
    ` dist=${Math.max(Math.abs(me.getX() - at.getX()), Math.abs(me.getY() - at.getY()))}`,
  );
  return true;
}

module.exports = function attachCommands(api) {
  core = api.core;
  api.registerCommand("araxxorkill", killAraxxor, api.core.PlayerRights.DEVELOPER, "Defeat your active Araxxor");
  api.registerCommand("araxxorhp", setAraxxorHitpoints, api.core.PlayerRights.DEVELOPER, "Set your Araxxor's hitpoints");
  api.registerCommand("araxxordebug", debugAraxxor, api.core.PlayerRights.DEVELOPER, "Print the Araxxor fight state");
};
