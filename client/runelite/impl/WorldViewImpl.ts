import { LocalPoint } from "../api/coords/LocalPoint";
import type { WorldView } from "../api/WorldView";
import type { WorldPoint } from "../api/coords/WorldPoint";
import { ClientState } from "../../game/ClientState";
import type { ClientImpl } from "./ClientImpl";
import { SceneImpl } from "./SceneImpl";
import type { WorldView as NativeWorldView } from "../../game/worldview/WorldView";
export class WorldViewImpl implements WorldView {
    private readonly scene:SceneImpl;
    constructor(private readonly client:ClientImpl,private readonly id:number, private readonly retainedValue:NativeWorldView|undefined=client.engine.worldViewManager.getWorldView(id)) { this.scene=new SceneImpl(client,this); }
    private get value():NativeWorldView|undefined { return this.isTopLevel() ? this.client.engine.worldViewManager.getWorldView(this.id) : this.retainedValue; }
    matchesNative(value:NativeWorldView):boolean { return this.isTopLevel() || this.retainedValue===value; }
    getId():number { return this.id; } isTopLevel():boolean { return this.id===-1; }
    getBaseX():number { return this.isTopLevel() ? ClientState.baseX : this.value!.baseX; }
    getBaseY():number { return this.isTopLevel() ? ClientState.baseY : this.value!.baseY; }
    getPlane():number { return this.isTopLevel() ? ClientState.plane : this.value!.plane; }
    getSizeX():number { return this.value?.sizeX ?? 104; } getSizeY():number { return this.value?.sizeY ?? 104; }
    isInstance():boolean { return this.isTopLevel() ? ClientState.inInstance : (this.value?.templateChunks.length ?? 0)>0; }
    getInstanceTemplateChunks():number[][][] { return this.isTopLevel() ? ClientState.instanceTemplateChunks ?? [] : this.value!.templateChunks; }
    contains(p:WorldPoint|LocalPoint):boolean { if(p instanceof LocalPoint)return p.getWorldView()===this.id && p.getSceneX()>=0 && p.getSceneY()>=0 && p.getSceneX()<this.getSizeX() && p.getSceneY()<this.getSizeY(); return p.getX()>=this.getBaseX() && p.getY()>=this.getBaseY() && p.getX()<this.getBaseX()+this.getSizeX() && p.getY()<this.getBaseY()+this.getSizeY(); }
    getTileHeights():number[][][] { return this.scene.getTileHeights(); }
    getTileSettings():number[][][] { return this.scene.getTileSettings(); }
    getCollisionMaps() { return this.scene.getCollisionMaps(); }
    getSelectedSceneTile() { const t=this.client.getSelectedSceneTile();return t?.worldViewId===this.id ? t:null; }
    getTileHeight(x:number,y:number,plane:number):number { return this.client.getTileHeight(x,y,plane,this.id); }
    getScene():SceneImpl { return this.scene; }
    players() { return this.client.getPlayers().filter(a=>a.getWorldView().getId()===this.id); }
    npcs() { return this.client.getNpcs().filter(a=>a.getWorldView().getId()===this.id); }
}
