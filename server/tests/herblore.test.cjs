// Run after `yarn build`: node --test tests/herblore.test.cjs
const assert = require("node:assert/strict");
const path = require("path");
const { test, before, beforeEach } = require("node:test");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { PluginManager } = require("../dist/plugins/PluginManager");
const DATA = require("../plugins/skills/data/herblore.json");
const Herblore = require("../plugins/skills/Herblore.plugin");

let core;
const hooks = { firstAction: [], itemOnItem: [], customEvents: new Map() };
const world = { quests: new Map(), cape: false };

const api = new Proxy({
  onItemFirstAction(handler) { hooks.firstAction.push(handler); },
  onItemOnItem(handler) { hooks.itemOnItem.push(handler); },
  onCustomEvent(name, handler) { hooks.customEvents.set(name, handler); },
  emitCustomEvent(name, request) {
    if (name === "quest:is-complete") request.complete = world.quests.get(request.key) ?? true;
    if (name === "quest:is-started") request.started = world.quests.get(`${request.key}:started`) ?? true;
    if (name === "skillcape:has-perk") request.result = world.cape;
  },
}, { get: (target, key) => (key === "core" ? core : key in target ? target[key] : () => {}) });

before(async () => {
  const { CachePipeline } = require("../dist/game/cache/CachePipeline");
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  core = PluginManager.getCoreApi();
  Herblore.register(api);
});

beforeEach(() => {
  world.quests.clear();
  world.cape = false;
});

const obj = (name) => core.CacheDefinitions.getObjId(name);

function inventory(contents) {
  const slots = Array(28).fill(null);
  contents.forEach(([name, amount = 1], index) => { slots[index] = new core.Item(obj(name), amount); });
  const self = {
    getItems: () => slots.map((item) => item ?? new core.Item(-1, 0)),
    getAmount: (id) => slots.filter((item) => item?.getId() === id).reduce((sum, item) => sum + item.getAmount(), 0),
    setItem(slot, item) { slots[slot] = item; return self; },
    refreshItems() { return self; },
    addItem(item) {
      const stack = core.ItemDefinition.forId(item.getId()).isStackable();
      const existing = stack && slots.find((slot) => slot?.getId() === item.getId());
      if (existing) existing.setAmount(existing.getAmount() + item.getAmount());
      else for (let n = 0; n < (stack ? 1 : item.getAmount()); n++) slots[slots.indexOf(null)] = new core.Item(item.getId(), stack ? item.getAmount() : 1);
      return self;
    },
    deleteNumber(id, amount) {
      for (let slot = 0; slot < slots.length && amount > 0; slot++) {
        const item = slots[slot];
        if (item?.getId() !== id) continue;
        const taken = Math.min(amount, item.getAmount());
        amount -= taken;
        if (item.getAmount() === taken) slots[slot] = null; else item.setAmount(item.getAmount() - taken);
      }
      return self;
    },
    count: (name) => self.getAmount(obj(name)),
  };
  return self;
}

function player(contents, level = 99) {
  const sent = { messages: [], spam: [], sounds: [], animations: [], xp: 0 };
  const inv = inventory(contents);
  const sender = new Proxy({
    sendTypedMessage(type, text) { sent.spam.push(text); return sender; },
    sendSound(id) { sent.sounds.push(id); return sender; },
  }, { get: (target, key) => key in target ? target[key] : () => sender });
  return {
    sent, inv,
    getInventory: () => inv,
    getPacketSender: () => sender,
    getSkillManager: () => ({
      getCurrentLevel: () => level,
      addExperiences(skill, xp) { assert.equal(skill, core.Skill.HERBLORE); sent.xp += xp; },
    }),
    sendMessage(text) { sent.messages.push(text); },
    performAnimation(animation) { sent.animations.push(animation.getId()); },
    getIndex: () => 1, isRegistered: () => true, getHitpoints: () => 99,
  };
}

function click(who, name) {
  const itemId = obj(name);
  const slot = who.inv.getItems().findIndex((item) => item.getId() === itemId);
  const event = { player: who, itemId, slot, clickType: 1 };
  return hooks.firstAction.some((handler) => handler(event) !== false);
}

function use(who, used, usedWith) {
  const event = { player: who, usedItemId: obj(used), usedWithItemId: obj(usedWith), handled: false };
  for (const handler of hooks.itemOnItem) handler(event);
  return event.handled;
}

test("every herb and recipe names a cache item", () => {
  for (const herb of DATA.herbs) for (const name of [herb.grimy, herb.clean]) assert.ok(Number.isInteger(obj(name)), name);
  for (const recipe of DATA.recipes) {
    for (const name of [recipe.product, ...recipe.ingredients.map(([n]) => n), ...(recipe.returns ?? []).map(([n]) => n)]) {
      assert.ok(Number.isInteger(obj(name)), `${recipe.product}: ${name}`);
    }
  }
});

/** Herblore in table 213's skill column, which numbers skills as the skill guide does. */
const SKILL_GUIDE_HERBLORE = 9;

test("levels agree with the cache's Herblore skill guide (table 213)", () => {
  const { CacheDefinitions } = core;
  const text = CacheDefinitions.getDbColumn(213, "text");
  const skill = CacheDefinitions.getDbColumn(213, "skill");
  const name = (gameval) => CacheDefinitions.getItem(obj(gameval)).name.replace(/ ?\(\d\)$/, "").replace(/ \(unf\)$/, "").toLowerCase();
  const potions = new Map(DATA.recipes.map((recipe) => [name(recipe.product), recipe.level]));
  const herbs = new Map(DATA.herbs.map((herb) => [name(herb.clean), herb.level]));
  let compared = 0;
  for (const row of CacheDefinitions.getDbTableRows(213)) {
    const [skillId, level, subsection] = row.columns.get(skill) ?? [];
    if (Number(skillId) !== SKILL_GUIDE_HERBLORE || ![1, 2].includes(Number(subsection))) continue;
    const label = String(row.columns.get(text)?.[0] ?? "").split("<br>")[0].toLowerCase();
    const ours = (Number(subsection) === 2 ? herbs : potions).get(label);
    if (ours === undefined) continue;
    assert.equal(ours, Number(level), label);
    compared++;
  }
  assert.ok(compared >= 25, `only ${compared} skill guide rows matched`);
});

test("cleaning swaps the herb in its slot with the captured message, a cleaning sound and XP", () => {
  const who = player([["unidentified_ranarr"], ["unidentified_ranarr"]]);
  assert.equal(click(who, "unidentified_ranarr"), true);
  assert.equal(click(who, "unidentified_ranarr"), true, "a second clean in the same tick");
  assert.equal(who.inv.count("ranarr_weed"), 2);
  assert.equal(who.inv.getItems()[0].getId(), obj("ranarr_weed"));
  assert.deepEqual(who.sent.spam, ["You clean the Grimy ranarr weed.", "You clean the Grimy ranarr weed."]);
  assert.ok(who.sent.sounds.every((id) => id >= 3920 && id <= 3923));
  assert.equal(who.sent.xp, 15);
});

test("cleaning below the level names the herb and the level", () => {
  const who = player([["unidentified_torstol"]], 74);
  click(who, "unidentified_torstol");
  assert.deepEqual(who.sent.messages, ["You need level 75 Herblore to clean the Grimy torstol."]);
  assert.equal(who.inv.count("unidentified_torstol"), 1);
});

test("Herblore needs Druidic Ritual", () => {
  world.quests.set("druidic_ritual", false);
  const who = player([["unidentified_guam"], ["guam_leaf"], ["vial_water"]]);
  click(who, "unidentified_guam");
  assert.equal(use(who, "guam_leaf", "vial_water"), true);
  assert.equal(who.inv.count("unidentified_guam"), 1);
  assert.equal(who.inv.count("guamvial"), 0);
  assert.deepEqual(who.sent.messages, Array(2).fill("You must complete the Druidic Ritual quest to unlock the Herblore skill."));
});

test("a herb in a vial of water makes the unfinished potion, with no XP", () => {
  const who = player([["ranarr_weed"], ["vial_water"]]);
  assert.equal(use(who, "vial_water", "ranarr_weed"), true);
  assert.equal(who.inv.count("ranarrvial"), 1);
  assert.equal(who.sent.xp, 0);
  assert.deepEqual(who.sent.spam, ["You put the Ranarr Weed into the vial of water."]);
  assert.deepEqual(who.sent.sounds, [2608]);
  assert.deepEqual(who.sent.animations, [core.CacheDefinitions.getSeqId("human_herbing_vial")]);
});

test("a secondary finishes the potion at the Wiki's level and XP", () => {
  const low = player([["guamvial"], ["eye_of_newt"]], 2);
  use(low, "eye_of_newt", "guamvial");
  assert.deepEqual(low.sent.messages, ["You need a Herblore level of 3 to combine those."]);
  const who = player([["ranarrvial"], ["snape_grass"]], 38);
  use(who, "snape_grass", "ranarrvial");
  assert.equal(who.inv.count("3doseprayerrestore"), 1);
  assert.equal(who.sent.xp, 87.5);
  assert.deepEqual(who.sent.spam, ["You mix the snape grass into your potion."]);
});

test("items that make nothing are left to other plugins", () => {
  const who = player([["snape_grass"], ["vial_water"]]);
  assert.equal(use(who, "snape_grass", "vial_water"), false);
});

test("the Herblore cape puts a grimy herb straight into the vial", () => {
  world.cape = true;
  const who = player([["unidentified_marentill"], ["vial_water"]]);
  use(who, "unidentified_marentill", "vial_water");
  assert.equal(who.inv.count("marrentillvial"), 1);
  assert.deepEqual(who.sent.spam, ["You clean the Grimy marrentill.", "You put the Marrentill into the vial of water."]);
  assert.equal(who.sent.xp, 3.8);
  world.cape = false;
  const without = player([["unidentified_marentill"], ["vial_water"]]);
  assert.equal(use(without, "unidentified_marentill", "vial_water"), false);
});

test("herblore:unfinished answers Zahur with the herb's unfinished potion", () => {
  const request = { herbId: obj("toadflax"), potion: null };
  hooks.customEvents.get("herblore:unfinished")(request);
  assert.equal(request.potion, obj("toadflaxvial"));
});
