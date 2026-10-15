const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const runtime = require('../plugins/quests/QuestRuntime');
before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
});
let nextIndex = 100;
function setup() {
  const hooks = { custom: new Map(), variants: [], namedNpcs: new Map(), objects: [], items: [], logout: [] };
  const tasks = [], spawned = [], removed = [], objects = [], projectiles = [], graphics = [];
  const core = { ...PluginManager.getCoreApi(),
    CountdownTask: class { constructor(key, ticks, run) { Object.assign(this, { key, ticks, run }); } },
    ForceMovementTask: class { constructor(player, ticks, movement) { Object.assign(this, { ticks, run() { player.moveTo(new core.Location(movement.start.x + movement.end.x, movement.start.y + movement.end.y, 0)); } }); } },
    TaskManager: { submit(task) { tasks.push(task); } },
    ObjectManager: { register(object) { objects.push(object); }, deregister(object) { objects.splice(objects.indexOf(object), 1); object.getPrivateArea()?.detach(object); } },
  };
  const api = new Proxy({ core,
    persistAttribute() {}, onNpcDialogueVariant(fn) { hooks.variants.push(fn); }, onNpcDialogueCondition() {},
    onNpcInteraction(target, actions) { if (typeof target === 'string') hooks.namedNpcs.set(target, actions); },
    onObjectInteraction(target) { if (typeof target === 'function') hooks.objects.push(target); },
    onItemOnItem(first, second, fn) { hooks.items.push({ first, second, fn }); }, onPlayerLogout(fn) { hooks.logout.push(fn); },
    onCustomEvent(name, fn) { const list = hooks.custom.get(name) ?? []; list.push(fn); hooks.custom.set(name, list); },
    emitCustomEvent(name, event) { for (const fn of hooks.custom.get(name) ?? []) fn(event); },
    spawnNpc(def) {
      let hp = 40, area, tile = new core.Location(def.x, def.y, def.z);
      const npc = { def, getId: () => def.id, getOwner: () => def.owner, getHitpoints: () => hp, setHitpoints(value) { hp = value; },
        getCombat: () => ({ attack(target) { npc.target = target; } }), isRegistered: () => true,
        isNpc: () => true, isPlayer: () => false, setArea(value) { area = value; }, getArea: () => area,
        getIndex: () => nextIndex++, getAsNpc() { return npc; }, getLocation: () => tile, moveTo(value) { tile = value; },
        getMovementQueue: () => ({ addFirstStep(value) { tile = value; } }),
        performAnimation(value) { npc.animation = value.id; }, performGraphic(value) { npc.graphic = value.id; }, forceChat(value) { npc.chat = value; } };
      spawned.push(npc); return npc;
    }, removeNpc(npc) { removed.push(npc); },
  }, { get(target, key) { return target[key] ?? (() => {}); } });
  require('../plugins/quests/quests/BelowIceMountain.Quest')(api);
  const quest = runtime.getRegisteredQuests().at(-1);
  const attrs = new Map(), inventory = new Map(), varbits = new Map(), messages = [], animations = [], xp = [];
  const index = nextIndex++;
  let location = new core.Location(3086, 3415, 0), area = null, current = null, menu = null, miningLevel = 10;
  const movement = { reset() { return this; }, setBlockMovement(value) { this.blocked = value; return this; } };
  const sender = new Proxy({ sendVarbit(id, value) { varbits.set(id, value); return sender; },
    sendCreationMenu(value) { menu = value; return sender; }, sendInterfaceRemoval() { current = null; return sender; },
    sendProjectile(...args) { projectiles.push(args); return sender; }, sendGraphic(...args) { graphics.push(args); return sender; },
  }, { get(target, key) { return target[key] ?? (() => sender); } });
  const player = {
    getAttribute: key => attrs.get(key), setAttribute(key, value) { attrs.set(key, value); },
    getPacketSender: () => sender, getFrameUpdater: () => null, sendMessage(message) { messages.push(message); },
    getInventory: () => ({ getAmount: id => inventory.get(id) ?? 0,
      deleteNumber(id, count) { inventory.set(id, Math.max(0, (inventory.get(id) ?? 0) - count)); },
      adds(id, count) { inventory.set(id, (inventory.get(id) ?? 0) + count); } }),
    getSkillManager: () => ({ getCurrentLevel: skill => skill === core.Skill.MINING ? miningLevel : 99,
      addExperiences(skill, amount) { xp.push({ skill, amount }); } }),
    getLocation: () => location, moveTo(value) { location = value; }, getArea: () => area, getPrivateArea: () => area, setArea(value) { area = value; },
    getIndex: () => index, isPlayer: () => true, getAsPlayer() { return player; }, isNpc: () => false, isRegistered: () => true,
    getMovementQueue: () => movement, getCombat: () => ({ reset() {} }), setUntargetable() {}, setForceMovement() {},
    performAnimation(animation) { animations.push(animation); },
    getDialogueManager: () => ({ startDialogues(chain) { current = chain; }, getCurrent: () => current, reset() { current = null; }, isActive: () => Boolean(current), advance() {} }),
  };
  const emit = (name, event) => api.emitCustomEvent(name, { player, ...event });
  const action = (npcId, stepId) => { const event = { player, npcId, stepId }; api.emitCustomEvent('npc-dialogue:action', event); return event; };
  const line = (npcId, text) => { const event = { player, npcId, text }; api.emitCustomEvent('npc-dialogue:line', event); return event; };
  return { api, hooks, core, quest, attrs, inventory, varbits, messages, animations, xp, player, tasks, spawned, removed, objects, projectiles, graphics,
    emit, action, line, menu: () => menu, setMiningLevel(value) { miningLevel = value; } };
}
const CHECKAL = 'quest.below_ice_mountain.checkal', MARLEY = 'quest.below_ice_mountain.marley';
test('capture start/recruitment milestones preserve cache morphs and old saves', () => {
  const h = setup(), N = h.core.NpcIdentifiers;
  h.attrs.set('quest.points', 15);
  assert.equal(h.hooks.namedNpcs.get('Willow')['Talk-to']({ player: h.player }), true);
  h.emit('npc-dialogue:choice', { npcId: N.WILLOW, option: 'Yes.' });
  assert.equal(h.quest.getStage(h.player), 0);
  h.attrs.set('quest.points', 16); h.emit('npc-dialogue:choice', { npcId: N.WILLOW, option: 'Yes.' });
  assert.equal(h.varbits.get(12063), 5);
  h.line(N.WILLOW, 'What happened?').after(); assert.equal(h.varbits.get(12063), 7);
  h.line(N.WILLOW, 'I have no idea where he is these days.').after(); assert.equal(h.varbits.get(12063), 10);
  h.hooks.variants[0]({ player: h.player, npcId: N.CHECKAL });
  assert.equal(h.attrs.get(CHECKAL), 0, 'opening a conversation cannot advance the errand');
  h.line(N.CHECKAL, 'If you can survive his rigorous training program, I shall offer you my help.').after();
  assert.equal(h.varbits.get(12065), 5);
  h.line(N.ATLAS, "That's a lot of money!").after(); assert.equal(h.varbits.get(12065), 10);
  h.attrs.set(CHECKAL, 2); assert.equal(h.quest.varbitValue(1, h.player), 15);
  h.quest.setStage(h.player, 5); assert.equal(h.varbits.get(12063), 120); assert.equal(h.varbits.get(12067), 1);
});
test('Checkal waits for a nearby real Flex after the workout and prompt', () => {
  const h = setup(), N = h.core.NpcIdentifiers;
  h.quest.setStage(h.player, 1); h.attrs.set(CHECKAL, 15); h.attrs.set('quest.below_ice_mountain.atlas-sessions', 1);
  h.action(N.CHECKAL, 'pPaqOe'); assert.equal(h.attrs.get(CHECKAL), 20); assert.equal(h.animations.length, 0);
  h.player.moveTo(new h.core.Location(3200, 3200, 0)); h.emit('player:emote', { sequence: 8917 }); assert.equal(h.tasks.length, 0);
  h.player.moveTo(new h.core.Location(3086, 3415, 0)); h.emit('player:emote', { sequence: 8917 });
  assert.equal(h.tasks.at(-1).ticks, 3); h.tasks.at(-1).run();
  h.line(N.CHECKAL, 'Thank you my friend, I will meet you there.').after();
  assert.equal(h.attrs.get(CHECKAL), 40); assert.equal(h.varbits.get(12063), 15);
});
test('sandwich recipe requires learning, uses make menu and stays usable after completion', () => {
  const h = setup(), I = h.core.ItemIdentifiers, recipe = h.hooks.items.find(x => x.second === 'Bread').fn;
  h.quest.setStage(h.player, 1); h.attrs.set(MARLEY, 5);
  for (const id of [I.KNIFE, I.BREAD, I.COOKED_MEAT]) h.inventory.set(id, 2);
  const event = { player: h.player, usedItemId: I.KNIFE, usedWithItemId: I.BREAD };
  assert.equal(recipe(event), false);
  h.line(h.core.NpcIdentifiers.COOK_2, 'Then, you take some bread. I recommend making it fresh.').after();
  assert.equal(h.varbits.get(12064), 10); assert.equal(recipe(event), true);
  assert.deepEqual(h.menu().getItems(), [I.BREADCRUMBS, I.STEAK_SANDWICH]); assert.equal(h.inventory.get(I.BREAD), 2);
  h.menu().execute(I.STEAK_SANDWICH, 1); assert.equal(h.inventory.get(I.STEAK_SANDWICH), 1); assert.equal(h.inventory.get(I.COOKED_MEAT), 1);
  assert.ok(h.messages.includes('You combine the cooked meat and bread to make a Steak sandwich!'));
  h.quest.setStage(h.player, 5); recipe(event); h.menu().execute(I.STEAK_SANDWICH, 1); assert.equal(h.inventory.get(I.STEAK_SANDWICH), 2);
});
test('RPS third-round cheat beats the actual shown sign for every player pick', () => {
  const h = setup(), N = h.core.NpcIdentifiers; h.quest.setStage(h.player, 1);
  for (const [pick, shown, cheat] of [['Rock.', 'Paper', 'Scissors'], ['Paper.', 'Scissors', 'Rock'], ['Scissors.', 'Rock', 'Paper']]) {
    h.emit('npc-dialogue:choice', { npcId: N.BURNTOF, option: pick });
    assert.equal(h.line(N.BURNTOF, 'Burntof chose [winning sign].').text, `Burntof chose ${shown.toLowerCase()}.`);
    assert.equal(h.line(N.BURNTOF, "You quickly change your sign to [sign that beats Burntof's].").text, `You quickly change your sign to ${cheat.toLowerCase()}.`);
  }
});
test('workout lasts 206 ticks, unlocks Flex at its end and cleans up logout', () => {
  const h = setup(), N = h.core.NpcIdentifiers; h.quest.setStage(h.player, 1); h.attrs.set(CHECKAL, 10);
  h.action(N.ATLAS, '_RwWTk'); assert.equal(h.player.getPrivateArea().getName(), 'Barbarian Workout');
  assert.equal(h.attrs.get('below-ice-mountain:training'), 1); assert.equal(h.varbits.get(12062), 0);
  const completeWorkout = h.tasks.at(-1);
  for (const task of h.tasks.filter(task => task.ticks < 206)) task.run();
  const woman = h.spawned.find(npc => npc.getId() === 10674);
  assert.equal(woman.chat, 'Catch!'); assert.equal(woman.animation, 385); assert.equal(woman.graphic, 30);
  assert.equal(h.projectiles[0][4], 29); assert.equal(h.graphics[0][0].id, 31); assert.equal(h.graphics[0][0].delay, 81);
  assert.ok(h.spawned.some(npc => npc.getId() === 10675), 'the recorded dog appears in the final run');
  assert.ok(h.spawned.some(npc => npc.getId() === 10678), 'the barbarian crowd appears for the last pushups');
  assert.equal(completeWorkout.ticks, 206); completeWorkout.run(); assert.equal(h.attrs.get(CHECKAL), 15); assert.equal(h.varbits.get(12062), 1);
  assert.equal(h.attrs.get('quest.below_ice_mountain.atlas-sessions'), 1);
  assert.equal(h.hooks.variants[0]({ player: h.player, npcId: N.CHECKAL }), 'checkal-the-strongman-talking-to-checkal-after-completing-atlas-training');
  assert.equal(h.hooks.variants[0]({ player: h.player, npcId: N.ATLAS }), 'checkal-the-strongman-talking-to-atlas-again-after-first-training-session');
  h.action(N.ATLAS, 'Ajwwje'); assert.equal(h.attrs.get('quest.below_ice_mountain.atlas-sessions'), 1);
  h.hooks.logout[0]({ player: h.player }); assert.equal(h.attrs.get('below-ice-mountain:training'), 0); assert.equal(h.player.getMovementQueue().blocked, false);
});
test('mining needs level/pickaxe, damages each distinct pillar once and gives 10 XP', () => {
  const h = setup(), N = h.core.NpcIdentifiers, O = h.core.ObjectIdentifiers;
  h.quest.setStage(h.player, 3); h.action(N.WILLOW, 'wWX1Ws');
  const guardian = h.spawned.at(-1), mine = h.hooks.objects[0];
  const click = () => { const object = h.objects.find(object => object.getId() === O.STRUCTURAL_PILLAR);
    h.player.moveTo(object.getLocation().transform(1, 0)); mine({ player: h.player, objectId: O.STRUCTURAL_PILLAR, object, clickType: 1 }); return object; };
  h.setMiningLevel(9); click(); assert.match(h.messages.at(-1), /Mining level of at least 10/);
  h.setMiningLevel(10); click(); assert.match(h.messages.at(-1), /pickaxe/);
  h.api.onCustomEvent('mining:best-pickaxe', event => { event.pickaxe = { animation: new h.core.Animation(625) }; });
  const first = click(); assert.equal(guardian.getHitpoints(), 40); assert.equal(h.tasks.at(-1).ticks, 8); h.tasks.at(-1).run(); assert.equal(guardian.getHitpoints(), 30);
  mine({ player: h.player, objectId: O.STRUCTURAL_PILLAR, object: first, clickType: 1 }); assert.equal(guardian.getHitpoints(), 30);
  for (let i = 0; i < 3; i++) { click(); h.tasks.at(-1).run(); }
  assert.equal(h.quest.getStage(h.player), 4); assert.equal(h.varbits.get(12063), 40); assert.equal(h.xp.reduce((sum, x) => sum + x.amount, 0), 40); assert.ok(h.removed.includes(guardian));
  h.player.getPrivateArea().destroy();
});

test('entrance uses a private crew and Marley scene, then replaces the awakening with a combat guardian', () => {
  const h = setup(), N = h.core.NpcIdentifiers;
  h.quest.setStage(h.player, 2);
  h.action(N.WILLOW, 'fOQUgc');
  const exterior = h.player.getPrivateArea();
  assert.equal(exterior.getName(), 'Opening Camdozaal');
  assert.deepEqual(h.spawned.map(npc => npc.getId()), [N.CHECKAL_2, N.BURNTOF_3, N.WILLOW_2, N.MARLEY_2]);
  h.action(N.WILLOW, 'JSFicf');
  assert.deepEqual([exterior.originX, exterior.originY], [2944, 5760]);
  h.action(N.WILLOW, '1Pscfp');
  const arena = h.player.getPrivateArea();
  assert.notEqual(arena, exterior);
  assert.equal(h.varbits.get(12063), 30);
  assert.equal(h.varbits.get(12065), 45);
  h.action(N.WILLOW, 'wWX1Ws');
  assert.equal(h.spawned.at(-1).getId(), N.ANCIENT_GUARDIAN_2);
  assert.equal(h.varbits.get(12063), 35);
  h.action(N.WILLOW, '6g-zlD');
  assert.equal(h.tasks.at(-1).ticks, 2);
  h.tasks.at(-1).run();
  assert.equal(h.spawned.at(-1).getId(), N.ANCIENT_GUARDIAN_2);
  h.line(N.WILLOW, "I can't believe they ran so quickly. I suppose I should take care of this thing.").after();
  assert.equal(h.tasks.at(-1).ticks, 5); h.tasks.at(-1).run();
  assert.equal(h.spawned.at(-1).getId(), N.ANCIENT_GUARDIAN);
  assert.equal(h.spawned.at(-1).target, h.player);
  assert.equal(h.player.getMovementQueue().blocked, false);
  h.hooks.logout[0]({ player: h.player });
});
test('the bag shows coins before completion; Ramarno finishes and rewards exactly once', () => {
  const h = setup(), N = h.core.NpcIdentifiers, I = h.core.ItemIdentifiers;
  h.quest.setStage(h.player, 4);
  h.hooks.objects[0]({ player: h.player, objectId: h.core.ObjectIdentifiers.RUINS_ENTRANCE, clickType: 1 });
  const rummage = h.action(N.RAMARNO_2, 'zy3NHn');
  assert.equal(h.quest.getStage(h.player), 4);
  assert.ok(rummage.steps.some(step => step.text === 'You find a pile of coins!'));
  h.line(N.RAMARNO_2, 'Bless my beard...').after();
  assert.equal(h.quest.getStage(h.player), 4, 'completion waits for the recorded fade');
  assert.equal(h.tasks.at(-1).ticks, 8); h.tasks.at(-1).run();
  assert.equal(h.quest.getStage(h.player), 5);
  assert.equal(h.varbits.get(12063), 120);
  assert.equal(h.inventory.get(I.COINS), 2000);
  assert.equal(h.attrs.get('quest.points'), 1);
  assert.equal(h.quest.scrollItemId, I.STEAK_SANDWICH);
  assert.equal(h.quest.completionJingleId, 152);
  h.emit('interface:closed', { interfaceId: 153 });
  assert.equal(h.attrs.get('below-ice-mountain:reward-pending'), 0);
  assert.equal(h.quest.complete(h.player), false);
  assert.equal(h.inventory.get(I.COINS), 2000);
  const depart = h.action(N.RAMARNO_2, 'i5wpmS');
  assert.equal(depart.steps[0].text, 'Ramarno departs for his workshop.');
  assert.equal(h.tasks.at(-1).ticks, 3); h.tasks.at(-1).run();
  assert.equal(h.varbits.get(12068), 1);
});
