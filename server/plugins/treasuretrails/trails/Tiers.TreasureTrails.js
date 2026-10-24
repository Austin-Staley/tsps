"use strict";

// Per-tier rules. Step counts are from each tier's Wiki "Clue scroll (<tier>)" page, STASH
// costs from the Wiki "STASH" page; the difficulty is the cache clue-helper `difficulty` column.
const TIERS = [
  { name: "easy", label: "Easy", difficulty: 1, length: [2, 4], stash: { level: 27, xp: 150, plank: "PLANK" } },
  { name: "medium", label: "Medium", difficulty: 2, length: [3, 5], stash: { level: 42, xp: 250, plank: "OAK_PLANK" } },
];

const byName = new Map(TIERS.map(tier => [tier.name, tier]));

module.exports = { TIERS, byName };
