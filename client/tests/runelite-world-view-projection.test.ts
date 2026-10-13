import assert from "node:assert/strict";
import { test } from "node:test";
import { mat4, vec3, vec4 } from "gl-matrix";

import type { OsrsClient } from "../game/OsrsClient";
import { WorldViewManager } from "../game/worldview/WorldViewManager";
import { WorldEntityAnimator } from "../render/WorldEntityAnimator";
import { transformWorldEntityPoint } from "../render/WorldEntityProjection";
import { updateWorldEntityMotion } from "../render/render/worldEntityMotion";
import { Perspective } from "../runelite/api/Perspective";
import { ClientImpl } from "../runelite/impl/ClientImpl";

test("child-view Perspective follows the rendered rotating and moving deck on both backends", () => {
    for (const backend of ["webgl", "webgpu"]) {
        const manager = new WorldViewManager();
        manager.createWorldView(7, 16, 16, { baseX: 800, baseY: 1200 });
        const entity = manager.getWorldEntity(7)!;
        entity.hasPosition = true;
        entity.position.x = 10 * 128;
        entity.position.z = 20 * 128;
        entity.position.orientation = 512;
        const animator = new WorldEntityAnimator(undefined, undefined, undefined);
        const viewMatrix = mat4.lookAt(mat4.create(), [10, 12, 35], [10, 0, 20], [0, 1, 0]) as Float32Array;
        const projection = mat4.perspective(mat4.create(), Math.PI / 3, 800 / 600, 0.1, 100);
        const project = (x: number, y: number, z: number) => {
            const p = vec4.transformMat4(vec4.create(), [x, y, z, 1], viewMatrix);
            vec4.transformMat4(p, p, projection);
            return p[3] > 0.1 ? [(p[0] / p[3] + 1) * 400, (1 - p[1] / p[3]) * 300] : undefined;
        };
        const renderer = { worldEntityAnimator: animator,
            ...(backend === "webgl" ? { worldToScreen: project } : { overlays: { getHost: () => ({ worldToScreen: project }) } }) };
        const engine = { worldViewManager: manager, camera: { viewMatrix }, renderer } as unknown as OsrsClient;
        const client = new ClientImpl(engine);
        const host = { osrsClient: engine, worldEntityAnimator: animator,
            worldEntityOverlays: new Map([[7, { configId: -1, regionX: 100, regionY: 150, sizeX: 16, sizeZ: 16 }]]) };
        const localX = 10 * 128, localY = 8 * 128;
        // The deck centre is (808, 1208); its point two tiles east rotates two tiles south.
        updateWorldEntityMotion(host); animator.compose(viewMatrix);
        let actual = Perspective.localToCanvas(client, 7, localX, localY, -128);
        let expected = project(10, 1, 18)!;
        // Shader matrices are Float32: the inverse-view round trip can cross an integer
        // pixel boundary, so compare within one rasterized pixel.
        assert(Math.abs(actual!.x - Math.trunc(expected[0])) <= 1, backend);
        assert(Math.abs(actual!.y - Math.trunc(expected[1])) <= 1, backend);
        // A moving/turning boat reuses the local point; the projected point follows its new pose.
        entity.position.x = 12 * 128; entity.position.z = 22 * 128; entity.position.orientation = 1024;
        updateWorldEntityMotion(host); animator.compose(viewMatrix);
        actual = Perspective.localToCanvas(client, 7, localX, localY, -128);
        expected = project(10, 1, 22)!;
        assert(Math.abs(actual!.x - Math.trunc(expected[0])) <= 1, backend);
        assert(Math.abs(actual!.y - Math.trunc(expected[1])) <= 1, backend);
        animator.removeEntity(7);
        assert.equal(Perspective.localToCanvas(client, 7, localX, localY, -128), null);
    }
});

test("deck point projection retains camera-space animation and rejects singular cameras", () => {
    const view = mat4.lookAt(mat4.create(), [10, 12, 35], [10, 0, 20], [0, 1, 0]) as Float32Array;
    const animator = new WorldEntityAnimator(undefined, undefined, undefined);
    const bob = mat4.fromTranslation(mat4.create(), [0.25, 0.5, 0]) as Float32Array;
    animator.getTransform = () => bob;
    const world = transformWorldEntityPoint(view, animator, 2, 10, 1, 20)!;
    const rendered = vec3.transformMat4(vec3.create(), [10, 1, 20], view);
    vec3.transformMat4(rendered, rendered, bob);
    const projected = vec3.transformMat4(vec3.create(), world, view);
    for (let i = 0; i < 3; i++) assert(Math.abs(rendered[i] - projected[i]) < 0.00001);
    assert.equal(transformWorldEntityPoint(new Float32Array(16), animator, 2, 10, 1, 20), null);
});
