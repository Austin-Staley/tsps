import type { OsrsClient } from "../../game/OsrsClient";
import type { NpcType } from "../../rs/config/npctype/NpcType";
import type { NPCComposition } from "../api/NPCComposition";
import { CompositionImpl } from "./CompositionImpl";
export class NPCCompositionImpl extends CompositionImpl implements NPCComposition {
    constructor(engine:OsrsClient, protected readonly value:NpcType) { super(engine,value); }
    getName():string { return this.value.name; } getActions():string[] { return this.value.actions; }
    getSize():number { return this.value.size; } getCombatLevel():number { return this.value.combatLevel; }
    getConfigs():number[]|null { return this.value.transforms ?? null; }
    transform():NPCComposition|null { const v=this.value.transform(this.engine.varManager,this.engine.npcTypeLoader); return v ? new NPCCompositionImpl(this.engine,v) : null; }
    isFollower():boolean { return this.value.isFollower; } isInteractible():boolean { return this.value.isInteractable; }
    getModels():number[]|null { return this.value.modelIds ?? null; }
}
