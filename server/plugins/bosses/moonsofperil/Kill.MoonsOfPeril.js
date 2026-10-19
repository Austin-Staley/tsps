/**
 * A Moon subdued (docs/moons-of-peril.md), as captured, for the player who did it:
 * - at once: pmoon_boss_hp 0, the Moon's dead varbit, hide_npc 1 (the Moon turns to its empty
 *   form for them), and a stand-in on its tile that faces them and plays the Moon's death;
 * - 5 ticks on: the HUD goes and the portal overlay opens (script 5984 [52841, 1355188], sound 7928);
 * - 6 ticks on: hide_npc 0 and the stand-in goes;
 * - 7 ticks on: the boss varbits reset and the player lands by a camp's cooking stove: which one
 *   depends on the Moons already down (Wiki; data moons.<moon>.landing).
 * Then "moons-of-peril:killed" { player, moon } tells the quest and anyone else.
 */
const Common = require("./Common.MoonsOfPeril");

function landing(player, moon) {
  const { landing: rule } = Common.data.moons[moon];
  const after = Object.entries(rule.ifDead ?? {}).find(([other]) => Common.isDead(player, other));
  const camp = after ? after[1] : rule.default;
  return Common.location(Common.data.camps[camp]);
}

function kill(fight) {
  if (fight.killed) return;
  const { player, arena, moon } = fight;
  const { kill: timing } = Common.data;
  fight.killed = true;
  fight.stopSpecial();
  const camp = landing(player, moon);
  Common.setDead(player, moon, true);
  Common.varbit(player, "hp", 0);
  fight.sendHideNpc();

  const [x, y, z] = arena.spec.tile;
  const standIn = Common.api.spawnNpc({ id: Common.data.trackingNpc, x, y, z, wanderRadius: 0, owner: player, ownerOnly: true });
  if (standIn) {
    standIn.__skipDefaultRespawn = true;
    standIn.getMovementQueue().setBlockMovement(true);
    standIn.setMobileInteraction(player);
    standIn.performGraphic(Common.graphic(arena.spec.deathSpot));
  }

  Common.later(timing.hudTicks, () => {
    if (!player.isRegistered()) return;
    Common.closeHud(player);
    Common.portal(player, Common.data.portal.leave);
  });
  Common.later(timing.standInTicks, () => {
    if (standIn?.isRegistered?.()) Common.api.removeNpc(standIn);
    if (player.isRegistered()) Common.varbit(player, "hideNpc", 0);
  });
  Common.later(timing.landTicks, () => {
    if (!player.isRegistered()) return;
    fight.end();
    player.getMovementQueue().reset();
    player.moveTo(camp);
    Common.closePortal(player);
    Common.api.emitCustomEvent("moons-of-peril:killed", { player, moon });
  });
}

module.exports = { kill, landing };
