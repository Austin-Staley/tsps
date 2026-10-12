// Run after `yarn build`: node --test tests/quest-plugins.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { PluginManager } = require('../dist/plugins/PluginManager');

// A stand-in for the live PluginApi: real core, every hook a no-op. Quests must
// register cleanly through it and hand back their variant/condition resolvers.
function mockApi() {
  const handlers = {
    variant: [],
    condition: [],
    custom: new Map(),
  };
  const noop = () => {};
  const base = {
    core: PluginManager.getCoreApi(),
    onNpcDialogueVariant: (h) => handlers.variant.push(h),
    onNpcDialogueCondition: (h) => handlers.condition.push(h),
    onCustomEvent: (name, h) => {
      const list = handlers.custom.get(name) ?? [];
      list.push(h);
      handlers.custom.set(name, list);
    },
    persistAttribute: noop,
  };
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return noop;
    },
  });
  return { api, handlers };
}

test('Quests.plugin registers every quest through api.core without throwing', () => {
  const { api } = mockApi();
  const plugin = require('../plugins/quests/Quests.plugin');
  assert.equal(plugin.name, 'Quests');
  assert.doesNotThrow(() => plugin.register(api));
});

test('NPC Contact paginates plugin contacts and dispatches the chosen contact once', () => {
  const { LunarSpells } = require('../dist/game/content/combat/magic/LunarSpells');
  const original = PluginManager.emitCustomEvent;
  const contacts = ['Nieve', 'Duradel', 'Konar quo Maten', 'Mazchna', 'Turael', 'Cyrisus'];
  let chain;
  const dispatched = [];
  const player = {
    getDialogueManager: () => ({ startDialogues: builder => { chain = builder; } }),
    getPacketSender: () => ({ sendInterfaceRemoval() {} }),
    sendMessage: message => { throw Error(message); },
  };
  PluginManager.emitCustomEvent = (name, event) => {
    if (name === 'magic:npc-contact') event.contacts.push(...contacts.slice(4));
    else { dispatched.push(event.name); event.handled = true; }
  };
  try {
    LunarSpells.openNpcContact(player);
    let menu = [...chain.getDialogues().values()][0];
    assert.equal(menu.getOptions().length, 5);
    menu.execute(5);
    menu = [...chain.getDialogues().values()][0];
    assert.deepEqual(menu.getOptions(), ['Turael', 'Cyrisus']);
    menu.execute(2);
    assert.deepEqual(dispatched, ['Cyrisus']);
  } finally { PluginManager.emitCustomEvent = original; }
});

test('Fellowship recruitment waits for dialogue continuation and all four heroes before herb growth', () => {
  const { api, handlers, player, attributes } = movarioFixture();
  let progress = 280;
  api.context.stage = () => progress;
  api.context.advance = (p, next) => { progress = Math.max(progress, next); };
  require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')(api.context);
  const line = handlers.custom.get('npc-dialogue:line');
  const final = [
    [13618, "Eh, you know what... I'm in! One last job, and quite the job it is!"],
    [13620, 'I would be glad to. The chance to face a Mahjarrat again is something I have desired for many centuries.'],
    [13622, 'It seems my years of waiting are over. I have been granted leave to join your cause.'],
    [13559, 'Then I shall join you there.'],
  ];
  for (const [npcId, text] of final) {
    const before = attributes.get('while-guthix-sleeps:recruits');
    const event = { player, npcId, text };
    line(event);
    assert.equal(attributes.get('while-guthix-sleeps:recruits'), before);
    assert.equal(progress, 280);
    event.after();
  }
  assert.equal(progress, 300);
  assert.equal(player.varbits.get(10781), 2);
});

test('Fellowship seed enrichment requires the seed on Betty’s counter and the doorway tile', () => {
  const { api, handlers, player, attributes } = movarioFixture();
  let progress = 250;
  api.context.stage = () => progress;
  api.context.advance = (p, next) => { progress = Math.max(progress, next); };
  require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')(api.context);
  const enrich = handlers.items.find(h => h.name === 'Rose-tinted lens').handler;
  const object = { getLocation: () => new api.core.Location(3013, 3261, 0) };
  player.getLocation = () => new api.core.Location(3012, 3258, 0);
  assert.equal(enrich({ player, itemId: 6956, object }), false);
  attributes.set('while-guthix-sleeps:seed-on-counter', 1);
  player.getLocation = () => new api.core.Location(3011, 3258, 0);
  enrich({ player, itemId: 6956, object });
  assert.equal(attributes.get('while-guthix-sleeps:seed-on-counter'), 1);
  player.getLocation = () => new api.core.Location(3012, 3258, 0);
  enrich({ player, itemId: 6956, object });
  assert.equal(attributes.get('while-guthix-sleeps:seed-on-counter'), 2);
  assert.equal(player.varbits.get(1537), 3);
});

test('Movario rune door checks the symbol and real carried weight before consuming a rune', () => {
  const { api, handlers, player, attributes, removed, hits } = movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({ player });
  attributes.set('while-guthix-sleeps:door-rune', 1);
  handlers.items.find(h => h.name === 'Earth rune').handler({ player, itemId: 557, objectId: 53901 });
  assert.equal(hits.length, 1);
  assert.equal(removed.length, 0);
  handlers.items.find(h => h.name === 'Air rune').handler({ player, itemId: 556, objectId: 53901 });
  assert.equal(removed.length, 0, 'empty slots must not contribute their bogus weight');
  player.items.push({ getId: () => 29527, getAmount: () => 2, getDefinition: () => ({ getWeight: () => 1000 }) });
  handlers.items.find(h => h.name === 'Air rune').handler({ player, itemId: 556, objectId: 53901 });
  assert.deepEqual(removed, [[556, 1]]);
  assert.deepEqual(player.position, [4181, 4964, 0]);
});

test('Movario reads a transformed door through ObjectDefinition.id', () => {
  const { api, handlers, player, attributes } = movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({ player });
  const inspect = handlers.objects.find(h => h.name === 'Old battered door').options.Inspect;
  assert.equal(inspect({ player, objectId:54089, definition:{ id:53901 } }),true);
  assert.ok(attributes.get('while-guthix-sleeps:door-rune')>0);
});

test('Movario keeps teleport locked after a wrong pressure attempt and has a mapped return door', () => {
  const { api, handlers, player, attributes } = movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({ player });
  player.getLocation = () => new api.core.Location(4186, 4953, 1);
  attributes.set('while-guthix-sleeps:door-tries', 1);
  assert.equal(player.area.canTeleport(player), false);
  attributes.set('while-guthix-sleeps:door-tries', 3);
  assert.equal(player.area.canTeleport(player), null);
  handlers.objects.find(h => h.name === 'Old battered door').options.Open({ player, objectId: 53902 });
  assert.deepEqual(player.position, [4210, 4981, 0]);
});

test('Movario’s mapped stairs land beside the return stairs on walkable floor', () => {
  const { api, handlers, player } = movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({ player });
  handlers.objects.find(h=>h.name==='Stairs').options['Climb-down']({player,objectId:53895});
  assert.deepEqual(player.position,[4210,4981,0]);
  handlers.objects.find(h=>h.name==='Stairs').options['Climb-up']({player,objectId:53896});
  assert.deepEqual(player.position,[4116,4971,0]);
});

test('Movario cleanup uses the live Mobile attribute API so logout can save progress', () => {
  const { api, handlers, player, attributes } = movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({ player });
  delete player.removeAttribute;
  assert.doesNotThrow(()=>player.area.postLeave(player,true));
  assert.equal(attributes.get('while-guthix-sleeps:in-base'),0);
  assert.deepEqual(player.position,[2519,3248,0],'private base logout saves a safe return position');
});

test('Movario’s open gate crosses south from the cache interaction tile', () => {
  const { api, handlers, player, attributes } = movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({player});
  attributes.set('while-guthix-sleeps:wires',7);
  player.getLocation=()=>new api.core.Location(4181,4953,0);
  handlers.objects.find(h=>h.name==='Gate').options.Open({player,objectId:54108,definition:{id:53922}});
  assert.deepEqual(player.position,[4181,4952,0]);
});

test('Movario’s replacement staircase faces the same accessible edge as the cache bookcase', () => {
  const {api,handlers,player}=movarioFixture();
  let replacement;
  api.context.replace=(...args)=>{replacement=args;};
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({player});
  handlers.items.find(h=>h.name==='Ruby key'&&h.object==='Bookcase').handler({player,itemId:29523,objectId:53939});
  assert.deepEqual(replacement.slice(1),[53947,[4172,4954,1],10,3]);
});

test('Movario’s hidden wall approaches from the clicked side before crossing', () => {
  const {api,handlers,player}=movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({player});
  player.getLocation=()=>new api.core.Location(4179,4948,1);
  for(const [source,expected]of [[4952,4949],[4945,4946]]){
    const event={player,objectId:53884,sourceLocation:{y:source}};
    handlers.routes[0](event);assert.deepEqual(event.destination,{x:4179,y:expected,z:1});
  }
});

test('Movario bookcases only deactivate the gate after following the wires', () => {
  const { api, handlers, player, attributes } = movarioFixture();
  require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
  handlers.custom.get('wgs:enter-movario')({ player });
  const search = handlers.objects.find(h => h.name === 'Bookcase').options.Search;
  search({ player, objectId: 53917 });
  assert.equal(attributes.get('while-guthix-sleeps:wires'), undefined);
  for (let objectId = 53914; objectId <= 53920; objectId++) search({ player, objectId });
  assert.equal(attributes.get('while-guthix-sleeps:wires'), 7);
  assert.equal(player.varbits.get(10797), 1);
  search({ player, objectId: 53920 });
  assert.equal(attributes.get('while-guthix-sleeps:wires'), 7);
});

function movarioFixture() {
  const attributes = new Map(), removed = [], hits = [];
  const handlers = { custom: new Map(), objects: [], items: [], routes:[] };
  const core = PluginManager.getCoreApi();
  class PrivateArea {
    constructor() { this.objects = []; }
    enter(mobile) { mobile.area = this; }
    getObjects() { return this.objects; }
    postLeave() {}
  }
  const api = new Proxy({
    core: { ...core, PrivateArea, ObjectDefinition: { forPlayer: id => ({ id }) } },
    onCustomEvent: (name, handler) => handlers.custom.set(name, handler),
    onObjectInteraction: (name, options) => handlers.objects.push({ name, options }),
    onObjectRoute: handler=>handlers.routes.push(handler),
    onItemOnObject: (name, object, handler) => handlers.items.push({ name, object, handler }),
    spawnNpc: () => ({}),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const player = {
    area: null, position: null, varbits: new Map(),
    items: [{ getId: () => -1, getAmount: () => 0, getDefinition: () => ({ getWeight: () => 100000 }) }],
    getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key), sendMessage() {},
    getPrivateArea() { return this.area; },
    getInventory() { return { getItems: () => this.items, deleteNumber: (id, amount) => removed.push([id, amount]) }; },
    getEquipment: () => ({ getItems: () => [] }),
    moveTo(location) { this.position = [location.getX(), location.getY(), location.getZ()]; },
    getPacketSender() { return { sendVarbit: (id, value) => this.varbits.set(id, value) }; },
  };
  api.context = { api, quest: {}, stage: () => 100, advance() {}, held: () => true,
    give() {}, play() {}, val: (p, key) => Number(p.getAttribute(key)) || 0, replace() {},
    hit: (p, amount) => hits.push(amount), ATTRIBUTES: [] };
  return { api, handlers, player, attributes, removed, hits };
}

test('While Guthix Sleeps only tracks a shirt through the player’s own broav', () => {
  const { api: base } = mockApi();
  const handlers = [];
  const api = new Proxy({ ...base, onItemOnNpc: handler => handlers.push(handler) },
    { get: (target, key) => target[key] ?? (() => {}) });
  require('../plugins/quests/quests/WhileGuthixSleeps.Quest')(api);
  const attributes = new Map(), moves = [];
  const player = { getLocation: () => new api.core.Location(2519,3249,0),
    getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key,value),
    sendMessage() {}, getPacketSender: () => ({ sendVarbit() {} }) };
  const npc = { getId: () => 13518, getOwner: () => player,
    getMovementQueue: () => ({ addSteps: location => moves.push(location) }) };
  const event = { player, itemId:29521, target:npc };
  assert.equal(handlers.at(-1)({...event,target:{...npc,getOwner:()=>({})}}),false);
  assert.equal(handlers.at(-1)(event),true);
  assert.equal(event.handled,true);
  assert.equal(attributes.get('while-guthix-sleeps:broav-trail'),1);
  assert.equal(moves.length,1);
});

test("While Guthix Sleeps counts Thaerisk's actual assassin kill without a player death event", () => {
  const { api: base } = mockApi();
  const custom = new Map(), spawned = [], attributes = new Map();
  class PrivateArea { enter(mobile) { mobile.area = this; (this.npcs ??= []).push(mobile); } postLeave() {} }
  const api = new Proxy({ ...base, core: { ...base.core, PrivateArea },
    onCustomEvent: (name, handler) => custom.set(name, handler),
    spawnNpc: definition => {
      const npc = { hp: 0, id: definition.id,
        setMaxHitpoints: () => npc, setHitpoints: hp => (npc.hp = hp, npc), setScriptedMovement() {},
        getHitpoints: () => npc.hp, getCombat: () => ({ getLastAttack: () => ({ reset() {} }) }),
        getArea: () => npc.area,
      };
      spawned.push(npc); return npc;
    },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  require('../plugins/quests/quests/WhileGuthixSleeps.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const sender = new Proxy({}, { get: () => () => sender });
  const player = { getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => sender, sendMessage() {}, getPrayerActive: () => [],
  };
  quest.setStage(player, 10);
  custom.get('npc-dialogue:action')({ player, npcId: 13511, stepId: 'c_eyt5' });
  spawned.find(n => n.id === 13515).area = null;
  player.area.process(player);
  assert.equal(quest.getStage(player), 10, 'one surviving assassin still blocks the investigation');
  spawned.find(n => n.id === 13514).hp = 0;
  player.area.process(player);
  assert.equal(quest.getStage(player), 30);
  assert.equal(attributes.get('while-guthix-sleeps:assassins-defeated'), 3);
});

test('quest keys, names and varps are unique', () => {
  const { api } = mockApi();
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const before = getRegisteredQuests().length;
  require('../plugins/quests/Quests.plugin').register(api);
  const quests = getRegisteredQuests().slice(before);
  const seen = { key: new Map(), name: new Map(), varpId: new Map() };
  for (const quest of quests) {
    for (const field of ['key', 'name', 'varpId']) {
      const value = quest[field];
      if (seen[field].has(value)) {
        assert.fail(`duplicate quest ${field} "${value}" (${seen[field].get(value)}, ${quest.name})`);
      }
      seen[field].set(value, quest.name);
    }
  }
  assert.ok(quests.length > 0, 'no quests registered');
});

test('Quests.plugin lists every quest file on disk', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { QUESTS } = require('../plugins/quests/Quests.plugin');
  const dir = path.join(__dirname, '../plugins/quests/quests');
  const onDisk = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.Quest.js'))
    .map((f) => f.replace(/\.Quest\.js$/, ''))
    .sort();
  assert.deepEqual([...QUESTS].sort(), onDisk, 'Quests.plugin must register every quests/*.Quest.js');
});

test('each quest varp is sent again on login, so quest-gated locs show after a relog', () => {
  // The Grand Exchange spirit tree only has Travel once varp 111 (Tree Gnome Village) is 9.
  const { api } = mockApi();
  const { getRegisteredQuests, sendQuestVarps } = require('../plugins/quests/QuestRuntime');
  if (!getRegisteredQuests().some((quest) => quest.name === 'Tree Gnome Village')) require('../plugins/quests/Quests.plugin').register(api);
  const village = getRegisteredQuests().find((quest) => quest.name === 'Tree Gnome Village');
  const attributes = new Map();
  const varps = new Map();
  const varbits = new Map();
  const sender = new Proxy({}, {
    get: (t, key) => {
      if (key === 'sendConfig') return (id, value) => (varps.set(id, value), sender);
      if (key === 'sendVarbit') return (id, value) => (varbits.set(id, value), sender);
      return () => sender;
    },
  });
  const player = { getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), getPacketSender: () => sender };
  village.setStage(player, village.completionValue);
  varps.clear();
  varbits.clear();
  sendQuestVarps({ player });
  if (village.varbitId !== undefined) {
    assert.equal(varbits.get(village.varbitId), village.completionValue);
  } else {
    assert.equal(varps.get(village.varpId), village.completionValue);
  }
  // Unstarted quests are sent as 0 too: the login bootstrap clobbers shared varps (QuestRuntime).
  // Quests with a bitfield stage write their varbit instead, so sibling bits survive.
  // Earlier tests register the list more than once, so skip every Tree Gnome
  // Village registration (same stage attribute) rather than just this instance.
  const others = getRegisteredQuests().filter((quest) => quest.key !== village.key);
  const sent = (quest) => (quest.varbitId !== undefined ? varbits.get(quest.varbitId) : varps.get(quest.varpId));
  const offenders = others.filter((quest) => sent(quest) !== 0).map((quest) => `${quest.name}:${quest.varpId}/${quest.varbitId}=${sent(quest)}`);
  assert.ok(offenders.length === 0, `unstarted quests are reset to 0 (${offenders.slice(0, 5).join(', ')})`);
});

test("Tree Gnome Village sends King Bolren's orbs (varbit 598): the village's spirit tree has Travel at 2", () => {
  const custom = new Map();
  const logins = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onPlayerLogin') return (h) => logins.push(h);
      if (prop === 'onCustomEvent') return (name, h) => custom.set(name, [...(custom.get(name) ?? []), h]);
      if (prop === 'emitCustomEvent') return (name, payload) => (custom.get(name) ?? []).forEach((h) => h(payload));
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/TreeGnomeVillage.Quest')];
  require('../plugins/quests/quests/TreeGnomeVillage.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const village = getRegisteredQuests().filter((quest) => quest.name === 'Tree Gnome Village').at(-1);
  const attributes = new Map();
  const varbits = new Map();
  const sender = new Proxy({}, { get: (t, key) => (key === 'sendVarbit' ? (id, value) => (varbits.set(id, value), sender) : () => sender) });
  const player = { getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), getPacketSender: () => sender };
  village.setStage(player, village.completionValue);
  assert.equal(varbits.get(598), 2, "on completing it");
  varbits.clear();
  for (const login of logins) {
    try { login({ player }); } catch (error) { /* other login hooks want a real player */ }
  }
  assert.equal(varbits.get(598), 2, "and on every login");
});

test('Current Affairs and Prying Times start gates require every registered prerequisite', () => {
  const conditions = [];
  const completeQuests = new Set();
  let hasPortTaskSlot = false;
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcDialogueCondition') return (handler) => conditions.push(handler);
      if (prop === 'emitCustomEvent') return (name, request) => {
        if (name === 'quest:is-complete') request.complete = completeQuests.has(request.key);
        if (name === 'sailing:has-port-task-slot') request.available = hasPortTaskSlot;
      };
      return target[prop];
    },
  });
  require('../plugins/quests/quests/CurrentAffairs.Quest')(api);
  require('../plugins/quests/quests/PryingTimes.Quest')(api);
  const [currentAffairs, pryingTimes] = conditions;
  const player = { getSkillManager: () => ({ getMaxLevel: () => 99, getCurrentLevel: () => 99 }) };
  assert.equal(currentAffairs({ npcId: api.core.NpcIdentifiers.ARHEIN, player, stepId: 'mNhEI-' }), true,
    'missing Pandemonium blocks Current Affairs');
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'aifq0J' }), true,
    'missing quests and an unavailable task slot block Prying Times');
  completeQuests.add('pandemonium');
  assert.equal(currentAffairs({ npcId: api.core.NpcIdentifiers.ARHEIN, player, stepId: 'mNhEI-' }), false);
  completeQuests.add('the_knights_sword');
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'aifq0J' }), false,
    'high skills and both required quests satisfy the quest prerequisites');
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'PSw89b' }), true,
    'a full task ledger blocks starting Prying Times');
  hasPortTaskSlot = true;
  assert.equal(pryingTimes({ npcId: api.core.NpcIdentifiers.SQUAWKING_STEVE_BEANIE, player, stepId: 'PSw89b' }), false,
    'an available task slot clears the full-ledger condition');
});

test('Priest in Peril unlocks the mausoleum Holy barrier only after completion', () => {
  const { api: base } = mockApi();
  const objects = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (name, actions) => objects.set(name, actions)
      : target[prop],
  });
  require('../plugins/quests/quests/PriestInPeril.Quest')(api);
  const pass = objects.get('Holy barrier')?.['Pass-through'];
  assert.equal(typeof pass, 'function');
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const moves = [];
  const messages = [];
  let stage = 0;
  const player = {
    getAttribute: () => stage,
    moveTo: (location) => moves.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage: (text) => messages.push(text),
  };
  for (stage of [0, 10, 50, quest.completionValue - 1]) {
    assert.equal(pass({ player, objectId: api.core.ObjectIdentifiers.HOLY_BARRIER }), true);
    assert.deepEqual(moves, [], 'unfinished quests cannot cross');
    assert.match(messages.at(-1), /complete Priest in Peril/);
  }
  for (stage of [quest.completionValue, quest.completionValue + 1]) {
    assert.equal(pass({ player, objectId: api.core.ObjectIdentifiers.HOLY_BARRIER }), true);
    assert.deepEqual(moves.at(-1), [3423, 3485, 0]);
    assert.equal(messages.at(-1), 'You pass through the holy barrier.');
  }
  const before = [moves.length, messages.length];
  assert.equal(pass({ player, objectId: api.core.ObjectIdentifiers.HOLY_BARRIER_2 }), false,
    'the Hallowed Sepulchre barrier is handled by its own content');
  assert.deepEqual([moves.length, messages.length], before);
});


test('Catacomb orb spell consumes its real ingredients and reveals only the quest trapdoor', () => {
  const {api,player}=movarioFixture();let charge;const amounts=new Map([[567,1],[564,3],[555,29]]),attributes=new Map();
  api.onSpellOnObject=h=>{charge=h;};
  api.core={...api.core,CacheDefinitions:{getSpellName:()=> 'Charge Water Orb'}};
  player.getAttribute=k=>attributes.get(k);player.setAttribute=(k,v)=>attributes.set(k,v);
  const sender={sendVarbit(){return sender;}};player.getPacketSender=()=>sender;
  player.getSpellbook=()=>api.core.MagicSpellbook.NORMAL;
  player.getSkillManager=()=>({getCurrentLevel:()=>99,addExperience(){}});
  player.getInventory=()=>({getAmount:id=>amounts.get(id)||0,deleteNumber:(id,n)=>amounts.set(id,amounts.get(id)-n)});
  require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,api,stage:()=>480});
  charge({player,objectId:54076,spellWidget:218,spellItemId:-1});
  assert.equal(attributes.get('while-guthix-sleeps:catacomb-open'),undefined);
  assert.equal(amounts.get(567),1);
  amounts.set(555,30);
  charge({player,objectId:54076,spellWidget:218,spellItemId:-1});
  assert.equal(attributes.get('while-guthix-sleeps:catacomb-open'),1);
  assert.deepEqual([...amounts.values()],[0,0,0]);
});

test('Elite Kinshra protection can be bypassed by switching styles and expires in the area', () => {
  const {api,player}=movarioFixture();let area,modify;
  api.registerArea=a=>{area=a;};api.onNpcHitModify=h=>{modify=h;};
  require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,api,stage:()=>490});
  player.isPlayer=()=>true;
  const npc={getId:()=>13463,getArea:()=>area,isNpc:()=>true};let amount=12,type=api.core.CombatType.MELEE;
  const hit={getAttacker:()=>player,getCombatType:()=>type,setTotalDamage:n=>{amount=n;}};
  modify({npc,hit});assert.equal(amount,0);
  type=api.core.CombatType.MAGIC;amount=12;modify({npc,hit});assert.equal(amount,12);
  for(let i=0;i<100;i++)area.process(npc);
  type=api.core.CombatType.MELEE;amount=12;modify({npc,hit});assert.equal(amount,12);
});


test('Surok requires real combat spells and the opposite element for surges', () => {
  const { api } = mockApi(), module = require('../plugins/quests/wgs/Surok.WhileGuthixSleeps');
  const f = module({api}), player = { getCombat: () => ({ getSelectedSpell: () => selected, getCastSpell: () => null, getPreviousCast: () => api.core.CombatSpells.FIRE_WAVE }), sendMessage() {} };
  let selected = null, damage = 20;
  const boss = { forceChat() {} }, surge = {};
  f.fights.set(player,{boss,enemies:new Set([boss,surge])});
  const hit = {getAttacker:()=>player,getCombatType:()=>api.core.CombatType.MAGIC,setTotalDamage:n=>damage=n};
  f.hit({npc:boss,hit});assert.equal(damage,0,'powered staff is blocked even after a previous standard cast');
  selected=api.core.CombatSpells.FIRE_WAVE;damage=20;f.hit({npc:boss,hit});assert.equal(damage,20);
  f.targets.set(surge,{surge:true,index:0});damage=20;f.hit({npc:surge,hit});assert.equal(damage,0,'fire cannot counter earth');
  selected=api.core.CombatSpells.WIND_WAVE;damage=20;f.hit({npc:surge,hit});assert.equal(damage,20);
  const effect={attacker:player,target:boss,spell:api.core.CombatSpells.BLOOD_BARRAGE,allowed:true};
  f.spellEffects(effect);assert.equal(effect.allowed,false,'blood damage must not heal off Surok');
});

test('Surok explosive can only be alchemised after telegrab at its actual position', () => {
  const { api } = mockApi(), f = require('../plugins/quests/wgs/Surok.WhileGuthixSleeps')({api});
  const player={sendMessage(){}},position=new api.core.Location(4143,4850,2),fight={explosive:{position,grabbed:false}};
  f.fights.set(player,fight);
  const policy=()=>({player,itemId:29573,allowed:false,coins:5});
  let e=policy();f.alchemy(e);assert.equal(e.allowed,false);
  f.telegrab({player,itemId:29573,position:new api.core.Location(4142,4850,2)});
  e=policy();f.alchemy(e);assert.equal(e.allowed,false);
  f.telegrab({player,itemId:29573,position});e=policy();f.alchemy(e);assert.equal(e.allowed,true);assert.equal(e.coins,0);
  f.alchemised({player,itemId:29573});assert.equal(fight.explosive,null);
});


test('Movario notes claim the inventory action and require every page before the hand-in flag', () => {
 const {api}=mockApi();let handler,next;
 api.onItemAction=h=>handler=h;api.sendMultiChatboxPrompt=(p,prompt,label,callback)=>next=callback;
 const attributes=new Map(),player={getAttribute:k=>attributes.get(k),setAttribute:(k,v)=>attributes.set(k,v),sendMessage(){}};
 require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')({api,ATTRIBUTES:[],val:(p,k)=>Number(p.getAttribute(k))||0});
 const event={player,itemId:29525,option:'Read'};handler(event);assert.equal(event.handled,true);
 next();next();assert.equal(attributes.get('while-guthix-sleeps:notes-read'),undefined);next();
 assert.equal(attributes.get('while-guthix-sleeps:notes-read'),1);
});


test('McGrubor mercenaries wait for the opening cutscene to finish', () => {
 const {api}=mockApi();let area;api.registerArea=a=>area=a;
 const battles=[];api.spawnNpc=()=>({setMaxHitpoints(){return this},setHitpoints(){return this},setScriptedMovement(){},getHitpoints:()=>140,getCombat:()=>({getLastAttack:()=>({reset(){}})})});
 // The live battle process must not count ticks or attack until its dialogue callback.
 const {PrivateArea}=api.core;
 const original=PrivateArea.prototype.enter;PrivateArea.prototype.enter=function(m){if(m===player)battles.push(this);};
 const player={isPlayer:()=>true,getAsPlayer(){return this;},sendMessage(){}};
 try {require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')({api,stage:()=>200,val:()=>0,ATTRIBUTES:[],play(){},hit(){throw Error('cutscene attacked player');}});
 area.process(player);const battle=battles[0];battle.process(player);assert.equal(battle.ticks,0);
 }finally{PrivateArea.prototype.enter=original;}
});

test('Chasm orb sockets enforce symbols and recover a lost unplaced block',()=>{
 const {api}=mockApi(),a=new Map(),items=new Map([[569,1],[571,1]]),messages=[];
 const sender={sendVarbit(){return sender}};
 const p={getAttribute:k=>a.get(k),setAttribute:(k,v)=>a.set(k,v),getPacketSender:()=>sender,sendMessage:m=>messages.push(m),getInventory:()=>({contains:id=>!!items.get(id),deleteNumber:(id,n)=>items.set(id,(items.get(id)||0)-n)})};
 const f=require('../plugins/quests/wgs/Chasm.WhileGuthixSleeps')({api,ATTRIBUTES:[],stage:()=>720,held:(p,id)=>!!items.get(id),give:(p,id)=>{items.set(id,1);return true},val:(p,k)=>Number(a.get(k))||0});
 f.sessions.set(p,{});
 f.use({player:p,itemId:569,definition:{id:53617}});assert.equal(items.get(569),1);assert.equal(items.get(29554),undefined);
 f.use({player:p,itemId:569,definition:{id:53615}});assert.equal(items.get(569),0);assert.equal(items.get(29554),1);
 items.delete(29554);f.search({player:p,definition:{id:53615}});assert.equal(items.get(29554),1);
 f.use({player:p,itemId:29554,definition:{id:53625},object:{getLocation:()=>new api.core.Location(4147,5094)}});assert.equal(items.get(29554),1);
 f.use({player:p,itemId:29554,definition:{id:53618},object:{getLocation:()=>new api.core.Location(4062,4548,2)}});assert.equal(items.get(29554),0);assert.equal(a.get('while-guthix-sleeps:elemental-blocks'),4);
});

test('Temple has eight distinct persisted statues and consumes only a matching recipe',()=>{
 const {api}=mockApi(),attrs=new Map(),items=new Map([[255,1],[1975,1],[261,1],[2970,1],[573,1]]),drops=[];
 api.core={...api.core,ItemOnGroundManager:{registerLocation:(p,item)=>drops.push(item.getId())}};
 const sender={sendVarbit(){return sender}};
 const p={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),getPacketSender:()=>sender,sendMessage(){},getInventory:()=>({contains:id=>!!items.get(id),deleteNumber:(id,n)=>items.set(id,(items.get(id)||0)-n)})};
 const f=require('../plugins/quests/wgs/Temple.WhileGuthixSleeps')({api,ATTRIBUTES:[],stage:()=>760,held:(p,id)=>!!items.get(id),give:(p,id)=>{items.set(id,1);return true},val:(p,k)=>Number(attrs.get(k))||0,replace(){}});
 p.getLocation=()=>new api.core.Location(4041,4453);p.getPrivateArea=()=>null;
 const random=f.state(p);assert.equal(new Set(random.types).size,8);assert.equal(f.state(p),random);
 const state={types:[2,0,1,3,4,5,6,7],ingredients:Array.from({length:8},()=>[]),finished:0,placed:0,revealed:0};attrs.set('while-guthix-sleeps:temple-puzzle',state);f.sessions.set(p,{});
 const event=id=>({player:p,itemId:id,definition:{id:53644},object:{getLocation:()=>new api.core.Location(4041,4454)},handled:false});
 f.use(event(573));assert.equal(items.get(573),1,'unrelated orb must remain');
 f.use(event(255));assert.equal(items.get(255),0);assert.equal(state.finished,0);
 // Changing to the alternative herb returns the old herb instead of losing it.
 f.use(event(261));assert.deepEqual(drops,[255]);assert.equal(state.finished,0);
 f.use(event(1975));assert.equal(state.finished,0,'crossing two alternate recipes is not a potion');
 f.use(event(2970));assert.equal(state.finished,1);assert.equal(items.get(29540),1);assert.deepEqual(drops,[255,1975]);
 f.use({player:p,itemId:29540,definition:{id:53666}});assert.equal(state.placed,1);assert.equal(items.get(29540),0);
 items.set(29540,1);f.use({player:p,itemId:29540,definition:{id:53666}});assert.equal(items.get(29540),1,'the same statue cannot supply two table positions');
});

test('Balance Elemental protection changes require switching all three styles',()=>{
 const {api}=mockApi(),f=require('../plugins/quests/wgs/Stone.WhileGuthixSleeps')({api}),p={},boss={getHitpoints:()=>hp,setHeadIcon:n=>icon=n};
 let hp=750,icon,damage=20,type=api.core.CombatType.MELEE;
 const a={boss,protection:[],lastStyle:0};f.sessions.set(p,a);
 const hit={getAttacker:()=>p,getCombatType:()=>type,getTotalDamage:()=>damage,setTotalDamage:n=>damage=n};
 f.protect(a,0);assert.deepEqual(a.protection,[]);assert.equal(icon,-1);
 hp=500;f.protect(a,0);f.modify({npc:boss,hit});assert.equal(damage,0);
 type=api.core.CombatType.RANGED;damage=20;f.modify({npc:boss,hit});assert.equal(damage,20);assert.equal(a.lastStyle,1);
 hp=180;f.protect(a,1);assert.deepEqual(a.protection,[1,2]);
 for(const t of [api.core.CombatType.RANGED,api.core.CombatType.MAGIC]){type=t;damage=20;f.modify({npc:boss,hit});assert.equal(damage,0);}
 type=api.core.CombatType.MELEE;damage=20;f.modify({npc:boss,hit});assert.equal(damage,20);
});

test('Balance Elemental checks protection at impact rather than its wind-up',()=>{
 const {api}=mockApi();let boss,damage=0;
 api.core={...api.core,World:{getNpcs:()=>({get:()=>boss})},RegionManager:{canProjectileAttackBounds:()=>true}};
 const prayers=[],p={getPrayerActive:()=>prayers,getHitpoints:()=>99,getLocation:()=>new api.core.Location(4134,4380)};
 const f=require('../plugins/quests/wgs/Stone.WhileGuthixSleeps')({api,stage:()=>805,hit:(p,n)=>damage+=n});
 const a=new f.StoneArea(p);boss={getHitpoints:()=>750,getIndex:()=>1,performAnimation(){},getLocation:()=>new api.core.Location(4135,4383)};a.boss=boss;a.started=true;
 for(let i=0;i<6;i++)a.process(p);assert.equal(a.pending.length,1);assert.equal(a.pending[0].tick,8);
 prayers[api.core.PrayerHandler.PROTECT_FROM_MISSILES]=true;
 a.process(p);a.process(p);assert.equal(damage,0);assert.equal(a.pending.length,0);
});


test('Surok ladder uses the guard transcript before entering, with separate disguise branches', () => {
 const {api}=mockApi();let robe=false,elite=false,played;
 const player={getEquipment:()=>({contains:id=>([29566,29568,29570].includes(id)&&robe)||([29560,29562,29564].includes(id)&&elite)})};
 const f=require('../plugins/quests/wgs/Surok.WhileGuthixSleeps')({api,stage:()=>580,play:(p,id,variant)=>{played={id,variant};}});
 const branch=id=>f.guardCondition({player,stepId:id,pages:[{page:'While Guthix Sleeps'}]});
 assert.equal(branch('a-SLUY'),true);elite=true;assert.equal(branch('a-SLUY'),false);assert.equal(branch('KE9ZPi'),true);
 elite=false;robe=true;assert.equal(branch('sRYfCo'),true);assert.equal(branch('3gavgP'),false);
 f.climb({player,objectId:53370});assert.equal(played.id,13566);assert.equal(f.fights.has(player),false);
 assert.equal(branch('sRYfCo'),false);assert.equal(branch('3gavgP'),true);
 const e={player,npcId:13566,text:'Yes master!'};f.line(e);assert.equal(typeof e.after,'function');
});

test('Movario gas confiscates research notes from every bank tab', () => {
 const {api,handlers,player,attributes}=movarioFixture();
 const banks=Array.from({length:api.core.Bank.TOTAL_BANK_TABS},()=>new Map([[29525,1],[29526,2]]));
 player.getBank=tab=>({getAmount:id=>banks[tab].get(id)||0,deleteNumber:id=>banks[tab].delete(id)});
 player.getInventory=()=>({getItems:()=>[],getAmount:()=>1,deleteNumber(){}});
 player.getLocation=()=>new api.core.Location(4186,4953,1);
 attributes.set('while-guthix-sleeps:pressure-gauge',10);attributes.set('while-guthix-sleeps:door-tries',2);
 require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);
 handlers.custom.get('wgs:enter-movario')({player});
 handlers.objects.find(h=>h.name==='Door').options.Open({player,objectId:53897});
 assert.ok(banks.every(bank=>bank.size===0));assert.deepEqual(player.position,[4128,4938,0]);
});

test('Temple vine picking allows the three flowers needed to refill a pouch', () => {
 const {api}=movarioFixture();let flowers=0,replaced=0,space=3;
 const player={getInventory:()=>({getFreeSlots:()=>space,adds:(id,n)=>{assert.equal(id,29556);flowers+=n;space-=n;}}),sendMessage(){}};
 const f=require('../plugins/quests/wgs/Temple.WhileGuthixSleeps')({api,ATTRIBUTES:[],replace:()=>replaced++});f.sessions.set(player,{});
 const event={player,definition:{id:53724},object:{getLocation:()=>new api.core.Location(4080,4450),getType:()=>22,getFace:()=>0}};
 for(let i=0;i<3;i++)assert.equal(f.pick(event),true);
 assert.equal(flowers,3);assert.equal(replaced,3);f.pick(event);assert.equal(flowers,3,'a full inventory leaves the vine intact');
});


test('Druid pouch refills existing charges using three produce, preferring pears and stems', () => {
 const {api}=mockApi(),handlers=[];
 api.onItemAction=handler=>handlers.push(handler);
 require('../plugins/quests/quests/NatureSpirit.Quest')(api);
 const items=new Map([[2958,6],[2974,2],[2972,1],[29556,3]]);
 const inventory={contains:id=>(items.get(id)||0)>0,getAmount:id=>items.get(id)||0,deleteNumber:(id,n)=>items.set(id,(items.get(id)||0)-n),adds:(id,n)=>items.set(id,(items.get(id)||0)+n)};
 const player={getInventory:()=>inventory,sendMessage(){}};
 const fill=()=>{const e={player,itemId:2958,option:'Fill'};for(const handler of handlers)handler(e);assert.equal(e.handled,true);};
 fill();assert.equal(items.get(2958),14);assert.equal(items.get(29556),3);assert.equal(items.get(2974),0);assert.equal(items.get(2972),0);
 fill();assert.equal(items.get(2958),17);assert.equal(items.get(29556),0);
 items.set(29556,2);fill();assert.equal(items.get(2958),17);assert.equal(items.get(29556),2,'insufficient produce stays intact');
});

test('Akrisae’s Ice Mountain teleport requires the castle chapter and can be used once', () => {
 const {api,handlers,player,attributes}=movarioFixture();let progress=400,resets=0;
 player.getCombat=()=>({reset:()=>resets++});player.getLocation=()=>new api.core.Location(2990,3342,0);
 require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,stage:()=>progress});
 const teleport=handlers.custom.get('npc-dialogue:choice'),e={player,npcId:13543,stepId:'wgs-ice-mountain'};
 teleport(e);assert.deepEqual(player.position,[3006,3499,0]);assert.equal(attributes.get('while-guthix-sleeps:ice-mountain-teleport'),1);
 player.position=null;teleport(e);assert.equal(player.position,null);assert.equal(resets,1);
 progress=490;attributes.delete('while-guthix-sleeps:ice-mountain-teleport');teleport(e);assert.equal(player.position,null);
});

test('Duradel’s notes can be reclaimed until read and only grant Slayer XP once', () => {
 const {api}=mockApi(),attrs=new Map(),items=new Map();let banked=false,xp=0;
 const inventory={contains:id=>(items.get(id)||0)>0,getFreeSlots:()=>28,deleteNumber:(id,n)=>items.set(id,(items.get(id)||0)-n),adds:(id,n)=>items.set(id,(items.get(id)||0)+n)};
 const player={getInventory:()=>inventory,getBank:()=>({contains:()=>banked}),getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),getSkillManager:()=>({getCurrentLevel:()=>70,addExperience:(skill,amount)=>{assert.equal(skill,api.core.Skill.SLAYER);xp+=amount;}}),sendMessage(){}};
 const f=require('../plugins/quests/wgs/Rewards.WhileGuthixSleeps')({api,stage:()=>900,held:(p,id)=>inventory.contains(id),give:(p,id)=>{inventory.adds(id,1);return true;},val:(p,k)=>attrs.get(k)||0,ATTRIBUTES:[]});
 const condition=id=>f.condition({player,stepId:id,pages:[{page:'While Guthix Sleeps'}]});
 assert.equal(condition('omXWyi'),true);f.action({player,npcId:13623,stepId:'PGNPip'});assert.equal(items.get(29596),1);
 inventory.deleteNumber(29596,1);banked=true;assert.equal(condition('lIknwQ'),false);banked=false;assert.equal(condition('lIknwQ'),true);
 f.action({player,npcId:13623,stepId:'PGNPip'});f.read({player,itemId:29596,option:'Read'});assert.equal(xp,1050);assert.equal(items.get(29596),0);
 f.action({player,npcId:13623,stepId:'PGNPip'});assert.equal(items.get(29596),0);inventory.adds(29596,1);f.read({player,itemId:29596,option:'Read'});assert.equal(xp,1050);
});


test('Movario resource pallets preserve the unnoted remainder when inventory fills', () => {
 const {api,handlers,player,attributes}=movarioFixture();let slots=3;const items=new Map();
 player.getInventory=()=>({getItems:()=>[],contains:id=>items.has(id),getFreeSlots:()=>slots,getAmount:id=>items.get(id)||0,adds:(id,n)=>{items.set(id,(items.get(id)||0)+n);if(id===453||id===1513)slots-=n;}});
 const old=api.core.ItemDefinition;api.core.ItemDefinition={forId:id=>({isStackable:()=>[554,560].includes(id)})};
 require('../plugins/quests/wgs/Movario.WhileGuthixSleeps')(api.context);handlers.custom.get('wgs:enter-movario')({player});
 const coal=handlers.objects.find(h=>h.name==='Coal pile').options['Take-from'];coal({player,definition:{id:53958}});assert.equal(items.get(453),3);assert.equal(player.varbits.get(10793),97);
 coal({player,definition:{id:53958}});assert.equal(items.get(453),3);slots=28;coal({player,definition:{id:53958}});assert.equal(items.get(453),31);assert.equal(player.varbits.get(10793),69);
 slots=1;handlers.objects.find(h=>h.name==='Fire rune pile').options['Take-from']({player,definition:{id:53964}});assert.equal(items.get(554),100);assert.equal(player.varbits.get(10794),0);
 assert.deepEqual(attributes.get('while-guthix-sleeps:base-resources'),[31,100,0,0]);api.core.ItemDefinition=old;
});


test('Quest tormented demons display their starting melee protection prayer', () => {
 const {api}=mockApi(),spawned=[];let progress=820;
 const player={getMovementQueue:()=>({setBlockMovement(){}}),getSkillManager:()=>({setCurrentLevel(){}}),sendMessage(){}};
 api.spawnNpc=spec=>{const n={...spec,setMaxHitpoints(){return n;},setHitpoints(){return n;},setScriptedMovement(){},setHeadIcon:icon=>n.headIcon=icon,performGraphic(){}};spawned.push(n);return n;};
 const f=require('../plugins/quests/wgs/Stone.WhileGuthixSleeps')({api,stage:()=>progress,advance:(p,next)=>progress=next,replace(){}}),area={player,cast:new Set(),enter(){},ticks:0};
 f.startDemons(area);assert.equal(progress,850);assert.equal(area.demons.length,2);
 for(const n of area.demons){assert.equal(n.headIcon,0);assert.equal(f.demonStates.get(n).prayer,0);}
});

test('WGS completed alliance talks stay post-quest and Silif only replaces missing robes', () => {
 const {api}=mockApi(),played=[],given=[];let slots=1;
 const player={getLocation:()=>new api.core.Location(2990,3343),getEquipment:()=>({contains:id=>id===29566}),getBank:()=>({contains:id=>id===29568}),getInventory:()=>({getFreeSlots:()=>slots}),sendMessage(){}};
 const f=require('../plugins/quests/wgs/Alliance.WhileGuthixSleeps')({api,stage:()=>900,held:()=>false,give:(p,id)=>given.push(id),play:(p,id,variant)=>played.push(variant)});
 for(const npcId of[13540,13543,13511])assert.equal(f.group({player,npcId}),true);
 assert.deepEqual(played,['post-quest-dialogue-talking-to-idria','post-quest-dialogue-talking-to-akrisae','post-quest-dialogue-talking-to-thaerisk']);
 f.action({player,npcId:13519,stepId:'h_h2X8'});assert.deepEqual(given,[29570]);
 slots=0;f.action({player,npcId:13519,stepId:'h_h2X8'});assert.deepEqual(given,[29570]);
});


test('Completed WGS restores the alliance and captured Surok on login', () => {
 const {api}=mockApi(),spawned=[];let login;
 api.onPlayerLogin=h=>login=h;api.spawnNpc=spec=>{spawned.push(spec);return spec;};
 const player={getLocation:()=>new api.core.Location(2989,3343),getPacketSender:()=>({sendVarbit(){return this;}})};
 require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')({api,stage:()=>900,val:()=>0,ATTRIBUTES:[]});
 login({player});assert.deepEqual(spawned.map(n=>n.id),[13540,13543,13511,13519,13548]);
 assert.ok(spawned.every(n=>n.owner===player&&n.ownerOnly));
 const played=[],f=require('../plugins/quests/wgs/Alliance.WhileGuthixSleeps')({api,stage:()=>900,play:(p,id,v)=>played.push([id,v])});
 assert.equal(f.postQuestTalk({player,npcId:13548}),true);assert.equal(played[0][1],'post-quest-dialogue-talking-to-surok');
 assert.equal(f.postQuestTalk({player,npcId:13522}),false);
});


test('Thaerisk offers an explicit choice before the Port Sarim teleport after giving the seed', () => {
 const data=require('../data/definitions/npc-dialogues.json')['While Guthix Sleeps'].variants;
 const steps=data['forming-a-fellowship-capturing-a-spy-talking-to-the-group-after-planting-a-teleorb'].at(-1).options[0].steps;
 const choice=steps.find(s=>s.type==='choice');assert.deepEqual(choice.options.map(o=>o.text),['Yes.','No.']);
 assert.equal(choice.options[0].steps.find(s=>s.type==='action').id,'wgs-sarim-after-seed');
 assert.ok(!choice.options[1].steps.some(s=>s.type==='action'));assert.ok(!steps.some(s=>s.type==='jump'));
});


test('Lantern lenses and unpowered orbs are glassblown without consuming the pipe', () => {
 const {api}=mockApi(),handlers=[],items=new Map([[1785,1],[1775,2]]);let choices,level=48,xp=0;
 api.onItemOnItem=h=>handlers.push(h);api.sendMultiChatboxPrompt=(p,title,...opts)=>choices=opts;
 require('../plugins/skills/Crafting.plugin').register(api);
 const inventory={contains:id=>(items.get(id)||0)>0,deleteNumber:(id,n)=>items.set(id,items.get(id)-n),addItem:i=>items.set(i.getId(),(items.get(i.getId())||0)+i.getAmount())};
 const player={getInventory:()=>inventory,getSkillManager:()=>({getCurrentLevel:()=>level,addExperiences:(s,n)=>xp+=n}),sendMessage(){}};
 const e={player,usedItemId:1785,usedWithItemId:1775};handlers.forEach(h=>h(e));assert.equal(e.handled,true);
 assert.deepEqual([choices[0],choices[2]],['unpowered orb','lantern lens']);choices[3]();assert.equal(items.get(1775),2);
 level=49;choices[3]();assert.equal(items.get(4542),1);assert.equal(xp,55);assert.equal(items.get(1785),1);
 choices[1]();assert.equal(items.get(567),1);assert.equal(items.get(1775),0);assert.equal(xp,107.5);
 choices[3]();assert.equal(items.get(4542),1,'a stale menu cannot create more glass');
});
