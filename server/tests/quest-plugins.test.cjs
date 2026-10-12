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
  assert.equal(amount, 9, 'switching to the right style works after a mistake');
  raid.boss = target;
  raid.room = 5; raid.phase = 0; raid.redShield = 0; raid.tick = 1;
  amount = 120;
  entry._test.dealtDamage({ player, target, hit });
  assert.equal(amount, 6, 'queued damage cannot kill Verzik before the phase transition');
});


test('Sotetseg random maze paths connect to the fixed cached portal', () => {
  const { api } = mockApi();
  api.core = { ...api.core, ObjectManager: { register() {} } };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  for (let trial = 0; trial < 100; trial++) {
    const player = { getCombat: () => ({ reset() {} }), moveTo() {}, sendMessage() {} };
    const raid = { player, area: null, objects: new Set() };
    entry._test.startMaze(raid);
    assert.deepEqual(raid.maze.end, [3357, 4329, 3]);
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
  api.spawnNpc = () => {
    const npc = {
      setMaxHitpoints: () => npc,
      setHitpoints: () => npc,
      setScriptedMovement() {},
      getMovementQueue: () => ({ setBlockMovement() {} }),
    };
    return npc;
  };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const area = entry._test.createArea();
  area.enter = () => {};
  const player = { isNpc: () => false, getPacketSender: () => ({ sendVarbit() {} }) };
  const pillars = Array.from({ length: 4 }, () => ({ getHitpoints: () => 155 }));
  const raid = { player, area, npcs: new Set(), pillars, wave: 0, tick: 1, started: true, room: 2 };
  entry._test.RAIDS.set(player, raid);
  entry._test.nextWave(raid);
  assert.equal(raid.npcs.size, 3);
  for (const spider of raid.npcs) assert.equal(entry._test.NPC_RAIDS.get(spider).expires,51,'spiders expire after thirty seconds');
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


test('Xarpus acid covers nine tiles without stacking damage when pools overlap', () => {
  const { api } = mockApi();
  api.core = { ...api.core, ObjectManager: { register() {} }, Projectile: { createProjectile: () => ({ sendProjectile() {} }) } };
  const entry = require('../plugins/minigames/tob/Entry.TheatreOfBlood');
  entry(api);
  const player = {
    getLocation: () => new api.core.Location(3174, 4386, 1),
    getHitpoints: () => 99,
    getCombat: () => ({ getHitQueue: () => ({ addPendingDamage() {} }) }),
  };
  const raid = { player, boss: { getHitpoints: () => 390, getMaxHitpoints: () => 520, performAnimation() {} }, tick: 52, effects: [], pools: [], objects: new Set(), area: null };
  entry._test.xarpus(raid);
  raid.effects.pop().fn();
  assert.equal(raid.pools.length, 9);
  assert.ok(raid.pools.some(pool => pool.tile[0] === 3173 && pool.tile[1] === 4385));
  assert.ok(raid.pools.some(pool => pool.tile[0] === 3175 && pool.tile[1] === 4387));
  entry._test.xarpus(raid);
  raid.effects.pop().fn();
  assert.equal(raid.pools.length, 9, 'spitting on existing acid does not multiply floor damage');
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
