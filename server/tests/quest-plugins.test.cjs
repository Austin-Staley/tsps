// Run after `yarn build`: node --test tests/quest-plugins.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { PluginManager } = require('../dist/plugins/PluginManager');
const apiMethods = new Set(Object.keys(PluginManager.createApi('QuestTest')));

// A stand-in for the live PluginApi: real core, every hook a no-op. Quests must
// register cleanly through it and hand back their variant/condition resolvers.
function mockApi() {
  const objects = [];
  const routes = [];
  const npcInteractions = new Map();
  const handlers = {
    variant: [],
    condition: [],
    custom: new Map(),
    npcInteractions,
    npc: npcInteractions,
    area: [],
    ground: [],
    namedItemActions: new Map(),
    objects,
    object: objects,
    itemOnItem: [],
    itemOnNpc: [],
    itemOnObject: [],
    itemAction: [],
    routes,
    route: routes,
    walkRoutes: [],
    playerProcess: [],
    npcBeforeDeath: [],
    npcDeath: [],
    npcHitModify: [],
  };
  const noop = () => {};
  const base = {
    core: PluginManager.getCoreApi(),
    onNpcDialogueVariant: (h) => handlers.variant.push(h),
    onNpcDialogueCondition: (h) => handlers.condition.push(h),
    onObjectInteraction: (target, actions) => {
      if (typeof target === 'function') return handlers.objects.push(target);
      for (const [option, handler] of Object.entries(actions)) handlers.objects.push(event => {
        if (event.definition?.getName?.() === target && event.option === option) return handler(event);
        return false;
      });
    },
    onNpcInteraction: (target, actions) => { assert(['string', 'function'].includes(typeof target), 'NPC hooks accept names or generic handlers'); handlers.npcInteractions.set(target, actions); },
    onObjectRoute: (h) => handlers.routes.push(h),
    onWalkRoute: (h) => handlers.walkRoutes.push(h),
    onPlayerProcess: (h) => handlers.playerProcess.push(h),
    onNpcBeforeDeath: h => handlers.npcBeforeDeath.push(h),
    onNpcDeath: h => handlers.npcDeath.push(h),
    onNpcHitModify: (h) => handlers.npcHitModify.push(h),
    onItemOnItem: (h) => handlers.itemOnItem.push(h),
    onItemOnNpc: (h) => handlers.itemOnNpc.push(h),
    onItemOnObject: (...args) => handlers.itemOnObject.push(typeof args[0] === 'function' ? args[0] : args[2]),
    onItemAction: (...args) => {
      handlers.itemAction.push(args.at(-1));
      if (typeof args[0] === 'string') handlers.namedItemActions.set(args[0], args[1]);
    },
    registerArea: area => handlers.area.push(area),
    onGroundItemPickup: handler => handlers.ground.push(handler),
    onCustomEvent: (name, h) => {
      const list = handlers.custom.get(name) ?? [];
      list.push(h);
      handlers.custom.set(name, list);
    },
    emitCustomEvent: (name, event) => {
      for (const handler of handlers.custom.get(name) ?? []) handler(event);
    },
    persistAttribute: noop,
  };
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (apiMethods.has(prop)) return noop;
      throw Error('Unknown PluginApi member: '+String(prop));

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
  assert.equal(player.varbits.get(10782), 1);
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

test('walk route hooks can claim a map-click path before collision pathfinding', () => {
  const calls = [];
  PluginManager.createApi('WalkRouteTest').onWalkRoute((event) => {
    calls.push([event.player, event.destination]);
    event.handled = true;
  });
  const player = {};
  const destination = { x: 10, y: 20, z: 0 };
  const event = { player, destination, handled: false };
  assert.equal(PluginManager.emitWalkRoute(event), true);
  assert.equal(event.handled, true);
  assert.deepEqual(calls, [[player, destination]]);

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

test('The Blood Moon Rises starts only after Sarius accepts the yes choice and requirements pass', () => {
  const { api, handlers } = mockApi();
  const npcHooks = [];
  const prompts = [];
  let reclaimed = 0;
  let nightComplete = true;
  api.emitCustomEvent = (name, event) => {
    if (name === 'quest:is-complete') event.complete = event.key === 'a_night_at_the_theatre' ? nightComplete : true;
    if (name === 'night-at-the-theatre:claim-lamps') { reclaimed++; event.handled = true; }
  };
  api.onAnyNpcInteraction = (hook) => npcHooks.push(hook);
  api.sendMultiChatboxPrompt = (_player, title, ...options) => prompts.push({ title, options });
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  let skillLevel = 70;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getMaxLevel: () => skillLevel }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  const choose = handlers.custom.get('npc-dialogue:choice').at(-1);
  const event = { player, option: 'Yes.', definition: { getName: () => 'Sarius Guile' } };
  choose(event);
  assert.equal(quest.getStage(player), 0, 'the skill gate blocks the start');
  skillLevel = 99;
  choose(event);
  assert.equal(quest.getStage(player), 10, 'accepting Sarius’s invitation starts the quest');
  choose({ ...event, definition: { getName: () => 'Ivan Strom' } });
  assert.equal(quest.getStage(player), 10, 'another NPC’s yes choice cannot start this quest');
  nightComplete = false;
  const stranger = npcHooks.at(-1)['Talk-to'];
  const interaction = { player, definition: { getName: () => 'Mysterious Stranger' }, handled: false };
  assert.equal(stranger(interaction), false, 'Night at the Theatre retains the Stranger until it is complete');
  nightComplete = true;
  quest.setStage(player, 10);
  assert.equal(stranger(interaction), true, 'Blood Moon preserves the lamp service without swallowing Night dialogue');
  assert.equal(interaction.handled, true);
  assert.match(prompts.at(-1).options[0], /Claim unused Hallowed lamps/);
  assert.equal(reclaimed, 0, 'opening the menu does not reclaim lamps before the player chooses');
  prompts.at(-1).options[1]();
  assert.equal(reclaimed, 1, 'the explicit option delegates to Night at the Theatre’s inventory-safe reclaim event');
});

test('Blood Moon portal entry starts the Castle Drakan chapter where the physical puzzle handlers become active', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
  };
  quest.setStage(player, 30);
  const enter = handlers.objects.find((handler) => handler.name === 'enterVampyriumCastle');
  enter({ player, definition: { getName: () => 'Ominous red portal' }, location: { x: 3161, y: 7710, z: 0 }, handled: false });
  assert.equal(quest.getStage(player), 40);
});

test('Blood Moon Hallowed preparations make the stew, upgraded flail and stakes before the siege stage', () => {
  const { api, handlers } = mockApi();
  const originalForId = api.core.NpcDefinition.forId;
  api.core.NpcDefinition.forId = () => ({ getName: () => 'Safalaan Hallow' });
  const messages = [];
  let menu;
  api.sendMultiChatboxPrompt = (player, title, ...options) => { menu = options; };
  const choose = option => menu[option*2-1]();
  api.emitCustomEvent = (name, event) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(event);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    getFreeSlots: () => 0,
    contains: (id) => (counts.get(id) ?? 0) > 0,
    getAmount: (id) => counts.get(id) ?? 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getEquipment: () => ({ contains: () => false }),
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage: (text) => messages.push(text),
  };
  quest.setStage(player, 60);
  const object = handlers.objects.find((handler) => handler.name === 'handlePrepObject');
  const itemOnItem = handlers.itemOnItem.find((handler) => handler.name === 'handlePrepItemOnItem');
  const itemOnNpc = handlers.itemOnNpc.at(-1);
  const ids = api.core.ItemIdentifiers;
  const use = (a, b) => itemOnItem({ player, usedItemId: a, usedWithItemId: b, handled: false });
  const interact = (name, x = 0, y = 0, z = 1) => object({ player, definition: { getName: () => name }, option: 'Search', location: { x, y, z }, handled: false });

  interact('Amitire plant', 2982, 7679, 0);
  interact('Shelves', 3159, 7824);
  const itemOnObject = handlers.itemOnObject.find(handler => handler.name === 'handlePrepItemOnObject');
  itemOnObject({ player, itemId: ids.BOWL, objectId: 62097, location: { x: 3156, y: 7824, z: 1 } });
  interact('Cupboard', 3155, 7832); choose(3); assert.equal(inventory.contains(ids.POTATO), false, 'Nothing does not award ingredients');
  interact('Cupboard', 3155, 7832); choose(1);
  use(ids.BOWL_OF_WATER, ids.POTATO);
  interact('Cupboard', 3155, 7832); choose(2);
  interact('Range', 3160, 7826);
  use(ids.INCOMPLETE_STEW, ids.COOKED_MEAT);
  interact('Range', 3160, 7826);
  use(ids.STEW, ids.AMITIRE_LEAVES);
  assert.equal(inventory.contains(ids.AMITIRE_STEW), true, 'the ordered ingredients create the quest stew');
  const feeding = { player, target: { getName: () => 'Safalaan Hallow' }, npcId: api.core.NpcIdentifiers.SAFALAAN_HALLOW, itemId: ids.AMITIRE_STEW, handled: false };
  itemOnNpc(feeding);
  assert.equal(feeding.handled, true);
  assert.equal(inventory.contains(ids.HALLOWED_MARKS), true, 'feeding Safalaan grants the hallowed marks');

  interact('Workbench', 3176, 7841); choose(3); assert.equal(inventory.contains(ids.KNIFE), true); assert.equal(inventory.contains(ids.HAMMER), false);
  interact('Workbench', 3176, 7841); choose(1); interact('Workbench', 3176, 7841); choose(2);
  interact('Crate', 3177, 7843);
  interact('Crate', 3181, 7841);
  interact('Chest', 3181, 7835);
  use(ids.SILVER_SICKLE_B_, ids.DIAMOND); choose(2); assert.equal(inventory.contains(ids.DIAMOND), true, 'No preserves crafting materials');
  use(ids.SILVER_SICKLE_B_, ids.DIAMOND); choose(1);
  interact('Chest', 3175, 7836);
  use(ids.DIAMOND_SICKLE_B_, ids.ENCHANT_DIAMOND);
  use(ids.ENCHANTED_DIAMOND_SICKLE_B_, ids.BLISTERWOOD_LOGS); choose(1);
  inventory.adds(ids.BLISTERWOOD_FLAIL, 1);
  interact('Anvil', 3179, 7842); choose(2); assert.equal(inventory.contains(ids.BLISTERWOOD_FLAIL), true);
  interact('Anvil', 3179, 7842); choose(1);
  assert.equal(inventory.contains(ids.HALLOWED_FLAIL), true, 'the anvil consumes the sickle/marks/flail and makes a hallowed flail');
  interact('Crate', 3177, 7843);
  use(ids.BLISTERWOOD_LOGS, ids.KNIFE);
  const action = handlers.custom.get('npc-dialogue:action').at(-1);
  action({ player, stepId: 'Sut83Q' });
  assert.equal(quest.getStage(player), 70, 'the siege starts after the player crafts both required defence items');
  assert.ok(messages.length > 0, 'interactions give feedback while ingredients and equipment are prepared');
  api.core.NpcDefinition.forId = originalForId;
});

test('Blood Moon Castle Drakan throne opens only after the ordered bust mechanism and awards its key', () => {
  const { api, handlers } = mockApi();
  const messages = [];
  api.emitCustomEvent = (name, event) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(event);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage: (text) => messages.push(text),
  };
  quest.setStage(player, 40);
  const interact = (name, x, y, option) => {
    const event = { player, definition: { getName: () => name }, location: { x, y, z: 0 }, option, handled: false };
    for (const handler of handlers.objects) {
      handler(event);
      if (event.handled) break;
    }
    return event;
  };
  const action = handlers.custom.get('npc-dialogue:action').at(-1);
  action({ player, stepId: 'XqVfhB' });
  assert.equal(quest.getStage(player), 40, 'the escape transcript cannot bypass the throne puzzle');
  interact('Throne', 2313, 7392, 'Search');
  interact('Bust with lever', 2317, 7393, 'Pull');
  assert.ok(messages.some((message) => message.includes('reset')), 'the wrong first lever resets the mechanism');
  for (const y of [7391, 7390, 7393, 7392]) interact('Bust with lever', 2317, y, 'Pull');
  interact('Throne', 2313, 7392, 'Search');
  assert.equal(inventory.contains(api.core.ItemIdentifiers.HALF_MOON_KEY), true);
  action({ player, stepId: 'XqVfhB' });
  assert.equal(quest.getStage(player), 45, 'the escape chapter advances only after claiming the key');
});

test('Blood Moon Castle basin puzzle requires all four correct potions before revealing the ancient symbol', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const objects = handlers.objects;
  const shelves = objects.find((handler) => handler.name === 'handleCastleBasinPuzzle');
  const altar = objects.find((handler) => handler.name === 'handleBasinAltar');
  shelves({ player, definition: { getName: () => 'Shelves' }, location: { x: 2380, y: 7396, z: 0 }, handled: false });
  const I = api.core.ItemIdentifiers;
  for (const id of [I.CLOUDY_GREY_POTION, I.WEIGHTLESS_BLACK_POTION, I.THICK_RED_POTION, I.COLD_BLUISH_WHITE_POTION]) {
    assert.equal(inventory.contains(id), true, 'searching the shelves gives each distinct potion');
  }
  const pour = (itemId, objectId, x, y) => {
    const event = { player, itemId, objectId, location: { x, y, z: 0 }, handled: false };
    handlers.itemOnObject.find((handler) => handler.name === 'handleBasinPotion')(event);
    return event;
  };
  assert.equal(pour(I.CLOUDY_GREY_POTION, 61704, 2380, 7389).handled, true);
  assert.equal(inventory.contains(I.CLOUDY_GREY_POTION), true, 'a wrong basin keeps the potion');
  pour(I.THICK_RED_POTION, 61704, 2380, 7389);
  pour(I.WEIGHTLESS_BLACK_POTION, 61703, 2387, 7389);
  pour(I.CLOUDY_GREY_POTION, 61702, 2380, 7384);
  pour(I.COLD_BLUISH_WHITE_POTION, 61705, 2387, 7384);
  altar({ player, definition: { getName: () => 'Altar' }, location: { x: 2382, y: 7393, z: 0 }, handled: false });
  assert.equal(inventory.contains(I.ANCIENT_SYMBOL), true, 'all four correctly poured potions reveal the symbol');
});

test('Blood Moon solid key requires the symbol, shield assembly, and southern wall mount', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map([
    ['quest.the_blood_moon_rises.castle-basin-puzzle', { basins: { one: true, two: true, three: true, four: true }, symbol: true }],
  ]);
  const counts = new Map([[api.core.ItemIdentifiers.ANCIENT_SYMBOL, 1]]);
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const I = api.core.ItemIdentifiers;
  const object = handlers.objects.find((handler) => handler.name === 'handleSolidKeyObjects');
  object({ player, definition: { getName: () => 'Crate' }, location: { x: 2439, y: 7378, z: 0 }, handled: false });
  assert.equal(inventory.contains(I.ANCIENT_SHIELD), true, 'the room crate supplies the ancient shield after the symbol is found');
  handlers.itemOnItem.find((handler) => handler.name === 'handleAncientShieldAssembly')({
    player, usedItemId: I.ANCIENT_SYMBOL, usedWithItemId: I.ANCIENT_SHIELD, handled: false,
  });
  assert.equal(inventory.contains(I.SHIELD_WITH_SYMBOL), true);
  const mount = handlers.itemOnObject.find((handler) => handler.name === 'handleMountShield');
  mount({ player, itemId: I.SHIELD_WITH_SYMBOL, location: { x: 2543, y: 7361, z: 0 }, handled: false });
  object({ player, definition: { getName: () => 'Shield' }, location: { x: 2543, y: 7361, z: 0 }, handled: false });
  assert.equal(inventory.contains(I.SOLID_KEY), true, 'searching the mounted shield yields the solid key');
});

test('Blood Moon clocks require the proper hands and both poem times before the fireplace gives an emblem', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const interact = handlers.objects.find((handler) => handler.name === 'handleCastleClocks');
  interact({ player, objectId: 61752, location: { x: 2323, y: 7386, z: 0 }, handled: false });
  interact({ player, objectId: 61751, location: { x: 2466, y: 7370, z: 0 }, handled: false });
  const hand = handlers.itemOnObject.find((handler) => handler.name === 'handleClockHandOnClock');
  hand({ player, objectId: 61656, itemId: api.core.ItemIdentifiers.SMALL_CLOCK_HAND, location: { x: 2344, y: 7372, z: 0 }, handled: false });
  hand({ player, objectId: 61657, itemId: api.core.ItemIdentifiers.LARGE_CLOCK_HAND, location: { x: 2350, y: 7372, z: 0 }, handled: false });
  const adjusted = { west: 0, east: 0 };
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => {
    if (title.startsWith('Adjust the')) {
      const side = title.includes('west') ? 'west' : 'east';
      pairs[adjusted[side]++ === 0 ? 1 : 3]();
    } else if (title.startsWith('Set the')) {
      const target = title.includes('large') ? (title.includes('west') ? 11 : 0) : (title.includes('west') ? 9 : 4);
      pairs[target * 2 + 1]();
    }
  };
  interact({ player, objectId: 61656, location: { x: 2344, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61656, location: { x: 2344, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61657, location: { x: 2350, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61657, location: { x: 2350, y: 7372, z: 0 }, handled: false });
  interact({ player, objectId: 61662, location: { x: 2346, y: 7372, z: 0 }, handled: false });
  assert.equal(inventory.contains(api.core.ItemIdentifiers.DRAKAN_EMBLEM_2), true);
});

test('Blood Moon gallery chest arrow puzzle resets mistakes and gives the crescent key after the right sequence', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const chest = handlers.objects.find((handler) => handler.name === 'handleGalleryChest');
  const interact = () => chest({ player, objectId: 61681, location: { x: 2379, y: 7372, z: 0 }, handled: false });
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[1]();
  interact();
  assert.equal(attributes.get('quest.the_blood_moon_rises.gallery-chest').step, 0, 'an incorrect first arrow resets the sequence');
  const correct = [1, 2, 1, 3, 3];
  let currentStep = 0;
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[correct[currentStep++] * 2 + 1]();
  interact();
  assert.equal(attributes.get('quest.the_blood_moon_rises.gallery-chest').solved, true);
  interact();
  assert.equal(inventory.contains(api.core.ItemIdentifiers.CRESCENT_MOON_KEY), true);
});

test('Blood Moon hunt requires the crank, bookcase key and TOOLS shed code before yielding bolt cutters', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 50);
  const route = handlers.routes.find((handler) => handler.name === 'routeBloodHuntObjects');
  const bookcaseRoute = { player, objectId: 61818, object: { getLocation: () => ({}) }, destination: null };
  bookcaseRoute.object.getLocation = () => ({ getX: () => 2585, getY: () => 7861, getZ: () => 0 });
  route(bookcaseRoute);
  assert.deepEqual(bookcaseRoute.destination, { x: 2584, y: 7862, z: 0 }, 'the bookcase is approached from its reachable southern side');
  let spawned = null;
  api.getItemOnGroundManager = () => ({
    getGroundItem: () => null,
    registerLocation: (_who, item, tile) => { spawned = { item, tile }; },
  });
  player.getUsername = () => 'BloodHuntFixture';
  player.isPlayerBot = () => false;
  player.getPrivateArea = () => null;
  handlers.playerProcess.find((handler) => handler.name === 'syncHuntGroundItems')({ player });
  assert.equal(spawned.item.id, api.core.ItemIdentifiers.CRANK_WHEEL, 'the crank wheel spawns at the mapped hunt tile');
  assert.deepEqual([spawned.tile.getX(), spawned.tile.getY(), spawned.tile.getZ()], [2603, 7847, 0]);
  const hunt = handlers.objects.find((handler) => handler.name === 'handleBloodHuntObjects');
  const interact = (x, y) => hunt({ player, location: { x, y, z: 0 }, handled: false });
  const ids = api.core.ItemIdentifiers;
  inventory.adds(ids.CRANK_WHEEL, 1);
  interact(2588, 7855);
  interact(2585, 7861);
  assert.equal(inventory.contains(ids.DUSTY_BOOK), true, 'the crank chase unlocks the bookcase');
  const read = handlers.itemAction.find((actions) => actions.Read)?.Read;
  read({ player, itemId: ids.DUSTY_BOOK, handled: false });
  assert.equal(inventory.contains(ids.VITUR_KEY), true, 'reading the dusty book gives the Vitur key');
  let digit = 0;
  const sequence = [0, 1, 1, 2, 3];
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[sequence[digit++] * 2 + 1]();
  interact(2616, 7855);
  assert.equal(attributes.get('quest.the_blood_moon_rises.blood-hunt').shedOpen, true);
  interact(2616, 7855);
  assert.equal(inventory.contains(ids.BOLT_CUTTERS), true, 'the opened shed provides the bolt cutters');
  interact(2600, 7845);
  interact(2590, 7818);
  interact(2588, 7816);
  assert.equal(inventory.contains(ids.TOOTH_HALF_OF_KEY_6), true);
  assert.equal(inventory.contains(ids.LOOP_HALF_OF_KEY_6), true);
  const combine = handlers.itemOnItem.find((handler) => handler.name === 'handleBloodHuntItemOnItem');
  combine({ player, usedItemId: ids.LOOP_HALF_OF_KEY_6, usedWithItemId: ids.TOOTH_HALF_OF_KEY_6, handled: false });
  assert.equal(inventory.contains(ids.MYRMEL_KEY), true, 'both halves combine into the pub key');
  interact(2596, 7833);
  const useOnObject = handlers.itemOnObject.find((handler) => handler.name === 'handleBloodHuntItemOnObject');
  useOnObject({ player, itemId: ids.BUCKET, objectId: 1, location: { x: 2592, y: 7825, z: 0 }, handled: false });
  useOnObject({ player, itemId: ids.BUCKET_OF_WATER, objectId: 1, location: { x: 2592, y: 7833, z: 0 }, handled: false });
  assert.equal(inventory.contains(ids.SHADUM_KEY), true, 'water on the northern barrel reveals the Shadum key');
  interact(2619, 7812);
  assert.equal(inventory.contains(ids.TRAPDOOR_KEY), true, 'the Shadum house contains the trapdoor key');
  interact(2580, 7835);
  interact(2582, 7834);
  assert.equal(attributes.get('quest.the_blood_moon_rises.blood-hunt').bankCrank, true);
  interact(2579, 7830);
  let chestDigit = 0;
  const chestCode = [2, 4, 0, 4, 7];
  api.sendMultiChatboxPrompt = (who, title, ...pairs) => pairs[chestCode[chestDigit++] * 2 + 1]();
  interact(2576, 7846);
  assert.equal(inventory.contains(ids.JOVKAI_KEY), true, 'the altar chest code yields the Jovkai key');
  interact(2582, 7817);
  assert.equal(inventory.contains(ids.OLD_COG), true, 'the smithy provides the old cog after the key');
});

test('Blood Moon refiner requires the four correct chemical vials totalling 53 before destroying the stockpile', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    getAmount: (id) => counts.get(id) ?? 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 40);
  const interact = handlers.objects.find((handler) => handler.name === 'handleRefiner');
  const shelves = { player, definition: { getName: () => 'Shelves' }, location: { x: 2513, y: 7387, z: 0 }, handled: false };
  interact(shelves);
  const I = api.core.ItemIdentifiers;
  const makeVial = (itemId) => handlers.itemOnObject.find((handler) => handler.name === 'handleRefinerMixture')({
    player, itemId, objectId: 61709, location: { x: 2520, y: 7385, z: 0 }, handled: false,
  });
  makeVial(I.VIAL_OF_BLOOD_5);
  makeVial(I.VIAL_OF_BLOOD_5);
  makeVial(I.VIAL_OF_BLOOD_5);
  makeVial(I.PURE_ESSENCE_4);
  const vial = handlers.itemOnObject.find((handler) => handler.name === 'handleRefinerVial');
  for (let i = 0; i < 4; i++) {
    const event = { player, itemId: I.CHEMICAL_VIAL, objectId: 61707, location: { x: 2518, y: 7389, z: 0 }, handled: false };
    vial(event);
    assert.equal(event.handled, true);
  }
  const stockpile = { player, definition: { getName: () => 'Blood stockpile' }, location: { x: 2535, y: 7385, z: 0 }, handled: false };
  interact(stockpile);
  assert.equal(attributes.get('quest.the_blood_moon_rises.castle-refiner').destroyed, true);
});

test('The Wyrd transcript action starts a private encounter with the cache-mapped boss', () => {
  const { api, handlers } = mockApi();
  const attributes = new Map();
  const spawns = [];
  let bossArea = null;
  const boss = {
    isNpc: () => true,
    isPlayer: () => false,
    getAsNpc: () => boss,
    getIndex: () => 200,
    getArea: () => bossArea,
    setArea: (area) => { bossArea = area; },
    setMultiCombat() {},
    setMaxHitpoints(value) { this.maxHitpoints = value; },
    setHitpoints(value) { this.hitpoints = value; },
  };
  api.spawnNpc = (definition) => (spawns.push(definition), boss);
  api.emitCustomEvent = (name, request) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(request);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const player = {
    getUsername: () => 'WyrdFightTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => player,
    getIndex: () => 100,
    getArea: () => player.area,
    setArea: (area) => { player.area = area; },
    moveTo: (location) => { player.destination = [location.getX(), location.getY(), location.getZ()]; },
    sendMessage() {},
  };
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: '4G5OZg' });
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.WYRD_8, x: 2976, y: 7456, z: 0, ownerOnly: true },
  ]);
  assert.deepEqual(player.destination, [2976, 7452, 0]);
  assert.equal(player.getArea(), bossArea, 'the player and owner-only Wyrd share a private combat area');
  assert.equal(boss.getArea(), bossArea);
  assert.equal(boss.hitpoints, 1100);
});

test('Blood Moon northern-door transcript starts the private Lowerniel encounter', () => {
  const { api, handlers } = mockApi();
  const attributes = new Map();
  const spawns = [];
  let bossArea = null;
  const boss = {
    isNpc: () => true,
    isPlayer: () => false,
    getAsNpc: () => boss,
    getIndex: () => 201,
    getArea: () => bossArea,
    setArea: (area) => { bossArea = area; },
    setMultiCombat() {},
    setMaxHitpoints(value) { this.maxHitpoints = value; },
    setHitpoints(value) { this.hitpoints = value; },
  };
  api.spawnNpc = (definition) => (spawns.push(definition), boss);
  api.emitCustomEvent = (name, request) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(request);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const player = {
    getUsername: () => 'DrakanFightTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => player,
    getIndex: () => 101,
    getArea: () => player.area,
    setArea: (area) => { player.area = area; },
    moveTo: (location) => { player.destination = [location.getX(), location.getY(), location.getZ()]; },
    sendMessage() {},
  };
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: 't7FMNM' });
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.LOWERNIEL_DRAKAN_17, x: 2505, y: 7838, z: 3, ownerOnly: true },
  ]);
  assert.deepEqual(player.destination, [2502, 7838, 3]);
  assert.equal(player.getArea(), bossArea, 'the player and Lowerniel share an owner-only final arena');
  assert.equal(boss.getArea(), bossArea);
  assert.equal(boss.hitpoints, 1600);
});

test('Blood Moon siege barrier action starts the second private Lowerniel fight and caps damage at the 58% cutscene', () => {
  const { api, handlers } = mockApi();
  const attributes = new Map();
  const spawns = [];
  let bossArea = null;
  const boss = {
    isNpc: () => true,
    isPlayer: () => false,
    getAsNpc: () => boss,
    getIndex: () => 202,
    getArea: () => bossArea,
    setArea: (area) => { bossArea = area; },
    setMultiCombat() {},
    setMaxHitpoints(value) { this.maxHitpoints = value; },
    setHitpoints(value) { this.hitpoints = value; },
    getHitpoints() { return this.hitpoints; },
    getId: () => api.core.NpcIdentifiers.LOWERNIEL_DRAKAN_19,
  };
  api.spawnNpc = (definition) => (spawns.push(definition), boss);
  api.emitCustomEvent = (name, request) => {
    for (const handler of handlers.custom.get(name) ?? []) handler(request);
  };
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const player = {
    getUsername: () => 'SiegeDrakanTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    isNpc: () => false,
    getAsPlayer: () => player,
    getIndex: () => 102,
    getArea: () => player.area,
    setArea: (area) => { player.area = area; },
    sendMessage() {},
  };
  quest.setStage(player, 70);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: 'Xz7d4O' });
  assert.equal(spawns.length, 0, 'Lowerniel cannot bypass the bridge and hall defence');
  attributes.set('quest.the_blood_moon_rises.siege-defence', { phase: 'breach', integrity: 0, qualified: true });
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: 'Xz7d4O' });
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.LOWERNIEL_DRAKAN_19, x: 3168, y: 7853, z: 1, ownerOnly: true },
  ]);
  assert.equal(boss.maxHitpoints, 3000, 'the second fight begins at 85% of the boss’s 3,000 HP');
  assert.equal(boss.hitpoints, 2550);
  assert.equal(player.getArea(), bossArea);
  assert.equal(boss.getArea(), bossArea);
  let total = 900;
  const parts = [{ damage: 400, getDamage() { return this.damage; }, setDamage(value) { this.damage = value; } },
    { damage: 500, getDamage() { return this.damage; }, setDamage(value) { this.damage = value; } }];
  handlers.npcHitModify.at(-1)({ npc: boss, hit: { getHits: () => parts, updateTotalDamage() { total = parts.reduce((sum, part) => sum + part.damage, 0); } } });
  assert.equal(total, 810, 'the lethal multi-hit is capped at 58% so the escape cutscene cannot be skipped');
});

test('Blood Moon hall defence supplies hammers and potions, records repairs and heals a fallen Aranei', () => {
  const { api, handlers } = mockApi();
  const replaced = [], objectManager = api.core.ObjectManager;
  const originalDeregister = objectManager.deregister, originalRegister = objectManager.register;
  objectManager.deregister = object => replaced.push(['remove', object]);
  objectManager.register = object => replaced.push(['add', object]);
  api.core = { ...api.core, PrivateArea: class extends api.core.PrivateArea {
    constructor() { super([]); this.objects = []; }
    enter(member) { member.area = this; }
    add(object) { object.setArea(this); this.objects.push(object); }
    getObjects() { return this.objects; }
    postLeave() {}
  } };
  let cycle = 0, palace, loginHook;
  api.onPlayerLogin = handler => { if(handler.name==='handleSiegeLogin')loginHook=handler; };
  api.registerArea = area => { palace = area; };
  const originalGetProcessCycle = api.core.World.getProcessCycle;
  api.core.World.getProcessCycle = () => cycle;
  const spawns = [];
  const injured = {
    getId: () => api.core.NpcIdentifiers.ARANEI_112,
    getIndex: () => 800,
    getLocation: () => new api.core.Location(3173, 7855, 1),
    getHitpoints: () => 30,
    isRegistered: () => true,
    setNpcTransformationId(id) { this.transformedId = id; },
  };
  api.spawnNpc = (definition) => (spawns.push(definition), injured);
  const persisted = []; api.persistAttribute = key => persisted.push(key);
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  assert(!persisted.includes('quest.the_blood_moon_rises.siege-drakan-area'), 'live combat areas must not enter JSON player saves');
  assert(persisted.includes('quest.the_blood_moon_rises.siege-defence'), 'the earned siege checkpoint is saved');
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const counts = new Map();
  const inventory = {
    contains: (id) => (counts.get(id) ?? 0) > 0,
    adds: (id, amount) => (counts.set(id, (counts.get(id) ?? 0) + amount), true),
    deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
  };
  const player = {
    isPlayer: () => true, getAsPlayer: () => player,
    getUsername: () => 'SiegeHallTest',
    getPrivateArea: () => player.area,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 70);
  attributes.set('quest.the_blood_moon_rises.siege-defence',{phase:'hall',integrity:100,healed:[],repaired:[]});
  palace.process(player);
  loginHook({player});
  assert.deepEqual(spawns.map(({ id, x, y, z, ownerOnly }) => ({ id, x, y, z, ownerOnly })), [
    { id: api.core.NpcIdentifiers.ARANEI_112, x: 3173, y: 7855, z: 1, ownerOnly: true },
  ]);
  assert.equal(replaced.filter(([kind])=>kind==='add').length,9,'the actual hall scenery is spawned inside its private instance');
  assert.ok(replaced.every(([,object])=>object.getPrivateArea()===player.area));
  replaced.length=0;
  const interact = handlers.objects.find((handler) => handler.name === 'handleSiegeHallObject');
  const objectEvent = (id, x, y, option = 'Repair') => {
    const location = new api.core.Location(x, y, 1);
    const object = { getLocation: () => location, getType: () => 10, getFace: () => 0, getPrivateArea: () => player.area };
    const event = { player, object, objectId: id, definition: { id }, location: { x, y, z: 1 }, option, handled: false };
    interact(event);
    return event;
  };
  const ids = api.core.ObjectIdentifiers;
  objectEvent(ids.CRATE_OF_HAMMERS_2, 3177, 7843, 'Take-from');
  objectEvent(ids.CRATE_OF_POTIONS, 3171, 7847, 'Take-from');
  assert.equal(inventory.contains(api.core.ItemIdentifiers.HAMMER), true);
  assert.equal(inventory.contains(api.core.ItemIdentifiers.HEALING_POTION), true);
  const npc = {
    getId: () => api.core.NpcIdentifiers.ARANEI_108,
    getOwner: () => player, getArea: () => player.area,
    getIndex: () => 800,
    getLocation: () => new api.core.Location(3173, 7855, 1),
    setNpcTransformationId(id) { this.transformedId = id; },
  };
  const heal = handlers.npcInteractions.get('Aranei').Heal;
  const healEvent = { player, npc, npcId: npc.getId(), handled: false };
  const otherEvent={...healEvent,npc:{...npc,getOwner:()=>({})}};heal(otherEvent);assert.equal(otherEvent.handled,false,'another defender cannot heal this player’s instance');
  heal(healEvent);
  assert.equal(healEvent.handled, true);
  assert.equal(npc.transformedId, api.core.NpcIdentifiers.ARANEI_106);
  objectEvent(ids.DAMAGED_PILLAR_2, 3174, 7855);
  objectEvent(ids.DAMAGED_PILLAR_2, 3162, 7855);
  objectEvent(ids.DAMAGED_WINDOW, 3176, 7858);
  const state = attributes.get('quest.the_blood_moon_rises.siege-defence');
  assert.equal(state.repaired.length, 3);
  assert.equal(state.healed.length, 1);
  assert.equal(state.integrity, 100, 'repairs and healing support the integrity hold instead of completing it directly');
  assert.equal(replaced.filter(([kind]) => kind === 'add').length, 3, 'each fixed cache loc is replaced with its repaired variant');
  assert.equal(handlers.playerProcess.some(h=>h.name==='processSiegeDefence'),false,'hall timing belongs to its area');
  const process = ({player}) => player.area.process(player);
  attributes.set('quest.the_blood_moon_rises.siege-defence', { ...state, integrity: 51, participation: 0, nextIntegrityLossCycle: 20 });
  cycle = 20;
  const npcDefinition = api.core.NpcDefinition;
  const originalForId = npcDefinition.forId;
  npcDefinition.forId = (id) => ({ getId: () => id, getName: () => 'Lowerniel Drakan' });
  try {
    process({ player });
    assert.equal(attributes.get('quest.the_blood_moon_rises.siege-defence').phase, 'hall',
      'integrity alone cannot end the defence without the required participation');
    attributes.set('quest.the_blood_moon_rises.siege-defence', {
      ...attributes.get('quest.the_blood_moon_rises.siege-defence'), integrity: 51, participation: 3,
    });
    cycle = 40;
    process({ player });
    assert.equal(attributes.get('quest.the_blood_moon_rises.siege-defence').qualified, true);
    assert.equal(attributes.get('quest.the_blood_moon_rises.siege-defence').phase, 'hall', '50% qualifies participation without starting the breach');
    attributes.set('quest.the_blood_moon_rises.siege-defence', { ...attributes.get('quest.the_blood_moon_rises.siege-defence'), integrity: 1 });
    cycle = 60; process({ player });
  } finally {
    npcDefinition.forId = originalForId;
  }
  assert.equal(attributes.get('quest.the_blood_moon_rises.siege-defence').phase, 'breach',
    'the barricade cutscene begins only at zero integrity');
  const oldHall = player.area; oldHall.postLeave(player, true); replaced.length = 0;
  loginHook({player});
  assert.notEqual(player.area, oldHall, 'the saved breach restores a new owned hall');
  assert(replaced.some(([kind, object]) => kind === 'add' && object.getId() === ids.BARRICADE_60), 'the saved breach has a real barricade to resume the fight');
  assert.equal(spawns.length, 1, 'healed Aranei do not respawn on the breach checkpoint');
  objectManager.deregister = originalDeregister;
  objectManager.register = originalRegister;
  api.core.World.getProcessCycle = originalGetProcessCycle;
});

test('Blood Moon starts the scoped Theatre encounter and advances after Vasilias', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'the_blood_moon_rises').at(-1);
  const attributes = new Map();
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    sendMessage() {},
  };
  quest.setStage(player, 80);
  let started = 0;
  api.onCustomEvent('tob:bmr:start', ({ player: eventPlayer }) => {
    assert.equal(eventPlayer, player);
    started++;
  });
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: '1Z5SGt' });
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, stepId: '1Z5SGt' });
  assert.equal(started, 1, 'the ready dialogue enters the shared scoped raid instead of starting a duplicate arena');
  assert.equal(attributes.get('quest.the_blood_moon_rises.tob-challenge').started, true);
  const npcDefinition = api.core.NpcDefinition;
  const originalForId = npcDefinition.forId;
  npcDefinition.forId = (id) => ({ getId: () => id, getName: () => 'Sugadinti Vitur' });
  try {
    api.emitCustomEvent('tob:bmr:completed', { player });
  } finally {
    npcDefinition.forId = originalForId;
  }
  assert.equal(quest.getStage(player), 90, 'the Vasilias clear advances to the Wyrd chapter');
  assert.equal(attributes.get('quest.the_blood_moon_rises.tob-challenge').completed, true);
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

test('Dragon Slayer II reforging requires three distinct dragon-head casts and consumes the right runes', () => {
  const spells = [];
  const objectInteractions = [];
  const { api: base } = mockApi();
  const core = Object.assign({}, base.core, {
    CacheDefinitions: { getSpellName: () => 'Fire Wave' },
  });
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'core') return core;
      if (prop === 'onSpellOnObject') return (handler) => spells.push(handler);
      if (prop === 'onObjectInteraction') return (handler) => objectInteractions.push(handler);
      return target[prop];
    },
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 9]]);
  const counts = new Map([
    [core.ItemIdentifiers.DRAGON_KEY_PIECE, 1], [core.ItemIdentifiers.DRAGON_KEY_PIECE_2, 1],
    [core.ItemIdentifiers.DRAGON_KEY_PIECE_3, 1], [core.ItemIdentifiers.DRAGON_KEY_PIECE_4, 1],
    [core.ItemIdentifiers.ANCIENT_KEY, 1], [core.ItemIdentifiers.HAMMER, 1],
    [core.ItemIdentifiers.FIRE_RUNE, 21], [core.ItemIdentifiers.AIR_RUNE, 15],
    [core.ItemIdentifiers.BLOOD_RUNE, 3],
  ]);
  const packet = new Proxy({}, { get: (_target, key) => (..._args) => packet });
  const player = {
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => counts.get(id) ?? 0,
      deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
      adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      getFreeSlots: () => 20,
    }),
    getPacketSender: () => packet,
    sendMessage: () => {},
  };
  const cast = (objectId, x, y) => {
    const event = { player, objectId, location: { x, y, z: 1 }, spellWidget: 1, spellItemId: 0 };
    spells[0](event);
    return event;
  };
  cast(core.ObjectIdentifiers.DRAGON_HEAD_2, 1616, 5284);
  cast(core.ObjectIdentifiers.DRAGON_HEAD_3, 1622, 5279);
  assert.equal(attrs.get('dragon-slayer-ii:forge-heads') ?? 0, 3, 'two distinct heads only set two bits');
  const wrongHead = cast(core.ObjectIdentifiers.DRAGON_HEAD_3, 1744, 5284);
  assert.equal(wrongHead.handled, true, 'the spell interaction is consumed');
  assert.equal(counts.get(core.ItemIdentifiers.FIRE_RUNE), 7, 'wrong room head does not charge runes');
  cast(core.ObjectIdentifiers.DRAGON_HEAD_3, 1626, 5284);
  assert.equal(attrs.get('dragon-slayer-ii:forge-heads'), 7, 'the third distinct head lights the forge');
  assert.equal(counts.get(core.ItemIdentifiers.FIRE_RUNE), 0);
  assert.equal(counts.get(core.ItemIdentifiers.AIR_RUNE), 0);
  assert.equal(counts.get(core.ItemIdentifiers.BLOOD_RUNE), 0);
  objectInteractions[0]({ player, objectId: core.ObjectIdentifiers.ANVIL });
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 10, 'anvil advances only after the forge is lit');
  assert.equal(counts.get(core.ItemIdentifiers.DRAGON_KEY), 1);
  assert.equal(counts.get(core.ItemIdentifiers.ANCIENT_KEY), 0);
  assert.equal(counts.get(core.ItemIdentifiers.DRAGON_KEY_PIECE_4), 0);
});

test('Desert Treasure II requires and solves the real eight-cell golem grid', () => {
  const itemOnObject = [], objectInteractions = [];
  const interactions = [];
  const widgetActions = [];
  const dialogueActions = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onObjectInteraction') return (handler) => objectInteractions.push(handler);
      if (prop === 'onItemOnObject') return (handler) => itemOnObject.push(handler);
      if (prop === 'onNpcInteraction') return (name, options) => interactions.push({ name, options });
      if (prop === 'onCustomEvent') return (name, handler) => {
        if (name === 'player:widget-action') widgetActions.push(handler);
        if (name === 'npc-dialogue:action') dialogueActions.push(handler);
      };
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcripts = require('../data/definitions/npc-dialogues.json')['Desert Treasure II - The Fallen Empire'].variants;
  const searches = [];
  runtime.startTranscript = (_api, _player, _npcId, _page, variant) => {
    assert.ok(transcripts[variant], `missing golem transcript: ${variant}`);
    if (variant.includes('powering-up-the-golem-machine-') && !variant.includes('banikan')) {
      assert.equal(transcripts[variant][0].type, 'line', 'the archive report must display before Banikan speaks');
    }
    searches.push(variant);
    return true;
  };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, ObjectIdentifiers: O } = api.core;
    const attrs = new Map();
    const counts = new Map();
    let freeSlots = 0, inRoom = true;
    const packetCalls = [];
    const packet = new Proxy({}, { get: (_target, name) => (...args) => packetCalls.push([name, ...args]) });
    const messages = [];
    const damages = [];
    const player = {
      getPrivateArea: () => inRoom ? attrs.get('desert-treasure-ii:war-room') : null,
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        getFreeSlots: () => freeSlots,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }),
      getPacketSender: () => packet, sendMessage: (message) => messages.push(message),
      setEnteredSyntaxAction(action) { this.syntaxAction = action; },
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => damages.push(...hits) }) }),
    };
    quest.setStage(player, 6);
    attrs.set('desert-treasure-ii:golem-inspected', true);
    attrs.set('desert-treasure-ii:altar-inspected', true);
    attrs.set('desert-treasure-ii:totems-charged', true);
    attrs.set('desert-treasure-ii:war-room', {
      getBaseX: () => 8192, getBaseY: () => 1600, isDestroyed: () => false,
    });
    const crate = () => objectInteractions[0]({player, objectId: O.CRATE_302, location:{x:8212,y:1616,z:0}, option:'Search'});
    attrs.set('desert-treasure-ii:totems-charged', false);
    crate();
    assert.equal(counts.get(I.UNCHARGED_CELL_2), undefined, 'a full bag cannot lose the cells permanently');
    freeSlots = 1;
    crate();
    assert.equal(counts.get(I.UNCHARGED_CELL_2), 8, 'the cells can be collected before charging the totems');
    crate();
    assert.equal(counts.get(I.UNCHARGED_CELL_2), 8, 'repeating Search does not duplicate cells');
    counts.set(I.UNCHARGED_CELL_2, 2);
    crate();
    assert.equal(counts.get(I.UNCHARGED_CELL_2), 8, 'destroyed cells can be recovered from the crate');
    const altar = { x: 8204, y: 1617, z: 0 };
    const golem = { x: 8214, y: 1619, z: 0 };
    const apply = (itemId, objectId, location) => {const event={player,itemId,objectId,location,handled:false};itemOnObject[0](event);assert.equal(event.handled,true, "cell interactions must suppress the generic Nothing interesting happens message");};
    apply(I.UNCHARGED_CELL_2, O.ALTAR_93, altar);
    assert.equal(counts.get(I.UNCHARGED_CELL_2), 8, 'the altar needs the four activated totems');
    attrs.set('desert-treasure-ii:totems-charged', true);
    freeSlots = 0;
    apply(I.UNCHARGED_CELL_2, O.ALTAR_93, altar);
    assert.equal(counts.get(I.UNCHARGED_CELL_2), 8, 'a full bag cannot consume a cell before creating its charged stack');
    freeSlots = 1;
    for (let i = 0; i < 7; i++) apply(I.UNCHARGED_CELL_2, O.ALTAR_93, altar);
    assert.equal(counts.get(I.UNCHARGED_CELL_2), 1);
    assert.equal(counts.get(I.CHARGED_CELL), 7);
    apply(I.CHARGED_CELL, O.GOLEM, golem);
    assert.equal(counts.get(I.CHARGED_CELL), 7, 'the grid cannot be started with fewer than eight cells');
    apply(I.UNCHARGED_CELL_2, O.ALTAR_93, altar);
    assert.equal(counts.get(I.CHARGED_CELL), 8);
    apply(I.CHARGED_CELL, O.GOLEM, golem);
    assert.equal(counts.get(I.CHARGED_CELL), 0);
    assert.equal(attrs.get('desert-treasure-ii:cells-inserted'), true);
    dialogueActions[0]({ player, stepId: 'EDEdng' });
    assert.equal(attrs.get('desert-treasure-ii:cells-inserted'), true);
    assert.ok(packetCalls.some(([name, id]) => name === 'sendInterface' && id === 838));
    let positions = attrs.get('desert-treasure-ii:cell-positions');
    const solution = [16, 10, 27, 33, 52, 5, 62, 47];
    const groupWidget = (838 << 16) | 32;
    const wrongPowerOn = { player, packet: { type: 'widget_action', groupId: 838, childId: 4, option: 'Power-on' }, handled: false };
    attrs.set('desert-treasure-ii:puzzle-open', false);
    widgetActions[0](wrongPowerOn);
    assert.equal(wrongPowerOn.handled, false, 'closed puzzle packets cannot advance progress');
    attrs.set('desert-treasure-ii:puzzle-open', true);
    inRoom = false;
    widgetActions[0](wrongPowerOn);
    assert.equal(wrongPowerOn.handled, false, 'leaving the owned room invalidates puzzle input');
    inRoom = true;
    widgetActions[0](wrongPowerOn);
    assert.equal(wrongPowerOn.handled, true);
    assert.equal(damages.length, 1, 'a wrong arrangement shocks the player instead of advancing the quest');
    for (let cell = 0; cell < 8; cell++) {
      let current = attrs.get('desert-treasure-ii:cell-positions');
      const target = solution[cell];
      if (current.includes(target)) {
        const empty = Array.from({ length: 64 }, (_, i) => i).find((i) => !current.includes(i));
        widgetActions[0]({ player, packet: { type: 'widget_drag', sourceWidgetId: groupWidget, targetWidgetId: groupWidget, sourceSlot: target, targetSlot: empty }, handled: false });
        current = attrs.get('desert-treasure-ii:cell-positions');
      }
      const source = current[cell];
      widgetActions[0]({ player, packet: { type: 'widget_drag', sourceWidgetId: groupWidget, targetWidgetId: groupWidget, sourceSlot: source, targetSlot: target }, handled: false });
    }
    positions = attrs.get('desert-treasure-ii:cell-positions');
    assert.deepEqual(positions, solution);
    const powerOn = { player, packet: { type: 'widget_action', groupId: 838, childId: 4, option: 'Power-on' }, handled: false };
    widgetActions[0](powerOn);
    assert.equal(powerOn.handled, true);
    assert.equal(attrs.get('desert-treasure-ii:golem-solved'), true);
    assert.equal(quest.getStage(player), 6, 'solving the grid opens the next search stage, rather than skipping straight to a boss');
    assert.ok(player.syntaxAction);
    const previousTranscripts = searches.length;
    for (const term of ['Vardorvis', 'Perseriya', 'Sucellus', 'Whisperer']) {
      objectInteractions[0]({ player, objectId: O.GOLEM, location: golem, option: 'Operate' });
      player.syntaxAction.execute(term);
    }
    assert.equal(attrs.get('desert-treasure-ii:searched-names'), 15);
    assert.equal(searches.length - previousTranscripts, 4, 'each search must display its canonical NPC dialogue');
    objectInteractions[0]({ player, objectId: O.GOLEM, location: golem, option: 'Operate' });
    player.syntaxAction.execute('Vardorvis');
    assert.equal(searches.length - previousTranscripts, 5, 'known reports can be read again after relog');
    assert.equal(attrs.get('desert-treasure-ii:searched-names'), 15);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II starts the Vardorvis trail through Elissa, Barus, the botanist note and potion', () => {
  const npcInteractions = [];
  const objectInteractions = [];
  const itemActions = [];
  const { api: base, handlers } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => npcInteractions.push({ name, options });
      if (prop === 'onObjectInteraction') return (handler) => objectInteractions.push(handler);
      if (prop === 'onItemAction') return (handler) => itemActions.push(handler);
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, ObjectIdentifiers: O } = api.core;
    const attrs = new Map();
    const noteId = I.POTION_NOTE;
    const potionId = I.STRANGE_POTION_3;
    assert.equal(noteId, 28382, 'the note uses the cache item id');
    assert.equal(potionId, 28383, 'the potion uses the cache item id');
    const counts = new Map();
    let freeSlots = 28;
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        getFreeSlots: () => freeSlots,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; },
      sendMessage() {},
    };
    quest.setStage(player, 7);
    const talkTo = (name) => npcInteractions.find((entry) => entry.name === name).options['Talk-to']({ player, npcId: api.core.NpcIdentifiers[name.toUpperCase()] });
    talkTo('Elissa');
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), undefined, 'opening the menu is not accepting the lead');
    const elissa = { player, npcId: api.core.NpcIdentifiers.ELISSA, text: 'Great! Thanks for the help.' };
    handlers.custom.get('npc-dialogue:line').forEach(h => h(elissa));
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), undefined, 'the final line must be continued');
    elissa.after();
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 1);
    talkTo('Barus');
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 1);
    const barus = { player, npcId: api.core.NpcIdentifiers.BARUS, text: "Don't mention it!" };
    handlers.custom.get('npc-dialogue:line').forEach(h => h(barus));
    barus.after();
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 2);
    const desk = () => objectInteractions[0]({ player, objectId: 49490, location: { x: 1781, y: 3619, z: 0 } });
    freeSlots = 1;
    assert.equal(desk(), true);
    assert.equal(counts.size, 0, 'a full bag cannot lose either desk item');
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 2);
    freeSlots = 28;
    const searchDesk = desk();
    assert.equal(searchDesk, true);
    assert.equal(counts.get(noteId), 1);
    assert.equal(counts.get(potionId), 1, 'the desk supplies the potion without a fixture');
    desk();
    assert.equal(counts.get(potionId), 1, 'searching again cannot duplicate it');
    counts.delete(potionId);
    desk();
    assert.equal(counts.get(potionId), 1, 'a lost potion can be recovered before drinking');
    const spawns = require('../data/definitions/npc-spawns.json');
    assert.ok(spawns.some(n => n.id === api.core.NpcIdentifiers.BARUS && n.x === 1460 && n.y === 3780));
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 3);
    assert.equal(itemActions[0]({ player, itemId: potionId, option: 'Drink' }), true);
    assert.equal(counts.get(potionId), 1, 'the potion cannot be used before reading the note');
    itemActions[0]({ player, itemId: noteId, option: 'Read' });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 4);
    itemActions[0]({ player, itemId: potionId, option: 'Drink' });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 5);
    assert.equal(counts.get(potionId), 0);
    const boat = objectInteractions[0]({ player, objectId: 49491, location: { x: 1227, y: 3469, z: 0 } });
    assert.equal(boat, true);
    assert.deepEqual([player.location.getX(), player.location.getY(), player.location.getZ()], [1196, 3450, 0]);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 6);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('DT2 enters the barricaded house through its ruins scene and restores Kasonde across relog', () => {
  const { api, handlers } = mockApi(), runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript, played = [], spawned = [], removed = [];
  let login, logout;
  api.onPlayerLogin = handler => login = handler;
  api.onPlayerLogout = handler => logout = handler;
  api.spawnNpc = spec => { const npc = { ...spec, isRegistered: () => true }; spawned.push(npc); return npc; };
  api.removeNpc = npc => removed.push(npc);
  runtime.startTranscript = (...args) => { played.push(args[4]); return true; };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1), attrs = new Map([['desert-treasure-ii:vardorvis-progress',6]]);
    const player = { getAttribute:key=>attrs.get(key), setAttribute:(key,value)=>attrs.set(key,value),
      getPacketSender:()=>new Proxy({}, {get:()=>()=>{}}), getMovementQueue:()=>({reset(){}}),
      getPrivateArea:()=>attrs.get('desert-treasure-ii:stranglewood-hideout'), moveTo(tile){this.tile=tile;},
      getUsername:()=> 'ruins-check' };
    quest.setStage(player,7);
    const actor = {isPlayer:()=>true,getAsPlayer:()=>player}, area = handlers.area[0];
    assert.ok(area.getBoundaries()[0].inside(new api.core.Location(1194,3394,0)));
    area.postEnter(actor);
    area.process(actor);
    assert.equal(played.length,1,'the scene does not restart every tick');
    assert.equal(attrs.get('desert-treasure-ii:city-entered'),undefined,'opening the scene does not cross the barricade');
    handlers.custom.get('npc-dialogue:action')[0]({player,stepId:'nJRAbJ'});
    assert.equal(attrs.get('desert-treasure-ii:city-entered'),true);
    assert.deepEqual([player.tile.getX(),player.tile.getY()],[1193,3405]);
    logout({player});
    assert.deepEqual(removed,[spawned[0]]);
    login({player});
    assert.equal(spawned.length,2,'the same earned checkpoint recreates the owned conversation NPC');
    attrs.set('desert-treasure-ii:vardorvis-progress',18);
    handlers.objects[0]({player,objectId:49491,location:{x:1227,y:3469,z:0}});
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'),18,'returning by boat retains the completed trail');
    attrs.set('desert-treasure-ii:stranglewood-hideout',{defended:true,isDestroyed:()=>false,leave(){},postLeave(){},destroy(){}});
    logout({player});
    assert.deepEqual([player.tile.getX(),player.tile.getY(),player.tile.getZ()],[1193,3405,0],'logout leaves the instance at its public house');
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'),9,'a completed defense is retained');
  } finally { runtime.startTranscript = original; }
});

test('Desert Treasure II requires Kasonde dialogue and the full three-minute hideout defence', () => {
  const { api: base, handlers } = mockApi();
  const interactions = [], objectHooks = [], chunks = [];
  let cycle = 0;
  const queues = { add: [], remove: [] };
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    GameObject: class TestGameObject {
      constructor(id, location, type, face, privateArea) { Object.assign(this, { id, location, type, face, privateArea }); }
      getId() { return this.id; }
      getLocation() { return this.location; }
    },
    NPC: { create: (id, location) => ({
      id, location, setOwner() {}, setOwnerOnly() {}, setMaxHitpoints() {}, setHitpoints(value) { this.hp = value; },
      getHitpoints() { return this.hp ?? 10; }, isRegistered() { return true; }, getCombat() { return { attack() {} }; },
    }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove, getProcessCycle: () => cycle++ },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 5]]);
    const messages = [];
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-defence-test', getAsPlayer() { return this; }, isPlayer: () => true,
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage: (message) => messages.push(message),
    };
    quest.setStage(p, 7);
    assert.equal(objectHooks[0]({ player: p, objectId: 49491, location: { x: 1227, y: 3469, z: 0 } }), true);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 6);
    const kasonde = interactions.find((entry) => entry.name === 'Kasonde').options['Talk-to'];
    kasonde({ player: p, npcId: core.NpcIdentifiers.KASONDE });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 6, 'opening dialogue cannot accept Kasonde’s instructions');
    const line = {player:p,npcId:core.NpcIdentifiers.KASONDE,text:"They'll be coming. We've got no chance up here. Head down below! Now!"};
    handlers.custom.get('npc-dialogue:line').forEach(h => h(line));
    line.after();
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 7);
    kasonde({ player: p, npcId: core.NpcIdentifiers.KASONDE });
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 7);
    line.text = "What are you waiting for? They're coming! Quick, head down below!";
    handlers.custom.get('npc-dialogue:line').forEach(h => h(line));
    line.after();
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 8);
    assert.equal(objectHooks[0]({ player: p, objectId: core.ObjectIdentifiers.ENTRY_20, location: { x: 1191, y: 3411, z: 0 } }), true);
    const area = attrs.get('desert-treasure-ii:stranglewood-hideout');
    assert.equal(area.width, 7);
    assert.equal(area.height, 5);
    assert.deepEqual([p.location.x, p.location.y], [8223, 1624]);
    assert.equal(chunks.filter(([plane, , , chunk]) => plane === 0 && chunk !== null).length, 35);
    area.kasonde.isRegistered = () => false;
    area.process(p);
    assert.equal(area.failed, undefined, 'queued NPC registration must not fail the encounter');
    assert.equal(area.remainingTicks, 300);
    area.kasonde.isRegistered = () => true;
    for (let tick = 0; tick < 299; tick++) area.process(p);
    assert.equal(area.defended, undefined, 'the horde defence cannot be skipped by a short wait');
    area.process(p);
    assert.equal(area.defended, true, 'Kasonde survives the documented three-minute holdout');
    assert.equal(objectHooks[0]({ player: p, objectId: core.ObjectIdentifiers.LADDER_439, location: area.tile(27, 28, 0) }), true);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 9);
    assert.deepEqual([p.location.getX(), p.location.getY(), p.location.getZ()], [1187, 3411, 0]);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('DT2 hideout landing can reach Kasonde and the cache ladder through the real template', async () => {
  const { CachePipeline } = require('../dist/game/cache/CachePipeline');
  const { TemplatedInstanceArea } = require('../dist/game/model/areas/impl/TemplatedInstanceArea');
  const { RsmodRouteFinding } = require('../dist/game/model/movement/path/RsmodRouteFinding');
  const { RegionManager } = require('../dist/game/collision/RegionManager');
  await CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  RegionManager.init();
  const area = new TemplatedInstanceArea(7,5);
  try {
    for (let x=0;x<7;x++) for(let y=0;y<5;y++) for(let plane=0;plane<4;plane++)
      area.setChunk(plane,x,y,plane===0?{sourceChunkX:145+x,sourceChunkY:1217+y,sourcePlane:0,rotation:0}:null);
    const route = new RsmodRouteFinding();
    for (const [x,y] of [[24,21],[26,28]]) {
      const result = route.findRoute({level:0,srcX:area.getBaseX()+31,srcY:area.getBaseY()+24,srcSize:1,
        destX:area.getBaseX()+x,destY:area.getBaseY()+y,privateArea:area,moveNear:false});
      assert.equal(result.success,true,'the arrival must reach Kasonde and the real ladder');
    }
    for (const [x,y] of [[13,8],[20,8],[39,9],[37,24],[13,24],[24,27]]) {
      const result = route.findRoute({level:0,srcX:area.getBaseX()+x,srcY:area.getBaseY()+y,srcSize:1,
        destX:area.getBaseX()+24,destY:area.getBaseY()+21,privateArea:area,moveNear:false});
      assert.equal(result.success,true,'every horde entrance must reach Kasonde through the cache corridor');
    }
    const ladder = area.resolveObject(48732,new (require('../dist/game/model/Location').Location)(area.getBaseX()+27,area.getBaseY()+28,0));
    assert.ok(ladder,'source ladder1187,9764 is at template offset27,28');
  } finally { area.destroy(); }
});

test('Desert Treasure II makes the Strangler serum with the two real ingredients and requires Kasonde dialogue', () => {
  const { api: base } = mockApi();
  let combine, itemAction;
  const interactions = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemOnItem' ? (handler) => { combine = handler; }
      : prop === 'onItemAction' ? (handler) => { itemAction = handler; }
        : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, NpcIdentifiers: N } = api.core;
    const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 14]]);
    const counts = new Map([[I.UNFINISHED_SERUM, 1], [I.KORBAL_HERB, 1], [I.ARGIAN_BERRIES, 1]]);
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }), getPacketSender: () => new Proxy({}, { get: () => () => {} }), sendMessage() {},
    };
    quest.setStage(p, 7);
    assert.equal(combine({ player: p, usedItemId: I.UNFINISHED_SERUM, usedWithItemId: I.KORBAL_HERB }), true);
    assert.equal(counts.get(I.UNFINISHED_SERUM_2), 1);
    assert.equal(combine({ player: p, usedItemId: I.UNFINISHED_SERUM_2, usedWithItemId: I.ARGIAN_BERRIES }), true);
    assert.equal(counts.get(I.STRANGLER_SERUM), 1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 15);
    assert.equal(itemAction({ player: p, itemId: I.STRANGLER_SERUM, option: 'Drink' }), undefined,
      'Kasonde must explain the completed serum before it can be drunk');
    interactions.find((entry) => entry.name === 'Kasonde').options['Talk-to']({ player: p, npcId: N.KASONDE });
    assert.equal(attrs.get('desert-treasure-ii:kasonde-serum-discussed'), true);
    assert.equal(itemAction({ player: p, itemId: I.STRANGLER_SERUM, option: 'Drink' }), true);
    assert.equal(counts.get(I.STRANGLER_SERUM), 0);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 16);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II requires both Stranglewood ingredients and defeating temple Strangled before Kasonde gives serum', () => {
  const { api: base, handlers } = mockApi();
  const objectHooks = [], deathHooks = [], interactions = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const queues = { add: [], remove: [] };
  const core = {
    ...base.core, TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({
      id, location, setOwner() {}, setOwnerOnly() {}, getRealId() { return this.id; },
      isNpc() { return true; }, getAsNpc() { return this; },
    }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
            : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ItemIdentifiers: I, ObjectIdentifiers: O, NpcIdentifiers: N } = core;
    const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 11]]);
    const counts = new Map();
    let freeSlots = 28;
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-temple-test', moveTo(location) { this.location = location; },
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        getFreeSlots: () => freeSlots,
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
      }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }), sendMessage() {},
    };
    quest.setStage(p, 7);
    const interact = (objectId, x, y) => objectHooks[0]({ player: p, objectId, location: { x, y, z: 0 } });
    assert.equal(interact(O.ENTRY_21, 1174, 3428), undefined, 'the temple refuses entry before both ingredients are found');
    freeSlots = 0;
    interact(49494, 1153, 3443);
    assert.equal(counts.get(I.KORBAL_HERB), undefined, 'a full bag cannot collect the herb');
    freeSlots = 28;
    interact(49494, 1153, 3443);
    assert.equal(counts.get(I.KORBAL_HERB), 1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 11);
    freeSlots = 0;
    interact(49493, 1130, 3319);
    assert.equal(counts.get(I.ARGIAN_BERRIES), undefined, 'a full bag cannot collect the berries');
    freeSlots = 28;
    interact(49493, 1130, 3319);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 12);
    assert.equal(interact(O.ENTRY_21, 1174, 3428), true);
    const area = attrs.get('desert-treasure-ii:stranglewood-temple');
    assert.equal(area.width, 2);
    assert.equal(area.height, 5);
    assert.deepEqual([p.location.x, p.location.y], [8198, 1616]);
    const attackers = area.entities.filter((npc) => npc.__dt2TempleEnemy);
    assert.equal(attackers.length, 3);
    attackers.forEach((npc) => deathHooks[0]({ killer: p, npc }));
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 13);
    assert.ok(area.entities.some((npc) => npc.getRealId?.() === N.KASONDE), 'Kasonde appears after the attackers are defeated');
    interactions.find((entry) => entry.name === 'Kasonde').options['Talk-to']({ player: p, npcId: N.KASONDE });
    assert.equal(counts.get(I.UNFINISHED_SERUM), undefined, 'the serum is handed over during dialogue');
    const giveSerum = stepId => handlers.custom.get('npc-dialogue:action')[0]({player:p,stepId});
    freeSlots = 0;
    giveSerum('ixrOLP');
    assert.equal(counts.get(I.UNFINISHED_SERUM), undefined);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'),13,'a full bag cannot lose the reward');
    freeSlots = 1;
    giveSerum('ixrOLP');
    assert.equal(counts.get(I.UNFINISHED_SERUM), 1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 14);
    counts.delete(I.UNFINISHED_SERUM);
    interactions.find(entry=>entry.name==='Kasonde').options['Talk-to']({player:p,npcId:N.KASONDE});
    giveSerum('e7yS62');
    giveSerum('e7yS62');
    assert.equal(counts.get(I.UNFINISHED_SERUM),1,'a lost serum is recovered once');
    interact(O.KORBAL_HERBS,1155,3447);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'),14,'gathering again cannot undo later progress');
    attrs.set('desert-treasure-ii:vardorvis-progress',21);
    freeSlots=0;
    interact(49496,1196,3411);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'),21);
    assert.equal(counts.get(I.VARDORVIS_MEDALLION),undefined);
    freeSlots=1;
    interact(49496,1196,3411);
    assert.equal(counts.get(I.VARDORVIS_MEDALLION),1);
    assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'),22);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II enters a private copy of the real war room from the cleared Digsite hole', () => {
  const { api: base } = mockApi();
  const handlers = [];
  const chunks = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const queues = { add: [], remove: [] };
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {} }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => handlers.push(handler)
        : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const p = {
      attrs: new Map(),
      getAttribute(key) { return this.attrs.get(key); },
      setAttribute(key, value) { this.attrs.set(key, value); },
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      getUsername: () => 'dt2-room-test',
      moveTo(location) { this.location = location; },
    };
    quest.setStage(p, 5);
    const { ObjectIdentifiers: O, NpcIdentifiers: N } = core;
    assert.equal(handlers[0]({ player: p, objectId: O.CREVICE_45, location: { x: 3411, y: 9811, z: 0 } }), true);
    const room = p.getAttribute('desert-treasure-ii:war-room');
    assert.equal(room.width, 6);
    assert.equal(room.height, 5);
    assert.deepEqual(p.location, { x: 8215, y: 1607, z: 0 });
    assert.deepEqual(chunks.filter(([plane, , , chunk]) => plane === 0).map(([, x, y, chunk]) => [x, y, chunk.sourceChunkX, chunk.sourceChunkY]),
      Array.from({ length: 30 }, (_, i) => [Math.floor(i / 5), i % 5, 345 + Math.floor(i / 5), 803 + i % 5]));
    assert.equal(room.entities[0].id, N.ANCIENT_GUARDIAN_3);
    assert.deepEqual(queues.add, [room.entities[0]]);
    assert.equal(handlers[0]({ player: p, objectId: O.CREVICE_45, location: { x: 3412, y: 9811, z: 0 } }), false,
      'only the real excavation hole opens the room');
    quest.setStage(p, 6);
    assert.equal(handlers[0]({ player: p, objectId: O.RUBBLE_74, location: { x: 8215, y: 1601, z: 0 } }), true,
      'the cache Climb-up rubble is the return route');
    assert.deepEqual([p.location.getX(), p.location.getY(), p.location.getZ()], [3411, 9813, 0]);
    assert.equal(p.getAttribute('desert-treasure-ii:war-room'), null);
    assert.equal(room.destroyed, true);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II requires the four matching ancient combat spells to charge its totems', () => {
  const { api: base } = mockApi();
  const objectHooks = [], deathHooks = [], accuracyHooks = [], damageHooks = [], magicHooks = [];
  const chunks = [], addQueue = [], removeQueue = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({
      id, location, owner: null, transform: -1,
      setOwner(owner) { this.owner = owner; }, getOwner() { return this.owner; },
      setOwnerOnly() {}, setNpcTransformationId(id) { this.transform = id; },
      getRealId() { return this.id; }, isNpc() { return true; }, getAsNpc() { return this; },
    }) },
    World: { getAddNPCQueue: () => addQueue, getRemoveNPCQueue: () => removeQueue },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : prop === 'onCombatHitRoll' ? (handler) => accuracyHooks.push(handler)
            : prop === 'onNpcHitModify' ? (handler) => damageHooks.push(handler)
              : prop === 'onCustomEvent' ? (name, handler) => { if (name === 'magic:hit-effects') magicHooks.push(handler); }
                : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const messages = [];
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-totem-test', moveTo(location) { this.location = location; },
      getPacketSender: () => new Proxy({}, { get: () => () => {} }), sendMessage(message) { messages.push(message); },
    };
    const O = core.ObjectIdentifiers;
    quest.setStage(p, 5);
    assert.equal(objectHooks[0]({ player: p, objectId: O.CREVICE_45, location: { x: 3411, y: 9811, z: 0 } }), true);
    let area = attrs.get('desert-treasure-ii:war-room');
    assert.equal(p.getAttribute('desert-treasure-ii:war-room'), area);
    const guardian = area.entities[0];
    deathHooks[0]({ killer: p, npc: guardian });
    assert.equal(quest.getStage(p), 6);
    assert.equal(area.entities.filter((npc) => npc.__dt2Totem).length, 4);
    const onRoomObject = (id, x, y) => objectHooks[0]({ player: p, objectId: id, location: area.tile(x - 2760, y - 6424, 0) });
    onRoomObject(49511, 2782, 6443);
    onRoomObject(49512, 2772, 6441);
    const spells = core.CombatSpells;
    const entries = [
      ['blood', 12344, 'BLOOD_BURST'], ['shadow', 12342, 'SHADOW_BURST'],
      ['smoke', 12340, 'SMOKE_BURST'], ['ice', 12346, 'ICE_BURST'],
    ];
    for (const [kind, activeId, spellName] of entries) {
      const target = area.entities.find((npc) => npc.__dt2Totem === kind);
      const spell = spells[spellName];
      assert.equal(target.getOwner(), p);
      assert.equal(area.entities.includes(target), true);
      assert.equal(attrs.get('desert-treasure-ii:golem-inspected'), true);
      assert.equal(attrs.get('desert-treasure-ii:altar-inspected'), true);
      assert.equal(area.canCastOnNpc(p, target, spell), true, 'the actionless NPC accepts its matching spell');
      assert.equal(area.canCastOnNpc(p, target, spells.FIRE_STRIKE), false, 'ordinary spells cannot charge it');
      assert.equal(area.canCastOnNpc({getUsername:()=> 'other-player'},target,spell),false, 'only the owner can charge the totem');
      p.isPlayer = () => true;
      p.getCombat = () => ({ getSelectedSpell: () => spell });
      const attacker = p;
      const roll = { attacker, target, combatType: core.CombatType.MAGIC, forceAccurate: false };
      accuracyHooks[0](roll);
      assert.equal(roll.forceAccurate, true, `${kind} activation casts are accurate`);
      magicHooks[0]({ attacker, target, spell, allowed: true, hit: { isAccurate: () => true } });
      assert.equal(target.__dt2TotemCharged, true, `${kind} matching hit activates its totem (messages: ${messages.join(' | ')})`);
      assert.equal(target.transform, activeId);
      const damage = { setDamage(value) { this.value = value; } };
      damageHooks.forEach(handler => handler({ npc: target, hit: { isAccurate: () => true, getHits: () => [damage], updateTotalDamage() {} } }));
      assert.equal(damage.value, 0, 'totem activation does not damage the target');
      if (kind === 'blood') {
        assert.equal(attrs.get('desert-treasure-ii:totem-mask'), 4);
        attrs.set('desert-treasure-ii:war-room', null);
        objectHooks[0]({player:p, objectId:O.CREVICE_45, location:{x:3411,y:9811,z:0}});
        area = attrs.get('desert-treasure-ii:war-room');
        assert.equal(area.entities.filter(npc=>npc.__dt2TotemCharged).length,1, 'partial totem charging survives re-entry');
      }
    }
    assert.equal(attrs.get('desert-treasure-ii:totems-charged'), true);
    assert.equal(attrs.get('desert-treasure-ii:totem-mask'), 15, 'all four cache altar bits are persisted');
    attrs.set('desert-treasure-ii:war-room', null);
    objectHooks[0]({player:p, objectId:O.CREVICE_45, location:{x:3411,y:9811,z:0}});
    const restored = attrs.get('desert-treasure-ii:war-room').entities.filter(npc=>npc.__dt2Totem);
    assert.equal(restored.length,4);
    assert.ok(restored.every(npc=>npc.__dt2TotemCharged && npc.transform !== -1), 're-entering restores charged totems');
    quest.setStage(p,7);
    const finalArea = attrs.get('desert-treasure-ii:war-room');
    assert.equal(objectHooks[0]({player:p,objectId:O.RUBBLE_74,location:finalArea.tile(23,1,0)}),true,
      'learning Frostenhorn must not lock the installation exit');
    assert.equal(attrs.get('desert-treasure-ii:war-room'),null);
    assert.deepEqual([p.location.getX(),p.location.getY(),p.location.getZ()],[3411,9813,0]);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II enters the cache Ancient Vault and requires the four statues plus plaque', () => {
  const interactions = [];
  const objectInteractions = [];
  const logoutHooks = [];
  const { api: base } = mockApi();
  const chunks = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk(...args) { chunks.push(args); }
    enter(player) { this.player = player; }
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() { this.destroyed = true; }
  }
  const queues = { add: [], remove: [] };
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {} }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
        : prop === 'onObjectInteraction' ? (handler) => objectInteractions.push(handler)
          : prop === 'onPlayerLogout' ? handler => logoutHooks.push(handler)
          : prop === 'emitCustomEvent' ? (_name, event) => { event.complete = true; }
            : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const { ObjectIdentifiers: O } = core;
    const attrs = new Map();
    let spellbook = core.MagicSpellbook.NORMAL;
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'vault-test',
      getPrivateArea: () => attrs.get('desert-treasure-ii:ancient-vault'),
      getSpellbook: () => spellbook,
      getSkillManager: () => ({ getMaxLevel: () => 99 }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; },
      sendMessage() {},
    };
    const outerDoor = { player, objectId: O.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } };
    assert.equal(objectInteractions[0](outerDoor), true);
    assert.equal(quest.getStage(player), 0, 'the normal spellbook cannot open the ancient vault');
    assert.equal(queues.add.length, 0);
    spellbook = core.MagicSpellbook.ANCIENT;
    assert.equal(objectInteractions[0](outerDoor), true);
    assert.equal(quest.getStage(player), 1);
    const area = attrs.get('desert-treasure-ii:ancient-vault');
    assert.equal(area.width, 4);
    assert.equal(area.height, 4);
    assert.equal(player.location.x, 8202);
    assert.equal(player.location.y, 1615);
    assert.equal(queues.add[0].id, 12401, 'the room receives the cache initial Asgarnia Smith variant');
    assert.equal(chunks.filter(([plane, , , chunk]) => plane === 1 && chunk !== null).length, 16);
    const inspect = (id, x, y) => objectInteractions[0]({
      player, objectId: id, location: area.tile(x - 3920, y - 9616, 1),
    });
    assert.equal(inspect(49499, 3941, 9635), true);
    assert.equal(interactions.find((entry) => entry.name === 'Asgarnia Smith').options['Talk-to']({ player, npcId: 1 }), undefined);
    assert.equal(quest.getStage(player), 1, 'the NPC sends the player to inspect the remaining objects');
    inspect(49501, 3931, 9635);
    inspect(49503, 3931, 9625);
    inspect(49505, 3941, 9625);
    inspect(O.PLAQUE_35, 3944, 9631);
    interactions.find((entry) => entry.name === 'Asgarnia Smith').options['Talk-to']({ player, npcId: 1 });
    assert.equal(quest.getStage(player), 2, 'only the four statues and plaque advance the vault step');
    assert.equal(inspect(O.STEPS_23, 3925, 9630), true, 'the actual entrance steps let the player leave');
    assert.deepEqual([player.location.x, player.location.y, player.location.z], [3510,2971,0]);
    objectInteractions[0](outerDoor);
    logoutHooks[0]({ player });
    assert.equal(attrs.get('desert-treasure-ii:ancient-vault'), null);
    assert.deepEqual([player.location.x, player.location.y, player.location.z], [3510,2971,0], 'logout saves a public return point instead of orphaned instance coordinates');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II requires each medallion on its matching Vault statue and returns the Vardorvis trail to Persten', () => {
  const { api: base } = mockApi();
  const objectHooks = [], itemHooks = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {}, isNpc() { return true; }, getAsNpc() { return this; } }) },
    World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [] },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onItemOnObject' ? (handler) => itemHooks.push(handler)
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const { ItemIdentifiers: I, ObjectIdentifiers: O } = core;
  const attrs = new Map();
  const counts = new Map([[I.VARDORVIS_MEDALLION, 1]]);
  const p = {
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'dt2-medallion-test', getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getInventory: () => ({
      getAmount: (id) => counts.get(id) ?? 0,
      deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
      adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
    }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    moveTo(location) { this.location = location; }, sendMessage() {},
  };
  quest.setStage(p, 7);
  attrs.set('desert-treasure-ii:vardorvis-progress', 22);
  attrs.set('desert-treasure-ii:first-medallion-meeting', true);
  assert.equal(objectHooks[0]({ player: p, objectId: O.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } }), true);
  const area = attrs.get('desert-treasure-ii:ancient-vault');
  const location = area.tile(21, 19, 1);
  assert.equal(itemHooks[0]({ player: p, itemId: I.VARDORVIS_MEDALLION, objectId: 49501, location }), undefined,
    'a medallion cannot be placed on another general’s statue');
  assert.equal(counts.get(I.VARDORVIS_MEDALLION), 1);
  assert.equal(itemHooks[0]({ player: p, itemId: I.VARDORVIS_MEDALLION, objectId: 49499, location }), true);
  assert.equal(counts.get(I.VARDORVIS_MEDALLION), 0);
  assert.equal(quest.getStage(p), 8);
  assert.equal(attrs.get('desert-treasure-ii:medallions-placed'), 1);
});

test('Desert Treasure II plays the first-medallion ambush before re-entering the Ancient Vault', () => {
  const { api: base } = mockApi();
  const objectHooks = [], customEvents = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = { ...base.core, TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {} }) },
    World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [] } };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onCustomEvent' ? (name, handler) => customEvents.push({ name, handler })
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (_api, _player, npcId, page, variant) => { transcripts.push({ npcId, page, variant }); };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const counts = new Map([[core.ItemIdentifiers.VARDORVIS_MEDALLION, 1]]);
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-first-medallion-test',
      getSkillManager: () => ({ getMaxLevel: () => 99 }),
      getInventory: () => ({ getAmount: (id) => counts.get(id) ?? 0 }),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage() {},
    };
    quest.setStage(player, 7);
    const door = { player, objectId: core.ObjectIdentifiers.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } };
    assert.equal(objectHooks[0](door), true);
    assert.equal(transcripts[0].variant, 'carnifex-maximus-vardorvis-returning-the-first-medallion');
    assert.equal(attrs.get('desert-treasure-ii:ancient-vault'), undefined,
      'the scene does not skip the Mysterious Figure dialogue');
    customEvents.find(({ name }) => name === 'npc-dialogue:action').handler({ player, stepId: 'NoRYcT' });
    assert.ok(attrs.get('desert-treasure-ii:ancient-vault'), 'the dialogue action resumes the vault scene');
    assert.equal(player.location.x, 8202);
    assert.equal(player.location.y, 1615);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II last medallion route traps the player, requires solving the cell lock, then makes the Figure fight reclaimable', () => {
  const { api: base } = mockApi();
  const objectHooks = [], customEvents = [], deathHooks = [], npcHitHooks = [], prompts = [];
  let spawnedFigure;
  const core = { ...base.core,
    NPC: { create: (id, location) => ({ id, location }), },
    World: { getAddNPCQueue: () => [], getRemoveNPCQueue: () => [] },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onCustomEvent' ? (name, handler) => customEvents.push({ name, handler })
          : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
            : prop === 'onNpcHitModify' ? (handler) => npcHitHooks.push(handler)
            : prop === 'sendMultiChatboxPrompt' ? (player, prompt, ...options) => prompts.push({ player, prompt, options })
              : prop === 'spawnNpc' ? (args) => (spawnedFigure = { id: args.id, args, setMaxHitpoints(value) { this.maxHitpoints = value; }, setHitpoints(value) { this.hitpoints = value; } })
                : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (_api, _player, npcId, page, variant) => { transcripts.push({ npcId, page, variant }); };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const inventoryItems = Array.from({ length: 28 }, (_, index) => index === 0
      ? new core.Item(core.ItemIdentifiers.WHISPERERS_MEDALLION, 1) : index === 1
        ? new core.Item(995, 200) : new core.Item(-1, 0));
    const equipmentItems = Array.from({ length: 14 }, (_, index) => index === 0 ? new core.Item(1275, 1) : new core.Item(-1, 0));
    const container = (items) => ({ getItems: () => items, setItems(value) { items.splice(0, items.length, ...value); },
      capacity: () => items.length, refreshItems() {},
      getAmount(id) { return items.reduce((sum, item) => sum + (item.getId() === id ? item.getAmount() : 0), 0); },
      adds(id, amount) { const free = items.findIndex((item) => item.getId() <= 0); if (free >= 0) items[free] = new core.Item(id, amount); },
      deleteNumber(id, amount) { for (const item of items) { if (item.getId() !== id || amount <= 0) continue; const taken = Math.min(amount, item.getAmount()); item.setAmount?.(item.getAmount() - taken); if (!item.setAmount) item.amount -= taken; amount -= taken; if (item.getAmount() <= 0) { item.id = -1; item.amount = 0; } } },
    });
    const inventory = container(inventoryItems), equipment = container(equipmentItems);
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-final-cell-test',
      getSkillManager: () => ({ getMaxLevel: () => 99 }),
      getInventory: () => inventory, getEquipment: () => equipment,
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage() {},
    };
    quest.setStage(p, 10);
    assert.equal(objectHooks[0]({ player: p, objectId: core.ObjectIdentifiers.VAULT_DOOR_2, location: { x: 3511, y: 2970, z: 0 } }), true);
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-entering-the-ancient-vault-with-the-last-medallion');
    customEvents.find(({ name }) => name === 'npc-dialogue:action').handler({ player: p, stepId: 'qEMxBM' });
    assert.equal(p.location.x, 3103);
    assert.equal(inventory.getAmount(995), 0, 'equipment is secured outside the prison cell');
    assert.equal(equipment.getAmount(1275), 0, 'worn equipment is secured outside the prison cell');
    assert.equal(objectHooks[0]({ player: p, objectId: 48777, option: 'Search', location: { x: 3103, y: 9246, z: 0 } }), true);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.HAIR_CLIP_3), 1);
    attrs.set('desert-treasure-ii:final-cell-solution', '1,2,3,4');
    assert.equal(objectHooks[0]({ player: p, objectId: 48774, option: 'Open', location: { x: 3107, y: 9248, z: 0 } }), true);
    for (const digit of [1, 2, 3, 4]) {
      let prompt = prompts.at(-1);
      let optionIndex = prompt.options.findIndex((entry, index) => index % 2 === 0 && entry === String(digit));
      if (optionIndex === -1) {
        const moreIndex = prompt.options.findIndex((entry, index) => index % 2 === 0 && entry === 'More...');
        assert.notEqual(moreIndex, -1, `lock offers another digit page for ${digit}`);
        prompt.options[moreIndex + 1]();
        prompt = prompts.at(-1);
        optionIndex = prompt.options.findIndex((entry, index) => index % 2 === 0 && entry === String(digit));
      }
      assert.notEqual(optionIndex, -1, `lock exposes digit ${digit}`);
      prompt.options[optionIndex + 1]();
    }
    assert.equal(attrs.get('desert-treasure-ii:final-cell-open'), true);
    assert.equal(objectHooks[0]({ player: p, objectId: 48771, option: 'Search', location: { x: 3115, y: 9263, z: 0 } }), true);
    assert.equal(attrs.get('desert-treasure-ii:final-cell-chest'), true);
    assert.equal(inventory.getAmount(995), 200, 'the chest restores the stored inventory');
    assert.equal(equipment.getAmount(1275), 1, 'the chest restores worn equipment');
    assert.equal(objectHooks[0]({ player: p, objectId: 37633, option: 'Inspect', location: { x: 3086, y: 9260, z: 0 } }), true);
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-inspecting-the-altar-in-the-temple');
    const line = { player: p, npcId: core.NpcIdentifiers.MYSTERIOUS_FIGURE_2, text: 'Very well...' };
    customEvents.find(({ name }) => name === 'npc-dialogue:line').handler(line);
    line.after();
    assert.equal(spawnedFigure.id, core.NpcIdentifiers.MYSTERIOUS_FIGURE_4);
    assert.equal(spawnedFigure.maxHitpoints, 450);
    let attackStyle = 1;
    p.isPlayer = () => true; p.getAsPlayer = () => p;
    p.getFightType = () => ({ getBonusType: () => attackStyle });
    const hitFor = (style) => {
      attackStyle = style;
      const part = { damage: 10, setDamage(value) { this.damage = value; } };
      const hit = { getAttacker: () => p, getHits: () => [part], getTotalDamage: () => part.damage, updateTotalDamage() {} };
      npcHitHooks.at(-1)({ npc: spawnedFigure, hit });
      return part.damage;
    };
    assert.equal(hitFor(1), 10);
    assert.equal(hitFor(1), 10);
    assert.equal(hitFor(1), 10, 'the third attack lands before the Figure changes her prayer');
    assert.equal(hitFor(1), 0, 'the Figure blocks the attack style she prayed against');
    assert.equal(hitFor(4), 10, 'switching from melee to ranged bypasses her current protection');
    deathHooks[0]({ killer: p, npc: spawnedFigure });
    assert.equal(attrs.get('desert-treasure-ii:final-figure-defeated'), true);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.WHISPERERS_MEDALLION), 1);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II descends into the copied Elder Vault, chains all four wights, and grants the ending rewards', () => {
  const { api: base } = mockApi();
  const interactions = [], deaths = [], objects = [], actions = new Map(), queue = [];
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; this.chunks = []; this.destroyed = false; }
    setChunk(plane, x, y, chunk) { this.chunks.push([plane, x, y, chunk]); }
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create(id, location) { return { id, location, setOwner(owner) { this.owner = owner; }, setOwnerOnly() {}, setNpcTransformationId(id) { this.transformedTo = id; }, isNpc() { return true; }, getAsNpc() { return this; }, isRegistered() { return true; }, getOwner() { return this.owner; } }; } },
    World: { getAddNPCQueue: () => queue, getRemoveNPCQueue: () => [] },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
        : prop === 'onNpcDeath' ? (handler) => deaths.push(handler)
          : prop === 'onObjectInteraction' ? (handler) => objects.push(handler)
          : prop === 'onCustomEvent' ? (name, handler) => actions.set(name, handler)
            : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcripts = [];
  runtime.startTranscript = (_api, player, npcId, page, variant) => (transcripts.push({ npcId, page, variant }), true);
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    class Container {
      constructor() { this.counts = new Map(); }
      getAmount(id) { return this.counts.get(id) ?? 0; }
      adds(id, amount) { this.counts.set(id, this.getAmount(id) + amount); }
      deleteNumber(id, amount) { this.counts.set(id, Math.max(0, this.getAmount(id) - amount)); }
    }
    const inventory = new Container(), equipment = new Container();
    inventory.adds(core.ItemIdentifiers.RING_OF_VISIBILITY, 1);
    const p = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-final-room-test', getInventory: () => inventory, getEquipment: () => equipment,
      getPacketSender: () => new Proxy({}, { get: () => () => {} }),
      moveTo(location) { this.location = location; }, sendMessage() {}, isRegistered: () => false,
    };
    quest.setStage(p, 11);
    const talkSmith = interactions.find(({ name }) => name === 'Asgarnia Smith').options['Talk-to'];
    talkSmith({ player: p, npcId: core.NpcIdentifiers.ASGARNIA_SMITH });
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-disputes-of-the-mahjarrat');
    const dialogueAction = actions.get('npc-dialogue:action');
    dialogueAction({ player: p, stepId: 'lnBBaf' });
    const area = attrs.get('desert-treasure-ii:final-room');
    assert.equal(area.width, 7);
    assert.equal(area.height, 8);
    assert.equal(area.chunks.filter(([plane, , , chunk]) => plane === 0 && chunk).length, 56);
    assert.deepEqual(area.getName(), 'Elder Vault (Desert Treasure II)');
    for (const stepId of ['2ucP4K', 's3g1xZ', 'CQXcy8', 'F2TgOo', 't8wSqb', 'fknd65']) dialogueAction({ player: p, stepId });
    const sliske = queue.find((npc) => npc.id === core.NpcIdentifiers.SLISKE);
    assert.ok(sliske, 'the Mahjarrat scene reveals Sliske in the copied chamber');
    dialogueAction({ player: p, stepId: '2at3Ae' });
    for (const id of [core.NpcIdentifiers.THE_FORSAKEN_ASSASSIN, core.NpcIdentifiers.KETLA_THE_UNWORTHY,
      core.NpcIdentifiers.KASONDE_THE_CRAVEN, core.NpcIdentifiers.PERSTEN_THE_DECEITFUL]) {
      const wight = queue.findLast((npc) => npc.id === id);
      assert.ok(wight, `quest spawns wight ${id}`);
      assert.equal(wight.owner, p, 'the fight belongs to this player');
      deaths[0]({ killer: p, npc: wight });
    }
    assert.equal(attrs.get('desert-treasure-ii:final-wights-complete'), true);
    assert.equal(transcripts.at(-1).variant, 'the-desert-treasure-aftermath');
    dialogueAction({ player: p, stepId: 'xGIiPZ' });
    assert.equal(quest.isComplete(p), true);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.RING_OF_VISIBILITY), 0);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.RING_OF_SHADOWS), 1);
    assert.equal(inventory.getAmount(core.ItemIdentifiers.ANCIENT_LAMP), 3);
    assert.equal(objects[0]({ player: p, objectId: 48890, option: 'Climb', location: area.tile(30, 11, 0) }), true,
      'the cache staircase returns the player to the upper Ancient Vault');
    assert.equal(attrs.get('desert-treasure-ii:final-room'), null);
    assert.equal(p.location.x, 8202, 'the player is back in the private upper vault');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II opens the ritual site after the serum and grants the Temple key only after Vardorvis dies', () => {
  const { api: base } = mockApi();
  const objectHooks = [], deathHooks = [];
  const queues = { add: [], remove: [] };
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, owner: null, setOwner(value) { this.owner = value; }, setOwnerOnly() {}, isNpc() { return true; }, getAsNpc() { return this; }, isRegistered() { return true; } }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
      : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const { ItemIdentifiers: I } = api.core;
  const attrs = new Map([['desert-treasure-ii:vardorvis-progress', 16]]);
  const counts = new Map();
  const varbits = new Map();
  const p = {
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'dt2-vardorvis-test',
    getInventory: () => ({ getAmount: (id) => counts.get(id) ?? 0, adds: (id, n) => counts.set(id, (counts.get(id) ?? 0) + n) }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    moveTo(location) { this.location = location; }, sendMessage() {},
  };
  quest.setStage(p, 7);
  assert.equal(objectHooks[0]({ player: p, objectId: 49495, location: { x: 1118, y: 3428, z: 0 } }), true);
  const area = attrs.get('desert-treasure-ii:vardorvis-area');
  const boss = queues.add[0];
  assert.equal(boss.id, api.core.NpcIdentifiers.VARDORVIS_2, 'the quest form spawns at the documented ritual site');
  assert.equal(boss.owner, p);
  assert.equal(boss.location.x, 8209, 'Vardorvis is placed at source coordinate 1129,3419 inside the copied ritual site');
  assert.equal(boss.location.y, 1619);
  const rocks = { x: area.tile(6, 28, 0).x, y: area.tile(6, 28, 0).y, z: 0 };
  deathHooks[0]({ killer: p, npc: boss });
  assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 17);
  assert.equal(counts.get(I.VARDORVIS_MEDALLION) ?? 0, 0, 'Vardorvis does not skip the Temple key and Kasonde aftermath');
  assert.equal(objectHooks[0]({ player: p, objectId: api.core.ObjectIdentifiers.ROCKS_139, location: rocks }), true);
  assert.equal(counts.get(I.TEMPLE_KEY_3), 1);
  assert.equal(attrs.get('desert-treasure-ii:vardorvis-progress'), 18);
});

test('Desert Treasure II enters the Scar through the Catalytic Guardian and requires the six opening demons', () => {
  const { api: base } = mockApi();
  const objectHooks = [], objectRouteHooks = [], deathHooks = [], itemOnItemHooks = [], itemOnNpcHooks = [], itemOnObjectHooks = [], itemActionHooks = [], hitModifyHooks = [], lineHooks = [], actionHooks = [], interactions = [];
  const transcripts = [], queues = { add: [], remove: [] }, varbits = new Map(), inventoryCounts = new Map();
  const routes = [];
  let processCycle = 0;
  class TestInstance {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 8192; }
    getBaseY() { return 1600; }
    tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z, getX() { return this.x; }, getY() { return this.y; } }; }
    add(npc) { this.entities.push(npc); }
    remove(npc) { this.entities = this.entities.filter((entity) => entity !== npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestInstance,
    NPC: { create: (id, location) => ({ id, location, owner: null, setOwner(value) { this.owner = value; }, getOwner() { return this.owner; }, setOwnerOnly() {}, setScriptedMovement() {}, getMovementQueue() { return this.movement ??= { steps: [], addSteps(tile) { this.steps.push(tile); }, setBlockMovement(blocked) { this.blocked = blocked; } }; }, getLocation() { return { getX: () => this.location.x, getY: () => this.location.y }; }, isNpc() { return true; }, getAsNpc() { return this; }, isRegistered() { return true; }, getHitpoints() { return 100; } }) },
    PathFinder: { calculateWalkRoute: (npc, x, y) => { routes.push([x, y]); npc.getMovementQueue().addSteps({ x, y }); } },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove, getProcessCycle: () => processCycle++ },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onObjectRoute' ? (handler) => objectRouteHooks.push(handler)
        : prop === 'onItemOnItem' ? (handler) => itemOnItemHooks.push(handler)
        : prop === 'onItemOnNpc' ? (handler) => itemOnNpcHooks.push(handler)
          : prop === 'onItemOnObject' ? (handler) => itemOnObjectHooks.push(handler)
            : prop === 'onItemAction' ? (handler) => itemActionHooks.push(handler)
                : prop === 'onNpcHitModify' ? (handler) => hitModifyHooks.push(handler)
        : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : prop === 'onCustomEvent' ? (name, handler) => ({ 'npc-dialogue:line': lineHooks, 'npc-dialogue:action': actionHooks }[name]?.push(handler))
            : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
              : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = (_api, _player, _npcId, _page, variant) => (transcripts.push(variant), true);
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-scar-test',
      isPlayer: () => true, getAsPlayer() { return this; },
      getLocation() { return { getX: () => this.location.x, getY: () => this.location.y }; },
      getInventory: () => ({
        getAmount: (id) => inventoryCounts.get(id) ?? 0,
        adds: (id, amount) => inventoryCounts.set(id, (inventoryCounts.get(id) ?? 0) + amount),
        deleteNumber: (id, amount) => inventoryCounts.set(id, Math.max(0, (inventoryCounts.get(id) ?? 0) - amount)),
      }),
      getPacketSender: () => new Proxy({}, { get: (_target, prop) => prop === 'sendVarbit' ? (id, value) => varbits.set(id, value) : () => {} }),
      moveTo(location) { this.location = location; }, sendMessage(message) { (this.messages ??= []).push(message); },
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pendingAirHits.push(...hits) }) }),
    };
    quest.setStage(player, 8);
    const guardian = interactions.find((entry) => entry.name === 'Catalytic Guardian').options['Talk-to'];
    guardian({ player, npcId: core.NpcIdentifiers.CATALYTIC_GUARDIAN });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-the-catalytic-guardian');
    const afterYes = { player, npcId: core.NpcIdentifiers.CATALYTIC_GUARDIAN, text: 'Yes.' };
    lineHooks[0](afterYes);
    afterYes.after();
    assert.equal(varbits.get(15128), 6, 'entering the Scar advances the canonical quest varbit');
    const area = attrs.get('desert-treasure-ii:scar-area');
    assert.equal(area.width, 9);
    assert.equal(area.height, 8);
    assert.equal(player.location.x, 8213);
    assert.equal(player.location.y, 1633);
    assert.equal(queues.add.length, 6);
    assert.ok(queues.add.every((npc) => npc.owner === player));
    for (const npc of [...queues.add]) deathHooks[0]({ killer: player, npc });
    assert.equal(attrs.get('desert-treasure-ii:scar-demons-defeated'), true);
    assert.equal(varbits.get(15128), 8);
    const firstStone = area.tile(31, 30, 0);
    player.location = area.tile(29, 30, 0);
    const firstRoute = { player, objectId: 49209, clickType: 1, object: { getLocation: () => firstStone } };
    objectRouteHooks[0](firstRoute);
    assert.deepEqual(firstRoute.destination, { x: area.tile(29, 30, 0).x, y: area.tile(29, 30, 0).y, z: 0 },
      'the first crossing routes to a walkable near-bank approach tile');
    assert.equal(objectHooks[0]({ player, objectId: 49209, location: firstStone }), true);
    assert.deepEqual([player.location.x, player.location.y], [area.tile(32, 30, 0).x, area.tile(32, 30, 0).y],
      'crossing the first stone moves only to the next safe tile');
    const secondStone = area.tile(33, 30, 0);
    const secondRoute = { player, objectId: 49209, clickType: 1, object: { getLocation: () => secondStone } };
    objectRouteHooks[0](secondRoute);
    assert.deepEqual(secondRoute.destination, { x: area.tile(32, 30, 0).x, y: area.tile(32, 30, 0).y, z: 0 },
      'the second crossing uses the approach from the near side');
    assert.equal(objectHooks[0]({ player, objectId: 49209, location: secondStone }), true);
    assert.deepEqual([player.location.x, player.location.y], [area.tile(34, 30, 0).x, area.tile(34, 30, 0).y]);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.ROWBOAT_19, location: area.tile(65, 35, 0) }), true,
      'the map boat is usable after naturally crossing the Scar fight');
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-attempting-to-board-the-rowboat-in-the-scar');
    actionHooks[0]({ player, stepId: '4b6oDl' });
    assert.equal(player.location.x, 8243);
    assert.equal(player.location.y, 1643);
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({ player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5 });
    assert.equal(attrs.get('desert-treasure-ii:scar-persten-talked'), true);
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten');
    assert.equal(varbits.get(15128), 14);
    assert.equal(area.scarMazeEntry.id, 49205,
      'Persten opens the canonical cache passage at its real Scar entrance');
    assert.deepEqual([area.scarMazeEntry.location.x, area.scarMazeEntry.location.y], [8235, 1641]);
    assert.equal(objectHooks[0]({ player, objectId: 49526, definition: { id: 49206 }, location: area.tile(43, 41, 0) }), false,
      'the closed cache morph cannot be entered');
    assert.equal(objectHooks[0]({ player, objectId: 49526, definition: { id: 49205 }, location: area.tile(43, 41, 0) }), true,
      'the north-west cache passage is available after Persten explains the ship plan');
    const maze = attrs.get('desert-treasure-ii:scar-maze-one');
    assert.equal(maze.width, 11);
    assert.equal(maze.height, 9);
    assert.equal(player.location.x, 8228, 'the maze entry lands at the real pathfinder-room entrance tile');
    assert.equal(player.location.y, 1654);
    assert.equal(varbits.get(15128), 16);
    let runner = queues.add.at(-1);
    assert.equal(runner.id, core.NpcIdentifiers.CEREBRAL_PATHFINDER,
      'the first cache pathfinder is moved with the documented Move interaction');
    const movePathfinder = interactions.find((entry) => entry.name === 'Cerebral pathfinder').options.Move;
    const movePathbreaker = interactions.find((entry) => entry.name === 'Cerebral pathbreaker').options.Move;
    const push = (npc, handler) => handler({ player, npc, npcId: npc.id, clickType: 1,
      definition: { getActions: () => ['Move', 'Reset-room'] }, handled: false });
    const firstMoveEvent = { player, npc: runner, npcId: runner.id, clickType: 1,
      definition: { getActions: () => ['Move', 'Reset-room'] }, handled: false };
    player.location = maze.tile(36, 50, 0);
    movePathfinder(firstMoveEvent);
    assert.equal(firstMoveEvent.handled, true);
    assert.equal(runner.getMovementQueue().steps.length, 0, 'pushing from the wrong side does not move an orb');
    assert.match(player.messages.at(-1), /Stand north/);
    player.location = maze.tile(35, 51, 0);
    push(runner, movePathfinder);
    assert.deepEqual(routes.at(-1), [8227, 1644], 'a green orb follows the documented north push to its first waypoint');
    runner.location = maze.tile(35, 44, 0);
    maze.process(player);
    assert.deepEqual(routes.at(-1), [8229, 1644], 'the pathfinder follows the second cache waypoint without another push');
    runner.location = maze.tile(37, 44, 0);
    player.location = maze.tile(37, 44, 0);
    maze.process(player);
    assert.equal(maze.pathIndex, 1, 'the next pathbreaker appears after the first orb reaches both Wiki waypoints');
    assert.ok(queues.remove.includes(runner), 'each orb leaves after reaching its waypoint');
    for (let pathIndex = 1; pathIndex < 6; pathIndex++) {
      runner = maze.pathRunner;
      const handler = runner.id === core.NpcIdentifiers.CEREBRAL_PATHFINDER ? movePathfinder : movePathbreaker;
      const path = [
        { points: [[2199, 6444], [2202, 6444], [2202, 6442]], side: [ -1, 0 ] },
        { points: [[2202, 6440], [2201, 6439], [2198, 6438]], side: [0, 1] },
        { points: [[2197, 6438], [2196, 6435]], side: [-1, 0] },
        { points: [[2196, 6435], [2207, 6436]], side: [1, 0] },
        { points: [[2207, 6436], [2207, 6433], [2209, 6433]], side: [0, -1] },
      ][pathIndex - 1];
      const source = path.points[0];
      player.location = maze.tile(source[0] - 2160 + path.side[0], source[1] - 6400 + path.side[1], 0);
      push(runner, handler);
      assert.deepEqual([runner.location.x, runner.location.y], [source[0] - 2160 + 8192, source[1] - 6400 + 1600]);
      for (const [pointX, pointY] of path.points.slice(1)) {
        runner.location = maze.tile(pointX - 2160, pointY - 6400, 0);
        maze.process(player);
      }
      player.location = runner.location;
      maze.process(player);
      assert.equal(queues.remove.includes(runner), true, 'each completed orb is cleaned up before the next step');
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-pathfinder-complete'), true);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.ABYSSAL_TETHER, location: maze.tile(50, 33, 0) }), true);
    assert.equal(attrs.get('desert-treasure-ii:scar-tether-destroyed'), true);
    assert.equal(attrs.get('desert-treasure-ii:scar-tether-destroyed'), true,
      'the tether completion is saved independently from the reused passage challenge varbits');
    assert.equal(objectHooks[0]({ player, objectId: 49415, location: maze.tile(73, 61, 0) }), true,
      'the green neural teleporter is usable only after severing the tether');
    assert.equal(player.location.x, 8223);
    assert.equal(objectHooks[0]({ player, objectId: 49411, location: maze.tile(30, 12, 0) }), true,
      'the catalyst room is entered through its real cache passage');
    assert.equal(attrs.get('desert-treasure-ii:scar-rift-live-nerves'), true);
    assert.equal(objectHooks[0]({ player, objectId: 49183, location: maze.tile(35, 18, 0) }), true,
      'breaking the mapped air nerve ending awards a nerve item');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.AIR_NERVE), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49182, location: maze.tile(38, 11, 0) }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.EARTH_NERVE), 1);
    assert.equal(itemOnItemHooks[0]({ player, usedItemId: core.ItemIdentifiers.AIR_NERVE,
      usedWithItemId: core.ItemIdentifiers.EARTH_NERVE }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.AIR_NERVE), 0);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.EARTH_NERVE), 0);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DUST_NERVE), 1,
      'the documented air + earth recipe makes dust nerve');
    for (const id of attrs.get('desert-treasure-ii:scar-catalyst-order')) inventoryCounts.set(id, 1);
    const catalystId = core.NpcIdentifiers.DT2_SCAR_MAZE_1_RITUAL_CATALYST;
    inventoryCounts.delete(core.ItemIdentifiers.DUST_NERVE);
    assert.equal(itemOnNpcHooks[0]({ player, npcId: catalystId, itemId: core.ItemIdentifiers.DUST_NERVE }), true,
      'a mismatched nerve is handled without advancing or consuming it');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DUST_NERVE), undefined);
    const catalystOrder = attrs.get('desert-treasure-ii:scar-catalyst-order');
    const catalystParts = new Map([
      [core.ItemIdentifiers.SMOKE_NERVE, [core.ItemIdentifiers.FIRE_NERVE, core.ItemIdentifiers.AIR_NERVE]],
      [core.ItemIdentifiers.BLOOD_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.WATER_NERVE]],
      [core.ItemIdentifiers.SOUL_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.MIND_NERVE]],
      [core.ItemIdentifiers.NATURE_NERVE, [core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.EARTH_NERVE]],
      [core.ItemIdentifiers.COSMIC_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.EARTH_NERVE]],
      [core.ItemIdentifiers.ASTRAL_NERVE, [core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.MIND_NERVE, core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.EARTH_NERVE, core.ItemIdentifiers.EARTH_NERVE]],
    ]);
    const firstCatalystPart = catalystParts.get(catalystOrder[0])[0];
    inventoryCounts.set(firstCatalystPart, 1);
    assert.equal(itemOnNpcHooks[0]({ player, npcId: catalystId, itemId: firstCatalystPart }), true,
      'a matching elemental nerve can damage the Catalyst without finishing its symbol');
    assert.equal(Number(attrs.get('desert-treasure-ii:scar-catalyst-progress')) || 0, 0);
    assert.equal(inventoryCounts.get(firstCatalystPart), 0);
    for (const nerve of catalystOrder) {
      assert.equal(itemOnNpcHooks[0]({ player, npcId: catalystId, itemId: nerve }), true);
    }
    assert.equal(Number(attrs.get('desert-treasure-ii:scar-catalyst-progress')), 6,
      'the Catalyst only completes after all matching nerves are used');
    assert.equal(objectHooks[0]({ player, objectId: 49414, location: maze.tile(21, 24, 0) }), true,
      'the blue teleporter becomes reachable after the Catalyst is disrupted');
    assert.equal(objectHooks[0]({ player, objectId: 49412, location: maze.tile(65, 21, 0) }), true,
      'the damaged growth room has its own cache entrance');
    const takeLure = interactions.find((entry) => entry.name === 'Light leech').options['Take-lure'];
    const random = Math.random;
    Math.random = () => 0;
    try {
      for (const leech of queues.add.filter((npc) => npc.id === core.NpcIdentifiers.DT2_SCAR_MAZE_LIGHT_LEECH)) takeLure({ player, npc: leech });
    } finally {
      Math.random = random;
    }
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.ILLUMINATING_LURE), 4,
      'each real light leech can yield a lure');
    for (const [x, y] of [[2219, 6435], [2220, 6423], [2231, 6423], [2232, 6435]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49436, itemId: core.ItemIdentifiers.ILLUMINATING_LURE,
        location: maze.tile(x - 2160, y - 6400, 0) }), true);
    }
    assert.equal(varbits.get(15210), 4, 'repairing all four growths reveals the rune sequence');
    const energies = new Map([[1, [49520, 49189, [2227, 6430]]], [2, [49521, 49190, [2224, 6433]]],
      [3, [49522, 49191, [2227, 6433]]], [4, [49523, 49192, [2224, 6427]]],
      [5, [49524, 49193, [2227, 6427]]], [6, [49525, 49194, [2224, 6430]]]]);
    const order = attrs.get('desert-treasure-ii:scar-growth-order');
    const wrong = energies.get(order[0] === 1 ? 2 : 1);
    assert.equal(objectHooks[0]({ player, objectId: wrong[0], definition: { id: wrong[1] },
      location: maze.tile(wrong[2][0] - 2160, wrong[2][1] - 6400, 0) }), true);
    assert.equal(varbits.get(15209), 0, 'touching the wrong energy preserves the current puzzle step');
    for (const rune of order) {
      const [baseId, visibleId, [x, y]] = energies.get(rune);
      assert.equal(objectHooks[0]({ player, objectId: baseId, definition: { id: visibleId },
        location: maze.tile(x - 2160, y - 6400, 0) }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-growth-complete'), true,
      'the exact six-energy order completes the growth challenge');
    assert.equal(objectHooks[0]({ player, objectId: 49418, location: maze.tile(60, 2, 0) }), true,
      'the southern shipwreck passage opens only after restoring the six-energy sequence');
    assert.equal(objectHooks[0]({ player, objectId: 49425, location: maze.tile(76, 2, 0) }), true,
      'searching the mapped crate provides the tinderbox');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.TINDERBOX), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49426, location: maze.tile(61, 14, 0) }), true,
      'the north-west skeleton contains the slimy key');
    assert.equal(objectHooks[0]({ player, objectId: 49427, location: maze.tile(63, 2, 0) }), true,
      'the south-west skeleton contains gunpowder');
    assert.equal(objectHooks[0]({ player, objectId: 49420, location: maze.tile(71, 13, 0) }), true,
      'the slimy key opens the actual cache chest for the old tablet');
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.OLD_TABLET), 1);
    const readTablet = { player, itemId: core.ItemIdentifiers.OLD_TABLET, option: 'Read' };
    assert.equal(itemActionHooks[0](readTablet), true);
    assert.equal(readTablet.handled, true);
    assert.equal(itemOnObjectHooks[0]({ player, objectId: 49423, itemId: core.ItemIdentifiers.TINDERBOX,
      location: maze.tile(75, 9, 0) }), true, 'the tinderbox lights gunpowder around the wreck after reading the tablet');
    assert.equal(attrs.get('desert-treasure-ii:scar-boat-burned'), true);
    assert.equal(varbits.get(15128), 20);
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({
      player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5,
    });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-first-passage');
    assert.equal(attrs.get('desert-treasure-ii:scar-persten-room1-talked'), true);
    assert.equal(varbits.get(15128), 22, 'Persten advances the quest only after the boat room is complete');
    assert.equal(area.scarMazeTwoEntry.id, core.ObjectIdentifiers.PASSAGE_15,
      'Persten opens the cache passage to the middle level after the first ship is destroyed');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_15, location: area.tile(51, 34, 0) }), true);
    const middle = attrs.get('desert-treasure-ii:scar-maze-two');
    assert.equal(middle.width, 12);
    assert.equal(middle.height, 8);
    assert.equal(varbits.get(15128), 24);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_18, location: middle.tile(60, 20, 0) }), true,
      'the cache doorway starts the four-axon terminal puzzle');
    let axons = queues.add.filter((npc) => npc.__dt2ScarAxon);
    assert.equal(axons.length, 4);
    const firstMove = axons[0].__dt2AxonPath.points[1];
    const firstStart = axons[0].__dt2AxonPath.points[0];
    const firstDx = Math.sign(firstMove[0] - firstStart[0]), firstDy = Math.sign(firstMove[1] - firstStart[1]);
    player.moveTo(middle.tile(firstStart[0] - 1696 + firstDx, firstStart[1] - 6400 + firstDy, 0));
    const wrongSideHit = { getAttacker: () => player, isAccurate: () => true,
      getHits: () => [{ setDamage(value) { this.damage = value; } }], updateTotalDamage() {} };
    hitModifyHooks.find((handler) => handler.name === 'handleScarAxonHit')({ npc: axons[0], hit: wrongSideHit });
    assert.equal(axons[0].__dt2AxonIndex, 0, 'hitting an axon from the wrong side does not push it away from its terminal');
    for (const axon of axons) {
      while (axon.__dt2AxonIndex < axon.__dt2AxonPath.points.length - 1) {
        const current = axon.__dt2AxonPath.points[axon.__dt2AxonIndex];
        const next = axon.__dt2AxonPath.points[axon.__dt2AxonIndex + 1];
        const dx = Math.sign(next[0] - current[0]), dy = Math.sign(next[1] - current[1]);
        player.moveTo(middle.tile(current[0] - 1696 - dx, current[1] - 6400 - dy, 0));
        const hit = { getAttacker: () => player, isAccurate: () => true,
          getHits: () => [{ setDamage(value) { this.damage = value; } }], updateTotalDamage() {} };
        hitModifyHooks.find((handler) => handler.name === 'handleScarAxonHit')({ npc: axon, hit });
        axon.location = middle.tile(next[0] - 1696, next[1] - 6400, 0);
      }
      assert.equal(axon.__dt2AxonComplete, true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-axon-room-complete'), true);
    assert.equal(varbits.get(15258), 1, 'all four axons must reach their matching terminals');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_19, location: middle.tile(86, 20, 0) }), true,
      'the broken nerve chamber opens after all axon terminals activate');
    assert.equal(attrs.get('desert-treasure-ii:scar-nerve-room-two-active'), true);
    assert.equal(varbits.get(15211), 100, 'the underwater room starts with full oxygen');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.AIR_BUBBLE, location: middle.tile(84, 25, 0) }), true);
    assert.equal(varbits.get(15211), 100, 'air bubbles restore oxygen while underwater');
    const roomNerves = [
      [core.ObjectIdentifiers.NERVE_ENDING_EARTH_, 1784, 6423, core.ItemIdentifiers.EARTH_NERVE],
      [core.ObjectIdentifiers.NERVE_ENDING_AIR_, 1789, 6429, core.ItemIdentifiers.AIR_NERVE],
      [core.ObjectIdentifiers.NERVE_ENDING_WATER_, 1775, 6426, core.ItemIdentifiers.WATER_NERVE],
      [core.ObjectIdentifiers.NERVE_ENDING_FIRE_, 1777, 6422, core.ItemIdentifiers.FIRE_NERVE],
    ];
    for (const [objectId, x, y, itemId] of roomNerves) {
      assert.equal(objectHooks[0]({ player, objectId, location: middle.tile(x - 1696, y - 6400, 0) }), true);
      assert.equal(inventoryCounts.get(itemId), 1);
    }
    for (const [ingredients, result] of [
      [[core.ItemIdentifiers.AIR_NERVE, core.ItemIdentifiers.EARTH_NERVE], core.ItemIdentifiers.DUST_NERVE],
      [[core.ItemIdentifiers.EARTH_NERVE, core.ItemIdentifiers.FIRE_NERVE], core.ItemIdentifiers.LAVA_NERVE],
      [[core.ItemIdentifiers.FIRE_NERVE, core.ItemIdentifiers.AIR_NERVE], core.ItemIdentifiers.SMOKE_NERVE],
      [[core.ItemIdentifiers.WATER_NERVE, core.ItemIdentifiers.FIRE_NERVE], core.ItemIdentifiers.STEAM_NERVE],
    ]) {
      inventoryCounts.set(ingredients[0], 2);
      inventoryCounts.set(ingredients[1], 2);
      assert.equal(itemOnItemHooks[0]({ player, usedItemId: ingredients[0], usedWithItemId: ingredients[1] }), true);
      assert.equal(inventoryCounts.get(result), 1);
    }
    const repairs = [
      [49445, 1778, 6431, core.ItemIdentifiers.SMOKE_NERVE],
      [49446, 1783, 6430, core.ItemIdentifiers.STEAM_NERVE],
      [49447, 1784, 6433, core.ItemIdentifiers.DUST_NERVE],
      [49448, 1779, 6435, core.ItemIdentifiers.LAVA_NERVE],
    ];
    for (const [objectId, x, y, itemId] of repairs) {
      const location = middle.tile(x - 1696, y - 6400, 0);
      const wrong = { player, itemId: core.ItemIdentifiers.DUST_NERVE, objectId, location };
      assert.equal(itemOnObjectHooks[0](wrong), true);
      assert.equal(wrong.handled, true);
      const repair = { player, itemId, objectId, location };
      assert.equal(itemOnObjectHooks[0](repair), true);
      assert.equal(repair.handled, true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-nerve-room-two-complete'), true);
    assert.equal(varbits.get(15259), 1);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_20, location: middle.tile(48, 57, 0) }), true);
    let imps = queues.add.filter((npc) => npc.__dt2SummonImp);
    let demons = queues.add.filter((npc) => npc.__dt2SummonDemon);
    assert.equal(imps.length, 3);
    assert.equal(demons.length, 2);
    const protectedHits = [{ setDamage(value) { this.damage = value; } }];
    const protectedHit = { isAccurate: () => true, getHits: () => protectedHits, updateTotalDamage() {} };
    hitModifyHooks.find((handler) => handler.name === 'preventScarSummonProtection')({ npc: demons[0], hit: protectedHit });
    assert.equal(protectedHits[0].damage, 0, 'the imps protect the lesser demons until they die');
    for (const imp of imps) deathHooks[0]({ killer: player, npc: imp });
    assert.equal(attrs.get('desert-treasure-ii:scar-summoning-imps'), 0);
    for (const demon of demons) deathHooks[0]({ killer: player, npc: demon });
    assert.equal(attrs.get('desert-treasure-ii:scar-summoning-room-complete'), true);
    assert.equal(varbits.get(15260), 1);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_23, location: middle.tile(75, 59, 0) }), true);
    for (const [objectId, x, y] of [[49425, 1774, 6448], [49427, 1779, 6448], [49426, 1789, 6449]]) {
      assert.equal(objectHooks[0]({ player, objectId, location: middle.tile(x - 1696, y - 6400, 0) }), true);
    }
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.TINDERBOX), 1);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.GUNPOWDER_2), 1);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.SLIMY_KEY), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49420, location: middle.tile(79, 60, 0) }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DAMP_TABLET), 1);
    const readDamp = { player, itemId: core.ItemIdentifiers.DAMP_TABLET, option: 'Read' };
    assert.equal(itemActionHooks[0](readDamp), true);
    assert.equal(readDamp.handled, true);
    const burnSecondWreck = { player, itemId: core.ItemIdentifiers.TINDERBOX, objectId: core.ObjectIdentifiers.SHIPWRECK,
      location: middle.tile(90, 53, 0) };
    assert.equal(itemOnObjectHooks[0](burnSecondWreck), true);
    assert.equal(burnSecondWreck.handled, true);
    assert.equal(attrs.get('desert-treasure-ii:scar-boat2-burned'), true);
    assert.equal(varbits.get(15128), 28);
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.PASSAGE_17, location: middle.tile(94, 5, 0) }), true,
      'the real passage exit returns the player to Persten after the second ship');
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({
      player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5,
    });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-second-passage');
    assert.equal(attrs.get('desert-treasure-ii:scar-persten-room2-talked'), true);
    assert.equal(varbits.get(15128), 30);
    assert.equal(area.scarMazeTwoEntry.id, 49410, 'Persten reveals the third passage after the second boat is burned');
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: area.tile(51, 34, 0) }), true);
    const finalPassage = attrs.get('desert-treasure-ii:scar-maze-three');
    assert.equal(finalPassage.width, 9);
    assert.equal(finalPassage.height, 9);
    assert.equal(varbits.get(15128), 32);
    const pendingAirHits = [];
    attrs.set('desert-treasure-ii:scar-maze-three-air', 2);
    finalPassage.process(player);
    assert.equal(varbits.get(15211), 1, 'the third passage drains oxygen once per world cycle');
    assert.equal(objectHooks[0]({ player, objectId: core.ObjectIdentifiers.AIR_BUBBLE,
      location: finalPassage.tile(1900 - 1856, 6430 - 6400, 0) }), true);
    assert.equal(varbits.get(15211), 100, 'the correct cache air bubble restores oxygen');
    attrs.set('desert-treasure-ii:scar-maze-three-air', 0);
    finalPassage.process(player);
    assert.equal(pendingAirHits.length, 1, 'running out of air forces the player back and causes damage');
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: finalPassage.tile(41, 36, 0) }), true,
      'the Abyssal Stem starts the final passage memory puzzle');
    const memory = attrs.get('desert-treasure-ii:scar-memory-order');
    assert.equal(memory.length, 4);
    assert.equal(new Set(memory).size, 4);
    const wrongStep = memory[0] === 0 ? 1 : 0;
    const [wx, wy] = [[1903, 6431], [1900, 6442], [1909, 6441], [1914, 6434]][wrongStep];
    assert.equal(objectHooks[0]({ player, objectId: 49391, location: finalPassage.tile(wx - 1856, wy - 6400, 0) }), true);
    assert.equal(varbits.get(15212), 0, 'a wrong memory growth resets the sequence');
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: finalPassage.tile(41, 36, 0) }), true,
      'touching the stem shows the same stored sequence again');
    for (const growth of memory) {
      const [x, y] = [[1903, 6431], [1900, 6442], [1909, 6441], [1914, 6434]][growth];
      assert.equal(objectHooks[0]({ player, objectId: 49391, location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-memory-complete'), true);
    assert.equal(varbits.get(15258), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49412, location: finalPassage.tile(46, 11, 0) }), true,
      'the Brain Pillar room only opens after solving the memory puzzle');
    for (let wave = 0; wave < 4; wave++) {
      const enemies = queues.add.filter((npc) => npc.__dt2ScarTreeEnemy === true);
      assert.equal(enemies.length, 2);
      for (const enemy of enemies) deathHooks[0]({ killer: player, npc: enemy });
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-tree-complete'), true,
      'the Brain Pillar heals after the player clears four actual enemy waves');
    assert.equal(varbits.get(15260), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49416, location: finalPassage.tile(35, 57, 0) }), true,
      'the north neural teleporter leads to the Unlit Veins');
    const takeMazeThreeLure = interactions.find((entry) => entry.name === 'Light leech').options['Take-lure'];
    const oldRandom = Math.random;
    Math.random = () => 0;
    try {
      for (const leech of queues.add.filter((npc) => npc.__dt2ScarMazeThreeLeech)) takeMazeThreeLure({ player, npc: leech });
    } finally { Math.random = oldRandom; }
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.ILLUMINATING_LURE), 4);
    for (const [x, y] of [[1862, 6432], [1869, 6423], [1869, 6440], [1876, 6432]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49436, itemId: core.ItemIdentifiers.ILLUMINATING_LURE,
        location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(varbits.get(15210), 4);
    for (const cell of queues.add.filter((npc) => npc.__dt2ScarBloodCell)) deathHooks[0]({ killer: player, npc: cell });
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.CRIMSON_FIBRE), 3);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.RADIANT_FIBRE), 3);
    for (const [x, y] of [[1865, 6438], [1874, 6429], [1874, 6434]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49537, itemId: core.ItemIdentifiers.CRIMSON_FIBRE,
        location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    for (const [x, y] of [[1867, 6427], [1867, 6433], [1874, 6425]]) {
      assert.equal(itemOnObjectHooks[0]({ player, objectId: 49536, itemId: core.ItemIdentifiers.RADIANT_FIBRE,
        location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:scar-leech-complete'), true);
    assert.equal(varbits.get(15259), 1);
    assert.equal(objectHooks[0]({ player, objectId: 49419, location: finalPassage.tile(43, 56, 0) }), true);
    for (const [objectId, x, y] of [[49425, 1915, 6460], [49427, 1912, 6446], [49426, 1902, 6459]]) {
      assert.equal(objectHooks[0]({ player, objectId, location: finalPassage.tile(x - 1856, y - 6400, 0) }), true);
    }
    assert.equal(objectHooks[0]({ player, objectId: 49420, location: finalPassage.tile(53, 49, 0) }), true);
    assert.equal(inventoryCounts.get(core.ItemIdentifiers.DAMP_TABLET_2), 1);
    const readThirdTablet = { player, itemId: core.ItemIdentifiers.DAMP_TABLET_2, option: 'Read' };
    assert.equal(itemActionHooks[0](readThirdTablet), true);
    assert.equal(readThirdTablet.handled, true);
    const burnThirdWreck = { player, itemId: core.ItemIdentifiers.TINDERBOX, objectId: core.ObjectIdentifiers.SHIPWRECK,
      location: finalPassage.tile(58, 55, 0) };
    assert.equal(itemOnObjectHooks[0](burnThirdWreck), true);
    assert.equal(burnThirdWreck.handled, true);
    assert.equal(attrs.get('desert-treasure-ii:scar-boat3-burned'), true);
    assert.equal(varbits.get(15128), 34);
    assert.equal(objectHooks[0]({ player, objectId: 49410, location: finalPassage.tile(41, 36, 0) }), true,
      'the passage exit returns to camp after the third ship burns');
    interactions.find((entry) => entry.name === 'Wizard Persten').options['Talk-to']({ player, npcId: core.NpcIdentifiers.WIZARD_PERSTEN_5 });
    assert.equal(transcripts.at(-1), 'praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-third-passage');
    assert.equal(varbits.get(15128), 36);
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II opens Lassar from Ramarno and Prescott, then gates the cathedral and blackstone fragment behind real caches', () => {
  const { api: base } = mockApi();
  const objectHooks = [], itemOnObjectHooks = [], itemActionHooks = [], itemOnItemHooks = [], groundPickupHooks = [], actionHooks = [], interactions = [], transcripts = [], groundSpawns = [], playerProcesses = [];
  const counts = new Map();
  const varbits = new Map();
  const core = {
    ...base.core,
    NPC: { create: (id, location) => ({ id, location, setOwner() {}, setOwnerOnly() {}, setScriptedMovement() {}, setMaxHitpoints() {}, setHitpoints() {} }) },
    World: { getAddNPCQueue: () => [] },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objectHooks.push(handler)
        : prop === 'onItemOnObject' ? (handler) => itemOnObjectHooks.push(handler)
          : prop === 'onItemAction' ? (handler) => itemActionHooks.push(handler)
            : prop === 'onItemOnItem' ? (handler) => itemOnItemHooks.push(handler)
          : prop === 'onGroundItemPickup' ? (handler) => groundPickupHooks.push(handler)
            : prop === 'onPlayerProcess' ? (handler) => playerProcesses.push(handler)
            : prop === 'getItemOnGroundManager' ? () => ({ getGroundItem: () => null, registerLocation: (...args) => groundSpawns.push(args) })
          : prop === 'onCustomEvent' ? (name, handler) => name === 'npc-dialogue:action' && actionHooks.push(handler)
            : prop === 'onNpcInteraction' ? (name, options) => interactions.push({ name, options })
              : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  runtime.startTranscript = (_api, _player, _id, _page, variant) => (transcripts.push(variant), true);
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1);
    const attrs = new Map();
    const player = {
      getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      getUsername: () => 'dt2-lassar-test',
      getSkillManager: () => ({ getMaxLevel: () => 99 }),
      getInventory: () => ({
        getAmount: (id) => counts.get(id) ?? 0,
        adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
        deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
      }),
      getPacketSender: () => new Proxy({}, { get: (_target, key) => key === 'sendVarbit'
        ? (id, value) => varbits.set(id, value)
        : () => {} }),
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: () => {} }) }),
      getLocation() { return this.location; },
      moveTo(location) { this.location = location; }, sendMessage(message) { (this.messages ??= []).push(message); },
    };
    quest.setStage(player, 10);
    const interact = objectHooks[0];
    const ramarno = interactions.find((entry) => entry.name === 'Ramarno').options['Talk-to'];
    const prescott = interactions.find((entry) => entry.name === 'Prescott').options['Talk-to'];
    ramarno({ player, npcId: core.NpcIdentifiers.RAMARNO });
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-ramarno');
    actionHooks[0]({ player, stepId: 'xu7yT_' });
    prescott({ player, npcId: core.NpcIdentifiers.PRESCOTT });
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-prescott');
    actionHooks[0]({ player, stepId: 'em2ULK' });
    assert.equal(counts.get(core.ItemIdentifiers.VERY_LONG_ROPE), 1);
    const rock = { player, objectId: 48195, location: { x: 2922, y: 5827, z: 0 }, option: 'Climb-down' };
    assert.equal(interact(rock), true, 'the sinkhole cannot be descended before the rope is tied');
    assert.equal(itemOnObjectHooks[0]({ player, objectId: 48195, itemId: core.ItemIdentifiers.VERY_LONG_ROPE, location: rock.location }), true);
    assert.equal(interact(rock), true);
    assert.equal(player.location.x, 2587);
    assert.equal(player.location.y, 6436);
    const portals = [[2593, 6424, 49479], [2617, 6417, 49480], [2611, 6379, 49482], [2599, 6341, 49483], [2643, 6434, 49484], [2652, 6405, 49481]];
    assert.equal(interact({ player, objectId: portals[1][2], definition: { id: portals[1][2] }, location: { x: portals[1][0], y: portals[1][1], z: 0 }, option: 'Activate' }), true);
    assert.match(player.messages.at(-1), /earlier Lassar teleporters/);
    for (const [x, y, id] of portals.slice(0, 3)) {
      assert.equal(interact({ player, objectId: id, definition: { id }, location: { x, y, z: 0 }, option: 'Activate' }), true);
    }
    assert.equal(interact({ player, objectId: 49483, definition: { id: 49483 }, location: { x: 2599, y: 6341, z: 0 }, option: 'Activate' }), true);
    assert.match(player.messages.at(-1), /sealed district/);
    const findProp = (id, x, y, option = 'Search') => interact({ player, objectId: id, definition: { id }, location: { x, y, z: 0 }, option });
    findProp(48186, 2589, 6380, 'Search');
    findProp(48159, 2581, 6387, 'Search');
    findProp(48168, 2594, 6352, 'Search');
    assert.equal(counts.get(core.ItemIdentifiers.SHADOW_BLOCKER_SCHEMATIC), 1);
    assert.equal(counts.get(core.ItemIdentifiers.SHADOW_KEY_5), 1);
    assert.equal(counts.get(core.ItemIdentifiers.SHADOW_KEY), 1);
    for (const [x, y, id] of portals.slice(3)) {
      assert.equal(interact({ player, objectId: id, definition: { id }, location: { x, y, z: 0 }, option: 'Activate' }), true);
    }
    assert.equal(interact({ player, objectId: 48254, location: { x: 2656, y: 6424, z: 0 }, option: 'Open' }), true);
    assert.equal(player.location.x, 2648, 'the cathedral blackout moves the player to Ketla’s house');
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-ketla-after-coming-to');
    counts.set(core.ItemIdentifiers.RING_OF_VISIBILITY, 1);
    interactions.find((entry) => entry.name === 'Ketla').options['Talk-to']({ player, npcId: core.NpcIdentifiers.KETLA });
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-ketla-with-the-ring-of-visibility');
    actionHooks[0]({ player, stepId: 'JQeeJF' });
    interactions.find((entry) => entry.name === 'Ketla').options['Talk-to']({ player, npcId: core.NpcIdentifiers.KETLA });
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-ketla-with-the-ring-of-visibility-reclaiming-the-blackstone-fragment');
    actionHooks[0]({ player, stepId: '5mQjA2' });
    assert.equal(counts.get(core.ItemIdentifiers.BLACKSTONE_FRAGMENT), 1);
    interactions.find((entry) => entry.name === 'Ketla').options['Talk-to']({ player, npcId: core.NpcIdentifiers.KETLA });
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-ketla-with-a-schematic');
    actionHooks[0]({ player, stepId: 'tOep7b' });
    assert.equal(counts.get(core.ItemIdentifiers.SHADOW_BLOCKER_SCHEMATIC), 0, 'Ketla takes the schematic to build the blocker');
    assert.equal(interact({ player, objectId: 48163, location: { x: 2645, y: 6440, z: 0 }, option: 'Search' }), true);
    assert.equal(counts.get(core.ItemIdentifiers.SHADOW_BLOCKER), 1);
    assert.equal(interact({ player, objectId: 48200, location: { x: 2598, y: 6365, z: 0 }, option: 'Enter' }), true);
    assert.equal(player.location.x, 2342, 'the puddle carries the player into the mirrored shadow region');
    assert.equal(interact({ player, objectId: 48264, location: { x: 2350, y: 6360, z: 0 }, option: 'Open' }), true);
    assert.match(player.messages.at(-1), /lost souls overwhelm/);
    itemActionHooks[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
    assert.equal(player.location.x, 2598, 'the fragment returns the player to the material world');
    assert.equal(itemOnObjectHooks[0]({ player, objectId: 48264, itemId: core.ItemIdentifiers.SHADOW_BLOCKER, location: { x: 2606, y: 6359, z: 0 } }), true);
    assert.equal(counts.get(core.ItemIdentifiers.SHADOW_BLOCKER), 0, 'the blocker is placed by the furnace-house door');
    assert.equal(interact({ player, objectId: 48200, location: { x: 2598, y: 6365, z: 0 }, option: 'Enter' }), true);
    const unlocked = interact({ player, objectId: 48264, location: { x: 2350, y: 6360, z: 0 }, option: 'Open' });
    assert.equal(unlocked, false, 'the purple key opens the real locked shadow door after the blocker is placed');
    assert.equal(counts.get(core.ItemIdentifiers.SHADOW_KEY), 0);
    assert.equal(groundSpawns.length, 1, 'the basic torch schematic appears at its cache tile behind the door');
    groundPickupHooks[0]({ player, groundItemId: core.ItemIdentifiers.BASIC_SHADOW_TORCH_SCHEMATIC, location: { x: 2353, y: 6367, z: 0 } });
    assert.equal(attrs.get('desert-treasure-ii:lassar').torchSchematicFound, true);
    const state = attrs.get('desert-treasure-ii:lassar');
    assert.equal(state.teleporters.filter(Boolean).length, 6);
    assert.equal(state.entered, true);
    assert.equal(state.blackstone, true);
    assert.equal(varbits.get(15126), 20, 'the Lassar progress varbit reflects the recovered basic-torch schematic');
    assert.equal(varbits.get(15088), 1, 'the cache palace teleporter varbit follows the per-player activation');
    assert.equal(varbits.get(15090), 1, 'the cache cathedral teleporter varbit follows the per-player activation');
    attrs.set('desert-treasure-ii:lassar', { ...state, inShadow: true, sanity: 100 });
    playerProcesses[0]({ player });
    assert.equal(attrs.get('desert-treasure-ii:lassar').sanity, 99, 'sanity drains 1 point per shadow tick');
    assert.equal(varbits.get(15064), 99, 'the cache sanity bar stays in sync with shadow time');
    attrs.set('desert-treasure-ii:lassar', { ...attrs.get('desert-treasure-ii:lassar'), inShadow: false });
    playerProcesses[0]({ player });
    assert.equal(attrs.get('desert-treasure-ii:lassar').sanity, 100, 'sanity recovers 10 points per material-realm tick');
    attrs.set('desert-treasure-ii:lassar', {
      ...attrs.get('desert-treasure-ii:lassar'), cathedralTentacles: true, perfectTorch: true,
    });
    interactions.find((entry) => entry.name === 'The Whisperer').options['Talk-to']({
      player, npcId: core.NpcIdentifiers.THE_WHISPERER_3,
    });
    assert.equal(attrs.get('desert-treasure-ii:lassar').whispererStarted, true,
      'disturbing the Odd Figure persists the boss start so the encounter can resume after relog');
    assert.equal(attrs.get('desert-treasure-ii:lassar').cathedralEntered, true);
    const deviceState = { ...attrs.get('desert-treasure-ii:lassar'), inShadow: true, whiteKey: true, sanity: 100 };
    attrs.set('desert-treasure-ii:lassar', deviceState);
    counts.set(core.ItemIdentifiers.SHADOW_BLOCKER, 1);
    counts.set(core.ItemIdentifiers.ANIMA_PORTAL, 1);
    counts.set(core.ItemIdentifiers.REVITALISING_IDOL, 1);
    counts.set(core.ItemIdentifiers.SUPERIOR_SHADOW_TORCH, 1);
    assert.equal(itemOnObjectHooks[0]({ player, itemId: core.ItemIdentifiers.SHADOW_BLOCKER, objectId: 48228, location: { x: 2574, y: 6449, z: 0 } }), true);
    assert.equal(itemOnObjectHooks[0]({ player, itemId: core.ItemIdentifiers.ANIMA_PORTAL, objectId: 48228, location: { x: 2576, y: 6447, z: 0 } }), true);
    assert.equal(itemOnObjectHooks[0]({ player, itemId: core.ItemIdentifiers.REVITALISING_IDOL, objectId: 48228, location: { x: 2578, y: 6445, z: 0 } }), true);
    for (const [x, y] of [[2311, 6445], [2317, 6445], [2311, 6451], [2317, 6451]]) {
      assert.equal(interact({ player, objectId: 48253, definition: { id: 48253 }, location: { x, y, z: 0 }, option: 'Light' }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:lassar').braziersComplete, true, 'all four distinct cache braziers must light');
    assert.equal(interact({ player, objectId: 48232, definition: { id: 48232 }, location: { x: 2316, y: 6450, z: 0 }, option: 'Open' }), true);
    assert.equal(counts.get(core.ItemIdentifiers.PERFECTED_SHADOW_TORCH_SCHEMATIC_2), 1, 'the palace chest yields the marked false schematic only after the device puzzle');
    assert.equal(attrs.get('desert-treasure-ii:lassar').fakeSchematicFound, true);
    interactions.find((entry) => entry.name === 'Ketla').options['Talk-to']({ player, npcId: core.NpcIdentifiers.KETLA });
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-ketla-with-a-schematic-2');
    actionHooks[0]({ player, stepId: 'AYDmc1' });
    assert.equal(counts.get(core.ItemIdentifiers.PERFECTED_SHADOW_TORCH_SCHEMATIC_2), 0);
    assert.equal(attrs.get('desert-treasure-ii:lassar').silentChoir, true);
    attrs.set('desert-treasure-ii:lassar', { ...attrs.get('desert-treasure-ii:lassar'), blueKey: true, pubBlocker: true });
    counts.set(core.ItemIdentifiers.SHADOW_KEY_2, 1);
    assert.equal(interact({ player, objectId: 48278, definition: { id: 48278 }, location: { x: 2385, y: 6427, z: 0 }, option: 'Open' }), false,
      'the purple pub doors open only after the blocker and blue key, with the cache opening the real door');
    assert.equal(interact({ player, objectId: 48278, definition: { id: 48278 }, location: { x: 2372, y: 6430, z: 0 }, option: 'Climb-up' }), true);
    assert.equal(player.location.z, 1, 'the pub stairs use their real upper plane');
    assert.equal(interact({ player, objectId: 48245, definition: { id: 48245 }, location: { x: 2380, y: 6430, z: 1 }, option: 'Touch' }), true);
    assert.equal(transcripts.at(-1), 'the-whisperer-viewing-the-remnant-in-the-pub');
    itemActionHooks[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
    assert.equal(interact({ player, objectId: 48200, definition: { id: 48200 }, location: { x: 2665, y: 6418, z: 0 }, option: 'Enter' }), true);
    for (const [x, y, id] of [[2392, 6411, 48208], [2383, 6408, 48205]]) {
      assert.equal(interact({ player, objectId: id, definition: { id }, location: { x, y, z: 0 }, option: 'Burn' }), true);
    }
    assert.equal(attrs.get('desert-treasure-ii:lassar').redKeyFound, true, 'both residential barriers expose the red key');
    groundPickupHooks[0]({ player, groundItemId: core.ItemIdentifiers.SHADOW_KEY_4, location: { x: 2638, y: 6405, z: 0 } });
    counts.set(core.ItemIdentifiers.SHADOW_KEY_4, 1);
    counts.set(core.ItemIdentifiers.SHADOW_BLOCKER, 1);
    assert.equal(itemOnObjectHooks[0]({ player, itemId: core.ItemIdentifiers.SHADOW_BLOCKER, objectId: 48228, location: { x: 2649, y: 6406, z: 0 } }), true);
    assert.equal(interact({ player, objectId: 48232, definition: { id: 48232 }, location: { x: 2392, y: 6405, z: 0 }, option: 'Open' }), true);
    assert.equal(counts.get(core.ItemIdentifiers.ICON_SEGMENT), 1, 'the red-key chest gives the first icon half');
    assert.equal(interact({ player, objectId: 48205, definition: { id: 48205 }, location: { x: 2349, y: 6343, z: 0 }, option: 'Burn' }), true);
    assert.equal(interact({ player, objectId: 48232, definition: { id: 48232 }, location: { x: 2354, y: 6339, z: 0 }, option: 'Open' }), true);
    assert.equal(counts.get(core.ItemIdentifiers.ICON_SEGMENT_2), 1, 'the Science District chest gives the second icon half');
    assert.equal(itemOnItemHooks[0]({ player, usedItemId: core.ItemIdentifiers.ICON_SEGMENT, usedWithItemId: core.ItemIdentifiers.ICON_SEGMENT_2 }), true);
    assert.equal(counts.get(core.ItemIdentifiers.STRANGE_ICON), 1, 'the two halves combine into Prescott’s strange icon');
    interactions.find((entry) => entry.name === 'Ketla').options['Talk-to']({ player, npcId: core.NpcIdentifiers.KETLA });
    assert.equal(transcripts.at(-1), 'the-whisperer-talking-to-ketla-with-the-icon');
    assert.equal(interact({ player, objectId: 49488, definition: { id: 49488 }, location: { x: 2656, y: 6424, z: 0 }, option: 'Enter' }), true);
    assert.equal(player.location.x, 2784);
    assert.equal(interact({ player, objectId: 48301, definition: { id: 48301 }, location: { x: 2784, y: 6287, z: 1 }, option: 'Open' }), true);
    assert.equal(interact({ player, objectId: 48304, definition: { id: 48304 }, location: { x: 2806, y: 6303, z: 1 }, option: 'Climb-down' }), true);
    assert.equal(interact({ player, objectId: 47734, definition: { id: 47734 }, location: { x: 2784, y: 6304, z: 0 }, option: 'Inspect' }), true);
    assert.equal(transcripts.at(-1), 'the-whisperer-inspecting-the-totem-in-the-cistern');
    actionHooks[0]({ player, stepId: 'dUbk4i' });
    assert.equal(player.location.x, 3232, 'the vision action takes the player into the cistern water');
    actionHooks[0]({ player, stepId: '8nNqFG' });
    assert.equal(attrs.get('desert-treasure-ii:lassar').escapedVision, true);
    assert.equal(attrs.get('desert-treasure-ii:lassar').perfectTorchSchematic, true, 'Ketla supplies the real torch after the vision');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});

test('Desert Treasure II runs the Whisperer specials, enrage and medallion recovery', () => {
  const { api: base } = mockApi();
  const interactions = [], playerProcesses = [], itemActions = [], deathHooks = [], objectInteractions = [];
  const addQueue = [], removeQueue = [], created = [];
  const core = {
    ...base.core,
    NPC: { create: (id, location) => {
      const npc = {
        id, location, hp: 660, maxHp: 660, registered: true,
        getId() { return this.id; }, getOwner() { return this.owner; }, setOwner(owner) { this.owner = owner; }, setOwnerOnly() {},
        setScriptedMovement() {}, setMaxHitpoints(hp) { this.maxHp = hp; }, setHitpoints(hp) { this.hp = hp; },
        getHitpoints() { return this.hp; }, getMaxHitpoints() { return this.maxHp; },
        isRegistered() { return this.registered; }, forceChat(text) { this.chat = text; },
        getCombat() { return { getLastAttack: () => ({ reset() {} }) }; },
      };
      created.push(npc);
      return npc;
    } },
    World: { getAddNPCQueue: () => addQueue, getRemoveNPCQueue: () => removeQueue },
  };
  const api = new Proxy(base, { get: (target, prop) => prop === 'core' ? core
    : prop === 'onNpcInteraction' ? (name, opts) => interactions.push({ name, opts })
      : prop === 'onPlayerProcess' ? (handler) => playerProcesses.push(handler)
        : prop === 'onItemAction' ? (handler) => itemActions.push(handler)
          : prop === 'onNpcDeath' ? (handler) => deathHooks.push(handler)
          : prop === 'onObjectInteraction' ? (handler) => typeof handler === 'function' && objectInteractions.push(handler)
            : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop] });
  const runtime = require('../plugins/quests/QuestRuntime');
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = runtime.getRegisteredQuests().at(-1);
  const attrs = new Map([['desert-treasure-ii:lassar', {
    entered: true, cathedralTentacles: true, perfectTorch: true, sanity: 100, inShadow: false,
  }]]);
  const items = new Map([[core.ItemIdentifiers.BLACKSTONE_FRAGMENT, 1]]);
  let username = 'whisperer-regression';
  const player = {
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => username, getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getPacketSender: () => new Proxy({}, { get: (_target, key) => key === 'sendVarbit' ? () => {} : () => {} }),
    getInventory: () => ({
      getAmount: (id) => items.get(id) ?? 0,
      adds: (id, amount = 1) => items.set(id, (items.get(id) ?? 0) + amount),
      deleteNumber: (id, amount = 1) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
    }),
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage() {} }) }),
    location: { x: 2656, y: 6370, z: 0 }, getLocation() { return this.location; }, moveTo(location) { this.location = location; },
    sendMessage() {},
  };
  quest.setStage(player, 10);
  interactions.find((entry) => entry.name === 'Odd Figure').opts.Disturb({ player, npcId: core.NpcIdentifiers.ODD_FIGURE });
  const boss = created.find((npc) => npc.id === core.NpcIdentifiers.THE_WHISPERER_3);
  assert.ok(boss, 'disturbing the figure creates the quest Whisperer');
  assert.equal(attrs.get('desert-treasure-ii:lassar').whispererStarted, true, 'the fight start survives logout');
  boss.hp = 440;
  playerProcesses.forEach((handler) => handler({ player }));
  assert.equal(boss.__dt2WhispererSpecial, 'soul-siphon', 'the first special starts at one-third health');
  assert.equal(created.filter((npc) => npc.__dt2WhispererSoul).length, 12);
  itemActions[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
  assert.equal(attrs.get('desert-treasure-ii:lassar').inShadow, true, 'the fragment reaches the shadow realm for the special');
  const firstChant = created.filter((npc) => npc.__dt2WhispererSoul && npc.__dt2WhispererSoulSet === 0);
  for (const soul of firstChant) {
    soul.registered = false;
    deathHooks[0]({ npc: soul, killer: player });
  }
  assert.equal(boss.__dt2WhispererSpecial, null, 'killing one full matching chant set interrupts the siphon');
  itemActions[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
  username = 'c';
  boss.__dt2WhispererSpecialStarted = false;
  playerProcesses.forEach((handler) => handler({ player }));
  assert.equal(boss.__dt2WhispererSpecial, 'corrupted-seeds');
  assert.equal(boss.__dt2WhispererSeeds.length, 6, 'the seed special creates light and dark seed tiles');
  itemActions[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
  for (const seed of boss.__dt2WhispererSeeds.filter((entry) => entry.light)) {
    player.location = { x: seed.x, y: seed.y, z: 0 };
    playerProcesses.forEach((handler) => handler({ player }));
  }
  assert.equal(boss.__dt2WhispererSpecial, null, 'stepping on every light seed interrupts the seed special');
  itemActions[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
  username = 'd';
  boss.__dt2WhispererSpecialStarted = false;
  playerProcesses.forEach((handler) => handler({ player }));
  assert.equal(boss.__dt2WhispererSpecial, 'screech');
  assert.equal(boss.__dt2WhispererColumns.length, 3, 'the screech special creates three cover columns');
  itemActions[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
  for (const column of boss.__dt2WhispererColumns) {
    player.location = { x: column.x, y: column.y, z: 0 };
    for (let tick = 0; tick < 5; tick++) playerProcesses.forEach((handler) => handler({ player }));
  }
  assert.equal(boss.__dt2WhispererSpecial, null, 'standing by each remaining column survives all three screeches');

  itemActions[0]({ player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT, option: 'Activate' });
  assert.equal(attrs.get('desert-treasure-ii:lassar').inShadow, false, 'the fragment returns the player to the material world');
  boss.registered = false;
  deathHooks[0]({ npc: boss, killer: player });
  assert.equal(attrs.get('desert-treasure-ii:lassar').whispererEnraged, true, 'the first defeat starts her 100-hitpoint enrage');
  assert.equal(player.location.x, 2404, 'the enrage pulls the player back into the Shadow Realm');
  playerProcesses.forEach((handler) => handler({ player }));
  const enraged = created.filter((npc) => npc.__dt2Whisperer).at(-1);
  assert.equal(enraged.maxHp, 100);
  assert.equal(enraged.__dt2WhispererEnraged, true);
  enraged.registered = false;
  deathHooks[0]({ npc: enraged, killer: player });
  assert.equal(attrs.get('desert-treasure-ii:lassar').whispererDefeated, true, 'the second defeat opens the remains search');
  objectInteractions[0]({ player, objectId: 47578, definition: { id: 47578 }, option: 'Search', location: { x: 2400, y: 6370, z: 0 } });
  assert.equal(items.get(core.ItemIdentifiers.WHISPERERS_MEDALLION), 1, 'the remains yield the actual medallion');
  assert.equal(attrs.get('desert-treasure-ii:lassar').medallion, true);
  objectInteractions[0]({ player, objectId: 48310, definition: { id: 48310 }, option: 'Climb', location: { x: 2400, y: 6370, z: 0 } });
  assert.deepEqual([player.location.x, player.location.y], [2587, 6436], 'the cathedral exit returns to Camdozaal');
});

test('Dragon Slayer II Ungael notes require all six real pieces before combining', () => {
  const handlers = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemOnItem' ? (handler) => handlers.push(handler) : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { ItemIdentifiers: I } = api.core;
  const notes = [I.OLD_NOTES, I.OLD_NOTES_2, I.OLD_NOTES_3, I.OLD_NOTES_4, I.OLD_NOTES_5, I.OLD_NOTES_6];
  const counts = new Map(notes.slice(0, 5).map((id) => [id, 1]));
  const player = {
    getInventory: () => ({
      getAmount: (id) => counts.get(id) ?? 0,
      getFreeSlots: () => 28 - [...counts.values()].reduce((sum, amount) => sum + amount, 0),
      deleteNumber: (id, amount) => counts.set(id, Math.max(0, (counts.get(id) ?? 0) - amount)),
      adds: (id, amount) => counts.set(id, (counts.get(id) ?? 0) + amount),
    }),
    sendMessage: () => {},
  };
  assert.equal(handlers[0]({ player, usedItemId: notes[0], usedWithItemId: notes[1] }), true);
  assert.equal(counts.get(notes[0]), 1, 'incomplete notes are not consumed');
  counts.set(notes[5], 1);
  assert.equal(handlers[0]({ player, usedItemId: notes[0], usedWithItemId: notes[1] }), true);
  assert.ok(notes.every((id) => counts.get(id) === 0));
  assert.equal(counts.get(I.UNGAEL_LAB_NOTES), 1);
});

test('Dragon Slayer II rowboat build consumes the Wiki supplies and uses the ready dialogue to travel', () => {
  const objects = new Map();
  const objectHandlers = [];
  const playerProcesses = [];
  const custom = new Map();
  const { api: base } = mockApi();
  const objectManager = base.core.ObjectManager;
  const register = objectManager.register;
  const deregister = objectManager.deregister;
  objectManager.register = () => {};
  objectManager.deregister = () => {};
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onObjectInteraction') return (handler, actions) => {
        if (typeof handler === 'function') objectHandlers.push(handler);
        else if (typeof handler === 'string' && actions) objects.set(handler, actions);
      };
      if (prop === 'onPlayerProcess') return (handler) => playerProcesses.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    objectManager.register = register;
    objectManager.deregister = deregister;
  }
  const { ItemIdentifiers: I, ObjectIdentifiers: O } = api.core;
  const attributes = new Map([['quest.dragon_slayer_ii.stage', 6]]);
  const amounts = new Map([[I.HAMMER, 1], [I.SAW, 1], [I.OAK_PLANK, 8], [I.SWAMP_PASTE, 10], [I.STEEL_NAILS, 7], [I.IRON_NAILS, 5], [I.DRAGON_KEY, 1]]);
  const messages = [];
  const sentVarbits = [];
  let destination;
  let playerLocation = { x: 3661, y: 3847, z: 0 };
  const packet = new Proxy({ sendVarbit: (id, value) => sentVarbits.push([id, value]) }, { get: (target, key) => target[key] ?? (() => packet) });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getMaxLevel: () => 50 }),
    getLocation: () => ({ getX: () => playerLocation.x, getY: () => playerLocation.y, getZ: () => playerLocation.z }),
    getPacketSender: () => packet,
    getInventory: () => ({
      getAmount: (id) => amounts.get(id) ?? 0,
      deleteNumber: (id, count) => amounts.set(id, (amounts.get(id) ?? 0) - count),
    }),
    sendMessage: (message) => messages.push(message),
    moveTo: (location) => { destination = [location.getX(), location.getY(), location.getZ()]; playerLocation = { x: destination[0], y: destination[1], z: destination[2] }; },
  };
  const buildEvent = {
    player, objectId: O.ROWBOAT_SPACE, clickType: 1,
    definition: { getInteractions: () => ['Build'] },
    location: { x: 3661, y: 3847, z: 0 },
  };
  assert.equal(objectHandlers[0](buildEvent), true);
  assert.equal(attributes.get('dragon-slayer-ii:lithkren-rowboat-built'), true);
  assert.deepEqual(sentVarbits, [[6104, 60]], 'the cache boat NPC transforms become interactive after building');
  assert.deepEqual([I.OAK_PLANK, I.SWAMP_PASTE, I.STEEL_NAILS, I.IRON_NAILS].map((id) => amounts.get(id)), [0, 0, 0, 0]);
  assert.equal(objectHandlers[0]({
    player, objectId: O.ROWBOAT_SPACE, clickType: 1,
    definition: { getInteractions: () => ['Build'] },
    location: { x: 3661, y: 3847, z: 0 },
  }), true);
  assert.deepEqual(destination, [3559, 4004, 0]);
  destination = undefined;
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: 'wKz-eF' });
  assert.deepEqual(destination, [3559, 4004, 0]);
  assert.deepEqual(sentVarbits, [[6104, 60], [6104, 70]], 'boarding updates the native Lithkren quest milestone');
  assert.equal(attributes.get('dragon-slayer-ii:lithkren-arrived'), true);
  playerLocation = { x: 3549, y: 10448, z: 0 };
  for (const handler of playerProcesses) handler({ player });
  assert.equal(sentVarbits.at(-1)[1], 75, 'entering the underground hallway reveals the canonical Dallas and vault door transforms');
  assert.equal(objectHandlers[0]({
    player, objectId: O.BROKEN_DOORS, clickType: 1,
    definition: { getInteractions: () => ['Enter'] },
    location: { x: 3547, y: 10482, z: 0 },
  }), true, 'the deep-lab entrance cannot bypass the diary and dragon-key steps');
  assert.match(messages.at(-1), /completed dragon key/);
  assert.deepEqual(destination, [3559, 4004, 0], 'a premature Enter leaves the player in the key-vault corridor');
  for (const handler of custom.get('ladders:climb')) {
    const climb = { player, objectId: O.STAIRCASE_169,
      object: { getLocation: () => ({ getX: () => 3549, getY: () => 10469, getZ: () => 0 }) }, handled: false };
    handler(climb);
    assert.equal(climb.handled, true, 'the unpaired cache staircase is handled by the quest route');
  }
  assert.deepEqual(destination, [3549, 10419, 0], 'the northern stair route reaches Dallas and Aivas’ skeleton');
  attributes.set('quest.dragon_slayer_ii.stage', 8);
  assert.equal(objectHandlers[0]({
    player, objectId: O.ANCIENT_DOORS, location: { x: 3550, y: 10425, z: 0 },
  }), true);
  assert.equal(amounts.get(I.DRAGON_KEY), 0);
  assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 11);
  assert.ok(messages.includes('You successfully build the boat.'));
});

test('Desert Treasure II shadow spells interrupt the private Leviathan encounter', () => {
  const { api: base } = mockApi();
  const custom = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onCustomEvent'
      ? (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler])
      : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const messages = [];
  const attacker = { isPlayer: () => true, sendMessage: (message) => messages.push(message) };
  const target = { __dt2Leviathan: true, getOwner: () => attacker };
  custom.get('magic:hit-effects').at(-1)({ attacker, target, spell: { getName: () => 'Shadow Barrage' } });
  assert.ok(target.__dt2LeviathanStunnedUntil > api.core.World.getProcessCycle());
  assert.match(messages[0], /stuns the Leviathan/);
});

test('Desert Treasure II prison escape leads to the cache Duke arena and requires two real poisons', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const { api: base } = mockApi();
  const objects = [], itemItems = [], itemObjects = [], itemNpcs = [], itemActions = [], deaths = [], groundPickups = [];
  const queues = { add: [], remove: [] };
  let cycle = 0, hasPillarCover = true;
  const pendingHits = [];
  class TestArea {
    constructor(width, height) { this.width = width; this.height = height; this.entities = []; }
    setChunk() {}
    enter() {}
    leave() {}
    postLeave() {}
    getBaseX() { return 5000; }
    getBaseY() { return 6000; }
    tile(x, y, z) { return { x: 5000 + x, y: 6000 + y, z, getX() { return this.x; }, getY() { return this.y; }, getZ() { return this.z; } }; }
    add(npc) { this.entities.push(npc); }
    isDestroyed() { return false; }
    destroy() {}
  }
  const core = {
    ...base.core,
    TemplatedInstanceArea: TestArea,
    RegionManager: { canProjectileAttackBounds: () => !hasPillarCover },
    NPC: { create: (id, location) => ({
      id, location, owner: null, hp: 500,
      setOwner(value) { this.owner = value; }, getOwner() { return this.owner; }, setOwnerOnly() {},
      setScriptedMovement() {}, setMaxHitpoints(value) { this.hp = value; }, setHitpoints(value) { this.hp = value; },
      getHitpoints() { return this.hp; }, getLocation() { return this.location; }, getSize() { return 7; }, forceChat() {},
      getCombat() { return { getLastAttack: () => ({ reset() {} }) }; },
      isRegistered() { return true; }, isNpc() { return true; }, getAsNpc() { return this; },
    }) },
    World: { getAddNPCQueue: () => queues.add, getRemoveNPCQueue: () => queues.remove, getProcessCycle: () => cycle++ },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (handler) => objects.push(handler)
        : prop === 'onItemOnItem' ? (handler) => itemItems.push(handler)
          : prop === 'onItemOnObject' ? (handler) => itemObjects.push(handler)
            : prop === 'onItemOnNpc' ? (handler) => itemNpcs.push(handler)
                : prop === 'onGroundItemPickup' ? (handler) => groundPickups.push(handler)
              : prop === 'onNpcDeath' ? (handler) => deaths.push(handler)
                : prop === 'onItemAction' ? (handler) => itemActions.push(handler)
                : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = runtime.getRegisteredQuests().at(-1);
  const attrs = new Map(), inventory = new Map(), messages = [];
  const player = {
    isPlayer: () => true, getAsPlayer() { return this; }, getUsername: () => 'dt2-sucellus-test',
    getAttribute: (key) => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    moveTo(location) { this.location = location; }, getLocation() { return this.location; }, sendMessage: (message) => messages.push(message),
    getDialogueManager: () => ({ reset() {}, startDialogues() {} }),
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pendingHits.push(...hits) }) }),
    getSize: () => 1,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getInventory: () => ({ getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)) }),
  };
  const I = core.ItemIdentifiers, O = core.ObjectIdentifiers;
  const sourceLocation = (x, y, z = 0) => ({ x: 5000 + x - 2872, y: 6000 + y - 6336, z });
  const interactObject = (id, x, y, option = 'Search') => objects.at(-1)({ player, objectId: id, option, location: sourceLocation(x, y) });
  quest.setStage(player, 9);
  assert.equal(objects.at(-1)({ player, objectId: 49513, location: { x: 2926, y: 10354, z: 0 } }), true, 'enter through the prison entrance');
  assert.equal(attrs.get('desert-treasure-ii:sucellus-area') instanceof TestArea, true);
  const area = attrs.get('desert-treasure-ii:sucellus-area');
  player.moveTo(area.tile(40, 12, 2));
  area.process(player);
  assert.equal(attrs.get('desert-treasure-ii:sucellus-cell-entered'), true, 'the prison guard knocks the player out at the cell passage');
  assert.deepEqual([player.location.x, player.location.y, player.location.z], [sourceLocation(3040, 6370).x, sourceLocation(3040, 6370).y, 0]);
  interactObject(49099, 3040, 6370, 'Inspect');
  interactObject(49094, 3042, 6369);
  assert.equal(inventory.get(I.PRISONERS_LETTER), 1);
  itemActions.at(-1)({ player, itemId: I.PRISONERS_LETTER, option: 'Read' });
  interactObject(49095, 3039, 6367);
  assert.equal(inventory.get(I.KNIFE_5), 1);
  itemObjects.at(-1)({ player, itemId: I.KNIFE_5, objectId: 49099, location: sourceLocation(3040, 6370) });
  assert.equal(inventory.get(I.KNIFE_5), 0);
  assert.equal(inventory.get(I.CHISEL_5), 1);
  interactObject(49514, 3041, 6367);
  assert.equal(inventory.get(I.LOCKPICK_4), 1);
  itemObjects.at(-1)({ player, itemId: I.LOCKPICK_4, objectId: 49099, location: sourceLocation(3040, 6370) });
  assert.equal(attrs.get('desert-treasure-ii:sucellus-cell-escaped'), true);
  assert.equal(area.entities.some((npc) => npc.id === core.NpcIdentifiers.ASSASSIN_7), true, 'the cell guard is present after the escape');
  objects.at(-1)({ player, objectId: 49120, option: 'Pick-lock', location: sourceLocation(2945, 6389, 2) });
  assert.equal(attrs.get('desert-treasure-ii:sucellus-assassin-gone'), true);
  assert.equal(objects.at(-1)({ player, objectId: 49138, location: sourceLocation(3039, 6433) }), false, 'the asylum gate leads from the real prison into Duke’s chamber');
  const boss = attrs.get('desert-treasure-ii:boss');
  assert.equal(boss.__dt2SucellusAwake, false);
  assert.equal(boss.hp, 440, 'the quest Duke uses the documented normal 440 hitpoints');
  interactObject(O.PESTLE_AND_MORTAR_2, 3034, 6434);
  interactObject(O.PICKAXE_3, 3044, 6434);
  for (let i = 0; i < 3; i++) interactObject(O.MUSCA_MUSHROOMS_2, 3048, 6453);
  for (let i = 0; i < 3; i++) interactObject(O.ARDER_MUSHROOMS_2, 3030, 6453);
  for (let i = 0; i < 12; i++) interactObject(O.SALT_DEPOSIT_2, 3033, 6448, 'Mine');
  for (const id of [I.MUSCA_MUSHROOM, I.MUSCA_MUSHROOM, I.MUSCA_MUSHROOM, I.ARDER_MUSHROOM, I.ARDER_MUSHROOM, I.ARDER_MUSHROOM]) {
    itemItems.at(-1)({ player, usedItemId: I.PESTLE_AND_MORTAR, usedWithItemId: id });
  }
  assert.equal(inventory.get(I.MUSCA_POWDER), 3);
  assert.equal(inventory.get(I.ARDER_POWDER), 3);
  for (const [vat, x] of [[47537, 3034], [47537, 3043]]) {
    for (const powder of [I.MUSCA_POWDER, I.ARDER_POWDER]) {
      itemObjects.at(-1)({ player, itemId: powder, objectId: vat, location: sourceLocation(x, 6438) });
    }
    for (let i = 0; i < 6; i++) itemObjects.at(-1)({ player, itemId: I.SALAX_SALT, objectId: vat, location: sourceLocation(x, 6438) });
    interactObject(vat, x, 6438, 'Empty');
  }
  assert.equal(inventory.get(I.ARDER_MUSCA_POISON), 2);
  itemNpcs.at(-1)({ player, npc: boss, itemId: I.ARDER_MUSCA_POISON });
  assert.equal(boss.__dt2SucellusAwake, false);
  itemNpcs.at(-1)({ player, npc: boss, itemId: I.ARDER_MUSCA_POISON });
  assert.equal(boss.__dt2SucellusAwake, true);
  assert.equal(inventory.get(I.ARDER_MUSCA_POISON), 0);
  player.moveTo(area.tile(167, 97, 0));
  for (let i = 0; i < 31; i++) area.process(player);
  assert.ok(messages.some((message) => message.includes('turns his gaze upon you')));
  assert.ok(messages.some((message) => message.includes('avoid Duke Sucellus')));
  assert.equal(pendingHits.length, 0, 'the cached pillar collision protects against the freezing gaze');
  hasPillarCover = false;
  for (let i = 0; i < 30; i++) area.process(player);
  assert.equal(pendingHits.length, 1, 'the exposed freezing gaze queues its real hit');
  assert.ok(pendingHits[0].getDamage() > 0 && pendingHits[0].getDamage() <= 101);
  deaths.at(-1)({ killer: player, npc: boss });
  groundPickups.at(-1)({ player, groundItemId: I.ODD_KEY, location: sourceLocation(3039, 6454) });
  inventory.set(I.ODD_KEY, 1);
  interactObject(49140, 3023, 6425, 'Open');
  interactObject(49116, 3021, 6420, 'Open');
  assert.equal(inventory.get(I.SUCELLUS_MEDALLION), 1);
  assert.equal(quest.getStage(player), 10);
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

test('Surok requires real combat spells and the opposite element for surges', () => {
  const { api } = mockApi(), module = require('../plugins/quests/wgs/Surok.WhileGuthixSleeps');
  const f = module({api}), player = { getCombat: () => ({ getSelectedSpell: () => selected, getCastSpell: () => null, getPreviousCast: () => api.core.CombatSpells.FIRE_WAVE }), sendMessage() {} };
  let selected = null, launched = null, damage = 20;
  const boss = { forceChat() {} }, surge = {getHitpoints:()=>16};
  f.fights.set(player,{boss,enemies:new Set([boss,surge])});
  const hit = {getAttacker:()=>player,getSpell:()=>launched,getCombatType:()=>api.core.CombatType.MAGIC,setTotalDamage:n=>damage=n};
  f.hit({npc:boss,hit});assert.equal(damage,0,'powered staff is blocked even after a previous standard cast');
  launched=api.core.CombatSpells.TRIDENT_OF_THE_SEAS;damage=20;f.hit({npc:boss,hit});assert.equal(damage,0,'the powered spell object is blocked too');
  launched=api.core.CombatSpells.FIRE_WAVE;selected=null;damage=20;f.hit({npc:boss,hit});assert.equal(damage,20);
  f.targets.set(surge,{surge:true,index:0});damage=20;f.hit({npc:surge,hit});assert.equal(damage,0,'fire cannot counter earth');
  launched=api.core.CombatSpells.WIND_WAVE;selected=api.core.CombatSpells.FIRE_WAVE;damage=20;f.hit({npc:surge,hit});assert.equal(damage,16);
  launched=api.core.CombatSpells.WIND_STRIKE;damage=0;f.hit({npc:surge,hit});assert.equal(damage,16,'even a zero-damage opposing strike dispels the spell');
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


test('Astral Contact and its former name use one astral, one cosmic and two air runes', () => {
 const {Spell}=PluginManager.getCoreApi(),{LunarSpells}=require('../dist/game/content/combat/magic/LunarSpells');
 const original=Spell.prototype.canCast,emit=PluginManager.emitCustomEvent;let costs,chain,xp=0;
 const player={getSkillManager:()=>({getMaxLevel:()=>99,addExperiences:(s,n)=>xp+=n}),performAnimation(){},performGraphic(){},getDialogueManager:()=>({startDialogues:c=>chain=c})};
 try {
  Spell.prototype.canCast=function(){costs=this.itemsRequired().map(i=>[i.getId(),i.getAmount()]);return true;};PluginManager.emitCustomEvent=()=>{};
  for(const name of ['Astral Contact','NPC Contact']){
   assert.equal(LunarSpells.handleSelf(player,name),true);assert.deepEqual(costs,[[9075,1],[564,1],[556,2]]);assert.ok(chain);
  }
  assert.equal(xp,126);
 }finally{Spell.prototype.canCast=original;PluginManager.emitCustomEvent=emit;}
});


test('WGS super truth serum starts the captive conversation only for its owner at stage 300', () => {
 const {api,player,removed}=movarioFixture(), handlers=[],played=[];
 let progress=300,carrying=true;
 api.onItemOnNpc=h=>handlers.push(h);
 player.getLocation=()=>new api.core.Location(2987,3343,0);
 require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')({...api.context,stage:()=>progress,held:()=>carrying,play:(p,id,v)=>played.push([id,v])});
 const target={getId:()=>13546,getOwner:()=>player},handler=handlers.at(-1);
 const attempt=(itemId=29531,npc=target)=>{const e={player,itemId,target:npc};handler(e);return e;};
 assert.equal(attempt().handled,true);
 assert.match(played.at(-1)[1],/using-the-serum-talking-to-the-shady-stranger-while-inside/);
 assert.deepEqual(removed,[], 'the dialogue acceptance consumes the serum');
 assert.equal(attempt(29532).handled,undefined);
 assert.equal(attempt(29531,{getId:()=>13546,getOwner:()=>({})}).handled,undefined);
 assert.equal(attempt(29531,{getId:()=>13545,getOwner:()=>player}).handled,undefined);
 progress=310;assert.equal(attempt().handled,undefined);
 progress=300;carrying=false;assert.equal(attempt().handled,undefined);
 assert.equal(played.length,1);
});

test('WGS NPC Contact recruits only the first four heroes; Guild heroes require a visit', () => {
 const {api,handlers,player}=movarioFixture();let progress=280;const played=[];
 require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')({...api.context,stage:()=>progress,play:(p,id,v)=>played.push(v)});
 const e={player,contacts:[]};handlers.custom.get('magic:npc-contact')(e);
 assert.deepEqual(e.contacts,['Turael','Mazchna','Duradel','Cyrisus']);
 let selected={player,name:'Ghommal'};handlers.custom.get('magic:npc-contact-selected')(selected);
 assert.equal(selected.handled,undefined);
 progress=320;const second={player,contacts:[]};handlers.custom.get('magic:npc-contact')(second);
 assert.deepEqual(second.contacts,[]);
 selected={player,name:'Ghommal'};handlers.custom.get('magic:npc-contact-selected')(selected);
 assert.equal(selected.handled,undefined);assert.deepEqual(played,[]);
});


test('WGS delayed sketches consume their materials and lost sketches are reclaimed without a prose menu', () => {
 const {api,handlers,player,attributes,removed}=movarioFixture();const items=new Set([970,973]);let given=0;
 player.getInventory=()=>({deleteNumber:(id,n)=>{items.delete(id);removed.push([id,n]);},adds:id=>items.add(id)});
 require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')({...api.context,stage:()=>310,held:(p,id)=>items.has(id),give:(p,id)=>{items.add(id);given++;}});
 handlers.custom.get('npc-dialogue:action')({player,stepId:'SqlKov'});
 assert.deepEqual(removed,[[970,1],[973,1]]);assert(items.has(29533));
 assert.equal(attributes.get('while-guthix-sleeps:spy-sketched'),1);
 handlers.custom.get('npc-dialogue:action')({player,stepId:'IcllDi'});assert.equal(given,0);
 items.delete(29533);handlers.custom.get('npc-dialogue:action')({player,stepId:'IcllDi'});assert.equal(given,1);
 const data=require('../data/definitions/npc-dialogues.json')['While Guthix Sleeps'].variants;
 const steps=data['forming-a-fellowship-using-the-serum-talking-to-the-shady-stranger-while-inside-the-cell-with-the-serum-talking-to-the-shady-stranger-again-after-sketching-the-suspect'];
 assert(!steps.some(s=>s.type==='choice'));assert(steps.some(s=>s.type==='condition'&&s.id==='wgs-sketch-lost'));
});


test('WGS physical recruitment uses the visible definition of a transformed Guild NPC', () => {
 const {api,player,handlers}=movarioFixture();const hooks=new Map(),played=[];
 api.onNpcInteraction=(name,actions)=>hooks.set(name,actions);
 require('../plugins/quests/wgs/Fellowship.WhileGuthixSleeps')({...api.context,stage:()=>320,play:(p,id,v)=>played.push([id,v])});
 const npc={getDefinition:()=>({getName:()=> 'null'})};
 assert.equal(hooks.get('Ghommal')['Talk-to']({player,npc,definition:{getName:()=> 'Ghommal'}}),true);
 assert.equal(played[0][0],13613);assert.match(played[0][1],/second-recruitment-talking-to-ghommal/);
});


test('Elite knights show adapting prayers, spend prayer on attacks and apply seven flat armour outside magic', () => {
 const {api}=mockApi();let area,modify,killed;api.registerArea=a=>area=a;api.onNpcHitModify=h=>modify=h;api.onNpcDeath=h=>killed=h;
 require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({api,ATTRIBUTES:[],stage:()=>490});
 let icon;const npc={getId:()=>13463,getArea:()=>area,setHeadIcon:v=>icon=v,isNpc:()=>true};
 const p={isPlayer:()=>true,sendMessage(){}};
 function hit(type){let damage=20;const splat={getDamage:()=>damage,setDamage:d=>damage=d};modify({npc,hit:{getAttacker:()=>p,getCombatType:()=>type,getCombatMethod:()=>({attackSpeed:()=>4}),setTotalDamage:d=>damage=d,getHits:()=>[splat],updateTotalDamage(){}}});return damage;}
 const {CombatType}=api.core;
 assert.equal(hit(CombatType.MELEE),0);assert.equal(icon,0);
 for(let i=0;i<100;i++)area.process(npc);assert.equal(hit(CombatType.MELEE),0,'waiting does not drain the knight’s prayer');
 assert.equal(hit(CombatType.RANGED),13);assert.equal(icon,1);
 assert.equal(hit(CombatType.MAGIC),20);assert.equal(icon,2);
 for(let i=0;i<23;i++)hit(i%2?CombatType.MAGIC:CombatType.RANGED);
 assert.equal(icon,-1);assert.equal(hit(CombatType.RANGED),13);
 killed({npc,killer:null});assert.equal(hit(CombatType.RANGED),0, 'respawn restores the knight’s prayer');
});


test('WGS fortress door crosses north when routing places the player on the door tile', () => {
 const {api,handlers,player}=movarioFixture();
 require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,stage:()=>400});
 player.getEquipment=()=>({contains:()=>true});
 const open=handlers.objects.find(h=>h.name==='Sturdy door').options.Open;
 const object={getLocation:()=>new api.core.Location(3016,3514,0)};
 for(const y of[3513,3514,3515]){
  player.getLocation=()=>new api.core.Location(3016,y,0);
  assert.equal(open({player,object,objectId:2337}),true);
  assert.deepEqual(player.position,[3016,y<=3514?3515:3513,0]);
 }
});


test('WGS catacomb crossings bind the native Jump-to and Jump-down options', () => {
 const {api,handlers,player}=movarioFixture();
 require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,stage:()=>490});
 const bridge=handlers.objects.find(h=>h.name==='Bridge').options['Jump-to'];
 assert.equal(bridge({player,objectId:53512}),true);assert.deepEqual(player.position,[4112,4703,1]);
 assert.equal(bridge({player,objectId:53511}),true);assert.deepEqual(player.position,[4112,4696,1]);
 const wall=handlers.objects.find(h=>h.name==='Wall').options['Jump-down'];
 assert.equal(wall({player,objectId:53514}),true);assert.deepEqual(player.position,[4133,4724,1]);
});


test('WGS spawns jailed Silif only for the player’s rescue stage and transforms his earned disguise', () => {
 const {api,player,attributes}=movarioFixture();let progress=480,mapChange,login,logout;const spawned=[],removed=[];
 const sender={sendVarbit:(id,n)=>{player.varbits.set(id,n);return sender;}};player.getPacketSender=()=>sender;
 player.getLocation=()=>new api.core.Location(4133,4791,2);
 api.onPlayerMapSquareChange=h=>mapChange=h;api.onPlayerLogin=h=>login=h;api.onPlayerLogout=h=>logout=h;
 api.spawnNpc=args=>{const n={args,setNpcTransformationId:id=>n.transformed=id};spawned.push(n);return n;};api.removeNpc=n=>removed.push(n);
 require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,stage:()=>progress});
 login({player});assert.equal(spawned.length,0);
 progress=520;mapChange({player});assert.equal(spawned.length,1);assert.equal(spawned[0].args.id,13524);assert.equal(spawned[0].args.owner,player);
 attributes.set('while-guthix-sleeps:silif-armour',1);progress=550;mapChange({player});assert.equal(spawned[0].transformed,13521);
 progress=560;mapChange({player});assert.deepEqual(removed,[spawned[0]]);assert.equal(spawned[1].args.id,13521);assert.equal(spawned[1].args.z,2);logout({player});login({player});assert.equal(spawned[2].args.id,13521);assert.equal(spawned[2].args.owner,player);
 const spawns=require('../data/definitions/npc-spawns.json');assert(!spawns.some(n=>n.id===13524&&n.x===4135&&n.y===4790));
});


test('Completed WGS retains the unlocked catacomb route without replaying quest progress', () => {
 const {api,handlers,player,attributes}=movarioFixture();let login;
 const sender={sendVarbit:(id,n)=>{player.varbits.set(id,n);return sender;}};player.getPacketSender=()=>sender;
 player.getLocation=()=>new api.core.Location(3016,3515,0);api.onPlayerLogin=h=>login=h;
 attributes.set('while-guthix-sleeps:catacomb-open',1);
 require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,stage:()=>900,advance:(p,n)=>assert(n<=900)});
 login({player});assert.equal(player.varbits.get(10803),2);
 const enter=handlers.objects.find(h=>h.name==='Trapdoor').options['Climb-down'];
 assert.equal(enter({player,objectId:53350}),true);assert.deepEqual(player.position,[4105,4675,1]);
 const bridge=handlers.objects.find(h=>h.name==='Bridge').options['Jump-to'];
 assert.equal(bridge({player,objectId:53512}),true);assert.deepEqual(player.position,[4112,4703,1]);
});


test('Rescued Silif acknowledges the rescue before quest completion', () => {
 const {api}=mockApi();let interaction,played;
 api.onNpcInteraction=(name,options)=>{if(name==='Silif')interaction=options['Talk-to'];};
 const player={getLocation:()=>new api.core.Location(2989,3338,0)};
 require('../plugins/quests/wgs/Alliance.WhileGuthixSleeps')({api,stage:()=>610,play:(p,id,variant)=>played=variant});
 assert.equal(interaction({player,npcId:13519}),true);
 assert.equal(played,'the-dark-squall-talking-to-silif-after-rescuing-him');
});


test('Silif’s unlocked cell visibly opens and leaves a walkable exit', () => {
 const {api,handlers,player}=movarioFixture(),changed=[];let progress=490;
 api.core={...api.core,ObjectManager:{deregister:(o)=>changed.push(['remove',o.getId()]),register:o=>changed.push(['add',o.getId(),o.getLocation().getX(),o.getLocation().getY(),o.getFace()])}};
 require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,stage:()=>progress,advance:(p,n)=>progress=Math.max(progress,n)});
 const open=handlers.objects.find(h=>h.name==='Gate').options.Open;
 const object=new api.core.GameObject(53443,new api.core.Location(4132,4791,2),0,0,null);
 assert.equal(open({player,objectId:53443,object}),true);assert.equal(progress,520);
 assert.deepEqual(changed,[['remove',53443],['add',53444,4131,4791,1]]);
 assert.equal(player.position,null,'opening the gate leaves movement to the player');
});


test('Surok claims his ladder before the generic climb fallback', () => {
 const {api,handlers}=mockApi();let played;
 const player={};
 const f=require('../plugins/quests/wgs/Surok.WhileGuthixSleeps')({api,stage:()=>580,play:(p,id,variant)=>played=variant});
 const event={player,objectId:53370,handled:false};handlers.custom.get('ladders:climb')[0](event);
 assert.equal(event.handled,true);assert(f.climbing.has(player));assert.equal(played,'the-dark-squall-talking-to-the-elite-black-knight-by-the-ladder');
 const unrelated={player,objectId:25843,handled:false};handlers.custom.get('ladders:climb')[0](unrelated);assert.equal(unrelated.handled,false);
});


test('Picking up Surok’s lit explosive detonates it instead of giving the item', () => {
 const {api}=mockApi(),removed=[],damage=[];const ground={};
 api.core={...api.core,ItemOnGroundManager:{deregister:item=>removed.push(item)}};
 const player={getCombat:()=>({getHitQueue:()=>({addPendingDamage:h=>damage.push(...h)})}),getInventory:()=>({deleteNumber(){}}),sendMessage(){}};
 const f=require('../plugins/quests/wgs/Surok.WhileGuthixSleeps')({api});const fight={player,explosive:{ground}};f.fights.set(player,fight);
 const unrelated={player,groundItemId:29573,groundItem:{},handled:false};assert.equal(f.pickup(unrelated),false);assert.equal(damage.length,0);
 const take={player,groundItemId:29573,groundItem:ground,handled:false};assert.equal(f.pickup(take),true);assert(take.handled);assert.deepEqual(removed,[ground]);assert.equal(fight.explosive,null);
 assert.equal(damage.length,1);assert(damage[0].getDamage()>=45&&damage[0].getDamage()<=55);
});

function synapseFixture() {
 const {api}=mockApi(),attrs=new Map([['while-guthix-sleeps:duradel-notes-read',1]]),items=[],tasks=[],xp=[],damage=[];
 const current=new Map(),base=new Map();let progress=900,registered=true,position=new api.core.Location(3200,3200,0),prompt;
 api.core={...api.core,Task:class{constructor(ticks){this.ticks=ticks;}stop(){}},TaskManager:{submit:t=>tasks.push(t)},ObjectDefinition:{forPlayer:()=>({getName:()=> 'Anvil'})}};
 api.sendMultiChatboxPrompt=(p,title,...pairs)=>prompt=pairs;
 const inventory={getItems:()=>items,contains:id=>items.some(i=>i.getId()===id),getAmount:id=>items.filter(i=>i.getId()===id).length,refreshItems(){},deleteNumber:(id,n)=>{while(n--){const at=items.findIndex(i=>i.getId()===id);assert(at>=0);items.splice(at,1);}}};
 const player={getInventory:()=>inventory,getEquipment:()=>({getItems:()=>items,refreshItems(){}}),getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),getHitpoints:()=>99,getLocation:()=>position,isRegistered:()=>registered,sendMessage(){},getCombat:()=>({getHitQueue:()=>({addPendingDamage:d=>damage.push(...d)})}),getSkillManager:()=>({getCurrentLevel:s=>current.get(s)??99,getMaxLevel:s=>base.get(s)??99,addExperience:(s,n)=>xp.push([s,n]),stopSkillable(){}})};
 const arc=require('../plugins/items/Arclight.plugin');arc.register({core:api.core,onItemOnObject(){},onItemOnItem(){},onItemAction(){},onCombatHitResolved(){}});
 const f=require('../plugins/quests/wgs/Rewards.WhileGuthixSleeps')({api,stage:()=>progress,held:(p,id)=>inventory.contains(id),val:(p,k)=>attrs.get(k)||0,ATTRIBUTES:[]});
 const add=id=>{const i=new api.core.Item(id,1);items.push(i);return i;};
 return {api,f,arc,attrs,items,tasks,xp,damage,player,current,base,add,prompt:()=>prompt,setStage:s=>progress=s,move:()=>position=new api.core.Location(3201,3200,0),disconnect:()=>registered=false};
}

test('synapses require notes, skills and the complete recipe, and award first/repeat XP',()=>{
 const t=synapseFixture(),r=t.f.recipes[0];t.add(29580);t.add(70);t.attrs.delete('while-guthix-sleeps:duradel-notes-read');t.f.craft(t.player,r);assert.equal(t.tasks.length,0);
 t.attrs.set('while-guthix-sleeps:duradel-notes-read',1);t.setStage(880);t.f.craft(t.player,r);assert.equal(t.tasks.length,0);t.setStage(900);
 t.current.set(t.api.core.Skill.FLETCHING,73);t.f.craft(t.player,r);assert.equal(t.tasks.length,0);assert.equal(t.damage[0].getDamage(),4);
 t.current.set(t.api.core.Skill.FLETCHING,74);t.f.craft(t.player,r);t.f.craft(t.player,r);assert.equal(t.tasks.length,1);assert.equal(t.tasks[0].ticks,6);t.tasks[0].execute();assert.deepEqual(t.items.map(i=>i.getId()),[29591]);assert.deepEqual(t.xp,[[t.api.core.Skill.FLETCHING,730]]);
 t.f.revert({player:t.player,item:t.items[0]});t.prompt()[1]();assert.deepEqual(t.items.map(i=>i.getId()),[29580]);t.add(70);t.f.craft(t.player,r);t.tasks[1].execute();assert.deepEqual(t.xp.at(-1),[t.api.core.Skill.FLETCHING,73]);
});

test('synapse crafting preserves materials when interrupted or the recipe changes',()=>{
 for(const interruption of ['move','disconnect','material']){const t=synapseFixture();t.add(29580);t.add(70);t.f.craft(t.player,t.f.recipes[0]);if(interruption==='material')t.items[1].setId(72);else t[interruption]();t.tasks[0].execute();assert(t.items.some(i=>i.getId()===29580));assert.equal(t.xp.length,0);}
});

test('purging staff uses boosted Crafting, unboosted Smithing, an iron bar and a retained hammer',()=>{
 const t=synapseFixture(),r=t.f.recipes[1];for(const id of[29580,1391,2347,2351])t.add(id);t.current.set(t.api.core.Skill.CRAFTING,74);t.base.set(t.api.core.Skill.CRAFTING,70);t.current.set(t.api.core.Skill.SMITHING,60);t.base.set(t.api.core.Skill.SMITHING,54);t.f.anvil({player:t.player,itemId:29580,objectId:1});assert.equal(t.tasks.length,0);
 t.base.set(t.api.core.Skill.SMITHING,55);t.f.anvil({player:t.player,itemId:29580,objectId:1});assert.equal(t.tasks[0].ticks,7);t.tasks[0].execute();assert.deepEqual(t.items.map(i=>i.getId()).sort((a,b)=>a-b),[2347,29594]);assert.deepEqual(t.xp,[[t.api.core.Skill.CRAFTING,730],[t.api.core.Skill.SMITHING,13]]);
});

test('Arclight charges and infusion are per sword and must total 10,000 for Emberlight',()=>{
 const t=synapseFixture(),I=t.api.core.ItemIdentifiers,r=t.f.recipes[2],sword=t.add(I.DARKLIGHT);for(let n=0;n<30;n++)t.add(I.ANCIENT_SHARD);
 t.arc._test.enhance({player:t.player,item:sword,objectId:t.api.core.ObjectIdentifiers.ALTAR_52});assert.equal(sword.getId(),I.ARCLIGHT);assert.equal(t.arc.state(sword).charges,1000);assert.equal(t.player.getInventory().getAmount(I.ANCIENT_SHARD),27);
 t.add(29580);t.add(2347);t.f.craft(t.player,r);assert.equal(t.tasks.length,0);
 const shard=t.items.find(i=>i.getId()===I.ANCIENT_SHARD);t.arc._test.charge({player:t.player,usedItem:sword,usedWithItem:shard,usedItemId:sword.getId(),usedWithItemId:I.ANCIENT_SHARD});assert.equal(t.arc.state(sword).charges,10000);assert.equal(t.player.getInventory().getAmount(I.ANCIENT_SHARD),0);
 const other=new t.api.core.Item(I.ARCLIGHT,1);assert.equal(t.arc.state(other).charges,1000);
 sword.setId(I.ARCLIGHT_INACTIVE_).setMetaValue('arclight',{charges:0,infusion:10000});t.f.craft(t.player,r);assert.equal(t.tasks[0].ticks,5);t.tasks[0].execute();assert.deepEqual(t.items.map(i=>i.getId()).sort((a,b)=>a-b),[2347,29589]);
 t.f.revert({player:t.player,item:t.items.find(i=>i.getId()===29589)});t.prompt()[1]();assert.deepEqual(t.items.map(i=>i.getId()).sort((a,b)=>a-b),[2347,29580]);
});

test('normal Arclight hits spend charges and preserve infusion at zero; special attacks do not',()=>{
 const t=synapseFixture(),I=t.api.core.ItemIdentifiers,sword=t.add(I.ARCLIGHT),normal={},special={};sword.setMetaValue('arclight',{charges:1,infusion:300});
 const equipment=[];equipment[t.api.core.Equipment.WEAPON_SLOT]=sword;t.player.getEquipment=()=>({getItems:()=>equipment,refreshItems(){}});t.player.isPlayer=()=>true;t.player.getAsPlayer=()=>t.player;
 t.api.core.CombatSpecial={getById:()=>({getCombatMethod:()=>special})};
 const hit=(accurate,damage,method=normal)=>({isAccurate:()=>accurate,getTotalDamage:()=>damage,getCombatType:()=>t.api.core.CombatType.MELEE,getCombatMethod:()=>method});
 for(const h of[hit(false,0),hit(true,0),hit(true,5,special)])t.arc._test.hitResolved({attacker:t.player,hit:h});assert.deepEqual(t.arc.state(sword),{charges:1,infusion:300});
 t.arc._test.hitResolved({attacker:t.player,hit:hit(true,5)});assert.equal(sword.getId(),I.ARCLIGHT_INACTIVE_);assert.deepEqual(t.arc.state(sword),{charges:0,infusion:301});
});

test('Song of the Elves rubs the seed to the Enchanted Valley and returns to Lletya', () => {
  const { api: base } = mockApi();
  const itemActions = [];
  const custom = new Map();
  const spawns = [];
  const locations = [];
  const started = [];
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'onItemAction') return (handler) => itemActions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, handler);
      if (prop === 'spawnNpc') return (spawn) => (spawns.push(spawn), null);
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  try {
    require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }

  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const player = {
    getUsername: () => 'SoteTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 28 }),
    getEquipment: () => ({ get: () => null }),
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getArea: () => null,
    moveTo: (location) => locations.push(location),
    sendMessage() {},
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
  };
  quest.setStage(player, 120);

  const itemEvent = { player, itemId: api.core.ItemIdentifiers.CRYSTAL_SEED_3, handled: false };
  itemActions.at(-1)(itemEvent);
  assert.equal(itemEvent.handled, true);
  assert.equal(started.at(-1)[3], 'preparing-to-enter-prifddinas-a-mysterious-figure');

  custom.get('npc-dialogue:action')({ player, stepId: 'UeAKgA' });
  assert.deepEqual([locations.at(-1).getX(), locations.at(-1).getY()], [2440, 6090]);
  assert.equal(spawns.at(-1).id, api.core.NpcIdentifiers.MYSTERIOUS_FIGURE);
  assert.equal(spawns.at(-1).owner, player);

  custom.get('npc-dialogue:action')({ player, stepId: 'D1wXY6' });
  assert.deepEqual([locations.at(-1).getX(), locations.at(-1).getY()], [2353, 3172]);
  assert.equal(attributes.get('quest.song_of_the_elves.valley-figure'), false);
});

test('Song of the Elves follows the cached Hefin stepping stones from the Poison Waste shore', () => {
  const { api: base, handlers } = mockApi();
  class ImmediateTask {
    constructor(_key, _ticks, onComplete) { this.onComplete = onComplete; }
  }
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop === 'core') return {
        ...target.core,
        CountdownTask: ImmediateTask,
        TaskManager: { submit: (task) => task.onComplete() },
      };
      return target[prop];
    },
  });
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests()
    .filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map([['quest.song_of_the_elves.hefin-clue-heard', true]]);
  const moved = [];
  const faced = [];
  const requested = [];
  const location = { x: 2299, y: 3114, z: 0 };
  const movement = {
    reset() {}, walkToReset() {}, setBlockMovement() {},
    requestWalk: (destination) => requested.push(destination),
  };
  const player = {
    getUsername: () => 'HefinStoneTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => location.x, getY: () => location.y, getZ: () => location.z }),
    getMovementQueue: () => movement,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isRegistered: () => true,
    getHitpoints: () => 99,
    moveTo: (tile) => {
      location.x = tile.getX(); location.y = tile.getY(); location.z = tile.getZ();
      moved.push([location.x, location.y, location.z]);
    },
    setPositionToFace: (tile) => faced.push([tile.getX(), tile.getY()]),
    performAnimation() {},
  };
  quest.setStage(player, 150);
  const destination = { x: 2276, y: 3094, z: 0 };
  const event = { player, destination, handled: false };
  handlers.walkRoutes.at(-1)(event);
  assert.equal(event.handled, true);
  assert.ok(moved.length > 10, 'the crossing follows the intermediate cache stones');
  assert.deepEqual(moved.at(-1), [2280, 3092, 0]);
  assert.deepEqual(requested.map((tile) => [tile.getX(), tile.getY(), tile.getZ()]), [[2276, 3094, 0]],
    'normal pathfinding resumes after reaching the island shore');
  assert.equal(attributes.get('quest.song_of_the_elves.hefin-crossing'), false);
});

test('Song of the Elves exposes the post-library meeting through a talkable Arianwyn variant', () => {
  const { api } = mockApi();
  const areas = [];
  const spawns = [];
  api.registerArea = (area) => areas.push(area);
  api.spawnNpc = (definition) => (spawns.push(definition), { isRegistered: () => true });
  api.removeNpc = () => {};
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const player = {
    getUsername: () => 'PostLibraryMeetingTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    getAsPlayer: () => player,
  };
  quest.setStage(player, 140);
  const lletya = areas[0];
  lletya.process(player);
  lletya.process(player);
  assert.equal(spawns.length, 1, 'the owner-only meeting NPC is spawned once per chapter visit');
  assert.equal(spawns[0].id, api.core.NpcIdentifiers.ARIANWYN_6);
  assert.deepEqual([spawns[0].x, spawns[0].y, spawns[0].z], [2354, 3172, 0]);
  assert.equal(spawns[0].owner, player);
  assert.equal(spawns[0].ownerOnly, true);
});

test('Song of the Elves starts the post-library council and switches Baxtorian after it', () => {
  const { api, handlers } = mockApi();
  const hooks = [];
  const npcHooks = [];
  const started = [];
  const persistedAttributes = [];
  api.persistAttribute = (key) => persistedAttributes.push(key);
  api.onAnyNpcInteraction = (hook) => hooks.push(hook);
  api.onNpcInteraction = (...args) => npcHooks.push(args);
  const runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  try { require('../plugins/quests/quests/SongOfTheElves.Quest')(api); }
  finally { runtime.startTranscript = original; }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.revelations-meeting-started'));
  const attributes = new Map();
  const sentVarbits = [];
  let hasAxe = false;
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({ sendVarbit: (id, value) => sentVarbits.push([id, value]) }, {
      get: (target, prop) => prop in target ? target[prop] : () => {},
    }),
    getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 28, deleteNumber: () => {}, adds: () => {}, contains: (id) => hasAxe && id === api.core.ItemIdentifiers.BRONZE_AXE }),
    getEquipment: () => ({ getItems: () => [] }),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    sendMessage() {},
  };
  quest.setStage(player, 140);
  const talk = hooks.at(-1)['Talk-to'];
  const interact = (name) => talk({ player, npcId: api.core.NpcIdentifiers.ARIANWYN_6, definition: { getName: () => name } });
  assert.equal(interact('Arianwyn'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-the-curse-of-seren');
  assert.equal(interact('Baxtorian'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-dialogue-with-npcs-post-library-visit-talking-to-baxtorian');
  const handoff = { player, npcId: api.core.NpcIdentifiers.ARIANWYN_6, handled: false };
  handlers.custom.get('quest-song-of-the-elves:claim-arianwyn').at(-1)(handoff);
  assert.equal(handoff.handled, true, 'the completed Mourning’s End handler can hand the NPC to SOTE');
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-the-curse-of-seren');
  quest.setStage(player, 160);
  attributes.set('quest.song_of_the_elves.lletya-traitor-revealed', true);
  const lletyaHandoff = { player, npcId: api.core.NpcIdentifiers.ARIANWYN_6, handled: false };
  handlers.custom.get('quest-song-of-the-elves:claim-arianwyn').at(-1)(lletyaHandoff);
  assert.equal(lletyaHandoff.handled, true, 'ME2 hands Arianwyn to SOTE during the Lletya attack');
  assert.equal(started.at(-1)[3], 'attack-on-lletya-confronting-the-traitor');
  handlers.custom.get('npc-dialogue:line').at(-1)({
    player, text: 'So be it.', step: { player: 'So be it.' },
    definition: { getName: () => 'Arianwyn' },
  });
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-arianwyn-confronted'), true,
    'the final player line starts the encounter even though this wiki step has no NPC speaker field');
  quest.setStage(player, 140);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'koxQh3' });
  assert.equal(attributes.get('quest.song_of_the_elves.revelations-meeting-started'), true);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'J6osYV' });
  assert.equal(quest.getStage(player), 140, 'closing the revelations meeting waits for Baxtorian’s follow-up');
  assert.equal(interact('Baxtorian'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-talking-to-baxtorian-after-the-meeting');
  assert.equal(quest.getStage(player), 150, 'Baxtorian’s follow-up opens the clan-leader chapter');
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'FoLVmk' });
  assert.equal(quest.getStage(player), 150, 'the meeting ending advances into the clan-leader chapter');
  assert.equal(interact('Baxtorian'), true);
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-talking-to-baxtorian-after-the-meeting',
    'players who closed the council dialogue can still ask for both elder clues');

  const choice = handlers.custom.get('npc-dialogue:choice').at(-1);
  choice({ player, option: 'How do I find Lord Crwys?', definition: { getName: () => 'Baxtorian' } });
  assert.equal(attributes.get('quest.song_of_the_elves.crwys-clue-heard'), true);
  assert.deepEqual(sentVarbits.at(-1), [9022, 1], 'the clue selects the cache tree variant with Chop down');
  const treeHook = npcHooks.find(([handler]) => typeof handler === 'function')?.[0];
  assert.equal(typeof treeHook, 'function');
  const chopTree = (extra = {}) => {
    const event = { player, npcId: api.core.NpcIdentifiers.LORD_PIQUAN_CRWYS_2, clickType: 1,
      npc: { getContentId: () => api.core.NpcIdentifiers.COL_00FFFF_TREE_COL_2, getSpawnPosition: () => ({ getX: () => 2176, getY: () => 3211 }) },
      location: { x: 2176, y: 3211 }, definition: { getName: () => '<col=00ffff>Tree</col>', getActions: () => ['Chop down'] }, ...extra };
    treeHook(event);
    return event;
  };
  const noAxe = chopTree();
  assert.equal(noAxe.handled, true, 'a missing axe is handled by the quest instead of starting woodcutting');
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-talking-to-baxtorian-after-the-meeting',
    'the disguised leader cannot be revealed without a usable axe');
  hasAxe = true;
  chopTree();
  assert.equal(started.at(-1)[3], 'reporting-back-after-the-revelations-finding-lord-crwys');
  assert.deepEqual(sentVarbits.at(-1), [9022, 2], 'chopping reveals Lord Crwys');
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'UNrb5z' });
  choice({ player, option: 'How do I find Lady Hefin?', definition: { getName: () => 'Baxtorian' } });
  assert.equal(attributes.get('quest.song_of_the_elves.hefin-clue-heard'), true);
  handlers.custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'K9K0W4' });
  assert.equal(quest.getStage(player), 150, 'both clan leaders keep the quest in the orb chapter');
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.crwys-clue-heard'));
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.hefin-clue-heard'));
});

test('Song of the Elves keeps Arianwyn engaged so ranged hits are not erased by generic NPC regeneration', () => {
  class TestPrivateArea {
    enter(mobile) { mobile.area = this; }
    leave(mobile) { mobile.area = null; }
    isDestroyed() { return false; }
  }
  const { api, handlers } = mockApi();
  api.core = { ...api.core, PrivateArea: TestPrivateArea, World: { getProcessCycle: () => 100 } };
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const started = [];
  const runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  let engagementResets = 0;
  const boss = {
    hitpoints: 300,
    getHitpoints() { return this.hitpoints; },
    getMaxHitpoints() { return 300; },
    setMultiCombat() {},
    setScriptedMovement() {},
    getCombat() {
      return {
        attack() {},
        getLastAttack: () => ({ reset: () => engagementResets++ }),
      };
    },
  };
  api.spawnNpc = () => boss;
  try { require('../plugins/quests/quests/SongOfTheElves.Quest')(api); }
  finally { runtime.startTranscript = original; }
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map([['quest.song_of_the_elves.lletya-traitor-revealed', true]]);
  const player = {
    area: null,
    getUsername: () => 'ArianwynEngagementTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => 2351, getY: () => 3172, getZ: () => 0 }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    moveTo() {},
    sendMessage() {},
  };
  quest.setStage(player, 160);
  handlers.custom.get('npc-dialogue:line').at(-1)({
    player, text: 'So be it.', step: { player: 'So be it.' },
    definition: { getName: () => 'Arianwyn' },
  });
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-boss') instanceof TestPrivateArea, true);
  assert.equal(started.length, 0, 'the final challenge line enters combat rather than leaving a queued dialogue over it');
  attributes.get('quest.song_of_the_elves.lletya-boss').process(player);
  assert.equal(engagementResets, 1, 'private-area ticks refresh the boss combat timer so real hit queues can damage it');
});

test('Song of the Elves tracks Ysgawyn clues in order through normal object examine packets', () => {
  const { api, handlers } = mockApi();
  const areas = [];
  const spawns = [];
  api.registerArea = (area) => areas.push(area);
  api.spawnNpc = (definition) => (spawns.push(definition), { isRegistered: () => true });
  api.removeNpc = () => {};
  const persistedAttributes = [];
  api.persistAttribute = (key) => persistedAttributes.push(key);
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const messages = [];
  let tile = { x: 2306, y: 3194, z: 0 };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({ getAmount: (id) => id === api.core.ItemIdentifiers.ORB_OF_LIGHT_5 ? 1 : 0 }),
    getLocation: () => ({ getX: () => tile.x, getY: () => tile.y, getZ: () => tile.z }),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage: (message) => messages.push(message),
    isPlayer: () => true,
    getAsPlayer: () => player,
  };
  quest.setStage(player, 150);
  assert.ok(persistedAttributes.includes('quest.song_of_the_elves.ysgawyn-track-step'));
  const examine = handlers.custom.get('world:object-examine').at(-1);
  const outOfOrder = { player, objectId: 37297, handled: false };
  examine(outOfOrder);
  assert.equal(outOfOrder.handled, false);
  assert.equal(attributes.has('quest.song_of_the_elves.ysgawyn-track-step'), false);
  const mushroom = { player, objectId: 37292, handled: false };
  examine(mushroom);
  assert.equal(mushroom.handled, true);
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 1);
  assert.match(messages.at(-1), /mushrooms/);
  tile = { x: 2294, y: 3189, z: 0 };
  examine({ player, objectId: 37297, handled: false });
  tile = { x: 2279, y: 3186, z: 0 };
  examine({ player, objectId: 37296, handled: false });
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 3);
  const route = {
    player, objectId: 3923, clickType: 1, destination: null,
    definition: { getInteractions: () => ['Jump'] },
    sourceLocation: { x: 2274, y: 3177, z: 0 },
  };
  for (const hook of handlers.routes) hook(route);
  assert.deepEqual(route.destination, route.sourceLocation,
    'the natural Regicide Jump handler keeps the original approach edge before it applies Agility');
  for (const [id, x, y] of [[3918, 2272, 3168], [3916, 2259, 3159], [37297, 2244, 3170]]) {
    tile = { x, y, z: 0 };
    examine({ player, objectId: id, handled: false });
  }
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 6);
  tile = { x: 2254, y: 3168, z: 0 };
  for (const process of handlers.playerProcess) process({ player });
  assert.equal(attributes.get('quest.song_of_the_elves.ysgawyn-track-step'), 7,
    'the tripwire clearing is required after all six clues');
  const clearing = areas.find((area) => area.constructor.name === 'YsgawynClearingArea');
  clearing.process(player);
  assert.deepEqual(spawns.at(-1), { id: api.core.NpcIdentifiers.YSGAWYN, x: 2256, y: 3168, z: 0,
    wanderRadius: 0, owner: player, ownerOnly: true });
});

test('Song of the Elves rescue searches require the east table before Iona and preserve both rescues', () => {
  const { api, handlers } = mockApi();
  const started = [];
  const runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  try { require('../plugins/quests/quests/SongOfTheElves.Quest')(api); }
  finally { runtime.startTranscript = original; }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  let playerLocation = { x: 2340, y: 3158, z: 0 };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({}),
    moveTo() {},
    getLocation: () => ({ getX: () => playerLocation.x, getY: () => playerLocation.y, getZ: () => playerLocation.z }),
    getPrivateArea: () => null,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    sendMessage() {},
  };
  quest.setStage(player, 150);
  handlers.custom.get('npc-dialogue:action').at(-1)({
    player, kind: 'message', stepId: 'XhOxpi', npcId: api.core.NpcIdentifiers.ARIANWYN_6,
  });
  assert.equal(quest.getStage(player), 160);
  assert.equal(started.at(-1)[3], 'attack-on-lletya-a-village-on-fire');
  const mapObjects = api.core.MapObjects;
  const originalGet = mapObjects.get;
  mapObjects.get = (id) => ({ getId: () => id });
  const examine = (objectId) => {
    const event = { player, objectId, handled: false };
    for (const hook of handlers.custom.get('world:object-examine') ?? []) hook(event);
    return event.handled;
  };
  playerLocation = { x: 2338, y: 3157, z: 1 };
  assert.equal(examine(api.core.ObjectIdentifiers.COOKING_POTS_2), true);
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-children'), undefined,
    'Iona cannot be rescued before finding Eoin');
  playerLocation = { x: 2340, y: 3158, z: 0 };
  assert.equal(examine(api.core.ObjectIdentifiers.TABLE_75), true);
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-children').eoin, true);
  assert.equal(started.at(-1)[3], 'attack-on-lletya-a-village-on-fire-finding-eoin');
  playerLocation = { x: 2338, y: 3157, z: 1 };
  assert.equal(examine(api.core.ObjectIdentifiers.COOKING_POTS_2), true);
  assert.equal(attributes.get('quest.song_of_the_elves.lletya-children').iona, true);
  assert.equal(started.at(-1)[3], 'attack-on-lletya-a-village-on-fire-finding-iona');
  mapObjects.get = originalGet;
});

test('Song of the Elves spawns Baxtorian in Lletya for the post-attack clan clues', () => {
  const { api } = mockApi();
  const areas = [];
  const spawns = [];
  api.registerArea = (area) => areas.push(area);
  api.spawnNpc = (definition) => (spawns.push(definition), { isRegistered: () => true });
  api.removeNpc = () => {};
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const player = {
    getUsername: () => 'PostAttackCluesTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    isPlayer: () => true,
    getAsPlayer: () => player,
  };
  quest.setStage(player, 170);
  const lletya = areas.find((area) => area.constructor.name === 'LletyaStoryArea');
  lletya.process(player);
  assert.deepEqual(spawns.at(-1), { id: api.core.NpcIdentifiers.BAXTORIAN, x: 2352, y: 3170, z: 0,
    wanderRadius: 0, owner: player, ownerOnly: true });
});

test('Song of the Elves chapter 16 requires the real Ithell symbols, statue, clue digs and spin', () => {
  const { api: base, handlers } = mockApi();
  const custom = handlers.custom;
  const areas = [];
  const npcHooks = [];
  const spawned = [];
  const started = [];
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = (...args) => (started.push(args.slice(1)), true);
  apiSetup();
  function apiSetup() {
    base.registerArea = (area) => areas.push(area);
    base.spawnNpc = (definition) => {
      spawned.push(definition);
      return { isRegistered: () => true };
    };
    base.removeNpc = () => {};
    base.onAnyNpcInteraction = (hook) => npcHooks.push(hook);
    require('../plugins/quests/quests/SongOfTheElves.Quest')(base);
  }
  runtime.startTranscript = originalStartTranscript;

  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map([['quest.song_of_the_elves.recruited-elders', 7]]);
  const inventory = new Map();
  const varbits = new Map();
  const location = { x: 2352, y: 3170, z: 0 };
  const player = {
    getUsername: () => 'SoteChapter16Test',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - [...inventory.values()].filter((amount) => amount > 0).length,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    getPacketSender: () => new Proxy({}, { get: (_, key) => key === 'sendVarbit' ? (id, value) => varbits.set(id, value) : () => {} }),
    getLocation: () => ({ getX: () => location.x, getY: () => location.y, getZ: () => location.z }),
    getEquipment: () => ({ getItems: () => [] }),
    getArea: () => areas[0],
    isPlayer: () => true,
    getAsPlayer: () => player,
    moveTo() {}, sendMessage() {}, performAnimation() {},
  };
  quest.setStage(player, 170);

  const choices = custom.get('npc-dialogue:choice');
  choices.at(-1)({ player, option: "What's Lady Ithell's clue?", definition: { getName: () => 'Baxtorian' } });
  assert.equal(varbits.get(9035), 1);
  const examineSymbol = custom.get('world:object-examine')[1];
  location.x = 2322; location.y = 3163; location.z = 0;
  const examined = { player, objectId: 37305, handled: false };
  examineSymbol(examined);
  assert.equal(examined.handled, true, 'missing cache actions use the current-tile wall Examine fallback');
  const remoteExamine = { player, objectId: 37306, handled: false };
  examineSymbol(remoteExamine);
  assert.equal(remoteExamine.handled, false, 'an Examine packet cannot claim a different symbol across Lletya');
  for (const symbol of [
    { id: 37307, x: 2349, y: 3161, z: 0 }, { id: 37306, x: 2340, y: 3181, z: 0 },
    { id: 37304, x: 2334, y: 3183, z: 1 }, { id: 37303, x: 2351, y: 3172, z: 1 },
  ]) {
    const event = { player, objectId: symbol.id, location: symbol, option: 'Touch', handled: false };
    for (const handler of handlers.objects) if (handler(event) === true) break;
    assert.equal(event.handled, true);
  }
  assert.equal(attributes.get('quest.song_of_the_elves.ithell-clue-stage'), 2);
  assert.equal(varbits.get(9035), 2);
  inventory.set(base.core.ItemIdentifiers.LIMESTONE_BRICK, 8);
  inventory.set(base.core.ItemIdentifiers.SAW, 1);
  inventory.set(base.core.ItemIdentifiers.HAMMER, 1);
  const statue = { player, objectId: 37308, location: { x: 2337, y: 3171, z: 0 }, option: 'Build', handled: false };
  for (const handler of handlers.objects) if (handler(statue) === true) break;
  assert.equal(attributes.get('quest.song_of_the_elves.ithell-statue'), true);
  assert.equal(inventory.get(base.core.ItemIdentifiers.LIMESTONE_BRICK), 0);
  attributes.set('quest.song_of_the_elves.ithell-clue-stage', 0);
  areas[0].process(player);
  attributes.set('quest.song_of_the_elves.ithell-clue-stage', 2);
  assert.equal(spawned.at(-1).id, base.core.NpcIdentifiers.LADY_KELYN_ITHELL);

  choices.at(-1)({ player, option: "What's Lady Meilyr's clue?", definition: { getName: () => 'Baxtorian' } });
  assert.equal(inventory.get(base.core.ItemIdentifiers.CLUE_SCROLL_HARD_), 1);
  const dig = handlers.itemAction.find((actions) => actions?.Dig)?.Dig;
  assert.ok(dig);
  for (const spot of [{ x: 2225, y: 3133 }, { x: 2203, y: 3061 }, { x: 2240, y: 3269 }]) {
    location.x = spot.x; location.y = spot.y; location.z = 0;
    const event = { player, itemId: base.core.ItemIdentifiers.SPADE, handled: false };
    assert.equal(dig(event), true);
    assert.equal(event.handled, true);
  }
  assert.equal(varbits.get(9036), 4);
  location.x = 2309; location.y = 3215; location.z = 0;
  custom.get('player:emote').at(-1)({ player, sequence: 2107 });
  assert.equal(varbits.get(9036), 5);
  assert.equal(spawned.at(-1).id, base.core.NpcIdentifiers.LADY_FFION_MEILYR);
  const talk = npcHooks.at(-1)['Talk-to'];
  assert.equal(talk({ player, npcId: base.core.NpcIdentifiers.LADY_FFION_MEILYR,
    definition: { getName: () => 'Lady Ffion Meilyr' } }), true);
  assert.equal(started.at(-1)[3], 'after-the-attack-finding-lady-meilyr');
  custom.get('npc-dialogue:action').at(-1)({ player, kind: 'message', stepId: 'S3ME_F' });
  assert.equal(inventory.get(base.core.ItemIdentifiers.CLUE_SCROLL_HARD_), 0);
  assert.equal(quest.getStage(player), 180);
});

test('Song of the Elves Iorwerth scroll lands on the walkable camp tile', () => {
  const { api: base, handlers } = mockApi();
  let destination;
  let consumed;
  const core = {
    ...base.core,
    TeleportHandler: {
      checkReqs: () => true,
      teleport: (player, location) => player.moveTo(location),
    },
  };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core : target[prop],
  });
  require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  const player = {
    getInventory: () => ({ deleteNumber: (id, amount) => { consumed = [id, amount]; } }),
    moveTo: (location) => { destination = [location.getX(), location.getY(), location.getZ()]; },
  };
  const event = {
    player,
    itemId: core.ItemIdentifiers.IORWERTH_CAMP_TELEPORT,
    option: 'Teleport',
    handled: false,
  };
  handlers.itemAction.at(-1)(event);
  assert.equal(event.handled, true);
  assert.deepEqual(consumed, [core.ItemIdentifiers.IORWERTH_CAMP_TELEPORT, 1]);
  assert.deepEqual(destination, [2194, 3258, 0]);
});

test('Song of the Elves library mirrors must follow the previous beam direction', () => {
  class TestPrivateArea {
    constructor() { this.objects = []; }
    enter(player) { player.area = this; }
    getObjects() { return this.objects; }
    getTemplateObjects(tile) {
      return [[2609, 6158, 1], [2623, 6158, 1], [2623, 6159, 1], [2623, 6158, 0], [2623, 6130, 0],
        [2609, 6130, 0], [2609, 6116, 0], [2609, 6102, 0], [2623, 6102, 0], [2581, 6130, 0]]
        .some(([x, y, z]) => tile?.getX?.() === x && tile?.getY?.() === y && tile?.getZ?.() === z)
        ? [{ getId: () => tile.getX() === 2609 && tile.getY() === 6158
          ? 35222 : base.core.ObjectIdentifiers.PILLAR_OF_LIGHT_41 }]
        : [];
    }
  }
  const itemObjects = new Map();
  const objectInteractions = [];
  const custom = new Map();
  const prompts = [];
  const base = { core: {
    ...PluginManager.getCoreApi(), PrivateArea: TestPrivateArea,
    ObjectDefinition: { forId: (id) => id === 35222 ? { name: 'Pillar of Light' } : null },
  } };
  base.core.ObjectDefinition.forPlayer = (id) => [35222, 35259, 35194].includes(id)
    ? { id: id === 35259 ? 35194 : id, name: 'Pillar of Light', getName: () => 'Pillar of Light' }
    : null;
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'onItemOnObject') return (itemName, objectName, handler) => itemObjects.set(itemName, handler);
      if (prop === 'onObjectInteraction') return (...args) => {
        if (typeof args[0] === 'function') objectInteractions.push(args[0]);
        else if (args[0] === 'Floating Book') objectInteractions.push(args[1].Climb);
      };
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, handler);
      if (prop === 'sendMultiChatboxPrompt') return (player, prompt, ...choices) => prompts.push(choices);
      if (prop === 'spawnNpc') return () => null;
      return () => {};
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/SongOfTheElves.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'song_of_the_elves').at(-1);
  const attributes = new Map();
  const amounts = new Map();
  const messages = [];
  const inventory = {
    getAmount: (id) => amounts.get(id) ?? 0,
    getFreeSlots: () => 28,
    adds: (id, amount) => amounts.set(id, (amounts.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => amounts.set(id, Math.max(0, (amounts.get(id) ?? 0) - amount)),
  };
  const player = {
    getUsername: () => 'SoteLibraryTest',
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getArea: () => player.area ?? null,
    getPacketSender: () => new Proxy({}, { get: () => () => {} }),
    getEquipment: () => ({ get: () => null }),
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    sendMessage: (message) => messages.push(message),
    moveTo(location) { player.destination = [location.getX(), location.getY(), location.getZ()]; },
  };
  quest.setStage(player, 130);
  custom.get('npc-dialogue:choice')({
    player, option: 'Yes', definition: { getName: () => 'Lord Ieuan Amlodd' },
  });
  const climbFloatingBooks = objectInteractions.at(-1);
  const bookCrossing = { player, objectId: api.core.ObjectIdentifiers.FLOATING_BOOK, location: { x: 2598, y: 6173, z: 2 }, handled: false };
  assert.equal(climbFloatingBooks(bookCrossing), true);
  assert.equal(bookCrossing.handled, true);
  assert.deepEqual(player.destination, [2606, 6173, 2]);
  const returnCrossing = { player, objectId: api.core.ObjectIdentifiers.FLOATING_BOOK + 1,
    location: { x: 2606, y: 6173, z: 2 }, handled: false };
  assert.equal(climbFloatingBooks(returnCrossing), true,
    'the far-end cache variant also routes back across the book handhold');
  assert.equal(returnCrossing.handled, true);
  assert.deepEqual(player.destination, [2598, 6173, 2]);
  custom.get('npc-dialogue:choice')({
    player, option: 'Yes please.', definition: { getName: () => 'Memory of Seren' },
  });
  assert.deepEqual(player.destination, [2623, 6144, 0],
    'the memory transport returns the player to the Grand Library entrance chamber');

  const useObject = objectInteractions.find((handler) => handler({
    player, objectId: api.core.ObjectIdentifiers.SEAL_OF_THE_FORGOTTEN,
  }) === true);
  assert.ok(useObject, 'the central seal interaction is registered');
  attributes.set('quest.song_of_the_elves.library-seals', 3);
  useObject({ player, objectId: api.core.ObjectIdentifiers.CRYSTAL_DISPENSER_3, handled: false });
  const useMirror = itemObjects.get('Hand mirror');
  const place = (x, y, direction, z = 0, overrideId = null) => {
    const objectId = overrideId ?? (x === 2609 && y === 6158
      ? 35222 : api.core.ObjectIdentifiers.PILLAR_OF_LIGHT_41);
    useMirror({
      player, itemId: api.core.ItemIdentifiers.HAND_MIRROR_2,
      objectId,
      location: { x, y, z }, handled: false,
    });
    let options = prompts.at(-1);
    let choice = options.findIndex((value) => value === `Reflect ${direction}`);
    if (choice === -1) {
      const more = options.findIndex((value) => value === 'More directions...');
      assert.notEqual(more, -1);
      options[more + 1]();
      options = prompts.at(-1);
      choice = options.findIndex((value) => value === `Reflect ${direction}`);
    }
    assert.notEqual(choice, -1);
    options[choice + 1]();
  };
  place(2609, 6158, 'east', 1);
  place(2623, 6158, 'south', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:0');
  assert.ok(messages.some((message) => message.includes('sequence has reset')));
  useObject({ player, objectId: api.core.ObjectIdentifiers.CRYSTAL_DISPENSER_3, handled: false });
  place(2609, 6158, 'east', 1);
  place(2623, 6159, 'down', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:0');
  assert.ok(messages.some((message) => message.includes('different pillar')));
  useObject({ player, objectId: api.core.ObjectIdentifiers.CRYSTAL_DISPENSER_3, handled: false });
  place(2609, 6158, 'east', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:1');
  place(2623, 6158, 'down', 1);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '1:2');

  attributes.set('quest.song_of_the_elves.library-seals', 14);
  attributes.set('quest.song_of_the_elves.library-puzzle', '3:18');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2595,6186,0': { operation: 'S', direction: 'south', x: 2595, y: 6186, z: 0, step: 7 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2595, 6172, 'east', 0, 35259);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '3:19');

  attributes.set('quest.song_of_the_elves.library-seals', 62);
  attributes.set('quest.song_of_the_elves.library-puzzle', '5:14');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2581,6116,0': { operation: 'U', direction: 'up', x: 2581, y: 6116, z: 0, step: 13 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2581, 6130, 'north', 0);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '5:15',
    `Hefin’s blue beam branches north from the shared floor-zero pillar while the green beam rises: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-puzzle', '5:19');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2581,6130,2': { operation: 'W', direction: 'west', x: 2581, y: 6130, z: 2, step: 18 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2567, 6144, 'south', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '5:20',
    `Hefin’s final blue beam has its own north-west source: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-seals', 255);
  attributes.set('quest.song_of_the_elves.library-puzzle', '7:16');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2651,6200,1': { operation: 'S', direction: 'south', x: 2651, y: 6200, z: 1, step: 15 },
  }));
  amounts.set(api.core.ItemIdentifiers.MAGENTA_CRYSTAL_2, 1);
  itemObjects.get('Magenta crystal')({
    player, itemId: api.core.ItemIdentifiers.MAGENTA_CRYSTAL_2,
    objectId: api.core.ObjectIdentifiers.PILLAR_OF_LIGHT_41,
    location: { x: 2637, y: 6200, z: 1 }, handled: false,
  });
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '7:17',
    `Iorwerth’s magenta crystal follows the cyan beam beside mirror 12, independently of mirror 12’s south branch: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-puzzle', '7:30');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2665,6186,2': { operation: 'D', direction: 'down', x: 2665, y: 6186, z: 2, step: 29 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 2);
  place(2637, 6200, 'south', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '7:31',
    `Iorwerth’s final blue ray starts at the cache-mapped F7 pillar on floor two: ${messages.slice(-2).join(' | ')}`);
  place(2637, 6186, 'down', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '7:32',
    `Iorwerth’s final mirror sends the branch down toward the seal: ${messages.slice(-2).join(' | ')}`);
  attributes.set('quest.song_of_the_elves.library-seals', 127);
  attributes.set('quest.song_of_the_elves.library-puzzle', '6:6');
  attributes.set('quest.song_of_the_elves.library-pillar-state', JSON.stringify({
    '2581,6116,0': { operation: 'U', direction: 'up', x: 2581, y: 6116, z: 0, step: 5 },
  }));
  amounts.set(api.core.ItemIdentifiers.HAND_MIRROR_2, 1);
  place(2581, 6116, 'north', 2);
  assert.equal(attributes.get('quest.song_of_the_elves.library-puzzle'), '6:7',
    `Trahaearn’s vertical beam travels through an unmirrored middle floor: ${messages.slice(-2).join(' | ')}`);
  const beforeReplay = messages.length;
  useObject({ player, objectId: 36726, handled: false });
  assert.ok(!messages.slice(beforeReplay).some((message) => message.includes('seal remains dark')),
    'touching a completed seal replays its memory so its return transport stays available');
});

test('Regicide tripwires use the Agility success roll and apply the dart hit and poison on failure', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  assert.equal(typeof interact, 'function');

  const location = { x: 2285, y: 3187, z: 0 };
  const object = { getFace: () => 3 };
  const createPlayer = (agility) => {
    const state = { moves: [], hits: [], poison: 0 };
    const position = { x: 2286, y: 3188, z: 0 };
    const player = {
      getLocation: () => ({ getX: () => position.x, getY: () => position.y, getZ: () => position.z }),
      getSkillManager: () => ({ getCurrentLevel: () => agility }),
      getCombat: () => ({
        getHitQueue: () => ({ addPendingDamage: (damage) => state.hits.push(damage) }),
        getPoisonImmunityTimer: () => ({ finished: () => true }),
      }),
      isPoisoned: () => false,
      setPoisonDamage: (amount) => { state.poison = amount; },
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
    };
    return { player, state };
  };
  const interactWith = (player) => ({
    player, object, objectId: api.core.ObjectIdentifiers.TRIPWIRE_3, clickType: 1,
    location, definition: { getActions: () => ['Step-over'] }, handled: false,
  });

  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const safe = createPlayer(99);
    const success = interactWith(safe.player);
    interact(success);
    assert.equal(success.handled, true);
    assert.deepEqual(safe.state.moves, [[2284, 3188, 0]], 'a successful westward crossing reaches the opposite side');

    Math.random = () => 0.12;
    const levelOne = createPlayer(1);
    const lowLevelSuccess = interactWith(levelOne.player);
    interact(lowLevelSuccess);
    assert.deepEqual(levelOne.state.moves, [[2284, 3188, 0]], 'the 31/256 level-one success rate is preserved');

    Math.random = () => 0.99;
    const caught = createPlayer(99);
    const failure = interactWith(caught.player);
    interact(failure);
    assert.equal(failure.handled, true);
    assert.equal(caught.state.hits[0][0].getDamage(), 10);
    assert.equal(caught.state.poison, 2);
    assert.deepEqual(caught.state.moves, [], 'a triggered tripwire leaves the player on the near side');
  } finally {
    Math.random = originalRandom;
  }
});

test('Regicide Huge Gate passes the player to the far side from either approach', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  const run = (sourceY, id, objectY) => {
    const attributes = new Map([['quest.regicide.stage', 13]]);
    const state = { moves: [], messages: [] };
    const position = { x: 2386, y: sourceY, z: 0 };
    const player = {
      getAttribute: (key) => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      getLocation: () => ({ getX: () => position.x, getY: () => position.y, getZ: () => position.z }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      sendMessage: (message) => state.messages.push(message),
    };
    const event = { player, objectId: id, location: { x: 2386, y: objectY, z: 0 }, sourceLocation: { x: 2386, y: sourceY, z: 0 }, handled: false };
    interact(event);
    assert.equal(event.handled, true);
    assert.match(state.messages[0], /guards recognise Lord Iorwerth's seal/);
    return state.moves;
  };
  assert.deepEqual(run(3335, api.core.ObjectIdentifiers.HUGE_GATE, 3334), [[2386, 3332, 0]], 'south approach crosses north');
  assert.deepEqual(run(3333, api.core.ObjectIdentifiers.HUGE_GATE_2, 3334), [[2386, 3336, 0]], 'north approach crosses south');
});

test('Regicide dense forest crossing checks Agility and clears the full rotated cache footprint', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const attributes = new Map([['quest.regicide.stage', 15]]);
  const state = { moves: [], messages: [] };
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getSkillManager: () => ({ getCurrentLevel: () => 99 }),
    getLocation: () => ({ getX: () => 2274, getY: () => 3191, getZ: () => 0 }),
    moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
    sendMessage: (message) => state.messages.push(message),
  };
  const event = {
    player,
    object: { getFace: () => 1 },
    objectId: api.core.ObjectIdentifiers.DENSE_FOREST,
    clickType: 1,
    location: { x: 2272, y: 3191, z: 0 },
    definition: { getSizeX: () => 3, getSizeY: () => 2 },
    handled: false,
  };
  objectHooks[0](event);
  assert.equal(event.handled, true);
  assert.deepEqual(state.moves, [[2271, 3191, 0]], 'crosses from the east edge to the west edge of the rotated 2×3 obstacle');
});

test('Regicide routes the Meilyr dense forest from outside its footprint in both directions', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const routeHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : prop === 'onObjectRoute'
        ? (handler) => routeHooks.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const forest = {
    getLocation: () => ({ getX: () => 2302, getY: () => 3214, getZ: () => 0 }),
    getFace: () => 0,
  };
  const route = (source) => {
    const event = {
      object: forest,
      objectId: api.core.ObjectIdentifiers.DENSE_FOREST,
      sourceLocation: source,
      destination: null,
    };
    routeHooks.at(-1)(event);
    return event.destination;
  };
  assert.deepEqual(route({ x: 2299, y: 3215, z: 0 }), { x: 2301, y: 3215, z: 0 });
  assert.deepEqual(route({ x: 2307, y: 3215, z: 0 }), { x: 2305, y: 3213, z: 0 });

  const attributes = new Map([['quest.regicide.stage', 15]]);
  const cross = (x, y) => {
    const state = { moves: [] };
    const player = {
      getAttribute: (key) => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      getSkillManager: () => ({ getCurrentLevel: () => 99 }),
      getLocation: () => ({ getX: () => x, getY: () => y, getZ: () => 0 }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      sendMessage() {},
    };
    objectHooks.at(-1)({
      player,
      object: forest,
      objectId: api.core.ObjectIdentifiers.DENSE_FOREST,
      location: { x: 2302, y: 3214, z: 0 },
      definition: { getSizeX: () => 3, getSizeY: () => 2 },
      handled: false,
    });
    return state.moves;
  };
  assert.deepEqual(cross(2301, 3215), [[2305, 3213, 0]], 'west-to-east lands beyond the full forest footprint');
  assert.deepEqual(cross(2305, 3213), [[2301, 3215, 0]], 'east-to-west lands west of the footprint');
});

test('Regicide keeps the approach side clear when routing to the Isafdar leaf trap', () => {
  const { api: base } = mockApi();
  const routeHooks = [];
  const leaves = new Set([
    '2273,3173', '2274,3173', '2275,3173',
    '2273,3174', '2274,3174', '2275,3174',
    '2273,3175', '2274,3175', '2275,3175',
  ]);
  const core = { ...base.core };
  core.ObjectManager = {
    objectsAt: (location) => leaves.has(`${location.getX()},${location.getY()}`)
      ? [{ getId: () => core.ObjectIdentifiers.LEAVES }]
      : [],
  };
  core.MapObjects = { mapObjects: new Map(), getHash: () => 0 };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core'
      ? core
      : prop === 'onObjectRoute'
        ? (handler) => routeHooks.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const event = {
    objectId: core.ObjectIdentifiers.LEAVES,
    object: { getLocation: () => ({ getX: () => 2273, getY: () => 3175, getZ: () => 0 }) },
    sourceLocation: { x: 2274, y: 3176, z: 0 },
    destination: null,
  };
  routeHooks.at(-1)(event);
  assert.deepEqual(event.destination, { x: 2274, y: 3176, z: 0 }, 'north approach remains outside the whole 3×3 trap');
});

test('Regicide supports both cache Log balance endpoints on the Isafdar bridge', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  const run = (objectX, sourceX) => {
    const state = { moves: [], animations: [] };
    const player = {
      getLocation: () => ({ getX: () => sourceX, getY: () => 3250, getZ: () => 0 }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      performAnimation: (animation) => state.animations.push(animation.getId()),
    };
    const event = {
      player, objectId: api.core.ObjectIdentifiers.LOG_BALANCE_10, option: 'Cross',
      location: { x: objectX, y: 3250, z: 0 }, sourceLocation: { x: sourceX, y: 3250, z: 0 }, handled: false,
    };
    interact(event);
    assert.equal(event.handled, true);
    assert.deepEqual(state.animations, [762]);
    return state.moves;
  };
  assert.deepEqual(run(2259, 2258), [[2259, 3250, 0]], 'western endpoint steps onto the balance');
  assert.deepEqual(run(2259, 2260), [[2258, 3250, 0]], 'western endpoint returns to the west bank');
  assert.deepEqual(run(2263, 2262), [[2264, 3250, 0]], 'eastern endpoint steps onto the east bank');
  assert.deepEqual(run(2263, 2264), [[2262, 3250, 0]], 'eastern endpoint returns to the balance');
  const unrelated = { player: {}, objectId: api.core.ObjectIdentifiers.LOG_BALANCE_10,
    option: 'Cross', location: { x: 2259, y: 3251, z: 0 }, handled: false };
  interact(unrelated);
  assert.equal(unrelated.handled, false, 'the handler is limited to the verified bridge placements');
});

test('Regicide leaves completed Well of Voyage crossings to the shared loc route', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const attributes = new Map([['quest.regicide.stage', 15]]);
  const moves = [];
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getLocation: () => ({ getX: () => 2340, getY: () => 9623, getZ: () => 0 }),
    moveTo: (destination) => moves.push([destination.getX(), destination.getY(), destination.getZ()]),
    sendMessage() {},
  };
  const event = {
    player,
    objectId: api.core.ObjectIdentifiers.WELL_9,
    location: { x: 2341, y: 9622, z: 0 },
    handled: false,
  };

  for (const handler of handlers.objects) handler(event);

  assert.equal(event.handled, false, 'the native Well of Voyage route can handle the completed-quest traversal');
  assert.deepEqual(moves, []);
});

test('completed Underground Pass leaves Iban temple doors to normal door handling', () => {
  const { api, handlers, quest, player } = questScene('UndergroundPass');
  quest.setStage(player, 10);
  const event = { player, objectId: api.core.ObjectIdentifiers.DOOR_109, handled: false };

  handlers.custom.get('door:toggle').forEach((handler) => handler(event));

  assert.equal(event.handled, false, 'completed players do not need the unsaved history bit');
});

test('Underground Pass bridge jumps move to the far bank', () => {
  const { api, handlers, quest, player, tile } = questScene('UndergroundPass');
  quest.setStage(player, 3);
  player.getSkillManager = () => ({ getCurrentLevel: () => 99 });
  const bridge = (id, x, y, start, face = 0) => {
    player.moveTo(tile(...start));
    const event = {
      player,
      objectId: id,
      object: { getFace: () => face },
      definition: { getSizeX: () => 1, getSizeY: () => 3 },
      location: { x, y, z: 1 },
      sourceLocation: { x: start[0], y: start[1], z: start[2] },
      handled: false,
    };
    handlers.objects.forEach((handler) => handler(event));
    assert.equal(event.handled, true);
    const landed = player.getLocation();
    return [landed.getX(), landed.getY(), landed.getZ()];
  };

  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    assert.deepEqual(bridge(3255, 2033, 4718, [2033, 4717, 1]), [2033, 4721, 1], 'south bank lands north of the span');
    assert.deepEqual(bridge(3254, 2033, 4701, [2033, 4704, 1], 2), [2033, 4700, 1], 'north bank lands south of the span');
  } finally {
    Math.random = originalRandom;
  }
});

test('Regicide leaf and stick traps use Agility checks and cross from the approached side', () => {
  const { api: base } = mockApi();
  const objectHooks = [];
  const leaves = new Set();
  for (let x = 2273; x <= 2275; x++) for (let y = 3173; y <= 3175; y++) leaves.add(`${x},${y}`);
  const core = { ...base.core, ObjectManager: { objectsAt: (location) =>
    leaves.has(`${location.getX()},${location.getY()}`) ? [{ getId: () => 3923 }] : [] } };
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core : prop === 'onObjectInteraction'
      ? (handler) => objectHooks.push(handler)
      : target[prop],
  });
  require('../plugins/quests/quests/Regicide.Quest')(api);
  const interact = objectHooks[0];
  const createPlayer = (agility, position) => {
    const state = { moves: [], hits: [] };
    const player = {
      getLocation: () => ({ getX: () => position.x, getY: () => position.y, getZ: () => 0 }),
      getSkillManager: () => ({ getCurrentLevel: () => agility }),
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => state.hits.push(hits) }) }),
      moveTo: (destination) => state.moves.push([destination.getX(), destination.getY(), destination.getZ()]),
      sendMessage() {},
    };
    return { player, state };
  };
  const event = (player, objectId, option, location, sourceLocation) => ({ player, objectId,
    clickType: 1, location, sourceLocation, definition: { getActions: () => [option] }, handled: false });
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const leafRunner = createPlayer(99, { x: 2274, y: 3176 });
    const leafCrossing = event(leafRunner.player, 3923, 'Jump', { x: 2274, y: 3175, z: 0 }, { x: 2274, y: 3176, z: 0 });
    interact(leafCrossing);
    assert.equal(leafCrossing.handled, true);
    assert.deepEqual(leafRunner.state.moves, [[2274, 3172, 0]], 'the full 3×3 leaf pit is crossed southward');

    Math.random = () => 0.99;
    const stickRunner = createPlayer(99, { x: 2301, y: 3190 });
    const stickCrossing = event(stickRunner.player, 3922, 'Pass', { x: 2300, y: 3190, z: 0 }, { x: 2301, y: 3190, z: 0 });
    interact(stickCrossing);
    assert.equal(stickCrossing.handled, true);
    assert.equal(stickRunner.state.hits[0][0].getDamage(), 8);
    assert.deepEqual(stickRunner.state.moves, [[2302, 3190, 0]], 'a failed stick pass knocks the player back');
  } finally {
    Math.random = originalRandom;
  }
});

test("Mourning's End I last teleport crystal charge becomes a saveable seed", () => {
  const { api: base } = mockApi();
  const itemActions = new Map();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemAction'
      ? (name, actions) => itemActions.set(name, actions)
      : target[prop],
  });
  require('../plugins/quests/quests/MourningsEndPartI.Quest')(api);
  const items = new Map([[6102, 1]]);
  const moved = [];
  const messages = [];
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    deleteNumber(id, amount) {
      const left = (items.get(id) ?? 0) - amount;
      if (left > 0) items.set(id, left); else items.delete(id);
      return true;
    },
    adds(id, amount) { items.set(id, (items.get(id) ?? 0) + amount); return true; },
  };
  const player = {
    getInventory: () => inventory,
    moveTo: (location) => moved.push([location.getX(), location.getY(), location.getZ()]),
    sendMessage: (message) => messages.push(message),
  };
  const event = { player, itemId: 6102, handled: false };
  itemActions.get('Teleport crystal (1)').Lletya(event);
  assert.equal(event.handled, true);
  assert.equal(items.get(6102), undefined);
  assert.equal(items.get(6103), 1);
  assert.equal(items.has(undefined), false, 'a depleted crystal must not add an undefined item id');
  assert.ok([...items.keys()].every(Number.isFinite));
  assert.deepEqual(moved, [[2352, 3170, 0]]);
  assert.equal(messages.length, 1);

});


function questScene(name) {
  const { api, handlers } = mockApi();
  require(`../plugins/quests/quests/${name}.Quest`)(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const attributes = new Map();
  const items = new Map();
  const messages = [];
  let location;
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    isFull: () => false,
    adds: (id, amount) => items.set(id, inventory.getAmount(id) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, inventory.getAmount(id) - amount)),
  };
  const sender = new Proxy({}, { get: () => () => sender });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getInventory: () => inventory,
    getPacketSender: () => sender,
    getUsername: () => 'QuestTester',
    getPrivateArea: () => null,
    isPlayer: () => true,
    getAsPlayer: () => player,
    getLocation: () => location,
    moveTo: (tile) => { location = tile; },
    sendMessage: (text) => messages.push(text),
  };
  const tile = (x, y, z = 0) => new api.core.Location(x, y, z);
  return { api, handlers, quest, player, items, messages, tile };
}

test('manor front doors close after entry and the back door crosses both ways', () => {
  const { api, handlers, player, tile, messages } = questScene('ErnestTheChicken');
  const { ObjectIdentifiers: O, GameObject } = api.core;
  const open = (id, x, y, face, from) => {
    player.moveTo(from);
    const object = new GameObject(id, tile(x, y), 0, face);
    const route = { player, object, objectId: id, sourceLocation: { x: from.getX(), y: from.getY(), z: 0 } };
    handlers.route.forEach((h) => h(route));
    assert.ok(route.destination);
    player.moveTo(tile(route.destination.x, route.destination.y));
    const event = { player, object, objectId: id, location: { x, y, z: 0 }, clickType: 1,
      definition: { getInteractions: () => ['Open'] } };
    handlers.custom.get('door:toggle').forEach((h) => h(event));
    if (!event.handled) handlers.object.forEach((h) => h(event));
    assert.equal(event.handled, true);
    return [player.getLocation().getX(), player.getLocation().getY()];
  };
  for (const [id, x] of [[O.LARGE_DOOR_5, 3108], [O.LARGE_DOOR_6, 3109]]) {
    assert.deepEqual(open(id, x, 3353, 1, tile(x, 3353)), [x, 3354]);
    assert.match(messages.at(-1), /slam shut/);
    assert.deepEqual(open(id, x, 3353, 1, tile(x, 3354)), [x, 3354]);
    assert.match(messages.at(-1), /another way out/);
  }
  assert.deepEqual(open(O.DOOR_15, 3123, 3361, 3, tile(3123, 3360)), [3123, 3362]);
  assert.deepEqual(open(O.DOOR_15, 3123, 3361, 3, tile(3123, 3361)), [3123, 3360]);
});

test('fortress sturdy doors and secret walls can be crossed and recrossed from their own tile', () => {
  const { api, handlers, quest, player, tile } = questScene('BlackKnightsFortress');
  const { ObjectIdentifiers: O, GameObject } = api.core;
  for (const stage of [1, 2, 3]) {
    quest.setStage(player, stage);
    for (const [id, x, y, face, option] of [
      [O.STURDY_DOOR_2, 3025, 3511, 2, 'Open'],
      [O.WALL_8, 3016, 3517, 3, 'Push'],
      [O.WALL_8, 3030, 3510, 3, 'Push'],
    ]) {
      const object = new GameObject(id, tile(x, y, 1), 0, face);
      const axis = face === 2 ? 'x' : 'y';
      for (const side of [-1, 0, 1]) {
        const from = { x, y, z: 1, [axis]: (axis === 'x' ? x : y) + side };
        player.moveTo(tile(from.x, from.y, from.z));
        const route = { player, object, objectId: id, sourceLocation: from };
        handlers.route.forEach((h) => h(route));
        player.moveTo(tile(route.destination.x, route.destination.y, 1));
        const event = { player, object, objectId: id, location: { x, y, z: 1 }, clickType: 1,
          definition: { getInteractions: () => [option] } };
        handlers.object.forEach((h) => h(event));
        const direction = side || (face === 2 ? -1 : 1);
        assert.equal(player.getLocation()[axis === 'x' ? 'getX' : 'getY'](), (axis === 'x' ? x : y) - direction);
        assert.equal(event.handled, true);
      }
    }
  }
});

test('Prince Ali key print and bronze bar go to Osman, then Leela gives the key', () => {
  const { api, handlers, quest, player, items } = questScene('PrinceAliRescue');
  const { ItemIdentifiers: I, NpcIdentifiers: N } = api.core;
  quest.setStage(player, 20);
  items.set(I.KEY_PRINT, 1);
  const give = () => handlers.itemOnNpc.forEach((h) => h({ player, npcId: N.OSMAN_9, itemId: I.KEY_PRINT }));
  give();
  assert.equal(items.get(I.KEY_PRINT), 1, 'missing bronze must not consume the print');
  assert.equal(quest.getStage(player), 20);
  items.set(I.BRONZE_BAR, 1);
  give();
  assert.equal(quest.getStage(player), 21);
  assert.equal(items.get(I.KEY_PRINT), 0);
  assert.equal(items.get(I.BRONZE_BAR), 0);
  assert.match(quest.buildJournal(player, quest).join('\n'), /collect the bronze key from.*Leela/);
  const event = { player, npcId: N.LEELA, stepId: 'NVdPNU' };
  handlers.custom.get('npc-dialogue:action').forEach((h) => h(event));
  assert.equal(quest.getStage(player), 22);
  assert.equal(items.get(I.BRONZE_KEY), 1);
  handlers.custom.get('npc-dialogue:action').forEach((h) => h(event));
  assert.equal(items.get(I.BRONZE_KEY), 1, 'replaying the handoff must not duplicate the key');
});


test('all four Surok elemental surges launch from his reachable tile', () => {
 const {api}=mockApi(),created=[],L=api.core.Location;
 api.core={...api.core,PrivateArea:class{enter(){}},CombatSpells:{...api.core.CombatSpells,FIRE_SURGE:{castAnimation:()=>null,castProjectile:()=>null}}};
 const location=new L(4145,4850,2),combat={getLastAttack:()=>({reset(){}})};
 const npc=(id)=>({getId:()=>id,getLocation:()=>location,getHitpoints:()=>1,getCombat:()=>combat,performAnimation(){},forceChat(){},setMaxHitpoints(){return this;},setHitpoints(){return this;},setScriptedMovement(){},getMovementQueue:()=>({setBlockMovement(){}})});
 api.spawnNpc=spec=>{created.push(spec);return npc(spec.id);};
 const player={getLocation:()=>new L(4135,4850,2),getHitpoints:()=>99,getPrayerActive:()=>[],getCombat:()=>({getHitQueue:()=>({addPendingDamage(){}})})};
 const f=require('../plugins/quests/wgs/Surok.WhileGuthixSleeps')({api});
 const room=new f.SurokArea(player);room.boss=npc(13482);room.enemies.add(room.boss);room.started=true;room.specials=2;room.specialAt=1;room.nextAttack=0;room.process(player);
 assert.equal(created.length,4);for(const spell of created){assert.ok([13505,13506,13507,13508].includes(spell.id));assert.deepEqual([spell.x,spell.y,spell.z],[4145,4850,2]);}
});

function bloodBridgeFixture() {
 const {api}=mockApi(),attrs=new Map(),items=new Map(),eq=[];let tick=0,progress=70,allowed=true,free=28;const scenes=[];
 api.core={...api.core,World:{getProcessCycle:()=>tick},PrivateArea:class{enter(m){m.area=this;}leave(m,logout){this.postLeave(m,logout);m.area=null;}postLeave(){}}};
 const player={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),getInventory:()=>({contains:id=>items.has(id),getFreeSlots:()=>free,adds:(id,n)=>items.set(id,n)}),getEquipment:()=>({contains:id=>eq.some(i=>i?.getId()===id),getItems:()=>eq}),getCombat:()=>({reset(){}}),moveTo:l=>player.position=l,sendMessage(){},getDialogueManager:()=>({isActive:()=>false})};
 api.spawnNpc=spec=>({getOwner:()=>spec.owner,getHitpoints:()=>1,setMaxHitpoints(){return this;},setHitpoints(){return this;},setScriptedMovement(){},getMovementQueue:()=>({setBlockMovement(){}})});api.removeNpc=()=>{};
 const f=require('../plugins/quests/bmr/Bridge.TheBloodMoonRises')({api,stage:()=>progress,attribute:'bridge',ready:()=>allowed,play:(...args)=>scenes.push(args)});
 return {api,player,f,attrs,items,eq,scenes,advance:n=>tick+=n,setStage:n=>progress=n,setReady:v=>allowed=v,setFree:v=>free=v};
}

test('bridge handoff checks quest readiness and inventory before creating the encounter',()=>{
 const t=bloodBridgeFixture();t.setStage(60);assert.equal(t.f.start(t.player),false);t.setStage(70);t.setReady(false);assert.equal(t.f.start(t.player),false);t.setReady(true);t.setFree(1);assert.equal(t.f.start(t.player),false);assert.equal(t.items.size,0);assert.equal(t.attrs.size,0);
 t.setFree(2);assert.equal(t.f.start(t.player),true);assert.equal(t.items.get(t.api.core.ItemIdentifiers.SILVTHRILL_BALLISTA),1);assert.equal(t.items.get(t.api.core.ItemIdentifiers.SILVTHRILL_JAVELIN),100);assert.equal(t.f.start(t.player),false);
});

test('bridge portals require the owned silvthrill ranged hit; passive defence retries',()=>{
 const t=bloodBridgeFixture();t.f.start(t.player);const area=t.f.sessions.get(t.player);t.advance(5);area.process(t.player);const npc=[...area.cast][0];let damage=42,type=t.api.core.CombatType.RANGED;
 const hit={getAttacker:()=>t.player,getCombatType:()=>type,setTotalDamage:n=>damage=n};t.f.hit({npc,hit});assert.equal(damage,0);
 t.eq[t.api.core.Equipment.WEAPON_SLOT]=new t.api.core.Item(t.api.core.ItemIdentifiers.SILVTHRILL_BALLISTA);t.f.hit({npc,hit});assert.equal(damage,1);type=t.api.core.CombatType.MAGIC;t.f.hit({npc,hit});assert.equal(damage,0);
 const event={target:npc,attacker:t.player};t.f.roll(event);assert.equal(event.forceAccurate,true);
 t.attrs.set('bridge',{phase:'bridge',integrity:60,shots:0});area.process(t.player);assert.equal(t.attrs.get('bridge').integrity,100);assert.equal(t.scenes.length,0);
});

test('bridge qualification falls back only at zero and portal kills cannot count twice',()=>{
 const t=bloodBridgeFixture();t.f.start(t.player);const area=t.f.sessions.get(t.player);
 for(let i=0;i<3;i++){t.advance(10);area.process(t.player);const npc=[...area.cast][0];t.f.death({npc,killer:t.player});t.f.death({npc,killer:t.player});}
 assert.equal(t.attrs.get('bridge').shots,3);t.attrs.get('bridge').integrity=60;area.process(t.player);assert.equal(t.attrs.get('bridge').qualified,true);assert.equal(t.scenes.length,0);t.attrs.get('bridge').integrity=0;area.process(t.player);assert.equal(t.scenes.length,1);assert.equal(t.scenes[0][2],'drakan-s-siege-upon-reaching-0-defender-integrity');assert.equal(t.f.finish(t.player),true);assert.equal(t.f.sessions.has(t.player),false);assert.deepEqual([t.player.position.getX(),t.player.position.getY(),t.player.position.getZ()],[3168,7855,1]);
});

test('silvthrill ballista uses its actual javelins through the shared ranged checks',()=>{
 const {RangedWeapon,Ammunition}=require('../dist/game/content/combat/ranged/RangedData');const {Item,Equipment,ItemIdentifiers:I}=PluginManager.getCoreApi(),eq=[];eq[Equipment.WEAPON_SLOT]=new Item(I.SILVTHRILL_BALLISTA);eq[Equipment.AMMUNITION_SLOT]=new Item(I.SILVTHRILL_JAVELIN,100);const p={getEquipment:()=>({getItems:()=>eq})};
 assert.deepEqual(RangedWeapon.getFor(p).getAmmunitionData(),[Ammunition.getFor(p)]);assert.equal(Ammunition.getFor(p).getItemId(),I.SILVTHRILL_JAVELIN);
});

test('Blood Moon palace spawns usable preparation NPCs once and removes them on departure',()=>{
 const {api}=mockApi(),cast=[],removed=[],attrs=new Map();let progress=60;
 api.spawnNpc=spec=>{const npc={...spec,transformed:spec.id,getId:()=>spec.id,setScriptedMovement(){},getMovementQueue:()=>({setBlockMovement(){}}),setNpcTransformationId(id){npc.transformed=id;}};cast.push(npc);return npc;};api.removeNpc=n=>removed.push(n);
 const player={getAttribute:k=>attrs.get(k)};const f=require('../plugins/quests/bmr/Palace.TheBloodMoonRises')({api,stage:()=>progress,preparationAttribute:'prep'});
 f.sync(player);f.sync(player);assert.equal(cast.length,4);assert.ok(cast.every(n=>n.owner===player&&n.ownerOnly&&n.z===1));assert.deepEqual(cast.map(n=>[n.x,n.y]),[[3157,7841],[3157,7839],[3175,7834],[3168,7828]]);
 attrs.set('prep',{stewFed:true});f.sync(player);assert.equal(cast[0].transformed,api.core.NpcIdentifiers.SAFALAAN_HALLOW_12);progress=70;f.sync(player);assert.equal(removed.length,4);assert.equal(f.residents.has(player),false);
});

test('bridge uses the actual cache palace exit and lets a full-inventory handoff retry',()=>{
 const t=bloodBridgeFixture();t.setFree(0);assert.equal(t.f.start(t.player),false);t.setFree(2);assert.equal(t.f.doors({player:t.player,objectId:t.api.core.ObjectIdentifiers.DOORS_46,location:{x:3167,y:7860,z:1}}),true);assert.ok(t.f.sessions.has(t.player));
});

test('Blood Moon native bitfield mapping reveals preparations and survives relog without changing quest stage',()=>{
 const {api}=mockApi();require('../plugins/quests/quests/TheBloodMoonRises.Quest')(api);const runtime=require('../plugins/quests/QuestRuntime'),quest=runtime.getRegisteredQuests().filter(q=>q.key==='the_blood_moon_rises').at(-1),attrs=new Map(),bits=new Map();const sender=new Proxy({}, {get:(_,key)=>key==='sendVarbit'?(id,n)=>bits.set(id,n):()=>sender});const player={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),getPacketSender:()=>sender};
 quest.setStage(player,60);assert.equal(quest.getStage(player),60);assert.equal(bits.get(15464),102);bits.clear();runtime.sendQuestVarps({player});assert.equal(bits.get(15464),102);quest.setStage(player,70);assert.equal(bits.get(15464),116);
 attrs.set('quest.the_blood_moon_rises.preparations',{stewFed:true});quest.setStage(player,60);assert.equal(bits.get(15464),110);
 attrs.set('quest.the_blood_moon_rises.preparations',{flail:true,stakes:true});quest.setStage(player,60);assert.equal(bits.get(15464),114);
 attrs.set('quest.the_blood_moon_rises.siege-defence',{phase:'hall'});quest.setStage(player,70);assert.equal(bits.get(15464),120);
 bits.clear();runtime.sendQuestVarps({player});assert.equal(bits.get(15464),120);assert.equal(quest.getStage(player),70);
 quest.setStage(player,110);assert.equal(bits.get(15464),176);assert.equal(quest.isComplete(player),true);
});

test('Blood Moon preparation exit allows gathering leaves before the defence is ready',()=>{
 const t=bloodBridgeFixture();t.setStage(60);t.setReady(false);assert.equal(t.f.doors({player:t.player,objectId:t.api.core.ObjectIdentifiers.DOORS_46,location:{x:3167,y:7860,z:1}}),true);assert.deepEqual([t.player.position.getX(),t.player.position.getY(),t.player.position.getZ()],[2975,7683,0]);assert.equal(t.scenes.length,0);
});


test('completed Lunar Diplomacy players can replace a lost Seal of Passage from Brundt', () => {
  const { api: base } = mockApi();
  let talkToBrundt;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcInteraction'
      ? (handler) => { if (typeof handler === 'function') talkToBrundt = handler; }
      : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  let transcript;
  runtime.startTranscript = (...args) => { transcript = args.slice(3, 5); return true; };
  try {
    delete require.cache[require.resolve('../plugins/quests/quests/LunarDiplomacy.Quest')];
    require('../plugins/quests/quests/LunarDiplomacy.Quest')(api);
    const player = {
      getAttribute: (key) => key === 'quest.lunar_diplomacy.stage' ? 190 : 0,
      getInventory: () => ({ getAmount: () => 0 }),
    };
    const event = { player, npcId: api.core.NpcIdentifiers.BRUNDT_THE_CHIEFTAIN_6, clickType: 1, handled: false };
    assert.equal(talkToBrundt(event), true);
    assert.deepEqual(transcript, [
      'Lunar Diplomacy',
      'getting-started-talking-to-brundt-the-chieftain-after-losing-the-seal-of-passage',
    ]);
    assert.equal(event.handled, true);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
});


test('Fremennik Exiles yields Longhall Brundt to Lunar Seal recovery before its start menu', () => {
  const { api: base } = mockApi();
  let brundtTalk;
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => {
        if (name === 'Brundt the Chieftain') brundtTalk = options['Talk-to'];
      };
      if (prop === 'emitCustomEvent') return (name, request) => {
        if (name === 'quest:is-complete') request.complete = request.key === 'lunar_diplomacy';
      };
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/TheFremennikExiles.Quest')];
  require('../plugins/quests/quests/TheFremennikExiles.Quest')(api);
  const player = {
    getAttribute: () => 0,
    getInventory: () => ({ getAmount: () => 0 }),
  };
  const event = { player, npcId: api.core.NpcIdentifiers.BRUNDT_THE_CHIEFTAIN_6, clickType: 1, handled: false };
  assert.equal(brundtTalk(event), false);
  assert.equal(event.handled, false, 'the later Lunar Diplomacy hook can play its replacement transcript');
});


test('an unlocked Troll Stronghold storeroom door falls through to the shared door toggler', () => {
  const { api: base } = mockApi();
  let objectHandler;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (handler) => { objectHandler = handler; }
      : target[prop],
  });
  delete require.cache[require.resolve('../plugins/quests/quests/EadgarsRuse.Quest')];
  require('../plugins/quests/quests/EadgarsRuse.Quest')(api);
  const player = { getAttribute: (key) => key === 'quest.eadgars_ruse.stage' ? 110 : 0 };
  const event = { player, objectId: api.core.ObjectIdentifiers.STOREROOM_DOOR, handled: false };
  objectHandler(event);
  assert.equal(event.handled, false, 'the quest plugin leaves an unlocked door for Doors.plugin.js to open');
});


test('the Sphinx replaces a lost normal catspeak amulet for a cat guardian after Icthlarin’s Little Helper', () => {
  const handlers = { conditions: [], custom: new Map() };
  const { api: base } = mockApi();
  let cats = [];
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcDialogueCondition') return (handler) => handlers.conditions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => handlers.custom.set(name, [...(handlers.custom.get(name) ?? []), handler]);
      if (prop === 'getWorld') return () => ({ getNpcs: () => cats });
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/TailOfTwoCats.Quest')];
  require('../plugins/quests/quests/TailOfTwoCats.Quest')(api);
  const attrs = new Map([['quest.ictlharins_little_helper.stage', 70]]);
  const inventory = new Map();
  const messages = [];
  let wornAmulet = null;
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - inventory.size,
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    getEquipment: () => ({ get: () => wornAmulet }),
    sendMessage: (message) => messages.push(message),
  };
  cats = [{ getOwner: () => player, getId: () => api.core.NpcIdentifiers.CAT }];
  const lostCondition = {
    npcId: api.core.NpcIdentifiers.SPHINX,
    player,
    text: 'If the player lost the amulet of catspeak:',
  };
  const resolve = () => handlers.conditions.map((handler) => handler(lostCondition)).find((value) => value !== null);

  assert.equal(resolve(), true, 'a cat guardian who finished the prerequisite can recover the amulet');
  const wornCondition = { npcId: api.core.NpcIdentifiers.SPHINX, player, text: 'If a catspeak amulet is worn:' };
  const notWornCondition = { ...wornCondition, text: 'If a catspeak amulet is not worn:' };
  const answer = (condition) => handlers.conditions.map((handler) => handler(condition)).find((value) => value !== null);
  assert.equal(answer(wornCondition), false);
  assert.equal(answer(notWornCondition), true);
  wornAmulet = { getId: () => api.core.ItemIdentifiers.CATSPEAK_AMULET };
  assert.equal(answer(wornCondition), true);
  assert.equal(answer(notWornCondition), false);
  wornAmulet = null;
  inventory.set(api.core.ItemIdentifiers.CATSPEAK_AMULET_E_, 1);
  assert.equal(resolve(), false, 'the recovery choice is hidden while either catspeak amulet is held');
  inventory.clear();
  cats = [];
  assert.equal(resolve(), false, 'the Sphinx requires a cat follower');
  cats = [{ getOwner: () => player, getId: () => api.core.NpcIdentifiers.CAT }];
  attrs.set('quest.ictlharins_little_helper.stage', 0);
  assert.equal(resolve(), false, 'the Sphinx recovery is gated on the completed prerequisite');
  attrs.set('quest.ictlharins_little_helper.stage', 70);

  for (const handler of handlers.custom.get('npc-dialogue:action') ?? []) {
    const event = { kind: 'message', player, stepId: 'vA_xBM', text: 'The Sphinx hands you an amulet of catspeak.', handled: false };
    handler(event);
    assert.equal(event.handled, true);
  }
  assert.equal(inventory.get(api.core.ItemIdentifiers.CATSPEAK_AMULET), 1, 'the transcript action grants the normal amulet');
  assert.match(messages.at(-1), /hands you an amulet of catspeak/);
});


test('Gertrude sells a replacement kitten for 100 coins after her quest', () => {
  const handlers = { conditions: [], custom: new Map() };
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcDialogueCondition') return (handler) => handlers.conditions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => handlers.custom.set(name, [...(handlers.custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  delete require.cache[require.resolve('../plugins/quests/quests/GertrudesCat.Quest')];
  require('../plugins/quests/quests/GertrudesCat.Quest')(api);
  const attrs = new Map([['quest.gertrudes_cat.stage', 6]]);
  const inventory = new Map([[api.core.ItemIdentifiers.COINS, 123]]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      isFull: () => inventory.size >= 28,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
    }),
    sendMessage() {},
  };
  const gertrude = { npcId: api.core.NpcIdentifiers.GERTRUDE, player, text: 'If the player has at least 100 coins:' };
  assert.equal(handlers.conditions.map((handler) => handler(gertrude)).find((value) => value !== null), true);
  const event = { player, npcId: api.core.NpcIdentifiers.GERTRUDE, stepId: 'Q44J0B', handled: false };
  for (const handler of handlers.custom.get('npc-dialogue:action') ?? []) handler(event);
  assert.equal(event.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.COINS), 23);
  assert.equal(inventory.get(api.core.ItemIdentifiers.PET_KITTEN), 1);
});


test('Ratcatchers restores the missing kitten menu branch from Gertrude’s transcript', () => {
  const { restoreGertrudeKittenOption } = require('../plugins/quests/quests/Ratcatchers.Quest')._test;
  const transcripts = require('../data/definitions/npc-dialogues.json');
  const source = transcripts.Ratcatchers.variants['talking-to-gertrude-talking-to-gertrude-again-after-starting-the-quest'];
  const find = (steps) => {
    for (const step of steps ?? []) {
      const option = (step.options ?? []).find((entry) => entry.text === 'Do you have any more kittens?');
      if (option) return option;
      for (const nested of step.options ?? []) {
        const match = find(nested.steps);
        if (match) return match;
      }
      const match = find(step.steps);
      if (match) return match;
    }
    return null;
  };
  const before = find(source);
  assert.equal(before.steps, undefined, 'the Ratcatchers export omits this option branch');
  const restored = restoreGertrudeKittenOption(source);
  const option = find(restored);
  assert.ok(option.steps.some((step) => step.player === 'Do you have any more kittens?'));
  assert.ok(option.steps.some((step) => step.type === 'condition' && step.text.includes('at least 100 coins')));
  assert.equal(JSON.stringify(option.steps).includes('Q44J0B'), true, 'the purchase keeps Gertrude’s canonical hand-out action');
  assert.equal(before.steps, undefined, 'the canonical transcript data remains untouched');
});


test('Dragon Slayer II lets a cat guardian reach the Sphinx’s general amulet-recovery dialogue', () => {
  const { restoreSphinxGeneralTopic } = require('../plugins/quests/quests/DragonSlayerII.Quest')._test;
  const transcripts = require('../data/definitions/npc-dialogues.json');
  const source = transcripts['Dragon Slayer II'].variants['bob-the-cat-talking-to-the-sphinx'];
  const locate = (steps) => {
    for (const step of steps ?? []) {
      const option = (step.options ?? []).find((entry) => entry.text === 'Talk about something else.');
      if (option) return option;
      for (const nested of step.options ?? []) {
        const match = locate(nested.steps);
        if (match) return match;
      }
      const match = locate(step.steps);
      if (match) return match;
    }
    return null;
  };
  assert.equal(locate(source).steps, undefined, 'the DS2 export leaves the general-topic jump empty');
  const restored = restoreSphinxGeneralTopic(source);
  const option = locate(restored);
  const text = JSON.stringify(option.steps);
  assert.match(text, /Do you have a spare amulet of catspeak\?/);
  assert.match(text, /vA_xBM/);
});


test('Dragon Slayer II selects the Oneiromancer’s Robert-memory transcript only after the Sphinx sends Bob', () => {
  const { oneiromancerDialogueVariant } = require('../plugins/quests/quests/DragonSlayerII.Quest')._test;
  const before = { npcId: 3835, stage: 7, dreamProgress: 1, hasDreamPotion: false };
  assert.equal(oneiromancerDialogueVariant(before), null, 'the Oneiromancer transcript stays gated before the Sphinx completes her memory step');
  assert.equal(oneiromancerDialogueVariant({ ...before, dreamProgress: 2 }),
    'robert-the-strong-talking-to-the-oneiromancer-before-making-the-dream-potion');
  assert.equal(oneiromancerDialogueVariant({ ...before, dreamProgress: 2, hasDreamPotion: true }),
    'robert-the-strong-talking-to-the-oneiromancer-before-making-the-dream-potion-talking-to-her-after-making-the-dream-potion');
  assert.equal(oneiromancerDialogueVariant({ ...before, npcId: 12345, dreamProgress: 2 }), null);
});


test('Dragon Slayer II mirrors compact stages to the cache quest milestones in varbit 6104', () => {
  const { api } = mockApi();
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { getRegisteredQuests, sendQuestVarps } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((row) => row.key === 'dragon_slayer_ii').at(-1);
  const attributes = new Map();
  const varbits = new Map();
  const sender = new Proxy({}, { get: (_t, key) => (key === 'sendVarbit'
    ? (id, value) => (varbits.set(id, value), sender)
    : () => sender) });
  const player = { getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), getPacketSender: () => sender };

  quest.setStage(player, 1);
  assert.equal(varbits.get(6104), 5, 'after Alec, native stage 5 keeps Dallas visible at Musa Point');
  varbits.clear();
  sendQuestVarps({ player });
  assert.equal(varbits.get(6104), 5, 'the same native value is restored at login');
  quest.setStage(player, quest.completionValue);
  assert.equal(varbits.get(6104), 210, 'completion follows the native QuestHelper terminal stage');
});


test('Dragon Slayer II Brundt handler yields before the leader council stage', () => {
  const { api: base } = mockApi();
  let brundtTalk;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcInteraction'
      ? (name, options) => { if (name === 'Brundt the Chieftain') brundtTalk = options['Talk-to']; }
      : target[prop],
  });
  delete require.cache[require.resolve('../plugins/quests/quests/DragonSlayerII.Quest')];
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const player = { getAttribute: (key) => key === 'quest.dragon_slayer_ii.stage' ? 7 : 0 };
  const event = {
    player,
    npcId: api.core.NpcIdentifiers.BRUNDT_THE_CHIEFTAIN_6,
    definition: { getName: () => 'Brundt the Chieftain' },
  };
  assert.equal(brundtTalk(event), false, 'other quests may handle Longhall Brundt before the leader chapter');
});


test('Dragon Slayer II follows the cache blockage Investigate → Mine → Enter morphs', () => {
  const objectHandlers = [];
  const logins = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction' ? (handler) => objectHandlers.push(handler)
      : prop === 'onPlayerLogin' ? (handler) => logins.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { getRegisteredQuests } = require('../plugins/quests/QuestRuntime');
  const quest = getRegisteredQuests().filter((row) => row.key === 'dragon_slayer_ii').at(-1);
  const attributes = new Map();
  const varbits = new Map();
  const messages = [];
  const sender = new Proxy({}, { get: (_t, key) => (key === 'sendVarbit'
    ? (id, value) => (varbits.set(id, value), sender)
    : () => sender) });
  const player = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => sender,
    getInventory: () => ({ getAmount: (id) => id === 1265 ? 1 : 0 }),
    moveTo() {},
    sendMessage: (message) => messages.push(message),
  };
  quest.setStage(player, 3);
  const handle = objectHandlers[0];
  const atBlockage = { x: 2860, y: 9648, z: 0 };
  const click = (id, action) => handle({
    player, objectId: 29873, location: atBlockage, clickType: 1,
    definition: { id, getInteractions: () => [action] },
  });
  assert.equal(click(32165, 'Investigate'), true);
  assert.equal(varbits.get(6104), 16);
  assert.equal(click(32167, 'Mine'), true);
  assert.equal(varbits.get(6104), 17);
  assert.equal(click(32169, 'Enter'), true);
  assert.equal(quest.getStage(player), 4);
  assert.equal(varbits.get(6104), 17, 'native varbit 17 keeps the mural room at the correct quest stage');
  attributes.set('dragon-slayer-ii:crandor-blockage-progress', 25);
  quest.setStage(player, 3);
  varbits.clear();
  for (const login of logins) login({ player });
  assert.equal(varbits.get(6104), 17, 'the current transformed object state is restored at login');
  assert.equal(messages.length, 3);
});


test('Dragon Slayer II registers the Ungael Cave Enter action with a cache ID guard', () => {
  const { api: base } = mockApi();
  let caveActions;
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (name, actions) => { if (name === 'Cave') caveActions = actions; }
      : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  assert.equal(typeof caveActions?.Enter, 'function');

  const messages = [];
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 8]]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    sendMessage: (message) => messages.push(message),
  };
  const wrongCave = caveActions.Enter({
    player, objectId: api.core.ObjectIdentifiers.CAVE_62,
    definition: { id: api.core.ObjectIdentifiers.CAVE_62 + 1 },
    location: { x: 2248, y: 4077, z: 0 },
  });
  assert.equal(wrongCave, false, 'another Cave with Enter must fall through');

  const blocked = caveActions.Enter({
    player, objectId: api.core.ObjectIdentifiers.CAVE_62,
    definition: { id: api.core.ObjectIdentifiers.CAVE_62 },
    location: { x: 2248, y: 4077, z: 0 },
  });
  assert.equal(blocked, true, 'the actual Ungael cave consumes its locked entrance action');
  assert.match(messages.at(-1), /Vorkath blocks the way/);
});


test('Dragon Slayer II completes Veos boat travel after the narrated destination is chosen', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 8]]);
  let movedTo;
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    moveTo: (location) => { movedTo = [location.getX(), location.getY(), location.getZ()]; },
  };
  const choose = (option) => handlers.custom.get('npc-dialogue:choice').forEach((handler) =>
    handler({ player, npcId: api.core.NpcIdentifiers.VEOS_4, option }));
  const line = () => {
    const event = { player, npcId: api.core.NpcIdentifiers.VEOS_4, text: "As you wish, I hope you don't get seasick, it is a  long voyage." };
    handlers.custom.get('npc-dialogue:line').forEach((handler) => handler(event));
    event.after?.();
  };

  choose("I'd like to travel to Port Piscarilius, please.");
  line();
  assert.deepEqual(movedTo, [1825, 3691, 0]);
  assert.equal(attrs.get('dragon-slayer-ii:veos-travel-destination'), null);

  movedTo = undefined;
  choose("I'd like to travel to Land's End, please.");
  line();
  assert.deepEqual(movedTo, [1504, 3401, 0]);
});


test('Dragon Slayer II handles Veos direct cache travel options by their visible action', () => {
  const { api: base } = mockApi();
  const actions = [];
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcInteraction'
      ? (name, options) => { if (name === 'Veos') actions.push(options); }
      : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 8]]);
  let movedTo;
  const player = {
    getAttribute: (key) => attrs.get(key),
    moveTo: (location) => { movedTo = [location.getX(), location.getY(), location.getZ()]; },
    sendMessage: () => {},
  };
  const handler = actions[0]["Land's End"];
  assert.equal(typeof handler, 'function');
  const event = {
    player, npcId: api.core.NpcIdentifiers.VEOS_5, clickType: 3, handled: false,
    definition: { getActions: () => ['Talk-to', 'Port Piscarilius', "Land's End"] },
  };
  assert.equal(handler(event), true);
  assert.deepEqual(movedTo, [1504, 3401, 0]);
  assert.equal(handler({ ...event, npcId: api.core.NpcIdentifiers.VEOS_5 + 100 }), false);
  attrs.set('quest.dragon_slayer_ii.stage', 7);
  assert.equal(handler(event), false, 'the voyage is scoped to the DS2 key chapters');
});


test('Port Piscarilius spawns the cache-active Veos with both onward boat options', async () => {
  const spawn = require('../data/definitions/npc-spawns.json')
    .find(({ x, y, name }) => name === 'Veos' && x === 1825 && y === 3691);
  assert.equal(spawn?.id, 10724, '2147 is a null transform parent with no interaction options');
  const { CachePipeline } = require('../dist/game/cache/CachePipeline');
  const { CacheDefinitions } = require('../dist/game/cache/CacheDefinitions');
  await CachePipeline.initialize();
  const actions = CacheDefinitions.getNpc(spawn.id).actions;
  assert.equal(actions[0], 'Talk-to');
  assert.equal(actions[2], 'Port Piscarilius');
  assert.equal(actions[3], "Land's End");
});


test('Dragon Slayer II unlocks the northern Ungael exit from Vorkath completion on login', () => {
  const deaths = [];
  const logins = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onNpcDeath' ? (handler) => deaths.push(handler)
      : prop === 'onPlayerLogin' ? (handler) => logins.push(handler)
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const values = [];
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:ungael-trip', true],
  ]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getPacketSender: () => ({ sendVarbit: (id, value) => values.push([id, value]) }),
    sendMessage() {},
  };
  const npc = { getId: () => api.core.NpcIdentifiers.VORKATH_5 };
  deaths[0]({ killer: player, npc });
  assert.equal(attrs.get('dragon-slayer-ii:vorkath-defeated'), true);
  assert.deepEqual(values.at(-1), [6108, 30], 'the cache morph exposes the northern climb-over after Vorkath dies');
  values.length = 0;
  logins.forEach((handler) => handler({ player }));
  assert.deepEqual(values, [[6108, 30]], 'the climb-over stays open after relogging');
  attrs.set('dragon-slayer-ii:vorkath-defeated', false);
  logins.forEach((handler) => handler({ player }));
  assert.deepEqual(values.at(-1), [6108, 0], 'unfinished players see the blocked cache morph');
});


test('Dragon Slayer II locator orb points on eight compass directions and cannot kill its user', () => {
  const actions = new Map();
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onItemAction'
      ? (name, handlers) => actions.set(name, handlers)
      : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:morytania-step', 5],
    ['dragon-slayer-ii:locator-target', [10, 10]],
  ]);
  const inventory = new Map([[api.core.ItemIdentifiers.LOCATOR_ORB, 1], [api.core.ItemIdentifiers.SPADE, 1]]);
  const pending = [];
  const messages = [];
  let hitpoints = 99;
  const player = {
    getAttribute: (key) => attrs.get(key),
    getInventory: () => ({ getAmount: (id) => inventory.get(id) ?? 0, getFreeSlots: () => 20, adds: () => {} }),
    getLocation: () => ({ x: 0, y: 0, getX: () => 0, getY: () => 0 }),
    getHitpoints: () => hitpoints,
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pending.push(...hits) }) }),
    sendMessage: (message) => messages.push(message),
  };
  const orbAction = { player, handled: false };
  actions.get('Locator orb').Feel(orbAction);
  assert.equal(orbAction.handled, true, 'the quest action suppresses the item fallback');
  assert.match(messages.at(-1), /north-east/);
  assert.equal(pending.at(-1).getDamage(), 10);

  hitpoints = 4;
  actions.get('Locator orb').Feel({ player, handled: false });
  assert.equal(pending.at(-1).getDamage(), 3, 'orb damage stops at 1 hitpoint');
  const before = pending.length;
  hitpoints = 1;
  const lastOrbAction = { player, handled: false };
  actions.get('Locator orb').Feel(lastOrbAction);
  assert.equal(lastOrbAction.handled, true);
  assert.equal(pending.length, before, 'the orb never queues lethal damage');

  const digAction = { player, handled: false };
  actions.get('Spade').Dig(digAction);
  assert.equal(digAction.handled, true, 'wrong dig spots are handled by the quest');
});


test('Dragon Slayer II Fossil Island map caches yield all 24 distinct, reclaimable pieces', () => {
  const firstClicks = [];
  const interfaceClicks = [];
  const { api: base, handlers } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectFirstClick'
      ? (_objects, handler) => firstClicks.push(handler)
      : prop === 'onInterfaceActionClick' ? (handler) => interfaceClicks.push(handler)
      : target[prop],
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  runtime.startTranscript = originalStartTranscript;
  const attrs = new Map([['quest.dragon_slayer_ii.stage', 5]]);
  const amounts = new Map();
  const messages = [];
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: (id) => amounts.get(id) ?? 0,
      adds: (id, count) => amounts.set(id, (amounts.get(id) ?? 0) + count),
      deleteNumber: (id, count) => amounts.set(id, Math.max(0, (amounts.get(id) ?? 0) - count)),
      getFreeSlots: () => 28,
    }),
    sendMessage: (message) => messages.push(message),
  };
  const search = firstClicks.find((handler) => handler.toString().includes('MAP_SOURCES.find'));
  assert.equal(typeof search, 'function');
  const sources = [
    [29911, 3764, 3872, 0], [29912, 3766, 3873, 1], [29913, 3755, 3873, 0],
    [29914, 3764, 3861, 0], [29915, 3790, 3876, 0],
  ];
  for (const [objectId, x, y, z] of sources) assert.equal(search({ player, objectId, location: { x, y, z } }), true);
  const pieces = Array.from({ length: 24 }, (_, i) => (i === 0 ? api.core.ItemIdentifiers.MAP_PIECE : api.core.ItemIdentifiers[`MAP_PIECE_${i + 1}`]));
  assert.equal(pieces.reduce((sum, id) => sum + (amounts.get(id) ?? 0), 0), 24);
  assert.ok(pieces.every((id) => amounts.get(id) === 1), 'each source contributes its own distinct map scraps');
  search({ player, objectId: 29911, location: { x: 3764, y: 3872, z: 0 } });
  assert.equal(pieces.reduce((sum, id) => sum + (amounts.get(id) ?? 0), 0), 24, 'completed source does not duplicate pieces');
  amounts.set(pieces[0], 0);
  search({ player, objectId: 29911, location: { x: 3764, y: 3872, z: 0 } });
  assert.equal(amounts.get(pieces[0]), 1, 'a lost piece can be recovered before Dallas takes it');

  attrs.set('dragon-slayer-ii:fossil-map-handed-in', 0xffffff);
  const sentVarbits = new Map();
  const packet = new Proxy({}, { get: (_target, key) => (...args) => {
    if (key === 'sendVarbit') sentVarbits.set(args[0], args[1]);
    return packet;
  } });
  player.getPacketSender = () => packet;
  const mapCondition = handlers.condition.find((handler) => handler.toString().includes('rs8Q9u'));
  assert.equal(mapCondition({ player, stepId: 'rs8Q9u' }), false, 'handed-in pieces continue through the positive dialogue branch');
  assert.equal(mapCondition({ player, stepId: 'nJTruP' }), false, 'all 24 pieces suppress the incomplete branch');
  assert.equal(mapCondition({ player, stepId: 'LkwLY1' }), true, 'all 24 handed-in pieces unlock the map-completion choice');
  const mapAction = handlers.custom.get('npc-dialogue:action').find((handler) => handler.toString().includes('ACTION_MAP_COMPLETE'));
  const mapActionEvent = { player, stepId: 'dragon-slayer-ii:fossil-map-complete', handled: false, end: false };
  mapAction(mapActionEvent);
  assert.equal(attrs.get('dragon-slayer-ii:fossil-map-puzzle-ready'), true, 'the affirmative dialogue choice starts the puzzle');
  assert.equal(mapActionEvent.handled, true);
  assert.equal(mapActionEvent.end, true);
  assert.equal(sentVarbits.get(6104), 45, 'the native map loc morphs to its puzzle option after the choice');
    const openMap = firstClicks.find((handler) => handler.name === 'interactWithFossilMap');
    assert.equal(openMap({ player, objectId: 29910, definition: { id: 32443 }, location: { x: 3764, y: 3869, z: 0 } }), true,
      'the cache placement opens the map puzzle after the canonical completion choice morph');
    assert.equal(sentVarbits.get(6156), 2, 'the cache receives a shuffled tile position');
    assert.equal(sentVarbits.get(6166), 1, 'the cache receives a non-solved tile rotation');
    const clickPuzzle = interfaceClicks.at(-1);
    const encodeArgs = (values) => Buffer.from(values.flatMap((value) => {
      let encoded = (value << 1) ^ (value >> 31);
      const bytes = [];
      while (encoded > 0x7f) { bytes.push((encoded & 0x7f) | 0x80); encoded >>>= 7; }
      bytes.push(encoded);
      return bytes;
    }));
    const grid = (305 << 16) | 1;
    const editable = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35];
    const positions = attrs.get('dragon-slayer-ii:fossil-map-positions');
    const rotations = attrs.get('dragon-slayer-ii:fossil-map-rotations');
    for (const index of editable) {
      const target = editable.indexOf(index) + 1;
      if (positions[index] === target) continue;
      const from = positions.indexOf(target);
      clickPuzzle({ player, groupId: 305, action: 0, scriptTrigger: true, argsData: encodeArgs([grid, index, grid, from]) });
    }
    for (const index of editable) {
      while (rotations[index] !== 0) {
        clickPuzzle({ player, groupId: 305, action: 0, scriptTrigger: true, argsData: encodeArgs([2, grid, index]) });
      }
    }
  assert.equal(attrs.get('dragon-slayer-ii:fossil-map-solved'), true);
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 6, 'solving the native position/rotation puzzle unlocks the boat chapter');
});


test('Dragon Slayer II restores the Karamja plinth when its key piece was lost', () => {
  const objectHandlers = [];
  const objects = [];
  const { api: base } = mockApi();
  const objectManager = { register() {}, deregister() {} };
  const core = Object.assign({}, base.core, {
    ObjectManager: objectManager,
    TemplatedInstanceArea: class {
      constructor(width, height) { this.width = width; this.height = height; this.objects = []; }
      setChunk() {}
      enter() {}
      tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
      getBaseX() { return 8192; }
      getBaseY() { return 1600; }
      add(object) { this.objects.push(object); objects.push(object); }
      remove(object) { this.objects = this.objects.filter((entry) => entry !== object); }
      getName() { return 'Karamja test'; }
    },
  });
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'spawnNpc' ? () => null
        : prop === 'onObjectFirstClick' ? (...args) => {
          const handler = args.find((arg) => typeof arg === 'function');
          if (handler) objectHandlers.push(handler);
        }
          : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:key-parts', 1],
  ]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'Karamja recovery test',
    getInventory: () => ({ getAmount: () => 0 }),
    moveTo() {},
    sendMessage() {},
  };
  const enter = objectHandlers.find((handler) => handler.toString().includes('KARAMJA_START'));
  assert.equal(typeof enter, 'function');
  enter({ player, objectId: core.ObjectIdentifiers.CAVE_63, location: { x: 2943, y: 2894, z: 0 } });
  assert.equal(attrs.get('dragon-slayer-ii:key-parts'), 0, 'a stale possession bit cannot strand the player');
  assert.equal(objects.at(-1).getId(), core.ObjectIdentifiers.PLINTH_17, 'the piece becomes available again');
});


test('Dragon Slayer II laboratory copies every cache chunk containing its six notes', () => {
  const objectHandlers = [];
  const chunks = [];
  let dimensions;
  let spawn;
  const { api: base } = mockApi();
  const core = Object.assign({}, base.core, {
    TemplatedInstanceArea: class {
      constructor(width, height) { dimensions = [width, height]; }
      setChunk(plane, chunkX, chunkY, template) {
        if (plane === 0) chunks.push({ chunkX, chunkY, ...template });
      }
      enter() {}
      getBaseX() { return 8192; }
      getBaseY() { return 1600; }
      tile(x, y, z) { return { x: 8192 + x, y: 1600 + y, z }; }
      getName() { return 'Ungael lab test'; }
    },
  });
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (...args) => {
        const handler = args.find((arg) => typeof arg === 'function');
        if (handler) objectHandlers.push(handler);
      }
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:vorkath-defeated', true],
  ]);
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'Lab map test',
    moveTo: (location) => { spawn = location; },
    sendMessage() {},
  };
  const enter = objectHandlers[0];
  assert.equal(typeof enter, 'function');
  enter({ player, objectId: core.ObjectIdentifiers.CAVE_62, location: { x: 2248, y: 4077, z: 0 } });
  assert.deepEqual(dimensions, [6, 4]);
  assert.deepEqual(chunks[0], { chunkX: 0, chunkY: 0, sourceChunkX: 281, sourceChunkY: 1306, sourcePlane: 0, rotation: 0 });
  assert.deepEqual(chunks.at(-1), { chunkX: 5, chunkY: 3, sourceChunkX: 286, sourceChunkY: 1309, sourcePlane: 0, rotation: 0 });
  assert.deepEqual(spawn, { x: 8204, y: 1616, z: 0 }, 'the entrance lands at the cache lever and inside the expanded template');
});


test('Dragon Slayer II Ungael lever limits the key chest to its 30-tick window', () => {
  const objectHandlers = [];
  let cycle = 100;
  const { api: base } = mockApi();
  const core = Object.assign({}, base.core, {
    World: Object.assign({}, base.core.World, { getProcessCycle: () => cycle }),
    TemplatedInstanceArea: class {
      constructor() { this.x = 8192; this.y = 1600; }
      setChunk() {}
      enter() {}
      getBaseX() { return this.x; }
      getBaseY() { return this.y; }
      tile(x, y, z) { return { x: this.x + x, y: this.y + y, z }; }
      getName() { return 'Ungael lab test'; }
    },
  });
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'core' ? core
      : prop === 'onObjectInteraction' ? (...args) => {
        const handler = args.find((arg) => typeof arg === 'function');
        if (handler) objectHandlers.push(handler);
      }
        : target[prop],
  });
  require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  const { ItemIdentifiers: I, ObjectIdentifiers: O } = core;
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:vorkath-defeated', true],
  ]);
  const items = new Map();
  const messages = [];
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    getFreeSlots: () => 28 - [...items.values()].reduce((sum, amount) => sum + amount, 0),
    adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getUsername: () => 'Ungael lever test',
    getRunEnergy: () => 20,
    getInventory: () => inventory,
    moveTo() {},
    sendMessage: (message) => messages.push(message),
  };
  const generic = objectHandlers[0];
  assert.equal(typeof generic, 'function');
  generic({ player, objectId: O.CAVE_62, location: { x: 2248, y: 4077, z: 0 } });
  const lab = attrs.get('dragon-slayer-ii:instance-area');
  assert.ok(lab, 'the cave creates the player’s laboratory instance');
  const use = (objectId, x, y, option) => generic({
    player, objectId, location: { x, y, z: 0 }, clickType: 1,
    definition: { getInteractions: () => [option] },
  });
  use(O.LEVER_55, 8204, 1616, 'Pull');
  assert.ok(messages.includes('You pull the lever. A door opens somewhere to the east!'));
  cycle = 131;
  use(O.STONE_CHEST_3, 8236, 1618, 'Search');
  assert.equal(inventory.getAmount(I.DRAGON_KEY_PIECE_3), 0, 'an expired door cannot be looted');
  cycle = 200;
  use(O.LEVER_55, 8204, 1616, 'Pull');
  cycle = 203;
  use(O.STONE_CHEST_3, 8236, 1618, 'Search');
  assert.equal(inventory.getAmount(I.DRAGON_KEY_PIECE_3), 1);
  assert.equal(inventory.getAmount(I.ANCIENT_KEY), 1);
});


test('Dragon Slayer II Torfinn runs the cache quest dragons, checkpoints the waves, and changes Galvek phase', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const { api: base } = mockApi();
  const interactions = [];
  const deaths = [];
  const playerDeaths = [];
  const dialogueActions = [];
  const objectHandlers = [];
  const emittedRewards = [];
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => interactions.push({ name, options });
      if (prop === 'onNpcDeath') return (handler) => deaths.push(handler);
      if (prop === 'onPlayerDeath') return (handler) => playerDeaths.push(handler);
      if (prop === 'onObjectInteraction') return (handler) => { if (typeof handler === 'function') objectHandlers.push(handler); };
      if (prop === 'emitCustomEvent') return (name, payload) => { if (name === 'xpreward:open') emittedRewards.push(payload); };
      if (prop === 'onCustomEvent') return (name, handler) => {
        if (name === 'npc-dialogue:action') dialogueActions.push(handler);
      };
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const startTranscript = runtime.startTranscript;
  const transcriptRequests = [];
  runtime.startTranscript = (...args) => { transcriptRequests.push(args[4]); return true; };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
    const core = api.core;
    const attributes = new Map([['quest.dragon_slayer_ii.stage', 12]]);
    let at = new core.Location(1456, 2968, 0);
    const messages = [];
    const pendingHits = [];
    const supplies = new Map();
    const rewardXp = new Map();
    let inventoryCapacity = 28;
    const packet = new Proxy({}, { get: (_target, _key) => (..._args) => packet });
    const player = {
      isPlayer: () => true, getAsPlayer: () => player, getIndex: () => 987654, getUsername: () => 'quest-wave-test',
      getArea: () => null, setArea: () => {}, getLocation: () => at, moveTo: (location) => { at = location; },
      getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
      getPacketSender: () => packet, sendMessage: (message) => messages.push(message),
      getInventory: () => ({
        getAmount: (id) => supplies.get(id) ?? 0,
        getFreeSlots: () => inventoryCapacity - [...supplies.values()].filter((amount) => amount > 0).length,
        adds: (id, amount = 1) => supplies.set(id, (supplies.get(id) ?? 0) + amount),
        deleteNumber: (id, amount = 1) => supplies.set(id, Math.max(0, (supplies.get(id) ?? 0) - amount)),
      }),
      getHitpoints: () => 99, getRunEnergy: () => 100, setRunEnergy: () => {},
      getCombat: () => ({ getHitQueue: () => ({ addPendingDamage: (hits) => pendingHits.push(...hits) }) }),
      getSkillManager: () => ({
        decreaseCurrentLevel: () => {},
        addExperiences: (skill, amount) => rewardXp.set(skill, (rewardXp.get(skill) ?? 0) + amount),
        getExperience: (skill) => rewardXp.get(skill) ?? 0,
        addExperience: (skill, amount) => rewardXp.set(skill, (rewardXp.get(skill) ?? 0) + amount),
      }),
    };
    const torfinn = interactions.find(({ name }) => name === 'Torfinn').options['Talk-to'];
    torfinn({ player, npcId: core.NpcIdentifiers.TORFINN });
    dialogueActions.forEach((handler) => handler({ player, stepId: 'lXAPbM' }));
    assert.equal(attributes.get('dragon-slayer-ii:assault-defense-active'), true,
      'Torfinn’s yes response begins the ship-defense part');
    assert.deepEqual([at.getX(), at.getY(), at.getZ()], [1702, 5543, 1], 'the player boards Brundt’s ship');
    const area = attributes.get('dragon-slayer-ii:instance-area');
    const suppliesByObject = new Map([
      [core.ObjectIdentifiers.HAMMERS, core.ItemIdentifiers.HAMMER],
      [core.ObjectIdentifiers.WATER_CONTAINERS, core.ItemIdentifiers.WATER_CONTAINER],
      [core.ObjectIdentifiers.SWAMP_PASTE, core.ItemIdentifiers.SWAMP_PASTE_2],
      [core.ObjectIdentifiers.POTIONS, core.ItemIdentifiers.REVITALISATION_POTION],
    ]);
    const object = (objectId, location, option = 'Take') => objectHandlers[0]({
      player, objectId, location: { x: location.getX?.() ?? location.x, y: location.getY?.() ?? location.y, z: location.getZ?.() ?? location.z },
      clickType: 1, definition: { getInteractions: () => [option] },
    });
    for (const [objectId, itemId] of suppliesByObject) {
      object(objectId, { x: 1700, y: 5530, z: 1 });
      assert.equal(supplies.get(itemId), 1, `ship crate supplies item ${itemId}`);
    }
    for (let tick = 0; tick < 400; tick++) {
      area.process(player);
      for (const [key, damage] of [...area.assaultDamage]) {
        const [x, y, z] = key.split(',').map(Number);
        if (supplies.get(damage.item) === 0) {
          const crateId = [...suppliesByObject].find(([, itemId]) => itemId === damage.item)[0];
          object(crateId, { x: 1700, y: 5530, z: 1 });
        }
        object(damage.id, { x, y, z }, damage.action);
      }
    }
    assert.equal(attributes.get('dragon-slayer-ii:assault-defense-active'), false);
    assert.equal(attributes.get('dragon-slayer-ii:assault-ship-defended'), true);
    const wave = [core.NpcIdentifiers.RED_DRAGON_8, core.NpcIdentifiers.IRON_DRAGON_4,
      core.NpcIdentifiers.BRUTAL_GREEN_DRAGON_2, core.NpcIdentifiers.BLUE_DRAGON_12,
      core.NpcIdentifiers.GREEN_DRAGON_9, core.NpcIdentifiers.BLUE_DRAGON_13,
      core.NpcIdentifiers.GREEN_DRAGON_10, core.NpcIdentifiers.BLACK_DRAGON_12,
      core.NpcIdentifiers.STEEL_DRAGON_5, core.NpcIdentifiers.BRUTAL_RED_DRAGON_2,
      core.NpcIdentifiers.MITHRIL_DRAGON_2, core.NpcIdentifiers.ADAMANT_DRAGON_2,
      core.NpcIdentifiers.RUNE_DRAGON_3];
    for (let index = 0; index < 7; index++) {
      const dragon = attributes.get('dragon-slayer-ii:instance-boss');
      assert.equal(dragon.getId(), wave[index], `route opponent ${index + 1}`);
      deaths[0]({ killer: player, npc: dragon });
    }
    assert.equal(attributes.get('dragon-slayer-ii:assault-checkpoint'), 7);
    playerDeaths[0]({ player });
    torfinn({ player, npcId: core.NpcIdentifiers.TORFINN });
    dialogueActions.forEach((handler) => handler({ player, stepId: 'lXAPbM' }));
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getId(), wave[7], 'death resumes at the first grand-ship wave');
    for (let index = 7; index < wave.length; index++) {
      const dragon = attributes.get('dragon-slayer-ii:instance-boss');
      assert.equal(dragon.getId(), wave[index], `wave opponent ${index + 1}`);
      deaths[0]({ killer: player, npc: dragon });
    }
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 13);
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getId(), core.NpcIdentifiers.GALVEK_2);
    assert.equal(attributes.get('dragon-slayer-ii:instance-boss').getMaxHitpoints(), 1200);
    const battleArea = attributes.get('dragon-slayer-ii:instance-area');
    for (let tick = 0; tick < 7; tick++) battleArea.process(player);
    const galvek = attributes.get('dragon-slayer-ii:instance-boss');
    assert.equal(galvek.getNpcTransformationId(), core.NpcIdentifiers.GALVEK_2, 'phase one uses the fire form');
    assert.ok(messages.some((message) => message.includes('launches a fireball')));
    at = new core.Location(at.getX() + 2, at.getY(), at.getZ());
    for (let tick = 0; tick < 3; tick++) battleArea.process(player);
    assert.equal(pendingHits.length, 0, 'moving two tiles avoids Galvek’s lethal fireball');
    for (const [hitpoints, expected] of [[899, core.NpcIdentifiers.GALVEK_4], [599, core.NpcIdentifiers.GALVEK_3], [299, core.NpcIdentifiers.GALVEK_5]]) {
      galvek.setHitpoints(hitpoints);
      battleArea.process(player);
      assert.equal(galvek.getNpcTransformationId(), expected, `Galvek changes phase at ${hitpoints} hitpoints`);
    }
    deaths[0]({ killer: player, npc: galvek });
    assert.equal(attributes.get('dragon-slayer-ii:galvek-defeated'), true,
      'only Galvek’s death marks the final boss as defeated');
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 13,
      'the quest remains active until Alec receives the report');
    inventoryCapacity = [...supplies.values()].filter((amount) => amount > 0).length;
    dialogueActions.forEach((handler) => handler({ player, stepId: 'b5j1wa' }));
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 13,
      'Alec does not complete the quest if the Locator Orb will not fit');
    inventoryCapacity++;
    dialogueActions.forEach((handler) => handler({ player, stepId: 'b5j1wa' }));
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 14,
      'Alec’s final transcript action completes the quest');
    assert.equal(supplies.get(core.ItemIdentifiers.LOCATOR_ORB), 1,
      'completion returns the locator orb');
    assert.deepEqual([...rewardXp.entries()], [
      [core.Skill.SMITHING, 80000], [core.Skill.MINING, 60000],
      [core.Skill.AGILITY, 50000], [core.Skill.THIEVING, 50000],
    ], 'completion directly grants the fixed skill XP alongside the lamps');
    const ellen = interactions.find(({ name }) => name === 'Ellen').options['Talk-to'];
    const trainingAction = dialogueActions.find((handler) => handler.name === 'handleEllenTrainingAction');
    ellen({ player, npcId: core.NpcIdentifiers.ELLEN });
    assert.equal(transcriptRequests.at(-1), 'standard-dialogue', 'Ellen offers combat training after completion');
    for (let count = 0; count < 4; count++) {
      const training = { player, npcId: core.NpcIdentifiers.ELLEN, stepId: 'P2tord', handled: false };
      trainingAction(training);
      assert.equal(training.handled, true);
      assert.deepEqual(emittedRewards.at(-1).skills, [
        core.Skill.ATTACK, core.Skill.STRENGTH, core.Skill.DEFENCE, core.Skill.HITPOINTS,
        core.Skill.RANGED, core.Skill.MAGIC,
      ]);
      assert.match(emittedRewards.at(-1).onConfirm(core.Skill.RANGED, 'Ranged'), /25,000 Ranged XP/);
    }
    assert.equal(attributes.get('dragon-slayer-ii:ellen-training-rewards'), 4,
      'Ellen grants the four combat XP rewards one at a time');
    assert.equal(rewardXp.get(core.Skill.RANGED), 100000,
      'four Ellen training claims award 25,000 XP each');
    ellen({ player, npcId: core.NpcIdentifiers.ELLEN });
    assert.equal(transcriptRequests.at(-1), 'after-claiming-experience-rewards', 'Ellen retires after four rewards');
    const fifthTraining = { player, npcId: core.NpcIdentifiers.ELLEN, stepId: 'P2tord', handled: false };
    trainingAction(fifthTraining);
    assert.equal(fifthTraining.handled, false, 'a fifth training interface cannot be opened');
  } finally {
    runtime.startTranscript = startTranscript;
  }
});


test('Dragon Slayer II follows Reldo to the cache-marked red bookcase in Varrock Library', () => {
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const objectInteractions = new Map();
  const actionHandlers = [];
  const transcriptVariants = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => prop === 'onObjectInteraction'
      ? (name, actions) => { if (typeof name === 'string') objectInteractions.set(name, actions); }
      : prop === 'onCustomEvent'
        ? (name, handler) => { if (name === 'npc-dialogue:action') actionHandlers.push(handler); }
      : target[prop],
  });
  runtime.startTranscript = (_api, _player, _npcId, _page, variant) => {
    transcriptVariants.push(variant);
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 8],
    ['dragon-slayer-ii:morytania-step', 1],
  ]);
  const items = new Map();
  const inventory = {
    getAmount: (id) => items.get(id) ?? 0,
    getFreeSlots: () => 28 - [...items.values()].reduce((sum, amount) => sum + amount, 0),
    adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
    deleteNumber: (id, amount) => items.set(id, Math.max(0, (items.get(id) ?? 0) - amount)),
  };
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => inventory,
    sendMessage() {},
  };
  const search = objectInteractions.get('Bookcase').Search;
  const wrongShelf = { player, objectId: 7181, location: { x: 3207, y: 3491, z: 0 }, handled: false };
  assert.equal(search(wrongShelf), false, 'an ordinary shelf does not substitute for the red census book');
  const markedShelf = { player, objectId: 32462, location: { x: 3211, y: 3495, z: 0 }, handled: false };
  search(markedShelf);
  assert.equal(markedShelf.handled, true);
  assert.equal(attrs.get('dragon-slayer-ii:morytania-step'), 2);
  assert.deepEqual(transcriptVariants, ['tristan-s-key-piece-finding-the-book']);
  const foundBook = { player, stepId: 'mF7UO1', handled: false };
  actionHandlers.forEach((handler) => handler(foundBook));
  assert.equal(foundBook.handled, true);
  assert.equal(inventory.getAmount(api.core.ItemIdentifiers.VARROCK_CENSUS_RECORDS), 1);
  const handBookToReldo = { player, stepId: '0ordv0', handled: false };
  actionHandlers.forEach((handler) => handler(handBookToReldo));
  assert.equal(handBookToReldo.handled, true);
  assert.equal(inventory.getAmount(api.core.ItemIdentifiers.VARROCK_CENSUS_RECORDS), 0);
});


test('Dragon Slayer II Robert death plays Bob’s memories before unlocking the key hunt', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const custom = new Map();
  const itemObjectHandlers = [];
  let deathHandler;
  let transcript;
  const api = new Proxy(mockApi().api, {
    get: (target, prop) => {
      if (prop === 'onNpcDeath') return (handler) => { deathHandler = handler; };
      if (prop === 'onItemOnObject') return (handler) => itemObjectHandlers.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      if (prop === 'emitCustomEvent') return () => {};
      return target[prop];
    },
  });
  runtime.startTranscript = (_api, _player, _npcId, _page, variant, select) => {
    const raw = require('../data/definitions/npc-dialogues.json')['Dragon Slayer II'].variants[variant];
    transcript = { variant, steps: select ? select(raw) : raw };
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 7],
    ['dragon-slayer-ii:dream-progress', 2],
  ]);
  let brazierLit = 0;
  const packet = new Proxy({}, { get: (_target, property) => property === 'getVarbit' ? () => brazierLit : () => packet });
  let currentArea = null;
  const moves = [];
  const messages = [];
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getPacketSender: () => packet,
    getLocation: () => new api.core.Location(1761, 3850, 0),
    getArea: () => currentArea,
    setArea: (area) => { currentArea = area; },
    getIndex: () => 1,
    isPlayer: () => true,
    getAsPlayer: () => player,
    moveTo(location) { moves.push([location.getX(), location.getY(), location.getZ()]); },
    getUsername: () => 'BobMemoryTest',
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      getFreeSlots: () => 20,
    }),
    sendMessage: (message) => messages.push(message),
  };
  const inventory = new Map([[api.core.ItemIdentifiers.DREAM_POTION, 1]]);
  const usePotion = {
    player,
    itemId: api.core.ItemIdentifiers.DREAM_POTION,
    // This is the actual Lunar Isle ceremonial brazier cache multiloc.
    objectId: 17025,
    handled: false,
  };
  itemObjectHandlers[0](usePotion);
  assert.equal(usePotion.handled, true);
  assert.equal(inventory.get(api.core.ItemIdentifiers.DREAM_POTION), 1, 'an unlit brazier does not consume the potion');
  assert.equal(attrs.get('dragon-slayer-ii:instance-boss'), undefined);
  assert.match(messages.at(-1), /light the ceremonial brazier/i);
  brazierLit = 1;
  usePotion.handled = false;
  itemObjectHandlers[0](usePotion);
  assert.equal(usePotion.handled, true, 'the quest suppresses the generic Nothing interesting fallback');
  assert.equal(inventory.get(api.core.ItemIdentifiers.DREAM_POTION), 0);
  assert.equal(attrs.get('dragon-slayer-ii:instance-boss'), undefined, 'the dream starts only after the Yes choice');
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: 'z9kHar' });
  const dreamBoss = attrs.get('dragon-slayer-ii:instance-boss');
  assert.ok(dreamBoss, 'the transcript Yes action enters the dream');
  deathHandler({
    killer: player,
    npc: dreamBoss,
  });
  assert.equal(transcript.variant, 'robert-the-strong-robert-s-memories');
  assert.equal(transcript.steps.at(-1).id, 'dragon-slayer-ii:bob-memories-complete');
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 7, 'the next chapter waits for Bob’s memory scene');
  for (const handler of custom.get('npc-dialogue:action')) {
    handler({ player, stepId: 'dragon-slayer-ii:bob-memories-complete' });
  }
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 8, 'the key hunt opens after the scene finishes');
  assert.deepEqual(moves.at(-1), [2074, 3912, 0], 'the player returns to Bob beside Lunar Isle’s brazier');
});


test('Dragon Slayer II routes the roaming Bob and Sphinx dialogues before Lunar Isle', () => {
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const custom = new Map();
  const npcActions = new Map();
  const conditions = [];
  const varbits = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, actions) => npcActions.set(name, actions);
      if (prop === 'onNpcDialogueCondition') return (handler) => conditions.push(handler);
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  const transcripts = [];
  runtime.startTranscript = (_api, _player, _npcId, _page, variant, select) => {
    const raw = require('../data/definitions/npc-dialogues.json')['Dragon Slayer II'].variants[variant];
    transcripts.push({ variant, steps: select ? select(raw) : raw });
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }
  const quest = runtime.getRegisteredQuests().filter((entry) => entry.key === 'dragon_slayer_ii').at(-1);

  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 7],
    ['dragon-slayer-ii:dream-progress', 0],
    ['dragon-slayer-ii:aivas-diary', true],
  ]);
  let equipped = new Set();
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getEquipment: () => ({ getAmount: (id) => equipped.has(id) ? 1 : 0 }),
    getPacketSender: () => ({ sendVarbit: (id, value) => varbits.push([id, value]) }),
    getInventory: () => ({ getAmount: () => 0 }),
  };
  assert.match(quest.buildJournal(player)[0], /Find Bob the Cat/);
  const bob = npcActions.get('Bob')['Talk-to'];
  const sphinx = npcActions.get('Sphinx')['Talk-to'];
  const invokeAction = (stepId) => custom.get('npc-dialogue:action').forEach((handler) => handler({ player, stepId }));

  assert.equal(attrs.get('dragon-slayer-ii:dream-progress'), 0);
  bob({ player, npcId: 1 });
  assert.equal(transcripts.at(-1).variant, 'bob-the-cat-talking-to-bob');
  assert.equal(transcripts.at(-1).steps.at(-1).id, 'dragon-slayer-ii:bob-first-talk-complete');
  invokeAction('dragon-slayer-ii:bob-first-talk-complete');
  assert.equal(attrs.get('dragon-slayer-ii:dream-progress'), 1);
  assert.match(quest.buildJournal(player)[0], /Sphinx in Sophanem/);

  equipped.add(api.core.ItemIdentifiers.CATSPEAK_AMULET_E_);
  assert.equal(conditions.flatMap((handler) => [
    handler({ player, stepId: 'i7XI9Q' }), handler({ player, stepId: 'gQ21dn' }),
  ]).filter(Boolean).length, 1, 'the transcript chooses the worn-amulet branch');
  sphinx({ player, npcId: 2 });
  assert.equal(transcripts.at(-1).variant, 'bob-the-cat-talking-to-the-sphinx');
  const sphinxChoice = transcripts.at(-1).steps.find((step) => step.type === 'choice');
  assert.equal(sphinxChoice.options[0].steps.at(-1).id, 'dragon-slayer-ii:sphinx-dream-complete');
  invokeAction('dragon-slayer-ii:sphinx-dream-complete');
  assert.equal(attrs.get('dragon-slayer-ii:dream-progress'), 2);
  assert.match(quest.buildJournal(player)[0], /Oneiromancer on Lunar Isle/);
  assert.deepEqual(varbits, [[6144, 1], [6145, 0]]);
  bob({ player, npcId: 1 });
  assert.equal(transcripts.at(-1).variant, 'robert-the-strong-talking-to-bob-on-lunar-isle');
});


test('Dragon Slayer II registers the cache-named roaming Bob through the live singular NPC hook', () => {
  const names = [];
  const { api: base } = mockApi();
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcsInteraction') return undefined;
      if (prop === 'onNpcInteraction') return (name) => names.push(name);
      return target[prop];
    },
  });
  assert.doesNotThrow(() => require('../plugins/quests/quests/DragonSlayerII.Quest')(api));
  assert.ok(names.includes('Bob'), 'npc-spawns.json calls the roaming cat Bob');
  assert.ok(names.includes('Bob the Cat'), 'retain support for descriptive cache name variants');
  assert.ok(names.includes('Istoria') && names.includes('Jonathan'));
  assert.ok(names.includes('Sir Amik Varze') && names.includes('King Roald'));
});


test('Dragon Slayer II Lithkren diary chapter follows Dallas, the skeleton, and the read diary milestone', () => {
  const runtime = require('../plugins/quests/QuestRuntime');
  const originalStartTranscript = runtime.startTranscript;
  const custom = new Map();
  const npcInteractions = new Map();
  const objectClicks = [];
  const itemActions = [];
  let transcript;
  const base = mockApi().api;
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => npcInteractions.set(name, options);
      if (prop === 'onObjectFirstClick') return (ids, handler) => objectClicks.push({ ids: Array.isArray(ids) ? ids : [ids], handler });
      if (prop === 'onItemAction') return (name, actions) => itemActions.push({ name, actions });
      if (prop === 'onCustomEvent') return (name, handler) => custom.set(name, [...(custom.get(name) ?? []), handler]);
      return target[prop];
    },
  });
  runtime.startTranscript = (_api, _player, _npcId, _page, variant, select) => {
    const raw = require('../data/definitions/npc-dialogues.json')['Dragon Slayer II'].variants[variant];
    transcript = { variant, steps: select ? select(raw) : raw };
    return true;
  };
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
  } finally {
    runtime.startTranscript = originalStartTranscript;
  }

  const { ItemIdentifiers: I, NpcIdentifiers: N, ObjectIdentifiers: O, Location } = api.core;
  const attrs = new Map([
    ['quest.dragon_slayer_ii.stage', 6],
    ['dragon-slayer-ii:lithkren-arrived', true],
  ]);
  const inventory = new Map();
  const varbits = [];
  const player = {
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getLocation: () => new Location(3549, 10419, 0),
    getPacketSender: () => new Proxy({ sendVarbit: (id, value) => varbits.push([id, value]) }, {
      get: (target, key) => target[key] ?? (() => {}),
    }),
    getInventory: () => ({
      getAmount: (id) => inventory.get(id) ?? 0,
      getFreeSlots: () => 28 - [...inventory.values()].reduce((sum, amount) => sum + amount, 0),
      adds: (id, amount) => inventory.set(id, (inventory.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - amount)),
    }),
    sendMessage() {},
  };
  npcInteractions.get('Dallas Jones')['Talk-to']({ player, npcId: N.DALLAS_JONES_2 });
  assert.equal(transcript.variant, 'to-lithkren-talking-to-dallas-at-the-ancient-doors');
  assert.equal(transcript.steps.at(-1).id, 'dragon-slayer-ii:lithkren-dallas-complete');
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: transcript.steps.at(-1).id });
  assert.equal(attrs.get('dragon-slayer-ii:lithkren-dallas-talked'), true);
  assert.deepEqual(varbits.at(-1), [6104, 80], 'Dallas dialogue unlocks the native Search skeleton milestone');

  const skeleton = objectClicks.find(({ ids }) => ids.includes(O.SKELETON_82)).handler;
  assert.equal(skeleton({ player, objectId: O.SKELETON_82, location: { x: 3555, y: 10419, z: 0 } }), true);
  assert.equal(inventory.get(I.AIVAS_DIARY), 1);
  const read = itemActions.find(({ name }) => name === "Aivas' diary").actions.Read;
  assert.equal(read({ player, itemId: I.AIVAS_DIARY }), true);
  assert.equal(attrs.get('dragon-slayer-ii:aivas-diary'), true);
  assert.deepEqual(varbits.at(-1), [6104, 85], 'reading the diary unlocks Dallas’ follow-up milestone');
  npcInteractions.get('Dallas Jones')['Talk-to']({ player, npcId: N.DALLAS_JONES_2 });
  assert.equal(transcript.variant, 'to-lithkren-talking-to-dallas-after-finding-aivas-diary');
  assert.equal(transcript.steps.at(-1).id, 'dragon-slayer-ii:lithkren-diary-complete');
  for (const handler of custom.get('npc-dialogue:action')) handler({ player, stepId: transcript.steps.at(-1).id });
  assert.equal(attrs.get('quest.dragon_slayer_ii.stage'), 7, 'the Bob-memory chapter starts only after the diary is read');
});


test('Dragon Slayer II resolves both Alec prerequisite transcript branches', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const { api: base, handlers } = mockApi();
  const interactions = [];
  const completed = new Map([
    ['legends_quest', true], ['dream_mentor', true], ['a_tail_of_two_cats', true],
    ['animal_magnetism', true], ['ghosts_ahoy', true], ['bone_voyage', true], ['client_of_kourend', true],
  ]);
  const api = new Proxy(base, {
    get: (target, prop) => {
      if (prop === 'onNpcInteraction') return (name, options) => interactions.push({ name, options });
      if (prop === 'emitCustomEvent') return (name, payload) => {
        if (name === 'quest:is-complete') payload.complete = completed.get(payload.key) === true;
        for (const handler of handlers.custom.get(name) ?? []) handler(payload);
      };
      return target[prop];
    },
  });
  const runtime = require('../plugins/quests/QuestRuntime');
  const oldStartTranscript = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DragonSlayerII.Quest')(api);
    const attributes = new Map([['quest.points', 200]]);
    const messages = [];
    let magicLevel = 99;
    const player = {
      getAttribute: (key) => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      getSkillManager: () => ({ getMaxLevel: (skill) => skill === api.core.Skill.MAGIC ? magicLevel : 99 }),
      getPacketSender: () => new Proxy({}, { get: () => () => ({}) }),
      sendMessage: (message) => messages.push(message),
      getInventory: () => ({ getAmount: () => 0, getFreeSlots: () => 28, adds: () => {} }),
    };
    const alec = interactions.find(({ name }) => name === 'Alec Kincade').options['Talk-to'];
    const conditions = handlers.condition.filter((handler) => handler.name === 'answerAlecStartRequirements');
    assert.equal(conditions.length, 1);
    completed.set('dream_mentor', false);
    alec({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE });
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), undefined, 'Alec cannot start DS2 with a missing prerequisite quest');
    assert.match(messages.at(-1), /Dream Mentor/);
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '7iH3Yl' }), false);
    completed.set('dream_mentor', true);
    alec({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE });
    assert.equal(attributes.get('quest.dragon_slayer_ii.stage'), 1);
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '7iH3Yl' }), true,
      'the qualifying transcript branch is shown');
    magicLevel = 74;
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '7iH3Yl' }), false);
    assert.equal(conditions[0]({ player, npcId: api.core.NpcIdentifiers.ALEC_KINCADE, stepId: '5wzysS' }), true,
      'the unmet-requirements branch appears when a required skill is short');
  } finally {
    runtime.startTranscript = oldStartTranscript;
  }
});

test('DT2 keeps internal stages separate from native progress and the cache completion threshold', async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  const attrs = new Map(), sent = [];
  const player = { getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    getPacketSender: () => new Proxy({ sendVarbit: (id, value) => sent.push([id, value]) }, { get: (target, key) => target[key] ?? (() => {}) }) };
  for (const [stage, value] of [[0,0], [1,4], [2,10], [3,12], [4,18], [5,20], [6,24], [7,42], [8,54], [9,66], [10,76], [11,100], [12,118]]) {
    quest.setStage(player, stage);
    assert.equal(quest.getStage(player), stage);
    assert.equal(sent.findLast(([id]) => id === 14862)[1], value);
  }
  assert.equal(quest.varbitValue(12, player), api.core.CacheDefinitions.getDbRow(2343).int(19));
  attrs.set('quest.desert_treasure_ii.stage', 1);
  attrs.set('desert-treasure-ii:smith-intro', true);
  handlers.playerProcess[0]({ player });
  assert.deepEqual(sent.at(-1), [14862,6]);
  const count = sent.length;
  handlers.playerProcess[0]({ player });
  assert.equal(sent.length, count, 'unchanged progress is not sent every tick');
  attrs.set('desert-treasure-ii:statues', 31);
  handlers.playerProcess[0]({ player });
  assert.deepEqual(sent.at(-1), [14862,8]);
  attrs.set('desert-treasure-ii:golem-solved', true);
  assert.equal(quest.varbitValue(6,player),36);
  attrs.set('desert-treasure-ii:searched-names',15);
  assert.equal(quest.varbitValue(6,player),38);
  attrs.set('desert-treasure-ii:banikan-left',true);
  assert.equal(quest.varbitValue(6,player),40);
  const desk = api.core.CacheDefinitions.getObject(49490);
  assert.equal(desk.transformVarbit, 15125);
  quest.setStage(player, 7);
  for (const [lead, value] of [[1,4], [2,6], [3,6], [4,8], [5,10], [6,12]]) {
    attrs.set('desert-treasure-ii:vardorvis-progress', lead);
    handlers.playerProcess[0]({ player });
    assert.equal(sent.findLast(([id]) => id === 15125)[1], value);
    if (lead >= 2 && lead <= 5) assert.ok(api.core.CacheDefinitions.getObject(desk.transforms[value]).actions.includes('Search'));
  }
});

test('DT2 ancient lamps offer only combat skills, require level 60, and consume once after 100,000 XP', () => {
  const { api, handlers } = mockApi();
  let reward;
  api.emitCustomEvent = (name, event) => { if (name === 'xpreward:open') reward = event; };
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const { Skill, ItemIdentifiers: I } = api.core;
  const item = { getId: () => I.ANCIENT_LAMP }, items = [item];
  let level = 59, xp = 1000, blocked = false;
  const player = { getAttribute: key => key === 'quest.desert_treasure_ii.stage' ? 12 : undefined,
    getInventory: () => ({ get: slot => items[slot], deleteAtSlot: slot => items.splice(slot,1) }),
    getSkillManager: () => ({ getMaxLevel: () => level, getExperience: () => xp, addExperience: (_skill, amount) => { if (!blocked) xp += amount; } }) };
  const event = { player, itemId: I.ANCIENT_LAMP, item, slot: 0, option: 'Rub' };
  assert.equal(handlers.itemAction[0](event), true);
  assert.equal(reward.minLevel, 60);
  assert.equal(reward.skills.length, 7);
  assert.equal(reward.onConfirm(Skill.ATTACK, 'Attack'), null);
  level = 60;
  assert.equal(reward.onConfirm(Skill.AGILITY, 'Agility'), null);
  blocked = true;
  assert.equal(reward.onConfirm(Skill.ATTACK, 'Attack'), null);
  assert.equal(items.length,1);
  blocked = false;
  assert.match(reward.onConfirm(Skill.ATTACK, 'Attack'), /100,000 Attack/);
  assert.equal(xp,101000);
  assert.equal(items.length,0);
  assert.equal(reward.onConfirm(Skill.ATTACK, 'Attack'), null);
  assert.equal(xp,101000);
  const quest = require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  assert.equal(quest.xpRewards, undefined, 'the quest grants no extra fixed XP alongside its lamps');
});

test('DT2 excavation uses the cache winch, pickaxe crate and crevice without letting Banikan skip combat', () => {
  const { api, handlers } = mockApi();
  const runtime = require('../plugins/quests/QuestRuntime'), original = runtime.startTranscript;
  runtime.startTranscript = () => true;
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1), { ItemIdentifiers: I, ObjectIdentifiers: O, NpcIdentifiers: N } = api.core;
    const attrs = new Map(), amounts = new Map(), messages = [], equipment = [];
    const player = { getUsername: () => 'dt2-excavation', getAttribute: key => attrs.get(key), setAttribute: (key,value) => attrs.set(key,value),
      getPacketSender: () => new Proxy({}, { get: () => () => {} }), getSkillManager: () => ({ getCurrentLevel: () => 99 }),
      getInventory: () => ({ contains: id => (amounts.get(id) ?? 0) > 0, getAmount: id => amounts.get(id) ?? 0,
        getFreeSlots: () => 28 - amounts.size, adds: (id,n) => amounts.set(id,(amounts.get(id) ?? 0)+n) }),
      getEquipment: () => ({ getItems: () => equipment }), moveTo(location) { this.location = location; }, sendMessage: text => messages.push(text) };
    const click = (objectId,x,y,option,visibleId=objectId) => handlers.objects[0]({ player,objectId,definition:{id:visibleId},location:{x,y,z:0},option });
    quest.setStage(player,2);
    assert.equal(click(O.WINCH_14,3384,3418,'Operate'),false);
    quest.setStage(player,3);
    assert.equal(click(O.WINCH_14,3384,3418,'Operate'),true);
    assert.deepEqual([player.location.x,player.location.y], [3404,9804]);
    const talk = handlers.npcInteractions.get('Dr Banikan')['Talk-to'];
    talk({ player,npcId:N.DR_BANIKAN });
    assert.equal(quest.getStage(player),4);
    talk({ player,npcId:N.DR_BANIKAN });
    assert.equal(quest.getStage(player),4, 'repeating the excavation conversation cannot skip the Guardian');
    assert.equal(click(49510,3411,9811,'Mine',O.ROCKS_141),true);
    assert.equal(quest.getStage(player),4, 'no pickaxe leaves the obstruction intact');
    assert.equal(click(O.CRATE_301,3414,9819,'Search'),true);
    assert.equal(amounts.get(I.BRONZE_PICKAXE),1);
    click(O.CRATE_301,3414,9819,'Search');
    assert.equal(amounts.get(I.BRONZE_PICKAXE),1, 'the crate does not duplicate a carried pickaxe');
    amounts.clear();
    equipment[require('../dist/game/model/container/impl/Equipment').Equipment.WEAPON_SLOT] = { getId: () => I.RUNE_PICKAXE };
    assert.equal(click(49510,3411,9811,'Mine',O.ROCKS_141),true);
    assert.equal(quest.getStage(player),5, 'an equipped usable rune pickaxe clears the real obstruction');
    talk({ player,npcId:N.DR_BANIKAN });
    assert.equal(quest.getStage(player),5, 'Banikan still waits for the actual Guardian defeat');
    assert.match(messages.at(-1), /Defeat the Ancient Guardian/);
    const spawns = require('../data/definitions/npc-spawns.json');
    assert.ok(spawns.some(n => n.id===N.DR_BANIKAN && n.x===3409 && n.y===9815));
  } finally { runtime.startTranscript = original; }
});

test('DT2 Guardian absorbs ranged shield hits and survives a melee overkill into its cache body phase', () => {
  const { api, handlers } = mockApi();
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const { CombatType, Skill, ItemIdentifiers: I, NpcIdentifiers: N } = api.core;
  const original = api.core.World.getProcessCycle;
  api.core.World.getProcessCycle = () => 10;
  try {
    const player = { getSpellbook: () => api.core.MagicSpellbook.ANCIENT, sendMessage() {},
      getSkillManager: () => ({ getCurrentLevel: skill => skill===Skill.MINING ? 99 : 1 }),
      getEquipment: () => ({ getItems: () => [] }), getInventory: () => ({ contains: id => id===I.BRONZE_PICKAXE }) };
    const npc = { hp:95, max:200, __dt2Guardian:{shielded:true,bodyHp:75,lastAttack:0}, getOwner: () => player,
      getHitpoints() {return this.hp;}, setHitpoints(n) {this.hp=n;}, setMaxHitpoints(n) {this.max=n;}, setNpcTransformationId(id) {this.transform=id;} };
    const incoming = (type,value) => {
      const part = {getDamage:()=>value,setDamage:n=>value=n};
      const hit = { getAttacker:()=>player,getCombatMethod:()=>({type:()=>type}),getHits:()=>[part],getTotalDamage:()=>value,updateTotalDamage(){} };
      handlers.npcHitModify.forEach(handler => handler({npc,hit}));
      return value;
    };
    assert.equal(incoming(CombatType.RANGED,40),0);
    assert.equal(npc.hp,95);
    assert.equal(npc.__dt2Guardian.lastAttack,0,'an ineffective ranged attack does not stop recharge');
    assert.equal(incoming(CombatType.MELEE,0),0);
    assert.equal(npc.__dt2Guardian.lastAttack,10,'a four-tick melee miss still interrupts shield recharge');
    assert.equal(incoming(CombatType.MAGIC,3),3,'Ancient Magicks can damage the shield');
    assert.equal(incoming(CombatType.MELEE,6),6,'a carried pickaxe does not multiply weapon damage');
    assert.equal(incoming(CombatType.MELEE,25),0,'shield overkill is consumed by the phase change');
    assert.equal(npc.hp,75,'the wounded body resumes at its retained HP');
    assert.equal(npc.max,100);
    assert.equal(npc.transform,N.ANCIENT_GUARDIAN_4);
    assert.equal(npc.__dt2Guardian.shielded,false);
    assert.equal(incoming(CombatType.RANGED,8),8,'the exposed body can be damaged normally');
  } finally { api.core.World.getProcessCycle=original; }
});

test('DT2 Guardian reforms its shield and its warned rocks can be dodged but bypass melee prayer', () => {
  const { api: base, handlers } = mockApi();
  let cycle=0;
  const npcs=[],graphics=[],damage=[],attrs=new Map();
  class Instance {
    constructor() {this.entities=[];}
    setChunk() {} enter() {} leave() {} postLeave() {} destroy() {} isDestroyed() {return false;}
    tile(x,y,z) {return new base.core.Location(8192+x,1600+y,z);}
    add(npc) {this.entities.push(npc);}
  }
  const core={...base.core,TemplatedInstanceArea:Instance,
    World:{getProcessCycle:()=>cycle,getAddNPCQueue:()=>npcs,getRemoveNPCQueue:()=>[]},
    NPC:{create(id,location){return {id,location,hp:200,max:200,setOwner(p){this.owner=p;},getOwner(){return this.owner;},setOwnerOnly(){},setScriptedMovement(){},
      getHitpoints(){return this.hp;},setHitpoints(n){this.hp=n;},setMaxHitpoints(n){this.max=n;},setNpcTransformationId(id){this.transform=id;},
      getCombat:()=>({getLastAttack:()=>({reset(){}})}),calculateDistance:()=>1,performAnimation(){}};}}};
  const api=new Proxy(base,{get:(target,key)=>key==='core'?core:target[key]});
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  const quest=require('../plugins/quests/QuestRuntime').getRegisteredQuests().at(-1);
  let here=new core.Location(8215,1607,0);
  const sender=new Proxy({getVarbit:()=>1,sendGraphic:(graphic,tile)=>graphics.push([graphic,tile])},{get:(target,key)=>target[key]??(()=>{})});
  const player={getUsername:()=> 'guardian-timing',isPlayer:()=>true,getAsPlayer:()=>player,getHitpoints:()=>99,getLocation:()=>here,
    getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),getPacketSender:()=>sender,
    getCombat:()=>({getHitQueue:()=>({addPendingDamage:hits=>damage.push(...hits)})}),moveTo:location=>here=location,sendMessage(){}};
  quest.setStage(player,5);
  handlers.objects[0]({player,objectId:core.ObjectIdentifiers.CREVICE_45,location:{x:3411,y:9811,z:0},option:'Enter'});
  const area=attrs.get('desert-treasure-ii:war-room'),boss=npcs.find(n=>n.__dt2Guardian);
  assert.ok(area&&boss);
  boss.__dt2Guardian.shielded=false;boss.hp=65;boss.max=100;
  cycle=5;area.process(player);
  assert.equal(boss.__dt2Guardian.bodyHp,65);
  assert.equal(boss.hp,85, "shield recharge retains the wounded body instead of restoring it");
  assert.equal(boss.max,200);
  assert.equal(boss.__dt2Guardian.shielded,true);
  assert.equal(damage.length,0,'Protect from Melee blocks the ordinary attack');
  boss.__dt2Guardian.attacks=4;boss.__dt2Guardian.nextAttack=25;
  cycle=25;area.process(player);area.process(player);
  assert.equal(graphics.length,3,'the warning is emitted once per world tick');
  here=here.transform(0,1,0);
  cycle=28;area.process(player);
  assert.equal(damage.length,0,'moving off all warned tiles avoids the rocks');
  boss.__dt2Guardian.attacks=4;boss.__dt2Guardian.nextAttack=30;
  cycle=30;area.process(player);
  cycle=33;area.process(player);
  assert.equal(damage.length,1,'standing under a rock is hit despite the melee prayer');
  assert.ok(damage[0].getDamage()>=15&&damage[0].getDamage()<=25);
});

test('DT2 completes Banikan departure during dialogue and reveals the last search on Operate', () => {
  const { api, handlers } = mockApi(), runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript, played = [];
  runtime.startTranscript = (_api, _player, _npc, _page, variant) => { played.push(variant); return true; };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1), attrs = new Map();
    const room = { getBaseX:()=>8192, getBaseY:()=>1600 };
    const player = {getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),sendMessage(){},getPacketSender:()=>new Proxy({}, {get:()=>()=>{}})};
    quest.setStage(player,6);
    attrs.set('desert-treasure-ii:war-room',room);
    attrs.set('desert-treasure-ii:golem-solved',true);
    attrs.set('desert-treasure-ii:banikan-briefed',true);
    attrs.set('desert-treasure-ii:searched-names',15);
    handlers.npcInteractions.get('Dr Banikan')['Talk-to']({player,npcId:api.core.NpcIdentifiers.DR_BANIKAN});
    assert.equal(attrs.get('desert-treasure-ii:banikan-left'),undefined,'opening the conversation does not finish it');
    assert.equal(quest.varbitValue(6,player),38);
    const variants = require('../data/definitions/npc-dialogues.json')['Desert Treasure II - The Fallen Empire'].variants;
    const resolve = handlers.condition[0];
    const { flatten } = require('../plugins/npcs/NpcDialogues.plugin');
    const queue = flatten(variants['familiar-faces-powering-up-the-golem-machine-the-whisperer-true-name-classified'],{resolveCondition:step=>resolve({player,text:step.text})});
    assert.ok(queue.some(step=>step.id==='T24jg_'),'the last report flows into the departure conversation');
    handlers.custom.get('npc-dialogue:action')[0]({player,stepId:'T24jg_'});
    assert.equal(quest.varbitValue(6,player),40);
    handlers.objects[0]({player,objectId:49511,location:{x:8214,y:1619,z:0},option:'Operate'});
    assert.equal(quest.getStage(player),7);
    const report = variants[played.at(-1)];
    assert.ok(report.some(step=>step.player==='Repeat last search.'));
    assert.ok(report.some(step=>step.type==='line'&&step.text==='Frostenhorn'),'the archived name must be shown');
    assert.equal(quest.varbitValue(7,player),42);
  } finally { runtime.startTranscript = original; }
});

test('DT2 persists progress and puzzle state without serializing its live boss NPC', () => {
  const {api}=mockApi(),keys=[];
  api.persistAttribute=key=>keys.push(key);
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  assert.ok(keys.includes('quest.desert_treasure_ii.stage'));
  assert.ok(keys.includes('desert-treasure-ii:medallions-placed'));
  assert.ok(keys.includes('desert-treasure-ii:cell-positions'));
  assert.ok(!keys.includes('desert-treasure-ii:boss'),'NPC references fail PlayerSave JSON validation and must remain runtime state');
});


test('DT2 leaves shared Smith and Terry NPC conversations available outside their quest chapters', () => {
  const {api,handlers}=mockApi();
  require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
  let stage=0;
  const player={getAttribute:()=>stage,sendMessage(){throw Error('outside-scope DT2 dialogue');}};
  const smith=handlers.npcInteractions.get('Asgarnia Smith')['Talk-to'];
  const terry=handlers.npcInteractions.get('Terry Balando')['Talk-to'];
  for (stage of [0,3,6,12]) {
    assert.equal(smith({player}),false);
    assert.equal(terry({player}),false);
  }
});

test('DT2 shared NPC hooks fall through outside their own chapter and cannot spawn another chapter boss', () => {
  const { api, handlers } = mockApi(), runtime = require('../plugins/quests/QuestRuntime');
  const original = runtime.startTranscript;
  runtime.startTranscript = () => { throw Error('wrong chapter dialogue'); };
  try {
    require('../plugins/quests/quests/DesertTreasureII.Quest')(api);
    const quest = runtime.getRegisteredQuests().at(-1), attrs = new Map();
    const player = { getAttribute:key=>attrs.get(key), setAttribute:(key,value)=>attrs.set(key,value), getPacketSender:()=>new Proxy({}, {get:()=>()=>{}}) };
    const ids = api.core.NpcIdentifiers;
    for (const stage of [0, 1, 6, 12]) {
      quest.setStage(player,stage);
      for (const name of ['Elissa','Barus','Kasonde','Ramarno','Prescott','Wizard Persten','Captain Malleta','Ketla','Catalytic Guardian'])
        assert.equal(handlers.npcInteractions.get(name)['Talk-to']({player,npcId:ids[name.toUpperCase().replaceAll(' ','_')]}),false,name+' retains its normal dialogue');
    }
    quest.setStage(player,7);
    for (const [name,id] of [['Wizard Persten',ids.WIZARD_PERSTEN_5],['Captain Malleta',ids.CAPTAIN_MALLETA],['Ketla',ids.KETLA]])
      assert.equal(handlers.npcInteractions.get(name)['Talk-to']({player,npcId:id}),false,'unrelated NPCs cannot trigger Vardorvis');
  } finally { runtime.startTranscript = original; }
});


test('Death Plateau keeps Eohric and Harold dialogue in order', () => {
  const { api, handlers, quest, player } = questScene('DeathPlateau');
  const { EOHRIC, HAROLD, DENULTH } = api.core.NpcIdentifiers;
  const select = handlers.variant.at(-1);
  const talk = npcId => select({ npcId, player });
  quest.setStage(player, 10);
  assert.equal(talk(DENULTH), 'getting-started-talking-to-denulth-again');
  assert.equal(talk(EOHRIC), 'finding-the-combination-talking-to-eohric');
  assert.equal(quest.getStage(player), 20);
  assert.equal(talk(EOHRIC), 'finding-the-combination-talking-to-eohric-talking-to-eohric-again');
  assert.equal(quest.getStage(player), 20, 'revisiting Eohric cannot pretend Harold was met');
  assert.equal(talk(HAROLD), 'finding-the-combination-talking-to-harold');
  assert.equal(quest.getStage(player), 30);
  assert.equal(talk(HAROLD), 'finding-the-combination-talking-to-harold-again');
  assert.equal(talk(EOHRIC), 'finding-the-combination-talking-to-eohric-after-talking-to-harold');
  assert.equal(quest.getStage(player), 40);
  assert.equal(talk(EOHRIC), 'finding-the-combination-talking-to-eohric-again-after-learning-harold-s-weakness');
  assert.equal(talk(HAROLD), 'finding-the-combination-talking-to-harold-after-learning-his-weakness');
  quest.setStage(player, 65);
  assert.equal(talk(EOHRIC), 'finding-the-combination-talking-to-eohric-after-opening-the-equipment-room');
});


test("Death Plateau doors require Eohric's hint and the solved puzzle", () => {
  const { api, handlers, quest, player, messages } = questScene('DeathPlateau');
  const door = api.core.ObjectIdentifiers.DOOR_115;
  const toggle = objectId => {
    const event = { player, objectId, handled: false };
    handlers.custom.get('door:toggle').forEach(handler => handler(event));
    return event.handled;
  };
  for (const stage of [0, 10]) {
    quest.setStage(player, stage);
    assert.equal(toggle(door), true);
    assert.match(messages.at(-1), /without a reason/);
  }
  for (const stage of [20, 30, 40, 60, 80]) {
    quest.setStage(player, stage);
    assert.equal(toggle(door), false, 'the shared door handler opens it');
  }
  for (const stage of [0, 55, 60, 65, 70, 80]) {
    quest.setStage(player, stage);
    assert.equal(toggle(api.core.ObjectIdentifiers.LARGE_DOOR_23), stage < 65);
  }
  quest.setStage(player, 0);
  assert.equal(toggle(api.core.ObjectIdentifiers.DOOR), false);
});


test('Tenzing sells climbing boots after Death Plateau, including during Troll Stronghold', () => {
  const { api, handlers, quest, player, items } = questScene('DeathPlateau');
  const { TENZING } = api.core.NpcIdentifiers;
  const { COINS, CLIMBING_BOOTS } = api.core.ItemIdentifiers;
  quest.setStage(player, quest.completionValue);
  assert.deepEqual(handlers.variant.at(-1)({ player, npcId: TENZING }), { page: 'Tenzing', variant: 'after-death-plateau' });
  const condition = text => handlers.condition.at(-1)({ player, npcId: TENZING, text });
  const action = event => handlers.custom.get('npc-dialogue:action').forEach(handler => handler(event));
  for (const stepId of ['FgkYXO', '7mwtJo']) {
    items.set(COINS, 24);
    items.set(CLIMBING_BOOTS, 0);
    assert.equal(condition('If the player has enough coins in their inventory:'), true);
    assert.equal(condition('If the player does not have enough coins in their inventory:'), false);
    assert.equal(condition('If the player has 12 gp:'), true);
    action({ player, npcId: TENZING, stepId });
    assert.equal(items.get(COINS), 24, 'generic action events do not charge');
    action({ player, npcId: TENZING, stepId, kind: 'message' });
    assert.equal(items.get(COINS), 12);
    assert.equal(items.get(CLIMBING_BOOTS), 1);
  }
  player.setAttribute('quest.troll_stronghold.stage', 10);
  assert.equal(handlers.variant.at(-1)({ player, npcId: TENZING }), null, 'active Troll Stronghold keeps its dialogue');
  assert.equal(condition('If the player has 12 gp:'), true, 'its purchase uses the same coin check');
});


test('Tenzing refuses unpaid/full-inventory purchases and accepts payment that frees a slot', () => {
  const { api, handlers, quest, player, items } = questScene('DeathPlateau');
  const { COINS, CLIMBING_BOOTS } = api.core.ItemIdentifiers;
  const inventory = player.getInventory();
  let fullMessage = false;
  inventory.full = () => { fullMessage = true; };
  const buy = () => {
    const event = { player, npcId: api.core.NpcIdentifiers.TENZING, stepId: 'FgkYXO', kind: 'message' };
    handlers.custom.get('npc-dialogue:action').forEach(handler => handler(event));
    return event;
  };
  items.set(COINS, 12);
  assert.equal(buy().end, true, 'cannot buy before completing Death Plateau');
  assert.equal(items.get(COINS), 12);
  quest.setStage(player, quest.completionValue);
  items.set(COINS, 11);
  assert.equal(buy().end, true);
  assert.equal(items.get(COINS), 11);
  items.set(COINS, 13);
  inventory.isFull = () => true;
  assert.equal(buy().end, true);
  assert.equal(fullMessage, true);
  assert.equal(items.get(COINS), 13);
  assert.equal(items.get(CLIMBING_BOOTS), undefined);
  items.set(COINS, 12);
  buy();
  assert.equal(items.get(COINS), 0);
  assert.equal(items.get(CLIMBING_BOOTS), 1, 'spending the last coins makes room for the boots');
});


test('Death Plateau final handover conditions require both the map and combination', () => {
  const { api, handlers, quest, player, items } = questScene('DeathPlateau');
  const { SECRET_WAY_MAP, COMBINATION } = api.core.ItemIdentifiers;
  quest.setStage(player, 78);
  const condition = text => handlers.condition.at(-1)({ player, npcId: api.core.NpcIdentifiers.DENULTH, text });
  for (const have of [[], [SECRET_WAY_MAP], [COMBINATION], [SECRET_WAY_MAP, COMBINATION]]) {
    items.clear();
    have.forEach(id => items.set(id, 1));
    assert.equal(condition('If the player has not turned in all the items:'), have.length < 2);
    assert.equal(condition('If the player has turned in all the items:'), have.length === 2);
  }
});


test('Harold keeps his ale/drunk state and accepts either Blurberry special', () => {
  for (const drink of ['BLURBERRY_SPECIAL', 'PREMADE_BLURB_SP']) {
    const { api, handlers, quest, player, items } = questScene('DeathPlateau');
    const { HAROLD } = api.core.NpcIdentifiers;
    const I = api.core.ItemIdentifiers;
    const select = () => handlers.variant.at(-1)({ player, npcId: HAROLD });
    const act = stepId => handlers.custom.get('npc-dialogue:action').forEach(h => h({ player, npcId: HAROLD, kind: 'message', stepId }));
    quest.setStage(player, 40); items.set(I.ASGARNIAN_ALE, 1); act('_ELP6x');
    assert.equal(quest.getStage(player), 50);
    assert.equal(items.get(I.ASGARNIAN_ALE), 0);
    assert.equal(select(), 'finding-the-combination-talking-to-harold-after-giving-him-an-asgarnian-ale');
    items.set(I[drink], 1);
    assert.equal(handlers.condition.at(-1)({ player, npcId: HAROLD, text: 'If the player does not have a Blurberry special:' }), false);
    act('VZS4Rq');
    assert.equal(items.get(I[drink]), 0);
    assert.equal(player.getAttribute('death-plateau:harold-drunk'), true);
    assert.equal(select(), 'finding-the-combination-talking-to-harold-after-giving-him-a-blurberry-special');
  }
});


test('Harold gives an IOU first and reading it replaces it with one combination', () => {
  const { api, handlers, quest, player, items } = questScene('DeathPlateau');
  const I = api.core.ItemIdentifiers, { HAROLD } = api.core.NpcIdentifiers;
  const act = stepId => handlers.custom.get('npc-dialogue:action').forEach(h => h({ player, npcId: HAROLD, kind: 'message', stepId }));
  quest.setStage(player, 50); act('4p9H2-'); act('MBm6Sz');
  assert.equal(quest.getStage(player), 55);
  assert.equal(items.get(I.IOU), 1); assert.equal(items.get(I.COMBINATION), undefined);
  act('abx6jE'); act('hYvfps');
  assert.equal(quest.getStage(player), 60);
  assert.equal(items.get(I.IOU), 0); assert.equal(items.get(I.COMBINATION), 1);
  items.delete(I.COMBINATION); act('23tpMt');
  assert.equal(items.get(I.COMBINATION), 1, 'lost combination comes back without gambling');
  assert.equal(items.get(I.IOU), 0);
  assert.equal(handlers.namedItemActions.get('Combination').Read({ player, itemId: I.COMBINATION }), true);
});


function puzzleScene() {
  const scene = questScene('DeathPlateau'), ground = new Map();
  const key = (id, tile) => `${id}:${tile.getX()},${tile.getY()}`;
  scene.api.getItemOnGroundManager = () => ({
    getGroundItem: (_owner, id, tile) => ground.get(key(id, tile)),
    registerNonGlobals: (player, item, tile) => ground.set(key(item.id, tile), { id: item.id, tile, getOwner: () => player.getUsername() }),
    deregister: item => ground.delete(key(item.id, item.tile)),
  });
  scene.place = (id, x, y) => scene.handlers.itemOnObject.forEach(h => h({ player: scene.player, itemId: id, objectId: scene.api.core.ObjectIdentifiers.STONE_MECHANISM, location: { x, y, z: 0 } }));
  scene.ground = ground;
  return scene;
}


test('five correct colours unlock only after reading; placements are private and reversible', () => {
  const { quest, player, items, place, handlers, ground } = puzzleScene();
  const solution = [[3109,2894,3563],[3110,2894,3562],[3111,2895,3562],[3112,2895,3563],[3113,2895,3564]];
  quest.setStage(player, 55);
  solution.forEach(([id,x,y]) => { items.set(id,1); place(id,x,y); });
  assert.equal(quest.getStage(player),55,'unread IOU does not unlock the room');
  quest.setStage(player,60); items.set(3113,1); place(3113,2895,3564);
  assert.equal(quest.getStage(player),65);
  const green = ground.get('3113:2895,3564');
  const pickup = { player, groundItem:green, groundItemId:3113, location:{x:2895,y:3564,z:0}, handled:false };
  handlers.ground.forEach(h => h(pickup));
  assert.equal(pickup.handled,true);
  assert.equal(items.get(3113),2,'the replacement and the placed ball each return once');
  assert.equal(player.getAttribute('death-plateau:stone-balls')['2895,3564'],undefined);
  assert.equal(ground.size,4);
  ground.clear(); handlers.area.find(a => a.constructor.name==='PuzzleArea').process(player);
  assert.equal(ground.size,4,'saved placements restore after floor-item expiry/relogin');
});


test('wrong colours and a sixth occupied mechanism tile keep the room locked', () => {
  const { quest, player, items, place } = puzzleScene();
  quest.setStage(player,60);
  for (const [id,x,y] of [[3110,2894,3563],[3109,2894,3562],[3111,2895,3562],[3112,2895,3563],[3113,2895,3564]]) {items.set(id,1);place(id,x,y);}
  assert.equal(quest.getStage(player),60);
  items.set(3109,1);place(3109,2894,3564);
  items.set(3109,1);place(3109,2894,3563);
  items.set(3110,1);place(3110,2894,3562);
  assert.equal(quest.getStage(player),60,'the spare top-left tile must be empty');
  assert.equal(Object.keys(player.getAttribute('death-plateau:stone-balls')).length,6);
});


test('Dunstan introduces his son first and remembers a delivered certificate', () => {
  const { api, handlers, quest, player, items } = questScene('DeathPlateau');
  const { DUNSTAN, DENULTH } = api.core.NpcIdentifiers, I = api.core.ItemIdentifiers;
  const talk = npcId => handlers.variant.at(-1)({ player, npcId });
  quest.setStage(player,72);items.set(I.CLIMBING_BOOTS,1);
  assert.equal(talk(DENULTH),'new-route-up-death-plateau-talking-to-denulth-after-opening-the-equipment-room');
  assert.equal(talk(DUNSTAN),'new-route-up-death-plateau-talking-to-dunstan');
  assert.equal(quest.getStage(player),73);
  assert.equal(talk(DUNSTAN),'new-route-up-death-plateau-talking-to-dunstan-again');
  assert.equal(talk(DENULTH),'new-route-up-death-plateau-talking-to-denulth-after-talking-to-dunstan');
  items.set(I.CERTIFICATE_2,1);
  handlers.custom.get('npc-dialogue:action').forEach(h => h({ player,npcId:DUNSTAN,stepId:'jmuuX8',kind:'message' }));
  assert.equal(talk(DUNSTAN),'new-route-up-death-plateau-talking-to-dunstan-before-getting-the-spiked-boots');
});


test('scouting is required and lost maps can be replaced without paying supplies again', () => {
  const runtime=require('../plugins/quests/QuestRuntime'), original=runtime.startTranscript;
  let scene;
  runtime.startTranscript=()=>true;
  try { scene=questScene('DeathPlateau'); } finally { runtime.startTranscript=original; }
  const { api, handlers, quest, player, items, tile }=scene;
  const I=api.core.ItemIdentifiers, { TENZING, DENULTH }=api.core.NpcIdentifiers;
  quest.setStage(player,77);items.set(I.SECRET_WAY_MAP,1);items.set(I.COMBINATION,1);
  const ready=()=>handlers.condition.at(-1)({ player,npcId:DENULTH,text:'If the player has turned in all the items:' });
  assert.equal(ready(),false);
  assert.equal(handlers.npc.get('Denulth')['Talk-to']({ player }),true);
  const scout=handlers.area.find(a=>a.constructor.name==='ScoutArea');
  player.moveTo(tile(2865,3609,1));scout.process(player);assert.equal(quest.getStage(player),77);
  items.delete(I.SECRET_WAY_MAP);
  assert.equal(handlers.variant.at(-1)({ player,npcId:TENZING }),'new-route-up-death-plateau-talking-to-tenzing-after-losing-the-map');
  player.moveTo(tile(2865,3609));scout.process(player);assert.equal(quest.getStage(player),77,'the scout needs the map');
  handlers.custom.get('npc-dialogue:action').forEach(h=>h({ player,npcId:TENZING,stepId:'TgL2Wy',kind:'message' }));
  assert.equal(items.get(I.SECRET_WAY_MAP),1);
  scout.process(player);assert.equal(quest.getStage(player),78);
  assert.equal(handlers.npc.get('Denulth')['Talk-to']({ player }),false);
  assert.equal(ready(),true);
});


test('Denulth remembers partial note hand-ins and completes after the missing note is recovered', () => {
  const { api, handlers, quest, player, items } = questScene('DeathPlateau');
  const I = api.core.ItemIdentifiers, { DENULTH } = api.core.NpcIdentifiers;
  const act = stepId => handlers.custom.get('npc-dialogue:action').forEach(h => h({ player, npcId: DENULTH, kind: 'message', stepId }));
  player.getSkillManager = () => ({ addExperiences: () => {} });
  player.isRegistered = () => false;
  quest.setStage(player,77);items.set(I.SECRET_WAY_MAP,1);
  act('sdE5c5');assert.equal(items.get(I.SECRET_WAY_MAP),1,'cannot submit before scouting');
  quest.setStage(player,78);act('sdE5c5');
  assert.equal(items.get(I.SECRET_WAY_MAP),0);
  assert.equal(handlers.condition.at(-1)({ player,npcId:DENULTH,text:"If the player has the map:" }),true);
  act('IRymYG');assert.equal(quest.getStage(player),78);
  items.set(I.COMBINATION,1);act('liaDgz');act('IRymYG');
  assert.equal(items.get(I.COMBINATION),0);assert.equal(quest.isComplete(player),true);
});


test('boot and map exchanges happen together and cannot strand a cancelled dialogue', () => {
  const { api, handlers, quest, player, items } = questScene('DeathPlateau');
  const I = api.core.ItemIdentifiers, { DUNSTAN, TENZING } = api.core.NpcIdentifiers;
  const act = (npcId, stepId) => handlers.custom.get('npc-dialogue:action').forEach(h => h({ player, npcId, kind: 'message', stepId }));
  quest.setStage(player,73);items.set(I.CLIMBING_BOOTS,1);items.set(I.IRON_BAR,1);
  act(DUNSTAN,'V1M373');assert.equal(items.get(I.CLIMBING_BOOTS),1,'cancelling before reward retains materials');
  act(DUNSTAN,'1TFYaK');act(DUNSTAN,'WryBLk');
  assert.equal(items.get(I.CLIMBING_BOOTS),0);assert.equal(items.get(I.IRON_BAR),0);assert.equal(items.get(I.SPIKED_BOOTS),1);
  items.set(I.BREAD,10);items.set(I.TROUT,10);
  act(TENZING,'_ZbFCb');act(TENZING,'JM8S8J');assert.equal(items.get(I.SPIKED_BOOTS),1);
  act(TENZING,'yDYvE0');act(TENZING,'MtULDz');
  assert.equal(items.get(I.SPIKED_BOOTS),0);assert.equal(items.get(I.BREAD),0);assert.equal(items.get(I.TROUT),0);
  assert.equal(items.get(I.SECRET_WAY_MAP),1);assert.equal(quest.getStage(player),77);
  items.delete(I.SECRET_WAY_MAP);act(TENZING,'TgL2Wy');assert.equal(items.get(I.SECRET_WAY_MAP),1);
});


test('Elite Kinshra protection follows attack style and wears down on unblocked hits', () => {
  const {api,player}=movarioFixture();let area,modify;
  api.registerArea=a=>{area=a;};api.onNpcHitModify=h=>{modify=h;};
  require('../plugins/quests/wgs/DarkSquall.WhileGuthixSleeps')({...api.context,api,stage:()=>490});
  player.isPlayer=()=>true;
  const npc={getId:()=>13463,getArea:()=>area,isNpc:()=>true,setHeadIcon(){}};let amount=12,type=api.core.CombatType.MELEE;
  const hit={getAttacker:()=>player,getCombatType:()=>type,setTotalDamage:n=>{amount=n;},getCombatMethod:()=>({attackSpeed:()=>4}),getHits:()=>[],updateTotalDamage(){}};
  modify({npc,hit});assert.equal(amount,0);
  type=api.core.CombatType.MAGIC;amount=12;modify({npc,hit});assert.equal(amount,12);
  for(let i=0;i<25;i++){type=i%2?api.core.CombatType.MAGIC:api.core.CombatType.MELEE;amount=12;modify({npc,hit});assert.equal(amount,12);}
  amount=12;modify({npc,hit});assert.equal(amount,12,'once exhausted, repeating the same style is no longer blocked');
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
  const player={attributes:new Map(),getAttribute(k){return this.attributes.get(k);},setAttribute(k,v){this.attributes.set(k,v);},sendMessage(){}};
  const actions=interactions.find(([name])=>name==='Notice board')[1];
  const read=actions.Read;
  assert.equal(typeof actions.read,'function','the live cache interaction may be lowercased by ObjectDefinition');
  assert.equal(read({player,objectId:32655,definition:{id:24099}}),true);
  assert.equal(read({player,objectId:24099}),false,'unrelated notice boards keep their own interaction');
  assert.equal(prompt[1],'Theatre of Blood: choose a mode');
  assert.equal(prompt[2],'Solo Entry Mode.');
  prompt[3]();
  assert.equal(player.attributes.get('tob:entry-party'),true);
  let normal;
  api.onCustomEvent('tob:normal-party',event=>{normal=event.player;});
  assert.equal(prompt[4],'Normal Mode party.');
  prompt[5]();
  assert.equal(normal,player);
  assert.equal(player.attributes.get('tob:entry-party'),false);
  assert.equal(interactions.find(([name])=>name==='Theatre of Blood')[1].Enter({player,objectId:32653}),false,'normal parties retain the main entrance handler');
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
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
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
  raid.tick += 4;
  entry._test.xarpus(raid);
  raid.effects.pop().fn();
  assert.equal(raid.pools.length, 1, 'spitting on existing acid does not multiply persistent floor damage');
  assert.equal(hits.length, 2, 'a later splat still causes its own single immediate hit');
  } finally { Math.random = originalRandom; }
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
