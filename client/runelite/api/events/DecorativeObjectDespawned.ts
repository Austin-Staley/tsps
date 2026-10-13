import type { DecorativeObject } from "../DecorativeObject";
import type { Tile } from "../Tile";

export class DecorativeObjectDespawned {
    constructor(private readonly tile: Tile, private readonly decorativeObject: DecorativeObject) {}
    getTile(): Tile { return this.tile; }
    getDecorativeObject(): DecorativeObject { return this.decorativeObject; }
}
