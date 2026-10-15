import assert from "node:assert/strict";
import { vec4 } from "gl-matrix";

import { Camera } from "../game/Camera";
import { handleInboundWorld } from "../network/serverConnection/handlers/inboundWorld";

const previousClient = (globalThis as any).__osrsClient;
const camera = new Camera(0, 0, 0, 200, 0);
let shakesCleared = 0;
// The current plane has ground height -8 tiles; camera packet heights are
// offsets above the sampled ground, rather than absolute world elevations.
const map = {
    mapX: 50, mapY: 52, heightMapSize: 66, borderSize: 0,
    heightMapData: new Int16Array(4 * 66 * 66).fill(128),
};
const client = {
    camera, followPlayerCamera: true, controlledPlayerServerId: 7,
    playerEcs: { getIndexForServerId: () => 2, getLevel: (index: number) => { assert.equal(index, 2); return 1; } },
    renderer: { mapManager: { getMapForWorldTile: () => map }, clearCameraShake: () => { shakesCleared++; } },
};
(globalThis as any).__osrsClient = client;
const apply = (payload: object) => assert.equal(handleInboundWorld({ type: "camera", payload }), true);

try {
    for (const instant of [true, false]) {
        for (const [dx, dz, height] of [[4, 0, 128], [-4, 0, 128], [0, 4, 128], [0, -4, 128], [3, 4, 640]]) {
            camera.setScenePitchOverride(300); // Existing terrain pressure must not mask the scene.
            camera.setViewPitchOverride(-100); // Nor may an existing first-person view angle.
            apply({ mode: "move", x: 3227, y: 3369, height: 384, instant: true });
            assert.equal(client.followPlayerCamera, false);
            assert.deepEqual([...camera.pos], [3227.5, -11, 3369.5]);
            apply({ mode: "look", x: 3227 + dx, y: 3369 + dz, height, instant });
            camera.applySmoothing(10_000);
            camera.update(800, 600);
            const target = vec4.fromValues(3227.5 + dx, -8 - height / 128, 3369.5 + dz, 1);
            const inView = vec4.transformMat4(vec4.create(), target, camera.viewMatrix);
            assert.ok(inView[2] < 0, `target must be in front of the camera (${dx},${dz},${height})`);
            assert.ok(Math.abs(inView[0]) < 0.03 && Math.abs(inView[1]) < 0.03,
                `look target must be centred, including shallow/downward/upward angles: ${[...inView]}`);
        }
    }
    apply({ mode: "reset" });
    assert.equal(client.followPlayerCamera, true);
    assert.equal(camera.getScenePitchOverride(), undefined);
    assert.equal(camera.getViewPitchOverride(), undefined);
    assert.equal(shakesCleared, 1);
} finally {
    (globalThis as any).__osrsClient = previousClient;
}
console.log("scripted camera look geometry: ok");
