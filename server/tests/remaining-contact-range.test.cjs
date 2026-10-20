// From server/: yarn build && node --test tests/remaining-contact-range.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, before } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { NpcDefinitionLoader } = require('../dist/game/definition/loader/impl/NpcDefinitionLoader');
const { NpcDefinition } = require('../dist/game/definition/NpcDefinition');
const { NPC } = require('../dist/game/entity/impl/npc/NPC');
const { Player } = require('../dist/game/entity/impl/player/Player');
const { Location } = require('../dist/game/model/Location');
const { World } = require('../dist/game/World');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { NPCOptionPacketListener } = require('../dist/net/packet/impl/NPCOptionPacketListener');
const { NpcDialogue } = require('../dist/game/model/dialogues/entries/impl/NpcDialogue');
const runtime = require('../plugins/quests/QuestRuntime');

const ROOT = path.resolve(__dirname, '..');
const BLOCKED = 0x1280120;
let contactQuest;

before(async () => {
  await CachePipeline.initialize(ROOT);
  RegionManager.init();
  for (const [x, y] of [[2240, 4288], [2304, 4288], [2240, 4352], [2304, 4352]]) {
    RegionManager.loadMapFiles(x, y, false);
  }
  new NpcDefinitionLoader().load();

  const api = PluginManager.createApi('remaining-contact-range-test');
  require('../plugins/npcs/NpcDialogues.plugin').register(api);
  require('../plugins/quests/quests/Contact.Quest')(api);
  contactQuest = runtime.getRegisteredQuests().find((quest) => quest.key === 'contact');
  assert.ok(contactQuest, 'Contact quest registered through the real plugin API');
});

function account(x = 2262, y = 4320) {
  const player = new Player(null);
  const sender = new Proxy({}, {
    get: (target, key) => {
      if (key === 'getVarbit') return () => 0;
      if (key === 'isSubInterfaceOpen' || key === 'isChatboxInterface') return () => false;
      if (key === 'closeInterruptibleInterfaces') return () => {};
      return () => sender;
    },
  });
  player.getPacketSender = () => sender;
  player.moveTo(new Location(x, y, 0));
  player.setNeedsPlacement(false);
  return player;
}

function maisaNpc() {
  const npc = new NPC(3876, new Location(2258, 4317, 0));
  assert.equal(World.getNpcs().add(npc, true), true, 'real public Maisa registered');
  return npc;
}

function routeEvent(player, npc, range = 1) {
  return {
    player,
    npc,
    definition: npc.getCurrentDefinition(player),
    npcId: npc.getContentId(player),
    npcIndex: npc.getIndex(),
    clickType: 1,
    location: { x: npc.getLocation().getX(), y: npc.getLocation().getY(), z: npc.getLocation().getZ() },
    handled: false,
    range,
  };
}

test('Contact: real cache keeps Maisa on the west bank across the blocked chasm', () => {
  assert.equal(RegionManager.getClipping(2258, 4317, 0, null) & BLOCKED, 0, 'Maisa spawn tile is walkable');
  assert.equal(RegionManager.getClipping(2263, 4318, 0, null) & BLOCKED, 0, 'east landing is walkable');
  assert.notEqual(RegionManager.getClipping(2260, 4318, 0, null) & BLOCKED, 0, 'the chasm blocks the direct line');

  assert.equal(NpcDefinition.forId(3876).getName(), 'Maisa');
  assert.ok(NpcDefinition.forId(3876).getActions().includes('Talk-to'), 'real cache definition has Talk-to');

  const spawns = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/definitions/npc-spawns.json'), 'utf8'));
  const spawn = spawns.find((entry) => entry.id === 6164);
  assert.deepEqual({ name: spawn?.name, x: spawn?.x, y: spawn?.y }, { name: 'Maisa', x: 2258, y: 4317 });

  const dialogues = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/definitions/npc-dialogues.json'), 'utf8'));
  const variant = dialogues['Contact!'].variants['kaleef-s-corpse-talking-to-maisa'];
  const options = variant.filter((step) => step.type === 'choice').flatMap((step) => step.options.map((option) => option.text));
  assert.ok(options.includes('Draynor Village.') && options.includes('Leela.'), 'shipped quiz answers are intact');
});

test('Contact: the route hook widens only real Maisa on stages 40-60', () => {
  const player = account();
  const npc = maisaNpc();
  const unrelated = new NPC(3875, new Location(2258, 4317, 0));
  const owned = new NPC(3876, new Location(2258, 4317, 0));
  owned.setOwner(player);

  try {
    for (const [stage, range] of [[39, 1], [40, 10], [50, 10], [60, 10], [61, 1]]) {
      contactQuest.setStage(player, stage);
      const event = routeEvent(player, npc);
      PluginManager.emitNpcRoute(event);
      assert.equal(event.range, range, `stage ${stage} route range`);
    }

    contactQuest.setStage(player, 50);
    const otherEvent = routeEvent(player, unrelated);
    PluginManager.emitNpcRoute(otherEvent);
    assert.equal(otherEvent.range, 1, 'unrelated NPCs keep the default range');

    const ownerEvent = routeEvent(player, owned);
    PluginManager.emitNpcRoute(ownerEvent);
    assert.equal(ownerEvent.range, 1, 'owner-only NPCs do not inherit Maisa far-talk');
  } finally {
    World.getNpcs().remove(npc);
  }
});

test('Contact: a normal Talk-to reaches the real Maisa dialogue across the chasm', () => {
  const player = account(2262, 4320);
  contactQuest.setStage(player, 50);
  const npc = maisaNpc();

  try {
    new NPCOptionPacketListener().executeOption(player, npc.getIndex(), 1);

    assert.equal(player.getLocation().getX(), 2262);
    assert.equal(player.getLocation().getY(), 4320);
    assert.equal(player.getDialogueManager().isActive(), true, 'Talk-to opened a dialogue');
    const dialogue = player.getDialogueManager().getCurrent();
    assert.ok(dialogue instanceof NpcDialogue);
    assert.match(dialogue.getText(), /You're not Kaleef!/);
  } finally {
    World.getNpcs().remove(npc);
  }
});

test('Contact: the MovementQueue route uses range 10 and completes without the radius-2 fallback', () => {
  const player = account(2262, 4320);
  contactQuest.setStage(player, 50);
  const npc = maisaNpc();

  try {
    const event = routeEvent(player, npc);
    PluginManager.emitNpcRoute(event);
    assert.equal(event.range, 10);

    let opened = 0;
    player.getMovementQueue().walkToEntity(npc, () => opened++, event.range);
    assert.equal(opened, 1, 'the ranged interaction resolves on the initial route');
    assert.equal(player.getMovementQueue().points.length, 0, 'no walk was queued across the chasm');
  } finally {
    World.getNpcs().remove(npc);
  }
});
