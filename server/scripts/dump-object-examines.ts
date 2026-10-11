// Writes data/definitions/object-examines.json: every scenery object's examine text, from the
// OSRS Wiki. OSRS sends a loc's examine from the server, so the cache has none; the Wiki's
// {{Infobox Scenery}} gives it per version, with the object ids each version covers
// (|id1 = 1276 / |examine1 = One of the most common trees in Gielinor.).
//
// The scenery pages are listed from the Wiki's "infobox_scenery" bucket, then read 50 at a time.
// An id given different texts by two pages keeps the first, and is reported. Examines captured
// live (data/definitions/object-examines-captured.json, from rsprox captures on normal worlds)
// win over the Wiki's: they are what the server sent, and cover ids the Wiki pages do not list.
// Usage: TS_NODE_COMPILER_OPTIONS='{"target":"es2020"}' ts-node ./scripts/dump-object-examines.ts
import fs = require("fs");
import path = require("path");
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { CacheDefinitions } from "../src/main/typescript/elvarg/game/cache/CacheDefinitions";

const WIKI_API = "https://oldschool.runescape.wiki/api.php";
const USER_AGENT = "tsps-object-examines (https://github.com/RSPSApp/tsps)";
const PAGE = 5000;
const TITLES_PER_REQUEST = 50;
const OUT = path.resolve(__dirname, "../data/definitions/object-examines.json");
const CAPTURED = path.resolve(__dirname, "../data/definitions/object-examines-captured.json");
/** What the Wiki writes when a scenery object has no examine. */
const NO_EXAMINE = new Set(["N/A", "None"]);

async function wikiJson(params: Record<string, string>): Promise<any> {
    const response = await fetch(`${WIKI_API}?${new URLSearchParams({ format: "json", ...params })}`, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`Wiki ${response.status} for ${JSON.stringify(params)}`);
    return response.json();
}

async function scenePages(): Promise<string[]> {
    const pages = new Set<string>();
    for (let offset = 0; ; offset += PAGE) {
        const query = `bucket('infobox_scenery').select('page_name').limit(${PAGE}).offset(${offset}).run()`;
        const rows: any[] = (await wikiJson({ action: "bucket", query })).bucket ?? [];
        for (const row of rows) if (row.page_name) pages.add(String(row.page_name));
        if (rows.length < PAGE) return [...pages].sort();
    }
}

/** Every {{Infobox Scenery ...}} on a page, as its parameters (nested templates left in place). */
export function infoboxes(text: string): Map<string, string>[] {
    const boxes: Map<string, string>[] = [];
    const start = /\{\{\s*Infobox Scenery\s*\|?/gi;
    for (let match = start.exec(text); match; match = start.exec(text)) {
        let depth = 1;
        let index = match.index + 2;
        for (; index < text.length - 1 && depth > 0; index++) {
            if (text.startsWith("{{", index)) { depth++; index++; } else if (text.startsWith("}}", index)) { depth--; index++; }
        }
        const body = text.slice(match.index + match[0].length, index - 1);
        const params = new Map<string, string>();
        for (const line of body.split("\n")) {
            const param = /^\s*\|?\s*([a-z]+\d*)\s*=\s*(.*?)\s*$/i.exec(line);
            if (param) params.set(param[1].toLowerCase(), param[2]);
        }
        boxes.push(params);
    }
    return boxes;
}

/** Wiki markup out of an examine: links, bold/italics, refs, tags and templates. */
export function plainText(markup: string): string {
    return markup
        .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/\{\{\s*sic\s*\}\}/gi, "")
        .replace(/\{\{[^{}]*\}\}/g, "")
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
        .replace(/'''?/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** An infobox's object ids and their examine: per version (id1/examine1 ...), else the plain ones. */
export function examinesOf(params: Map<string, string>): Array<[number, string]> {
    const pairs: Array<[number, string]> = [];
    const ids = (value: string | undefined) => (value ?? "").split(",").map((part) => part.trim()).filter((part) => /^\d+$/.test(part)).map(Number);
    const versions = new Set<number>();
    for (const key of params.keys()) {
        const numbered = /^(?:id|examine|version)(\d+)$/.exec(key);
        if (numbered) versions.add(Number(numbered[1]));
    }
    const add = (idText: string | undefined, examine: string | undefined) => {
        const text = plainText(examine ?? "");
        if (!text || NO_EXAMINE.has(text)) return;
        for (const id of ids(idText)) pairs.push([id, text]);
    };
    if (versions.size === 0) {
        add(params.get("id"), params.get("examine"));
        return pairs;
    }
    for (const version of [...versions].sort((a, b) => a - b)) {
        add(params.get(`id${version}`) ?? params.get("id"), params.get(`examine${version}`) ?? params.get("examine"));
    }
    return pairs;
}

/**
 * "(Unlit) You can light a fire here. (Lit) A fire burns steadily in the grate.": one text for
 * both states of a loc whose states are separate ids. An id with a "Light" option is the unlit one.
 */
const LIT_STATES = /^\(Unlit\) (.+?) \(Lit\) (.+)$/;

export function forState(id: number, text: string, actions: (id: number) => readonly (string | null)[]): string {
    const states = LIT_STATES.exec(text);
    if (!states) return text;
    return actions(id).some((action) => action === "Light") ? states[1] : states[2];
}

async function main() {
    await CachePipeline.initialize(path.resolve(__dirname, ".."));
    const actions = (id: number) => CacheDefinitions.getObject(id)?.actions ?? [];
    const pages = await scenePages();
    process.stderr.write(`${pages.length} scenery pages\n`);
    const examines = new Map<number, string>();
    const conflicts: string[] = [];
    for (let start = 0; start < pages.length; start += TITLES_PER_REQUEST) {
        const titles = pages.slice(start, start + TITLES_PER_REQUEST).join("|");
        const result = await wikiJson({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles, redirects: "1" });
        for (const page of Object.values<any>(result.query?.pages ?? {})) {
            const text: string = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
            for (const box of infoboxes(text)) {
                for (const [id, examine] of examinesOf(box).map(([id, text]) => [id, forState(id, text, actions)] as [number, string])) {
                    const existing = examines.get(id);
                    if (existing === undefined) examines.set(id, examine);
                    else if (existing !== examine) conflicts.push(`${id}: "${existing}" kept over "${examine}" (${page.title})`);
                }
            }
        }
        process.stderr.write(`\r  pages ${Math.min(start + TITLES_PER_REQUEST, pages.length)}/${pages.length}`);
    }
    process.stderr.write("\n");
    const captured: Record<string, string> = JSON.parse(fs.readFileSync(CAPTURED, "utf8"));
    let overridden = 0;
    for (const [id, text] of Object.entries(captured)) {
        if (examines.get(Number(id)) !== text) overridden++;
        examines.set(Number(id), text);
    }
    console.log(`${Object.keys(captured).length} captured examines, ${overridden} of them differing from or missing on the Wiki`);
    const sorted = Object.fromEntries([...examines].sort((a, b) => a[0] - b[0]).map(([id, text]) => [String(id), text]));
    fs.writeFileSync(OUT, `${JSON.stringify(sorted, null, 0).replace(/,"/g, ",\n\"")}\n`);
    console.log(`${examines.size} object examines -> ${path.relative(process.cwd(), OUT)}; ${conflicts.length} ids with differing texts`);
    for (const line of conflicts.slice(0, 20)) console.log(`  ${line}`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
