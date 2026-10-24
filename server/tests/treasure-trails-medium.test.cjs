const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
CachePipeline.initialize();
const { PluginManager } = require("../dist/plugins/PluginManager");
const core = PluginManager.getCoreApi();
const plugin = require("../plugins/treasuretrails/TreasureTrails.plugin");
const Runtime = require("../plugins/treasuretrails/trails/Runtime.TreasureTrails");
const Dialogue = require("../plugins/treasuretrails/trails/Dialogue.TreasureTrails");
const Caskets = require("../plugins/treasuretrails/trails/Caskets.TreasureTrails");
const Stash = require("../plugins/treasuretrails/trails/Stash.TreasureTrails");
const Catalogue = require("../plugins/treasuretrails/trails/Catalogue.TreasureTrails");
const { byName } = require("../plugins/treasuretrails/trails/Tiers.TreasureTrails");
const TRANSCRIPTS = require("../data/definitions/npc-dialogues.json");
const MEDIUM = byName.get("medium");
const I = core.ItemIdentifiers;
const C = core.CacheDefinitions;

// Every line Dialogue.play shows, so tests can check the transcript words used.
const played = [];
const play = Dialogue.play;
Dialogue.play = (player, npcId, spoken, onEnd) => { played.push(...spoken); return play(player, npcId, spoken, onEnd); };

function fixture() {
  const actions = new Map(), events = new Map(), attributes = new Map(), sent = [], ground = [], spawned = [];
  let position = new core.Location(3222, 3218, 0), chain, amountAction, placed = 0;
  const items = Array(28).fill(null), worn = [];
  const inventory = {
    getItems: () => items, refreshItems() {}, setItem(slot, item) { items[slot] = item; return inventory; },
    getFreeSlots: () => items.filter(i => !i).length, isFull() { return this.getFreeSlots() === 0; },
    delete(id, amount) { while (amount > 0) { const slot = items.findIndex(i => i?.getId() === id); if (slot < 0) return; const take = Math.min(amount, items[slot].getAmount()); this.deleteAtSlot(slot, take); amount -= take; } },
    deleteAtSlot(slot, amount) { const item = items[slot]; if (!item) return; if (item.getAmount() <= amount) items[slot] = null; else item.setAmount(item.getAmount() - amount); },
    adds(id, amount) { this.forceAdd(null, new core.Item(id, amount)); },
    forceAdd(player, item) { const slot = items.findIndex(i => !i); if (slot < 0) ground.push(item); else items[slot] = item; },
  };
  const sender = new Proxy({}, { get: (_, name) => (...args) => sent.push([name, ...args]) });
  const skills = { level: 1, xp: 0, getCurrentLevel() { return this.level; }, addExperiences(skill, xp) { this.xp += xp; } };
  const player = { getInventory: () => inventory, getSkillManager: () => skills, getEquipment: () => ({ getItems: () => worn }),
    getPacketSender: () => sender, getLocation: () => position, getPrivateArea: () => null,
    getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    sendMessage: message => sent.push(["message", message]), performAnimation: value => sent.push(["animation", value]),
    setEnteredAmountAction: action => { amountAction = action; },
    getDialogueManager: () => ({ startDialogues: value => { chain = value; } }) };
  const api = { core, persistAttribute() {}, onItemAction: (name, handlers) => actions.set(name, { ...actions.get(name), ...handlers }),
    onBeforeNpcInteraction() {}, onBeforeObjectInteraction() {}, onCanUseItem() {},
    onCustomEvent: (name, fn) => { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); },
    emitCustomEvent: (name, request) => { for (const fn of events.get(name) ?? []) fn(request); },
    onPlayerLogout() {}, onPlayerDisconnect() {}, onPlayerLogin() {},
    spawnNpc: def => { const npc = { getLocation: () => new core.Location(def.x, def.y, def.z), def }; spawned.push(npc); return npc; },
    removeNpc: npc => { npc.removed = true; }, getRegionManager: () => ({ blocked: () => false, canMovestart: () => true }) };
  plugin.register(api);
  api.onCustomEvent("treasure-trails:milestone-rewards", request => { request.handled = true; });
  // NpcDialogues' answer to "npc-dialogue:start", read straight from the imported transcripts.
  api.onCustomEvent("npc-dialogue:start", request => {
    const steps = TRANSCRIPTS[C.getNpc(request.npcId)?.name]?.variants?.[request.variant];
    if (steps?.length && request.select) request.select(steps);
  });
  function place(step, length = 3, slot = 0, completed = 0) {
    items[slot] = new core.Item(step.itemId, 1).setMetaValue(Runtime.metaKey(MEDIUM),
      { version: 1, token: `t${slot}-${++placed}`, revision: 0, completed, length, row: step.row });
    position = new core.Location(step.location.x, step.location.y, step.location.z);
  }
  const talk = (npcId, npc = { getLocation: () => position }) => {
    const event = { player, npcId, npc, clickType: 1, handled: false, definition: { getActions: () => ["Talk-to"] } };
    Runtime.talk(event);
    return event;
  };
  return { player, items, worn, skills, attributes, actions, sent, ground, spawned, place, talk, on: api.onCustomEvent, emit: api.emitCustomEvent,
    event: (slot = 0) => ({ player, slot, item: items[slot], itemId: items[slot]?.getId() }),
    move: target => { position = new core.Location(target.x, target.y, target.z); },
    answer: value => amountAction.execute(value),
    state: () => items[0]?.getMetaValue(Runtime.metaKey(MEDIUM)),
    finish: () => { const current = chain; chain = null; for (const d of current?.getDialogues().values() ?? []) if (d instanceof core.ActionDialogue) d.send(player); },
  };
}

const steps = () => Runtime.data(MEDIUM).steps;
const ofKind = (family, target) => steps().filter(step => step.family === family && (!target || step.target === target));

test("every medium step is a distinct cache clue item with a solvable target", () => {
  fixture();
  const data = Runtime.data(MEDIUM);
  assert.equal(data.steps.length, 167);
  for (const [family, target, count] of [["anagram", "npc", 47], ["cipher", "npc", 6], ["coordinate", "coord", 44], ["cryptic", "npc", 8],
    ["cryptic", "loc", 8], ["cryptic", "key", 11], ["emote", "coord", 25], ["map", "coord", 10], ["map", "loc", 2], ["music", "npc", 6]])
    assert.equal(ofKind(family, target).length, count, `${family}/${target}`);
  for (const step of data.steps) {
    assert.equal(core.ItemDefinition.forId(step.itemId).getName(), "Clue scroll (medium)", step.key);
    if (step.target === "npc") assert.ok(step.npcIds.length, step.key);
    if (step.target === "key") assert.ok(step.keyItem > 0 && step.npcIds.length && step.locIds.length, step.key);
    if (step.family === "map") assert.ok(step.interfaceId != null, `${step.key} has no map interface`);
    if (step.family === "emote") assert.ok(step.emotes.length === 2 && step.stash && step.equipment.every(r => r.anyOf?.length || Number.isInteger(r.group) || Number.isInteger(r.emptySlot)), step.key);
    if (step.family === "coordinate") assert.match(step.text, /^\d+ degrees \d+ minutes (north|south)<br>\d+ degrees \d+ minutes (east|west)$/, step.key);
  }
  const challenged = data.steps.filter(step => step.challenge);
  assert.equal(challenged.length, 44);
  for (const step of challenged) {
    assert.equal(core.ItemDefinition.forId(step.challenge.itemId).getName(), "Challenge scroll (medium)", step.key);
    assert.ok(step.challenge.question && Number.isInteger(step.challenge.answer), step.key);
    assert.equal(data.byItem.get(step.challenge.itemId), step);
  }
  assert.equal(Catalogue.coordinateText("00.05S 01.13E"), "00 degrees 05 minutes south<br>01 degrees 13 minutes east");
});

test("every challenge NPC hands over its scroll, then takes only the cache's answer", () => {
  const f = fixture();
  for (const step of steps().filter(entry => entry.challenge)) {
    f.items.fill(null); f.sent.length = 0;
    f.place(step);
    assert.equal(f.talk(step.npcIds[0]).handled, true, step.key);
    f.finish();
    assert.equal(f.items[0].getId(), step.challenge.itemId, `${step.key} hands over the challenge scroll`);
    f.actions.get("Challenge scroll (medium)").Read(f.event());
    assert.ok(f.sent.some(([name, text]) => name === "sendString" && text === step.challenge.question), step.key);
    f.talk(step.npcIds[0]);
    f.finish();
    assert.ok(f.sent.some(([name]) => name === "sendEnterAmountPrompt"), step.key);
    f.answer(step.challenge.answer + 1);
    f.finish();
    assert.equal(f.items[0].getId(), step.challenge.itemId, `${step.key} keeps the scroll after a wrong answer`);
    f.talk(step.npcIds[0]);
    f.finish();
    f.answer(step.challenge.answer);
    f.finish();
    assert.equal(f.state().completed, 1, step.key);
    assert.notEqual(f.items[0].getId(), step.challenge.itemId);
  }
});

test("challenge NPCs speak their own transcript where it has the words", () => {
  const f = fixture();
  const baraek = steps().find(step => step.challenge?.key === "cluehelper_challenge_question_baraek");
  f.place(baraek);
  played.length = 0;
  f.talk(baraek.npcIds[0]); f.finish();
  assert.deepEqual(played[0], { npc: "I must ask you something..." });
  assert.ok(f.sent.some(([name, text]) => name === "message" && text === "Baraek has given you a challenge scroll!"));
  f.talk(baraek.npcIds[0]); f.finish(); f.answer(1); f.finish();
  assert.ok(played.some(line => line.npc === "Wrong! Try again."));
  f.talk(baraek.npcIds[0]); f.finish(); f.answer(baraek.challenge.answer); f.finish();
  assert.ok(played.some(line => line.npc === "Correct."));
  assert.ok(f.sent.some(([name, text]) => name === "message" && text === "Baraek has given you another clue scroll!"));
});

test("an NPC with no transcript lines hands over its challenge scroll at once", () => {
  const f = fixture();
  const otto = steps().find(step => step.challenge && C.getNpc(step.npcIds[0])?.name === "Otto Godblessed");
  f.place(otto);
  played.length = 0;
  f.talk(otto.npcIds[0]);
  assert.deepEqual(played, []);
  assert.equal(f.items[0].getId(), otto.challenge.itemId, "no dialogue is left holding the hand-over");
  assert.ok(f.sent.some(([name, text]) => name === "message" && text === "Otto Godblessed has given you a challenge scroll!"));
});

test("plain anagram, cipher and cryptic NPCs complete after their dialogue", () => {
  const f = fixture();
  for (const step of steps().filter(entry => entry.target === "npc" && !entry.challenge && entry.family !== "music")) {
    f.items.fill(null);
    f.place(step);
    assert.equal(f.talk(step.npcIds[0]).handled, true, step.key);
    f.finish();
    assert.equal(f.state().completed, 1, step.key);
  }
});

test("keyed steps drop their key only during the trail, and the loc opens only with it", () => {
  const f = fixture();
  for (const step of ofKind("cryptic", "key")) {
    f.items.fill(null);
    f.place(step);
    const drops = [];
    f.emit("npc-drops:add", { player: f.player, npcId: step.npcIds[0] + 100000, drops });
    assert.deepEqual(drops, [], `${step.key} other NPCs drop no key`);
    f.emit("npc-drops:add", { player: f.player, npcId: step.npcIds[0], drops });
    assert.deepEqual(drops, [{ itemId: step.keyItem, amount: 1 }], step.key);
    const open = () => { const event = { player: f.player, objectId: step.locIds[0], location: step.location, handled: false }; Runtime.search(event); return event.handled; };
    assert.equal(open(), false, `${step.key} stays locked without the key`);
    f.items[5] = new core.Item(step.keyItem, 1);
    const again = [];
    f.emit("npc-drops:add", { player: f.player, npcId: step.npcIds[0], drops: again });
    assert.deepEqual(again, [], `${step.key} drops no second key`);
    assert.equal(open(), true, step.key);
    assert.equal(f.items[5], null, `${step.key} uses the key up`);
    assert.equal(f.state().completed, 1, step.key);
  }
});

test("crate maps search their crate; coordinate and map digs need the exact tile", () => {
  const f = fixture();
  for (const step of ofKind("map", "loc")) {
    f.items.fill(null); f.place(step);
    const event = { player: f.player, objectId: step.locIds[0], location: step.location, handled: false };
    Runtime.search(event);
    assert.equal(event.handled, true, step.key);
  }
  for (const step of [...ofKind("coordinate"), ...ofKind("map", "coord")]) {
    f.items.fill(null); f.place(step);
    f.items[1] = new core.Item(I.SPADE, 1);
    const dig = () => { const event = { player: f.player, itemId: I.SPADE, option: "Dig", allow: true }; Runtime.dig(event); return event.allow; };
    f.move({ ...step.location, x: step.location.x + 1 });
    assert.equal(dig(), true, step.key);
    f.move(step.location);
    assert.equal(dig(), false, step.key);
    assert.equal(f.state().completed, 1, step.key);
  }
});

test("medium emotes need both emotes in order, the outfit (groups included) and Uri's own words", () => {
  const f = fixture();
  for (const step of ofKind("emote")) {
    f.items.fill(null); f.worn.length = 0; f.spawned.length = 0;
    f.place(step);
    for (const requirement of step.equipment) {
      if (requirement.emptySlot != null) continue;
      const id = requirement.anyOf?.[0] ?? [...C.getObjNames().keys()].find(item => C.getItem(item)?.params?.get?.(Catalogue.TRAIL_ITEM_GROUP_PARAM) === requirement.group);
      assert.ok(id != null, `${step.key} group ${requirement.group} has an item`);
      f.worn.push(new core.Item(id, 1));
    }
    Runtime.emote({ player: f.player, slot: step.emotes[1] });
    assert.equal(f.spawned.length, 0, `${step.key} the second emote alone does nothing`);
    Runtime.emote({ player: f.player, slot: step.emotes[0] });
    assert.equal(f.spawned.length, 1, step.key);
    const uri = f.spawned[0];
    played.length = 0;
    f.talk(uri.def.id, uri); f.finish();
    assert.deepEqual(played, [{ npc: "I do not believe we have any business, Comrade." }], `${step.key} needs the second emote`);
    assert.equal(f.state().completed, 0);
    Runtime.emote({ player: f.player, slot: step.emotes[1] });
    played.length = 0;
    f.talk(uri.def.id, uri); f.finish();
    assert.deepEqual(played.at(-1), { player: "What?" }, step.key);
    assert.equal(f.state().completed, 1, step.key);
    assert.ok(f.sent.some(([name, text]) => name === "message" && text === "You have been given a new clue!"), step.key);
  }
});

test("the imported medium table opens a casket of 3-5 rolls once", () => {
  const f = fixture();
  assert.deepEqual(require("../data/definitions/clue-caskets.json").tables.medium.rolls, [3, 5]);
  f.items[0] = new core.Item(I.REWARD_CASKET_MEDIUM_, 1);
  const event = f.event();
  assert.equal(Caskets.open(event), true);
  assert.equal(f.attributes.get(Runtime.completedAttribute(MEDIUM)), 1);
  assert.equal(Caskets.open(event), false);
});

test("a medium STASH unit needs Construction 42 and oak planks", () => {
  const f = fixture();
  const units = [...Stash.stashes().values()].filter(unit => unit.tier === MEDIUM);
  assert.equal(units.length, 25);
  const unit = units[0];
  const use = () => { const event = { player: f.player, objectId: unit.step.stash.locId, location: unit.location, handled: false }; Stash.interact(event); };
  [[I.HAMMER, 1], [I.SAW, 1], [I.PLANK, 2], [I.STEEL_NAILS, 10]].forEach(([id, amount], slot) => { f.items[slot] = new core.Item(id, amount); });
  f.skills.level = 42;
  use();
  assert.equal(f.attributes.get(Stash.BUILT_ATTRIBUTE), undefined, "regular planks do not build a medium unit");
  f.items[2] = new core.Item(I.OAK_PLANK, 2);
  f.skills.level = 41;
  use();
  assert.equal(f.attributes.get(Stash.BUILT_ATTRIBUTE), undefined);
  f.skills.level = 42;
  use();
  assert.deepEqual(f.attributes.get(Stash.BUILT_ATTRIBUTE), [unit.step.stash.locId]);
  assert.equal(f.skills.xp, 250);
});

test("\"no boots\" means nothing may be worn in that slot", () => {
  const f = fixture();
  const step = steps().find(entry => entry.key === "cluehelper_emote_medium_17");
  const feet = step.equipment.find(requirement => requirement.emptySlot != null);
  assert.equal(feet.emptySlot, core.Equipment.FEET_SLOT);
  f.place(step);
  f.worn.push(...step.equipment.filter(requirement => requirement.anyOf).map(requirement => new core.Item(requirement.anyOf[0], 1)));
  assert.equal(Runtime.emoteReady(f.player, step), true);
  f.worn.push(new core.Item(I.LEATHER_BOOTS, 1));
  assert.equal(Runtime.emoteReady(f.player, step), false);
});

test("answer variants and branches are found under the transcripts' other names", () => {
  const f = fixture();
  const ali = steps().find(step => step.key === "cluehelper_cipher_medium_0");
  f.place(ali);
  played.length = 0;
  f.talk(ali.npcIds[0]); f.finish();
  assert.ok(played.some(line => line.npc === "I need you to answer this for me."));
  f.talk(ali.npcIds[0]); f.finish();
  assert.ok(played.some(line => line.npc === "Please give me your answer!"));
  f.answer(1); f.finish();
  assert.ok(played.some(line => line.npc === "Nope, not correct!"));
  f.talk(ali.npcIds[0]); f.finish(); f.answer(ali.challenge.answer); f.finish();
  assert.ok(played.some(line => line.npc === "Spot on!"));
  assert.ok(f.sent.some(([name, text]) => name === "message" && text === "Ali the Kebab seller has given you another clue scroll!"));
});
