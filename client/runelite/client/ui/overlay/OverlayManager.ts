/*
 * Copyright (c) 2018, Tomas Slusny <slusnucky@gmail.com>
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
import { Point, Dimension, type Font } from "../../../awt";
import { FontType } from "../../config/FontType";
import { RuneLiteConfig } from "../../config/RuneLiteConfig";
import { ConfigManager } from "../../config/ConfigManager";
import { WidgetItemOverlay } from "./WidgetItemOverlay";
import { Overlay } from "./Overlay";
import { OverlayLayer } from "./OverlayLayer";
import { OverlayPosition } from "./OverlayPosition";
export class OverlayManager {
    private widgetItems: readonly WidgetItem[] = [];
    getWidgetItems(): readonly WidgetItem[] { return this.widgetItems; }
    setWidgetItems(items: readonly WidgetItem[]): void { this.widgetItems = items; }
    private readonly overlays = new Set<Overlay>();
    constructor(private readonly config?: ConfigManager) { }
    add(overlay: Overlay): boolean {
        if (this.overlays.has(overlay))
            return false;
        this.loadOverlay(overlay);
        if (overlay instanceof WidgetItemOverlay)
            overlay.setOverlayManager(this);
        this.overlays.add(overlay);
        return true;
    }
    remove(overlay: Overlay): boolean { return this.overlays.delete(overlay); }
    removeIf(predicate: (overlay: Overlay) => boolean): boolean {
        let removed = false;
        for (const overlay of this.overlays)
            if (predicate(overlay)) {
                this.overlays.delete(overlay);
                removed = true;
            }
        return removed;
    }
    anyMatch(predicate: (overlay: Overlay) => boolean): boolean { return [...this.overlays].some(predicate); }
    getOverlays(): readonly Overlay[] { return [...this.overlays]; }
    getLayer(layer: OverlayLayer): Overlay[] { return this.sort([...this.overlays].filter(overlay => this.effectiveLayer(overlay) === layer)); }
    getForHook(widgetId: number): Overlay[] { return this.sort([...this.overlays].filter(overlay => overlay.getDrawHooks().includes(widgetId))); }
    getFontFor(overlay: Overlay): Font { const config = this.config?.getConfig(RuneLiteConfig), position = overlay.getPosition(); const type = position === OverlayPosition.TOOLTIP ? config?.tooltipFont() : position === OverlayPosition.DYNAMIC || position === OverlayPosition.DETACHED ? config?.dynamicOverlayFont() : config?.interfaceFont(); return (type ?? (position === OverlayPosition.DYNAMIC || position === OverlayPosition.DETACHED || position === OverlayPosition.TOOLTIP ? FontType.SMALL : FontType.REGULAR)).getFont(); }
    clear(): void { this.overlays.clear(); }
    resetOverlay(overlay: Overlay): void {
        overlay.reset();
        this.saveOverlay(overlay);
        for (const item of this.overlays)
            item.revalidate();
    }
    saveOverlay(overlay: Overlay): void {
        const name = overlay.getName(), location = overlay.getPreferredLocation(), size = overlay.getPreferredSize(), position = overlay.getPreferredPosition();
        const save = (key: string, value: string | null) => {
            if (value === null)
                this.config?.unsetConfiguration("runelite", name + key);
            else
                this.config?.setConfiguration("runelite", name + key, value);
        };
        save("_preferredLocation", location ? `${Math.round(location.x)}:${Math.round(location.y)}` : null);
        save("_preferredSize", size ? `${Math.round(size.width)}x${Math.round(size.height)}` : null);
        save("_preferredPosition", position === null ? null : OverlayPosition[position]);
    }
    private loadOverlay(overlay: Overlay): void {
        const read = (key: string) => this.config?.getConfiguration("runelite", overlay.getName() + key);
        const location = /^(-?\d+):(-?\d+)$/.exec(read("_preferredLocation") ?? "");
        if (location && Number.isFinite(Number(location[1])) && Number.isFinite(Number(location[2])))
            overlay.setPreferredLocation(new Point(Number(location[1]), Number(location[2])));
        const size = /^(\d+)x(\d+)$/.exec(read("_preferredSize") ?? "");
        if (size && Number(size[1]) > 0 && Number(size[2]) > 0 && Number.isFinite(Number(size[1])) && Number.isFinite(Number(size[2])))
            overlay.setPreferredSize(new Dimension(Number(size[1]), Number(size[2])));
        const position = read("_preferredPosition");
        if (position && typeof OverlayPosition[position as keyof typeof OverlayPosition] === "number")
            overlay.setPreferredPosition(OverlayPosition[position as keyof typeof OverlayPosition] as OverlayPosition);
    }
    private effectiveLayer(overlay: Overlay): OverlayLayer { return overlay.getLayer() === OverlayLayer.UNDER_WIDGETS && overlay.getPreferredLocation() && overlay.getPreferredPosition() === null ? OverlayLayer.ABOVE_WIDGETS : overlay.getLayer(); }
    private sort(overlays: Overlay[]): Overlay[] { return overlays.sort((a, b) => { const ap = a.getPreferredPosition() ?? a.getPosition(), bp = b.getPreferredPosition() ?? b.getPosition(); return ap - bp || ((ap === OverlayPosition.DYNAMIC || ap === OverlayPosition.DETACHED) ? a.getPriority() - b.getPriority() : b.getPriority() - a.getPriority()); }); }
}
