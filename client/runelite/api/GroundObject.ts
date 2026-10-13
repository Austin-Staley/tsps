import type { TileObject } from "./TileObject";
export interface GroundObject extends TileObject { getOrientation(): number; }
