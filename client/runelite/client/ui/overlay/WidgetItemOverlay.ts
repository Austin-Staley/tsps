/*
 * Copyright (c) 2019, Adam <Adam@sigterm.info>
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
import { type Dimension, type Graphics2D } from "../../../awt";
import type { WidgetItem } from "../../../api/widgets/WidgetItem";
import type { Widget } from "../../../api/widgets/Widget";
import * as InterfaceID from "../../../api/gameval/InterfaceID";
import { Overlay } from "./Overlay";
import type { OverlayManager } from "./OverlayManager";
import { OverlayLayer } from "./OverlayLayer";
import { OverlayPosition } from "./OverlayPosition";
export abstract class WidgetItemOverlay extends Overlay {
    private manager?: OverlayManager;
    constructor() { super(); super.setPosition(OverlayPosition.DYNAMIC); super.setPriority(Overlay.PRIORITY_LOW); super.setLayer(OverlayLayer.MANUAL); }
    setOverlayManager(manager: OverlayManager): void { this.manager = manager; }
    abstract renderItemOverlay(graphics: Graphics2D, itemId: number, widgetItem: WidgetItem): void;
    render(graphics: Graphics2D): Dimension | null {
        if (!this.manager)
            throw new Error("WidgetItemOverlay must be added to OverlayManager before rendering");
        const originalClip = graphics.getClipBounds();
        let currentParent: Widget | null = null;
        for (const item of this.manager.getWidgetItems()) {
            const widget = item.getWidget(), parent = widget.getParent();
            if (!parent)
                continue;
            const parentBounds = parent.getBounds(), bounds = item.getCanvasBounds();
            const dragging = item.getDraggingCanvasBounds() !== null;
            const shouldClip = dragging ? bounds.x < parentBounds.x || bounds.getMaxX() >= parentBounds.getMaxX() || bounds.y < parentBounds.y || bounds.getMaxY() >= parentBounds.getMaxY() :
                (bounds.y < parentBounds.y && bounds.getMaxY() >= parentBounds.y) || (bounds.y < parentBounds.getMaxY() && bounds.getMaxY() >= parentBounds.getMaxY()) || (bounds.x < parentBounds.x && bounds.getMaxX() >= parentBounds.x) || (bounds.x < parentBounds.getMaxX() && bounds.getMaxX() >= parentBounds.getMaxX());
            if (shouldClip && currentParent !== parent) {
                graphics.setClip(parentBounds);
                currentParent = parent;
            }
            else if (!shouldClip && currentParent !== null && currentParent !== parent) {
                graphics.setClip(originalClip);
                currentParent = null;
            }
            this.renderItemOverlay(graphics, item.getId(), item);
        }
        return null;
    }
    protected showOnInventory(): void { this.showOnInterfaces(InterfaceID.BANK_DEPOSITBOX, InterfaceID.BANKSIDE, InterfaceID.SHOPSIDE, InterfaceID.GE_OFFERS_SIDE, InterfaceID.GE_PRICECHECKER_SIDE, InterfaceID.EQUIPMENT_SIDE, InterfaceID.INVENTORY, InterfaceID.SEED_VAULT_DEPOSIT, InterfaceID.TRADEMAIN, InterfaceID.TRADESIDE, InterfaceID.POH_COSTUMES_SIDE); }
    protected showOnBank(): void { this.drawAfterLayer(InterfaceID.Bankmain.ITEMS); this.drawAfterLayer(InterfaceID.SharedBank.ITEMS); }
    protected showOnEquipment(): void { this.showOnInterfaces(InterfaceID.WORNITEMS); }
    protected showOnInterfaces(...ids: number[]): void {
        for (const id of ids)
            this.drawAfterInterface(id);
    }
    setPosition(_position: OverlayPosition): void { throw new Error("WidgetItemOverlay position is fixed"); }
    setLayer(_layer: OverlayLayer): void { throw new Error("WidgetItemOverlay layer is fixed"); }
}
