"use strict";

/**
 * The inner vault after Ocellus: a chest for each player, their loot, and the Rift out.
 *
 * Captured as a spectator (docs/fractured-archive.md):
 * - Travel on the Blade takes the party to the vault (level 2), arriving at 4127,5779.
 * - Eight chests stand round the island (4124,5793 to 4133,5803), one per party slot. Each is a
 *   multinpc on tfa_vault_own_chest, so a player's own chest shows as theirs. Opened, it plays
 *   chest_guthixian02_open01 and becomes a Rift ("Search").
 * - The Merit scroll reads the records. The Rift out ("Leave", "Quick-leave") fades in at
 *   4126,5796 about 15 ticks after the party arrives.
 * - The loot itself was never seen. It follows the Wiki's chest table (data
 *   fractured-archive.json): three standard rolls (1/51 for five times as much) when no unique,
 *   and tertiaries.
 * Estimates: the unique chance and weights, the pet's rate, the unique chest's tile, a player
 * opening only their own chest, and leftovers going to the bank when a player leaves (the Wiki
 * says the lobby's Loot Wheelbarrow keeps them).
 */

const path = require("path");
const fs = require("fs");
const Shared = require("./Shared.FracturedArchive");
const Raid = require("./RaidState.FracturedArchive");
const Records = require("./Records.FracturedArchive");

const { named, anim } = Shared;

const LOOT = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "fractured-archive.json"), "utf8")).loot;

const LAYOUT = {
  chests: [[4124, 5793], [4130, 5793], [4121, 5796], [4133, 5796], [4120, 5800], [4134, 5800], [4121, 5803], [4133, 5803]],
  unique: { x: 4126, y: 5806, z: 2 },
  rift: { x: 4126, y: 5796, z: 2 },
  exitLoc: { x: 4127, y: 5773, z: 2 },
  scoreboard: { x: 4129, y: 5778, z: 2 },
  braziers: [[4131, 5805], [4123, 5805]],
};
const RIFT_AFTER = 15;

class VaultRoom extends Raid.Room {
  onBuild() {
    this.placeObject(named("loc", "tfa_vault_exit"), LAYOUT.exitLoc);
    this.placeObject(named("loc", "tfa_vault_scoreboard"), LAYOUT.scoreboard);
    for (const [x, y] of LAYOUT.braziers) this.placeObject(named("loc", "tfa_brazier_guthixloot01_fire01"), { x, y, z: 2 });
    this.chests = new Map();
    this.loot = new Map();
    this.raid.roster.forEach((player, slot) => {
      const [x, y] = LAYOUT.chests[slot];
      const chest = this.spawn(named("npc", `tfa_rewards_chest_vault_${slot + 1}_closed`), { x, y, z: 2 }, { scripted: true });
      if (chest) this.chests.set(slot, { npc: chest, open: false });
    });
    for (const player of this.raid.players) this.loot.set(player.getUsername(), rollLoot());
    if ([...this.loot.values()].some((loot) => loot.unique)) {
      this.uniqueChest = this.spawn(named("npc", "tfa_unique_chest_vault_closed"), LAYOUT.unique, { scripted: true });
    }
    this.later(RIFT_AFTER, () => this.spawn(named("npc", "tfa_vault_exit_small"), LAYOUT.rift, { scripted: true, fadeIn: 90 }));
  }

  onArrive(player) {
    const slot = this.raid.slotOf(player);
    player.getPacketSender().sendVarbit(named("varbit", "tfa_vault_own_chest"), slot + 1);
    player.getPacketSender().sendVarbit(named("varbit", "tfa_has_claimable_loot"), this.loot.has(player.getUsername()) ? 1 : 0);
  }

  /** Open: their own chest opens into a Rift (captured); someone else's is left alone (estimate). */
  open(player, npc) {
    const slot = this.raid.slotOf(player);
    const own = this.chests.get(slot);
    if (!own || own.npc !== npc) {
      player.sendMessage("That isn't your chest.");
      return;
    }
    if (own.open) return;
    own.open = true;
    npc.performAnimation(anim("chest_guthixian02_open01"));
    this.later(1, () => npc.setNpcTransformationId(named("npc", `tfa_rewards_chest_vault_${slot + 1}_open`)));
    player.getPacketSender().sendVarbit(named("varbit", `tfa_vault_chest_${slot}_state`), 1);
  }

  /** Search the Rift: the loot, into the inventory, or the bank where it won't fit. */
  search(player, npc) {
    const slot = this.raid.slotOf(player);
    const own = this.chests.get(slot);
    const unique = npc === this.uniqueChest;
    if (!unique && (!own || own.npc !== npc || !own.open)) return;
    const loot = this.loot.get(player.getUsername());
    if (!loot) {
      player.sendMessage("There's nothing left in here for you.");
      return;
    }
    if (loot.unique && !unique) {
      player.sendMessage("Something special waits for you in the chest at the north end of the vault.");
      return;
    }
    this.loot.delete(player.getUsername());
    give(player, loot.items);
    player.getPacketSender().sendVarbit(named("varbit", "tfa_has_claimable_loot"), 0);
  }

  /** Leaving with loot still unclaimed sends it to the bank (estimate). */
  leave(player) {
    this.bankUnclaimed(player);
    this.raid.leaveFinished(player);
  }

  /** Logging out (or dropping) in the vault banks their unclaimed loot before the save. */
  onPlayerLogout(player) {
    this.bankUnclaimed(player);
  }

  bankUnclaimed(player) {
    const loot = this.loot.get(player.getUsername());
    if (!loot) return;
    this.loot.delete(player.getUsername());
    give(player, loot.items, true);
    player.sendMessage("Your unclaimed rewards from the Archive have been sent to your bank.");
  }
}

// ---------------------------------------------------------------- the loot

function weightedPick(rows, weightAt) {
  const total = rows.reduce((sum, row) => sum + row[weightAt], 0);
  let roll = Math.random() * total;
  for (const row of rows) {
    roll -= row[weightAt];
    if (roll < 0) return row;
  }
  return rows[rows.length - 1];
}

/** One player's loot: a unique, or three standard rolls; then the tertiaries and the pet. */
function rollLoot() {
  const items = [];
  let unique = null;
  if (Math.random() < LOOT.uniqueChance) {
    unique = weightedPick(LOOT.uniques, 1)[0];
    items.push([unique, 1]);
  } else {
    for (let i = 0; i < LOOT.rolls; i++) {
      const [name, min, max] = weightedPick(LOOT.standard, 3);
      const bonus = Math.random() < 1 / LOOT.bonusChance ? LOOT.bonusFactor : 1;
      items.push([name, Shared.random(min, max) * bonus]);
    }
  }
  for (const [name, oneIn] of LOOT.tertiary) if (Math.random() < 1 / oneIn) items.push([name, 1]);
  const [pet, petOneIn] = LOOT.pet;
  if (Math.random() < 1 / petOneIn) items.push([pet, 1]);
  return { unique, items };
}

/** An item by its gameval name (or an ItemIdentifiers constant, for the elite clue). */
function itemId(name) {
  const { ItemIdentifiers } = Shared.core();
  if (ItemIdentifiers[name] !== undefined) return ItemIdentifiers[name];
  return named("obj", name);
}

function give(player, items, toBank = false) {
  const { Item, ItemDefinition, Bank } = Shared.core();
  const inventory = player.getInventory();
  for (const [name, amount] of items) {
    const base = itemId(name);
    const definition = ItemDefinition.forId(base);
    // Bulky drops come noted, as the other raids' chests give them; the bank keeps them unnoted.
    const id = !definition.isStackable() && amount > 1 && definition.getNoteId() >= 0 ? definition.getNoteId() : base;
    const fits = ItemDefinition.forId(id).isStackable() ? inventory.contains(id) || inventory.getFreeSlots() > 0 : inventory.getFreeSlots() >= amount;
    if (!toBank && fits) inventory.add(new Item(id, amount), false);
    else player.getBank(Bank.getTabForItem(player, base)).add(new Item(base, amount), false);
    Shared.api().emitCustomEvent("collection-log:obtain", { player, itemId: base, amount });
  }
  inventory.refreshItems();
  player.sendMessage("You claim your rewards from the vault.");
}

// ---------------------------------------------------------------- clicks

function vaultOf(player) {
  const room = Raid.raidOf(player)?.room;
  return room instanceof VaultRoom ? room : null;
}

function openChest(event) {
  const room = vaultOf(event.player);
  if (!room) return false;
  if (event.npc === room.uniqueChest) {
    event.npc.performAnimation(anim("chest_guthixian02_open01"));
    event.npc.setNpcTransformationId(named("npc", "tfa_unique_chest_vault_open"));
    return true;
  }
  room.open(event.player, event.npc);
  return true;
}

function searchChest(event) {
  const room = vaultOf(event.player);
  if (!room) return false;
  room.search(event.player, event.npc);
  return true;
}

function leaveVault(event) {
  const room = vaultOf(event.player);
  if (!room) return false;
  room.leave(event.player);
  return true;
}

function readMerits({ player }) {
  if (!vaultOf(player)) return false;
  Records.open(player);
  return true;
}

module.exports = function registerVault(api) {
  Shared.bind(api);
  Raid.registerRoom("VAULT", VaultRoom);
  api.onNpcInteraction("<col=00ffff>Chest</col>", { Open: openChest, Search: searchChest });
  api.onNpcInteraction("<col=00ffff>Rift</col>", { Search: searchChest, Leave: leaveVault, "Quick-leave": leaveVault });
  api.onObjectInteraction("Merit scroll", { Read: readMerits });
};

Object.assign(module.exports, { VaultRoom, LAYOUT, rollLoot });
