import type { GroundObject } from "../GroundObject";
import type { Tile } from "../Tile";

export class GroundObjectDespawned {
    constructor(private readonly tile: Tile, private readonly groundObject: GroundObject) {}
    getTile(): Tile { return this.tile; }
    getGroundObject(): GroundObject { return this.groundObject; }
}
