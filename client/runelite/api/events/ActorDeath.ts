import type { Actor } from "../Actor";

export class ActorDeath {
    constructor(private readonly actor: Actor) {}
    getActor(): Actor { return this.actor; }
}
