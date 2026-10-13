"use strict";

/**
 * The preform: worn in the weapon slot while it is worked, kept warm in the preform storage, and
 * stored there automatically when the player leaves the cave or logs out. Its HUD (754) is open
 * whenever it is worn.
 *
 * rsprox captures (recording 101): Store-preform and Take-preform play human_furnace, flip
 * preform_stored, and close or reopen the HUD with the combat tab's header.
 */

const Shared = require("./Shared.GiantsFoundry");

const ANIM_STORAGE = 899; // human_furnace
const HEADER_COMPONENT = 2; // combat_interface:header

const MESSAGE = {
  STORED: "<col=229628>You place the preform in the handy storage area. It should stay nice and warm there.",
  TAKEN: "You take the preform from the handy storage area. It will start to get cold now.",
  KEPT_WARM: "You notice your current commission is being kept warm in the preform storage.",
  FREE_HANDS: "You must free your hands so you can hold the preform.",
  NOTHING_STORED: "There is no preform in the storage.",
  NOTHING_TO_STORE: "You have no preform to store.",
};

function hasFreeHands(player) {
  const { Equipment } = Shared.core();
  const equipment = player.getEquipment();
  return !equipment.get(Equipment.WEAPON_SLOT)?.isValid?.() && !equipment.get(Equipment.SHIELD_SLOT)?.isValid?.();
}

function refreshWeapon(player) {
  const { WeaponInterfaceManager, Flag } = Shared.core();
  player.getEquipment().refreshItems();
  WeaponInterfaceManager.assign(player);
  Shared.api().getBonusManager().update(player);
  player.getUpdateFlag().flag(Flag.APPEARANCE);
}

function openHud(player) {
  player.getPacketSender().sendSubInterface(Shared.OVERLAY_HUD_UID, Shared.INTERFACE.HUD, 1);
}

function closeHud(player) {
  player.getPacketSender().closeSubInterface(Shared.OVERLAY_HUD_UID);
}

/** Puts the preform in the player's hands, with its combat tab header and HUD. */
function equip(player) {
  const { Equipment, Item } = Shared.core();
  player.getEquipment().setItem(Equipment.WEAPON_SLOT, new Item(Shared.ITEM.PREFORM, 1));
  refreshWeapon(player);
  player.getPacketSender().sendString("Preform", (Shared.INTERFACE.COMBAT_TAB << 16) | HEADER_COMPONENT);
  openHud(player);
}

/** Takes the preform out of the player's hands. */
function unequip(player) {
  const { Equipment, Item } = Shared.core();
  if (!Shared.wornPreform(player)) return false;
  player.getEquipment().setItem(Equipment.WEAPON_SLOT, new Item(-1, 0));
  refreshWeapon(player);
  closeHud(player);
  return true;
}

/** The preform goes into the storage, keeping its heat and progress. */
function store(player) {
  if (!unequip(player)) return false;
  Shared.set(player, Shared.VARBIT.PREFORM_STORED, 1);
  return true;
}

function storePreform({ player }) {
  if (!Shared.wornPreform(player)) {
    player.sendMessage(MESSAGE.NOTHING_TO_STORE);
    return;
  }
  Shared.stopWork(player);
  Shared.animate(player, ANIM_STORAGE);
  store(player);
  player.sendMessage(MESSAGE.STORED);
}

function takePreform({ player }) {
  if (Shared.get(player, Shared.VARBIT.PREFORM_STORED) !== 1) {
    player.sendMessage(MESSAGE.NOTHING_STORED);
    return;
  }
  if (!hasFreeHands(player)) {
    Shared.statement(player, MESSAGE.FREE_HANDS);
    return;
  }
  Shared.animate(player, ANIM_STORAGE);
  Shared.set(player, Shared.VARBIT.PREFORM_STORED, 0);
  equip(player);
  player.sendMessage(MESSAGE.TAKEN);
}

/** The preform never leaves the foundry: walking out, teleporting or logging out stores it. */
function storeOnLeave(player) {
  if (Shared.wornPreform(player)) store(player);
}

function noticeStoredPreform(player) {
  if (Shared.get(player, Shared.VARBIT.PREFORM_STORED) === 1) player.sendMessage(MESSAGE.KEPT_WARM);
}

/**
 * The preform can only be taken off at the preform storage (Wiki). No capture shows the
 * refusal's message, so it is refused silently.
 */
function keepPreformWorn(event) {
  if (event.item?.getId?.() !== Shared.ITEM.PREFORM) return;
  event.allow = false;
}

/** A preform worn outside the cave (an old save) goes back into storage. */
function checkLogin({ player }) {
  if (Shared.wornPreform(player) && !Shared.inRoom(player.getLocation())) store(player);
  else if (Shared.wornPreform(player)) openHud(player);
}

module.exports = function attachPreform(api) {
  api.onObjectInteraction(Shared.OBJECT.PREFORM_STORAGE, { "Store-preform": storePreform, "Take-preform": takePreform });
  api.onCanUnequip(keepPreformWorn);
  api.onPlayerLogin(checkLogin);
};

Object.assign(module.exports, {
  hasFreeHands, equip, unequip, store, storeOnLeave, noticeStoredPreform, openHud, closeHud, MESSAGE,
});
