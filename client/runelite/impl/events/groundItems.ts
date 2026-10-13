import type { GroundItemStore, GroundItemMutation } from "../../../game/data/ground/GroundItemStore";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { ItemDespawned, ItemQuantityChanged, ItemSpawned } from "../../api/events";
export function bindGroundItemEvents(store: GroundItemStore, client: ClientImpl, bus: EventBus): () => void {
    const items = client.groundItemWrappers;
    const changed = (event: GroundItemMutation) => {
        const stack = event.stack;
        let item = items.get(stack.id);
        if (!item) item = client.wrapGroundItem(stack);
        const tile = client.getSceneTile(stack.tile.x, stack.tile.y, stack.tile.level);
        switch (event.kind) {
            case "spawn": bus.post(new ItemSpawned(tile, item)); break;
            case "despawn": items.delete(stack.id); bus.post(new ItemDespawned(tile, item)); break;
            case "quantity": item.setQuantity(stack.quantity); bus.post(new ItemQuantityChanged(item, tile, event.oldQuantity!, stack.quantity)); break;
        }
    };
    for (const stack of store.getAllStacks()) client.wrapGroundItem(stack);
    store.mutationListeners.add(changed);
    return () => { store.mutationListeners.delete(changed); items.clear(); };
}
