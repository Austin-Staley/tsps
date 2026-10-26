/**
 * Translates the browser client's custom frames into revision 241 packets.
 *
 * The browser opcode bytes are never forwarded. Player and NPC sync are
 * re-encoded from the live entities (the browser bitstreams are a different
 * protocol). Rebuilds are re-encoded without XTEA keys. A varbit is folded
 * into its varp because the Jagex client has no varbit packet.
 */
import { ServerPacketId, SERVER_PACKET_LENGTHS } from "../protocol/ServerPackets";
import { IsaacRandom } from "../security/IsaacRandom";
import { frameServer } from "./Frame";
import { JagOut } from "./JagBuf";
import { NpcInfoState, type NpcView } from "./NpcInfo";
import { ServerOp } from "./opcodes";
import {
  applyVarbit,
  BACKPACK_INVENTORY_ID,
  encodeIfCloseSub,
  encodeIfOpenSub,
  encodeIfOpenTop,
  encodeIfSetEvents,
  encodeIfSetHide,
  encodeIfSetObject,
  encodeIfSetText,
  encodeInvFull,
  encodeLocAdd,
  encodeMapFlag,
  encodeMapFlagClear,
  encodeMessageGame,
  encodeObjAdd,
  encodeProjectile,
  encodeRebuildRegion,
  encodeRunEnergy,
  rebuildNormalTail,
  encodeSong,
  encodeStat,
  encodeSynth,
  encodeVarp,
  encodeZonePartialFollows,
  MAIN_INVENTORY_COMBINED,
  modalDestination,
  zoneOrigin,
  type InvSlot,
  type VarpBit,
} from "./Packets";
import { PlayerInfoState, type AppearanceView, type PlayerExtended, type PlayerHitView, type PlayerSpotView } from "./PlayerInfo";

export type ObservedPlayer = {
  index: number;
  x: number;
  y: number;
  z: number;
  name: string;
  member: boolean;
  appearance: AppearanceView;
  hits?: PlayerHitView[];
  sequence?: { id: number; delay: number };
  spotanims?: PlayerSpotView[];
  say?: string;
  teleport?: boolean;
  npcs: NpcView[];
};

export type TranslateContext = {
  observe?: () => ObservedPlayer | undefined;
  varbit?: (id: number) => VarpBit | undefined;
  /** Public chat Huffman block, if a table is loaded. */
  huffmanChat?: (text: string, colour: number, effects: number) => Buffer | undefined;
};

type CustomFrame = { opcode: number; payload: Buffer };

const loggedUnknown = new Set<number>();

export function splitCustomFrames(data: Buffer): CustomFrame[] {
  const frames: CustomFrame[] = [];
  let offset = 0;
  while (offset < data.length) {
    const opcode = data[offset];
    const expected = SERVER_PACKET_LENGTHS[opcode as ServerPacketId];
    if (expected === undefined) throw new Error(`rev241 bridge saw unknown browser opcode ${opcode}`);
    const header = expected === -2 ? 3 : expected === -1 ? 2 : 1;
    if (offset + header > data.length) break;
    const length = expected === -2 ? data.readUInt16BE(offset + 1) : expected === -1 ? data[offset + 1] : expected;
    const end = offset + header + length;
    if (end > data.length) break;
    frames.push({ opcode, payload: data.subarray(offset + header, end) });
    offset = end;
  }
  return frames;
}

function readString(payload: Buffer, offset: number): { value: string; next: number } {
  const end = payload.indexOf(0, offset);
  if (end < 0) return { value: payload.subarray(offset).toString("latin1"), next: payload.length };
  return { value: payload.toString("latin1", offset, end), next: end + 1 };
}

function once(opcode: number, why: string): void {
  if (loggedUnknown.has(opcode)) return;
  loggedUnknown.add(opcode);
  console.info(`[rev241] TODO: browser opcode ${opcode} is not translated (${why})`);
}

export class Rev241Translator {
  readonly players = new PlayerInfoState();
  readonly npcs = new NpcInfoState();
  private readonly varps = new Map<number, number>();
  private inventory: InvSlot[] = new Array(28).fill(null);
  private cipher?: IsaacRandom;
  private loggedIn = false;
  private rebuilds = 0;
  private baseX = 0;
  private baseY = 0;
  private pendingChat?: Buffer;
  private pendingSay?: string;
  private appearanceKey = "";
  private loginIndex = 1;
  private loginName = "";
  private loginMember = true;

  constructor(private context: TranslateContext = {}) {}

  public setContext(context: TranslateContext): void {
    this.context = context;
  }

  public get encodeCipher(): IsaacRandom | undefined {
    return this.cipher;
  }

  public isLoggedIn(): boolean {
    return this.loggedIn;
  }

  public arm(cipher: IsaacRandom, index: number, name: string, member: boolean): void {
    this.cipher = cipher;
    this.loggedIn = true;
    this.loginIndex = index;
    this.loginName = name;
    this.loginMember = member;
    this.players.localIndex = index;
  }

  /**
   * Turns one concatenated browser write into Jagex frames.
   * Rebuilds and other packets come first, then player info, NPC info, and
   * SERVER_TICK_END when this burst included a tick or any game packet.
   */
  public translate(data: Buffer): Buffer {
    if (!this.loggedIn) return Buffer.alloc(0);
    const frames = splitCustomFrames(data);
    const lead: Buffer[] = [];
    let playerInfo: Buffer | null = null;
    let npcInfo: Buffer | null = null;
    let sawTick = false;
    for (const frame of frames) {
      if (frame.opcode === ServerPacketId.WELCOME || frame.opcode === ServerPacketId.HANDSHAKE || frame.opcode === ServerPacketId.LOGIN_RESPONSE) {
        continue;
      }
      if (frame.opcode === ServerPacketId.TICK) {
        sawTick = true;
        continue;
      }
      if (frame.opcode === ServerPacketId.PLAYER_SYNC) {
        playerInfo = this.playerInfo();
        continue;
      }
      if (frame.opcode === ServerPacketId.NPC_INFO) {
        npcInfo = this.npcInfo();
        continue;
      }
      const translated = this.one(frame);
      if (translated) lead.push(translated);
    }
    const out = [...lead];
    if (playerInfo) out.push(playerInfo);
    if (npcInfo) out.push(npcInfo);
    if ((sawTick || out.length > 0) && this.cipher) out.push(frameServer(ServerOp.SERVER_TICK_END, Buffer.alloc(0), this.cipher));
    return out.length === 0 ? Buffer.alloc(0) : Buffer.concat(out);
  }

  private frame(opcode: number, payload: Buffer): Buffer {
    return frameServer(opcode, payload, this.cipher);
  }

  private observe(): ObservedPlayer | undefined {
    return this.context.observe?.();
  }

  private sceneBase(x: number, y: number): void {
    this.baseX = Math.max(0, (x - 48) & ~7);
    this.baseY = Math.max(0, (y - 48) & ~7);
  }

  private playerInfo(): Buffer {
    const seen = this.observe();
    const extended: PlayerExtended = {};
    const appearance = seen?.appearance ?? {
      gender: 0, skull: -1, overhead: -1, kits: [3, 14, 18, 26, 34, 38, 42],
      colours: [2, 14, 5, 4, 0], equipment: new Array(12).fill(-1),
      name: this.loginName, combatLevel: 3, skillLevel: 32,
    };
    const appearanceKey = JSON.stringify(appearance);
    if (!this.players.hasGpi() || appearanceKey !== this.appearanceKey) {
      extended.appearance = appearance;
      this.appearanceKey = appearanceKey;
    }
    if (this.pendingChat) {
      extended.chat = this.pendingChat;
      this.pendingChat = undefined;
    }
    if (seen?.say) extended.say = seen.say;
    else if (this.pendingSay) extended.say = this.pendingSay;
    this.pendingSay = undefined;
    if (seen?.hits?.length) extended.hits = seen.hits;
    if (seen?.sequence) extended.sequence = seen.sequence;
    if (seen?.spotanims?.length) extended.spotanims = seen.spotanims;
    const local = seen ?? { index: this.loginIndex, x: 3089, y: 3524, z: 0 };
    if (!this.players.hasGpi()) this.sceneBase(local.x, local.y);
    const payload = this.players.encode({
      index: local.index,
      x: local.x,
      y: local.y,
      z: local.z,
      extended,
    });
    return this.frame(ServerOp.PLAYER_INFO, payload);
  }

  private npcInfo(): Buffer {
    const seen = this.observe();
    const payload = this.npcs.encode(seen?.x ?? 0, seen?.y ?? 0, seen?.npcs ?? [], seen?.teleport === true);
    const large = payload.length > 4000;
    return this.frame(large ? ServerOp.NPC_INFO_LARGE_V6 : ServerOp.NPC_INFO_SMALL_V6, payload);
  }

  private one(frame: CustomFrame): Buffer | null {
    const { opcode, payload } = frame;
    switch (opcode) {
      case ServerPacketId.REBUILD_NORMAL:
        return this.rebuildNormal(payload);
      case ServerPacketId.REBUILD_REGION:
        return this.rebuildRegion(payload);
      case ServerPacketId.WIDGET_SET_ROOT:
        return this.frame(ServerOp.IF_OPENTOP, encodeIfOpenTop(payload.readUInt16BE(0)));
      case ServerPacketId.WIDGET_OPEN: {
        const group = payload.readUInt16BE(0);
        const modal = payload[2] === 1;
        return this.frame(ServerOp.IF_OPENSUB, encodeIfOpenSub(modalDestination(modal), group, modal ? 1 : 0));
      }
      case ServerPacketId.WIDGET_OPEN_SUB: {
        const uid = payload.readInt32BE(0);
        const group = payload.readUInt16BE(4);
        const type = payload[6];
        return this.frame(ServerOp.IF_OPENSUB, encodeIfOpenSub(uid, group, type));
      }
      case ServerPacketId.WIDGET_CLOSE_SUB:
        return this.frame(ServerOp.IF_CLOSESUB, encodeIfCloseSub(payload.readInt32BE(0)));
      case ServerPacketId.WIDGET_SET_TEXT: {
        const text = readString(payload, 4);
        return this.frame(ServerOp.IF_SETTEXT, encodeIfSetText(payload.readInt32BE(0), text.value));
      }
      case ServerPacketId.WIDGET_SET_HIDDEN:
        return this.frame(ServerOp.IF_SETHIDE, encodeIfSetHide(payload.readInt32BE(0), payload[4] !== 0));
      case ServerPacketId.WIDGET_SET_ITEM:
        return this.frame(ServerOp.IF_SETOBJECT, encodeIfSetObject(payload.readInt32BE(0), payload.readUInt16BE(4), payload.readInt32BE(6)));
      case ServerPacketId.WIDGET_SET_FLAGS_RANGE:
        return this.frame(ServerOp.IF_SETEVENTS, encodeIfSetEvents(
          payload.readInt32BE(0), payload.readUInt16BE(4), payload.readUInt16BE(6), payload.readInt32BE(8), payload.readInt32BE(8),
        ));
      case ServerPacketId.WIDGET_SET_FLAGS_RANGE_V2:
        // TODO: events1/events2 are the browser flags and op mask. Confirm clicks register on the stock client.
        return this.frame(ServerOp.IF_SETEVENTS, encodeIfSetEvents(
          payload.readInt32BE(0), payload.readUInt16BE(4), payload.readUInt16BE(6), payload.readInt32BE(8), payload.readInt32BE(12),
        ));
      case ServerPacketId.VARP_SMALL:
      case ServerPacketId.VARP_LARGE: {
        const id = payload.readUInt16BE(0);
        const value = opcode === ServerPacketId.VARP_SMALL ? payload[2] : payload.readInt32BE(2);
        this.varps.set(id, value);
        const encoded = encodeVarp(id, value);
        return this.frame(encoded.opcode, encoded.payload);
      }
      case ServerPacketId.VARBIT:
        return this.varbit(payload.readUInt16BE(0), payload.readInt32BE(2));
      case ServerPacketId.INVENTORY_SNAPSHOT:
        return this.inventorySnapshot(payload);
      case ServerPacketId.INVENTORY_SLOT:
        return this.inventorySlot(payload);
      case ServerPacketId.SKILLS_SNAPSHOT:
      case ServerPacketId.SKILLS_DELTA:
        return this.skills(payload);
      case ServerPacketId.RUN_ENERGY:
        return this.frame(ServerOp.UPDATE_RUNENERGY, encodeRunEnergy(payload[0]));
      case ServerPacketId.CHAT_MESSAGE:
        return this.chat(payload);
      case ServerPacketId.DESTINATION: {
        const x = payload.readUInt16BE(0);
        const y = payload.readUInt16BE(2);
        if (x === 0 && y === 0) return this.frame(ServerOp.SET_MAP_FLAG_V2, encodeMapFlagClear());
        const level = this.observe()?.z ?? 0;
        return this.frame(ServerOp.SET_MAP_FLAG_V2, encodeMapFlag(level, x, y));
      }
      case ServerPacketId.LOC_ADD_CHANGE:
        return this.loc(payload, false);
      case ServerPacketId.LOC_DEL:
        return this.loc(payload, true);
      case ServerPacketId.GROUND_ITEMS:
        return this.ground(payload);
      case ServerPacketId.PROJECTILES:
        return this.projectiles(payload);
      case ServerPacketId.SOUND:
        return this.sound(payload);
      case ServerPacketId.PLAY_SONG:
        return this.frame(ServerOp.MIDI_SONG_V2, encodeSong(
          payload.readUInt16BE(0), payload.readUInt16BE(2), payload.readUInt16BE(4), payload.readUInt16BE(6), payload.readUInt16BE(8),
        ));
      case ServerPacketId.LOGOUT_RESPONSE:
        return this.frame(ServerOp.LOGOUT, Buffer.alloc(0));
      case ServerPacketId.WIDGET_RUN_SCRIPT:
      case ServerPacketId.RUN_CLIENT_SCRIPT:
        once(opcode, "client scripts are not forwarded; script 828 and the login script need a cited IF_RUNSCRIPT encoder");
        return null;
      case ServerPacketId.REBUILD_WORLDENTITY:
      case ServerPacketId.WORLDENTITY_INFO:
      case ServerPacketId.CAMERA_CONTROL:
        once(opcode, "world entities and camera packets are not in the M1-M4 encoders");
        return null;
      default:
        once(opcode, "no rev 241 mapping");
        return null;
    }
  }

  private rebuildNormal(payload: Buffer): Buffer {
    const seen = this.observe();
    const zoneX = seen ? seen.x >> 3 : payload.readUInt16BE(0);
    const zoneZ = seen ? seen.y >> 3 : payload.readUInt16BE(2);
    const x = seen?.x ?? zoneX * 8;
    const y = seen?.y ?? zoneZ * 8;
    const z = seen?.z ?? 0;
    this.sceneBase(x, y);
    const login = this.rebuilds === 0;
    this.rebuilds++;
    const body = login
      ? Buffer.concat([this.players.gpiInit(seen?.index ?? this.loginIndex, x, y, z), rebuildNormalTail(zoneX, zoneZ)])
      : rebuildNormalTail(zoneX, zoneZ);
    if (login) this.npcs.clear();
    return this.frame(ServerOp.REBUILD_NORMAL_V2, body);
  }

  private rebuildRegion(payload: Buffer): Buffer {
    const zoneZ = payload.readUInt16BE(0);
    const reload = payload[2] === 1;
    const zoneX = payload.readUInt16BE(3);
    const chunks = readPalette(payload.subarray(7));
    const seen = this.observe();
    if (seen && this.rebuilds === 0) {
      this.sceneBase(seen.x, seen.y);
      const gpi = this.players.gpiInit(seen.index, seen.x, seen.y, seen.z);
      this.rebuilds++;
      return this.frame(ServerOp.REBUILD_REGION_V2, Buffer.concat([gpi, encodeRebuildRegion(zoneX, zoneZ, reload, chunks)]));
    }
    this.rebuilds++;
    this.sceneBase((zoneX << 3), (zoneZ << 3));
    return this.frame(ServerOp.REBUILD_REGION_V2, encodeRebuildRegion(zoneX, zoneZ, reload, chunks));
  }

  private varbit(id: number, value: number): Buffer | null {
    const bit = this.context.varbit?.(id);
    if (!bit) {
      once(ServerPacketId.VARBIT, `varbit ${id} has no cache definition`);
      return null;
    }
    const next = applyVarbit(this.varps.get(bit.baseVar) ?? 0, bit, value);
    this.varps.set(bit.baseVar, next);
    const encoded = encodeVarp(bit.baseVar, next);
    return this.frame(encoded.opcode, encoded.payload);
  }

  private inventorySnapshot(payload: Buffer): Buffer {
    const count = payload.readUInt16BE(0);
    let offset = 2;
    const slots: InvSlot[] = new Array(28).fill(null);
    for (let i = 0; i < count; i++) {
      const slot = payload.readUInt16BE(offset);
      const idPlus = payload.readUInt16BE(offset + 2);
      const small = payload[offset + 4];
      offset += 5;
      let quantity = small;
      if (small === 255) {
        quantity = payload.readInt32BE(offset);
        offset += 4;
      }
      if (slot < slots.length) slots[slot] = idPlus === 0 ? null : { id: idPlus - 1, count: quantity };
    }
    this.inventory = slots;
    return this.frame(ServerOp.UPDATE_INV_FULL, encodeInvFull(MAIN_INVENTORY_COMBINED, BACKPACK_INVENTORY_ID, slots));
  }

  private inventorySlot(payload: Buffer): Buffer {
    const slot = payload.readUInt16BE(0);
    const idPlus = payload.readUInt16BE(2);
    const small = payload[4];
    const quantity = small === 255 ? payload.readInt32BE(5) : small;
    if (slot >= 0 && slot < this.inventory.length) {
      this.inventory[slot] = idPlus === 0 ? null : { id: idPlus - 1, count: quantity };
    }
    return this.frame(ServerOp.UPDATE_INV_FULL, encodeInvFull(MAIN_INVENTORY_COMBINED, BACKPACK_INVENTORY_ID, this.inventory));
  }

  private skills(payload: Buffer): Buffer {
    const count = payload[0];
    const parts: Buffer[] = [];
    let offset = 1;
    for (let i = 0; i < count; i++) {
      const id = payload[offset];
      const xp = payload.readInt32BE(offset + 1);
      const current = payload[offset + 8];
      offset += 10;
      parts.push(this.frame(ServerOp.UPDATE_STAT_V2, encodeStat(id, xp, current)));
    }
    return Buffer.concat(parts);
  }

  private chat(payload: Buffer): Buffer | null {
    const text = readString(payload, 0);
    const type = payload[text.next] ?? 0;
    const from = readString(payload, text.next + 1);
    if (type === 2) {
      const block = this.context.huffmanChat?.(text.value, 0, 0);
      if (block) this.pendingChat = block;
      else {
        once(ServerPacketId.CHAT_MESSAGE, "public chat needs the cache Huffman table; sent as a game message");
        return this.frame(ServerOp.MESSAGE_GAME, encodeMessageGame(text.value, 0, from.value || undefined));
      }
      return null;
    }
    return this.frame(ServerOp.MESSAGE_GAME, encodeMessageGame(text.value, type, from.value || undefined));
  }

  private loc(payload: Buffer, remove: boolean): Buffer {
    const id = remove ? 0 : payload.readUInt16BE(0);
    const x = payload.readUInt16BE(remove ? 0 : 2);
    const y = payload.readUInt16BE(remove ? 2 : 4);
    const level = payload[remove ? 4 : 6];
    const shapeRot = payload[remove ? 5 : 7];
    const shape = shapeRot >> 2;
    const rotation = shapeRot & 3;
    const zone = zoneOrigin(x, y, this.baseX, this.baseY);
    const follows = this.frame(ServerOp.UPDATE_ZONE_PARTIAL_FOLLOWS, encodeZonePartialFollows(level, zone.zoneX, zone.zoneZ));
    if (remove) {
      once(ServerPacketId.LOC_DEL, "LOC_DEL needs the cited zone loc-delete encoder; the follows header is sent without a body");
      return follows;
    }
    const body = this.frame(ServerOp.LOC_ADD_CHANGE_V2, encodeLocAdd(id, shape, rotation, zone.localX, zone.localZ, payload.length > 8 ? payload[8] : 0));
    return Buffer.concat([follows, body]);
  }

  private ground(payload: Buffer): Buffer | null {
    const count = payload.readUInt16BE(4);
    let offset = 6;
    const groups = new Map<string, Buffer[]>();
    for (let i = 0; i < count; i++) {
      const itemId = payload.readUInt16BE(offset + 4);
      const quantity = payload.readInt32BE(offset + 6);
      const x = payload.readUInt16BE(offset + 10);
      const y = payload.readUInt16BE(offset + 12);
      const level = payload[offset + 14];
      const isPrivate = payload[offset + 31] === 1;
      offset += 33;
      const zone = zoneOrigin(x, y, this.baseX, this.baseY);
      const key = `${level}:${zone.zoneX}:${zone.zoneZ}`;
      const list = groups.get(key) ?? [];
      list.push(encodeObjAdd(itemId, quantity, zone.localX, zone.localZ, isPrivate));
      groups.set(key, list);
    }
    if (groups.size === 0) return null;
    const parts: Buffer[] = [];
    for (const [key, objs] of groups) {
      const [level, zoneX, zoneZ] = key.split(":").map(Number);
      const out = new JagOut().p1(zoneZ).p1(zoneX).p1Alt3(level);
      for (const obj of objs) out.p1(9).raw(obj);
      parts.push(this.frame(ServerOp.UPDATE_ZONE_PARTIAL_ENCLOSED, out.toBuffer()));
    }
    return Buffer.concat(parts);
  }

  private projectiles(payload: Buffer): Buffer {
    const count = payload.readUInt16BE(0);
    const parts: Buffer[] = [];
    let offset = 2;
    for (let i = 0; i < count; i++) {
      const id = payload.readUInt16BE(offset);
      const sx = payload.readUInt16BE(offset + 2);
      const sy = payload.readUInt16BE(offset + 4);
      const sz = payload[offset + 6];
      const sh = payload.readUInt16BE(offset + 7);
      const tx = payload.readUInt16BE(offset + 9);
      const ty = payload.readUInt16BE(offset + 11);
      const tz = payload[offset + 13];
      const eh = payload.readUInt16BE(offset + 14);
      const slope = payload[offset + 16];
      const start = payload.readUInt16BE(offset + 19);
      const end = payload.readUInt16BE(offset + 21);
      const sourceKind = payload[offset + 23];
      const sourceIndex = payload.readUInt16BE(offset + 24);
      const targetKind = payload[offset + 26];
      const targetIndex = payload.readUInt16BE(offset + 27);
      offset += 29;
      parts.push(this.frame(ServerOp.PROJANIM_SPECIFIC_V4, encodeProjectile({
        id, startX: sx, startY: sy, startLevel: sz, startHeight: sh,
        endX: tx, endY: ty, endLevel: tz, endHeight: eh,
        startTime: start, endTime: end, progress: 0, angle: slope,
        sourceIndex: sourceKind === 0 ? undefined : sourceIndex,
        targetIndex: targetKind === 0 ? undefined : targetIndex,
      })));
    }
    return Buffer.concat(parts);
  }

  private sound(payload: Buffer): Buffer {
    const id = payload.readUInt16BE(0);
    const positioned = payload[2] === 1;
    if (positioned) {
      once(ServerPacketId.SOUND, "area sounds need the zone SOUND_AREA encoder; a non-positional synth is sent");
    }
    const base = positioned ? 8 : 3;
    const loops = payload[base] ?? 1;
    const delay = payload.readUInt16BE(base + 1);
    return this.frame(ServerOp.SYNTH_SOUND, encodeSynth(id, loops, delay));
  }
}

function readPalette(data: Buffer): Array<number | -1> {
  const chunks: Array<number | -1> = [];
  let bit = 0;
  const read = (count: number): number => {
    let value = 0;
    for (let i = 0; i < count; i++) {
      const byte = data[bit >> 3] ?? 0;
      value = (value << 1) | ((byte >> (7 - (bit & 7))) & 1);
      bit++;
    }
    return value;
  };
  for (let i = 0; i < 4 * 13 * 13; i++) {
    if (read(1) === 0) chunks.push(-1);
    else chunks.push(read(26));
  }
  return chunks;
}
