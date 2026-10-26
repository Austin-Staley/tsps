/**
 * Revision 241 NPC info, small viewport (6-bit deltas).
 *
 * High-resolution count and movement bits match blurite/rsprot `NpcInfo.kt`
 * `processHighResolution` and `NpcAvatar` (`pNoUpdate`, `pExtendedInfo`,
 * `pWalk`, `pRun`, removal `pBits(1,1)+pBits(2,3)`) at commit 37c4eb46.
 * Adding an NPC matches `DesktopLowResolutionChangeEncoder`. The 0xFFFF
 * terminator is written only when extended-info bytes follow.
 *
 * Extended-info flag bits are `NpcAvatarExtendedInfoDesktopWriter`:
 * EXTENDED_SHORT 0x10, EXTENDED_MEDIUM 0x2000, EXTENDED_INT 0x40000,
 * SPOTANIM 0x4, SEQUENCE 0x8, SAY 0x40, HITMARKS 0x10000.
 * Hit and sequence bodies reuse the shared Hitmark and Sequence encoders.
 * NPC spotanim and say bodies are the shared player encoders; if a capture
 * shows they differ, that is a TODO on those two blocks only.
 */
import { BitWriter } from "../protocol/BitWriter";
import { JagOut } from "./JagBuf";
import { singleCellOpcode, type PlayerHitView, type PlayerSpotView } from "./PlayerInfo";

const TYPE_WIDTHS = [12, 14, 17, 24];
const SPAWN_WIDTHS = [18, 19, 20, 32];

export type NpcView = {
  index: number;
  id: number;
  x: number;
  y: number;
  z: number;
  /** 3-bit facing written by DesktopLowResolutionChangeEncoder. tsps Direction.getId(), or 0. */
  direction?: number;
  remove?: boolean;
  teleport?: boolean;
  say?: string;
  hits?: PlayerHitView[];
  sequence?: { id: number; delay: number };
  spotanims?: PlayerSpotView[];
};

type Known = { id: number; x: number; y: number; z: number };

function typeBits(id: number): { index: number; width: number } {
  for (let i = 0; i < TYPE_WIDTHS.length; i++) {
    if (id <= (1 << TYPE_WIDTHS[i]) - 1) return { index: i, width: TYPE_WIDTHS[i] };
  }
  return { index: 3, width: 24 };
}

function encodeNpcExtended(npc: NpcView): Buffer | null {
  const parts: Array<{ flag: number; bytes: Buffer }> = [];
  if (npc.spotanims?.length) {
    const out = new JagOut().p1Alt2(npc.spotanims.length);
    for (const spot of npc.spotanims) {
      out.p1Alt2(spot.slot).p2Alt2(spot.id);
      out.p4((spot.delay & 0xffff) | ((spot.height & 0xffff) << 16));
      out.p1(spot.loop ? 1 : 0);
    }
    parts.push({ flag: 0x4, bytes: out.toBuffer() });
  }
  if (npc.sequence) {
    parts.push({ flag: 0x8, bytes: new JagOut().p2Alt2(npc.sequence.id).p1Alt1(npc.sequence.delay).toBuffer() });
  }
  if (npc.say != null) parts.push({ flag: 0x40, bytes: new JagOut().pjstr(npc.say).toBuffer() });
  if (npc.hits?.length) {
    const out = new JagOut().p1(Math.min(255, npc.hits.length));
    for (const hit of npc.hits.slice(0, 255)) {
      out.pSmart1or2(hit.type).pSmart1or2(hit.value).pSmart1or2(hit.delay ?? 0).pSmart1or2(hit.limit ?? hit.value);
    }
    parts.push({ flag: 0x10000, bytes: out.toBuffer() });
  }
  if (parts.length === 0) return null;
  let flag = 0;
  for (const part of parts) flag |= part.flag;
  if ((flag & ~0xff) !== 0) flag |= 0x10;
  if ((flag & ~0xffff) !== 0) flag |= 0x2000;
  if ((flag & ~0xffffff) !== 0) flag |= 0x40000;
  const out = new JagOut().p1(flag);
  if ((flag & 0x10) !== 0) out.p1(flag >> 8);
  if ((flag & 0x2000) !== 0) out.p1(flag >> 16);
  if ((flag & 0x40000) !== 0) out.p1(flag >> 24);
  for (const wanted of [0x4, 0x8, 0x40, 0x10000]) {
    const part = parts.find((entry) => entry.flag === wanted);
    if (part) out.raw(part.bytes);
  }
  return out.toBuffer();
}

function writeAdd(bits: BitWriter, npc: NpcView, originX: number, originY: number, extended: boolean): void {
  const dx = npc.x - originX;
  const dz = npc.y - originY;
  const large = Math.abs(dx) > 31 || Math.abs(dz) > 31;
  const width = large ? 8 : 6;
  const mask = large ? 0xff : 0x3f;
  const type = typeBits(npc.id & 0xffffff);
  bits.writeBits(16, npc.index & 0xffff);
  bits.writeBits(width, dz & mask);
  bits.writeBits(1, 1);
  bits.writeBits(3, (npc.direction ?? 0) & 7);
  bits.writeBits(1, 0);
  bits.writeBits(1, extended ? 1 : 0);
  bits.writeBits(2, type.index);
  bits.writeBits(type.width, npc.id);
  bits.writeBits(width, dx & mask);
  void SPAWN_WIDTHS;
}

/**
 * Observes NPCs for one player. A count of 0 drops every high-resolution NPC,
 * which is what rsprot sends when the player teleports further than the viewport.
 */
export class NpcInfoState {
  private readonly known = new Map<number, Known>();

  public clear(): void {
    this.known.clear();
  }

  public encode(originX: number, originY: number, npcs: NpcView[], teleport = false): Buffer {
    const bits = new BitWriter();
    const extended: Buffer[] = [];
    if (teleport) this.known.clear();
    const present = new Map(npcs.filter((npc) => !npc.remove).map((npc) => [npc.index, npc]));

    if (this.known.size === 0 || teleport) {
      bits.writeBits(8, 0);
    } else {
      const ids = [...this.known.keys()];
      let count = ids.length;
      for (let i = ids.length - 1; i >= 0; i--) {
        const npc = present.get(ids[i]);
        if (!npc || npc.teleport) count = i;
        else break;
      }
      bits.writeBits(8, count);
      for (let i = 0; i < count; i++) {
        const previous = this.known.get(ids[i])!;
        const npc = present.get(ids[i]);
        if (!npc || npc.teleport) {
          bits.writeBits(1, 1);
          bits.writeBits(2, 3);
          this.known.delete(ids[i]);
          continue;
        }
        const block = encodeNpcExtended(npc);
        const dx = npc.x - previous.x;
        const dz = npc.y - previous.y;
        const moved = dx !== 0 || dz !== 0 || npc.z !== previous.z;
        if (!moved && !block) {
          bits.writeBits(1, 0);
        } else if (!moved && block) {
          bits.writeBits(1, 1);
          bits.writeBits(2, 0);
          extended.push(block);
        } else if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && npc.z === previous.z) {
          bits.writeBits(1, 1);
          bits.writeBits(2, 1);
          bits.writeBits(3, singleCellOpcode(dx, dz));
          bits.writeBits(1, block ? 1 : 0);
          if (block) extended.push(block);
        } else if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2 && npc.z === previous.z) {
          bits.writeBits(1, 1);
          bits.writeBits(2, 2);
          bits.writeBits(1, 1);
          const first = dx === 0 && dz === 0 ? 0 : singleCellOpcode(Math.sign(dx), Math.sign(dz));
          const restX = dx - Math.sign(dx);
          const restZ = dz - Math.sign(dz);
          bits.writeBits(3, first);
          bits.writeBits(3, singleCellOpcode(restX, restZ));
          bits.writeBits(1, block ? 1 : 0);
          if (block) extended.push(block);
        } else {
          bits.writeBits(1, 1);
          bits.writeBits(2, 3);
          this.known.delete(ids[i]);
        }
      }
    }

    for (const npc of npcs) {
      if (npc.remove || this.known.has(npc.index)) continue;
      const block = encodeNpcExtended(npc);
      writeAdd(bits, npc, originX, originY, !!block);
      if (block) extended.push(block);
      this.known.set(npc.index, { id: npc.id, x: npc.x, y: npc.y, z: npc.z });
    }
    for (const [index, npc] of present) {
      if (this.known.has(index)) this.known.set(index, { id: npc.id, x: npc.x, y: npc.y, z: npc.z });
    }
    for (const index of [...this.known.keys()]) {
      if (!present.has(index)) this.known.delete(index);
    }
    if (extended.length > 0) bits.writeBits(16, 0xffff);
    return bits.toBuffer();
  }
}
