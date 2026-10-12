/** Quest Helper palace positions, with the cache's playable NPC variants. */
module.exports = function registerPalace({ api, stage, preparationAttribute }) {
  const { Area, Boundary, NpcIdentifiers: N } = api.core;
  const residents = new WeakMap();
  function cleanup(player) {
    for (const npc of residents.get(player) ?? []) api.removeNpc(npc);
    residents.delete(player);
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
  }
  class PalaceArea extends Area {
    constructor() { super([new Boundary(3154, 3183, 7823, 7861, 1)]); }
    process(member) { if (member.isPlayer?.()) sync(member.getAsPlayer()); }
    postLeave(member) { if (member.isPlayer?.()) cleanup(member.getAsPlayer()); }
  }
  api.registerArea(new PalaceArea());
  return { sync, cleanup, residents };
};
