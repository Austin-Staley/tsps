import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { CacheMaps } from "../cache/CacheMaps";
import { CachePipeline } from "../cache/CachePipeline";
import { Buffer as CollisionBuffer } from "./Buffer";
import { encodeRegionReplacement } from "../../net/protocol/ClientProtocol";

export type ReplaceMapRegionSource = string | [string, string];

type RegionReplacement = {
  regionId: number;
  source: string;
  terrainData: Uint8Array;
  objectData: Uint8Array | null;
};

export type ReplaceMapRegionResult = {
  regionId: number;
  source: string;
  terrainBytes: number;
  objectBytes: number;
  objectCount: number;
};

export class MapRegionReplacementManager {
  // Region replacements use a three-byte variable-packet header, so the
  // payload must leave room inside the browser transport's 64 KiB frame.
  private static readonly MAX_PACKET_PAYLOAD = 0xfffd;

  private static replacements: Map<number, RegionReplacement> = new Map();

  public static replaceMapRegion(
    regionId: number,
    source: ReplaceMapRegionSource
  ): ReplaceMapRegionResult {
    if (!Number.isInteger(regionId) || regionId < 0 || regionId > 0xffff) {
      throw new Error(`invalid regionId: ${regionId}`);
    }

    const loadedSource = this.loadSource(regionId, source);
    return this.register(regionId, loadedSource.terrainData, loadedSource.objectData, loadedSource.resolvedSource);
  }

  public static replaceMapRegionData(
    regionId: number,
    terrainData: Uint8Array,
    objectData: Uint8Array | null,
    source: string = "runtime"
  ): ReplaceMapRegionResult {
    if (!Number.isInteger(regionId) || regionId < 0 || regionId > 0xffff) {
      throw new Error(`invalid regionId: ${regionId}`);
    }
    return this.register(regionId, terrainData, objectData, source);
  }

  /**
   * Clears terrain setting bit 0 (`BLOCKED_TILE`) for one tile, preserving every
   * other setting bit/op, plane and object byte.
   */
  public static clearTerrainBlockTile(
    regionId: number,
    plane: number,
    localX: number,
    localY: number
  ): ReplaceMapRegionResult {
    if (!Number.isInteger(regionId) || regionId < 0 || regionId > 0xffff) {
      throw new Error(`invalid regionId: ${regionId}`);
    }
    if (!Number.isInteger(plane) || plane < 0 || plane > 3) {
      throw new Error(`invalid plane: ${plane}`);
    }
    if (!Number.isInteger(localX) || localX < 0 || localX > 63 ||
        !Number.isInteger(localY) || localY < 0 || localY > 63) {
      throw new Error(`invalid local tile: ${localX},${localY}`);
    }
    const current = this.replacements.get(regionId);
    const base = CacheMaps.getRegion(regionId);
    const terrainData = current?.terrainData ?? base?.terrainData;
    const objectData = current?.objectData ?? base?.objectData ?? null;
    if (!terrainData) {
      throw new Error(`no cache terrain data for region ${regionId}`);
    }
    const modified = this.removeTerrainSettingBit0(terrainData, plane, localX, localY);
    return this.replaceMapRegionData(
      regionId,
      modified,
      objectData,
      `runtime BLOCKED_TILE clear ${regionId}:${plane}:${localX},${localY}`
    );
  }

  private static removeTerrainSettingBit0(
    data: Uint8Array,
    plane: number,
    localX: number,
    localY: number
  ): Uint8Array {
    const wide = CachePipeline.getActive().revision >= 209;
    const opSize = wide ? 2 : 1;
    const buffer = Buffer.from(data);
    const output = Buffer.from(buffer);
    const removals: Array<[number, number]> = [];
    let offset = 0;
    const ensure = (size: number) => {
      if (offset + size > buffer.length) {
        throw new Error(`truncated terrain stream at byte ${offset}`);
      }
    };
    for (let z = 0; z < 4; z++) {
      for (let x = 0; x < 64; x++) {
        for (let y = 0; y < 64; y++) {
          const target = z === plane && x === localX && y === localY;
          for (;;) {
            ensure(opSize);
            const start = offset;
            const opcode = wide ? buffer.readUInt16BE(offset) : buffer.readUInt8(offset);
            offset += opSize;
            if (opcode === 0) {
              break;
            }
            if (opcode === 1) {
              ensure(1);
              offset += 1;
              break;
            }
            if (opcode <= 49) {
              const payloadSize = wide ? 2 : 1;
              ensure(payloadSize);
              offset += payloadSize;
            } else if (opcode <= 81) {
              if (target) {
                const setting = (opcode - 49) & ~1;
                if (setting === 0) {
                  removals.push([start, offset]);
                } else if (wide) {
                  output.writeUInt16BE(49 + setting, start);
                } else {
                  output[start] = 49 + setting;
                }
              }
            }
          }
        }
      }
    }
    if (buffer.length - offset > 1) {
      throw new Error(`trailing terrain bytes: ${buffer.length - offset}`);
    }
    if (removals.length === 0) {
      return output;
    }
    const chunks: Buffer[] = [];
    let cursor = 0;
    for (const [start, end] of removals) {
      chunks.push(output.subarray(cursor, start));
      cursor = end;
    }
    chunks.push(output.subarray(cursor));
    return Buffer.concat(chunks);
  }

  private static register(
    regionId: number,
    terrainData: Uint8Array,
    objectData: Uint8Array | null,
    source: string
  ): ReplaceMapRegionResult {
    const payloadLength = 7 + terrainData.length + (objectData?.length ?? 0);
    if (payloadLength > this.MAX_PACKET_PAYLOAD) {
      throw new Error(
        `region replacement is too large: region=${regionId} bytes=${payloadLength} max=${this.MAX_PACKET_PAYLOAD}`
      );
    }
    const objectCount = this.countObjectPlacements(objectData);

    this.replacements.set(regionId, {
      regionId,
      source,
      terrainData: Uint8Array.from(terrainData),
      objectData: objectData ? Uint8Array.from(objectData) : null,
    });

    return {
      regionId,
      source,
      terrainBytes: terrainData.length,
      objectBytes: objectData?.length ?? 0,
      objectCount,
    };
  }

  public static getReplacementMapData(
    regionId: number
  ): { terrainData: Uint8Array; objectData: Uint8Array | null } | null {
    const replacement = this.replacements.get(regionId);
    if (!replacement) {
      return null;
    }
    return {
      terrainData: replacement.terrainData,
      objectData: replacement.objectData,
    };
  }

  public static getRegionIds(): number[] {
    return Array.from(this.replacements.keys()).sort((a, b) => a - b);
  }

  public static getRegionPack(regionId: number): Buffer | null {
    const replacement = this.replacements.get(regionId);
    const files = CacheMaps.getArchiveIds(regionId);
    if (!replacement || !files || !replacement.objectData) return null;
    const objectData = Buffer.from(replacement.objectData);
    const terrainData = Buffer.from(replacement.terrainData);
    const pack = Buffer.alloc(28 + objectData.length + terrainData.length);
    pack.writeInt32BE(1, 0);
    pack.writeInt32BE(files.objectFile, 4);
    pack.writeInt32BE(files.terrainFile, 8);
    pack.writeInt32BE(regionId >> 8, 12);
    pack.writeInt32BE(regionId & 0xff, 16);
    pack.writeInt32BE(objectData.length, 20);
    objectData.copy(pack, 24);
    pack.writeInt32BE(terrainData.length, 24 + objectData.length);
    terrainData.copy(pack, 28 + objectData.length);
    return pack;
  }

  public static sendAllReplacementsToPlayer(player: any): number {
    let sent = 0;
    const ordered = Array.from(this.replacements.values()).sort(
      (a, b) => a.regionId - b.regionId
    );
    for (const replacement of ordered) {
      if (this.sendPayloadToPlayer(player, replacement, true)) {
        sent++;
      }
    }
    return sent;
  }

  public static sendVisibleReplacementsToPlayer(
    player: any,
    tileX: number,
    tileY: number,
    chunkRadius: number = 6,
    excludeRegionIds: readonly number[] = [],
    allowReload: boolean = true
  ): number {
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return 0;
    }
    const excluded = new Set<number>(excludeRegionIds);
    const visibleRegionIds = this.computeVisibleRegionIds(tileX, tileY, chunkRadius);
    if (visibleRegionIds.size === 0) {
      return 0;
    }

    let sent = 0;
    const orderedIds = Array.from(visibleRegionIds).sort((a, b) => a - b);
    for (const regionId of orderedIds) {
      if (excluded.has(regionId)) {
        continue;
      }
      const replacement = this.replacements.get(regionId);
      if (!replacement) {
        continue;
      }
      if (this.sendPayloadToPlayer(player, replacement, allowReload)) {
        sent++;
      }
    }
    return sent;
  }

  public static sendNonVisibleReplacementsToPlayer(
    player: any,
    tileX: number,
    tileY: number,
    chunkRadius: number = 6
  ): number {
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return this.sendAllReplacementsToPlayer(player);
    }
    const visibleRegionIds = this.computeVisibleRegionIds(tileX, tileY, chunkRadius);
    let sent = 0;
    const ordered = Array.from(this.replacements.values()).sort(
      (a, b) => a.regionId - b.regionId
    );
    for (const replacement of ordered) {
      if (visibleRegionIds.has(replacement.regionId)) {
        continue;
      }
      if (this.sendPayloadToPlayer(player, replacement, true)) {
        sent++;
      }
    }
    return sent;
  }

  public static sendReplacementToPlayer(
    player: any,
    regionId: number,
    allowReload: boolean = true
  ): boolean {
    const replacement = this.replacements.get(regionId);
    if (!replacement) {
      return false;
    }
    return this.sendPayloadToPlayer(player, replacement, allowReload);
  }

  private static sendPayloadToPlayer(
    player: any,
    replacement: RegionReplacement,
    allowReload: boolean
  ): boolean {
    const session = player?.getSession?.();
    if (!session || typeof session.sendClientPacket !== "function") {
      return false;
    }
    return session.sendClientPacket(encodeRegionReplacement(
      replacement.regionId,
      allowReload,
      replacement.terrainData,
      replacement.objectData
    ));
  }

  private static computeVisibleRegionIds(
    tileX: number,
    tileY: number,
    chunkRadius: number
  ): Set<number> {
    const chunkX = tileX >> 3;
    const chunkY = tileY >> 3;
    const minRegionX = (chunkX - chunkRadius) >> 3;
    const maxRegionX = (chunkX + chunkRadius) >> 3;
    const minRegionY = (chunkY - chunkRadius) >> 3;
    const maxRegionY = (chunkY + chunkRadius) >> 3;
    const ids = new Set<number>();

    for (let regionX = minRegionX; regionX <= maxRegionX; regionX++) {
      if (regionX < 0 || regionX > 0xff) {
        continue;
      }
      for (let regionY = minRegionY; regionY <= maxRegionY; regionY++) {
        if (regionY < 0 || regionY > 0xff) {
          continue;
        }
        ids.add(((regionX & 0xff) << 8) | (regionY & 0xff));
      }
    }
    return ids;
  }

  private static countObjectPlacements(data: Uint8Array | null): number {
    if (!data || data.length === 0) {
      return 0;
    }

    const stream = new CollisionBuffer(data);
    let count = 0;

    while (stream.offset < stream.length()) {
      const objectIdDelta = stream.getUSmart();
      if (objectIdDelta === 0) {
        break;
      }

      let location = 0;
      while (stream.offset < stream.length()) {
        const locationDelta = stream.getUSmart();
        if (locationDelta === 0) {
          break;
        }
        location += locationDelta - 1;

        if (stream.offset >= stream.length()) {
          break;
        }
        stream.readUnsignedByte();
        count++;
      }
    }

    return count;
  }

  private static loadSource(
    regionId: number,
    source: ReplaceMapRegionSource
  ): { terrainData: Uint8Array; objectData: Uint8Array | null; resolvedSource: string } {
    if (Array.isArray(source)) {
      if (source.length !== 2) {
        throw new Error("array source must be [terrainPath, objectPath]");
      }
      const terrainPath = this.resolveSourcePath(source[0]);
      const objectPath = this.resolveSourcePath(source[1]);
      return {
        terrainData: this.readMapFile(terrainPath),
        objectData: this.readMapFile(objectPath),
        resolvedSource: `[${terrainPath}, ${objectPath}]`,
      };
    }

    if (typeof source !== "string" || source.trim().length === 0) {
      throw new Error("source must be a non-empty string or [terrainPath, objectPath]");
    }

    const sourcePath = this.resolveSourcePath(source);
    if (sourcePath.toLowerCase().endsWith(".pack")) {
      return this.readPackSource(regionId, sourcePath);
    }

    throw new Error(
      `single-file source '${sourcePath}' is unsupported; use .pack or [terrainPath, objectPath]`
    );
  }

  private static readPackSource(
    regionId: number,
    packPath: string
  ): { terrainData: Uint8Array; objectData: Uint8Array | null; resolvedSource: string } {
    const data = fs.readFileSync(packPath);
    if (data.length < 28) {
      throw new Error(`pack file too short: ${packPath}`);
    }

    if (data.readInt32BE(0) !== 1 || data.readInt32BE(12) !== (regionId >> 8) ||
        data.readInt32BE(16) !== (regionId & 0xff)) {
      throw new Error(`pack region does not match ${regionId}: ${packPath}`);
    }
    const files = CacheMaps.getArchiveIds(regionId);
    if (!files || data.readInt32BE(4) !== files.objectFile ||
        data.readInt32BE(8) !== files.terrainFile) {
      throw new Error(`pack archive IDs do not match the active cache: ${packPath}`);
    }
    const firstLength = data.readInt32BE(20);
    if (firstLength <= 0) {
      throw new Error(`invalid first entry length in pack: ${packPath}`);
    }

    const firstDataStart = 24;
    const firstDataEnd = firstDataStart + firstLength;
    if (firstDataEnd + 4 > data.length) {
      throw new Error(`truncated first entry in pack: ${packPath}`);
    }

    const secondLength = data.readInt32BE(firstDataEnd);
    if (secondLength < 0) {
      throw new Error(`invalid second entry length in pack: ${packPath}`);
    }
    const secondDataStart = firstDataEnd + 4;
    const secondDataEnd = secondDataStart + secondLength;
    if (secondDataEnd > data.length) {
      throw new Error(`truncated second entry in pack: ${packPath}`);
    }

    return {
      objectData: this.decodeMapFileBytes(data.subarray(firstDataStart, firstDataEnd), `${packPath}#object`),
      terrainData: this.decodeMapFileBytes(data.subarray(secondDataStart, secondDataEnd), `${packPath}#terrain`),
      resolvedSource: packPath,
    };
  }

  private static resolveSourcePath(rawPath: string): string {
    const trimmed = String(rawPath ?? "").trim();
    if (!trimmed) {
      throw new Error("source path must not be empty");
    }
    if (path.isAbsolute(trimmed)) {
      return trimmed;
    }
    return path.resolve(process.cwd(), trimmed);
  }

  private static readMapFile(filePath: string): Uint8Array {
    const data = fs.readFileSync(filePath);
    return this.decodeMapFileBytes(data, filePath);
  }

  private static decodeMapFileBytes(
    data: Uint8Array,
    sourceLabel: string
  ): Uint8Array {
    if (!data || data.length === 0) {
      throw new Error(`empty map data: ${sourceLabel}`);
    }

    const raw = Buffer.from(data);
    if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
      try {
        return zlib.gunzipSync(raw);
      } catch (err) {
        throw new Error(
          `failed to gunzip '${sourceLabel}': ${(err as Error)?.message ?? String(err)}`
        );
      }
    }
    return raw;
  }

}
