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
export function rsaPrivateDecrypt(material: RsaMaterial, block: Buffer): Buffer {
  return crypto.privateDecrypt(
    { key: material.privatePem, padding: crypto.constants.RSA_NO_PADDING },
    block,
  );
}

export function rsaPublicEncrypt(material: RsaMaterial, block: Buffer): Buffer {
  return crypto.publicEncrypt(
    { key: material.publicPem, padding: crypto.constants.RSA_NO_PADDING },
    block,
  );
}

/** Hex modulus, no leading 00, for a client that wants the raw big-endian integer. */
export function modulusHex(material: RsaMaterial): string {
  return BigInt(material.modulus).toString(16);
}
