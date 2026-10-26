/**
 * JS5 responses for revision 241.
 *
 * blurite/rsprot `Js5Service.prepareJs5Buffer` (commit 37c4eb46): write the archive
 * byte and group short, then the group bytes (version trailer already removed) in
 * 512-byte blocks separated by 0xFF. The first block is 509 bytes because of the
 * 3-byte header; later blocks are 511 bytes. A non-zero XOR key (client opcode 4)
 * is applied to every output byte.
 *
 * Request opcodes are Js5ClientProtId: 0 prefetch, 1 urgent, 2 logged-in high,
 * 3 logged-in low, 4 XOR change. Urgent/prefetch payload is archive byte + group short.
 * The JS5 stream is not ISAAC'd.
 */

export const JS5_BLOCK = 512;

export const Js5Op = {
  PREFETCH: 0,
  URGENT: 1,
  PRIORITY_HIGH: 2,
  PRIORITY_LOW: 3,
  XOR: 4,
} as const;

export function prepareJs5Buffer(archive: number, group: number, input: Buffer, xor = 0): Buffer {
  const out: number[] = [archive & 0xff, (group >> 8) & 0xff, group & 0xff];
  let offset = 0;
  const first = Math.min(input.length, JS5_BLOCK - 3);
  for (let i = 0; i < first; i++) out.push(input[offset + i]);
  offset += first;
  while (offset < input.length) {
    out.push(0xff);
    const next = Math.min(input.length - offset, JS5_BLOCK - 1);
    for (let i = 0; i < next; i++) out.push(input[offset + i]);
    offset += next;
  }
  if (xor !== 0) {
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ^ xor) & 0xff;
  }
  return Buffer.from(out);
}

/**
 * The on-disk group from FileStore includes the 2-byte version trailer.
 * rsprot's comment on prepareJs5Buffer says that trailer is stripped before framing.
 */
export function stripVersionTrailer(group: Buffer): Buffer {
  if (group.length < 2) return group;
  return group.subarray(0, group.length - 2);
}

export type Js5Request =
  | { kind: "group"; urgent: boolean; archive: number; group: number }
  | { kind: "priority"; high: boolean }
  | { kind: "xor"; key: number };

/**
 * Every Js5ClientProt message is the opcode plus 3 bytes (rsprot `Js5ClientProt`, size 3):
 * 0/1 carry archive byte + group short, 2/3 (priority change, sent on login state change)
 * and 4 (XOR key byte) pad to 3. Treating 2/3 as group requests or reading XOR as 2 bytes
 * desynchronises the stream. Returns null if the buffer is short.
 */
export const JS5_REQUEST_SIZE = 4;

export function readJs5Request(data: Buffer): { request: Js5Request; consumed: number } | null {
  if (data.length < 1) return null;
  const opcode = data[0];
  if (opcode > Js5Op.XOR) {
    throw new Error(`rev241 JS5 opcode ${opcode} is not in Js5ClientProtId 0..4`);
  }
  if (data.length < JS5_REQUEST_SIZE) return null;
  if (opcode === Js5Op.XOR) {
    return { request: { kind: "xor", key: data[1] }, consumed: JS5_REQUEST_SIZE };
  }
  if (opcode === Js5Op.PRIORITY_HIGH || opcode === Js5Op.PRIORITY_LOW) {
    return { request: { kind: "priority", high: opcode === Js5Op.PRIORITY_HIGH }, consumed: JS5_REQUEST_SIZE };
  }
  return {
    request: {
      kind: "group",
      urgent: opcode === Js5Op.URGENT,
      archive: data[1],
      group: (data[2] << 8) | data[3],
    },
    consumed: JS5_REQUEST_SIZE,
  };
}

/**
 * Cuts a stored group to its container: compression byte, int length, (int uncompressed
 * length if compressed), payload. Whatever follows (the 2-byte version trailer most
 * archives carry; archive 255 has none) is dropped. Blindly removing 2 bytes truncated
 * the reference tables, which have no trailer.
 */
export function trimToContainer(group: Buffer): Buffer {
  if (group.length < 5) return group;
  const compression = group[0];
  const length = group.readInt32BE(1);
  const total = (compression === 0 ? 5 : 9) + length;
  if (compression > 3 || length < 0 || total > group.length) return group;
  return group.subarray(0, total);
}

/**
 * The JS5 master index (archive 255, group 255), which is not stored in the cache files.
 * OSRS layout (as RuneLite's cache server and OpenRS2 build it): an uncompressed container
 * holding, per archive 0..max, the CRC32 of that archive's reference table container and
 * the table's version (0 when the table predates versioning or the archive is absent).
 */
export function buildMasterIndex(
  archiveCount: number,
  readTable: (archive: number) => Buffer | null,
  decompress: (container: Buffer) => Buffer,
  crc32: (data: Uint8Array) => number,
): Buffer {
  const body = Buffer.alloc(archiveCount * 8);
  for (let archive = 0; archive < archiveCount; archive++) {
    const raw = readTable(archive);
    if (!raw || raw.length < 5) continue;
    const table = trimToContainer(raw);
    let version = 0;
    try {
      const data = decompress(table);
      if (data.length >= 5 && data[0] >= 6) version = data.readInt32BE(1);
    } catch {
      version = 0;
    }
    body.writeUInt32BE(crc32(table) >>> 0, archive * 8);
    body.writeInt32BE(version, archive * 8 + 4);
  }
  const header = Buffer.alloc(5);
  header[0] = 0;
  header.writeInt32BE(body.length, 1);
  return Buffer.concat([header, body]);
}