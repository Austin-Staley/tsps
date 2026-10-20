/**
 * Anvil smithing: the smithing interface (312) for the best bar the player can work, its
 * 1/5/10/X/All quantity row, and the smith loop. Interface 312 draws its own products from
 * varbit smithing_bar_type (client scripts 415 -> 430), so the server only sets the varbit.
 */
const Core = require("./Core.Smithing");
const Data = require("./Data.Smithing");
const Sessions = require("./Sessions.Smithing");

const SMITH_ANIMATION = 898;
const MAIN_MODAL_TARGET_UID = (161 << 16) | 16;
const SMITHING_BAR_TYPE_VARBIT = 3216;
const SMITHING_INTERVAL_TICKS = 5;
const FIRST_DELAY_TICKS = 1;
const ALL_QUANTITY_CAP = 28;
/** The quantity row left of the products: components 3-7 select 1, 5, 10, X and All. */
const QUANTITY_MODE_COMPONENTS = new Map([[3, 1], [4, 5], [5, 10], [6, "x"], [7, "all"]]);
const FIRST_PRODUCT_COMPONENT = 9;
const LAST_PRODUCT_COMPONENT = 38;
// The rusted anvil in Lumbridge can only be used to smith bronze.
const RUSTED_ANVIL_BRONZE_ONLY_MESSAGE = "You can only use bronze bars to smith on this anvil.";

/** player -> the bar the open interface shows. */
const OPEN_MENUS = new Map();
/** player -> the selected quantity ("all", "x" amount or a number); kept until disconnect. */
const SELECTED_QUANTITY = new Map();

const buttonId = (component) => (Data.SMITHING_INTERFACE << 16) | component;
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function smithingLevel(player) {
  return player.getSkillManager().getCurrentLevel(Core.Skill.SMITHING);
}

function canSmith(player, product) {
  const inventory = player.getInventory();
  if (!inventory.contains(Core.ItemIdentifiers.HAMMER)) {
    player.sendMessage("You need a hammer to work metal bars.");
    return false;
  }
  if (smithingLevel(player) < product.level) {
    player.sendMessage(`You need a Smithing level of at least ${product.level} to smith this item.`);
    return false;
  }
  if (inventory.getAmount(product.barId) < product.bars) {
    player.sendMessage("You don't have enough bars to smith that item.");
    return false;
  }
  return true;
}

function smithOnce(player, product) {
  if (!canSmith(player, product)) return false;
  const inventory = player.getInventory();
  inventory.deleteNumber(product.barId, product.bars);
  inventory.addItem(new Core.Item(product.itemId, product.amount));
  player.performAnimation(new Core.Animation(SMITH_ANIMATION));
  player.getSkillManager().addExperiences(Core.Skill.SMITHING, product.xp);
  player.sendMessage("You hammer the metal and shape an item.");
  Core.api.emitCustomEvent("smithing:success", { player, skill: Core.Skill.SMITHING, itemId: product.itemId });
  return true;
}

function startSmithing(player, product, amount) {
  if (!product || !Number.isInteger(amount) || amount <= 0 || !canSmith(player, product)) return false;
  Sessions.start(player, {
    type: "smith",
    remaining: amount,
    interval: SMITHING_INTERVAL_TICKS,
    firstDelay: FIRST_DELAY_TICKS,
    step: (smith) => smithOnce(smith, product),
  });
  player.performAnimation(new Core.Animation(SMITH_ANIMATION));
  return true;
}

/** The bar to show: the one used on the anvil, else the best one carried that the player can work. */
function chooseBar(player, preferredBarId) {
  const inventory = player.getInventory();
  const level = smithingLevel(player);
  const lowestLevel = (bar) => Math.min(...Data.productsFor(bar).map((product) => product.level));
  if (Number.isInteger(preferredBarId) && Data.BAR_TYPE_BY_BAR.has(preferredBarId)) {
    if (level < lowestLevel(preferredBarId)) {
      player.sendMessage(`You need a Smithing level of at least ${lowestLevel(preferredBarId)} to smith this bar.`);
      return null;
    }
    if (inventory.contains(preferredBarId)) return preferredBarId;
  }
  let best = null;
  for (const bar of Data.anvilBars()) {
    if (inventory.contains(bar) && level >= lowestLevel(bar)) best = bar;
  }
  return best;
}

function openInterface(player, preferredBarId = null) {
  const bar = chooseBar(player, preferredBarId);
  if (bar == null) {
    player.sendMessage("You don't have any bars in your inventory which can be used with your Smithing level.");
    return false;
  }
  OPEN_MENUS.set(player, bar);
  player.setInterfaceId(Data.SMITHING_INTERFACE);
  player
    .getPacketSender()
    .sendVarbit(SMITHING_BAR_TYPE_VARBIT, Data.BAR_TYPE_BY_BAR.get(bar))
    .sendSubInterface(MAIN_MODAL_TARGET_UID, Data.SMITHING_INTERFACE, 0);
  for (const component of range(FIRST_PRODUCT_COMPONENT, LAST_PRODUCT_COMPONENT)) {
    player.getPacketSender().sendInterfaceFlags(buttonId(component), 2);
  }
  return true;
}

function closeInterface(player) {
  if (!player?.isRegistered?.() || player.getInterfaceId() !== Data.SMITHING_INTERFACE) return;
  OPEN_MENUS.delete(player);
  player.setInterfaceId(-1);
  player.getPacketSender().closeSubInterface(MAIN_MODAL_TARGET_UID);
}

/** Closes the interface of a player who walked off, died or logged out. */
function closeAbandonedMenus() {
  for (const player of OPEN_MENUS.keys()) {
    if (!player?.isRegistered?.() || player.getMovementQueue().size() > 0 || player.getForceMovement() != null) {
      closeInterface(player);
    }
  }
}

function selectQuantity({ player, buttonId: id }) {
  const mode = QUANTITY_MODE_COMPONENTS.get(id & 0xffff);
  if (mode === undefined) return false;
  if (mode !== "x") {
    SELECTED_QUANTITY.set(player, mode);
    return true;
  }
  player.setEnteredAmountAction({
    execute: (amount) => {
      if (Number.isInteger(amount) && amount > 0) SELECTED_QUANTITY.set(player, amount);
    },
  });
  player.getPacketSender().sendEnterAmountPrompt("How many would you like to make?");
  return true;
}

function chooseProduct({ player, buttonId: id }) {
  const bar = OPEN_MENUS.get(player);
  if (player.getInterfaceId() !== Data.SMITHING_INTERFACE || bar == null) return false;
  const product = Data.productsFor(bar).find((candidate) => candidate.component === (id & 0xffff));
  if (!product) return false;

  const selected = SELECTED_QUANTITY.get(player) ?? 1;
  OPEN_MENUS.delete(player);
  const started = startSmithing(player, product, selected === "all" ? ALL_QUANTITY_CAP : selected);
  if (started) closeInterface(player);
  return started;
}

function anvilAccess(event) {
  const request = { player: event.player, object: event.object, denied: false };
  Core.api.emitCustomEvent("smithing:anvil-access", request);
  return !request.denied;
}

function smith(event) {
  if (anvilAccess(event)) openInterface(event.player);
}

function smithRustedAnvil(event) {
  if (!anvilAccess(event)) return;
  if (!event.player.getInventory().contains(Core.ItemIdentifiers.BRONZE_BAR)) {
    event.player.sendMessage(RUSTED_ANVIL_BRONZE_ONLY_MESSAGE);
    return;
  }
  openInterface(event.player, Core.ItemIdentifiers.BRONZE_BAR);
}

/** A bar used on an anvil opens the interface on that bar. */
function useOnAnvil(event) {
  const { player, object, itemId } = event;
  if (!Data.BAR_TYPE_BY_BAR.has(itemId)) return;
  event.handled = true;
  if (!anvilAccess(event)) return;
  if (object.getDefinition().getName() === "Rusted anvil" && itemId !== Core.ItemIdentifiers.BRONZE_BAR) {
    player.sendMessage(RUSTED_ANVIL_BRONZE_ONLY_MESSAGE);
    return;
  }
  openInterface(player, itemId);
}

function forget(player) {
  OPEN_MENUS.delete(player);
  SELECTED_QUANTITY.delete(player);
}

module.exports = function attach(api) {
  api.onObjectInteraction("Anvil", { Smith: smith });
  api.onObjectInteraction("An experimental anvil", { Use: smith });
  api.onObjectInteraction("Rusted anvil", { Smith: smithRustedAnvil });
  api.onInterfaceActionButton([...QUANTITY_MODE_COMPONENTS.keys()].map(buttonId), selectQuantity);
  api.onInterfaceActionButton(range(FIRST_PRODUCT_COMPONENT, LAST_PRODUCT_COMPONENT).map(buttonId), chooseProduct);
};

Object.assign(module.exports, { ANVIL_NAMES: ["Anvil", "An experimental anvil", "Rusted anvil"], useOnAnvil, closeAbandonedMenus, forget });
