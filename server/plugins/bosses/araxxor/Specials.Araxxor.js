/**
 * Araxxor's three specials and the per-tick fight engine (hatch timing, acid pools, the
 * rolling acid ball, chasing drip pools).
 *
 * The special replaces every seventh attack and turns on the first egg's colour (as
 * captured, first at attack 7, then every 42 ticks):
 *  - Acidic: the boss rears (11476), a ball (13676) rolls from its feet two tiles a tick
 *    leaving acid pools, burning anyone within two tiles for 4 venom, then bursts (11492)
 *    into nine splatters;
 *  - Mirrorback: the boss splatters acid (11477) onto nine tiles around the player;
 *  - Ruptura: the boss drips (11478) a pool onto the player's tile that chases them for six
 *    ticks.
 *
 * Pools (object 54148, shape 10) are the damage field: standing in acid hurts more the
 * longer you keep standing (Wiki; ramp values ours). The capture shows only one collapsing
 * graphic per pool, so pools are pooled objects on the private area, cleared on death.
 */
const Shared = require("./Shared.Araxxor");
const Minions = require("./Minions.Araxxor");

const SPECIAL_ANIMATION = Object.freeze({ ball: 11476, splatter: 11477, drip: 11478 });
const BALL_ANIMATION = 11491;
const BALL_BURST_ANIMATION = 11492;

const WALKABLE_MASK = 0x1280100;

let api = null;
let core = null;
let CombatFactory = null;

/** Live fights by boss NPC: pools, standing counters, the ball and drip follow-ups. */
const fights = new Map();

function later(ticks, target, execFunc) {
  class DelayedTask extends core.Task {
    constructor() {
      super(Math.max(1, ticks), target, false);
    }

    execute() {
      this.stop();
      execFunc();
    }
  }
  core.TaskManager.submit(new DelayedTask());
}

function alive(entity) {
  return !!entity?.isRegistered?.() && (entity.getHitpoints?.() ?? 1) > 0;
}

function getFight(npc) {
  let fight = fights.get(npc);
  if (!fight) {
    fight = { pools: new Map(), standing: new Map(), ball: null, ballTiles: 0, drips: [], nextHatchAt: 0 };
    fights.set(npc, fight);
  }
  return fight;
}

function isWalkable(x, y) {
  return (core.RegionManager.getClipping(x, y, 0, null) & WALKABLE_MASK) === 0;
}

/**
 * One acid pool on the boss's private area. The fight tracks them by tile so the damage
 * tick can ask "is anyone standing in acid", and death clears them all.
 */
function spawnPool(npc, x, y) {
  const fight = getFight(npc);
  const key = Shared.tileKey(x, y);
  if (fight.pools.has(key)) return fight.pools.get(key);
  const area = npc.getPrivateArea?.() ?? null;
  if (area?.isDestroyed?.() === true) return null;
  const object = new core.GameObject(Shared.ACID_POOL_OBJECT, new core.Location(x, y, 0), 10, 0, area);
  core.ObjectManager.register(object, true);
  area?.add?.(object);
  fight.pools.set(key, object);
  return object;
}

/** How long the fight has left; the hatch timer and specials share the 42-tick beat. */
function initFight(npc) {
  const fight = getFight(npc);
  fight.nextHatchAt = core.World.getProcessCycle() + Shared.FIRST_HATCH_TICKS;
  return fight;
}

function startSpecial(npc, target) {
  const kind = npc.getAttribute?.(Shared.ATTR_SPECIAL);
  if (!kind) return;
  npc.performAnimation(new core.Animation(SPECIAL_ANIMATION[kind] ?? SPECIAL_ANIMATION.ball));
  if (kind === "ball") {
    later(2, target, () => {
      if (alive(npc)) startBall(npc, target);
    });
  } else if (kind === "splatter") {
    const pos = target?.getLocation?.();
    if (!pos) return;
    const tiles = Shared.splatterTiles(pos.getX(), pos.getY(), isWalkable);
    throwBlobs(npc, tiles);
  } else if (kind === "drip") {
    startDrip(npc, target);
  }
}

/** A projectile for every tile; the pool grows where the blob lands. */
function throwBlobs(npc, tiles) {
  const areaDestroyed = () => npc.getPrivateArea?.()?.isDestroyed?.() === true;
  for (const [x, y] of tiles) {
    new core.Projectile(
      core.Projectile.centreOf(npc),
      new core.Location(x, y, npc.getLocation().getZ()),
      null,
      Shared.ACID_PROJECTILE,
      30,
      90,
      35,
      0,
      npc.getPrivateArea(),
    ).sendProjectile();
  }
  later(3, npc, () => {
    if (areaDestroyed()) return;
    for (const [x, y] of tiles) spawnPool(npc, x, y);
  });
}

/**
 * The rolling acid ball: two tiles a tick in the player's direction at the cast, an acid
 * pool under every tile it crosses, 4 venom to anyone within two tiles, and a nine-blob
 * burst when it stops (walls, or its range).
 */
function startBall(npc, target) {
  const fight = getFight(npc);
  if (fight.ball && alive(fight.ball)) return;
  const centre = core.Projectile.centreOf(npc);
  let x = centre.getX() - 1;
  let y = centre.getY();
  const pos = target?.getLocation?.();
  const dx = pos ? Math.sign(pos.getX() - x) : 0;
  const dy = pos ? Math.sign(pos.getY() - y) : 0;
  if (dx === 0 && dy === 0) return;
  const area = npc.getPrivateArea?.() ?? null;
  if (area?.isDestroyed?.() === true) return;
  const ball = core.NPC.create(Shared.BALL_ID, new core.Location(x, y, npc.getLocation().getZ()));
  ball.__skipDefaultRespawn = true;
  // The cache has no hitpoints for 13676 (-1); the tracker's alive() needs a positive one.
  ball.setHitpoints?.(1);
  // Rolls through bodies, notably the boss's own 7x7, instead of stalling on them.
  ball.setFlag?.(core.NPC.WALK_THROUGH_ENTITIES_FLAG, true);
  area?.add?.(ball);
  core.World.getAddNPCQueue().push(ball);
  fight.ball = ball;
  fight.ballTiles = 0;
  fight.ballDirection = { x: dx, y: dy };
}

function tickBall(npc, fight, players) {
  const ball = fight.ball;
  if (!ball) return;
  if (!ball.isRegistered?.() || (npc.getPrivateArea?.() ?? null)?.isDestroyed?.() === true) {
    fight.ball = null;
    return;
  }
  const location = ball.getLocation();
  spawnPool(npc, location.getX(), location.getY());
  for (const player of players) {
    if (!alive(player)) continue;
    const pos = player.getLocation();
    const distance = Math.max(Math.abs(pos.getX() - location.getX()), Math.abs(pos.getY() - location.getY()));
    if (distance <= 2) {
      player.getCombat().getHitQueue().addPendingDamage([new core.HitDamage(Shared.BALL_DAMAGE, core.HitMask.RED)]);
      CombatFactory?.poisonEntity?.(player, 6, 2);
    }
  }
  const { x: dx, y: dy } = fight.ballDirection ?? { x: 0, y: 0 };
  const next = { x: location.getX() + dx, y: location.getY() + dy };
  fight.ballTiles += 1;
  if (fight.ballTiles >= Shared.BALL_ROLL_TILES || !isWalkable(next.x, next.y)) {
    ball.performAnimation(new core.Animation(BALL_BURST_ANIMATION));
    core.World.getRemoveNPCQueue().push(ball);
    fight.ball = null;
    throwBlobs(npc, Shared.splatterTiles(location.getX(), location.getY(), isWalkable));
    return;
  }
  ball.performAnimation(new core.Animation(BALL_ANIMATION));
  const step = new core.Location(next.x, next.y, ball.getLocation().getZ());
  const movement = ball.getMovementQueue?.();
  movement?.reset?.();
  movement?.addSteps?.(step);
  if (!movement?.addSteps) ball.moveTo?.(step);
}

/** The dripping pool: lands after the flight, then chases the player for six ticks. */
function startDrip(npc, target) {
  const pos = target?.getLocation?.();
  if (!pos) return;
  const from = core.Projectile.centreOf(npc);
  const distance = Math.max(1, from.getDistance(pos));
  const delay = Math.max(1, distance - 3);
  new core.Projectile(
    from,
    new core.Location(pos.getX(), pos.getY(), npc.getLocation().getZ()),
    null,
    Shared.ACID_PROJECTILE,
    30,
    30 + 30 * distance,
    35,
    0,
    npc.getPrivateArea(),
  ).sendProjectile();
  const fight = getFight(npc);
  const landing = { x: pos.getX(), y: pos.getY() };
  later(delay, target, () => {
    if (!alive(npc) || (npc.getPrivateArea?.() ?? null)?.isDestroyed?.() === true) return;
    const object = spawnPool(npc, landing.x, landing.y);
    if (object) fight.drips.push({ object, player: target, until: core.World.getProcessCycle() + Shared.DRIP_FOLLOW_TICKS });
  });
}

function tickDrips(npc, fight) {
  if (fight.drips.length === 0) return;
  const now = core.World.getProcessCycle();
  for (let index = fight.drips.length - 1; index >= 0; index--) {
    const drip = fight.drips[index];
    if (now >= drip.until || !alive(drip.player)) {
      fight.drips.splice(index, 1);
      continue;
    }
    const pos = drip.player.getLocation();
    const key = Shared.tileKey(pos.getX(), pos.getY());
    const currentKey = `${drip.object.getLocation().getX()},${drip.object.getLocation().getY()}`;
    if (key === currentKey) continue;
    core.ObjectManager.deregister(drip.object, true);
    fight.pools.delete(currentKey);
    const moved = spawnPool(npc, pos.getX(), pos.getY());
    if (moved) drip.object = moved;
    else fight.drips.splice(index, 1);
  }
}

/** Acid hurts more the longer a player keeps standing on it (Wiki). */
function tickPools(npc, fight, players) {
  for (const player of players) {
    if (!alive(player)) continue;
    const pos = player.getLocation();
    const key = Shared.tileKey(pos.getX(), pos.getY());
    const standing = fight.standing.get(player);
    if (!fight.pools.has(key)) {
      fight.standing.delete(player);
      continue;
    }
    const ticks = standing && standing.key === key ? standing.ticks + 1 : 1;
    fight.standing.set(player, { key, ticks });
    const damage = Shared.poolDamage(ticks);
    player.getCombat().getHitQueue().addPendingDamage([new core.HitDamage(damage, core.HitMask.RED)]);
  }
}

function tick() {
  for (const [npc, fight] of fights) {
    if (!alive(npc)) {
      endFight(npc);
      continue;
    }
    const players = npc.getPlayersWithinDistance(25);
    if (core.World.getProcessCycle() >= fight.nextHatchAt) {
      fight.nextHatchAt += Shared.HATCH_INTERVAL_TICKS;
      npc.setAttribute?.(Shared.ATTR_LAST_HATCH, core.World.getProcessCycle());
      Minions.hatchNext(npc);
    }
    tickBall(npc, fight, players);
    tickDrips(npc, fight);
    tickPools(npc, fight, players);
  }
}

function endFight(npc) {
  const fight = fights.get(npc);
  if (!fight) return;
  for (const object of fight.pools.values()) {
    core.ObjectManager.deregister(object, true);
  }
  fight.pools.clear();
  fight.standing.clear();
  fight.drips.length = 0;
  if (fight.ball?.isRegistered?.()) {
    core.World.getRemoveNPCQueue().push(fight.ball);
  }
  fight.ball = null;
  fights.delete(npc);
}

function attach(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
  CombatFactory = pluginApi.getCombatFactory();
  class EngineTask extends core.Task {
    constructor() {
      super(1, null, false);
    }

    execute() {
      tick();
    }
  }
  core.TaskManager.submit(new EngineTask());
}

module.exports = {
  attach,
  initFight,
  startSpecial,
  startBall,
  startDrip,
  throwBlobs,
  spawnPool,
  tick,
  tickBall,
  tickDrips,
  tickPools,
  endFight,
  fights,
  _test: { SPECIAL_ANIMATION },
};
