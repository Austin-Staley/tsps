import type { ClientScriptLoader } from "../../../game/cs2/ClientScriptLoader";
import { assemble } from "./assemble";
import manifest from "./patches.json";
export type ScriptPatch = { name: string; id: number; expectedHash: string | null; source: string; symbols?: Record<string, number | undefined> };
export type PatchStatus = { id: number; name: string; status: "installed" | "hash-mismatch" | "shape-mismatch" | "unavailable" | "id-conflict"; detail?: string };
export async function sha256(bytes: Int8Array): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}
/** An upstream patch is eligible only for the exact vanilla bytecode recorded in its .hash. */
export function installRuneLiteScriptPatches(loader: ClientScriptLoader, patches: readonly ScriptPatch[] = manifest.patches): { ready: Promise<PatchStatus[]>; dispose(): void } {
    let disposed = false;
    const installed = new Set<number>();
    const ready = Promise.all(patches.map(async patch => {
        const result = (status: PatchStatus["status"], detail?: string): PatchStatus => ({ id: patch.id, name: patch.name, status, detail });
        const compiled = assemble(patch.source, patch.name, patch.symbols);
        if (compiled.id !== patch.id) throw new Error(`Patch ID mismatch: ${patch.name}`);
        let bytes: Int8Array | null;
        try { bytes = await loader.getRawBytesWithRetry(patch.id); }
        catch (error) { return result("unavailable", String(error)); }
        if (disposed) return result("unavailable", "Installer was disposed");
        if (patch.expectedHash === null) {
            if (patch.id < 10000) throw new Error(`Missing vanilla hash: ${patch.name}`);
            if (bytes) return result("id-conflict", "RuneLite script ID already belongs to this cache");
        } else {
            if (!bytes) return result("unavailable", "Original script does not exist");
            const actual = await sha256(bytes);
            if (disposed) return result("unavailable", "Installer was disposed");
            if (actual !== patch.expectedHash.toLowerCase()) return result("hash-mismatch", `Expected ${patch.expectedHash}; got ${actual}`);
            const original = loader.load(patch.id);
            if (!original || original.intArgCount !== compiled.intArgCount || original.objArgCount !== compiled.objArgCount || original.longArgCount !== compiled.longArgCount) return result("shape-mismatch", "Script argument counts changed");
        }
        loader.setOverride(compiled); installed.add(compiled.id); return result("installed");
    }));
    return { ready, dispose() { disposed = true; for (const id of installed) loader.removeOverride(id); installed.clear(); } };
}
export { manifest as runeLiteScriptManifest };
