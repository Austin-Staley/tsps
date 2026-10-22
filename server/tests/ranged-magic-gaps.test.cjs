const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");
const core = PluginManager.getCoreApi();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { ItemDefinition } = require("../dist/game/definition/ItemDefinition");
const { NpcDefinition } = require("../dist/game/definition/NpcDefinition");
const { NpcDefinitionLoader } = require("../dist/game/definition/loader/impl/NpcDefinitionLoader");
const { NPC } = require("../dist/game/entity/impl/npc/NPC");
const { I = core.ItemIdentifiers } = {};

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  require("../plugins/items/ItemDefinitionLoader.plugin").register({ log() {}, onPlayerLogin() {}, registerContentEndpoint() {} });
});

function playerWith(weapon) {
  const items = [];
  items[core.Equipment.WEAPON_SLOT] = { getId: () => weapon, getDefinition: () => ItemDefinition.forId(weapon) };
  const player = {
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => player,
    getEquipment: () => ({ get: (slot) => items[slot], getItems: () => items }),
    getPrayerActive: () => [],
    getBonusManager: () => ({ getOtherBonus: () => [0, 0, ItemDefinition.forId(weapon).getBonuses()[12] ?? 0] }),
  };
  return player;
}

test("Kodai's real item bonus increases spell damage by 15%, ancient sceptre by 10%", () => {
  for (const [item, expected] of [[I.KODAI_WAND, 23], [I.KODAI_WAND_3, 23], [I.ANCIENT_SCEPTRE, 22], [I.ANCIENT_SCEPTRE_L_, 22]]) {
    assert.equal(core.DamageFormulas.applyMagicDamageBonus(playerWith(item), 20), expected);
  }
});

test("all four Power of Death animation and graphic ids match the cache gamevals", () => {
  const { Gamevals, GamevalKind } = require("../dist/game/cache/Gamevals");
  const animations = new Gamevals().namesOf(GamevalKind.SEQ);
  const graphics = new Gamevals().namesOf(GamevalKind.SPOTANIM);
  for (const [item, animation, graphic, animationName, graphicName] of [
    [I.STAFF_OF_THE_DEAD, 7083, 1228, "sotd_special", "sotd_special_start"],
    [I.STAFF_OF_LIGHT, 7967, 1516, "staff_of_light_special", "staff_of_light_special_start"],
    [I.STAFF_OF_BALANCE, 3652, 1733, "staff_of_balance_special", "staff_of_balance_special_start"],
    [I.TOXIC_STAFF_OF_THE_DEAD, 1720, 1228, "sotd_special_toxic_charged", "sotd_special_start"],
  ]) {
    assert.equal(animations.get(animation), animationName);
    assert.equal(graphics.get(graphic), graphicName);
    let definition;
    require(`../plugins/combat/specials/${item === I.STAFF_OF_THE_DEAD ? "StaffOfTheDead" : item === I.STAFF_OF_LIGHT ? "StaffOfLight" : item === I.STAFF_OF_BALANCE ? "StaffOfBalance" : "ToxicStaffOfTheDead"}.SpecialAttack`)({
      core: { ...core, CombatSpecial: { drain() {} } }, registerCombatSpecial: (entry) => { definition = entry; },
      registerIncomingDamageModifier() {}, onCustomEvent() {},
    });
    const player = playerWith(item);
    player.performAnimation = (value) => { player.animation = value.getId(); };
    player.performGraphic = (value) => { player.graphic = value.getId(); };
    player.setAttribute = () => {};
    player.sendMessage = () => {};
    definition.combatMethod.start(player);
    assert.equal(player.animation, animation);
    assert.equal(player.graphic, graphic);
  }
});

test("NPC ranged defences retain the Wiki light/standard/heavy split and cache rolls separately", () => {
  const stats = NpcDefinitionLoader.fromMonsterDump({ defence_ranged_light: -10, defence_ranged_standard: 30, defence_ranged_heavy: 80 });
  assert.deepEqual([stats.defenceBonuses.light, stats.defenceBonuses.ranged, stats.defenceBonuses.heavy], [-10, 30, 80]);
  const definition = new NpcDefinition();
  definition.stats = Array(18).fill(0);
  definition.stats[14] = 30;
  definition.rangedDefenceBonuses = { light: -10, heavy: 80 };
  const npc = {
    isPlayer: () => false, isNpc: () => true, getAsNpc: () => npc,
    getDefenceLevel: () => 99, getCurrentDefinition: () => definition,
    getDefenceBonus: (index, type) => NPC.prototype.getDefenceBonus.call(npc, index, type),
  };
  const rolls = ["light", "standard", "heavy"].map((type) => core.AccuracyFormulasDpsCalc.defenseRangedRoll(npc, type));
  assert.deepEqual(rolls, [108 * 54, 108 * 94, 108 * 144]);
  const chin = playerWith(I.RED_CHINCHOMPA_2);
  chin.getWeapon = () => core.WeaponInterfaces.CHINCHOMPA;
  assert.equal(core.WeaponProfiles.ranged(chin).rangedDefenceType, "heavy");
});

test("Hamstring multiplies the actual run drain and refreshes without stacking", () => {
  let modifier, special;
  require("../plugins/combat/specials/MorrigansThrowingAxeBh.SpecialAttack")({ core,
    registerCombatSpecial: (entry) => { special = entry; }, registerRunEnergyDrainModifier: (entry) => { modifier = entry; },
  });
  const attributes = new Map();
  const victim = { isPlayer: () => true, getAsPlayer: () => victim, performGraphic() {}, sendMessage() {},
    getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
  };
  const hit = { isAccurate: () => true, getTotalDamage: () => 10, getTarget: () => victim };
  assert.equal(modifier(victim, 0.5), 0.5);
  special.combatMethod.handleAfterHitEffects(hit);
  assert.equal(modifier(victim, 0.5), 3);
  special.combatMethod.handleAfterHitEffects(hit);
  assert.equal(modifier(victim, 0.5), 3);
  attributes.set("morrigans-throwing-axe:hamstring-until", Date.now() - 1);
  assert.equal(modifier(victim, 0.5), 0.5);
});

test("3rd Age bow keeps shortbow speed, 9 tile reach, 65 Ranged and +80 accuracy", () => {
  const player = playerWith(I._3RD_AGE_BOW);
  player.getWeapon = () => core.WeaponInterfaces.SHORTBOW;
  player.getFightType = () => null;
  assert.equal(core.WeaponProfiles.attackSpeed(player, 6), 4);
  assert.equal(core.WeaponProfiles.attackDistance(player, 6), 9);
  assert.equal(ItemDefinition.forId(I._3RD_AGE_BOW).getBonuses()[4], 80);
  assert.equal(ItemDefinition.forId(I._3RD_AGE_BOW).getRequirements()[4], 65);
});

test("seeking dragon arrows have their own ammunition and successful minimum, leaving specials alone", () => {
  assert.equal(core.Ammunition.getForItem(I.SEEKING_DRAGON_ARROW), core.Ammunition.SEEKING_DRAGON_ARROW);
  assert.ok(core.RangedWeapon.DARK_BOW.getAmmunitionData().includes(core.Ammunition.SEEKING_DRAGON_ARROW));
  let handler;
  require("../plugins/items/SeekingArrows.plugin").register({ core, onCombatHitDamage: (entry) => { handler = entry; } });
  const attacker = playerWith(I.DARK_BOW);
  attacker.isSpecialActivated = () => false;
  attacker.getCombat = () => ({ getAmmunition: () => core.Ammunition.SEEKING_DRAGON_ARROW });
  const damage = new core.HitDamage(1, core.HitMask.RED);
  handler({ attacker, damage, accurate: true, combatType: core.CombatType.RANGED });
  assert.equal(damage.getDamage(), 3);
  damage.setDamage(0);
  handler({ attacker, damage, accurate: false, combatType: core.CombatType.RANGED });
  assert.equal(damage.getDamage(), 0);
  attacker.isSpecialActivated = () => true;
  damage.setDamage(8);
  handler({ attacker, damage, accurate: true, combatType: core.CombatType.RANGED });
  assert.equal(damage.getDamage(), 8);
});

test("ancient sceptre buffs each ancient family once, and ordinary staves keep the existing effect", (t) => {
  let handler;
  const frozen = [], poisoned = [], heals = [];
  require("../plugins/items/AncientSceptre.plugin").register({
    core: { ...core, CombatFactory: { freeze: (_target, seconds) => frozen.push(seconds / 0.6), poisonEntity: (_target, severity) => poisoned.push(severity) }, Misc: { getRandom: () => 0 } },
    onCustomEvent: (_name, entry) => { handler = entry; },
  });
  const cast = playerWith(I.ANCIENT_SCEPTRE);
  cast.heal = (damage) => heals.push(damage);
  let attack = 100;
  const castOn = { isPlayer: () => true, getAsPlayer: () => castOn, getSkillManager: () => ({ getCurrentLevel: () => attack, getMaxLevel: () => 100, setCurrentLevelCombat: (_skill, value) => { attack = value; }, updateSkill() {} }) };
  for (const [tier, ticks] of [["RUSH", 8], ["BURST", 17], ["BLITZ", 26], ["BARRAGE", 35]]) {
    for (const family of ["ICE", "SMOKE", "BLOOD", "SHADOW"]) {
      attack = 100;
      const event = { attacker: cast, target: castOn, spell: core.CombatSpells[`${family}_${tier}`], hit: { getTotalDamage: () => 40 }, allowed: true };
      handler(event);
      assert.equal(event.allowed, false);
      if (family === "SHADOW") assert.equal(attack, tier === "RUSH" || tier === "BURST" ? 89 : 84);
    }
    assert.equal(frozen.at(-1), ticks);
  }
  assert.deepEqual(heals, [11, 11, 11, 11]);
  assert.deepEqual(poisoned, [11, 11, 22, 22]);
  const ordinary = { attacker: playerWith(I.ANCIENT_STAFF), target: castOn, spell: core.CombatSpells.ICE_BARRAGE, hit: { getTotalDamage: () => 40 }, allowed: true };
  handler(ordinary);
  assert.equal(ordinary.allowed, true);
  t.mock.method(PluginManager, "emitCustomEvent", (name, event) => { if (name === "magic:hit-effects") handler(event); });
  core.CombatSpells.ICE_BARRAGE.onHitCalc({ isAccurate: () => true, getAttacker: () => cast, getTarget: () => castOn, getTotalDamage: () => 40 });
  assert.equal(frozen.at(-1), 35, "the real spell hook applies the enhanced effect instead of the original effect");
});

test("ancient sceptre's Shadow spells drain NPC Attack once", () => {
  let handler;
  require("../plugins/items/AncientSceptre.plugin").register({ core, onCustomEvent: (_name, entry) => { handler = entry; } });
  let level = 100;
  const target = { isPlayer: () => false, getAsNpc: () => target, getMaxLevel: () => 100,
    getCurrentLevel: () => level, setCurrentLevels: (_skill, value) => { level = value; },
  };
  const event = { attacker: playerWith(I.ANCIENT_SCEPTRE), target, spell: core.CombatSpells.SHADOW_BARRAGE, hit: { getTotalDamage: () => 10 }, allowed: true };
  handler(event);
  assert.equal(level, 84);
  handler({ ...event, allowed: true });
  assert.equal(level, 84, "shadow drain does not stack");
});
