import { Point } from "./Point";
import { Dimension } from "./Dimension";
import type { Shape } from "./Shape";
export class Rectangle implements Shape {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    constructor(x?: number | Point | Rectangle | Dimension, y?: number | Dimension, width = 0, height = 0) {
        this.x = typeof x === "number" ? x : x instanceof Dimension ? 0 : x?.x ?? 0;
        this.y = typeof y === "number" ? y : typeof x === "number" || x instanceof Dimension ? 0 : x?.y ?? 0;
        this.width = y instanceof Dimension ? y.width : x instanceof Rectangle || x instanceof Dimension ? x.width : width;
        this.height = y instanceof Dimension ? y.height : x instanceof Rectangle || x instanceof Dimension ? x.height : height;
    }
    getX(): number { return this.x; }
    getY(): number { return this.y; }
    getWidth(): number { return this.width; }
    getHeight(): number { return this.height; }
    getMinX(): number { return this.x; }
    getMaxX(): number { return this.x + this.width; }
    getMinY(): number { return this.y; }
    getMaxY(): number { return this.y + this.height; }
    getCenterX(): number { return this.x + this.width / 2; }
    getCenterY(): number { return this.y + this.height / 2; }
    getLocation(): Point { return new Point(this.x, this.y); }
    getSize(): Dimension { return new Dimension(this.width, this.height); }
    setLocation(x: number | Point, y?: number): void { this.x = typeof x === "number" ? x : x.x; this.y = typeof x === "number" ? y! : x.y; }
    setSize(width: number | Dimension, height?: number): void { this.width = typeof width === "number" ? width : width.width; this.height = typeof width === "number" ? height! : width.height; }
    setBounds(x: number | Rectangle, y?: number, width?: number, height?: number): void {
        this.x = typeof x === "number" ? x : x.x;
        this.y = typeof x === "number" ? y! : x.y;
        this.width = typeof x === "number" ? width! : x.width;
        this.height = typeof x === "number" ? height! : x.height;
    }
    contains(x: number | Point | Rectangle, y?: number): boolean {
        if (x instanceof Rectangle)
            return !this.isEmpty() && !x.isEmpty() && x.x >= this.x && x.y >= this.y && x.getMaxX() <= this.getMaxX() && x.getMaxY() <= this.getMaxY();
        const px = typeof x === "number" ? x : x.x, py = typeof x === "number" ? y! : x.y;
        return this.width > 0 && this.height > 0 && px >= this.x && py >= this.y && px < this.getMaxX() && py < this.getMaxY();
    }
    intersects(other: Rectangle): boolean { return !this.isEmpty() && !other.isEmpty() && other.getMaxX() > this.x && other.getMaxY() > this.y && other.x < this.getMaxX() && other.y < this.getMaxY(); }
    intersection(other: Rectangle): Rectangle { const x = Math.max(this.x, other.x), y = Math.max(this.y, other.y); return new Rectangle(x, y, Math.min(this.getMaxX(), other.getMaxX()) - x, Math.min(this.getMaxY(), other.getMaxY()) - y); }
    union(other: Rectangle): Rectangle { const x = Math.min(this.x, other.x), y = Math.min(this.y, other.y); return new Rectangle(x, y, Math.max(this.getMaxX(), other.getMaxX()) - x, Math.max(this.getMaxY(), other.getMaxY()) - y); }
    grow(horizontal: number, vertical: number): void { this.x -= horizontal; this.y -= vertical; this.width += horizontal * 2; this.height += vertical * 2; }
    translate(dx: number, dy: number): void { this.x += dx; this.y += dy; }
    isEmpty(): boolean { return this.width <= 0 || this.height <= 0; }
    getBounds(): Rectangle { return new Rectangle(this); }
    trace(context: CanvasRenderingContext2D): void {
        if (this.width >= 0 && this.height >= 0)
            context.rect(this.x, this.y, this.width, this.height);
    }
}
