import { Inventory } from "../../../rs/inventory/Inventory";
import type { Cs2Vm } from "../../../rs/cs2/Cs2Vm";
import { Item } from "../../api/Item";
import { ItemContainer } from "../../api/ItemContainer";
import { ItemContainerChanged } from "../../api/events";
import type { EventBus } from "../../client/eventbus/EventBus";
export function bindContainerEvents(vm: Cs2Vm, bus: EventBus): () => void {
    const changed = (inventory: Inventory) => {
        if (!bus.hasSubscribers(ItemContainerChanged)) return;
        for (const [id, source] of vm.context.inventories ?? []) {
            if (source !== inventory) continue;
            const items = source.getSlots().map(slot => new Item(slot.itemId, slot.quantity));
            bus.post(new ItemContainerChanged(id, new ItemContainer(id, items)));
        }
    };
    Inventory.changeListeners.add(changed);
    return () => Inventory.changeListeners.delete(changed);
}
