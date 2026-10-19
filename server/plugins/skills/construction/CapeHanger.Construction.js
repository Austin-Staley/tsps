"use strict";

const { api, Animation, CacheDefinitions, Skill } = require("./Core.Construction");
const House = require("./House.Construction");
const Mounted = require("./Mounted.Construction");

// The cape hanger (rsprox captures, Wiki): using a cape (and its hood, for capes that have one) on
// the blank hanger plays human_pickuptable and "You mount your cape and hood for display." ("You
// need both the cape and the hood for display.", "You can't display that here.", "There's
// something there already."); the hanger shows the cape's poh_mounted_* loc (data/mounted-capes.json
// from dump:construction). Take gives them back ("You remove your cape from the hanger.", "You don't
// have space to take the cape and hood."), Admire plays castlewars_pray_start, and the cape's own
// options (Teleport, Perks, Spellbook, Commune, Search) work for the owner as the worn cape's do.
// An untrimmed skillcape shows trimmed once its owner has two 99s (Wiki).
const MOUNTED = require("./data/mounted-capes.json");
const HANGER = 29166;
const PICK_UP = 832;
const ADMIRE = 6937;
const MYTHICAL_CAPE = 22114;
// Mounted cape option -> the cape item's option of the same use.
const ITEM_OPTIONS = { Perks: "Features" };

const capeLocs = new Map();
const trimmedOf = new Map();
for (const [loc, items] of Object.entries(MOUNTED)) {
  if (!capeLocs.has(items.cape)) capeLocs.set(items.cape, Number(loc));
}
// poh_mounted_<x>_cape -> poh_mounted_<x>_cape_trim are consecutive ids with the same hood.
for (const [loc, items] of Object.entries(MOUNTED)) {
  const next = MOUNTED[Number(loc) + 1];
  if (next && next.hood && next.hood === items.hood && next.cape !== items.cape) trimmedOf.set(items.cape, next.cape);
}

function hangerAt(event) {
  const house = House.houseFor(event.player);
  const furniture = house?.getFurnitureAt(event.location, event.objectId, event.object?.getType() ?? 10);
  return furniture?.buildableKey === "CAPE_HANGER" ? { house, furniture } : null;
}

function ninetyNines(player) {
  return Skill.values().filter(skill => player.getSkillManager().getMaxLevel(skill) >= 99).length;
}

/** The cape the hanger shows: an untrimmed skillcape trims itself once its owner has two 99s. */
function shownCape(house, capeId) {
  const trimmed = trimmedOf.get(capeId);
  return trimmed && house.owner && ninetyNines(house.owner) > 1 ? trimmed : capeId;
}

function show(house, furniture) {
  const mounted = furniture.mountedCape;
  if (mounted) furniture.displayObjectId = capeLocs.get(shownCape(house, mounted.cape));
  else delete furniture.displayObjectId;
  house.redrawFurniture();
  House.saveHouse(house);
}

function mount(event) {
  const found = hangerAt(event);
  if (!found) return;
  event.handled = true;
  const { house, furniture } = found;
  const player = event.player;
  const entry = Object.values(MOUNTED).find(items => items.cape === event.itemId || items.hood === event.itemId);
  if (!entry) return player.sendMessage("You can't display that here.");
  if (furniture.mountedCape) return player.sendMessage("There's something there already.");
  if (house.owner !== player) return player.sendMessage("You can only do that in your own house.");
  // The hood names the cape when it is used: the plainer cape that has it, if the player carries it.
  const cape = entry.cape === event.itemId ? entry.cape
    : Object.values(MOUNTED).map(items => items.cape).find(id => player.getInventory().contains(id) && MOUNTED[capeLocs.get(id)]?.hood === event.itemId);
  if (!cape || !capeLocs.has(cape)) return player.sendMessage("You need both the cape and the hood for display.");
  const hood = MOUNTED[capeLocs.get(cape)].hood;
  if (hood && !player.getInventory().contains(hood)) return player.sendMessage("You need both the cape and the hood for display.");
  player.getInventory().delete(cape, 1);
  if (hood) player.getInventory().delete(hood, 1);
  player.performAnimation(new Animation(PICK_UP));
  furniture.mountedCape = hood ? { cape, hood } : { cape };
  show(house, furniture);
  player.sendMessage(hood ? "You mount your cape and hood for display." : "You mount your cape for display.");
}

function take(event) {
  const found = hangerAt(event);
  const mounted = found?.furniture.mountedCape;
  if (!mounted) return false;
  const { house, furniture } = found;
  const player = event.player;
  if (house.owner !== player) return player.sendMessage("You can only do that in your own house."), true;
  if (player.getInventory().getFreeSlots() < (mounted.hood ? 2 : 1)) {
    return player.sendMessage(mounted.hood ? "You don't have space to take the cape and hood." : "You don't have space to take the cape."), true;
  }
  player.performAnimation(new Animation(PICK_UP));
  player.getInventory().adds(shownCape(house, mounted.cape), 1);
  if (mounted.hood) player.getInventory().adds(mounted.hood, 1);
  delete furniture.mountedCape;
  show(house, furniture);
  player.sendMessage("You remove your cape from the hanger.");
  return true;
}

function admire(event) {
  if (!hangerAt(event)?.furniture.mountedCape) return false;
  event.player.performAnimation(new Animation(ADMIRE));
  return true;
}

/** Teleport, Perks, Spellbook, Commune, Search: the owner uses the mounted cape as if worn. */
function capeOption(event) {
  const found = hangerAt(event);
  const mounted = found?.furniture.mountedCape;
  if (!mounted) return false;
  const player = event.player;
  if (found.house.owner !== player) return player.sendMessage("Only the owner of the house can use the cape's powers."), true;
  const option = event.definition?.getInteractions?.()?.[event.clickType - 1] ?? event.option;
  if (option === "Teleport" && mounted.cape === MYTHICAL_CAPE) return Mounted.mythicalCapeTeleport(event);
  const request = { player, itemId: shownCape(found.house, mounted.cape), option: ITEM_OPTIONS[option] ?? option, clickType: 1, handled: false };
  api.emitCustomEvent("skillcape:operate", request);
  if (!request.handled) player.sendMessage("Nothing interesting happens.");
  return true;
}

function attachCapeHanger(api) {
  const options = { Admire: admire, Take: take, Teleport: capeOption, Perks: capeOption, Spellbook: capeOption, Commune: capeOption, Search: capeOption };
  const names = new Set();
  for (const loc of Object.keys(MOUNTED)) names.add(CacheDefinitions.getObject(Number(loc))?.name);
  for (const name of names) if (name) api.onObjectInteraction(name, options);
  api.onItemOnObject((event) => {
    const found = event.objectId === HANGER || MOUNTED[event.objectId] ? hangerAt(event) : null;
    if (found) mount(event);
  }, { noted: false });
}

Object.assign(module.exports, { attachCapeHanger });
