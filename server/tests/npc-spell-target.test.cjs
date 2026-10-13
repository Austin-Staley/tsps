// Run after `yarn build`: node --test tests/npc-spell-target.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { World } = require('../dist/game/World');
const { CombatSpells } = require('../dist/game/content/combat/magic/CombatSpells');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { NPCOptionPacketListener } = require('../dist/net/packet/impl/NPCOptionPacketListener');

test('spell-on-NPC defaults to attackable definitions and permits explicit plugin opt-in', () => {
  const originalNpcs = World.getNpcs;
  const originalSpell = CombatSpells.getCombatSpell;
  const originalCustomEvent = PluginManager.emitCustomEvent;
  const spell = { canCastOnTarget: () => true };
  let cast = null;
  const npc = {
    getLocation: () => ({}),
    getCurrentDefinition: () => ({ isAttackable: () => false }),
    getHitpoints: () => 10,
  };
  const player = {
    getHitpoints: () => 99,
    busy: () => false,
    getLocation: () => ({ isWithinDistance: () => true }),
    getMovementQueue: () => ({ reset() {} }),
    getCombat: () => ({ castSpellOn: (target, selectedSpell) => { cast = [target, selectedSpell]; } }),
  };
  World.getNpcs = () => ({ capacityReturn: () => 1, get: () => npc });
  CombatSpells.getCombatSpell = () => spell;
  try {
    PluginManager.emitCustomEvent = () => {};
    assert.equal(NPCOptionPacketListener.castSpell(player, 0, 1), false, 'unattackable NPCs reject ordinary spell targeting');
    assert.equal(cast, null, 'a rejected target never reaches combat or rune consumption');

    PluginManager.emitCustomEvent = (name, event) => {
      assert.equal(name, 'magic:can-cast-on-npc');
      event.allowed = true;
    };
    assert.equal(NPCOptionPacketListener.castSpell(player, 0, 1), true, 'a quest can opt one NPC into spell targeting');
    assert.deepEqual(cast, [npc, spell]);
  } finally {
    World.getNpcs = originalNpcs;
    CombatSpells.getCombatSpell = originalSpell;
    PluginManager.emitCustomEvent = originalCustomEvent;
  }
});
