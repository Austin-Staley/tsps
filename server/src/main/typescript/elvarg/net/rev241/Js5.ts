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
  | { kind: "xor"; key: number };

/** Reads one JS5 request. Returns null if the buffer is short. */
export function readJs5Request(data: Buffer): { request: Js5Request; consumed: number } | null {
  if (data.length < 1) return null;
  const opcode = data[0];
  if (opcode === Js5Op.XOR) {
    if (data.length < 2) return null;
    return { request: { kind: "xor", key: data[1] }, consumed: 2 };
  }
  if (
    opcode === Js5Op.PREFETCH || opcode === Js5Op.URGENT
    || opcode === Js5Op.PRIORITY_HIGH || opcode === Js5Op.PRIORITY_LOW
  ) {
    if (data.length < 4) return null;
    const archive = data[1];
    const group = (data[2] << 8) | data[3];
    return {
      request: {
        kind: "group",
        urgent: opcode === Js5Op.URGENT || opcode === Js5Op.PRIORITY_HIGH,
        archive,
        group,
      },
      consumed: 4,
    };
  }
  throw new Error(`TODO: rev241 JS5 opcode ${opcode} is not in Js5ClientProtId 0..4`);
}
