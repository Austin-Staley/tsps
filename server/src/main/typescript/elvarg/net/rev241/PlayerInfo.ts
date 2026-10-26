/**
 * Revision 241 player info and the login GPI block.
 *
 * Bit order is blurite/rsprot `PlayerInfo.kt` (commit 37c4eb46):
 * `handleAbsolutePlayerPositions`, then `pBitcodes` (high-res was-moving,
 * high-res was-stationary, low-res was-moving, low-res was-stationary).
 * Stationary run-length matches `pStationary`. Movement opcodes match
 * `CellOpcodes.kt` and `prepareHighResMovement`.
 *
 * Appearance bytes match `PlayerAppearanceEncoder`. Extended-info flags and
 * write order match `PlayerAvatarExtendedInfoDesktopWriter`. Hits, sequence,
 * spotanim and chat match the encoders of those names in the same tree.
 * The public-chat Huffman block is only written when a bit-length table is
 * supplied; without one the caller sends the text as a game message.
 */
import { BitWriter } from "../protocol/BitWriter";
import { JagOut } from "./JagBuf";

export const PLAYER_CAPACITY = 2048;

/** Wearpos 0..11 → ident-kit slot. `Appearance.identKitSlotList` in rsprot. */
export const IDENT_KIT_SLOT_LIST = [-1, -1, -1, -1, 2, -1, 3, 5, 0, 4, 6, 1];

const SINGLE_CELL = buildSingle();
const DUAL_CELL = buildDual();

function buildSingle(): number[] {
  const table = new Array<number>(16).fill(-1);
  const index = (dx: number, dz: number) => (dx + 1) | ((dz + 1) << 2);
  table[index(-1, -1)] = 0;
  table[index(0, -1)] = 1;
  table[index(1, -1)] = 2;
  table[index(-1, 0)] = 3;
  table[index(1, 0)] = 4;
  table[index(-1, 1)] = 5;
  table[index(0, 1)] = 6;
  table[index(1, 1)] = 7;
  return table;
}

function buildDual(): number[] {
  const table = new Array<number>(64).fill(-1);
  const index = (dx: number, dz: number) => (dx + 2) | ((dz + 2) << 3);
  const pairs: Array<[number, number, number]> = [
    [-2, -2, 0], [-1, -2, 1], [0, -2, 2], [1, -2, 3], [2, -2, 4],
    [-2, -1, 5], [2, -1, 6], [-2, 0, 7], [2, 0, 8], [-2, 1, 9], [2, 1, 10],
    [-2, 2, 11], [-1, 2, 12], [0, 2, 13], [1, 2, 14], [2, 2, 15],
  ];
  for (const [dx, dz, opcode] of pairs) table[index(dx, dz)] = opcode;
  return table;
}

export function singleCellOpcode(dx: number, dz: number): number {
  return SINGLE_CELL[(dx + 1) | ((dz + 1) << 2)] ?? -1;
}

export function dualCellOpcode(dx: number, dz: number): number {
  return DUAL_CELL[(dx + 2) | ((dz + 2) << 3)] ?? -1;
}

/** `CoordGrid.packed`: level in the top 2 bits, then 14-bit x, then 14-bit z. */
export function packCoord(level: number, x: number, z: number): number {
  return ((level & 3) << 28) | ((x & 0x3fff) << 14) | (z & 0x3fff);
}

export type AppearanceView = {
  gender: number;
  /** -1 is written as 0xff (no icon). */
  skull: number;
  overhead: number;
  /** Ident kits in slot order hair, beard, body, arms, gloves, legs, boots. */
  kits: number[];
  colours: number[];
  /** Item id per appearance wearpos 0..11, or -1. */
  equipment: number[];
  name: string;
  combatLevel: number;
  skillLevel: number;
  hidden?: boolean;
  anims?: number[];
};

const DEFAULT_ANIMS = [808, 823, 819, 820, 821, 822, 824];

export function encodeAppearance(view: AppearanceView): Buffer {
  const body = new JagOut();
  body.p1(view.gender & 0xff);
  body.p1(view.skull < 0 ? 0xff : view.skull & 0xff);
  body.p1(view.overhead < 0 ? 0xff : view.overhead & 0xff);
  for (let wearpos = 0; wearpos < 12; wearpos++) {
    const obj = view.equipment[wearpos] ?? -1;
    if (obj !== -1 && (obj & 0xffff) !== 0xffff) {
      body.p2((obj & 0xffff) + 0x800);
      continue;
    }
    const kitSlot = IDENT_KIT_SLOT_LIST[wearpos];
    const kit = kitSlot < 0 ? -1 : (view.kits[kitSlot] ?? -1);
    if (kitSlot < 0 || kit <= 0 || (kit & 0xffff) === 0xffff) body.p1(0);
    else body.p2((kit & 0xffff) + 0x100);
  }
  for (let wearpos = 0; wearpos < 12; wearpos++) {
    const kitSlot = IDENT_KIT_SLOT_LIST[wearpos];
    const kit = kitSlot < 0 ? -1 : (view.kits[kitSlot] ?? -1);
    if (kitSlot < 0 || kit <= 0 || (kit & 0xffff) === 0xffff) body.p1(0);
    else body.p2((kit & 0xffff) + 0x100);
  }
  for (let i = 0; i < 5; i++) body.p1((view.colours[i] ?? 0) & 0xff);
  const anims = view.anims ?? DEFAULT_ANIMS;
  for (let i = 0; i < 7; i++) body.p2(anims[i] ?? DEFAULT_ANIMS[i]);
  body.pjstr(view.name);
  body.p1(view.combatLevel & 0xff);
  body.p2(view.skillLevel & 0xffff);
  body.p1(view.hidden ? 1 : 0);
  body.p2(0);
  body.pjstr("");
  body.pjstr("");
  body.pjstr("");
  body.p1(0);
  const raw = body.toBuffer();
  if (raw.length > 255) throw new Error(`rev241 appearance is ${raw.length} bytes; the length is one byte`);
  return new JagOut().p1Alt2(raw.length).pdataAlt1(raw).toBuffer();
}

export type PlayerHitView = { type: number; value: number; delay?: number; limit?: number };
export type PlayerAnimView = { id: number; delay: number };
export type PlayerSpotView = { slot: number; id: number; height: number; delay: number; loop?: boolean };

const EXTENDED_SHORT = 0x80;
const EXTENDED_MEDIUM = 0x2000;
const SAY = 0x10;
const FACE = 0x20;
const SPOTANIM = 0x4;
const APPEARANCE = 0x2;
const CHAT = 0x400;
const HITMARKS = 0x20000;
const SEQUENCE = 0x40;

export type PlayerExtended = {
  appearance?: AppearanceView;
  say?: string;
  hits?: PlayerHitView[];
  sequence?: PlayerAnimView;
  spotanims?: PlayerSpotView[];
  /** Huffman-compressed public chat. Omitted when no table is loaded. */
  chat?: Buffer;
};

function encodeHits(hits: PlayerHitView[]): Buffer {
  const out = new JagOut();
  const count = Math.min(255, hits.length);
  out.p1(count);
  for (let i = 0; i < count; i++) {
    const hit = hits[i];
    // TODO: hit.limit is the hitsplat cap from rsprot Hitmark. tsps stores damage only, so the damage is repeated.
    out.pSmart1or2(hit.type).pSmart1or2(hit.value).pSmart1or2(hit.delay ?? 0).pSmart1or2(hit.limit ?? hit.value);
  }
  return out.toBuffer();
}

function encodeSequence(sequence: PlayerAnimView): Buffer {
  return new JagOut().p2Alt2(sequence.id).p1Alt1(sequence.delay).toBuffer();
}

function encodeSpotanims(spots: PlayerSpotView[]): Buffer {
  const out = new JagOut().p1Alt2(spots.length);
  for (const spot of spots) {
    out.p1Alt2(spot.slot);
    out.p2Alt2(spot.id);
    out.p4((spot.delay & 0xffff) | ((spot.height & 0xffff) << 16));
    out.p1(spot.loop ? 1 : 0);
  }
  return out.toBuffer();
}

export function encodeExtendedBlock(info: PlayerExtended): Buffer {
  const parts: Array<{ flag: number; bytes: Buffer }> = [];
  if (info.say != null) parts.push({ flag: SAY, bytes: new JagOut().pjstr(info.say).toBuffer() });
  if (info.spotanims?.length) parts.push({ flag: SPOTANIM, bytes: encodeSpotanims(info.spotanims) });
  if (info.appearance) parts.push({ flag: APPEARANCE, bytes: encodeAppearance(info.appearance) });
  if (info.chat) parts.push({ flag: CHAT, bytes: info.chat });
  if (info.hits?.length) parts.push({ flag: HITMARKS, bytes: encodeHits(info.hits) });
  if (info.sequence) parts.push({ flag: SEQUENCE, bytes: encodeSequence(info.sequence) });
  let flag = 0;
  for (const part of parts) flag |= part.flag;
  if ((flag & ~0xff) !== 0) flag |= EXTENDED_SHORT;
  if ((flag & ~0xffff) !== 0) flag |= EXTENDED_MEDIUM;
  const out = new JagOut().p1(flag);
  if ((flag & EXTENDED_SHORT) !== 0) out.p1(flag >> 8);
  if ((flag & EXTENDED_MEDIUM) !== 0) out.p1(flag >> 16);
  const order = [SAY, SPOTANIM, APPEARANCE, CHAT, HITMARKS, SEQUENCE];
  for (const wanted of order) {
    const part = parts.find((entry) => entry.flag === wanted);
    if (part) out.raw(part.bytes);
  }
  return out.toBuffer();
}

function writeStationary(bits: BitWriter, count: number): void {
  const lowerBits = (-count) >>> 31;
  const higherBits = ((-(count >> 5)) >>> 31) + ((-(count >> 8)) >>> 31);
  const opcode = lowerBits + higherBits;
  const valueBits = lowerBits * 5 + higherBits * 3;
  bits.writeBits(3 + valueBits, (count | (opcode << valueBits)) >>> 0);
}

function writeMovement(bits: BitWriter, dx: number, dz: number, dLevel: number): void {
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);
  if (dLevel !== 0 || absX > 2 || absZ > 2) {
    if (absX >= 16 || absZ >= 16) {
      bits.writeBits(2, 3);
      bits.writeBits(1, 1);
      bits.writeBits(2, dLevel & 3);
      bits.writeBits(14, dx & 0x3fff);
      bits.writeBits(14, dz & 0x3fff);
    } else {
      bits.writeBits(2, 3);
      bits.writeBits(1, 0);
      bits.writeBits(2, dLevel & 3);
      bits.writeBits(5, dx & 0x1f);
      bits.writeBits(5, dz & 0x1f);
    }
    return;
  }
  if (absX === 2 || absZ === 2) {
    bits.writeBits(2, 2);
    bits.writeBits(4, dualCellOpcode(dx, dz));
    return;
  }
  bits.writeBits(2, 1);
  bits.writeBits(3, singleCellOpcode(dx, dz));
}

export type TrackedPlayer = {
  index: number;
  x: number;
  y: number;
  z: number;
  extended?: PlayerExtended;
  /** Remove from high resolution (logged out or left view). */
  remove?: boolean;
};

type Coord = { x: number; y: number; z: number };

/**
 * One observer's high-resolution set. The first `encode` after `reset`
 * matches the cycle immediately after `handleAbsolutePlayerPositions`:
 * the local player is high-res and was not stationary, everyone else is
 * low-res and was not stationary, and the coordinate is not sent again.
 */
export class PlayerInfoState {
  localIndex = 1;
  private readonly high = new Set<number>();
  private highOrder: number[] = [];
  private readonly wasStationary = new Uint8Array(PLAYER_CAPACITY);
  private readonly last = new Map<number, Coord>();
  private gpiSent = false;

  public reset(localIndex: number, x: number, y: number, z: number): void {
    this.localIndex = localIndex;
    this.high.clear();
    this.high.add(localIndex);
    this.highOrder = [localIndex];
    this.wasStationary.fill(0);
    this.last.clear();
    this.last.set(localIndex, { x, y, z });
    this.gpiSent = true;
  }

  public hasGpi(): boolean {
    return this.gpiSent;
  }

  /** 30-bit local coord, then 18-bit low-res positions for every other index. */
  public gpiInit(localIndex: number, x: number, y: number, z: number): Buffer {
    this.reset(localIndex, x, y, z);
    const bits = new BitWriter();
    bits.writeBits(30, packCoord(z, x, y));
    for (let i = 1; i < PLAYER_CAPACITY; i++) {
      if (i === localIndex) continue;
      bits.writeBits(18, 0);
    }
    return bits.toBuffer();
  }

  public encode(local: TrackedPlayer, others: TrackedPlayer[] = []): Buffer {
    if (!this.gpiSent) this.gpiInit(local.index, local.x, local.y, local.z);
    const byIndex = new Map<number, TrackedPlayer>();
    byIndex.set(local.index, local);
    for (const other of others) byIndex.set(other.index, other);

    const highList = this.highOrder.slice();
    const lowList: number[] = [];
    for (let i = 1; i < PLAYER_CAPACITY; i++) {
      if (!this.high.has(i)) lowList.push(i);
    }

    const bits = new BitWriter();
    const extended: Buffer[] = [];
    const nowStationary = new Uint8Array(PLAYER_CAPACITY);
    const nextHigh = new Set<number>();

    const movementOf = (index: number): { dx: number; dz: number; dLevel: number } | null => {
      const player = byIndex.get(index);
      const previous = this.last.get(index);
      if (!player || !previous) return null;
      if (player.x === previous.x && player.y === previous.y && player.z === previous.z) return null;
      return { dx: player.x - previous.x, dz: player.y - previous.y, dLevel: player.z - previous.z };
    };

    const finish = (skips: number): number => {
      if (skips > -1) writeStationary(bits, skips);
      return -1;
    };

    const processHigh = (skipStationary: boolean): void => {
      let skips = -1;
      for (const index of highList) {
        const was = this.wasStationary[index] === 1;
        if (skipStationary === was) continue;
        const player = byIndex.get(index);
        const stay = index === local.index || (player != null && !player.remove);
        if (!stay) {
          skips = finish(skips);
          bits.writeBits(4, 1 << 3);
          bits.writeBits(1, 0);
          this.high.delete(index);
          continue;
        }
        nextHigh.add(index);
        const extendedInfo = player?.extended;
        const hasExtended = !!extendedInfo && encodeExtendedBlock(extendedInfo).length > 1;
        const move = movementOf(index);
        if (!hasExtended && !move) {
          skips++;
          nowStationary[index] = 1;
          continue;
        }
        skips = finish(skips);
        bits.writeBits(1, 1);
        bits.writeBits(1, hasExtended ? 1 : 0);
        if (move) writeMovement(bits, move.dx, move.dz, move.dLevel);
        else bits.writeBits(2, 0);
        if (hasExtended && extendedInfo) extended.push(encodeExtendedBlock(extendedInfo));
      }
      finish(skips);
    };

    const processLow = (skipStationary: boolean): void => {
      let skips = -1;
      for (const index of lowList) {
        const was = this.wasStationary[index] === 1;
        if (skipStationary === was) continue;
        const player = byIndex.get(index);
        if (!player || player.remove) {
          skips++;
          nowStationary[index] = 1;
          continue;
        }
        skips = finish(skips);
        const block = player.extended ? encodeExtendedBlock(player.extended) : null;
        const hasExtended = !!block && block.length > 1;
        bits.writeBits(3, 1 << 2);
        bits.writeBits(1, 0);
        bits.writeBits(13, player.x & 0x1fff);
        bits.writeBits(13, player.y & 0x1fff);
        bits.writeBits(1, hasExtended ? 1 : 0);
        if (hasExtended && block) extended.push(block);
        nextHigh.add(index);
        nowStationary[index] = 1;
      }
      finish(skips);
    };

    processHigh(true);
    processHigh(false);
    processLow(false);
    processLow(true);

    for (const [index, player] of byIndex) {
      this.last.set(index, { x: player.x, y: player.y, z: player.z });
    }
    this.high.clear();
    for (const index of nextHigh) this.high.add(index);
    for (const index of highList) {
      if (this.high.has(index) && !nextHigh.has(index)) this.high.delete(index);
    }
    // Keep anyone who stayed from the previous high list even if this call
    // didn't mention them (still in view, no update record). Local always stays.
    for (const index of highList) {
      if (index === local.index || byIndex.has(index) || this.high.has(index)) {
        if (index === local.index || !byIndex.get(index)?.remove) this.high.add(index);
      }
    }
    this.high.add(local.index);
    this.highOrder = [];
    for (let i = 1; i < PLAYER_CAPACITY; i++) {
      if (this.high.has(i)) this.highOrder.push(i);
      this.wasStationary[i] = nowStationary[i];
    }
    bits.alignToByte();
    const body = bits.toBuffer();
    return extended.length === 0 ? body : Buffer.concat([body, ...extended]);
  }
}
