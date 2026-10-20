/**
 * Smelting at a furnace: the Smelt menu (the shared skillmulti CreationMenu), ore used on a
 * furnace, and the smelt loop. A carried coal bag's coal is used after the inventory's
 * (docs/storage-items.md).
 *
 * Captured (rsprox, docs/smithing.md): choosing a bar plays human_furnace (899) with sound 2725
 * and the "You smelt ..." message on the same tick; the bar, "You retrieve a bar of ..." and
 * the XP come 4 ticks later, and the next ore starts on the 5th. Iron fails half the time:
 * "The ore is too impure and you fail to refine it." With no ore at all the furnace says "You
 * don't have any ore to smelt." in a message box.
 */
const Core = require("./Core.Smithing");
const Data = require("./Data.Smithing");
const Sessions = require("./Sessions.Smithing");

const SMELT_ANIMATION = 899;
// Wiki: goldsmith gauntlets (or the Smithing or max cape) raise gold bar XP from 22.5 to 56.2.
const GOLDSMITH_GAUNTLETS_BONUS_XP = 33.7;
const SMELT_TITLE = "What would you like to smelt?";
const NO_ORE_MESSAGE = "You don't have any ore to smelt.";
const SMELT_INTERVAL_TICKS = 5;
const SMELT_FINISH_TICKS = 4;
/** The skillmulti list's quantity cap, also what the old menu clamped to. */
const MAX_QUANTITY = 28;

/** Every furnace loc, for the bots' object catalog. Filled in when the plugin registers. */
const FURNACE_OBJECT_IDS = new Set();

/** The list's op flags (Make 1/5/10/X/All, bits 1-5); the CreationMenu sends the same. */
const SMELTING_SKILLMULTI_OP_FLAGS = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5);

/** The skillmulti list sends the chosen quantity itself; a bare click sends 0 (make one). */
function quantityForSmeltAction(action) {
  return Number.isInteger(action) && action > 0 ? Math.min(action, MAX_QUANTITY) : 1;
}

/** What a carried container (the coal bag) holds of an ingredient ("storage:amount"). */
function storedAmount(player, itemId) {
  const request = { player, itemId, amount: 0 };
  Core.api.emitCustomEvent("storage:amount", request);
  return request.amount;
}

function available(player, itemId) {
  return player.getInventory().getAmount(itemId) + storedAmount(player, itemId);
}

function hasIngredients(player, recipe) {
  return recipe.ingredients.every(([itemId, amount]) => available(player, itemId) >= amount);
}

/** How many of a recipe the player's ore (and coal bag) covers. */
function batches(player, recipe) {
  return Math.min(...recipe.ingredients.map(([itemId, amount]) => Math.floor(available(player, itemId) / amount)));
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

function statement(player, text) {
  const { DialogueChainBuilder, StatementDialogue } = Core;
  player.getDialogueManager().startDialogues(new DialogueChainBuilder().add(new StatementDialogue(0, text)));
}

function levelOf(player, recipe) {
  return player.getSkillManager().getCurrentLevel(recipe.skill ?? Core.Skill.SMITHING);
}

/**
 * The Gold bar choice smelts Family Crest's 'perfect' gold ore when that is all the gold ore
 * the player has.
 */
function resolveRecipe(player, recipe) {
  if (recipe.barId !== Core.ItemIdentifiers.GOLD_BAR || hasIngredients(player, recipe)) return recipe;
  const perfect = Data.SMELTING_RECIPES.find((candidate) => candidate.barId === Core.ItemIdentifiers.PERFECT_GOLD_BAR);
  return perfect && hasIngredients(player, perfect) ? perfect : recipe;
}

/** Opens the cycle: the message, animation and sound; the ore goes in on the finish tick. */
function beginSmelt(player, recipe) {
  if (!hasIngredients(player, recipe)) {
    player.sendMessage(recipe.missingMessage);
    return false;
  }
  if (recipe.smeltMessage) player.sendMessage(recipe.smeltMessage);
  player.performAnimation(new Core.Animation(SMELT_ANIMATION));
  Core.Sounds.sendSound(player, Core.Sound.SMELTING);
  return true;
}

function finishSmelt(player, recipe) {
  if (!hasIngredients(player, recipe)) {
    player.sendMessage(recipe.missingMessage);
    return false;
  }
  consumeIngredients(player, recipe);
  const inventory = player.getInventory();
  for (const [itemId, amount] of recipe.byproducts ?? []) inventory.addItem(new Core.Item(itemId, amount));
  const outcome = { player, recipe, success: Math.random() < (recipe.successChance ?? 1), bars: 1 };
  Core.api.emitCustomEvent("smithing:smelt-outcome", outcome);
  if (!outcome.success) {
    player.sendMessage(recipe.failMessage);
    return true;
  }
  const skill = recipe.skill ?? Core.Skill.SMITHING;
  inventory.addItem(new Core.Item(recipe.barId, outcome.bars));
  player.getSkillManager().addExperiences(skill, smeltingXp(player, recipe) * outcome.bars);
  if (recipe.retrieveMessage) player.sendMessage(recipe.retrieveMessage);
  Core.api.emitCustomEvent("smelting:success", { player, skill, itemId: recipe.barId });
  return true;
}

function startSmelting(player, chosen, amount) {
  if (!chosen || !Number.isInteger(amount) || amount <= 0) return false;
  const recipe = resolveRecipe(player, chosen);
  if (recipe.quest && !Core.questComplete(player, recipe.quest)) {
    player.sendMessage(`You need to complete ${Data.questName(recipe.quest)} to smelt ${recipe.barPhrase}.`);
    return false;
  }
  if (levelOf(player, recipe) < recipe.level) {
    statement(player, `You need a Smithing level of ${recipe.level} to smelt ${recipe.barPhrase}.`);
    return false;
  }
  if (!hasIngredients(player, recipe)) {
    player.sendMessage(recipe.missingMessage);
    return false;
  }
  Sessions.start(player, {
    type: "smelt",
    remaining: amount,
    interval: SMELT_INTERVAL_TICKS,
    finishDelay: SMELT_FINISH_TICKS,
    begin: (smelter) => beginSmelt(smelter, recipe),
    step: (smelter) => finishSmelt(smelter, recipe),
  });
  return true;
}

function isSmeltingActive(player) {
  return Sessions.typeOf(player) === "smelt";
}

function openMenu(player, recipes) {
  const { CreationMenu } = Core;
  const byBar = new Map(recipes.map((recipe) => [recipe.barId, recipe]));
  const most = Math.max(1, ...recipes.map((recipe) => batches(player, resolveRecipe(player, recipe))));
  player.getPacketSender().sendCreationMenu(
    new CreationMenu(SMELT_TITLE, [...byBar.keys()], { execute: (barId, amount) => startSmelting(player, byBar.get(barId), amount) }, {
      maxAmount: Math.min(most, MAX_QUANTITY),
    })
  );
}

/** "Smelt" on a furnace: the menu lists every bar; with no ore at all, a message box instead. */
function smelt({ player }) {
  const recipes = Data.smeltMenuRecipes();
  const hasOre = Data.SMELTING_RECIPES.some((recipe) => !recipe.skill && recipe.ingredients.some(([id]) => id !== Core.ItemIdentifiers.COAL && available(player, id) > 0));
  if (!hasOre) {
    statement(player, NO_ORE_MESSAGE);
    return;
  }
  openMenu(player, recipes);
}

/**
 * An item used on a furnace: ore opens the Smelt menu; sand, soda ash and 'perfect' gold ore,
 * which aren't on it, open a menu of their own product.
 */
function useOnFurnace(event) {
  const recipes = Data.SMELTING_RECIPES.filter((recipe) => recipe.ingredients.some(([id]) => id === event.itemId));
  if (recipes.length === 0) return;
  event.handled = true;
  const offMenu = recipes.filter((recipe) => recipe.notInMenu);
  if (offMenu.length > 0) openMenu(event.player, offMenu);
  else smelt(event);
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
});
