// The Grand Exchange's two decanters (rsprox 226/01637, 226/01671, 232/03238, 238/04168; Wiki):
// - Bob Barter (herbs) > Decant opens the decant interface (582); its four buttons pool every potion
//   family's doses into potions of that many doses, the rest in one smaller potion, empty vials back.
//   Families come from the cache's dose enum (Potions' "potions:dose-family"); only those that empty
//   into a vial are his to decant.
// - Murky Matt (runes) > Decant pools the charges on teleport jewellery the same way, up to each
//   piece's normal capacity; an emptied piece comes back uncharged, or is gone.
// Noted and unnoted are pooled apart and come back as they went in (recorded). Neither charges for the
// service; Bob sells any vial he has to supply (Wiki).
const DATA = require("./data/ge-decanters.json");

let api;

const core = () => api.core;
const definition = (id) => core().ItemDefinition.forId(id);
const objId = (name) => core().CacheDefinitions.getObjId(name);
const MAX_STACK = 2147483647;

function talk(player, who, line, mood) {
  const { DialogueChainBuilder, NpcDialogue, CacheDefinitions } = core();
  const npcId = CacheDefinitions.getNpcId(who.npc);
  player.getDialogueManager().startDialogues(new DialogueChainBuilder().add(new NpcDialogue(0, npcId, line, who.name, DATA.anim[mood])));
}

/** The inventory's stacks as { slot, id, amount, base, noted }: `base` is the unnoted item. */
function stacks(player) {
  return player.getInventory().getItems().map((item, slot) => {
    if (!item || item.getId() <= 0 || item.getAmount() <= 0) return null;
    const def = definition(item.getId());
    const noted = def.isNoted();
    return { slot, id: item.getId(), amount: item.getAmount(), base: noted ? def.getNoteId() : item.getId(), noted, meta: item.getMeta?.() ?? null };
  }).filter(Boolean);
}

const asNoted = (id, noted) => (noted ? definition(id).getNoteId() : id);

/** A plain (no metadata) stack of `id` the group isn't consuming, which `add` would merge into. */
function plainStack(player, id, consumed) {
  if (consumed.has(id)) return null;
  return player.getInventory().getItems().find((item) => item?.getId() === id && item.getAmount() > 0 && (item.getMeta?.() ?? null) == null) ?? null;
}

/**
 * Whether a group's results fit once its own pieces (and, for Bob, the vials and coins it spends) are
 * gone: every unstackable result needs a slot; a stackable one merges into a plain stack only within
 * the stack limit, else needs a slot of its own.
 */
function fits(player, group, adds) {
  const inventory = player.getInventory();
  const consumed = new Set(group.pieces.map((piece) => piece.id));
  let freed = group.noted ? group.stacks : group.pieces.reduce((n, piece) => n + piece.amount, 0);
  freed += group.freesSlots ?? 0;
  let slots = 0;
  for (const { id, amount } of adds) {
    if (!definition(id).isStackable()) {
      slots += amount;
      continue;
    }
    const stack = plainStack(player, id, consumed);
    if (!stack) slots++;
    else if (MAX_STACK - stack.getAmount() < amount) return false;
  }
  return slots <= inventory.getFreeSlots() + freed;
}

/** Pools each group whose results fit; returns { changed, short, poor }. */
function apply(player, groups) {
  const inventory = player.getInventory();
  let changed = false;
  let short = false;
  let poor = false;
  for (const group of groups) {
    const adds = [...group.outputs, ...(group.spare?.amount > 0 ? [group.spare] : [])];
    if (group.cost && !group.cost.affordable) {
      poor = true;
      continue;
    }
    if (!fits(player, group, adds)) {
      short = true;
      continue;
    }
    group.cost?.pay();
    for (const piece of group.pieces) inventory.deleteNumber(piece.id, piece.amount);
    for (const { id, amount } of adds) inventory.add(new (core().Item)(id, amount));
    changed = true;
  }
  inventory.refreshItems();
  return { changed, short, poor };
}

/** The same counts as the pieces already are: nothing to do for this group. */
function sameAs(pieces, outputs) {
  const tally = (list) => list.reduce((map, entry) => map.set(entry.id, (map.get(entry.id) ?? 0) + entry.amount), new Map());
  const before = tally(pieces);
  const after = tally(outputs);
  return before.size === after.size && [...before].every(([id, amount]) => after.get(id) === amount);
}

// ---------------------------------------------------------------- Bob Barter: potions

function doseFamily(itemId) {
  const request = { itemId, family: null };
  api.emitCustomEvent("potions:dose-family", request);
  return request.family;
}

/**
 * Splitting needs vials: the player's own empty ones (noted for a noted group) first, then Bob's at
 * 5 coins each (Wiki). Spending them, and the whole coin stack, frees inventory slots.
 */
function vialCost(player, needed, noted) {
  const inventory = player.getInventory();
  const vial = asNoted(objId(DATA.vial), noted);
  const coins = objId(DATA.coins);
  const own = Math.min(needed, inventory.getAmount(vial));
  const price = (needed - own) * DATA.vialPrice;
  const held = inventory.getAmount(coins);
  const ownSlots = noted ? (own > 0 && own === inventory.getAmount(vial) ? 1 : 0) : own;
  return {
    affordable: held >= price,
    freesSlots: ownSlots + (price > 0 && price === held ? 1 : 0),
    pay() {
      if (own > 0) inventory.deleteNumber(vial, own);
      if (price > 0) inventory.deleteNumber(coins, price);
    },
  };
}

/** Potion groups (one per family, noted apart from unnoted) decanted into `target` doses. */
function potionGroups(player, target) {
  const vial = objId(DATA.vial);
  const groups = new Map();
  for (const stack of stacks(player)) {
    if (stack.meta != null) continue;
    const family = doseFamily(stack.base);
    // Bob's are the vial potions; a family that empties into something else (or nothing) is not.
    if (!family || family.byDose[0] !== vial) continue;
    const key = `${family.byDose.join(",")}:${stack.noted}`;
    if (!groups.has(key)) groups.set(key, { noted: stack.noted, family, pieces: [], stacks: 0 });
    const group = groups.get(key);
    group.pieces.push({ id: stack.id, amount: stack.amount, value: family.byDose.indexOf(stack.base) });
    group.stacks++;
  }
  const result = [];
  for (const group of groups.values()) {
    const { byDose, max } = group.family;
    const doses = Math.min(target, max);
    const total = group.pieces.reduce((sum, piece) => sum + piece.value * piece.amount, 0);
    const full = Math.floor(total / doses);
    const rest = total % doses;
    const idFor = (d) => asNoted(byDose[d], group.noted);
    group.outputs = [...(full > 0 ? [{ id: idFor(doses), amount: full }] : []), ...(rest > 0 ? [{ id: idFor(rest), amount: 1 }] : [])];
    if (sameAs(group.pieces, group.outputs)) continue;
    const potions = group.pieces.reduce((sum, piece) => sum + piece.amount, 0);
    const spare = potions - group.outputs.reduce((sum, out) => sum + out.amount, 0);
    if (spare >= 0) {
      group.spare = { id: asNoted(vial, group.noted), amount: spare };
    } else {
      group.cost = vialCost(player, -spare, group.noted);
      group.freesSlots = group.cost.freesSlots;
    }
    result.push(group);
  }
  return result;
}

function openDecant({ player }) {
  player.getPacketSender().sendChatboxInterface(DATA.decantInterface);
  return true;
}

function decant(player, target) {
  player.getPacketSender().sendSoundEffect(DATA.decantSound, 1, 0, 1);
  const { changed, short, poor } = apply(player, potionGroups(player, target));
  if (short) return talk(player, DATA.bob, DATA.messages.short, "sad");
  if (poor && !changed) return talk(player, DATA.bob, DATA.messages.poor, "sad");
  if (!changed) return talk(player, DATA.bob, DATA.messages.nothingToDecant, "sad");
  talk(player, DATA.bob, DATA.messages.decanted, "happy");
}

/** A dose button, only while the decant interface is the chatbox's (closing or walking off ends it). */
function decantButton(event) {
  if (event.groupId !== DATA.decantInterface) return;
  const target = DATA.buttons[event.childId];
  if (!target || !event.player.getPacketSender().isChatboxInterface(DATA.decantInterface)) return;
  event.handled = true;
  decant(event.player, target);
}

// ---------------------------------------------------------------- Murky Matt: jewellery

let families;

/** id -> { family, charges } for every charged piece of the families Matt handles. */
function jewellery() {
  if (families) return families;
  families = new Map();
  for (const family of DATA.jewellery) {
    for (let charges = 1; charges <= 8; charges++) {
      const id = objId(`${family.prefix}${charges}`);
      if (id != null) families.set(id, { family, charges });
    }
  }
  return families;
}

function jewelleryGroups(player) {
  const groups = new Map();
  let fountain = false;
  for (const stack of stacks(player)) {
    const piece = jewellery().get(stack.base);
    if (!piece || stack.meta != null) continue;
    if (piece.family.fountain) fountain = true;
    // Wiki: never past its normal capacity, as for a glory charged to 6 at the Fountain of Rune.
    if (piece.charges > piece.family.cap) continue;
    const key = `${piece.family.prefix}:${stack.noted}`;
    if (!groups.has(key)) groups.set(key, { noted: stack.noted, family: piece.family, pieces: [], stacks: 0 });
    const group = groups.get(key);
    group.pieces.push({ id: stack.id, amount: stack.amount, value: piece.charges });
    group.stacks++;
  }
  const result = [];
  for (const group of groups.values()) {
    const { cap, prefix, empty } = group.family;
    const total = group.pieces.reduce((sum, piece) => sum + piece.value * piece.amount, 0);
    const full = Math.floor(total / cap);
    const rest = total % cap;
    const idFor = (charges) => asNoted(objId(`${prefix}${charges}`), group.noted);
    group.outputs = [...(full > 0 ? [{ id: idFor(cap), amount: full }] : []), ...(rest > 0 ? [{ id: idFor(rest), amount: 1 }] : [])];
    if (sameAs(group.pieces, group.outputs)) continue;
    const pieces = group.pieces.reduce((sum, piece) => sum + piece.amount, 0);
    const emptied = pieces - group.outputs.reduce((sum, out) => sum + out.amount, 0);
    if (empty && emptied > 0) group.spare = { id: asNoted(objId(empty), group.noted), amount: emptied };
    result.push(group);
  }
  return { groups: result, fountain };
}

function combine({ player }) {
  const { groups, fountain } = jewelleryGroups(player);
  const { changed } = apply(player, groups);
  if (changed) return talk(player, DATA.matt, DATA.messages.combined, "happy");
  if (fountain) return talk(player, DATA.matt, DATA.messages.fountain, "sad3");
  talk(player, DATA.matt, DATA.messages.nothingToCombine, "sad");
}

module.exports = {
  name: "GeDecanters",
  members: true,
  DATA,
  _test: { potionGroups, jewelleryGroups, decant, combine },
  register(pluginApi) {
    api = pluginApi;
    api.onNpcInteraction(DATA.bob.name, { Decant: openDecant });
    api.onNpcInteraction(DATA.matt.name, { Decant: combine });
    api.onInterfaceActionClick(decantButton);
  },
};
