import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";

import { EXCLUDED_NPC_IDLES, EXCLUDED_SEQUENCES } from "./exclusions";

/**
 * Animation smoothing, as in RuneLite: keyframe animations of players, NPCs, graphics and
 * scenery are blended toward their next frame by how far into the current frame they are,
 * instead of jumping from frame to frame. The renderers ask smoothsPlayer/smoothsNpc per
 * animation; scenery is baked a frame per client cycle when its map square loads
 * (smoothsObjects), skipping EXCLUDED_SEQUENCES there.
 */
export class AnimationSmoothingPlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "Animation Smoothing",
        description: "Blends player, NPC, graphic and object animations between their frames.",
        tags: ["animation"],
        enabledByDefault: false,
        configKey: "animationsmoothingplugin",
    };

    /** Whether a player's animation (action or movement) is blended. */
    smoothsPlayer(seqId: number): boolean {
        return this.isEnabled() && !EXCLUDED_SEQUENCES.has(seqId);
    }

    /** Whether graphics (spotanims on actors and the ground, and projectiles) are blended. */
    smoothsGraphics(): boolean {
        return this.isEnabled();
    }

    /** Whether scenery animations are baked blended (read when a map square is built). */
    smoothsObjects(): boolean {
        return this.isEnabled();
    }

    /** Whether an NPC's animation is blended; `action` is false for its movement/idle pose. */
    smoothsNpc(npcTypeId: number, seqId: number, action: boolean): boolean {
        if (!this.isEnabled() || EXCLUDED_SEQUENCES.has(seqId)) return false;
        return action || !EXCLUDED_NPC_IDLES.has(npcTypeId);
    }
}
