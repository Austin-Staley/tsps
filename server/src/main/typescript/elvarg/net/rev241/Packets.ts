/**
 * Revision 241 server packet bodies.
 *
 * Each writer follows the rsprot encoder named in the comment, commit 37c4eb46.
 * Login OK follows `OkLoginResponseEncoder` plus the hardcoded size byte 37 in
 * `GameLoginResponseHandler` (the payload is 34 bytes; three zero bytes pad it).
 * Rebuild normal follows `RebuildNormalV2Encoder`. The GPI block in front of a
 * login rebuild is `PlayerInfo.handleAbsolutePlayerPositions`, which
 * `StaticRebuildV2Decoder` (rsprox 46719fd1) reads when the packet is at least
 * MINIMUM_REBUILD_LOGIN_CAPACITY. Later rebuilds are exactly the 6-byte tail.
 * Rebuild region follows `RebuildRegionV2Decoder`: zone header, a mapsquare
 * count, then the 4×13×13 bit area. Revision 237 removed the XTEA keys
 * (rsprot WHATSNEW). Keys are not written.
 */
import { BitWriter } from "../protocol/BitWriter";
import { JagOut } from "./JagBuf";
import { LoginOp, ServerOp } from "./opcodes";
import { PlayerInfoState, packCoord } from "./PlayerInfo";

export const LOGIN_OK_PAYLOAD = 37;
const CHATBOX_MODAL = (162 << 16) | 568;
const MAIN_MODAL = (161 << 16) | 16;
export const MAIN_INVENTORY_COMBINED = 149 << 16;
/** OSRS backpack container. 3214 is the old widget id the browser client still uses. */
export const BACKPACK_INVENTORY_ID = 93;

/**
 * TODO: live run energy is often percent×100 (10000 = 100%). rsprot writes the
 * value it is given (`UpdateRunEnergyEncoder`) and does not document the scale.
 * This constant is the assumption; change it if the orb is wrong.
 */
export const RUN_ENERGY_SCALE = 100;

export function encodeLoginOk(options: {
  index: number;
  member: boolean;
  accountHash?: bigint;
  staffModLevel?: number;
  playerMod?: boolean;
}): Buffer {
  const hash = options.accountHash ?? 0n;
  const body = new JagOut();
  body.p1(0).p4(0);
  body.p1(options.staffModLevel ?? 0);
  body.pboolean(options.playerMod === true);
  body.p2(options.index & 0xffff);
  body.pboolean(options.member);
  body.p8(hash).p8(hash).p8(hash);
  const payload = body.toBuffer();
  if (payload.length > LOGIN_OK_PAYLOAD) throw new Error("rev241 login ok exceeded 37 bytes");
  const packet = Buffer.alloc(2 + LOGIN_OK_PAYLOAD);
  packet[0] = LoginOp.OK;
  packet[1] = LOGIN_OK_PAYLOAD;
  payload.copy(packet, 2);
  return packet;
}

export function encodeLoginFailure(opcode: number): Buffer {
  return Buffer.from([opcode & 0xff]);
}

export function rebuildNormalTail(zoneX: number, zoneZ: number, worldArea = 0): Buffer {
  return new JagOut().p2(zoneZ).p2Alt1(zoneX).p2(worldArea).toBuffer();
}

export function encodeRebuildNormal(state: PlayerInfoState, x: number, y: number, z: number, zoneX: number, zoneZ: number, login: boolean): Buffer {
  const tail = rebuildNormalTail(zoneX, zoneZ, 0);
  if (!login) return tail;
  return Buffer.concat([state.gpiInit(state.localIndex, x, y, z), tail]);
}

export type RegionChunk = { level: number; x: number; z: number; packed: number };

/** 26-bit template chunk. Matches `TemplatedInstanceArea.packTemplateChunk` and rsprot ReferenceZone. */
export function referenceZone(rotation: number, level: number, zoneX: number, zoneZ: number): number {
  return ((rotation & 3) << 1) | ((zoneZ & 0x7ff) << 3) | ((zoneX & 0x3ff) << 14) | ((level & 3) << 24);
}

export function encodeRebuildRegion(zoneX: number, zoneZ: number, reload: boolean, chunks: Array<number | -1>): Buffer {
  if (chunks.length !== 4 * 13 * 13) throw new Error(`rev241 region palette has ${chunks.length} chunks`);
  const squares = new Set<number>();
  for (const packed of chunks) {
    if (packed === -1) continue;
    const zx = (packed >>> 14) & 0x3ff;
    const zz = (packed >>> 3) & 0x7ff;
    squares.add(((zx >>> 3) << 8) | (zz >>> 3));
  }
  const bits = new BitWriter();
  for (const packed of chunks) {
    if (packed === -1) bits.writeBits(1, 0);
    else {
      bits.writeBits(1, 1);
      bits.writeBits(26, packed & 0x3ffffff);
    }
  }
  const header = new JagOut().p2(zoneX).p1Alt2(reload ? 1 : 0).p2Alt1(zoneZ).p2(squares.size);
  return Buffer.concat([header.toBuffer(), bits.toBuffer()]);
}

export function encodeIfOpenTop(interfaceId: number): Buffer {
  return new JagOut().p2Alt2(interfaceId).toBuffer();
}

export function encodeIfOpenSub(destination: number, interfaceId: number, type: number): Buffer {
  return new JagOut().p4Alt3(destination).p2Alt2(interfaceId).p1Alt1(type).toBuffer();
}

export function encodeIfCloseSub(combinedId: number): Buffer {
  return new JagOut().p4(combinedId).toBuffer();
}

export function encodeIfSetText(combinedId: number, text: string): Buffer {
  return new JagOut().p4(combinedId).pjstr(text).toBuffer();
}

export function encodeIfSetHide(combinedId: number, hidden: boolean): Buffer {
  return new JagOut().p4Alt1(combinedId).p1(hidden ? 1 : 0).toBuffer();
}

export function encodeIfSetObject(combinedId: number, obj: number, count: number): Buffer {
  return new JagOut().p2Alt3(obj).p4Alt2(combinedId).p4Alt2(count).toBuffer();
}

export function encodeIfSetEvents(combinedId: number, start: number, end: number, events1: number, events2: number): Buffer {
  return new JagOut().p4Alt2(events1).p2Alt3(end).p2Alt1(start).p4(combinedId).p4Alt1(events2).toBuffer();
}

export function encodeVarpSmall(id: number, value: number): Buffer {
  return new JagOut().p1Alt3(value).p2Alt1(id).toBuffer();
}

export function encodeVarpLarge(id: number, value: number): Buffer {
  return new JagOut().p2Alt3(id).p4Alt3(value).toBuffer();
}

export function encodeVarp(id: number, value: number): { opcode: number; payload: Buffer } {
  if (value >= 0 && value <= 255) return { opcode: ServerOp.VARP_SMALL, payload: encodeVarpSmall(id, value) };
  return { opcode: ServerOp.VARP_LARGE, payload: encodeVarpLarge(id, value) };
}

export type VarpBit = { baseVar: number; startBit: number; endBit: number };

/** Folds a varbit into its varp. The Jagex client has no varbit packet. */
export function applyVarbit(current: number, bit: VarpBit, value: number): number {
  const width = bit.endBit - bit.startBit + 1;
  const mask = (1 << width) - 1;
  const cleared = current & ~(mask << bit.startBit);
  return (cleared | ((value & mask) << bit.startBit)) | 0;
}

export type InvSlot = { id: number; count: number } | null;

export function encodeInvFull(combinedId: number, inventoryId: number, slots: InvSlot[]): Buffer {
  const out = new JagOut().p4(combinedId).p2(inventoryId).p2(slots.length);
  for (const slot of slots) {
    if (!slot || slot.id < 0 || slot.count <= 0) {
      out.p2Alt1(0).p1Alt3(0);
      continue;
    }
    out.p2Alt1((slot.id + 1) & 0xffff);
    out.p1Alt3(Math.min(slot.count, 255));
    if (slot.count >= 255) out.p4Alt2(slot.count);
  }
  return out.toBuffer();
}

export function encodeStat(stat: number, xp: number, level: number, invisible = level): Buffer {
  // TODO: invisibleBoostedLevel is the uncapped level. tsps sends one level, used for both fields.
  return new JagOut().p4Alt1(xp).p1Alt1(invisible).p1Alt2(stat).p1Alt2(level).toBuffer();
}

export function encodeRunEnergy(percent: number): Buffer {
  const scaled = Math.max(0, Math.min(100, percent)) * RUN_ENERGY_SCALE;
  return new JagOut().p2(scaled).toBuffer();
}

export function encodeMessageGame(message: string, type = 0, name?: string): Buffer {
  const out = new JagOut().pSmart1or2(type);
  if (name) out.p1(1).pjstr(name);
  else out.p1(0);
  return out.pjstr(message).toBuffer();
}

export function encodeMapFlag(level: number, x: number, z: number): Buffer {
  return new JagOut().p4(packCoord(level, x, z)).toBuffer();
}

export function encodeMapFlagClear(): Buffer {
  return new JagOut().p4(-1).toBuffer();
}

export function encodeSynth(id: number, loops: number, delay: number): Buffer {
  return new JagOut().p2(id).p1(loops).p2(delay).toBuffer();
}

export function encodeSong(id: number, fadeOutDelay: number, fadeOutSpeed: number, fadeInDelay: number, fadeInSpeed: number): Buffer {
  return new JagOut().p2Alt1(id).p2Alt1(fadeOutSpeed).p2Alt2(fadeInDelay).p2(fadeOutDelay).p2(fadeInSpeed).toBuffer();
}

/**
 * `ProjAnimSpecificV4Encoder`. Target and source index 0xFFFFFF means "no actor".
 * TODO: the sentinel is the common 24-bit empty index; confirm against a capture if projectiles miss.
 */
export const PROJ_INDEX_NONE = 0xffffff;

export function encodeProjectile(projectile: {
  id: number;
  startX: number;
  startY: number;
  startLevel: number;
  startHeight: number;
  endX: number;
  endY: number;
  endLevel: number;
  endHeight: number;
  startTime: number;
  endTime: number;
  progress: number;
  angle: number;
  sourceIndex?: number;
  targetIndex?: number;
}): Buffer {
  return new JagOut()
    .p2(projectile.startTime)
    .p2Alt2(projectile.id)
    .p3Alt2(projectile.targetIndex ?? PROJ_INDEX_NONE)
    .p2Alt1(projectile.progress)
    .p4Alt3(packCoord(projectile.startLevel, projectile.startX, projectile.startY))
    .p2(projectile.startHeight)
    .p2Alt3(projectile.endHeight)
    .p2Alt1(projectile.endTime)
    .p3(projectile.sourceIndex ?? PROJ_INDEX_NONE)
    .p4(packCoord(projectile.endLevel, projectile.endX, projectile.endY))
    .p1Alt3(projectile.angle)
    .toBuffer();
}

/** South-west tile of the 8×8 zone, inside the 104×104 build area. */
export function zoneOrigin(worldX: number, worldY: number, baseX: number, baseY: number): { zoneX: number; zoneZ: number; localX: number; localZ: number } {
  const localX = worldX - baseX;
  const localZ = worldY - baseY;
  return { zoneX: localX & ~7, zoneZ: localZ & ~7, localX: localX & 7, localZ: localZ & 7 };
}

export function coordInZone(localX: number, localZ: number): number {
  return ((localX & 7) << 4) | (localZ & 7);
}

export function locProperties(shape: number, rotation: number): number {
  return ((shape & 0x1f) << 2) | (rotation & 3);
}

/** `UpdateZonePartialFollowsEncoder`: level, zoneZ, zoneX. */
export function encodeZonePartialFollows(level: number, zoneX: number, zoneZ: number): Buffer {
  return new JagOut().p1Alt1(level).p1Alt1(zoneZ).p1(zoneX).toBuffer();
}

/** `LocAddChangeV2Encoder` with no per-op name overrides. */
export function encodeLocAdd(id: number, shape: number, rotation: number, localX: number, localZ: number, opFlags = 0): Buffer {
  return new JagOut()
    .p1Alt1(locProperties(shape, rotation))
    .p1(opFlags)
    .p1Alt1(coordInZone(localX, localZ))
    .p1Alt2(0)
    .p2(id)
    .toBuffer();
}

/**
 * Obj add inside an enclosed zone update. `ObjAddEncoder` (rsprot zone payload).
 * TODO: ownershipType 0 and the time fields are server ticks; the client may want client cycles.
 */
export function encodeObjAdd(id: number, quantity: number, localX: number, localZ: number, privateItem: boolean): Buffer {
  return new JagOut()
    .p1Alt2(0)
    .p1Alt3(coordInZone(localX, localZ))
    .p2Alt1(id)
    .p2Alt2(privateItem ? 0 : 100)
    .p1Alt2(0)
    .p4(quantity)
    .p2Alt3(0)
    .p1Alt3(privateItem ? 1 : 0)
    .toBuffer();
}

export function modalDestination(modal: boolean): number {
  return modal ? MAIN_MODAL : CHATBOX_MODAL;
}

export { CHATBOX_MODAL, MAIN_MODAL };
