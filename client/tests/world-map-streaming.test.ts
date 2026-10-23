import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import { GroupMissingError } from "../rs/cache/js5/GroupMissingError";
import { IndexType } from "../rs/cache/IndexType";
import { WorldMapArea } from "../rs/map/WorldMapArea";
import { WorldMapArchiveRenderer } from "../rs/map/WorldMapArchiveRenderer";

function fixture() {
    const area = new WorldMapArea();
    Object.assign(area, {
        id: 7, internalName: "test", backgroundColor: 0x123456,
        regionLowX: 50, regionHighX: 50, regionLowY: 50, regionHighY: 50,
    });
    // One legacy region, geography group 9/file 0, with no decorations or overlays.
    const composite = Int8Array.from([
        0, 1, 0, 0, 1, 0, 50, 0, 50, 0, 50, 0, 50, 0, 9, 0, 0, 0, 0, 0, 0,
    ]);
    // One underlay tile makes ground colours observable in the rendered result.
    const geography = Int8Array.from([0, 50, 50, 1, 0, 1, ...new Array(4095).fill(0)]);
    const present = new Set([19, 18, 20]);
    const requested: number[] = [];
    const read = (index: number) => {
        requested.push(index);
        if (!present.has(index)) throw new GroupMissingError(index, 9, 0, 520);
    };
    const indexes = {
        [IndexType.OSRS.worldMap]: {
            getArchiveId: () => 1,
            getArchive: () => {
                read(19);
                return { getFileNamed: () => ({ data: composite }) };
            },
        },
        [IndexType.OSRS.worldMapGeography]: {
            getFile: () => { read(18); return { data: geography }; },
        },
        [IndexType.OSRS.worldMapGround]: {
            getArchive: () => {
                read(20);
                return { getFile: () => ({ data: new Int8Array(1) }) };
            },
        },
    };
    const renderer = new WorldMapArchiveRenderer({
        cacheSystem: { getIndex: (id: number) => indexes[id] },
        locTypeLoader: {}, overlayTypeLoader: {}, textureLoader: {}, mapScenes: [],
    } as any);
    // Image decoding is unrelated to sparse-cache readiness and needs a browser canvas.
    (renderer as any).decodeWorldMapSprite = async () => new Int32Array(4096).fill(0xabcdef);
    return { renderer, area, present, requested };
}

test("cold geography and ground requests start together and finish in the original tile load", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { renderer, area, present, requested } = fixture();
    present.delete(18);
    present.delete(20);
    const pending = renderer.loadTile(area, 50, 50, 1);
    await setImmediate();
    assert.ok(requested.includes(18) && requested.includes(20));
    present.add(18);
    present.add(20);
    t.mock.timers.tick(250);
    const tile = await pending;
    assert.ok(tile, "the caller receives the tile without a 2.5-second image-cache retry");
    assert.equal(tile.width, 64);
    assert.deepEqual([...tile.pixels.slice(63 * 64 * 4, 63 * 64 * 4 + 4)], [0xab, 0xcd, 0xef, 255]);
    assert.strictEqual(await renderer.loadTile(area, 50, 50, 1), tile);
});

test("a composite-map miss is retried instead of being cached as an unavailable area", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { renderer, area, present } = fixture();
    present.delete(19);
    assert.equal(renderer.getIcons(area, 50, 50), undefined);
    const pending = renderer.loadTile(area, 50, 50, 1);
    await setImmediate();
    present.add(19);
    t.mock.timers.tick(250);
    assert.ok(await pending);
});

test("a ground timeout never poisons the rendered tile cache with blank ground", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { renderer, area, present } = fixture();
    present.delete(20);
    const pending = renderer.loadTile(area, 50, 50, 1);
    for (let i = 0; i < 40; i++) {
        await setImmediate();
        t.mock.timers.tick(250);
    }
    assert.equal(await pending, undefined);
    present.add(20);
    const tile = await renderer.loadTile(area, 50, 50, 1);
    assert.ok(tile);
    assert.deepEqual([...tile.pixels.slice(63 * 64 * 4, 63 * 64 * 4 + 4)], [0xab, 0xcd, 0xef, 255]);
});

test("all legacy chunk misses are queued in one attempt", async (t) => {
    const { renderer } = fixture();
    const data1 = [1, 2, 3].map((groupId) => ({ groupId }));
    const requested: number[] = [];
    t.mock.method(renderer as any, "loadWorldMapDataGeography", (data: any) => {
        requested.push(data.groupId);
        throw new GroupMissingError(18, data.groupId, 0, 520);
    });
    assert.throws(() => (renderer as any).loadGeography({ data1, dynamicIcons: [] }), GroupMissingError);
    assert.deepEqual(requested, [1, 2, 3]);
});
