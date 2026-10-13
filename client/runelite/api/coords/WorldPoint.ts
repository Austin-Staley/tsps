import type { Client } from "../Client";
import type { WorldView } from "../WorldView";
import { LocalPoint } from "./LocalPoint";
/** OSRS coordinates; instance rotation follows RuneLite's eight-tile chunk mapping. */
export class WorldPoint {
    constructor(private readonly x: number, private readonly y: number, private readonly plane: number) {}
    getX(): number { return this.x; }
    getY(): number { return this.y; }
    getPlane(): number { return this.plane; }
    dx(dx: number): WorldPoint { return new WorldPoint(this.x + dx, this.y, this.plane); }
    dy(dy: number): WorldPoint { return new WorldPoint(this.x, this.y + dy, this.plane); }
    dz(dz: number): WorldPoint { return new WorldPoint(this.x, this.y, this.plane + dz); }
    distanceTo(other: WorldPoint): number { return this.plane === other.plane ? this.distanceTo2D(other) : 2147483647; }
    distanceTo2D(other: WorldPoint): number { return Math.max(Math.abs(this.x - other.x), Math.abs(this.y - other.y)); }
    getRegionID(): number { return ((this.x >> 6) << 8) | (this.y >> 6); }
    getRegionX(): number { return this.x & 63; }
    getRegionY(): number { return this.y & 63; }
    equals(other: unknown): boolean { return other instanceof WorldPoint && this.x === other.x && this.y === other.y && this.plane === other.plane; }
    static fromCoord(coord: number): WorldPoint { return new WorldPoint((coord >> 14) & 16383, coord & 16383, (coord >> 28) & 3); }
    static fromRegion(id: number, x: number, y: number, plane: number): WorldPoint { return new WorldPoint((id >> 8) * 64 + x, (id & 255) * 64 + y, plane); }
    static isInScene(view: WorldView, x: number, y: number): boolean { return x >= view.getBaseX() && y >= view.getBaseY() && x < view.getBaseX() + view.getSizeX() && y < view.getBaseY() + view.getSizeY(); }
    static fromScene(source: Client | WorldView, x: number, y: number, plane: number): WorldPoint { const v = "getTopLevelWorldView" in source ? source.getTopLevelWorldView() : source; return new WorldPoint(v.getBaseX() + x, v.getBaseY() + y, plane); }
    static fromLocal(source: Client | WorldView, local: LocalPoint): WorldPoint;
    static fromLocal(source: Client | WorldView, x: number, y: number, plane: number): WorldPoint;
    static fromLocal(source: Client | WorldView, localOrX: LocalPoint | number, y?: number, plane?: number): WorldPoint {
        const v = "getTopLevelWorldView" in source ? (localOrX instanceof LocalPoint ? source.getWorldView(localOrX.getWorldView())! : source.getTopLevelWorldView()) : source;
        return WorldPoint.fromScene(v, localOrX instanceof LocalPoint ? localOrX.getSceneX() : localOrX >> 7, localOrX instanceof LocalPoint ? localOrX.getSceneY() : y! >> 7, plane ?? v.getPlane());
    }
    static fromLocalInstance(source: Client | WorldView, local: LocalPoint, plane?: number): WorldPoint {
        const v = "getTopLevelWorldView" in source ? source.getWorldView(local.getWorldView())! : source;
        const p = plane ?? v.getPlane();
        if (!v.isInstance()) return WorldPoint.fromLocal(v, local.getX(), local.getY(), p);
        const sx = local.getSceneX(), sy = local.getSceneY();
        const chunk = v.getInstanceTemplateChunks()[p]?.[sx >> 3]?.[sy >> 3] ?? -1;
        return WorldPoint.rotate(new WorldPoint(((chunk >> 14) & 1023) * 8 + (sx & 7), ((chunk >> 3) & 2047) * 8 + (sy & 7), (chunk >> 24) & 3), 4 - ((chunk >> 1) & 3));
    }
    static toLocalInstance(source: Client | WorldView, point: WorldPoint): WorldPoint[] {
        const v = "getTopLevelWorldView" in source ? source.getTopLevelWorldView() : source;
        if (!v.isInstance()) return v.contains(point) ? [point] : [];
        const found: WorldPoint[] = [], chunks = v.getInstanceTemplateChunks();
        chunks.forEach((xs, plane) => xs.forEach((ys, x) => ys.forEach((chunk, y) => {
            if (chunk === -1 || (chunk >> 24 & 3) !== point.plane || (chunk >> 14 & 1023) !== point.x >> 3 || (chunk >> 3 & 2047) !== point.y >> 3) return;
            found.push(WorldPoint.rotate(new WorldPoint(v.getBaseX() + x * 8 + (point.x & 7), v.getBaseY() + y * 8 + (point.y & 7), plane), chunk >> 1 & 3));
        })));
        return found;
    }
    private static rotate(p: WorldPoint, rotation: number): WorldPoint {
        const bx = p.x & ~7, by = p.y & ~7, x = p.x & 7, y = p.y & 7;
        switch (rotation & 3) { case 1: return new WorldPoint(bx + y, by + 7 - x, p.plane); case 2: return new WorldPoint(bx + 7 - x, by + 7 - y, p.plane); case 3: return new WorldPoint(bx + 7 - y, by + x, p.plane); default: return p; }
    }
}
