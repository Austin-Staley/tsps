// Run after `yarn build`: node --test tests/teleport-interface.test.cjs
// ::teleports: the destination data against the cache and collision map, the rows each tab
// sends, and selecting, teleporting, favourites, recents and the Wilderness warning.
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { RegionManager } = require("../dist/game/collision/RegionManager");
const { PluginManager } = require("../dist/plugins/PluginManager");
const TeleportInterface = require("../plugins/interface/TeleportInterface.plugin");

const { COMPONENT, TAB, TAB_UIDS, ROW_UIDS, OP, Destinations, uid } = TeleportInterface._test;
const teleports = [];
let dialogue;
let commands;
let buttons;

class OptionDialogue {
  constructor(_id, handler, ...options) { this.handler = handler; this.options = options; }
  setTitle(title) { this.title = title; return this; }
}

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  RegionManager.init();
  const core = {
    ...PluginManager.getCoreApi(),
    TeleportHandler: { checkReqs: () => true, teleport: (player, location, type) => teleports.push({ location, type }) },
    DialogueChainBuilder: class { add(step) { dialogue = step; return this; } },
    OptionDialogue,
  };
  commands = new Map();
  buttons = new Map();
  TeleportInterface.register({
    core,
    registerCustomInterface() {},
    persistAttribute() {},
    registerCommand: (name, handler) => commands.set(name, handler),
    onInterfaceActionButton: (ids, handler) => ids.forEach((id) => buttons.set(id, handler)),
    emitCustomEvent: (name, request) => { if (name === "combat-achievements:count") request.total = request.monster === "Zulrah" ? 12 : 0; },
  });
});

function player() {
  const attributes = new Map();
  const texts = new Map();
  const items = new Map();
  const hidden = new Map();
  const messages = [];
  let interfaceId = -1;
  const sender = {
    sendSubInterface() { return this; },
    sendString(text, id) { texts.set(id, text); return this; },
    sendItemOnInterface(id, item) { items.set(id, item); return this; },
    clearItemOnInterface(id) { items.delete(id); return this; },
    sendInterfaceDisplayState(id, hide) { hidden.set(id, hide); return this; },
    sendInterfaceRemoval() { interfaceId = -1; return this; },
    sendMessage(message) { messages.push(message); return this; },
  };
  return {
    texts, items, hidden, messages, attributes,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInterfaceId: () => interfaceId,
    setInterfaceId: (id) => { interfaceId = id; },
    getPacketSender: () => sender,
    getFrameUpdater: () => ({ clear: (id) => texts.delete(id) }),
    getDialogueManager: () => ({ startDialogues() {} }),
  };
}

const run = (p, ...parts) => commands.get("teleports")({ player: p, parts: ["teleports", ...parts] });
const rows = (p) => JSON.parse(p.texts.get(uid(COMPONENT.DATA)));
const click = (p, buttonId, extra = {}) => buttons.get(buttonId)({ player: p, buttonId, ...extra });
const rowFor = (p, key) => rows(p).find((row) => row.id === Destinations.byKey(key).id);
const clickRow = (p, key, opId) => click(p, ROW_UIDS[0], { slot: Destinations.byKey(key).id, opId });

test("every destination lands on a free tile, with a known icon, type and tab", () => {
  const { DESTINATIONS, TAB_ORDER } = Destinations;
  const keys = new Set();
  const blocked = [];
  const core = PluginManager.getCoreApi();
  for (const entry of DESTINATIONS) {
    assert.ok(!keys.has(entry.key), `duplicate key ${entry.key}`);
    keys.add(entry.key);
    assert.ok(Destinations.iconId(entry) >= 0, `${entry.key}: unknown icon ${entry.icon}`);
    assert.ok(core.TeleportType[entry.type], `${entry.key}: unknown type ${entry.type}`);
    assert.ok(entry.tabs.every((tab) => TAB_ORDER.includes(tab) && tab !== TAB.SAVED && tab !== TAB.ALL), `${entry.key}: bad tab`);
    assert.ok(entry.description, `${entry.key}: no description`);
    if (RegionManager.blocked(Destinations.location(entry), null)) blocked.push(`${entry.key} ${entry.tile}`);
  }
  assert.deepEqual(blocked, [], "landing tiles must be walkable");
  for (const entry of DESTINATIONS.filter((row) => row.tabs.includes(TAB.WILDERNESS))) {
    assert.ok(Destinations.wildernessLevel(entry) > 0, `${entry.key} is on the Wilderness tab but not in it`);
  }
  assert.equal(Destinations.wildernessLevel(Destinations.byKey("corporeal-beast")), 0, "Corp's cave is not PvP ground");
});

test("each tab sends its destinations under sorted headers, with Wilderness levels", () => {
  const p = player();
  run(p);
  const all = rows(p);
  // Widget text travels in a packet with a 16-bit length; keep the biggest tab well inside it.
  const allBytes = Buffer.byteLength(p.texts.get(uid(COMPONENT.DATA)), "latin1");
  assert.ok(allBytes < 48000, `the All tab's rows are ${allBytes} bytes, too close to the 65535-byte packet limit`);
  assert.equal(all.filter((row) => !row.header).length, Destinations.DESTINATIONS.length, "All lists everything once");
  click(p, TAB_UIDS[Destinations.TAB_ORDER.indexOf(TAB.BOSSES)]);
  const bosses = rows(p);
  assert.deepEqual(bosses.filter((row) => row.header).map((row) => row.name), ["Bosses", "God Wars Dungeon"]);
  const firstSection = bosses.slice(1, bosses.findIndex((row, index) => index > 0 && row.header)).map((row) => row.name);
  assert.deepEqual(firstSection, [...firstSection].sort((a, b) => a.localeCompare(b)), "sections are sorted by name");
  assert.ok(bosses.some((row) => row.name === "Nex"));
  assert.equal(p.texts.get(uid(COMPONENT.TAB_LABEL_START + Destinations.TAB_ORDER.indexOf(TAB.BOSSES))), "<col=ffffff>Bosses</col>");
  click(p, TAB_UIDS[Destinations.TAB_ORDER.indexOf(TAB.WILDERNESS)]);
  const callisto = rows(p).find((row) => row.name === "Callisto");
  assert.match(callisto.detail, /^ Lvl \d+$/, "Wilderness rows carry their level");
  assert.ok(callisto.icon >= 0);
  run(p);
  assert.equal(p.texts.get(uid(COMPONENT.TAB_LABEL_START + Destinations.TAB_ORDER.indexOf(TAB.WILDERNESS))), "<col=ffffff>Wilderness</col>",
    "reopening returns to the last tab");
  run(p, "god", "wars");
  assert.equal(p.texts.get(uid(COMPONENT.SEARCH_INPUT)), "god wars", "a search opens All with the query");
  click(p, TAB_UIDS[Destinations.TAB_ORDER.indexOf(TAB.BOSSES)]);
  assert.equal(p.texts.get(uid(COMPONENT.SEARCH_INPUT)), "", "switching tabs clears the search");
  p.texts.delete(uid(COMPONENT.SEARCH_INPUT));
  click(p, TAB_UIDS[Destinations.TAB_ORDER.indexOf(TAB.BOSSES)]);
  assert.equal(p.texts.get(uid(COMPONENT.SEARCH_INPUT)), "", "every switch clears it, even after an earlier clear");
});

test("rows carry their panel text; selecting arms the panel and right-click both teleport", () => {
  const p = player();
  run(p);
  assert.equal(p.hidden.get(uid(COMPONENT.TELEPORT_BUTTON)), true, "nothing selected, no buttons");
  assert.equal(p.texts.get(uid(COMPONENT.PANEL_TITLE)), "Teleports");
  assert.deepEqual(rowFor(p, "zulrah").panel, {
    title: "Zulrah", subtitle: "Bosses", info: "Kill count: <col=ffffff>12</col>", info2: "",
    description: Destinations.byKey("zulrah").description, favourite: "Favourite",
  }, "outside the Wilderness the kill count takes the first line");
  assert.match(rowFor(p, "callisto").panel.info, /^<col=ff5f5f>Level \d+ Wilderness/);
  assert.equal(rowFor(p, "callisto").panel.info2, "Kill count: <col=ffffff>0</col>");
  assert.equal(rowFor(p, "elvarg").panel.info, "", "no Wilderness and no kill count, no lines");
  const sent = p.texts.size;
  clickRow(p, "zulrah", OP.SELECT);
  assert.equal(p.texts.size, sent, "the client draws the selection; the server sends nothing");
  teleports.length = 0;
  click(p, uid(COMPONENT.TELEPORT_BUTTON));
  assert.deepEqual([teleports[0].location.getX(), teleports[0].location.getY()], [2196, 3056]);
  assert.equal(p.getInterfaceId(), -1, "teleporting closes the interface");
  run(p);
  clickRow(p, "count-draynor", OP.TELEPORT);
  assert.equal(teleports.length, 2);
  assert.equal(p.getAttribute("count_draynor:pending_instance"), true, "a destination's attributes are set");
  assert.deepEqual(p.getAttribute(TeleportInterface._test.RECENT_ATTRIBUTE), ["count-draynor", "zulrah"]);
  const before = teleports.length;
  click(p, ROW_UIDS[0], { slot: Destinations.byKey("zulrah").id, opId: OP.TELEPORT });
  assert.equal(teleports.length, before, "a closed interface ignores stale clicks");
});

test("the Wilderness asks first, and remembers 'don't ask again'", () => {
  const p = player();
  teleports.length = 0;
  dialogue = undefined;
  run(p);
  clickRow(p, "callisto", OP.TELEPORT);
  assert.equal(teleports.length, 0, "no teleport before the answer");
  assert.match(dialogue.title, /^Teleport into level \d+ Wilderness\?$/);
  dialogue.handler.executeOption(2);
  assert.equal(teleports.length, 0, "No stays put");
  run(p);
  clickRow(p, "callisto", OP.TELEPORT);
  dialogue.handler.executeOption(3);
  assert.equal(teleports.length, 1);
  assert.equal(p.getAttribute(TeleportInterface._test.SKIP_WILDERNESS_WARNING_ATTRIBUTE), true);
  dialogue = undefined;
  run(p);
  clickRow(p, "callisto", OP.TELEPORT);
  assert.equal(dialogue, undefined, "no question once declined");
  assert.equal(teleports.length, 2);
});

test("favourites and recents fill the Saved tab; ::teleports last repeats the newest", () => {
  const p = player();
  teleports.length = 0;
  run(p, "last");
  assert.deepEqual(p.messages, ["You haven't teleported with ::teleports yet."]);
  run(p);
  clickRow(p, "zulrah", OP.FAVOURITE);
  clickRow(p, "barrows", OP.FAVOURITE);
  assert.deepEqual(p.getAttribute(TeleportInterface._test.FAVOURITES_ATTRIBUTE), ["zulrah", "barrows"]);
  for (const key of ["vorkath", "gwd-nex", "kraken", "giant-mole", "scurrius", "yama"]) {
    run(p);
    clickRow(p, key, OP.TELEPORT);
  }
  assert.deepEqual(p.getAttribute(TeleportInterface._test.RECENT_ATTRIBUTE), ["yama", "scurrius", "giant-mole", "kraken", "gwd-nex"],
    "the five newest, newest first");
  run(p);
  click(p, TAB_UIDS[Destinations.TAB_ORDER.indexOf(TAB.SAVED)]);
  assert.deepEqual(rows(p).map((row) => row.name),
    ["Favourites", "Barrows", "Zulrah", "Recent", "Yama", "Scurrius", "Giant Mole", "Kraken", "Nex"]);
  assert.equal(rowFor(p, "zulrah").panel.favourite, "Unfavourite");
  clickRow(p, "zulrah", OP.SELECT);
  click(p, uid(COMPONENT.FAVOURITE_BUTTON));
  assert.ok(!rows(p).slice(0, 3).some((row) => row.name === "Zulrah"), "the Saved tab redraws");
  click(p, TAB_UIDS[Destinations.TAB_ORDER.indexOf(TAB.BOSSES)]);
  clickRow(p, "zulrah", OP.FAVOURITE);
  assert.equal(rowFor(p, "zulrah").panel.favourite, "Unfavourite", "any tab resends rows with the new label");
  p.setAttribute(TeleportInterface._test.FAVOURITES_ATTRIBUTE, ["barrows", "a-removed-destination"]);
  click(p, TAB_UIDS[Destinations.TAB_ORDER.indexOf(TAB.SAVED)]);
  assert.deepEqual(rows(p).slice(0, 2).map((row) => row.name), ["Favourites", "Barrows"], "unknown keys are skipped");
  teleports.length = 0;
  run(p, "last");
  assert.deepEqual([teleports[0].location.getX(), teleports[0].location.getY()], Destinations.byKey("yama").tile.slice(0, 2));
});
