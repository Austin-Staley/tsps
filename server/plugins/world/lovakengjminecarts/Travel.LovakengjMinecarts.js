/**
 * Riding the Lovakengj Minecart Network (Wiki: Lovakengj_Minecart_Network, the conductors'
 * transcripts):
 * - Travel on a conductor or a station's minecart, or "Can I go for a ride?" in their talk, opens
 *   the destination list: the twelve stations in the Wiki's order (the cache's generic menu);
 * - a ride costs 20 coins from the pack, free once The Forsaken Tower is complete; without them the
 *   conductor says "Minecart rides are 20 coins.";
 * - picking the station the player is at gets the conductor's "already there" line, and no charge;
 * - the ride is a fade to the destination's cart.
 * The six conductors the generated spawns lack (the stations added in 2024) are placed here.
 */
const Common = require("./Common.LovakengjMinecarts");

const MENU_SCRIPT = 217;
const MENU_OPTIONS_CHILD = 3;
const PAUSE_BUTTON_EVENTS = 1;
const OPEN_ACTION = /Lovakengj Minecart Network interface opens/i;
const COINS = 995;

const pendingMenus = new WeakMap();

function conductorOf(npc) {
  return Common.ids.conductors.get(npc?.getId?.()) ?? null;
}

/** "If the player (does not) have 20 coins in their inventory:" for the conductors. */
function answerCondition({ player, npcId, npc, text }) {
  if (!Common.ids.conductors.has(npcId) && !conductorOf(npc)) return null;
  const value = String(text).toLowerCase();
  if (!value.includes("coins in their inventory")) return null;
  const has = player.getInventory().getAmount(COINS) >= Common.data.fare;
  return value.includes("does not") ? !has : has;
}

function openMenu(player, from) {
  const labels = Common.data.stations.map((station) => station.label);
  const sender = player.getPacketSender();
  const menu = Common.ids.menu;
  sender.sendInterfaceRemoval();
  sender.sendInterface(menu);
  sender.sendClientScript(MENU_SCRIPT, 1, Common.data.menuTitle, labels.join("|"));
  sender.sendInterfaceFlagsRange((menu << 16) | MENU_OPTIONS_CHILD, 0, labels.length - 1, PAUSE_BUTTON_EVENTS);
  pendingMenus.set(player, { from });
}

/** A line from a station's conductor (their transcript variant, or one line). */
function conductorSays(player, station, { variant = null, line = null }) {
  if (variant) {
    Common.api.emitCustomEvent("npc-dialogue:start", { player, npcId: station.npcId, variant, exact: true, handled: false });
    return;
  }
  const { DialogueChainBuilder, NpcDialogue, EndDialogue } = Common.core;
  const chain = new DialogueChainBuilder();
  chain.add(new NpcDialogue(0, station.npcId, line));
  chain.add(new EndDialogue(1));
  player.getDialogueManager().startDialogues(chain);
}

/** The ride from `from` (the station the player is at) to `to`. */
function ride(player, from, to) {
  if (from && from.key === to.key) {
    if (to.alreadyThere) conductorSays(player, to, { variant: to.alreadyThere });
    return false;
  }
  if (!Common.freeRides(player)) {
    const inventory = player.getInventory();
    if (inventory.getAmount(COINS) < Common.data.fare) {
      if (from) conductorSays(player, from, { line: Common.data.messages.fare });
      else player.sendMessage(Common.data.messages.fare);
      return false;
    }
    inventory.delete(COINS, Common.data.fare);
    inventory.refreshItems?.();
  }
  const movement = player.getMovementQueue?.();
  movement?.setBlockMovement?.(true);
  movement?.reset?.();
  Common.fade(player, true);
  Common.later(Common.data.travelTicks, () => {
    if (player.isRegistered?.() === false || player.isDyingReturn?.() === true || player.getHitpoints?.() <= 0) return;
    movement?.setBlockMovement?.(false);
    player.moveTo(Common.toLocation([...to.arrive, 0]));
    Common.fade(player, false);
    Common.later(2, () => Common.closeFade(player));
  });
  return true;
}

function chooseOption(event) {
  if (event.groupId !== Common.ids.menu || event.childId !== MENU_OPTIONS_CHILD) return;
  const pending = pendingMenus.get(event.player);
  if (!pending) return;
  event.handled = true;
  pendingMenus.delete(event.player);
  if (event.player.getInterfaceId?.() !== Common.ids.menu) return;
  const index = event.slot ?? event.action;
  event.player.getPacketSender().sendInterfaceRemoval();
  const to = Common.data.stations[index];
  if (to) ride(event.player, pending.from, to);
}

function closeMenu({ player }) {
  pendingMenus.delete(player);
}

/** Travel on a conductor: straight to the list. */
function travelNpc({ player, npc }) {
  const station = conductorOf(npc);
  if (!station) return false;
  openMenu(player, station);
  return true;
}

/** Travel on a station's minecart. */
function travelCart({ player, objectId, location }) {
  if (objectId !== Common.ids.minecart) return false;
  const at = location ? new Common.core.Location(location.x, location.y, location.z ?? 0) : player.getLocation();
  openMenu(player, Common.stationAt(at) ?? Common.stationAt(player.getLocation()));
  return true;
}

/** "(Lovakengj Minecart Network interface opens.)" in a conductor's talk. */
function onAction(event) {
  if (!OPEN_ACTION.test(String(event.text ?? ""))) return;
  const station = Common.ids.conductors.get(event.npcId) ?? conductorOf(event.npc) ?? Common.stationAt(event.player.getLocation());
  event.handled = true;
  event.end = true;
  // The conversation closes its window as it ends; the list opens on the next tick.
  Common.later(1, () => openMenu(event.player, station));
}

/** The six conductors the generated spawns don't have. */
function spawnConductors() {
  for (const station of Common.data.stations) {
    if (!station.spawn) continue;
    const [x, y] = station.spawn;
    const npc = Common.api.spawnNpc({ id: station.npcId, x, y, z: 0, wanderRadius: 0 });
    if (npc) station.spawned = npc;
  }
}

function attach(api) {
  api.onNpcDialogueCondition(answerCondition);
  api.onCustomEvent("npc-dialogue:action", onAction);
  for (const station of Common.data.stations) api.onNpcInteraction(station.name, { Travel: travelNpc });
  api.onObjectInteraction("Minecart", { Travel: travelCart });
  api.onInterfaceActionClick(chooseOption);
  api.onCustomEvent("interface:close", closeMenu);
  api.onPlayerLogout(closeMenu);
  api.onServerStartup(spawnConductors);
}

module.exports = { attach, answerCondition, openMenu, ride, chooseOption, travelNpc, travelCart, onAction, spawnConductors };
