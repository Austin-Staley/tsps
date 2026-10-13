import type { Actor } from "../Actor";

export class AnimationChanged {
    constructor(private readonly actor: Actor) {}
    getActor(): Actor { return this.actor; }
}
