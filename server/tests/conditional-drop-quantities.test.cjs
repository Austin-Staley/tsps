const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const Drops = require('../plugins/npcs/NpcDrops.plugin');
const { rollTable } = Drops.__internals;

const player = {};
const coal = {
    item_id: 453, quantity: [130, 130], quantity_selection: 'conditional',
    quantity_alternatives: [
        { quantity: [130, 130] },
        { quantity: [195, 195], condition: { type: 'perfect_kill' } },
    ],
};

test('conditional quantities select the source default or the matching alternative', () => {
    const table = { entries: [{ ...coal, always: true }] };
    assert.equal(rollTable(table, player, null, { perfectKill: false })[0].amount, 130);
    assert.equal(rollTable(table, player, null, { perfectKill: true })[0].amount, 195);
    assert.equal(rollTable(table, player, null, { perfectKill: 'true' })[0].amount, 130);
});

test('one kill context query supplies every main, guaranteed, bonus and tertiary quantity', t => {
    const npc = { getId: () => 12223 };
    const events = [];
    Drops.register(new Proxy({
        core: {}, getItemOnGroundManager: () => ({}),
        emitCustomEvent(name, event) {
            if (name !== 'npc-drops:context') return;
            events.push(event);
            assert.equal(event.player, player);
            assert.equal(event.npc, npc);
            assert.equal(event.npcId, 12223);
            assert.equal(event.context.perfectKill, false);
            event.context.perfectKill = true;
        },
    }, { get: (target, key) => target[key] ?? (() => {}) }));
    t.mock.method(Math, 'random', () => 0);
    const drops = rollTable({ main_max_roll: 1, entries: [
        { ...coal, always: true },
        { ...coal, weight: 1, out_of: 1, bonus_drops: [coal] },
    ], tertiary: [{ ...coal, weight: 1, out_of: 2 }] }, player, npc);
    assert.deepEqual(drops.map(drop => drop.amount), [195, 195, 195, 195]);
    assert.equal(events.length, 1);
});

test('conditions match their own context and unknown types do not activate', () => {
    for (const [condition, yes, no] of [
        [{ type: 'bounty_task', monster: 'Narwhal' }, { bountyTask: 'narwhal' }, { bountyTask: 'orca' }],
        [{ type: 'preferred_method', location: 'Chasm of Fire' }, { preferredMethodLocation: 'Chasm of Fire' }, { preferredMethodLocation: 'Wilderness' }],
        [{ type: 'future_condition' }, {}, {}],
    ]) {
        const entry = { ...coal, always: true, quantity_alternatives: [coal.quantity_alternatives[0], { quantity: [195, 195], condition }] };
        assert.equal(rollTable({ entries: [entry] }, player, null, yes)[0].amount,
            condition.type === 'future_condition' ? 130 : 195);
        assert.equal(rollTable({ entries: [entry] }, player, null, no)[0].amount, 130);
    }
});

test('unknown distributions select listed alternatives, never a concatenated or intermediate value', t => {
    const entry = { ...coal, always: true, quantity_selection: 'unknown' };
    let value = 0;
    t.mock.method(Math, 'random', () => value);
    assert.equal(rollTable({ entries: [entry] }, player, null, {})[0].amount, 130);
    value = 0.999999;
    assert.equal(rollTable({ entries: [entry] }, player, null, {})[0].amount, 195);
});

test('legacy ranges continue to roll their inclusive bounds', t => {
    let value = 0;
    t.mock.method(Math, 'random', () => value);
    const table = { entries: [{ item_id: 453, quantity: [3, 5], always: true }] };
    assert.equal(rollTable(table, player, null, {})[0].amount, 3);
    value = 0.999999;
    assert.equal(rollTable(table, player, null, {})[0].amount, 5);
});
