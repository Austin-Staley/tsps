import type { CollisionData } from "./CollisionData";
import type { Tile } from "./Tile";
export interface Scene {
    getWorldViewId(): number; getBaseX(): number; getBaseY(): number; getSizeX(): number; getSizeY(): number;
    isInstance(): boolean; getInstanceTemplateChunks(): number[][][]; getTiles(): (Tile | null)[][][]; getTileHeights(): number[][][]; getTileSettings():number[][][]; getCollisionMaps():CollisionData[];
}
