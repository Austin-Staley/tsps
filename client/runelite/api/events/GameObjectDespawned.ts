import type { GameObject } from "../GameObject";
import type { Tile } from "../Tile";

export class GameObjectDespawned {
    constructor(private readonly tile: Tile, private readonly gameObject: GameObject) {}
    getTile(): Tile { return this.tile; }
    getGameObject(): GameObject { return this.gameObject; }
}
