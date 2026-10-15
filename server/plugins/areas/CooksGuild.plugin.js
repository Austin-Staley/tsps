/**
 * The Cooks' Guild door in Varrock (https://oldschool.runescape.wiki/w/Cooks%27_Guild): coming in
 * needs 32 Cooking and one of a chef's hat (or golden chef's hat), a Cooking cape or hood, a max
 * cape or hood (or a variant), or Varrock armour 3 or 4 worn. The head chef turns the rest away
 * with his Wiki transcript's lines. Leaving is never stopped; the door itself opens as any door
 * does (rsprox captures: it swings into the guild, north).
 */
const REQUIRED_LEVEL = 32;
const NO_HAT_VARIANT = "standard-dialogue-trying-to-open-the-door-without-a-chef-s-hat-a-skillcape-of-cooking-or-varrock-armour-3";
const LOW_LEVEL_NO_HAT_VARIANT = "standard-dialogue-trying-to-open-the-door-with-below-32-cooking-and-without-a-chef-s-hat";
const LOW_LEVEL_HAT_VARIANT = "standard-dialogue-trying-to-open-the-door-with-below-32-cooking-with-a-chef-s-hat";
/** The guild is north of the door; its tile is outside. */
const INSIDE_FROM_Y = 3444;
const HATS = /^(?:golden )?chef's hat$|^cooking hood$|max hood$/i;
const VARROCK_ARMOUR = /^varrock armour [34]$/i;

let api;
let core;

function wornName(player, slot) {
  const id = player.getEquipment().getItems()[slot]?.getId?.() ?? -1;
  return id > 0 ? core.ItemDefinition.forId(id)?.getName?.() ?? "" : "";
}

function wearsCookingCape(player) {
  const request = { player, skill: "COOKING", result: false };
  api.emitCustomEvent("skillcape:has-perk", request);
  return request.result === true;
}

/** A chef's hat, or something like that. */
function dressedForIt(player) {
  const { Equipment } = core;
  return HATS.test(wornName(player, Equipment.HEAD_SLOT)) || VARROCK_ARMOUR.test(wornName(player, Equipment.BODY_SLOT)) ||
    wearsCookingCape(player);
}

function refusal(player) {
  const level = player.getSkillManager().getMaxLevel(core.Skill.COOKING) >= REQUIRED_LEVEL;
  const dressed = dressedForIt(player);
  if (level && dressed) return null;
  if (level) return NO_HAT_VARIANT;
  return dressed ? LOW_LEVEL_HAT_VARIANT : LOW_LEVEL_NO_HAT_VARIANT;
}

function openDoor(event) {
  const { player } = event;
  if (player.getLocation().getY() >= INSIDE_FROM_Y) return false;
  const variant = refusal(player);
  if (!variant) return false;
  api.emitCustomEvent("npc-dialogue:start", { player, npcId: core.NpcIdentifiers.HEAD_CHEF, variant, handled: false });
  return true;
}

module.exports = {
  name: "CooksGuild",
  _test: { refusal, openDoor },
  register(pluginApi) {
    api = pluginApi;
    core = pluginApi.core;
    api.onObjectFirstClick(core.CacheDefinitions.getLocId("chefdoor"), openDoor);
  },
};
