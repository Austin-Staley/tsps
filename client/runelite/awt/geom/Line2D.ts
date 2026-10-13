import { Rectangle } from "../Rectangle";
import type { Shape } from "../Shape";
import type { Point } from "../Point";
export class Line2D implements Shape {
    static readonly Double = Line2D;
    static readonly Float = Line2D;
    constructor(public x1 = 0, public y1 = 0, public x2 = 0, public y2 = 0) { }
    getBounds(): Rectangle { return new Rectangle(Math.min(this.x1, this.x2), Math.min(this.y1, this.y2), Math.abs(this.x2 - this.x1), Math.abs(this.y2 - this.y1)); }
    contains(_x: number | Point, _y?: number): boolean { return false; }
    trace(context: CanvasRenderingContext2D): void { context.moveTo(this.x1, this.y1); context.lineTo(this.x2, this.y2); }
}
