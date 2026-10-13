import type { NPC } from "../NPC";
import type { NPCComposition } from "../NPCComposition";

export class NpcChanged {
    constructor(private readonly npc: NPC, private readonly old: NPCComposition) {}
    getNpc(): NPC { return this.npc; }
    getOld(): NPCComposition { return this.old; }
}
