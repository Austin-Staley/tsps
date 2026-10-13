/*
 * Copyright (c) 2016-2017, Adam <Adam@sigterm.info>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// Ported to TypeScript; Canvas2D and browser scheduling replace desktop implementations.
import type { WidgetItem } from "../../../api/widgets/WidgetItem";
import { Graphics2D, Point, Rectangle, Dimension } from "../../../awt";
import { Overlay } from "./Overlay";
import { OverlayManager } from "./OverlayManager";
import { OverlayLayer } from "./OverlayLayer";
import { OverlayPosition } from "./OverlayPosition";
export interface OverlayFrame {
    canvas: Rectangle;
    viewport: Rectangle;
    chatbox?: Rectangle;
}
/** Runs at the engine's real scene/widget/menu boundaries, never flattens layers onto one top canvas. */
export class OverlayRenderer {
    private readonly offsets = new Map<OverlayPosition, number>();
    constructor(private readonly manager: OverlayManager, private readonly onError: (overlay: Overlay, error: unknown) => void = (overlay, error) => console.error(`[Overlay ${overlay.getName()}]`, error)) { }
    beginFrame(): void { this.offsets.clear(); }
    renderLayer(graphics: Graphics2D, layer: OverlayLayer, frame: OverlayFrame): void { this.render(graphics, this.manager.getLayer(layer), frame, layer); }
    renderAfterWidget(graphics: Graphics2D, widgetId: number, frame: OverlayFrame, widgetItems: readonly WidgetItem[] = []): void {
        this.manager.setWidgetItems(widgetItems);
        try {
            this.render(graphics, this.manager.getForHook(widgetId), frame, OverlayLayer.ABOVE_WIDGETS);
        }
        finally {
            this.manager.setWidgetItems([]);
        }
    }
    private render(graphics: Graphics2D, overlays: Overlay[], frame: OverlayFrame, layer: OverlayLayer): void {
        for (const overlay of overlays) {
            const g = graphics.create();
            try {
                g.setFont(this.manager.getFontFor(overlay));
                const position = overlay.getPreferredPosition() ?? overlay.getPosition();
                const dynamic = position === OverlayPosition.DYNAMIC || position === OverlayPosition.DETACHED || position === OverlayPosition.TOOLTIP;
                if (dynamic && (layer === OverlayLayer.ABOVE_SCENE || layer === OverlayLayer.UNDER_WIDGETS))
                    g.clip(frame.viewport);
                const previous = overlay.getBounds(), size = overlay.getPreferredSize() ?? new Dimension(previous.width, previous.height);
                const offset = this.offsets.get(position) ?? 0;
                const point = overlay.getPreferredLocation() ?? (dynamic ? previous.getLocation() : this.snap(position, size, frame, offset));
                if (!dynamic) {
                    const parent = overlay.getParentBounds() ?? frame.canvas;
                    point.x = Math.max(parent.x, Math.min(point.x, parent.getMaxX() - size.width));
                    point.y = Math.max(parent.y, Math.min(point.y, parent.getMaxY() - size.height));
                }
                g.translate(point.x, point.y);
                const rendered = overlay.render(g);
                if (rendered) {
                    overlay.setBounds(new Rectangle(point, rendered));
                    if (!dynamic && !overlay.getPreferredLocation())
                        this.offsets.set(position, offset + rendered.height + 2);
                }
                else
                    overlay.setBounds(new Rectangle(point, new Dimension()));
            }
            catch (error) {
                this.onError(overlay, error);
            }
            finally {
                g.dispose();
            }
        }
    }
    private snap(position: OverlayPosition, size: Dimension, frame: OverlayFrame, offset: number): Point {
        const area = position === OverlayPosition.CANVAS_TOP_RIGHT ? frame.canvas : frame.viewport, margin = 5;
        switch (position) {
            case OverlayPosition.TOP_CENTER: return new Point(area.x + (area.width - size.width) / 2, area.y + margin + offset);
            case OverlayPosition.TOP_RIGHT:
            case OverlayPosition.CANVAS_TOP_RIGHT: return new Point(area.getMaxX() - size.width - margin, area.y + margin + offset);
            case OverlayPosition.BOTTOM_LEFT: return new Point(area.x + margin, area.getMaxY() - size.height - margin - offset);
            case OverlayPosition.BOTTOM_RIGHT: return new Point(area.getMaxX() - size.width - margin, area.getMaxY() - size.height - margin - offset);
            case OverlayPosition.ABOVE_CHATBOX_RIGHT: {
                const chat = frame.chatbox ?? new Rectangle(area.x, area.getMaxY(), area.width, 0);
                return new Point(chat.getMaxX() - size.width - margin, chat.y - size.height - margin - offset);
            }
            default: return new Point(area.x + margin, area.y + margin + offset);
        }
    }
}
