import { WorldPoint } from "./WorldPoint";
export class WorldArea {
    private x: number; private y: number; private width: number; private height: number; private plane: number;
    constructor(x: number | WorldPoint, y: number, width: number, height?: number, plane?: number) {
        if (x instanceof WorldPoint) { this.x=x.getX(); this.y=x.getY(); this.plane=x.getPlane(); this.width=y; this.height=width; }
        else { this.x=x; this.y=y; this.width=width; this.height=height!; this.plane=plane!; }
    }
    getX(): number { return this.x; } getY(): number { return this.y; } getWidth(): number { return this.width; } getHeight(): number { return this.height; } getPlane(): number { return this.plane; }
    toWorldPoint(): WorldPoint { return new WorldPoint(this.x,this.y,this.plane); }
    toWorldPointList(): WorldPoint[] { const r: WorldPoint[]=[]; for(let x=0;x<this.width;x++) for(let y=0;y<this.height;y++) r.push(new WorldPoint(this.x+x,this.y+y,this.plane)); return r; }
    distanceTo(other: WorldArea | WorldPoint): number { return other.getPlane() === this.plane ? this.distanceTo2D(other) : 2147483647; }
    distanceTo2D(other: WorldArea | WorldPoint): number { const a = other instanceof WorldPoint ? new WorldArea(other,1,1) : other; return Math.max(0,a.x-(this.x+this.width-1),this.x-(a.x+a.width-1),a.y-(this.y+this.height-1),this.y-(a.y+a.height-1)); }
    intersectsWith(other: WorldArea): boolean { return this.distanceTo(other)===0; }
    contains(point: WorldPoint): boolean { return this.distanceTo(point)===0; }
    isInMeleeDistance(other: WorldArea | WorldPoint): boolean { if (other.getPlane() !== this.plane) return false; const a=other instanceof WorldPoint ? new WorldArea(other,1,1):other; const dx=Math.max(0,a.x-(this.x+this.width-1),this.x-(a.x+a.width-1)); const dy=Math.max(0,a.y-(this.y+this.height-1),this.y-(a.y+a.height-1)); return dx+dy===1; }
}
