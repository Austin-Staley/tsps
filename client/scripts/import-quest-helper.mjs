// Import authored OSRS guide content, never private-server quest definitions.
// shortcut: static authored content only; port Java conditions and puzzle solvers before claiming full RuneLite parity.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const UPSTREAM_COMMIT = "08bb7c55ffc5aa61b7f4df61820967d63157e389";
const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function splitArguments(text) {
    const args = [];
    let start = 0, depth = 0, quoted = false, escaped = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if ("([{<".includes(char)) depth++;
        else if (")]}>".includes(char)) depth--;
        else if (char === "," && depth === 0) { args.push(text.slice(start, i).trim()); start = i + 1; }
    }
    args.push(text.slice(start).trim());
    return args;
}

function stripComments(source) {
    return source.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (token) => token.startsWith('"') ? token : " ");
}

export function literalText(expression) {
    const strings = expression.match(/"(?:\\.|[^"\\])*"/g) ?? [];
    if (!strings.length || expression.replace(/"(?:\\.|[^"\\])*"/g, "").replace(/[+\s]/g, "")) return undefined;
    return strings.map((value) => JSON.parse(value.replace(/\\'/g, "'").replace(/\\s/g, " "))).join("");
}

function constructors(source) {
    const calls = [];
    const pattern = /(?:new\s+([\w.]+)|\b(super))\s*\(/g;
    for (const match of source.matchAll(pattern)) {
        let depth = 1, quoted = false, escaped = false, end = match.index + match[0].length;
        for (; end < source.length && depth; end++) {
            const char = source[end];
            if (quoted) {
                if (escaped) escaped = false;
                else if (char === "\\") escaped = true;
                else if (char === '"') quoted = false;
            } else if (char === '"') quoted = true;
            else if (char === "(") depth++;
            else if (char === ")") depth--;
        }
        assert.equal(depth, 0, `Unclosed constructor: ${match[1]}`);
        const variable = source.slice(0, match.index).match(/(\w+)\s*=\s*$/)?.[1];
        calls.push({ kind: match[1] ?? match[2], variable, args: splitArguments(source.slice(match.index + match[0].length, end - 1)) });
    }
    return calls;
}

export function extractSteps(source, itemIds, itemCollections = {}) {
    source = stripComments(source);
    const calls = constructors(source);
    const textValues = new Map();
    function authoredText(expression) {
        const literal = literalText(expression);
        if (literal !== undefined) return literal;
        if (textValues.has(expression)) return textValues.get(expression);
        const list = expression.match(/^(?:Arrays\.asList|List\.of|Collections\.singletonList)\(([\s\S]*)\)$/);
        if (list) {
            const lines = splitArguments(list[1]).map(authoredText);
            if (lines.every((line) => line !== undefined)) return lines.join(" ");
        }
        return undefined;
    }
    for (const match of source.matchAll(/\b(\w+)\s*=\s*([^;]+);/g)) {
        const text = authoredText(match[2].trim());
        if (text !== undefined) textValues.set(match[1], text);
    }
    const requirements = new Map();
    for (const call of calls.filter((call) => call.kind === "ItemRequirement" && call.variable)) {
        const name = literalText(call.args[0]);
        const ids = call.args[1]?.startsWith("ItemCollections.") ? itemCollections[call.args[1].replace("ItemCollections.", "")]
            : [itemIds[call.args[1]?.replace("ItemID.", "")]];
        const id = ids?.[0];
        const amount = call.args[2] === undefined ? 1 : Number(call.args[2]);
        if (name && id !== undefined && Number.isInteger(amount) && amount > 0) {
            requirements.set(call.variable, { id, name, amount, ...(call.args[3] === "true" ? { equipped: true } : {}), ...(ids.length > 1 ? { alternates: ids.slice(1) } : {}) });
        }
    }
    for (const match of source.matchAll(/(\w+)\.addAlternates\(([^;]+)\);/g)) {
        const requirement = requirements.get(match[1]);
        const alternates = splitArguments(match[2]).map((id) => itemIds[id.replace("ItemID.", "")]);
        if (requirement && alternates.every((id) => id !== undefined)) requirement.alternates = [...new Set([...(requirement.alternates ?? []), ...alternates])];
    }
    for (const match of source.matchAll(/(\w+)\s*=\s*(\w+)\.(?:highlighted|alsoCheckBank|quantity)\((\d*)\);/g)) {
        const requirement = requirements.get(match[2]);
        if (requirement) requirements.set(match[1], { ...requirement, ...(match[3] ? { amount: Number(match[3]) } : {}) });
    }
    const steps = [];
    for (const call of calls.filter((call) => call.args[0] === "this" || call.kind === "super")) {
        const textIndex = call.args.findIndex((arg) => authoredText(arg) !== undefined);
        const name = call.variable?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const replacements = name ? [...source.matchAll(new RegExp(`${name}\\.setText\\(([^;]+)\\);`, "g"))].map((match) => authoredText(match[1])).filter(Boolean) : [];
        let text = replacements[0] ?? (textIndex < 0 ? undefined : authoredText(call.args[textIndex]));
        if (!text) continue;
        const point = call.args.map((arg) => arg.match(/^new WorldPoint\((-?\d+),\s*(-?\d+),\s*(\d+)\)$/)).find(Boolean);
        const items = call.args.slice(textIndex + 1).map((arg) => {
            const requirement = requirements.get(arg.split(".")[0]);
            const quantity = arg.match(/\.quantity\((\d+)\)/)?.[1];
            return requirement && { ...requirement, ...(quantity ? { amount: Number(quantity) } : {}) };
        }).filter(Boolean);
        const step = { text, ...(point ? { target: { x: Number(point[1]), y: Number(point[2]), plane: Number(point[3]) } } : {}), ...(items.length ? { items } : {}) };
        if (call.variable) {
            const choices = [...source.matchAll(new RegExp(`${name}\\.addDialogSteps?\\(([^;]+)\\);`, "g"))]
                .flatMap((match) => splitArguments(match[1]).map(authoredText)).filter(Boolean);
            if (choices.length) step.choices = choices;
            const extra = [...source.matchAll(new RegExp(`${name}\\.addText\\(([^;]+)\\);`, "g"))]
                .flatMap((match) => splitArguments(match[1]).map(literalText)).filter(Boolean);
            if (extra.length) step.text += " " + extra.join(" ");
        }
        steps.push(step);
    }
    return steps;
}

function javaFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
        ? javaFiles(join(directory, entry.name)) : entry.name.endsWith(".java") ? [join(directory, entry.name)] : []);
}

function identifiers(file) {
    return Object.fromEntries([...readFileSync(file, "utf8").matchAll(/export const (\w+) = (\d+);/g)].map((match) => [match[1], Number(match[2])]));
}

export function importGuides(upstreamRoot, questApiFile) {
    assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: upstreamRoot, encoding: "utf8" }).trim(), UPSTREAM_COMMIT, "Use the pinned upstream revision");
    const sourceRoot = join(upstreamRoot, "src/main/java/com/questhelper");
    const files = javaFiles(join(sourceRoot, "helpers"));
    const classes = new Map(files.map((path) => [path.split("/").at(-1).replace(".java", ""), path]));
    const questIds = new Map([...readFileSync(questApiFile, "utf8").matchAll(/\b(\w+)\((\d+),\s*"([^"]+)"\)/g)].map((match) => [match[1], { questId: Number(match[2]), name: match[3] }]));
    const itemIds = identifiers(join(clientRoot, "runelite/api/gameval/ItemID.ts"));
    const collectionsSource = readFileSync(join(sourceRoot, "collections/ItemCollections.java"), "utf8");
    const itemCollections = {};
    for (const match of stripComments(collectionsSource).matchAll(/\b(\w+)\(ImmutableList\.of\(([\s\S]*?)\)\s*\)/g)) {
        const ids = splitArguments(match[2]).map((arg) => itemIds[arg.replace("ItemID.", "")]);
        if (ids.length && ids.every((id) => id !== undefined)) itemCollections[match[1]] = [...new Set(ids)];
    }
    const varpIds = identifiers(join(clientRoot, "runelite/api/gameval/VarPlayerID.ts"));
    const varbitIds = identifiers(join(clientRoot, "runelite/api/gameval/VarbitID.ts"));
    const varps = new Map([...readFileSync(join(sourceRoot, "questinfo/QuestVarPlayer.java"), "utf8").matchAll(/\b(\w+)\((\d+|VarPlayerID\.\w+)\)/g)].map((match) => [match[1], /^\d+$/.test(match[2]) ? Number(match[2]) : varpIds[match[2].replace("VarPlayerID.", "")]]));
    const varbits = new Map([...readFileSync(join(sourceRoot, "questinfo/QuestVarbits.java"), "utf8").matchAll(/\b(\w+)\((\d+|VarbitID\.\w+)\)/g)].map((match) => [match[1], /^\d+$/.test(match[2]) ? Number(match[2]) : varbitIds[match[2].replace("VarbitID.", "")]]));
    const info = stripComments(readFileSync(join(sourceRoot, "questinfo/QuestHelperQuest.java"), "utf8"));
    const catalog = [], guides = new Map(), notices = new Set();
    notices.add(collectionsSource.match(/^\/\*[\s\S]*?\*\//)[0]);
    for (const match of info.matchAll(/\b(\w+)\(new (\w+)\(\),([\s\S]*?)QuestDetails\.Difficulty\.\w+\)/g)) {
        const type = match[3].match(/QuestDetails\.Type\.(F2P|P2P|MINIQUEST)\b/)?.[1];
        if (!type) continue;
        const path = classes.get(match[2]);
        assert.ok(path, `Missing upstream guide ${match[2]}`);
        const quest = match[3].match(/Quest\.(\w+)/)?.[1];
        const explicitName = match[3].match(/"([^"]+)"/)?.[1];
        const metadata = quest ? questIds.get(quest) : undefined;
        assert.ok(explicitName || metadata, `Missing quest metadata: ${match[1]}`);
        const key = match[1].toLowerCase();
        const binding = match[3].match(/Quest(VarPlayer|Varbits)\.(\w+)/);
        const source = `https://github.com/Zoinkwiz/quest-helper/blob/${UPSTREAM_COMMIT}/src/main/java/com/questhelper/${relative(sourceRoot, path)}`;
        const entry = { key, name: explicitName ?? metadata.name, type, ...(metadata ? { questId: metadata.questId } : {}), source };
        if (binding) {
            const value = (binding[1] === "VarPlayer" ? varps : varbits).get(binding[2]);
            assert.ok(Number.isInteger(value), `Missing var binding: ${key}`);
            entry[binding[1] === "VarPlayer" ? "varp" : "varbit"] = value;
            const completeValue = match[3].match(/Quest(?:VarPlayer|Varbits)\.\w+,\s*(\d+)/)?.[1];
            if (completeValue) entry.completeValue = Number(completeValue);
        }
        // Include referenced helper classes, without importing another quest's route.
        const related = new Set();
        function include(file) {
            if (related.has(file)) return;
            related.add(file);
            const text = stripComments(readFileSync(file, "utf8"));
            for (const dependency of text.matchAll(/(?:new|extends)\s+(\w+)\b/g)) {
                const child = classes.get(dependency[1]);
                if (child && child.startsWith(dirname(path) + "/")) include(child);
            }
        }
        include(path);
        const steps = [...related].flatMap((file) => {
            const text = readFileSync(file, "utf8");
            const notice = text.match(/^\/\*[\s\S]*?\*\//)?.[0];
            if (notice) notices.add(notice);
            return extractSteps(text, itemIds, itemCollections);
        });
        assert.ok(steps.length, `No authored steps imported for ${key}`);
        catalog.push(entry);
        guides.set(key, { source, steps });
    }
    assert.ok(catalog.length > 200, "The complete quest and miniquest catalog must be imported");
    catalog.sort((a, b) => a.name.localeCompare(b.name, "en"));
    const destination = join(clientRoot, "public/quest-helper");
    mkdirSync(destination, { recursive: true });
    for (const [key, guide] of guides) writeFileSync(join(destination, `${key}.json`), JSON.stringify(guide) + "\n");
    writeFileSync(join(clientRoot, "game/plugins/questhelper/catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
    writeFileSync(join(destination, "LICENSE.txt"), readFileSync(join(upstreamRoot, "LICENSE"), "utf8") + "\n" + [...notices].join("\n\n") + "\n");
    return { guides: catalog.length, steps: [...guides.values()].reduce((total, guide) => total + guide.steps.length, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assert.ok(process.argv[2] && process.argv[3], "Usage: node scripts/import-quest-helper.mjs <pinned quest-helper checkout> <RuneLite Quest.java>");
    console.log(importGuides(resolve(process.argv[2]), resolve(process.argv[3])));
}
