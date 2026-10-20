/**
 * Message boxes for the repair-style smithing (godswords, shields): a plain box or one showing
 * an item, optionally running `then` when the player continues.
 */
const Core = require("./Core.Smithing");

function show(player, entry, then) {
  const { DialogueChainBuilder, ActionDialogue } = Core;
  const chain = new DialogueChainBuilder().add(entry);
  // An ActionDialogue only works at the end of a chain: it runs on the box's continue.
  if (then) chain.add(new ActionDialogue(1, { execute: () => { player.getDialogueManager().reset(); then(); } }));
  player.getDialogueManager().startDialogues(chain);
}

function messageBox(player, text, then) {
  show(player, new Core.StatementDialogue(0, text), then);
}

function itemBox(player, itemId, text, then) {
  show(player, new Core.ItemStatementDialogue(0, itemId, text), then);
}

/** Wiki (Smithing): a hammer, or an Imcando hammer carried or wielded (either hand). */
function hasHammer(player) {
  const { ItemIdentifiers: Items, Equipment } = Core;
  const hammers = [Items.HAMMER, Items.IMCANDO_HAMMER, Items.IMCANDO_HAMMER_OFF_HAND_];
  const equipment = player.getEquipment?.();
  const wielded = [Equipment.WEAPON_SLOT, Equipment.SHIELD_SLOT].map((slot) => equipment?.get(slot)?.getId?.());
  return hammers.some((id) => player.getInventory().contains(id) || wielded.includes(id));
}

function smithingLevel(player) {
  return player.getSkillManager().getCurrentLevel(Core.Skill.SMITHING);
}

/** The cache id of an obj gameval, e.g. "godwars_godsword_blade1". */
function obj(name) {
  const id = Core.CacheDefinitions.getObjId(name);
  if (id == null) throw new Error(`Smithing: unknown obj ${name}`);
  return id;
}

module.exports = { messageBox, itemBox, hasHammer, smithingLevel, obj };
