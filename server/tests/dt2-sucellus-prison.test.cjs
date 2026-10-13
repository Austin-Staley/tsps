const test = require("node:test");
const assert = require("node:assert/strict");

const register = require("../plugins/quests/dt2/Prison.DesertTreasureII");
require("../plugins/quests/QuestRuntime").startTranscript = () => true;

function setup() {
  const handlers = { custom: {}, npc: [], object: null, itemObject: null, item: [], dialogueAction: null };
  const emitted = [];
  let stashRestored = false;
  const prompts = [];
  const createdNpcs = [];
  const openedObjects = [];
  let cycle = 100;
  const npc = (id, location) => ({
    id, location, maxHitpoints: 1500, hitpoints: 1500,
    getId() { return this.id; },
    getLocation() { return { getX: () => this.location.x, getY: () => this.location.y }; },
    isRegistered: () => true,
    setOwner() {}, setOwnerOnly() {}, getCombat() { return { attack: (target) => { this.target = target; this.attacks = (this.attacks ?? 0) + 1; } }; },
    setHitpointsLocked(value) { this.hitpointsLocked = value; },
    setMaxHitpoints(value) { this.maxHitpoints = value; return this; },
    setHitpoints(value) { this.hitpoints = value; return this; },
  });
  const area = {
    entities: [],
    templateObjects: [],
    tile: (x, y, z) => ({ x: 10000 + x, y: 20000 + y, z }),
    getBaseX: () => 10000,
    getBaseY: () => 20000,
    getObjects() { return []; },
    getTemplateObjects() { return this.templateObjects; },
    add(value) { this.entities.push(value); },
    remove(value) { this.entities = this.entities.filter((entry) => entry !== value); },
  };
  const inventory = {
    contents: new Map(),
    getAmount(id) { return this.contents.get(id) ?? 0; },
    adds(id, amount) { this.contents.set(id, this.getAmount(id) + amount); return this; },
    deleteNumber(id, amount) { this.contents.set(id, Math.max(0, this.getAmount(id) - amount)); return true; },
  };
  const player = {
    attrs: new Map([["desert-treasure-ii:sucellus-cell-escaped", true]]),
    location: { x: 10000, y: 20000, z: 2 },
    getAttribute(key) { return this.attrs.get(key); },
    setAttribute(key, value) { this.attrs.set(key, value); },
    getInventory: () => inventory,
    getPrivateArea: () => area,
    getLocation() { return { getX: () => this.location.x, getY: () => this.location.y, getZ: () => this.location.z }; },
    getDialogueManager: () => ({ isActive: () => false }),
    sendMessage() {},
  };
  const api = {
    core: {
      ItemIdentifiers: { PRISONERS_LETTER: 28412, KNIFE_5: 28413, CHISEL_5: 28414, LOCKPICK_4: 28415,
        SAPPHIRE_KEY_3: 28416, EMERALD_KEY_3: 28417, RUBY_KEY_3: 28418, DIAMOND_KEY: 28419, WARNING_LETTER: 28429,
        REQUISITION_NOTE: 28423, GRID_NOTE: 28424, CODE_CONVERTER: 28425, MAGIC_LANTERN: 28426, STRANGE_SLIDER: 28427, LIBRARY_NOTE: 28428 },
      NpcIdentifiers: { ASSASSIN_7: 12348, ASSASSIN_8: 12349, JHALLAN_3: 12353, JHALLAN_4: 12354, JHALLAN_5: 12355 },
      ObjectDefinition: { forPlayer: (id) => ({ id }) },
      NPC: { create(id, location) { const value = npc(id, location); createdNpcs.push(value); return value; } },
      World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [], getProcessCycle: () => cycle },
      ObjectManager: { deregister(object) { object.removed = true; openedObjects.push(object); } },
    },
    persistAttribute() {},
    onCustomEvent(name, handler) {
      if (/^[^:\s]+:[^:\s]+$/.test(name)) handlers.custom[name] = handler;
    },
    emitCustomEvent(name, payload) {
      if (/^[^:\s]+:[^:\s]+$/.test(name)) {
        emitted.push({ name, payload });
        if (name === "dt2:sucellus-prison-return-stash") payload.restored = stashRestored;
      }
    },
    onNpcInteraction(...args) { handlers.npc.push(args); },
    onObjectInteraction(handler) { handlers.object = handler; },
    onItemOnObject(handler) { handlers.itemObject = handler; },
    onItemAction(...args) { handlers.item.push(args); },
    sendMultiChatboxPrompt(_player, title, ...pairs) { prompts.push({ title, pairs }); return true; },
  };
  player.setAttribute("desert-treasure-ii:sucellus-area", area);
  register(api);
  const instanceLocation = (x, y, z) => ({ x: x + 10000 - 2872, y: y + 20000 - 6336, z });
  const moveToSource = (x, y, z = 2) => { player.location = { x: x + 10000 - 2872, y: y + 20000 - 6336, z }; };
  return { api, handlers, emitted, prompts, player, area, inventory, createdNpcs, openedObjects, instanceLocation, moveToSource, setCycle: (v) => { cycle = v; }, setStashRestored: (value) => { stashRestored = value; } };
}

test("prison start removes the cutscene Assassin until the diamond-key stage", () => {
  const { handlers, player, area, createdNpcs } = setup();
  const existing = {
    id: 12348,
    location: area.tile(48, 39, 2),
    getId() { return this.id; },
    getLocation() { return { getX: () => this.location.x, getY: () => this.location.y }; },
    isRegistered: () => true,
  };
  area.entities.push(existing);

  assert.equal(handlers.custom["dt2:sucellus-prison-start"]({ player, area }), true);
  assert.equal(createdNpcs.length, 0, "module start must not create a duplicate cutscene NPC");
  assert.equal(area.entities.filter((value) => value.getId?.() === 12348).length, 0,
    "the transcript disappearance action leaves the prison clear");
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-assassin") ?? null, null);
});

function enterAnswer(prompts, answer) {
  for (const character of answer) {
    let prompt = prompts.at(-1);
    let index = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === character);
    for (let page = 0; index < 0 && page < 8; page++) {
      const more = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === "More options");
      assert.notEqual(more, -1);
      prompt.pairs[more + 1]();
      prompt = prompts.at(-1);
      index = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === character);
    }
    assert.notEqual(index, -1, `lock prompt provides ${character}`);
    prompt.pairs[index + 1]();
  }
}

function enterPadlock(prompts, heights) {
  for (const height of heights) {
    let prompt = prompts.at(-1);
    let index = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === `Set to ${height + 1}`);
    if (index < 0) {
      const more = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === "More options");
      assert.notEqual(more, -1, `padlock prompt must page to height ${height + 1}`);
      prompt.pairs[more + 1]();
      prompt = prompts.at(-1);
      index = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === `Set to ${height + 1}`);
    }
    assert.notEqual(index, -1, `padlock prompt provides height ${height + 1}`);
    prompt.pairs[index + 1]();
  }
}

test("prison lifecycle hooks use PluginManager's valid single-colon custom event names", () => {
  const { api, handlers, emitted } = setup();
  assert.deepEqual(Object.keys(handlers.custom).sort(), [
    "dt2:sucellus-prison-journal",
    "dt2:sucellus-prison-process",
    "dt2:sucellus-prison-resume",
    "dt2:sucellus-prison-start",
    "npc-dialogue:action",
    "npc-dialogue:line",
  ]);
  api.onCustomEvent("dt2:sucellus-prison:process", () => assert.fail("invalid event names must not register"));
  api.emitCustomEvent("dt2:sucellus-prison:complete", {});
  assert.equal(handlers.custom["dt2:sucellus-prison:process"], undefined);
  assert.deepEqual(emitted, [], "invalid event names are ignored like PluginManager does");
});

test("Sucellus prison gates require the lockpick and sapphire key is earned through each tumbler", () => {
  const { handlers, emitted, prompts, player, area, inventory, instanceLocation, openedObjects } = setup();
  const state = () => player.getAttribute("desert-treasure-ii:sucellus-prison-progress");
  handlers.custom["dt2:sucellus-prison-start"]({ player, area });
  assert.equal(state(), 22);

  const padlock = {
    getPrivateArea: () => area, getId: () => 49120,
    getLocation: () => ({ equals: () => true }),
  };
  area.templateObjects = [padlock];
  handlers.object({ player, object: padlock, objectId: 49120, option: "Open", location: instanceLocation(2945, 6389, 2), handled: false });
  assert.equal(state(), 22, "a missing lockpick cannot open the gate");
  inventory.adds(28415, 1);
  handlers.object({ player, object: padlock, objectId: 49120, option: "Open", location: instanceLocation(2945, 6389, 2), handled: false });
  assert.equal(state(), 22, "the six tumblers must be solved before the gate opens");
  enterPadlock(prompts, [2, 0, 5, 1, 4, 3]);
  assert.equal(state(), 24);
  assert.deepEqual(openedObjects, [padlock], "opening the gate removes the blocking private-instance object");
  const solvedLockPromptCount = prompts.length;
  const solvedPadlockOpen = handlers.object({ player, object: padlock, objectId: 49120, option: "Open", location: instanceLocation(2945, 6389, 2), handled: false });
  assert.equal(solvedPadlockOpen, true, "a solved padlock opens directly after relog");
  assert.equal(prompts.length, solvedLockPromptCount, "the solved lock does not ask for the six tumblers again");

  handlers.object({ player, objectId: 50001, option: "Search", location: instanceLocation(2974, 6347, 2), definition: { name: "Altar" }, handled: false });
  handlers.item.find(([name]) => name === "Warning letter")[1].Read({ player, itemId: 28429, handled: false });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-clues-read"), 1);

  handlers.object({ player, objectId: 50000, option: "Open", location: instanceLocation(2980, 6346, 2), handled: false });
  assert.match(prompts.at(-1).title, /Choose tumbler 1/, "the six lock tumblers are followed by the sapphire code prompt");
  for (const digit of "214013") {
    let prompt = prompts.at(-1);
    let index = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === digit);
    for (let page = 0; index < 0 && page < 3; page++) {
      prompt.pairs.at(-1)();
      prompt = prompts.at(-1);
      index = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === digit);
    }
    assert.notEqual(index, -1, `prompt must offer digit ${digit}`);
    prompt.pairs[index + 1]();
  }
  assert.equal(inventory.getAmount(28416), 1);
  assert.equal(state(), 26);
  assert.ok(emitted.some(({ name }) => name === "dt2:sucellus-prison-journal"));
});

test("Jhallan defense lasts three minutes (300 area ticks) and asylum transcript owns completion", () => {
  const { handlers, emitted, prompts, player, area, createdNpcs, setCycle, instanceLocation } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 52);
  handlers.custom["dt2:sucellus-prison-start"]({ player, area });
  handlers.object({ player, objectId: 50000, option: "Search", location: instanceLocation(2972, 6367, 2), handled: false });
  prompts[0].pairs[1]();
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 54);
  const liveJhallan = createdNpcs.find((value) => value.id === 12353);
  assert.ok(liveJhallan, "the cache-backed combat variant must attack the player");
  assert.equal(liveJhallan.hitpointsLocked, true, "players cannot shorten the scripted three-minute survival encounter by killing Jhallan");
  assert.equal(liveJhallan.target, undefined, "the scripted introduction must finish before combat starts");

  handlers.custom["dt2:sucellus-prison-process"]({ player, area, cycle: 100 });
  assert.equal(liveJhallan.target, player, "Jhallan must use the normal NPC combat path after the introduction");
  assert.equal(liveJhallan.attacks, 1);

  setCycle(250);
  handlers.custom["dt2:sucellus-prison-process"]({ player, area, cycle: 250 });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 54);
  assert.deepEqual(createdNpcs.filter((value) => value.id === 12354).map((value) => [value.id, value.hitpoints]), [[12354, 1], [12354, 1]]);

  setCycle(399);
  handlers.custom["dt2:sucellus-prison-process"]({ player, area, cycle: 399 });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 54);
  assert.equal(emitted.filter(({ name }) => name === "dt2:sucellus-prison-complete").length, 0);

  handlers.custom["dt2:sucellus-prison-process"]({ player, area, cycle: 400 });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 56);
  handlers.custom["npc-dialogue:action"]({ player, npcId: 12348, stepId: "IME-83" });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 58);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-complete"), true);
  assert.equal(emitted.filter(({ name }) => name === "dt2:sucellus-prison-complete").length, 1);
});

test("earned frozen-Jhallan progress restores the Assassin after relog without replaying the defence", () => {
  const { handlers, player, area, createdNpcs } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 56);
  player.setAttribute("desert-treasure-ii:sucellus-prison-fireworks", true);
  assert.equal(handlers.custom["dt2:sucellus-prison-resume"]({ player, area }), true);
  assert.ok(createdNpcs.some((value) => value.id === 12348), "the Assassin is recreated at the saved frozen-Jhallan stage");
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 56);
  assert.equal(handlers.custom["dt2:sucellus-prison-resume"]({ player, area: { ...area } }), false, "resume ignores a different instance");
});

test("the Assassin stays gone after the cell escape and returns only for the diamond-key plan", () => {
  const { handlers, player, area, createdNpcs } = setup();
  assert.equal(handlers.custom["dt2:sucellus-prison-start"]({ player, area }), true);
  assert.equal(createdNpcs.length, 0, "the transcript disappearance action leaves the cell area clear");
  assert.equal(handlers.custom["dt2:sucellus-prison-resume"]({ player, area }), true);
  assert.equal(createdNpcs.length, 0, "relogging at stage22 must not restore the disappeared Assassin");
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 40);
  assert.equal(handlers.custom["dt2:sucellus-prison-resume"]({ player, area }), true);
  assert.equal(createdNpcs.filter((value) => value.id === 12348).length, 1, "the diamond-key stage restores the Assassin");
});

test("private-instance gate coordinates normalize to cache tiles and preserve the earned key", () => {
  const { handlers, player, area, inventory, openedObjects, instanceLocation } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 26);
  inventory.adds(28416, 1);
  const gate = {
    getPrivateArea: () => area,
    getId: () => 49122,
    getLocation: () => ({ equals: () => true }),
  };
  const event = { player, object: gate, definition: { id: 49122 }, option: "Open", location: instanceLocation(2912, 6418, 2), handled: false };
  handlers.object(event);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 28);
  assert.equal(inventory.getAmount(28416), 1);
  assert.deepEqual(openedObjects, [gate]);

  const secondSapphireGate = { getPrivateArea: () => area, getId: () => 49122, getLocation: () => ({ equals: () => true }) };
  area.templateObjects = [secondSapphireGate];
  handlers.object({ player, object: secondSapphireGate, definition: { id: 49122 }, option: "Open", location: instanceLocation(2954, 6406, 2), handled: false });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 28, "the earned sapphire key opens later gates too");
  assert.deepEqual(openedObjects, [gate, secondSapphireGate]);

  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 46);
  inventory.adds(28419, 1);
  const diamondGate = { getPrivateArea: () => area, getId: () => 49128, getLocation: () => ({ equals: () => true }) };
  area.templateObjects = [diamondGate];
  handlers.object({ player, object: diamondGate, definition: { id: 49128 }, option: "Open", location: instanceLocation(2903, 6375, 2), handled: false });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 48, "the diamond key opens the equipment-cell gate after the Assassin's answers");
  assert.equal(inventory.getAmount(28419), 1);
  assert.equal(handlers.object({ ...event, player: { getAttribute: () => null } }), false, "outside the quest instance, gate handling falls through");
});

test("ordinary Ghorrock prison doors open without consuming a quest key", () => {
  const { handlers, player, area, inventory, openedObjects, instanceLocation } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 22);
  inventory.adds(28416, 1);
  const door = {
    getPrivateArea: () => area,
    getId: () => 49118,
    getLocation: () => ({ equals: () => true }),
  };
  const event = { player, object: door, definition: { id: 49118 }, option: "Open", location: instanceLocation(2935, 6354, 2), handled: false };
  assert.equal(handlers.object(event), true);
  assert.equal(event.handled, true);
  assert.deepEqual(openedObjects, [door]);
  assert.equal(inventory.getAmount(28416), 1);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 22);
});

test("the equipment chest advances only after confirmed stash recovery and retries safely", () => {
  const { handlers, emitted, player, inventory, instanceLocation, setStashRestored } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 46);
  inventory.adds(28419, 1);
  const chest = { player, definition: { id: 49130, name: "Chest" }, option: "Open", location: instanceLocation(2899, 6376, 2), handled: false };
  handlers.object(chest);
  assert.equal(chest.handled, true);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 46, "failed recovery keeps the chest retryable");
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-gear-returned"), undefined);
  assert.equal(emitted.filter(({ name }) => name === "dt2:sucellus-prison-return-stash").length, 1);

  setStashRestored(true);
  handlers.object({ ...chest, handled: false });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 50);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-gear-returned"), true);
  assert.equal(emitted.filter(({ name }) => name === "dt2:sucellus-prison-return-stash").length, 2);
  handlers.object({ ...chest, handled: false });
  assert.equal(emitted.filter(({ name }) => name === "dt2:sucellus-prison-return-stash").length, 2, "reopen does not duplicate stash recovery");
});

test("the real Enter dialog clears the blocked crevice without the cell's consumed chisel", () => {
  const { handlers, prompts, player, openedObjects, area, instanceLocation } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 30);
  const crevice = { getPrivateArea: () => area };
  area.templateObjects = [crevice];
  const event = { player, object: crevice, definition: { id: 49106 }, option: "Enter", location: instanceLocation(2965, 6427, 2), handled: false };
  handlers.object(event);
  assert.equal(event.handled, true);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 30, "the player confirms the rubble before it clears");
  prompts[0].pairs[1]();
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-crevice-cleared"), true);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 32);
  assert.deepEqual(openedObjects, [crevice], "the actual private blocked loc is removed so the passage is traversable");
});

test("Ruby key chain requires the seven chest names, converter clue, and translated bed-room route", () => {
  const { handlers, prompts, player, inventory, instanceLocation, moveToSource } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 32);
  player.setAttribute("desert-treasure-ii:sucellus-prison-crevice-cleared", true);
  moveToSource(2960, 6416);
  handlers.custom["dt2:sucellus-prison-process"]({ player, area: player.getPrivateArea(), cycle: 100 });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 34);

  const locations = [[2959, 6414], [2959, 6419], [2962, 6414], [2962, 6419], [2965, 6414], [2965, 6419], [2968, 6419]];
  for (const [index, [x, y]] of locations.entries()) {
    const event = { player, definition: { id: 49152, name: "Chest" }, option: "Open", location: instanceLocation(x, y, 2), handled: false };
    handlers.object(event);
    assert.equal(event.handled, true, `marked chest ${index + 1} is searched`);
  }
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-ruby-chests"), 127);

  handlers.object({ player, definition: { id: 46688, name: "Crate" }, option: "Search", location: instanceLocation(2967, 6415, 2), handled: false });
  assert.equal(inventory.getAmount(28425), 1);
  assert.equal(inventory.getAmount(28426), 1);
  const converterAction = handlers.item.find(([name]) => name === "Code converter")[1].Read;
  converterAction({ player, itemId: 28425, handled: false });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-clues-read") & 4, 4);

  handlers.object({ player, definition: { id: 49113, name: "Chest" }, option: "Open", location: instanceLocation(2968, 6414, 2), handled: false });
  for (const letter of "URLDRU") {
    const prompt = prompts.at(-1);
    const option = prompt.pairs.findIndex((value, i) => i % 2 === 0 && value === letter);
    assert.notEqual(option, -1);
    prompt.pairs[option + 1]();
  }
  assert.equal(inventory.getAmount(28418), 1);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 36);
});

test("Emerald and Diamond clues gate their real cache chests", () => {
  const { handlers, prompts, player, inventory, instanceLocation } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 28);
  handlers.object({ player, definition: { id: 49151, name: "Crate" }, option: "Search", location: instanceLocation(2912, 6450, 2), handled: false });
  assert.equal(inventory.getAmount(28423), 1);
  assert.equal(inventory.getAmount(28424), 1);
  for (const [name, itemId] of [["Requisition note", 28423], ["Grid note", 28424]]) {
    handlers.item.find(([registered]) => registered === name)[1].Read({ player, itemId, handled: false });
  }
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-clues-read") & 18, 18);
  handlers.object({ player, definition: { id: 49112, name: "Chest" }, option: "Open", location: instanceLocation(2902, 6445, 2), handled: false });
  enterAnswer(prompts, "LIES");
  assert.equal(inventory.getAmount(28417), 1);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 30);

  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 36);
  inventory.adds(28418, 1);
  const rubyGate = { getPrivateArea: () => player.getPrivateArea() };
  handlers.object({ player, object: rubyGate, definition: { id: 49126 }, option: "Open", location: instanceLocation(2968, 6384, 2), handled: false });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 38);

  handlers.object({ player, definition: { id: 49160, name: "Bed" }, option: "Search", location: instanceLocation(2889, 6373, 2), handled: false });
  assert.equal(inventory.getAmount(28428), 1);
  assert.equal(inventory.getAmount(28427), 1);
  handlers.item.find(([registered]) => registered === "Library note")[1].Read({ player, itemId: 28428, handled: false });
  handlers.item.find(([registered]) => registered === "Strange slider")[1].Inspect({ player, itemId: 28427, handled: false });
  for (const [x, y] of [[2931, 6430], [2931, 6432], [2932, 6430]]) {
    handlers.object({ player, definition: { id: 49161, name: "Bookcase" }, option: "Search", location: instanceLocation(x, y, 2), handled: false });
  }
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-library-books"), 7);
  handlers.object({ player, definition: { id: 49114, name: "Chest" }, option: "Open", location: instanceLocation(2890, 6375, 2), handled: false });
  enterAnswer(prompts, "WRATH");
  assert.equal(inventory.getAmount(28419), 1);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 40);
});
