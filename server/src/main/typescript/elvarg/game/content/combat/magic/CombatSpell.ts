import { PluginManager } from "../../../../plugins/PluginManager";

import { Spell } from "./Spell";
import { Mobile } from "../../../entity/impl/Mobile";
import { NPC } from "../../../entity/impl/npc/NPC";
import { Animation } from "../../../model/Animation";
import { Graphic } from "../../../model/Graphic";
import { Sound } from "../../../Sound";
import { Projectile } from "../../../model/Projectile";
import { PendingHit } from "../hit/PendingHit";


export abstract class CombatSpell extends Spell {
  /**
   * Standard spells' cast animations and their `_staff` twins (cache gamevals, e.g.
   * human_castentangle 710 / human_castentangle_staff 1161). Each pair shares its frames, but
   * the plain one empties both hands, so a player wielding a staff casts with the twin and keeps
   * the staff drawn (LostCity's player_magic: the spell's staffanim when the weapon is a staff).
   */
  public static readonly STAFF_CAST_ANIMATIONS: ReadonlyMap<number, number> = new Map([
    [710, 1161], // human_castentangle: Bind, Snare, Entangle
    [711, 1162], // human_caststrike: strikes, bolts, blasts
    [716, 1163], // human_castconfuse
    [717, 1164], // human_castweaken
    [718, 1165], // human_castcurse: Curse, Vulnerability
    [724, 1166], // human_castcrumbleundead
    [727, 1167], // human_castwave
    [728, 1168], // human_castenfeeble
    [729, 1169], // human_caststun
    [1819, 1820], // human_casting_tele_block
  ]);

  protected usesSharedCastDelay(): boolean {
    return true;
  }

  /** The cast animation as `cast` plays it: its `_staff` twin when a player wields a staff. */
  public castAnimationFor(cast: Mobile): Animation | undefined {
    const animation = this.castAnimation();
    const staffId = animation ? CombatSpell.STAFF_CAST_ANIMATIONS.get(animation.getId()) : undefined;
    if (staffId === undefined || !cast.isPlayer() || !cast.getAsPlayer().getEquipment().hasStaffEquipped()) {
      return animation;
    }
    const staff = new Animation(staffId, animation.getDelay());
    staff.priority = animation.getPriority();
    return staff;
  }

  /**
   * Allows spells with a restricted target type to reject a cast before the
   * combat cycle consumes runes. Most combat spells may target anything that
   * the normal combat rules allow.
   */
  public canCastOnTarget(cast: Mobile, target: Mobile): boolean {
    return true;
  }

  public startCast(cast: Mobile, castOn: Mobile): void {
    let castAnimation = -1;

    const npc = cast.isNpc() ? (cast as NPC) : null;
    const castAnim = this.castAnimationFor(cast);
    if (castAnim !== null && castAnim !== undefined && castAnimation == -1) {
      cast.performAnimation(castAnim);
    } else {
      cast.performAnimation(new Animation(castAnimation));
    }

    if (npc !== null) {
      if (
        npc.getId() !== 2000 &&
        npc.getId() !== 109 &&
        npc.getId() !== 3580 &&
        npc.getId() !== 2007
      ) {
        const startGraphic = this.startGraphic();
        if (startGraphic != null) {
          cast.performGraphic(startGraphic);
        }
      }
    } else {
      const startGraphic = this.startGraphic();
      if (startGraphic != null) {
        cast.performGraphic(startGraphic);
      }
    }

    const projectile = this.castProjectile(cast, castOn);

    if (projectile) {
      projectile.sendProjectile();
    }
  }


  public getAttackSpeed(): number {
    return 5;
  }

  abstract spellId(): number;
  abstract maximumHit(): number;
  abstract castAnimation(): Animation | undefined;
  abstract startGraphic(): Graphic | undefined;
  abstract castProjectile(cast: Mobile, castOn: Mobile): Projectile | undefined;
  abstract endGraphic(): Graphic | undefined;
  abstract finishCast(cast: Mobile, castOn: Mobile, accurate: boolean, damage: number): void;
  abstract levelRequired(): number;
  abstract getSpell(): CombatSpell;

  public onHitCalc(hit: PendingHit): void {
    if (!hit.isAccurate()) {
      return;
    }
    const effect = { attacker: hit.getAttacker(), target: hit.getTarget(), spell: this, hit, allowed: true };
    PluginManager.emitCustomEvent("magic:hit-effects", effect);
    if (effect.allowed) this.spellEffectOnHitCalc(effect.attacker, effect.target, hit.getTotalDamage());
  }

  public spellEffectOnHitCalc(cast: Mobile, castOn: Mobile, damage: number): void { }

  public impactSound(): Sound {
    return null;
  }

  /** The sound played as it's cast, when the spell has its own (null: by spell id, MagicCombatMethod). */
  public castSound(): Sound | null {
    return null;
  }

  /** Ticks until the hit lands, when the spell has its own (null: the usual magic delay). */
  public hitDelay(): number | null {
    return null;
  }
}
