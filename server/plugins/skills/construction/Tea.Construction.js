"use strict";

const { CountdownTask, TaskManager } = require("./Core.Construction");
const House = require("./House.Construction");

// Tea (rsprox captures, Wiki): a full kettle (filled at a sink, WaterSources) on a stove says
// "You place the kettle over the fire." and shows the stove's kettle loc; "The kettle boils." with
// synth 935 eight ticks later, and Take-kettle gives a hot kettle ("The kettle has not boiled yet."
// before then). Tea leaves in a teapot: "You add the leaves to the teapot."; the hot kettle on it:
// "You pour the water into the teapot." (a pot of tea (4); "You should add tea leaves to the teapot
// first." without them); the pot into a cup: "You pour some tea."; milk makes it milky. Drinking is
// the Potions plugin's (the Construction boost and the captured drinking messages); cups of tea
// vanish when their drinker leaves the house (Wiki).
const KETTLE = 7688;
const HOT_KETTLE = 7691;
const FULL_KETTLE = 7690;
const TEA_LEAVES = 7738;
const MILK = 1927;
const EMPTY_BUCKET = 1925;
const BOIL_SOUND = 935;
const BOIL_TICKS = 8;
// Stove furniture -> its loc with a kettle on (poh_stove_<n>_kettle); the plain firepit has none.
const KETTLE_LOCS = { FIREPIT_WITH_HOOK: 13530, FIREPIT_WITH_POT: 13532, SMALL_OVEN: 13535, LARGE_OVEN: 13538, STEEL_RANGE: 13540, FANCY_RANGE: 13543 };
// poh_teapot_<material>_{empty,leaves,4..1} and poh_<material>cup_{empty,tea,tea_milky}.
const SETS = [
  { empty: 7702, leaves: 7700, pots: [7698, 7696, 7694, 7692], cup: 7728, tea: 7730, milky: 7731 },
  { empty: 7714, leaves: 7712, pots: [7710, 7708, 7706, 7704], cup: 7732, tea: 7733, milky: 7734 },
  { empty: 7726, leaves: 7724, pots: [7722, 7720, 7718, 7716], cup: 7735, tea: 7736, milky: 7737 },
];
const TEA_CUPS = SETS.flatMap(set => [set.tea, set.milky]);

/** furniture -> { boiled } for kettles on stoves */
const kettles = new WeakMap();

function stoveAt(event) {
  const house = House.houseFor(event.player);
  const furniture = house?.getFurnitureAt(event.location, event.objectId, event.object?.getType() ?? 10);
  return furniture && furniture.hotspotKey === "STOVE" ? { house, furniture } : null;
}

function kettleOnStove(event) {
  if (event.itemId !== FULL_KETTLE) return false;
  const found = stoveAt(event);
  if (!found) return false;
  const { house, furniture } = found;
  const loc = KETTLE_LOCS[furniture.buildableKey];
  if (!loc || kettles.has(furniture)) return false;
  const player = event.player;
  player.getInventory().delete(FULL_KETTLE, 1);
  player.sendMessage("You place the kettle over the fire.");
  const kettle = { boiled: false };
  kettles.set(furniture, kettle);
  furniture.displayObjectId = loc;
  house.redrawFurniture();
  TaskManager.submit(new CountdownTask(house, BOIL_TICKS, () => {
    if (kettles.get(furniture) !== kettle) return;
    kettle.boiled = true;
    for (const occupant of house.getPlayers()) {
      if (!occupant.getLocation().isWithinDistance(player.getLocation(), 16)) continue;
      occupant.getPacketSender().sendSound(BOIL_SOUND, 0, 0);
      occupant.sendMessage("The kettle boils.");
    }
  }));
  return true;
}

function takeKettle(event) {
  const found = stoveAt(event);
  const kettle = found && kettles.get(found.furniture);
  if (!kettle) return false;
  const player = event.player;
  if (!kettle.boiled) return player.sendMessage("The kettle has not boiled yet."), true;
  if (player.getInventory().getFreeSlots() === 0) return player.sendMessage("You don't have enough inventory space."), true;
  kettles.delete(found.furniture);
  delete found.furniture.displayObjectId;
  found.house.redrawFurniture();
  player.getInventory().adds(HOT_KETTLE, 1);
  return true;
}

function swap(player, from, to) {
  player.getInventory().delete(from, 1);
  player.getInventory().adds(to, 1);
}

/** Item on item: leaves into a teapot, hot water onto the leaves, tea into a cup, milk into tea. */
function brew(event) {
  const player = event.player;
  const ids = [event.usedItemId, event.usedWithItemId];
  const has = (id) => ids.includes(id);
  const other = (id) => (ids[0] === id ? ids[1] : ids[0]);
  let done = false;
  for (const set of SETS) {
    if (has(TEA_LEAVES) && has(set.empty)) {
      player.getInventory().delete(TEA_LEAVES, 1);
      swap(player, set.empty, set.leaves);
      player.sendMessage("You add the leaves to the teapot.");
      done = true;
    } else if (has(HOT_KETTLE) && has(set.leaves)) {
      swap(player, HOT_KETTLE, KETTLE);
      swap(player, set.leaves, set.pots[3]);
      player.sendMessage("You pour the water into the teapot.");
      done = true;
    } else if (has(HOT_KETTLE) && has(set.empty)) {
      player.sendMessage("You should add tea leaves to the teapot first.");
      done = true;
    } else if (has(MILK) && has(set.tea)) {
      swap(player, MILK, EMPTY_BUCKET);
      swap(player, set.tea, set.milky);
      done = true;
    }
    if (done) break;
    const pot = set.pots.find(has);
    const cups = pot !== undefined && SETS.find(cupSet => cupSet.cup === other(pot));
    if (cups) {
      const left = set.pots.indexOf(pot);
      swap(player, pot, left === 0 ? set.empty : set.pots[left - 1]);
      swap(player, cups.cup, cups.tea);
      player.sendMessage("You pour some tea.");
      done = true;
      break;
    }
  }
  if (done) event.handled = true;
}

/** House.leftHouse: cups of tea don't leave the house. */
function leftWithTea(player) {
  for (const cup of TEA_CUPS) {
    const amount = player.getInventory().getAmount(cup);
    if (amount) player.getInventory().delete(cup, amount);
  }
}

function attachTea(api) {
  api.onItemOnObject((event) => { if (kettleOnStove(event)) event.handled = true; }, { noted: false });
  for (const name of ["Firepit with hook", "Firepit with pot", "Small oven", "Large oven", "Steel range", "Fancy range"]) {
    api.onObjectInteraction(name, { "Take-kettle": takeKettle });
  }
  api.onItemOnItem(brew);
}

Object.assign(module.exports, { attachTea, leftWithTea });
