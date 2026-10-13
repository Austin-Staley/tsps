import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { assemble } from "../runelite/impl/scripts/assemble";
const upstream = resolve(process.argv[2] ?? "../runelite");
const directory = resolve(upstream, "runelite-client/src/main/scripts");
const symbols: Record<string, number> = {};
const interfaces = readFileSync(resolve(upstream, "runelite-api/src/main/interfaces/interfaces.toml"), "utf8");
let group = "", interfaceId = -1;
for (const raw of interfaces.split(/\r?\n/)) {
    const section = /^\[([^\]]+)\]/.exec(raw); if (section) { group = section[1]; interfaceId = -1; }
    const field = /^(\w+)\s*=\s*(\d+)/.exec(raw); if (!field) continue;
    if (field[1] === "id") interfaceId = Number(field[2]);
    else if (interfaceId >= 0) symbols[`${group.toLowerCase()}:${field[1].toLowerCase()}`] = (interfaceId << 16) | Number(field[2]);
}
const patches = readdirSync(directory).filter(file => file.endsWith(".rs2asm")).sort().map(file => {
    const name = file.slice(0, -7);
    const source = readFileSync(resolve(directory, file), "utf8");
    const script = assemble(source, name, symbols);
    const expectedHash = script.id < 10000 ? readFileSync(resolve(directory, `${name}.hash`), "utf8").trim().toLowerCase() : null;
    if (expectedHash !== null && !/^[0-9a-f]{64}$/.test(expectedHash)) throw new Error(`Invalid hash for ${name}`);
    const usedSymbols = Object.fromEntries([...source.matchAll(/:(\w+:\w+)/g)].map(match => [match[1], symbols[match[1]]]));
    return { name, id: script.id, expectedHash, source, symbols: usedSymbols };
});
const ids = new Set(patches.map(patch => patch.id));
if (ids.size !== patches.length) throw new Error("Duplicate script IDs");
writeFileSync(resolve("runelite/impl/scripts/patches.json"), JSON.stringify({ upstreamCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: upstream, encoding: "utf8" }).trim(), patches }, null, 2) + "\n");
console.log(`Imported and assembled ${patches.length} RuneLite script patches`);
