// From server/: node --test tests/remaining-custodia-dawn-parity.test.cjs (after yarn build).
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const path = require('node:path');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { DialogueManager } = require('../dist/game/model/dialogues/DialogueManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const { CacheDefinitions } = require('../dist/game/cache/CacheDefinitions');
const runtime = require('../plugins/quests/QuestRuntime');
const core = PluginManager.getCoreApi();
const I = core.ItemIdentifiers, N = core.NpcIdentifiers, O = core.ObjectIdentifiers;
let nextIndex = 1;
const noop = () => {};

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  new NpcDefinitionLoader().load();
});

function harness(name) {
  const hooks = {}, events = [], tasks = [], npcs = [], objects = [], namedNpcs = new Map(), npcHandlers = [], namedObjects = new Map();
  const ground = new Map();
  const groundManager = {
    getGroundItem(username, id, tile) { return ground.get(`${username}:${id}:${tile.getX()}:${tile.getY()}:${tile.getZ()}`) ?? null; },
    registerLocation(player, item, tile) { ground.set(`${player.getUsername()}:${item.getId()}:${tile.getX()}:${tile.getY()}:${tile.getZ()}`, item); },
  };
  const api = new Proxy({
    core: {
      ...core,
      TaskManager: { submit(task) { task.setRunning(true); tasks.push(task); }, cancelTasks() {} },
      World: { ...core.World, getNpcs: () => npcs },
      ObjectManager: { register: object => objects.push(object), deregister: noop },
    },
    persistAttribute: noop,
    onCustomEvent: (key, fn) => (events[key] ??= []).push(fn),
    emitCustomEvent: (key, event) => (events[key] ?? []).forEach(fn => fn(event)),
    onObjectClick: noop,
    onObjectFirstClick: noop,
    getObjectManager: () => ({ register: object => objects.push(object), deregister: noop }),
    getItemOnGroundManager: () => groundManager,
    getWorld: () => ({ getNpcs: () => npcs }),
    onObjectInteraction: (target, actions) => {
      if (typeof target === 'function') (hooks.onObjectInteraction ??= []).push(target);
      else namedObjects.set(target, actions);
    },
    onNpcInteraction: (name, actions) => {
      namedNpcs.set(name, actions);
      for (const [action, fn] of Object.entries(actions)) npcHandlers.push({ name, action, fn });
    },
    sendMultiChatboxPrompt(p, title, ...pairs) { p.prompt = { title, options: pairs.filter((_, i) => i % 2 === 0), pairs }; return true; },
    onItemAction: (name, actions) => (hooks.onItemAction ??= []).push(...Object.values(actions)),
    spawnNpc(definition) {
      let tile = new core.Location(definition.x, definition.y, definition.z);
      const npc = {
        ...definition, index: nextIndex++, getId: () => definition.id, isRegistered: () => !npc.removed,
        getOwner: () => definition.owner, isDyingFunction: () => false, getHitpoints: () => 1, setArea: noop, setPositionToFace: noop,
        getLocation: () => tile, moveTo: value => { tile = value; }, forceChat: text => { npc.chat = text; },
        remove() { npc.removed = true; },
      };
      npcs.push(npc);
      return npc;
    },
    removeNpc: npc => { npc.removed = true; },
  }, { get: (target, key) => target[key] ?? ((...args) => (hooks[key] ??= []).push(args.find(x => typeof x === 'function'))) });
  const names = [].concat(name);
  for (const questName of names) require(`../plugins/quests/quests/${questName}.Quest`)(api);
  PluginManager.emitNpcDialogueCondition = event => {
    for (const fn of hooks.onNpcDialogueCondition ?? []) {
      const answer = fn(event);
      if (answer !== null && answer !== undefined) return answer;
    }
    return null;
  };
  return {
    api, hooks, events, objects, npcs, namedNpcs, npcHandlers, namedObjects, ground, quests: runtime.getRegisteredQuests().slice(-[].concat(name).length), quest: runtime.getRegisteredQuests().at(-1),
    emit: (name, event) => (events[name] ?? []).forEach(fn => fn(event)),
    object(player, objectId, clickType = 1, location = null) {
      const tile = location?.getX ? { x: location.getX(), y: location.getY(), z: location.getZ() } : location ?? {
        x: player.getLocation().getX(), y: player.getLocation().getY(), z: player.getLocation().getZ(),
      };
      const event = {
        player, objectId, clickType, option: 'Inspect',
        object: { getId: () => objectId, getLocation: () => new core.Location(tile.x, tile.y, tile.z) },
        definition: { getName: () => '', getInteractions: () => ['', 'Inspect'] },
        location: { x: tile.x, y: tile.y, z: tile.z },
        sourceLocation: { x: tile.x, y: tile.y, z: tile.z },
        handled: false,
      };
      for (const fn of hooks.onObjectInteraction ?? []) fn(event);
      return event;
    },
    action(player, npcId, stepId) {
      const event = { player, npcId, stepId };
      this.emit('npc-dialogue:action', event);
      return event;
    },
    line(player, npcId, text) {
      const event = { player, npcId, text };
      this.emit('npc-dialogue:line', event);
      return event;
    },
    talk(player, npcId) {
      const variant = (hooks.onNpcDialogueVariant ?? []).map(fn => fn({ player, npcId })).find(Boolean);
      assert.ok(variant, `no variant for ${npcId}`);
      runtime.startTranscript(api, player, npcId, typeof variant === 'string' ? this.quest.name : variant.page, typeof variant === 'string' ? variant : variant.variant);
    },
    tick(count = 1) {
      while (count-- > 0) {
        for (const task of [...tasks]) task.tick();
      }
    },
    advanceToPrompt(player, limit = 80) {
      while (!player.prompt) {
        assert.ok(limit-- > 0, 'dialogue stalled');
        assert.ok(player.manager.getCurrent(), 'dialogue ended');
        player.manager.advance();
      }
    },
    choose(player, label) {
      const prompt = player.prompt;
      assert.ok(prompt, `no prompt for ${label}`);
      const index = prompt.options.indexOf(label);
      assert.ok(index >= 0, `missing ${label}`);
      player.prompt = null;
      prompt.pairs[index * 2 + 1]();
    },
    interfaceClick(player, groupId, childId) {
      for (const fn of hooks.onInterfaceActionClick ?? []) fn({ player, groupId, childId, handled: false });
    },
  };
}

function player(level = 99, current = 99) {
  const attrs = new Map(), items = new Map(), configs = new Map(), varbits = new Map(), log = [];
  let location = new core.Location(3210, 3220, 0), area = null;
  const packet = new Proxy({
    sendVarbit: (id, value) => varbits.set(id, value),
    sendConfig: (id, value) => configs.set(id, value),
    sendMessage: text => p.messages.push(text),
    sendInterfaceRemoval: () => p.manager?.reset?.(),
    sendCameraMoveTo: (...args) => { p.camera.push(['move', ...args]); return packet; },
    sendCameraLookAt: (...args) => { p.camera.push(['look', ...args]); return packet; },
    sendCameraReset: () => { p.camera.push(['reset']); return packet; },
    sendCameraShake: (...args) => { p.camera.push(['shake', ...args]); return packet; },
    sendSubInterface: (...args) => { p.camera.push(['sub', ...args]); return packet; },
    closeSubInterface: (...args) => { p.camera.push(['close', ...args]); return packet; },
    sendObjectRemoval: noop,
    sendInterface: id => { p.interface = id; return packet; },
    sendInterfaceScript: (id, args) => { p.interfaceScript = { id, args }; return packet; },
  }, { get: (t, key) => t[key] ?? (() => packet) });
  const p = {
    attrs, items, configs, varbits, log, messages: [], camera: [], full: false,
    getAttribute: key => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value),
    getInventory: () => ({
      getAmount: id => items.get(id) ?? 0,
      getFreeSlots: () => (p.full ? 0 : 28),
      adds: (id, amount) => items.set(id, (items.get(id) ?? 0) + amount),
      deleteNumber: (id, amount) => items.set(id, (items.get(id) ?? 0) - amount),
    }),
    getSkillManager: () => ({
      getMaxLevel: () => level,
      getCurrentLevel: () => current,
      addExperiences: noop,
    }),
    getPacketSender: () => packet,
    getDialogueManager: () => p.manager,
    getEquipment: () => ({ get: slot => (slot === core.Equipment.BODY_SLOT ? { getId: () => I.EMISSARY_ROBE_TOP } : { getId: () => I.EMISSARY_ROBE_BOTTOM }) }),
    getLocation: () => location,
    moveTo: to => { location = to; },
    getArea: () => area,
    setArea: value => { area = value; },
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement(value) { p.blocked = value; return this; } }),
    setUntargetable: value => { p.untargetable = value; },

    getUsername: () => 'Parity',
    sendMessage: text => p.messages.push(text),
    setEnteredAmountAction(action) { p.amountAction = action; },
    getEnteredAmountAction() { return p.amountAction; },
    getIndex: () => 1,
    getAsPlayer: () => p,
    isPlayer: () => true,
    isRegistered: () => true,
    isPlayerBot: () => false,
    getWorld: () => null,
  };
  p.manager = new DialogueManager(p);
  return p;
}

function completeQuests(h, keys) {
  (h.events['quest:is-complete'] ??= []).push(event => {
    if (keys.includes(event.key)) event.complete = true;
  });
}

const SUN_ORDER_STEPS = [[1, 5], [7, 3], [6, 4]]; // [Itzla, player], QH order 1
function sunPair(step) {
  const [itzla, player] = SUN_ORDER_STEPS[step];
  return [player, itzla];
}
const SUN_TILES = [[1337,9453],[1339,9446],[1337,9439],[1330,9436],[1323,9439],[1320,9446],[1323,9453],[1330,9456]];


test('Final Dawn start survives Heart of Darkness completion through the shipped cache transform', () => {
  const h = harness(['TheHeartOfDarkness', 'TheFinalDawn']), p = player();
  const hod = h.quests.find(quest => quest.key === 'the_heart_of_darkness');
  const fd = h.quests.find(quest => quest.key === 'the_final_dawn');
  assert.ok(hod && fd);

  hod.complete(p);
  h.emit('player:bootstrap-complete', { player: p });
  assert.equal(p.varbits.get(16668), 1);

  const base = CacheDefinitions.getNpc(14054);
  const resolved = base.transform(
    { getVarbit: id => p.varbits.get(id) ?? 0, getVarp: () => 0 },
    { load: id => CacheDefinitions.getNpc(id) }
  );
  assert.equal(resolved?.id, 13694);
  assert.equal(resolved?.name, 'Servius, Teokan of Ralos');

  completeQuests(h, ['the_heart_of_darkness', 'perilous_moons', 'twilights_promise', 'children_of_the_sun']);
  const talk = h.npcHandlers.filter(handler => handler.name === 'Servius, Teokan of Ralos' && handler.action === 'Talk-to');
  let handled = false;
  for (const handler of talk) handled = handler.fn({ player: p, npcId: resolved.id }) || handled;
  assert.equal(handled, true);
  assert.equal(fd.getStage(p), 0);
  assert.ok(p.manager.getCurrent());

  h.advanceToPrompt(p);
  h.choose(p, 'Yes.');
  assert.equal(fd.getStage(p), 1);
  const countBefore = h.npcs.filter(npc => [14054, 13694, 14377].includes(npc.id)).length;
  for (const handler of talk) handler.fn({ player: p, npcId: 13694 });
  assert.equal(fd.getStage(p), 1);
  assert.equal(h.npcs.filter(npc => [14054, 13694, 14377].includes(npc.id)).length, countBefore);

  fd.complete(p);
  handled = false;
  for (const handler of talk) handled = handler.fn({ player: p, npcId: 13694 }) || handled;
  assert.equal(handled, true);
  assert.equal(h.npcs.filter(npc => [14054, 13694, 14377].includes(npc.id)).length, countBefore);
});

test('Shadows of Custodia matches captured stage 4 on Ictus and advances once inside the den', () => {
  const h = harness('ShadowsOfCustodia'), p = player();
  h.quest.setStage(p, 2);
  h.line(p, 14212, 'Oh, yes!');
  assert.equal(h.quest.getStage(p), 4);
  h.line(p, 14208, 'Hello.');
  h.line(p, 14660, 'Welcome.');
  h.line(p, 14656, 'Nilsal.');
  assert.equal(h.quest.getStage(p), 4);
  h.quest.setStage(p, 10);
  const enter = { player: p, objectId: 56439, clickType: 2, definition: { getInteractions: () => ['', 'Enter'] } };
  for (const fn of h.hooks.onObjectInteraction) fn(enter);
  h.tick(2);
  assert.equal(h.quest.getStage(p), 12);
  for (const fn of h.hooks.onZoneEnter ?? []) fn({ player: p });
});

test('Shadows of Custodia refuses to reinforce before stage 15 and keeps the logs', () => {
  const h = harness('ShadowsOfCustodia'), p = player();
  h.quest.setStage(p, 6);
  p.items.set(I.MAPLE_LOGS, 4); p.items.set(I.HAMMER, 1);
  const event = { player: p, objectId: 56432, clickType: 2, definition: { getInteractions: () => ['', 'Reinforce'] } };
  for (const fn of h.hooks.onObjectInteraction) fn(event);
  assert.equal(p.items.get(I.MAPLE_LOGS), 4);
  assert.equal(h.quest.getStage(p), 6);
});

test('The Final Dawn applies all four quest prerequisites and base levels', () => {
  const h = harness('TheFinalDawn'), p = player(99, 1);
  h.quest.setStage(p, 0);
  h.emit('npc-dialogue:hook', { player: p, hook: 'quest:the-final-dawn:start' });
  assert.equal(h.quest.getStage(p), 0);
  completeQuests(h, ['the_heart_of_darkness', 'perilous_moons', 'twilights_promise']);
  h.emit('npc-dialogue:hook', { player: p, hook: 'quest:the-final-dawn:start' });
  assert.equal(h.quest.getStage(p), 0);
  completeQuests(h, ['children_of_the_sun']);
  h.emit('npc-dialogue:hook', { player: p, hook: 'quest:the-final-dawn:start' });
  assert.equal(h.quest.getStage(p), 1);
});

test('The Final Dawn sun altar consumes essence and the barrel puzzle needs the glass before the lever', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 55);
  const [playerAltar, itzlaAltar] = sunPair(0);
  p.attrs.set('the-final-dawn:sun-itzla', (itzlaAltar + 1) % 8);
  p.items.set(I.KUHU_ESSENCE, 1);
  h.object(p, 56687, 1, { x: SUN_TILES[playerAltar][0], y: SUN_TILES[playerAltar][1], z: 1 });
  assert.equal(p.attrs.get('quest.the_final_dawn.sun'), undefined);
  assert.equal(p.items.get(I.KUHU_ESSENCE), 1);
  p.attrs.set('the-final-dawn:sun-itzla', itzlaAltar);
  h.object(p, 56687, 1, { x: SUN_TILES[playerAltar][0], y: SUN_TILES[playerAltar][1], z: 1 });
  assert.equal(p.attrs.get('quest.the_final_dawn.sun'), 1);
  assert.equal(p.items.get(I.KUHU_ESSENCE), 0);

  h.quest.setStage(p, 31);
  for (const [objectId, itemId] of [[56491, I.BEER], [56492, I.STEAMFORGE_BREW], [56493, I.DWARVEN_STOUT], [56494, I.WIZARDS_MIND_BOMB], [56490, I.BEER_GLASS]]) {
    p.items.set(itemId, 1);
    for (const fn of h.hooks.onItemOnObject) fn({ player: p, objectId, itemId, handled: false });
  }
  assert.equal(p.attrs.get('quest.the_final_dawn.barrels'), 5);
  h.object(p, 56496);
  h.action(p, N.ATTALA, 'pRXkuK');
  assert.equal(h.quest.getStage(p), 34);
});


test('The Final Dawn safe-house follows captured stages 15 to 22', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 14);
  h.object(p, 56498); assert.equal(h.quest.getStage(p), 15);
  h.object(p, 56498); assert.equal(h.quest.getStage(p), 16);
  p.items.set(I.BONES, 1);
  for (const fn of h.hooks.onItemOnNpc) fn({ player: p, npcId: 14236, itemId: I.BONES, handled: false });
  assert.equal(h.quest.getStage(p), 17);
  h.object(p, 56513); assert.equal(h.quest.getStage(p), 18);
  h.object(p, 52630); assert.equal(h.quest.getStage(p), 19);
  p.items.set(I.COIN_PURSE, 1);
  for (const fn of h.hooks.onItemAction) fn({ player: p, itemId: I.COIN_PURSE, option: 'Open', handled: false });
  assert.equal(h.quest.getStage(p), 20);
  p.items.set(I.EMPTY_COIN_PURSE, 1);
  for (const fn of h.hooks.onItemOnObject) fn({ player: p, objectId: 56472, itemId: I.EMPTY_COIN_PURSE, handled: false });
  assert.equal(h.quest.getStage(p), 21);
  p.items.set(I.KNIFE, 1);
  for (const fn of h.hooks.onItemOnObject) fn({ player: p, objectId: 56470, itemId: I.KNIFE, handled: false });
  assert.equal(h.quest.getStage(p), 22);
});


test('Shadows of Custodia den entry plays the captured fade and rockslide locs', () => {
  const h = harness('ShadowsOfCustodia'), p = player();
  h.quest.setStage(p, 10);
  const event = { player: p, objectId: 56439, clickType: 2, definition: { getInteractions: () => ['', 'Enter'] } };
  for (const fn of h.hooks.onObjectInteraction) fn(event);
  h.tick(4);
  assert.ok(p.camera.some(packet => packet[0] === 'sub'));
  assert.ok(h.objects.some(object => [57642, 57643, 57645, 11426].includes(object.getId?.() ?? object.id)));
  assert.equal(h.quest.getStage(p), 12);
});

test('The Final Dawn basement, archive and safe-house hooks emit captured camera/fade beats and clean actors', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 5);
  h.action(p, 13706, '1cZjnd');
  assert.ok(p.camera.some(packet => packet[0] === 'move' && packet[1] === 1705));

  h.quest.setStage(p, 22);
  p.attrs.set('quest.the_final_dawn.last', 0);
  p.manager.reset();
  h.namedNpcs.get('Captain Vibia')['Talk-to']({ player: p, npcId: 14303 });
  h.tick(3);
  assert.ok(p.camera.some(packet => packet[0] === 'move' && packet[1] === 1648));
  assert.ok(h.npcs.some(npc => npc.id === 14241 && !npc.removed));
  h.action(p, 14303, 'XR0VTA');
  assert.ok(p.camera.some(packet => packet[0] === 'reset'));
  assert.equal(h.quest.getStage(p), 23);
});

test('The Final Dawn crypt uses six captured waves before Ennius', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 46);
  const event = { player: p, objectId: 56636, clickType: 1, definition: { getInteractions: () => ['Enter'] } };
  for (const fn of h.hooks.onObjectInteraction) fn(event);
  assert.equal(h.quest.getStage(p), 47);
  for (let wave = 1; wave <= 5; wave++) {
    const alive = h.npcs.filter(npc => !npc.removed && [14401, 14407].includes(npc.id));
    assert.ok(alive.length > 1);
    for (const npc of alive) { npc.removed = true; h.hooks.onNpcDeath[0]({ npc, npcId: npc.id, player: p }); }
    assert.equal(p.attrs.get('the-final-dawn:wave'), wave + 1);
  }
  const alive = h.npcs.filter(npc => !npc.removed && [14401, 14407].includes(npc.id));
  for (const npc of alive) { npc.removed = true; h.hooks.onNpcDeath[0]({ npc, npcId: npc.id, player: p }); }
  assert.equal(h.quest.getStage(p), 50);
});

test('The Final Dawn moon statue asks for the captured kindling count', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 55);
  p.items.set(I.ROOT_KINDLING, 8);
  h.object(p, 56690);
  assert.ok(p.prompt);
  h.choose(p, '2');
  assert.equal(p.attrs.get('quest.the_final_dawn.moon'), 1);
  assert.equal(p.items.get(I.ROOT_KINDLING), 6);
});

test('The Final Dawn temple chest validates the captured four-pin code, first attempt allowed', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 7);
  h.object(p, 56537, 1, new core.Location(1723, 9709, 0));
  assert.equal(p.interface, 811);
  assert.deepEqual(p.interfaceScript.args.slice(-4), [4, 0, 0, 0]);
  assert.ok(p.amountAction, 'confirm countdialog is armed');

  // Recorded guesses and ternary feedback are sent back to the client.
  for (const [guess, feedback] of [[0, 702], [43, 708], [80, 708], [117, 710]]) {
    p.amountAction.execute(guess);
    assert.equal(p.varbits.get(16693) ?? 0, 0);
    h.tick(1);
    assert.equal(p.interface, 811);
    assert.deepEqual(p.interfaceScript.args.slice(-4).slice(-2), [guess, feedback]);
    assert.ok(p.amountAction);
  }
  // Correct code works immediately, with no invented five-attempt gate.
  p.amountAction.execute(153);
  assert.equal(p.varbits.get(16693), 1);
  assert.ok(p.messages.includes('You picklock the chest and find a scroll inside.'));
  assert.equal(p.amountAction, null, 'success clears the countdialog action');
});

test('The Final Dawn stale lockpick success after leaving STAGE_SCROLL is inert', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 7);
  h.object(p, 56537, 1, new core.Location(1723, 9709, 0));
  const action = p.amountAction;
  h.quest.setStage(p, 8);
  action.execute(153);
  assert.equal(p.varbits.get(16693) ?? 0, 0);
  assert.equal(p.attrs.get('the-final-dawn:chest-lockpick-solved') ?? 0, 0);
  assert.ok(!p.messages.includes('You picklock the chest and find a scroll inside.'));
});

test('The Final Dawn patrol kick cancels an active lockpick before teleporting', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 7);
  h.object(p, 56537, 1, new core.Location(1723, 9709, 0));
  assert.ok(p.amountAction);
  h.quest.setStage(p, 4);
  h.hooks.onPlayerLogin[0]({ player: p });
  p.moveTo(new core.Location(1684, 9705, 0));
  h.tick(1);
  assert.equal(p.amountAction, null, 'patrol kick closes the lockpick prompt');
  assert.ok(p.messages.includes('A guard spots you in a restricted area and kicks you out.'));
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1679, 9698]);
});

test('The Final Dawn temple talk accepts the visible Ascended family only at the temple stage', () => {
  const h = harness('TheFinalDawn'), p = player();
  const def = CacheDefinitions.getNpc(13744);
  assert.equal(def?.name, 'Emissary Ascended');
  h.quest.setStage(p, 3);
  const talk = h.namedNpcs.get('Emissary Ascended')['Talk-to'];
  assert.equal(talk({ player: p, npcId: 13744 }), true);
  h.action(p, 13744, 'QNa_aF');
  assert.equal(h.quest.getStage(p), 4);
  h.quest.complete(p);
  assert.equal(talk({ player: p, npcId: 13744 }), false, 'post-quest Talk-to yields');
  const stage = h.quest.getStage(p);
  h.action(p, 13744, 'QNa_aF');
  assert.equal(h.quest.getStage(p), stage, 'post-quest sermon action is inert');
});

test('The Final Dawn Enforcer patrol spots the player and cleans up at the fight', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 4);
  h.hooks.onPlayerLogin[0]({ player: p });
  const patrol = h.npcs.find(npc => npc.id === 14266);
  assert.ok(patrol, 'captured patrol spawned');
  assert.equal(patrol.owner, p);
  assert.equal(patrol.ownerOnly, true);
  p.moveTo(new core.Location(1684, 9705, 0));
  h.tick(1);
  assert.equal(p.messages.includes('A guard spots you in a restricted area and kicks you out.'), true);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1679, 9698]);
  h.quest.setStage(p, 8);
  h.hooks.onPlayerLogin[0]({ player: p });
  assert.ok(!h.npcs.some(npc => npc.id === 14266 && !npc.removed), 'patrol removed for the fight');
});

test('The Final Dawn safehouse loot is a ground pickup and the sack empties naturally', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 16);
  h.hooks.onPlayerLogin[0]({ player: p });
  assert.ok(h.ground.has('Parity:5424:1645:3091:0'), 'potato sack ground spawn');
  assert.ok(h.ground.has('Parity:946:1646:3095:0'), 'knife ground spawn');
  p.items.set(5424, 1);
  for (const fn of h.hooks.onItemAction) fn({ player: p, itemId: 5424, option: 'Empty', handled: false });
  assert.equal(p.items.get(5424) ?? 0, 0);
  assert.equal(p.items.get(I.EMPTY_SACK), 1);
  assert.equal(p.items.get(I.POTATO), 3);
});


test('The Final Dawn scene cleanup restores controls and camera on logout', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 22);
  h.namedNpcs.get('Captain Vibia')['Talk-to']({ player: p, npcId: 14303 });
  h.tick(3);
  for (const fn of h.hooks.onPlayerLogout) fn({ player: p });
  assert.equal(p.blocked, false);
  assert.ok(p.camera.some(packet => packet[0] === 'reset'));
  assert.equal(p.getArea(), null);
});

test('The Final Dawn keystone Locate uses the three captured tiles, varbit 16671 and ordered checkpoints', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 40);
  p.items.set(I.KEYSTONE_FRAGMENT, 1);
  const locate = () => {
    for (const fn of h.hooks.onItemAction) fn({ player: p, itemId: I.KEYSTONE_FRAGMENT, option: 'Locate', handled: false });
  };
  p.moveTo(new core.Location(1500, 9700, 0));
  locate();
  assert.equal(p.varbits.get(16671) ?? 0, 0, 'wrong tile does not advance');
  p.moveTo(new core.Location(1511, 9702, 0));
  locate();
  assert.equal(p.varbits.get(16671), 1);
  assert.equal(h.quest.getStage(p), 40);
  p.moveTo(new core.Location(1375, 9684, 0));
  locate();
  assert.equal(p.varbits.get(16671), 2);
  assert.equal(h.quest.getStage(p), 40);
  p.moveTo(new core.Location(1373, 9539, 0));
  locate();
  assert.equal(h.quest.getStage(p), 41);
  assert.equal(p.items.get(I.KEYSTONE_FRAGMENT) ?? 0, 0);
  assert.equal(p.varbits.get(16671), 2);
  p.attrs.set('the-final-dawn:neypotzli-checkpoint', 2);
  p.varbits.delete(16671);
  h.hooks.onPlayerLogin[0]({ player: p });
  assert.equal(p.varbits.get(16671), 2, 'login resyncs the saved checkpoint');
});

test('The Final Dawn glowing symbol only starts the fight at stage 41', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 40);
  h.object(p, 56620, 1, { x: 1375, y: 9537, z: 0 });
  assert.equal(h.quest.getStage(p), 40, 'symbol is inert before the third locate');
  h.quest.setStage(p, 41);
  h.object(p, 56620, 1, { x: 1375, y: 9537, z: 0 });
  h.action(p, 14331, 'maos4n');
  assert.equal(h.quest.getStage(p), 43);
  assert.ok(h.npcs.some(npc => npc.id === 14362));
});

test('The Final Dawn logout removes every tracked owner NPC before a fresh login', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 23);
  h.hooks.onPlayerLogin[0]({ player: p });
  const spawned = h.npcs.filter(npc => !npc.removed);
  assert.ok(spawned.some(npc => npc.id === 14303), 'Vibia is spawned for the owner');
  assert.ok(spawned.some(npc => npc.id === 14236), 'the guard dog is spawned for the owner');

  for (const fn of h.hooks.onPlayerLogout) fn({ player: p });
  assert.ok(spawned.every(npc => npc.removed), 'logout removes every tracked owner NPC');

  const relogged = player();
  h.quest.setStage(relogged, 23);
  h.hooks.onPlayerLogin[0]({ player: relogged });
  assert.equal(h.npcs.filter(npc => !npc.removed && npc.id === 14303).length, 1, 'relog spawns one Vibia');
  assert.equal(h.npcs.filter(npc => !npc.removed && npc.id === 14236).length, 1, 'relog spawns one dog');
});

test('The Final Dawn Neypotzli gates lead through Streambound, Earthbound and Ancient Prison in order', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 37);
  h.object(p, 51375);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [1440, 9616, 1]);
  h.quest.setStage(p, 39);
  h.object(p, 51376);
  assert.equal(h.quest.getStage(p), 40);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1481, 9669]);
  p.attrs.set('the-final-dawn:neypotzli-checkpoint', 1);
  h.object(p, 51378);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1390, 9676]);
  p.attrs.set('the-final-dawn:neypotzli-checkpoint', 2);
  h.object(p, 51377);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY()], [1347, 9590]);
});

test('The Final Dawn temple stairs dispatch through real Ladders and require Final then Dawn', () => {
  const h = harness('TheFinalDawn'), p = player();
  require('../plugins/objects/Ladders.plugin').register(h.api);
  h.quest.setStage(p, 4);
  const stairs = h.namedObjects.get('Stairs')['Climb-down'];
  const event = (player = p) => ({ player, objectId: 54518, clickType: 1, object: { getLocation: () => new core.Location(1677, 3247, 0) }, definition: { getName: () => 'Stairs' }, handled: false });

  const wrong = event();
  assert.equal(stairs(wrong), true);
  h.advanceToPrompt(p);
  h.choose(p, 'Final.');
  h.advanceToPrompt(p);
  h.choose(p, 'Rise.');
  assert.equal(h.quest.getStage(p), 4, 'wrong phrase does not enter the basement');
  assert.notDeepEqual([p.getLocation().getX(), p.getLocation().getY()], [1672, 9687]);

  const correct = event();
  assert.equal(stairs(correct), true);
  h.advanceToPrompt(p);
  h.choose(p, 'Final.');
  h.advanceToPrompt(p);
  h.choose(p, 'Dawn.');
  assert.equal(h.quest.getStage(p), 5);
  assert.deepEqual([p.getLocation().getX(), p.getLocation().getY(), p.getLocation().getZ()], [1672, 9687, 0]);
  assert.equal(event().handled, false, 'stairs are not claimed after stage 4');
});

test('The Final Dawn final chamber follows captured stages 65 to 66', () => {
  const h = harness('TheFinalDawn'), p = player();
  h.quest.setStage(p, 65);
  h.object(p, 56600);
  h.object(p, 56603);
  h.object(p, 56615);
  h.object(p, 56595);
  assert.equal(h.quest.getStage(p), 66);
  assert.equal(p.items.get(I.STONE_TABLET_12), 1);
});
