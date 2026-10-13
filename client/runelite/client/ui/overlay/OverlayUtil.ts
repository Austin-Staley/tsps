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
import { Client } from "../../../api/Client";
import { Perspective } from "../../../api/Perspective";
import type { LocalPoint } from "../../../api/coords/LocalPoint";
import { ColorUtil } from "../../util/ColorUtil";
import { BasicStroke, BufferedImage, Color, Graphics2D, Point, type Shape } from "../../../awt";
import type { Actor } from "../../../api/Actor";
export class OverlayUtil {
    static renderPolygon(graphics: Graphics2D, polygon: Shape, color: Color, stroke?: BasicStroke): void;
    static renderPolygon(graphics: Graphics2D, polygon: Shape, color: Color, fillColor: Color, stroke: BasicStroke): void;
    static renderPolygon(graphics: Graphics2D, polygon: Shape, color: Color, fillOrStroke: Color | BasicStroke = new BasicStroke(2), borderStroke = new BasicStroke(2)): void {
        const fill = fillOrStroke instanceof Color ? fillOrStroke : new Color(0, 0, 0, 50), stroke = fillOrStroke instanceof BasicStroke ? fillOrStroke : borderStroke, original = graphics.getStroke();
        graphics.setColor(color);
        graphics.setStroke(stroke);
        graphics.draw(polygon);
        graphics.setColor(fill);
        graphics.fill(polygon);
        graphics.setStroke(original);
    }
    static renderTextLocation(graphics: Graphics2D, location: Point, text: string, color: Color): void {
        if (!text)
            return;
        graphics.setColor(Color.BLACK);
        graphics.drawString(text, location.x + 1, location.y + 1);
        graphics.setColor(ColorUtil.colorWithAlpha(color, 255));
        graphics.drawString(text, location.x, location.y);
    }
    static renderImageLocation(graphics: Graphics2D, location: Point, image: BufferedImage): void;
    static renderImageLocation(client: Client, graphics: Graphics2D, point: LocalPoint, image: BufferedImage, zOffset: number): void;
    static renderImageLocation(clientOrGraphics: Client | Graphics2D, graphicsOrLocation: Graphics2D | Point, pointOrImage: LocalPoint | BufferedImage, image?: BufferedImage, zOffset = 0): void {
        if (clientOrGraphics instanceof Graphics2D) {
            const point = graphicsOrLocation as Point;
            clientOrGraphics.drawImage(pointOrImage as BufferedImage, point.x, point.y, null);
        }
        else {
            const point = Perspective.getCanvasImageLocation(clientOrGraphics, pointOrImage as LocalPoint, image!, zOffset);
            if (point)
                this.renderImageLocation(graphicsOrLocation as Graphics2D, point, image!);
        }
    }
    static renderMinimapLocation(graphics: Graphics2D, location: Point, color: Color): void { graphics.setColor(Color.BLACK); graphics.fillOval(location.x - 2, location.y - 1, 4, 4); graphics.setColor(ColorUtil.colorWithAlpha(color, 255)); graphics.fillOval(location.x - 2, location.y - 2, 4, 4); }
    static renderHoverableArea(graphics: Graphics2D, area: Shape, mouse: Point, fillColor: Color, hoverColor: Color, borderColor: Color): void {
        const g = graphics.create();
        try {
            g.setColor(area.contains(mouse) ? hoverColor : fillColor);
            g.fill(area);
            g.setColor(borderColor);
            g.draw(area);
        }
        finally {
            g.dispose();
        }
    }
    static renderActorOverlay(graphics: Graphics2D, actor: Actor, text: string, color: Color): void {
        const poly = actor.getCanvasTilePoly();
        if (poly)
            this.renderPolygon(graphics, poly, color);
        const location = actor.getCanvasTextLocation(graphics, text, actor.getLogicalHeight() + 40);
        if (location)
            this.renderTextLocation(graphics, location, text, color);
    }
    static renderActorOverlayImage(graphics: Graphics2D, actor: Actor, image: BufferedImage, color: Color, zOffset: number): void {
        const poly = actor.getCanvasTilePoly();
        if (poly)
            this.renderPolygon(graphics, poly, color);
        const location = actor.getCanvasImageLocation(image, zOffset);
        if (location)
            this.renderImageLocation(graphics, location, image);
    }
    static renderTileOverlay(client: Client, graphics: Graphics2D, point: LocalPoint, color: Color, image: BufferedImage): void {
        const poly = Perspective.getCanvasTilePoly(client, point);
        if (poly)
            this.renderPolygon(graphics, poly, color);
        this.renderImageLocation(client, graphics, point, image, 0);
    }
}
