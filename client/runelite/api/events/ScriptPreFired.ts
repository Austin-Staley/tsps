import type { ScriptEvent } from "../ScriptEvent";

export class ScriptPreFired {
    constructor(private readonly scriptId: number, private readonly scriptEvent: ScriptEvent | null) {}
    getScriptId(): number { return this.scriptId; }
    getScriptEvent(): ScriptEvent | null { return this.scriptEvent; }
}
