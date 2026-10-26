// Run after `npx tsc --build`: node --test tests/castlewars-scoreboard.test.cjs
//
// The Castle Wars lobby scoreboards (castlewars_scoreboard: View, View Stats): games ended by the
// real Game.CastleWars.js endGame feed the teams' wins and each player's record, on real Players
// with only the network stubbed.
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
const { World } = require('../dist/game/World');
const { Location } = require('../dist/game/model/Location');
const { PathFinder } = require('../dist/game/model/movement/path/PathFinder');

const core = PluginManager.getCoreApi();
const data = require('../plugins/minigames/castlewars/Data.CastleWars')(core);
const Game = require('../plugins/minigames/castlewars/Game.CastleWars');
const Scoreboard = require('../plugins/minigames/castlewars/Scoreboard.CastleWars');
const { TEAM } = data;

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'castle-wars-scoreboard-'));
const hooks = { objects: {}, custom: {}, persisted: new Map() };
let game;
let index = 1;
let INTERFACE, BOARD;

const registry = {
  core,
  getAreaManager: () => ({ areas: [] }),
  getBonusManager: () => ({ update: () => {} }),
  getObjectManager: () => ({ register: () => {}, deregister: () => {}, existsLocation: () => false }),
  getRegionManager: () => RegionManager,
  getTaskManager: () => ({ submit: () => {}, cancelTasks: () => {} }),
  getWorld: () => World,
  persistAttribute: (key, value) => hooks.persisted.set(key, value),
  onObjectInteraction: (name, actions) => { (hooks.objects[name] ??= []).push(actions); },
  onCustomEvent: (name, handler) => { (hooks.custom[name] ??= []).push(handler); },
  emitCustomEvent: (name, payload) => { for (const handler of hooks.custom[name] ?? []) handler(payload); },
};

const fakeArea = (players = []) => ({ players, getPlayers: () => players });

before(() => {
  CachePipeline.initialize();
  RegionManager.init();
  game = Game(registry);
  game.lobbyArea = fakeArea();
  game.waitingAreas = { [TEAM.SARADOMIN]: fakeArea(), [TEAM.ZAMORAK]: fakeArea() };
  game.gameArea = fakeArea();
  Scoreboard.attachScoreboard(registry);
  INTERFACE = core.CacheDefinitions.getInterfaceId('castlewars_score');
  BOARD = core.CacheDefinitions.getLocId('castlewars_scoreboard');
});

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

beforeEach(() => Scoreboard._useFile(path.join(scratch, `${Math.random()}.json`)));

/** A real Player with only the network stubbed; the packets it would send are recorded. */
function realPlayer(t) {
  const { Player } = require('../dist/game/entity/impl/player/Player');
  const p = new Player(null);
  p.setIndex(index++);
  p.setRegistered(true);
  p.setLocation(new Location(2440, 3089, 0));
  t.mock.method(p, 'getSession', () => ({ sendClientPacket: () => true, write: () => true }));
  t.mock.method(p.getInventory(), 'refreshItems', () => {});
  t.mock.method(p, 'smartMove', () => {});
  const sender = p.getPacketSender();
  p.sent = { interfaces: [], texts: new Map(), statements: [] };
  const original = { sendInterface: sender.sendInterface, sendString: sender.sendString };
  t.mock.method(sender, 'sendInterface', function (id) { p.sent.interfaces.push(id); return original.sendInterface.apply(this, arguments); });
  t.mock.method(sender, 'sendString', function (text, uid) { p.sent.texts.set(uid, text); return original.sendString.apply(this, arguments); });
  t.mock.method(p.getDialogueManager(), 'startDialogues', (chain) => {
    const built = typeof chain?.build === 'function' ? chain.build() : chain;
    p.sent.statements.push(built);
  });
  return p;
}

/** One game to its end through Game.CastleWars.js: `teams` maps each player to a team. */
function playGame(teams, saradominScore, zamorakScore) {
  const queued = fakeArea([...teams.keys()]);
  game.waitingAreas[TEAM.SARADOMIN].players.push(...[...teams].filter(([, team]) => team === TEAM.SARADOMIN).map(([p]) => p));
  game.waitingAreas[TEAM.ZAMORAK].players.push(...[...teams].filter(([, team]) => team === TEAM.ZAMORAK).map(([p]) => p));
  game.beginStartCountdown();
  assert.equal(game.getPhase(), game.PHASE.STARTING);
  for (const area of Object.values(game.waitingAreas)) area.players.length = 0;
  for (const [player, team] of teams) game.setTeamId(player, team);
  game.gameArea.players.splice(0, game.gameArea.players.length, ...queued.players);
  game.score[TEAM.SARADOMIN] = saradominScore;
  game.score[TEAM.ZAMORAK] = zamorakScore;
  game.endGame();
  game.gameArea.players.length = 0;
  assert.equal(game.getPhase(), game.PHASE.IDLE);
}

function click(player, option, objectId = BOARD) {
  for (const actions of hooks.objects.Scoreboard ?? []) {
    if (actions[option]?.({ player, objectId, option: option.toLowerCase(), clickType: 1, handled: false }) === true) return true;
  }
  return false;
}

const total = (p, team) => p.sent.texts.get(core.CacheDefinitions.getComponentId(`castlewars_score:castlewars_${team}_totalscore`));
const statement = (p) => Scoreboard.statsText(p);

test('View on a fresh world: the castlewars_score interface with both teams at 0', (t) => {
  const p = realPlayer(t);
  assert.equal(click(p, 'View'), true);
  assert.deepEqual(p.sent.interfaces, [INTERFACE]);
  assert.equal(total(p, 'saradomin'), 'Saradomin: 0');
  assert.equal(total(p, 'zamorak'), 'Zamorak: 0');
});

test("games ended by endGame count the winning team's wins and each player's record; a tie counts for no team", (t) => {
  const sara = realPlayer(t);
  const zam = realPlayer(t);
  const teams = new Map([[sara, TEAM.SARADOMIN], [zam, TEAM.ZAMORAK]]);
  playGame(teams, 2, 1);
  playGame(teams, 0, 3);
  playGame(teams, 1, 1);
  playGame(teams, 0, 0);
  click(sara, 'View');
  assert.equal(total(sara, 'saradomin'), 'Saradomin: 1');
  assert.equal(total(sara, 'zamorak'), 'Zamorak: 1');
  assert.equal(statement(sara), "You've played 4 games of Castle Wars.<br>Won: 1 Lost: 1");
  assert.equal(statement(zam), "You've played 4 games of Castle Wars.<br>Won: 1 Lost: 1");
  // The usual end messages and tickets are unchanged.
  assert.equal(sara.getInventory().getAmount(core.ItemIdentifiers.CASTLE_WARS_TICKET), 2 + 1 + 2 + 1);
});

test('View Stats opens a statement with the reader\'s own record', (t) => {
  const p = realPlayer(t);
  const other = realPlayer(t);
  playGame(new Map([[p, TEAM.ZAMORAK], [other, TEAM.SARADOMIN]]), 0, 1);
  assert.equal(click(p, 'View Stats'), true);
  assert.equal(p.sent.statements.length, 1);
  assert.equal(statement(p), "You've played 1 games of Castle Wars.<br>Won: 1 Lost: 0");
  assert.equal(statement(other), "You've played 1 games of Castle Wars.<br>Won: 0 Lost: 1");
  const fresh = realPlayer(t);
  assert.equal(statement(fresh), "You've played 0 games of Castle Wars.<br>Won: 0 Lost: 0");
});

test('the record is three saved attributes starting at 0, and the teams\' wins survive a restart', (t) => {
  for (const key of [Scoreboard.GAMES_ATTRIBUTE, Scoreboard.WINS_ATTRIBUTE, Scoreboard.LOSSES_ATTRIBUTE]) {
    assert.equal(hooks.persisted.get(key), 0, key);
  }
  const file = path.join(scratch, 'restart.json');
  Scoreboard._useFile(file);
  const a = realPlayer(t);
  const b = realPlayer(t);
  playGame(new Map([[a, TEAM.SARADOMIN], [b, TEAM.ZAMORAK]]), 1, 0);
  Scoreboard._useFile(file); // as a restart reads it again
  const q = realPlayer(t);
  click(q, 'View');
  assert.equal(total(q, 'saradomin'), 'Saradomin: 1');
  assert.equal(total(q, 'zamorak'), 'Zamorak: 0');
});

test('clicking twice shows the board twice and counts nothing', (t) => {
  const p = realPlayer(t);
  click(p, 'View');
  click(p, 'View');
  click(p, 'View Stats');
  click(p, 'View Stats');
  assert.deepEqual(p.sent.interfaces, [INTERFACE, INTERFACE]);
  assert.equal(p.sent.statements.length, 2);
  assert.equal(total(p, 'saradomin'), 'Saradomin: 0');
  assert.equal(statement(p), "You've played 0 games of Castle Wars.<br>Won: 0 Lost: 0");
});

test("another loc's Scoreboard is left to its own handler", (t) => {
  const p = realPlayer(t);
  assert.equal(click(p, 'View', core.CacheDefinitions.getLocId('soul_wars_scoreboard')), false);
  assert.equal(click(p, 'View Stats', 12345), false);
  assert.deepEqual(p.sent.interfaces, []);
});

test('both lobby boards are on the map and read from the lobby floor in front of them', () => {
  RegionManager.loadMapFiles(2437, 3086, true);
  for (const y of [3086, 3093]) {
    const board = MapObjects.get(BOARD, new Location(2437, y, 0), null);
    assert.ok(board, `board at 2437,${y}`);
    assert.equal(board.getType(), 4);
    const stand = (x) => ({ getLocation: () => new Location(x, y, 0), getSize: () => 1, getPrivateArea: () => null });
    assert.equal(RegionManager.getClipping(2438, y, 0, null), 0, 'the lobby floor east of it is open');
    assert.equal(PathFinder.reachedObject(stand(2438, y), 2437, y, 1, 1, board.getFace(), board.getType(), 0), true);
    assert.equal(PathFinder.reachedObject(stand(2437, y), 2437, y, 1, 1, board.getFace(), board.getType(), 0), true);
  }
});
