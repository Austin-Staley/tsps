/**
 * Burying bones, from plugins/skills/data/bones.json, and scattering demonic ashes, from
 * plugins/skills/data/ashes.json (docs/prayer-bones.md).
 *
 * Other plugins bury through custom events:
 *   api.emitCustomEvent("prayer:bury", { player, itemId, scale, crushed })
 *     -> sets `handled` when `itemId` is a bone: its experience (times `scale`, default 1) and
 *        its Prayer restore are given. `crushed` (the bonecrusher) leaves out bones it can't crush.
 *   api.emitCustomEvent("prayer:bone", { itemId, bone: null })
 *     -> sets `bone` to the bone's row ({ xp, level, ... }) when `itemId` is a bone, for content
 *        that gives its own experience (altars).
 *   api.onCustomEvent("prayer:bone-restore", (event) => { event.restore = event.points; })
 *     -> asked after every burial; `points` is the bone's restore, and Prayer gives back
 *        `restore` once, so two sources (the Catacombs, a dragonbone necklace) never stack.
 */
const DATA = require("./data/bones.json");
const ASHES = require("./data/ashes.json");

const BURY_DELAY_MS = 1200; // Two OSRS game ticks; scattering ashes waits the same (the Wiki gives no separate figure).
const BURY_ANIMATION = 827; // human_pickupfloor
const SCATTER_ANIMATION = 827; // human_pickupfloor, until the scatter animation is identified in the cache (no seq is named for it).

let api = null;
let bones = null;
let ashes = null;

/** Rows keyed by item id, resolved from their obj gamevals on first use. */
function rowsByItemId(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = api.core.CacheDefinitions.getObjId(row.obj);
    if (!Number.isInteger(id)) throw new Error(`[Prayer] unknown obj gameval ${row.obj}`);
    map.set(id, row);
  }
  return map;
}

/** The bone rows by item id. */
function boneFor(itemId) {
  if (!bones) bones = rowsByItemId(DATA.bones);
  return bones.get(itemId) ?? null;
}

/** The demonic ash rows by item id. */
function ashFor(itemId) {
  if (!ashes) ashes = rowsByItemId(ASHES.ashes);
  return ashes.get(itemId) ?? null;
}

/** Experience is whole in tsps; a bone's tenths round up, as the old table did (bones 4.5 -> 5). */
const experience = (xp, scale) => Math.ceil(xp * scale);

function restorePrayer(player, itemId, bone) {
  if (!bone.restore) return;
  const event = { player, itemId, points: bone.restore, restore: 0 };
  api.emitCustomEvent("prayer:bone-restore", event);
  if (event.restore <= 0) return;
  const { Skill } = api.core;
  const skills = player.getSkillManager();
  const max = skills.getMaxLevel(Skill.PRAYER);
  if (skills.getCurrentLevel(Skill.PRAYER) >= max) return;
  skills.increaseCurrentLevel(Skill.PRAYER, event.restore, max);
}

function award(player, itemId, bone, scale) {
  player.getSkillManager().addExperiences(api.core.Skill.PRAYER, experience(bone.xp, scale));
  restorePrayer(player, itemId, bone);
}

/** "prayer:bury": a bone buried without the spade (the bonecrusher). */
function buryRequest(request) {
  const bone = boneFor(request?.itemId);
  if (!bone || !request.player) return;
  if (request.crushed && bone.crush === false) return;
  award(request.player, request.itemId, bone, request.scale ?? 1);
  request.handled = true;
}

/** "prayer:bone": the bone's row for `itemId`. */
function boneRequest(request) {
  if (request) request.bone = boneFor(request.itemId);
}

/**
 * The two-tick rite shared by burying and scattering. The item is consumed and `complete` runs
 * together on the resolving tick, so an interrupted rite keeps its item, including on logout
 * before the account is saved.
 */
function consumeAfterTwoTicks(player, slot, itemId, { animation, sound }, complete) {
  const core = api.core;
  const inventory = player.getInventory();
  player.getSkillManager().stopSkillable();
  player.getPacketSender().sendInterfaceRemoval();
  player.performAnimation(new core.Animation(animation));
  if (sound) core.Sounds.sendSound(player, sound);
  const location = player.getLocation().clone();
  const task = new core.CountdownTask(player, 2, () => {
    if (!canComplete() || inventory.get(slot)?.getId() !== itemId) return;
    inventory.deleteAtSlot(slot, 1);
    complete();
  });
  function canComplete() {
    return player.isRegistered() && player.getHitpoints() > 0 &&
      player.getLocation().equals(location) && player.getMovementQueue().size() === 0 &&
      player.getForceMovement() == null;
  }
  task.onTick = () => { if (!canComplete()) task.stop(); };
  const stop = task.stop.bind(task);
  task.stop = () => {
    stop();
    if (player.isRegistered()) player.performAnimation(core.Animation.DEFAULT_RESET_ANIMATION);
  };
  api.getTaskManager().submit(task);
  player.getClickDelay().reset();
}

function buryBone({ player, itemId, slot }) {
  const core = api.core;
  const bone = boneFor(itemId);
  if (!bone) return false;
  if (!player.getClickDelay().elapsedTime(BURY_DELAY_MS)) return true;
  if (player.getInventory().get(slot)?.getId() !== itemId) return true;
  if (bone.level && player.getSkillManager().getMaxLevel(core.Skill.PRAYER) < bone.level) {
    player.sendMessage(`You need a Prayer level of ${bone.level} to bury these bones.`);
    return true;
  }
  consumeAfterTwoTicks(player, slot, itemId, { animation: BURY_ANIMATION, sound: core.Sound.BURY_BONES }, () => {
    player.sendMessage("You dig a hole in the ground..");
    player.sendMessage(`..and bury the ${core.ItemDefinition.forId(itemId).getName()}.`);
    award(player, itemId, bone, 1);
  });
  return true;
}

/** "Scatter" on demonic ashes: Prayer experience, no restore (Wiki, Remains). */
function scatterAshes({ player, itemId, slot }) {
  const ash = ashFor(itemId);
  if (!ash) return false;
  if (!player.getClickDelay().elapsedTime(BURY_DELAY_MS)) return true;
  if (player.getInventory().get(slot)?.getId() !== itemId) return true;
  consumeAfterTwoTicks(player, slot, itemId, { animation: SCATTER_ANIMATION }, () => {
    player.sendMessage("You scatter the ashes.");
    player.getSkillManager().addExperiences(api.core.Skill.PRAYER, experience(ash.xp, 1));
  });
  return true;
}

module.exports = {
  name: "Prayer",
  register(pluginApi) {
    api = pluginApi;
    api.onItemFirstAction(buryBone);
    api.onItemFirstAction(scatterAshes);
    api.onCustomEvent("prayer:bury", buryRequest);
    api.onCustomEvent("prayer:bone", boneRequest);
  },
};
