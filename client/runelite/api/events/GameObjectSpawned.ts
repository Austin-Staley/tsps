import type { GameObject } from "../GameObject";
import type { Tile } from "../Tile";

export class GameObjectSpawned {
    constructor(private readonly tile: Tile, private readonly gameObject: GameObject) {}
    getTile(): Tile { return this.tile; }
    getGameObject(): GameObject { return this.gameObject; }
}
