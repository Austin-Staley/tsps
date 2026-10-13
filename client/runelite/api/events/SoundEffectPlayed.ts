import type { Actor } from "../Actor";
export class SoundEffectPlayed {
    private consumed = false;
    constructor(private readonly source: Actor | null, private soundId: number, private delay: number) {}
    getSource(): Actor | null { return this.source; }
    getSoundId(): number { return this.soundId; }
    setSoundId(value: number): void { this.soundId = value; }
    getDelay(): number { return this.delay; }
    setDelay(value: number): void { this.delay = value; }
    consume(): void { this.consumed = true; }
    isConsumed(): boolean { return this.consumed; }
}
