// Run after `yarn build`: node --test tests/zoryas-tome.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { PluginManager } = require('../dist/plugins/PluginManager');
const { ItemIdentifiers: I } = require('../dist/util/ItemIdentifiers');
const { Item } = require('../dist/game/model/Item');
const { Equipment } = require('../dist/game/model/container/impl/Equipment');

const Zorya = require('../plugins/items/ZoryasTome.plugin');
const { CHARGES_META_KEY, MAX_CHARGES, buffs, onMaxHit, onAttackRoll, onHitResolved } = Zorya._test;

const resolvers = [];
const itemActions = new Map();
const specials = [];
const core = PluginManager.getCoreApi();
Zorya.register({
    core,
    registerCombatMethodResolver: (resolver) => resolvers.push(resolver),
    registerCombatSpecial: (definition) => specials.push(definition),
    onItemAction: (name, actions) => itemActions.set(name, actions),
    onItemOnItem: () => {},
    onCombatHitResolved: () => {},
    onCustomEvent: () => {},
});

const NPC = { isPlayer: () => false };

function playerWithTome({ id = I.ZORYAS_TOME, charges = 0, special = 0 } = {}) {
    const tome = new Item(id, 1);
    if (charges > 0) tome.setMetaValue(CHARGES_META_KEY, charges);
    const equipment = new Array(14).fill(null);
    equipment[Equipment.WEAPON_SLOT] = tome;
    let castSpell = null;
    const messages = [];
    const player = {
        isPlayer: () => true,
        getAsPlayer: () => player,
        getEquipment: () => ({ getItems: () => equipment, refreshItems: () => {} }),
        getCombat: () => ({ setCastSpell: (spell) => { castSpell = spell; }, reset: () => {} }),
        getUpdateFlag: () => ({ flag: () => {} }),
        isSpecialActivated: () => special > 0,
        getSpecialPercentage: () => special,
        sendMessage: (message) => messages.push(message),
    };
    return { player, tome, messages, get castSpell() { return castSpell; } };
}

function inventory({ astral = 0, nature = 0 } = {}) {
    const inv = {
        astral, nature, added: [],
        getAmount: (id) => (id === I.ASTRAL_RUNE ? inv.astral : id === I.NATURE_RUNE ? inv.nature : 0),
        deleteNumber: (id, n) => { if (id === I.ASTRAL_RUNE) inv.astral -= n; else inv.nature -= n; },
        refreshItems: () => {}, contains: () => true, getFreeSlots: () => 28,
        addItem: (item) => inv.added.push(item),
    };
    return inv;
}

test('charging spends 3 astral and 2 nature a charge, uncharging returns them, and the tome swaps ids', () => {
    const tome = new Item(I.ZORYAS_TOME_UNCHARGED_, 1);
    const inv = inventory({ astral: 10, nature: 10 });
    const messages = [];
    const player = { getInventory: () => inv, sendMessage: (m) => messages.push(m) };
    const event = { player, usedItem: tome, usedWithItem: new Item(I.ASTRAL_RUNE, 10), usedItemId: tome.getId(), usedWithItemId: I.ASTRAL_RUNE };
    Zorya._test.chargeTome(event);
    assert.equal(Zorya._test.chargesOf(tome), 3, 'min(10/3, 10/2)');
    assert.equal(tome.getId(), I.ZORYAS_TOME);
    assert.deepEqual([inv.astral, inv.nature], [1, 4]);
    assert.equal(MAX_CHARGES, 20000);

    Zorya._test.checkCharges({ player, item: tome });
    assert.match(messages.at(-1), /3 charges/);
    Zorya._test.uncharge({ player, item: tome });
    assert.deepEqual(inv.added.map((i) => [i.getId(), i.getAmount()]), [[I.ASTRAL_RUNE, 9], [I.NATURE_RUNE, 6]]);
    assert.equal(tome.getId(), I.ZORYAS_TOME_UNCHARGED_);
});

test('every cast spends a charge, base max hit is 18 at 3 ticks, and the last charge degrades it', () => {
    const built = playerWithTome({ charges: 1 });
    const method = resolvers[0].resolve(built.player);
    assert.equal(method.attackSpeed(built.player), 3);
    assert.equal(method.attackDistance(built.player), 7);
    assert.equal(method.canAttack(built.player, NPC), true);
    assert.equal(built.castSpell.maximumHit(), 18);
    assert.equal(built.tome.getId(), I.ZORYAS_TOME_UNCHARGED_);
    assert.equal(method.canAttack(built.player, NPC), false);
    assert.match(built.messages.at(-1), /no charges/);
    assert.equal(specials[0].drainAmount, 50);
});

test("Zorya's flow: the special buffs accuracy and damage, a landed hit buffs the next three attacks at 2 ticks", (t) => {
    const built = playerWithTome({ charges: 10, special: 100 });
    const drained = [];
    t.mock.method(core.CombatSpecial, 'drain', (_, amount) => drained.push(amount));
    const method = resolvers[0].resolve(built.player);
    assert.equal(method.canAttack(built.player, NPC), true);
    assert.deepEqual(drained, [50]);
    const request = () => ({ attacker: built.player, spell: built.castSpell, maxHit: 20, attackRoll: 1000 });
    const r = request(); onMaxHit(r); onAttackRoll(r);
    assert.deepEqual([r.maxHit, r.attackRoll], [32, 2500], '+60% damage, +150% accuracy');
    assert.equal(method.attackSpeed(built.player), 3, 'the special itself is a normal-speed cast');

    const hit = { isAccurate: () => true };
    Zorya._test.specialHits.add(hit);
    onHitResolved({ attacker: built.player, hit });
    assert.equal(Zorya._test.buffAttacks(built.player), 3);

    built.player.isSpecialActivated = () => false;
    assert.equal(method.canAttack(built.player, NPC), true);
    assert.equal(method.attackSpeed(built.player), 2, 'buffed attacks come every 2 ticks');
    assert.equal(Zorya._test.buffAttacks(built.player), 2);
    const buffed = request(); onMaxHit(buffed);
    assert.equal(buffed.maxHit, 32);

    buffs.get(built.player).expires = Date.now() - 1;
    method.canAttack(built.player, NPC);
    const plain = request(); onMaxHit(plain);
    assert.equal(plain.maxHit, 20, 'the buff ends after 30 seconds');
});
