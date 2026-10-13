import { subscribeActorGraphics, subscribeActorHitsplats, subscribeActorHealth } from "../../../game/ActorEventHooks";
import { ArchiveHitSplatTypeLoader } from "../../../rs/config/hitsplat/HitSplatTypeLoader";
import { IndexType } from "../../../rs/cache/IndexType";
import { ConfigType } from "../../../rs/cache/ConfigType";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { ActorDeath } from "../../api/events/ActorDeath";
import { GraphicChanged } from "../../api/events/GraphicChanged";
import { HitsplatApplied } from "../../api/events/HitsplatApplied";
import { Hitsplat } from "../../api/Hitsplat";
export function bindActorEffects(client: ClientImpl, bus: EventBus): { flush(): void; dispose(): void } {
    const pending: object[] = [];
    let definitionCache: object | undefined;
    let definitions: ArchiveHitSplatTypeLoader | undefined;
    const duration = (id: number) => {
        if (id < 0) return 0;
        if (definitionCache !== client.engine.loadedCache) { definitions = undefined; definitionCache = client.engine.loadedCache; }
        if (!definitions && client.engine.loadedCache) {
            const archive = client.engine.cacheSystem.getIndex(IndexType.DAT2.configs).getArchive(ConfigType.OSRS.hitSplat);
            definitions = new ArchiveHitSplatTypeLoader(client.engine.loadedCache.info, archive);
        }
        return definitions?.load(id).displayCycles ?? 70;
    };
    const resolve = (kind: "npc" | "player", id: number) => kind === "npc" ? client.getNpcByIndex(id) : client.getPlayerByIndex(id);
    const ungraphics = subscribeActorGraphics(event => {
        const actor = resolve(event.type, event.serverId);
        if (actor) pending.push(new GraphicChanged(actor));
    });
    const unhits = subscribeActorHitsplats(event => {
        if (!bus.hasSubscribers(HitsplatApplied)) return;
        const actor = resolve(event.targetType, event.targetId);
        if (!actor) return;
        const type = event.style ?? -1;
        const expires = client.getGameCycle() + Math.max(0, event.delayCycles ?? 0) + duration(type);
        pending.push(new HitsplatApplied(actor, new Hitsplat(type, event.damage, expires)));
    });
    const dead = new WeakSet<object>();
    const unhealth = subscribeActorHealth(event => {
        if (event.bar.removed) return;
        const actor = resolve(event.type, event.serverId);
        if (!actor) return;
        actor.setDead(event.bar.health2 === 0);
        if (event.bar.health2 !== 0) { dead.delete(actor); return; }
        if (!dead.has(actor)) { dead.add(actor); pending.push(new ActorDeath(actor)); }
    });
    return {
        flush() { for (const event of pending.splice(0)) bus.post(event); },
        dispose() { ungraphics(); unhits(); unhealth(); pending.length = 0; },
    };
}
