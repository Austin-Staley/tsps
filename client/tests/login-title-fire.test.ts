import assert from "node:assert/strict";

import type { LoginRendererHost } from "../game/login/renderer/host";
import { getLogicalFirePositions, getTitleBackgroundLayout } from "../game/login/renderer/layout/geometry";

// The classic flames sit at -22 and 765 - 128 + 22 of the 765x503 scene, whichever art is drawn.
const host = (artWidth: number, scene: { x: number; y: number; scale: number }, viewport = { w: 765, h: 503 }) =>
    ({
        containerX: 0,
        containerWidth: viewport.w,
        containerHeight: viewport.h,
        contentOriginX: scene.x,
        contentOriginY: scene.y,
        contentScale: scene.scale,
        SCENE_WIDTH: 765,
        titleBackgroundImage: { width: artWidth, height: 503 },
    }) as unknown as LoginRendererHost;

// The cache's title art (765 wide) is drawn whole, where the scene is and at its scale.
const sceneArt = host(765, { x: 100, y: 20, scale: 2 }, { w: 1730, h: 1100 });
assert.deepEqual(getTitleBackgroundLayout(sceneArt), { drawX: 100, drawY: 20, drawW: 1530, drawH: 1006, scale: 2 });
assert.deepEqual(getLogicalFirePositions(sceneArt), { leftX: 56, rightX: 1418, y: 20, scale: 2 });

// The bundled 1089-wide image covers the viewport, the scene centred in it.
for (const artWidth of [765, 1089]) {
    const fire = getLogicalFirePositions(host(artWidth, { x: 0, y: 0, scale: 1 }));
    assert.equal(fire.leftX, -22, `${artWidth}: left flame`);
    assert.equal(fire.rightX, 659, `${artWidth}: right flame`);
    assert.equal(fire.scale, 1, `${artWidth}: flames drawn 1:1`);
}

console.log("login-title-fire: ok");
