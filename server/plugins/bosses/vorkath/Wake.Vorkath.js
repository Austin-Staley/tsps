/**
 * Waking, sleeping and dying around the fight itself (combat lives in Combat.Vorkath.js,
 * specials in Specials.Vorkath.js).
 *
 * Vorkath sleeps as 8059 until poked: the wake transforms her to 8061 in place, plays the
 * rise over 7 ticks, then she attacks the poker. Kills respawn her asleep after a short
 * delay. Attacks on the sleeper are denied with a poke-first message.
 */
const Shared = require("./Shared.Vorkath");
const Specials = require("./Specials.Vorkath");

const POKE_ANIMATION = 827;
const WAKE_ANIMATION = 7950;
const POKE_FIRST_MESSAGE = "You need to poke Vorkath awake first.";
const WAKE_MESSAGE = "Vorkath awakens.";

let api = null;
let core = null;

function later(ticks, action) {
  core.TaskManager.submit(new (class extends core.Task {
    constructor() {
      super(Math.max(1, ticks), null, false);
    }
    execute() {
      this.stop();
      action();
    }
  })());
}

function alive(entity) {
  return !!entity?.isRegistered?.() && (entity.getHitpoints?.() ?? 1) > 0;
}

function pokeVorkath({ player, npc }) {
  if (!npc || npc.getId() !== Shared.SLEEPING_ID || !alive(npc)) return false;
  if (!alive(player)) return false;
  player.performAnimation(new core.Animation(POKE_ANIMATION));
  npc.setNpcTransformationId(Shared.AWAKE_ID);
  npc.setHitpoints?.(Shared.MAX_HITPOINTS);
  npc.performAnimation(new core.Animation(WAKE_ANIMATION));
  player.sendMessage(WAKE_MESSAGE);
  const cycle = core.World.getProcessCycle();
  npc.setAttribute(Shared.ATTR_ATTACKS, 0);
  npc.setAttribute(Shared.ATTR_NEXT_SPECIAL, Math.random() < 0.5 ? Shared.SPECIAL_ACID : Shared.SPECIAL_SPAWN);
  npc.setAttribute(Shared.ATTR_PHASE, Shared.PHASE_ACTIVE);
  npc.setAttribute(Shared.ATTR_WAKE_UNTIL, cycle + Shared.WAKE_TICKS);
  later(Shared.WAKE_TICKS, () => {
    if (!alive(npc) || npc.getId() !== Shared.AWAKE_ID || !alive(player)) return;
    npc.getCombat?.().attack?.(player);
  });
  return true;
}

function denySleepingAttack(event) {
  const target = event.target;
  if (!target?.isNpc?.() || target.getId() !== Shared.SLEEPING_ID) return;
  event.allow = false;
  if (event.attacker?.isPlayer?.()) {
    event.attacker.sendMessage(POKE_FIRST_MESSAGE);
  }
}

function denyWakeAttack(event) {
  const target = event.target;
  if (!target?.isNpc?.() || target.getId() !== Shared.AWAKE_ID) return;
  const until = target.getAttribute?.(Shared.ATTR_WAKE_UNTIL) ?? 0;
  if (core.World.getProcessCycle() < until) {
    event.allow = false;
  }
}

function vorkathDied({ npc }) {
  if (!npc || npc.getId() !== Shared.AWAKE_ID) return;
  const location = npc.getLocation().clone();
  Specials.endFight(npc);
  later(Shared.RESPAWN_TICKS, () => {
    const sleeper = core.NPC.create(Shared.SLEEPING_ID, location.clone());
    sleeper.getMovementCoordinator?.().setRadius?.(0);
    core.World.getAddNPCQueue().push(sleeper);
  });
}

function attach(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
  pluginApi.onNpcInteraction("Vorkath", { Poke: pokeVorkath });
  pluginApi.onCanAttack(denySleepingAttack);
  pluginApi.onCanAttack(denyWakeAttack);
  pluginApi.onNpcDeath(vorkathDied);
}

module.exports = { attach, pokeVorkath, denySleepingAttack, denyWakeAttack, vorkathDied };
