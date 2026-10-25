// Run after `yarn build`: node --test tests/fractured-archive-rewards.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { PrayerData, PrayerHandler } = require("../dist/game/content/PrayerHandler");
const { Equipment } = require("../dist/game/model/container/impl/Equipment");
const { ItemIds } = require("../dist/util/IdEnums");
const { Skill } = require("../dist/game/model/Skill");

const rewards = require("../plugins/minigames/tfa/Rewards.FracturedArchive");
const rondache = require("../plugins/combat/effects/Rondache.EquipmentEffects");
rondache._test.bind({ Equipment, ItemIdentifiers: ItemIds });

rewards({
  core: { PrayerData, Skill, ItemIdentifiers: ItemIds, Area: class {}, Boundary: class {} },
  persistAttribute() {}, registerArea() {}, onPlayerLogin() {}, onPrayerDisabled() {}, onItemAction() {}, onItemOnNpc() {}, onItemOnItem() {},
});

function player(levels = {}, attributes = {}, shield = 0) {
  const attrs = new Map(Object.entries(attributes));
  const items = new Array(14).fill(null).map(() => ({ getId: () => 0 }));
  items[Equipment.SHIELD_SLOT] = { getId: () => shield };
  return {
    isPlayer: () => true,
    getAsPlayer() { return this; },
    getPacketSender: () => ({ sendVarbit() {} }),
    getCombatSpecial: () => null,
    sendMessage() {},
    getInventory: () => ({ contains: (id) => attrs.get("horn") && id === ItemIds.HORN_OF_BRAN, deleteNumber() { attrs.set("horn", false); } }),
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getSkillManager: () => ({ getMaxLevel: (skill) => levels[skill] ?? 99 }),
    getEquipment: () => ({ getItems: () => items }),
  };
}

test("Zeal is the thirtieth prayer, from the cache's varbit, at 84 Prayer", () => {
  assert.equal(PrayerData.ZEAL.prayerId, PrayerHandler.ZEAL);
  assert.equal(PrayerData.ZEAL.requirement, 84);
  assert.equal(PrayerData.ZEAL.configId, 16577);
});

test("Zeal needs the Horn's unlock and 75 Attack, 75 Strength, 70 Defence", () => {
  const check = (p) => {
    const event = { player: p, prayer: PrayerData.ZEAL, disabled: null };
    rewards._test.zealRequirements(event);
    return event.disabled;
  };
  assert.equal(check(player()), true, "locked");
  assert.equal(check(player({ [Skill.DEFENCE]: 69 }, { "prayer:zeal-unlocked": true })), true);
  assert.equal(check(player({}, { "prayer:zeal-unlocked": true })), null);
});

test("Rondache takes 2 off each hit and charges by what it took", () => {
  const p = player({}, {}, ItemIds.RONDACHE);
  const hit = (damage) => ({ damage, getDamage() { return this.damage; }, setDamage(v) { this.damage = v; } });
  const big = hit(10);
  rondache._test.applyRondache(p, big);
  const small = hit(1);
  rondache._test.applyRondache(p, small);
  assert.deepEqual([big.damage, small.damage], [8, 0]);
  assert.equal(p.getAttribute(rondache._test.CHARGES_ATTRIBUTE), 3);
  for (let i = 0; i < 30; i++) rondache._test.applyRondache(p, hit(10));
  assert.equal(p.getAttribute(rondache._test.CHARGES_ATTRIBUTE), 20, "capped at 20");
  const bare = hit(10);
  rondache._test.applyRondache(player(), bare);
  assert.equal(bare.damage, 10);
});

test("Entering Camelot with the Horn of Bran unlocks Zeal and uses the horn up", () => {
  const p = player({}, { horn: true });
  rewards._test.enterCamelot(p);
  assert.equal(p.getAttribute("prayer:zeal-unlocked"), true);
  assert.equal(p.getAttribute("horn"), false);
});
