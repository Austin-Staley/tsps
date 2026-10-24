"use strict";

/**
 * The catch (Wiki: Fishing Trawler, Angler's outfit): back in port, each player with at least 50
 * contribution and 15 Fishing has their share waiting in the trawler net on the Port Khazard
 * dock. Each fish is one the player can catch at their base Fishing level, with up to two junk
 * items; a 1 in 12 roll for each angler's piece they don't own adds it to the net. Inspecting
 * the net sends the catch to the bank with its Fishing experience (the fish's own trawler XP).
 * The catch survives logging out; the next trip throws it back (Lobby.FishingTrawler.js).
 */

const Shared = require("./Shared.FishingTrawler");

const ANGLER_PIECES = ["anglerHat", "anglerTop", "anglerLegs", "anglerBoots"];
/** Junk per catch: none, one or two (the Wiki gives 0 to 2). */
const JUNK_WEIGHTS = [47, 37, 16];

function owns(player, itemId) {
  const { Bank } = Shared.core();
  return player.getInventory().contains(itemId) || player.getEquipment().contains(itemId)
    || Bank.contains(player, new (Shared.core().Item)(itemId, 1));
}

function rollJunk(random) {
  let roll = random() * JUNK_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  for (let count = 0; count < JUNK_WEIGHTS.length; count++) {
    roll -= JUNK_WEIGHTS[count];
    if (roll < 0) return count;
  }
  return 0;
}

/** The items and experience for `fishCount` fish at `fishingLevel`: { items: [[id, n]], xp }. */
function rollCatch(fishCount, fishingLevel, random = Math.random, ownsPiece = () => false) {
  const ids = Shared.ids();
  const eligible = ids.fish.filter((fish) => fish.level <= fishingLevel);
  const counts = new Map();
  let xp = 0;
  const add = (id, n = 1) => counts.set(id, (counts.get(id) ?? 0) + n);
  for (let i = 0; i < fishCount && eligible.length > 0; i++) {
    const fish = eligible[Math.floor(random() * eligible.length)];
    add(fish.id);
    xp += fish.xp;
  }
  const junk = Math.min(Shared.DATA.catch.junkMax, rollJunk(random));
  for (let i = 0; i < junk; i++) {
    add(ids.junk[Math.floor(random() * ids.junk.length)]);
    xp += Shared.DATA.junkXp;
  }
  const angler = [];
  for (const piece of ANGLER_PIECES) {
    const id = ids.items[piece];
    if (ownsPiece(id)) continue;
    if (Math.floor(random() * Shared.DATA.anglerChance) === 0) {
      add(id);
      angler.push(id);
    }
  }
  return { items: [...counts], xp: Math.round(xp * 10) / 10, angler };
}

/** At the end of a trip in port: the player's share into the net, or why there is none. */
function award(player, voyage, random = Math.random) {
  const points = voyage.contribution.get(player) ?? 0;
  if (Shared.baseLevel(player, "FISHING") < Shared.DATA.rewardFishingLevel) {
    player.sendMessage(Shared.message("lowLevel"));
    return null;
  }
  if (points < Shared.DATA.points.rewardMinimum) {
    player.sendMessage(Shared.message("tooLittle"));
    return null;
  }
  const reward = rollCatch(voyage.shareFor(player), Shared.baseLevel(player, "FISHING"), random, (id) => owns(player, id));
  player.setAttribute(Shared.REWARD_ATTRIBUTE, { items: reward.items, xp: reward.xp });
  player.sendMessage(Shared.message("success"));
  return reward;
}

/** Inspect the trawler net on the dock: the catch to the bank, its experience to Fishing. */
function inspectNet({ player }) {
  const reward = player.getAttribute(Shared.REWARD_ATTRIBUTE);
  if (!reward || !Array.isArray(reward.items) || reward.items.length === 0) {
    player.sendMessage(Shared.message("nothingInNet"));
    return true;
  }
  const { Bank, Item } = Shared.core();
  const anglers = new Set(ANGLER_PIECES.map((piece) => Shared.ids().items[piece]));
  const left = [];
  let free = player.getBank(0).getFreeSlots?.() ?? 0;
  for (const [id, count] of reward.items) {
    // Into an existing stack, or a free slot; what doesn't fit stays in the net.
    const stacked = Bank.contains(player, new Item(id, 1));
    if (!stacked && free <= 0) {
      left.push([id, count]);
      continue;
    }
    if (!stacked) free -= 1;
    player.getBank(Bank.getTabForItem(player, id)).add(new Item(id, count), false);
    if (anglers.has(id)) player.sendMessage(Shared.message("angler"));
  }
  const delivered = reward.items.length - left.length;
  const xp = reward.items.length > 0 ? Math.round((reward.xp * delivered / reward.items.length) * 10) / 10 : 0;
  Shared.addXp(player, "FISHING", left.length === 0 ? reward.xp : xp);
  player.setAttribute(Shared.REWARD_ATTRIBUTE, left.length === 0 ? null : { items: left, xp: Math.max(0, Math.round((reward.xp - xp) * 10) / 10) });
  player.sendMessage(Shared.message(left.length === 0 ? "collected" : "bankFull"));
  return true;
}

function attachRewards(api) {
  Shared.bind(api);
  api.persistAttribute(Shared.REWARD_ATTRIBUTE, null);
  api.onObjectInteraction("Trawler net", { Inspect: inspectNetOrBoat });
}

/** The dock's net holds the catch; the trawler's own nets are for checking the net at sea. */
function inspectNetOrBoat(event) {
  if (event.objectId === Shared.ids().locs.rewardNet) return inspectNet(event);
  return false;
}

module.exports = { attachRewards, rollCatch, award, inspectNet, ANGLER_PIECES };
