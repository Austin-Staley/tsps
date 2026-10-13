import type { TileObject } from "../api/TileObject";
import { WorldPoint } from "../api/coords/WorldPoint";
import { LocalPoint } from "../api/coords/LocalPoint";
import { Perspective } from "../api/Perspective";
import { Point } from "../awt/Point";
import type { Polygon } from "../awt/Polygon";
import type { ClientImpl } from "./ClientImpl";
export type SceneObjectKind = "GameObject" | "WallObject" | "GroundObject" | "DecorativeObject";
export class TileObjectImpl implements TileObject {
    constructor(private readonly client:ClientImpl, readonly kind:SceneObjectKind, private readonly id:number, readonly x:number, readonly y:number, readonly plane:number, readonly viewId:number, readonly shape:number, readonly rotation:number) {}
    getId():number { return this.id; }
    getHash():bigint {
        const v=this.getWorldView(),nonInteractive=this.client.engine.locTypeLoader.load(this.id).isInteractive===0;
        return BigInt((this.x-v.getBaseX())&127) | (BigInt((this.y-v.getBaseY())&127)<<7n) | (BigInt(this.plane&3)<<14n) | (2n<<16n) | (nonInteractive ? 1n<<19n:0n) | (BigInt(this.id>>>0)<<20n) | (BigInt((this.viewId+1)&4095)<<52n);
    }
    getPlane():number { return this.plane; } getWorldView() { return this.client.getWorldView(this.viewId)!; }
    private size():[number,number] { if(this.kind!=="GameObject")return [1,1];const c=this.client.getObjectDefinition(this.id);return this.rotation%2 ? [c.getSizeY(),c.getSizeX()]:[c.getSizeX(),c.getSizeY()]; }
    sizeX():number { return this.size()[0]; } sizeY():number { return this.size()[1]; }
    getWorldLocation():WorldPoint { const [sx,sy]=this.size();return new WorldPoint(this.x+((sx-1)>>1),this.y+((sy-1)>>1),this.plane); }
    getLocalLocation():LocalPoint { const v=this.getWorldView(),[sx,sy]=this.size();return new LocalPoint(((this.x-v.getBaseX())<<7)+sx*64,((this.y-v.getBaseY())<<7)+sy*64,v); }
    getX():number { return this.getLocalLocation().getX(); } getY():number { return this.getLocalLocation().getY(); }
    getZ():number { return this.client.getTileHeight(this.getX(),this.getY(),this.plane,this.viewId); }
    getCanvasLocation(zOffset=0):Point|null { return Perspective.localToCanvas(this.client,this.getLocalLocation(),this.plane,zOffset); }
    getCanvasTilePoly():Polygon|null { const [sx,sy]=this.size();return Perspective.getCanvasTileAreaPoly(this.client,this.getLocalLocation(),sx,sy,this.plane); }
    getSceneMinLocation():Point { const v=this.getWorldView();return new Point(this.x-v.getBaseX(),this.y-v.getBaseY()); }
    getSceneMaxLocation():Point { const p=this.getSceneMinLocation(),[sx,sy]=this.size();return new Point(p.x+sx-1,p.y+sy-1); }
    getOrientation():number { return (this.rotation * 512 + (this.shape===11 ? 256:0)) & 2047; }
}
