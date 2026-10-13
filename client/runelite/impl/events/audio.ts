import type { SoundEffectSystem, PendingSoundEffect } from "../../../game/audio/SoundEffectSystem";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { AreaSoundEffectPlayed, SoundEffectPlayed, VolumeChanged } from "../../api/events";
export function bindAudioEvents(system: SoundEffectSystem, client: ClientImpl, bus: EventBus): () => void {
    const play = (pending: PendingSoundEffect) => {
        const options = pending.options;
        const source = options.isLocalPlayer ? client.getLocalPlayer() : null;
        const delay = Math.floor((options.delayMs ?? 0) / 20);
        if (options.position && options.radius !== undefined) {
            if (!bus.hasSubscribers(AreaSoundEffectPlayed)) return;
            const x = Math.floor(options.position.x / 128) - client.getBaseX();
            const y = Math.floor(options.position.y / 128) - client.getBaseY();
            const event = new AreaSoundEffectPlayed(source, pending.soundId, x, y, Math.floor(options.radius / 128), delay);
            bus.post(event);
            options.position = { ...options.position, x: options.position.x + (event.getSceneX() - x) * 128, y: options.position.y + (event.getSceneY() - y) * 128 };
            options.radius = event.getRange() * 128;
            options.delayMs = event.getDelay() * 20;
            pending.soundId = event.getSoundId(); pending.consumed = event.isConsumed();
        } else {
            if (!bus.hasSubscribers(SoundEffectPlayed)) return;
            const event = new SoundEffectPlayed(source, pending.soundId, delay);
            bus.post(event);
            pending.soundId = event.getSoundId(); options.delayMs = event.getDelay() * 20; pending.consumed = event.isConsumed();
        }
    };
    const volume = (type: "effects" | "area") => bus.post(new VolumeChanged(type === "effects" ? VolumeChanged.Type.EFFECTS : VolumeChanged.Type.AREA));
    system.beforePlayListeners.add(play); system.volumeChangedListeners.add(volume);
    return () => { system.beforePlayListeners.delete(play); system.volumeChangedListeners.delete(volume); };
}
