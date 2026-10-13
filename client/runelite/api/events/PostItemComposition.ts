import type { ItemComposition } from "../ItemComposition";
export class PostItemComposition {
    constructor(private readonly itemComposition: ItemComposition) {}
    getItemComposition(): ItemComposition { return this.itemComposition; }
}
