import assert from "node:assert/strict";
import { test } from "node:test";

import { Camera } from "../game/Camera";
import { LoadingRequirement, LoadingTracker } from "../game/state/LoadingTracker";
import { updateCameraFollow } from "../render/render/camera2";
import { shortestYawDelta, updateFollowCamera, wrapYaw } from "../render/webgpu/camera";

test("wrapYaw keeps RS yaw in [0, 2048)", () => {
    assert.equal(wrapYaw(0), 0);
    assert.equal(wrapYaw(2048), 0);
    assert.equal(wrapYaw(-1), 2047);
    assert.equal(wrapYaw(2049), 1);
    assert.equal(wrapYaw(1024), 1024);
});

test("shortestYawDelta takes the short way across the 0/2048 seam", () => {
    assert.equal(shortestYawDelta(10, 2040), 18);
    assert.equal(shortestYawDelta(2040, 10), -18);
    assert.equal(shortestYawDelta(500, 0), 500);
    assert.equal(shortestYawDelta(1500, 0), -548);
    assert.equal(shortestYawDelta(0, 0), 0);
});

for (const backend of ["WebGL", "WebGPU"]) {
    test(`${backend} finishes login during a scripted camera without moving the shot`, () => {
        let terrainReady = false;
        let sceneReady = false;
        let completions = 0;
        const tracker = new LoadingTracker();
        tracker.setRequirements([LoadingRequirement.MAP_DATA_LOADED]);
        tracker.setOnComplete(() => { completions++; });
        const camera = new Camera(1619.5, -10, 4824.5, 256, 512);
        const before = [...camera.pos, camera.getYaw(), camera.getScenePitchAngle()];
        const map = {
            mapX: 25, mapY: 75, heightMapSize: 66, borderSize: 0,
            heightMapData: new Int16Array(4 * 66 * 66),
        };
        const renderer = {
            osrsClient: {
                camera, followPlayerCamera: false, controlledPlayerServerId: 7,
                loadingTracker: tracker,
                playerEcs: {
                    getIndexForServerId: () => 0, size: () => 1,
                    getX: () => 1625 * 128 + 64, getY: () => 4827 * 128 + 64,
                    getLevel: () => 0, getWorldViewId: () => -1,
                },
                clientPlugins: { handleCameraFollow: () => assert.fail("cutscene must retain camera control") },
            },
            playerPosUni: new Float32Array(2),
            stats: { frameCount: 1 },
            getControlledPlayerEcsIndex: () => 0,
            getControlledPlayerWorldViewId: () => -1,
            mapManager: {
                getMapForWorldTile: () => terrainReady ? map : undefined,
                isSceneReady: () => sceneReady,
            },
        } as any;
        const frame = (time: number) => backend === "WebGPU"
            ? updateFollowCamera(renderer, time, 16)
            : updateCameraFollow(renderer, 16, time);

        frame(0);
        frame(5);
        assert.equal(completions, 0, "missing terrain must keep the loading overlay");
        terrainReady = true;
        frame(10);
        frame(12);
        assert.equal(completions, 0, "player terrain alone must not dismiss loading");
        sceneReady = true;
        terrainReady = false;
        frame(13);
        assert.equal(completions, 0, "a complete scene still needs the player's ground");
        terrainReady = true;
        frame(14);
        frame(15);
        assert.equal(completions, 1, "map readiness must not wait for a camera-reset packet");
        assert.equal(renderer.osrsClient.followPlayerCamera, false);
        assert.deepEqual([...camera.pos, camera.getYaw(), camera.getScenePitchAngle()], before);
    });
}
