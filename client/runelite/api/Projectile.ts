import type { Actor } from "./Actor";
import type { WorldPoint } from "./coords/WorldPoint";
import type { LocalPoint } from "./coords/LocalPoint";
export interface Projectile {
    getId(): number;
    getSourceLevel(): number; getTargetLevel(): number;
    getSourcePoint(): WorldPoint; getTargetPoint(): WorldPoint;
    getSourceActor(): Actor | null; getTargetActor(): Actor | null;
    getTarget(): LocalPoint;
    getX1(): number; getY1(): number; getFloor(): number;
    getHeight(): number; getEndHeight(): number;
    getStartCycle(): number; getEndCycle(): number; setEndCycle(cycle: number): void;
    getRemainingCycles(): number; getSlope(): number; getStartPos(): number; getStartHeight(): number;
    getX(): number; getY(): number; getZ(): number; getOrientation(): number; getAnimationFrame(): number;
}
