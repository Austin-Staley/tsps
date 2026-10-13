import type { Player } from "../api/Player";
import { WorldPoint } from "../api/coords/WorldPoint";
import type { ClientImpl } from "./ClientImpl";
import { ActorImpl } from "./ActorImpl";
import { PlayerCompositionImpl } from "./PlayerCompositionImpl";
import { socialNameKey } from "./SocialState";
import type { HeadIcon } from "../api/HeadIcon";
export class PlayerImpl extends ActorImpl implements Player {
    private composition:PlayerCompositionImpl|null=null;
    constructor(client:ClientImpl,index:number,serverIndex:number) { super(client,index,serverIndex,"player"); }
    private removed: {team:number;hidden:boolean;skull:number;head:HeadIcon|null}|null=null;
    detach():void { if(!this.removed){this.getPlayerComposition();this.removed={team:this.getTeam(),hidden:this.isHidden(),skull:this.getSkullIcon(),head:this.getOverheadIcon()};}super.detach(); }
    private get ecs() { return this.client.engine.playerEcs; }
    getId():number { return this.serverIndex; } getPlayerId():number { return this.serverIndex; }
    protected readName():string|null { return this.ecs.getName(this.ecsIndex) ?? null; }
    protected readWorld():WorldPoint { const s=this.client.engine.getPlayerServerTile?.(this.serverIndex); return new WorldPoint(s?.tileX ?? this.ecs.getX(this.ecsIndex)>>7,s?.tileY ?? this.ecs.getY(this.ecsIndex)>>7,this.ecs.getLevel(this.ecsIndex)); }
    protected readAnimation():number { return this.ecs.getAnimActionSeqId(this.ecsIndex); }
    protected readPose():number { return this.ecs.getAnimMovementSeqId(this.ecsIndex); }
    protected readOrientation():number { return this.ecs.getTargetRotation(this.ecsIndex); }
    protected readCurrentOrientation():number { return this.ecs.getRotation(this.ecsIndex); }
    protected readText():string|null { return this.ecs.getOverheadTextRaw(this.ecsIndex) ?? null; }
    protected readCombat():number { return this.ecs.getCombatLevel(this.ecsIndex); }
    protected readSize():number { const a=this.ecs.getAppearance(this.ecsIndex); return a?.npcTransformationId !== undefined && a.npcTransformationId>=0 ? this.client.getNpcDefinition(a.npcTransformationId).getSize() : 1; }
    protected readViewId():number { return this.ecs.getWorldViewId(this.ecsIndex); }
    protected readInteraction():number { return this.ecs.getInteractionIndex(this.ecsIndex); }
    getTeam():number { return this.removed?.team ?? this.ecs.getTeam(this.ecsIndex); } isHidden():boolean { return this.removed?.hidden ?? this.ecs.getIsHidden(this.ecsIndex); }
    getSkullIcon():number { return this.removed?.skull ?? this.ecs.getHeadIconPk(this.ecsIndex); }
    getOverheadIcon():HeadIcon|null { if(this.removed)return this.removed.head;const icon=this.ecs.getHeadIconPrayer(this.ecsIndex);return icon<0 ? null:icon as HeadIcon; }
    setSkullIcon(icon:number):void { this.assertAttached();this.ecs.setHeadIconPk(this.ecsIndex,icon); }
    getPlayerComposition():PlayerCompositionImpl|null { if(this.removed)return this.composition;const app=this.ecs.getAppearance(this.ecsIndex);if(!app)return null;if(this.composition?.appearance!==app)this.composition=new PlayerCompositionImpl(app,()=>this.client.engine.objTypeLoader,()=>{if(!this.removed && this.ecs.getAppearance(this.ecsIndex)===app){this.ecs.setBaseModel(this.ecsIndex,undefined);this.ecs.setAppearance(this.ecsIndex,app);}});return this.composition; }
    isFriend():boolean { const name=this.getName();return name!==null && this.client.socialState.friends.has(socialNameKey(name)); }
    isFriendsChatMember():boolean { const name=this.getName();return name!==null && this.client.socialState.members.has(socialNameKey(name)); }
    setAnimation(id:number):void { this.assertAttached(); if(this.client.engine.playerAnimController)this.client.engine.playerAnimController.setAnimation(this.serverIndex,id);else this.ecs.setAnimActionSeqId(this.ecsIndex,id); }
}
