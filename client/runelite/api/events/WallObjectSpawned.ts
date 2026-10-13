import type { Tile } from "../Tile";
import type { WallObject } from "../WallObject";

export class WallObjectSpawned {
    constructor(private readonly tile: Tile, private readonly wallObject: WallObject) {}
    getTile(): Tile { return this.tile; }
    getWallObject(): WallObject { return this.wallObject; }
}
