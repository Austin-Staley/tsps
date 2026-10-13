import { Graphics2D, Rectangle } from "../awt";
import type { OsrsClient } from "../../game/OsrsClient";
import type { GLRenderer } from "../../widgets/gl/renderer";
import { OverlayManager } from "../client/ui/overlay/OverlayManager";
import { OverlayRenderer } from "../client/ui/overlay/OverlayRenderer";
import { OverlayLayer } from "../client/ui/overlay/OverlayLayer";
import { getChatboxScreenRect } from "../../widgets/gl/widgetsOverlayFactory";
import type { Client } from "../api/Client";
import type { WidgetItem } from "../api/widgets/WidgetItem";

export function getOverlayFrame(engine: OsrsClient, client: Client) {
    const viewport = (engine.renderer as unknown as { getSceneViewportWidgetRect?(): { x: number; y: number; width: number; height: number } }).getSceneViewportWidgetRect?.();
    const chat = getChatboxScreenRect({ osrsClient: engine });
    return { canvas: new Rectangle(0, 0, client.getCanvasWidth(), client.getCanvasHeight()),
        viewport: viewport ? new Rectangle(viewport.x, viewport.y, viewport.width, viewport.height) : new Rectangle(0, 0, client.getCanvasWidth(), client.getCanvasHeight()),
        chatbox: chat ? new Rectangle(chat.x, chat.y, chat.width, chat.height) : undefined };
}

/** Composites Java2D-style plugins at the native widget renderer's layer boundaries. */
export class OverlayCanvas {
    private canvas?: HTMLCanvasElement;
    private readonly renderer: OverlayRenderer;
    constructor(private readonly engine: OsrsClient, readonly manager: OverlayManager) { this.renderer = new OverlayRenderer(manager); }
    beginFrame() { this.renderer.beginFrame(); }
    draw(gl: GLRenderer, layer: OverlayLayer, widgetId?: number, widgetItems: WidgetItem[] = []) {
        if (!this.engine.isLoggedIn()) return;
        const overlays = widgetId === undefined ? this.manager.getLayer(layer) : this.manager.getForHook(widgetId);
        if (!overlays.length) return;
        const canvas = this.canvas ??= document.createElement("canvas");
        if (canvas.width !== gl.width) canvas.width = gl.width;
        if (canvas.height !== gl.height) canvas.height = gl.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const viewport = (this.engine.renderer as unknown as { getSceneViewportWidgetRect?(): { x: number; y: number; width: number; height: number } }).getSceneViewportWidgetRect?.();
        const chat = getChatboxScreenRect({ osrsClient: this.engine });
        const frame = { canvas: new Rectangle(0, 0, canvas.width, canvas.height),
            viewport: viewport ? new Rectangle(viewport.x, viewport.y, viewport.width, viewport.height) : new Rectangle(0, 0, canvas.width, canvas.height),
            chatbox: chat ? new Rectangle(chat.x, chat.y, chat.width, chat.height) : undefined };
        const graphics = new Graphics2D(ctx);
        try {
            if (widgetId === undefined) this.renderer.renderLayer(graphics, layer, frame);
            else this.renderer.renderAfterWidget(graphics, widgetId, frame, widgetItems);
        } finally { graphics.dispose(); }
        const texture = gl.updateTextureFromCanvas("runelite:overlays", canvas);
        gl.drawTexture(texture, 0, 0, canvas.width, canvas.height);
        gl.flush();
    }
    dispose() { this.canvas = undefined; }
}
