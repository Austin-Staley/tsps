/**
 * Soar Leader Pitri at the Hunter Guild: Recharge-whistle, his "Can you recharge my whistle?",
 * and the whistle blueprints, all through his transcript (npc-dialogues.json) - this unit only
 * answers its conditions and its "receive" steps.
 *
 * Recharging (Wiki whistle pages, rsprox 237/4003 and 237/4051): raw hunter meat and quetzal
 * feed in the inventory, unnoted, go into the first chargeable whistle until it is full, at the
 * Wiki's charges per item; charges past the whistle's capacity are lost. Being full by the end
 * is what picks "Looks like the birds are all full..." over "There you go...".
 *
 * Blueprints: a free basic blueprint after ten Hunters' Rumours (the count is Hunter's, over
 * `hunter:rumours-completed`), more for 500 coins.
 */
const Common = require("./Common.Quetzals");
const Whistle = require("./Whistle.Quetzals");

const PITRI = "Soar Leader Pitri";
const RECHARGE_VARIANT = "standard-dialogue-choosing-the-recharge-whistle-option";
const BLUEPRINT_TARGET = "a Basic quetzal whistle blueprint";
const BASIC_BLUEPRINT = "hg_whistle_blueprint_1";
const BLUEPRINT_CLAIMED_ATTRIBUTE = "quetzals:free-blueprint-claimed";

function meats() {
  return Object.entries(Common.data.meatCharges).map(([name, charges]) => ({ id: Common.obj(name), charges }));
}

/** The whistle Pitri charges: the first one in the inventory that holds charges. */
function chargeableWhistle(player) {
  for (const item of player.getInventory().getItems()) {
    const whistle = item ? Whistle.whistleOf(item.getId()) : null;
    if (whistle && whistle.charges != null) return whistle;
  }
  return null;
}

function hasWhistle(player) {
  return player.getInventory().getItems().some((item) => item && Whistle.whistleOf(item.getId()));
}

function hasMeat(player) {
  const inventory = player.getInventory();
  return meats().some(({ id }) => id != null && inventory.contains(id));
}

function full(player, whistle) {
  return Whistle.chargesOf(player, whistle) >= whistle.charges;
}

/** Feeds the inventory's meat, slot by slot, into the whistle until it is full. */
function recharge(player) {
  const whistle = chargeableWhistle(player);
  if (!whistle) return;
  const inventory = player.getInventory();
  const values = new Map(meats().map(({ id, charges }) => [id, charges]));
  let charges = Whistle.chargesOf(player, whistle);
  let fed = false;
  // Ids first: a deleted slot's Item turns into an empty one.
  const ids = [...new Set(inventory.getItems().map((item) => item?.getId?.()).filter((id) => values.has(id)))];
  for (const id of ids) {
    while (charges < whistle.charges && inventory.contains(id)) {
      inventory.delete(id, 1);
      charges += values.get(id);
      fed = true;
    }
    if (charges >= whistle.charges) break;
  }
  if (!fed) return;
  inventory.refreshItems?.();
  Whistle.setCharges(player, whistle, charges);
}

function rumoursCompleted(player) {
  const request = { player, completed: 0 };
  Common.api.emitCustomEvent("hunter:rumours-completed", request);
  return Number(request.completed) || 0;
}

function freeBlueprintDue(player) {
  return rumoursCompleted(player) >= Common.data.freeBlueprintRumours && player.getAttribute(BLUEPRINT_CLAIMED_ATTRIBUTE) !== true;
}

/** Pitri's prose conditions, by what the player carries and has done. */
function answer({ player, definition, text }) {
  if (definition?.getName?.() !== PITRI) return null;
  const value = String(text).toLowerCase();
  const whistle = chargeableWhistle(player);
  if (value.includes("free whistle blueprint")) return freeBlueprintDue(player);
  if (value.includes("not completed 10 rumours")) return rumoursCompleted(player) < Common.data.freeBlueprintRumours;
  if (value.includes("completed 10 rumours")) return rumoursCompleted(player) >= Common.data.freeBlueprintRumours;
  if (value.includes("does not have a whistle")) return !hasWhistle(player);
  if (value.includes("no raw hunter meats/quetzal feed") && value.includes("fully charged")) {
    return hasWhistle(player) && (!hasMeat(player) || !whistle || full(player, whistle));
  }
  if (value.includes("at least one raw hunter meat")) {
    if (!whistle || !hasMeat(player) || full(player, whistle)) return false;
    recharge(player);
    return true;
  }
  if (value.includes("fully charged after exchanging") || value.includes("partially charged after exchanging")) {
    if (!whistle) return false;
    recharge(player);
    return value.includes("fully") === full(player, whistle);
  }
  if (value.includes("no raw hunter meats")) return !hasMeat(player);
  if (value.includes("one raw hunter meat")) return hasMeat(player);
  if (value.includes("has a whistle in their inventory")) return hasWhistle(player);
  return null;
}

/** The transcript's "receive a Basic quetzal whistle blueprint": free once, then 500 coins. */
function giveBlueprint(event) {
  if (event.action !== "receive" || event.target !== BLUEPRINT_TARGET) return;
  if (event.definition?.getName?.() !== PITRI) return;
  event.handled = true;
  const { player } = event;
  const inventory = player.getInventory();
  const free = freeBlueprintDue(player);
  const coins = Common.core.ItemIdentifiers.COINS;
  if (!free && inventory.getAmount(coins) < Common.data.blueprintCost) {
    player.sendMessage(Common.message("blueprintCoins"));
    event.end = true;
    return;
  }
  if (free) player.setAttribute(BLUEPRINT_CLAIMED_ATTRIBUTE, true);
  else inventory.delete(coins, Common.data.blueprintCost);
  inventory.add(new Common.core.Item(Common.obj(BASIC_BLUEPRINT), 1), true);
}

function rechargeWhistle({ player, npc, definition }) {
  const request = { player, npc, npcId: definition?.getId?.() ?? npc?.getId?.(), variant: RECHARGE_VARIANT, exact: true, handled: false };
  Common.api.emitCustomEvent("npc-dialogue:start", request);
  return request.handled;
}

function attach(api) {
  api.persistAttribute(BLUEPRINT_CLAIMED_ATTRIBUTE, false);
  api.onNpcInteraction(PITRI, { "Recharge-whistle": rechargeWhistle });
  api.onNpcDialogueCondition(answer);
  api.onCustomEvent("npc-dialogue:action", giveBlueprint);
}

module.exports = { attach, answer, recharge, giveBlueprint, rechargeWhistle, BLUEPRINT_CLAIMED_ATTRIBUTE };
