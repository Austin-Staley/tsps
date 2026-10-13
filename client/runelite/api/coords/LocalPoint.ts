import type { Client } from "../Client";
import type { WorldView } from "../WorldView";
import { WorldPoint } from "./WorldPoint";
export class LocalPoint {
    private readonly worldView: number;
    constructor(private readonly x: number, private readonly y: number, worldView: number | WorldView = -1) { this.worldView = typeof worldView === "number" ? worldView : worldView.getId(); }
    getX(): number { return this.x; }
    getY(): number { return this.y; }
    getWorldView(): number { return this.worldView; }
    getSceneX(): number { return this.x >> 7; }
    getSceneY(): number { return this.y >> 7; }
    distanceTo(other: LocalPoint): number { return other.worldView === this.worldView ? Math.trunc(Math.hypot(this.x - other.x, this.y - other.y)) : 2147483647; }
    isInScene(): boolean { return this.x >= 0 && this.x < 104 * 128 && this.y >= 0 && this.y < 104 * 128; }
    equals(other: unknown): boolean { return other instanceof LocalPoint && this.x === other.x && this.y === other.y && this.worldView === other.worldView; }
    static fromScene(x: number, y: number, view: number | WorldView = -1): LocalPoint { return new LocalPoint((x << 7) + 64, (y << 7) + 64, view); }
    static fromWorld(source: Client | WorldView, point: WorldPoint): LocalPoint | null;
    static fromWorld(source: Client | WorldView, x: number, y: number): LocalPoint | null;
    static fromWorld(source: Client | WorldView, pointOrX: WorldPoint | number, y?: number): LocalPoint | null {
        const view = "getTopLevelWorldView" in source ? (pointOrX instanceof WorldPoint ? source.findWorldViewFromWorldPoint(pointOrX) : source.getTopLevelWorldView()) : source;
        if (!view) return null;
        const x = typeof pointOrX === "number" ? pointOrX : pointOrX.getX();
        const wy = typeof pointOrX === "number" ? y! : pointOrX.getY();
        if (pointOrX instanceof WorldPoint && pointOrX.getPlane() !== view.getPlane()) return null;
        if (!WorldPoint.isInScene(view, x, wy)) return null;
        return LocalPoint.fromScene(x - view.getBaseX(), wy - view.getBaseY(), view);
    }
}
