import assert from "node:assert/strict";
import { test } from "node:test";

import { VarManager } from "../rs/config/vartype/VarManager";
import { VarcMap } from "../runelite/impl/VarcMap";
import { Cs2ArrayObject } from "../rs/cs2/Cs2ArrayObject";

test("the combined varc map reads native writes and writes through to interpreter variables and events", () => {
    let vars = new VarManager({ load: () => undefined } as any);
    const map = new VarcMap(() => vars);
    const changes: unknown[] = [];
    vars.varcIntChangeListeners.add((id, old, value) => changes.push([id, old, value]));
    vars.varcStringChangeListeners.add((id, old, value) => changes.push([id, old, value]));
    vars.setVarcInt(1, 20); vars.setVarcString(2, "native");
    assert.equal(map.get(1), 20); assert.equal(map.get(2), "native");
    assert.equal(map.set(1, 30).set(3, "plugin"), map);
    assert.equal(vars.getVarcInt(1), 30); assert.equal(vars.getVarcString(3), "plugin");
    assert.deepEqual(changes.slice(-2), [[1, 20, 30], [3, "", "plugin"]]);
    map.set(1, "new type"); assert.equal(vars.varcInts.has(1), false); assert.equal(vars.getVarcString(1), "new type");
    const array = new Cs2ArrayObject("int", 0, 1, 1);
    map.set(4, array); assert.equal(vars.getVarcString(4), array);
    map.set(5, 42n); assert.equal(vars.varcLongs.get(5), 42n);
    assert.equal(map.size, 5); assert.equal(new Map(map).get(4), array);
    map.set(6,-1).set(7,"");assert.equal(map.has(6),true);assert.equal(map.has(7),true);assert.equal(map.size,7);
    assert.deepEqual([...map.values()], [...map].map(([, value]) => value));
    map.forEach((value, id, sameMap) => { assert.equal(sameMap, map); assert.equal(value, map.get(id)); });
    assert.equal(map.delete(2), true); assert.equal(vars.varcStrings.has(2), false); assert.equal(map.delete(2), false);
    assert.deepEqual(changes[changes.length - 1], [2, "native", ""]);
    map.clear(); assert.equal(map.size, 0); assert.equal(vars.varcLongs.size, 0); assert.equal(vars.varcInts.size, 0); assert.equal(vars.varcStrings.size, 0);
    // Cache reinitialization replaces the native manager, while the facade map stays live.
    vars = new VarManager({ load: () => undefined } as any); vars.setVarcInt(7, 99);
    assert.equal(map.get(7), 99); assert.equal(map.size, 1);
});
