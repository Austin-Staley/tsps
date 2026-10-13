/*
 * Copyright (c) 2017, Adam <Adam@sigterm.info>
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
import { BufferedImage, Graphics2D, Point, Polygon } from "../awt";
import { Client } from "./Client";
import { LocalPoint } from "./coords/LocalPoint";
import { WorldPoint } from "./coords/WorldPoint";
type Projector = (x: number, y: number, z: number, worldView: number) => Point | null;
const projectors = new WeakMap<Client, Projector>();
/** RuneLite coordinate conventions, with engine projection registered by the adapter. */
export class Perspective {
    static readonly LOCAL_COORD_BITS = 7;
    static readonly LOCAL_TILE_SIZE = 128;
    static readonly SINE14 = Int32Array.from({ length: 16384 }, (_, angle) => Math.trunc(Math.sin(angle * Math.PI / 8192) * 65536));
    static readonly COSINE14 = Int32Array.from({ length: 16384 }, (_, angle) => Math.trunc(Math.cos(angle * Math.PI / 8192) * 65536));
    static setProjector(client: Client, projector: Projector): void { projectors.set(client, projector); }
    static localToCanvas(client: Client, point: LocalPoint, plane: number, heightOffset?: number): Point | null;
    static localToCanvas(client: Client, x: number, y: number, z: number): Point | null;
    static localToCanvas(client: Client, worldView: number, x: number, y: number, z: number): Point | null;
    static localToCanvas(client: Client, pointOrX: LocalPoint | number, yOrPlane: number, zOrOffset = 0, z?: number): Point | null {
        let x: number, y: number, height: number, view = -1;
        if (pointOrX instanceof LocalPoint) {
            x = pointOrX.getX();
            y = pointOrX.getY();
            view = pointOrX.getWorldView();
            height = this.getTileHeight(client, pointOrX, yOrPlane) - zOrOffset;
        }
        else if (z !== undefined) {
            view = pointOrX;
            x = yOrPlane;
            y = zOrOffset;
            height = z;
        }
        else {
            x = pointOrX;
            y = yOrPlane;
            height = zOrOffset;
        }
        if (!client.getWorldView(view))
            return null;
        const projector = projectors.get(client);
        if (projector)
            return projector(x, y, height, view);
        if (view !== -1)
            return null;
        const dx = x - client.getCameraFpX(), dy = y - client.getCameraFpY(), dz = height - client.getCameraFpZ();
        const pitch = client.getCameraFpPitch(), yaw = client.getCameraFpYaw(), sin = Math.sin(yaw), cos = Math.cos(yaw), ps = Math.sin(pitch), pc = Math.cos(pitch);
        const rx = dx * cos + dy * sin, forward = dy * cos - dx * sin, vertical = dz * pc - forward * ps, depth = forward * pc + dz * ps;
        if (depth < 50)
            return null;
        return new Point(Math.round(client.getViewportWidth() / 2 + rx * client.getScale() / depth) + client.getViewportXOffset(), Math.round(client.getViewportHeight() / 2 + vertical * client.getScale() / depth) + client.getViewportYOffset());
    }
    static getTileHeight(client: Client, point: LocalPoint, plane: number): number { return client.getTileHeight(point.getX(), point.getY(), plane, point.getWorldView()); }
    static getFootprintTileHeight(client: Client, point: LocalPoint, plane: number, size: number): number {
        if (size <= 1)
            return this.getTileHeight(client, point, plane);
        let height = this.getTileHeight(client, point, plane), half = size * 64;
        for (let x = point.getX() - half; x <= point.getX() + half; x += 128)
            for (let y = point.getY() - half; y <= point.getY() + half; y += 128)
                height = Math.min(height, client.getTileHeight(x, y, plane, point.getWorldView()));
        return height;
    }
    static getCanvasTilePoly(client: Client, point: LocalPoint, zOffset = 0): Polygon | null { return this.getCanvasTileAreaPoly(client, point, 1, 1, -1, zOffset); }
    static getCanvasTileAreaPoly(client: Client, point: LocalPoint, sizeX: number, sizeY = sizeX, level = -1, heightOffset = 0): Polygon | null {
        const view = client.getWorldView(point.getWorldView());
        if (!view)
            return null;
        const offset = view.isTopLevel() ? 16 : 0;
        if (point.getSceneX() < -offset || point.getSceneY() < -offset || point.getSceneX() >= view.getSizeX() + offset || point.getSceneY() >= view.getSizeY() + offset)
            return null;
        if (level === -1)
            level = view.getPlane();
        const x = point.getX(), y = point.getY(), hx = sizeX * 64, hy = sizeY * 64, polygon = new Polygon();
        for (const [px, py] of [[x - hx, y - hy], [x + hx, y - hy], [x + hx, y + hy], [x - hx, y + hy]]) {
            const projected = this.localToCanvas(client, point.getWorldView(), px, py, client.getTileHeight(px, py, level, point.getWorldView()) - heightOffset);
            if (!projected)
                return null;
            polygon.addPoint(projected.x, projected.y);
        }
        return polygon;
    }
    static getCanvasTextLocation(client: Client, graphics: Graphics2D, point: LocalPoint, text: string | null, zOffset: number): Point | null {
        if (text === null)
            return null;
        const plane = client.getWorldView(point.getWorldView())?.getPlane();
        if (plane === undefined)
            return null;
        const projected = this.localToCanvas(client, point, plane, zOffset);
        return projected ? new Point(projected.x - Math.trunc(graphics.getFontMetrics().stringWidth(text) / 2), projected.y) : null;
    }
    static getCanvasImageLocation(client: Client, point: LocalPoint, image: BufferedImage, zOffset: number): Point | null {
        const plane = client.getWorldView(point.getWorldView())?.getPlane();
        if (plane === undefined)
            return null;
        const p = this.localToCanvas(client, point, plane, zOffset);
        return p ? new Point(p.x - image.getWidth() / 2, p.y - image.getHeight() / 2) : null;
    }
    static getCanvasSpriteLocation(client: Client, point: LocalPoint, sprite: {
        getWidth(): number;
        getHeight(): number;
    }, zOffset: number): Point | null {
        const plane = client.getWorldView(point.getWorldView())?.getPlane();
        if (plane === undefined)
            return null;
        const p = this.localToCanvas(client, point, plane, zOffset);
        return p ? new Point(p.x - sprite.getWidth() / 2, p.y - sprite.getHeight() / 2) : null;
    }
    static localToMinimap(client: Client, point: LocalPoint, distance = Math.trunc(20 * 128 * 4 / client.getMinimapZoom())): Point | null {
        if (point.getWorldView() !== -1)
            return null;
        const player = client.getLocalPlayer(), bounds = client.getMinimapBounds();
        if (!player || !bounds || bounds.isEmpty())
            return null;
        const focus = player.getLocalLocation(), dx = point.getX() - focus.getX(), dy = point.getY() - focus.getY();
        if (dx * dx + dy * dy >= distance * distance)
            return null;
        const zoom = client.getMinimapZoom() / 128, x = Math.trunc(dx * zoom), y = Math.trunc(dy * zoom), angle = client.getCameraYawTarget() & 16383;
        const sin = this.SINE14[angle], cos = this.COSINE14[angle];
        return new Point(bounds.getCenterX() + ((cos * x + sin * y) >> 16), bounds.getCenterY() + ((sin * x - cos * y) >> 16));
    }
    static worldToMinimap(client: Client, point: WorldPoint): Point | null { const local = LocalPoint.fromWorld(client, point); return local ? this.localToMinimap(client, local) : null; }
    static getMiniMapImageLocation(client: Client, point: LocalPoint, image: BufferedImage): Point | null { const p = this.localToMinimap(client, point); return p ? new Point(p.x - image.getWidth() / 2, p.y - image.getHeight() / 2) : null; }
}
