"use strict";

/**
 * The Fractured Archive's reward items that do something when used (docs/fractured-archive.md).
 *
 * Horn of Bran (https://oldschool.runescape.wiki/w/Horn_of_Bran): taken to King Arthur in Camelot
 * it unlocks the Zeal prayer for good (varbit prayer_zeal_unlocked). The Wiki has a cutscene and
 * dialogue there; this is the unlock without them. Zeal itself is core's PrayerData.ZEAL: Prayer 84,
 * Attack 75, Strength 75 and, from the cache's unlock table (dbrow 17168), Defence 70.
 *
 * Archivist's folio (https://oldschool.runescape.wiki/w/Archivist%27s_folio): Read teleports to
 * the lobby, Charge/ascension shards add 5 charges each, Check says how many. Out of charges it
 * is the inert folio. The Wiki gives no cap or wilderness limit: *estimates* of no cap and 20.
 */

const ZEAL_UNLOCKED_ATTRIBUTE = "prayer:zeal-unlocked";
const FOLIO_CHARGES_ATTRIBUTE = "fractured-archive:folio-charges";
const ZEAL_UNLOCKED_VARBIT = 16578;
const ZEAL_ATTACK = 75;
const ZEAL_STRENGTH = 75;
const ZEAL_DEFENCE = 70;
const CHARGES_PER_SHARD = 5;
const WILDERNESS_LIMIT = 20;
const LOBBY = { x: 4127, y: 5508, z: 0 };

let core = null;

const charges = (player) => Number(player.getAttribute(FOLIO_CHARGES_ATTRIBUTE)) || 0;
const plural = (count) => `${count} charge${count === 1 ? "" : "s"}`;

// ---------------------------------------------------------------- Zeal

function syncZeal({ player }) {
  player.getPacketSender().sendVarbit(ZEAL_UNLOCKED_VARBIT, player.getAttribute(ZEAL_UNLOCKED_ATTRIBUTE) === true ? 1 : 0);
}

function showHornToArthur(event) {
  const { player, definition } = event;
  if (event.itemId !== core.ItemIdentifiers.HORN_OF_BRAN || definition?.getName?.() !== "King Arthur") return;
  event.handled = true;
  if (player.getAttribute(ZEAL_UNLOCKED_ATTRIBUTE) === true) {
    player.sendMessage("You have already unlocked that prayer.");
    return;
  }
  player.getInventory().deleteNumber(core.ItemIdentifiers.HORN_OF_BRAN, 1);
  player.setAttribute(ZEAL_UNLOCKED_ATTRIBUTE, true);
  syncZeal({ player });
  player.sendMessage("You have unlocked the Zeal prayer.");
}

function zealRequirements(event) {
  if (event.prayer !== core.PrayerData.ZEAL) return;
  const skills = event.player.getSkillManager();
  const { Skill } = core;
  if (event.player.getAttribute(ZEAL_UNLOCKED_ATTRIBUTE) !== true) {
    event.message = "You have not unlocked that prayer.";
  } else if (skills.getMaxLevel(Skill.ATTACK) < ZEAL_ATTACK || skills.getMaxLevel(Skill.STRENGTH) < ZEAL_STRENGTH
    || skills.getMaxLevel(Skill.DEFENCE) < ZEAL_DEFENCE) {
    event.message = `You need ${ZEAL_ATTACK} Attack, ${ZEAL_STRENGTH} Strength and ${ZEAL_DEFENCE} Defence to use Zeal.`;
  } else {
    return;
  }
  event.disabled = true;
}

// ---------------------------------------------------------------- the folio

/** Sets the charges, and swaps the folio between charged and inert when they start or run out. */
function setCharges(player, count, slot) {
  const before = charges(player);
  player.setAttribute(FOLIO_CHARGES_ATTRIBUTE, count);
  if ((before > 0) === (count > 0)) return;
  const { Item, ItemIdentifiers } = core;
  const id = count > 0 ? ItemIdentifiers.ARCHIVISTS_FOLIO : ItemIdentifiers.ARCHIVISTS_FOLIO_INERT_;
  player.getInventory().setItem(slot, new Item(id, 1));
  player.getInventory().refreshItems();
}

function checkFolio({ player }) {
  player.sendMessage(charges(player) > 0
    ? `Your folio has ${plural(charges(player))} left.`
    : "Your folio has no charges. It can be charged with ascension shards.");
}

function readFolio({ player, slot }) {
  if (charges(player) <= 0) {
    checkFolio({ player });
    return;
  }
  const target = new core.Location(LOBBY.x, LOBBY.y, LOBBY.z);
  if (!core.TeleportHandler.checkReqs(player, target, WILDERNESS_LIMIT)) return;
  core.TeleportHandler.teleport(player, target, core.TeleportType.NORMAL, false, () => {
    setCharges(player, charges(player) - 1, slot);
    player.sendMessage(`Your folio has ${plural(charges(player))} left.`);
  });
}

function chargeFolio({ player, slot }) {
  const inventory = player.getInventory();
  const shards = inventory.getAmount(core.ItemIdentifiers.ASCENSION_SHARDS);
  if (shards <= 0) {
    player.sendMessage("You need ascension shards to charge the folio.");
    return;
  }
  inventory.deleteNumber(core.ItemIdentifiers.ASCENSION_SHARDS, shards);
  setCharges(player, charges(player) + shards * CHARGES_PER_SHARD, slot);
  checkFolio({ player });
}

function chargeWithShards({ player, usedItemId, usedItemSlot, usedWithItemSlot }) {
  const folioSlot = usedItemId === core.ItemIdentifiers.ASCENSION_SHARDS ? usedWithItemSlot : usedItemSlot;
  chargeFolio({ player, slot: folioSlot });
}

module.exports = function registerFracturedArchiveRewards(api) {
  core = api.core;
  api.persistAttribute(ZEAL_UNLOCKED_ATTRIBUTE, false);
  api.persistAttribute(FOLIO_CHARGES_ATTRIBUTE, 0);
  api.onPlayerLogin(syncZeal);
  api.onPrayerDisabled(zealRequirements);
  api.onItemOnNpc(showHornToArthur);
  for (const folio of ["Archivist's folio", "Archivist's folio (inert)"]) {
    api.onItemAction(folio, { Read: readFolio, Charge: chargeFolio, Check: checkFolio });
    api.onItemOnItem("Ascension shards", folio, chargeWithShards);
  }
};
module.exports._test = { zealRequirements, readFolio, chargeFolio, showHornToArthur, chargeWithShards };
