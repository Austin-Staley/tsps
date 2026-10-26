"use strict";

/** Shared player charges, not item metadata (Wiki: Bracelet of slaughter; docs/slayer.md). */
const CHARGES_ATTRIBUTE = "slayer:slaughter-charges";
const MAX_CHARGES = 30;
const ACTIVATION_CHANCE = 0.25;
const REGENERATION_CHANCE = 0.1;
const EXCLUDED_MONSTERS = new Set(["TzTok-Jad", "TzKal-Zuk"]);
const ACTIVATION_MESSAGE = "Your bracelet of slaughter prevents your slayer count from decreasing.";

let api = null;
let core = null;

function init(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
}

function charges(player) {
  const saved = player.getAttribute(CHARGES_ATTRIBUTE);
  return Number.isInteger(saved) && saved > 0 && saved <= MAX_CHARGES ? saved : MAX_CHARGES;
}

function isBracelet(item) {
  return item?.getId() === core.ItemIdentifiers.BRACELET_OF_SLAUGHTER;
}

/** Called for an eligible task kill, after its Slayer XP, at the point the count would fall. */
function preventsDecrement(player, npc, random = Math.random) {
  const equipment = player.getEquipment();
  if (!isBracelet(equipment.getItems()[core.Equipment.HANDS_SLOT])) return false;
  const name = (npc.getCurrentDefinition?.() ?? npc.getDefinition()).getName();
  if (EXCLUDED_MONSTERS.has(name) || random() >= ACTIVATION_CHANCE) return false;

  const remaining = charges(player) - 1;
  player.setAttribute(CHARGES_ATTRIBUTE, remaining || MAX_CHARGES);
  let suffix;
  if (remaining > 0) {
    suffix = `It has ${remaining} charge${remaining === 1 ? "" : "s"} left.`;
  } else {
    const reward = { player, tier: "Elite", unlocked: false };
    api.emitCustomEvent("combat-achievements:tier", reward);
    if (reward.unlocked && random() < REGENERATION_CHANCE) {
      suffix = "It then regenerates itself to full charge!";
    } else {
      equipment.set(core.Equipment.HANDS_SLOT, new core.Item(-1));
      equipment.refreshItems();
      suffix = "It then crumbles to dust.";
    }
  }
  // The supplied live capture sends this as message_game type=spam.
  player.getPacketSender().sendTypedMessage(core.ChatType.SPAM, `${ACTIVATION_MESSAGE} ${suffix}`);
  return true;
}

function check({ player, item }) {
  if (!isBracelet(item)) return false;
  const remaining = charges(player);
  player.sendMessage(`Your bracelet of slaughter has ${remaining} charge${remaining === 1 ? "" : "s"} left.`);
}

function breakBracelet({ player, item, slot, interfaceId }) {
  if (!isBracelet(item) || interfaceId === core.Equipment.INVENTORY_INTERFACE_ID) return false;
  const inventory = player.getInventory();
  if (inventory.get(slot) !== item) return false;
  inventory.deleteAtSlot(slot, 1);
  player.setAttribute(CHARGES_ATTRIBUTE, MAX_CHARGES);
  player.sendMessage("You break the bracelet of slaughter. Your next bracelet will start with 30 charges.");
}

function attach(pluginApi) {
  pluginApi.persistAttribute(CHARGES_ATTRIBUTE, MAX_CHARGES);
  pluginApi.onItemAction("Bracelet of slaughter", { Check: check, Break: breakBracelet });
}

module.exports = { init, attach, preventsDecrement, charges, CHARGES_ATTRIBUTE };
