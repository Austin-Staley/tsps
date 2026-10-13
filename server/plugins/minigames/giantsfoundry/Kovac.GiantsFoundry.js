"use strict";

/**
 * Kovac (11472, shown by kovac_multi 11560 once Sleeping Giants is complete): commissions and
 * his Talk-to.
 *
 * - Talk-to plays the Wiki's "Transcript:Kovac" (npc-dialogues.json). This unit answers its
 *   "has a commission" conditions and fills in its "[sword style]" blanks; the "Make [sword
 *   style] sword." line hands out the commission it names.
 * - Commission (op4) gives one straight away (rsprox captures: commission_word_1/2 are set on
 *   the click's tick, then "Make <col=ef1020>Light Spiked</col> sword.").
 *
 * A commission is two words from enum 4372 on different axes: the first Broad, Narrow, Heavy
 * or Light, the second Heavy, Light, Flat or Spiked (the twelve pairs live OSRS hands out).
 */

const Shared = require("./Shared.GiantsFoundry");

const WORDS_ENUM = 4372;
const WORD = { NARROW: 1, LIGHT: 2, FLAT: 3, BROAD: 4, HEAVY: 5, SPIKED: 6 };
const FIRST_WORDS = [WORD.BROAD, WORD.NARROW, WORD.HEAVY, WORD.LIGHT];
const SECOND_WORDS = [WORD.HEAVY, WORD.LIGHT, WORD.FLAT, WORD.SPIKED];
/** Each word's axis: Broad-Narrow, Heavy-Light, Spiked-Flat. */
const AXIS = { 1: 0, 4: 0, 2: 1, 5: 1, 3: 2, 6: 2 };
const STYLE_COLOUR = "ef1020";
const STYLE_PLACEHOLDER = "[sword style]";

/** "Transcript:Kovac" conditions, by step id. */
const CONDITION = {
  NO_COMMISSION: ["Hponlh", "Gf7nCm"],
  HAS_COMMISSION: ["JVpUXP", "n4UTPI", "AGlqvx"],
};

const COMMISSION_STARTED = "commissionStarted";

/** Every pair Kovac can ask for: the two words never share an axis. */
const PAIRS = FIRST_WORDS.flatMap((first) =>
  SECOND_WORDS.filter((second) => AXIS[first] !== AXIS[second]).map((second) => [first, second]));

function wordName(word) {
  const { CacheDefinitions } = Shared.core();
  return String(CacheDefinitions.getEnumValues(WORDS_ENUM).get(word) ?? "");
}

function words(player) {
  return [Shared.get(player, Shared.VARBIT.COMMISSION_WORD_1), Shared.get(player, Shared.VARBIT.COMMISSION_WORD_2)];
}

function hasCommission(player) {
  return words(player)[0] !== 0;
}

/** "Light Spiked", coloured as Kovac says it. */
function style(player) {
  const [first, second] = words(player);
  return `<col=${STYLE_COLOUR}>${wordName(first)} ${wordName(second)}</col>`;
}

/** Hands out a new commission and starts its timer (the hand-in reports the time taken). */
function giveCommission(player, pair = PAIRS[Math.floor(Math.random() * PAIRS.length)]) {
  Shared.set(player, Shared.VARBIT.COMMISSION_WORD_1, pair[0]);
  Shared.set(player, Shared.VARBIT.COMMISSION_WORD_2, pair[1]);
  Shared.setField(player, COMMISSION_STARTED, Date.now());
}

function clearCommission(player) {
  Shared.set(player, Shared.VARBIT.COMMISSION_WORD_1, 0);
  Shared.set(player, Shared.VARBIT.COMMISSION_WORD_2, 0);
  Shared.setField(player, COMMISSION_STARTED, null);
}

/** The new commission's line, handing it out first. */
function commissionLine(player) {
  giveCommission(player);
  return `Make ${style(player)} sword.`;
}

function commission({ player }) {
  if (hasCommission(player)) {
    Shared.kovacSays(player, `Kovac give commission already. Go make me ${style(player)} sword.`);
    return;
  }
  Shared.kovacSays(player, commissionLine(player));
}

function isKovac(npcId) {
  return npcId === Shared.NPC.KOVAC;
}

function answerCondition({ npcId, player, stepId }) {
  if (!isKovac(npcId)) return null;
  if (CONDITION.NO_COMMISSION.includes(stepId)) return !hasCommission(player);
  if (CONDITION.HAS_COMMISSION.includes(stepId)) return hasCommission(player);
  return null;
}

/** Fills "[sword style]"; the first line that names a new commission hands it out. */
function fillStyle(request) {
  if (!isKovac(request.npcId) || typeof request.text !== "string" || !request.text.includes(STYLE_PLACEHOLDER)) return;
  if (!hasCommission(request.player) && /^Make \[sword style\] sword\.$/.test(request.text)) {
    request.text = commissionLine(request.player);
    return;
  }
  request.text = request.text.split(STYLE_PLACEHOLDER).join(style(request.player));
}

module.exports = function attachKovac(api) {
  api.onNpcInteraction(Shared.NPC.KOVAC_NAME, { Commission: commission });
  api.onNpcDialogueCondition(answerCondition);
  api.onCustomEvent("npc-dialogue:line", fillStyle);
};

Object.assign(module.exports, {
  WORD, PAIRS, words, hasCommission, style, giveCommission, clearCommission, commissionLine, wordName,
  COMMISSION_STARTED,
});
