import assert from "node:assert/strict";

import type { LoginRendererHost } from "../game/login/renderer/host";
import { getLogicalFirePositions, getTitleBackgroundLayout } from "../game/login/renderer/layout/geometry";

// A viewport with the 765x503 scene centred in it at `sceneScale`, as the login layout puts it.
const host = (artWidth: number, w: number, h: number, sceneScale = 1) =>
    ({
        containerX: 0,
        containerWidth: w,
        containerHeight: h,
        contentOriginX: Math.floor((w - 765 * sceneScale) / 2),
        contentOriginY: Math.floor((h - 503 * sceneScale) / 2),
        contentScale: sceneScale,
        SCENE_WIDTH: 765,
        SCENE_HEIGHT: 503,
        titleBackgroundImage: { width: artWidth, height: 503 },
    }) as unknown as LoginRendererHost;

const sceneCenter = (h: LoginRendererHost) => [
    h.contentOriginX + (765 * h.contentScale) / 2,
    h.contentOriginY + (503 * h.contentScale) / 2,
];

// The cache's 765-wide art: centred on the scene, whole, at most twice the scene's scale.
for (const [w, h, sceneScale] of [[1920, 1080, 1], [1200, 700, 1], [3840, 2160, 1.5], [765, 503, 1], [700, 460, 0.9]]) {
    const view = host(765, w, h, sceneScale);
    const bg = getTitleBackgroundLayout(view);
    const [cx, cy] = sceneCenter(view);
    const label = `${w}x${h} at ${sceneScale}`;
    assert.ok(Math.abs(bg.drawX + bg.drawW / 2 - cx) < 1e-9 && Math.abs(bg.drawY + bg.drawH / 2 - cy) < 1e-9, `${label}: centred`);
    assert.ok(bg.scale >= sceneScale && bg.scale <= sceneScale * 2, `${label}: between 1x and 2x the scene`);
    if (bg.scale > sceneScale) {
        assert.ok(bg.drawX >= -1e-9 && bg.drawY >= -1e-9 && bg.drawX + bg.drawW <= w + 1e-9 && bg.drawY + bg.drawH <= h + 1e-9, `${label}: whole`);
    }
    const fire = getLogicalFirePositions(view);
    assert.ok(Math.abs(fire.scale - bg.scale) < 1e-9, `${label}: flames scale with the art`);
    assert.ok(Math.abs(fire.leftX - (bg.drawX - 22 * bg.scale)) < 1e-9, `${label}: left flame on the art`);
    assert.ok(Math.abs(fire.rightX - (bg.drawX + 659 * bg.scale)) < 1e-9, `${label}: right flame on the art`);
}
assert.equal(getTitleBackgroundLayout(host(765, 1920, 1080)).scale, 2, "1080p: twice the scene");
assert.equal(getTitleBackgroundLayout(host(765, 765, 503)).scale, 1, "classic size: 1:1");

// The classic scene at 1:1: the flames sit at -22 and 765 - 128 + 22 with either art.
for (const artWidth of [765, 1089]) {
    const fire = getLogicalFirePositions(host(artWidth, 765, 503));
    assert.equal(fire.leftX, -22, `${artWidth}: left flame`);
    assert.equal(fire.rightX, 659, `${artWidth}: right flame`);
    assert.equal(fire.scale, 1, `${artWidth}: flames drawn 1:1`);
}

console.log("login-title-fire: ok");
