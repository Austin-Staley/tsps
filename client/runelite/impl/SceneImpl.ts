import type { Scene } from "../api/Scene";
import type { Tile } from "../api/Tile";
import type { WorldView } from "../api/WorldView";
import type { ClientImpl } from "./ClientImpl";
/** Scene arrays retain their identity until a rebase; streamed changes update them in place. */
export class SceneImpl implements Scene {
    private signature="";
    private revisions={tiles:-1,heights:-1,settings:-1,collision:-1};
    private tiles:(Tile|null)[][][]=[];
    private heights:number[][][]=[];
    private settings:number[][][]=[];
    private flags:number[][][]=[];
    private readonly collision=Array.from({length:4},(_,p)=>({getFlags:()=>{this.updateCollision();return this.flags[p];}}));
    constructor(private readonly client:ClientImpl,private readonly view:WorldView) {}
    getWorldViewId():number { return this.view.getId(); } getBaseX():number { return this.view.getBaseX(); } getBaseY():number { return this.view.getBaseY(); }
    getSizeX():number { return this.view.getSizeX(); } getSizeY():number { return this.view.getSizeY(); }
    isInstance():boolean { return this.view.isInstance(); } getInstanceTemplateChunks():number[][][] { return this.view.getInstanceTemplateChunks(); }
    private revision():number {
        this.client.ensureSceneMaps();
        const key=`${this.getBaseX()}:${this.getBaseY()}:${this.getSizeX()}:${this.getSizeY()}`;
        if(key!==this.signature){this.signature=key;this.tiles=[];this.heights=[];this.settings=[];this.flags=[];this.revisions={tiles:-1,heights:-1,settings:-1,collision:-1};}
        return this.client.sceneRegistry.revision;
    }
    private numbers(array:number[][][],edge=0):number[][][] { if(array.length)return array;return Array.from({length:4},()=>Array.from({length:this.getSizeX()+edge},()=>Array(this.getSizeY()+edge).fill(0))); }
    getTiles():(Tile|null)[][][] {
        const revision=this.revision();if(this.revisions.tiles===revision)return this.tiles;
        if(!this.tiles.length)this.tiles=Array.from({length:4},()=>Array.from({length:this.getSizeX()},()=>Array(this.getSizeY()).fill(null)));
        for(let x=0;x<this.getSizeX();x++)for(let y=0;y<this.getSizeY();y++){
            const wx=this.getBaseX()+x,wy=this.getBaseY()+y,map=this.client.getSceneMap(wx,wy,this.view.getId());
            const mx=wx-(map?.getRenderBaseTileX?.() ?? (map?.mapX ?? 0)*64),my=wy-(map?.getRenderBaseTileY?.() ?? (map?.mapY ?? 0)*64),span=map?.getLocalTileSpan?.() ?? 64;
            for(let p=0;p<4;p++)this.tiles[p][x][y]=map && (map.tilePresenceByLevel?.[p]?.[my*span+mx] ?? 1) ? this.client.getSceneTile(wx,wy,p,this.view.getId()):null;
        }
        this.revisions.tiles=revision;return this.tiles;
    }
    getTileHeights():number[][][] {
        const revision=this.revision();if(this.revisions.heights===revision)return this.heights;
        this.heights=this.numbers(this.heights,1);
        for(let p=0;p<4;p++)for(let x=0;x<=this.getSizeX();x++)for(let y=0;y<=this.getSizeY();y++)this.heights[p][x][y]=this.client.getTileHeight(x<<7,y<<7,p,this.view.getId());
        this.revisions.heights=revision;return this.heights;
    }
    getTileSettings():number[][][] {
        const revision=this.revision();if(this.revisions.settings===revision)return this.settings;
        this.settings=this.numbers(this.settings);
        for(let p=0;p<4;p++)for(let x=0;x<this.getSizeX();x++)for(let y=0;y<this.getSizeY();y++)this.settings[p][x][y]=this.client.sampleTileSetting(this.getBaseX()+x,this.getBaseY()+y,p,this.view.getId());
        this.revisions.settings=revision;return this.settings;
    }
    private updateCollision():void {
        const revision=this.revision();if(this.revisions.collision===revision)return;
        this.flags=this.numbers(this.flags);
        for(let p=0;p<4;p++)for(let x=0;x<this.getSizeX();x++)for(let y=0;y<this.getSizeY();y++)this.flags[p][x][y]=this.client.sampleCollision(this.getBaseX()+x,this.getBaseY()+y,p,this.view.getId());
        this.revisions.collision=revision;
    }
    getCollisionMaps() { return this.collision; }
}
