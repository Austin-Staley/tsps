export class Dimension {
    public width: number;
    public height: number;
    constructor(width: number | Dimension = 0, height = 0) { this.width = typeof width === "number" ? width : width.width; this.height = typeof width === "number" ? height : width.height; }
    getSize(): Dimension { return new Dimension(this); }
    getWidth(): number { return this.width; }
    getHeight(): number { return this.height; }
    setSize(width: number | Dimension, height?: number): void { this.width = typeof width === "number" ? width : width.width; this.height = typeof width === "number" ? height! : width.height; }
}
