/**
 * TCP frontend for an unmodified revision 241 client.
 *
 * Opcode 15 is the JS5 connection (`InitJs5RemoteConnection`). Opcode 14 is
 * the game init (`InitGameConnection`): the server replies 0 and an 8-byte
 * session id. Opcode 16/18 is the login block. Login responses use a nop
 * cipher; game packets after Login OK use ISAAC on the header only
 * (`OutgoingMessageEncoder`, rsprot 37c4eb46).
 *
 * Nothing in this file dials a Jagex host. JS5 bytes come from the local
 * cache directory the rest of the server already uses.
 */
import * as crypto from "crypto";
import * as net from "net";
import type { BinaryChannel } from "../BinaryChannel";
import type { ClientMessage } from "../protocol/ClientProtocol";
import { frameServer, isaacPair, readClientPacket } from "./Frame";
import { prepareJs5Buffer, readJs5Request, stripVersionTrailer } from "./Js5";
import { decodeLoginPacket, type DecodedLogin } from "./LoginBlock";
import { LoginOp, REV241, ServerOp } from "./opcodes";
import { encodeLoginFailure, encodeLoginOk, rebuildNormalTail } from "./Packets";
import type { RsaMaterial } from "./RsaKeys";
import { splitCustomFrames, Rev241Translator, type TranslateContext } from "./Translate";
import { decodeRev241Packet } from "./Inbound";
import { IsaacRandom } from "../security/IsaacRandom";

export type GroupReader = (archive: number, group: number) => Buffer | null;

export type Rev241ServerOptions = {
  host?: string;
  port?: number;
  material: RsaMaterial;
  onLogin: (login: DecodedLogin, link: Rev241Link) => void;
  readGroup?: GroupReader;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 43595;

export function rev241Host(): string {
  return process.env.REV241_HOST || DEFAULT_HOST;
}

export function rev241Port(): number {
  const parsed = Number(process.env.REV241_PORT ?? DEFAULT_PORT);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_PORT;
}

export function rev241Enabled(): boolean {
  return process.env.REV241_ENABLED !== "0";
}

function mapFailure(code: number): number {
  if (code === 2) return 7;
  if (code === 4) return 4;
  if (code === 5) return 5;
  if (code === 6) return LoginOp.CLIENT_OUT_OF_DATE;
  if (code === 8) return 8;
  if (code === 27) return 26;
  return LoginOp.INVALID_USERNAME_OR_PASSWORD;
}

function readCString(payload: Buffer, offset: number): { value: string; next: number } {
  const end = payload.indexOf(0, offset);
  if (end < 0) return { value: "", next: payload.length };
  return { value: payload.toString("latin1", offset, end), next: end + 1 };
}

export class Rev241Link implements BinaryChannel {
  public readonly kind = "tcp" as const;
  public readonly binaryTransport = true as const;
  private readonly translator: Rev241Translator;
  private decode?: IsaacRandom;
  private closed = false;
  private dataHandler?: (data: Buffer) => void;
  private closeHandler?: (code?: number, reason?: Buffer | string) => void;
  private errorHandler?: (err: Error) => void;
  private connection?: { inject(messages: ClientMessage[]): void; noteActivity?: () => void; getPlayer?: () => unknown };
  onArmed?: () => void;

  constructor(
    private readonly socket: net.Socket,
    private readonly seed: number[],
    context: TranslateContext = {},
  ) {
    this.translator = new Rev241Translator(context);
  }

  public get remoteAddress(): string {
    return this.socket.remoteAddress ?? "";
  }

  public get bufferedAmount(): number {
    return this.socket.writableLength;
  }

  public bind(connection: { inject(messages: ClientMessage[]): void; noteActivity?: () => void; getPlayer?: () => unknown }): void {
    this.connection = connection;
  }

  public setContext(context: TranslateContext): void {
    this.translator.setContext(context);
  }

  public send(payload: Buffer): void {
    const frames = payload.length ? splitCustomFrames(payload) : [];
    for (const frame of frames) {
      if (frame.opcode === 3) this.onLoginResponse(frame.payload);
      if (frame.opcode === 2) this.onHandshake(frame.payload);
    }
    if (!this.translator.isLoggedIn()) return;
    const out = this.translator.translate(payload);
    if (out.length > 0) this.write(out);
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.end();
    this.closeHandler?.(1000, "close");
  }

  public onData(handler: (data: Buffer) => void): void {
    this.dataHandler = handler;
  }

  public onClose(handler: (code?: number, reason?: Buffer | string) => void): void {
    this.closeHandler = handler;
  }

  public onError(handler: (err: Error) => void): void {
    this.errorHandler = handler;
  }

  public isOpen(): boolean {
    return !this.closed && !this.socket.destroyed;
  }

  public fail(code: number): void {
    this.write(encodeLoginFailure(mapFailure(code)));
    this.close();
  }

  /** Test and headless login: OK, then a login rebuild with the player standing on `tile`. */
  public finishLogin(tile: { index: number; x: number; y: number; z: number; name: string; member?: boolean }, options: { spawn?: boolean } = {}): void {
    const member = tile.member !== false;
    this.write(encodeLoginOk({ index: tile.index, member, accountHash: hashName(tile.name) }));
    const pair = isaacPair(this.seed);
    this.decode = pair.decode;
    this.translator.arm(pair.encode, tile.index, tile.name, member);
    if (options.spawn !== false) {
      const gpi = this.translator.players.gpiInit(tile.index, tile.x, tile.y, tile.z);
      const rebuild = frameServer(ServerOp.REBUILD_NORMAL_V2, Buffer.concat([gpi, rebuildNormalTail(tile.x >> 3, tile.y >> 3)]), pair.encode);
      const info = frameServer(ServerOp.PLAYER_INFO, this.translator.players.encode({
        index: tile.index, x: tile.x, y: tile.y, z: tile.z,
        extended: {
          appearance: {
            gender: 0, skull: -1, overhead: -1,
            kits: [3, 14, 18, 26, 34, 38, 42],
            colours: [2, 14, 5, 4, 0],
            equipment: new Array(12).fill(-1),
            name: tile.name, combatLevel: 3, skillLevel: 32,
          },
        },
      }), pair.encode);
      const npc = frameServer(ServerOp.NPC_INFO_SMALL_V6, this.translator.npcs.encode(tile.x, tile.y, []), pair.encode);
      const tick = frameServer(ServerOp.SERVER_TICK_END, Buffer.alloc(0), pair.encode);
      this.write(Buffer.concat([rebuild, info, npc, tick]));
    }
    this.onArmed?.();
  }

  public consumeClient(buffer: Buffer): Buffer {
    if (!this.decode) return buffer;
    let rest = buffer;
    const messages: ClientMessage[] = [];
    while (rest.length > 0) {
      let decoded;
      try {
        decoded = readClientPacket(rest, this.decode);
      } catch (error) {
        console.warn("[rev241] client packet rejected", (error as Error).message);
        this.close();
        return Buffer.alloc(0);
      }
      if (!decoded) return rest;
      this.decode = decoded.cipher;
      const message = decodeRev241Packet(decoded.packet.opcode, decoded.packet.payload);
      if (message) messages.push(message);
      rest = rest.subarray(decoded.consumed);
    }
    if (messages.length > 0) {
      this.connection?.noteActivity?.();
      this.connection?.inject(messages);
      this.dataHandler?.(Buffer.alloc(0));
    }
    return rest;
  }

  public socketClosed(): void {
    if (this.closed) return;
    this.closed = true;
    this.closeHandler?.(1006, "socket");
  }

  public socketError(error: Error): void {
    this.errorHandler?.(error);
  }

  private onLoginResponse(payload: Buffer): void {
    if (payload[0] !== 1) {
      const code = payload.length >= 5 ? payload.readInt32BE(1) : 3;
      this.fail(code);
      return;
    }
    const error = readCString(payload, 5);
    const name = readCString(payload, error.next);
    this.connection?.inject([{ type: "handshake", name: name.value, clientType: 0 }]);
  }

  private onHandshake(payload: Buffer): void {
    if (this.translator.isLoggedIn()) return;
    const index = payload.readInt32BE(0);
    const name = readCString(payload, 4).value;
    const member = payload[payload.length - 1] !== 0;
    this.write(encodeLoginOk({ index, member, accountHash: hashName(name) }));
    const pair = isaacPair(this.seed);
    this.decode = pair.decode;
    this.translator.arm(pair.encode, index, name, member);
    this.onArmed?.();
  }

  private write(data: Buffer): void {
    if (!this.isOpen()) return;
    this.socket.write(data);
  }
}

function hashName(name: string): bigint {
  let hash = 0n;
  for (const byte of Buffer.from(name, "utf8")) hash = (hash * 131n + BigInt(byte)) & 0xffffffffffffffffn;
  return hash;
}

type Phase = "init" | "js5" | "login" | "game";

class Rev241Socket {
  private buffer: Buffer = Buffer.alloc(0);
  private phase: Phase = "init";
  private xor = 0;
  private sessionId = 0n;
  private link?: Rev241Link;

  constructor(
    private readonly socket: net.Socket,
    private readonly options: Rev241ServerOptions,
  ) {
    socket.setNoDelay(true);
    socket.on("data", (chunk) => {
      this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
      try {
        this.pump();
      } catch (error) {
        console.warn("[rev241] connection closed", (error as Error).message);
        socket.destroy();
      }
    });
    socket.on("error", (error) => this.link?.socketError(error));
    socket.on("close", () => this.link?.socketClosed());
  }

  private pump(): void {
    if (this.phase === "init") {
      if (this.buffer.length < 1) return;
      const opcode = this.buffer[0];
      if (opcode === 15) {
        if (this.buffer.length < 21) return;
        const revision = this.buffer.readInt32BE(1);
        this.buffer = this.buffer.subarray(21);
        if (revision !== REV241) {
          this.socket.write(Buffer.from([LoginOp.CLIENT_OUT_OF_DATE]));
          this.socket.end();
          return;
        }
        this.socket.write(Buffer.from([0]));
        this.phase = "js5";
      } else if (opcode === 14) {
        this.buffer = this.buffer.subarray(1);
        this.sessionId = crypto.randomBytes(8).readBigInt64BE();
        const reply = Buffer.alloc(9);
        reply[0] = 0;
        reply.writeBigInt64BE(this.sessionId, 1);
        this.socket.write(reply);
        this.phase = "login";
      } else {
        this.socket.end();
        return;
      }
    }
    if (this.phase === "js5") {
      while (this.buffer.length > 0) {
        const request = readJs5Request(this.buffer);
        if (!request) return;
        this.buffer = this.buffer.subarray(request.consumed);
        if (request.request.kind === "xor") {
          this.xor = request.request.key;
          continue;
        }
        const group = this.options.readGroup?.(request.request.archive, request.request.group);
        if (!group) continue;
        this.socket.write(prepareJs5Buffer(request.request.archive, request.request.group, stripVersionTrailer(group), this.xor));
      }
      return;
    }
    if (this.phase === "login") {
      if (this.buffer.length < 3) return;
      const opcode = this.buffer[0];
      if (opcode !== 16 && opcode !== 18) {
        this.socket.end();
        return;
      }
      const size = this.buffer.readUInt16BE(1);
      if (this.buffer.length < 3 + size) return;
      const payload = this.buffer.subarray(3, 3 + size);
      this.buffer = this.buffer.subarray(3 + size);
      const decoded = decodeLoginPacket(payload, this.options.material, this.sessionId);
      decoded.reconnect = opcode === 18;
      if (decoded.version !== REV241) {
        this.socket.write(Buffer.from([LoginOp.CLIENT_OUT_OF_DATE]));
        this.socket.end();
        return;
      }
      this.link = new Rev241Link(this.socket, decoded.seed);
      this.link.onArmed = () => this.pump();
      this.phase = "game";
      this.options.onLogin(decoded, this.link);
    }
    if (this.phase === "game" && this.link && this.buffer.length > 0) {
      this.buffer = this.link.consumeClient(this.buffer);
    }
  }
}

export class Rev241Server {
  private server?: net.Server;
  private readonly sockets = new Set<net.Socket>();

  constructor(private readonly options: Rev241ServerOptions) {}

  public listen(): Promise<number> {
    const host = this.options.host ?? rev241Host();
    const port = this.options.port ?? rev241Port();
    this.server = net.createServer((socket) => {
      this.sockets.add(socket);
      socket.on("close", () => this.sockets.delete(socket));
      new Rev241Socket(socket, this.options);
    });
    return new Promise((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(port, host, () => {
        const address = this.server!.address();
        const bound = typeof address === "object" && address ? address.port : port;
        console.info(`[rev241] listening on ${host}:${bound}`);
        resolve(bound);
      });
    });
  }

  public close(): Promise<void> {
    const server = this.server;
    if (!server) return Promise.resolve();
    for (const socket of this.sockets) socket.destroy();
    return new Promise((resolve) => server.close(() => resolve()));
  }
}

export function readCacheGroup(archive: number, group: number): Buffer | null {
  try {
    const { CachePipeline } = require("../../game/cache/CachePipeline") as typeof import("../../game/cache/CachePipeline");
    const bytes = CachePipeline.getStore().read(archive, group);
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}
