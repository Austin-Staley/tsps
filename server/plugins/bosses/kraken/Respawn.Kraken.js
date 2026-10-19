"use strict";

/**
 * Tentacle/boss respawn cycle (see ../Kraken.plugin.js for behaviour and sources).
 *
 * Wiki-mirroring shared-fight rules (estimates where the Wiki is silent):
 * - A tentacle killed while the Kraken is up stays dead: no mid-fight trickle respawn.
 * - Killing the Kraken kills its remaining tentacles with it (they drop nothing — they
 *   have no drop table), then boss + tentacles respawn together as whirlpools once the
 *   boss's own respawn timer elapses.
 * - A tentacle killed while the Kraken is down respawns normally as its whirlpool.
 * Deaths respawn as whirlpools because the engine clears the transformation first.
 */

const Shared = require("./Shared.Kraken");

/** While true, deaths are collected for one simultaneous respawn instead of respawning. */
let simultaneousPending = false;
/** Whirlpools to respawn together: [{ id, at }]. */
const deadThisFight = [];

function later(ticks, action) {
  const { Task, TaskManager } = Shared.core();
  TaskManager.submit(
    new (class extends Task {
      constructor() {
        super(Math.max(1, ticks), null, false);
      }
      execute() {
        this.stop();
        action();
      }
    })(),
  );
}

function livingIn(area, npcId) {
  let World = null;
  try {
    World = Shared.core().World;
  } catch {
    return [];
  }
  const found = [];
  for (const other of World?.getNpcs?.() ?? []) {
    if (!other?.isNpc?.() || other.getId?.() !== npcId) continue;
    if (!Shared.alive(other)) continue;
    if (other.getPrivateArea?.() !== area) continue;
    found.push(other);
  }
  return found;
}

/** Whether the Kraken is currently up in `area`. */
function bossUp(area) {
  return livingIn(area, Shared.ids().BOSS).length > 0;
}

function tentacleDied({ npc }) {
  if (!npc || npc.getId?.() !== Shared.ids().TENTACLE) return;
  if (simultaneousPending || bossUp(npc.getPrivateArea?.())) {
    // Mid-fight (or fight cleanup): stay dead, come back with the rest after the fight.
    npc.__skipDefaultRespawn = true;
    deadThisFight.push({ id: Shared.ids().TENTACLE_WHIRLPOOL, at: npc.getSpawnPosition() });
    return;
  }
  // Boss is down: a normal respawn as the whirlpool.
  npc.__skipDefaultRespawn = false;
}

function respawnAll() {
  const { NPC, World } = Shared.core();
  for (const { id, at } of deadThisFight.splice(0)) {
    try {
      World.getAddNPCQueue().push(NPC.create(id, at));
    } catch {
      // One failed spawn must not block the rest.
    }
  }
  simultaneousPending = false;
}

function bossDied({ npc }) {
  if (!npc || npc.getId?.() !== Shared.ids().BOSS) return;
  simultaneousPending = true;
  npc.__skipDefaultRespawn = true;
  deadThisFight.push({ id: Shared.ids().BOSS_WHIRLPOOL, at: npc.getSpawnPosition() });
  // The remaining tentacles die with the Kraken; their deaths join the same respawn.
  for (const tentacle of livingIn(npc.getPrivateArea?.(), Shared.ids().TENTACLE)) {
    try {
      tentacle.setHitpoints(0);
    } catch {
      // Already dying; its death event still joins the respawn.
    }
  }
  const delay = npc.getDefinition?.()?.getRespawn?.() ?? 25;
  later(delay, respawnAll);
}

function attach(api) {
  api.onNpcDeath(tentacleDied);
  api.onNpcDeath(bossDied);
}

module.exports = { attach, tentacleDied, bossDied, bossUp, respawnAll };
