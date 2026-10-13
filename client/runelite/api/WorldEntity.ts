import type { LocalPoint } from "./coords/LocalPoint";
import type { WorldView } from "./WorldView";
export interface WorldEntity {
    getWorldView(): WorldView;
    getLocalLocation(): LocalPoint;
    getOrientation(): number;
    getTargetLocation(): LocalPoint;
    getTargetOrientation(): number;
}
