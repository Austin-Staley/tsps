import type { TileObject } from "./TileObject";
export interface WallObject extends TileObject { getOrientation(): number; }
