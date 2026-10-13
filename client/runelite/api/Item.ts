export class Item {
    constructor(private readonly id: number, private readonly quantity: number) {}
    getId(): number { return this.id; }
    getQuantity(): number { return this.quantity; }
}
