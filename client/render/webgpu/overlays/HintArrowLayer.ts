import { hintArrow, hintArrowTileOffset, isHintArrowBlinkOn } from "../../../game/HintArrow";
import { IndexType } from "../../../rs/cache/IndexType";
import { IndexedSprite } from "../../../rs/sprite/IndexedSprite";
import { SpriteLoader } from "../../../rs/sprite/SpriteLoader";
import type { OverlayHost } from "./OverlayHost";
import type { ScreenLayer, ScreenTexture } from "./ScreenLayer";
import { indexedSpriteToPixels } from "./textTextures";

/**
 * Port of client/ui/devoverlay/TutorialHintOverlay.ts: the hint arrow (`headicons_hint` frame 0)
 * over the NPC or tile the server points at, blinking as the OSRS client does. Actor hints on
 * players (type 3) are head icons, not this arrow.
 */
export class HintArrowLayer {
    private readonly host: OverlayHost;
    private readonly screen: ScreenLayer;
    private sprite?: ScreenTexture;
    /** The sprite's trim offset: the texture holds only its drawn part. */
    private offsetX = 0;
    private offsetY = 0;
    private loadAttempted = false;

    scale = 1.0;

    constructor(host: OverlayHost, screen: ScreenLayer) {
        this.host = host;
        this.screen = screen;
    }

    draw(): void {
        if (hintArrow.type !== 1 && hintArrow.type !== 2) return;
        const sprite = this.getSprite();
        if (!sprite || !isHintArrowBlinkOn()) return;
        const args = this.host.buildUpdateArgs();
        const helpers = args.helpers;
        if (!helpers?.worldToScreen) return;

        let worldX: number;
        let worldZ: number;
        let plane: number;
        let heightOffsetTiles: number;
        if (hintArrow.type === 1) {
            // Follow the rendered (interpolated) NPC like the native head icons do.
            const npcEcs = this.host.osrsClient.npcEcs;
            const ecsId = npcEcs?.getEcsIdForServer?.(hintArrow.npcId);
            if (ecsId === undefined || ecsId < 0) return;
            const mapId = npcEcs.getMapId(ecsId) | 0;
            // Native: worldToScreenActor(npc, getLogicalHeightWithAnimationOffset() + 15).
            const anchor = this.host.resolveNpcOverlayAnchor(
                ecsId,
                ((mapId >> 8) & 0xff) * 64 + (npcEcs.getX(ecsId) | 0) / 128,
                (mapId & 0xff) * 64 + (npcEcs.getY(ecsId) | 0) / 128,
                npcEcs.getNpcTypeId(ecsId) | 0,
            );
            if (!anchor) return;
            worldX = anchor.worldX;
            worldZ = anchor.worldZ;
            plane = npcEcs.getLevel(ecsId) | 0;
            heightOffsetTiles = anchor.logicalHeightTiles + 15 / 128;
        } else {
            // Tile hints carry their own floor: another floor's target is not drawn here.
            const localPlane = args.state.playerLevel ?? 0;
            if ((hintArrow.plane | 0) !== localPlane) return;
            // As the OSRS client: the tile's centre or edge, `height * 2` world units up.
            const [subX, subY] = hintArrowTileOffset(hintArrow.position);
            worldX = hintArrow.x + subX / 128;
            worldZ = hintArrow.y + subY / 128;
            plane = localPlane;
            heightOffsetTiles = ((hintArrow.height | 0) * 2) / 128;
        }

        // Scene Y points down, so "up" is ground minus the offset.
        const ground = helpers.getMinTileHeightInRadius(worldX, worldZ, plane, 0) ?? 0;
        const screenPos = helpers.worldToScreen(worldX, ground - heightOffsetTiles, worldZ);
        if (!screenPos || typeof screenPos[0] !== "number" || typeof screenPos[1] !== "number") return;

        // Native draws at (x - 12, y - 28) in UI pixels; scale to buffer pixels.
        const scale = Number.isFinite(this.scale) && this.scale > 0 ? this.scale : 1.0;
        this.screen.queueTexture(
            sprite,
            Math.round(screenPos[0] + (this.offsetX - 12) * scale),
            Math.round(screenPos[1] + (this.offsetY - 28) * scale),
            Math.max(1, Math.round(sprite.width * scale)),
            Math.max(1, Math.round(sprite.height * scale)),
            0,
            0,
            1,
            1,
            1,
            1,
            1,
            1,
        );
    }

    dispose(): void {
        if (this.sprite) this.screen.releaseTexture(this.sprite);
        this.sprite = undefined;
        this.loadAttempted = false;
    }

    private getSprite(): ScreenTexture | undefined {
        if (this.sprite || this.loadAttempted) return this.sprite;
        const cacheSystem = this.host.osrsClient.cacheSystem;
        if (!cacheSystem) return undefined;
        this.loadAttempted = true;
        try {
            const spriteIndex = cacheSystem.getIndex(IndexType.DAT2.sprites);
            const archiveId = spriteIndex.getArchiveId("headicons_hint");
            if (archiveId < 0) return undefined;
            const indexed = SpriteLoader.loadIntoIndexedSprites(spriteIndex, archiveId)?.[0];
            if (!indexed) return undefined;
            const { pixels, width, height } = indexedSpriteToPixels(indexed as IndexedSprite);
            this.sprite = this.screen.createPixelTexture(pixels, width, height);
            this.offsetX = indexed.xOffset | 0;
            this.offsetY = indexed.yOffset | 0;
        } catch {
            this.sprite = undefined;
        }
        return this.sprite;
    }
}
