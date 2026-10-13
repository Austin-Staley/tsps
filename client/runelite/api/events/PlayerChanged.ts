import type { Player } from "../Player";

export class PlayerChanged {
    constructor(private readonly player: Player) {}
    getPlayer(): Player { return this.player; }
}
