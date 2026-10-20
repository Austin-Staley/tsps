import assert from "node:assert/strict";

import type { LoginRendererHost } from "../game/login/renderer/host";
import { getLogicalFirePositions } from "../game/login/renderer/layout/geometry";

// On the classic 765x503 scene the flames sit at -22 and 765 - 128 + 22, whichever art is drawn:
// the cache's title.jpg with its mirror (765 wide) or the bundled image (1089 wide, scene centred).
const host = (artWidth: number) =>
    ({
        containerX: 0,
        containerWidth: 765,
        containerHeight: 503,
        SCENE_WIDTH: 765,
        titleBackgroundImage: { width: artWidth, height: 503 },
    }) as unknown as LoginRendererHost;

for (const artWidth of [765, 1089]) {
    const fire = getLogicalFirePositions(host(artWidth));
    assert.equal(fire.leftX, -22, `${artWidth}: left flame`);
    assert.equal(fire.rightX, 659, `${artWidth}: right flame`);
    assert.equal(fire.scale, 1, `${artWidth}: flames drawn 1:1`);
}

// Wider than the scene: the art covers the width and the flames scale with it.
const wide = getLogicalFirePositions({ ...host(765), containerWidth: 1530 } as LoginRendererHost);
assert.equal(wide.scale, 2);
assert.equal(wide.leftX, -44);
assert.equal(wide.rightX, 1318);

console.log("login-title-fire: ok");
