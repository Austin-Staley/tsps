const Common = require('./Common.Leviathan');
const { own } = require('./Fight.Leviathan');
const MONSTER = 'Leviathan';
function current(npc, player = null) {
  const f = own(npc);
  return f && f.boss === npc && f.over && !f.stopped && !f.session.ended && f.session.fight === f &&
    npc.getHitpoints() === 0 && (!player || f.player === player) ? f : null;
}
function context(event) {
  const fight = current(event.npc, event.player);
  if (fight && event.context) event.context.perfectKill = fight.perfect;
}
function location(event) {
  const fight = current(event.npc, event.player);
  if (fight) event.location = fight.session.tile(Common.data.arena.loot);
}
function died({ npc, killer }) {
  const fight = current(npc, killer);
  if (!fight || fight.rewarded || killer !== fight.player) return;
  fight.rewarded = true;
  const { player, session, awakened } = fight;
  const key = awakened ? Common.AWAKENED_KILLS_ATTRIBUTE : Common.KILLS_ATTRIBUTE;
  let kills = Common.count(player, key) + 1;
  const announce = count => player.sendMessage(`Your ${awakened ? 'awakened ' : ''}Leviathan kill count is: <col=ff0000>${count}</col>.`);
  if (!awakened) {
    let announced = false;
    const request = { player, monster: MONSTER, count: kills, announce: value => { announced = true; announce(value); } };
    Common.api.emitCustomEvent('combat-achievements:kill', request);
    if (Number.isInteger(request.total)) kills = Math.max(kills, request.total);
    if (!announced) announce(kills);
  } else announce(kills);
  player.setAttribute(key, kills);
  player.getPacketSender().sendConfig(Common.ids.varps[awakened ? 'awakenedKills' : 'kills'], kills);
  const bestKey = awakened ? Common.AWAKENED_BEST_ATTRIBUTE : Common.BEST_ATTRIBUTE;
  const previous = Common.count(player, bestKey), ticks = fight.finishedTicks;
  if (!previous || ticks < previous) player.setAttribute(bestKey, ticks);
  player.sendMessage(`Fight duration: ${(ticks * 0.6).toFixed(1)} seconds${!previous || ticks < previous ? ' (new personal best)' : ''}.`);
  const complete = task => Common.api.emitCustomEvent('combat-achievements:complete', { player, task });
  if (awakened) complete('Leviathan Sleeper');
  else {
    if (fight.perfect && ++session.perfectKills >= 5) complete('Perfect Leviathan');
    if (fight.stuns <= 1) complete('Serpentine Solo');
    const task = { player, npc, onTask: false };
    Common.api.emitCustomEvent('slayer:on-task', task);
    if (!task.onTask) for (const [name, seconds] of [['Trialist', 110], ['Chaser', 85], ['Runner', 70]])
      if (ticks * 0.6 < seconds) complete(`Leviathan Speed-${name}`);
  }
  session.scheduleRespawn?.(fight);
}
function counts(request) { const count = Common.count(request.player, Common.KILLS_ATTRIBUTE); if (count) request.counts[MONSTER] = count; }
function best(request) { if (request.monster === MONSTER) request.best = Common.count(request.player, Common.BEST_ATTRIBUTE); }
function login({ player }) {
  player.getPacketSender().sendConfig(Common.ids.varps.kills, Common.count(player, Common.KILLS_ATTRIBUTE));
  player.getPacketSender().sendConfig(Common.ids.varps.awakenedKills, Common.count(player, Common.AWAKENED_KILLS_ATTRIBUTE));
}
function attach(api) {
  api.persistAttribute(Common.KILLS_ATTRIBUTE, 0);
  api.persistAttribute(Common.AWAKENED_KILLS_ATTRIBUTE, 0);
  api.persistAttribute(Common.BEST_ATTRIBUTE, 0);
  api.persistAttribute(Common.AWAKENED_BEST_ATTRIBUTE, 0);
  api.onNpcDeath(died);
  api.onPlayerLogin(login);
  api.onCustomEvent('npc-drops:context', context);
  api.onCustomEvent('npc-drops:location', location);
  api.onCustomEvent('combat-achievements:kill-count', counts);
  api.onCustomEvent('combat-achievements:personal-best', best);
}
module.exports = { attach };
