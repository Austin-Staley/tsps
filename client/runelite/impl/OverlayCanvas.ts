import { Graphics2D, Rectangle } from "../awt";
import type { OsrsClient } from "../../game/OsrsClient";
import type { GLRenderer } from "../../widgets/gl/renderer";
import { OverlayManager } from "../client/ui/overlay/OverlayManager";
import { OverlayRenderer } from "../client/ui/overlay/OverlayRenderer";
import { OverlayLayer } from "../client/ui/overlay/OverlayLayer";
import { getChatboxScreenRect } from "../../widgets/gl/widgetsOverlayFactory";
import type { Client } from "../api/Client";
import type { WidgetItem } from "../api/widgets/WidgetItem";

const PAINT_METHODS = new Set(["fill", "stroke", "fillRect", "strokeRect", "fillText", "strokeText", "drawImage", "putImageData"]);

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
    private readonly layers = new Map<OverlayLayer, { canvas: HTMLCanvasElement; active: boolean; bounds?: Rectangle }>();
    private readonly renderer: OverlayRenderer;
    constructor(private readonly engine: OsrsClient, readonly manager: OverlayManager) { this.renderer = new OverlayRenderer(manager); }
    beginFrame() {
        this.renderer.beginFrame();
        for (const layer of this.layers.values()) layer.active = false;
    }
    prepare(gl: GLRenderer): { x: number; y: number; w: number; h: number }[] {
        const rects: { x: number; y: number; w: number; h: number }[] = [];
        if (!this.engine.isLoggedIn()) return rects;
        for (const layer of [OverlayLayer.ABOVE_SCENE, OverlayLayer.UNDER_WIDGETS, OverlayLayer.ABOVE_WIDGETS, OverlayLayer.ALWAYS_ON_TOP]) {
            const overlays = this.manager.getLayer(layer);
            if (!overlays.length) continue;
            let cached = this.layers.get(layer);
            if (!cached) this.layers.set(layer, cached = { canvas: document.createElement("canvas"), active: false });
            const canvas = cached.canvas;
            if (canvas.width !== gl.width) canvas.width = gl.width;
            if (canvas.height !== gl.height) canvas.height = gl.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let painted = false;
            let unbounded = false;
            const tracked = new Proxy(ctx, {
                get(target, key) {
                    const value = Reflect.get(target, key, target);
                    if (typeof value !== "function") return value;
                    return (...args: unknown[]) => { if (PAINT_METHODS.has(String(key))) painted = true; return value.apply(target, args); };
                },
                set(target, key, value) { return Reflect.set(target, key, value, target); },
            });
            const graphics = new Graphics2D(tracked);
            try { this.renderer.renderLayer(graphics, layer, getOverlayFrame(this.engine, this.engine.runeLite.clientApi), overlay => {
                const bounds = overlay.getBounds();
                if (painted && (bounds.width <= 0 || bounds.height <= 0)) unbounded = true;
                painted = false;
            }); }
            finally { graphics.dispose(); }
            let currentBounds: Rectangle | undefined;
            for (const overlay of overlays) {
                const bounds = overlay.getBounds();
                if (bounds.width <= 0 || bounds.height <= 0) continue;
                cached.active = true;
                const rect = new Rectangle(Math.floor(bounds.x) - 1, Math.floor(bounds.y) - 1,
                    Math.ceil(bounds.width) + 2, Math.ceil(bounds.height) + 2);
                currentBounds = currentBounds ? currentBounds.union(rect) : rect;
                rects.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
            }
            // shortcut: overlays that paint without reporting bounds redraw their layer's canvas; upgrade to measured damage if common.
            if (unbounded) {
                cached.active = true;
                currentBounds = new Rectangle(0, 0, gl.width, gl.height);
                rects.push({ x: 0, y: 0, w: gl.width, h: gl.height });
            }
            if (cached.active && currentBounds) {
                // Include old pixels so moved or removed overlays are erased from the retained texture.
                const damage = cached.bounds ? cached.bounds.union(currentBounds) : currentBounds;
                gl.updateTextureFromCanvas(`runelite:layer:${layer}`, canvas, { x: damage.x, y: damage.y, w: damage.width, h: damage.height });
                cached.bounds = currentBounds;
            }
        }
        return rects;
    }
    draw(gl: GLRenderer, layer: OverlayLayer, widgetId?: number, widgetItems: WidgetItem[] = [], clip?: { x: number; y: number; w: number; h: number }) {
        if (!this.engine.isLoggedIn()) return;
        if (widgetId === undefined) {
            const cached = this.layers.get(layer), texture = gl.textures.get(`runelite:layer:${layer}`);
            if (!cached?.active || !texture) return;
            gl.flush();
            const context = gl.gl, scissor = context.getParameter(context.SCISSOR_BOX) as Int32Array;
            const enabled = context.isEnabled(context.SCISSOR_TEST);
            if (clip) { context.enable(context.SCISSOR_TEST); context.scissor(clip.x, gl.height - clip.y - clip.h, clip.w, clip.h); }
            try { gl.drawTexture(texture, 0, 0, gl.width, gl.height); gl.flush(); }
            finally { context.scissor(scissor[0], scissor[1], scissor[2], scissor[3]); if (!enabled) context.disable(context.SCISSOR_TEST); }
            return;
        }
        const overlays = this.manager.getForHook(widgetId);
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
            this.renderer.renderAfterWidget(graphics, widgetId, frame, widgetItems);
        } finally { graphics.dispose(); }
        const texture = gl.updateTextureFromCanvas("runelite:overlays", canvas);
        gl.drawTexture(texture, 0, 0, canvas.width, canvas.height);
        gl.flush();
    }
    dispose() { this.canvas = undefined; this.layers.clear(); }
}
