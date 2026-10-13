import type { Script } from "../Script";
export class ScriptCallbackEvent {
    constructor(private script: Script, private eventName: string) {}
    getScript(): Script { return this.script; }
    setScript(value: Script): void { this.script = value; }
    getEventName(): string { return this.eventName; }
    setEventName(value: string): void { this.eventName = value; }
}
