import { LocAnimated } from "./LocAnimated";

/**
 * Locs whose models reach below the floor and are meant to be seen down there: the Fractured
 * Archive's void (Ocellus' degen bomb, debris and cracks, 62701-62705). OSRS paints a loc after
 * its floor with no depth test, so a pit modelled under the ground shows, and gains depth as the
 * camera turns; a depth-tested floor hides it. These are drawn again after the opaque scene: once
 * with the floor's depth under them reset to the far plane, then normally.
 */
export const SUNKEN_LOC_IDS: ReadonlySet<number> = new Set([62701, 62702, 62703, 62704, 62705]);

/** The draw range indices (full detail, not interact) of a square's sunken animated locs. */
export function sunkenRangeIndices(locs: readonly LocAnimated[], alpha: boolean): number[] {
    const indices: number[] = [];
    for (const loc of locs) {
        if (!SUNKEN_LOC_IDS.has(loc.id)) continue;
        const index = loc.getDrawRangeIndex(alpha, false, false);
        if (index !== -1) indices.push(index);
    }
    return indices;
}
