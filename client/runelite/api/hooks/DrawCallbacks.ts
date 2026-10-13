/*
 * Copyright (c) 2018, Adam <Adam@sigterm.info>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// Ported to TypeScript; unsupported rasterizer overrides are rejected by the backend adapter.
import type { Projection } from "../Projection";
import type { Scene } from "../Scene";
import type { SceneTilePaint } from "../SceneTilePaint";
import type { SceneTileModel } from "../SceneTileModel";
import type { Renderable } from "../Renderable";
import type { Texture } from "../Texture";
import type { WorldView } from "../WorldView";
import type { TileObject } from "../TileObject";
import type { Model } from "../Model";
import type { GameObject } from "../GameObject";
/** Java default hooks become optional methods so plugins can still extend Plugin. */
export interface DrawCallbacks {
    draw(overlayColor: number): void;
    draw(projection: Projection, scene: Scene, renderable: Renderable, orientation: number, x: number, y: number, z: number, hash: number | bigint): void;
    /** Required by native RuneLite. Browser frame-only observers omit it; overrides are rejected. */
    swapScene?(scene: Scene): void;
    drawScenePaint?(scene: Scene, paint: SceneTilePaint, plane: number, tileX: number, tileZ: number): void;
    drawSceneTileModel?(scene: Scene, model: SceneTileModel, tileX: number, tileZ: number): void;
    drawScene?(cameraX: number, cameraY: number, cameraZ: number, cameraPitch: number, cameraYaw: number, plane: number): void;
    postDrawScene?(): void;
    animate?(texture: Texture, diff: number): void;
    loadScene?(scene: Scene): void;
    loadScene?(worldView: WorldView, scene: Scene): void;
    tileInFrustum?(scene: Scene, pitchSin: number, pitchCos: number, yawSin: number, yawCos: number, cameraX: number, cameraY: number, cameraZ: number, plane: number, msx: number, msy: number): boolean;
    zoneInFrustum?(zoneX: number, zoneZ: number, maxY: number, minY: number): boolean;
    despawnWorldView?(worldView: WorldView): void;
    preSceneDraw?(scene: Scene, projection: Projection, cameraX: number, cameraY: number, cameraZ: number, cameraPitch: number, cameraYaw: number, minLevel: number, level: number, maxLevel: number, hideRoofIds: Set<number>): void;
    preSceneDraw?(scene: Scene, cameraX: number, cameraY: number, cameraZ: number, cameraPitch: number, cameraYaw: number, minLevel: number, level: number, maxLevel: number, hideRoofIds: Set<number>): void;
    postSceneDraw?(scene: Scene): void;
    drawPass?(projection: Projection, scene: Scene, pass: number): void;
    drawZoneOpaque?(projection: Projection, scene: Scene, zx: number, zz: number): void;
    drawZoneAlpha?(projection: Projection, scene: Scene, level: number, zx: number, zz: number): void;
    drawDynamic?(projection: Projection, scene: Scene, tileObject: TileObject, renderable: Renderable, model: Model, orientation: number, x: number, y: number, z: number): void;
    drawDynamic?(renderThreadId: number, projection: Projection, scene: Scene, tileObject: TileObject, renderable: Renderable, model: Model, orientation: number, x: number, y: number, z: number): void;
    drawTemp?(projection: Projection, scene: Scene, object: GameObject, model: Model, orientation: number, x: number, y: number, z: number): void;
    invalidateZone?(scene: Scene, zx: number, zz: number): void;
}
export namespace DrawCallbacks {
    export const GPU = 1, HILLSKEW = 2, NORMALS = 4, NO_VERTEX_SNAPPING = 8, ZBUF = 16, ZBUF_ZONE_FRUSTUM_CHECK = 32, UNLIT_FACE_COLORS = 64;
    export const RENDER_THREADS_MASK = 15, RENDER_THREADS_SHIFT = 7, PASS_OPAQUE = 0, PASS_ALPHA = 1, PRE_PASS_ALPHA = 2;
    export function RENDER_THREADS(num: number): number { return (num & 15) << 7; }
}
