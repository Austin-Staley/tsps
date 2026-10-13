import type { MapManager, MapSquare } from "../../../game/MapManager";
import type { ClientImpl } from "../ClientImpl";
import type { SceneMapData, SceneObjectChange } from "../SceneRegistry";
import type { EventBus } from "../../client/eventbus/EventBus";
import { PreMapLoad, DecorativeObjectDespawned, DecorativeObjectSpawned, GameObjectDespawned, GameObjectSpawned, GroundObjectDespawned, GroundObjectSpawned, WallObjectDespawned, WallObjectSpawned } from "../../api/events";

type SceneSource = MapSquare & SceneMapData & { locDataChangedListeners?: Set<() => void> };
const classes = {
    GameObject: [GameObjectDespawned, GameObjectSpawned],
    WallObject: [WallObjectDespawned, WallObjectSpawned],
    GroundObject: [GroundObjectDespawned, GroundObjectSpawned],
    DecorativeObject: [DecorativeObjectDespawned, DecorativeObjectSpawned],
} as const;
/** Only scans loc CSR after a map load or geometry update, never each client cycle. */
export function bindSceneEvents(manager: MapManager<SceneSource>, client: ClientImpl, bus: EventBus): () => void {
    const pending = new Map<SceneSource, SceneObjectChange[]>();
    const needsObjects = (map: SceneSource) => client.sceneRegistry.hasMap(map) ||
        Object.values(classes).some(events => events.some(event => bus.hasSubscribers(event)));
    const preloaded = (map: SceneSource) => {
        if (bus.hasSubscribers(PreMapLoad) || needsObjects(map)) pending.set(map, client.sceneRegistry.update(map));
        if (!bus.hasSubscribers(PreMapLoad)) return;
        const id = client.engine.worldViewManager.getWorldViewByOverlayMapId(map.id ?? -1)?.id ?? -1;
        const view = client.getWorldView(id);
        if (view) bus.post(new PreMapLoad(view, view.getScene()));
    };
    const subscriptions = new Map<SceneSource, () => void>();
    const dispatch = (changes: SceneObjectChange[]) => {
        for (const change of changes) {
            const object = change.object;
            const Event = classes[change.kind][Number(change.spawned)];
            if (bus.hasSubscribers(Event)) {
                const tile = client.getSceneTile(object.x, object.y, object.plane, object.viewId);
                bus.post(new Event(tile, object));
            }
        }
    };
    const added = (map: SceneSource, replaced?: SceneSource) => {
        if (replaced && replaced !== map) { subscriptions.get(replaced)?.(); subscriptions.delete(replaced); }
        const staged = pending.get(map);
        // A PreMapLoad subscriber can query the still-resident prior map through the facade,
        // restoring its registry entry. Commit the incoming source again before spawn dispatch.
        const changes = client.sceneRegistry.hasMap(map)
            ? staged ?? []
            : staged || needsObjects(map) ? client.sceneRegistry.update(map) : [];
        dispatch(changes);
        pending.delete(map);
        if (subscriptions.has(map)) return;
        const changed = () => { if (needsObjects(map)) dispatch(client.sceneRegistry.update(map)); };
        map.locDataChangedListeners?.add(changed);
        subscriptions.set(map, () => map.locDataChangedListeners?.delete(changed));
    };
    const removed = (map: SceneSource) => {
        subscriptions.get(map)?.(); subscriptions.delete(map);
        dispatch(client.sceneRegistry.remove(map));
    };
    manager.preMapLoadListeners.add(preloaded);
    manager.mapAddedListeners.add(added);
    manager.mapRemovedListeners.add(removed);
    for (const map of manager.mapSquares.values()) added(map);
    return () => {
        manager.preMapLoadListeners.delete(preloaded);
        pending.clear();
        manager.mapAddedListeners.delete(added);
        manager.mapRemovedListeners.delete(removed);
        for (const dispose of subscriptions.values()) dispose();
        subscriptions.clear();
        client.sceneRegistry.reset();
    };
}
