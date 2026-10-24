const assert = require('node:assert/strict');
const { test } = require('node:test');
const dump = require('../data/definitions/npc-drops.json');

test('the conditional-quantity import preserves upstream table identities and NPC variants', () => {
    assert.equal(Object.keys(dump.tables).length, 1112);
    assert.equal(Object.keys(dump.npcs).length, 3092);
    for (const id of [8058, 8060, 13686]) assert.ok(dump.npcs[id], `upstream variant ${id}`);
    for (const id of [8058, 8060, 13686]) assert.deepEqual(dump.npcs[id].tables, [], `quest variant ${id} has no normal boss loot`);
    for (const id of [8059, 8061, 13685]) assert.ok(dump.npcs[id].tables.length > 0, `post-quest variant ${id} retains its table`);
    assert.deepEqual(dump.tables.the_mimic.entries.map(entry => entry.item_id), [8782],
        'canonical NPC table keeps the plank; the existing Mimic handler owns casket rewards');
    assert.deepEqual(dump.tables.bandit_champion.entries.map(entry => entry.item_id), [526, 4600, 1331],
        'canonical conditional rows remain intact; the quest owns the two exclusive rewards');
    const occult = dump.tables.thermonuclear_smoke_devil.entries.find(e => e.item_id === 12002);
    assert.deepEqual([occult.weight, occult.out_of], [1, 350]);
});

test('Nex keeps both existing supply bundles and her 12-slot pool', () => {
    const table = dump.tables.nex;
    assert.equal(table.main_max_roll, 12);
    const pairs = table.entries.flatMap(entry => (entry.bonus_drops || []).map(bonus => [entry.item_id, bonus.item_id]));
    assert.deepEqual(pairs.sort((a, b) => a[0] - b[0]), [[385, 2434], [6685, 3024]]);
    assert.ok(!table.entries.some(entry => entry.item_id === 2434 || entry.item_id === 3024));
});

test('Vardorvis Coal uses source alternatives without changing its roll chance', () => {
    const coal = dump.tables.vardorvis.entries.find(entry => entry.item_id === 453);
    assert.deepEqual([coal.weight, coal.out_of], [8, 100]);
    assert.deepEqual(coal.quantity, [130, 130]);
    assert.equal(coal.quantity_selection, 'conditional');
    assert.deepEqual(coal.quantity_alternatives.map(alt => alt.quantity), [[130, 130], [195, 195]]);
    assert.equal(coal.quantity_alternatives[1].condition.type, 'perfect_kill');
});

test('the imported alternatives retain explicit conditions and unknown-distribution accounting', () => {
    const rows = Object.values(dump.tables).flatMap(table => [...(table.entries || []), ...(table.tertiary || [])]);
    const counts = {};
    for (const row of rows.filter(entry => entry.quantity_alternatives)) {
        const type = row.quantity_selection === 'unknown' ? 'unknown' : row.quantity_alternatives[1].condition.type;
        counts[type] = (counts[type] || 0) + 1;
        assert.ok(row.quantity_alternatives.every(alt => alt.quantity.every(Number.isInteger)));
        if (row.quantity_selection === 'conditional') {
            assert.ok(row.quantity_alternatives.slice(1).every(alt => alt.condition?.type));
        }
    }
    assert.deepEqual(counts, { perfect_kill: 99, bounty_task: 2, preferred_method: 3, unknown: 12 });
});
