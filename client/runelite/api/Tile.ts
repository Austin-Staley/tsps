import type { Point } from "../awt/Point";
import type { LocalPoint } from "./coords/LocalPoint";
import type { WorldPoint } from "./coords/WorldPoint";
import type { TileItem } from "./TileItem";
import type { GameObject } from "./GameObject";
import type { WallObject } from "./WallObject";
import type { GroundObject } from "./GroundObject";
import type { DecorativeObject } from "./DecorativeObject";
export interface Tile {
    getPlane(): number; getWorldLocation(): WorldPoint; getLocalLocation(): LocalPoint; getSceneLocation(): Point;
    getGroundItems(): TileItem[]; getGameObjects(): GameObject[]; getWallObject(): WallObject | null;
    getGroundObject(): GroundObject | null; getDecorativeObject(): DecorativeObject | null;
}
