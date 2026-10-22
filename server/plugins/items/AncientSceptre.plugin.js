/** Wiki: Ancient sceptre strengthens Ancient Magicks effects by 10%; its +10% damage is item data. */
let core;
const SCEPTRES = ["ANCIENT_SCEPTRE", "ANCIENT_SCEPTRE_L_"];
const ICE_TICKS = [8, 17, 26, 35];
const TIERS = ["RUSH", "BURST", "BLITZ", "BARRAGE"];

function enhanceAncientEffect(event) {
  const { attacker: cast, target: castOn, spell, hit } = event;
  const damage = hit.getTotalDamage();
  if (!event.allowed) return;
  if (!cast?.isPlayer?.()) return;
  const weaponId = cast.getEquipment().get(core.Equipment.WEAPON_SLOT).getId();
  if (!SCEPTRES.some((name) => core.ItemIdentifiers[name] === weaponId)) return;
  for (const family of ["SMOKE", "SHADOW", "BLOOD", "ICE"]) {
    const tier = TIERS.findIndex((name) => core.CombatSpells[`${family}_${name}`] === spell);
    if (tier < 0) continue;
    event.allowed = false;
    if (family === "ICE") core.CombatFactory.freeze(castOn, ICE_TICKS[tier] * 0.6);
    if (family === "BLOOD") cast.heal(Math.floor(damage * 0.275));
    if (family === "SMOKE" && core.Misc.getRandom(7) === 0) core.CombatFactory.poisonEntity(castOn, tier < 2 ? 11 : 22);
    if (family === "SHADOW") {
      const skills = castOn.isPlayer() ? castOn.getAsPlayer().getSkillManager() : castOn.getAsNpc();
      const level = skills.getCurrentLevel(core.Skill.ATTACK);
      const base = skills.getMaxLevel(core.Skill.ATTACK);
      if (level >= base) {
        const next = level - Math.floor(level * (tier < 2 ? 0.11 : 0.165));
        if (castOn.isPlayer()) {
          skills.setCurrentLevelCombat(core.Skill.ATTACK, next);
          skills.updateSkill(core.Skill.ATTACK);
        } else {
          skills.setCurrentLevels(core.Skill.ATTACK, next);
        }
      }
    }
    return;
  }
}

module.exports = {
  name: "AncientSceptre",
  members: true,
  register(api) {
    core = api.core;
    api.onCustomEvent("magic:hit-effects", enhanceAncientEffect);
  },
};
