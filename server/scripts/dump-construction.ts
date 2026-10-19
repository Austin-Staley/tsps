// Refreshes the Construction plugin's data (plugins/skills/construction/data) from the
// cache's own POH tables:
//   110 furniture    - level, materials and menu icon of every buildable furniture row
//   111 poh_room     - room cost and level, and the hotspot rows of each room
//   112 poh_hotspot  - the furniture rows each hotspot offers, in menu order
// Cache-derived fields (name, level, materials, menu icon) refresh; experience, built loc ids, the build animation, tool
// requirements and upgrade sources (the furniture that must already stand there) are
// server-owned and kept. Rows the data doesn't have yet are listed, not added.
//
//   yarn dump:construction [--check]
//
// --check writes nothing and exits 1 if the data is out of date.
// Needs the cache in server/caches - run `yarn ensure-cache` first.
import * as fs from "fs";
import path = require("path");

import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { CacheIndexDat2 } from "../src/main/typescript/elvarg/game/cache/codec/rs/cache/CacheIndex";
import { IndexType } from "../src/main/typescript/elvarg/game/cache/codec/rs/cache/IndexType";
import { ByteBuffer } from "../src/main/typescript/elvarg/game/cache/codec/rs/io/ByteBuffer";
import { Gamevals, GamevalKind } from "../src/main/typescript/elvarg/game/cache/Gamevals";
import { decodeRow } from "./combat-style-table";

const DBROW_ARCHIVE = 38;
const FURNITURE_TABLE = 110;
const ROOM_TABLE = 111;
const HOTSPOT_TABLE = 112;

// Table 110 columns.
const FURNITURE_MENU_OBJ = 0;
const FURNITURE_NAME = 1;
const FURNITURE_MATERIALS = 2; // (obj, count) pairs
const FURNITURE_LEVEL = 3; // (stat, level)
const FURNITURE_HIDDEN = 5;
// Table 111 columns.
const ROOM_COST = 2;
const ROOM_ID = 3;
const ROOM_LEVEL = 4; // (stat, level)
const ROOM_HOTSPOTS = 7;
// Table 112 columns.
const HOTSPOT_FURNITURE = 0;

// The tables list "any nails" as one obj; the plugin takes the cheapest nails held.
const ANY_NAILS_OBJ = 32923;

type Material = { itemId?: number; amount: number; source?: string };
type Furniture = {
    key: string;
    name?: string;
    level: number;
    experience: number;
    menuItemId: number;
    menuRowId?: number;
    hidden?: boolean;
    buildAnimationId: number;
    objectIds: number[];
    materials: Material[];
};
type Room = { key: string; id: number; name: string; level: number; cost: number; [field: string]: unknown };

const dataDir = path.resolve(__dirname, "..", "plugins", "skills", "construction", "data");

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
}

/** One row per line so cache bumps diff cleanly. */
function rows(values: unknown[]): string {
    return "[\n" + values.map((value) => "  " + JSON.stringify(value)).join(",\n") + "\n]\n";
}

function readTables(configs: CacheIndexDat2): Map<number, Map<number, Map<number, any[]>>> {
    const tables = new Map<number, Map<number, Map<number, any[]>>>(
        [FURNITURE_TABLE, ROOM_TABLE, HOTSPOT_TABLE].map((table) => [table, new Map()]),
    );
    // Load the whole dbrow archive once: per-file getFile() re-reads the archive.
    const archive = configs.getArchive(DBROW_ARCHIVE);
    for (const rowId of archive.fileIds) {
        const file = archive.getFile(rowId);
        if (!file) continue;
        const row = decodeRow(new ByteBuffer(new Int8Array(file.data)));
        tables.get(row.tableId)?.set(rowId, row.columns);
    }
    return tables;
}

function cacheMaterials(columns: Map<number, any[]>): Material[] {
    const pairs = columns.get(FURNITURE_MATERIALS) ?? [];
    const materials: Material[] = [];
    for (let i = 0; i + 1 < pairs.length; i += 2) {
        const [obj, amount] = [pairs[i], pairs[i + 1]];
        materials.push(obj === ANY_NAILS_OBJ ? { amount, source: "NAILS" } : { itemId: obj, amount });
    }
    return materials;
}

async function main() {
    const check = process.argv.includes("--check");
    await CachePipeline.initialize(path.resolve(__dirname, ".."));
    const configs = CacheIndexDat2.fromStore(IndexType.DAT2.configs, CachePipeline.getStore());
    const tables = readTables(configs);
    const rowNames = new Gamevals().namesOf(GamevalKind.DBROW);
    const furnitureRows = tables.get(FURNITURE_TABLE)!;
    const roomRows = tables.get(ROOM_TABLE)!;
    const hotspotRows = tables.get(HOTSPOT_TABLE)!;
    const notes: string[] = [];

    const furniture = readJson<Furniture[]>("furniture.json");
    const furnitureKeys = new Set(furniture.map((entry) => entry.key));
    const usedRows = new Set<number>();
    const refreshed = furniture.map((entry) => {
        if (entry.menuRowId == null) return entry; // not POH furniture (raid storage units)
        const columns = furnitureRows.get(entry.menuRowId);
        if (!columns) {
            notes.push(`${entry.key}: furniture row ${entry.menuRowId} is gone`);
            return entry;
        }
        usedRows.add(entry.menuRowId);
        // Server-owned requirements: the furniture an upgrade replaces, and tools.
        const kept = entry.materials.filter(
            (material) => material.itemId == null && (furnitureKeys.has(material.source ?? "") || material.source?.startsWith("Tool.")),
        );
        const hidden = (columns.get(FURNITURE_HIDDEN) ?? [0])[0] === 1;
        const { hidden: _previous, ...rest } = entry;
        return {
            ...rest,
            name: (columns.get(FURNITURE_NAME) ?? [entry.name])[0],
            level: (columns.get(FURNITURE_LEVEL) ?? [0, entry.level])[1],
            menuItemId: (columns.get(FURNITURE_MENU_OBJ) ?? [entry.menuItemId])[0],
            ...(hidden ? { hidden } : {}),
            materials: [...kept, ...cacheMaterials(columns)],
        };
    });
    for (const rowId of [...furnitureRows.keys()].filter((id) => !usedRows.has(id))) {
        const name = (furnitureRows.get(rowId)!.get(1) ?? [""])[0];
        notes.push(`furniture row ${rowId} ${rowNames.get(rowId)} ("${name}") is not in furniture.json`);
    }

    const rooms = readJson<Room[]>("rooms.json");
    const roomsById = new Map([...roomRows.values()].map((columns) => [(columns.get(ROOM_ID) ?? [-1])[0], columns]));
    const refreshedRooms = rooms.map((room) => {
        const columns = roomsById.get(room.id);
        if (!columns) {
            notes.push(`room ${room.key}: no poh_room row with id ${room.id}`);
            return room;
        }
        return {
            ...room,
            level: (columns.get(ROOM_LEVEL) ?? [0, room.level])[1],
            cost: (columns.get(ROOM_COST) ?? [room.cost])[0],
        };
    });
    for (const [id, columns] of roomsById) {
        if (id > 0 && !rooms.some((room) => room.id === id)) {
            notes.push(`poh_room id ${id} ("${(columns.get(1) ?? [""])[0]}") is not in rooms.json`);
        }
    }

    // The house viewer lists each room's hotspots in table order, each with its furniture rows.
    const viewer: Record<string, number[][]> = {};
    for (const [id, columns] of [...roomsById].sort(([a], [b]) => a - b)) {
        if (id <= 0) continue;
        viewer[id] = (columns.get(ROOM_HOTSPOTS) ?? []).map(
            (hotspotRow: number) => hotspotRows.get(hotspotRow)?.get(HOTSPOT_FURNITURE) ?? [],
        );
    }

    const outputs: Record<string, string> = {
        "furniture.json": rows(refreshed),
        "rooms.json": rows(refreshedRooms),
        "viewer-furniture.json":
            "{\n" +
            Object.entries(viewer).map(([id, slots]) => `  ${JSON.stringify(id)}: ${JSON.stringify(slots)}`).join(",\n") +
            "\n}\n",
    };
    let stale = false;
    for (const [file, text] of Object.entries(outputs)) {
        const target = path.join(dataDir, file);
        if (fs.readFileSync(target, "utf8") === text) continue;
        stale = true;
        if (!check) fs.writeFileSync(target, text);
        console.log(`${check ? "out of date" : "updated"}: ${file}`);
    }
    for (const note of notes) console.log(`note: ${note}`);
    if (check && stale) process.exit(1);
}

main().then(
    () => process.exit(0),
    (error) => {
        console.error(error);
        process.exit(1);
    },
);
