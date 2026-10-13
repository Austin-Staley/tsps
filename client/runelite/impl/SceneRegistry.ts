import type { ClientImpl } from "./ClientImpl";
import { TileObjectImpl, SceneObjectKind } from "./TileObjectImpl";
export interface SceneMapData {
    mapX:number; mapY:number; id?:number;
    getRenderBaseTileX?():number; getRenderBaseTileY?():number; getLocalTileSpan?():number;
    tilePresenceByLevel?:Uint8Array[];
    tileLocOffsetsByLevel?:Uint32Array[]; tileLocIdsByLevel?:Int32Array[]; tileLocTypeRotByLevel?:Uint8Array[];
}
export interface SceneObjectChange { kind:SceneObjectKind; object:TileObjectImpl; spawned:boolean; }
/** Retained interaction metadata, independent of GPU geometry and its reloads. */
export class SceneRegistry {
    revision=0;
    private maps = new Map<string, Map<string, TileObjectImpl>>();
    private sources = new Map<string, SceneMapData>();
    hasMap(map:SceneMapData):boolean { return this.sources.get(this.mapKey(map))===map; }
    private byTile = new Map<string, TileObjectImpl[]>();
    constructor(private readonly client:ClientImpl) {}
    private mapKey(map:SceneMapData):string { return `${map.mapX}:${map.mapY}`; }
    private key(x:number,y:number,plane:number,view:number):string { return `${view}:${plane}:${x}:${y}`; }
    update(map:SceneMapData):SceneObjectChange[] {
        const key=this.mapKey(map), old=this.maps.get(key) ?? new Map(), next=new Map<string,TileObjectImpl>();
        const view=this.client.engine.worldViewManager.getWorldViewByOverlayMapId(map.id ?? -1)?.id ?? -1;
        const bx=map.getRenderBaseTileX?.() ?? map.mapX*64, by=map.getRenderBaseTileY?.() ?? map.mapY*64, span=map.getLocalTileSpan?.() ?? 64;
        map.tileLocOffsetsByLevel?.forEach((offsets,plane)=>{
            const ids=map.tileLocIdsByLevel?.[plane], types=map.tileLocTypeRotByLevel?.[plane];
            if(!ids || !types)return;
            for(let tile=0;tile<offsets.length-1;tile++) for(let i=offsets[tile];i<offsets[tile+1];i++) {
                const x=bx+tile%span, y=by+Math.floor(tile/span), shape=types[i]&63, rotation=types[i]>>6;
                const kind:SceneObjectKind=shape===22 ? "GroundObject" : shape<=3 ? "WallObject" : shape<=8 ? "DecorativeObject" : "GameObject";
                const id=`${view}:${plane}:${x}:${y}:${ids[i]}:${shape}:${rotation}`;
                next.set(id,old.get(id) ?? new TileObjectImpl(this.client,kind,ids[i],x,y,plane,view,shape,rotation));
            }
        });
        const changes:SceneObjectChange[]=[];
        for(const [id,obj] of old) if(!next.has(id))changes.push({kind:obj.kind,object:obj,spawned:false});
        for(const [id,obj] of next) if(!old.has(id))changes.push({kind:obj.kind,object:obj,spawned:true});
        this.revision++;this.maps.set(key,next); this.sources.set(key,map); this.reindex(); return changes;
    }
    remove(map:SceneMapData):SceneObjectChange[] { const old=this.maps.get(this.mapKey(map)); this.revision++;this.maps.delete(this.mapKey(map));this.sources.delete(this.mapKey(map)); this.reindex(); return [...(old?.values() ?? [])].map(object=>({object,kind:object.kind,spawned:false})); }
    private reindex():void {
        this.byTile.clear();
        for(const objects of this.maps.values()) for(const o of objects.values()) {
            const c=this.client.getObjectDefinition(o.getId());
            const sx=o.kind==="GameObject" ? (o.rotation%2 ? c.getSizeY():c.getSizeX()):1, sy=o.kind==="GameObject" ? (o.rotation%2 ? c.getSizeX():c.getSizeY()):1;
            for(let dx=0;dx<sx;dx++)for(let dy=0;dy<sy;dy++) { const k=this.key(o.x+dx,o.y+dy,o.plane,o.viewId); const arr=this.byTile.get(k) ?? []; arr.push(o); this.byTile.set(k,arr); }
        }
    }
    objectsAt(x:number,y:number,plane:number,view=-1):TileObjectImpl[] { return this.byTile.get(this.key(x,y,plane,view)) ?? []; }
    reset():void { this.revision++; this.maps.clear(); this.sources.clear(); this.byTile.clear(); }
}
