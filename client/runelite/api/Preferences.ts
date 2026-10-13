/** RuneLite's persisted login and audio preferences, backed by the browser client. */
export interface Preferences {
    getRememberedUsername(): string | null;
    setRememberedUsername(username: string | null): void;
    getSoundEffectVolume(): number;
    setSoundEffectVolume(volume: number): void;
    getAreaSoundEffectVolume(): number;
    setAreaSoundEffectVolume(volume: number): void;
    getHideUsername(): boolean;
}
