/**
 * Tai Bwo Wannai Cleanup: the ten villagers who turn favour into trading sticks.
 *
 * Each has a multinpc on its chat_ varbit: 0 hides them, 1 shows them holding sticks (due), 2-7
 * without. rsprox 227/01858 and 231/03030: every one is 1 from login, a claim sets it to 7, and it
 * steps down one every 300 ticks (1800 to due again; the Wiki's 15-18 minutes, logged in). A claim
 * is their recorded line, then (once it's continued) the sticks and the item box "You get N
 * trading sticks. You are left with P% favour.", one point spent per stick.
 *
 * The Wiki's order: Murcaily explains the cleanup (cleanup_progress 1), sticks only come after a
 * fence repair, and the first from Murcaily. The payout grows with favour; the Wiki gives no
 * formula, so it is a fit to the three recorded claims (419 -> 23, 921 -> 71, 1000 -> 79 points ->
 * sticks). Villager clothes (more sticks, Wiki) are not modelled.
 */
const Common = require("./Common.TaiBwoWannaiCleanup");
const Favour = require("./Favour.TaiBwoWannaiCleanup");

const { ATTR } = Common;

/** Players whose cooldown clock is running. */
const counting = new WeakSet();

function cooldowns(player) {
  const saved = player.getAttribute(ATTR.COOLDOWNS);
  return saved && typeof saved === "object" ? saved : {};
}

/** The villager's chat_ value: 1 (due) unless claimed from in the last 1800 ticks. */
function cooldownOf(player, villager) {
  return Math.max(Common.data.villagerCooldown.ready, Number(cooldowns(player)[villager.name]) || 0);
}

function setCooldown(player, villager, value) {
  player.setAttribute(ATTR.COOLDOWNS, { ...cooldowns(player), [villager.name]: value });
  Common.varbit(player, villager.varbit, value);
}

/** Sticks for a claim at `points` favour points: at least one while any favour is left (Wiki). */
function sticksFor(points) {
  const { linear, square } = Common.data.sticks;
  if (points <= 0) return 0;
  return Math.min(points, Math.max(1, Math.round(points * (linear + square * points))));
}

function villagerOf(npcId) {
  const npc = (name) => Common.core.CacheDefinitions.getNpcId(name);
  return Common.data.villagers.find((villager) => npcId === npc(villager.npc) || npcId === npc(`${villager.npc}_nosticks`)) ?? null;
}

/** Whether `villager` gives `player` sticks now. */
function canClaim(player, villager) {
  const { progress } = Common.data;
  const stage = Common.progress(player);
  if (stage < (villager.first ? progress.repaired : progress.claimed)) return false;
  if (cooldownOf(player, villager) !== Common.data.villagerCooldown.ready) return false;
  return sticksFor(Favour.points(player)) > 0;
}

function grant(player, villager) {
  const sticks = sticksFor(Favour.points(player));
  const item = Common.objId(Common.data.sticks.item);
  if (sticks <= 0) return;
  const inventory = player.getInventory();
  if (!inventory.contains(item) && inventory.getFreeSlots() <= 0) {
    player.sendMessage(Common.message("noRoom"));
    return;
  }
  Favour.spend(player, sticks);
  setCooldown(player, villager, Common.data.villagerCooldown.claimed);
  inventory.add(new Common.core.Item(item, sticks));
  Common.advance(player, Common.data.progress.claimed);
  startCooldowns(player);
  const { DialogueChainBuilder, EndDialogue, ItemStatementDialogue } = Common.core;
  player.getDialogueManager().startDialogues(new DialogueChainBuilder().add(
    new ItemStatementDialogue(0, item, Common.message("claimed", { sticks, favour: Favour.percentage(player) })),
    new EndDialogue(1),
  ));
}

/** Talk-to: the claim when sticks are due; otherwise the villager's own transcript. */
function talkTo(event) {
  const { player } = event;
  const villager = villagerOf(event.npcId);
  if (!villager || !canClaim(player, villager)) return false;
  event.handled = true;
  const { ActionDialogue, DialogueChainBuilder, NpcDialogue } = Common.core;
  const npcId = Common.core.CacheDefinitions.getNpcId(villager.npc);
  player.getDialogueManager().startDialogues(new DialogueChainBuilder().add(
    new NpcDialogue(0, npcId, Common.message(villager.first && Common.progress(player) < Common.data.progress.claimed ? "firstClaim" : "claim")),
    new ActionDialogue(1, { execute: () => grant(player, villager) }),
  ));
  return true;
}

/** Steps every claimed villager one closer to due every 300 ticks while logged in. */
function startCooldowns(player) {
  const { Task, TaskManager } = Common.core;
  if (counting.has(player)) return;
  counting.add(player);
  TaskManager.submit(new (class extends Task {
    constructor() {
      super(Common.data.villagerCooldown.stepTicks, null, false);
    }
    execute() {
      if (player.isRegistered() && stepCooldowns(player)) return;
      counting.delete(player);
      this.stop();
    }
  })());
}

/** One step down for each claimed villager; whether any is still waiting. */
function stepCooldowns(player) {
  const { ready } = Common.data.villagerCooldown;
  let waiting = false;
  for (const villager of Common.data.villagers) {
    const value = cooldownOf(player, villager);
    if (value <= ready) continue;
    setCooldown(player, villager, value - 1);
    waiting ||= value - 1 > ready;
  }
  return waiting;
}

function sendOnLogin({ player }) {
  for (const villager of Common.data.villagers) Common.varbit(player, villager.varbit, cooldownOf(player, villager));
  if (Common.data.villagers.some((villager) => cooldownOf(player, villager) > Common.data.villagerCooldown.ready)) startCooldowns(player);
}

// ------------------------------------------------------------------ Murcaily's transcript

/** His "if you're stuck for something to do" is where he explains the cleanup. */
function toldOnLine(event) {
  if (event.definition?.getName?.() !== "Murcaily") return;
  if (!String(event.text ?? "").startsWith(Common.data.murcaily.toldLine)) return;
  const { player } = event;
  event.before = () => Common.advance(player, Common.data.progress.told);
}

/** His transcript's cleanup conditions, from the progress (the first claim itself is talkTo). */
function answerCondition(event) {
  if (event.definition?.getName?.() !== "Murcaily") return undefined;
  const { conditions } = Common.data.murcaily;
  const { player } = event;
  const stage = Common.progress(player);
  const { progress } = Common.data;
  switch (event.text) {
    // His welcome back, until he has told the player about the cleanup.
    case conditions.afterJunglePotion: return stage < progress.told;
    case conditions.hackedNotRepaired: {
      const due = stage === progress.hacked && player.getAttribute(ATTR.HACK_TOLD) !== true;
      if (due) player.setAttribute(ATTR.HACK_TOLD, true);
      return due;
    }
    case conditions.repaired: return false;
    case conditions.notHacked: return stage < progress.hacked;
    case conditions.hacked: return stage >= progress.hacked;
    default: return undefined;
  }
}

function attachVillagers(api) {
  api.persistAttribute(ATTR.COOLDOWNS, {});
  api.persistAttribute(ATTR.HACK_TOLD, false);
  api.onPlayerLogin(sendOnLogin);
  for (const villager of Common.data.villagers) api.onNpcInteraction(villager.name, { "Talk-to": talkTo });
  api.onNpcDialogueCondition(answerCondition);
  api.onCustomEvent("npc-dialogue:line", toldOnLine);
}

module.exports = { attachVillagers, talkTo, canClaim, sticksFor, cooldownOf, stepCooldowns, villagerOf, answerCondition, toldOnLine };
