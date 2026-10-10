/**
 * Shared Vorkath constants and pure combat math.
 *
 * Behaviour: https://oldschool.runescape.wiki/w/Vorkath and
 * https://oldschool.runescape.wiki/w/Vorkath/Strategies (attack pattern, specials, max hits,
 * dragonfire tiers, acid/rapid-fire, zombified spawn, drops). Triangulated against two RSPS
 * oracles, never justification on their own: OpenRune-Server PR #217 (instanced Vorkath
 * encounter) and kurdowns/RSPS-NEAR-REALITY (plugins/boss/vorkath). Where they conflict the
 * Wiki wins; remaining conflicts resolve to OpenRune (capture-derived) over Near-Reality,
 * whose deadly fireball is unwired dead code.
 *
 * Ids from the cache (rev 241): NPCs 8059 (sleeping, Poke) / 8061 (awake) / 8063 (Zombified
 * Spawn, post-quest; 8062 is the quest twin); Vorkath is 7x7 at 2269,4062 (both oracles agree,
 * Wiki corroborates the crater). Anim 7950 wakes (210 cycles = 7 ticks), 7951 melees,
 * 7952 breathes, 7957 channels acid (900 cycles), 7960 launches high; 7948 flinches (64
 * cycles) and 7949 dies (200 cycles) by length class. Projectiles 1477/1479/393/1470/1471/
 * 395/1481/1483/1482/1484 and graphics 1478/1480/1472/1473/131/369/1460/32000-object per the
 * oracles; the dragonfire impact uses 1466 per OpenRune's captures.
 *
 * Approximations (no capture behind them): chat messages, the 8 acid edge segments (OpenRune
 * gives order but not tiles), spawn landing search (Wiki: exactly 10 tiles away), respawn
 * delay, and anything marked below.
 */
const SLEEPING_ID = 8059;
const AWAKE_ID = 8061;
const SPAWN_ID = 8063;

const SIZE = 7;
const SPAWN_TILE = [2269, 4062, 0];
const TELEPORT_TILE = [2272, 4054];
const MAX_HITPOINTS = 750;
const SPAWN_HITPOINTS = 38;

const ATTACK_SPEED_TICKS = 5;
const ATTACK_DISTANCE = 10;
const STANDARDS_BEFORE_SPECIAL = 6;
const WAKE_TICKS = 7;

const MELEE_MAX = 32;
const RANGED_MAX = 32;
const MAGIC_MAX = 30;
const FIREBALL_MAX = 121;
const RAPID_MIN = 25;
const RAPID_MAX = 41;
const POOL_MIN = 1;
const POOL_MAX = 10;
const SPAWN_EXPLOSION_MAX = 60;

const ACID_POOL_OBJECT = 32000;
const ACID_RAPID_SHOTS = 25;
const ACID_FIRST_SHOT_DELAY = 4;
const ACID_FORCE_END_TICKS = 33;
const ACID_POOL_LAND_DELAY = 3;
const ACID_GRID_ORIGIN = [2262, 4055];
const ACID_GRID_CELLS = 7;
const ACID_CELL_SIZE = 3;

const FREEZE_SECONDS = 60;
const SPAWN_LAND_DISTANCE = 10;
/** Spawn-phase failsafe: detonate in place rather than hold her immune forever. */
const SPAWN_FUSE_TICKS = 60;

/** NPC attribute keys (kebab-case, namespaced). */
const ATTR_ATTACKS = "vorkath:attacks";
const ATTR_NEXT_SPECIAL = "vorkath:next-special";
const ATTR_PHASE = "vorkath:phase";
const ATTR_WAKE_UNTIL = "vorkath:wake-until";

const PHASE_ACTIVE = "active";
const PHASE_ACID = "acid";
const PHASE_SPAWN = "spawn";

const SPECIAL_ACID = "acid";
const SPECIAL_SPAWN = "spawn";

const Attack = {
  MELEE: "melee",
  RANGED: "ranged",
  MAGIC: "magic",
  DRAGONFIRE: "dragonfire",
  VENOM: "venom",
  PRAYER: "prayer",
  FIREBALL: "fireball",
};

/**
 * One standard attack. Melee only when adjacent (the caller keeps players inside the 7x7
 * out: only ranged/magic/breaths/fireball). Weights: magic 3 / ranged 4 per Mod Ash (Wiki
 * Strategies references); every other face is unit weight (OpenRune flags the same).
 * `roll(n)` returns 0..n like Misc.getRandom, so tests can pass a stub.
 */
function chooseStandard({ adjacent, roll }) {
  const table = adjacent
    ? [[Attack.MELEE, 1], [Attack.RANGED, 4], [Attack.MAGIC, 3], [Attack.DRAGONFIRE, 1],
      [Attack.VENOM, 1], [Attack.PRAYER, 1], [Attack.FIREBALL, 1]]
    : [[Attack.RANGED, 4], [Attack.MAGIC, 3], [Attack.DRAGONFIRE, 1],
      [Attack.VENOM, 1], [Attack.PRAYER, 1], [Attack.FIREBALL, 1]];
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let pick = roll(total - 1);
  for (const [attack, weight] of table) {
    pick -= weight;
    if (pick < 0) return attack;
  }
  return Attack.MAGIC;
}

/**
 * Dragonfire caps before the roll (OpenRune's Wiki-shaped pipeline): the shield/prayer
 * combination sets the cap, an inaccurate roll drops to the resisted cap, then the potion
 * and the venom/prayer-breath penalty subtract.
 */
function dragonfireCaps({ shield, prayer, potion, variant }) {
  const cap = shield ? 20 : (prayer ? 30 : 80);
  const resistedCap = (shield || prayer) ? cap : 50;
  const reduction = potion === "super" ? 20 : (potion === "antifire" ? 10 : 0);
  const variantPenalty = variant === "normal" ? 0 : 5;
  return { cap, resistedCap, reduction, variantPenalty };
}

/** Fireball damage from one roll: full on the tile, halved adjacent, none further out. */
function fireballDamage(roll, distance) {
  if (distance <= 0) return roll;
  if (distance === 1) return Math.floor(roll / 2);
  return 0;
}

/** Spawn explosion damage from its remaining hitpoints: up to 60 at full health (Wiki). */
function spawnExplosionDamage(hitpoints) {
  const clamped = Math.max(0, Math.min(SPAWN_HITPOINTS, hitpoints));
  return Math.floor((clamped * SPAWN_EXPLOSION_MAX) / SPAWN_HITPOINTS);
}

function tileKey(x, y) {
  return `${x},${y}`;
}

/** True when the tile sits under the 7x7 body anchored at the boss base tile. */
function underBoss(bossX, bossY, x, y) {
  return x >= bossX && x < bossX + SIZE && y >= bossY && y < bossY + SIZE;
}

/**
 * Straight-line walkability from (x0, y0) to (x1, y1), stepping the way the engine
 * does (diagonal first): every tile must be walkable and outside the boss body, so the
 * spawn can actually walk in instead of stalling against her.
 */
function hasClearPath(x0, y0, x1, y1, bossX, bossY, isWalkable) {
  let x = x0;
  let y = y0;
  for (let guard = 0; guard < 64; guard++) {
    if (x === x1 && y === y1) return true;
    x += Math.sign(x1 - x);
    y += Math.sign(y1 - y);
    if (underBoss(bossX, bossY, x, y) || !isWalkable(x, y)) return false;
  }
  return false;
}

/**
 * Acid pool tiles: one uniform pick per 3x3 cell of the 7x7 grid around the arena (minus
 * the centre cell), 8 edge tiles in S,S,N,N,W,W,E,E order, then the player's tile.
 * Candidates must be walkable and outside the boss body; `isWalkable(x, y)` is injected.
 * The edge tiles are an approximation: OpenRune gives their order but not their tiles.
 */
function acidPoolTiles(bossX, bossY, playerX, playerY, isWalkable, pick) {
  const [originX, originY] = ACID_GRID_ORIGIN;
  const pools = [];
  const seen = new Set();
  const take = (x, y) => {
    const key = tileKey(x, y);
    if (seen.has(key) || underBoss(bossX, bossY, x, y) || !isWalkable(x, y)) return false;
    seen.add(key);
    pools.push([x, y]);
    return true;
  };
  for (let cx = 0; cx < ACID_GRID_CELLS; cx++) {
    for (let cy = 0; cy < ACID_GRID_CELLS; cy++) {
      if (cx === 3 && cy === 3) continue;
      const candidates = [];
      for (let dx = 0; dx < ACID_CELL_SIZE; dx++) {
        for (let dy = 0; dy < ACID_CELL_SIZE; dy++) {
          const x = originX + cx * ACID_CELL_SIZE + dx;
          const y = originY + cy * ACID_CELL_SIZE + dy;
          if (!seen.has(tileKey(x, y)) && !underBoss(bossX, bossY, x, y) && isWalkable(x, y)) {
            candidates.push([x, y]);
          }
        }
      }
      if (candidates.length > 0) take(...candidates[pick(candidates.length - 1)]);
    }
  }
  const [minX, minY] = [originX, originY];
  const [maxX, maxY] = [originX + ACID_GRID_CELLS * ACID_CELL_SIZE - 1, originY + ACID_GRID_CELLS * ACID_CELL_SIZE - 1];
  const midX = Math.floor((minX + maxX) / 2);
  const midY = Math.floor((minY + maxY) / 2);
  for (const [x, y] of [[midX - 1, minY], [midX + 1, minY], [midX - 1, maxY], [midX + 1, maxY],
    [minX, midY - 1], [minX, midY + 1], [maxX, midY - 1], [maxX, midY + 1]]) {
    take(x, y);
  }
  take(playerX, playerY);
  return pools;
}

module.exports = {
  SLEEPING_ID,
  AWAKE_ID,
  SPAWN_ID,
  SIZE,
  SPAWN_TILE,
  TELEPORT_TILE,
  MAX_HITPOINTS,
  SPAWN_HITPOINTS,
  ATTACK_SPEED_TICKS,
  ATTACK_DISTANCE,
  STANDARDS_BEFORE_SPECIAL,
  WAKE_TICKS,
  MELEE_MAX,
  RANGED_MAX,
  MAGIC_MAX,
  FIREBALL_MAX,
  RAPID_MIN,
  RAPID_MAX,
  POOL_MIN,
  POOL_MAX,
  SPAWN_EXPLOSION_MAX,
  ACID_POOL_OBJECT,
  ACID_RAPID_SHOTS,
  ACID_FIRST_SHOT_DELAY,
  ACID_FORCE_END_TICKS,
  ACID_POOL_LAND_DELAY,
  FREEZE_SECONDS,
  SPAWN_LAND_DISTANCE,
  SPAWN_FUSE_TICKS,
  ATTR_ATTACKS,
  ATTR_NEXT_SPECIAL,
  ATTR_PHASE,
  ATTR_WAKE_UNTIL,
  PHASE_ACTIVE,
  PHASE_ACID,
  PHASE_SPAWN,
  SPECIAL_ACID,
  SPECIAL_SPAWN,
  Attack,
  chooseStandard,
  dragonfireCaps,
  fireballDamage,
  spawnExplosionDamage,
  tileKey,
  underBoss,
  hasClearPath,
  acidPoolTiles,
  _test: {
    chooseStandard,
    dragonfireCaps,
    fireballDamage,
    spawnExplosionDamage,
    underBoss,
    hasClearPath,
    acidPoolTiles,
  },
};
