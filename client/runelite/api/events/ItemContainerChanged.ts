import type { ItemContainer } from "../ItemContainer";

export class ItemContainerChanged {
    constructor(private readonly containerId: number, private readonly itemContainer: ItemContainer) {}
    getContainerId(): number { return this.containerId; }
    getItemContainer(): ItemContainer { return this.itemContainer; }
}
