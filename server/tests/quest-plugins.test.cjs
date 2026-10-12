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
    npcHitModify: [],
    npcBeforeDeath: [],
    npcDeath: [],
    custom: new Map(),
  };
  const noop = () => {};
  const base = {
    core: PluginManager.getCoreApi(),
    onNpcDialogueVariant: (h) => handlers.variant.push(h),
    onNpcDialogueCondition: (h) => handlers.condition.push(h),
    onNpcHitModify: (h) => handlers.npcHitModify.push(h),
    onNpcBeforeDeath: (h) => handlers.npcBeforeDeath.push(h),
    onNpcDeath: (h) => handlers.npcDeath.push(h),
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


test('WGS restores native Slayer and Warriors Guild replacement states on login', () => {
 const {api}=mockApi();let login,progress=300;const bits=new Map();
 api.onPlayerLogin=h=>login=h;
 const sender={sendVarbit:(id,v)=>{bits.set(id,v);return sender;}};
 const player={getPacketSender:()=>sender,getLocation:()=>new api.core.Location(2869,2982,1)};
 require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')({api,stage:()=>progress,val:()=>0,ATTRIBUTES:[]});
 for(const [stage,slayer,guild] of [[0,0,0],[300,1,0],[340,1,1],[650,2,2],[900,2,2]]){
  progress=stage;login({player});assert.equal(bits.get(10782),slayer);assert.equal(bits.get(10792),guild);
 }
 const spawns=require('../data/definitions/npc-spawns.json');
 assert.equal(spawns.find(n=>n.name==='Duradel').id,13654);assert.equal(spawns.find(n=>n.name==='Turael').id,13651);
 assert.equal(spawns.find(n=>n.name==='Laidee Gnonock').id,13647);
});

test('Night at the Theatre obtains and hands in the head once, and scopes shared dialogue conditions', () => {
  const objects = new Map(), customs = new Map();
  let conditions, route;
  const { api: base } = mockApi();
  const core = { ...base.core, PrivateArea: class { enter(p) { p.area = this; } add() {} }, ObjectManager: { register() {} }, NpcDefinition: { forId: (id) => ({ getName: () => id === 10875 ? 'Mysterious Stranger' : 'Man' }) } };
  const api = new Proxy(base, { get(target, prop) {
    if (prop === 'core') return core;
    if (prop === 'onObjectInteraction') return (name, actions) => objects.set(name, actions);
    if (prop === 'onCustomEvent') return (name, handler) => customs.set(name, handler);
    if (prop === 'onNpcDialogueCondition') return (handler) => { conditions = handler; };
    if (prop === 'onObjectRoute') return (handler) => { route = handler; };
    if (prop === 'emitCustomEvent') return (name, event) => { if (name === 'quest:is-complete') event.complete = true; };
    return target[prop];
  } });
  require('../plugins/quests/quests/ANightAtTheTheatre.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const attributes = new Map(), items = new Map(), messages = [];
  let free = 28;
  const inventory = {
    contains: (id) => (items.get(id) ?? 0) > 0,
    getAmount: (id) => items.get(id) ?? 0,
    getFreeSlots: () => free,
    adds: (id, count) => { items.set(id, (items.get(id) ?? 0) + count); },
    deleteNumber: (id, count) => { items.set(id, Math.max(0, (items.get(id) ?? 0) - count)); },
  };
  const sender = new Proxy({}, { get: () => () => sender });
  const player = {
    getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory, getPacketSender: () => sender, sendMessage: (text) => messages.push(text),
  };
  customs.get('npc-dialogue:hook')({ player, hook: 'quest:a-night-at-the-theatre:start' });
  assert.equal(quest.getStage(player), 10);
  const search = objects.get('Coffin').Search;
  search({ player, objectId: 30243 });
  assert.equal(inventory.contains(core.ItemIdentifiers.RANIS_HEAD), false, 'a saw is needed');
  items.set(core.ItemIdentifiers.SAW, 1);
  free = 0;
  search({ player, objectId: 30243 });
  assert.equal(inventory.contains(core.ItemIdentifiers.RANIS_HEAD), false, 'a full inventory does not lose the head');
  free = 1;
  search({ player, objectId: 30243 });
  search({ player, objectId: 30243 });
  assert.equal(inventory.getAmount(core.ItemIdentifiers.RANIS_HEAD), 1);
  const handIn = { player, npcId: 10875, stepId: 'T6VA-h' };
  customs.get('npc-dialogue:action')(handIn);
  customs.get('npc-dialogue:action')(handIn);
  assert.equal(quest.getStage(player), 14);
  assert.equal(inventory.getAmount(core.ItemIdentifiers.RANIS_HEAD), 0);
  customs.get('npc-dialogue:action')({ player, npcId: 1, stepId: 'evA_XO' });
  assert.equal(quest.getStage(player), 14, 'another NPC cannot advance a memory');
  customs.get('npc-dialogue:action')({ player, npcId: 10875, stepId: 'evA_XO' });
  assert.equal(quest.getStage(player), 20);
  const memoryEnd = { player, npcId: 10875, text: "I'm not sure why I asked. I'll be back once I've explored this nest." };
  customs.get('npc-dialogue:line')(memoryEnd);
  assert.equal(quest.getStage(player), 20, 'the briefing stays replayable until the last line is continued');
  memoryEnd.after();
  assert.equal(quest.getStage(player), 22);
  assert.equal(conditions({ player, stepId: 'RPwP26', pages: [{ page: 'Another quest' }] }), undefined);
  assert.equal(conditions({ player, stepId: 'RPwP26', pages: [{ page: 'A Night at the Theatre' }] }), false);
  let position = new core.Location(3497, 3355, 0);
  player.getLocation = () => position;
  player.moveTo = next => { position = next; };
  player.getArea = () => player.area;
  const request = { player, objectId: 42588, object: { getLocation: () => new core.Location(3499, 3355, 0) } };
  route(request);
  assert.deepEqual(request.destination, { x: 3497, y: 3355, z: 0 }, 'approach from the bank, not the water tile');
  objects.get('Stepping stone').Cross(request);
  assert.equal(player.area.isMulti(), true, 'Hespori cannot lock the player out of attacking its flowers');
  assert.deepEqual([position.getX(), position.getY()], [3501, 3355]);

  quest.setStage(player, 80);
  const lamp = core.ItemIdentifiers.ANTIQUE_LAMP_23;
  attributes.set('night-at-the-theatre:lamps-used', 1);
  player.getBank = () => ({ getAmount: id => id === lamp ? 2 : 0 });
  free = 28;
  const requestLamps = { player, handled: false };
  customs.get('night-at-the-theatre:claim-lamps')(requestLamps);
  assert.equal(requestLamps.handled, true);
  assert.equal(inventory.getAmount(lamp), 1, 'banked lamps count toward the four-lamp reward');
  customs.get('night-at-the-theatre:claim-lamps')(requestLamps);
  assert.equal(inventory.getAmount(lamp), 1, 'repeat claims cannot duplicate unused lamps');

});

test('Entry Mode notice board starts its party prompt from the live cache object id', () => {
  const { api } = mockApi();
  const interactions=[];let prompt;
  api.onObjectInteraction=(name,options)=>interactions.push([name,options]);
  api.sendMultiChatboxPrompt=(...args)=>{prompt=args;};
  const entry=require('../plugins/minigames/tob/Entry.TheatreOfBlood');entry(api);
  const player={attributes:new Map(),setAttribute(k,v){this.attributes.set(k,v);},sendMessage(){}};
  const actions=interactions.find(([name])=>name==='Notice board')[1];
  const read=actions.Read;
  assert.equal(typeof actions.read,'function','the live cache interaction may be lowercased by ObjectDefinition');
  assert.equal(read({player,objectId:32655,definition:{id:24099}}),true);
  assert.equal(prompt[1],'Theatre of Blood: solo Entry Mode');
  assert.equal(prompt[2],'Create a party.');
  prompt[3]();
  assert.equal(player.attributes.get('tob:entry-party'),true);
});

test('Entry Mode Nylocas requires the correct style and Verzik transitions preserve one HP', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const damages = [], healed = [];
  const player = {
    getHitpoints: () => 99,
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => damages.push(...hits) }) }),
    getEquipment: () => ({ get: () => ({ getId: () => api.core.ItemIdentifiers.DAWNBRINGER }) }),
  };
  const target = {
    getHitpoints: () => 10,
    getCombat: () => ({ getHitQueue: () => ({ getQueuedDamage: () => 3 }) }),
    heal: (amount) => healed.push(amount),
  };
  const raid = { player, room: 2, boss: target };
  entry._test.NPC_RAIDS.set(target, { raid, style: 1 });
  let amount = 17;
  const hit = { getTotalDamage: () => amount, setTotalDamage: (value) => { amount = value; }, getCombatType: () => api.core.CombatType.MELEE };
  entry._test.dealtDamage({ player, target, hit });
  assert.equal(amount, 0);
  assert.deepEqual(healed, [17]);
  assert.equal(damages.length, 1, 'a wrong boss style reflects the hit');
  amount = 9;
  hit.getCombatType = () => api.core.CombatType.RANGED;
  entry._test.dealtDamage({ player, target, hit });
  assert.equal(amount, 9, 'the correct style damages the boss');
  entry._test.NPC_RAIDS.set(target, { raid, style: 1, nylo: true });
  raid.boss = null;
  amount = 9; hit.getCombatType = () => api.core.CombatType.MELEE;
  entry._test.dealtDamage({ player, target, hit });
  assert.equal(amount, 0, 'a small nylo ignores the wrong style');
  amount = 9; hit.getCombatType = () => api.core.CombatType.RANGED;
  entry._test.dealtDamage({ player, target, hit });
  assert.equal(amount, 0, 'the player stays locked out of that nylo after a wrong style');
  const freshNylo = { ...target };
  entry._test.NPC_RAIDS.set(freshNylo, { raid, style: 1, nylo: true });
  amount = 9;
  entry._test.dealtDamage({ player, target: freshNylo, hit });
  assert.equal(amount, 9, 'the same player can damage a different nylo with the right style');
  entry._test.NPC_RAIDS.set(target, { raid });
});

test('Entry Verzik phase caps run before damage so lethal hits cannot skip a phase', () => {
  const { api, handlers } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  let hp = 100, queued = 0, weapon = 12926, amount = 120;
  const player = { getEquipment: () => ({ get: () => ({ getId: () => weapon }) }) };
  const npc = {
    getHitpoints: () => hp,
    getCombat: () => ({ getHitQueue: () => ({ getQueuedDamage: () => queued }) }),
  };
  const raid = { player, boss: npc, room: 5, phase: 0 };
  entry._test.NPC_RAIDS.set(npc, { raid });
  const hit = { getTotalDamage: () => amount, setTotalDamage: (value) => { amount = value; } };
  assert.equal(handlers.npcHitModify.length, 1, 'registers the damage gate before NPC HP is reduced');
  handlers.npcHitModify[0]({ npc, hit });
  assert.equal(amount, 10, 'non-Dawnbringer phase-zero damage is capped before impact');
  hp = 6; queued = 0; amount = 120;
  handlers.npcHitModify[0]({ npc, hit });
  assert.equal(amount, 5, 'an overkill hit leaves one HP for the phase transition');
  hp -= amount;
  assert.equal(hp, 1);
  raid.phase = 1; hp = 9; queued = 4; amount = 120;
  handlers.npcHitModify[0]({ npc, hit });
  assert.equal(amount, 4, 'already queued damage also cannot skip phase two');
  raid.phase = 2; hp = 9; queued = 0; amount = 120;
  handlers.npcHitModify[0]({ npc, hit });
  assert.equal(amount, 120, 'the final phase can be killed normally');
});

test('Entry Verzik red summon converts hits to healing for eight ticks, independent of red crab deaths', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const player = {};
  let dealt = 20, healed = 0;
  const boss = { heal: amount => { healed += amount; } };
  const raid = { player, boss, room: 5, tick: 7, redShield: 8 };
  entry._test.NPC_RAIDS.set(boss, { raid });
  const hit = {
    getTotalDamage: () => dealt,
    setTotalDamage: amount => { dealt = amount; },
    getCombatType: () => api.core.CombatType.RANGED,
  };

  entry._test.dealtDamage({ player, target: boss, hit });
  assert.equal(dealt, 0);
  assert.equal(healed, 20);

  // The Wiki specifies an eight-tick conversion window within the 12-tick
  // summon. Killing both crabs does not shorten that window or extend it.
  raid.tick = 8;
  dealt = 20;
  entry._test.dealtDamage({ player, target: boss, hit });
  assert.equal(dealt, 20);
  assert.equal(healed, 20);
});

test('Entry Verzik queued overkill deaths advance phases and only the live 600 HP form completes the room', () => {
  const { api, handlers } = mockApi();
  api.core = { ...api.core, GameObject: class {}, ObjectManager: { register() {}, deregister() {} } };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  let hp=1, queued=1, maxHp=300, amount=100;
  const queue={getQueuedDamage:()=>queued,clear(){queued=0;}};
  const npc={
    getHitpoints:()=>hp,getCombat:()=>({getHitQueue:()=>queue}),
    setHitpoints(value){hp=value;return this;},setMaxHitpoints(value){maxHp=value;return this;},
    setNpcTransformationId(){return this;},moveTo(){return this;},
  };
  const player={
    getEquipment:()=>({get:()=>({getId:()=>api.core.ItemIdentifiers.DAWNBRINGER})}),
    getCombat:()=>({reset(){}}),setHitpoints(){},
    getSkillManager:()=>({getMaxLevel:()=>99,setCurrentLevel(){}}),
    getPacketSender:()=>({sendVarbit(){}}),sendMessage(){},
  };
  const raid={player,boss:npc,room:5,phase:0,pillars:[],complete:false,started:true,dead:false,
    npcs:new Set(),objects:new Set(),effects:[],pools:[],area:{}};
  entry._test.NPC_RAIDS.set(npc,{raid});
  assert.equal(handlers.npcBeforeDeath.length,1);
  assert.equal(handlers.npcDeath.length,1);

  const hit={getTotalDamage:()=>amount,setTotalDamage:value=>{amount=value;}};
  handlers.npcHitModify[0]({npc,hit});
  assert.equal(amount,0,'a second queued overkill hit is suppressed at the one-HP boundary');

  hp=0;
  const phaseZeroDeath={npc,preventDeath:false};
  handlers.npcBeforeDeath[0](phaseZeroDeath);
  assert.equal(phaseZeroDeath.preventDeath,true);
  assert.equal(raid.phase,1);
  assert.equal(hp,400);
  assert.equal(maxHp,400);
  assert.equal(queued,0,'queued phase-zero hits are discarded during the transition');
  handlers.npcDeath[0]({npc});
  assert.equal(raid.complete,false,'a delayed phase-zero death callback cannot finish the raid');

  hp=0;
  const phaseOneDeath={npc,preventDeath:false};
  handlers.npcBeforeDeath[0](phaseOneDeath);
  assert.equal(phaseOneDeath.preventDeath,true);
  assert.equal(raid.phase,2);
  assert.equal(hp,600);
  assert.equal(maxHp,600);
  handlers.npcDeath[0]({npc});
  assert.equal(raid.complete,false,'a delayed phase-one death callback cannot finish the restored final form');

  hp=0;
  const staleNpc={};
  entry._test.NPC_RAIDS.set(staleNpc,{raid});
  handlers.npcDeath[0]({npc:staleNpc});
  assert.equal(raid.complete,false,'a stale NPC death cannot complete the current boss encounter');
  handlers.npcDeath[0]({npc});
  assert.equal(raid.complete,true,'the current phase-two form completes only after it reaches zero HP');
});

test('Entry Mode bandages apply the one-minute stamina effect and Dawnbringer is limited to Verzik phase one', () => {
  const { api, handlers } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  let stamina;
  api.emitCustomEvent = (name, payload) => { if (name === 'potions:apply-stamina') stamina = payload; };
  let hitpoints = 40, energy = 10, deleted = 0;
  const player = {
    getInventory: () => ({ deleteNumber: (id, amount) => { deleted += amount; } }),
    getSkillManager: () => ({ getMaxLevel: () => 99, increaseCurrentLevel() {} }),
    heal: amount => { hitpoints += amount; },
    getRunEnergy: () => energy,
    setRunEnergy: value => { energy = value; },
  };
  const raid = { player, room: 5, phase: 0, boss: {} };
  entry._test.RAIDS.set(player, raid);
  const bandage = { player, itemId: api.core.ItemIdentifiers.BANDAGES_4, option: 'Heal' };
  entry._test.item(bandage);
  assert.equal(bandage.handled, true);
  assert.equal(deleted, 1);
  assert.equal(hitpoints, 60);
  assert.equal(energy, 30);
  assert.equal(stamina.player, player);
  assert.equal(stamina.durationMs, 60_000);

  const allow = handlers.custom.get('combat-special:can-use')[0];
  const request = { specialId: 'dawnbringer', attacker: player, target: raid.boss, allow: false };
  allow(request);
  assert.equal(request.allow, true);
  request.target = {};
  request.allow = false;
  allow(request);
  assert.equal(request.allow, false, 'a different target is denied');
  request.target = raid.boss;
  raid.phase = 1;
  allow(request);
  assert.equal(request.allow, false, 'Dawnbringer is disallowed after Verzik leaves the throne');
  request.specialId = 'another-special';
  raid.phase = 0;
  allow(request);
  assert.equal(request.allow, false, 'the policy does not modify other specials');
});

test('Entry Nylocas waves match the complete 31-wave Wiki schedule and encode large, aggressive and flickering variants', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const { NYLO_WAVES, readNyloSpec } = entry._test;
  assert.equal(NYLO_WAVES.length, 31);
  assert.deepEqual(NYLO_WAVES[0], ['m', 'a', 'r!']);
  assert.deepEqual(NYLO_WAVES[9], ['r!+R', 'r+r', 'r+r!']);
  assert.deepEqual(NYLO_WAVES[20], ['r/m/r+r!', 'm/r/m+m!', 'a/m/r+a/r/a']);
  assert.deepEqual(NYLO_WAVES[27], ['a/m/a+r/a/m', 'm/r/m+a/m/r', 'm/r/m+r/m/a!']);
  assert.deepEqual(NYLO_WAVES[28], ['a/r/m+r/m/a!', 'M', 'm/r/a!+r/m/r']);
  assert.deepEqual(NYLO_WAVES[30], ['a/r/a+r/m/r', 'm/a/r+a/m/r', 'm/r/a+r/a/r']);
  for (const wave of NYLO_WAVES) {
    assert.equal(wave.length, 3, 'each chart row has east, south and west lanes');
    for (const group of wave) for (const spec of group.split('+').filter(Boolean)) {
      const parsed = readNyloSpec(spec);
      assert.ok(parsed.styles.length === 1 || parsed.styles.length === 3, spec);
      assert.ok(parsed.styles.every(style => style === 0 || style === 1 || style === 2), spec);
      assert.equal(parsed.big, /^[MRA]/.test(spec), spec);
    }
  }
  assert.deepEqual(readNyloSpec('R/a/m!'), { aggressive: true, big: true, styles: [1, 2, 0] });
});

test('Entry Nylocas first wave follows the room-entry 4-tick cycle', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const { firstNyloWaveAt } = entry._test;
  assert.equal(firstNyloWaveAt(100, 100), 106, 'the first wave is on the second cycle');
  assert.equal(firstNyloWaveAt(100, 101), 106, 'a cycle phase is anchored to entering the room');
  assert.equal(firstNyloWaveAt(102, 102), 106, 'entering on the first cycle still waits for the second');
  assert.equal(firstNyloWaveAt(100, 106), 110, 'late barrier entry waits for the next room cycle');
});

test('Entry Nylocas pillars use the inferred solo inverse-scale cache baseline', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  assert.equal(entry._test.soloNyloPillarHitpoints(155), 775);
  assert.equal(entry._test.soloNyloPillarHitpoints(130), 650);
});

test('Entry Nylocas count death animations when checking wave caps', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const { activeNylocas, NPC_RAIDS } = entry._test;
  const dying = { getHitpoints: () => 0, isDyingFunction: () => true };
  const alive = { getHitpoints: () => 1, isDyingFunction: () => false };
  const unrelated = { getHitpoints: () => 1, isDyingFunction: () => false };
  const raid = { npcs: [dying, alive, unrelated] };
  NPC_RAIDS.set(dying, { nylo: true, raid });
  NPC_RAIDS.set(alive, { nylo: true, raid });
  NPC_RAIDS.set(unrelated, { raid });
  assert.equal(activeNylocas(raid), 2);
  assert.equal(activeNylocas(raid, dying), 1);
});

test('Entry Nylocas retain wiki natural death timing and split only after the large death animation', () => {
  const { api } = mockApi();
  api.core = { ...api.core, CacheDefinitions: { getNpc: () => ({ hitpoints: 2 }) } };
  let nextId = 1;
  const removed = [];
  api.spawnNpc = ({ id, x, y, z }) => {
    const npc = {
      id, hp: 2, location: new api.core.Location(x,y,z),
      setMaxHitpoints(value) { this.maxHp = value; return this; },
      setHitpoints(value) { this.hp = value; return this; },
      setScriptedMovement() {},
      getMovementQueue: () => ({ setBlockMovement() {} }),
      getLocation() { return this.location; },
      getHitpoints() { return this.hp; },
      isDyingFunction() { return false; },
    };
    npc.id = id || nextId++;
    return npc;
  };
  api.removeNpc = npc => removed.push(npc);
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const { activeNylocas, NPC_RAIDS, updateNyloExpiry } = entry._test;
  const area = entry._test.createArea();
  area.enter = () => {};
  const player = { getLocation: () => new api.core.Location(3200,4300,0), getHitpoints: () => 99 };
  const pillar = { getHitpoints: () => 155 };
  const raid = { player, area, npcs: new Set(), pillars: [pillar], wave: 31, tick: 51, room: 2 };
  const large = api.spawnNpc({ id: 10804, x: 3295, y: 4248, z: 0 });
  raid.npcs.add(large);
  const details = { raid, nylo: true, big: true, pillarTarget: pillar, expires: 52 };
  NPC_RAIDS.set(large, details);
  assert.equal(updateNyloExpiry(raid, large, details), false, 'a large spider remains through tick 51');
  raid.tick = 52;
  assert.equal(updateNyloExpiry(raid, large, details), true, 'natural explosion starts on alive tick 52');
  assert.equal(activeNylocas(raid), 1, 'the large death animation still counts toward the cap');
  raid.tick = 54;
  updateNyloExpiry(raid, large, details);
  assert.equal(activeNylocas(raid), 1, 'the large remains during its three-tick death animation');
  raid.tick = 55;
  updateNyloExpiry(raid, large, details);
  assert.equal(removed.includes(large), true);
  assert.equal(activeNylocas(raid), 2, 'the natural death splits into two small spiders at despawn');
  for (const child of raid.npcs) {
    const childDetails = NPC_RAIDS.get(child);
    assert.equal(childDetails.expires, 108, 'split children receive the wiki small-spider lifetime');
    raid.tick = 107;
    assert.equal(updateNyloExpiry(raid, child, childDetails), false);
    raid.tick = 108;
    assert.equal(updateNyloExpiry(raid, child, childDetails), true, 'small spiders expire at alive tick 53');
  }
  assert.equal(activeNylocas(raid), 0);
});


test('Sotetseg random maze paths connect to the fixed cached portal', () => {
  const { api } = mockApi();
  api.core = { ...api.core, ObjectManager: { register() {} } };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const cleared = [];
  for (let trial = 0; trial < 100; trial++) {
    const player = { getCombat: () => ({ reset() {} }), moveTo() {}, sendMessage() {} };
    const area = { add() {}, setClip(location, mask) { cleared.push([location.getX(), location.getY(), location.getZ(), mask]); } };
    const raid = { player, area, objects: new Set() };
    entry._test.startMaze(raid);
    assert.deepEqual(raid.maze.end, [3357, 4329, 3]);
    assert.deepEqual(new Set(cleared.map(([x,y,z]) => `${x},${y},${z}`)), new Set([...raid.maze.path].map(tile => `${tile},3`)), 'only red path tiles clear their collision');
    cleared.length = 0;
    const visited = new Set(['3359,4307']), pending = ['3359,4307'];
    while (pending.length) {
      const [x, y] = pending.pop().split(',').map(Number);
      for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const key = `${x+dx},${y+dy}`;
        if (raid.maze.path.has(key) && !visited.has(key)) { visited.add(key); pending.push(key); }
      }
    }
    assert.ok(visited.has('3357,4329'), 'the player can follow red tiles to the portal');
  }
});

test('Entry Theatre completes a boss whose death hook did not arrive before the next area tick', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  let hp = 1;
  const varbits = [];
  const messages = [];
  const player = {
    getHitpoints: () => hp,
    setHitpoints: value => { hp = value; },
    getCombat: () => ({ reset() {} }),
    getSkillManager: () => ({ getMaxLevel: () => 99, setCurrentLevel() {} }),
    getPacketSender: () => ({ sendVarbit: (...args) => varbits.push(args) }),
    sendMessage: message => messages.push(message),
  };
  const raid = {
    player, room: 3, started: true, complete: false, dead: false, tick: 20,
    boss: { getHitpoints: () => 0 }, npcs: new Set(), objects: new Set(), effects: [], pools: [],
  };
  entry._test.process(raid);
  assert.equal(raid.complete, true);
  assert.equal(raid.started, false);
  assert.equal(hp, 99);
  assert.ok(varbits.some(([id, value]) => id === 6448 && value === 100));
  assert.ok(messages.includes('Sotetseg defeated. Your hitpoints and prayer are restored.'));
});

test('Blood Moon ToB entry waits at the Nylocas barrier and exposes four quest encounters', () => {
  const { api, handlers } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  const spawned = [];
  api.core = {
    ...api.core,
    Boundary: class {},
    PrivateArea: class { enter() {} },
    CacheDefinitions: { getNpc: () => ({ hitpoints: 10 }) },
  };
  api.spawnNpc = ({ id, x, y, z }) => {
    const npc = {
      hp: 10, maxHp: 10, location: new api.core.Location(x,y,z),
      setHitpoints(value) { this.hp=value; return this; },
      setMaxHitpoints(value) { this.maxHp=value; return this; },
      setScriptedMovement() {}, getMovementQueue: () => ({ setBlockMovement() {} }),
      getLocation() { return this.location; }, getHitpoints() { return this.hp; },
    };
    spawned.push({ id, npc });
    return npc;
  };
  const emitted = [];
  api.emitCustomEvent = (name, event) => emitted.push([name,event]);
  const inventory = [];
  const playerInventory = {
    contains: id => inventory.includes(id),
    getFreeSlots: () => 28 - inventory.length,
    adds: id => inventory.push(id),
  };
  const player = {
    moveTo() {}, getLocation: () => new api.core.Location(3295,4257,0),
    getInventory: () => playerInventory,
    getPacketSender: () => ({ sendVarbit() { return this; } }),
    sendMessage() {}, getCombat: () => ({ reset() {} }),
    getSkillManager: () => ({ getMaxLevel: () => 99, setCurrentLevel() {} }),
    setHitpoints() {}, getHitpoints: () => 99,
  };
  entry(api);
  handlers.custom.get('tob:bmr:start')[0]({ player });
  const raid = entry._test.RAIDS.get(player);
  assert.deepEqual(inventory,[api.core.ItemIdentifiers.ESCAPE_CRYSTAL_2], 'the scoped run supplies its normal escape crystal');
  assert.equal(raid.mode, 'bmr');
  assert.equal(raid.room, 2);
  assert.equal(raid.bmrEncounter, 'wave');
  assert.equal(raid.started, false, 'the quest dialogue and barrier crossing happen before any fight starts');
  assert.equal(spawned.length, 1, 'only the entry Stranger is present before the player crosses the barrier');

  entry._test.startRoom(raid);
  assert.equal(raid.started, true);
  assert.equal(spawned.length, 16, 'the first encounter spawns fifteen mixed-style nylocas');
  const nylo = spawned.slice(1).map(({ npc }) => entry._test.NPC_RAIDS.get(npc));
  assert.equal(nylo.filter(({ big }) => big).length, 7);
  assert.deepEqual(new Set(nylo.map(({ style }) => style)), new Set([0,1,2]));
  assert.deepEqual(entry._test.BMR_ENCOUNTERS.map(({ type }) => type), ['wave','maiden','wave','vasilias']);

  raid.complete = true;
  entry._test.passage({ player, objectId: 33113 });
  assert.equal(raid.bmrIndex, 1);
  assert.equal(raid.room, 0);
  assert.equal(raid.bmrEncounter, 'maiden');
  raid.complete = true;
  entry._test.passage({ player, objectId: 33113 });
  assert.equal(raid.bmrIndex, 2);
  assert.equal(raid.room, 2);
  assert.equal(raid.bmrEncounter, 'wave');

  raid.bmrIndex = entry._test.BMR_ENCOUNTERS.length - 1;
  entry._test.roomComplete(raid);
  assert.equal(emitted.filter(([name]) => name === 'tob:bmr:completed').length, 1);
});


test('Maiden crabs pause their approach while frozen', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  let frozen = true;
  const moved = [];
  const crab = {
    getHitpoints: () => 16,
    getTimers: () => ({ has: (key) => key === api.core.TimerKey.FREEZE && frozen }),
    getLocation: () => new api.core.Location(3178, 4439, 0),
    moveTo: (position) => moved.push(position),
  };
  const boss = { getHitpoints: () => 500, getMaxHitpoints: () => 500, getLocation: () => new api.core.Location(3162, 4444, 0) };
  const raid = { player: {}, boss, tick: 2, threshold: 0, npcs: new Set([crab]) };
  entry._test.NPC_RAIDS.set(crab, { raid, crab: true });
  entry._test.maiden(raid);
  assert.equal(moved.length, 0);
  frozen = false;
  entry._test.maiden(raid);
  assert.equal(moved.length, 1);
});


test('Maiden victory opens its cache walkway inside only that raid instance', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const opened = [];
  const player = {
    getCombat: () => ({ reset() {} }),
    setHitpoints() {},
    getSkillManager: () => ({ getMaxLevel: () => 99, setCurrentLevel() {} }),
    getPacketSender: () => ({ sendVarbit() {} }),
    sendMessage() {},
  };
  const raid = { player, room: 0, npcs: new Set(), objects: new Set(), area: { setClip: (position, mask) => opened.push([position.getX(), position.getY(), mask]) } };
  entry._test.roomComplete(raid);
  assert.equal(raid.complete, true);
  assert.equal(opened.length, 12);
  assert.ok(opened.every(([x, y, mask]) => x >= 3176 && x <= 3177 && y >= 4431 && y <= 4436 && mask === 0));
});


test('Nylocas that attack pillars remain attackable, while the pillars do not', () => {
  const { api } = mockApi();
  api.core = { ...api.core, CacheDefinitions: { getNpc: () => ({ hitpoints: 2 }) } };
  api.spawnNpc = ({ id, x, y, z }) => {
    const npc = {
      id, position: new api.core.Location(x,y,z),
      setMaxHitpoints: () => npc,
      setHitpoints: () => npc,
      setScriptedMovement() {},
      getMovementQueue: () => ({ setBlockMovement() {} }),
      getLocation() { return this.position; },
      getX() { return this.position.getX(); },
      getY() { return this.position.getY(); },
      getHitpoints() { return 2; },
      isDyingFunction() { return false; },
    };
    return npc;
  };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const area = entry._test.createArea();
  area.enter = () => {};
  const player = { isNpc: () => false, getPacketSender: () => ({ sendVarbit() {} }) };
  const pillars = [[3290,4245],[3290,4251],[3299,4245],[3299,4251]].map(([x,y]) => ({
    getLocation: () => new api.core.Location(x,y,0), getHitpoints: () => 155,
  }));
  const raid = { player, area, npcs: new Set(), pillars, wave: 0, tick: 1, started: true, room: 2 };
  entry._test.RAIDS.set(player, raid);
  entry._test.nextWave(raid);
  assert.equal(raid.npcs.size, 3);
  const passiveTargets=[...raid.npcs].map(n=>entry._test.NPC_RAIDS.get(n)).filter(d=>!d.aggressive).map(d=>d.pillarTarget);
  assert.equal(new Set(passiveTargets).size,2,'different spawn lanes split passive spiders across the nearest pillars');
  const fallenTarget=passiveTargets[0];
  fallenTarget.getHitpoints=()=>0;
  const reassigned=entry._test.pillarTarget(raid,[...raid.npcs][0],entry._test.NPC_RAIDS.get([...raid.npcs][0]));
  assert.notEqual(reassigned,fallenTarget,'passive spiders retarget a surviving pillar when their target falls');
  assert.notEqual(reassigned,player,'passive spiders do not turn into player attackers when a pillar falls');
  const first=raid.npcs.values().next().value,details=entry._test.NPC_RAIDS.get(first);
  details.flashing=[0,1,0];
  assert.equal(area.canAttack(player,first),false,'style flashes happen before the spider can be attacked');
  details.flashing=null;
  assert.equal(area.canAttack(player,first),null,'the spider becomes attackable when it settles on its final style');
  for (const spider of raid.npcs) {
    const details=entry._test.NPC_RAIDS.get(spider);
    assert.equal(details.expires,1+(details.big?52:53),'spiders use the wiki large/small lifetimes');
  }
  for (const spider of raid.npcs) assert.equal(area.canAttack(player, spider), null, 'pillar-targeting enemies can be killed');
  entry._test.NPC_RAIDS.set(pillars[0], { raid, pillar: true });
  assert.equal(area.canAttack(player, pillars[0]), false, 'players cannot attack the room supports');
  const before = new Set(raid.npcs);
  entry._test.splitNylocas(raid, { getLocation: () => new api.core.Location(3295, 4248, 0) }, { big: true, pillarTarget: pillars[1] });
  const splits = [...raid.npcs].filter(n => !before.has(n));
  assert.equal(splits.length, 2);
  for (const small of splits) {
    assert.equal(entry._test.NPC_RAIDS.get(small).pillarTarget, pillars[1], 'splits retain their parent target instead of all attacking the player');
    assert.equal(area.canAttack(player, small), null);
  }
});


test('Xarpus splat damages its 3x3 once and leaves one permanent acid tile', () => {
  const { api } = mockApi();
  api.core = { ...api.core, ObjectManager: { register() {} }, Projectile: { createProjectile: () => ({ sendProjectile() {} }) } };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const hits = [];
  const player = {
    getLocation: () => new api.core.Location(3174, 4386, 1),
    getHitpoints: () => 99,
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage(value) { hits.push(value); } }) }),
  };
  const raid = { player, boss: { getHitpoints: () => 390, getMaxHitpoints: () => 520, performAnimation() {} }, tick: 52, effects: [], pools: [], objects: new Set(), area: null };
  entry._test.xarpus(raid);
  raid.effects.pop().fn();
  assert.equal(raid.pools.length, 1);
  assert.deepEqual(raid.pools[0].tile, [3174, 4386, 1]);
  assert.equal(hits.length, 1, 'the player in the splat receives one immediate damage hit');
  entry._test.xarpus(raid);
  raid.effects.pop().fn();
  assert.equal(raid.pools.length, 1, 'spitting on existing acid does not multiply persistent floor damage');
  assert.equal(hits.length, 2, 'a later splat still causes its own single immediate hit');
});


test('Large Nylocas approach the player footprint without standing on the player', () => {
  const { api } = mockApi();
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const player = { getLocation: () => new api.core.Location(3298, 4246, 0), getSize: () => 1 };
  for (const [x, y] of [[3297, 4246], [3296, 4246], [3298, 4245], [3298, 4248]]) {
    const npc = { position: new api.core.Location(x, y, 0), getLocation() { return this.position; }, getSize: () => 2,
      moveTo(next) { this.position = next; } };
    if (!api.core.CombatRange.beside(npc, player)) entry._test.approachNylocas(npc, player);
    assert.equal(api.core.CombatRange.overlapsEntities(npc, player), false);
    assert.equal(api.core.CombatRange.beside(npc, player), true);
  }
});

test('Nylocas player attacks retain the normal accuracy roll and prayer protection', () => {
  const { api } = mockApi();
  let rolledDamage = 0;
  const queued = [];
  class PendingHit {
    constructor(npc, player, method, config) { this.damage=rolledDamage; this.method=method; assert.equal(config.rollAccuracy, undefined); }
    getTotalDamage() { return this.damage; }
    setTotalDamage(damage) { this.damage=damage; }
  }
  api.core = { ...api.core, PendingHit };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const prayers = [];
  const player = { getPrayerActive: () => prayers, getCombat: () => ({ getHitQueue: () => ({ addPendingHit: hit => queued.push(hit) }) }) };
  entry._test.attackNylocas({}, player, 1);
  assert.equal(queued[0].damage, 0, 'a missed accuracy roll must remain zero');
  assert.equal(queued[0].method.type(), api.core.CombatType.RANGED);
  rolledDamage=15;
  entry._test.attackNylocas({}, player, 1);
  assert.equal(queued[1].damage, 8);
  prayers[api.core.PrayerHandler.PROTECT_FROM_MISSILES]=true;
  entry._test.attackNylocas({}, player, 1);
  assert.equal(queued[2].damage, 0);
});


test('Bloat has line of sight when any edge of its body can see past the central tank', () => {
  const {api}=mockApi();
  let open=false,calls=0;
  api.core={...api.core,RegionManager:{canProjectileAttackBounds:()=>{calls++;return open;}}};
  const entry=require('../plugins/minigames/tob/Entry.TheatreOfBlood');entry(api);
  const player={getLocation:()=>new api.core.Location(3300,4452,0),getPrivateArea:()=>null};
  const boss={getLocation:()=>new api.core.Location(3290,4440,0),getSize:()=>5};
  assert.equal(entry._test.behindBloatPillar(player,boss),true);
  assert.equal(calls,16,'all sixteen perimeter tiles are checked');
  open=true;assert.equal(entry._test.behindBloatPillar(player,boss),false);
});


test('Bloat falling hands sample distinct floor tiles instead of targeting the player every drop', () => {
  const {api}=mockApi();
  api.core={...api.core,RegionManager:{blocked:tile=>tile.getX()>=3293&&tile.getX()<=3298&&tile.getY()>=4445&&tile.getY()<=4450}};
  const entry=require('../plugins/minigames/tob/Entry.TheatreOfBlood');entry(api);
  const raid={},first=entry._test.bloatHands(raid),previous=new Set(raid.bloatHandsLast),second=entry._test.bloatHands(raid);
  assert.equal(first.length,16);assert.equal(previous.size,16);
  assert.equal(second.length,16);
  for(const tile of [...first,...second])assert.equal(api.core.RegionManager.blocked(tile),false);
  for(const tile of second)assert.equal(previous.has(`${tile.getX()},${tile.getY()}`),false);
});


test('Theatre supply chests use reachable floor tiles regardless of the killing position', () => {
  const { api } = mockApi(), placed = [];
  api.core = { ...api.core, ObjectManager: { register: object => placed.push(object.getLocation()), deregister() {} } };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const player = { getCombat: () => ({ reset() {} }), setHitpoints() {},
    getSkillManager: () => ({ getMaxLevel: () => 99, setCurrentLevel() {} }),
    getPacketSender: () => ({ sendVarbit() {} }), sendMessage() {},
    getLocation: () => new api.core.Location(3292,4447,0) };
  for (const room of [1,3]) {
    const raid = { player, room, npcs: new Set(), objects: new Set(), area: null };
    entry._test.roomComplete(raid);
    assert.equal(raid.supplies,10);
  }
  assert.deepEqual(placed.map(p=>[p.getX(),p.getY(),p.getZ()]),[[3301,4446,0],[3279,4312,0]]);
});

test('RFD M\'speak amulet and quest greegrees have usable equipment slots', () => {
  const gameplay = require('../data/definitions/item-gameplay.json');
  const byId = new Map(gameplay.map((item) => [item.id, item]));
  for (const id of [4022, 17926, 17927]) assert.equal(byId.get(id)?.equipmentType, 'AMULET', `item ${id}`);
  for (const id of [...Array.from({ length: 8 }, (_, i) => 4024 + i),
    ...Array.from({ length: 8 }, (_, i) => 17929 + i), 19526]) {
    assert.equal(byId.get(id)?.equipmentType, 'WEAPON', `item ${id}`);
  }
});


test('the Lumbridge Guide egg quiz asks three questions and consumes the egg only after three correct answers', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const menus = [];
  let pendingBuilder = null;
  let currentQuestion = '';
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onNpcInteraction') return (...args) => interactions.push(args);
      if (prop === 'sendMultiChatboxPrompt') return (_player, title, ...pairs) => menus.push({ title, pairs });
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const traiborn = interactions.find(([name]) => name === 'Wizard Traiborn')[1]['Talk-to'];

  const itemId = api.core.ItemIdentifiers.EGG;
  const inventory = new Map([[itemId, 1]]);
  const attributes = new Map();
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    isPlayer: () => true,
    getAsPlayer: () => player,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      getFreeSlots: () => 27,
    }),
    getPacketSender: () => packetSender,
    getDialogueManager: () => ({
      reset() {},
      startDialogues(builder) {
        pendingBuilder = builder;
        for (const dialogue of builder.getDialogues().values()) {
          if (dialogue.getText?.().endsWith('?')) currentQuestion = dialogue.getText();
        }
      },
    }),
    sendMessage() {},
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  quest.setStage(player, 4);
  traiborn({ player, npcId: api.core.NpcIdentifiers.WIZARD_TRAIBORN, clickType: 1,
    definition: { getActions: () => ['Talk-to'] } });

  const answers = new Map([
    ['A vision shows a ghostly woman in white. Who is she?', 'Velorina'],
    ['A vision shows an elf with long blond hair. Who is he?', 'Islwyn'],
    ['A vision shows a man wearing a crown in East Ardougne. Who is he?', 'King Lathas'],
    ['A vision shows a man in a blue shirt with a book. Who is he?', 'Reldo'],
    ['A vision shows a woman in a pink top. Who is she?', 'Gertrude'],
    ['A vision shows a witch in a pointed hat. Who is she?', 'Hetty'],
    ['A vision shows a pirate in a bandana. Who is he?', 'Pirate Pete'],
    ['A vision shows a man in ordinary clothes from a nearby farm. Who is he?', 'Unferth'],
    ['A vision shows a desert merchant with a white beard. Who is he?', 'Ali Morrisane'],
    ['A vision shows a man in a brown vest. Who is he?', 'Professor Gronigen'],
  ]);
  const advance = () => {
    const last = [...pendingBuilder.getDialogues().values()].at(-1);
    last.send(player);
  };
  while (menus.length < 3) {
    if (menus.length > 0 && menus.at(-1).used) {
      advance();
      continue;
    }
    if (menus.length > 0) {
      const menu = menus.at(-1);
      const answer = answers.get(currentQuestion);
      assert.ok(answer, `no fixture answer for ${currentQuestion}`);
      const optionIndex = menu.pairs.indexOf(answer);
      assert.notEqual(optionIndex, -1, `quiz omitted correct answer ${answer}`);
      menu.used = true;
      menu.pairs[optionIndex + 1]();
      continue;
    }
    advance();
  }
  const last = menus.at(-1);
  const answer = answers.get(currentQuestion);
  last.used = true;
  last.pairs[last.pairs.indexOf(answer) + 1]();
  advance();
  advance();

  assert.equal(menus.length, 3);
  assert.equal(inventory.get(itemId), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.ENCHANTED_EGG), 1);
  assert.equal(player.getAttribute('recipe-for-disaster:guide-state') & 1, 1);
});

test('RFD Sir Amik cornflour uses sweetcorn in the windmill before mixing the recipe', () => {
  const { api: base } = mockApi();
  const objectActions = [];
  const itemObjects = [];
  const itemItems = [];
  const core = Object.create(base.core);
  Object.defineProperty(core, 'ObjectDefinition', { value: {
    ...base.core.ObjectDefinition,
    forPlayer: () => ({ getName: () => 'Hopper' }),
  } });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (...args) => objectActions.push(args);
      if (prop === 'onItemOnObject') return (handler) => itemObjects.push(handler);
      if (prop === 'onItemOnItem') return (handler) => itemItems.push(handler);
      if (prop === 'core') return core;
      return target[prop];
    },
  });
  require('../plugins/objects/Windmill.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const fillCorn = itemObjects.findLast((handler) => handler.name !== 'handleGoblinIngredients'
    && handler.name !== 'handleSkrachItemOnObject' && handler.name !== 'handleEvilChickenShrine'
    && handler.name !== 'handleAwowogeiObjects' && handler.name !== 'handlePirateRange'
    && handler.name !== 'handleGuideRange');
  const operate = objectActions.findLast(([name, actions]) => name === 'Hopper controls' && actions.Operate)?.[1].Operate;
  const emptyBin = objectActions.findLast(([name, actions]) => name === 'Flour bin' && actions.Empty)?.[1].Empty;
  const ingredients = itemItems.findLast((handler) => handler.name === 'handleAmikItems');
  assert.ok(fillCorn && operate && emptyBin && ingredients);

  const attributes = new Map();
  const inventory = new Map([
    [api.core.ItemIdentifiers.SWEETCORN, 1],
    [api.core.ItemIdentifiers.POT, 1],
    [api.core.ItemIdentifiers.MILKY_MIXTURE, 1],
  ]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    sendMessage() {},
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      containsNumber: (id) => (inventory.get(id) ?? 0) > 0,
      getFreeSlots: () => 20,
      deleteNumber: (id, count) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - count)),
      adds: (id, count) => inventory.set(id, (inventory.get(id) ?? 0) + count),
    }),
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);

  const { MapObjects } = require('../src/main/typescript/elvarg/game/entity/impl/object/MapObjects');
  const loadedObjects = new Map(MapObjects.mapObjects);
  MapObjects.mapObjects.clear();

  const hopper = { player, objectId: api.core.ObjectIdentifiers.HOPPER_24,
    itemId: api.core.ItemIdentifiers.SWEETCORN, handled: false };
  fillCorn(hopper);
  assert.equal(hopper.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.SWEETCORN), 0);

  operate({ player, location: { x: 3166, y: 3305, z: 2 }, handled: false });

  emptyBin({ player, objectId: 1781, handled: false });
  MapObjects.mapObjects.clear();
  for (const [key, value] of loadedObjects) MapObjects.mapObjects.set(key, value);
  assert.equal(inventory.get(api.core.ItemIdentifiers.POT), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.POT_OF_CORNFLOUR), 1);

  const mix = { player, usedItemId: api.core.ItemIdentifiers.POT_OF_CORNFLOUR,
    usedWithItemId: api.core.ItemIdentifiers.MILKY_MIXTURE, handled: false };
  ingredients(mix);
  assert.equal(mix.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.POT_OF_CORNFLOUR), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.MILKY_MIXTURE), 0);
  assert.equal(inventory.get(api.core.ItemIdentifiers.CORNFLOUR_MIXTURE), 1);
});

test('RFD Amik shrine requires the Wise Old Man clue, enters the mapped lair and drops the real quest egg', () => {
  const { api: base } = mockApi();
  const itemObjects = [];
  const deaths = [];
  let spawn = null;
  let spawned = null;
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onItemOnObject') return (handler) => itemObjects.push(handler);
      if (prop === 'onNpcDeath') return (handler) => deaths.push(handler);
      if (prop === 'spawnNpc') return (config) => { spawned = config; return spawn; };
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const shrine = itemObjects.find((handler) => handler.name === 'handleEvilChickenShrine');
  const death = deaths.find((handler) => handler.name === 'handleAmikCombatDrop');
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const inventory = new Map([[api.core.ItemIdentifiers.RAW_CHICKEN, 1]]);
  const moves = [];
  const player = {
    isPlayer: () => true,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    moveTo: (location) => moves.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage() {},
    getPacketSender: () => new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => {} : undefined }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 20,
      deleteNumber: (id, count) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - count)),
      adds: (id, count) => inventory.set(id, (inventory.get(id) ?? 0) + count),
    }),
  };
  quest.setStage(player, 4);
  const event = { player, objectId: api.core.ObjectIdentifiers.CHICKEN_SHRINE,
    itemId: api.core.ItemIdentifiers.RAW_CHICKEN, handled: false };
  shrine(event);
  assert.equal(event.handled, false, 'the shrine remains inactive until Aris and the Wise Old Man give the clue');
  assert.equal(inventory.get(api.core.ItemIdentifiers.RAW_CHICKEN), 1);

  attributes.set('recipe-for-disaster:amik-state', 1);
  spawn = null;
  const failed = { ...event, handled: false };
  shrine(failed);
  assert.equal(failed.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.RAW_CHICKEN), 1, 'a failed spawn never consumes the offering');

  const chicken = {};
  spawn = chicken;
  const entered = { ...event, handled: false };
  shrine(entered);
  assert.equal(entered.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.RAW_CHICKEN), 0);
  assert.deepEqual(spawned, {
    id: api.core.NpcIdentifiers.EVIL_CHICKEN,
    x: 2455,
    y: 4399,
    z: 0,
    wanderRadius: 0,
    owner: player,
    ownerOnly: true,
  });
  assert.deepEqual(moves, [[2455, 4398, 0]]);

  death({ killer: player, npc: chicken, npcId: api.core.NpcIdentifiers.EVIL_CHICKEN });
  assert.equal(inventory.get(api.core.ItemIdentifiers.EVIL_CHICKENS_EGG), 1);
});

test('RFD council interactions read requirements through the SkillManager before starting a rescue', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onNpcInteraction') return (...args) => interactions.push(args);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const council = interactions.findLast(([handler]) => typeof handler === 'function')[0];
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const messages = [];
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    getPacketSender: () => packetSender,
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 27 }),
    sendMessage: (message) => messages.push(message),
  };
  quest.setStage(player, 4);

  assert.doesNotThrow(() => council({
    player,
    npcId: api.core.NpcIdentifiers.PIRATE_PETE_3,
    clickType: 1,
    definition: { getActions: () => ['Talk-to'] },
  }));
  assert.match(messages.at(-1), /Speak to Aris about freeing Pirate Pete/);
});

test('RFD only frees the Guide for a Cake of Guidance and consumes it on a valid hand-in', () => {
  const { api: base } = mockApi();
  const itemNpcHandlers = [];
  const npcDefinitions = Object.create(base.core.NpcDefinition);
  npcDefinitions.forId = () => ({ getId: () => 3393, getName: () => 'Lumbridge Guide' });
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: npcDefinitions });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return core;
      if (prop === 'onItemOnNpc') return (handler) => itemNpcHandlers.push(handler);
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  itemNpcHandlers.length = 0;
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handIn = itemNpcHandlers[0];
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quests = getRegisteredQuests();
  const quest = quests.findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const inventory = new Map([[api.core.ItemIdentifiers.CAKE, 1], [api.core.ItemIdentifiers.CAKE_OF_GUIDANCE, 1]]);
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const skillManager = { getCurrentLevel: () => 99, addExperiences() {} };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => skillManager,
    getPacketSender: () => packetSender,
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 27,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getEquipment: () => ({ get: () => null }),
    getDialogueManager: () => ({ startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 4);
  for (const key of ['big_chompy_bird_hunting', 'biohazard', 'demon_slayer', 'murder_mystery', 'nature_spirit', 'witchs_house']) {
    const prerequisite = quests.findLast((entry) => entry.key === key);
    assert.ok(prerequisite, `missing prerequisite quest ${key}`);
    prerequisite.setStage(player, prerequisite.completionValue);
  }

  const wrongDish = { player, npcId: api.core.NpcIdentifiers.LUMBRIDGE_GUIDE_4, itemId: api.core.ItemIdentifiers.CAKE, handled: false };
  handIn(wrongDish);
  assert.equal(wrongDish.handled, false);
  assert.equal(inventory.get(api.core.ItemIdentifiers.CAKE), 1);
  assert.equal(attributes.get('recipe-for-disaster:rescues') ?? 0, 0);

  const rightDish = { player, npcId: api.core.NpcIdentifiers.LUMBRIDGE_GUIDE_4, itemId: api.core.ItemIdentifiers.CAKE_OF_GUIDANCE, handled: false };
  handIn(rightDish);
  assert.equal(rightDish.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.CAKE_OF_GUIDANCE), 0);
  assert.equal(attributes.get('recipe-for-disaster:rescues'), 8);
  assert.equal(attributes.get('quest.points'), 1);
});

test('RFD fishcake recipe preserves incomplete ingredients and consumes all four only when combined', () => {
  const { api: base } = mockApi();
  const itemHandlers = [];
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: { forId: () => ({ getActions: () => ['Talk-to'] }) } });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return core;
      if (prop === 'onItemOnItem') return (handler) => itemHandlers.push(handler);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const recipe = itemHandlers.findLast((handler) => handler.toString().includes('GROUND_COD'));
  assert.ok(recipe);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const items = api.core.ItemIdentifiers;
  const inventory = new Map([[items.GROUND_COD, 1], [items.GROUND_KELP, 1],
    [items.BREAD, 1], [items.KNIFE, 1]]);
  const attributes = new Map();
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getPacketSender: () => packetSender,
    getDialogueManager: () => ({ startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 4);

  recipe({ player, usedItemId: items.BREAD, usedWithItemId: items.KNIFE, handled: false });
  assert.equal(inventory.get(items.BREAD), 0);
  assert.equal(inventory.get(items.KNIFE), 1);
  assert.equal(inventory.get(items.BREADCRUMBS), 1);

  recipe({ player, usedItemId: items.GROUND_COD, usedWithItemId: items.GROUND_KELP, handled: false });
  assert.equal(inventory.get(items.GROUND_COD), 1);
  assert.equal(inventory.get(items.GROUND_KELP), 1);
  assert.equal(inventory.get(items.RAW_FISHCAKE) ?? 0, 0);

  for (const id of [items.GROUND_GIANT_CRAB_MEAT, items.BREADCRUMBS]) inventory.set(id, 1);
  const complete = { player, usedItemId: items.GROUND_COD, usedWithItemId: items.GROUND_KELP, handled: false };
  recipe(complete);
  assert.equal(complete.handled, true);
  for (const id of [items.GROUND_COD, items.GROUND_KELP, items.GROUND_GIANT_CRAB_MEAT, items.BREADCRUMBS]) {
    assert.equal(inventory.get(id), 0);
  }
  assert.equal(inventory.get(items.RAW_FISHCAKE), 1);
});

test('RFD K\'klik flambe consumes the token and creme brulee after the protected success line', () => {
  const { api, handlers } = mockApi();
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  const items = api.core.ItemIdentifiers;
  const attributes = new Map();
  const inventory = new Map([[items.DRAGON_TOKEN, 1], [items.BRULEE_3, 1]]);
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      getFreeSlots: () => 27,
    }),
    getPacketSender: () => packetSender,
    getEquipment: () => ({ get: (slot) => slot === api.core.Equipment.HANDS_SLOT ? { getId: () => items.ICE_GLOVES } : null }),
  };
  quest.setStage(player, 4);

  const line = { player, npcId: api.core.NpcIdentifiers.KKLIK, text: "Sure, that's easy." };
  handlers.custom.get('npc-dialogue:line').at(-1)(line);
  assert.equal(typeof line.after, 'function');
  line.after();

  assert.equal(inventory.get(items.DRAGON_TOKEN), 0);
  assert.equal(inventory.get(items.BRULEE_3), 0);
  assert.equal(inventory.get(items.BRULEE_SUPREME), 1);
});

test('Below Ice Mountain yields knife-and-bread interactions outside its sandwich errand', () => {
  const { api: base } = mockApi();
  const itemHandlers = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onItemOnItem') return (...args) => itemHandlers.push(args);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/BelowIceMountain.Quest')];
  require('../plugins/quests/quests/BelowIceMountain.Quest')(api);
  const sandwich = itemHandlers.find(([first, second]) => first === 'Knife' && second === 'Bread')?.[2];
  assert.equal(typeof sandwich, 'function');
  const attributes = new Map();
  const inventory = new Map([[api.core.ItemIdentifiers.KNIFE, 1], [api.core.ItemIdentifiers.BREAD, 1]]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    getInventory: () => ({ getAmount: (id) => inventory.get(id) ?? 0 }),
  };

  assert.equal(sandwich({ player, usedItemId: api.core.ItemIdentifiers.KNIFE,
    usedWithItemId: api.core.ItemIdentifiers.BREAD, handled: false }), false);
  assert.equal(inventory.get(api.core.ItemIdentifiers.BREAD), 1);
});

test('RFD Awowogei banana gathering waits for the King, all three monkeys and both recipe clues', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const gather = objectHandlers.find((handler) => handler.name === 'handleAwowogeiObjects');
  assert.equal(typeof gather, 'function');
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map();
  const messages = [];
  const inventory = new Map([[api.core.ItemIdentifiers.ROPE, 1]]);
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 27,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    getEquipment: () => ({ get: () => null }),
    getPacketSender: () => packetSender,
    sendMessage: (message) => messages.push(message),
  };
  quest.setStage(player, 4);

  const event = { player, objectId: api.core.ObjectIdentifiers.RED_BANANA_TREE,
    itemId: api.core.ItemIdentifiers.ROPE, handled: false };
  gather(event);
  assert.equal(event.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.RED_BANANA), undefined);
  assert.match(messages.at(-1), /three wise monkeys/);
});

test('RFD Awowogei Tchiki route needs base Agility and an equipped ninja greegree before the rope swing', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const moves = [];
  const messages = [];
  const experiences = [];
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      if (prop === 'core') return base.core;
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handler = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCourse');
  assert.ok(handler);
  const attributes = new Map([['recipe-for-disaster:awowogei-state', 63]]);
  let agility = 47;
  let weapon = -1;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getCurrentLevel: () => agility, getMaxLevel: () => agility,
      addExperiences: (skill, amount) => experiences.push([skill, amount]) }),
    getEquipment: () => ({ get: (slot) => slot === api.core.Equipment.WEAPON_SLOT
      ? { getId: () => weapon } : null }),
    getInventory: () => ({ getItems: () => [] }),
    getPacketSender: () => packetSender,
    moveTo: (location) => moves.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage: (message) => messages.push(message),
  };
  const swing = () => ({ player, objectId: api.core.ObjectIdentifiers.ROPE_20, clickType: 1,
    definition: { getActions: () => ['Swing'] }, handled: false });
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);

  const belowLevel = swing();
  handler(belowLevel);
  assert.equal(belowLevel.handled, true);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63);
  assert.match(messages.at(-1), /level 48 Agility/);

  agility = 48;
  const human = swing();
  handler(human);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63);
  assert.match(messages.at(-1), /ninja monkey greegree/);

  weapon = api.core.ItemIdentifiers.NINJA_MONKEY_GREEGREE;
  const monkey = swing();
  handler(monkey);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63 | 256);
  assert.deepEqual(moves, [[2756, 2731, 0]]);
  assert.deepEqual(experiences, [[api.core.Skill.AGILITY, 100]]);
});

test('RFD Awowogei hole, mapped Tchiki cave, exit rope and final course tree use the real world route', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const moves = [];
  const packetSender = new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => packetSender : undefined });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      if (prop === 'core') return base.core;
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const course = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCourse');
  const cave = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCaveObject');
  const courseExit = objectHandlers.findLast((entry) => entry.name === 'handleTchikiCourseExit');
  const attributes = new Map([['recipe-for-disaster:awowogei-state', 63]]);
  let loc = [2758, 2729, 0];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => loc[0], getY: () => loc[1], getZ: () => loc[2] }),
    moveTo: (location) => { loc = [location.getX(), location.getY(), location.getZ()]; moves.push(loc); },
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 27, adds: () => {} }),
    getEquipment: () => ({ get: () => null }),
    getPacketSender: () => packetSender,
    sendMessage: () => {},
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);
  attributes.set('recipe-for-disaster:awowogei-state', 63 | 256);

  const hole = { player, objectId: base.core.ObjectIdentifiers.HOLE_18, clickType: 1,
    definition: { getActions: () => ['Enter'] }, handled: false };
  course(hole);
  assert.equal(hole.handled, true);
  assert.deepEqual(loc, [3020, 5457, 0]);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state'), 63 | 256 | 512);

  const rope = { player, objectId: 16060, clickType: 1,
    definition: { getActions: () => ['Climb-up'] }, handled: false };
  cave(rope);
  assert.equal(rope.handled, true);
  assert.deepEqual(loc, [2757, 2734, 0]);

  const tree = { player, objectId: 16062, clickType: 1,
    definition: { getActions: () => ['Climb-down'] }, handled: false };
  courseExit(tree);
  assert.equal(tree.handled, true);
  assert.deepEqual(loc, [2757, 2726, 0]);
});

test('RFD Awowogei enters the mapped hot-coal chamber and cooks only on the long hot rock', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const itemObjectHandlers = [];
  const itemNpcHandlers = [];
  const routes = [];
  const moves = [];
  const npcDefinitions = Object.create(base.core.NpcDefinition);
  npcDefinitions.forId = () => ({ getId: () => base.core.NpcIdentifiers.AWOWOGEI, getName: () => 'Awowogei', getActions: () => ['Talk-to'] });
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: npcDefinitions });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      if (prop === 'onItemOnObject') return (handler) => itemObjectHandlers.push(handler);
      if (prop === 'onItemOnNpc') return (handler) => itemNpcHandlers.push(handler);
      if (prop === 'onObjectRoute') return (handler) => routes.push(handler);
      if (prop === 'core') return core;
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const dungeon = objectHandlers.findLast((handler) => handler.name === 'handleAwowogeiDungeon');
  const cook = itemObjectHandlers.findLast((handler) => handler.name === 'handleAwowogeiObjects');
  const rescue = itemNpcHandlers.findLast((handler) => handler.name === 'rescueByItem');
  const route = routes.findLast((handler) => handler.name === 'routeRedBananaTree');
  assert.ok(dungeon && cook && rescue && route);

  const attributes = new Map([['recipe-for-disaster:awowogei-state', 63]]);
  const inventory = new Map([[core.ItemIdentifiers.RAW_STUFFED_SNAKE, 1]]);
  let loc = [2808, 9200, 0];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => loc[0], getY: () => loc[1], getZ: () => loc[2] }),
    moveTo: (location) => { loc = [location.getX(), location.getY(), location.getZ()]; moves.push(loc); },
    getEquipment: () => ({ get: (slot) => slot === base.core.Equipment.WEAPON_SLOT
      ? { getId: () => base.core.ItemIdentifiers.ZOMBIE_MONKEY_GREEGREE }
      : slot === base.core.Equipment.AMULET_SLOT ? { getId: () => base.core.ItemIdentifiers.MSPEAK_AMULET } : null }),
    getSkillManager: () => ({ getCurrentLevel: () => 99, addExperiences() {} }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 27,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getDialogueManager: () => ({ startDialogues() {} }),
    sendMessage: () => {},
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);

  const crack = { player, objectId: 16061, clickType: 1,
    definition: { getActions: () => ['Enter'] }, handled: false };
  dungeon(crack);
  assert.equal(crack.handled, true);
  assert.deepEqual(loc, [3055, 5484, 0]);
  assert.equal(attributes.get('recipe-for-disaster:awowogei-state') & 1024, 1024);

  const rock = { getLocation: () => ({ getX: () => 3056, getY: () => 5484 }),
    getDefinition: () => ({ getName: () => 'Rock', getExamine: () => "It's a long, hot rock." }) };
  loc = [3055, 5484, 0];
  const approach = { player, object: rock, objectId: 26175 };
  route(approach);
  assert.deepEqual(approach.destination, { x: 3055, y: 5484, z: 0 });
  const wrongObject = { player, object: { getDefinition: () => ({ getName: () => 'Crate', getExamine: () => 'A crate.' }) }, objectId: 123,
    itemId: base.core.ItemIdentifiers.RAW_STUFFED_SNAKE, handled: false };
  cook(wrongObject);
  assert.equal(wrongObject.handled, false);
  assert.equal(inventory.get(base.core.ItemIdentifiers.RAW_STUFFED_SNAKE), 1);

  const realRock = { player, object: rock, objectId: 26175,
    itemId: base.core.ItemIdentifiers.RAW_STUFFED_SNAKE, handled: false };
  cook(realRock);
  assert.equal(realRock.handled, true);
  assert.equal(inventory.get(base.core.ItemIdentifiers.RAW_STUFFED_SNAKE), 0);
  assert.equal(inventory.get(base.core.ItemIdentifiers.STUFFED_SNAKE), 1);

  const mm1 = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'monkey_madness_i');
  assert.ok(mm1);
  mm1.setStage(player, mm1.completionValue);
  const kingMeal = { player, npcId: base.core.NpcIdentifiers.AWOWOGEI,
    itemId: base.core.ItemIdentifiers.STUFFED_SNAKE, handled: false };
  rescue(kingMeal);
  assert.equal(kingMeal.handled, true);
  assert.equal(inventory.get(base.core.ItemIdentifiers.STUFFED_SNAKE), 0);
  assert.equal(attributes.get('recipe-for-disaster:rescues') & 128, 128);

  const returnCrack = { player, objectId: 16100, clickType: 1,
    definition: { getActions: () => ['Enter'] }, handled: false };
  dungeon(returnCrack);
  assert.equal(returnCrack.handled, true);
  assert.deepEqual(loc, [2808, 9200, 0]);
});

test('RFD goblin cellar ladders connect only the mapped village and cook-room ends', () => {
  const { api: base } = mockApi();
  const objectActions = [];
  const emitted = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (...args) => objectActions.push(args);
      if (prop === 'emitCustomEvent') return (name, event) => emitted.push({ name, event });
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const ladder = objectActions.find(([name]) => name === 'Ladder')?.[1];
  assert.ok(ladder);
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
  };
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .findLast(({ key }) => key === 'recipe_for_disaster');
  quest.setStage(player, 4);
  emitted.length = 0;

  const down = { player, objectId: 12389, clickType: 1,
    definition: { getActions: () => ['Climb-down'] }, location: { x: 2960, y: 3507, z: 0 }, handled: false };
  ladder['Climb-down'](down);
  assert.equal(down.handled, true);
  assert.equal(emitted[0].name, 'ladders:climbDown');
  assert.deepEqual([emitted[0].event.destination.getX(), emitted[0].event.destination.getY(), emitted[0].event.destination.getZ()], [2980, 9871, 0]);

  const wrong = { player, objectId: 12389, clickType: 1,
    definition: { getActions: () => ['Climb-down'] }, location: { x: 2961, y: 3507, z: 0 }, handled: false };
  ladder['Climb-down'](wrong);
  assert.equal(wrong.handled, false);
  assert.equal(emitted.length, 1);

  const up = { player, objectId: 12391, clickType: 1,
    definition: { getActions: () => ['Climb-up'] }, location: { x: 2981, y: 9876, z: 0 }, handled: false };
  ladder['Climb-up'](up);
  assert.equal(up.handled, true);
  assert.equal(emitted[1].name, 'ladders:climbUp');
  assert.deepEqual([emitted[1].event.destination.getX(), emitted[1].event.destination.getY(), emitted[1].event.destination.getZ()], [2960, 3506, 0]);
});

test('RFD ogre boat charges the correct chompies and herbs for each route', () => {
  const { api: base, handlers } = mockApi();
  const routes = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onNpcRoute') return (handler) => routes.push(handler);
      return target[property];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const condition = handlers.condition.at(-1);
  const action = handlers.custom.get('npc-dialogue:action').at(-1);
  const items = api.core.ItemIdentifiers;
  const inventory = new Map([[items.RAW_CHOMPY, 2], [items.SNAKE_WEED, 1], [items.ROGUES_PURSE, 1]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
  ]);
  const sentVarbits = [];
  let destination;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    getPacketSender: () => ({ sendVarbit: (id, value) => sentVarbits.push([id, value]) }),
    moveTo: (location) => { destination = location; },
  };
  const choice = handlers.custom.get('npc-dialogue:choice').find((handler) => handler.toString().includes('SKRACH_STATE_ATTRIBUTE'));
  assert.ok(choice);
  choice({ player, npcId: api.core.NpcIdentifiers.RANTZ, option: "Ok, I'll do it." });
  assert.equal(attributes.get('recipe-for-disaster:skrach-state') & 1, 1);
  assert.deepEqual(sentVarbits.at(-1), [1908, 1]);
  const boatRoute = routes.at(-1);
  assert.ok(boatRoute);
  const route = { player, npcId: 6260, clickType: 1, definition: { getActions: () => ['Board'] }, range: 1 };
  boatRoute(route);
  assert.equal(route.range, 5);

  assert.equal(condition({ npcId: 6260, player, stepId: 'n8xiFU', text: 'If the player does not have two chompies:' }), false);
  assert.equal(condition({ npcId: 6260, player, stepId: '7ke2SD', text: 'If the player has sufficient payment:' }), true);
  action({ player, npcId: 6260, stepId: 'f2OXgM', action: 'teleport' });
  assert.equal(inventory.get(items.RAW_CHOMPY), 0);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2790, 3077, 0]);

  assert.equal(condition({ npcId: 6261, player, stepId: 'jx9b44', text: 'If the player does not have two snake weed or two Rogue\'s purse:' }), false);
  assert.equal(condition({ npcId: 6261, player, stepId: 'SN91cd', text: 'If the player has sufficient payment:' }), true);
  action({ player, npcId: 6261, stepId: 'Lt1Y5S', action: 'teleport' });
  assert.equal(inventory.get(items.SNAKE_WEED), 0);
  assert.equal(inventory.get(items.ROGUES_PURSE), 0);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2655, 2964, 0]);
});

test("RFD Skrach's cooked chompy summons the free return boat and arrival frees the paid Jubbly hunt", () => {
  const { api: base, handlers } = mockApi();
  const itemOnObject = [];
  const interactions = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onItemOnObject') return (handler) => itemOnObject.push(handler);
      if (property === 'onNpcInteraction') return (...args) => interactions.push(args);
      return target[property];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (...args) => { transcripts.push(args.slice(3, 5)); return true; };
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const cooking = itemOnObject.find((handler) => handler.toString().includes('SKEWERED_CHOMPY'));
  assert.ok(cooking);
  const inventory = new Map([[api.core.ItemIdentifiers.SKEWERED_CHOMPY, 1]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:skrach-state', 7],
  ]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => new api.core.Location(2790, 3077, 0),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
  };
  const event = { player, itemId: api.core.ItemIdentifiers.SKEWERED_CHOMPY,
    objectId: api.core.ObjectIdentifiers.FIRE, handled: false };
  const boatTalk = interactions.find(([handler]) => typeof handler === 'function'
    && handler.toString().includes('OGRE_BOAT_IDS'))?.[0];
  assert.ok(boatTalk);
  try {
    cooking(event);
    assert.equal(inventory.get(api.core.ItemIdentifiers.SKEWERED_CHOMPY), 0);
    assert.equal(inventory.get(api.core.ItemIdentifiers.COOKED_CHOMPY), 1);
    assert.equal(attributes.get('recipe-for-disaster:skrach-state') & 16, 16);
    assert.deepEqual(transcripts.at(-1), ['Recipe for Disaster/Freeing Skrach Uglogwee', 'ranting-with-rantz-after-cooking-the-chompy-on-the-beach']);

    boatTalk({ player, npcId: api.core.NpcIdentifiers.OGRE_BOAT, clickType: 1,
      definition: { getActions: () => ['Board'] }, handled: false });
    assert.deepEqual(transcripts.at(-1), ['Recipe for Disaster/Freeing Skrach Uglogwee', 'ranting-with-rantz-boarding-the-ogre-boat']);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  let destination;
  player.moveTo = (location) => { destination = location; };
  const transfer = handlers.custom.get('npc-dialogue:action').find((handler) => handler.toString().includes('tOD_lg'));
  assert.ok(transfer);
  transfer({ player, npcId: api.core.NpcIdentifiers.OGRE_BOAT, stepId: 'tOD_lg', handled: false });
  assert.equal(attributes.get('recipe-for-disaster:skrach-state') & 8, 8);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2655, 2964, 0]);
});

test("RFD Skrach's second bellows inflation consumes the toad, rock and wool together", () => {
  const { api: base } = mockApi();
  const itemOnItem = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onItemOnItem') return (handler) => itemOnItem.push(handler);
      return target[property];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const assemble = itemOnItem.find((handler) => handler.toString().includes('BALLOON_TOAD'));
  assert.ok(assemble);

  const ids = api.core.ItemIdentifiers;
  const inventory = new Map([[ids.OGRE_BELLOWS_2_, 1], [ids.BLOATED_TOAD, 1], [ids.ROCK, 1]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:skrach-state', 1],
  ]);
  const messages = [];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - [...inventory.values()].reduce((sum, amount) => sum + amount, 0),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    sendMessage: (message) => messages.push(message),
  };
  const combine = (usedItemId, usedWithItemId) => {
    const event = { player, usedItemId, usedWithItemId, handled: false };
    assemble(event);
    assert.equal(event.handled, true);
  };

  combine(ids.BLOATED_TOAD, ids.OGRE_BELLOWS_2_);
  assert.equal(inventory.get(ids.OGRE_BELLOWS_2_), 1);
  assert.equal(inventory.get(ids.BLOATED_TOAD), 1);
  assert.match(messages.at(-1), /rock and a ball of wool/);

  inventory.set(ids.BALL_OF_WOOL, 1);
  combine(ids.BLOATED_TOAD, ids.OGRE_BELLOWS_2_);
  assert.equal(inventory.get(ids.OGRE_BELLOWS_2_), 0);
  assert.equal(inventory.get(ids.BLOATED_TOAD), 0);
  assert.equal(inventory.get(ids.ROCK), 0);
  assert.equal(inventory.get(ids.BALL_OF_WOOL), 0);
  assert.equal(inventory.get(ids.BALLOON_TOAD), 1);
});

test('RFD recognizes the live White Wolf spawn as the Old Dwarf', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const variants = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onNpcInteraction') return (...args) => interactions.push(args);
      if (property === 'onNpcDialogueVariant') return (handler) => variants.push(handler);
      return target[property];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const transcripts = [];
  const selectedSteps = [];
  runtime.startTranscript = (...args) => {
    transcripts.push(args.slice(3, 5));
    if (typeof args[5] === 'function') selectedSteps.push(args[5](runtime.loadTranscripts(api)[args[3]].variants[args[4]]));
    return true;
  };
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handler = interactions.map(([first, actions]) => typeof first === 'function' ? first : actions?.['Talk-to'])
    .find((entry) => entry?.toString().includes('DWARF_NPCS'));
  const attributes = new Map([['quest.recipe_for_disaster.stage', 4]]);
  const inventory = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
  };
  try {
    assert.ok(handler);
    const event = { player, npcId: 4810, clickType: 1, handled: false,
      definition: { getName: () => 'An old Dwarf', getActions: () => ['Talk-to'] } };
    handler(event);
    assert.equal(event.handled, true);
    assert.deepEqual(transcripts.at(-1), [
      'Recipe for Disaster/Freeing the Mountain Dwarf',
      'below-white-wolf-mountain-talking-to-an-old-dwarf',
    ]);
    inventory.set(base.core.ItemIdentifiers.ASGOLDIAN_ALE, 2);
    const firstAle = { player, npcId: 4810, clickType: 1, handled: false,
      definition: { getName: () => 'An old Dwarf', getActions: () => ['Talk-to'] } };
    handler(firstAle);
    assert.equal(inventory.get(base.core.ItemIdentifiers.ASGOLDIAN_ALE), 1);
    assert.equal(attributes.get('recipe-for-disaster:dwarf-state') & 7, 1);
    assert.equal(transcripts.at(-1)[1], 'getting-the-recipe-talking-to-rohak-with-asgoldian-ale-in-inventory');
    const secondAle = { player, npcId: 4810, clickType: 1, handled: false,
      definition: { getName: () => 'An old Dwarf', getActions: () => ['Talk-to'] } };
    handler(secondAle);
    assert.equal(inventory.get(base.core.ItemIdentifiers.ASGOLDIAN_ALE), 0);
    assert.equal(attributes.get('recipe-for-disaster:dwarf-state') & 7, 2);
    assert.equal(transcripts.at(-1)[1], 'getting-the-recipe-talking-to-rohak-with-a-second-asgoldian-ale-in-inventory');
    assert.deepEqual(variants[0]({ npcId: 1316, player,
      pages: [{ page: 'Recipe for Disaster/Freeing the Mountain Dwarf' }] }), {
      page: 'Recipe for Disaster/Freeing the Mountain Dwarf',
      variant: 'the-golden-nectar-talking-to-kaylee',
    });
    const bartender = { player, npcId: 1316, clickType: 1, handled: false,
      definition: { getName: () => 'Kaylee', getActions: () => ['Talk-to'] } };
    handler(bartender);
    assert.equal(bartender.handled, true);
    const copiedBranch = JSON.stringify(selectedSteps.at(-1));
    assert.match(copiedBranch, /"speaker":"Kaylee"/);
    assert.doesNotMatch(copiedBranch, /"speaker":"Emily"/);
    assert.match(copiedBranch, /"id":"QrDkgJ"/);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
});

test('Biohazard does not swallow RFD ingredient conditions', () => {
  const { api: base, handlers } = mockApi();
  require('../plugins/quests/quests/Biohazard.Quest')(base);
  const inventory = { getAmount: () => 0 };
  const player = { getInventory: () => inventory, getEquipment: () => ({ get: () => null }) };
  const condition = handlers.condition[0];
  assert.equal(condition({ player, npcId: 4810, stepId: 'Hk2Tfl',
    text: 'If the player has all the items',
    pages: [{ page: 'Recipe for Disaster/Freeing the Mountain Dwarf' }] }), null);
  assert.equal(condition({ player, npcId: 1102, stepId: 'Biohazard-test',
    text: 'If the player has all the items', pages: [{ page: 'Biohazard' }] }), false);
});

test('RFD gives the Evil Chicken lead to the Wise Old Man only after choosing Sir Amik', () => {
  const { api: base } = mockApi();
  const interactions = [];
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onNpcInteraction') return (...args) => interactions.push(args);
      return target[property];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (...args) => { transcripts.push(args.slice(3, 5)); return true; };
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const wiseOldMan = interactions.find(([name]) => name === 'Wise Old Man')[1]['Talk-to'];
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:rescues', 191],
  ]);
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
  };
  const event = {
    player,
    // The Draynor spawn uses cache variant 2109 rather than the base 2108 ID.
    npcId: 2109,
    clickType: 1,
    definition: { getActions: () => ['Talk-to'] },
  };
  try {
    assert.equal(wiseOldMan(event), false, 'ordinary Wise Old Man dialogue stays available before the quest lead');
    attributes.set('recipe-for-disaster:amik-state', 1);
    assert.equal(wiseOldMan(event), true);
    assert.deepEqual(transcripts.at(-1), [
      'Recipe for Disaster/Freeing Sir Amik Varze',
      'finding-the-lair-talking-to-the-wise-old-man',
    ]);
    attributes.set('recipe-for-disaster:rescues', 255);
    assert.equal(wiseOldMan(event), false, 'the rescue dialogue no longer intercepts after Sir Amik is freed');
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
});

test('RFD Jubbly hunting requires the Ogre bow and equipped Ogre arrows', () => {
  const { api: base } = mockApi();
  const itemActions = [];
  const attackRules = [];
  let spawnedBird;
  const api = new Proxy(base, {
    get(target, property) {
      if (property === 'onItemAction') return (_name, actions) => itemActions.push(actions);
      if (property === 'onCanAttack') return (handler) => attackRules.push(handler);
      if (property === 'spawnNpc') return ({ id }) => (spawnedBird = { getId: () => id });
      return target[property];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const ids = api.core.ItemIdentifiers;
  const npcIds = api.core.NpcIdentifiers;
  const equipment = new Map([[api.core.Equipment.WEAPON_SLOT, ids.OGRE_BOW]]);
  const attributes = new Map([
    ['quest.recipe_for_disaster.stage', 4],
    ['recipe-for-disaster:skrach-state', 1],
  ]);
  const messages = [];
  const player = {
    isPlayer: () => true,
    getAttribute: (key) => attributes.get(key),
    getLocation: () => new api.core.Location(2648, 2963, 0),
    getEquipment: () => ({ get: (slot) => equipment.has(slot) ? { getId: () => equipment.get(slot) } : null }),
    getInventory: () => ({ deleteNumber() {} }),
    sendMessage: (message) => messages.push(message),
  };
  const drop = itemActions.find((actions) => actions.Drop)?.Drop;
  const attack = attackRules.find((handler) => handler.toString().includes('AMMUNITION_SLOT'));
  assert.ok(drop);
  assert.ok(attack);
  drop({ player, itemId: ids.BALLOON_TOAD, option: 'Drop', handled: false });
  const bird = spawnedBird;
  assert.ok(bird);
  const attempt = () => {
    const event = { attacker: player, target: bird, allow: true };
    attack(event);
    return event.allow;
  };
  assert.equal(attempt(), false);
  assert.match(messages.at(-1), /ogre bow and ogre arrows/);
  equipment.set(api.core.Equipment.AMMUNITION_SLOT, ids.OGRE_ARROW);
  assert.equal(attempt(), true);
});

test('RFD counts diving weight in grams and checks the apparatus in the cape slot', () => {
  const { api, handlers } = mockApi();
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const condition = handlers.condition.at(-1);
  const makeItem = (id, weight, amount = 1) => ({
    getId: () => id,
    getAmount: () => amount,
    getDefinition: () => ({ getWeight: () => weight }),
  });
  const inventoryItems = [makeItem(995, 0, 1000), makeItem(-1, 50000, 0)];
  const equipmentItems = new Array(14).fill(null).map(() => makeItem(-1, 50000, 0));
  equipmentItems[api.core.Equipment.HEAD_SLOT] = makeItem(api.core.ItemIdentifiers.FISHBOWL_HELMET, 5000);
  equipmentItems[api.core.Equipment.CAPE_SLOT] = makeItem(api.core.ItemIdentifiers.DIVING_APPARATUS, 10000);
  const equipment = {
    getItems: () => equipmentItems,
    get: (slot) => equipmentItems[slot],
  };
  const inventory = {
    getItems: () => inventoryItems,
    getAmount: () => 0,
  };
  const player = { getInventory: () => inventory, getEquipment: () => equipment };

  assert.equal(condition({ player, text: 'If the player weighs more than 27kg:' }), false);
  assert.equal(condition({ player, text: 'If the player has lost their diving apparatus:' }), false);
  inventoryItems.push(makeItem(231, 12999));
  assert.equal(condition({ player, text: 'If the player weighs more than 27kg:' }), false);
  inventoryItems.push(makeItem(232, 1));
  assert.equal(condition({ player, text: 'If the player weighs more than 27kg:' }), true);
  assert.equal(condition({ player, text: 'If the player is properly equipped:' }), false);
});

test('RFD Murphy distinguishes a cat follower from other pets', () => {
  const { api: base, handlers } = mockApi();
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: { forId: (id) => ({ getName: () => id === 5591 ? 'Pet kitten' : 'Pet' }) } });
  const api = new Proxy(base, { get: (target, prop) => prop === 'core' ? core : target[prop] });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const condition = handlers.condition.at(-1);
  const attributes = new Map();
  const player = { getAttribute: (key) => attributes.get(key), getInventory: () => ({ getAmount: () => 0 }) };
  const pet = { getId: () => 5591, isRegistered: () => true };
  const npcId = api.core.NpcIdentifiers.MURPHY;

  assert.equal(condition({ player, npcId, stepId: 'bPnGSr' }), false);
  assert.equal(condition({ player, npcId, stepId: 'V2XqCw' }), false);
  attributes.set('pets:current', pet);
  assert.equal(condition({ player, npcId, stepId: 'bPnGSr' }), false);
  assert.equal(condition({ player, npcId, stepId: 'V2XqCw' }), true);
});

test('RFD dive and finale actions move players with Location objects', () => {
  const { api, handlers } = mockApi();
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const actions = handlers.custom.get('npc-dialogue:action');
  const action = actions.find((handler) => handler.toString().includes('azBBMr'));
  assert.ok(action);
  const items = api.core.ItemIdentifiers;
  const equipment = new Map([
    [api.core.Equipment.HEAD_SLOT, items.FISHBOWL_HELMET],
    [api.core.Equipment.CAPE_SLOT, items.DIVING_APPARATUS],
  ]);
  let destination;
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({ getItems: () => [], getFreeSlots: () => 27 }),
    getEquipment: () => ({ get: (slot) => ({ getId: () => equipment.get(slot) }) }),
    moveTo: (location) => { destination = location; },
  };
  attributes.set('quest.recipe_for_disaster.stage', 4);
  action({ player, stepId: 'azBBMr' });
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2960, 9512, 1]);
});

test('RFD lets divers leave the mudskipper cave without surfacing', () => {
  const { api: base } = mockApi();
  const objectHandlers = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onObjectInteraction') return (handler) => objectHandlers.push(handler);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const handler = objectHandlers.find((entry) => entry.toString().includes('MUDSKIPPER_CAVE'));
  assert.ok(handler);
  let destination;
  const player = {
    getLocation: () => new api.core.Location(2948, 9524, 1),
    moveTo: (location) => { destination = location; },
  };
  const event = { player, objectId: api.core.ObjectIdentifiers.UNDERWATER_CAVERN_ENTRANCE_4,
    clickType: 1, definition: { getActions: () => ['Exit'] } };
  handler(event);
  assert.equal(event.handled, true);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2948, 9512, 1]);

  const attributes = new Map([['recipe-for-disaster:pirate-state', 8]]);
  const outside = {
    getAttribute: (key) => attributes.get(key),
    getLocation: () => new api.core.Location(2975, 9512, 1),
    getInventory: () => ({ getAmount: (id) => id === api.core.ItemIdentifiers.ROCK_7 ? 5 : 0 }),
    moveTo: (location) => { destination = location; },
  };
  const door = { player: outside, objectId: api.core.ObjectIdentifiers.PEN_DOOR,
    clickType: 1, definition: { getActions: () => ['Open'] } };
  handler(door);
  assert.equal(door.handled, true);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2975, 9518, 1]);
  outside.getLocation = () => new api.core.Location(2975, 9518, 1);
  handler(door);
  assert.deepEqual([destination.getX(), destination.getY(), destination.getZ()], [2975, 9512, 1]);
});

test('RFD Mother cycles six weaknesses and the final room suppresses prayer and regeneration', (t) => {
  const { api: base } = mockApi();
  const loginHandlers = [];
  const prayerHandlers = [];
  const deathHandlers = [];
  const objectHandlers = [];
  const npcDeathHandlers = [];
  const combatHitHandlers = [];
  const npcHitModifyHandlers = [];
  const spawns = [];
  const core = Object.create(base.core);
  Object.defineProperty(core, 'NpcDefinition', { value: { forId: () => ({ getActions: () => ['Talk-to'] }) } });
  Object.defineProperty(core, 'Boundary', { value: class Boundary { constructor(...values) { this.values = values; } } });
  Object.defineProperty(core, 'PrivateArea', { value: class PrivateArea {
    constructor(boundaries) { this.boundaries = boundaries; this.members = new Set(); this.destroyed = false; }
    enter(mobile) { this.members.add(mobile); mobile.setArea(this); }
    leave(mobile) { this.members.delete(mobile); mobile.setArea(null); if (!this.members.size) this.destroyed = true; }
    hasMember(mobile) { return this.members.has(mobile); }
    isDestroyed() { return this.destroyed; }
  } });
  Object.defineProperty(core, 'PrayerHandler', { value: { deactivatePrayers() {} } });
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return core;
      if (prop === 'onPlayerLogin') return (handler) => loginHandlers.push(handler);
      if (prop === 'onPrayerDisabled') return (handler) => prayerHandlers.push(handler);
      if (prop === 'onPlayerDeath') return (handler) => deathHandlers.push(handler);
      if (prop === 'onObjectInteraction') return (...args) => objectHandlers.push(args);
      if (prop === 'onNpcDeath') return (handler) => npcDeathHandlers.push(handler);
      if (prop === 'onCombatHitResolved') return (handler) => combatHitHandlers.push(handler);
      if (prop === 'onNpcHitModify') return (handler) => npcHitModifyHandlers.push(handler);
      if (prop === 'spawnNpc') return (definition) => {
        let refreshes = 0;
        let area = null;
        const npc = { definition, refreshes: () => refreshes, getArea: () => area,
          setArea: (next) => { area = next; }, isRegistered: () => true, isNpc: () => true,
          setNpcTransformationId: (id) => { npc.transformation = id; },
          getCombat: () => ({ getLastAttack: () => ({ reset: () => refreshes++ }) }) };
        spawns.push(npc);
        return npc;
      };
      return target[prop];
    },
  });
  require('../plugins/quests/Quests.plugin').register(api);
  delete require.cache[require.resolve('../plugins/quests/quests/RecipeForDisaster.Quest')];
  require('../plugins/quests/quests/RecipeForDisaster.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quests = getRegisteredQuests();
  const quest = quests.findLast(({ key }) => key === 'recipe_for_disaster');
  const attributes = new Map([
    ['recipe-for-disaster:rescues', 255],
    ['recipe-for-disaster:culinaromancer-wave', 5],
    ['quest.points', 175],
  ]);
  const equipment = [];
  const { CombatSpells } = require('../dist/game/content/combat/magic/CombatSpells');
  const { PendingHit } = require('../dist/game/content/combat/hit/PendingHit');
  const { MagicCombatMethod } = require('../dist/game/content/combat/method/impl/MagicCombatMethod');
  t.mock.method(PendingHit.prototype, 'prepareHits', function () {
    this.accurate = true;
    this.totalDamage = 7;
    let damage = 7;
    return [{ getDamage: () => damage, setDamage: (value) => { damage = value; } }];
  });
  let selectedSpell = null;
  const player = {
    isPlayer: () => true,
    getAsPlayer: () => player,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getArea: () => area,
    setArea: (next) => { area = next; },
    getLocation: () => ({ getX: () => 1900, getY: () => 5355, getZ: () => 2 }),
    getSkillManager: () => ({ getCurrentLevel: () => 1 }),
    getPrayerActive: () => [],
    getEquipment: () => ({ getItems: () => equipment }),
    getCombat: () => ({ getSelectedSpell: () => selectedSpell }),
    moveTo: (location) => { player.destination = location; },
    getPacketSender: () => new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => {} : undefined }),
    messages: [], sendMessage(message) { this.messages.push(message); },
  };
  let area = null;
  quest.setStage(player, 4);
  for (const key of ['fishing_contest', 'goblin_diplomacy', 'big_chompy_bird_hunting', 'murder_mystery',
    'nature_spirit', 'witchs_house', 'gertrudes_cat', 'shadow_of_the_storm', 'monkey_madness_i',
    'family_crest', 'heroes_quest', 'lost_city', 'merlins_crystal', 'shield_of_arrav', 'dragon_slayer_i',
    'shilo_village', 'jungle_potion', 'druidic_ritual', 'underground_pass', 'biohazard', 'plague_city',
    'waterfall_quest', 'desert_treasure_i', 'horror_from_the_deep']) {
    const prerequisite = quests.findLast((entry) => entry.key === key);
    assert.ok(prerequisite, `missing prerequisite quest ${key}`);
    prerequisite.setStage(player, prerequisite.completionValue);
  }
  quests.findLast((entry) => entry.key === 'legends_quest')?.setStage(player, 5);

  loginHandlers.findLast(Boolean)({ player });
  const mother = spawns.at(-1);
  assert.equal(mother.definition.id, api.core.NpcIdentifiers.GELATINNOTH_MOTHER);
  assert.deepEqual(mother.definition, { id: api.core.NpcIdentifiers.GELATINNOTH_MOTHER,
    x: 1900, y: 5355, z: 2, wanderRadius: 0, owner: player, ownerOnly: true });
  assert.deepEqual(player.getArea().boundaries[0].values, [1889, 1910, 5345, 5366, 2]);
  assert.equal(mother.transformation, 4884);
  player.getArea().process(player);
  assert.equal(mother.refreshes(), 1);
  const handleMotherHit = npcHitModifyHandlers.findLast((handler) => handler.toString().includes('motherPhaseFor'));
  assert.equal(handleMotherHit.name, 'enforceMotherWeakness');
  const makeHit = (type, accurate = true, spell = null) => {
    let damage = 7;
    const hitDamage = { setDamage(value) { damage = value; }, getDamage() { return damage; } };
    return {
      getAttacker: () => player,
      getCombatType: () => type,
      getSpell: () => spell,
      isAccurate: () => accurate,
      getHits: () => [hitDamage],
      getTotalDamage: () => damage,
      setTotalDamage(value) { hitDamage.setDamage(value); },
    };
  };
  const wrongStyle = makeHit(api.core.CombatType.MELEE);
  const victim = { hitpoints: 100 };
  handleMotherHit({ npc: mother, hit: wrongStyle });
  victim.hitpoints -= wrongStyle.getTotalDamage();
  assert.equal(victim.hitpoints, 100, 'the pre-damage hook prevents an accurate wrong-style hit from reducing HP');
  assert.equal(wrongStyle.getTotalDamage(), 0, 'the white form blocks melee before damage is applied');
  selectedSpell = CombatSpells.WIND_BLAST;
  equipment[api.core.Equipment.WEAPON_SLOT] = { getId: () => api.core.ItemIdentifiers.STAFF_OF_AIR };
  const airHit = makeHit(api.core.CombatType.MAGIC, true, selectedSpell);
  handleMotherHit({ npc: mother, hit: airHit });
  assert.equal(airHit.getTotalDamage(), 7, 'the white form accepts an air spell');
  for (let tick = 0; tick < 29; tick++) player.getArea().process(player);
  assert.equal(mother.transformation, 4885, 'the Mother changes to blue after 30 ticks');
  selectedSpell = CombatSpells.WATER_BLAST;
  player.getLocation = () => new api.core.Location(1900, 5355, 2);
  mother.getLocation = () => new api.core.Location(1900, 5355, 2);
  mother.getSize = () => 1;
  const waterHit = new MagicCombatMethod().hits(player, mother)[0];
  selectedSpell = null; // MagicCombatMethod.finished clears the selected cast before impact.
  handleMotherHit({ npc: mother, hit: waterHit });
  assert.equal(waterHit.getTotalDamage(), 7, 'Water Blast remains water even when an air staff supplies its air runes');
  selectedSpell = CombatSpells.WIND_BLAST;
  const wrongAirHit = new MagicCombatMethod().hits(player, mother)[0];
  selectedSpell = null;
  handleMotherHit({ npc: mother, hit: wrongAirHit });
  assert.equal(wrongAirHit.getTotalDamage(), 0, 'the blue form blocks an air spell even with an air staff equipped');
  const phaseCases = [
    { type: api.core.CombatType.MELEE, spell: null, wrongType: api.core.CombatType.MAGIC },
    { type: api.core.CombatType.MAGIC, spell: CombatSpells.EARTH_BLAST, wrongSpell: CombatSpells.FIRE_BLAST },
    { type: api.core.CombatType.MAGIC, spell: CombatSpells.FIRE_BLAST, wrongSpell: CombatSpells.EARTH_BLAST },
    { type: api.core.CombatType.RANGED, spell: null, wrongType: api.core.CombatType.MELEE },
  ];
  for (let phase = 2; phase < 6; phase++) {
    for (let tick = 0; tick < 30; tick++) player.getArea().process(player);
    assert.equal(mother.transformation, 4884 + phase);
    const current = phaseCases[phase - 2];
    selectedSpell = current.spell;
    const valid = makeHit(current.type, true, current.spell);
    handleMotherHit({ npc: mother, hit: valid });
    assert.equal(valid.getTotalDamage(), 7, `phase ${phase} accepts its required combat style`);
    selectedSpell = current.wrongSpell ?? null;
    const invalid = makeHit(current.wrongType ?? api.core.CombatType.MAGIC, true, current.wrongSpell ?? null);
    handleMotherHit({ npc: mother, hit: invalid });
    assert.equal(invalid.getTotalDamage(), 0, `phase ${phase} rejects the wrong combat style`);
  }
  attributes.set('recipe-for-disaster:culinaromancer-wave', 3);
  const combatLevels = new Map([[api.core.Skill.ATTACK, 99], [api.core.Skill.STRENGTH, 99],
    [api.core.Skill.DEFENCE, 99], [api.core.Skill.RANGED, 99], [api.core.Skill.MAGIC, 99]]);
  player.getSkillManager = () => ({
    getCurrentLevel: (skill) => combatLevels.get(skill) ?? 1,
    setCurrentLevelCombat: (skill, value) => combatLevels.set(skill, value),
  });
  player.setRunEnergy = (value) => { player.runEnergy = value; };
  player.setSpecialPercentage = (value) => { player.special = value; };
  player.getPacketSender = () => new Proxy({}, { get: (_target, key) => key.startsWith('send') ? () => {} : undefined });
  player.getTimers = () => ({ has: () => false, registers() {} });
  player.getCombat = () => ({ reset() {} });
  player.getMovementQueue = () => ({ reset() {} });
  player.performGraphic = () => {};
  const karamel = { isNpc: () => true, getId: () => api.core.NpcIdentifiers.KARAMEL };
  const karamelHit = { getCombatType: () => api.core.CombatType.MAGIC, isAccurate: () => true,
    getTotalDamage: () => 5 };
  combatHitHandlers.findLast((handler) => handler.toString().includes('Karamel'))({ attacker: karamel, target: player, hit: karamelHit });
  assert.ok([...combatLevels.values()].some((level) => level < 99), 'Karamel lowers combat stats on a successful magic hit');
  assert.equal(player.runEnergy, 0);
  assert.equal(player.special, 0);
  const prayer = { player, disabled: null };
  prayerHandlers.at(-1)(prayer);
  assert.equal(prayer.disabled, true);
  assert.match(prayer.message, /cannot use Prayer/);
  player.setArea(null);
  const outsidePrayer = { player, disabled: null };
  prayerHandlers.at(-1)(outsidePrayer);
  assert.equal(outsidePrayer.disabled, null);
  attributes.set('recipe-for-disaster:culinaromancer-wave', 5);
  player.setArea(mother.getArea());
  const portal = objectHandlers.findLast(([name]) => name === 'Portal')?.[1];
  assert.equal(typeof portal?.Use, 'function');
  assert.equal(portal.Use({ player, action: 'Use', location: { x: 1900, y: 5345, z: 2 } }), true);
  assert.deepEqual([player.destination.getX(), player.destination.getY(), player.destination.getZ()], [3209, 3218, 0]);
  assert.equal(player.getArea(), null);
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), 5,
    'leaving the arena preserves the next wave checkpoint');
  assert.equal(portal.Use({ player, action: 'Use', location: { x: 3209, y: 3218, z: 0 } }), true);
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), 5);
  assert.equal(spawns.at(-1).definition.id, api.core.NpcIdentifiers.GELATINNOTH_MOTHER,
    're-entering resumes the saved wave');
  attributes.set('recipe-for-disaster:culinaromancer-wave', 1);
  loginHandlers.findLast(Boolean)({ player });
  deathHandlers.at(-1)({ player });
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), -1);
  assert.equal(player.getArea(), null);

  attributes.set('recipe-for-disaster:culinaromancer-wave', 5);
  assert.equal(portal.Use({ player, action: 'Use', location: { x: 3209, y: 3218, z: 0 } }), true);
  const transformedMother = spawns.at(-1);
  transformedMother.setNpcTransformationId(4889);
  const advanceFinale = npcDeathHandlers.findLast((handler) => handler.toString().includes('encounter.wave !== wave'));
  advanceFinale({ killer: player, npc: transformedMother, npcId: 4889 });
  assert.equal(attributes.get('recipe-for-disaster:culinaromancer-wave'), 6,
    'a transformed Mother reports its live cache id and still advances to the Culinaromancer');
  assert.equal(spawns.at(-1).definition.id, api.core.NpcIdentifiers.CULINAROMANCER_9);
});
