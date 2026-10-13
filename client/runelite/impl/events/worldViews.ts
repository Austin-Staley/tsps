import type { WorldViewManager } from "../../../game/worldview/WorldViewManager";
import type { WorldView as EngineWorldView } from "../../../game/worldview/WorldView";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { WorldViewLoaded, WorldViewUnloaded } from "../../api/events";
export function bindWorldViewEvents(manager: WorldViewManager, client: ClientImpl, bus: EventBus): () => void {
    const loaded = (view: EngineWorldView) => {
        const wrapper = client.getWorldView(view.id);
        if (wrapper) bus.post(new WorldViewLoaded(wrapper));
    };
    const unloaded = (view: EngineWorldView) => {
        const wrapper = client.getWorldView(view.id);
        if (wrapper) bus.post(new WorldViewUnloaded(wrapper));
    };
    manager.viewLoadedListeners.add(loaded);
    manager.viewUnloadedListeners.add(unloaded);
    return () => { manager.viewLoadedListeners.delete(loaded); manager.viewUnloadedListeners.delete(unloaded); };
}
