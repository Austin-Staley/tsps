import { Rectangle } from "../Rectangle";
import { Point } from "../Point";
export class Ellipse2D extends Rectangle {
    static readonly Double = Ellipse2D;
    static readonly Float = Ellipse2D;
    contains(x: number | Point, y?: number): boolean { const px = typeof x === "number" ? x : x.x, py = typeof x === "number" ? y! : x.y; return this.width > 0 && this.height > 0 && ((px - this.getCenterX()) / (this.width / 2)) ** 2 + ((py - this.getCenterY()) / (this.height / 2)) ** 2 < 1; }
    trace(context: CanvasRenderingContext2D): void {
        if (this.width <= 0 || this.height <= 0)
            return;
        context.ellipse(this.getCenterX(), this.getCenterY(), this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    }
}
