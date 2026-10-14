/** Quest Helper palace positions, with the cache's playable NPC variants. */
module.exports = function registerPalace({ api, stage, preparationAttribute, processHall }) {
  const { Area, Boundary, NpcIdentifiers: N } = api.core;
  const residents = new WeakMap();
  const preparationTalkers = new WeakMap();
  function cleanup(player) {
    for (const npc of residents.get(player) ?? []) api.removeNpc(npc);
    residents.delete(player);
    for (const npc of preparationTalkers.get(player) ?? []) api.removeNpc(npc);
    preparationTalkers.delete(player);
  }
  function sync(player) {
    if (stage(player) !== 60) { cleanup(player); return; }
    let cast = residents.get(player);
    if (!cast) {
      cast = [];
      for (const [id, x, y] of [[N.SAFALAAN_HALLOW_14, 3157, 7841], [N.EFARITAY_HALLOW, 3157, 7839],
        [N.IVAN_STROM_13, 3175, 7834], [N.SUGADINTI_VITUR, 3168, 7828]]) {
        const npc = api.spawnNpc({ id, x, y, z: 1, wanderRadius: 0, owner: player, ownerOnly: true });
        if (npc) { npc.setScriptedMovement(true); npc.getMovementQueue().setBlockMovement(true); cast.push(npc); }
      }
      residents.set(player, cast);
    }
    const fed = player.getAttribute(preparationAttribute)?.stewFed;
    const safalaan = cast.find(npc => npc.getId() === N.SAFALAAN_HALLOW_14);
    safalaan?.setNpcTransformationId(fed ? N.SAFALAAN_HALLOW_12 : N.SAFALAAN_HALLOW_14);

    // RSProx 4288 records the required downstairs conversation pair on the z0
    // floor after the player has made both hallowed weapons. These are cache
    // parents whose IDs are not named in NpcIdentifiers in this cache export.
    const prep = player.getAttribute(preparationAttribute) ?? {};
    if (prep.flail && prep.stakes) {
      if (!preparationTalkers.has(player)) {
        const talkers = [];
        for (const [id, x, y] of [[15871, 3168, 7842], [15906, 3168, 7844]]) {
          const npc = api.spawnNpc({ id, x, y, z: 0, wanderRadius: 0, owner: player, ownerOnly: true });
          if (npc) { npc.setScriptedMovement(true); npc.getMovementQueue().setBlockMovement(true); talkers.push(npc); }
        }
        preparationTalkers.set(player, talkers);
      }
    } else {
      for (const npc of preparationTalkers.get(player) ?? []) api.removeNpc(npc);
      preparationTalkers.delete(player);
    }
  }
  class PalaceArea extends Area {
    constructor() { super([new Boundary(3154, 3183, 7823, 7861, 0), new Boundary(3154, 3183, 7823, 7861, 1)]); }
    process(member) {
      if (!member.isPlayer?.()) return;
      const player = member.getAsPlayer();
      sync(player);
      if (player.getLocation?.().getZ?.() === 1) processHall?.({ player });
    }
    postLeave(member) { if (member.isPlayer?.()) cleanup(member.getAsPlayer()); }
  }
  api.registerArea(new PalaceArea());
  return { sync, cleanup, residents, preparationTalkers };
};
