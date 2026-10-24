# The Whisperer

`plugins/bosses/Whisperer.plugin.js` owns a post-quest normal encounter. The DT2 quest's own scene and progress are unchanged. Depends on PR #882 for conditional loot and actual-damage observers. Awakened is deliberately unavailable: no orb prompt or consumption occurs.

The public normal Whisperer spawn is replaced at load with the cache's Odd Figure. Disturb requires completed Desert Treasure II and a real Blackstone fragment; the bank placeholder does not qualify. Ketla can replace a lost fragment. A PrivateArea isolates the cathedral and its Shadow Realm mirror per player. Tentacle exit/quick-escape, teleport, logout and death clean the session; login recovery returns a saved occupant outside. Graves relocate to the Camdozaal rope, with a 0.25 fee multiplier before five normal kills through the shared grave contract.

The ordinary postquest route is handled independently of the quest's stage-only transport hooks: Camdozaal's rope descends into Lassar, activated public teleporters retain discovered destinations, and the Lassar rope returns beside the Camdozaal sinkhole. New discoveries use `whisperer:teleporters`; existing quest varbits are read without altering quest progress. Cache collision checks choose clear adjacent arrival tiles rather than landing on rope/teleporter objects. The grave and rope return use (2922,5826), the clear southern approach; (2922,5827) is the blocked rock anchor. PB timing freezes at lethal damage, before the delayed death/loot event.

Normal mechanics include 900 HP, three threshold specials (720/495/270), progressively mixed prayer volleys checked at scheduled impact, moving tentacle paths, mirrored double melee hits, binding pursuit countered with ice/standard binding spells, sanity/prayer drain, insanity damage, 140 HP enrage, loot grading, kill count, PB and a 30-tick Odd Figure respawn. Threshold specials wait for the next attack boundary and retain launched impacts. Actual avoidable HP loss drives perfect loot; protected melee chip preserves perfection, with both mirrored hits using protection captured at the damage roll. Queued encounter damage is cancelled on final death or cleanup. Souls count at lethal damage before delayed NPC death callbacks. The special damage reduction is 70% outside / 60% inside the Shadow Realm. Thrall damage uses the core's direct-hit path and therefore bypasses this PendingHit modifier.

After the third special, pursuit stops below 100 HP while an existing player bind expires normally; a successful freeze counter still releases the player. Marked Undead Grasp already doubles its bind chance to 100% on an accurate hit in the core, and that existing freeze releases the player here. This follow-up does not force Grasp accuracy or change shared spells. Entry normalizes a stale glowing fragment left by the earlier reversed conversion before the fight starts.

Corrupted seeds use all four Wiki diagram patterns (24 or 28 seeds), shown with light/dark cache locs in the Shadow Realm and uniform locs outside. Screech uses eight columns, with one 60-HP column, one to three 40-HP columns and the rest 20 HP; cover is the two-by-two immediately behind a column, and every blast damages every surviving column. Soul Siphon has 12 one-HP souls in the Wiki's 2/3/3/4 sets, with healing, prayer, sanity and boss-damage rewards; souls are vulnerable only in the Shadow Realm.

## Source evidence

- [The Whisperer](https://oldschool.runescape.wiki/w/The_Whisperer): normal HP/max hits, 10-tick attack cycle, 30-tick respawn and standard drops.
- [Strategies](https://oldschool.runescape.wiki/w/The_Whisperer/Strategies): thresholds, projectile patterns, impact prayers, tentacle damage/sanity, special mechanics, enrage, grave placement and first-five-kills discount.
- [Floating Column](https://oldschool.runescape.wiki/w/Floating_Column): eight columns, normal health guarantees/cap and damage per screech.
- [Blackstone fragment](https://oldschool.runescape.wiki/w/Blackstone_fragment): required entry item, yellow special indicator, Ketla replacement.
- The four seed-route diagrams and screech video on the strategy page were inspected directly. Tile patterns are transcribed in `Specials.Whisperer.js`.

Rev241 cache gamevals/configs were inspected directly: NPCs 12203–12212, sequences 10227–10267, projectile spotanims 2444/2445/2467, seeds 47573–47575, escape/exit 47584–47586, sanity interface 834, and varbits 15064/15162/15067. Widget 834 loads CS2 1827; its 1828/1829 update path reads the sanity varbit (under varp 3939). Fragment 28356 is glowing (cache examine: "It's vibrating with energy!"), 28357 is normal, and 28358 is a bank placeholder. Normal replacements and post-special cleanup use 28357. Quest code's old tentacle animation constants 2452/2454 are spotanims, not the correct NPC sequences; this plugin uses the cache sequences.

## Verification limits

This is not a verified 1:1 implementation. Seed/column geometry is now corroborated by normal-fight packet observations and ordinary-game diagrams, while the column-health distribution beyond published guarantees remains unresolved. Special animation timings, seed duration and binding flight timing are under capture analysis. Normal melee's 28–42 roll and 75% protected share are provisional; the obtained source confirms max 42, mirrored double hits and partial protection but does not establish the complete distribution. Realm switching is permitted during specials; the exact fragment deactivation window is under capture analysis. No in-game client smoke run has been performed.

Awakened geometry, timing, full five-projectile patterns, stat/slayer immunity integration, prayer/sanity changes, special rotations and final-phase mechanics are not implemented. No Awakened CA is awarded.

All eight normal achievement paths are supplied: the generic CA handler owns Adept/Master kill counts; this plugin tracks speed tasks at the current rev241 limits (strictly under 3:00, 2:25 and 2:05, without a Slayer task), Tentacular, Dark Memories and Perfect Whisperer. Tentacular records Arceuus throughout the fight, including attacks between process ticks; Dark Memories counts fewer than ten pre-enrage Shadow Realm ticks. Perfect Whisperer counts five perfect kills in one session, allowing imperfect kills between them, as the individual Wiki task page explicitly states. Eligibility and time freeze before delayed death, so completing the last Slayer kill cannot accidentally grant a speed task. Leaving starts a fresh perfect-kill session.

## Remaining normal evidence audit

| Mechanic | Current evidence/status | Work still required |
| --- | --- | --- |
| Entry/wake | Cache Odd Figure/spawn sequence and clear entry tiles verified; Wiki describes knockback | Establish knockback destination and first-attack tick |
| Normal volleys | Wiki patterns, impact prayer and ten-tick cycle verified | Ordered sequence variants, exact launch/impact timings |
| Tentacles | Four-tile origin, X/plus progression, one hit per wave verified | Spawn/attack phase timing and complete traversed path |
| Seeds | Every tile/color of all four patterns and centre (2656,6369) corroborated by capture and ordinary tile diagram | Activation/deadline timings (current 50 ticks provisional) |
| Screech | Eight exact column positions, three blasts and cover rule corroborated | Health-distribution discrepancy and phase timings (current five-tick spacing provisional) |
| Souls | Twelve souls and 20-tick chant, group effects verified | Exact positions, phase animations and cast deadline relative to teleport |
| Binding | Existing freeze counters and low-health pursuit cancellation verified | Flight/pursuit timing and optional-bind selection |
| Fragment | Correct real/cache state identities and realm mirror verified | Screech deactivation/return window; unlimited toggling is still provisional |
| Melee | Max 42, mirrored guaranteed hits and partial prayer verified | Exact roll distribution and protected amount; Tentacular page describes roughly 33% mitigation, conflicting with provisional 25% |
| Enrage/death | Wiki 140 HP, stat restore, two-tick paired styles, cancelled damage and 30-tick respawn verified | Exact phase animation/transition offsets and tentacle phase timing |

The local captured-animation aggregate confirms sequence families but lacks ordered ticks. New shared RSProx decoding is being checked against original OSRS video and official event modifiers before event-world observations are used. Modified stats and reward rates cannot establish ordinary-world values. This audit remains open; achievement coverage does not establish full encounter parity.

### Normal capture geometry evidence

RSProx recording 3285 (revision234, Grid Master:Forestry) has SHA256 `8cfd915cc9172769c3b871b17640f5b6141468f8e3796abf75d3ff461dace3da`. Official decoder runtime1.0.5, inspected source `d997d071bc2783664d1658a80f4d1f881b355119`, indexes ticks by `ServerTickEnd`. Only anonymous derived encounter facts are used here.

The observations used here are independently identified as **normal**, not inferred from a shared NPC ID: combat-level packets report791 (ticks20906/21347), volleys have three shots, screeches have three blasts and souls number twelve. Actor57079 from tick23232 is level1146/awakened and is excluded from normal inference. Ordinary Wiki sources identify the same normal characteristics. Grid masteries modify player attack rates, incoming damage, healing and prayer gains, so damage/stat/rate equivalence is not inferred from this recording.

- Odd Figure/central boss southwest tile is (2655,6368); the seed grid centres on (2656,6369). The first two diagram layouts were previously compressed along a rotated screenshot grid. Their world-grid transform is `(dx-dy,dx+dy)`.
- Complete shadow seed bursts at ticks20931/21824/21371/23113 show the four patterns, with12/16/14/14 light seeds and24/24/28/28 total seeds. Every tile/color agrees with the ordinary Wiki alternate-view tile diagram after the first two patterns' grid correction.
- Screech columns first appear at20976: (2646,6365), (2648,6361), (2651,6363), (2654,6364), (2657,6364), (2660,6363), (2663,6361), (2665,6365). The boss stands at (2655,6356). Shadow counterparts subtract256 from x, retaining y. Tests assert exact coordinates and both realm renders.

Focused tests use real rev241 cache configs, Player/NPC instances, equipment/inventory, HitDamage/HitQueue, skill levels, private areas and source hooks. Rendering/scheduling and deterministic accuracy are doubled only where the unit under test requires it. Build with `node node_modules/typescript/bin/tsc --build` and run `node --test tests/whisperer.test.cjs` from `server/`.

The full sandbox suite completed with 4,962/4,970 passing. Eight failures were a bot-index check, a localhost WebSocket connection denied by the sandbox, and JSON/IndexedDB atomic temp-file rename restrictions. All eight, plus the three matching SQLite persistence checks, passed in a targeted unsandboxed rerun (11/11). The final postquest-access changes were then checked with the focused suite rather than repeating the full suite.

### Additional normal capture checkpoint

Normal level791 actors show shots one tick apart, handed animations10237/10238 and10243/10244, fixed three-tick impacts, projectile client-cycle offsets30/90 and raw heights350/100. The owner-only packet uses existing PacketSender height conversion, preserving angle254 and progress128. Normal tentacle waves launch four ticks after the first shot; enrage launches one with every shot. Soul groups are shuffled across twelve fixed tiles. Tests verify packet geometry, impacts, coordinates, role counts and both realm renders.

Phase delays, fragment window, wake knockback, static tentacle rays and melee distribution remain implementation work. This checkpoint does not claim complete normal fidelity. Fresh server build and all41 focused tests pass; no full-suite or client-smoke claim for this checkpoint.
