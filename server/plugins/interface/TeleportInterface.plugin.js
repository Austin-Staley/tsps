/**
 * ::teleports, a free server teleport list (clicking a spell itself still enforces its rune
 * and level requirements). Destinations come from data/teleports.json and are grouped into
 * tabs; the list is searchable, and a player can keep favourites and see their last few
 * teleports. The Wilderness asks first, unless the player chose not to be asked again.
 */
const Layout = require("./teleportinterface/Layout.TeleportInterface");
const Destinations = require("./teleportinterface/Destinations.TeleportInterface");

const { GROUP_ID, MAIN_MODAL_UID, COMPONENT, uid } = Layout;
const { TAB, TAB_ORDER, TAB_LABELS } = Destinations;
const TAB_ATTRIBUTE = "teleports:tab";
const SELECTED_ATTRIBUTE = "teleports:selected";
const FAVOURITES_ATTRIBUTE = "teleports:favourites";
const RECENT_ATTRIBUTE = "teleports:recent";
const SKIP_WILDERNESS_WARNING_ATTRIBUTE = "teleports:skip-wilderness-warning";
const RECENT_LIMIT = 5;
const OP = { SELECT: 1, TELEPORT: 2, FAVOURITE: 3 };
const SEARCH_MAX_LENGTH = 40;
const TAB_UIDS = TAB_ORDER.map((_, index) => uid(COMPONENT.TAB_START + index));
const ROW_UIDS = Array.from({ length: Layout.ROW_SLOTS }, (_, slot) => uid(COMPONENT.ROW_LABEL_START + slot));
const INTERFACE_DEFINITION = Layout.buildInterface();

let core;
let pluginApi;

const favourites = (player) => [...(player.getAttribute(FAVOURITES_ATTRIBUTE) ?? [])];
const recent = (player) => [...(player.getAttribute(RECENT_ATTRIBUTE) ?? [])];
const isOpen = (player) => player.getInterfaceId?.() === GROUP_ID;

function selectedTab(player) {
  const tab = player.getAttribute(TAB_ATTRIBUTE);
  return TAB_ORDER.includes(tab) ? tab : TAB.ALL;
}

function showTab(player, tab) {
  player.setAttribute(TAB_ATTRIBUTE, tab);
  const sender = player.getPacketSender();
  TAB_ORDER.forEach((current, index) => {
    const colour = current === tab ? "ffffff" : "ffd27f";
    sender.sendString(`<col=${colour}>${TAB_LABELS[current]}</col>`, uid(COMPONENT.TAB_LABEL_START + index));
  });
  const rows = Destinations.rowsFor(tab, favourites(player), recent(player));
  sender.sendString(JSON.stringify(rows), uid(COMPONENT.DATA));
}

function killCountLine(player, entry) {
  if (!entry.kc) return "";
  const request = { player, monster: entry.kc };
  pluginApi.emitCustomEvent("combat-achievements:count", request);
  return `Kill count: <col=ffffff>${Number(request.total) || 0}</col>`;
}

function wildernessLine(entry) {
  const level = Destinations.wildernessLevel(entry);
  if (level <= 0) return "<col=7fbf6f>Outside the Wilderness</col>";
  const [x, y, z] = entry.tile;
  return `<col=ff5f5f>Level ${level} Wilderness${core.Wilderness.isMulti(x, y, z) ? ", multi-combat" : ""}</col>`;
}

/** Fills the details panel with the selected destination, or a prompt when there is none. */
function showPanel(player) {
  const entry = Destinations.byKey(player.getAttribute(SELECTED_ATTRIBUTE));
  const sender = player.getPacketSender();
  const panelHidden = !entry;
  for (const component of [COMPONENT.TELEPORT_BUTTON, COMPONENT.TELEPORT_LABEL, COMPONENT.FAVOURITE_BUTTON, COMPONENT.FAVOURITE_LABEL]) {
    sender.sendInterfaceDisplayState(uid(component), panelHidden);
  }
  if (!entry) {
    sender.clearItemOnInterface(uid(COMPONENT.PANEL_ICON));
    sender.sendString("Teleports", uid(COMPONENT.PANEL_TITLE))
      .sendString("", uid(COMPONENT.PANEL_SUBTITLE))
      .sendString("", uid(COMPONENT.PANEL_WILDERNESS))
      .sendString("", uid(COMPONENT.PANEL_KILLS))
      .sendString("Select a destination to see where it goes. Right-click one to teleport straight there or keep it as a favourite.",
        uid(COMPONENT.PANEL_DESCRIPTION));
    return;
  }
  const icon = Destinations.iconId(entry);
  if (icon >= 0) sender.sendItemOnInterface(uid(COMPONENT.PANEL_ICON), icon, 0, 1);
  else sender.clearItemOnInterface(uid(COMPONENT.PANEL_ICON));
  sender.sendString(entry.name, uid(COMPONENT.PANEL_TITLE))
    .sendString(entry.group ?? TAB_LABELS[entry.tabs[0]], uid(COMPONENT.PANEL_SUBTITLE))
    .sendString(wildernessLine(entry), uid(COMPONENT.PANEL_WILDERNESS))
    .sendString(killCountLine(player, entry), uid(COMPONENT.PANEL_KILLS))
    .sendString(entry.description ?? "", uid(COMPONENT.PANEL_DESCRIPTION))
    .sendString(favourites(player).includes(entry.key) ? "Unfavourite" : "Favourite", uid(COMPONENT.FAVOURITE_LABEL));
}

function open(player, query = "") {
  player.setInterfaceId(GROUP_ID);
  player.getPacketSender().sendSubInterface(MAIN_MODAL_UID, GROUP_ID, 0, {
    postScripts: [{ scriptId: 227, args: [uid(COMPONENT.FRAME), "Server Teleports"] }],
  });
  showTab(player, query ? TAB.ALL : selectedTab(player));
  player.getPacketSender().sendString(query.slice(0, SEARCH_MAX_LENGTH), uid(COMPONENT.SEARCH_INPUT));
  showPanel(player);
}

function rememberTeleport(player, entry) {
  const keys = recent(player).filter((key) => key !== entry.key);
  keys.unshift(entry.key);
  player.setAttribute(RECENT_ATTRIBUTE, keys.slice(0, RECENT_LIMIT));
}

function go(player, entry) {
  const destination = Destinations.location(entry);
  if (!core.TeleportHandler.checkReqs(player, destination)) return;
  for (const [key, value] of Object.entries(entry.attributes ?? {})) player.setAttribute(key, value);
  rememberTeleport(player, entry);
  core.TeleportHandler.teleport(player, destination, core.TeleportType[entry.type], false);
}

function confirmWilderness(player, entry, level) {
  const { DialogueChainBuilder, OptionDialogue } = core;
  player.getDialogueManager().startDialogues(new DialogueChainBuilder().add(
    new OptionDialogue(0, {
      executeOption(option) {
        player.getPacketSender().sendInterfaceRemoval();
        if (Number(option) === 3) player.setAttribute(SKIP_WILDERNESS_WARNING_ATTRIBUTE, true);
        if (Number(option) === 1 || Number(option) === 3) go(player, entry);
      },
    }, "Yes.", "No.", "Yes, and don't ask again.").setTitle(`Teleport into level ${level} Wilderness?`),
  ));
}

function teleport(player, entry) {
  player.getPacketSender().sendInterfaceRemoval();
  const level = Destinations.wildernessLevel(entry);
  if (level > 0 && !player.getAttribute(SKIP_WILDERNESS_WARNING_ATTRIBUTE)) confirmWilderness(player, entry, level);
  else go(player, entry);
}

function toggleFavourite(player, entry) {
  const keys = favourites(player);
  const kept = keys.filter((key) => key !== entry.key);
  player.setAttribute(FAVOURITES_ATTRIBUTE, kept.length === keys.length ? [...keys, entry.key] : kept);
  if (selectedTab(player) === TAB.SAVED) showTab(player, TAB.SAVED);
  if (player.getAttribute(SELECTED_ATTRIBUTE) === entry.key) showPanel(player);
}

function select(player, entry) {
  player.setAttribute(SELECTED_ATTRIBUTE, entry.key);
  showPanel(player);
}

function openTeleports({ player, parts }) {
  if (parts[1]?.toLowerCase() === "last") {
    const entry = Destinations.byKey(recent(player)[0]);
    if (entry) teleport(player, entry);
    else player.getPacketSender().sendMessage("You haven't teleported with ::teleports yet.");
    return true;
  }
  open(player, parts.slice(1).join(" "));
  return true;
}

function clickTab({ player, buttonId }) {
  if (!isOpen(player)) return false;
  showTab(player, TAB_ORDER[TAB_UIDS.indexOf(buttonId)]);
  return true;
}

/** A list row: its slot carries the row id the client showed there. */
function clickRow({ player, slot, opId }) {
  if (!isOpen(player)) return false;
  const entry = Destinations.byId(slot);
  if (!entry) return true;
  if (opId === OP.TELEPORT) teleport(player, entry);
  else if (opId === OP.FAVOURITE) toggleFavourite(player, entry);
  else select(player, entry);
  return true;
}

function selected(player) {
  return isOpen(player) ? Destinations.byKey(player.getAttribute(SELECTED_ATTRIBUTE)) : undefined;
}

function clickTeleportButton({ player }) {
  const entry = selected(player);
  if (entry) teleport(player, entry);
  return true;
}

function clickFavouriteButton({ player }) {
  const entry = selected(player);
  if (entry) toggleFavourite(player, entry);
  return true;
}

module.exports = {
  name: "TeleportInterface",
  register(api) {
    pluginApi = api;
    core = api.core;
    Destinations.init(api);
    api.registerCustomInterface(INTERFACE_DEFINITION);
    api.persistAttribute(FAVOURITES_ATTRIBUTE, []);
    api.persistAttribute(RECENT_ATTRIBUTE, []);
    api.persistAttribute(SKIP_WILDERNESS_WARNING_ATTRIBUTE, false);
    api.registerCommand("teleports", openTeleports, undefined, "Browse teleport destinations (optional search text, or 'last')");
    api.onInterfaceActionButton(TAB_UIDS, clickTab);
    api.onInterfaceActionButton(ROW_UIDS, clickRow);
    api.onInterfaceActionButton([uid(COMPONENT.TELEPORT_BUTTON), uid(COMPONENT.TELEPORT_LABEL)], clickTeleportButton);
    api.onInterfaceActionButton([uid(COMPONENT.FAVOURITE_BUTTON), uid(COMPONENT.FAVOURITE_LABEL)], clickFavouriteButton);
  },
  _test: {
    GROUP_ID, COMPONENT, TAB, TAB_UIDS, ROW_UIDS, OP, FAVOURITES_ATTRIBUTE, RECENT_ATTRIBUTE,
    SKIP_WILDERNESS_WARNING_ATTRIBUTE, Destinations, uid,
  },
};
