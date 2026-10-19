"use strict";

/**
 * Kraken attack script (see ../Kraken.plugin.js for behaviour and sources).
 *
 * Wiki (Kraken, Cave kraken, Enormous Tentacle): all three attack with Magic — the boss
 * and its tentacles typeless (prayer bypass lives in Typeless.Kraken.js), cave krakens
 * regular. The Kraken's projectile resembles Fire Wave; projectiles 156 (boss) and 162
 * (cave/tentacle) with impacts 157/163 are real spotanims in this cache (rev 241,
 * `yarn dump:spotanim`), matching that look. Surfacing and attack animations come from
 * the engine's own animation resolution (npc-animations.json + captures).
 * Speeds and max hits stay the dump's (monsters-complete.json: cave 6 ticks/max 13,
 * boss 4/max 28, tentacle 4/max 2 — the Wiki agrees on the tentacle's max 2).
 */

const Shared = require("./Shared.Kraken");

/** Surfaced NPC id -> projectile and impact graphic. */
const SHOTS = {
  492: { projectile: 162, impact: 163 },
  494: { projectile: 156, impact: 157 },
  5535: { projectile: 162, impact: 163 },
};
/** NPC magic lands a fixed 3 ticks after the cast, as the engine's own NPC cast does. */
const HIT_DELAY_TICKS = 3;

function shotsFor(npcId) {
  return SHOTS[npcId] ?? SHOTS[494];
}

let KrakenMethod = null;

function methodClass() {
  if (KrakenMethod) return KrakenMethod;
  const { Animation, CombatMethod, CombatType, Graphic, GraphicHeight, MagicCombatMethod, PendingHit, Projectile } = Shared.core();
  KrakenMethod = class extends CombatMethod {
    type() {
      return CombatType.MAGIC;
    }

    attackDistance() {
      return 10;
    }

    attackSpeed(character) {
      return character.getCurrentDefinition?.()?.getAttackSpeed?.() ?? 4;
    }

    start(character, target) {
      const animation = character.getAttackAnim();
      if (animation !== -1) character.performAnimation(new Animation(animation));
      const { projectile } = shotsFor(character.getId());
      Projectile.createProjectile(character, target, projectile, 0, 20, 43, 31).sendProjectile();
    }

    hits(character, target) {
      return [new PendingHit(character, target, this, HIT_DELAY_TICKS)];
    }

    handleAfterHitEffects(hit) {
      const target = hit.getTarget?.();
      if (!target) return;
      if (hit.isAccurate()) {
        target.performGraphic(new Graphic(shotsFor(hit.getAttacker?.()?.getId?.()).impact, GraphicHeight.HIGH));
      } else {
        target.performGraphic(MagicCombatMethod.SPLASH_GRAPHIC);
      }
    }
  };
  return KrakenMethod;
}

function attach(api) {
  api.registerNpcCombatMethodProvider(
    [Shared.ids().CAVE_KRAKEN, Shared.ids().BOSS, Shared.ids().TENTACLE],
    methodClass(),
  );
}

module.exports = { attach, methodClass, shotsFor, HIT_DELAY_TICKS };
