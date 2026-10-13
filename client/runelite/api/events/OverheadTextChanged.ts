import type { Actor } from "../Actor";

export class OverheadTextChanged {
    constructor(private readonly actor: Actor, private readonly overheadText: string) {}
    getActor(): Actor { return this.actor; }
    getOverheadText(): string { return this.overheadText; }
}
