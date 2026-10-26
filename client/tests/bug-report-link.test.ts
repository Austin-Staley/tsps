import { strict as assert } from "node:assert";

import {
    BUG_REPORT_ISSUE_URL,
    MAX_ISSUE_URL_LENGTH,
    buildIssueUrl,
    coarseBrowser,
    formatBugReportBody,
    formatErrorLines,
    redactAddresses,
    truncateCodePoints,
} from "../game/plugins/bugreport/bugReportLink";

function testTruncation(): void {
    assert.equal(truncateCodePoints("abc", 5), "abc");
    // An emoji at units 79-80 of a UTF-16 cut would lose half of itself; code points keep it whole.
    const emoji = "a".repeat(79) + "🙂";
    assert.equal(Array.from(truncateCodePoints(emoji, 80)).length, 80);
    assert.ok(truncateCodePoints(emoji, 80).endsWith("🙂"));
    assert.ok(!truncateCodePoints(`${emoji}tail`, 80).includes("�"));
}

function testRedaction(): void {
    assert.equal(redactAddresses("ws://192.168.1.10:43594/game"), "ws://(address left out):43594/game");
    assert.equal(redactAddresses("candidate 10.0.0.5:54321"), "candidate (address left out):54321");
    assert.ok(redactAddresses("fe80::1ff:fe23:4567:890a").includes("(address left out)"));
    assert.equal(redactAddresses("nothing to hide"), "nothing to hide");
}

function testCoarseBrowser(): void {
    const chrome =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    assert.equal(coarseBrowser(chrome), "Chrome");
    assert.equal(coarseBrowser("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"), "Firefox");
    assert.equal(coarseBrowser("经过"), "Other");
}

function testUrlCap(): void {
    const body = `line\n`.repeat(5000);
    const url = buildIssueUrl("a � 🙂 title that is far too long ".repeat(10), body);
    assert.ok(url.startsWith(`${BUG_REPORT_ISSUE_URL}?title=`), "keeps the issues/new target");
    assert.ok(url.length <= MAX_ISSUE_URL_LENGTH, `url fits 8KB, was ${url.length}`);
    assert.ok(!url.includes("�"), "no half emoji in the shrunk url");
}

function testBodyAllowlist(): void {
    const body = formatBugReportBody("The door won't open", {
        player: "Zezima",
        position: { x: 3200, y: 3200, plane: 0 },
        world: "Local Development",
        worldId: "1",
        tick: 1234,
        transport: "websocket",
        renderer: "WebGL",
        viewport: "1920x1080 @1x",
        fps: 50,
        mobile: false,
        cache: "rev 231",
        failedPlugins: {},
        errors: "[warn] something creaked",
        skills: "total 2277 (combat 126): Attack 99, Strength 99",
        inventory: "Coins x1000, Lobster",
        equipment: "Abyssal whip",
        varps: "3 set: 1=1, 2=5",
        interfaces: "root 378 (2 open)",
        messages: ["Welcome to tsps."],
    });
    for (const want of [
        "Zezima",
        "3200, 3200, 0",
        "tick 1234",
        "WebGL",
        "50 fps",
        "[warn] something creaked",
        "Attack 99",
        "Coins x1000",
        "Abyssal whip",
        "Welcome to tsps.",
    ]) {
        assert.ok(body.includes(want), `body carries ${want}`);
    }
    for (const banned of ["userAgent", "language", "timeZone", "address"]) {
        assert.ok(!body.toLowerCase().includes(banned.toLowerCase()), `body has no ${banned}`);
    }
    // Errors survive the shrink: bulky sections after them are cut first.
    const huge = formatBugReportBody("x".repeat(2000), {
        player: "p",
        world: "w",
        tick: 1,
        transport: "websocket",
        renderer: "r",
        viewport: "v",
        fps: 1,
        mobile: false,
        failedPlugins: {},
        errors: "[error] keep me",
        inventory: "item, ".repeat(500),
        messages: ["msg, ".repeat(500)],
    });
    assert.ok(huge.includes("[error] keep me"), "errors survive overflow");
    const url = buildIssueUrl("t", huge);
    assert.ok(url.length <= MAX_ISSUE_URL_LENGTH, "overflow body still fits the url");
}

function testErrorLines(): void {
    // Level filtering (warn/error only) happens in clientDiagnostics, which sees the entries;
    // here the lines are already filtered, and formatting redacts and shortens them.
    const lines = ["[warn] 192.168.0.1 creaked", `[error] ${"boom ".repeat(100)}`];
    const formatted = formatErrorLines(lines);
    assert.ok(formatted.includes("(address left out)"), "errors are redacted");
    assert.ok(
        Array.from(formatted).length <= 2 * 300 + 1,
        "each line is shortened to its budget",
    );
}

testTruncation();
testRedaction();
testCoarseBrowser();
testUrlCap();
testBodyAllowlist();
testErrorLines();
console.log("bug-report-link: all assertions passed");
