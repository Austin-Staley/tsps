import type { Actor } from "../Actor";
import type { Hitsplat } from "../Hitsplat";
export class HitsplatApplied {
    constructor(private readonly actor: Actor, private readonly hitsplat: Hitsplat) {}
    getActor(): Actor { return this.actor; }
    getHitsplat(): Hitsplat { return this.hitsplat; }
}
