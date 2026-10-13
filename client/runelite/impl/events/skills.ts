import { subscribeSkills } from "../../../network/serverConnection/subscriptions/ui";
import type { SkillEntryMessage } from "../../../network/serverConnection/types";
import { StatChanged } from "../../api/events";
import { Skill } from "../../api/Skill";
import type { EventBus } from "../../client/eventbus/EventBus";
export function bindSkillEvents(bus: EventBus): () => void {
    const previous = new Map<number, SkillEntryMessage>();
    return subscribeSkills(update => {
        for (const entry of update.skills) {
            const old = previous.get(entry.id);
            previous.set(entry.id, { ...entry });
            if (old?.xp === entry.xp && old.baseLevel === entry.baseLevel && old.currentLevel === entry.currentLevel) continue;
            if (entry.id < 0 || entry.id > Skill.SAILING) continue;
            bus.post(new StatChanged(entry.id, entry.xp, entry.baseLevel, entry.currentLevel));
        }
    });
}
