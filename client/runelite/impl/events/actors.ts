import { baseNpcTypeId } from "../../../custom/npcs/NpcModelOverrideRegistry";
import type { NpcEcs } from "../../../game/ecs/NpcEcs";
import type { PlayerEcs } from "../../../game/ecs/PlayerEcs";
import type { ActorMutation } from "../../../game/ecs/ActorMutation";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { AnimationChanged, InteractingChanged, NpcChanged, NpcDespawned, NpcSpawned, OverheadTextChanged, PlayerChanged, PlayerDespawned, PlayerSpawned } from "../../api/events";

export function bindActorEvents(npcs: NpcEcs, players: PlayerEcs, client: ClientImpl, bus: EventBus): { flush(): void; dispose(): void } {
    const pending: object[] = [];
    const npcChange = (change: ActorMutation) => {
        if (npcs.getServerId(change.index) <= 0) return;
        const actor = change.kind === "despawn" ? client.releaseNpc(change.index) : client.acquireNpc(change.index);
        if (!actor) return;
        switch (change.kind) {
            case "spawn": pending.push(new NpcSpawned(actor)); break;
            case "despawn": pending.push(new NpcDespawned(actor)); break;
            case "composition": {
                const oldId = baseNpcTypeId(change.oldId!);
                // Renderer model customization changes a synthetic ID without changing composition.
                if (oldId !== actor.getId()) pending.push(new NpcChanged(actor, client.getNpcDefinition(oldId)));
                break;
            }
            case "animation": pending.push(new AnimationChanged(actor)); break;
            case "interacting": pending.push(new InteractingChanged(actor, actor.getInteracting())); break;
            case "overhead": pending.push(new OverheadTextChanged(actor, change.text ?? "")); break;
        }
    };
    const playerChange = (change: ActorMutation) => {
        if (players.getServerIdForIndex(change.index) === undefined) return;
        const actor = change.kind === "despawn" ? client.releasePlayer(change.index) : client.acquirePlayer(change.index);
        if (!actor) return;
        switch (change.kind) {
            case "spawn": pending.push(new PlayerSpawned(actor)); break;
            case "despawn": pending.push(new PlayerDespawned(actor)); break;
            case "appearance": pending.push(new PlayerChanged(actor)); break;
            case "animation": pending.push(new AnimationChanged(actor)); break;
            case "interacting": pending.push(new InteractingChanged(actor, actor.getInteracting())); break;
            case "overhead": pending.push(new OverheadTextChanged(actor, change.text ?? "")); break;
        }
    };
    npcs.mutationListeners.add(npcChange);
    players.mutationListeners.add(playerChange);
    return {
        flush() { for (const event of pending.splice(0)) bus.post(event); },
        dispose() { npcs.mutationListeners.delete(npcChange); players.mutationListeners.delete(playerChange); pending.length = 0; },
    };
}
