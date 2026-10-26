/**
 * Revision 241 login block.
 *
 * Layout from blurite/rsprot `LoginBlockDecoder` and `GameLoginDecoder`
 * (commit 37c4eb46). The header is 15 bytes, then a big-endian short of RSA
 * ciphertext. Decrypted plaintext starts with check byte 1, four seed ints,
 * the session id long, then the authenticator and the password/token string.
 * The remainder of the packet is XTEA-encrypted with those four seeds; the
 * username is the first C-string of that plaintext.
 *
 * Host-platform stats and the CRC block follow the username. They are consumed
 * by a stock client but this server does not validate CRCs (a private cache
 * checksum is not Jagex's). Bytes after the username are ignored.
 */
import { JagIn, JagOut } from "./JagBuf";
import { rsaPrivateDecrypt, rsaPublicEncrypt, type RsaMaterial } from "./RsaKeys";
import { xteaDecrypt, xteaEncrypt } from "./Xtea";

export type DecodedLogin = {
  version: number;
  username: string;
  password: string;
  /** 2 when the password field is a remembered-login token (auth type 2). */
  flags: number;
  seed: number[];
  sessionId: bigint;
  reconnect: boolean;
};

const OTP_NONE = 2;
const AUTH_PASSWORD = 0;
const AUTH_TOKEN = 2;
const AUTH_MOBILE_PASSWORD = 5;

export function decodeLoginPacket(payload: Buffer, material: RsaMaterial, expectedSession: bigint): DecodedLogin {
  const input = new JagIn(payload);
  const version = input.g4();
  input.g4(); // subVersion
  input.g4(); // serverVersion
  input.g1(); // clientType
  input.g1(); // platformType
  input.g1(); // externalAuthenticatorType
  const rsaSize = input.g2();
  const cipher = input.bytes(rsaSize);
  const plain = new JagIn(rsaPrivateDecrypt(material, cipher));
  const check = plain.g1();
  if (check !== 1) {
    throw new Error(`rev241 RSA check byte was ${check}; the client modulus does not match this server`);
  }
  const seed = [plain.g4(), plain.g4(), plain.g4(), plain.g4()];
  const sessionId = plain.g8();
  if (sessionId !== expectedSession) {
    throw new Error("rev241 login session id does not match the value issued at opcode 14");
  }
  const otp = plain.g1();
  if (otp === OTP_NONE) plain.skip(4);
  else if (otp === 0) plain.g4();
  else if (otp === 1 || otp === 3) plain.skip(4);
  else throw new Error(`TODO: rev241 OTP type ${otp} is not documented in GameLoginDecoder`);
  const auth = plain.g1();
  const secret = plain.gjstr();
  const flags = auth === AUTH_TOKEN ? 2 : 0;
  if (auth !== AUTH_PASSWORD && auth !== AUTH_TOKEN && auth !== AUTH_MOBILE_PASSWORD) {
    throw new Error(`TODO: rev241 authentication type ${auth} is not in GameLoginDecoder`);
  }
  const xtea = xteaDecrypt(input.bytes(input.remaining), seed);
  const username = new JagIn(xtea).gjstr();
  return { version, username, password: secret, flags, seed, sessionId, reconnect: false };
}

/** Builds a login payload a test client (or a stock client with our modulus) would send. */
export function encodeLoginPacket(options: {
  material: RsaMaterial;
  sessionId: bigint;
  seed: readonly number[];
  username: string;
  password: string;
  version?: number;
  reconnect?: boolean;
}): { opcode: number; packet: Buffer } {
  const version = options.version ?? 241;
  const rsa = new JagOut();
  rsa.p1(1);
  for (const part of options.seed) rsa.p4(part);
  rsa.p8(options.sessionId);
  rsa.p1(OTP_NONE).p4(0);
  rsa.p1(AUTH_PASSWORD).pjstr(options.password);
  // Like the client: encrypt just the written bytes, not a modulus-sized block.
  const rsaBytes = rsa.toBuffer();
  if (BigInt("0x" + rsaBytes.toString("hex")) >= BigInt(options.material.modulus)) {
    throw new Error("rev241 RSA plaintext exceeds the modulus");
  }
  const encrypted = rsaPublicEncrypt(options.material, rsaBytes);
  const xteaPlain = new JagOut().pjstr(options.username).toBuffer();
  const padded = Buffer.alloc((xteaPlain.length + 7) & ~7);
  xteaPlain.copy(padded);
  const xtea = xteaEncrypt(padded, options.seed);
  const body = new JagOut();
  body.p4(version).p4(1).p4(1).p1(0).p1(0).p1(0);
  body.p2(encrypted.length).raw(encrypted).raw(xtea);
  const payload = body.toBuffer();
  const packet = Buffer.alloc(3 + payload.length);
  packet[0] = options.reconnect ? 18 : 16;
  packet.writeUInt16BE(payload.length, 1);
  payload.copy(packet, 3);
  return { opcode: packet[0], packet };
}


