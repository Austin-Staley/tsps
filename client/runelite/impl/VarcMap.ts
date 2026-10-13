import type { VarManager } from "../../rs/config/vartype/VarManager";

/** The native interpreter separates value types; plugins see one live map as in RuneLite. */
export class VarcMap extends Map<number, unknown> {
    constructor(private readonly source: () => VarManager) { super(); }
    private get vars(): VarManager { return this.source(); }
    override get size(): number { let count=0; for (const _id of this.keys()) count++; return count; }
    override has(id: number): boolean { return this.vars.varcInts.has(id) || this.vars.varcStrings.has(id) || this.vars.varcLongs.has(id); }
    override get(id: number): unknown {
        if (this.vars.varcStrings.has(id)) return this.vars.varcStrings.get(id);
        if (this.vars.varcLongs.has(id)) return this.vars.varcLongs.get(id);
        return this.vars.varcInts.get(id);
    }
    override set(id: number, value: unknown): this {
        if (!Number.isInteger(id)) throw new TypeError("A varc key must be an integer");
        if (typeof value === "number") {
            this.vars.varcStrings.delete(id); this.vars.varcLongs.delete(id);
            this.vars.setVarcInt(id, value | 0);
            this.vars.varcInts.set(id, value | 0);
        } else if (typeof value === "bigint") {
            this.vars.varcInts.delete(id); this.vars.varcStrings.delete(id);
            this.vars.varcLongs.set(id, BigInt.asIntN(64, value));
        } else {
            this.vars.varcInts.delete(id); this.vars.varcLongs.delete(id);
            // Object-stack varcs can also contain native CS2 array objects.
            this.vars.setVarcString(id, value as string);
            this.vars.varcStrings.set(id, value as string);
        }
        return this;
    }
    override delete(id: number): boolean {
        const existed = this.has(id);
        if (this.vars.varcInts.has(id)) { this.vars.setVarcInt(id, -1); this.vars.varcInts.delete(id); }
        if (this.vars.varcStrings.has(id)) { this.vars.setVarcString(id, ""); this.vars.varcStrings.delete(id); }
        this.vars.varcLongs.delete(id);
        return existed;
    }
    override clear(): void { for (const id of this.keys()) this.delete(id); }
    override *keys(): MapIterator<number> {
        const seen = new Set<number>();
        for (const map of [this.vars.varcInts, this.vars.varcStrings, this.vars.varcLongs]) {
            for (const id of map.keys()) if (!seen.has(id)) { seen.add(id); yield id; }
        }
    }
    override *entries(): MapIterator<[number, unknown]> { for (const id of this.keys()) yield [id, this.get(id)]; }
    override *values(): MapIterator<unknown> { for (const id of this.keys()) yield this.get(id); }
    override [Symbol.iterator](): MapIterator<[number, unknown]> { return this.entries(); }
    override forEach(callback: (value: unknown, key: number, map: Map<number, unknown>) => void, thisArg?: unknown): void {
        for (const [id, value] of this) callback.call(thisArg, value, id, this);
    }
}
