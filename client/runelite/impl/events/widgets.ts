import type { WidgetManager } from "../../../widgets/WidgetManager";
import { WidgetLoaded, WidgetClosed } from "../../api/events";
import type { EventBus } from "../../client/eventbus/EventBus";
export function bindWidgetEvents(manager: WidgetManager, bus: EventBus): () => void {
    const loaded = (id: number) => bus.post(new WidgetLoaded(id));
    const closed = (id: number, modal: number, unload: boolean) => bus.post(new WidgetClosed(id, modal, unload));
    manager.groupLoadedListeners.add(loaded);
    manager.interfaceClosedListeners.add(closed);
    return () => {
        manager.groupLoadedListeners.delete(loaded);
        manager.interfaceClosedListeners.delete(closed);
    };
}
