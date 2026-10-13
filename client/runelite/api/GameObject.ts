import type { Point } from "../awt/Point";
import type { TileObject } from "./TileObject";
export interface GameObject extends TileObject { getOrientation(): number; sizeX():number; sizeY():number; getSceneMinLocation():Point; getSceneMaxLocation():Point; }
