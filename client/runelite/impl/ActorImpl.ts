import { Perspective } from "../api/Perspective";
import type { Graphics2D } from "../awt/Graphics2D";
import type { Point } from "../awt/Point";
import type { Polygon } from "../awt/Polygon";
import type { BufferedImage } from "../awt/image/BufferedImage";
import type { Actor } from "../api/Actor";
import { LocalPoint } from "../api/coords/LocalPoint";
import { WorldPoint } from "../api/coords/WorldPoint";
import { WorldArea } from "../api/coords/WorldArea";
import type { WorldView } from "../api/WorldView";
import type { ClientImpl } from "./ClientImpl";
import type { SpritePixels } from "../api/SpritePixels";
import type { PlayerAnimKey } from "../../game/ecs/PlayerEcs";
import { actorModel, actorModelPoints, convexHull } from "./ActorModel";
import type { ModelImpl } from "./ModelImpl";
import { ActorGraphics } from "./ActorGraphics";
/** A wrapper belongs to one spawn. Removed actors retain their last observable state. */
export abstract class ActorImpl implements Actor {
    private dead=false;
    private modelCache:{key:string;model:ModelImpl|null}|null=null;
    private removedState:{frame:number;poseFrame:number;height:number;overheadCycle:number;heightOffset:number;modelHeight:number;sequences:Partial<Record<PlayerAnimKey,number>>}|null=null;
    setDead(dead:boolean):void { this.dead=dead; }
    private detached: { name:string|null; world:WorldPoint; local:LocalPoint; view:WorldView; animation:number; pose:number; graphic:number; orientation:number; current:number; text:string|null; combat:number; ratio:number; scale:number; size:number } | null = null;
    private readonly graphics:ActorGraphics;
    constructor(protected readonly client:ClientImpl, readonly ecsIndex:number, readonly serverIndex:number, readonly kind:"npc"|"player") { this.graphics=new ActorGraphics(client,kind,serverIndex); }
    protected abstract readName():string|null;
    protected abstract readWorld():WorldPoint;
    protected abstract readAnimation():number;
    protected abstract readPose():number;
    protected abstract readOrientation():number;
    protected abstract readCurrentOrientation():number;
    protected abstract readText():string|null;
    protected abstract readCombat():number;
    protected abstract readSize():number;
    protected abstract readViewId():number;
    protected abstract readInteraction():number;
    abstract setAnimation(animation:number):void;
    detach():void { if(this.detached)return;this.graphics.detach();this.removedState={frame:this.getAnimationFrame(),poseFrame:this.getPoseAnimationFrame(),height:this.getLogicalHeight(),overheadCycle:this.getOverheadCycle(),heightOffset:this.getAnimationHeightOffset(),modelHeight:this.getModelHeight(),sequences:{}};for(const key of ["idle","turnLeft","turnRight","walk","walkLeft","walkRight","walkBack","run"] as PlayerAnimKey[])this.removedState.sequences[key]=this.sequence(key); this.detached={name:this.getName(),world:this.getWorldLocation(),local:this.getLocalLocation(),view:this.getWorldView(),animation:this.getAnimation(),pose:this.getPoseAnimation(),graphic:this.getGraphic(),orientation:this.getOrientation(),current:this.getCurrentOrientation(),text:this.getOverheadText(),combat:this.getCombatLevel(),ratio:this.getHealthRatio(),scale:this.getHealthScale(),size:this.readSize()}; }
    getName():string|null { return this.detached ? this.detached.name : this.readName(); }
    getWorldLocation():WorldPoint { return this.detached?.world ?? this.readWorld(); }
    getWorldView():WorldView { return this.detached?.view ?? this.client.getWorldView(this.readViewId()) ?? this.client.getTopLevelWorldView(); }
    getLocalLocation():LocalPoint { if(this.detached)return this.detached.local; const v=this.getWorldView(); const fine=this.kind==="npc" ? {x:this.client.engine.npcEcs.getWorldX(this.ecsIndex),y:this.client.engine.npcEcs.getWorldY(this.ecsIndex)} : {x:this.client.engine.playerEcs.getX(this.ecsIndex),y:this.client.engine.playerEcs.getY(this.ecsIndex)}; return new LocalPoint(fine.x-(v.getBaseX()<<7),fine.y-(v.getBaseY()<<7),v); }
    getAnimationHeightOffset():number { if(this.removedState)return this.removedState.heightOffset;const engine=this.client.engine,delay=this.kind==="player" ? engine.playerEcs.getAnimSeqDelay(this.ecsIndex):engine.npcEcs.getSeqDelay(this.ecsIndex);const sequence=this.getAnimation()>=0 && delay===0 ? this.getAnimation():this.getPoseAnimation();return sequence>=0 ? engine.seqTypeLoader.load(sequence).verticalOffset:0; }
    getLogicalHeight():number {
        if(this.removedState)return this.removedState.height;
        const renderer=this.client.engine.renderer as unknown as {resolvePlayerLogicalHeightTiles?:(id:number)=>number;resolveNpcOverlayAnchor?:(id:number,x:number,z:number,type:number)=>{logicalHeightTiles:number};overlays?:{getHost:()=>typeof renderer|undefined}};
        const source=renderer.resolvePlayerLogicalHeightTiles ? renderer:renderer.overlays?.getHost();
        if(this.kind==="player" && source?.resolvePlayerLogicalHeightTiles)return Math.round(source.resolvePlayerLogicalHeightTiles(this.ecsIndex)*128);
        if(this.kind==="npc" && source?.resolveNpcOverlayAnchor){const ecs=this.client.engine.npcEcs;return Math.round(source.resolveNpcOverlayAnchor(this.ecsIndex,ecs.getWorldX(this.ecsIndex)/128,ecs.getWorldY(this.ecsIndex)/128,ecs.getNpcTypeId(this.ecsIndex)).logicalHeightTiles*128);}
        return this.client.getActorLogicalHeight(this.kind,this.ecsIndex)+this.getAnimationHeightOffset();
    }
    getCameraFocus():LocalPoint { return this.getLocalLocation(); }
    getFootprintSize():number { return this.detached?.size ?? this.readSize(); }
    getModelHeight():number { return this.removedState?.modelHeight ?? (this.kind==="player" ? this.client.engine.playerEcs:this.client.engine.npcEcs).getModelHeightOverride(this.ecsIndex) ?? this.client.getActorLogicalHeight(this.kind,this.ecsIndex); }
    setModelHeight(height:number):void { this.assertAttached();(this.kind==="player" ? this.client.engine.playerEcs:this.client.engine.npcEcs).setModelHeightOverride(this.ecsIndex,height); }
    getModel():ModelImpl|null { if(this.detached)return this.modelCache?.model ?? null;const appearance=this.kind==="player" ? this.client.engine.playerEcs.getAppearance(this.ecsIndex)?.getHash():this.client.engine.npcEcs.getNpcTypeId(this.ecsIndex);const spots=[...this.graphics].map(spot=>`${spot.getId()}:${spot.getFrame()}:${spot.getCycle()}:${spot.getHeight()}`).join(";");const key=`${this.client.getGameCycle()}:${appearance}:${this.getAnimation()}:${this.getAnimationFrame()}:${this.getPoseAnimation()}:${this.getPoseAnimationFrame()}:${spots}`;if(this.modelCache?.key!==key)this.modelCache={key,model:actorModel(this.client,this)};return this.modelCache.model; }
    getConvexHull():Polygon|null { const model=this.getModel();return model ? convexHull(actorModelPoints(this.client,this,model)):null; }
    getCanvasSpriteLocation(sprite:SpritePixels,heightOffset:number):Point|null { return Perspective.getCanvasSpriteLocation(this.client,this.getLocalLocation(),sprite,heightOffset); }
    getAnimationFrame():number { return this.removedState?.frame ?? (this.kind==="player" ? this.client.engine.playerEcs.getAnimSeqFrame(this.ecsIndex):this.client.engine.npcEcs.getFrameIndex(this.ecsIndex)); }
    setActionFrame(frame:number):void { this.setAnimationFrame(frame); }
    setAnimationFrame(frame:number):void { this.assertAttached();if(this.kind==="player"){this.client.engine.playerEcs.setAnimSeqFrame(this.ecsIndex,frame);this.client.engine.playerAnimController?.setActionFrame(this.serverIndex,frame);}else this.client.engine.npcEcs.setFrameIndex(this.ecsIndex,frame); }
    getPoseAnimationFrame():number { return this.removedState?.poseFrame ?? (this.kind==="player" ? this.client.engine.playerAnimController?.getMovementSequenceState(this.serverIndex)?.frame ?? 0:this.client.engine.npcEcs.getMovementFrameIndex(this.ecsIndex)); }
    setPoseAnimationFrame(frame:number):void { this.assertAttached();if(this.kind==="player")this.client.engine.playerAnimController.setMovementFrame(this.serverIndex,frame);else this.client.engine.npcEcs.setMovementFrameIndex(this.ecsIndex,frame); }
    setPoseAnimation(animation:number):void { this.assertAttached();if(this.kind==="player")this.client.engine.playerEcs.setAnimMovementSeqId(this.ecsIndex,animation);else this.client.engine.npcEcs.setMovementSeqId(this.ecsIndex,animation); }
    private sequence(key:PlayerAnimKey):number { if(this.detached)return this.removedState!.sequences[key]!;if(this.kind==="player")return this.client.engine.playerEcs.getAnimSeq(this.ecsIndex,key);const ecs=this.client.engine.npcEcs;return ecs.getMovementOverrides(this.ecsIndex)?.[key] ?? this.client.engine.npcTypeLoader.load(ecs.getNpcTypeId(this.ecsIndex)).getMovementSeqSet(this.client.engine.basTypeLoader)[key]; }
    private setSequence(key:PlayerAnimKey,value:number):void { this.assertAttached();if(this.kind==="player")this.client.engine.playerEcs.setAnimSequence(this.ecsIndex,key,value);else this.client.engine.npcEcs.setMovementOverride(this.ecsIndex,key,value); }
    getIdlePoseAnimation():number { return this.sequence("idle"); } setIdlePoseAnimation(v:number):void { this.setSequence("idle",v); }
    getIdleRotateLeft():number { return this.sequence("turnLeft"); } setIdleRotateLeft(v:number):void { this.setSequence("turnLeft",v); }
    getIdleRotateRight():number { return this.sequence("turnRight"); } setIdleRotateRight(v:number):void { this.setSequence("turnRight",v); }
    getWalkAnimation():number { return this.sequence("walk"); } setWalkAnimation(v:number):void { this.setSequence("walk",v); }
    getWalkRotateLeft():number { return this.sequence("walkLeft"); } setWalkRotateLeft(v:number):void { this.setSequence("walkLeft",v); }
    getWalkRotateRight():number { return this.sequence("walkRight"); } setWalkRotateRight(v:number):void { this.setSequence("walkRight",v); }
    getWalkRotate180():number { return this.sequence("walkBack"); } setWalkRotate180(v:number):void { this.setSequence("walkBack",v); }
    getRunAnimation():number { return this.sequence("run"); } setRunAnimation(v:number):void { this.setSequence("run",v); }
    getOverheadCycle():number { return this.removedState?.overheadCycle ?? (this.kind==="player" ? this.client.engine.playerEcs:this.client.engine.npcEcs).getOverheadCycle(this.ecsIndex); }
    setOverheadCycle(cycles:number):void { this.assertAttached();(this.kind==="player" ? this.client.engine.playerEcs:this.client.engine.npcEcs).setOverheadCycle(this.ecsIndex,cycles); }
    setOverheadText(text:string|null):void { this.assertAttached();(this.kind==="player" ? this.client.engine.playerEcs:this.client.engine.npcEcs).setOverheadTextRaw(this.ecsIndex,text ?? undefined); }
    getMinimapLocation():Point|null { return Perspective.localToMinimap(this.client,this.getLocalLocation()); }
    getCanvasTilePoly():Polygon|null { return Perspective.getCanvasTileAreaPoly(this.client,this.getLocalLocation(),this.getFootprintSize()); }
    getCanvasTextLocation(graphics:Graphics2D,text:string,heightOffset:number):Point|null { return Perspective.getCanvasTextLocation(this.client,graphics,this.getLocalLocation(),text,heightOffset); }
    getCanvasImageLocation(image:BufferedImage,heightOffset:number):Point|null { return Perspective.getCanvasImageLocation(this.client,this.getLocalLocation(),image,heightOffset); }
    getWorldArea():WorldArea { const size=this.detached?.size ?? this.readSize(); const p=this.getWorldLocation(); return new WorldArea(p,size,size); }
    getAnimation():number { return this.detached?.animation ?? this.readAnimation(); }
    getPoseAnimation():number { return this.detached?.pose ?? this.readPose(); }
    getOrientation():number { return this.detached?.orientation ?? this.readOrientation(); }
    getCurrentOrientation():number { return this.detached?.current ?? this.readCurrentOrientation(); }
    getOverheadText():string|null { return this.detached ? this.detached.text : this.readText(); }
    getCombatLevel():number { return this.detached?.combat ?? this.readCombat(); }
    getGraphic():number { return this.detached?.graphic ?? this.legacySpot()?.getId() ?? -1; }
    getSpotAnims():ActorGraphics { return this.graphics; }
    hasSpotAnim(id:number):boolean { for(const spot of this.graphics)if(spot.getId()===id)return true;return false; }
    createSpotAnim(slot:number,id:number,height:number,delay:number):void { this.assertAttached();this.graphics.create(slot,id,height,delay); }
    removeSpotAnim(slot:number):void { this.assertAttached();this.graphics.remove(slot); }
    clearSpotAnims():void { this.assertAttached();this.graphics.clear(); }
    private legacySpot() { return this.graphics.get(0) ?? this.graphics[Symbol.iterator]().next().value ?? null; }
    setGraphic(id:number):void { this.assertAttached();const current=this.legacySpot();if(current){if(id<0)this.removeSpotAnim(Number(current.getHash()));else current.setId(id);}else this.createSpotAnim(0,id,0,0); }
    getGraphicHeight():number { return this.legacySpot()?.getHeight() ?? 0; }
    setGraphicHeight(height:number):void { this.assertAttached();this.legacySpot()?.setHeight(height); }
    getSpotAnimFrame():number { return this.legacySpot()?.getFrame() ?? -1; }
    setSpotAnimFrame(frame:number):void { this.assertAttached();this.legacySpot()?.setFrame(frame); }
    getHealthRatio():number { return this.detached?.ratio ?? this.client.getActorHealth(this.kind,this.serverIndex).ratio; }
    getHealthScale():number { return this.detached?.scale ?? this.client.getActorHealth(this.kind,this.serverIndex).scale; }
    isDead():boolean { return this.dead; }
    getInteracting():Actor|null { if(this.detached)return null; const i=this.readInteraction(); return i < 0 ? null : i < 65536 ? this.client.getNpcByIndex(i) : this.client.getPlayerByIndex(i-65536); }
    isInteracting():boolean { return !this.detached && this.readInteraction()!==-1; }
    protected assertAttached():void { if(this.detached) throw new Error("Actor is no longer spawned"); }
}
