"use strict";

// Clue NPCs speak their own Wiki transcript (npc-dialogues.json, read through NpcDialogues'
// "npc-dialogue:start" with a `select` that only captures the steps). The trail decides what
// happens; the transcript supplies the words, with the wording most transcripts share as a fallback.
// The transcripts name the "talk again with the scroll" variant several ways.
const AGAIN_SUFFIXES = ["when-talked-to-again", "when-spoken-to-again", "talking-again", "spoken-to-again", "talked-to-again",
  "talked-to-when-talked-to-again", "speaking-to-him-again-with-the-challenge-scroll-in-the-inventory", "answering-the-clue", "solving-the-challenge"];
let api;
let core;

function attach(pluginApi) {
  api = pluginApi;
  core = api.core;
}

/** The steps of one variant of the NPC's transcript, or null when it has none. */
function transcript(player, npc, npcId, variant) {
  let found = null;
  // `exact`: an NPC without this variant has nothing to say here, not its everyday chat.
  api.emitCustomEvent("npc-dialogue:start", { player, npc, npcId, variant, exact: true, handled: false,
    select: steps => { found = steps; return []; } });
  return Array.isArray(found) && found.length ? found : null;
}

/** The first of `variants` the NPC's transcript has. */
function firstTranscript(player, npc, npcId, variants) {
  for (const variant of variants) {
    const steps = transcript(player, npc, npcId, variant);
    if (steps) return steps;
  }
  return null;
}

function againTranscript(player, npc, npcId, tier) {
  return firstTranscript(player, npc, npcId, AGAIN_SUFFIXES.map(suffix => `treasure-trails-${tier}-${suffix}`));
}

/** Spoken lines up to the first action, message, condition or end; a random step picks one option. */
function lines(steps, random = Math.random) {
  const spoken = [];
  for (const step of steps ?? []) {
    if (typeof step.npc === "string") spoken.push({ npc: step.npc });
    else if (typeof step.player === "string") spoken.push({ player: step.player });
    else if (step.type === "line" && typeof step.text === "string") spoken.push({ npc: step.text });
    else if (step.type === "random" && step.options?.length) {
      spoken.push(...lines(step.options[Math.floor(random() * step.options.length)].steps, random));
      break;
    } else break;
  }
  return spoken;
}

function branch(steps, test) {
  return (steps ?? []).find(step => step.type === "condition" && test(step.text ?? ""))?.steps ?? null;
}

const wrongBranch = steps => branch(steps, text => /wrong|incorrect/i.test(text));
const correctBranch = steps => branch(steps, text => /correct/i.test(text) && !/incorrect/i.test(text));

/**
 * The hand-over message for a clue or (with `casket`) a casket: "[a/b]" choices resolved, and
 * nested "another clue scroll" / "casket" conditions followed only on the matching side.
 */
function message(steps, casket = false) {
  for (const step of steps ?? []) {
    if (step.type === "message" && typeof step.text === "string") return step.text.replace(/\[([^\]/]+)\/([^\]]+)\]/g, (_, a, b) => casket ? b : a);
    if (step.type === "condition" && (/casket/i.test(step.text ?? "") ? !casket : /clue scroll/i.test(step.text ?? "") && casket)) continue;
    const nested = message(step.steps, casket);
    if (nested) return nested;
  }
  return null;
}

/** Plays spoken lines, then `onEnd` (if any) once the player has continued past them. */
function play(player, npcId, spoken, onEnd) {
  // A dialogue of only an action never shows, so its action would never run.
  if (!spoken.length) { onEnd?.(); return; }
  const chain = new core.DialogueChainBuilder();
  spoken.forEach((line, index) => chain.add(line.player != null ? new core.PlayerDialogue(index, line.player) : new core.NpcDialogue(index, npcId, line.npc)));
  if (onEnd) chain.add(new core.ActionDialogue(spoken.length, { execute: onEnd }));
  chain.add(new core.EndDialogue(spoken.length + 1));
  player.getDialogueManager().startDialogues(chain);
}

module.exports = { attach, transcript, againTranscript, lines, branch, wrongBranch, correctBranch, message, play };
