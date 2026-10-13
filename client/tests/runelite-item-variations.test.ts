import assert from "node:assert/strict";
import variations from "../runelite/client/game/item_variations.json";

assert.deepEqual(variations.toolkit, [1, 4051]);
for (const [name, ids] of Object.entries(variations)) {
    assert.ok(ids.length > 0, name);
    assert.ok(ids.every(id => Number.isInteger(id) && id >= 0), name);
    assert.equal(new Set(ids).size, ids.length, name);
}
console.log("RuneLite variation groups contain unique, valid item ids");
