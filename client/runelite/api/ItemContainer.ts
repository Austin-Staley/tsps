import { Item } from "./Item";
/** Immutable snapshot: event handlers may safely retain a previous container. */
export class ItemContainer {
    constructor(private readonly id: number, private readonly items: readonly Item[]) {}
    getId(): number { return this.id; }
    getItems(): Item[] { return this.items.slice(); }
    getItem(slot: number): Item | null { const item = this.items[slot]; return item && item.getId() !== -1 ? item : null; }
    count(itemId?: number): number { return this.items.reduce((sum, item) => sum + (itemId === undefined ? Number(item.getId() !== -1) : item.getId() === itemId ? item.getQuantity() : 0), 0); }
    contains(itemId: number): boolean { return this.items.some(item => item.getId() === itemId); }
    size(): number { return this.items.length; }
    find(itemId:number):number { return this.items.findIndex(i=>i.getId()===itemId); }
}
