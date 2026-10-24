/** Standard spellbook stat drains. Behavior: OSRS Wiki's six curse spell pages. */
const CURSES = [
  ['CONFUSE', 'ATTACK', 5], ['WEAKEN', 'STRENGTH', 5], ['CURSE', 'DEFENCE', 5],
  ['VULNERABILITY', 'DEFENCE', 10], ['ENFEEBLE', 'STRENGTH', 10], ['STUN', 'ATTACK', 10],
];
const spells = new Map();
let core;

function initialize(api) {
  core = api.core;
  spells.clear();
  for (const [name, skill, percent] of CURSES) {
    spells.set(core.CombatSpells[name].spellId(), { skill: core.Skill[skill], percent });
  }
}

function applyCurse(event) {
  if (!event.allowed || event.handled) return;
  const curse = spells.get(event.spell?.spellId?.());
  if (!curse) return;
  const { attacker, target } = event;
  const npc = target?.isNpc?.() ? target.getAsNpc() : null;
  const player = target?.isPlayer?.() ? target.getAsPlayer() : null;
  if (!npc && !player) return;
  event.handled = true;
  const skills = player?.getSkillManager();
  const current = npc ? npc.getCurrentLevel(curse.skill) : skills.getCurrentLevel(curse.skill);
  const maximum = npc ? npc.getMaxLevel(curse.skill) : skills.getMaxLevel(curse.skill);
  if (current < maximum) {
    if (attacker?.isPlayer?.()) attacker.getAsPlayer().sendMessage(
      `The spell has no effect because the ${npc ? 'NPC' : 'player'} is already weakened.`);
    return;
  }
  const decrease = Math.floor(current * curse.percent / 100);
  if (npc) {
    // The NPC API owns encounter immunity and per-instance restoration state.
    npc.setCurrentLevels(curse.skill, current - decrease);
  } else {
    skills.setCurrentLevelCombat(curse.skill, current - decrease);
    skills.updateSkill(curse.skill);
    player.sendMessage('You feel slightly weakened.');
  }
}

module.exports = {
  name: 'Standard Curses',
  register(api) {
    initialize(api);
    api.onCustomEvent('magic:utility-effect', applyCurse);
  },
};
