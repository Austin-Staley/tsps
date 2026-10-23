import assert from "node:assert/strict";
import { test } from "node:test";

// PicoGL expects a browser global when PlayerRenderer loads.
(globalThis as any).self ??= globalThis;
const { PlayerRenderer } = require("../render/player/PlayerRenderer");

const pose = (value: number, labels = 1) => new Float32Array(labels * 12).fill(value);
const groups = (...rows: [string, Float32Array][]) =>
    new Map(rows.map(([key, matrices]) => [key, { matrices, appearance: {} }]));

function harness() {
    const writes: { y: number; width: number; height: number; data: Float32Array }[] = [];
    const texture = () => ({ currentUnit: 0, bind() {} });
    const renderer = {
        playerPoseTexture: texture() as any,
        app: { gl: {
            TEXTURE_2D: 3553, RGBA: 6408, FLOAT: 5126,
            texSubImage2D(_target: number, _level: number, _x: number, y: number,
                width: number, height: number, _format: number, _type: number, data: Float32Array) {
                writes.push({ y, width, height, data: data.slice() });
            },
        } },
    };
    const player: any = new PlayerRenderer(renderer);
    player.ensureBaseForAppearance = () => ({ baseModel: {} });
    player.poseFor = (_key: string, _base: any, group: any) => group.matrices;
    player.rigFor = () => ({});
    player.restMeshFor = () => ({});
    return { renderer, player, writes, texture };
}

test("WebGL cached player poses stay uploaded across opaque/alpha and empty passes", () => {
    const { player, writes } = harness();
    const rows = groups(["idle", pose(1, 30)], ["walk", pose(2, 20)]);
    for (let frame = 0; frame < 120; frame++) {
        player.preparePoses(rows); // opaque
        player.preparePoses(rows); // alpha
    }
    assert.equal(writes.length, 1, "240 unchanged pass preparations need one upload");
    assert.equal(writes[0].data.byteLength, 30 * 12 * 2 * 4);
    player.preparePoses(new Map());
    const output = player.preparePoses(rows);
    assert.equal(writes.length, 1, "an empty pass leaves texture contents intact");
    assert.equal(output.get("walk").row, 1);
});

test("WebGL streamed pose replacements and animation keys refresh their actual row", () => {
    const { player, writes } = harness();
    const idle = pose(1), loading = pose(2);
    const rows = groups(["idle", idle], ["walk", loading]);
    player.preparePoses(rows);
    const streamed = pose(3);
    rows.get("walk")!.matrices = streamed;
    player.preparePoses(rows);
    assert.equal(writes.length, 2, "the same key can receive its streamed frame later");
    assert.deepEqual(writes[1], { y: 1, width: 3, height: 1, data: streamed });
    player.preparePoses(groups(["idle", idle], ["run", streamed]));
    assert.equal(writes.length, 3, "a new animation key must update its row");
    player.preparePoses(groups(["run", streamed], ["idle", idle]));
    assert.deepEqual(writes[3], { y: 0, width: 3, height: 2,
        data: Float32Array.from([...streamed, ...idle]) });
});

test("WebGL partial pose uploads keep intervening rows and changing row widths correct", () => {
    const { player, writes } = harness();
    const a = pose(1), b = pose(2), c = pose(3), d = pose(4);
    player.preparePoses(groups(["a", a], ["b", b], ["c", c], ["d", d]));
    const wideB = pose(5, 2), wideD = pose(6, 2);
    player.preparePoses(groups(["a", a], ["b", wideB], ["c", c], ["d", wideD]));
    const update = writes[1];
    assert.equal(update.y, 1);
    assert.equal(update.width, 6);
    assert.equal(update.height, 3);
    assert.deepEqual(update.data.subarray(0, 24), wideB);
    assert.deepEqual(update.data.subarray(24, 36), c, "unchanged row inside the span is repacked");
    assert.deepEqual(update.data.subarray(48, 72), wideD);
    const narrowD = pose(7);
    player.preparePoses(groups(["a", a], ["b", b], ["c", c], ["d", narrowD]));
    assert.deepEqual(writes[2], { y: 1, width: 3, height: 3,
        data: Float32Array.from([...b, ...c, ...narrowD]) });
});

test("WebGL replacement pose textures invalidate every previously uploaded row", () => {
    const { player, renderer, writes, texture } = harness();
    const a = pose(1), b = pose(2);
    const rows = groups(["a", a], ["b", b]);
    player.preparePoses(rows);
    renderer.playerPoseTexture = undefined;
    assert.equal(player.preparePoses(rows).size, 0, "missing texture uses CPU fallback");
    renderer.playerPoseTexture = texture();
    player.preparePoses(groups(["a", a]));
    player.preparePoses(rows);
    assert.equal(writes.length, 3);
    assert.deepEqual(writes[2], { y: 1, width: 3, height: 1, data: b },
        "a tail row from the deleted texture must be uploaded to its replacement");
    player.cleanupAppearanceCache();
    player.preparePoses(rows);
    assert.equal(writes.length, 4, "session cleanup releases pose upload history");
    assert.equal(writes[3].height, 2);
});
