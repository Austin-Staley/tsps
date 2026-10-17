import { Location } from "../../model/Location";
import { Mobile } from "../../entity/impl/Mobile";
import { WORLD_ZONE_BOUNDARIES } from "../../definition/WorldDefinition";

import { RegionManager } from "../../collision/RegionManager";

export class Wilderness {
    // [minX, maxX, minY, maxY] - minY doubles as the level-1 line.
    private static readonly LEVELLED_AREAS = [
        [2944, 3391, 3520, 4351],
        [2944, 3455, 9920, 10879],
    ];
    // [minX, maxX, minY, maxY, level] - the Wilderness boss caves, which script 384 levels
    // before the strips above: Callisto's Den, Vet'ion's Rest, the Silk Chasm and the three
    // singles lairs. The Escape Caves rise 33 to 40 with y (ESCAPE_CAVES).
    private static readonly FIXED_LEVEL_AREAS = [
        [3264, 3327, 10176, 10239, 35],
        [3392, 3455, 10176, 10239, 35],
        [3328, 3391, 10304, 10367, 40],
        [1728, 1791, 11520, 11583, 21],
        [1856, 1919, 11520, 11583, 21],
        [1600, 1663, 11520, 11583, 29],
    ];
    private static readonly ESCAPE_CAVES = [3328, 3391, 10240, 10303];

    public static isInSafeBuilding(location: Location | null | undefined): boolean {
        return !!location && WORLD_ZONE_BOUNDARIES["all-buildings-safe"].some((boundary) => boundary.inside(location)) &&
            (RegionManager.getRegion(location.getX(), location.getY())
                ?.isUnderRoof(location.getX(), location.getY(), location.getZ()) ?? false);
    }

    /**
     * Any PvP-tagged ground, safe carve-outs included. The overlay hangs off this: inside a
     * PvP area you either get the skull or, in a safe spot, the skull with the red cross.
     */
    public static isPvpArea(location: Location | null | undefined): boolean {
        return !!location && WORLD_ZONE_BOUNDARIES.pvp.some((boundary) => boundary.inside(location));
    }

    public static isInLocation(location: Location | null | undefined): boolean {
        if (!location) {
            return false;
        }
        return !Wilderness.isInSafeBuilding(location) && !WORLD_ZONE_BOUNDARIES.safe.some((boundary) => boundary.inside(location))
            && Wilderness.isPvpArea(location);
    }

    public static isIn(character: Mobile | null | undefined): boolean {
        return Wilderness.isInLocation(character?.getLocation?.());
    }

    /**
     * Wilderness levels only exist on the original Wilderness map - the surface strip and the
     * caves beneath it, the same boxes cache script 384 measures the overlay level from. A PvP
     * zone anywhere else (a PvP world, a custom zone) is attackable but unlevelled, so it must
     * not inherit a level from its y.
     */
    public static levelAt(x: number, y: number): number {
        for (const [minX, maxX, minY, maxY, level] of Wilderness.FIXED_LEVEL_AREAS) {
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                return level;
            }
        }
        const [escapeMinX, escapeMaxX, escapeMinY, escapeMaxY] = Wilderness.ESCAPE_CAVES;
        if (x >= escapeMinX && x <= escapeMaxX && y >= escapeMinY && y <= escapeMaxY) {
            // Script 384: 33 + scale(y % 64 - 6, 50, 7), an integer division.
            return 33 + Math.trunc(((y % 64) - 6) * 7 / 50);
        }
        for (const [minX, maxX, minY, maxY] of Wilderness.LEVELLED_AREAS) {
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                return Math.floor((y - minY) / 8) + 1;
            }
        }
        return 0;
    }

    /** Multi-combat zones are per plane (world.json `z`); the plane defaults to the surface. */
    public static isMulti(x: number, y: number, z: number = 0): boolean {
        const location = new Location(x, y, z);
        return WORLD_ZONE_BOUNDARIES["multi-combat"].some((boundary) => boundary.inside(location));
    }

    public static intersectsArea(minX: number, maxX: number, minY: number, maxY: number, z: number): boolean {
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return false;
        }
        if (!Number.isFinite(z)) {
            return false;
        }
        return WORLD_ZONE_BOUNDARIES.pvp.some((boundary) => {
            const boundaryZ = boundary.height ?? 0;
            const boundaryMinX = boundary.getX();
            const boundaryMaxX = boundary.getX2();
            const boundaryMinY = boundary.getY();
            const boundaryMaxY = boundary.getY2();
            return (
                boundaryZ === z &&
                boundaryMinX <= maxX &&
                boundaryMaxX >= minX &&
                boundaryMinY <= maxY &&
                boundaryMaxY >= minY
            );
        });
    }
}
