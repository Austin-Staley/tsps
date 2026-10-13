import type { NPC } from "../NPC";

export class NpcSpawned {
    constructor(private readonly npc: NPC) {}
    getNpc(): NPC { return this.npc; }
    getActor(): NPC { return this.npc; }
}
