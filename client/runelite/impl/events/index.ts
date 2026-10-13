import { bindCoreInputEvents, bindSearchEvents } from "./core";
import { bindQueuedChanges } from "./queuedChanges";
import type { OsrsClient } from "../../../game/OsrsClient";
import type { MapManager, MapSquare } from "../../../game/MapManager";
import type { ClientImpl } from "../ClientImpl";
import type { SceneMapData } from "../SceneRegistry";
import type { EventBus } from "../../client/eventbus/EventBus";
import { ClientShutdown } from "../../api/events/ClientShutdown";
import { bindActorEvents } from "./actors";
import { bindActorEffects } from "./effects";
import { bindVarEvents } from "./vars";
import { bindChatEvents } from "./chat";
import { bindContainerEvents } from "./containers";
import { bindGroundItemEvents } from "./groundItems";
import { bindSkillEvents } from "./skills";
import { bindScriptEvents } from "./scripts";
import { bindWidgetEvents } from "./widgets";
import { bindWorldViewEvents } from "./worldViews";
import { bindAudioEvents } from "./audio";
import { bindCacheEvents } from "./cache";
import { bindSocialEvents } from "./social";
import { bindWorldEntityEvents } from "./worldEntities";
import { bindProjectileEvents } from "./projectiles";
import { bindMarketEvents } from "./market";
import { bindSceneEvents } from "./scene";

type SceneSource = MapSquare & SceneMapData & { locDataChangedListeners?: Set<() => void> };
export function bindRuneLiteEvents(engine: OsrsClient, client: ClientImpl, bus: EventBus): { sync(): void; prepareQueued(): () => void; flushQueued(): void; flush(): void; dispose(): void } {
    const queued = bindQueuedChanges(client, bus);
    const market = bindMarketEvents(client, bus);
    const entities = bindWorldEntityEvents(engine.worldViewManager, client, bus);
    const actors = bindActorEvents(engine.npcEcs, engine.playerEcs, client, bus);
    const effects = bindActorEffects(client, bus);
    const disposers = [
        bindCoreInputEvents(bus),
        bindProjectileEvents(client, bus), bindSocialEvents(client.socialState, bus), bindCacheEvents(client, bus), bindChatEvents(bus), bindGroundItemEvents(engine.groundItems, client, bus),
        bindSkillEvents(bus), bindWorldViewEvents(engine.worldViewManager, client, bus),
    ];
    const stores = new Map<string, { source: object; dispose(): void }>();
    const track = <T extends object>(key: string, source: T | undefined, bind: (source: T) => () => void) => {
        if (!source) { stores.get(key)?.dispose(); stores.delete(key); return; }
        if (stores.get(key)?.source === source) return;
        stores.get(key)?.dispose();
        stores.set(key, { source, dispose: bind(source) });
    };
    const sync = () => {
        market.sync();
        track("audio", engine.soundEffectSystem, source => bindAudioEvents(source, client, bus));
        track("vars", engine.varManager, source => bindVarEvents(source, bus));
        track("widgets", engine.widgetManager, source => bindWidgetEvents(source, bus));
        track("scripts", engine.cs2Vm, source => {
            const uncontainers = bindContainerEvents(source, bus);
            const unscripts = bindScriptEvents(source, client, bus);
            const unsearch = bindSearchEvents(source, bus);
            return () => { uncontainers(); unscripts(); unsearch(); };
        });
    };
    sync();
    let sceneManager: MapManager<SceneSource> | undefined;
    let disposeScene: (() => void) | undefined;
    const shutdown = () => bus.post(new ClientShutdown());
    if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", shutdown);
        disposers.push(() => window.removeEventListener("beforeunload", shutdown));
    }
    return {
        sync,
        prepareQueued: () => queued.prepare(),
        flushQueued: () => queued.flush(),
        flush() {
            const manager = engine.renderer?.mapManager as MapManager<SceneSource> | undefined;
            if (manager !== sceneManager) {
                disposeScene?.();
                sceneManager = manager;
                disposeScene = manager ? bindSceneEvents(manager, client, bus) : undefined;
            }
            actors.flush(); effects.flush(); entities.flush(); market.flush();
        },
        dispose() { queued.dispose(); market.dispose(); entities.dispose(); actors.dispose(); effects.dispose(); disposeScene?.(); for (const dispose of disposers) dispose(); for (const store of stores.values()) store.dispose(); stores.clear(); },
    };
}
