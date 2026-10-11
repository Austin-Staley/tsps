import { CacheSystem } from "../../rs/cache/CacheSystem";
import { ConfigType } from "../../rs/cache/ConfigType";
import { IndexType } from "../../rs/cache/IndexType";
import { ByteBuffer } from "../../rs/io/ByteBuffer";
import { HealthBarDefinition } from "../../rs/config/healthbar/HealthBarDefinition";
import { NpcType } from "../../rs/config/npctype/NpcType";
import { StructType } from "../../rs/config/structtype/StructType";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

function decode<T extends { decodeOpcode(op: number, buf: ByteBuffer): void }>(
    id: number,
    Ctor: new (id: number, info: any) => T,
    info: any,
    data: ArrayBuffer,
): T {
    const type = new Ctor(id, info);
    const buffer = new ByteBuffer(data);
    while (buffer.offset < buffer.length) {
        const opcode = buffer.readUnsignedByte();
        if (opcode === 0) break;
        type.decodeOpcode(opcode, buffer);
    }
    return type;
}

const info = loadCacheList(loadCacheInfos()).latest;
const cache = CacheSystem.fromFiles(info, loadCache(info).files);
const configs: any = cache.getIndex(IndexType.DAT2.configs);

console.log("== health bar definitions ==");
const hbArchive = configs.getArchive(ConfigType.OSRS.healthBar);
for (const file of hbArchive.files as Iterable<{ id: number; data: ArrayBuffer }>) {
    const t = decode(file.id, HealthBarDefinition, info, file.data);
    console.log(
        `id=${file.id} width=${t.width} pad=${t.widthPadding} front=${t.frontSpriteId} back=${t.backSpriteId} int3=${t.int3} int5=${t.int5}`,
    );
}

console.log("== npc params ==");
const npcArchive = configs.getArchive(ConfigType.DAT2.npcs);
const wanted = new Set([319, 8060, 8061, 8062, 8063, 8059, 14707, 14779]);
for (const file of npcArchive.files as Iterable<{ id: number; data: ArrayBuffer }>) {
    if (!wanted.has(file.id)) continue;
    const t = decode(file.id, NpcType, info, file.data);
    const params = t.params ? [...t.params.entries()] : [];
    console.log(`npc=${file.id} name=${JSON.stringify(t.name)} hp=${t.hitpoints} combat=${t.combatLevel} size=${t.size} params=${JSON.stringify(params)}`);
}

console.log("== structs ==");
const structArchive = configs.getArchive(ConfigType.OSRS.struct);
const wantedStructs = new Set([22124, 592]);
for (const file of structArchive.files as Iterable<{ id: number; data: ArrayBuffer }>) {
    if (!wantedStructs.has(file.id)) continue;
    const t = decode(file.id, StructType, info, file.data);
    const params = t.params ? [...t.params.entries()] : [];
    console.log(`struct=${file.id} params=${JSON.stringify(params)}`);
}
