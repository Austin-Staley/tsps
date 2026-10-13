import type { GrandExchangeOffer } from "../GrandExchangeOffer";
export class GrandExchangeOfferChanged {
    constructor(private offer: GrandExchangeOffer, private slot: number) {}
    getOffer(): GrandExchangeOffer { return this.offer; } setOffer(value: GrandExchangeOffer): void { this.offer = value; }
    getSlot(): number { return this.slot; } setSlot(value: number): void { this.slot = value; }
}
