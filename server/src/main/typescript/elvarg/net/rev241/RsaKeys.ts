/**
 * Private-server RSA key for the rev 241 login block.
 *
 * This is NOT Jagex's key (that public modulus still lives in NetworkConstants for the
 * browser client). The bridge generates a 1024-bit key, public exponent 65537, and
 * stores it at `server/data/rev241/rsa.json` so the modulus the Kevlar launcher must
 * embed does not change between restarts.
 *
 * rsprot decrypts the login block with raw RSA (no PKCS#1 padding): the client sends
 * `m^e mod n` and the server recovers `m` with the private exponent. See
 * `LoginBlockDecoder.decodeLoginBlock`.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export type RsaMaterial = {
  /** Decimal modulus. This is the value the client must use. */
  modulus: string;
  /** Decimal private exponent. Server only. */
  privateExponent: string;
  /** PEM PKCS#8 private key, used by Node's RSA_NO_PADDING. */
  privatePem: string;
  /** PEM SPKI public key. */
  publicPem: string;
};

const PUBLIC_EXPONENT = 65537;

export function rsaKeyPath(root = process.cwd()): string {
  return path.join(root, "data", "rev241", "rsa.json");
}

export function generateRsaMaterial(): RsaMaterial {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 1024,
    publicExponent: PUBLIC_EXPONENT,
  });
  const jwk = privateKey.export({ format: "jwk" }) as { n?: string; d?: string };
  if (!jwk.n || !jwk.d) throw new Error("RSA JWK is missing n or d");
  return {
    modulus: BigInt("0x" + Buffer.from(jwk.n, "base64url").toString("hex")).toString(10),
    privateExponent: BigInt("0x" + Buffer.from(jwk.d, "base64url").toString("hex")).toString(10),
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

/** Public half only (safe to copy into a client config): `data/rev241/rsa.public.json`. */
export function rsaPublicPath(root = process.cwd()): string {
  return path.join(root, "data", "rev241", "rsa.public.json");
}

function writePublicExport(root: string, material: RsaMaterial): void {
  const out = JSON.stringify(
    { modulusHex: modulusHex(material), modulus: material.modulus, exponent: PUBLIC_EXPONENT },
    null,
    2,
  );
  const file = rsaPublicPath(root);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== out) fs.writeFileSync(file, out);
}

/**
 * Loads the key, or generates one on first start. rsa.json holds the private exponent and is
 * gitignored; never commit it. The public modulus is also written to rsa.public.json.
 */
export function loadOrCreateRsa(root = process.cwd()): RsaMaterial {
  const file = rsaKeyPath(root);
  let material: RsaMaterial;
  if (fs.existsSync(file)) {
    material = JSON.parse(fs.readFileSync(file, "utf8")) as RsaMaterial;
    if (!material.modulus || !material.privatePem || !material.publicPem) {
      throw new Error(`rev241 RSA key at ${file} is incomplete`);
    }
  } else {
    material = generateRsaMaterial();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(material, null, 2), { mode: 0o600 });
  }
  writePublicExport(root, material);
  return material;
}

export function rsaBlockSize(material: RsaMaterial): number {
  const bytes = (BigInt(material.modulus).toString(16).length + 1) >> 1;
  return bytes;
}

/** Raw RSA, no padding. Input length must equal the modulus size. */
/**
 * Textbook RSA exactly as the Java client and rsprot `decipherRsa` do it:
 * `new BigInteger(block).modPow(exp, mod).toByteArray()`. The client encrypts only the bytes
 * it wrote (check byte 1, seeds, session, auth), not a modulus-sized block, so the plaintext
 * must come back without left padding. Node's RSA_NO_PADDING returned a 128-byte block whose
 * first byte was the 0 padding, which the login read as "check byte 0".
 */
export function rsaPrivateDecrypt(material: RsaMaterial, block: Buffer): Buffer {
  return modPowBytes(block, BigInt(material.privateExponent), BigInt(material.modulus));
}

export function rsaPublicEncrypt(material: RsaMaterial, block: Buffer): Buffer {
  return modPowBytes(block, BigInt(PUBLIC_EXPONENT), BigInt(material.modulus));
}

function modPowBytes(block: Buffer, exponent: bigint, modulus: bigint): Buffer {
  let base = block.length === 0 ? 0n : BigInt("0x" + block.toString("hex")) % modulus;
  let e = exponent;
  let result = 1n;
  while (e > 0n) {
    if (e & 1n) result = (result * base) % modulus;
    base = (base * base) % modulus;
    e >>= 1n;
  }
  return javaByteArray(result);
}

/** BigInteger.toByteArray for a non-negative value: minimal big-endian, sign byte if the top bit is set. */
export function javaByteArray(value: bigint): Buffer {
  let hex = value.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = Buffer.from(hex, "hex");
  return bytes.length > 0 && bytes[0] & 0x80 ? Buffer.concat([Buffer.from([0]), bytes]) : bytes;
}

/** Hex modulus, no leading 00, for a client that wants the raw big-endian integer. */
export function modulusHex(material: RsaMaterial): string {
  return BigInt(material.modulus).toString(16);
}
