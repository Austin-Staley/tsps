module.exports = function registerMagicShortbowSpecialAttack(api) {
  const { Animation, CombatFactory, CombatSpecial, CombatType, Equipment, Graphic, GraphicHeight, ItemIdentifiers, Projectile, RangedCombatMethod, RangedWeapon, Skill, Sound, Sounds } = api.core;

  const SPECIAL_ID = "magic_shortbow";
  const DRAIN = 55;
  const IMBUED_DRAIN = 50;
  const RANGED_STRENGTH_BONUS_INDEX = 11;
  const ACCURACY_MULTIPLIER = 10 / 7;
  const ANIMATION = new Animation(1074);
  const GRAPHIC = new Graphic(250, GraphicHeight.HIGH);

  class MagicShortbowCombatMethod extends RangedCombatMethod {
    canAttack(character, target) {
      const player = character.getAsPlayer();
      if (player.getCombat().getRangedWeapon() != RangedWeapon.MAGIC_SHORTBOW) {
        return false;
      }
      if (!CombatFactory.checkAmmo(player, 2)) {
        return false;
      }
      return true;
    }

    start(character, target) {
      const player = character.getAsPlayer();
      CombatSpecial.drain(player, player.getCombatSpecial().getDrainAmountForWeaponId(player.getEquipment().get(Equipment.WEAPON_SLOT).getId()));
      player.performAnimation(ANIMATION);
      player.performGraphic(GRAPHIC);
      Sounds.sendSound(player, Sound.MAGIC_SHORTBOW_SPECIAL);
      Projectile.createProjectile(player, target, 249, 40, 57, 43, 31).sendProjectile();
      Projectile.createProjectile(character, target, 249, 33, 57, 48, 31).sendProjectile();
      CombatFactory.decrementAmmo(player, target.getLocation(), 2);
    }

    attackSpeed(character) {
      return super.attackSpeed(character) + 1;
    }
  }

  // Wiki (Magic shortbow): Snapshot's max hit ignores gear, prayers and Void - only the visible
  // Ranged level and the arrow's Ranged Strength count.
  function snapshotMaxHit(player) {
    const level = player.getSkillManager().getCurrentLevel(Skill.RANGED);
    const ammo = player.getEquipment().get(Equipment.AMMUNITION_SLOT);
    const strength = ammo?.getDefinition?.()?.getBonuses?.()?.[RANGED_STRENGTH_BONUS_INDEX] ?? 0;
    return Math.max(0, Math.floor(0.5 + ((level + 10) * (strength + 64)) / 640));
  }

  function rollSnapshot({ attacker, target, damage, accurate }) {
    if (!accurate || !attacker.isPlayer() || !attacker.isSpecialActivated() || attacker.getCombatSpecial()?.getId() !== SPECIAL_ID) {
      return;
    }
    const bounds = { minimumMultiplier: 0, maximumMultiplier: 0, minimumBonus: 0, maximumBonus: snapshotMaxHit(attacker) };
    damage.setDamage(CombatFactory.getHitDamage(attacker, target, CombatType.RANGED, false, bounds).getDamage());
  }

  api.onCombatHitDamage(rollSnapshot);

  api.registerCombatSpecial({
    id: SPECIAL_ID,
    itemIds: [
      ItemIdentifiers.MAGIC_SHORTBOW,
      ItemIdentifiers.MAGIC_SHORTBOW_I_,
      ItemIdentifiers.MAGIC_SHORTBOW_3,
    ],
    drainAmount: DRAIN,
    drainAmountByItemId: { [ItemIdentifiers.MAGIC_SHORTBOW_I_]: IMBUED_DRAIN },
    strengthMultiplier: 1,
    accuracyMultiplier: ACCURACY_MULTIPLIER,
    traits: {
      hitCount: 2,
      accuracyMultiplier: ACCURACY_MULTIPLIER,
      damageMultiplier: 1,
    },
    combatMethod: new MagicShortbowCombatMethod(),
    metadata: { finisherDamageMultiplier: 2 },
  });
};
