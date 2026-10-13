import type { Actor } from "../Actor";

export class GraphicChanged {
    constructor(private readonly actor: Actor) {}
    getActor(): Actor { return this.actor; }
}
