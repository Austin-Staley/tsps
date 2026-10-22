/**
 * Rune thrownaxe - Chainhit (Wiki: Rune thrownaxe). 10% energy per hit. In multicombat the axe
 * ricochets to up to five other opponents within three tiles of the first target, never back to it;
 * an accuracy roll follows each hit and a miss ends the chain. Its max hit ignores offensive
 * prayers and gear: floor(0.5 + (visible Ranged + 10) * (axe Ranged strength + 64) / 640).
 * It swings one tick slower than the axe's normal attack.
 */
function buildRuneThrownaxeSpecialAttack(api) {
  const { Animation, CombatFactory, CombatSpecial, Equipment, Graphic, GraphicHeight, ItemIdentifiers, PendingHit, Projectile, RangedCombatMethod, Skill, WeaponProfiles } = api.core;
  const BonusManager = api.core.BonusManager;

  const DRAIN = 10;
  const MAX_BOUNCES = 5;
  const BOUNCE_RADIUS = 3;
  const SPECIAL_ANIMATION = new Animation(1068);
  const SPECIAL_VFX = new Graphic(257, 0, GraphicHeight.HIGH);
  const IMPACT_GRAPHIC = new Graphic(258);
  const RANGED_STRENGTH_BONUS = 10 + BonusManager.RANGED_STRENGTH;
  const STANCE_BONUS = 10;
  const CLIENT_CYCLES_PER_TICK = 30;
  const BOUNCE_START_HEIGHT = 43;
  const BOUNCE_END_HEIGHT = 31;

  function chainhitMaxHit(player) {
    const axe = player.getEquipment().get(Equipment.WEAPON_SLOT);
    const strength = Number(axe?.getDefinition?.()?.getBonuses?.()?.[RANGED_STRENGTH_BONUS] ?? 0);
    const ranged = player.getSkillManager().getCurrentLevel(Skill.RANGED);
    return Math.floor(0.5 + ((ranged + STANCE_BONUS) * (strength + 64)) / 640);
  }

  function nearbyMobiles(player) {
    return [...player.getLocalNpcs().values(), ...player.getLocalPlayers().values()];
  }

  /** The nearest untouched opponent within the radius of the first target, or null. */
  function nextTarget(player, primary, origin, struck) {
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of nearbyMobiles(player)) {
      if (struck.has(candidate) || !CombatFactory.canAttackSecondaryTarget(player, primary, candidate, BOUNCE_RADIUS)) {
        continue;
      }
      const distance = origin.getLocation().getDistance(candidate.getLocation());
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }

  class RuneThrownaxeCombatMethod extends RangedCombatMethod {
    attackSpeed(character) {
      return super.attackSpeed(character) + 1;
    }

    start(character, target) {
      CombatSpecial.drain(character, DRAIN);
      super.start(character, target);
      character.performAnimation(SPECIAL_ANIMATION);
      character.performGraphic(SPECIAL_VFX);
    }

    hits(character, target) {
      const hits = super.hits(character, target);
      const player = character.getAsPlayer();
      const maxHit = chainhitMaxHit(player);
      const first = hits[0];
      CombatFactory.applyStyleDamage(first, maxHit);
      if (!CombatFactory.multiCombatBetween(player, target)) {
        return hits;
      }
      const struck = new Set([target]);
      const projectileId = player.getCombat().getAmmunition()?.getProjectileId?.();
      let origin = target;
      let previous = first;
      let elapsedCycles = first.getDelay() * CLIENT_CYCLES_PER_TICK;
      for (let bounce = 1; bounce <= MAX_BOUNCES && previous.isAccurate() && player.getSpecialPercentage() >= DRAIN; bounce++) {
        const next = nextTarget(player, target, origin, struck);
        if (!next) {
          break;
        }
        CombatSpecial.drain(player, DRAIN);
        const distance = origin.getLocation().getDistance(next.getLocation());
        const flight = RangedCombatMethod.projectileEnd(WeaponProfiles.ranged(player).projectiles[0], distance);
        const start = elapsedCycles;
        elapsedCycles += flight;
        if (projectileId != null) {
          Projectile.createProjectile(origin, next, projectileId, start, elapsedCycles, BOUNCE_START_HEIGHT, BOUNCE_END_HEIGHT).sendProjectile();
        }
        previous = new PendingHit(player, next, this, Math.ceil(elapsedCycles / CLIENT_CYCLES_PER_TICK));
        CombatFactory.applyStyleDamage(previous, maxHit);
        hits.push(previous);
        struck.add(next);
        origin = next;
      }
      return hits;
    }

    handleAfterHitEffects(hit) {
      if (hit.isAccurate()) {
        hit.getTarget().performGraphic(IMPACT_GRAPHIC);
      }
    }
  }

  return {
    id: "rune_thrownaxe",
    itemIds: [ItemIdentifiers.RUNE_THROWNAXE, ItemIdentifiers.RUNE_THROWNAXE_2],
    drainAmount: DRAIN,
    strengthMultiplier: 1,
    accuracyMultiplier: 1,
    traits: { hitCount: 1 },
    combatMethod: new RuneThrownaxeCombatMethod(),
  };
}

module.exports = function registerRuneThrownaxeSpecialAttack(api) {
  api.registerCombatSpecial(buildRuneThrownaxeSpecialAttack(api));
};
