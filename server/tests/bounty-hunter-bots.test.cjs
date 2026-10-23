// Run after `yarn build`: node --test tests/bounty-hunter-bots.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const Bots = require('../plugins/minigames/bountyhunter/Bots.BountyHunter');
const { pickTierChoice, TIER_BANDS } = require('../plugins/bots/behaviours/pvp/PvpTierLoadouts.PlayerBots');

function player(level, band = 5) {
  return {
    getSkillManager: () => ({ getCombatLevel: () => level }),
    getPacketSender: () => ({ getVarbit: () => band }),
  };
}

test('bot levels stay matchable with the player: 5 below to their band above', () => {
  assert.deepEqual(Bots._test.botLevelBand(player(126, 15), 'veteran'), { min: 121, max: 126 });
  assert.deepEqual(Bots._test.botLevelBand(player(90, 10), 'intermediate'), { min: 85, max: 100 });
  assert.deepEqual(Bots._test.botLevelBand(player(70), 'novice'), { min: 65, max: 75 });
});

test('a tier that cannot reach the player keeps the matchable levels', () => {
  assert.deepEqual(Bots._test.botLevelBand(player(60), 'veteran'), { min: 55, max: 65 });
  assert.deepEqual(Bots._test.botLevelBand(player(126), 'novice'), { min: 121, max: 126 });
});

test('the shared tier picker still answers each tier', () => {
  for (const tier of Object.keys(TIER_BANDS)) assert.ok(pickTierChoice(tier), tier);
  assert.equal(pickTierChoice('unknown'), null);
});
