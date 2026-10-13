// Generates client/runelite/api/gameval/*.ts from ../runelite's Java gameval
// constants. One named export per constant so webpack can tree-shake the
// roughly 100k lines down to what a plugin imports.
//
//   client/node_modules/.bin/tsx scripts/gen-gameval.ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "..", "runelite", "runelite-api", "src", "main", "java", "net", "runelite", "api", "gameval");
const outputDir = join(root, "client", "runelite", "api", "gameval");

// ObjectID extends ObjectID1, so its constants live across two source files.
const FILES: Array<[output: string, sources: string[]]> = [
    ["ItemID", ["ItemID"]],
    ["VarbitID", ["VarbitID"]],
    ["InterfaceID", ["InterfaceID"]],
    ["NpcID", ["NpcID"]],
    ["ObjectID", ["ObjectID", "ObjectID1"]],
    ["AnimationID", ["AnimationID"]],
    ["SpotanimID", ["SpotanimID"]],
    ["VarPlayerID", ["VarPlayerID"]],
    ["VarClientID", ["VarClientID"]],
    ["SpriteID", ["SpriteID"]],
    ["InventoryID", ["InventoryID"]],
];

function extractConstants(source: string): Map<string, Map<string, string>> {
    const groups = new Map<string, Map<string, string>>();
    const scopes: Array<string | undefined> = [];
    const clean = source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    const tokens = /\bclass\s+(\w+)[^{]*\{|public static final int ([A-Z0-9_]+)\s*=\s*(-?(?:0x[\da-fA-F_]+|[\d_]+));|[{}]/g;
    for (const match of clean.matchAll(tokens)) {
        if (match[1]) scopes.push(match[1]);
        else if (match[2]) {
            const path = scopes.filter((name): name is string => name !== undefined).slice(1).join(".");
            let constants = groups.get(path);
            if (!constants) groups.set(path, constants = new Map());
            constants.set(match[2], String(Number(match[3].replace(/_/g, ""))));
        } else if (match[0] === "{") scopes.push(undefined);
        else scopes.pop();
    }
    return groups;
}

function rueliteCommit(): string {
    try {
        return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
            cwd: join(root, "..", "runelite"),
            encoding: "utf8",
        }).trim();
    } catch {
        return "unknown";
    }
}

function generate(name: string, sources: string[], commit: string): string {
    const groups = new Map<string, Map<string, string>>();
    for (const source of sources) {
        const path = join(sourceDir, `${source}.java`);
        const text = readFileSync(path, "utf8");
        for (const [path, constants] of extractConstants(text)) {
            let group = groups.get(path);
            if (!group) groups.set(path, group = new Map());
            for (const [name, value] of constants) if (!group.has(name)) group.set(name, value);
        }
    }
    const lines = [
        `// Generated from RuneLite gameval ${sources.join(", ")}.java (RuneLite ${commit}). Do not edit.`,
        `// Regenerate with: client/node_modules/.bin/tsx scripts/gen-gameval.ts`,
        "",
    ];
    for (const [path, constants] of groups) {
        const names = path ? path.split(".") : [];
        if (names.length > 1) throw new Error(`Unsupported nested gameval class depth: ${path}`);
        if (names.length) lines.push(`export const ${names[0]} = {`);
        for (const [constant, value] of constants) lines.push(names.length ? `    ${constant}: ${value},` : `export const ${constant} = ${value};`);
        if (names.length) lines.push("} as const;");
    }
    lines.push("");
    return lines.join("\n");
}

if (!existsSync(sourceDir)) {
    console.error(`gen-gameval: ${sourceDir} not found (expected a ../runelite checkout)`);
    process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
const commit = rueliteCommit();
let total = 0;
for (const [name, sources] of FILES) {
    const output = generate(name, sources, commit);
    writeFileSync(join(outputDir, `${name}.ts`), output);
    total += output.split("\n").length;
    console.log(`gen-gameval: ${name}.ts`);
}
console.log(`gen-gameval: ${FILES.length} files, ${total} lines (RuneLite ${commit})`);
