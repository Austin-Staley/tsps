import { Graphics2D } from "../Graphics2D";
export type ImageSource = HTMLCanvasElement | OffscreenCanvas | ImageBitmap | HTMLImageElement;
export class BufferedImage {
    static readonly TYPE_INT_RGB = 1;
    static readonly TYPE_INT_ARGB = 2;
    readonly source: ImageSource;
    constructor(source: ImageSource);
    constructor(width: number, height: number, type?: number);
    constructor(source: ImageSource | number, height?: number, type = BufferedImage.TYPE_INT_ARGB) {
        if (typeof source !== "number")
            this.source = source;
        else {
            if (source <= 0 || height! <= 0)
                throw new RangeError("Invalid image size");
            const canvas = typeof document !== "undefined" ? document.createElement("canvas") : new OffscreenCanvas(source, height!);
            canvas.width = source;
            canvas.height = height!;
            this.source = canvas;
            if (type === BufferedImage.TYPE_INT_RGB) {
                const g = this.createGraphics();
                g.context.fillStyle = "#000";
                g.context.fillRect(0, 0, source, height!);
                g.dispose();
            }
        }
    }
    getWidth(): number { return this.source.width; }
    getHeight(): number { return this.source.height; }
    createGraphics(): Graphics2D {
        if (!("getContext" in this.source))
            throw new Error("Image must be a canvas for createGraphics");
        const context = this.source.getContext("2d") as CanvasRenderingContext2D | null;
        if (!context)
            throw new Error("Canvas2D unavailable");
        return new Graphics2D(context);
    }
    getRGB(x: number, y: number): number {
        if (!("getContext" in this.source))
            throw new Error("Image must be a canvas for pixel access");
        const context = this.source.getContext("2d") as CanvasRenderingContext2D;
        const p = context.getImageData(x, y, 1, 1).data;
        return (p[3] << 24) | (p[0] << 16) | (p[1] << 8) | p[2];
    }
    setRGB(x: number, y: number, argb: number): void {
        if (!("getContext" in this.source))
            throw new Error("Image must be a canvas for pixel access");
        const context = this.source.getContext("2d") as CanvasRenderingContext2D;
        const data = context.createImageData(1, 1);
        data.data.set([argb >>> 16 & 255, argb >>> 8 & 255, argb & 255, argb >>> 24]);
        context.putImageData(data, x, y);
    }
}
