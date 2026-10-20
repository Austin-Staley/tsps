/**
 * Using one ingredient on another: herb into a vial, secondary into an unfinished potion, and
 * the potions finished potions upgrade into. Recipes, levels, XP and ticks are the Wiki's
 * (plugins/skills/data/herblore.json); animation, sound and messages are from rsprox captures.
 */
const Common = require("./Common.Herblore");

/** Mixing a secondary into a potion (rsprox captures; the vial and unfinished potion steps). */
const COMBINE_LEVEL_MESSAGE = (level) => `You need a Herblore level of ${level} to combine those.`;
/** Adding to a finished potion (rsprox captures). */
const UPGRADE_LEVEL_MESSAGE = (level) => `You need level ${level} Herblore to upgrade the potion.`;
/** Super antifire before Dragon Slayer II (rsprox captures). */
const SUPER_ANTIFIRE_QUEST_MESSAGE = "You don't know how to make super antifire potions yet. Maybe someone can teach you.";

function hasIngredients(inventory, recipe) {
  return recipe.ingredients.every(({ id, count }) => inventory.getAmount(id) >= count);
}

/** The product's dose count, from its name ("Sanfew serum(4)"). */
function doses(productId) {
  const match = /\((\d)\)$/.exec(Common.core.ItemDefinition.forId(productId).getName());
  return match ? Number(match[1]) : 1;
}

function message(recipe) {
  return recipe.message
    .replace("{count}", String(recipe.ingredients[recipe.ingredients.length - 1].count))
    .replace("{doses}", String(doses(recipe.productId)));
}

/**
 * One potion: the ingredients go, the product (and any emptied vials) come, with XP. A grimy herb
 * the Herblore cape cleans on the way in says so and gives its cleaning XP, without the mixing
 * animation or sound (rsprox captures).
 */
function makeOne(player, recipe) {
  const inventory = player.getInventory();
  if (!hasIngredients(inventory, recipe)) return false;
  for (const { id, count } of recipe.ingredients) inventory.deleteNumber(id, count);
  inventory.addItem(new Common.core.Item(recipe.productId, 1));
  for (const { id, count } of recipe.returns) inventory.addItem(new Common.core.Item(id, count));
  if (recipe.cleaned) {
    Common.spam(player, `You clean the ${Common.core.ItemDefinition.forId(recipe.cleaned.grimyId).getName()}.`);
    Common.addXp(player, recipe.cleaned.xp);
  } else {
    Common.animate(player, Common.MIX_ANIMATION);
    Common.sound(player, Common.MIX_SOUND);
  }
  Common.spam(player, message(recipe));
  Common.addXp(player, recipe.xp);
  return true;
}

/**
 * Wiki (Herblore cape): wearing it, a grimy herb goes straight into the vial if the player could
 * clean it; these are the clean herb's recipes taking the grimy herb instead.
 */
function capeRecipes(player, firstId, secondId) {
  for (const [grimyId, otherId] of [[firstId, secondId], [secondId, firstId]]) {
    const herb = Common.herbFor(grimyId);
    if (!herb || Common.level(player) < herb.level || !Common.wearsHerbloreCape(player)) continue;
    return Common.recipesWith(herb.cleanId, otherId).map((recipe) => ({
      ...recipe,
      cleaned: herb,
      ingredients: recipe.ingredients.map((item) => item.id === herb.cleanId ? { ...item, id: grimyId } : item),
    }));
  }
  return [];
}

/** The recipe these two items make for this player, or null after saying why not. */
function chooseRecipe(player, recipes) {
  if (!Common.canUseHerblore(player)) return null;
  const known = recipes.filter((recipe) => !recipe.quest || Common.questDone(player, recipe.quest));
  if (known.length === 0) {
    player.sendMessage(recipes.some((recipe) => recipe.quest === "dragon_slayer_ii")
      ? SUPER_ANTIFIRE_QUEST_MESSAGE : "Nothing interesting happens.");
    return null;
  }
  const level = Common.level(player);
  const able = known.filter((recipe) => level >= recipe.level);
  if (able.length === 0) {
    const lowest = known[0];
    player.sendMessage((lowest.upgrade ? UPGRADE_LEVEL_MESSAGE : COMBINE_LEVEL_MESSAGE)(lowest.level));
    return null;
  }
  const recipe = able.find((candidate) => hasIngredients(player.getInventory(), candidate));
  if (!recipe) player.sendMessage("Nothing interesting happens.");
  return recipe ?? null;
}

function mix(event) {
  const { player, usedItemId, usedWithItemId } = event;
  const found = Common.recipesWith(usedItemId, usedWithItemId);
  const recipes = found.length > 0 ? found : capeRecipes(player, usedItemId, usedWithItemId);
  if (recipes.length === 0) return;
  event.handled = true;
  const recipe = chooseRecipe(player, recipes);
  if (recipe) makeOne(player, recipe);
}

module.exports = function attachMixing(api) {
  api.onItemOnItem(mix, { noted: false });
};
