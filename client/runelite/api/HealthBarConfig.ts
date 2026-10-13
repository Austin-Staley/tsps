import type { SpritePixels } from "./SpritePixels";
export interface HealthBarConfig {
    getHealthBarFrontSprite(): SpritePixels | null;
    getHealthBarBackSprite(): SpritePixels | null;
    getHealthBarFrontSpriteId(): number;
    setPadding(padding: number): void;
}
