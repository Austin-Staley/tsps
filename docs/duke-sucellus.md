# Postquest Duke Sucellus

## Normal fidelity audit, 24 October 2026 (in progress)

### Capture-backed corrections

The expanded audit uses original OSRS recordings [1751](https://rsprox.net/download/1751), [1827](https://rsprox.net/download/1827) and [3285](https://rsprox.net/download/3285), decoded with official RSProx source `d997d071bc2783664d1658a80f4d1f881b355119` and verified launcher runtime 1.0.5. Only anonymized numeric boss events were inspected; raw recordings are not committed. These are Leagues V/Grid Master worlds. Mode is classified per encounter: normal Duke explicitly reports combat level 758; 3285's Duke reports 1099 and a 370-point poison meter and is awakened. Player damage, healing, loot and mastery-modified statistics are not imported as normal values. The current Wiki corroborates the normal five/four-tick cycles, five-tick gaze warning/six-tick attack, preparation ordering and June/July 2025 preparation changes.

Normal 1827 ticks 1657/1662/1667 show waking, the first melee launch five ticks later, and another launch five ticks after that. Chip hits are in the launch update. Seven ground effects at x3036..3042,y6451 use 2440/2441/2442/2443/2442/2441/2440, with body effect 2439. The implementation now uses those effects rather than placing unused chip/slam graphics on the player's tile. Normal magic at tick 1973 originates at 3039,6453, uses projectile 2434 with start/end cycles 50/120, fine heights 350/100, angle 5 and start position 32, and hits at 1977. The source location has no actor attachment. Normal 1751 ticks 10121/10124/10127 and 10915/10918/10922 establish the three-tick second gas spit and the following auto interval at enrage/normal speeds. Gas now has its native projectile, faster casting animation and passive vent actor.

Normal 1827's first room clock begins asleep at 1248. Middle/south/north cones start at 1250/1252/1254 and repeat every 15 ticks, independently of vents. Vent actors begin at 1263 then 1288/1313, with each row progressing east independently. Native cone NPCs 12199..12201 and vent NPC 12198 are cache verified; cones last four ticks and the eye returns to its sleeping sequence five ticks after rousing. The dangerous corridor centre line implements the ordinary Wiki's documented run-through route, which skips those true tiles. Preparation vent graphics start with a 120-client-cycle delay, idle at +6/+8/+10 and end at +11. Actors expire independently, including after fight-event cancellation.

Ice uses native shadow 1447 and impact 538 four ticks later; warnings occur throughout both corridors rather than only on the player's occupied tile. The captured three-on/three-off warning cadence and mushroom safe tiles replace the old unrelated melee-chip warning. The observed density is represented by an explicit empirical per-tile roll; a finite recording does not reveal Jagex's exact random selection algorithm. Likewise, observed normal combat vents last 12–14 ticks from their passive actor spawn to their end effect, but their exact lifetime distribution is not published. These are empirical choices, not a claim to have recovered the original random algorithm.

Poison now uses green hitsplats and headbar 62, width 160, without changing sleeping hitpoints. A full meter wakes Duke on the next cycle, preventing extra doses. Vats use timer NPC 12197 with headbar 33 filling 0→50 over 180 client cycles. Awake resource objects are inactive and stale preparation clicks cannot harvest them; original vat/salt rotations and taken wall tools are preserved when the room refreshes. The native gaze overlay 829 mounts on the atmosphere slot and is removed on resolution, lethal damage or exit, without closing a replacement teleport overlay. Normal recordings consistently reset the dead form 23 ticks after its first death-animation update, 24 ticks after lethal damage. The body is retained with the existing generic remains contract until that boundary.

Fresh build and all 60 focused Duke tests pass. The remaining shared loot change and combined local/client checks are still pending at this checkpoint. Protected magic max 24 and covered gas max 4 remain explicitly unconfirmed numerical reductions; the prose establishes reduction but does not publish both exact bounds. Mining uses the existing pickaxe cadence; actual cancellation now follows the same player-keyed task mechanism as other skills. Awakened mode remains disabled.

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
