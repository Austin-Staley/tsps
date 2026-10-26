/**
 * Game-packet framing after login.
 *
 * blurite/rsprot `OutgoingMessageEncoder.kt` (commit 37c4eb46): the opcode is a
 * `pSmart1or2` (two bytes when the opcode is >= 0x80), then a length byte
 * (VAR_BYTE, size -1) or length short (VAR_SHORT, size -2). Each header byte is
 * then `byte + cipher.nextInt()` (payload bytes are not ciphered).
 *
 * Login responses use a nop cipher (GameLoginResponseHandler writes them before
 * the ISAAC pair is installed). The encode cipher is seeded with `seed[i] + 50`
 * and the decode cipher with the raw seed (`DECODE_SEED_OFFSET = 50`).
 */
import { IsaacRandom } from "../security/IsaacRandom";
import { JagIn, JagOut } from "./JagBuf";
import { CLIENT_PACKET_SIZES, ServerOp } from "./opcodes";

export const ISAAC_SEED_OFFSET = 50;

export function isaacPair(seed: readonly number[]): { encode: IsaacRandom; decode: IsaacRandom } {
  return {
    encode: new IsaacRandom(seed.map((value) => (value + ISAAC_SEED_OFFSET) | 0)),
    decode: new IsaacRandom(seed.map((value) => value | 0)),
  };
}

function headerBytes(opcode: number, size: number, payload: Buffer): number[] {
  const bytes: number[] = [];
  if (opcode < 0x80) bytes.push(opcode & 0xff);
  else {
    const smart = opcode | 0x8000;
    bytes.push((smart >> 8) & 0xff, smart & 0xff);
  }
  if (size === -1) bytes.push(payload.length & 0xff);
  else if (size === -2) bytes.push((payload.length >> 8) & 0xff, payload.length & 0xff);
  else if (payload.length !== size) {
    throw new Error(`rev241 opcode ${opcode} expected ${size} bytes, got ${payload.length}`);
  }
  return bytes;
}

export function framePacket(opcode: number, size: number, payload: Buffer, cipher?: IsaacRandom): Buffer {
  const header = headerBytes(opcode, size, payload);
  if (cipher) {
    for (let i = 0; i < header.length; i++) header[i] = (header[i] + cipher.nextInt()) & 0xff;
  }
  return Buffer.concat([Buffer.from(header), payload]);
}

export type ClientPacket = { opcode: number; payload: Buffer };

/**
 * Pulls one client packet out of a buffer. Returns null if more bytes are needed.
 * `consumed` is how many bytes of `data` the packet used.
 */
/**
 * Pulls one client packet. The returned `cipher` is the input cipher advanced
 * past this packet's header. A short buffer returns null and leaves `cipher` unchanged.
 */
export function readFramedPacket(
  data: Buffer,
  cipher: IsaacRandom,
  sizes: Array<number | null | undefined> | Record<number, number>,
  label: string,
): { packet: ClientPacket; consumed: number; cipher: IsaacRandom } | null {
  if (data.length < 1) return null;
  const probe = cipher.clone();
  const decodeAt = (index: number): number => (data[index] - probe.nextInt()) & 0xff;
  const first = decodeAt(0);
  let header = 1;
  let opcode = first;
  if (first >= 0x80) {
    if (data.length < 2) return null;
    opcode = ((first & 0x7f) << 8) | decodeAt(1);
    header = 2;
  }
  const size = Array.isArray(sizes) ? (opcode < sizes.length ? sizes[opcode] : undefined) : sizes[opcode];
  if (size == null) throw new Error(`TODO: rev241 ${label} opcode ${opcode} has no cited size`);
  let length = size;
  if (size === -1) {
    if (data.length < header + 1) return null;
    length = decodeAt(header);
    header += 1;
  } else if (size === -2) {
    if (data.length < header + 2) return null;
    length = (decodeAt(header) << 8) | decodeAt(header + 1);
    header += 2;
  }
  if (data.length < header + length) return null;
  return {
    packet: { opcode, payload: Buffer.from(data.subarray(header, header + length)) },
    consumed: header + length,
    cipher: probe,
  };
}

export function readClientPacket(
  data: Buffer,
  cipher: IsaacRandom,
): { packet: ClientPacket; consumed: number; cipher: IsaacRandom } | null {
  return readFramedPacket(data, cipher, CLIENT_PACKET_SIZES, "client");
}

export function readServerPacket(
  data: Buffer,
  cipher: IsaacRandom,
): { packet: ClientPacket; consumed: number; cipher: IsaacRandom } | null {
  return readFramedPacket(data, cipher, SERVER_PACKET_SIZES, "server");
}

export function payloadReader(payload: Buffer): JagIn {
  return new JagIn(payload);
}

export function emptyPayload(): Buffer {
  return new JagOut().toBuffer();
}

/**
 * Sizes from rsprox `GameServerProt.kt` (commit 46719fd1), which matches
 * rsprot `GameServerProt` at 37c4eb46. -1 VAR_BYTE, -2 VAR_SHORT.
 */
export const SERVER_PACKET_SIZES: Record<number, number> = {
  [ServerOp.LOGOUT]: 0,
  [ServerOp.SERVER_TICK_END]: 0,
  [ServerOp.UPDATE_RUNENERGY]: 2,
  [ServerOp.IF_SETANIM]: 6,
  [ServerOp.CAM_RESET]: 0,
  [ServerOp.IF_SETTEXT]: -2,
  [ServerOp.VARP_SMALL]: 3,
  [ServerOp.VARP_LONG]: 10,
  [ServerOp.PLAYER_INFO]: -2,
  [ServerOp.UPDATE_INV_PARTIAL]: -2,
  [ServerOp.MIDI_SONG_V2]: 10,
  [ServerOp.REBUILD_REGION_V2]: -2,
  [ServerOp.VARP_LARGE]: 6,
  [ServerOp.IF_CLOSESUB]: 4,
  [ServerOp.LOC_ADD_CHANGE_V2]: -2,
  [ServerOp.UPDATE_ZONE_PARTIAL_FOLLOWS]: 3,
  [ServerOp.IF_SETHIDE]: 5,
  [ServerOp.UPDATE_ZONE_FULL_FOLLOWS]: 3,
  [ServerOp.SYNTH_SOUND]: 5,
  [ServerOp.RESET_ANIMS]: 0,
  [ServerOp.IF_SETEVENTS_V2]: 16,
  [ServerOp.SET_PLAYER_OP]: -1,
  [ServerOp.IF_OPENSUB]: 7,
  [ServerOp.REBUILD_NORMAL_V2]: -2,
  [ServerOp.PROJANIM_SPECIFIC_V4]: 27,
  [ServerOp.UPDATE_ZONE_PARTIAL_ENCLOSED]: -2,
  [ServerOp.UPDATE_STAT_V2]: 7,
  [ServerOp.IF_OPENTOP]: 2,
  [ServerOp.IF_SETOBJECT]: 10,
  [ServerOp.MESSAGE_GAME]: -1,
  [ServerOp.UPDATE_INV_FULL]: -2,
  [ServerOp.NPC_INFO_LARGE_V6]: -2,
  [ServerOp.SET_MAP_FLAG_V2]: 4,
  [ServerOp.NPC_INFO_SMALL_V6]: -2,
};

export function frameServer(opcode: number, payload: Buffer, cipher?: IsaacRandom): Buffer {
  const size = SERVER_PACKET_SIZES[opcode];
  if (size == null) throw new Error(`TODO: rev241 server opcode ${opcode} has no cited size`);
  return framePacket(opcode, size, payload, cipher);
}
