import { Point } from "./Point";
import { Rectangle } from "./Rectangle";
import type { Shape } from "./Shape";
export class Polygon implements Shape {
    readonly xpoints: number[];
    readonly ypoints: number[];
    npoints: number;
    constructor(xpoints: ArrayLike<number> = [], ypoints: ArrayLike<number> = [], npoints = Math.min(xpoints.length, ypoints.length)) { this.xpoints = Array.from(xpoints).slice(0, npoints); this.ypoints = Array.from(ypoints).slice(0, npoints); this.npoints = npoints; }
    addPoint(x: number, y: number): void { this.xpoints.push(x); this.ypoints.push(y); this.npoints++; }
    reset(): void { this.xpoints.length = this.ypoints.length = this.npoints = 0; }
    translate(dx: number, dy: number): void {
        for (let i = 0; i < this.npoints; i++) {
            this.xpoints[i] += dx;
            this.ypoints[i] += dy;
        }
    }
    contains(x: number | Point, y?: number): boolean {
        const px = typeof x === "number" ? x : x.x, py = typeof x === "number" ? y! : x.y;
        let inside = false;
        for (let i = 0, j = this.npoints - 1; i < this.npoints; j = i++)
            if ((this.ypoints[i] > py) !== (this.ypoints[j] > py) && px < (this.xpoints[j] - this.xpoints[i]) * (py - this.ypoints[i]) / (this.ypoints[j] - this.ypoints[i]) + this.xpoints[i])
                inside = !inside;
        return inside;
    }
    getBounds(): Rectangle {
        if (!this.npoints)
            return new Rectangle();
        const x = Math.min(...this.xpoints), y = Math.min(...this.ypoints);
        return new Rectangle(x, y, Math.max(...this.xpoints) - x, Math.max(...this.ypoints) - y);
    }
    trace(context: CanvasRenderingContext2D): void {
        if (!this.npoints)
            return;
        context.moveTo(this.xpoints[0], this.ypoints[0]);
        for (let i = 1; i < this.npoints; i++)
            context.lineTo(this.xpoints[i], this.ypoints[i]);
        context.closePath();
    }
}
