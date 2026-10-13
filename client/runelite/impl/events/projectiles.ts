import { Projectile as NativeProjectile } from "../../../render/projectiles/Projectile";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { ProjectileMoved } from "../../api/events/ProjectileMoved";
export function bindProjectileEvents(client: ClientImpl, bus: EventBus): () => void {
    const moved = (source: NativeProjectile) => {
        if (!bus.hasSubscribers(ProjectileMoved)) return;
        const wrapper = client.wrapProjectile(source);
        bus.post(new ProjectileMoved(wrapper, wrapper.getTarget(), source.getTarget().z));
    };
    NativeProjectile.destinationListeners.add(moved);
    return () => NativeProjectile.destinationListeners.delete(moved);
}
