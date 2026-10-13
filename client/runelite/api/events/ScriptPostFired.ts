
export class ScriptPostFired {
    constructor(private readonly scriptId: number) {}
    getScriptId(): number { return this.scriptId; }
}
