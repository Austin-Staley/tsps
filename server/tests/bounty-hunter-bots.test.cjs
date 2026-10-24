// Run after `yarn build`: node --test tests/bounty-hunter-bots.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const Bots = require('../plugins/minigames/bountyhunter/Bots.BountyHunter');
const { pickTierChoice, TIER_BANDS } = require('../plugins/bots/behaviours/pvp/PvpTierLoadouts.PlayerBots');

const Entry = require('../plugins/minigames/bountyhunter/Entry.BountyHunter');
const Coffer = require('../plugins/minigames/bountyhunter/Coffer.BountyHunter');
const { setActiveBotRuntime } = require('../plugins/bots/runtime/RuntimeRegistry.PlayerBots');

test('lobby entry spawns funded, skulled PK bots and restores their entry fee after death', (t) => {
  const hooks = new Map();
  const tasks = [];
  const spawned = [];
  const removed = [];
  const populationRolls = [20, 50];
  const runtime = { botStatesByName: new Map(), spawnPvpBot };
  const human = { isPlayerBot: () => false };
  const bh = { lobby: new Set([human]), arena: new Set(), isArenaTile: () => true, inArena: () => false };
  const spawnTile = Entry.spawnTile;
  Entry.spawnTile = () => ({ getX: () => 3363, getY: () => 4037, getZ: () => 0 });
  setActiveBotRuntime(runtime, { PVP: 'pvp' });
  t.after(() => { Entry.spawnTile = spawnTile; setActiveBotRuntime(null, null); });

  function spawnPvpBot(location, options) {
    if (runtime.botStatesByName.has(options.username)) return null; // as the registry: name still taken
    const attributes = new Map();
    const level = [60, 88, 110, 126][spawned.length % 4];
    const bot = {
      skulled: false, dying: false, coins: 0,
      getUsername: () => options.username,
      isPlayerBot: () => true,
      getAttribute: (key) => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      getSkillManager: () => ({ getCombatLevel: () => level }),
      isSkulled: () => bot.skulled,
      getHitpoints: () => 99,
      getCombat: () => ({ getTarget: () => bot.opponent, getAttacker: () => bot.attacker }),
      isDyingReturn: () => bot.dying,
      getLocation: () => location,
      getInventory: () => ({ forceAdd: (_, item) => { bot.coins += item.amount; } }),
      getForcedLogoutTimer: () => ({ start: () => {} }),
      requestLogout: () => { removed.push(bot); hooks.get('logout')({ player: bot }); },
    };
    assert.equal(options.mode, 'pvp');
    runtime.botStatesByName.set(options.username, { pvp: {} });
    spawned.push(bot);
    return bot;
  }

  const api = {
    core: {
      Task: class {},
      Misc: { random: (min, max) => {
        assert.deepEqual([min, max], [20, 50]);
        assert.ok(populationRolls.length, 'roll only once per new population');
        return populationRolls.shift();
      } },
      Item: class { constructor(id, amount) { this.amount = amount; } },
      ItemIdentifiers: { COINS: 995 },
      SkullType: { WHITE_SKULL: 'white' },
      CombatFactory: { PVP_SKULL_SECONDS: 1800, skull: (bot) => { bot.skulled = true; } },
    },
    onCustomEvent: (name, fn) => hooks.set(name, fn),
    onPlayerLogout: (fn) => hooks.set('logout', fn),
    onServerStartup: (fn) => hooks.set('startup', fn),
    getTaskManager: () => ({ submit: (task) => tasks.push(task) }),
  };
  Coffer(new Proxy(api, { get: (object, name) => object[name] ?? (() => {}) }));
  Bots(api, bh);
  const enter = hooks.get('bounty-hunter:entered-lobby');
  enter({ player: { isPlayerBot: () => true } });
  assert.equal(spawned.length, 0, 'bots cannot populate the crater');
  enter({ player: human });
  assert.deepEqual(spawned.map((bot) => bot.getUsername()), Array.from({ length: 20 }, (_, i) => `BhBot${i + 1}`));
  for (const bot of spawned) {
    assert.equal(bot.isSkulled(), true);
    assert.equal(Coffer.balance(bot), Coffer.playerMinimumDeposit(bot));
  }
  enter({ player: human });
  assert.equal(spawned.length, 20, 'another entry cannot duplicate the population');

  const defender = spawned[0], rogue = spawned[1], quarry = spawned[2];
  const pvp = runtime.botStatesByName.get(defender.getUsername()).pvp;
  pvp.targetPlayer = rogue;
  pvp.targetUsername = rogue.getUsername();
  for (const link of ['opponent', 'attacker']) {
    defender[link] = rogue;
    hooks.get('bounty-hunter:target-assigned')({ player: defender, target: quarry });
    hooks.get('bounty-hunter:target-cleared')({ player: defender });
    assert.equal(pvp.targetPlayer, rogue, 'matchmaking cannot interrupt an ongoing fight');
    assert.equal(pvp.targetUsername, rogue.getUsername());
    defender[link] = null;
  }
  hooks.get('bounty-hunter:target-cleared')({ player: defender });
  assert.equal(pvp.targetPlayer, null, 'an idle bot drops its old assignment');

  hooks.get('startup')();
  const victim = spawned[0];
  const killer = spawned[1];
  Coffer.died({ player: victim, killer, skulled: true });
  assert.equal(killer.coins, 10_000, 'a bot kill pays the coffer reward');
  assert.equal(Coffer.balance(victim), 20_000);
  victim.skulled = false;
  victim.dying = true;
  tasks[0].execute();
  assert.equal(Coffer.balance(victim), 20_000, 'no refill or reskull during death handling');
  assert.equal(victim.isSkulled(), false);
  victim.dying = false;
  tasks[0].execute();
  assert.equal(Coffer.balance(victim), 30_000);
  assert.equal(victim.isSkulled(), true);
  const rich = spawned[2];
  rich.setAttribute('bounty-hunter:coffer', 200_000);
  tasks[0].execute();
  assert.equal(Coffer.balance(rich), 200_000, 'funding preserves an existing surplus');
  bh.lobby.clear();
  bh.arena.add(human);
  tasks[0].execute();
  assert.equal(removed.length, 0, 'entering the arena keeps the population');
  const otherHuman = { isPlayerBot: () => false };
  bh.lobby.add(otherHuman);
  enter({ player: otherHuman });
  bh.arena.delete(human);
  tasks[0].execute();
  assert.equal(removed.length, 0, 'one player leaving cannot remove another player\'s opponents');
  bh.lobby.delete(otherHuman);
  bh.arena.add(spawned[0]);
  tasks[0].execute();
  assert.equal(removed.length, 20, 'the next tick removes every bot when the last real player leaves');
  tasks[0].execute();
  assert.equal(removed.length, 20, 'an empty crater does no more bot work');
  bh.arena.clear();
  bh.lobby.add(human);
  enter({ player: human });
  assert.equal(spawned.length, 70, 'the next visit rolls a fresh population, including the upper limit');
  assert.equal(spawned.at(-1).getUsername(), 'BhBot70', 'fresh names: the last bots may still be online');
  for (const bot of spawned) hooks.get('logout')({ player: bot });
});

test('the shared tier picker still answers each tier', () => {
  for (const tier of Object.keys(TIER_BANDS)) assert.ok(pickTierChoice(tier), tier);
  assert.equal(pickTierChoice('unknown'), null);
});

test('members-only picks never draw a free-to-play preset', () => {
  for (const tier of Object.keys(TIER_BANDS)) {
    for (let index = 0; index < 20; index++) {
      const choice = pickTierChoice(tier, { index, excludeF2p: true });
      assert.ok(!choice || !choice.tags.includes('f2p'), `${tier} ${choice?.loadoutId}`);
    }
  }
});
