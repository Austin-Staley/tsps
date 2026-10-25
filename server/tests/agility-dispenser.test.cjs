// Run after `yarn build`: node --test tests/agility-dispenser.test.cjs
//
// The Wilderness Agility Course's Agility dispenser against rsprox 233/00449-00461 (the varbits, a lap's
// end, Tag, Pay, Redeem and their lines) and the Wiki (the loot tables and the ticket XP).
const assert = require('node:assert/strict');
const { test, before } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { Location } = require('../dist/game/model/Location');

let Dispenser, LootingBag, core;
const hooks = { events: {}, objects: {}, login: null, logout: null, prompts: [] };
const TICKET = 29460;
const OPEN_BAG = 22586;

before(() => {
  CachePipeline.initialize();
  core = PluginManager.getCoreApi();
  const api = {
    core,
    persistAttribute() {},
    onCustomEvent: (name, fn) => { hooks.events[name] = fn; },
    emitCustomEvent: (name, event) => hooks.events[name]?.(event),
    onObjectInteraction: (name, actions) => { hooks.objects[name] = actions; },
    onPlayerLogin: (fn) => { hooks.login = fn; },
    onPlayerLogout: (fn) => { hooks.logout = fn; },
    sendMultiChatboxPrompt: (player, title, ...pairs) => { player.prompt = { title, pairs }; return true; },
  };
  Dispenser = require('../plugins/skills/AgilityDispenser.plugin');
  LootingBag = require('../plugins/items/LootingBag.plugin');
  Dispenser.register(api);
  hooks.events['looting-bag:store'] = LootingBag._test.storeLoot;
});

function inventory() {
  const slots = [];
  const inv = {
    slots,
    getAmount: (id) => slots.filter((s) => s.getId() === id).reduce((n, s) => n + s.getAmount(), 0),
    add(item) {
      const same = core.ItemDefinition.forId(item.getId()).isStackable() && slots.find((s) => s.getId() === item.getId());
      if (same) same.setAmount(same.getAmount() + item.getAmount()); else slots.push(item);
    },
    deleteNumber(id, amount) {
      for (const s of slots) if (s.getId() === id && amount > 0) { const n = Math.min(amount, s.getAmount()); s.setAmount(s.getAmount() - n); amount -= n; }
      for (let i = slots.length - 1; i >= 0; i--) if (slots[i].getAmount() <= 0) slots.splice(i, 1);
    },
    getFreeSlots: () => 28 - slots.length,
    getValidItems: () => slots,
    refreshItems() {},
  };
  return inv;
}

function player() {
  const attributes = new Map();
  const p = {
    messages: [], boxes: [], varbits: new Map(), xp: [], sounds: [], energy: 50, inv: inventory(),
    location: new Location(3004, 3936, 0),
    getAttribute: (k) => attributes.get(k), setAttribute: (k, v) => attributes.set(k, v),
    getInventory: () => p.inv, getLocation: () => p.location, isRegistered: () => true,
    sendMessage: (m) => p.messages.push(m), setRunEnergy(e) { p.energy = e; },
    getPacketSender: () => ({ sendVarbit: (id, v) => p.varbits.set(id, v), sendSoundEffect: (id) => p.sounds.push(id) }),
    getDialogueManager: () => ({ startDialogues: (b) => { for (const d of b.getDialogues().values()) p.boxes.push(d.getText()); } }),
    getSkillManager: () => ({ addExperiences: (skill, xp) => p.xp.push(xp) }),
    choose(text) { const i = p.prompt.pairs.indexOf(text); p.prompt.pairs[i + 1](); },
  };
  return p;
}

const varbit = (name) => core.CacheDefinitions.getVarbitId(name);
const op = (p, option) => hooks.objects['Agility dispenser'][option]({ player: p });
const lap = (p) => hooks.events['agility:lap']({ player: p, course: 'wilderness', laps: 1 });

test('Tag before a lap: the recorded line; an unpaid lap gives just the ticket, and Tag restores run energy', () => {
  const p = player();
  op(p, 'Tag');
  assert.deepEqual(p.messages, ['You need to complete one full lap to receive a ticket and pay 150,000 coins to receive a reward after each lap.']);
  assert.equal(p.energy, 100);
  lap(p);
  assert.equal(p.varbits.get(varbit('wildy_agility_token_available')), 1);
  assert.equal(p.messages.length, 1, 'no streak line when unpaid');
  op(p, 'Tag');
  assert.equal(p.messages.at(-1), 'You received <col=ef1020>a Wilderness agility ticket</col> from the Agility dispenser.');
  assert.equal(p.inv.getAmount(TICKET), 1);
  assert.equal(p.varbits.get(varbit('wildy_agility_token_available')), 0);
});

test("Pay: the prompt, 150,000 coins, a looting bag for a player without one; then already paid; \"don't ask again\" skips the prompt", () => {
  const p = player();
  p.inv.add(new core.Item(995, 150000));
  op(p, 'Pay');
  assert.equal(p.prompt.title, "Do you want to pay 150,000 coins to receive a reward after each lap?<br>You'll lose your payment if you leave the course.");
  assert.deepEqual(p.prompt.pairs.filter((x) => typeof x === 'string'), ['Yes.', "Yes, and don't ask again.", 'No.']);
  p.choose("Yes, and don't ask again.");
  assert.equal(p.inv.getAmount(995), 0);
  assert.equal(p.inv.getAmount(11941), 1);
  assert.deepEqual(p.messages, ['You have paid 150,000 coins to receive a reward after each lap.', 'You received <col=ef1020>a Looting bag</col> from the Agility dispenser.']);
  assert.equal(p.varbits.get(varbit('wildy_agility_deposit')), 1);
  assert.equal(p.varbits.get(varbit('wildy_agility_payment_warning')), 1);
  op(p, 'Pay');
  assert.equal(p.boxes.at(-1), 'You have already paid 150,000 coins to receive a reward after each lap.');
  const poor = player();
  poor.setAttribute(Dispenser.ATTRIBUTE('paymentWarning'), 1);
  op(poor, 'Pay');
  assert.equal(poor.boxes.at(-1), 'You need 150,000 coins to pay to receive additional rewards.');
});

test('a paid lap: the streak line; Tag wants an open looting bag, then fills it, with an extra in the inventory', () => {
  const p = player();
  p.inv.add(new core.Item(995, 150000));
  p.setAttribute(Dispenser.ATTRIBUTE('paymentWarning'), 1);
  op(p, 'Pay');
  lap(p);
  assert.equal(p.messages.at(-1), 'Your Wilderness Agility reward streak is: <col=ff0000>1</col>');
  assert.equal(p.varbits.get(varbit('wildy_agility_reward_available')), 1);
  op(p, 'Tag');
  assert.equal(p.boxes.at(-1), 'You must have an open looting bag in your inventory before trying to claim loot.');
  assert.equal(p.inv.getAmount(TICKET), 0, 'nothing is given until the bag is open');
  p.inv.deleteNumber(11941, 1);
  const bag = new core.Item(OPEN_BAG, 1);
  p.inv.add(bag);
  op(p, 'Tag');
  assert.equal(p.inv.getAmount(TICKET), 1);
  assert.match(p.messages.at(-1), /^You have been awarded <col=ef1020>\d+ x Blighted .+<\/col> and <col=ef1020>1 x .+<\/col>, and an extra <col=ef1020>Blighted .+<\/col> from the Agility dispenser\.$/);
  const stored = LootingBag._test.bagItems(bag);
  assert.equal(stored.length, 2);
  assert.ok(stored.every(({ id }) => core.ItemDefinition.forId(id).isNoted()), 'noted resources and armour');
});

test('leaving the course loses the payment, the reward and the streak, not the ticket; logout takes 10 off the streak', () => {
  const p = player();
  p.inv.add(new core.Item(995, 150000));
  p.setAttribute(Dispenser.ATTRIBUTE('paymentWarning'), 1);
  op(p, 'Pay');
  lap(p);
  p.location = new Location(2998, 3916, 0);
  core.TaskManager.process();
  assert.equal(p.varbits.get(varbit('wildy_agility_deposit')), 0);
  assert.equal(p.varbits.get(varbit('wildy_agility_reward_available')), 0);
  assert.equal(p.varbits.get(varbit('wildy_agility_reward_lap_new')), 0);
  assert.equal(p.getAttribute(Dispenser.ATTRIBUTE('ticket')), 1);
  const q = player();
  q.setAttribute(Dispenser.ATTRIBUTE('streak'), 14);
  hooks.logout({ player: q });
  assert.equal(q.getAttribute(Dispenser.ATTRIBUTE('streak')), 4);
});

test('Redeem: 200 XP a ticket up to 10, then 210, 220 and 230 (Wiki); the recorded lines and sound', () => {
  assert.deepEqual([1, 10, 11, 50, 51, 100, 101].map(Dispenser.redeemXp), [200, 2000, 2310, 10500, 11220, 22000, 23230]);
  const p = player();
  op(p, 'Redeem');
  assert.equal(p.boxes.at(-1), 'You do not have any Wilderness agility tickets to redeem.');
  p.inv.add(new core.Item(TICKET, 1));
  op(p, 'Redeem');
  assert.equal(p.messages.at(-1), 'You redeem 1 Wilderness agility ticket and have been awarded 200 Agility XP!');
  p.inv.add(new core.Item(TICKET, 3));
  op(p, 'Redeem');
  assert.equal(p.messages.at(-1), 'You redeem 3 Wilderness agility tickets and have been awarded 600 Agility XP!');
  assert.deepEqual(p.xp, [200, 600]);
  assert.deepEqual(p.sounds, [2655, 2655]);
});

test('reward tiers by streak (Wiki): steel and mithril at 1-15, rune chainbodies and kiteshields only from 16', () => {
  const ids = (streak) => new Set(Array.from({ length: 400 }, () => core.ItemDefinition.forId(Dispenser.rollReward(streak)[1].id).getName()));
  assert.ok(!ids(1).has('Rune chainbody') && ids(1).has('Steel platebody'));
  assert.ok(ids(61).has('Rune kiteshield') && !ids(61).has('Steel platebody'));
});
