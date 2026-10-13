import { queryClip, snapshotClip } from "./ClipState";
import { Color } from "./Color";
import { Font } from "./Font";
import { FontMetrics } from "./FontMetrics";
import { BasicStroke } from "./BasicStroke";
import { AlphaComposite } from "./AlphaComposite";
import { RenderingHints } from "./RenderingHints";
import { Polygon } from "./Polygon";
import { Rectangle } from "./Rectangle";
import type { Shape } from "./Shape";
import type { BufferedImage } from "./image/BufferedImage";
import { AffineTransform } from "./geom/AffineTransform";
import { Ellipse2D } from "./geom/Ellipse2D";
/** Immediate-mode Java2D drawing over Canvas2D; create/dispose isolate plugin state. */
export class Graphics2D {
    private color = Color.WHITE;
    private font = new Font("sans-serif", Font.PLAIN, 12);
    private stroke = new BasicStroke();
    private background=Color.BLACK;
    private composite = AlphaComposite.SrcOver;
    private clips: {
        shape: Shape;
        transform: AffineTransform;
    }[] = [];
    private disposed = false;
    constructor(readonly context: CanvasRenderingContext2D) { context.save(); this.applyState(); }
    private applyState(): void { this.setColor(this.color); this.setFont(this.font); this.setStroke(this.stroke); this.setComposite(this.composite); }
    create(): Graphics2D { const copy = new Graphics2D(this.context); copy.color = this.color; copy.font = this.font; copy.stroke = this.stroke; copy.composite = this.composite; copy.background=this.background; copy.clips = this.clips.map(entry => ({ shape: snapshotClip(entry.shape), transform: AffineTransform.from(entry.transform) })); copy.applyState(); return copy; }
    dispose(): void {
        if (!this.disposed) {
            this.context.restore();
            this.disposed = true;
        }
    }
    setColor(color: Color): void { this.color = color; this.context.fillStyle = this.context.strokeStyle = (this.composite.getRule()===AlphaComposite.CLEAR?Color.BLACK:color).toCSS(); }
    getColor(): Color { return this.color; }
    setFont(font: Font): void { this.font = font; this.context.font = font.toCSS(); this.context.textBaseline = "alphabetic"; }
    getFont(): Font { return this.font; }
    getFontMetrics(font = this.font): FontMetrics { return new FontMetrics(this.context, font); }
    setStroke(stroke: BasicStroke): void { this.stroke = stroke; this.context.lineWidth = stroke.getLineWidth(); this.context.lineCap = (["butt", "round", "square"] as CanvasLineCap[])[stroke.getEndCap()]; this.context.lineJoin = (["miter", "round", "bevel"] as CanvasLineJoin[])[stroke.getLineJoin()]; this.context.miterLimit = stroke.getMiterLimit(); this.context.setLineDash(stroke.dash ?? []); this.context.lineDashOffset = stroke.dashPhase; }
    getStroke(): BasicStroke { return this.stroke; }
    setComposite(composite: AlphaComposite): void {
        this.composite = composite;
        const rules: GlobalCompositeOperation[] = ["source-over", "copy", "copy", "source-over", "destination-over", "source-in", "destination-in", "source-out", "destination-out", "destination-over", "source-atop", "destination-atop", "xor"];
        const clear=composite.getRule()===AlphaComposite.CLEAR,destination=composite.getRule()===AlphaComposite.DST;
        this.context.globalCompositeOperation=clear?"destination-out":destination?"source-over":rules[composite.getRule()];
        this.context.globalAlpha=clear?1:destination?0:composite.getAlpha();
        this.setColor(this.color);

    }
    getComposite(): AlphaComposite { return this.composite; }
    drawString(text: string, x: number, y: number): void { this.context.fillText(text, x, y); }
    drawLine(x1: number, y1: number, x2: number, y2: number): void { this.context.beginPath(); this.context.moveTo(x1, y1); this.context.lineTo(x2, y2); this.context.stroke(); }
    drawRect(x: number, y: number, width: number, height: number): void {
        if (width >= 0 && height >= 0)
            this.context.strokeRect(x, y, width, height);
    }
    fillRect(x: number, y: number, width: number, height: number): void {
        if (width > 0 && height > 0)
            this.context.fillRect(x, y, width, height);
    }
    setBackground(color:Color):void{this.background=color;}
    getBackground():Color{return this.background;}
    clearRect(x:number,y:number,width:number,height:number):void{if(width<=0||height<=0)return;this.context.save();try{this.context.clearRect(x,y,width,height);this.context.globalCompositeOperation="source-over";this.context.globalAlpha=1;this.context.fillStyle=this.background.toCSS();this.context.fillRect(x,y,width,height);}finally{this.context.restore();}}
    draw(shape: Shape): void { this.context.beginPath(); shape.trace(this.context); this.context.stroke(); }
    fill(shape: Shape): void { this.context.beginPath(); shape.trace(this.context); this.context.fill("nonzero"); }
    drawPolygon(polygon: Polygon): void { this.draw(polygon); }
    fillPolygon(polygon: Polygon): void { this.fill(polygon); }
    drawOval(x: number, y: number, width: number, height: number): void { this.draw(new Ellipse2D(x, y, width, height)); }
    fillOval(x: number, y: number, width: number, height: number): void { this.fill(new Ellipse2D(x, y, width, height)); }
    drawArc(x: number, y: number, width: number, height: number, startAngle: number, arcAngle: number): void { this.arc(x, y, width, height, startAngle, arcAngle, false); }
    fillArc(x: number, y: number, width: number, height: number, startAngle: number, arcAngle: number): void { this.arc(x, y, width, height, startAngle, arcAngle, true); }
    private arc(x: number, y: number, width: number, height: number, start: number, extent: number, fill: boolean): void {
        if (width <= 0 || height <= 0)
            return;
        const cx = x + width / 2, cy = y + height / 2;
        this.context.beginPath();
        if (fill)
            this.context.moveTo(cx, cy);
        this.context.ellipse(cx, cy, width / 2, height / 2, 0, -start * Math.PI / 180, -(start + extent) * Math.PI / 180, extent > 0);
        if (fill) {
            this.context.closePath();
            this.context.fill();
        }
        else
            this.context.stroke();
    }
    drawPolyline(xpoints: ArrayLike<number>, ypoints: ArrayLike<number>, count: number): void {
        if (count < 1)
            return;
        this.context.beginPath();
        this.context.moveTo(xpoints[0], ypoints[0]);
        for (let i = 1; i < count; i++)
            this.context.lineTo(xpoints[i], ypoints[i]);
        this.context.stroke();
    }
    drawRoundRect(x: number, y: number, width: number, height: number, arcWidth: number, arcHeight: number): void { this.roundRect(x, y, width, height, arcWidth, arcHeight, false); }
    fillRoundRect(x: number, y: number, width: number, height: number, arcWidth: number, arcHeight: number): void { this.roundRect(x, y, width, height, arcWidth, arcHeight, true); }
    private roundRect(x: number, y: number, width: number, height: number, arcWidth: number, arcHeight: number, fill: boolean): void {
        this.context.beginPath();
        this.context.roundRect(x, y, width, height, [Math.min(arcWidth, arcHeight) / 2]);
        if (fill)
            this.context.fill();
        else
            this.context.stroke();
    }
    drawImage(image: BufferedImage, x: number, y: number, observer?: unknown): boolean;
    drawImage(image: BufferedImage, x: number, y: number, width: number, height: number, observer?: unknown): boolean;
    drawImage(image:BufferedImage,x:number,y:number,widthOrObserver?:unknown,height?:number):boolean{
        const width=typeof widthOrObserver==="number"?widthOrObserver:image.getWidth(),drawHeight=height??image.getHeight();
        if(this.composite.getRule()===AlphaComposite.CLEAR){this.context.clearRect(x,y,width,drawHeight);return true;}
        if(typeof widthOrObserver==="number"&&height!==undefined)this.context.drawImage(image.source,x,y,widthOrObserver,height);else this.context.drawImage(image.source,x,y);return true;
    }

    translate(x: number, y: number): void { this.context.translate(x, y); }
    rotate(angle: number, x = 0, y = 0): void { this.context.translate(x, y); this.context.rotate(angle); this.context.translate(-x, -y); }
    scale(x: number, y: number): void { this.context.scale(x, y); }
    getTransform(): AffineTransform { return AffineTransform.from(this.context.getTransform()); }
    setTransform(transform: AffineTransform): void { this.context.setTransform(transform.m00, transform.m10, transform.m01, transform.m11, transform.m02, transform.m12); }
    transform(transform: AffineTransform): void { this.context.transform(transform.m00, transform.m10, transform.m01, transform.m11, transform.m02, transform.m12); }
    setClip(shape: Shape | null): void;
    setClip(x: number, y: number, width: number, height: number): void;
    setClip(shape: Shape | number | null, y?: number, width?: number, height?: number): void {
        const transform = this.getTransform();
        this.context.restore();
        this.context.save();
        this.applyState();
        this.setTransform(transform);
        this.clips = [];
        if (shape !== null)
            this.clip(typeof shape === "number" ? new Rectangle(shape, y!, width!, height!) : shape);
    }
    clip(shape: Shape): void { const snapshot = snapshotClip(shape), transform = this.getTransform(); this.context.beginPath(); shape.trace(this.context); this.context.clip(); this.clips.push({ shape: snapshot, transform }); }
    getClip(): Shape | null { return queryClip(this.clips, this.getTransform()); }
    getClipBounds(): Rectangle | null { return this.getClip()?.getBounds() ?? null; }
    setRenderingHint(key: string, value: unknown): void {
        if (key === RenderingHints.KEY_INTERPOLATION) {
            this.context.imageSmoothingEnabled = value !== RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR;
            this.context.imageSmoothingQuality = value === RenderingHints.VALUE_INTERPOLATION_BICUBIC ? "high" : "low";
        }
        else if (key === RenderingHints.KEY_ANTIALIASING || key === RenderingHints.KEY_TEXT_ANTIALIASING || key === RenderingHints.KEY_RENDERING) { /* Canvas2D controls vector/text antialiasing. */ }
        else
            throw new Error("Unsupported rendering hint: " + key);
    }
}
