// node --test tests/bounty-hunter.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const Targets = require("../plugins/minigames/bountyhunter/Targets.BountyHunter");

const { inRange, canPair, matchPairs, skipOutcome, SKIP_WINDOW_MS } = Targets._test;

const player = (name, level, band = 5) => ({ name, level, band });
const rules = (avoided = []) => ({
  levelOf: (p) => p.level,
  bandOf: (p) => p.band,
  avoids: (a, b) => avoided.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
});
const names = (pairs) => pairs.map((pair) => pair.map((p) => p.name).join("+"));

test("targets are from 15 levels below up to the chosen band above", () => {
  assert.equal(inRange(100, 85, 5), true);
  assert.equal(inRange(100, 84, 5), false);
  assert.equal(inRange(100, 105, 5), true);
  assert.equal(inRange(100, 106, 5), false);
  assert.equal(inRange(100, 115, 15), true);
});

test("a pair has to suit both players' bands", () => {
  const strong = player("strong", 100, 15);
  const weak = player("weak", 90, 5);
  assert.equal(canPair(strong, weak, (p) => p.level, (p) => p.band), false, "weak only takes up to 95");
  weak.band = 10;
  assert.equal(canPair(strong, weak, (p) => p.level, (p) => p.band), true);
});

test("matching serves the longest waiting first and leaves misfits waiting", () => {
  const a = player("a", 100);
  const b = player("b", 60);
  const c = player("c", 98);
  const d = player("d", 62);
  const e = player("e", 126);
  assert.deepEqual(names(matchPairs([a, b, c, d, e], rules())), ["a+c", "b+d"]);
});

test("a skipped target isn't offered again", () => {
  const a = player("a", 100);
  const b = player("b", 100);
  const c = player("c", 100);
  assert.deepEqual(names(matchPairs([a, b, c], rules([[a, b]]))), ["a+c"]);
  assert.deepEqual(names(matchPairs([a, b], rules([[a, b]]))), []);
});

test("unskulled skips are free; the third skulled skip in 30 minutes blocks", () => {
  const now = 10 * SKIP_WINDOW_MS;
  let history = [];
  for (let i = 0; i < 5; i++) {
    const unskulled = skipOutcome(history, now, false);
    assert.equal(unskulled.blocks, false);
    history = unskulled.history;
  }
  const first = skipOutcome(history, now, true);
  const second = skipOutcome(first.history, now + 1, true);
  const third = skipOutcome(second.history, now + 2, true);
  assert.deepEqual([first.blocks, second.blocks, third.blocks], [false, false, true]);
  assert.deepEqual(third.history, [], "the block starts a fresh window");
});

test("skulled skips older than 30 minutes no longer count", () => {
  const now = 10 * SKIP_WINDOW_MS;
  const old = [now - SKIP_WINDOW_MS - 1, now - SKIP_WINDOW_MS];
  const outcome = skipOutcome(old, now, true);
  assert.equal(outcome.blocks, false);
  assert.deepEqual(outcome.history, [now]);
  assert.equal(skipOutcome([now - SKIP_WINDOW_MS + 1, now - 1], now, true).blocks, true);
});
