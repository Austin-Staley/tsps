const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { Player } = require('../dist/game/entity/impl/player/Player');
const Rewards = require('../plugins/npcs/OrderedRewards.NpcDrops');
const State = require('../plugins/npcs/ForgottenFourRewards.plugin');
const Drops = require('../plugins/npcs/NpcDrops.plugin');

before(() => CachePipeline.initialize(require('node:path').resolve(__dirname, '..')));

// Generic consumer-contract fixtures, not a replacement for canonical source exports.
function fixture(t) {
    const player = new Player(null), handlers = new Map();
    const api = new Proxy({
        persistAttribute() {}, getItemOnGroundManager: () => ({}),
        onCustomEvent(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
        emitCustomEvent(name, event) { for (const fn of handlers.get(name) || []) fn(event); },
    }, { get: (api, key) => api[key] ?? (() => {}) });
    State.register(api);
    Drops.register(api);
    const row = item_id => ({ item_id, name: `Item ${item_id}`, quantity: [1, 1], weight: 1, out_of: 1 });
    const stage = (key, out_of, item_id) => ({ key, weight: 1, out_of, main_max_roll: 1, entries: [row(item_id)] });
    const unique = stage('unique', 2, 995);
    unique.entries[0].progression = { type: 'cyclic_hits', state_key: 'vestige:995', hits: 3, intermediate_item_id: 1635, intermediate_quantities: [1, 2] };
    const tablet = stage('tablet', 25, 590);
    tablet.eligibility = { type: 'until_first_received', state_key: 'first:590' };
    tablet.record_first_received = { state_key: 'first:590' };
    const quartz = stage('quartz', 200, 453);
    quartz.record_first_received = { state_key: 'first:453' };
    quartz.source_scaling = { execution: 'documented_base_and_endpoint', known_endpoint: { kill_count: 300, weight: 1, out_of: 50 }, after_first_received: { weight: 1, out_of: 200 } };
    const supplies = stage('supplies', 5, 385);
    supplies.entries[0].bonus_drops = [row(2434)];
    const table = { table_id: 'example_boss', wiki_page: 'Example boss', main_max_roll: 1, entries: [row(554)],
        reward_chain: { type: 'ordered_exclusive', state_domain: 'forgotten_four', stages: [unique, stage('orb', 2, 882), tablet, quartz, supplies] },
        tertiary: [{ ...row(558), out_of: 2 }], tertiary_groups: [{ type: 'exclusive', entries: [{ ...row(555), out_of: 160 }, { ...row(556), out_of: 160 }] }] };
    let values = [];
    t.mock.method(Math, 'random', () => values.shift() ?? .99);
    return { player, api, table, roll(sequence, other = table) { values = [...sequence]; return Drops.__internals.rollTable(other, player, null); } };
}

const has = (rows, id) => rows.some(row => row.itemId === id);
test('actual roller cycles vestige hits, isolates bosses, and restores serialized state into another player', t => {
    const f = fixture(t);
    assert.equal(f.roll([0, 0]).find(row => row.itemId === 1635).amount, 1);
    assert.equal(f.roll([0, 0], { ...f.table, table_id: 'other_boss' }).find(row => row.itemId === 1635).amount, 1);
    const saved = JSON.parse(JSON.stringify(f.player.getAttribute(State.STATE_ATTRIBUTE)));
    const reloaded = fixture(t);
    reloaded.player.setAttribute(State.STATE_ATTRIBUTE, saved);
    assert.equal(reloaded.roll([0, 0]).find(row => row.itemId === 1635).amount, 2);
    assert.ok(has(reloaded.roll([0, 0]), 995));
    assert.equal(reloaded.roll([0, 0]).find(row => row.itemId === 1635).amount, 1);
});
test('one unique replaces resources while the pet and one exclusive clue outcome remain independent', t => {
    const f = fixture(t), rows = f.roll(Array(12).fill(0));
    assert.ok(has(rows, 1635)); assert.ok(!has(rows, 554)); assert.ok(has(rows, 558));
    assert.equal(rows.filter(row => [555, 556].includes(row.itemId)).length, 1);
});
test('failed chain reaches resources and supply success returns the complete bundle instead', t => {
    const f = fixture(t);
    assert.ok(has(f.roll([.99, .99, .99, .99, .99]), 554));
    const rows = f.roll([.99, .99, .99, .99, 0, 0]);
    assert.ok(has(rows, 385)); assert.ok(has(rows, 2434)); assert.ok(!has(rows, 554));
});
test('first tablet receipt persists across serialization and skips its future access', t => {
    const f = fixture(t);
    assert.ok(has(f.roll([.99, .99, 0, 0]), 590));
    f.player.setAttribute(State.STATE_ATTRIBUTE, JSON.parse(JSON.stringify(f.player.getAttribute(State.STATE_ATTRIBUTE))));
    const rows = f.roll([.99, .99, 0, 0]);
    assert.ok(!has(rows, 590)); assert.ok(has(rows, 453));
});
test('documented quartz endpoint starts at 300 recorded kills and resets to base after receipt', t => {
    const f = fixture(t); let count = 299;
    f.api.onCustomEvent('combat-achievements:count', event => { assert.equal(event.monster, 'Example boss'); event.total = count; });
    assert.ok(!has(f.roll([.99, .99, .99, .01, 0]), 453));
    count = 300; assert.ok(has(f.roll([.99, .99, .99, .01, 0]), 453));
    f.player.setAttribute(State.STATE_ATTRIBUTE, JSON.parse(JSON.stringify(f.player.getAttribute(State.STATE_ATTRIBUTE))));
    assert.ok(!has(f.roll([.99, .99, .99, .01, 0]), 453));
});
test('missing or malformed state fails closed, including null and corrupt progress', t => {
    const f = fixture(t);
    assert.throws(() => Rewards.select(f.table, f.player, { emitCustomEvent() {} }, () => 0), /state provider/);
    for (const saved of [null, { example_boss: { 'vestige:995': 3 } }, { example_boss: { 'first:590': 1 } }]) {
        f.player.setAttribute(State.STATE_ATTRIBUTE, saved);
        assert.throws(() => f.roll([0, 0]), /state/);
    }
});
test('failed reward resolution leaves persisted progress unchanged', t => {
    const f = fixture(t), broken = { ...f.table, tertiary_groups: [{ type: 'unsupported' }] };
    assert.throws(() => f.roll([0, 0], broken), /Unsupported tertiary/);
    assert.equal(f.player.getAttribute(State.STATE_ATTRIBUTE), undefined);
});
test('rejected commit never returns an outcome and adjusted clue probabilities remain exclusive', t => {
    const f = fixture(t);
    f.api.onCustomEvent('npc-drops:reward-state-commit', event => { event.committed = false; });
    assert.throws(() => f.roll([0, 0]), /commit rejected/);
    const rows = f.table.tertiary_groups[0].entries;
    assert.equal(Rewards.group(rows, () => 2, () => 0), rows[0]);
    assert.equal(Rewards.group(rows, () => 2, () => .015), rows[1]);
    assert.equal(Rewards.group(rows, () => 2, () => .99), null);
});
