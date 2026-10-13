import type { VarManager } from "../../../rs/config/vartype/VarManager";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { GrandExchangeOfferChanged } from "../../api/events/GrandExchangeOfferChanged";
import { getGrandExchangeOffers } from "../GrandExchangeOfferImpl";
export function bindMarketEvents(client: ClientImpl, bus: EventBus): { sync(): void; flush(): void; dispose(): void } {
    let vars: VarManager | undefined;
    const dirty = new Set<number>();
    const changed = (id: number) => { if (id >= 7900 && id < 7956) dirty.add(Math.floor((id - 7900) / 7)); };
    const sync = () => { const next = client.engine.varManager; if (next === vars) return; vars?.varpChangeListeners.delete(changed); vars = next; dirty.clear(); vars?.varpChangeListeners.add(changed); };
    return {
        sync,
        flush() { if (!vars) return; const slots = [...dirty]; dirty.clear(); if (!bus.hasSubscribers(GrandExchangeOfferChanged)) return; const offers = getGrandExchangeOffers(vars); for (const slot of slots) bus.post(new GrandExchangeOfferChanged(offers[slot], slot)); },
        dispose() { vars?.varpChangeListeners.delete(changed); dirty.clear(); },
    };
}
