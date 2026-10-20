/**
 * Nex's loot (Wiki, "Nex" drops), on the ground under her as captured with the kill messages:
 * - Loot needs a minimum share of the damage to Nex, her mages and reavers (ours: 1%). Players who
 *   died or left get nothing and their share isn't passed on.
 * - Uniques: 1/43 per kill, split by share; the unique is a Torva piece, the Nihil horn 2/12 each,
 *   Zaryte vambraces 3/12, the ancient hilt 1/12.
 * - Two common drops a kill, their quantities split by share. The MVP (most damage) gets +10%
 *   quantities, +10% unique chance and the big bones ("You were the MVP for this fight!", captured).
 * - Separate rolls (blood essence, rune sword, nihil shards) and tertiaries (elite clue 1/48,
 *   Nexling 1/500), each as likely as the player's share.
 */
const Common = require("./Common.Nex");

const UNIQUE_RATE = 43;
const MVP_BONUS = 1.1;
const MIN_SHARE = 0.01;
const COMMON_DROPS = 2;

const UNIQUES = [
  ["TORVA_FULL_HELM_DAMAGED_", 2], ["TORVA_PLATEBODY_DAMAGED_", 2], ["TORVA_PLATELEGS_DAMAGED_", 2],
  ["NIHIL_HORN", 2], ["ZARYTE_VAMBRACES", 3], ["ANCIENT_HILT", 1],
];

/** The common drops: [item, min, max, noted, companion [item, min, max]]. */
const COMMONS = [
  ["BLOOD_RUNE", 84, 876], ["DEATH_RUNE", 85, 986], ["SOUL_RUNE", 86, 592], ["DRAGON_BOLTS_UNF_", 12, 283],
  ["STEEL_CANNONBALL", 42, 2252], ["AIR_ORB", 6, 100, true], ["UNCUT_RUBY", 3, 80, true],
  ["UNCUT_DIAMOND", 3, 64, true], ["WINE_OF_ZAMORAK", 4, 64, true], ["SHARK", 10, 10, false, ["PRAYER_POTION_4_", 3, 3]],
  ["SARADOMIN_BREW_4_", 1, 10, false, ["SUPER_RESTORE_4_", 1, 5]], ["ECUMENICAL_KEY_SHARD", 6, 39],
];

/** Separate rolls: [item, chance, min, max]. */
const SEPARATE = [
  ["BLOOD_ESSENCE", 1 / 82, 1, 2], ["RUNE_SWORD", 1 / 209, 1, 1],
  ["NIHIL_SHARD", 5 / 82, 80, 85], ["NIHIL_SHARD", 8 / 209, 85, 95],
];

function itemId(name) {
  const id = Common.core.ItemIdentifiers[name];
  if (id == null) throw new Error(`Nex loot: unknown item ${name}`);
  return id;
}

/** Each present player's share of the damage, the MVP among them. */
function shares(contribution, present) {
  let total = 0;
  for (const amount of contribution.values()) total += amount;
  const owed = [];
  let mvp = null;
  for (const player of present) {
    const amount = contribution.get(player) ?? 0;
    const share = total > 0 ? amount / total : 0;
    if (share < MIN_SHARE) continue;
    owed.push({ player, share });
    if (!mvp || amount > (contribution.get(mvp) ?? 0)) mvp = player;
  }
  return { owed, mvp };
}

function pickUnique(random) {
  const total = UNIQUES.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [name, weight] of UNIQUES) {
    if ((roll -= weight) < 0) return itemId(name);
  }
  return itemId(UNIQUES[0][0]);
}

function rollCommons(random) {
  const lump = [];
  const pool = [...COMMONS];
  for (let i = 0; i < COMMON_DROPS && pool.length > 0; i++) {
    const [name, min, max, noted, companion] = pool.splice(Math.floor(random() * pool.length), 1)[0];
    lump.push({ itemId: itemId(name), amount: min + Math.floor(random() * (max - min + 1)), noted: noted === true });
    if (companion) {
      const [other, otherMin, otherMax] = companion;
      lump.push({ itemId: itemId(other), amount: otherMin + Math.floor(random() * (otherMax - otherMin + 1)), noted: false });
    }
  }
  return lump;
}

/** Everything one kill gives, per player: [{ player, share, mvp, drops: [{ itemId, amount, noted }] }]. */
function rollLoot(contribution, present, random = Math.random) {
  const { owed, mvp } = shares(contribution, present);
  const lump = rollCommons(random);
  const { ItemIdentifiers } = Common.core;
  return owed.map(({ player, share }) => {
    const bonus = player === mvp ? MVP_BONUS : 1;
    const drops = [];
    if (player === mvp) drops.push({ itemId: ItemIdentifiers.BIG_BONES, amount: 1, noted: false });
    for (const drop of lump) {
      const amount = Math.floor(drop.amount * share * bonus);
      if (amount >= 1) drops.push({ ...drop, amount });
    }
    if (random() < (share * bonus) / UNIQUE_RATE) drops.push({ itemId: pickUnique(random), amount: 1, noted: false });
    for (const [name, chance, min, max] of SEPARATE) {
      if (random() < chance * share) drops.push({ itemId: itemId(name), amount: min + Math.floor(random() * (max - min + 1)), noted: false });
    }
    if (random() < share / 48) drops.push({ itemId: ItemIdentifiers.CLUE_SCROLL_ELITE_, amount: 1, noted: false });
    if (random() < share / 500) drops.push({ itemId: ItemIdentifiers.NEXLING, amount: 1, noted: false });
    return { player, share, mvp: player === mvp, drops };
  });
}

/** The kill's loot under her, for each player who is owed some. */
function reward(fight, players, where) {
  const { Item, ItemDefinition } = Common.core;
  const manager = Common.api.getItemOnGroundManager();
  const area = fight.arena.area;
  const damagers = players.filter((player) => (fight.contribution.get(player) ?? 0) > 0);
  for (const entry of rollLoot(fight.contribution, players)) {
    const { player } = entry;
    const request = { player, npc: fight.boss, npcId: Common.data.npcs.nex, drops: entry.drops, damagers };
    Common.api.emitCustomEvent("npc-drops:roll", request);
    for (const drop of request.drops) {
      if (!Number.isInteger(drop.itemId) || drop.amount <= 0) continue;
      const noteId = ItemDefinition.forId(drop.itemId).getNoteId();
      const itemId = drop.noted && noteId >= 0 && ItemDefinition.forId(noteId).isNoted() ? noteId : drop.itemId;
      if (ItemDefinition.forId(itemId).isStackable()) {
        manager.registerLocation(player, new Item(itemId, drop.amount), where, area);
      } else {
        for (let i = 0; i < drop.amount; i++) manager.registerLocation(player, new Item(itemId, 1), where, area);
      }
    }
    if (entry.mvp) player.sendMessage(Common.data.kill.mvp);
  }
}

module.exports = { reward, rollLoot, shares, pickUnique, UNIQUE_RATE, MIN_SHARE };
