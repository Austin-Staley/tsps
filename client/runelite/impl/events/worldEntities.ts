import type { WorldViewManager } from "../../../game/worldview/WorldViewManager";
import type { WorldEntity as EngineWorldEntity } from "../../../game/worldview/WorldEntity";
import type { ClientImpl } from "../ClientImpl";
import { WorldEntityImpl } from "../WorldEntityImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { WorldEntitySpawned, WorldEntityDespawned } from "../../api/events";
export function bindWorldEntityEvents(manager: WorldViewManager, client: ClientImpl, bus: EventBus): { flush(): void; dispose(): void } {
    const pending: object[] = [], wrappers = new WeakMap<EngineWorldEntity, WorldEntityImpl>();
    const wrap = (entity: EngineWorldEntity) => { let wrapper = wrappers.get(entity); if (!wrapper) { wrapper = new WorldEntityImpl(client, entity); wrappers.set(entity, wrapper); } return wrapper; };
    const loaded = (entity: EngineWorldEntity) => pending.push(new WorldEntitySpawned(wrap(entity)));
    const unloaded = (entity: EngineWorldEntity) => pending.push(new WorldEntityDespawned(wrap(entity)));
    manager.entityLoadedListeners.add(loaded); manager.entityUnloadedListeners.add(unloaded);
    return {
        flush() { for (const event of pending.splice(0)) bus.post(event); },
        dispose() { manager.entityLoadedListeners.delete(loaded); manager.entityUnloadedListeners.delete(unloaded); pending.length = 0; },
    };
}
