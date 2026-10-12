import { strict as assert } from "node:assert";

import { hintArrow, hintArrowTileOffset, setHintArrowTile } from "../game/HintArrow";
import { questMinimapArrowPosition } from "../game/plugins/questhelper/minimap";

/**
 * Tile hint arrows as OSRS sends them: the height byte (the arrow sits height * 2 world units
 * up) and the position type (the tile's centre or one of its edges), with the floor beside it.
 */
function tileHintsKeepPositionHeightAndPlane(): void {
    // A door's arrow on the tutorial: west edge, height 128, floor 0.
    setHintArrowTile(3098, 3107, 128, (3 << 2) | 0);
    assert.equal(hintArrow.type, 2);
    assert.equal(hintArrow.height, 128);
    assert.equal(hintArrow.position, 3);
    assert.equal(hintArrow.plane, 0);

    setHintArrowTile(3088, 9520, 5, (2 << 2) | 1);
    assert.equal(hintArrow.position, 2);
    assert.equal(hintArrow.plane, 1);

    // An unknown position type falls back to the centre.
    setHintArrowTile(1, 1, 0, 7 << 2);
    assert.equal(hintArrow.position, 2);
}

function offsetsMatchTheOsrsClient(): void {
    assert.deepEqual(hintArrowTileOffset(2), [64, 64]);
    assert.deepEqual(hintArrowTileOffset(3), [0, 64]);
    assert.deepEqual(hintArrowTileOffset(4), [128, 64]);
    assert.deepEqual(hintArrowTileOffset(5), [64, 0]);
    assert.deepEqual(hintArrowTileOffset(6), [64, 128]);
}

tileHintsKeepPositionHeightAndPlane();
offsetsMatchTheOsrsClient();

const center = { x: 100, y: 100 };
const close = questMinimapArrowPosition({ x: 120, y: 110 }, center, 5, 1, 1);
assert.deepEqual(close, { x: 120, y: 102, angle: 0 }, "Nearby quest arrows point down at their target");
for (const distance of [16, 75, 1000, 5000]) {
    const east = questMinimapArrowPosition({ x: 100 + distance * 4, y: 100 }, center, distance, 1, 1);
    assert.deepEqual(east, { x: 165, y: 100, angle: -Math.PI / 2 }, "Quest arrows stay on the edge at any distance, including outside the loaded scene");
}
const north = questMinimapArrowPosition({ x: 100, y: -10000 }, center, 2500, 1, 2);
assert.ok(Math.abs(north.x - 100) < 0.00001);
assert.equal(north.y, -30, "Scale the rim distance for high-resolution rendering");
assert.equal(north.angle, -Math.PI, "Follow the minimap's rotated screen direction");
assert.equal(questMinimapArrowPosition({ x: 132, y: 100 }, center, 8, 2, 1).x, 165, "Zooming in brings the rim transition closer");
assert.equal(questMinimapArrowPosition({ x: 132, y: 100 }, center, 8, 0.5, 1).x, 132, "Zooming out keeps nearby arrows on their target");
