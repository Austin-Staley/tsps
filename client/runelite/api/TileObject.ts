import type { WorldView } from "./WorldView";
import type { Point } from "../awt/Point";
import type { Polygon } from "../awt/Polygon";
import type { LocalPoint } from "./coords/LocalPoint";
import type { WorldPoint } from "./coords/WorldPoint";
export interface TileObject { getX():number; getY():number; getZ():number; getCanvasLocation(zOffset?:number):Point|null; getCanvasTilePoly():Polygon|null;
 getId(): number; getHash(): bigint; getPlane(): number; getWorldView(): WorldView; getWorldLocation(): WorldPoint; getLocalLocation(): LocalPoint; }
