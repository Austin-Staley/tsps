/**
 * Cape of skulls (https://oldschool.runescape.wiki/w/Cape_of_skulls): putting it on skulls the
 * player for the next 20 minutes. Even while the cape is worn the skull wears off after that;
 * putting it on again, or hopping worlds with it on, skulls the player again. Facts:
 * docs/skulling.md.
 */
let core;

/** Whether each player wore the cape at their last equipment change. */
const wornCape = new WeakMap();

function wearsCape(player) {
  const { Equipment, ItemIdentifiers } = core;
  return Number(player.getEquipment().get(Equipment.CAPE_SLOT)?.getId?.()) === ItemIdentifiers.CAPE_OF_SKULLS;
}

function skull(player) {
  const { CombatFactory, SkullType } = core;
  if (player.isSkulled()) CombatFactory.extendSkull(player, CombatFactory.ITEM_SKULL_SECONDS);
  else CombatFactory.skull(player, SkullType.WHITE_SKULL, CombatFactory.ITEM_SKULL_SECONDS);
}

/** The cape just put on skulls its wearer. */
function skullOnWear({ player }) {
  const worn = wearsCape(player);
  const previous = wornCape.get(player);
  wornCape.set(player, worn);
  if (previous === false && worn) skull(player);
}

/** Logging in (or hopping) with the cape on skulls the player again. */
function skullOnLogin({ player }) {
  const worn = wearsCape(player);
  wornCape.set(player, worn);
  if (worn) skull(player);
}

module.exports = {
  name: "CapeOfSkulls",
  members: true,
  _test: { skullOnWear, skullOnLogin },
  register(api) {
    core = api.core;
    api.onCustomEvent("equipment:changed", skullOnWear);
    api.onPlayerLogin(skullOnLogin);
  },
};
