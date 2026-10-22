// Run after `yarn build`: node --test tests/salamanders.test.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const { test, before } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { PluginManager } = require("../dist/plugins/PluginManager");
const { CombatFactory } = require("../dist/game/content/combat/CombatFactory");
const { CombatType } = require("../dist/game/content/combat/CombatType");
const { FightType } = require("../dist/game/content/combat/FightType");
const { FightStyle } = require("../dist/game/content/combat/FightStyle");
const { WeaponInterfaces } = require("../dist/game/content/combat/WeaponInterfaces");
const { WeaponProfiles } = require("../dist/game/content/combat/WeaponProfile");
const { Equipment } = require("../dist/game/model/container/impl/Equipment");
const { Item } = require("../dist/game/model/Item");
const { Skill } = require("../dist/game/model/Skill");
const { Player } = require("../dist/game/entity/impl/player/Player");
const { ItemIdentifiers: I } = require("../dist/util/ItemIdentifiers");
const { ItemDefinition } = require("../dist/game/definition/ItemDefinition");

const Salamanders = require("../plugins/items/Salamanders.plugin");

const SALAMANDERS = [I.SWAMP_LIZARD, I.ORANGE_SALAMANDER, I.RED_SALAMANDER, I.BLACK_SALAMANDER];

let registered;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  registered = { resolvers: [], ammo: [] };
  Salamanders.register({
    core: PluginManager.getCoreApi(),
    registerCombatMethodResolver: (resolver) => registered.resolvers.push(resolver),
    registerRangedAmmoHandler: (handler) => registered.ammo.push(handler),
  });
});

function wielding(weaponId, fightType, ammo = new Item(-1, 0)) {
  const items = Array.from({ length: 14 }, () => new Item(-1, 0));
  items[Equipment.WEAPON_SLOT] = new Item(weaponId, 1);
  items[Equipment.AMMUNITION_SLOT] = ammo;
  const experience = [];
  const player = {
    isPlayer: () => true,
    getAsPlayer() { return this; },
    getEquipment: () => ({ getItems: () => items, get: (slot) => items[slot], set: (slot, item) => { items[slot] = item; }, refreshItems() {} }),
    getWeapon: () => WeaponInterfaces.SALAMANDER,
    getFightType: () => fightType,
    getSkillManager: () => ({ getCurrentLevel: () => 99, addExperience: (skill, amount) => experience.push([skill.getName?.() ?? skill, amount]) }),
    sendMessage() {},
    experience,
  };
  player.getBaseAttackSpeed = () => Player.prototype.getBaseAttackSpeed.call(player);
  return player;
}

test("Blaze max hit follows the Wiki tables", () => {
  const maxHit = Salamanders._test.blazeBaseMaxHit;
  const bonus = Salamanders._test.BLAZE_MAGIC_BONUS_BY_ITEM;
  // [salamander, magic level, max hit] rows from each salamander's Wiki table.
  const rows = [
    ["SWAMP_LIZARD", 30, 6], ["SWAMP_LIZARD", 34, 6], ["SWAMP_LIZARD", 35, 7], ["SWAMP_LIZARD", 120, 23],
    ["ORANGE_SALAMANDER", 50, 10], ["ORANGE_SALAMANDER", 55, 11], ["ORANGE_SALAMANDER", 112, 22], ["ORANGE_SALAMANDER", 123, 24],
    ["RED_SALAMANDER", 60, 13], ["RED_SALAMANDER", 62, 14], ["RED_SALAMANDER", 121, 27], ["RED_SALAMANDER", 125, 28],
    ["BLACK_SALAMANDER", 70, 17], ["BLACK_SALAMANDER", 72, 18], ["BLACK_SALAMANDER", 89, 22], ["BLACK_SALAMANDER", 117, 29], ["BLACK_SALAMANDER", 125, 30],
  ];
  for (const [name, level, expected] of rows) {
    assert.equal(maxHit(level, bonus[name]), expected, `${name} at Magic ${level}`);
  }
});

test("each style picks the matching combat method", () => {
  const [resolver] = registered.resolvers;
  for (const id of SALAMANDERS) {
    assert.equal(resolver.resolve(wielding(id, FightType.SALAMANDER_SCORCH)), CombatFactory.MELEE_COMBAT);
    assert.equal(resolver.resolve(wielding(id, FightType.SALAMANDER_FLARE)), null, "Flare falls through to the ranged method");
    const blaze = resolver.resolve(wielding(id, FightType.SALAMANDER_BLAZE));
    assert.equal(blaze.type(), CombatType.MAGIC);
    assert.equal(blaze.attackDistance(), 1);
    assert.equal(blaze.splitsDefensiveMagicExperience(), false);
  }
  assert.equal(resolver.resolve(wielding(I.ABYSSAL_WHIP, FightType.SALAMANDER_BLAZE)), null, "other weapons keep their method");
});

test("styles train the intended skills", () => {
  assert.deepEqual(FightType.SALAMANDER_SCORCH.getStyle().skill(CombatType.MELEE), [Skill.STRENGTH.getIndex()]);
  assert.deepEqual(FightType.SALAMANDER_FLARE.getStyle().skill(CombatType.RANGED), [Skill.RANGED.getIndex()]);
  assert.notEqual(FightType.SALAMANDER_FLARE.getStyle(), FightStyle.ACCURATE, "Flare gets no invisible Ranged level");
  assert.equal(FightType.SALAMANDER_BLAZE.getStyle(), FightStyle.DEFENSIVE, "Blaze is +3 Defence");
  assert.deepEqual(FightType.SALAMANDER_SCORCH.getBonusType(), 1);
  assert.deepEqual(FightType.SALAMANDER_FLARE.getBonusType(), 4);
  assert.deepEqual(FightType.SALAMANDER_BLAZE.getBonusType(), 3);
});

test("Blaze pays Magic and Hitpoints XP only", () => {
  const player = wielding(I.BLACK_SALAMANDER, FightType.SALAMANDER_BLAZE);
  const blaze = registered.resolvers[0].resolve(player);
  player.getCombat = () => ({ getCastSpell: () => null, getPreviousCast: () => ({}) });
  const hit = {
    getTotalDamage: () => 10,
    getSkills: () => FightType.SALAMANDER_BLAZE.getStyle().skill(CombatType.MAGIC),
    getCombatType: () => CombatType.MAGIC,
    getCombatMethod: () => blaze,
    isAccurate: () => true,
    getTarget: () => ({ isNpc: () => false }),
  };
  CombatFactory.rewardExp(player, hit);
  const paid = player.experience.map(([skill, amount]) => [String(skill?.getName?.() ?? skill), amount]);
  assert.equal(player.experience.length, 2, JSON.stringify(paid));
  assert.equal(player.experience[0][1], 20, "2 Magic XP per damage");
  assert.equal(player.experience[1][1], 40 / 3, "Hitpoints 1.33 per damage");
});

test("reach is one tile and speed is 5, 4 for Flare", () => {
  for (const id of SALAMANDERS) {
    const scorch = wielding(id, FightType.SALAMANDER_SCORCH);
    assert.equal(WeaponProfiles.attackDistance(scorch, 6), 1);
    assert.equal(scorch.getBaseAttackSpeed(), 5);
    assert.equal(wielding(id, FightType.SALAMANDER_FLARE).getBaseAttackSpeed(), 4);
    assert.equal(wielding(id, FightType.SALAMANDER_BLAZE).getBaseAttackSpeed(), 5);
  }
});

test("every style plays the salamander attack animation", () => {
  for (const style of ["SALAMANDER_SCORCH", "SALAMANDER_FLARE", "SALAMANDER_BLAZE"]) {
    assert.equal(FightType[style].getAnimation(), 5247, `${style}`);
  }
});

test("tar ranged strength matches the Wiki", () => {
  const strength = (id) => ItemDefinition.forId(id).getBonuses()[11];
  assert.equal(strength(I.GUAM_TAR), 16);
  assert.equal(strength(I.MARRENTILL_TAR), 22);
  assert.equal(strength(I.TARROMIN_TAR), 31);
  assert.equal(strength(I.HARRALANDER_TAR), 49);
});

test("a Flare burns exactly one tar and drops nothing", () => {
  const [{ decrementAmmo }] = registered.ammo;
  const player = wielding(I.BLACK_SALAMANDER, FightType.SALAMANDER_FLARE, new Item(I.HARRALANDER_TAR, 2));
  assert.equal(decrementAmmo(player, null, 1), true);
  assert.equal(player.getEquipment().get(Equipment.AMMUNITION_SLOT).getAmount(), 1);
  assert.equal(decrementAmmo(player, null, 1), true);
  assert.equal(player.getEquipment().get(Equipment.AMMUNITION_SLOT).getId(), -1, "the last tar empties the slot");
  assert.equal(decrementAmmo(wielding(I.ABYSSAL_WHIP, FightType.SALAMANDER_FLARE, new Item(I.GUAM_TAR, 5)), null, 1), false);
});
