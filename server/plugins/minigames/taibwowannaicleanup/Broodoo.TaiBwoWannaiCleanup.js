/**
 * Tai Bwo Wannai Cleanup: the Broodoo victims a hack can disturb (combat white, poison green,
 * disease yellow).
 *
 * rsprox 227/01858 and 237/01102: they cast entangle every 6 ticks (human_castentangle, spotanim
 * 177 on the caster, entangle_travel to the player, sounds 2247, 151 and 227); the poison victim's
 * hits also bring "You feel incredibly weakened." and drain Attack, Strength, Defence, Ranged and
 * Magic by 1-3. The Wiki: max hit 7; a player's own hits do at most 3, but the right thing used on
 * one hurts it: any food on the white one (10-35, Cooking XP twice the damage), one dose of an
 * antipoison on the green one (antipoison 20, superantipoison and sanfew 30, antidote+ 40,
 * antidote++ and anti-venom 50; Herblore XP twice the damage after Druidic Ritual), Relicym's balm
 * or a sanfew serum on the yellow one; anything else "Nothing interesting happens.". The balm's
 * and sanfew's damage on the yellow one is not given anywhere; it is 30 here, as the sanfew's on
 * the green one. The disease victim's own effect is not recorded and is not modelled.
 */
const Common = require("./Common.TaiBwoWannaiCleanup");

const broodoo = () => Common.data.events.broodoo;
const npcId = (name) => Common.core.CacheDefinitions.getNpcId(name) ?? -1;
const ids = () => broodoo().npcs.map(npcId);
const nameOfId = (id) => broodoo().npcs.find((name) => npcId(name) === id) ?? null;
const between = ([low, high]) => low + Math.floor(Math.random() * (high - low + 1));

function combatClass() {
  const { Animation, CombatMethod, CombatType, Graphic, PendingHit, Projectile } = Common.core;
  return class BroodooVictimCombat extends CombatMethod {
    start(character, target) {
      const npc = character?.getAsNpc?.();
      if (!npc || !target) return;
      const { cast } = broodoo();
      npc.performAnimation(new Animation(Common.seqId(cast.seq)));
      npc.performGraphic?.(new Graphic(cast.spotanim));
      const projectile = Common.core.CacheDefinitions.getSpotanimId(cast.projectile);
      new Projectile(Projectile.centreOf(npc), target.getLocation(), target, projectile, cast.start, cast.end,
        cast.startHeight, cast.endHeight, npc.getPrivateArea()).withSource(npc).withAngle(cast.angle).withProgress(cast.progress).sendProjectile();
      if (target.isPlayer?.()) for (const [sound, delay] of cast.sounds) Common.sound(target.getAsPlayer(), sound, delay);
      this.weakens = npc.getId() === npcId(broodoo().weaken.npc);
    }

    hits(character, target) {
      if (!character || !target) return [];
      const hit = new PendingHit(character, target, this, { delay: Math.max(1, Math.ceil(broodoo().cast.end / 30)) });
      hit.setTotalDamage(Math.min(broodoo().maxHit, hit.getTotalDamage()));
      if (this.weakens && target.isPlayer?.() && hit.getTotalDamage() > 0) {
        const player = target.getAsPlayer();
        Common.later(player, Math.max(1, Math.ceil(broodoo().cast.end / 30)), () => weaken(player));
      }
      return [hit];
    }

    attackDistance() {
      return broodoo().distance;
    }

    attackSpeed() {
      return broodoo().speed;
    }

    type() {
      return CombatType.MAGIC;
    }
  };
}

function weaken(player) {
  const { weaken: drain } = broodoo();
  const skills = player.getSkillManager();
  for (const name of drain.skills) {
    const skill = Common.core.Skill[name];
    skills.setCurrentLevel(skill, Math.max(0, skills.getCurrentLevel(skill) - between(drain.drain)));
  }
  player.sendMessage(drain.message);
  Common.sound(player, drain.sound);
}

/** A player's own hits on a victim do at most 3 (Wiki). */
function capHit({ npc, hit }) {
  if (!ids().includes(npc?.getId?.())) return;
  if (!hit?.getAttacker?.()?.isPlayer?.()) return;
  if (hit.getTotalDamage() > broodoo().playerMaxHit) hit.setTotalDamage(broodoo().playerMaxHit);
}

const isFood = (id) => (Common.core.CacheDefinitions.getItem(id)?.inventoryActions ?? []).includes("Eat");
const potionOf = (id) => /^(.*)\((\d)\)$/.exec(Common.core.CacheDefinitions.getItem(id)?.name ?? "");

function questComplete(player, key) {
  const request = { player, key };
  Common.api.emitCustomEvent("quest:is-complete", request);
  return request.complete === true;
}

/** One dose used: the next lower dose, or the empty vial after the last. */
function useDose(player, id, base, doses) {
  const inventory = player.getInventory();
  inventory.delete(id, 1);
  const next = doses > 1 ? findItemByName(`${base}(${doses - 1})`) : Common.objId("vial_empty");
  if (next >= 0) inventory.add(new Common.core.Item(next, 1));
}

const itemsByName = new Map();
function findItemByName(name) {
  if (itemsByName.has(name)) return itemsByName.get(name);
  const { CacheDefinitions } = Common.core;
  let found = -1;
  for (const id of CacheDefinitions.getObjNames().keys()) {
    const item = CacheDefinitions.getItem(id);
    if (item?.name === name && !(item.noteTemplate >= 0) && !(item.placeholderTemplate >= 0)) {
      found = id;
      break;
    }
  }
  itemsByName.set(name, found);
  return found;
}

/** The right thing on the right victim hurts it; anything else does nothing. */
function feed(event) {
  const { player, target: npc, itemId } = event;
  const name = nameOfId(npc?.getId?.());
  if (!name) return false;
  event.handled = true;
  const rule = broodoo().feed[name];
  let damage = 0;
  if (rule.kind === "food" && isFood(itemId)) {
    damage = between(rule.damage);
    player.getInventory().delete(itemId, 1);
  } else if (rule.kind === "potion") {
    const dose = potionOf(itemId);
    const base = dose?.[1];
    if (base && rule.potions[base] !== undefined) {
      damage = rule.potions[base];
      useDose(player, itemId, base, Number(dose[2]));
    }
  }
  if (damage <= 0) {
    player.sendMessage(broodoo().nothing);
    return true;
  }
  const { HitDamage, HitMask } = Common.core;
  npc.addTickHit?.(npc.decrementHealth(new HitDamage(Math.min(damage, npc.getHitpoints()), HitMask.RED)));
  if (rule.kind === "food" || !rule.quest || questComplete(player, rule.quest)) Common.xp(player, rule.skill, damage * 2);
  if (!npc.getCombat().getTarget?.()) npc.getCombat().attack(player);
  return true;
}

function attachBroodoo(api) {
  api.registerNpcCombatMethodProvider(ids(), combatClass(), { singleton: false });
  api.onNpcHitModify(capHit);
  api.onItemOnNpc(feed);
}

module.exports = { attachBroodoo, feed, capHit, weaken, findItemByName };
