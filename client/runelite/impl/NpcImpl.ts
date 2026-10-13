import type { NPC } from "../api/NPC";
import type { NPCComposition } from "../api/NPCComposition";
import { WorldPoint } from "../api/coords/WorldPoint";
import type { ClientImpl } from "./ClientImpl";
import { ActorImpl } from "./ActorImpl";
import type { NpcOverrides } from "../api/NpcOverrides";
import { baseNpcTypeId } from "../../custom/npcs/NpcModelOverrideRegistry";
export class NpcImpl extends ActorImpl implements NPC {
    private lastTypeId:number;
    private removed=false;
    detach():void { this.lastTypeId=this.getId();super.detach();this.removed=true; }
    constructor(client:ClientImpl,index:number,serverIndex:number) { super(client,index,serverIndex,"npc"); this.lastTypeId=baseNpcTypeId(this.ecs.getNpcTypeId(index)); }
    private get ecs() { return this.client.engine.npcEcs; }
    getIndex():number { return this.serverIndex; }
    getId():number { return this.lastTypeId=!this.removed && this.ecs.isActive(this.ecsIndex) && this.ecs.getServerId(this.ecsIndex)===this.serverIndex ? baseNpcTypeId(this.ecs.getNpcTypeId(this.ecsIndex)) : this.lastTypeId; }
    getComposition():NPCComposition { return this.client.getNpcDefinition(this.getId()); }
    getTransformedComposition():NPCComposition|null { const c=this.getComposition(); return c.getConfigs() ? c.transform() : c; }
    private overrides:{record:object;value:NpcOverrides}|null=null;
    getModelOverrides():NpcOverrides|null { if(this.removed)return this.overrides?.value ?? null;const record=this.client.engine.getNpcModelOverride(this.serverIndex);if(!record)return null;if(this.overrides?.record!==record){const ids=this.client.engine.npcTypeLoader.load(this.ecs.getNpcTypeId(this.ecsIndex)).modelIds;this.overrides={record,value:{getModelIds:()=>ids ?? null,getColorToReplaceWith:()=>null,getTextureToReplaceWith:()=>null,useLocalPlayer:()=>false}};}return this.overrides.value; }
    // The native NPC stream currently sends only body-model customisation, not chathead overrides.
    getChatheadOverrides():NpcOverrides|null { return null; }
    getOverheadArchiveIds():number[]|null { return this.client.engine.npcTypeLoader.load(this.getTransformedComposition()?.getId() ?? this.getId()).headIconSpriteIds ?? null; }
    getOverheadSpriteIds():number[]|null { return this.client.engine.npcTypeLoader.load(this.getTransformedComposition()?.getId() ?? this.getId()).headIconSpriteIndices ?? null; }
    protected readName():string|null { return this.getTransformedComposition()?.getName() ?? null; }
    protected readWorld():WorldPoint { const s=this.ecs.getServerState(this.ecsIndex); return s ? new WorldPoint(s.tileX,s.tileY,s.plane) : new WorldPoint(this.ecs.getWorldX(this.ecsIndex)>>7,this.ecs.getWorldY(this.ecsIndex)>>7,this.ecs.getLevel(this.ecsIndex)); }
    protected readAnimation():number { return this.ecs.getSeqId(this.ecsIndex); }
    protected readPose():number { return this.ecs.getMovementSeqId(this.ecsIndex); }
    protected readOrientation():number { return this.ecs.getTargetRot(this.ecsIndex); }
    protected readCurrentOrientation():number { return this.ecs.getRotation(this.ecsIndex); }
    protected readText():string|null { return this.ecs.getOverheadTextRaw(this.ecsIndex) ?? null; }
    protected readCombat():number { return this.getTransformedComposition()?.getCombatLevel() ?? -1; }
    protected readSize():number { return this.ecs.getSize(this.ecsIndex); }
    protected readViewId():number { return this.ecs.getWorldViewId(this.ecsIndex); }
    protected readInteraction():number { return this.ecs.getInteractionIndex(this.ecsIndex); }
    setAnimation(id:number):void { this.assertAttached(); this.ecs.setSequenceId(this.ecsIndex,id); }
}
