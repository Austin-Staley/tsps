/**
 * The flights (Wiki: Eagle_transport_system): a rope lassoed round a giant eagle's neck - its
 * Quick-travel option, or a rope used on it. The network is a hub: the three eagles in the Eagles'
 * Peak eyrie fly out to the desert (Uzer), jungle (Feldip) and polar (Rellekka) eyries, and the
 * eagles there only fly back to the Peak. Eagles' Peak must be complete, and a rope carried; the
 * rope is kept.
 */
const Common = require("./Common.EagleTransport");

/** Where this eagle flies to: an eyrie's landing tile, or the Peak's. Null if not one of them. */
function destination(npc) {
  const { ids, data } = Common;
  const spawned = npc.getId?.();
  const remote = Object.values(data.eyries).find((eyrie) => ids.npcs[eyrie.eagle] === spawned);
  if (remote) return data.peak.arrive;
  if (!Common.inBox(npc.getLocation(), data.peak.box)) return null;
  const outbound = Object.values(data.eyries).find((eyrie) => ids.npcs[eyrie.peakEagle] === spawned);
  return outbound ? outbound.arrive : null;
}

function fly(player, npc) {
  const to = destination(npc);
  if (!to) return false;
  if (!Common.questComplete(player)) {
    Common.box(player, Common.message("questIncomplete"));
    return true;
  }
  if (!player.getInventory().contains(Common.ids.objs.rope)) {
    player.sendMessage(Common.message("noRope"));
    return true;
  }
  player.setPositionToFace?.(npc.getLocation());
  player.performAnimation(new Common.core.Animation(Common.ids.seqs.lasso));
  player.sendMessage(Common.message("lasso"));
  Common.travel(player, to, Common.data.flightTicks);
  return true;
}

function quickTravel({ player, npc }) {
  return fly(player, npc);
}

function ropeOnEagle(event) {
  if (event.itemId !== Common.ids.objs.rope || !event.target) return;
  if (destination(event.target)) {
    event.handled = true;
    fly(event.player, event.target);
  }
}

function attach(api) {
  for (const name of ["Desert eagle", "Jungle eagle", "Polar eagle"]) api.onNpcInteraction(name, { "Quick-travel": quickTravel });
  api.onItemOnNpc(ropeOnEagle);
}

module.exports = { attach, destination, fly, ropeOnEagle };
