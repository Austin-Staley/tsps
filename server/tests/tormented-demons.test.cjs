// Run after `yarn build`: node --test tests/tormented-demons.test.cjs
// Tormented Demons: the cache ids and room limits against the captures, and the shield, prayer
// and unshielded-attack rules against the Wiki (docs/tormented-demons.md).
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { Gamevals, GamevalKind } = require("../dist/game/cache/Gamevals");
const { Location } = require("../dist/game/model/Location");
const { PluginManager } = require("../dist/plugins/PluginManager");

const Shared = require("../plugins/bosses/tormenteddemons/Shared.TormentedDemons");
const Shield = require("../plugins/bosses/tormenteddemons/Shield.TormentedDemons");
const Temple = require("../plugins/bosses/tormenteddemons/Temple.TormentedDemons");

const core = PluginManager.getCoreApi();
let gamevals = null;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  Shared.attachApi({ core, emitCustomEvent: () => {} });
  gamevals = new Gamevals();
});

test("the ids are the cache's tormented demon sequences, graphics and npcs", () => {
  const npc = gamevals.namesOf(GamevalKind.NPC);
  const seq = gamevals.namesOf(GamevalKind.SEQ);
  const spotanim = gamevals.namesOf(GamevalKind.SPOTANIM);
  const varbit = gamevals.namesOf(GamevalKind.VARBIT);
  assert.deepEqual(Shared.DEMON_IDS.map((id) => npc.get(id)), ["tormented_demon_1", "tormented_demon_2"]);
  assert.equal(seq.get(Shared.SEQ.EXPLOSION_FIRE), "luc2_undead_demon_explosion_fire");
  assert.equal(seq.get(Shared.SEQ.MELEE), "luc2_undead_demon_melee");
  assert.equal(seq.get(Shared.SEQ.RANGED), "luc2_undead_demon_spare_ribs");
  assert.equal(seq.get(Shared.SEQ.MAGIC), "luc2_undead_demon_firey_balls");
  assert.equal(seq.get(Shared.SEQ.SUMMON), "luc2_undead_demon_summon");
  assert.equal(spotanim.get(Shared.SPOT.SHIELD.id), "luc2_undead_demon_shield_spot");
  assert.equal(spotanim.get(Shared.SPOT.SHIELD_RESTORE.id), "luc2_undead_demon_shield_restore_spot");
  assert.equal(spotanim.get(Shared.SPOT.SHIELD_DROP.id), "luc2_undead_demon_explosion_fire_spot");
  assert.equal(spotanim.get(Shared.SPOT.DEFENCELESS.id), "luc2_undead_accuracy_debuff");
  assert.equal(spotanim.get(Shared.PROJECTILE.RANGED.id), "luc2_rib_bone_shard_projectile");
  assert.equal(spotanim.get(Shared.PROJECTILE.MAGIC.id), "luc2_undead_demon_fireball_proj");
  assert.equal(spotanim.get(Shared.PROJECTILE.BOMB.id), "luc2_undead_demon_fireball_large_proj");
  assert.equal(spotanim.get(Shared.BOMB_TILE.EXPLOSION.id), "luc2_undead_demon_fireball_large_impact");
  assert.equal(varbit.get(10960), "td_multiway_indicator");
});

test("each tile takes its room's demon limit, as the captured indicator shows", () => {
  const { zoneLimit } = Temple._test;
  const at = (x, y) => zoneLimit(new Location(x, y, 0));
  // Captured: 2 on arriving at the entrance, 3 down the west corridor, 1 into the plinth room.
  assert.equal(at(4061, 4466), 2);
  assert.equal(at(4060, 4417), 2);
  assert.equal(at(4059, 4410), 3);
  assert.equal(at(4094, 4399), 1);
  // Wiki rooms: the plinth room 1, the central chamber 2, the south-west rooms 3.
  assert.equal(at(4126, 4386), 1);
  assert.equal(at(4076, 4430), 2);
  assert.equal(at(4046, 4384), 3);
  assert.equal(at(4112, 4430), 2);
});

function fakePlayer({ weaponType = "UNARMED", bonusType = 0, weapon = -1, spell = null, castSpell = null } = {}) {
  const items = [];
  items[core.Equipment.WEAPON_SLOT] = { getId: () => weapon };
  return {
    isPlayer: () => true,
    getAsPlayer() { return this; },
    getWeapon: () => ({ getName: () => weaponType }),
    getFightType: () => ({ getBonusType: () => bonusType }),
    getEquipment: () => ({ getItems: () => items }),
    getCombat: () => ({ getSelectedSpell: () => spell, getCastSpell: () => castSpell }),
  };
}

test("the unshielded attack's bonus: X^2 - 16 for crush, heavy ranged and spells", () => {
  const { unshieldedBonus } = Shield._test;
  const { CombatType } = core;
  // Wiki table: 7 ticks +33, 6 ticks +20, 5 ticks +9, 4 or faster +0.
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "TWO_HANDED_SWORD", bonusType: 2 }), CombatType.MELEE, 7), 33);
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "ELDER_MAUL", bonusType: 2 }), CombatType.MELEE, 6), 20);
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "CROSSBOW" }), CombatType.RANGED, 5), 9);
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "MACE", bonusType: 2 }), CombatType.MELEE, 4), 0);
  // Slash melee, light ranged and a powered staff's own spell get nothing.
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "TWO_HANDED_SWORD", bonusType: 1 }), CombatType.MELEE, 7), 0);
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "SHORTBOW" }), CombatType.RANGED, 6), 0);
  const trident = { name: "trident" };
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "POWERED_STAFF", spell: trident }), CombatType.MAGIC, 5), 0);
  assert.equal(unshieldedBonus(fakePlayer({ weaponType: "STAFF", spell: trident, castSpell: trident }), CombatType.MAGIC, 5), 9);
});

function fakeDemon(x) {
  const delays = [];
  return {
    delays,
    icon: null,
    isNpc: () => true,
    getAsNpc() { return this; },
    getId: () => 13599,
    getRealId: () => 13599,
    getSpawnPosition: () => new Location(x, 4400, 0),
    getLocation: () => new Location(x, 4400, 0),
    setHeadIcon(icon) { this.icon = icon; },
    getCombat: () => ({ extendAttackDelay: (ticks) => delays.push(ticks) }),
  };
}

function fakeHit(attacker, combatType, damages) {
  const parts = damages.map((damage) => new core.HitDamage(damage, damage > 0 ? core.HitMask.RED : core.HitMask.BLUE));
  return {
    getAttacker: () => attacker,
    getCombatType: () => combatType,
    getHits: () => parts,
    updateTotalDamage() {},
    total: () => parts.reduce((sum, part) => sum + part.getDamage(), 0),
  };
}

function land(npc, player, combatType, damages, entry) {
  const fight = Shared.fightOf(npc);
  fight.launches.set(player, [{ cycle: 0, ...entry }]);
  const hit = fakeHit(player, combatType, damages);
  Shield._test.onHitModify({ npc, hit });
  return hit.total();
}

test("the prayer stops its style, but lets a third of the unshielded bonus through", () => {
  const npc = fakeDemon(4100);
  const player = fakePlayer({ weaponType: "ELDER_MAUL", bonusType: 2 });
  Shared.setPrayer(npc, "melee");
  assert.equal(land(npc, player, core.CombatType.MELEE, [40], { shielded: true, bonus: 0 }), 0);
  // Wiki: a 7-tick weapon (+33) always hits 11 on prayer.
  assert.equal(land(npc, player, core.CombatType.MELEE, [0], { shielded: false, bonus: 33 }), 11);
});

test("the shield cuts 20% unless the attack is demonbane or abyssal; the bonus adds on top", () => {
  const npc = fakeDemon(4101);
  Shared.setPrayer(npc, "magic");
  const plain = fakePlayer({ weaponType: "SCIMITAR", weapon: core.ItemIdentifiers.DRAGON_SCIMITAR });
  const arclight = fakePlayer({ weaponType: "SWORD", weapon: core.ItemIdentifiers.ARCLIGHT });
  const whip = fakePlayer({ weaponType: "WHIP", weapon: core.ItemIdentifiers.ABYSSAL_WHIP });
  assert.equal(land(npc, plain, core.CombatType.MELEE, [30], { shielded: true, bonus: 0 }), 24);
  assert.equal(land(npc, arclight, core.CombatType.MELEE, [30], { shielded: true, bonus: 0 }), 30);
  assert.equal(land(npc, whip, core.CombatType.MELEE, [30], { shielded: true, bonus: 0 }), 30);
  assert.equal(land(npc, plain, core.CombatType.MELEE, [30], { shielded: false, bonus: 20 }), 50);
});

test("every 150 damage it prays against the style that last hit it, and stops attacking 6 ticks", () => {
  const npc = fakeDemon(4102);
  const player = fakePlayer({ weaponType: "SWORD", weapon: core.ItemIdentifiers.ARCLIGHT });
  Shared.setPrayer(npc, "ranged");
  land(npc, player, core.CombatType.MELEE, [100], { shielded: true, bonus: 0 });
  assert.equal(npc.icon, Shared.HEAD_ICON.ranged);
  land(npc, player, core.CombatType.MELEE, [60], { shielded: true, bonus: 0 });
  assert.equal(npc.icon, Shared.HEAD_ICON.melee);
  assert.equal(Shared.prayerOf(npc), "melee");
  assert.deepEqual(npc.delays, [Shared.PRAYER_SWAP_STALL]);
  assert.equal(Shared.fightOf(npc).damageSinceSwap, 0);
});
