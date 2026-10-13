import type { GrandExchangeOfferState } from "./GrandExchangeOfferState";
export interface GrandExchangeOffer {
    getQuantitySold(): number; getItemId(): number; getTotalQuantity(): number;
    getPrice(): number; getSpent(): number; getState(): GrandExchangeOfferState;
}
