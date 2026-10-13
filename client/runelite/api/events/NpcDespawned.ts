import type { NPC } from "../NPC";

export class NpcDespawned {
    constructor(private readonly npc: NPC) {}
    getNpc(): NPC { return this.npc; }
    getActor(): NPC { return this.npc; }
}
