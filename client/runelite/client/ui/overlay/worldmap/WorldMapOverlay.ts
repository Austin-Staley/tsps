/*
 * Copyright (c) 2018, Morgan Lewis <https://github.com/MESLewis>
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
import { type Dimension, Graphics2D, Point, Rectangle } from "../../../../awt";
import { WorldPoint } from "../../../../api/coords/WorldPoint";
import { MouseEvent } from "../../../../awt/event/MouseEvent";
import { Overlay } from "../Overlay";
import { OverlayLayer } from "../OverlayLayer";
import { OverlayPosition } from "../OverlayPosition";
import { Tooltip } from "../tooltip/Tooltip";
import { TooltipManager } from "../tooltip/TooltipManager";
import { WorldMapPoint } from "./WorldMapPoint";
import { WorldMapPointManager } from "./WorldMapPointManager";
export interface WorldMapFrame {
    bounds: Rectangle;
    project: (point: WorldPoint) => Point | null;
    jump: (point: WorldPoint) => void;
    mouse: Point;
}
export class WorldMapOverlay extends Overlay {
    private readonly targets: {
        point: WorldMapPoint;
        bounds: Rectangle;
    }[] = [];
    constructor(private readonly manager: WorldMapPointManager, private readonly frame: () => WorldMapFrame | null, private readonly tooltips: TooltipManager) { super(); this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    render(graphics: Graphics2D): Dimension | null {
        this.targets.length = 0;
        if (!this.manager.getWorldMapPoints().length)
            return null;
        const frame = this.frame();
        if (!frame)
            return null;
        const g = graphics.create();
        try {
            g.clip(frame.bounds);
            for (const point of this.manager.getWorldMapPoints()) {
                let anchor = frame.project(point.getWorldPoint());
                if (!anchor)
                    continue;
                const image = point.getImage(), offset = point.getImagePoint() ?? new Point(image.getWidth() / 2, image.getHeight() / 2);
                let snapped = false;
                if (point.isSnapToEdge()) {
                    const x = Math.max(frame.bounds.x + offset.x, Math.min(anchor.x, frame.bounds.getMaxX() - image.getWidth() + offset.x)), y = Math.max(frame.bounds.y + offset.y, Math.min(anchor.y, frame.bounds.getMaxY() - image.getHeight() + offset.y));
                    snapped = x !== anchor.x || y !== anchor.y;
                    anchor = new Point(x, y);
                }
                if (snapped !== point.isCurrentlyEdgeSnapped()) {
                    point.setCurrentlyEdgeSnapped(snapped);
                    if (snapped)
                        point.onEdgeSnap();
                    else
                        point.onEdgeUnsnap();
                }
                const bounds = new Rectangle(anchor.x - offset.x, anchor.y - offset.y, image.getWidth(), image.getHeight());
                if (!frame.bounds.intersects(bounds))
                    continue;
                g.drawImage(image, bounds.x, bounds.y, null);
                this.targets.push({ point, bounds });
                if (bounds.contains(frame.mouse) && point.getTooltip())
                    this.tooltips.add(new Tooltip(point.getTooltip()));
            }
        }
        finally {
            g.dispose();
        }
        return null;
    }
    mousePressed(event: MouseEvent): MouseEvent {
        const frame = this.frame();
        if (!frame || event.getButton() !== MouseEvent.BUTTON1)
            return event;
        for (const target of [...this.targets].reverse())
            if (target.point.isJumpOnClick() && target.bounds.contains(event.getPoint())) {
                frame.jump(target.point.getTarget() ?? target.point.getWorldPoint());
                event.consume();
                break;
            }
        return event;
    }
}
