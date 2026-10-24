/**
 * After a challenge (Wiki: TzHaar-Ket-Rak's_Challenges, Transcript:TzHaar-Ket-Rak):
 * - a completion pays its TokKul (inventory, or the floor when it can't hold it), counts on the
 *   challenge's varp, and the first sixth unlocks the JalRek-Jad metamorphosis (Pets.plugin.js
 *   reads the flag);
 * - TzHaar-Ket-Rak says the transcript's line for it, or "Failure..." for a failed one (not to a
 *   player who logged out);
 * - Combat Achievements: the tasks the completion meets, by name. Its kill-count tasks ("Complete
 *   TzHaar-Ket-Rak's second challenge.") name a challenge, not a count, so no count is reported:
 *   Data.CombatAchievements would read each as "once". Best times are kept for the scoreboard.
 */
const Common = require("./Common.TzHaarKetRak");
const Dialogue = require("./Dialogue.TzHaarKetRak");

const SECONDS_PER_TICK = 0.6;
const STYLES = ["MELEE", "RANGED", "MAGIC"];

function give(player, itemId, amount) {
  const { core } = Common;
  const inventory = player.getInventory();
  if (inventory.contains(itemId) || inventory.getFreeSlots() > 0) {
    inventory.adds(itemId, amount);
    return;
  }
  core.ItemOnGroundManager.registerLocation(player, new core.Item(itemId, amount), player.getLocation().clone(), null);
}

function sendCounts(player) {
  const sender = player.getPacketSender();
  for (let challenge = 1; challenge <= Common.SIX; challenge++) {
    sender.sendConfig(Common.ids.varps[`c${challenge}`], Common.completions(player, challenge));
  }
  sender.sendVarbit(Common.ids.varbits.transmog, player.getAttribute(Common.PET_UNLOCK_ATTRIBUTE) === true ? 1 : 0);
}

function bestTimes(player) {
  const times = player.getAttribute(Common.BEST_TIMES_ATTRIBUTE);
  return times && typeof times === "object" ? { ...times } : {};
}

/** The tasks a completion meets (Wiki task list; times in game ticks). */
function tasksFor(player, challenge) {
  const { ca } = Common.data;
  const n = String(challenge.number);
  const tasks = [];
  if (ca.killCount[n]) tasks.push(ca.killCount[n]);
  const speed = ca.speed[n];
  if (speed && challenge.elapsedTicks() * SECONDS_PER_TICK < speed[1]) tasks.push(speed[0]);
  if (ca.meleeOnly[n] && !challenge.nonMelee) tasks.push(ca.meleeOnly[n]);
  if (ca.emptyInventory[n] && challenge.emptyInventory) tasks.push(ca.emptyInventory[n]);
  if (ca.multiStyle[n]) {
    // Each Jad damaged with one style only, and every Jad a different one.
    const styles = [...challenge.styles.values()];
    const single = styles.length === challenge.number && styles.every((set) => set.size === 1);
    const distinct = new Set(styles.map((set) => [...set][0]));
    if (single && distinct.size === challenge.number && [...distinct].every((style) => STYLES.includes(style))) tasks.push(ca.multiStyle[n]);
  }
  if (challenge.number === Common.SIX && Number(player.getAttribute(Common.LAST_COMPLETED_ATTRIBUTE)) === Common.SIX - 1) {
    tasks.push(ca.backToBack);
  }
  return tasks;
}

function completed(player, challenge) {
  const { api, data, ids } = Common;
  const number = challenge.number;
  const tasks = tasksFor(player, challenge);
  const firstSixth = number === Common.SIX && player.getAttribute(Common.PET_UNLOCK_ATTRIBUTE) !== true;
  const tokkul = data.rewards[number - 1];
  give(player, ids.objs.tokkul, tokkul);
  player.setAttribute(Common.completionsAttribute(number), Common.completions(player, number) + 1);
  if (firstSixth) player.setAttribute(Common.PET_UNLOCK_ATTRIBUTE, true);
  player.setAttribute(Common.LAST_COMPLETED_ATTRIBUTE, number);
  const times = bestTimes(player);
  const ticks = challenge.elapsedTicks();
  if (!(Number(times[number]) > 0) || ticks < Number(times[number])) {
    times[number] = ticks;
    player.setAttribute(Common.BEST_TIMES_ATTRIBUTE, times);
  }
  sendCounts(player);
  for (const task of tasks) api.emitCustomEvent("combat-achievements:complete", { player, task });
  const variant = number !== Common.SIX ? Dialogue.VARIANT.completed
    : firstSixth ? Dialogue.VARIANT.sixthFirst : Dialogue.VARIANT.sixthAgain;
  Dialogue.say(player, variant, { challenge: number, tokkul });
}

function failed(player, challenge, { logout = false } = {}) {
  player.setAttribute(Common.LAST_COMPLETED_ATTRIBUTE, 0);
  if (!logout) Dialogue.say(player, Dialogue.VARIANT.failed, { challenge: challenge.number });
}

function refused(player, number, reason) {
  Dialogue.say(player, Dialogue.VARIANT[reason], { challenge: number });
}

function onLogin({ player }) {
  sendCounts(player);
}

function attach(api) {
  for (let challenge = 1; challenge <= Common.SIX; challenge++) api.persistAttribute(Common.completionsAttribute(challenge), 0);
  api.persistAttribute(Common.PET_UNLOCK_ATTRIBUTE, false);
  api.persistAttribute(Common.BEST_TIMES_ATTRIBUTE, {});
  api.persistAttribute(Common.LAST_COMPLETED_ATTRIBUTE, 0);
  api.onPlayerLogin(onLogin);
}

module.exports = { attach, completed, failed, refused, tasksFor, give };
