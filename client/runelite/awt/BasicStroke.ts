export class BasicStroke {
    static readonly CAP_BUTT = 0;
    static readonly CAP_ROUND = 1;
    static readonly CAP_SQUARE = 2;
    static readonly JOIN_MITER = 0;
    static readonly JOIN_ROUND = 1;
    static readonly JOIN_BEVEL = 2;
    constructor(private readonly width = 1, private readonly cap = BasicStroke.CAP_SQUARE, private readonly join = BasicStroke.JOIN_MITER, private readonly miterLimit = 10, readonly dash: number[] | null = null, readonly dashPhase = 0) {
        if (width < 0 || miterLimit < 1 || dash?.some(v => v < 0) || dash?.every(v => v === 0))
            throw new RangeError("Invalid stroke");
    }
    getLineWidth(): number { return this.width; }
    getEndCap(): number { return this.cap; }
    getLineJoin(): number { return this.join; }
    getMiterLimit(): number { return this.miterLimit; }
}
