export class AlphaComposite {
    static readonly CLEAR = 1;
    static readonly SRC = 2;
    static readonly SRC_OVER = 3;
    static readonly DST_OVER = 4;
    static readonly SRC_IN = 5;
    static readonly DST_IN = 6;
    static readonly SRC_OUT = 7;
    static readonly DST_OUT = 8;
    static readonly DST = 9;
    static readonly SRC_ATOP = 10;
    static readonly DST_ATOP = 11;
    static readonly XOR = 12;
    static readonly SrcOver = new AlphaComposite(AlphaComposite.SRC_OVER);
    static readonly Clear = new AlphaComposite(AlphaComposite.CLEAR);
    constructor(private readonly rule: number, private readonly alpha = 1) {
        if (rule < 1 || rule > 12 || alpha < 0 || alpha > 1)
            throw new RangeError("Invalid composite");
    }
    getAlpha(): number { return this.alpha; }
    getRule(): number { return this.rule; }
    static getInstance(rule: number, alpha = 1): AlphaComposite { return new AlphaComposite(rule, alpha); }
}
