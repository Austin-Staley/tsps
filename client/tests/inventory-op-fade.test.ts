import assert from "node:assert/strict";
import { isInventoryOpFaded, markInventoryOpFade } from "../game/widgets/inventoryOpFade";

const invalidated: any[] = [];
const widgetManager = { invalidateWidgetRender: (w: any) => invalidated.push(w) } as any;
const shark = { uid: (149 << 16) | 0x8003, itemId: 385, itemQuantity: 1 };
const potion = { uid: (149 << 16) | 0x8004, itemId: 2434, itemQuantity: 1 };

// Only inventory items fade.
markInventoryOpFade(widgetManager, { uid: (12 << 16) | 1, itemId: 385, itemQuantity: 1 });
assert.equal(invalidated.length, 0);

markInventoryOpFade(widgetManager, shark);
assert.equal(isInventoryOpFaded(shark), true);
assert.equal(isInventoryOpFaded(potion), false, "other slots stay solid");
assert.deepEqual(invalidated, [shark]);

// The server's answer ends it: the slot's item or amount changed.
assert.equal(isInventoryOpFaded({ ...shark, itemId: -1 }), false, "eaten");
assert.equal(isInventoryOpFaded({ ...shark, itemQuantity: 0 }), false, "amount changed");
assert.equal(isInventoryOpFaded(shark, performance.now() + 601), false, "a tick passed");

// A second op moves the fade and redraws the first slot.
markInventoryOpFade(widgetManager, potion);
assert.equal(isInventoryOpFaded(shark), false);
assert.equal(isInventoryOpFaded(potion), true);
assert.deepEqual(invalidated.slice(1), [shark, potion]);

// The timeout redraws the slot so the fade disappears without other changes.
setTimeout(() => {
    assert.equal(isInventoryOpFaded(potion), false);
    assert.equal(invalidated[invalidated.length - 1], potion);
    console.log("inventory op fade ok");
}, 650);
