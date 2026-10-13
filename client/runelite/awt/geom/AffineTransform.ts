export class AffineTransform {
    constructor(public m00 = 1, public m10 = 0, public m01 = 0, public m11 = 1, public m02 = 0, public m12 = 0) { }
    static from(matrix: DOMMatrix | AffineTransform): AffineTransform { return matrix instanceof AffineTransform ? new AffineTransform(matrix.m00, matrix.m10, matrix.m01, matrix.m11, matrix.m02, matrix.m12) : new AffineTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f); }
    concatenate(other: AffineTransform): void { const a = this.m00, b = this.m10, c = this.m01, d = this.m11, e = this.m02, f = this.m12; this.m00 = a * other.m00 + c * other.m10; this.m10 = b * other.m00 + d * other.m10; this.m01 = a * other.m01 + c * other.m11; this.m11 = b * other.m01 + d * other.m11; this.m02 = a * other.m02 + c * other.m12 + e; this.m12 = b * other.m02 + d * other.m12 + f; }
    translate(x: number, y: number): void { this.concatenate(new AffineTransform(1, 0, 0, 1, x, y)); }
    scale(x: number, y: number): void { this.concatenate(new AffineTransform(x, 0, 0, y)); }
    rotate(angle: number, x = 0, y = 0): void { this.translate(x, y); this.concatenate(new AffineTransform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle))); this.translate(-x, -y); }
    getTranslateX(): number { return this.m02; }
    getTranslateY(): number { return this.m12; }
    getScaleX(): number { return this.m00; }
    getScaleY(): number { return this.m11; }
    createInverse(): AffineTransform {
        const d = this.m00 * this.m11 - this.m01 * this.m10;
        if (d === 0)
            throw new Error("Non-invertible transform");
        return new AffineTransform(this.m11 / d, -this.m10 / d, -this.m01 / d, this.m00 / d, (this.m01 * this.m12 - this.m11 * this.m02) / d, (this.m10 * this.m02 - this.m00 * this.m12) / d);
    }
    transformPoint(x: number, y: number): [
        number,
        number
    ] { return [this.m00 * x + this.m01 * y + this.m02, this.m10 * x + this.m11 * y + this.m12]; }
}
