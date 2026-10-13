export class TileItem {
    constructor(private readonly id: number, private quantity: number) {}
    getId(): number { return this.id; } getQuantity(): number { return this.quantity; }
    setQuantity(quantity:number):void { this.quantity = quantity; }
}
