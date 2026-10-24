import assert from "node:assert/strict";

import { CacheSystem } from "../rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { LocModelType } from "../rs/config/loctype/LocModelType";
import { isDoorLocType } from "../render/loc/SceneLocs";
import { loadCache, loadCacheInfos, loadCacheList } from "../scripts/cache/load-util";

// PicoGL expects a browser global when SceneRaycaster imports WebGLMapSquare.
(globalThis as any).self = globalThis;
const { SceneRaycaster } = require("../game/scene/SceneRaycaster");

// The house portal's swirl (seq 3174) is shrunk to one point in its first frame, so a clickbox
// built from that frame had a hole in the middle. OSRS tests the model as it is drawn.
const cacheInfo = loadCacheList(loadCacheInfos()).latest;
const factory: any = getCacheLoaderFactory(
    cacheInfo,
    CacheSystem.fromFiles(cacheInfo, loadCache(cacheInfo).files),
);
const raycaster = new SceneRaycaster({}, {
    locTypeLoader: factory.getLocTypeLoader(),
    modelLoader: factory.getModelLoader(),
    textureLoader: factory.getTextureLoader(),
    seqTypeLoader: factory.getSeqTypeLoader(),
    seqFrameLoader: factory.getSeqFrameLoader(),
    skeletalSeqLoader: factory.getSkeletalSeqLoader?.(),
});
const PORTAL = 4525;
const portal = factory.getLocTypeLoader().load(PORTAL);
const seqType = factory.getSeqTypeLoader().load(portal.seqId);

// Straight through the middle of the arch, a little below the point the first frame shrinks to.
const throughCentre = (animated?: { seqType: unknown; frame: number }) =>
    raycaster.intersectLocModel(
        { origin: [1, -1.25, -1], direction: [0, 0, 1] },
        100,
        portal,
        LocModelType.NORMAL,
        0,
        128,
        128,
        0,
        animated,
    );
// Its Lock option makes the client draw it as a door: unanimated, with the whole swirl.
assert.ok(isDoorLocType(portal));
assert.ok(throughCentre() !== undefined, "the centre of the portal, drawn unanimated, is clickable");
// Animated, it clicks on the frame it is on.
assert.equal(throughCentre({ seqType, frame: 0 }), undefined, "the first frame's swirl is a single point");
assert.ok(throughCentre({ seqType, frame: 5 }) !== undefined, "the centre clicks while the swirl shows");

// The raycaster finds the animation by the loc's fine position in its square.
const playing = { id: PORTAL, x: 1 * 128 + 128, y: 2 * 128 + 128, level: 1, seqType, frame: 5 };
const map = { locsAnimated: [{ ...playing, id: PORTAL + 1 }, playing] };
assert.equal(raycaster.animatedLocAt(map, PORTAL, 1, 256, 384), playing);
assert.equal(raycaster.animatedLocAt(map, PORTAL, 1, 256, 256), undefined);
console.log("House portal pick regression passed");
