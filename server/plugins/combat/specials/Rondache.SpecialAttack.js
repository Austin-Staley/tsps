// Rondache's Shield Slam (https://oldschool.runescape.wiki/w/Rondache). The combat tab shows it as
// a special bar counting the shield's charges (cs2 10148/10159: varbit rondache_charges, max 20),
// so it is toggled with the special bar button like a weapon's. Wiki: needs 10 or more charges,
// uses all of them and no special attack energy; rolls against Crush defence with +6 Crush
// accuracy per charge; deals x + x% damage for x charges (24 at 20).
// Estimates: the hit is instant and unmodified by prayers or gear beyond the accuracy roll; the
// refusal message; the animation (tfa_human_rondache_special) and gfx (vfx_tfa_rondache_special)
// are the cache's names for it.
const Effects = require("../effects/Rondache.EquipmentEffects");

const MIN_CHARGES = 10;
const ACCURACY_PER_CHARGE = 6;

module.exports = function registerRondacheSpecialAttack(api) {
  const { AccuracyFormulasDpsCalc, Animation, BonusManager, CacheDefinitions, CombatMethod, CombatSpecial, CombatType, Graphic, HitDamage, HitMask, ItemIdentifiers } = api.core;

  const roll = (max) => Math.floor(Math.random() * (max + 1));

  function slam(player, target) {
    const used = Effects._test.charges(player);
    const crushBonus = player.getBonusManager().getAttackBonus()[BonusManager.ATTACK_CRUSH] + ACCURACY_PER_CHARGE * used;
    const attack = Math.floor(AccuracyFormulasDpsCalc.effectiveAttackLevel(player) * (crushBonus + 64));
    const defence = AccuracyFormulasDpsCalc.defenseMeleeRoll(target, BonusManager.ATTACK_CRUSH);
    const damage = Math.floor(used + (used * used) / 100);
    return roll(attack) > roll(defence) ? damage : 0;
  }

  class ShieldSlamCombatMethod extends CombatMethod {
    hits() {
      return null;
    }

    type() {
      return CombatType.MELEE;
    }

    start(character) {
      const player = character.getAsPlayer();
      const target = player.getCombat().getTarget();
      if (Effects._test.charges(player) < MIN_CHARGES) {
        player.sendMessage("Your rondache needs at least 10 charges to use Shield Slam.");
        return;
      }
      if (!target) {
        player.sendMessage("You need a target to use Shield Slam.");
        return;
      }
      const damage = slam(player, target);
      Effects._test.setCharges(player, 0);
      player.performAnimation(new Animation(CacheDefinitions.getSeqId("tfa_human_rondache_special")));
      player.performGraphic(new Graphic(CacheDefinitions.getSpotanimId("vfx_tfa_rondache_special")));
      target.getCombat().getHitQueue().addPendingDamage([new HitDamage(damage, damage > 0 ? HitMask.RED : HitMask.BLUE).setSource(player)]);
    }
  }

  // Shield-slot special: core's CombatSpecial.assign falls back to the worn shield's.
  api.registerCombatSpecial({
    id: "rondache",
    itemIds: [ItemIdentifiers.RONDACHE, ItemIdentifiers.RONDACHE_2, ItemIdentifiers.RONDACHE_3],
    drainAmount: 0,
    strengthMultiplier: 1,
    accuracyMultiplier: 1,
    traits: { skipAttack: true },
    combatMethod: new ShieldSlamCombatMethod(),
  });
};
