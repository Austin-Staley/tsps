import { Point } from "../awt/Point";
import type { Tile } from "../api/Tile";
import { WorldPoint } from "../api/coords/WorldPoint";
import { LocalPoint } from "../api/coords/LocalPoint";
import type { TileItem } from "../api/TileItem";
import type { ClientImpl } from "./ClientImpl";
export class TileImpl implements Tile {
    constructor(private readonly client:ClientImpl, readonly x:number, readonly y:number, readonly plane:number, readonly worldViewId=-1) {}
    getPlane():number { return this.plane; }
    getSceneLocation():Point { return new Point(this.x,this.y); }
    getWorldLocation():WorldPoint { return WorldPoint.fromScene(this.client.getWorldView(this.worldViewId)!,this.x,this.y,this.plane); }
    getLocalLocation():LocalPoint { return LocalPoint.fromScene(this.x,this.y,this.worldViewId); }
    getGroundItems():TileItem[] { const p=this.getWorldLocation(); return this.client.engine.groundItems.getStacksAt(p.getX(),p.getY(),this.plane).map(s=>this.client.wrapGroundItem(s)); }
    private objects() { this.client.ensureSceneMaps(); const p=this.getWorldLocation(); return this.client.sceneRegistry.objectsAt(p.getX(),p.getY(),this.plane,this.worldViewId); }
    getGameObjects() { return this.objects().filter(o=>o.kind==="GameObject"); }
    getWallObject() { return this.objects().find(o=>o.kind==="WallObject") ?? null; }
    getGroundObject() { return this.objects().find(o=>o.kind==="GroundObject") ?? null; }
    getDecorativeObject() { return this.objects().find(o=>o.kind==="DecorativeObject") ?? null; }
}
