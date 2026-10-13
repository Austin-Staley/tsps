import type { VarManager } from "../../rs/config/vartype/VarManager";
import type { GrandExchangeOffer } from "../api/GrandExchangeOffer";
import { GrandExchangeOfferState as State } from "../api/GrandExchangeOfferState";
/** Matches the same native offer fields read by CS2's stockmarket opcodes. */
export class GrandExchangeOfferImpl implements GrandExchangeOffer {
    constructor(private readonly fields: readonly number[]) {}
    getQuantitySold(): number { return this.fields[2]; } getItemId(): number { return this.fields[6]; }
    getTotalQuantity(): number { return this.fields[1]; } getPrice(): number { return this.fields[0]; } getSpent(): number { return this.fields[3]; }
    getState(): State {
        const sell = this.fields[4] === 1, status = this.fields[5];
        if (status === 0) return State.EMPTY;
        if (status !== 5) return sell ? State.SELLING : State.BUYING;
        if (this.getQuantitySold() >= this.getTotalQuantity()) return sell ? State.SOLD : State.BOUGHT;
        return sell ? State.CANCELLED_SELL : State.CANCELLED_BUY;
    }
}
const caches = new WeakMap<VarManager, { fields: number[][]; offers: GrandExchangeOfferImpl[] }>();
export function getGrandExchangeOffers(vars: VarManager): GrandExchangeOfferImpl[] {
    let cache = caches.get(vars);
    if (!cache) { cache = { fields: [], offers: [] }; caches.set(vars, cache); }
    for (let slot = 0; slot < 8; slot++) {
        const fields = Array.from({ length: 7 }, (_, offset) => vars.getVarp(7900 + slot * 7 + offset));
        if (fields.every((value, offset) => value === cache!.fields[slot]?.[offset])) continue;
        cache.fields[slot] = fields; cache.offers[slot] = new GrandExchangeOfferImpl(fields);
    }
    return cache.offers.slice();
}
