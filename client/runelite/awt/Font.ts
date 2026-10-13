export class Font {
    static readonly PLAIN = 0;
    static readonly BOLD = 1;
    static readonly ITALIC = 2;
    constructor(private readonly name: string, private readonly style: number, private readonly size: number) { }
    getName(): string { return this.name; }
    getFamily(): string { return this.name; }
    getStyle(): number { return this.style; }
    getSize(): number { return this.size; }
    deriveFont(styleOrSize: number, size?: number): Font { return new Font(this.name, size === undefined ? this.style : styleOrSize, size ?? styleOrSize); }
    toCSS(): string { return `${this.style & Font.ITALIC ? "italic " : ""}${this.style & Font.BOLD ? "bold " : ""}${this.size}px "${this.name}"`; }
}
