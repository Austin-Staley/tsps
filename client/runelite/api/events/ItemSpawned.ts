import type { Tile } from "../Tile";
import type { TileItem } from "../TileItem";

export class ItemSpawned {
    constructor(private readonly tile: Tile, private readonly item: TileItem) {}
    getTile(): Tile { return this.tile; }
    getItem(): TileItem { return this.item; }
}
