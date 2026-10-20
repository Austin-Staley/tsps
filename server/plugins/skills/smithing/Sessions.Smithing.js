/**
 * Smithing's make-X loops (smelting, anvil work, cannonballs): one task ticks every player's
 * session. A session makes its first item `firstDelay` ticks after it starts, then one every
 * `interval` ticks, until `remaining` runs out, `step` returns false, or the player moves,
 * dies or logs out.
 */
const Core = require("./Core.Smithing");

const SESSIONS = new Map();
/** Other per-tick work (closing menus a player walked away from). */
const EVERY_TICK = [];
let tick = 0;

/** `step(player)` makes one item; false ends the session. `onStop(player)` runs however it ends. */
function start(player, { type, remaining, interval, firstDelay, step, onStop }) {
  stop(player, false);
  SESSIONS.set(player, { type, remaining, interval, nextTick: tick + firstDelay, step, onStop });
}

function stop(player, resetAnimation = true) {
  const session = SESSIONS.get(player);
  if (!session) return;
  SESSIONS.delete(player);
  session.onStop?.(player);
  if (resetAnimation) player.performAnimation(Core.Animation.DEFAULT_RESET_ANIMATION);
}

function typeOf(player) {
  return SESSIONS.get(player)?.type ?? null;
}

function everyTick(fn) {
  EVERY_TICK.push(fn);
}

function process() {
  tick++;
  for (const fn of EVERY_TICK) fn();
  for (const [player, session] of SESSIONS) {
    if (!player?.isRegistered?.() || player.getHitpoints() <= 0) {
      stop(player, false);
      continue;
    }
    if (player.getMovementQueue().size() > 0 || player.getForceMovement() != null) {
      stop(player);
      continue;
    }
    if (tick < session.nextTick) continue;
    session.nextTick = tick + session.interval;
    if (!session.step(player)) {
      stop(player);
      continue;
    }
    if (--session.remaining <= 0) stop(player, false);
  }
}

/** The ticking task; a closure-free Task subclass built from `api.core`. */
function createTask() {
  class SmithingTask extends Core.Task {
    constructor() {
      super(1);
    }

    execute() {
      process();
    }
  }
  return new SmithingTask();
}

module.exports = { start, stop, typeOf, everyTick, createTask };
