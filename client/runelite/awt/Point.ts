export class Point {
    public x: number;
    public y: number;
    constructor(x: number | Point = 0, y = 0) { this.x = typeof x === "number" ? x : x.x; this.y = typeof x === "number" ? y : x.y; }
    getLocation(): Point { return new Point(this); }
    getX(): number { return this.x; }
    getY(): number { return this.y; }
    setLocation(x: number | Point, y?: number): void { this.x = typeof x === "number" ? x : x.x; this.y = typeof x === "number" ? y! : x.y; }
    translate(dx: number, dy: number): void { this.x += dx; this.y += dy; }
    distance(point: Point): number { return Math.hypot(this.x - point.x, this.y - point.y); }
    equals(other: unknown): boolean { return other instanceof Point && other.x === this.x && other.y === this.y; }
}
