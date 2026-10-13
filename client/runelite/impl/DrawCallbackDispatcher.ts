import { DrawCallbacks } from "../api/hooks/DrawCallbacks";
import type { Client } from "../api/Client";
import type { WorldView } from "../api/WorldView";
import type { WorldViewManager } from "../../game/worldview/WorldViewManager";
import type { WorldView as NativeWorldView } from "../../game/worldview/WorldView";
/** Real scene/frame notifications. Native rasterizer replacement requires an explicit renderer backend. */
export class DrawCallbackDispatcher {
    private callbacks: DrawCallbacks | null = null;
    constructor(private readonly client: Client) { }
    getDrawCallbacks(): DrawCallbacks | null { return this.callbacks; }
    setDrawCallbacks(callbacks: DrawCallbacks | null): void {
        if (callbacks) {
            for (const name of ["loadScene", "swapScene", "loadWorldView"] as const) {
                if ((callbacks as DrawCallbacks & {
                    loadWorldView?: unknown;
                })[name] !== undefined)
                    throw new Error(`DrawCallbacks.${name} requires atomic native scene loading; progressive browser scene streaming does not provide this boundary`);
            }
            const unsupported = ["drawScenePaint", "drawSceneTileModel", "animate", "tileInFrustum", "zoneInFrustum", "preSceneDraw", "postSceneDraw", "drawPass", "drawZoneOpaque", "drawZoneAlpha", "drawDynamic", "drawTemp", "invalidateZone"] as const;
            for (const name of unsupported)
                if (callbacks[name] !== undefined)
                    throw new Error(`DrawCallbacks.${name} requires native rasterizer replacement; this renderer exposes scene/frame callbacks only`);
            if (callbacks.draw.length > 1)
                throw new Error("DrawCallbacks.draw(Renderable) requires native rasterizer replacement");
        }
        this.callbacks = callbacks;
    }
    beforeScene(): void { const c = this.client; this.callbacks?.drawScene?.(c.getCameraFpX(), c.getCameraFpY(), c.getCameraFpZ(), c.getCameraFpPitch(), c.getCameraFpYaw(), c.getPlane()); }
    afterScene(): void { this.callbacks?.postDrawScene?.(); }
    afterFrame(overlayColor: number): void { this.callbacks?.draw(overlayColor); }
    despawnWorldView(view: WorldView): void { this.callbacks?.despawnWorldView?.(view); }
}
/** Native views are still present during this notification, preserving the removed wrapper's identity. */
export function bindDrawCallbackLifecycle(manager: WorldViewManager, client: Client, dispatcher: DrawCallbackDispatcher): () => void {
    const despawn = (native: NativeWorldView) => {
        if (native.isTopLevel())
            return;
        const view = client.getWorldView(native.id);
        if (view)
            dispatcher.despawnWorldView(view);
    };
    manager.viewUnloadedListeners.add(despawn);
    return () => manager.viewUnloadedListeners.delete(despawn);
}
