import assert from "node:assert/strict";
import { assemble } from "../runelite/impl/scripts/assemble";
import { installRuneLiteScriptPatches, sha256, runeLiteScriptManifest } from "../runelite/impl/scripts/install";
import { Cs2Vm } from "../rs/cs2/Cs2Vm";
import type { ClientScriptLoader } from "../game/cs2/ClientScriptLoader";
import type { Script } from "../rs/cs2/Script";
import { bindScriptEvents } from "../runelite/impl/events/scripts";
import { EventBus } from "../runelite/client/eventbus/EventBus";
import { ScriptCallbackEvent } from "../runelite/api/events/ScriptCallbackEvent";
import type { ClientImpl } from "../runelite/impl/ClientImpl";

async function main() {
    for (const patch of runeLiteScriptManifest.patches) {
        const script = assemble(patch.source, patch.name, patch.symbols);
        assert.equal(script.id, patch.id);
        assert.ok(script.instructions.length > 0);
    }
    assert.throws(() => assemble(".id 10\njump MISSING\nreturn"), /Undefined label/);
    assert.throws(() => assemble(".id 10\nnot_real"), /Unknown instruction/);
    const branch = assemble('.id 10\niconst 2\nswitch\n1: FIRST\n2: SECOND\nFIRST:\niconst 1\nreturn\nSECOND:\niconst 2\nreturn');
    assert.equal(branch.switches?.[0].get(2), 2);
    assert.equal(assemble('.id 10\nsconst "a;b"\nreturn').stringOperands[0], "a;b", "quoted semicolons survive comments");

    const patch = runeLiteScriptManifest.patches.find(p => p.name === "BankSearchFilter")!;
    const script = assemble(patch.source, patch.name, patch.symbols);
    const vm = new Cs2Vm({ widgetManager: { beginBatch() {}, endBatch() {} }, loadScript: () => null } as any);
    const bus = new EventBus();
    const dispose = bindScriptEvents(vm, {} as ClientImpl, bus);
    bus.subscribe(ScriptCallbackEvent, event => {
        assert.equal(event.getEventName(), "bankSearchFilter");
        assert.equal(vm.intStack[vm.intStackSize - 1], 1944, "callback observes upstream item argument");
        assert.equal(vm.stringStack[vm.stringStackSize - 1], "egg");
        vm.intStack[vm.intStackSize - 2] = 1;
    });
    vm.run(script, [1944, 1], ["egg"]);
    assert.equal(vm.intStackSize, 1); assert.equal(vm.intStack[0], 1, "real upstream bank callback controls result via shared VM stacks");
    dispose();

    const bytes = Int8Array.from([1, 2, 3]);
    const compiled = assemble('.id 12\n.int_arg_count 1\niload 0\nreturn');
    const installed = new Map<number, Script>();
    const loader = { getRawBytesWithRetry: async () => bytes, load: () => compiled, setOverride: (s: Script) => installed.set(s.id, s), removeOverride: (id: number) => installed.delete(id) } as unknown as ClientScriptLoader;
    const valid = { name: "test", id: 12, expectedHash: await sha256(bytes), source: '.id 12\n.int_arg_count 1\niload 0\nreturn' };
    const good = installRuneLiteScriptPatches(loader, [valid]);
    assert.equal((await good.ready)[0].status, "installed"); assert.equal(installed.size, 1);
    good.dispose(); assert.equal(installed.size, 0);
    const bad = installRuneLiteScriptPatches(loader, [{ ...valid, expectedHash: "0".repeat(64) }]);
    assert.equal((await bad.ready)[0].status, "hash-mismatch"); assert.equal(installed.size, 0);
    const shape = installRuneLiteScriptPatches(loader, [{ ...valid, source: '.id 12\nreturn' }]);
    assert.equal((await shape.ready)[0].status, "shape-mismatch"); assert.equal(installed.size, 0);
    console.log(`RuneLite ${runeLiteScriptManifest.patches.length} assembler patches, native bank callback and hash guards passed`);
}
void main();
