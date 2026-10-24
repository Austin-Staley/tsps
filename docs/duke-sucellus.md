# Postquest Duke Sucellus

This members-only plugin adds the normal, repeatable solo encounter after Desert Treasure II. The quest's separate NPCs, prison and progression are unchanged. The postquest heavy door at 2926,10354 skips the prison to the asylum gates; entering the gate creates an owner-only copy of the cache room. Leaving or logging out destroys that copy and its temporary ingredients. Login recovery returns a saved in-instance character to the outside gate.

The eight-pick mushroom patches, Herblore-based powder yield, pickaxe-assisted salt gathering, six-of-each vat recipe, six-tick fermentation and two-poison meter support repeated kills. Finished poison stays in its vat when inventory space prevents collection. Ingredients and poison persist between kills but are removed before a player-death inventory snapshot and on exit. Awakened mode is unavailable; no awakener's orb is consumed.

The normal fight implements aimed melee chip/slam, magic, pillar-hidden freezing gaze, gas vents, preparation ice and extremities, HP-dependent gas cadence, enrage and respawning. Chip is unavoidable for perfection. Applied magic, including a zero, and positive avoidable hazard damage invalidate the kill. The exact current dead boss supplies `perfectKill` to the existing canonical NPC-drop roller; this feature does not hand-author or patch generated loot tables. Counts, best times and novice grave discounts persist. The generic combat-achievement NPC-death handler owns kill-count achievements, avoiding a duplicate count event. The plugin awards the five-perfect-kill and three speed achievements, excluding speed awards on Slayer tasks. Cold Feet and Mirror Image require further movement/attack-tick tracking and are not awarded by this implementation.

## Evidence and limits

Primary behavior sources:

- [Duke Sucellus](https://oldschool.runescape.wiki/w/Duke_Sucellus)
- [Strategies](https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies)
- [Arder powder](https://oldschool.runescape.wiki/w/Arder_powder)
- [Salax salt](https://oldschool.runescape.wiki/w/Salax_salt)
- [Arder-musca poison](https://oldschool.runescape.wiki/w/Arder-musca_poison)
- [Fermentation Vat](https://oldschool.runescape.wiki/w/Fermentation_Vat)

Installed revision-241 gamevals, definitions and map placements establish NPC/item/object IDs, options, animations, the 7x7 boss footprint, pillars, vents and resource coordinates. The authored `bosses/data/duke-sucellus.json` is encounter configuration, not a generated drop artifact.

This is a functional normal-mode implementation, not a claim of capture-exact OSRS parity. Exact visual/impact offsets, the preparation cycle, extremity warning/coverage, icefall targeting and mining cadence are not completely specified by the cited prose. The configuration exposes those provisional choices. The chip effect marks an icefall warning because a dedicated icefall spot-animation has not been verified. Normal protected magic max 24 and covered gas max 4 are provisional reductions; the source establishes reduced damage but does not explicitly give both bounds. A future capture can replace these values without changing the instance or reward contracts. Awakened hazards and achievements are intentionally not offered.

The generic grave multiplier defaults to one, accepts only finite values from zero through one, and affects gravestone reclamation rather than Death's Office. Duke supplies .25 until five normal kills. Merged graves retain the larger multiplier, a conservative policy preventing discounting previously normal-fee contents; that merge policy is not asserted as capture-confirmed OSRS behavior.

## Verification

Focused tests use actual cache definitions, players, NPCs, inventories, templated areas and hit queues. Packet-shaped object events reproduce gate/resource interactions. Regression tests cover full-inventory retention, feeding spam, per-owner access, zero magic grading, a single positive equipment reaction per hit, gaze and slam avoidance, queued-hit cancellation, respawn, saved statistics and death/exit cleanup. Independent review covers the encounter and canonical reward integration. Full-suite outcomes and remaining environment failures are recorded in the PR.

Final build and all 27 Duke tests pass. The broad server run passed 4,959 of 4,967 tests. Eight failures were confined to sandbox-dependent bot-index, localhost WebSocket and temporary-save-file cases; complete affected files passed outside the sandbox (133 bot/network and 28 save tests). This is not represented as an entirely green broad run. Later Duke review corrections received the fresh focused run, including actual canonical quantities, real NPC death tasks, source-cache walkable entry tiles and cache-named achievement targets.

This branch depends on TSPS #882 for conditional drop quantities and applied-damage observers. It includes generic per-NPC stat-drain immunity and grave-fee foundations also used by the other normal-mode boss branches. No live game restart, account edit or Claude-owned client/clue deployment is performed here.
