// Run after `yarn build`: node --test tests/mcp-set-npc-hitpoints.test.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { test, before } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { NPC } = require('../dist/game/entity/impl/npc/NPC');
const { Player } = require('../dist/game/entity/impl/player/Player');
const { Location } = require('../dist/game/model/Location');
const { World } = require('../dist/game/World');
const { PluginManager } = require('../dist/plugins/PluginManager');
const z = require('zod');

const core = PluginManager.getCoreApi();
const players = new Map();
const tools = {};

require('../plugins/agent/mcp/Testing.AgentMcp')({
  core,
  z,
  tool: (name, _description, _schema, handler) => { tools[name] = handler; },
  player: z.string(),
  find: (username) => {
    const player = players.get(username);
    if (!player) throw new Error(`${username} is not online`);
    return player;
  },
  send: () => ({}),
  status: (player) => ({ x: player.getLocation().getX(), y: player.getLocation().getY(), z: player.getLocation().getZ() }),
  sleepTicks: async () => {},
  takeMessages: () => [],
  MAX_WAIT_TICKS: 50,
});

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
});

test('set_npc_hitpoints rejects invalid targets/HP and lowers a real NPC for the final player hit', () => {
  const player = new Player(null);
  player.getPacketSender = () => new Proxy({}, { get: () => () => {} });
  player.moveTo(new Location(2270, 4316, 0));
  player.setNeedsPlacement(false);
  player.setRegistered(true);
  players.set('qa', player);

  const npc = new NPC(797, new Location(2269, 4316, 0));
  assert.equal(World.getNpcs().add(npc, true), true, 'real NPC registered');
  const setHp = tools.set_npc_hitpoints;
  try {
    assert.throws(() => setHp({ player: 'qa', npcIndex: 999999, hitpoints: 1 }), /No NPC at index/);
    assert.throws(() => setHp({ player: 'qa', npcIndex: npc.getIndex(), hitpoints: 0 }), /from 1 to 130/);
    assert.throws(() => setHp({ player: 'qa', npcIndex: npc.getIndex(), hitpoints: 131 }), /from 1 to 130/);

    const lowered = setHp({ player: 'qa', npcIndex: npc.getIndex(), hitpoints: 60 });
    assert.equal(lowered.before, 130);
    assert.equal(lowered.hitpoints, 60);
    assert.equal(npc.getHitpoints(), 60, 'positive path lowers the real NPC');
    assert.throws(() => setHp({ player: 'qa', npcIndex: npc.getIndex(), hitpoints: 60 }), /must reduce/);

    player.setArea({ getObjects: () => [] });
    assert.throws(() => setHp({ player: 'qa', npcIndex: npc.getIndex(), hitpoints: 50 }), /private area/);
    player.setArea(null);

    const otherOwner = new Player(null);
    npc.setOwner(otherOwner);
    assert.throws(() => setHp({ player: 'qa', npcIndex: npc.getIndex(), hitpoints: 50 }), /Cannot target NPC/);
    npc.setOwner(null);

    const lastHit = setHp({ player: 'qa', npcIndex: npc.getIndex(), hitpoints: 1 });
    assert.equal(lastHit.hitpoints, 1);
    assert.equal(npc.getHitpoints(), 1, 'never sets an anonymous 0-HP death');
    assert.notEqual(npc.isDyingFunction?.(), true, 'the NPC stays alive for the real killing hit');
  } finally {
    World.getNpcs().remove(npc);
  }
});
