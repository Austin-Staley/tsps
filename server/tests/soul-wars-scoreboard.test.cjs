// Run after `npx tsc --build`: node --test tests/soul-wars-scoreboard.test.cjs
//
// The Soul Wars lobby scoreboard (soul_wars_scoreboard: View, interface soul_wars_stats) on a real
// Player with only the network stubbed: the text it writes, the world's records across players and
// a restart, and the boards' placement. The game flow feeding it is in tests/soul-wars.test.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, beforeEach, after } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { RegionManager } = require('../dist/game/collision/RegionManager');
const { MapObjects } = require('../dist/game/entity/impl/object/MapObjects');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { Location } = require('../dist/game/model/Location');
const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');

const Common = require('../plugins/minigames/soulwars/Common.SoulWars');
const Scoreboard = require('../plugins/minigames/soulwars/Scoreboard.SoulWars');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-wars-board-'));
const hooks = { objects: {} };
let INTERFACE, BOARD, TEXT;
let index = 1;

before(() => {
  CachePipeline.initialize();
  const api = {
    core: PluginManager.getCoreApi(),
    onObjectInteraction: (name, actions) => { (hooks.objects[name] ??= []).push(actions); },
  };
  Common.init(api);
  Scoreboard.attachScoreboard(api);
  const cache = api.core.CacheDefinitions;
  INTERFACE = cache.getInterfaceId('soul_wars_stats');
  BOARD = cache.getLocId('soul_wars_scoreboard');
  TEXT = cache.getComponentId('soul_wars_stats:scroll_text');
});

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

beforeEach(() => Scoreboard._useFile(path.join(scratch, `${Math.random()}.json`)));

function realPlayer(t) {
  const { Player } = require('../dist/game/entity/impl/player/Player');
  const p = new Player(null);
  p.setIndex(index++);
  p.setRegistered(true);
  t.mock.method(p, 'getSession', () => ({ sendClientPacket: () => true, write: () => true }));
  const sender = p.getPacketSender();
  p.sent = { interfaces: [], texts: new Map() };
  const original = { sendInterface: sender.sendInterface, sendString: sender.sendString };
  t.mock.method(sender, 'sendInterface', function (id) { p.sent.interfaces.push(id); return original.sendInterface.apply(this, arguments); });
  t.mock.method(sender, 'sendString', function (text, uid) { p.sent.texts.set(uid, text); return original.sendString.apply(this, arguments); });
  return p;
}

function view(player, objectId = BOARD) {
  for (const actions of hooks.objects.Scoreboard ?? []) {
    if (actions.View?.({ player, objectId, option: 'view', clickType: 1, handled: false }) === true) return true;
  }
  return false;
}

const lines = (p) => p.sent.texts.get(TEXT).split('<br>');

test('a new reader: the interface and every count at 0', (t) => {
  const p = realPlayer(t);
  assert.equal(view(p), true);
  assert.deepEqual(p.sent.interfaces, [INTERFACE]);
  assert.deepEqual(lines(p), [
    'Your Soul Wars statistics', 'Games played: 0', 'Games won: 0', 'Players killed: 0', 'Deaths: 0', '',
    'Global statistics', 'Games played: 0', 'Players killed: 0', 'Avatars killed: 0',
  ]);
});

test("the reader's lines are their own saved Soul Wars counters, in thousands", (t) => {
  const p = realPlayer(t);
  p.setAttribute(Common.FIGURE_ATTRIBUTES.total_games, 1234);
  p.setAttribute(Common.FIGURE_ATTRIBUTES.total_wins, 600);
  p.setAttribute(Common.FIGURE_ATTRIBUTES.total_kills, 2500);
  p.setAttribute(Common.FIGURE_ATTRIBUTES.total_deaths, 7);
  view(p);
  assert.deepEqual(lines(p).slice(1, 5), ['Games played: 1,234', 'Games won: 600', 'Players killed: 2,500', 'Deaths: 7']);
});

test("the world's records are every player's and survive a restart", (t) => {
  const file = path.join(scratch, 'restart.json');
  Scoreboard._useFile(file);
  Scoreboard.playerKilled();
  Scoreboard.playerKilled();
  Scoreboard.avatarKilled();
  Scoreboard.gameEnded({ starters: { blue: 3, red: 2 } });
  Scoreboard.gameEnded({ starters: { blue: 3, red: 0 } }); // not a real game
  Scoreboard._useFile(file);
  const a = realPlayer(t);
  const b = realPlayer(t);
  view(a);
  view(b);
  for (const p of [a, b]) assert.deepEqual(lines(p).slice(7), ['Games played: 1', 'Players killed: 2', 'Avatars killed: 1']);
});

test('viewing twice shows the board twice and counts nothing', (t) => {
  const p = realPlayer(t);
  view(p);
  view(p);
  assert.deepEqual(p.sent.interfaces, [INTERFACE, INTERFACE]);
  assert.equal(lines(p)[7], 'Games played: 0');
});

test("another loc's Scoreboard is left to its own handler", (t) => {
  const p = realPlayer(t);
  assert.equal(view(p, 12345), false);
  assert.deepEqual(p.sent.interfaces, []);
});

test('both boards (the lobby and the tutorial copy) are on the map and reached from the open floor beside them', () => {
  RegionManager.init();
  for (const [x, y] of [[2216, 2856], [2024, 5928]]) {
    RegionManager.loadMapFiles(x, y, true);
    const board = MapObjects.get(BOARD, new Location(x, y, 0), null);
    assert.ok(board, `board at ${x},${y}`);
    assert.equal(RegionManager.getClipping(x - 1, y, 0, null), 0, 'the floor west of it is open');
    const stand = { getLocation: () => new Location(x - 1, y, 0), getSize: () => 1, getPrivateArea: () => null };
    assert.equal(PathFinder.reachedObject(stand, x, y, 1, 2, board.getFace(), board.getType(), 0), true);
  }
});
