import type { Actor } from "../Actor";
export class AreaSoundEffectPlayed {
    private consumed = false;
    constructor(private readonly source: Actor | null, private soundId: number, private sceneX: number, private sceneY: number, private range: number, private delay: number) {}
    getSource(): Actor | null { return this.source; }
    getSoundId(): number { return this.soundId; }
    setSoundId(value: number): void { this.soundId = value; }
    getSceneX(): number { return this.sceneX; }
    setSceneX(value: number): void { this.sceneX = value; }
    getSceneY(): number { return this.sceneY; }
    setSceneY(value: number): void { this.sceneY = value; }
    getRange(): number { return this.range; }
    setRange(value: number): void { this.range = value; }
    getDelay(): number { return this.delay; }
    setDelay(value: number): void { this.delay = value; }
    consume(): void { this.consumed = true; }
    isConsumed(): boolean { return this.consumed; }
}
