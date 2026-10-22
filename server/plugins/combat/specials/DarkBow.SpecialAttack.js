module.exports = function registerDarkBowSpecialAttack(api) {
  const { Ammunition, Animation, CombatFactory, CombatSpecial, CombatType, DamageFormulas, Graphic, GraphicHeight, ItemIdentifiers, PendingHit, PluginManager, Projectile, RangedCombatMethod, RangedWeapon, Sound, Sounds, WeaponProfiles } = api.core;

  const SPECIAL_ID = "dark_bow";
  const DRAIN = 55;
  const HIT_COUNT = 2;
  // Wiki (Dark bow): each arrow deals at least `minimum`, even when its accuracy roll fails.
  const DESCENT_OF_DARKNESS = { multiplier: 1.3, minimum: 5, cap: Infinity };
  const DESCENT_OF_DRAGONS = { multiplier: 1.5, minimum: 8, cap: 48 };
  const ANIMATION = new Animation(426);
  const GRAPHIC = new Graphic(1100, GraphicHeight.HIGH);

  class DarkBowCombatMethod extends RangedCombatMethod {
    hits(character, target) {
      const distance = character.getLocation().getDistance(target.getLocation());
      const delays = WeaponProfiles.hitDelays(character.getAsPlayer(), distance);
      // The dark bow profile already declares two hit delays; one PendingHit with
      // the special's hit count keeps this at two hitsplats instead of four.
      return [new PendingHit(character, target, this, { delay: delays[0], hitAmount: HIT_COUNT })];
    }

    canAttack(character, target) {
      let player = character.getAsPlayer();
      if (player.getCombat().getRangedWeapon() != RangedWeapon.DARK_BOW) {
        return false;
      }
      if (!CombatFactory.checkAmmo(player, HIT_COUNT)) {
        return false;
      }
      return true;
    }

    start(character, target) {
      let player = character.getAsPlayer();
      CombatSpecial.drain(player, DRAIN);
      player.performAnimation(ANIMATION);
      Sounds.sendSound(character, Sound.SHOOT_BOW_QUIET);
      let projectileId = 1099;
      if (player.getCombat().getAmmunition() != Ammunition.DRAGON_ARROW) {
        projectileId = 1101;
      }
      Projectile.createProjectile(player, target, projectileId, 40, 70, 43, 31).sendProjectile();
      Projectile.createProjectile(character, target, projectileId, 33, 74, 48, 31).sendProjectile();
      CombatFactory.decrementAmmo(player, target.getLocation(), HIT_COUNT);
    }

    attackSpeed(character) {
      return super.attackSpeed(character) + 1;
    }

    handleAfterHitEffects(hit) {
      hit.getTarget().performGraphic(GRAPHIC);
    }
  }

  function descentOf(player) {
    return player.getCombat().getAmmunition() === Ammunition.DRAGON_ARROW ? DESCENT_OF_DRAGONS : DESCENT_OF_DARKNESS;
  }

  // Rolls each arrow here, where its ammunition is known: a hit lands between the minimum and
  // the boosted max hit, a missed arrow still deals the minimum.
  function rollDescent({ attacker, target, damage, accurate }) {
    if (!attacker.isPlayer() || !attacker.isSpecialActivated() || attacker.getCombatSpecial()?.getId() !== SPECIAL_ID) {
      return;
    }
    const { multiplier, minimum, cap } = descentOf(attacker);
    const boosted = Math.floor(PluginManager.modifyRangedMaxHit(attacker, target, DamageFormulas.sourceMaxHit(attacker, CombatType.RANGED)) * multiplier);
    const maximum = accurate ? Math.max(minimum, Math.min(cap, boosted)) : minimum;
    const bounds = { minimumMultiplier: 0, maximumMultiplier: 0, minimumBonus: minimum, maximumBonus: maximum };
    damage.setDamage(CombatFactory.getHitDamage(attacker, target, CombatType.RANGED, false, bounds).getDamage());
  }

  api.onCombatHitDamage(rollDescent);

  api.registerCombatSpecial({
    id: SPECIAL_ID,
    itemIds: [
      ItemIdentifiers.DARK_BOW,
      ItemIdentifiers.DARK_BOW_3,
      ItemIdentifiers.DARK_BOW_4,
      ItemIdentifiers.DARK_BOW_5,
      ItemIdentifiers.DARK_BOW_6,
    ],
    drainAmount: DRAIN,
    strengthMultiplier: DESCENT_OF_DARKNESS.multiplier,
    accuracyMultiplier: 1,
    traits: {
      hitCount: HIT_COUNT,
      accuracyMultiplier: 1,
      rollAttackType: "ranged",
      damageType: "ranged",
    },
    combatMethod: new DarkBowCombatMethod(),
    metadata: { finisherDamageMultiplier: 2 },
  });
};
