// Run after yarn build: node --test tests/granite-hammer.test.cjs
// Wiki: https://oldschool.runescape.wiki/w/Granite_hammer#Special_attack
const assert = require("node:assert/strict");
const { before, test } = require("node:test");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");
const core = PluginManager.getCoreApi();
const { CombatSpecial, PendingHit, AccuracyFormulasDpsCalc, DamageFormulas, ItemIdentifiers, CombatType } = core;

before(async () => {
  await core.CachePipeline.initialize(require("node:path").resolve(__dirname, ".."));
  const api = PluginManager.createApi("GraniteHammerTest");
  require("../plugins/combat/specials/GraniteHammer.SpecialAttack")(api);
  const equipment = require("../plugins/skills/slayer/Equipment.Slayer");
  equipment.init(api);
  equipment.attach(api);
});

function resolve({ accurate = false, hp = 100, active = true, playerTarget = false, protection = false, random = 0, combatType = CombatType.MELEE } = {}) {
  const special = CombatSpecial.getById("granite_hammer");
  const attacker = {
    isPlayer: () => true, isNpc: () => false,
    getAsPlayer() { return this; },
    isSpecialActivated: () => active,
    getCombatSpecial: () => special,
    getFightType: () => ({ getBonusType: () => core.BonusManager.ATTACK_CRUSH }),
    getEquipment: () => ({ getItems: () => Object.assign([], { [core.Equipment.WEAPON_SLOT]: { getId: () => ItemIdentifiers.GRANITE_HAMMER } }) }),
  };
  const target = {
    isPlayer: () => playerTarget, isNpc: () => !playerTarget,
    getAsPlayer() { return this; },
    getHitpoints: () => hp,
    getPrayerActive: () => Object.assign([], protection ? { [core.PrayerHandler.PROTECT_FROM_MELEE]: true } : {}),
    getEquipment: () => ({ getItems: () => Array(14).fill({ getId: () => -1 }) }),
  };
  const original = { roll: AccuracyFormulasDpsCalc.rollAccuracyCount, plainRoll: AccuracyFormulasDpsCalc.rollAccuracy, max: DamageFormulas.sourceMaxHit, random: Math.random };
  AccuracyFormulasDpsCalc.rollAccuracyCount = () => Number(accurate);
  AccuracyFormulasDpsCalc.rollAccuracy = () => accurate;
  DamageFormulas.sourceMaxHit = () => 20;
  Math.random = () => random;
  try {
    const method = combatType === CombatType.MELEE ? special.getCombatMethod() : { type: () => combatType, accuracyDefenceType: () => undefined };
    return new PendingHit(attacker, target, method);
  } finally {
    AccuracyFormulasDpsCalc.rollAccuracyCount = original.roll;
    AccuracyFormulasDpsCalc.rollAccuracy = original.plainRoll;
    DamageFormulas.sourceMaxHit = original.max;
    Math.random = original.random;
  }
}

test("Hammer Blow deals five damage even when its accuracy roll fails", () => {
  const hit = resolve();
  assert.equal(hit.getTotalDamage(), 5);
  assert.equal(hit.isAccurate(), false, "the fallback does not turn the failed roll into a successful one");
});

test("the missed Hammer Blow is capped to the target's remaining HP", () => {
  assert.equal(resolve({ hp: 3 }).getTotalDamage(), 3);
});

test("successful Hammer Blow rolls keep their five bonus damage", () => {
  assert.equal(resolve({ accurate: true }).getTotalDamage(), 5);
  assert.equal(resolve({ accurate: true, random: 0.999999 }).getTotalDamage(), 25);
});

test("ordinary granite hammer misses still deal zero", () => {
  assert.equal(resolve({ active: false }).getTotalDamage(), 0);
});

test("leaving the special toggled on does not add damage to a missed spell", () => {
  assert.equal(resolve({ combatType: CombatType.MAGIC }).getTotalDamage(), 0);
});

test("the bonus cannot bypass the Slayer weapon immunity at impact", () => {
  const { NPC } = require("../dist/game/entity/impl/npc/NPC");
  for (const name of ["Kurask", "Turoth"]) {
    const hit = resolve();
    assert.equal(hit.getTotalDamage(), 5, "the weapon bonus exists before target immunity");
    const npc = { getCurrentDefinition: () => ({ getName: () => name }) };
    const resolved = NPC.prototype.manipulateHit.call(npc, hit);
    assert.equal(resolved.getTotalDamage(), 0, name);
  }
});

test("the miss fallback passes through ordinary PvP protection prayer reduction", () => {
  assert.equal(resolve({ playerTarget: true, protection: true, random: 0.9 }).getTotalDamage(), 3);
});

test("Hammer Blow keeps its energy cost and accuracy boost for every registered variant", () => {
  const special = CombatSpecial.getById("granite_hammer");
  assert.equal(special.getDrainAmount(), 60);
  assert.equal(special.getTraits().accuracyMultiplier, 1.5);
  for (const id of [ItemIdentifiers.GRANITE_HAMMER, ItemIdentifiers.GRANITE_HAMMER_2, ItemIdentifiers.GRANITE_HAMMER_3]) {
    assert.equal(CombatSpecial.getForWeaponId(id), special);
  }
  assert.equal(special.getCombatMethod().type(), CombatType.MELEE);
});
