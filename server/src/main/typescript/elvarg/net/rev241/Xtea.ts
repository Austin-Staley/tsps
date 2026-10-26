/**
 * XTEA as used on the rev 241 login block.
 *
 * Matches blurite/rsprot `crypto/src/main/kotlin/net/rsprot/crypto/xtea/XteaByteBufExt.kt`
 * (commit 37c4eb46e4731ae6764343d136f3076a50567ec1): delta `0x9E3779B9`, 32 rounds,
 * sum starts at `delta * rounds` for decrypt. Kotlin `+` binds tighter than `xor`,
 * so each mix is `(((v << 4) xor (v >>> 5)) + v) xor (sum + key)`.
 */

const GOLDEN = 0x9e3779b9 | 0;
const ROUNDS = 32;

function mix(value: number): number {
  return ((((value << 4) ^ (value >>> 5)) + value) | 0);
}

function readInt(block: Buffer, offset: number): number {
  return block.readInt32BE(offset);
}

function writeInt(block: Buffer, offset: number, value: number): void {
  block.writeInt32BE(value | 0, offset);
}

export function xteaDecrypt(data: Buffer, key: readonly number[]): Buffer {
  const out = Buffer.from(data);
  const sum0 = Math.imul(GOLDEN, ROUNDS) | 0;
  const full = data.length & ~7;
  for (let offset = 0; offset < full; offset += 8) {
    let v0 = readInt(out, offset);
    let v1 = readInt(out, offset + 4);
    let sum = sum0;
    for (let round = 0; round < ROUNDS; round++) {
      v1 = (v1 - (mix(v0) ^ ((sum + (key[(sum >>> 11) & 3] | 0)) | 0))) | 0;
      sum = (sum - GOLDEN) | 0;
      v0 = (v0 - (mix(v1) ^ ((sum + (key[sum & 3] | 0)) | 0))) | 0;
    }
    writeInt(out, offset, v0);
    writeInt(out, offset + 4, v1);
  }
  return out;
}

export function xteaEncrypt(data: Buffer, key: readonly number[]): Buffer {
  const out = Buffer.from(data);
  const full = data.length & ~7;
  for (let offset = 0; offset < full; offset += 8) {
    let v0 = readInt(out, offset);
    let v1 = readInt(out, offset + 4);
    let sum = 0;
    for (let round = 0; round < ROUNDS; round++) {
      v0 = (v0 + (mix(v1) ^ ((sum + (key[sum & 3] | 0)) | 0))) | 0;
      sum = (sum + GOLDEN) | 0;
      v1 = (v1 + (mix(v0) ^ ((sum + (key[(sum >>> 11) & 3] | 0)) | 0))) | 0;
    }
    writeInt(out, offset, v0);
    writeInt(out, offset + 4, v1);
  }
  return out;
}
