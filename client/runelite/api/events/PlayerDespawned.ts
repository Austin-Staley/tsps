import type { Player } from "../Player";

export class PlayerDespawned {
    constructor(private readonly player: Player) {}
    getPlayer(): Player { return this.player; }
    getActor(): Player { return this.player; }
}
