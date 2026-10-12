// Import authored OSRS guide content, never private-server quest definitions.
// shortcut: static authored content only; port Java conditions and puzzle solvers before claiming full RuneLite parity.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
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

function parseGuide(source, itemIds, itemCollections = {}) {
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
    const displayRequirements = new Map();
    for (const call of calls.filter((call) => call.kind === "ItemRequirement" && call.variable)) {
        const name = literalText(call.args[0]);
        const ids = call.args[1]?.startsWith("ItemCollections.") ? itemCollections[call.args[1].replace("ItemCollections.", "")]
            : [itemIds[call.args[1]?.replace("ItemID.", "")]];
        const id = ids?.[0];
        const amount = call.args[2] === undefined ? 1 : Number(call.args[2]);
        if (name) displayRequirements.set(call.variable, { name });
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
    const stepVariables = new Map();
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
        if (call.kind === "ItemStep") step.type = "item";
        if (call.variable) {
            const choices = [...source.matchAll(new RegExp(`${name}\\.addDialogSteps?\\(([^;]+)\\);`, "g"))]
                .flatMap((match) => splitArguments(match[1]).map(authoredText)).filter(Boolean);
            if (choices.length) step.choices = choices;
            const extra = [...source.matchAll(new RegExp(`${name}\\.addText\\(([^;]+)\\);`, "g"))]
                .flatMap((match) => splitArguments(match[1]).map(literalText)).filter(Boolean);
            if (extra.length) step.text += " " + extra.join(" ");
        }
        if (call.variable) stepVariables.set(call.variable, steps.length);
        steps.push(step);
    }
    for (const [name, requirement] of requirements) displayRequirements.set(name, requirement);
    return { source, calls, steps, stepVariables, requirements: displayRequirements };
}

export function extractSteps(source, itemIds, itemCollections = {}) {
    return parseGuide(source, itemIds, itemCollections).steps;
}

const titleCase = (text) => text.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function extractPresentation(source, itemIds, itemCollections = {}, questNames = {}) {
    const parsed = parseGuide(source, itemIds, itemCollections);
    const { calls, steps, stepVariables, requirements } = parsed;
    source = parsed.source;
    const method = (name) => source.match(new RegExp(`\\b${name}\\(\\)\\s*\\{([\\s\\S]*?)\\n\\t\\}`))?.[1] ?? "";
    const list = (expression) => {
        const match = expression?.trim().match(/^(?:List\.of|Arrays\.asList|Collections\.singletonList)\(([\s\S]*)\)$/);
        return match ? splitArguments(match[1]) : expression ? [expression.trim()] : [];
    };
    const items = (expression) => list(expression).map((name) => {
        const item = requirements.get(name.split(".")[0]);
        const quantity = name.match(/\.quantity\((\d+)\)/)?.[1];
        return item && { ...item, ...(quantity ? { amount: Number(quantity) } : {}) };
    }).filter(Boolean);
    const returnedItems = (name) => items(method(name).match(/return\s+([\s\S]*?);/)?.[1]);
    const substeps = new Map();
    for (const match of source.matchAll(/(\w+)\.addSubSteps\(([^;]+)\);/g)) {
        substeps.set(match[1], splitArguments(match[2]).map((name) => stepVariables.get(name)).filter((index) => index !== undefined));
    }
    const panels = calls.filter((call) => call.kind === "PanelDetails").flatMap((call) => {
        const header = literalText(call.args[0]);
        const names = list(call.args[1]);
        const indices = names.map((name) => stepVariables.get(name)).filter((index) => index !== undefined);
        if (!header || !indices.length) return [];
        const children = names.flatMap((name) => substeps.get(name) ?? []);
        return [{ header, steps: indices, ...(children.length ? { substeps: children } : {}),
            ...(call.args[2] ? { items: items(call.args[2]) } : {}),
            ...(call.args[3] ? { recommended: items(call.args[3]) } : {}) }];
    });
    const general = (name) => constructors(method(name)).flatMap((call) => {
        if (call.kind === "SkillRequirement" && /^Skill\.\w+$/.test(call.args[0]) && /^\d+$/.test(call.args[1])) {
            return [literalText(call.args[3] ?? "") ?? `${call.args[1]} ${titleCase(call.args[0].slice(6))}`];
        }
        if (call.kind === "QuestRequirement") {
            const key = call.args[0]?.replace("QuestHelperQuest.", "");
            return questNames[key] ? [questNames[key]] : [];
        }
        if (call.kind === "QuestPointRequirement" && /^\d+$/.test(call.args[0])) return [`${call.args[0]} Quest Points`];
        if (call.kind === "ItemRequirement") return literalText(call.args[0]) ? [literalText(call.args[0])] : [];
        return [];
    });
    const rewards = calls.flatMap((call) => {
        if (call.kind === "QuestPointReward" && /^\d+$/.test(call.args[0])) return [`${call.args[0]} Quest Point${call.args[0] === "1" ? "" : "s"}`];
        if (call.kind === "ExperienceReward" && /^Skill\.\w+$/.test(call.args[0]) && /^\d+$/.test(call.args[1])) {
            return [`${Number(call.args[1]).toLocaleString("en-US")} ${titleCase(call.args[0].slice(6))} Experience${call.args[2] === "true" ? " Lamp" : ""}`];
        }
        if (call.kind === "ItemReward" && literalText(call.args[0])) return [`${Number(call.args[2]) > 1 ? `${call.args[2]} x ` : ""}${literalText(call.args[0])}`];
        if (call.kind === "UnlockReward" && literalText(call.args[0])) return [literalText(call.args[0])];
        return [];
    });
    const strings = (name) => [...method(name).matchAll(/"(?:\\.|[^"\\])*"/g)].map((match) => literalText(match[0]));
    return { steps, panels, overview: { required: returnedItems("getItemRequirements"), recommended: returnedItems("getItemRecommended"),
        general: general("getGeneralRequirements"), generalRecommended: general("getGeneralRecommended"),
        combat: strings("getCombatRequirements"), notes: strings("getNotes"), rewards } };
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
    const questNames = Object.fromEntries([...info.matchAll(/\b(\w+)\(new \w+\(\),([\s\S]*?)QuestDetails\.Difficulty\.\w+\)/g)]
        .map((match) => [match[1], match[2].match(/"([^"]+)"/)?.[1] ?? questIds.get(match[2].match(/Quest\.(\w+)/)?.[1])?.name]));
    const orders = Object.fromEntries(["OptimalQuestGuide", "IronmanOptimalQuestGuide", "ReleaseDate"].map((name) => {
        const text = stripComments(readFileSync(join(sourceRoot, `panel/questorders/${name}.java`), "utf8"));
        return [name, [...text.matchAll(/QuestHelperQuest\.(\w+)/g)].map((match) => match[1].toLowerCase())];
    }));
    const catalog = [], guides = new Map(), notices = new Set();
    notices.add(collectionsSource.match(/^\/\*[\s\S]*?\*\//)[0]);
    for (const file of ["panel/QuestHelperPanel.java", "panel/QuestSelectPanel.java", "panel/QuestOverviewPanel.java", "panel/QuestRequirementsPanel.java", "panel/QuestRewardsPanel.java", "panel/queststepsection/QuestStepPanel.java", "steps/overlay/DirectionArrow.java"]) {
        notices.add(readFileSync(join(sourceRoot, file), "utf8").match(/^\/\*[\s\S]*?\*\//)[0]);
    }
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
        const entry = { key, name: explicitName ?? metadata.name, type, difficulty: match[0].match(/QuestDetails\.Difficulty\.(\w+)/)[1],
            ...(metadata ? { questId: metadata.questId } : {}), source };
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
        const steps = [], panels = [];
        let overview;
        for (const file of related) {
            const text = readFileSync(file, "utf8");
            const notice = text.match(/^\/\*[\s\S]*?\*\//)?.[0];
            if (notice) notices.add(notice);
            const presentation = extractPresentation(text, itemIds, itemCollections, questNames);
            const offset = steps.length;
            panels.push(...presentation.panels.map((panel) => ({ ...panel, steps: panel.steps.map((index) => index + offset),
                ...(panel.substeps ? { substeps: panel.substeps.map((index) => index + offset) } : {}) })));
            steps.push(...presentation.steps);
            if (file === path) overview = presentation.overview;
        }
        const text = stripComments(readFileSync(path, "utf8"));
        entry.skills = [...new Set([...text.matchAll(/new (?:SkillRequirement|ExperienceReward)\(Skill\.(\w+)/g)].map((match) => titleCase(match[1])))];
        entry.questPoints = Number(text.match(/new QuestPointReward\((\d+)\)/)?.[1] ?? 0);
        assert.ok(steps.length, `No authored steps imported for ${key}`);
        catalog.push(entry);
        guides.set(key, { source, steps, panels, overview });
    }
    assert.ok(catalog.length > 200, "The complete quest and miniquest catalog must be imported");
    catalog.sort((a, b) => a.name.localeCompare(b.name, "en"));
    const destination = join(clientRoot, "public/quest-helper");
    mkdirSync(destination, { recursive: true });
    const icons = ["close", "collapsed", "expanded", "start", "discord", "github", "patreon", "settings_icon", "quest_icon"];
    mkdirSync(join(destination, "icons"), { recursive: true });
    for (const icon of icons) copyFileSync(join(upstreamRoot, `src/main/resources/${icon}.png`), join(destination, `icons/${icon}.png`));
    const runeLiteRoot = resolve(dirname(questApiFile), "../../../../../../..");
    const skillIcons = join(runeLiteRoot, "runelite-client/src/main/resources/skill_icons_small");
    mkdirSync(join(destination, "icons/skills"), { recursive: true });
    for (const file of readdirSync(skillIcons).filter((file) => file.endsWith(".png"))) copyFileSync(join(skillIcons, file), join(destination, "icons/skills", file));
    copyFileSync(join(runeLiteRoot, "LICENSE"), join(destination, "icons/skills/LICENSE.txt"));
    const fonts = join(clientRoot, "game/plugins/questhelper/fonts");
    mkdirSync(fonts, { recursive: true });
    for (const font of ["runescape.ttf", "runescape_bold.ttf"]) copyFileSync(join(runeLiteRoot, `runelite-client/src/main/resources/net/runelite/client/ui/${font}`), join(fonts, font));
    copyFileSync(join(runeLiteRoot, "LICENSE"), join(fonts, "LICENSE.txt"));
    writeFileSync(join(clientRoot, "game/plugins/questhelper/orders.json"), JSON.stringify(orders) + "\n");
    for (const [key, guide] of guides) writeFileSync(join(destination, `${key}.json`), JSON.stringify(guide) + "\n");
    writeFileSync(join(clientRoot, "game/plugins/questhelper/catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
    writeFileSync(join(destination, "LICENSE.txt"), readFileSync(join(upstreamRoot, "LICENSE"), "utf8") + "\n" + [...notices].join("\n\n") + "\n");
    return { guides: catalog.length, steps: [...guides.values()].reduce((total, guide) => total + guide.steps.length, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assert.ok(process.argv[2] && process.argv[3], "Usage: node scripts/import-quest-helper.mjs <pinned quest-helper checkout> <RuneLite Quest.java>");
    console.log(importGuides(resolve(process.argv[2]), resolve(process.argv[3])));
}
