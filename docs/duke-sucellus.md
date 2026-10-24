# Postquest Duke Sucellus

## Normal fidelity audit, 24 October 2026 (in progress)

The current follow-up corrects left-click Feed to choose poison first, then held mushroom powder, as documented by the powder pages' 2 July 2025 update. Raw mushrooms remain ineligible. Powder feeding is limited to one item per game cycle and stops on waking. Grinding now repeats using a player-keyed cancellable task: immediate response, two ticks after that response cycle, then every three ticks (the current powder creation footnote and the existing captured Herblore action convention). Each conversion retains the atomic full-inventory check. The final Slayer-task kill freezes eligibility before Slayer clears its assignment at death.

The revision-241 cache's `duke_sucellus_scoreboard` (828) has static value components 9/11/13/15/17/19, with no transmit listeners. Reading object 47563 opens it with personal kills/deaths/best and local-world totals. Personal deaths persist as a namespaced attribute; world records use an atomic JSON save, following the other boss scoreboard stores. Duplicate death/death-task callbacks cannot count twice. Cache dump confirms the title and close operation.

This checkpoint builds and passes all 43 focused Duke tests (six new regressions were observed failing first). The broader remaining audit is tracked in `docs/superpowers/plans/2026-10-24-normal-boss-fidelity.md`; publishing a checkpoint does not establish that its remaining numeric/effect/loot findings are complete.

This members-only plugin adds the normal, repeatable solo encounter after Desert Treasure II. The quest's separate NPCs, prison and progression are unchanged. The postquest heavy door at 2926,10354 skips the prison to the asylum gates; entering the gate creates an owner-only copy of the cache room. Leaving or logging out destroys that copy and its temporary ingredients. Login recovery returns a saved in-instance character to the outside gate.

The eight-pick mushroom patches, Herblore-based powder yield, pickaxe-assisted salt gathering, six-of-each vat recipe, six-tick fermentation and two-poison meter support repeated kills. Finished poison stays in its vat when inventory space prevents collection. Ingredients and poison persist between kills but are removed before a player-death inventory snapshot and on exit. Awakened mode is unavailable; no awakener's orb is consumed.

The normal fight implements aimed melee chip/slam, magic, pillar-hidden freezing gaze, gas vents, preparation ice and extremities, HP-dependent gas cadence, enrage and respawning. Chip is unavoidable for perfection. Applied magic, including a zero, and positive avoidable hazard damage invalidate the kill. The exact current dead boss supplies `perfectKill` to the existing canonical NPC-drop roller; this feature does not hand-author or patch generated loot tables. Counts, best times and novice grave discounts persist. The generic combat-achievement NPC-death handler owns kill-count achievements, avoiding a duplicate count event. The plugin awards the five-perfect-kill, three speed, Cold Feet and Mirror Image achievements, excluding speed awards on Slayer tasks.

### Normal-mode restrictions

[Cold Feet](https://oldschool.runescape.wiki/w/Cold_Feet) tracks actual running in the private area's post-movement processing, including poison preparation. Merely enabling run while stationary does not fail it, and the entry teleport does not count the approach outside the gate. Eligibility freezes at lethal damage and resets immediately for the following kill, so running during the corpse/respawn interval affects the next attempt. Avoidable preparation damage still fails through the encounter's existing perfect grade.

[Mirror Image](https://oldschool.runescape.wiki/w/Mirror_Image) compares player attack initiation with Duke attack initiation in the same world cycle. It listens to actual PendingHit queue-time rolls for the exact owned boss, including misses, rather than delayed impacts. Duke auto/gaze starts and scheduled gas launches record their cycle. NPC/thrall attacks do not fail the restriction, and a recoil-only victory requires no direct attack. This follows the implemented encounter's attack launches; the remaining uncaptured numeric launch/impact timings below are not newly asserted exact.

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

The normal achievement follow-up adds ten regressions using actual MovementQueue, PendingHit and hit queues, including teleport/run state and death-animation eligibility. Fresh build and 61 Duke/Combat Achievement/hit-queue checks pass. The original combined local server installation separately passed all 4,961 server tests before these follow-ups.

This branch depends on TSPS #882 for conditional drop quantities and applied-damage observers. It includes generic per-NPC stat-drain immunity and grave-fee foundations also used by the other normal-mode boss branches. No live game restart, account edit or Claude-owned client/clue deployment is performed here.
