// Edit MCP tools (plugins/agent/mcp/Edit.AgentMcp.js): search/describe/place/remove/list
// against a fake core and a temp spawns file. Run: node --test tests/edit-mcp.test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { z } = require("zod");

const registerEditTools = require("../plugins/agent/mcp/Edit.AgentMcp");

const NAMES = {
  0: "null",
  1: "Oak tree",
  2: "Marble wall",
  3: "Marble wall",
  4: "Bank booth",
  5: "Oak door",
};

function fakeCore(live = []) {
  class Location {
    constructor(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    getX() { return this.x; }
    getY() { return this.y; }
    getZ() { return this.z; }
  }
  class GameObject {
    constructor(id, position, type, face) {
      this.id = id;
      this.position = position;
      this.objectType = type;
      this.objectFace = face;
    }
    getId() { return this.id; }
    getType() { return this.objectType; }
    getFace() { return this.objectFace; }
    getLocation() { return this.position; }
  }
  const keyOf = (position, type) => `${position.x},${position.y},${position.z},${type}`;
  return {
    Location,
    GameObject,
    CacheDefinitions: {
      getCounts: () => ({ objects: Object.keys(NAMES).length }),
      getObject: (id) => ({ name: NAMES[id] ?? "null" }),
    },
    ObjectDefinition: {
      forId: (id) => (NAMES[id] === undefined || NAMES[id] === "null" ? undefined : {
        getName: () => NAMES[id],
        getSizeX: () => 1,
        getSizeY: () => 1,
        isSolid: () => id !== 5,
        isImpenetrable: () => false,
        hasActions: () => id === 4,
        getInteractions: () => (id === 4 ? ["Bank"] : null),
      }),
    },
    ObjectManager: {
      register: (object) => {
        for (let i = live.length - 1; i >= 0; i--) {
          if (keyOf(live[i].position, live[i].objectType) === keyOf(object.position, object.objectType)) {
            live.splice(i, 1);
          }
        }
        live.push(object);
      },
      deregister: (object) => {
        const index = live.indexOf(object);
        if (index !== -1) live.splice(index, 1);
      },
      objectsAt: (position) => live.filter(
        (object) => object.position.x === position.x && object.position.y === position.y && object.position.z === position.z,
      ),
    },
    live,
    World: {
      removeQueue: [],
      getRemoveNPCQueue() { return this.removeQueue; },
      getNpcsNear: () => [],
    },
    MapObjects: {
      mapObjects: new Map(),
      getHash: (x, y, z) => `${x},${y},${z}`,
    },
  };
}

function setup(core) {
  const tools = new Map();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edit-mcp-"));
  process.env.AGENT_MCP_SPAWNS_FILE = path.join(dir, "object-spawns.json");
  fs.writeFileSync(process.env.AGENT_MCP_SPAWNS_FILE, "[]");
  process.env.AGENT_MCP_NPC_SPAWNS_FILE = path.join(dir, "npc-spawns.json");
  fs.writeFileSync(process.env.AGENT_MCP_NPC_SPAWNS_FILE, "[]");
  // Same envelope as Context.AgentMcp's tool(): JSON text, errors flagged.
  const tool = (name, _description, _schema, handler) => tools.set(name, async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await handler(args)) }] };
    } catch (error) {
      return { content: [{ type: "text", text: String(error?.message ?? error) }], isError: true };
    }
  });
  registerEditTools({ core, tool, z });
  const call = async (name, args) => {
    const result = await tools.get(name)(args);
    if (result.isError) throw new Error(result.content[0].text);
    return JSON.parse(result.content[0].text);
  };
  const callRaw = (name, args) => tools.get(name)(args);
  return { tools, call, callRaw, file: process.env.AGENT_MCP_SPAWNS_FILE };
}

test("registers the edit toolset", () => {
  const { tools } = setup(fakeCore());
  assert.deepEqual(
    [...tools.keys()],
    ["search_objects", "describe_object", "place_object", "remove_object", "clear_area", "list_placed_objects"],
  );
});

test("clear_area removes objects and npcs, persisting removals", async () => {
  const core = fakeCore();
  const tools = new Map();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edit-mcp-clear-"));
  process.env.AGENT_MCP_SPAWNS_FILE = path.join(dir, "object-spawns.json");
  process.env.AGENT_MCP_NPC_SPAWNS_FILE = path.join(dir, "npc-spawns.json");
  fs.writeFileSync(process.env.AGENT_MCP_SPAWNS_FILE, "[]");
  fs.writeFileSync(process.env.AGENT_MCP_NPC_SPAWNS_FILE, JSON.stringify([
    { level: 0, name: "Man", x: 101, y: 101, id: 1 },
  ]));
  const tool = (name, _description, _schema, handler) => tools.set(name, async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await handler(args)) }] };
    } catch (error) {
      return { content: [{ type: "text", text: String(error?.message ?? error) }], isError: true };
    }
  });
  registerEditTools({ core, tool, z });
  const call = async (name, args) => {
    const result = await tools.get(name)(args);
    if (result.isError) throw new Error(result.content[0].text);
    return JSON.parse(result.content[0].text);
  };
  // ObjectManager object inside, MapObjects (cache) object inside, one outside; one live NPC inside.
  core.live.push(new core.GameObject(2, new core.Location(101, 101, 0), 10, 0));
  core.live.push(new core.GameObject(2, new core.Location(200, 200, 0), 10, 0));
  const cacheObject = new core.GameObject(4, new core.Location(102, 101, 0), 10, 0);
  core.MapObjects.mapObjects.set(core.MapObjects.getHash(102, 101, 0), [cacheObject]);
  const npc = { getId: () => 1, getLocation: () => new core.Location(101, 101, 0), getPrivateArea: () => null };
  core.World.getNpcsNear = () => [npc];
  const cleared = await call("clear_area", { x1: 100, y1: 100, x2: 102, y2: 102 });
  assert.equal(cleared.removedObjects, 2);
  assert.equal(cleared.removedNpcs, 1);
  assert.deepEqual(cleared.unpersistedCacheNpcs, []);
  assert.equal(core.live.length, 1);
  assert.equal(core.World.removeQueue.length, 1);
  const spawns = JSON.parse(fs.readFileSync(process.env.AGENT_MCP_SPAWNS_FILE, "utf8"));
  assert.equal(spawns.length, 2);
  assert.ok(spawns.every((entry) => entry.remove === true));
  assert.deepEqual(spawns.map((entry) => entry.id).sort(), [2, 4]);
  assert.deepEqual(JSON.parse(fs.readFileSync(process.env.AGENT_MCP_NPC_SPAWNS_FILE, "utf8")), []);
  // Cache NPCs with no file entry are reported as unpersisted.
  const stray = { getId: () => 9, getLocation: () => new core.Location(101, 102, 0), getPrivateArea: () => null };
  core.World.getNpcsNear = () => [stray];
  const cleared2 = await call("clear_area", { x1: 100, y1: 100, x2: 102, y2: 102 });
  assert.equal(cleared2.removedNpcs, 1);
  assert.deepEqual(cleared2.unpersistedCacheNpcs, [{ id: 9, x: 101, y: 102 }]);
  // Oversized rects are rejected.
  const big = await tools.get("clear_area")({ x1: 0, y1: 0, x2: 100, y2: 100 });
  assert.equal(big.isError, true);
});

test("search_objects matches names and ids, skipping null entries", async () => {
  const { call } = setup(fakeCore());
  const walls = await call("search_objects", { query: "marble", limit: 20 });
  assert.deepEqual(walls.results, [{ id: 2, name: "Marble wall" }, { id: 3, name: "Marble wall" }]);
  const byId = await call("search_objects", { query: "4", limit: 20 });
  assert.deepEqual(byId.results.map((r) => r.id), [4]);
  const none = await call("search_objects", { query: "zzz-no-such-loc", limit: 20 });
  assert.equal(none.count, 0);
});

test("describe_object reports footprint and flags; unknown ids fail", async () => {
  const { call, callRaw } = setup(fakeCore());
  assert.deepEqual(await call("describe_object", { id: 4 }), {
    id: 4, name: "Bank booth", sizeX: 1, sizeY: 1,
    solid: true, blocksProjectiles: false, interactive: true, options: ["Bank"],
  });
  const bad = await callRaw("describe_object", { id: 99 });
  assert.equal(bad.isError, true);
});

test("place_object goes live, persists once, and validates", async () => {
  const core = fakeCore();
  const { call, callRaw, file } = setup(core);
  const placed = await call("place_object", { id: 2, x: 3200, y: 3200 });
  assert.equal(placed.placed.name, "Marble wall");
  assert.equal(placed.persisted, true);
  assert.equal(core.live.length, 1);
  // Placing again replaces live and does not duplicate the file entry.
  await call("place_object", { id: 2, x: 3200, y: 3200 });
  assert.equal(core.live.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).length, 1);
  const entry = JSON.parse(fs.readFileSync(file, "utf8"))[0];
  assert.deepEqual(entry, {
    id: 2, position: { x: 3200, y: 3200, z: 0 }, type: 10, face: 0, source: "agent-mcp",
  });
  for (const args of [
    { id: 99, x: 3200, y: 3200 },
    { id: 2, x: -1, y: 3200 },
    { id: 2, x: 3200, y: 3200, z: 5 },
    { id: 2, x: 3200, y: 3200, type: 23 },
  ]) {
    assert.equal((await callRaw("place_object", args)).isError, true, JSON.stringify(args));
  }
});

test("remove_object clears live and file; cache objects get a removal entry", async () => {
  const core = fakeCore();
  const { call, callRaw, file } = setup(core);
  await call("place_object", { id: 2, x: 3200, y: 3200 });
  const removed = await call("remove_object", { x: 3200, y: 3200, z: 0 });
  assert.deepEqual(removed.removed, [{ id: 2, type: 10, x: 3200, y: 3200, z: 0 }]);
  assert.equal(core.live.length, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), []);
  // A cache-map object (live, but no file entry) leaves a remove:true marker.
  core.live.push(new core.GameObject(1, new core.Location(3210, 3210, 0), 10, 0));
  await call("remove_object", { x: 3210, y: 3210, z: 0 });
  const [marker] = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(marker.remove, true);
  assert.equal(marker.id, 1);
  const empty = await callRaw("remove_object", { x: 3220, y: 3220, z: 0 });
  assert.equal(empty.isError, true);
});

test("list_placed_objects filters by source", async () => {
  const { call, file } = setup(fakeCore());
  fs.writeFileSync(file, JSON.stringify([
    { id: 2, position: { x: 1, y: 2, z: 0 }, type: 10, face: 0, source: "agent-mcp" },
    { id: 4, position: { x: 3, y: 4, z: 0 }, type: 10, face: 0 },
  ]));
  assert.equal((await call("list_placed_objects", {})).count, 2);
  const agent = await call("list_placed_objects", { source: "agent-mcp" });
  assert.equal(agent.count, 1);
});

// --- review follow-ups -------------------------------------------------------

test("clear_area does not write removal markers for objects it placed itself", async () => {
  const core = fakeCore();
  const tools = new Map();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edit-mcp-clear2-"));
  process.env.AGENT_MCP_SPAWNS_FILE = path.join(dir, "object-spawns.json");
  process.env.AGENT_MCP_NPC_SPAWNS_FILE = path.join(dir, "npc-spawns.json");
  fs.writeFileSync(process.env.AGENT_MCP_SPAWNS_FILE, "[]");
  fs.writeFileSync(process.env.AGENT_MCP_NPC_SPAWNS_FILE, "[]");
  const tool = (name, _d, _s, handler) => tools.set(name, async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await handler(args)) }] };
    } catch (error) {
      return { content: [{ type: "text", text: String(error?.message ?? error) }], isError: true };
    }
  });
  registerEditTools({ core, tool, z });
  const call = async (name, args) => {
    const result = await tools.get(name)(args);
    if (result.isError) throw new Error(result.content[0].text);
    return JSON.parse(result.content[0].text);
  };
  // Place an object through the toolset, then raze the tile.
  // place_object already registered it live; the fake keeps that in core.live.
  await call("place_object", { id: 2, x: 500, y: 500 });
  await call("clear_area", { x1: 500, y1: 500, x2: 500, y2: 500, includeNpcs: false });
  const entries = JSON.parse(fs.readFileSync(process.env.AGENT_MCP_SPAWNS_FILE, "utf8"));
  assert.equal(entries.filter((entry) => entry.remove === true).length, 0,
    "an agent-placed object is dropped, not turned into a cache-map removal marker");
});

test("placing on a razed tile keeps the object after a reload", async () => {
  const core = fakeCore();
  const tools = new Map();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edit-mcp-replace-"));
  process.env.AGENT_MCP_SPAWNS_FILE = path.join(dir, "object-spawns.json");
  process.env.AGENT_MCP_NPC_SPAWNS_FILE = path.join(dir, "npc-spawns.json");
  fs.writeFileSync(process.env.AGENT_MCP_NPC_SPAWNS_FILE, "[]");
  fs.writeFileSync(process.env.AGENT_MCP_SPAWNS_FILE, JSON.stringify([
    { id: 2, position: { x: 700, y: 700, z: 0 }, type: 10, face: 0, remove: true, source: "agent-mcp" },
  ]));
  const tool = (name, _d, _s, handler) => tools.set(name, async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await handler(args)) }] };
    } catch (error) {
      return { content: [{ type: "text", text: String(error?.message ?? error) }], isError: true };
    }
  });
  registerEditTools({ core, tool, z });
  const result = await tools.get("place_object")({ id: 2, x: 700, y: 700 });
  assert.equal(result.isError, undefined);
  const entries = JSON.parse(fs.readFileSync(process.env.AGENT_MCP_SPAWNS_FILE, "utf8"));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].remove, undefined, "the stale marker must be gone");
});
