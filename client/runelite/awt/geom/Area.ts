import { Rectangle } from "../Rectangle";
import type { Shape } from "../Shape";
import type { Point } from "../Point";
export class Area implements Shape {
    private readonly shapes: Shape[];
    constructor(shape?: Shape) { this.shapes = shape ? [shape] : []; }
    getShapes(): readonly Shape[] { return this.shapes; }
    add(area: Area): void { this.shapes.push(...area.shapes); }
    isEmpty(): boolean { return !this.shapes.length; }
    getBounds(): Rectangle { return this.shapes.reduce((bounds, shape) => bounds ? bounds.union(shape.getBounds()) : shape.getBounds(), null as Rectangle | null) ?? new Rectangle(); }
    contains(x: number | Point, y?: number): boolean { return this.shapes.some(shape => shape.contains(x, y)); }
    trace(context: CanvasRenderingContext2D): void {
        for (const shape of this.shapes)
            shape.trace(context);
    }
}
