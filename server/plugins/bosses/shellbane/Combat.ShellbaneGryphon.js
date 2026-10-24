/**
 * The Shellbane gryphon's attacks (Wiki: Shellbane_gryphon, /Strategies):
 * - melee up to 22, or now and then a ranged one up to 22 (even beside the player), every 5
 *   ticks; every few attacks a special instead (Fight.ShellbaneGryphon.js);
 * - without a tortugan shield worn, its melee is devastating: Protect from Melee doesn't stop it
 *   ("You need some sort of protection!"); with one, the prayer works as usual.
 */
const Common = require("./Common.ShellbaneGryphon");

function hitDelay(distance) {
  return 1 + Math.floor((3 + distance) / 6);
}

function methods() {
  const { CombatMethod, CombatType, PendingHit, Animation, Projectile } = Common.core;
  const { combat } = Common.data;

  class GryphonCombat extends CombatMethod {
    start(character, target) {
      this.plan = null;
      const npc = character?.getAsNpc?.();
      const fight = npc?.__sgCave?.fight;
      const player = target?.isPlayer?.() ? target.getAsPlayer() : null;
      if (!fight || fight.stopped || !player) return;
      fight.attacks += 1;
      const { ids } = Common;
      if (fight.attacks % combat.specialEvery === 0) {
        fight.special(player);
        return;
      }
      const distance = Common.distanceToNpc(player.getLocation(), npc);
      const ranged = distance > 1 || fight.random() < combat.rangedChance;
      if (ranged) {
        this.style = "ranged";
        npc.performAnimation(new Animation(ids.seqs.ranged));
        const delay = hitDelay(distance);
        new Projectile(Projectile.centreOf(npc), player.getLocation(), player, ids.spotanims.rangedProjectile, 30, delay * 30, 60, 31, npc.getPrivateArea?.() ?? null).sendProjectile();
        this.plan = { delay, typeless: false };
        return;
      }
      this.style = "melee";
      npc.performAnimation(new Animation(ids.seqs.melee));
      // No shield: the prayer doesn't help (Wiki); the hit is dealt as typeless damage.
      const shielded = Common.wearingShield(player);
      if (!shielded && !fight.warnedNoShield) {
        fight.warnedNoShield = true;
        player.sendMessage(Common.message("devastating"));
      }
      this.plan = { delay: 0, typeless: !shielded };
    }

    hits(character, target) {
      if (!this.plan) return [];
      if (this.plan.typeless) {
        const player = target.getAsPlayer();
        Common.hurtPlayer(player, Common.randomInt(0, combat.maxHit));
        return [];
      }
      const hit = new PendingHit(character, target, this, this.plan.delay);
      hit.setTotalDamage(Math.min(combat.maxHit, hit.getTotalDamage()));
      return [hit];
    }

    attackDistance() {
      return 8;
    }

    attackSpeed() {
      return combat.attackSpeed;
    }

    type() {
      return this.style === "ranged" ? CombatType.RANGED : CombatType.MELEE;
    }
  }

  return { GryphonCombat };
}

function attach(api) {
  const { GryphonCombat } = methods();
  api.registerNpcCombatMethodProvider([Common.ids.npcs.boss], GryphonCombat, { singleton: false });
}

module.exports = { attach, methods, hitDelay };
