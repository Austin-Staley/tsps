import type { GfxManager, GfxInstance } from "../../render/gfx/GfxManager";
import type { GfxCache } from "../../render/gfx/GfxCache";
import { notifyActorGraphic } from "../../game/ActorEventHooks";
import type { ClientImpl } from "./ClientImpl";
import type { ActorSpotAnim } from "../api/ActorSpotAnim";
import type { IterableHashTable } from "../api/IterableHashTable";
import { ModelImpl } from "./ModelImpl";

export class ActorGraphics implements IterableHashTable<ActorSpotAnim> {
    private readonly wrappers=new WeakMap<GfxInstance,ActorSpotAnimImpl>();
    private detached:GfxInstance[]|null=null;
    constructor(private readonly client:ClientImpl,readonly kind:"npc"|"player",readonly serverIndex:number) {}
    private get source():{manager?:GfxManager;cache?:GfxCache} {
        const r=this.client.engine.renderer as unknown as {gfxManager?:GfxManager;gfxRenderer?:{getCache:()=>GfxCache};actors?:{getActorGfxManager:()=>GfxManager|undefined;getActorGfxCache:()=>GfxCache|undefined}};
        return {manager:r.gfxManager ?? r.actors?.getActorGfxManager(),cache:r.gfxRenderer?.getCache() ?? r.actors?.getActorGfxCache()};
    }
    get manager():GfxManager { const value=this.source.manager;if(!value)throw new Error("Actor graphics are unavailable before the scene renderer is initialized");return value; }
    get cache():GfxCache|undefined { return this.source.cache; }
    wrap(value:GfxInstance):ActorSpotAnimImpl { let wrapper=this.wrappers.get(value);if(!wrapper){wrapper=new ActorSpotAnimImpl(this,value);this.wrappers.set(value,wrapper);}return wrapper; }
    detach():void { if(this.detached)return;const spots=[...this];spots.forEach(spot=>spot.freezeFrame());this.detached=spots.map(spot=>spot.value); }
    *[Symbol.iterator]():IterableIterator<ActorSpotAnimImpl> { if(this.detached){for(const instance of this.detached)yield this.wrap(instance);return;}const manager=this.source.manager;if(manager)for(const instance of manager.getActorInstances(this.kind,this.serverIndex))yield this.wrap(instance); }
    get(hash:bigint|number):ActorSpotAnimImpl|null { const slot=Number(hash);for(const wrapper of this)if((wrapper.value.slot ?? 0)===slot)return wrapper;return null; }
    put(node:ActorSpotAnim,hash:bigint|number):void { if(!(node instanceof ActorSpotAnimImpl) || node.owner!==this)throw new TypeError("Spot animation belongs to another actor");const slot=Number(hash);if(!Number.isInteger(slot)||slot<0||slot>255)throw new RangeError("Spot animation slot must be 0..255");const existing=this.get(slot);if(existing!==node)this.remove(slot);node.value.slot=slot; }
    changed():void { notifyActorGraphic({type:this.kind,serverId:this.serverIndex,graphic:this.source.manager?.getActorGraphic(this.kind,this.serverIndex) ?? -1}); }
    create(slot:number,id:number,height:number,delay:number):void {
        if(slot<0 || slot>255 || !Number.isInteger(slot))throw new RangeError("Spot animation slot must be 0..255");
        if(id<0){this.remove(slot);return;}
        const start=this.client.getGameCycle()+delay;
        if(this.kind==="player")this.manager.spawnAttachedToPlayer(id,this.serverIndex,height ? "offset":"ground",height/128,false,start,slot);
        else this.manager.spawnAttachedToNpc(id,this.serverIndex,height ? "offset":"ground",height/128,false,start,slot);
        this.changed();
    }
    remove(slot:number):void { if(this.kind==="player")this.manager.clearAttachedSlotPlayer(this.serverIndex,slot);else this.manager.clearAttachedSlotNpc(this.serverIndex,slot); }
    clear():void { this.manager.removeActorInstances(this.kind,this.serverIndex); }
}
class ActorSpotAnimImpl implements ActorSpotAnim {
    private lastFrame:{frame:number;cycle:number}|null=null;
    constructor(readonly owner:ActorGraphics,readonly value:GfxInstance) {}
    freezeFrame():void { this.lastFrame=this.owner.manager.getActorFrame(this.value); }
    getHash():bigint { return BigInt(this.value.slot ?? 0); }
    getNext():ActorSpotAnim|null { const entries=[...this.owner];return entries[entries.indexOf(this)+1] ?? null; }
    getPrevious():ActorSpotAnim|null { const entries=[...this.owner];return entries[entries.indexOf(this)-1] ?? null; }
    getId():number { return this.value.spotId; } setId(id:number):void { this.value.spotId=id;this.owner.changed(); }
    getStartCycle():number { return this.value.startCycle; } setStartCycle(cycle:number):void { this.value.startCycle=cycle;this.value.startTimeMs=undefined;this.value.endTimeMs=undefined; }
    getHeight():number { return Math.round((this.value.yOffsetTiles ?? 0)*128); } setHeight(height:number):void { this.value.yOffsetTiles=height/128;this.value.anchor=height ? "offset":"ground"; }
    getFrame():number { return this.lastFrame?.frame ?? this.owner.manager.getActorFrame(this.value).frame; } setFrame(frame:number):void { this.owner.manager.setActorFrame(this.value,frame); }
    getCycle():number { return this.lastFrame?.cycle ?? this.owner.manager.getActorFrame(this.value).cycle; } setCycle(cycle:number):void { this.owner.manager.setActorFrame(this.value,this.getFrame(),cycle); }
    getModel():ModelImpl|null { if(this.getFrame()<0)return null;const model=this.owner.cache?.getModel(this.getId(),this.getFrame(),this.getCycle());return model ? new ModelImpl(model):null; }
}
