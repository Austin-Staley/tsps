import type { Tile } from "../Tile";
import type { TileItem } from "../TileItem";

export class ItemQuantityChanged {
    constructor(private readonly item: TileItem, private readonly tile: Tile, private readonly oldQuantity: number, private readonly newQuantity: number) {}
    getItem(): TileItem { return this.item; }
    getTile(): Tile { return this.tile; }
    getOldQuantity(): number { return this.oldQuantity; }
    getNewQuantity(): number { return this.newQuantity; }
}
