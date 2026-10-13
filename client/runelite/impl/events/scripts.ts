import type { Cs2Vm, ScriptEvent as EngineScriptEvent } from "../../../rs/cs2/Cs2Vm";
import type { ClientImpl } from "../ClientImpl";
import type { ScriptEvent } from "../../api/ScriptEvent";
import type { Script as EngineScript } from "../../../rs/cs2/Script";
import { ScriptImpl } from "../ScriptImpl";
import { ScriptCallbackEvent } from "../../api/events/ScriptCallbackEvent";
import { ScriptPostFired, ScriptPreFired } from "../../api/events";
import type { EventBus } from "../../client/eventbus/EventBus";
export function bindScriptEvents(vm: Cs2Vm, client: ClientImpl, bus: EventBus): () => void {
    const wrap = (event: EngineScriptEvent): ScriptEvent => ({
        getSource: () => event.widget ? client.wrapWidget(event.widget) : null,
        getTarget: () => event.dragTarget ? client.wrapWidget(event.dragTarget) : null,
        getArguments: () => event.args,
        getOp: () => event.opIndex,
        getOpbase: () => event.targetName,
        getMouseX: () => event.mouseX,
        getMouseY: () => event.mouseY,
        getTypedKeyCode: () => event.keyTyped,
        getTypedKeyChar: () => event.keyPressed,
        run: () => { vm.runScriptEvent(event); },
    });
    const pre = (id: number, event: EngineScriptEvent | null) => {
        if (bus.hasSubscribers(ScriptPreFired)) bus.post(new ScriptPreFired(id, event ? wrap(event) : null));
    };
    const post = (id: number) => {
        if (bus.hasSubscribers(ScriptPostFired)) bus.post(new ScriptPostFired(id));
    };
    const callback = (script: EngineScript, eventName: string) => {
        if (bus.hasSubscribers(ScriptCallbackEvent)) bus.post(new ScriptCallbackEvent(new ScriptImpl(script), eventName));
    };
    vm.scriptCallbackListeners.add(callback);
    vm.scriptPreListeners.add(pre);
    vm.scriptPostListeners.add(post);
    return () => { vm.scriptCallbackListeners.delete(callback); vm.scriptPreListeners.delete(pre); vm.scriptPostListeners.delete(post); };
}
