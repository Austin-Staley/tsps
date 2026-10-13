import { BIT_MASKS } from "../../../rs/MathConstants";
import type { VarManager, CustomVarbitDef } from "../../../rs/config/vartype/VarManager";
import { VarbitChanged, VarClientIntChanged, VarClientStrChanged } from "../../api/events";
import type { EventBus } from "../../client/eventbus/EventBus";

export function bindVarEvents(vars: VarManager, bus: EventBus): () => void {
    let reverseIndex: Map<number, Array<CustomVarbitDef & { id: number }>> | undefined;
    let customCount = -1;
    const index = () => {
        if (reverseIndex && customCount === vars.varbitDefinitionRevision) return reverseIndex;
        const byId = new Map<number, CustomVarbitDef>();
        const count = vars.varbitLoader.getCount();
        for (let id = 0; id < count; id++) {
            const definition = vars.varbitLoader.load(id);
            if (definition && Number.isInteger(definition.baseVar)) byId.set(id, definition);
        }
        for (const [id, definition] of vars.customVarbits) {
            if (!byId.has(id)) byId.set(id, definition);
        }
        const byVarp = new Map<number, Array<CustomVarbitDef & { id: number }>>();
        for (const [id, definition] of byId) {
            const entries = byVarp.get(definition.baseVar) ?? [];
            entries.push({ ...definition, id });
            byVarp.set(definition.baseVar, entries);
        }
        reverseIndex = byVarp;
        customCount = vars.varbitDefinitionRevision;
        return byVarp;
    };
    const onVarp = (id: number, old: number, value: number) => {
        if (!bus.hasSubscribers(VarbitChanged)) return;
        bus.post(new VarbitChanged(id, -1, value));
        for (const definition of index().get(id) ?? []) {
            const mask = BIT_MASKS[definition.endBit - definition.startBit];
            const previous = (old >> definition.startBit) & mask;
            const next = (value >> definition.startBit) & mask;
            if (previous !== next) bus.post(new VarbitChanged(id, definition.id, next));
        }
    };
    const onInt = (id: number) => bus.post(new VarClientIntChanged(id));
    const onStr = (id: number) => bus.post(new VarClientStrChanged(id));
    vars.varpChangeListeners.add(onVarp);
    vars.varcIntChangeListeners.add(onInt);
    vars.varcStringChangeListeners.add(onStr);
    return () => {
        vars.varpChangeListeners.delete(onVarp);
        vars.varcIntChangeListeners.delete(onInt);
        vars.varcStringChangeListeners.delete(onStr);
    };
}
