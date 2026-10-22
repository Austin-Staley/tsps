module.exports = function registerDragon2hSwordSpecialAttack(api) {
  const { Animation, CombatSpecial, Graphic, ItemIdentifiers, MeleeCombatMethod } = api.core;

  const DRAIN = 60;
  const SPECIAL_ANIMATION = new Animation(3157);
  const SPECIAL_VFX = new Graphic(559);
  const POWERSTAB_TARGETING = { pattern: "surrounding", width: 1, maxTargets: 14, requiresMultiCombat: true };

  // Powerstab also hits every NPC within one tile of the player (up to 14 in total) in
  // multi-combat. PvP's three-player sweep is not handled: the resolver only selects NPCs.
  class Dragon2hSwordCombatMethod extends MeleeCombatMethod {
    start(character, target) {
      CombatSpecial.drain(character, DRAIN);
      super.start(character, target);
      character.performAnimation(SPECIAL_ANIMATION);
      character.performGraphic(SPECIAL_VFX);
    }
  }

  api.registerCombatSpecial({
    id: "dragon_2h_sword",
    itemIds: [ItemIdentifiers.DRAGON_2H_SWORD],
    drainAmount: DRAIN,
    strengthMultiplier: 1,
    accuracyMultiplier: 1,
    traits: { hitCount: 1, targeting: POWERSTAB_TARGETING },
    combatMethod: new Dragon2hSwordCombatMethod(),
  });
};
