import type { LocalPoint } from "./coords/LocalPoint";
import type { CollisionData } from "./CollisionData";
import type { Tile } from "./Tile";
import type { Scene } from "./Scene";
import type { NPC } from "./NPC";
import type { Player } from "./Player";
import type { WorldPoint } from "./coords/WorldPoint";
export interface WorldView {
    getId(): number; getBaseX(): number; getBaseY(): number; getPlane(): number; getSizeX(): number; getSizeY(): number;
    isTopLevel(): boolean; isInstance(): boolean; getInstanceTemplateChunks(): number[][][]; contains(point:WorldPoint|LocalPoint): boolean; getTileHeights():number[][][]; getTileSettings():number[][][]; getCollisionMaps():CollisionData[]; getSelectedSceneTile():Tile|null; getTileHeight(x:number,y:number,plane:number):number;
    getScene(): Scene; players(): Player[]; npcs(): NPC[];
}
export namespace WorldView { export const TOPLEVEL = -1; }
