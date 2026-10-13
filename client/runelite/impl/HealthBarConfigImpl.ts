import type { HealthBarDefinition } from "../../rs/config/healthbar/HealthBarDefinition";
import type { OsrsClient } from "../../game/OsrsClient";
import { SpriteLoader } from "../../rs/sprite/SpriteLoader";
import { IndexType } from "../../rs/cache/IndexType";
import type { HealthBarConfig } from "../api/HealthBarConfig";
import type { SpritePixels } from "../api/SpritePixels";
import { SpritePixelsImpl } from "./SpritePixelsImpl";
export class HealthBarConfigImpl implements HealthBarConfig {
    private readonly sprites = new Map<number, SpritePixels>();
    constructor(private readonly engine: OsrsClient, private readonly value: HealthBarDefinition) {}
    private sprite(id: number): SpritePixels | null {
        if (id < 0) return null;
        const cached = this.sprites.get(id); if (cached) return cached;
        const sprite = SpriteLoader.loadIntoIndexedSprite(this.engine.cacheSystem.getIndex(IndexType.DAT2.sprites), id);
        if (!sprite) return null;
        const wrapper = SpritePixelsImpl.fromIndexed(sprite); this.sprites.set(id, wrapper); return wrapper;
    }
    getHealthBarFrontSprite(): SpritePixels | null { return this.sprite(this.value.frontSpriteId); }
    getHealthBarBackSprite(): SpritePixels | null { return this.sprite(this.value.backSpriteId); }
    getHealthBarFrontSpriteId(): number { return this.value.frontSpriteId; }
    setPadding(padding: number): void { this.value.widthPadding = padding | 0; }
}
