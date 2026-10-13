import { Rectangle } from "./Rectangle";
import { Font } from "./Font";
export class FontMetrics {
    constructor(private readonly context: CanvasRenderingContext2D, private readonly font: Font) { }
    private measure(text: string): TextMetrics { this.context.save(); this.context.font = this.font.toCSS(); const metrics = this.context.measureText(text); this.context.restore(); return metrics; }
    stringWidth(text: string): number { return Math.ceil(this.measure(text).width); }
    getAscent(): number { const metric = this.measure("Mg"); return Math.ceil(metric.fontBoundingBoxAscent ?? metric.actualBoundingBoxAscent ?? this.font.getSize() * .8); }
    getDescent(): number { const metric = this.measure("Mg"); return Math.ceil(metric.fontBoundingBoxDescent ?? metric.actualBoundingBoxDescent ?? this.font.getSize() * .2); }
    getHeight(): number { return this.getAscent() + this.getDescent(); }
    getStringBounds(text: string, _graphics?: unknown): Rectangle { return new Rectangle(0, -this.getAscent(), this.stringWidth(text), this.getHeight()); }
    charWidth(character: string | number): number { return this.stringWidth(typeof character === "number" ? String.fromCharCode(character) : character); }
    getFont(): Font { return this.font; }
}
