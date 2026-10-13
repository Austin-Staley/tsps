import assert from "node:assert/strict";
import { VarManager } from "../rs/config/vartype/VarManager";
import { GroundItemStore } from "../game/data/ground/GroundItemStore";
import { NpcEcs } from "../game/ecs/NpcEcs";
import { PlayerEcs } from "../game/ecs/PlayerEcs";
import { MapManager } from "../game/MapManager";
import { Cs2Vm } from "../rs/cs2/Cs2Vm";
import { Script } from "../rs/cs2/Script";
import { InputManager } from "../game/InputManager";
import { ClientState } from "../game/ClientState";
import { dispatchMenuAction, setMenuEventHooks } from "../ui/menu/menuEvents";

const vars = new VarManager({ load: () => ({ baseVar: 12, startBit: 0, endBit: 1 }) } as any);
const changes: number[][] = [];
const listener = (id: number, before: number, after: number) => changes.push([id, before, after]);
vars.varpChangeListeners.add(listener);
vars.setServerVarp(12, 9); vars.setVarp(12, 2); vars.setServerVarbit(0, 3);
assert.equal(vars.serverValues[12], 11);
assert.equal(vars.getVarp(12), 3, "packet bit updates retain normal client write behavior");
assert.deepEqual(changes, [[12, 0, 9], [12, 9, 2], [12, 2, 3]]);
vars.varpChangeListeners.delete(listener);
vars.setVarp(12, 4); assert.equal(changes.length, 3);
assert.equal(vars.setServerVarp(-1, 10), false);
assert.equal(vars.setServerVarp(8000, 10), false);
vars.resetForLogout(); assert.equal(vars.serverValues[12], 0);

const ground = new GroundItemStore(), groundChanges: string[] = [];
ground.mutationListeners.add(event => groundChanges.push(`${event.kind}:${event.stack.quantity}`));
const stack = { id: 1, itemId: 1944, quantity: 1, tile: { x: 3200, y: 3200, level: 0 } };
ground.update({ kind: "snapshot", stacks: [stack] });
ground.update({ kind: "delta", upserts: [{ ...stack, quantity: 3 }], removes: [] });
ground.clear(); assert.deepEqual(groundChanges, ["spawn:1", "quantity:3", "despawn:3"]);

const npcs = new NpcEcs(4), players = new PlayerEcs(4), mutations: string[] = [];
npcs.mutationListeners.add(event => mutations.push(`${event.kind}:${npcs.getServerId(event.index)}`));
const n = npcs.createNpc(50, 50, 1, 1, 64, 64, 0, 0, 0, 0);
assert.deepEqual(mutations, [], "cached visual NPCs are not server spawns");
npcs.setServerMapping(n, 7); npcs.setServerMapping(n, 7); npcs.setNpcTypeId(n, 2); npcs.destroyNpc(n);
assert.deepEqual(mutations, ["spawn:7", "composition:7", "despawn:7"]);
const playerChanges: string[] = [];
players.mutationListeners.add(event => playerChanges.push(event.kind));
players.allocatePlayer(9); players.deallocatePlayer(9);
assert.deepEqual(playerChanges, ["spawn", "despawn"]);

const maps = new MapManager<any>(8, () => {}), map = { mapX: 50, mapY: 50, delete() {}, canRender: () => true };
const mapChanges: string[] = [];
maps.preMapLoadListeners.add(() => { assert.equal(maps.getMap(50, 50), undefined); mapChanges.push("pre"); });
maps.mapAddedListeners.add(() => { assert.equal(maps.getMap(50, 50), map); mapChanges.push("added"); });
maps.mapRemovedListeners.add(() => mapChanges.push("removed"));
maps.addMap(50, 50, map); maps.removeMap(50, 50);
assert.deepEqual(mapChanges, ["pre", "added", "removed"]);

const scripts = new Map<number, Script>(), root = new Script(), child = new Script();
root.id = 100; root.instructions = Int32Array.from([40, 21]); root.intOperands = Int32Array.from([101, 0]); root.stringOperands = [null, null];
child.id = 101; child.instructions = Int32Array.from([21]); child.intOperands = Int32Array.from([0]); child.stringOperands = [null];
scripts.set(101, child);
const vm = new Cs2Vm({ widgetManager: { beginBatch() {}, endBatch() {} }, loadScript: (id: number) => scripts.get(id) } as any);
const fired: string[] = [];
vm.scriptPreListeners.add(id => fired.push(`pre:${id}`)); vm.scriptPostListeners.add(id => fired.push(`post:${id}`));
vm.run(root); assert.deepEqual(fired, ["pre:100", "pre:101", "post:101", "post:100"]);

const input = new InputManager();
const removeFilter = input.addInputFilter(() => true);
const key = { code: "KeyW", key: "w", preventDefault() {} } as KeyboardEvent;
input.onKeyDown(key); assert.equal(input.isKeyDown("KeyW"), false);
removeFilter(); input.onKeyDown(key); assert.equal(input.isKeyDown("KeyW"), true);

for (const consumer of ["none", "filter", "handler"] as const) {
    for (const [code, key, keyCode, osrsCode] of [
        ["ShiftLeft", "Shift", 16, 81], ["ControlLeft", "Control", 17, 82],
        ["KeyW", "w", 87, 33], ["ArrowLeft", "ArrowLeft", 37, 96],
    ] as const) {
        const releaseInput = new InputManager();
        const press = { code, key, keyCode, shiftKey: keyCode === 16, preventDefault() {} } as KeyboardEvent;
        releaseInput.onKeyDown(press);
        assert.equal(releaseInput.isKeyDown(code), true);
        assert.equal(releaseInput.isKeyHeld(osrsCode), true);
        let consumed = 0;
        if (consumer === "filter") releaseInput.addInputFilter(type => {
            if (type !== "keyReleased") return false;
            consumed++; return true;
        });
        if (consumer === "handler") releaseInput.addKeyHandler({ onKeyUp: () => { consumed++; return true; } });
        (releaseInput as any).onKeyUp({ ...press, shiftKey: false });
        assert.equal(consumed, consumer === "none" ? 0 : 1);
        assert.equal(releaseInput.isKeyDown(code), false, `${consumer}: camera key released`);
        assert.equal(releaseInput.isKeyHeld(osrsCode), false, `${consumer}: CS2 key released`);
        assert.equal(releaseInput.keyArray[osrsCode], 0);
        assert.equal(releaseInput.shiftDown, false);
        if (keyCode === 16 || keyCode === 17) assert.equal(ClientState.isKeybindPressed(osrsCode), false);
    }
}

const action = { param0: 0, param1: 0, opcode: 57, identifier: 1, itemId: -1, option: "Click", target: "", screenX: 0, screenY: 0 };
let clicks = 0, native = 0;
const dispose = setMenuEventHooks({ build: entries => entries, opened: entries => entries, shouldOpen: open => open,
    click: () => { clicks++; return false; } });
dispatchMenuAction(action, data => dispatchMenuAction(data, () => native++));
assert.equal(clicks, 1); assert.equal(native, 1);
dispose(); dispatchMenuAction(action, () => native++);
assert.equal(clicks, 1); assert.equal(native, 2, "unregistered hooks preserve native actions");
console.log("Engine hooks: packet mirrors, actor/map lifecycle, nested scripts, input and menu cleanup passed");
