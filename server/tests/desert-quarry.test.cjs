// Run after `yarn build`: node --test tests/desert-quarry.test.cjs
//
// The Desert Quarry's grinder and Drew against rsprox 232/03162 and 232/03165 (the grinds, the deposits,
// the claims and their lines) and the Wiki (25,000 buckets, 50 coins a bucket of sand).
const assert = require('node:assert/strict');
const { test, before } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { PluginManager } = require('../dist/plugins/PluginManager');

let Quarry, hooks, core;
const obj = (name) => core.CacheDefinitions.getObjId(name);

before(() => {
  CachePipeline.initialize();
  core = PluginManager.getCoreApi();
  hooks = { npcs: {}, objects: {}, itemOnObject: null, prompts: [] };
  const api = {
    core,
    persistAttribute() {},
    onNpcInteraction: (name, actions) => { hooks.npcs[name] = actions; },
    onObjectInteraction: (name, actions) => { hooks.objects[name] = actions; },
    onItemOnObject: (fn) => { hooks.itemOnObject = fn; },
    sendMultiChatboxPrompt: (player, title, ...pairs) => { player.menus.push(pairs.filter((x) => typeof x === 'string')); player.menu = pairs; return true; },
  };
  Quarry = require('../plugins/areas/DesertQuarry.plugin');
  Quarry.register(api);
});

function container() {
  const stacks = new Map();
  return {
    stacks,
    getAmount: (id) => stacks.get(id) ?? 0,
    add(item) { stacks.set(item.getId(), (stacks.get(item.getId()) ?? 0) + item.getAmount()); },
    deleteNumber(id, amount) { stacks.set(id, (stacks.get(id) ?? 0) - amount); },
    getFreeSlots: () => 28 - [...stacks.values()].filter((n) => n > 0).length,
    refreshItems() {},
  };
}

function player() {
  const attributes = new Map();
  const p = {
    messages: [], pages: [], menus: [], prompts: [], amountAction: null, inventory: container(),
    getAttribute: (k) => attributes.get(k), setAttribute: (k, v) => attributes.set(k, v),
    getInventory: () => p.inventory, sendMessage: (m) => p.messages.push(m),
    setEnteredAmountAction(action) { p.amountAction = action; },
    getPacketSender: () => ({ sendEnterAmountPrompt: (text) => p.prompts.push(text) }),
    getDialogueManager: () => ({
      startDialogues(builder) {
        for (const page of builder.getDialogues().values()) {
          if (page.getText) p.pages.push(page.getText());
          else if (page.action?.execute) page.action.execute();
        }
      },
    }),
    choose(text) { const i = p.menu.indexOf(text); p.menu[i + 1](); },
    enter(count) { const action = p.amountAction; p.amountAction = null; action.execute(count); },
  };
  return p;
}

const drew = () => ({ getId: () => core.CacheDefinitions.getNpcId('grinder_drew') });
const grinder = () => ({ getId: () => core.CacheDefinitions.getLocId('grinder_machine') });
const op = (p, option) => hooks.npcs.Drew[option]({ player: p, npc: drew() });

test('the grinder takes every piece at once: 1kg 1, 2kg 2, 5kg 4, 10kg 8 buckets (232/03162: 2 medium, 2 large, 1 small -> 26)', () => {
  const p = player();
  hooks.objects.Grinder.Deposit({ player: p, object: grinder() });
  assert.deepEqual(p.messages, ['You do not have any sandstone to grind.']);
  p.inventory.add(new core.Item(obj('enakh_sandstone_medium'), 2));
  p.inventory.add(new core.Item(obj('enakh_sandstone_large'), 2));
  p.inventory.add(new core.Item(obj('enakh_sandstone_small'), 1));
  hooks.objects.Grinder.Deposit({ player: p, object: grinder() });
  assert.equal(p.messages.at(-1), 'The grinder is holding enough sandstone for 26 buckets of sand.');
  assert.equal(p.inventory.getAmount(obj('enakh_sandstone_large')), 0);
  // 6 tiny + 5 small + 2 medium -> 50, as recorded; used on the grinder it does the same.
  p.inventory.add(new core.Item(obj('enakh_sandstone_tiny'), 6));
  p.inventory.add(new core.Item(obj('enakh_sandstone_small'), 5));
  p.inventory.add(new core.Item(obj('enakh_sandstone_medium'), 2));
  hooks.itemOnObject({ player: p, object: grinder(), item: {}, itemId: obj('enakh_sandstone_tiny'), handled: false });
  assert.equal(p.messages.at(-1), 'The grinder is holding enough sandstone for 50 buckets of sand.');
});

test("noted sandstone on the grinder gets Drew's refusal and stays", () => {
  const p = player();
  const noted = core.ItemDefinition.forId(obj('enakh_sandstone_large')).getNoteId();
  p.inventory.add(new core.Item(noted, 3));
  const event = { player: p, object: grinder(), item: {}, itemId: noted, handled: false };
  hooks.itemOnObject(event);
  assert.equal(event.handled, true);
  assert.deepEqual(p.pages, ["Sorry mate, ya can't turn noted sandstone into sand. Come back with some real sandstone."]);
  assert.equal(p.inventory.getAmount(noted), 3);
});

test('Deposit buckets: none, zero, one, then up to the 25,000 Drew holds (232/03162, 232/03165)', () => {
  const p = player();
  op(p, 'Deposit buckets');
  assert.equal(p.pages.at(-1), "You haven't got any buckets for me to hold.");
  p.inventory.add(new core.Item(obj('cert_bucket_empty'), 500));
  op(p, 'Deposit buckets');
  assert.equal(p.prompts.at(-1), 'How many buckets do you wish to deposit?');
  p.enter(0);
  assert.equal(p.pages.at(-1), "You can't deposit zero buckets.");
  op(p, 'Deposit buckets');
  p.enter(1);
  assert.equal(p.pages.at(-1), 'I am only holding onto one bucket for ya.');
  op(p, 'Deposit buckets');
  p.enter(800);
  assert.equal(p.pages.at(-1), 'I am holding onto 500 buckets for ya.');
  assert.equal(p.inventory.getAmount(obj('cert_bucket_empty')), 0);
  p.inventory.add(new core.Item(obj('cert_bucket_empty'), 26700));
  op(p, 'Deposit buckets');
  p.enter(50000);
  assert.equal(p.pages.at(-1), 'I am holding onto 25,000 buckets for ya. Why would ya want so many buckets?');
  assert.equal(p.inventory.getAmount(obj('cert_bucket_empty')), 2200, 'only up to 25,000 is taken');
  op(p, 'Deposit buckets');
  assert.equal(p.pages.at(-1), "I can't hold any more buckets for you.");
});

test('Claim Sand: noted buckets of sand at 50 coins each, as many as the sand, buckets and coins allow', () => {
  const p = player();
  op(p, 'Claim Sand');
  assert.match(p.pages.at(-1), /^Ya don't have any buckets of sand to withdraw\./);
  p.setAttribute(Quarry.BUCKETS_KEY, 1000);
  p.setAttribute(Quarry.SAND_KEY, 642);
  op(p, 'Claim Sand');
  assert.match(p.pages.at(-1), /^Ya do not have enough money to withdraw even one bucket of sand;/);
  p.inventory.add(new core.Item(995, 796138));
  op(p, 'Claim Sand');
  assert.equal(p.prompts.at(-1), 'How many buckets of sand do ya want? (50 coins each)');
  p.enter(0);
  assert.equal(p.pages.at(-1), 'Come back when ya actually want some buckets of sand.');
  op(p, 'Claim Sand');
  p.enter(1);
  assert.equal(p.inventory.getAmount(995), 796088);
  assert.equal(p.inventory.getAmount(obj('cert_bucket_sand')), 1);
  assert.equal(p.pages.at(-1), 'If ya need any more sand, please come back and use Sandstorm again.');
  op(p, 'Claim Sand');
  p.enter(50000);
  assert.equal(p.inventory.getAmount(obj('cert_bucket_sand')), 642, 'capped at the ground sand');
  assert.equal(p.inventory.getAmount(995), 796138 - 642 * 50);
  assert.equal(p.getAttribute(Quarry.BUCKETS_KEY), 1000 - 642);
  assert.equal(p.getAttribute(Quarry.SAND_KEY), 0);
});

test('Check, and Talk-to: the recorded lines, the menu, and Yes leading to the claim', () => {
  const p = player();
  op(p, 'Check');
  assert.deepEqual(p.pages, ["I have 0 of your buckets and you've ground enough sandstone for 0 buckets of sand."]);
  p.setAttribute(Quarry.BUCKETS_KEY, 10);
  p.setAttribute(Quarry.SAND_KEY, 4);
  p.inventory.add(new core.Item(995, 1000));
  op(p, 'Check');
  assert.equal(p.pages.at(-1), 'Would ya like to purchase some buckets of sand?');
  p.choose('Yes.');
  assert.equal(p.prompts.at(-1), 'How many buckets of sand do ya want? (50 coins each)');
  op(p, 'Talk-to');
  assert.equal(p.pages.at(-1), 'Hey there, what can I do for ya?');
  assert.deepEqual(p.menus.at(-1), ['Tell me about yourself.', 'Deposit buckets.', 'Withdraw buckets of sand.', 'Check my buckets and sand.', 'Nothing.']);
  p.choose('Tell me about yourself.');
  assert.equal(p.pages.at(-1), "Anyway, that's all in the past. Can I help ya with anything else?");
  p.choose('Nothing.');
  assert.deepEqual(p.pages.slice(-2), ['Nothing sorry. I have to be going now.', 'Oh, bye then.']);
});
