const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const Pickpocket = require('../plugins/skills/thieving/Pickpocket.Thieving');
const attach = require('../plugins/skills/thieving/Blackjacking.Thieving');
const base = PluginManager.getCoreApi();
const tasks = [], log = [], listeners = new Map();
const core = { ...base, World: { getNpcs: () => [] }, CombatFactory: { inCombat: () => false }, TaskManager: { submit: (task) => tasks.push(task) }, ItemDefinition: { forId: () => ({ getName: () => 'Maple blackjack(o)' }) } };
const api = { core, onNpcsInteraction() {}, onNpcInteraction() {}, onCustomEvent: (name, handler) => listeners.set(name, handler), emitCustomEvent: (name, event) => {
  if (name === 'quest:get-stage') event.stage = event.player.questStage;
  else listeners.get(name)?.(event);
} };
Pickpocket.register(api); attach(api);
const B = attach._test;
function event({ level = 65, stage = 9, id = core.NpcIdentifiers.MENAPHITE_THUG } = {}) {
  const player = {
    questStage: stage, getEquipment: () => ({ get: () => ({ getId: () => core.ItemIdentifiers.MAPLE_BLACKJACK_O_ }) }),
    getClickDelay: () => ({ elapsedTime: () => true, reset() {} }), getSkillManager: () => ({ getCurrentLevel: () => level, addExperiences: (_skill, amount) => log.push(['xp', amount]) }),
    getInventory: () => ({ isFull: () => true, getAmount: () => 100 }),
    performAnimation: (animation) => log.push(['player anim', animation.getId()]), sendMessage: (message) => log.push(message), isRegistered: () => true,
  };
  const npc = { isRegistered: () => true, getCombat: () => ({ reset() {}, getTarget: () => null, attack: () => log.push('attack') }), getMovementQueue: () => ({ reset() {} }), getTimers: () => ({ registers() {} }), forceChat: (message) => log.push(message), setFollowing(target) { this.following = target; }, getFollowing() { return this.following; }, performAnimation: (animation) => log.push(['npc anim', animation.getId()]) };
  return { player, npc, npcId: id, definition: { getName: () => id === core.NpcIdentifiers.MENAPHITE_THUG ? 'Menaphite Thug' : 'Bandit' } };
}
function withRandom(value, run) { const original = Math.random; Math.random = () => value; try { run(); } finally { Math.random = original; } }
function clear() { tasks.length = 0; log.length = 0; }
test('knockout chart follows Blackjack/Jagex: low80 high240, independent of wood and NPC', () => {
  assert.equal(B.successChance(1), 81 / 256); assert.equal(B.successChance(99), 241 / 256); assert.equal(B.successChance(65), 185 / 256);
});
test('quest training, target family and target-specific levels gate the action', () => {
  clear(); assert.equal(B.ready(event({ stage: 0 })), false); assert.equal(B.ready(event({ level: 64 })), false);
  assert.equal(B.ready(event({ level: 45, id: core.NpcIdentifiers.BANDIT_7 })), true);
  assert.equal(B.ready(event({ level: 54, id: core.NpcIdentifiers.BANDIT_9 })), false); assert.equal(B.ready(event({ id: core.NpcIdentifiers.BANDIT })), false);
});
test('knockout grants 10 XP and exactly two guaranteed coin pickpockets before wakeup', () => {
  clear(); const e = event(); withRandom(0, () => B.knockOut(e));
  assert.ok(log.some((line) => Array.isArray(line) && line[0] === 'xp' && line[1] === 10));
  for (let index = 0; index < 2; index++) {
    const request = { ...e, target: B.targetFor(e.npcId), unconscious: false };
    B.pickpocketTarget(request); assert.equal(request.unconscious, true); assert.equal(request.target.pickpocketAnimation, 827); request.onAttempt();
  }
  const third = { ...e, target: B.targetFor(e.npcId), unconscious: false }; B.pickpocketTarget(third); assert.equal(third.unconscious, false);
  tasks.at(-1).execute(); assert.equal(B.unconscious.has(e.npc), false);
});
test('failed knockout starts combat unless a quick pickpocket or knockout interrupts it', () => {
  clear(); const e = event(); withRandom(1, () => B.knockOut(e)); tasks.at(-1).execute(); assert.ok(log.includes('attack'));
  clear(); const again = event(); withRandom(1, () => B.knockOut(again)); B.pickpocketTarget({ ...again, target: B.targetFor(again.npcId) }); tasks.at(-1).execute(); assert.ok(!log.includes('attack'));
  clear(); const retry = event(); withRandom(1, () => B.knockOut(retry)); const aggression = tasks.at(-1); withRandom(0, () => B.knockOut(retry)); aggression.execute(); assert.ok(!log.includes('attack'));
});
test('lure follows the player and stops after the lure window', () => {
  clear(); const e = event(); B.lure(e); assert.equal(e.npc.following, e.player); tasks.at(-1).execute(); assert.equal(e.npc.following, null);
});
