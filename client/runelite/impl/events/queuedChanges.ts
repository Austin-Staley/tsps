import { markStatTransmit, markVarTransmit } from "../../../game/TransmitCycles";
import { Skill } from "../../api/Skill";
import { StatChanged, VarbitChanged } from "../../api/events";
import type { EventBus } from "../../client/eventbus/EventBus";
import type { ClientImpl } from "../ClientImpl";
const skillListeners = new Set<(id: Skill) => void>();
const varpListeners = new Set<(id: number) => void>();
/** Native changed rings also wake CS2 onStatTransmit/onVarTransmit listeners. */
export function queueChangedSkill(skill: Skill): void {
    if (!Number.isInteger(skill) || skill < 0 || skill > Skill.SAILING) throw new RangeError("Invalid skill ID");
    markStatTransmit(skill);
    for (const listener of skillListeners) listener(skill);
}
export function queueChangedVarp(id: number): void {
    if (!Number.isInteger(id) || id < 0) throw new RangeError("Invalid varp ID");
    markVarTransmit(id);
    for (const listener of varpListeners) listener(id);
}
/** Flush at the beginning of a client tick. Changes queued by subscribers wait another tick. */
export function bindQueuedChanges(client: ClientImpl, bus: EventBus): { prepare(): () => void; flush(): void; dispose(): void } {
    const skills: Skill[] = [], varps: number[] = [];
    const skill = (id: Skill) => { skills.push(id); };
    const varp = (id: number) => { varps.push(id); };
    skillListeners.add(skill); varpListeners.add(varp);
    let disposed = false;
    const prepare = () => {
        const nextSkills = skills.splice(0), nextVarps = varps.splice(0);
        return () => {
            if (disposed) return;
            for (const id of nextVarps) { if (disposed) return; bus.post(new VarbitChanged(id, -1, client.getVarpValue(id))); }
            for (const id of nextSkills) { if (disposed) return; bus.post(new StatChanged(id, client.getSkillExperience(id), client.getRealSkillLevel(id), client.getBoostedSkillLevel(id))); }
        };
    };
    return {
        prepare,
        flush() { prepare()(); },
        dispose() { disposed = true; skillListeners.delete(skill); varpListeners.delete(varp); skills.length = 0; varps.length = 0; },
    };
}
