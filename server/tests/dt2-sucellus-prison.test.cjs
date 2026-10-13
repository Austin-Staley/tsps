const test = require("node:test");
const assert = require("node:assert/strict");

const register = require("../plugins/quests/dt2/Prison.DesertTreasureII");
require("../plugins/quests/QuestRuntime").startTranscript = () => true;

function setup() {
  const handlers = { custom: {}, npc: [], object: null, itemObject: null, item: [], dialogueAction: null };
  const emitted = [];
  const prompts = [];
  const createdNpcs = [];
  let cycle = 100;
  const npc = (id, location) => ({
    id, location, maxHitpoints: 1500, hitpoints: 1500,
    isRegistered: () => true,
    setOwner() {}, setOwnerOnly() {}, setCombatFollowing(target) { this.target = target; },
    setMaxHitpoints(value) { this.maxHitpoints = value; return this; },
    setHitpoints(value) { this.hitpoints = value; return this; },
  });
  const area = {
    entities: [],
    tile: (x, y, z) => ({ x: 10000 + x, y: 20000 + y, z }),
    getBaseX: () => 10000,
    getBaseY: () => 20000,
    add(value) { this.entities.push(value); },
    remove(value) { this.entities = this.entities.filter((entry) => entry !== value); },
  };
  const inventory = {
    contents: new Map(),
    getAmount(id) { return this.contents.get(id) ?? 0; },
    adds(id, amount) { this.contents.set(id, this.getAmount(id) + amount); return this; },
  };
  const player = {
    attrs: new Map([["desert-treasure-ii:sucellus-cell-escaped", true]]),
    getAttribute(key) { return this.attrs.get(key); },
    setAttribute(key, value) { this.attrs.set(key, value); },
    getInventory: () => inventory,
    getPrivateArea: () => area,
    getLocation: () => ({ getX: () => 10000, getY: () => 20000, getZ: () => 2 }),
    sendMessage() {},
  };
  const api = {
    core: {
      ItemIdentifiers: { PRISONERS_LETTER: 28412, KNIFE_5: 28413, CHISEL_5: 28414, LOCKPICK_4: 28415,
        SAPPHIRE_KEY_3: 28416, EMERALD_KEY_3: 28417, RUBY_KEY_3: 28418, DIAMOND_KEY: 28419, WARNING_LETTER: 28429 },
      NpcIdentifiers: { ASSASSIN_7: 12348, ASSASSIN_8: 12349, JHALLAN_3: 12353, JHALLAN_4: 12354, JHALLAN_5: 12355 },
      NPC: { create(id, location) { const value = npc(id, location); createdNpcs.push(value); return value; } },
      World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [], getProcessCycle: () => cycle },
    },
    persistAttribute() {},
    onCustomEvent(name, handler) { handlers.custom[name] = handler; },
    emitCustomEvent(name, payload) { emitted.push({ name, payload }); },
    onNpcInteraction(...args) { handlers.npc.push(args); },
    onObjectInteraction(handler) { handlers.object = handler; },
    onItemOnObject(handler) { handlers.itemObject = handler; },
    onItemAction(...args) { handlers.item.push(args); },
    sendMultiChatboxPrompt(_player, title, ...pairs) { prompts.push({ title, pairs }); return true; },
  };
  player.setAttribute("desert-treasure-ii:sucellus-area", area);
  register(api);
  return { api, handlers, emitted, prompts, player, area, inventory, createdNpcs, setCycle: (v) => { cycle = v; } };
}

test("Sucellus prison gates require the lockpick and sapphire key is earned through each tumbler", () => {
  const { handlers, emitted, prompts, player, area, inventory } = setup();
  const state = () => player.getAttribute("desert-treasure-ii:sucellus-prison-progress");
  handlers.custom["dt2:sucellus-prison:start"]({ player, area });
  assert.equal(state(), 22);

  handlers.object({ player, objectId: 49120, option: "Open", location: { x: 2945, y: 6389, z: 2 }, handled: false });
  assert.equal(state(), 22, "a missing lockpick cannot open the gate");
  inventory.adds(28415, 1);
  handlers.object({ player, objectId: 49120, option: "Open", location: { x: 2945, y: 6389, z: 2 }, handled: false });
  assert.equal(state(), 24);

  handlers.object({ player, objectId: 50000, option: "Open", location: { x: 2980, y: 6346, z: 2 }, handled: false });
  assert.equal(prompts.length, 1);
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
  assert.ok(emitted.some(({ name }) => name === "dt2:sucellus-prison:journal"));
});

test("Jhallan defense lasts three minutes (300 area ticks) and asylum transcript owns completion", () => {
  const { handlers, emitted, prompts, player, area, createdNpcs, setCycle } = setup();
  player.setAttribute("desert-treasure-ii:sucellus-prison-progress", 52);
  handlers.custom["dt2:sucellus-prison:start"]({ player, area });
  handlers.object({ player, objectId: 50000, option: "Search", location: { x: 2972, y: 6367, z: 2 }, handled: false });
  prompts[0].pairs[1]();
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 54);
  const liveJhallan = createdNpcs.find((value) => value.id === 12353);
  assert.ok(liveJhallan, "the cache-backed combat variant must attack the player");
  assert.equal(liveJhallan.target, player, "Jhallan must enter normal NPC combat");

  setCycle(250);
  handlers.custom["dt2:sucellus-prison:process"]({ player, area, cycle: 250 });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 54);
  assert.deepEqual(createdNpcs.filter((value) => value.id === 12354).map((value) => [value.id, value.hitpoints]), [[12354, 1], [12354, 1]]);

  setCycle(399);
  handlers.custom["dt2:sucellus-prison:process"]({ player, area, cycle: 399 });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 54);
  assert.equal(emitted.filter(({ name }) => name === "dt2:sucellus-prison:complete").length, 0);

  handlers.custom["dt2:sucellus-prison:process"]({ player, area, cycle: 400 });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 56);
  handlers.custom["npc-dialogue:action"]({ player, stepId: "IME-83" });
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-progress"), 58);
  assert.equal(player.getAttribute("desert-treasure-ii:sucellus-prison-complete"), true);
  assert.equal(emitted.filter(({ name }) => name === "dt2:sucellus-prison:complete").length, 1);
});
