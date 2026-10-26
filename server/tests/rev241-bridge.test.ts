/**
 * Revision 241 bridge. These tests build the bytes from the encoders cited in
 * server/docs/rev241-bridge.md and read them back. They do not open a socket
 * to Jagex and they do not boot the game world.
 */
import * as assert from "node:assert/strict";
import { once } from "node:events";
import * as net from "net";
import { describe, it } from "node:test";
import { IsaacRandom } from "../src/main/typescript/elvarg/net/security/IsaacRandom";
import { framePacket, frameServer, isaacPair, readClientPacket, readServerPacket } from "../src/main/typescript/elvarg/net/rev241/Frame";
import { JagIn, JagOut } from "../src/main/typescript/elvarg/net/rev241/JagBuf";
import { buildMasterIndex, prepareJs5Buffer, readJs5Request, stripVersionTrailer, trimToContainer } from "../src/main/typescript/elvarg/net/rev241/Js5";
import { decodeLoginPacket, encodeLoginPacket } from "../src/main/typescript/elvarg/net/rev241/LoginBlock";
import { NpcInfoState } from "../src/main/typescript/elvarg/net/rev241/NpcInfo";
import { CLIENT_PACKET_SIZES, ClientOp, LoginOp, REV241, ServerOp } from "../src/main/typescript/elvarg/net/rev241/opcodes";
import {
  applyVarbit,
  encodeInvFull,
  encodeLoginOk,
  encodeRebuildRegion,
  encodeVarpSmall,
  LOGIN_OK_PAYLOAD,
  referenceZone,
} from "../src/main/typescript/elvarg/net/rev241/Packets";
import { packCoord, PlayerInfoState, singleCellOpcode } from "../src/main/typescript/elvarg/net/rev241/PlayerInfo";
import { generateRsaMaterial, rsaPrivateDecrypt } from "../src/main/typescript/elvarg/net/rev241/RsaKeys";
import { Rev241Server } from "../src/main/typescript/elvarg/net/rev241/Rev241Server";
import { Rev241Translator, splitCustomFrames } from "../src/main/typescript/elvarg/net/rev241/Translate";
import { decodeRev241Packet } from "../src/main/typescript/elvarg/net/rev241/Inbound";
import { xteaDecrypt, xteaEncrypt } from "../src/main/typescript/elvarg/net/rev241/Xtea";

const SPAWN_X = 3089;
const SPAWN_Y = 3524;

class BitReader {
  private bit = 0;
  constructor(private readonly data: Buffer) {}
  public read(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i++) {
      const byte = this.data[this.bit >> 3] ?? 0;
      value = (value << 1) | ((byte >> (7 - (this.bit & 7))) & 1);
      this.bit++;
    }
    return value >>> 0;
  }
}

function customFrame(opcode: number, payload: Buffer, size: number): Buffer {
  if (size === -1) return Buffer.concat([Buffer.from([opcode, payload.length]), payload]);
  if (size === -2) return Buffer.concat([Buffer.from([opcode, payload.length >> 8, payload.length & 0xff]), payload]);
  return Buffer.concat([Buffer.from([opcode]), payload]);
}

describe("rev 241 bytes", () => {
  it("round-trips the Jagex alt transforms", () => {
    const out = new JagOut().p1Alt1(5).p1Alt3(9).p2Alt1(0x1234).p2Alt3(400).p4Alt2(0x01020304);
    const input = new JagIn(out.toBuffer());
    assert.equal(input.g1Alt1(), 5);
    assert.equal(input.g1Alt3(), 9);
    assert.equal(input.g2Alt1(), 0x1234);
    assert.equal(input.g2Alt3(), 400);
    assert.equal(input.g4Alt2(), 0x01020304);
  });

  it("round-trips XTEA a block at a time", () => {
    const key = [0x11111111, 0x22222222, 0x33333333, 0x44444444];
    const plain = Buffer.from("username\0padpad", "latin1");
    const back = xteaDecrypt(xteaEncrypt(plain, key), key);
    assert.deepEqual(back, plain);
  });

  it("does not advance ISAAC when the client packet is short", () => {
    const cipher = new IsaacRandom([1, 2, 3, 4]);
    const before = cipher.clone().nextInt();
    const framed = frameServer(ServerOp.SET_MAP_FLAG_V2, new JagOut().p4(1).toBuffer(), new IsaacRandom([1, 2, 3, 4]));
    assert.equal(readClientPacket(framed.subarray(0, 1), cipher), null);
    assert.equal(cipher.nextInt(), before);
  });

  it("keeps the cited client opcode sizes", () => {
    assert.equal(CLIENT_PACKET_SIZES.length, 102);
    assert.equal(CLIENT_PACKET_SIZES[52], null);
    assert.equal(CLIENT_PACKET_SIZES[ClientOp.MOVE_GAMECLICK], -1);
    assert.equal(CLIENT_PACKET_SIZES[ClientOp.CLIENT_CHEAT], -1);
    assert.equal(CLIENT_PACKET_SIZES[ClientOp.OPNPC1], 4);
    assert.equal(CLIENT_PACKET_SIZES[ClientOp.OPLOC1], 8);
    assert.equal(CLIENT_PACKET_SIZES[ClientOp.IF_BUTTON], 4);
    assert.equal(REV241, 241);
  });

  it("decrypts a short RSA block the way Java BigInteger does (no left padding)", () => {
    const material = generateRsaMaterial();
    const plain = Buffer.from([1, 0, 0, 0, 5, 0xab, 0xcd]);
    // What the client sends: new BigInteger(plain).modPow(65537, n).toByteArray()
    const m = BigInt("0x" + plain.toString("hex"));
    const n = BigInt(material.modulus);
    let r = 1n, b = m, e = 65537n;
    while (e > 0n) { if (e & 1n) r = (r * b) % n; b = (b * b) % n; e >>= 1n; }
    let hex = r.toString(16); if (hex.length % 2) hex = "0" + hex;
    let cipher = Buffer.from(hex, "hex");
    if (cipher[0] & 0x80) cipher = Buffer.concat([Buffer.from([0]), cipher]);
    assert.deepEqual(rsaPrivateDecrypt(material, cipher), plain);
  });
  it("decrypts a login block with our RSA key", () => {
    const material = generateRsaMaterial();
    const seed = [5, 6, 7, 8];
    const session = 0x1122334455667788n;
    const built = encodeLoginPacket({ material, sessionId: session, seed, username: "Test", password: "secret" });
    assert.equal(built.opcode, 16);
    const decoded = decodeLoginPacket(built.packet.subarray(3), material, session);
    assert.equal(decoded.username, "Test");
    assert.equal(decoded.password, "secret");
    assert.equal(decoded.version, 241);
    assert.deepEqual(decoded.seed, seed);
  });

  it("frames JS5 in 512-byte blocks with an 0xFF separator", () => {
    const group = Buffer.alloc(600, 7);
    const framed = prepareJs5Buffer(2, 10, stripVersionTrailer(Buffer.concat([group, Buffer.from([1, 2])])), 0);
    assert.equal(framed[0], 2);
    assert.equal(framed.readUInt16BE(1), 10);
    assert.equal(framed[512], 0xff);
    const request = readJs5Request(Buffer.from([1, 2, 0, 10]));
    assert.equal(request?.request.kind, "group");
    if (request?.request.kind === "group") assert.equal(request.request.group, 10);
  });

  it("reads every JS5 message as opcode + 3 bytes (rsprot Js5ClientProt size 3)", () => {
    const stream = Buffer.from([3, 0, 0, 0, 4, 0x5a, 0, 0, 1, 255, 0, 255]);
    const a = readJs5Request(stream);
    assert.deepEqual(a, { request: { kind: "priority", high: false }, consumed: 4 });
    const b = readJs5Request(stream.subarray(4));
    assert.deepEqual(b, { request: { kind: "xor", key: 0x5a }, consumed: 4 });
    const c = readJs5Request(stream.subarray(8));
    assert.deepEqual(c, { request: { kind: "group", urgent: true, archive: 255, group: 255 }, consumed: 4 });
    assert.equal(readJs5Request(Buffer.from([4, 1])), null);
    assert.throws(() => readJs5Request(Buffer.from([6, 0, 0, 0])));
  });

  it("trims groups to their container instead of always dropping 2 bytes", () => {
    const table = Buffer.from([0, 0, 0, 0, 3, 9, 8, 7]);
    assert.deepEqual(trimToContainer(table), table);
    assert.deepEqual(trimToContainer(Buffer.concat([table, Buffer.from([0, 5])])), table);
    const gz = Buffer.from([2, 0, 0, 0, 1, 0, 0, 0, 9, 0xaa, 0, 1]);
    assert.equal(trimToContainer(gz).length, 10);
  });

  it("builds the 255/255 master index as crc + version per archive", () => {
    const t0 = Buffer.from([0, 0, 0, 0, 5, 6, 0, 0, 0, 42]);
    const index = buildMasterIndex(
      3,
      (a) => (a === 0 ? t0 : null),
      (c) => c.subarray(5),
      () => 0xdeadbeef,
    );
    assert.equal(index[0], 0);
    assert.equal(index.readInt32BE(1), 24);
    assert.equal(index.readUInt32BE(5), 0xdeadbeef);
    assert.equal(index.readInt32BE(9), 42);
    assert.equal(index.readUInt32BE(13), 0);
  });
  it("pads login OK to the client's hardcoded 37 bytes", () => {
    const packet = encodeLoginOk({ index: 1, member: true, accountHash: 99n });
    assert.equal(packet.length, 2 + LOGIN_OK_PAYLOAD);
    assert.equal(packet[0], LoginOp.OK);
    assert.equal(packet[1], 37);
    assert.equal(packet.readUInt16BE(2 + 1 + 4 + 1 + 1), 1);
  });

  it("places the spawn tile in the login rebuild and not in a later one", () => {
    const state = new PlayerInfoState();
    const gpi = state.gpiInit(1, SPAWN_X, SPAWN_Y, 0);
    const bits = new BitReader(gpi);
    assert.equal(bits.read(30), packCoord(0, SPAWN_X, SPAWN_Y));
    assert.equal(bits.read(18), 0);
    const tail = new JagOut().p2(SPAWN_Y >> 3).p2Alt1(SPAWN_X >> 3).p2(0).toBuffer();
    assert.deepEqual(tail, Buffer.from([0x01, 0xb8, 0x82, 0x01, 0x00, 0x00]));
    const info = state.encode({
      index: 1, x: SPAWN_X, y: SPAWN_Y, z: 0,
      extended: {
        appearance: {
          gender: 0, skull: -1, overhead: -1,
          kits: [3, 14, 18, 26, 34, 38, 42],
          colours: [2, 14, 5, 4, 0],
          equipment: new Array(12).fill(-1),
          name: "Test", combatLevel: 3, skillLevel: 32,
        },
      },
    });
    // Appearance strings are pdataAlt1, so the name bytes are reversed.
    assert.ok(info.includes(Buffer.from("tseT")));
    const still = state.encode({ index: 1, x: SPAWN_X, y: SPAWN_Y, z: 0 });
    const walked = state.encode({ index: 1, x: SPAWN_X, y: SPAWN_Y + 1, z: 0 });
    assert.ok(still.length > 0);
    assert.ok(walked.length > 0);
    assert.equal(singleCellOpcode(0, 1), 6);
  });

  it("writes a region rebuild without XTEA keys", () => {
    const chunks = new Array<number | -1>(4 * 13 * 13).fill(-1);
    chunks[0] = referenceZone(1, 0, 400, 400);
    const body = encodeRebuildRegion(50, 60, true, chunks);
    assert.equal(body.readUInt16BE(0), 50);
    const marker = Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
    assert.equal(body.includes(marker), false);
    const bits = new BitReader(body.subarray(7));
    assert.equal(bits.read(1), 1);
    assert.equal(bits.read(26), chunks[0]);
  });

  it("folds a varbit into the varp and encodes inventory", () => {
    const merged = applyVarbit(0, { baseVar: 10, startBit: 2, endBit: 4 }, 5);
    assert.equal(merged, 5 << 2);
    const small = encodeVarpSmall(10, merged);
    const back = new JagIn(small);
    assert.equal(back.g1Alt3(), merged);
    assert.equal(back.g2Alt1(), 10);
    const inv = encodeInvFull(149 << 16, 93, [{ id: 995, count: 1000 }, null]);
    const view = new JagIn(inv);
    assert.equal(view.g4() >>> 16, 149);
    assert.equal(view.g2(), 93);
    assert.equal(view.g2(), 2);
    assert.equal(view.g2Alt1(), 996);
    assert.equal(view.g1Alt3(), 255);
    assert.equal(view.g4Alt2(), 1000);
  });

  it("decodes a walk and a :: command", () => {
    const seed = [9, 8, 7, 6];
    const encode = new IsaacRandom(seed);
    const walk = new JagOut().p1Alt1(1).p2Alt2(SPAWN_Y).p2Alt2(SPAWN_X).toBuffer();
    const cheat = new JagOut().pjstr("tfaroom").toBuffer();
    const bytes = Buffer.concat([
      framePacket(ClientOp.MOVE_GAMECLICK, -1, walk, encode),
      framePacket(ClientOp.CLIENT_CHEAT, -1, cheat, encode),
    ]);
    const decode = new IsaacRandom(seed);
    const first = readClientPacket(bytes, decode);
    assert.ok(first);
    const move = decodeRev241Packet(first.packet.opcode, first.packet.payload);
    assert.deepEqual(move, { type: "move", worldX: SPAWN_X, worldY: SPAWN_Y, modifierFlags: 1 });
    const second = readClientPacket(bytes.subarray(first.consumed), first.cipher);
    assert.ok(second);
    const command = decodeRev241Packet(second.packet.opcode, second.packet.payload);
    assert.deepEqual(command, { type: "chat", text: "::tfaroom", messageType: "public" });
  });

  it("translates a browser rebuild into a login rebuild and drops the browser opcode", () => {
    const translator = new Rev241Translator({
      observe: () => ({
        index: 1, x: SPAWN_X, y: SPAWN_Y, z: 0, name: "Test", member: true, npcs: [],
        appearance: {
          gender: 0, skull: -1, overhead: -1,
          kits: [3, 14, 18, 26, 34, 38, 42],
          colours: [2, 14, 5, 4, 0],
          equipment: new Array(12).fill(-1),
          name: "Test", combatLevel: 3, skillLevel: 32,
        },
      }),
    });
    const seed = [1, 2, 3, 4];
    translator.arm(isaacPair(seed).encode, 1, "Test", true);
    const keys = [[0x11111111, 0x22222222, 0x33333333, 0x44444444]];
    const browser = Buffer.alloc(7 + 16);
    browser.writeUInt16BE(SPAWN_X >> 3);
    browser.writeUInt16BE(SPAWN_Y >> 3, 2);
    browser[4] = 1;
    browser.writeUInt16BE(1, 5);
    keys[0].forEach((value, index) => browser.writeInt32BE(value, 7 + index * 4));
    const frame = customFrame(141, browser, -2);
    const tick = customFrame(1, Buffer.alloc(8), 0);
    const out = translator.translate(Buffer.concat([frame, tick]));
    const reader = isaacPair(seed).encode;
    const rebuild = readServerPacket(out, reader);
    assert.ok(rebuild);
    assert.equal(rebuild.packet.opcode, ServerOp.REBUILD_NORMAL_V2);
    assert.equal(rebuild.packet.payload.includes(Buffer.from([0x11, 0x11, 0x11, 0x11])), false);
    assert.ok(rebuild.packet.payload.length > 6);
    const end = readServerPacket(out.subarray(rebuild.consumed), rebuild.cipher);
    assert.equal(end?.packet.opcode, ServerOp.SERVER_TICK_END);
    assert.equal(splitCustomFrames(frame)[0].opcode, 141);
  });

  it("builds frames in write order so ISAAC opcodes stay in step", () => {
    const observed = {
      index: 1, x: SPAWN_X, y: SPAWN_Y, z: 0, name: "Test", member: true, npcs: [],
      appearance: {
        gender: 0, skull: -1, overhead: -1,
        kits: [3, 14, 18, 26, 34, 38, 42],
        colours: [2, 14, 5, 4, 0],
        equipment: new Array(12).fill(-1),
        name: "Test", combatLevel: 3, skillLevel: 32,
      },
    };
    const seed = [5, 6, 7, 8];
    const read = (out: Buffer): number[] => {
      const ops: number[] = [];
      let cipher = isaacPair(seed).encode;
      let rest = out;
      while (rest.length > 0) {
        const next = readServerPacket(rest, cipher);
        assert.ok(next);
        ops.push(next.packet.opcode);
        cipher = next.cipher;
        rest = rest.subarray(next.consumed);
      }
      return ops;
    };
    const rebuild = Buffer.alloc(7);
    rebuild.writeUInt16BE(SPAWN_X >> 3);
    rebuild.writeUInt16BE(SPAWN_Y >> 3, 2);
    // Browser order: player sync, then the rebuild, then NPC info and the tick.
    const translator = new Rev241Translator({ observe: () => observed });
    translator.arm(isaacPair(seed).encode, 1, "Test", true);
    const out = translator.translate(Buffer.concat([
      customFrame(20, Buffer.alloc(0), -2),
      customFrame(141, rebuild, -2),
      customFrame(21, Buffer.alloc(0), -2),
      customFrame(1, Buffer.alloc(8), 0),
    ]));
    assert.deepEqual(read(out), [ServerOp.REBUILD_NORMAL_V2, ServerOp.PLAYER_INFO, ServerOp.NPC_INFO_SMALL_V6, ServerOp.SERVER_TICK_END]);

    // A first burst without a rebuild still leads with the login rebuild.
    const early = new Rev241Translator({ observe: () => observed });
    early.arm(isaacPair(seed).encode, 1, "Test", true);
    const first = early.translate(Buffer.concat([customFrame(20, Buffer.alloc(0), -2), customFrame(1, Buffer.alloc(8), 0)]));
    assert.deepEqual(read(first), [ServerOp.REBUILD_NORMAL_V2, ServerOp.PLAYER_INFO, ServerOp.SERVER_TICK_END]);
  });

  it("adds an NPC and then reports no movement", () => {
    const state = new NpcInfoState();
    const added = state.encode(SPAWN_X, SPAWN_Y, [{ index: 4, id: 16673, x: SPAWN_X + 1, y: SPAWN_Y, z: 0 }]);
    const bits = new BitReader(added);
    assert.equal(bits.read(8), 0);
    assert.equal(bits.read(16), 4);
    const still = state.encode(SPAWN_X, SPAWN_Y, [{ index: 4, id: 16673, x: SPAWN_X + 1, y: SPAWN_Y, z: 0 }]);
    const again = new BitReader(still);
    assert.equal(again.read(8), 1);
    assert.equal(again.read(1), 0);
  });
});

describe("rev 241 login socket", () => {
  it("completes handshake, login and a rebuild at the world spawn", async () => {
    const material = generateRsaMaterial();
    const server = new Rev241Server({
      host: "127.0.0.1",
      port: 0,
      material,
      onLogin: (login, link) => {
        assert.equal(login.username, "Test");
        assert.equal(login.password, "secret");
        link.finishLogin({ index: 1, x: SPAWN_X, y: SPAWN_Y, z: 0, name: "Test", member: true });
      },
    });
    const port = await server.listen();
    try {
      const socket = net.connect({ host: "127.0.0.1", port });
      await once(socket, "connect");
      socket.write(Buffer.from([14]));
      const received: Buffer[] = [];
      socket.on("data", (chunk) => received.push(chunk));
      const waitFor = async (size: number): Promise<Buffer> => {
        for (let i = 0; i < 50; i++) {
          const all = Buffer.concat(received);
          if (all.length >= size) return all;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error(`short read, have ${Buffer.concat(received).length} of ${size}`);
      };
      const hello = await waitFor(9);
      assert.equal(hello[0], 0);
      const session = hello.readBigInt64BE(1);
      const seed = [4, 3, 2, 1];
      const login = encodeLoginPacket({ material, sessionId: session, seed, username: "Test", password: "secret" });
      socket.write(login.packet);
      const ok = await waitFor(9 + 2 + LOGIN_OK_PAYLOAD);
      const response = ok.subarray(9);
      assert.equal(response[0], LoginOp.OK);
      assert.equal(response[1], 37);
      const clientDecode = isaacPair(seed).encode;
      let rebuild: ReturnType<typeof readServerPacket> = null;
      for (let i = 0; i < 50 && !rebuild; i++) {
        const game = await waitFor(9 + 2 + LOGIN_OK_PAYLOAD + 1);
        rebuild = readServerPacket(game.subarray(9 + 2 + LOGIN_OK_PAYLOAD), clientDecode);
        if (!rebuild) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(rebuild, "rebuild packet");
      assert.equal(rebuild.packet.opcode, ServerOp.REBUILD_NORMAL_V2);
      const gpi = new BitReader(rebuild.packet.payload);
      assert.equal(gpi.read(30), packCoord(0, SPAWN_X, SPAWN_Y));
      assert.deepEqual(rebuild.packet.payload.subarray(rebuild.packet.payload.length - 6), Buffer.from([0x01, 0xb8, 0x82, 0x01, 0x00, 0x00]));
      const afterRebuild = Buffer.concat(received).subarray(9 + 2 + LOGIN_OK_PAYLOAD + rebuild.consumed);
      const player = readServerPacket(afterRebuild, rebuild.cipher);
      assert.equal(player?.packet.opcode, ServerOp.PLAYER_INFO);
      assert.ok(player?.packet.payload.includes(Buffer.from("tseT")));
      socket.destroy();
    } finally {
      await server.close();
    }
  });
});
