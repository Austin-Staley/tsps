const { Equipment } = require("../../../src/main/typescript/elvarg/game/model/container/impl/Equipment");
const { ItemIdentifiers } = require("../../../src/main/typescript/elvarg/util/ItemIdentifiers");

// Wiki: Rondache (The Fractured Archive). Its passive is +2 flat armour and magic resistance, and
// its Shield Slam charges come from damage the shield mitigated. The Wiki page is incomplete, so
// this is an estimate: every hit that lands loses 2 damage (a hit of 1 or 2 goes to 0), and the
// damage removed is added to the charges. Shield Slam itself (10 charges, spent from the shield
// slot with no special energy) is not built: the special bar belongs to the weapon.
const CHARGES_ATTRIBUTE = "rondache:charges";
const FLAT_ARMOUR = 2;
const RONDACHE = new Set([ItemIdentifiers.RONDACHE, ItemIdentifiers.RONDACHE_2, ItemIdentifiers.RONDACHE_3]);

function applyRondache(entity, hitDamage) {
  if (!entity?.isPlayer?.() || !(hitDamage?.getDamage?.() > 0)) return;
  const player = entity.getAsPlayer();
  const shield = player.getEquipment().getItems()[Equipment.SHIELD_SLOT]?.getId?.();
  if (!RONDACHE.has(shield)) return;
  const damage = hitDamage.getDamage();
  const mitigated = Math.min(damage, FLAT_ARMOUR);
  hitDamage.setDamage(damage - mitigated);
  player.setAttribute(CHARGES_ATTRIBUTE, (Number(player.getAttribute(CHARGES_ATTRIBUTE)) || 0) + mitigated);
}

module.exports = function registerRondacheEffects(api) {
  api.persistAttribute?.(CHARGES_ATTRIBUTE, 0);
  api.registerIncomingDamageModifier(applyRondache);
};

module.exports._test = { applyRondache, CHARGES_ATTRIBUTE };
