import type { Rectangle } from "./Rectangle";
import type { Point } from "./Point";
export interface Shape {
    trace(context: CanvasRenderingContext2D): void;
    getBounds(): Rectangle;
    contains(x: number | Point, y?: number): boolean;
}
