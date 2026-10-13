import type { Actor } from "../Actor";

export class InteractingChanged {
    constructor(private readonly source: Actor, private readonly target: Actor | null) {}
    getSource(): Actor { return this.source; }
    getTarget(): Actor | null { return this.target; }
}
