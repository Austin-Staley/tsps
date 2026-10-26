/**
 * Pure helpers for the GitHub-issue-link bug report flow.
 *
 * No token anywhere: the player files the issue themselves from the prefilled
 * `issues/new` page, so every report is tied to a real GitHub account and GitHub's
 * own spam protection applies. Everything here is unit-testable without a client.
 */

/** Where the player's browser opens a prefilled issue. */
export const BUG_REPORT_ISSUE_URL = "https://github.com/RSPSApp/tsps/issues/new";

/**
 * GitHub and browsers stop handling very long `issues/new` URLs (around 8 KB), so the
 * whole URL is capped. The body shrinks to fit; nothing else grows to fill it.
 */
export const MAX_ISSUE_URL_LENGTH = 8000;

/** An IPv4 or IPv6 literal: client, relay and server addresses must never reach a public issue. */
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IPV6 = /\b[0-9a-fA-F:]*:[0-9a-fA-F:]+(?::[0-9a-fA-F:.]+)?\b/g;

/** Address literals left out, keeping the line that carried them. */
export function redactAddresses(text: string): string {
    return text.replace(IPV4, "(address left out)").replace(IPV6, "(address left out)");
}

/** Cut to whole code points, so an emoji at the boundary never loses half of itself. */
export function truncateCodePoints(text: string, maxCodePoints: number): string {
    const points = Array.from(text);
    return points.length <= maxCodePoints ? text : points.slice(0, maxCodePoints).join("");
}

/** Coarse browser family from the UA: enough for "only repros on Safari", nothing fingerprintable. */
export function coarseBrowser(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes("edg/") || ua.includes("edge/")) return "Edge";
    if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
    if (ua.includes("chrome/") && !ua.includes("chromium")) return "Chrome";
    if (ua.includes("firefox/") || ua.includes("fxios/")) return "Firefox";
    if (ua.includes("safari/")) return "Safari";
    return "Other";
}

/**
 * The `issues/new?title=…&body=…` link. The body shrinks (code-point-safe) until the
 * whole URL fits; the title is trimmed to 80 code points the same way.
 */
export function buildIssueUrl(title: string, body: string): string {
    let safeTitle = truncateCodePoints(title.trim(), 80);
    let safeBody = body;
    let url = `${BUG_REPORT_ISSUE_URL}?title=${encodeURIComponent(safeTitle)}&body=${encodeURIComponent(safeBody)}`;
    if (url.length <= MAX_ISSUE_URL_LENGTH) return url;
    const overhead = url.length - safeBody.length;
    let budget = MAX_ISSUE_URL_LENGTH - overhead;
    while (budget > 0) {
        const cut = truncateCodePoints(safeBody, budget);
        url = `${BUG_REPORT_ISSUE_URL}?title=${encodeURIComponent(safeTitle)}&body=${encodeURIComponent(cut)}`;
        if (url.length <= MAX_ISSUE_URL_LENGTH) return url;
        // encodeURIComponent expands non-ASCII; shrink by the overshoot in code points.
        budget -= Math.max(1, Math.ceil((url.length - MAX_ISSUE_URL_LENGTH) / 3));
    }
    return `${BUG_REPORT_ISSUE_URL}?title=${encodeURIComponent(safeTitle)}&body=`;
}

/** One error section for the issue body: last warn/error lines, redacted and shortened. */
export function formatErrorLines(lines: readonly string[], maxLines = 10, maxChars = 300): string {
    return lines
        .slice(-maxLines)
        .map((line) => truncateCodePoints(redactAddresses(line), maxChars))
        .join("\n");
}

export type BugReportPosition = { x: number; y: number; plane: number };

/** The diagnostics allowlist, as plain data: no user agent, language, timezone, page URL,
 * world address, inventory, skills, varps, interfaces or full console. Account state
 * (name, position) is in; anything identifying a real person is out. */
export type BugReportDiagnostics = {
    player: string;
    position?: BugReportPosition;
    world: string;
    worldId?: string;
    tick: number;
    transport: string;
    renderer: string;
    viewport: string;
    fps: number;
    mobile: boolean;
    cache?: string;
    failedPlugins: Record<string, string>;
    errors: string;
    skills?: string;
    inventory?: string;
    equipment?: string;
    varps?: string;
    interfaces?: string;
    messages: string[];
};

/** The prefilled issue body: description first, then the diagnostics allowlist. Bulky
 * account sections are capped per section and come after the errors, so if the whole
 * URL still overflows its ~8KB cap, the shrink cuts game messages first, errors last. */
export function formatBugReportBody(description: string, diagnostics: BugReportDiagnostics): string {
    const browser = typeof navigator === "undefined" ? "unknown" : coarseBrowser(navigator.userAgent);
    const capped = (text: string | undefined, max: number): string | undefined =>
        text ? truncateCodePoints(redactAddresses(text), max) : undefined;
    const lines = [
        description.trim(),
        "",
        "---",
        `World: ${diagnostics.world}${diagnostics.worldId ? ` (${diagnostics.worldId})` : ""}, tick ${diagnostics.tick}, ${diagnostics.transport}`,
        `Player: ${diagnostics.player}${diagnostics.position ? ` at ${diagnostics.position.x}, ${diagnostics.position.y}, ${diagnostics.position.plane}` : ""}`,
        `Client: ${browser}, ${diagnostics.renderer}, ${diagnostics.viewport}, ${diagnostics.fps} fps${diagnostics.mobile ? ", mobile" : ""}${diagnostics.cache ? `, cache ${diagnostics.cache}` : ""}`,
    ];
    const failed = Object.entries(diagnostics.failedPlugins);
    if (failed.length > 0) {
        lines.push(`Failed plugins: ${failed.map(([name]) => name).join(", ")}`);
    }
    lines.push("", "Recent errors:", "```", diagnostics.errors, "```");
    const account: string[] = [];
    const skills = capped(diagnostics.skills, 300);
    if (skills) account.push(`Skills: ${skills}`);
    const inventory = capped(diagnostics.inventory, 400);
    if (inventory) account.push(`Inventory: ${inventory}`);
    const equipment = capped(diagnostics.equipment, 300);
    if (equipment) account.push(`Equipment: ${equipment}`);
    const varps = capped(diagnostics.varps, 300);
    if (varps) account.push(`Varps: ${varps}`);
    const interfaces = capped(diagnostics.interfaces, 150);
    if (interfaces) account.push(`Interfaces: ${interfaces}`);
    if (account.length > 0) lines.push("", ...account);
    const messages = diagnostics.messages
        .slice(-8)
        .map((message) => truncateCodePoints(redactAddresses(message), 120))
        .filter((message) => message.trim().length > 0);
    if (messages.length > 0) lines.push("", "Game messages:", "```", messages.join("\n"), "```");
    return lines.join("\n");
}
