import assert from "node:assert/strict";

import { parseWrappedOsrsMarkup, type TextSegment } from "../widgets/components/TextRenderer";

// The OSRS client sets a font's colour and styles once (AbstractFont.reset) and then draws every
// wrapped line (draw0) without resetting them, so a <col> opened on one line still colours the
// next. The skill guide's "Requires: ... Making Friends with My Arm" wraps inside its red tag.
const DEFAULT = 0xff981f;
const RED = 0xff0000;

const textOf = (line: TextSegment[]) => line.map((segment) => segment.text).join("");
const colourOf = (line: TextSegment[], text: string) => {
    const segment = line.find((s) => s.text.includes(text));
    assert.ok(segment, `no segment with "${text}" in "${textOf(line)}"`);
    return segment.color;
};

const guide = parseWrappedOsrsMarkup(
    [
        "Requires: <col=ff0000>Level 35 Construction</col>, <col=ff0000>Making",
        "Friends with My Arm</col>",
    ],
    DEFAULT,
);
assert.equal(colourOf(guide[0], "Requires:"), DEFAULT);
assert.equal(colourOf(guide[0], "Making"), RED);
assert.equal(colourOf(guide[1], "Friends with My Arm"), RED, "the colour carries to the next line");

// A closing tag on the next line ends it there, and later lines are back to the default.
const closed = parseWrappedOsrsMarkup(["<col=ff0000>red", "still</col> plain", "plain"], DEFAULT);
assert.equal(colourOf(closed[1], "still"), RED);
assert.equal(colourOf(closed[1], "plain"), DEFAULT);
assert.equal(colourOf(closed[2], "plain"), DEFAULT);

// Shadow, underline and strikethrough carry the same way.
const styled = parseWrappedOsrsMarkup(["<shad=00ff00><u=0000ff><str>one", "two"], DEFAULT);
assert.equal(styled[1][0].shadow, 0x00ff00);
assert.equal(styled[1][0].underline, 0x0000ff);
assert.equal(styled[1][0].strikethrough, 0x800000);

// Separate calls still start from the default: only lines of one text share styles.
assert.equal(colourOf(parseWrappedOsrsMarkup(["fresh"], DEFAULT)[0], "fresh"), DEFAULT);

console.log("text-wrapped-styles: ok");
