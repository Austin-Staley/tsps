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
  const me = player.getLocation();
  const at = boss.getLocation();
  player.sendMessage(
    `boss=${boss.getId()} at=${at.getX()},${at.getY()} area=${boss.getArea?.()?.constructor?.name ?? "null"}` +
    ` playerArea=${player.getArea?.()?.constructor?.name ?? "null"} privateSame=${boss.getPrivateArea?.() === player.getPrivateArea?.()}`,
  );
  const playerAttacker = player.getCombat?.().getAttacker?.() ?? null;
  const who = (entity) => !entity ? "none" : entity.isPlayer?.() ? "player" : `npc:${entity.getAsNpc?.().getId?.()}`;
  const cycle = core.World.getProcessCycle();
  const lastAttack = boss.getAttribute?.(Shared.ATTR_LAST_ATTACK) ?? 0;
  const lastHatch = boss.getAttribute?.(Shared.ATTR_LAST_HATCH) ?? 0;
  let line = `cycle=${cycle} bossHp=${boss.getHitpoints?.()} attacks=${boss.getAttribute?.(Shared.ATTR_ATTACKS) ?? 0}` +
    ` sinceAttack=${lastAttack ? cycle - lastAttack : "-"} sinceHatch=${lastHatch ? cycle - lastHatch : "-"}` +
    ` target=${who(target)} attackedBy=${who(combat?.getAttacker?.())} playerAttacks=${who(playerAttacker)}` +
    ` dist=${Math.max(Math.abs(me.getX() - at.getX()), Math.abs(me.getY() - at.getY()))}`;
  try {
    const method = boss.getCombatMethod?.();
    const fakeRanged = { type: () => core.CombatType.MAGIC, attackDistance: () => 10, attackSpeed: () => 6 };
    line += method ? ` ownReach=${core.CombatRange.canReach(boss, method, player)}` : " method=none";
    line += ` rangedReach=${core.CombatRange.canReach(boss, fakeRanged, player)}`;
  } catch (error) {
    line += ` methodErr=${String(error?.message ?? error).slice(0, 90)}`;
  }
  try {
    const permission = core.CombatFactory.canAttackPermission(boss, player, true);
    line += ` permission=${permission}`;
  } catch (error) {
    line += ` permErr=${String(error?.message ?? error).slice(0, 90)}`;
  }
  player.sendMessage(line);
  return true;
}

module.exports = function attachCommands(api) {
  core = api.core;
  api.registerCommand("araxxorkill", killAraxxor, api.core.PlayerRights.DEVELOPER, "Defeat your active Araxxor");
  api.registerCommand("araxxorhp", setAraxxorHitpoints, api.core.PlayerRights.DEVELOPER, "Set your Araxxor's hitpoints");
  api.registerCommand("araxxordebug", debugAraxxor, api.core.PlayerRights.DEVELOPER, "Print the Araxxor fight state");
};
