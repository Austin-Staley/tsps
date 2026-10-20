/**
 * Smelting at a furnace: the Smelt menu (the skillmulti list, interface 270), using ore on a
 * furnace, and the smelt loop. A carried coal bag's coal is used after the inventory's
 * (docs/storage-items.md).
 */
const Core = require("./Core.Smithing");
const Data = require("./Data.Smithing");
const Sessions = require("./Sessions.Smithing");

const SMELT_ANIMATION = 899;
// Wiki: goldsmith gauntlets (or the Smithing or max cape) raise gold bar XP from 22.5 to 56.2.
const GOLDSMITH_GAUNTLETS_BONUS_XP = 33.7;

const SMELTING_SKILLMULTI_GROUP_ID = 270;
const SMELTING_SKILLMULTI_FIRST_ITEM_COMPONENT = 15;
const SMELTING_SKILLMULTI_MAX_QUANTITY = 28;
const SMELTING_SKILLMULTI_TARGET_UID = (162 << 16) | 568;
const SMELTING_CHATMODAL_UNCLAMP_VARBIT = 10670;
// Widget transmit flags: bit (opIndex+1) must be set for that right-click op to reach the
// server (see WidgetActionRouter.shouldTransmitAction on the client). The skillmulti list
// exposes 5 ops per item - Make 1/5/10/X/All - so ops 1-5 (bits 1-5) all need to be enabled;
// leaving only bit 1 set (as before) silently dropped every click except plain "Make 1".
const SMELTING_SKILLMULTI_OP_FLAGS = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5);
const SMELTING_INTERVAL_TICKS = 5;
// The first item in a batch produces almost immediately (1 tick), only repeats wait the full
// interval. Using the full interval for the first one too made every batch open with what
// looked like a stalled/doubled pause.
const FIRST_DELAY_TICKS = 1;

/** Every furnace loc, for the bots' object catalog. Filled in when the plugin registers. */
const FURNACE_OBJECT_IDS = new Set();
const OPEN_MENUS = new Set();

// This list is routed through the mesLayer "continue" packet (cc_resume_pausebutton, per the
// cache's skillmulti_itembutton_triggered script). Disassembly shows that opcode's childIndex
// argument is `get_varc_int 200` - the client's own "currently selected quantity" var - sent
// as the literal number, not an op/menu index. The quantity-mode buttons (1/5/10/All) and the
// native X text box (if_setonkey) all just write that var client-side; by the time an item is
// clicked, `action` already is the exact quantity to make. A bare/no-mode click sends 0.
function quantityForSmeltAction(action) {
  return Number.isInteger(action) && action > 0
    ? Math.min(action, SMELTING_SKILLMULTI_MAX_QUANTITY)
    : 1;
}

function menuButtonIds() {
  return Data.smeltMenuRecipes().map(
    (_, index) => (SMELTING_SKILLMULTI_GROUP_ID << 16) | (SMELTING_SKILLMULTI_FIRST_ITEM_COMPONENT + index)
  );
}

/** What a carried container (the coal bag) holds of an ingredient ("storage:amount"). */
function storedAmount(player, itemId) {
  const request = { player, itemId, amount: 0 };
  Core.api.emitCustomEvent("storage:amount", request);
  return request.amount;
}

function hasIngredients(player, recipe) {
  const inventory = player.getInventory();
  for (const [itemId, amount] of recipe.ingredients) {
    if (inventory.getAmount(itemId) < amount && inventory.getAmount(itemId) + storedAmount(player, itemId) < amount) {
      return false;
    }
  }
  return true;
}

/** Wiki (Coal bag): the inventory's coal goes first, then the bag's ("storage:take"). */
function consumeIngredients(player, recipe) {
  const inventory = player.getInventory();
  for (const [itemId, amount] of recipe.ingredients) {
    const held = Math.min(amount, inventory.getAmount(itemId));
    if (held > 0) inventory.deleteNumber(itemId, held);
    if (amount > held) Core.api.emitCustomEvent("storage:take", { player, itemId, amount: amount - held, taken: 0 });
  }
}

function smeltingXp(player, recipe) {
  if (recipe.barId !== Core.ItemIdentifiers.GOLD_BAR) return recipe.xp;
  const gloves = player.getEquipment().get(Core.Equipment.HANDS_SLOT)?.getId?.();
  const cape = { player, skill: "SMITHING", result: false };
  Core.api.emitCustomEvent("skillcape:has-perk", cape);
  const boosted = gloves === Core.ItemIdentifiers.GOLDSMITH_GAUNTLETS || cape.result === true;
  return boosted ? recipe.xp + GOLDSMITH_GAUNTLETS_BONUS_XP : recipe.xp;
}

function openMenu(player) {
  const recipes = Data.smeltMenuRecipes();
  const sender = player.getPacketSender();
  const itemIds = recipes.map((recipe) => recipe.barId);
  while (itemIds.length < 18) itemIds.push(-1);

  OPEN_MENUS.add(player);
  sender
    .sendInterfaceScript(2379)
    .sendVarbit(SMELTING_CHATMODAL_UNCLAMP_VARBIT, 1)
    .sendInterfaceDisplayState(SMELTING_SKILLMULTI_TARGET_UID, false)
    .sendSubInterface(SMELTING_SKILLMULTI_TARGET_UID, SMELTING_SKILLMULTI_GROUP_ID, 0);
  for (const buttonId of menuButtonIds()) {
    sender.sendInterfaceFlagsRange(buttonId, 0, SMELTING_SKILLMULTI_MAX_QUANTITY, SMELTING_SKILLMULTI_OP_FLAGS);
  }
  sender.sendInterfaceScript(2046, [
    13,
    ["What would you like to smelt?", ...recipes.map((recipe) => recipe.name)].join("|"),
    SMELTING_SKILLMULTI_MAX_QUANTITY,
    ...itemIds,
    SMELTING_SKILLMULTI_MAX_QUANTITY,
  ]);
}

function closeMenu(player) {
  if (!OPEN_MENUS.delete(player)) return;
  player
    .getPacketSender()
    .closeSubInterface(SMELTING_SKILLMULTI_TARGET_UID)
    .sendInterfaceDisplayState(SMELTING_SKILLMULTI_TARGET_UID, true);
}

/** Closes the menu of a player who walked off, died or logged out. */
function closeAbandonedMenus() {
  for (const player of OPEN_MENUS) {
    if (!player?.isRegistered?.() || player.getMovementQueue().size() > 0 || player.getForceMovement() != null) {
      closeMenu(player);
    }
  }
}

function smeltOnce(player, recipe) {
  const inventory = player.getInventory();
  const skill = recipe.skill ?? Core.Skill.SMITHING;
  const level = player.getSkillManager().getCurrentLevel(skill);
  if (level < recipe.level) {
    player.sendMessage(`You need a Smithing level of at least ${recipe.level} to smelt this bar.`);
    return false;
  }
  if (!hasIngredients(player, recipe)) {
    player.sendMessage(recipe.missingMessage ?? "You don't have the required ores to smelt this bar.");
    return false;
  }

  consumeIngredients(player, recipe);
  Core.Sounds.sendSound(player, Core.Sound.SMELTING);
  player.performAnimation(new Core.Animation(SMELT_ANIMATION));

  const successChance = recipe.successChance ?? 1;
  if (Math.random() <= successChance) {
    inventory.addItem(new Core.Item(recipe.barId, 1));
    player.getSkillManager().addExperiences(skill, smeltingXp(player, recipe));
    player.sendMessage(recipe.successMessage ?? "You retrieve a bar of metal.");
    Core.api.emitCustomEvent("smelting:success", { player, skill, itemId: recipe.barId });
  } else {
    player.sendMessage("The ore is too impure and fails to become a bar.");
  }
  return true;
}

function startSmelting(player, recipe, amount) {
  if (!recipe || !Number.isInteger(amount) || amount <= 0) return false;
  if (player.getSkillManager().getCurrentLevel(Core.Skill.SMITHING) < recipe.level) {
    player.sendMessage(`You need a Smithing level of at least ${recipe.level} to smelt this bar.`);
    return false;
  }
  if (!hasIngredients(player, recipe)) {
    player.sendMessage("You don't have the required ores to smelt this bar.");
    return false;
  }
  Sessions.start(player, {
    type: "smelt",
    remaining: amount,
    interval: SMELTING_INTERVAL_TICKS,
    firstDelay: FIRST_DELAY_TICKS,
    step: (smelter) => smeltOnce(smelter, recipe),
  });
  player.performAnimation(new Core.Animation(SMELT_ANIMATION));
  return true;
}

function isSmeltingActive(player) {
  return Sessions.typeOf(player) === "smelt";
}

function smelt({ player }) {
  openMenu(player);
}

function chooseBar({ player, buttonId, action }) {
  if (!OPEN_MENUS.has(player)) return false;
  const recipe = Data.smeltMenuRecipes()[(buttonId & 0xffff) - SMELTING_SKILLMULTI_FIRST_ITEM_COMPONENT];
  if (!recipe) return false;
  closeMenu(player);
  return startSmelting(player, recipe, quantityForSmeltAction(action));
}

/** Ore (or sand) used on a furnace smelts it straight away. */
function useOnFurnace(event) {
  const recipe = Data.SMELTING_RECIPES.find((candidate) => candidate.ingredients.some(([id]) => id === event.itemId));
  if (!recipe) return;
  smeltOnce(event.player, recipe);
  event.handled = true;
}

function forget(player) {
  OPEN_MENUS.delete(player);
}

function fillFurnaceIds() {
  for (const [name, id] of Object.entries(Core.ObjectIdentifiers)) {
    if (/^(SMALL_)?FURNACE(_\d+)?$/.test(name) && Number.isInteger(id)) FURNACE_OBJECT_IDS.add(id);
  }
}

module.exports = function attach(api) {
  fillFurnaceIds();
  // Some furnaces (e.g. Tutorial Island 10082) only offer "Use".
  api.onObjectInteraction("Furnace", { Smelt: smelt, Use: smelt });
  api.onObjectInteraction("Small furnace", { Smelt: smelt });
  api.onInterfaceActionButton(menuButtonIds(), chooseBar);
};

Object.assign(module.exports, {
  FURNACE_OBJECT_IDS,
  SMELTING_SKILLMULTI_OP_FLAGS,
  quantityForSmeltAction,
  hasIngredients,
  consumeIngredients,
  smeltingXp,
  startSmelting,
  isSmeltingActive,
  useOnFurnace,
  closeAbandonedMenus,
  forget,
});
