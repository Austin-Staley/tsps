// Run after `yarn build`: node --test tests/object-examines.test.cjs
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { ObjectDefinition } = require("../dist/game/definition/ObjectDefinition");
const examines = require("../data/definitions/object-examines.json");
const captured = require("../data/definitions/object-examines-captured.json");

before(async () => {
  const { CachePipeline } = require("../dist/game/cache/CachePipeline");
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  ObjectDefinition.init();
});

test("a tree's examine is the Wiki's, per version of the tree", () => {
  assert.equal(ObjectDefinition.forId(1276).getExamine(), "One of the most common trees in Gielinor.");
  assert.equal(ObjectDefinition.forId(1278).getExamine(), "A commonly found tree.");
});

test("an examine captured live wins over the Wiki's and covers ids its pages miss", () => {
  for (const [id, text] of Object.entries(captured)) assert.equal(examines[id], text, `object ${id}`);
  assert.equal(ObjectDefinition.forId(6768).getExamine(), "A good source of books!", "poh_bookcase1, on no Wiki page");
});

test("an object with no recorded examine keeps the generic line", () => {
  const unknown = [...Array(ObjectDefinition.totalObjects).keys()].find((id) => !examines[id] && ObjectDefinition.forId(id)?.getName() === "Tree");
  if (unknown !== undefined) assert.equal(ObjectDefinition.forId(unknown).getExamine(), "It's a Tree.");
});

test("no wiki markup or placeholders are left in the texts", () => {
  const leftovers = Object.entries(examines).filter(([, text]) => /\[\[|\]\]|\{\{|\}\}|<[a-z/]|''|^N\/A$|^\(Unlit\)/i.test(text));
  assert.deepEqual(leftovers, []);
});
