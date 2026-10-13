import type { Script as EngineScript } from "../../rs/cs2/Script";
import type { Script } from "../api/Script";
export class ScriptImpl implements Script {
    constructor(private readonly script: EngineScript) {}
    getIntOperands(): Int32Array { return this.script.intOperands; }
    getInstructions(): Int32Array { return this.script.instructions; }
}
