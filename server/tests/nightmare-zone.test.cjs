// Run after `yarn build`: node --test tests/nightmare-zone.test.cjs
//
// Nightmare Zone against the rsprox recordings (234/03279: Dominic, the dream menus, the coffer,
// the barrels; 224/01512: a Practice dream from the vial to the arena's potion) and the Wiki (the
// bosses, points, a death in a dream).
const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const { TaskManager } = require('../dist/game/task/TaskManager');
const { Location } = require('../dist/game/model/Location');

let Common, Dominic, Coffer, Dream, hooks, core;

/** Name hooks run in turn until one takes the click, as the plugin manager does. */
function chain(map, key, fn) {
  const prior = map.get(key);
  map.set(key, prior ? (event) => prior(event) || fn(event) : fn);
}

before(() => {
  CachePipeline.initialize();
  RegionManager.init();
  new NpcDefinitionLoader().load();
  core = PluginManager.getCoreApi();
  hooks = { objects: new Map(), npcs: new Map(), events: {}, death: [], drops: [], npcDeath: [] };
  const api = {
    core,
    persistAttribute() {},
    onObjectInteraction: (name, actions) => { for (const [op, fn] of Object.entries(actions)) chain(hooks.objects, `${name}:${op}`, fn); },
    onNpcInteraction: (name, actions) => { for (const [op, fn] of Object.entries(actions)) chain(hooks.npcs, `${name}:${op}`, fn); },
    onNpcDeath: (fn) => hooks.npcDeath.push(fn),
    onPlayerDeath: (fn) => hooks.death.push(fn),
    onShouldDropItemsOnDeath: (fn) => hooks.drops.push(fn),
    onPlayerLogin() {},
    onPlayerLogout() {},
    onInterfaceActionClick: (fn) => { hooks.click = fn; },
    onCustomEvent: (name, fn) => { const prior = hooks.events[name]; hooks.events[name] = prior ? (e) => { prior(e); fn(e); } : fn; },
    emitCustomEvent: (name, payload) => {
      if (name === 'quest:is-complete') payload.complete = payload.player.quests?.has(payload.key) ?? false;
      else hooks.events[name]?.(payload);
    },
    registerArea: (area) => { hooks.enclosure = area; },
  };
  require('../plugins/minigames/NightmareZone.plugin').register(api);
  Common = require('../plugins/minigames/nightmarezone/Common.NightmareZone');
  Dominic = require('../plugins/minigames/nightmarezone/Dominic.NightmareZone');
  Coffer = require('../plugins/minigames/nightmarezone/Coffer.NightmareZone');
  Dream = require('../plugins/minigames/nightmarezone/Dream.NightmareZone');
  Dream.engine.attack = (npc, player) => { npc.target = player; };
  Dream.engine.free = () => true;
});

beforeEach(() => {
  for (const player of [...Dream.dreams.keys()]) Dream.wake({ player });
  ticks(2);
});

function container(capacity = 28) {
  const slots = [];
  return {
    slots,
    add(item) { const slot = slots.find((s) => s.id === item.getId()); if (slot) slot.amount += item.getAmount(); else slots.push({ id: item.getId(), amount: item.getAmount() }); },
    delete(id, amount = 1) { for (const s of slots) { if (s.id !== id || amount <= 0) continue; const n = Math.min(s.amount, amount); s.amount -= n; amount -= n; } },
    getAmount: (id) => slots.filter((s) => s.id === id).reduce((sum, s) => sum + s.amount, 0),
    getFreeSlots: () => capacity - slots.filter((s) => s.amount > 0).length,
    refreshItems() {},
  };
}

const QUESTS = () => Common.data.bosses.map((boss) => boss.quest);

function fakePlayer({ quests = QUESTS().slice(0, 12), coins = 0 } = {}) {
  const attributes = new Map();
  const p = {
    location: new Location(2608, 3116, 0), messages: [], varbits: new Map(), varps: new Map(), texts: new Map(), pages: [],
    quests: new Set(quests), inventory: container(),
    isPlayer: () => true, getAsPlayer: () => p, isRegistered: () => true, getUsername: () => 'Dreamer',
    getLocation: () => p.location, moveTo(l) { p.location = l; }, setLocation(l) { p.location = l; }, getArea: () => p.area, setArea(a) { p.area = a; },
    getPrivateArea: () => null, getIndex: () => 1,
    getAttribute: (k) => attributes.get(k), setAttribute: (k, v) => attributes.set(k, v),
    getInventory: () => p.inventory,
    sendMessage: (m) => p.messages.push(m),
    setEnteredAmountAction(action) { p.amount = action; },
    getDialogueManager: () => (p.dialogue ??= dialogueManager(p)),
    getPacketSender() {
      const sender = {
        sendVarbit: (id, value) => { p.varbits.set(id, value); return sender; },
        sendConfig: (id, value) => { p.varps.set(id, value); return sender; },
        sendString: (text, id) => { p.texts.set(id, text); return sender; },
        sendSubInterface: () => sender, closeSubInterface: () => sender, sendInterfaceScript: () => sender,
        sendInterface: (id) => { p.interface = id; return sender; },
        sendClientScript: (id, ...args) => { p.script = [id, ...args]; return sender; },
        sendInterfaceFlagsRange: () => sender, sendInterfaceRemoval: () => sender, sendSound: () => sender, sendSong: () => sender,
        sendEnterAmountPrompt: (text) => { p.prompt = text; return sender; },
      };
      return sender;
    },
  };
  if (coins) p.inventory.add(new core.Item(995, coins));
  return p;
}

function dialogueManager(p) {
  return {
    entries: null, index: -1,
    startDialogues(builder) { this.entries = builder.getDialogues(); this.startDialogue(0); },
    startDialogue(i) {
      this.index = i;
      const page = this.entries?.get(i);
      if (!page) { this.entries = null; return; }
      if (page.constructor.name === 'ActionDialogue') page.send(p);
      else if (page.constructor.name !== 'OptionDialogue') p.pages.push(page);
    },
    reset() { this.entries = null; this.index = -1; },
    current() { return this.entries?.get(this.index); },
    continueAll() { for (let n = 0; n < 200 && this.entries && this.current()?.constructor.name !== 'OptionDialogue'; n++) this.startDialogue(this.index + 1); },
    options() { return this.current()?.getOptions(); },
    title() { return this.current()?.getTitle(); },
    choose(option) { const menu = this.current(); this.reset(); menu.execute(option); },
  };
}

const pageText = (page) => page.text ?? page.getText?.();
const varbit = (p, name) => p.varbits.get(core.CacheDefinitions.getVarbitId(name));
const DOMINIC = { getId: () => 1120 };

function ticks(count) {
  for (let i = 0; i < count; i++) TaskManager.process();
}

function talk(p) {
  p.pages.length = 0;
  assert.ok(hooks.npcs.get('Dominic Onion:Talk-to')({ player: p, npc: DOMINIC }));
  p.getDialogueManager().continueAll();
}

/** Talk-to, "Can I choose a dream?", then `path` through the menus. */
function chooseDream(p, ...path) {
  talk(p);
  p.getDialogueManager().choose(4);
  p.getDialogueManager().continueAll();
  for (const option of path) {
    p.getDialogueManager().choose(option);
    p.getDialogueManager().continueAll();
  }
}

test('Dominic: the recorded greeting and menu; "Who are you?" and back to the menu', () => {
  const p = fakePlayer();
  talk(p);
  assert.equal(pageText(p.pages[0]), 'Welcome to the Nightmare Zone! Would you like me to create a dream for you?');
  assert.deepEqual(p.getDialogueManager().options(), ['Who are you?', 'What is this place?', 'Can you tell me about the dreams?', 'Can I choose a dream?', "I'll come back another time."]);
  p.getDialogueManager().choose(1);
  p.getDialogueManager().continueAll();
  assert.equal(pageText(p.pages.at(-1)), 'Good times...');
  assert.equal(p.getDialogueManager().title(), 'Select an option');
});

test('an Endurance dream, normal: the price, "Agree to pay 1,000 coins?", prepared (code 124) and nothing taken yet', () => {
  const p = fakePlayer();
  chooseDream(p, 2, 1);
  assert.match(pageText(p.pages.at(-1)), /^For an Endurance dream, normal mode, I'll want 1,000 coins\./);
  assert.equal(p.getDialogueManager().title(), 'Agree to pay 1,000 coins?');
  p.getDialogueManager().choose(1);
  p.getDialogueManager().continueAll();
  assert.equal(varbit(p, 'nzone_purchaseddream'), 124);
  assert.match(pageText(p.pages.at(-1)), /I'll deduct 1,000 coins from the coffer when you do\.$/);
  // Op3 with a dream prepared offers to cancel it.
  p.pages.length = 0;
  hooks.npcs.get('Dominic Onion:Dream')({ player: p, npc: DOMINIC });
  p.getDialogueManager().continueAll();
  assert.equal(pageText(p.pages[0]), "I've already created a dream for you. Do you want me to cancel it?");
  p.getDialogueManager().choose(1);
  p.getDialogueManager().continueAll();
  assert.equal(varbit(p, 'nzone_purchaseddream'), 0);
});

test('Practice: the boss list, an unfinished quest shown "not complete"; Trapped Soul is code 47', () => {
  const p = fakePlayer();
  chooseDream(p, 1, 1);
  const [, , title, labels] = p.script;
  assert.equal(title, 'Practice: Normal mode');
  const list = labels.split('|');
  assert.equal(list.length, 50);
  assert.equal(list[0], 'The Ascent of Arceuus: Trapped Soul');
  assert.equal(list[49], 'Dream Mentor: <col=ff0000>not complete</col>');
  hooks.click({ player: p, groupId: core.CacheDefinitions.getInterfaceId('menu'), childId: 3, slot: 0, handled: false });
  assert.equal(varbit(p, 'nzone_purchaseddream'), 47);
});

test('a dream needs five of the quests (Wiki)', () => {
  const p = fakePlayer({ quests: QUESTS().slice(0, 2) });
  chooseDream(p);
  assert.ok(p.messages.includes(Common.message('notEnoughQuests', { needed: 5 })));
});

test('the coffer: "The coffer is empty.", Deposit money., in thousands (nzone_cash 10000 for 10,000,000)', () => {
  const p = fakePlayer({ coins: 10_000_500 });
  hooks.objects.get("Dominic's coffer:Use")({ player: p });
  assert.equal(pageText(p.pages[0]), 'The coffer is empty.');
  p.getDialogueManager().continueAll();
  assert.equal(p.getDialogueManager().title(), "Dominic's Coffer (Empty)");
  assert.deepEqual(p.getDialogueManager().options(), ['Deposit money.', 'Cancel.']);
  p.getDialogueManager().choose(1);
  assert.equal(p.prompt, 'How much do you wish to deposit? (10,000,500)');
  p.amount.execute(10_000_500);
  assert.equal(varbit(p, 'nzone_cash'), 10000);
  assert.equal(Common.coffer(p), 10_000_000);
  assert.equal(p.inventory.getAmount(995), 500, 'only whole thousands go in');
  assert.equal(p.getDialogueManager().title(), "Dominic's Coffer (10,000,000 coins)");
  assert.deepEqual(p.getDialogueManager().options(), ['Deposit money.', 'Withdraw money.', 'Cancel.']);
});

test('the vial: "Start dream", the fee from the coffer, then the arena, a boss and points; the potion wakes you', () => {
  const p = fakePlayer({ quests: QUESTS() });
  Common.setCoffer(p, 5000);
  Common.setPreparedDream(p, { mode: 'endurance', difficulty: 'normal' });
  hooks.objects.get('<col=ff9040>Potion:Drink')({ player: p, object: { getId: () => core.CacheDefinitions.getLocId('nzone_lobby_vial') } });
  assert.equal(p.getDialogueManager().title(), 'Start dream: Endurance');
  p.getDialogueManager().choose(1);
  assert.equal(Common.coffer(p), 4000);
  ticks(3);
  assert.ok(p.messages.includes('Welcome to the Nightmare Zone.'));
  const state = Dream.dreams.get(p);
  assert.deepEqual([p.location.getX() - state.area.getBaseX() + state.area.origin[0], p.location.getY() - state.area.getBaseY() + state.area.origin[1]], [2276, 4680]);
  assert.equal(varbit(p, 'nzone_purchaseddream'), 0);
  ticks(Common.data.arena.firstSpawnTicks);
  const [boss] = state.npcs;
  assert.equal(boss.getId(), core.CacheDefinitions.getNpcId('nzone_arceuusquest_soul_normal'));
  Dream.bossDied({ npc: boss });
  assert.equal(Common.points(p), 183, 'every boss unlocked: the full figure');
  assert.ok(Dream.wake({ player: p }));
  assert.deepEqual([p.location.getX(), p.location.getY()], [2608, 3115]);
  assert.equal(Dream.dreams.has(p), false);
});

test("bosses with several forms fight through them all (Witch's experiment); a death in a dream is safe", () => {
  const p = fakePlayer({ quests: QUESTS() });
  Common.setPreparedDream(p, { mode: 'practice', difficulty: 'normal', boss: 6 });
  Dream.start(p);
  ticks(3 + Common.data.arena.firstSpawnTicks);
  const state = Dream.dreams.get(p);
  for (const form of ['shapeshifterglob', 'shapeshifterspider', 'shapeshifterbear', 'shapeshifterwolf']) {
    const [npc] = state.npcs;
    assert.equal(npc.getId(), core.CacheDefinitions.getNpcId(`nzone_${form}_normal`));
    Dream.bossDied({ npc });
  }
  assert.equal(state.npcs.size, 0);
  assert.equal(Common.points(p), 0, 'Practice gives no points');
  const again = fakePlayer({ quests: QUESTS() });
  Common.setCoffer(again, 6000);
  Common.setPreparedDream(again, { mode: 'rumble', difficulty: 'hard' });
  Dream.start(again);
  ticks(3 + Common.data.arena.firstSpawnTicks);
  assert.equal(Dream.dreams.get(again).npcs.size, Common.data.rumbleBosses);
  const event = { player: again, handled: false };
  for (const fn of hooks.death) fn(event);
  assert.equal(event.handled, true);
  assert.equal(Dream.dreams.has(again), false);
  assert.deepEqual([again.location.getX(), again.location.getY()], [2608, 3115]);
});
