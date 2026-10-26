/**
 * Jagex byte transforms used by the rev 241 game protocol.
 *
 * Write order matches blurite/rsprot `buffer/src/main/kotlin/net/rsprot/buffer/JagexByteBufExtensions.kt`
 * at commit 37c4eb46e4731ae6764343d136f3076a50567ec1 (`p1`/`p1Alt*`/`p2`/`p2Alt*`/`p3`/`p4`/`p4Alt*`/`pdataAlt1`).
 * Reads are the matching `g*` inverses from that file.
 */

const HALF = 128;

export class JagOut {
  private readonly bytes: number[] = [];

  public get length(): number {
    return this.bytes.length;
  }

  public u8(value: number): this {
    this.bytes.push(value & 0xff);
    return this;
  }

  public p1(value: number): this {
    return this.u8(value);
  }

  public p1Alt1(value: number): this {
    return this.u8(value + HALF);
  }

  public p1Alt2(value: number): this {
    return this.u8(-value);
  }

  public p1Alt3(value: number): this {
    return this.u8(HALF - value);
  }

  public pboolean(value: boolean): this {
    return this.u8(value ? 1 : 0);
  }

  public p2(value: number): this {
    return this.u8(value >> 8).u8(value);
  }

  public p2Alt1(value: number): this {
    return this.u8(value).u8(value >> 8);
  }

  public p2Alt2(value: number): this {
    return this.u8(value >> 8).u8(value + HALF);
  }

  public p2Alt3(value: number): this {
    return this.u8(value + HALF).u8(value >> 8);
  }

  public p3(value: number): this {
    return this.u8(value >> 16).u8(value >> 8).u8(value);
  }

  public p3Alt2(value: number): this {
    return this.u8(value >> 16).u8(value).u8(value >> 8);
  }

  public p4(value: number): this {
    return this.u8(value >> 24).u8(value >> 16).u8(value >> 8).u8(value);
  }

  public p4Alt1(value: number): this {
    return this.u8(value).u8(value >> 8).u8(value >> 16).u8(value >> 24);
  }

  public p4Alt2(value: number): this {
    return this.u8(value >> 8).u8(value).u8(value >> 24).u8(value >> 16);
  }

  public p4Alt3(value: number): this {
    return this.u8(value >> 16).u8(value >> 24).u8(value).u8(value >> 8);
  }

  public p8(value: bigint): this {
    const hex = BigInt.asUintN(64, value).toString(16).padStart(16, "0");
    for (let i = 0; i < 16; i += 2) this.u8(Number.parseInt(hex.slice(i, i + 2), 16));
    return this;
  }

  /** 0..127 as one byte, otherwise a short with the high bit set. rsprot `pSmart1or2`. */
  public pSmart1or2(value: number): this {
    if ((value | 0) >= 0 && (value | 0) < 128) return this.u8(value);
    return this.p2((value | 0) | 0x8000);
  }

  public pjstr(value: string): this {
    const bytes = Buffer.from(value, "latin1");
    for (const byte of bytes) this.u8(byte);
    return this.u8(0);
  }

  /** Bytes written last-to-first. rsprot `pdataAlt1`. */
  public pdataAlt1(data: Buffer): this {
    for (let i = data.length - 1; i >= 0; i--) this.u8(data[i]);
    return this;
  }

  public raw(data: Buffer): this {
    for (const byte of data) this.u8(byte);
    return this;
  }

  public toBuffer(): Buffer {
    return Buffer.from(this.bytes);
  }
}

export class JagIn {
  private offset = 0;

  constructor(private readonly data: Buffer) {}

  public get remaining(): number {
    return this.data.length - this.offset;
  }

  public u8(): number {
    if (this.offset >= this.data.length) throw new Error("rev241 buffer underflow");
    return this.data[this.offset++];
  }

  public g1(): number {
    return this.u8();
  }

  public g1Alt1(): number {
    return (this.u8() - HALF) & 0xff;
  }

  public g1Alt2(): number {
    return (-(this.u8() << 24 >> 24)) & 0xff;
  }

  public g1Alt3(): number {
    return (HALF - (this.u8() << 24 >> 24)) & 0xff;
  }

  public g2(): number {
    return (this.u8() << 8) | this.u8();
  }

  public g2Alt1(): number {
    const low = this.u8();
    return low | (this.u8() << 8);
  }

  public g2Alt2(): number {
    const high = this.u8();
    const low = (this.u8() - HALF) & 0xff;
    return (high << 8) | low;
  }

  public g2Alt3(): number {
    const first = this.u8();
    const second = this.u8();
    const short = (first << 8) | second;
    return (((short >>> 8) - HALF) & 0xff) | ((short & 0xff) << 8);
  }

  public g3(): number {
    return (this.u8() << 16) | (this.u8() << 8) | this.u8();
  }

  public g4(): number {
    return (this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8();
  }

  public g4Alt1(): number {
    const a = this.u8();
    const b = this.u8();
    const c = this.u8();
    const d = this.u8();
    return (a | (b << 8) | (c << 16) | (d << 24)) | 0;
  }

  /** Inverse of p4Alt2 (bytes shr 8, low, shr 24, shr 16). */
  public g4Alt2(): number {
    const a = this.u8();
    const b = this.u8();
    const c = this.u8();
    const d = this.u8();
    return (b | (a << 8) | (d << 16) | (c << 24)) | 0;
  }

  public g8(): bigint {
    let value = 0n;
    for (let i = 0; i < 8; i++) value = (value << 8n) | BigInt(this.u8());
    return BigInt.asIntN(64, value);
  }

  public gjstr(): string {
    const start = this.offset;
    while (this.u8() !== 0) {
      if (this.offset > this.data.length) throw new Error("rev241 string underflow");
    }
    return this.data.subarray(start, this.offset - 1).toString("latin1");
  }

  public bytes(length: number): Buffer {
    if (length < 0 || this.offset + length > this.data.length) throw new Error("rev241 buffer underflow");
    const slice = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return Buffer.from(slice);
  }

  public skip(length: number): void {
    this.bytes(length);
  }
}
