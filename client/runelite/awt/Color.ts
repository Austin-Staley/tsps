export class Color {
    static readonly WHITE = new Color(255, 255, 255);
    static readonly BLACK = new Color(0, 0, 0);
    static readonly RED = new Color(255, 0, 0);
    static readonly GREEN = new Color(0, 255, 0);
    static readonly BLUE = new Color(0, 0, 255);
    static readonly YELLOW = new Color(255, 255, 0);
    static readonly ORANGE = new Color(255, 200, 0);
    static readonly CYAN = new Color(0, 255, 255);
    static readonly MAGENTA = new Color(255, 0, 255);
    static readonly PINK = new Color(255, 175, 175);
    static readonly GRAY = new Color(128, 128, 128);
    static readonly LIGHT_GRAY = new Color(192, 192, 192);
    static readonly DARK_GRAY = new Color(64, 64, 64);
    static readonly white = Color.WHITE;
    static readonly black = Color.BLACK;
    static readonly red = Color.RED;
    static readonly green = Color.GREEN;
    static readonly blue = Color.BLUE;
    static readonly yellow = Color.YELLOW;
    static readonly orange = Color.ORANGE;
    static readonly cyan = Color.CYAN;
    private readonly red: number;
    private readonly green: number;
    private readonly blue: number;
    private readonly alpha: number;
    constructor(rgb: number, hasAlpha?: boolean);
    constructor(red: number, green: number, blue: number, alpha?: number);
    constructor(red: number, green?: number | boolean, blue?: number, alpha = 255) {
        if (typeof green !== "number") {
            this.red = red >>> 16 & 255;
            this.green = red >>> 8 & 255;
            this.blue = red & 255;
            this.alpha = green ? red >>> 24 & 255 : 255;
        }
        else {
            if (![red, green, blue!, alpha].every(v => Number.isInteger(v) && v >= 0 && v <= 255))
                throw new RangeError("Color component outside 0..255");
            this.red = red;
            this.green = green;
            this.blue = blue!;
            this.alpha = alpha;
        }
    }
    getRed(): number { return this.red; }
    getGreen(): number { return this.green; }
    getBlue(): number { return this.blue; }
    getAlpha(): number { return this.alpha; }
    getRGB(): number { return (this.alpha << 24) | (this.red << 16) | (this.green << 8) | this.blue; }
    darker(): Color { return new Color(Math.floor(this.red * .7), Math.floor(this.green * .7), Math.floor(this.blue * .7), this.alpha); }
    brighter(): Color {
        const values = [this.red, this.green, this.blue];
        if (values.every(v => v === 0))
            return new Color(3, 3, 3, this.alpha);
        return new Color(...values.map(v => Math.min(255, Math.floor((v > 0 && v < 3 ? 3 : v) / .7))) as [
            number,
            number,
            number
        ], this.alpha);
    }
    equals(other: unknown): boolean { return other instanceof Color && this.getRGB() === other.getRGB(); }
    toCSS(): string { return `rgba(${this.red},${this.green},${this.blue},${this.alpha / 255})`; }
    static decode(value: string): Color { return new Color(decodeJavaInteger(value)); }
}
export function decodeJavaInteger(value: string): number {
    let text = value, sign = 1;
    if (text[0] === "-" || text[0] === "+") {
        if (text[0] === "-")
            sign = -1;
        text = text.slice(1);
    }
    let radix = 10;
    if (text.startsWith("0x") || text.startsWith("0X")) {
        radix = 16;
        text = text.slice(2);
    }
    else if (text.startsWith("#")) {
        radix = 16;
        text = text.slice(1);
    }
    else if (text.startsWith("0") && text.length > 1) {
        radix = 8;
        text = text.slice(1);
    }
    const valid = radix === 16 ? /^[\da-f]+$/i : radix === 8 ? /^[0-7]+$/ : /^\d+$/;
    if (!valid.test(text))
        throw new Error("Invalid integer: " + value);
    const result = sign * parseInt(text, radix);
    if (result < -2147483648 || result > 2147483647)
        throw new RangeError("Integer overflow: " + value);
    return result;
}
