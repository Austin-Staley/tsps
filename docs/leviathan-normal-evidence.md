# Leviathan normal-mode evidence ledger

This ledger tracks unresolved mechanics explicitly. A passing test against a chosen value does not establish OSRS fidelity. Normal mode is not complete while a required item below remains unresolved. Awakened mode remains outside this change and inaccessible.

## Sources and measurement rules

- Wiki: [boss](https://oldschool.runescape.wiki/w/The_Leviathan), [strategy](https://oldschool.runescape.wiki/w/The_Leviathan/Strategies), [Unconventional](https://oldschool.runescape.wiki/w/Unconventional).
- Original normal video: AsukaYen `mhzvu8217oA`, 13 August 2023. At 6:11–7:07 it describes volley counts 6/8/8/12/12 and intervals 3/2/2/1/1. Its later-stun advice conflicts with current Wiki progression, so do not adopt that advice.
- Original normal video: `9n3C5Z4e3kI`, 27 October 2024, full fight and narration. This is after the 7 February 2024 lightning-delay correction. Captions and original video retrieved; frame analysis in progress.
- Original short normal guide: `1gchIAY7EU4`, 14 August 2023. Earlier than the enrage-transition protection fix; do not use it to reinstate the old bug.
- Shared capture worker owns original RSProx decoder acquisition. Available recordings are Leagues V or Grid Master. Separate NPC packets/layout from modified player stats, loot, masteries and any event-specific respawn changes. Require normal-video corroboration and event-rule checks before using packet timings for ordinary mode. Never copy another private server.
- Local revision 241 cache supplies IDs, definitions and collision. `npc-captured-animations.json` confirms observed animation IDs but its aggregate counts do not establish phase timing.

## Exhaustive gap checklist

| Area | Current behavior / unresolved fact | Evidence or next verification |
|---|---|---|
| Normal stats and bonuses | First five stats overridden; remaining bonuses inherited | Compare all normal stats/bonuses with current Wiki and canonical cache-backed definition; never use special-world player damage to infer stats |
| Volley counts | Opening five tiers implemented as6/8/8/12/12 | Normal video and opening packet schedule agree; final two12-shot counts remain extrapolated |
| Volley speed/styles | Seven tiers, Wiki 3/2/2/1/1/1/1 | Retain source-backed tiers; verify transitions at packet boundaries |
| Early projectile flight | Implemented5/5/4/3/3ticks | Original mode-classified packets; normal footage corroborates opening cadence, not every flight offset |
| Late projectile flight | Wiki explicitly 2 ticks then 1 tick | Verify client-cycle offsets and damage timing |
| Enrage projectile flight | Implemented5ticks | Captures3285/1751 normal900HP actors; special-world mode limitation retained |
| First attack | Implemented4ticks | Captures3285/1751 normal900HP actors |
| Volley roar gap | Roar one attack interval after final shot; next shot5ticks after roar | Capture1751 opening offsets22/27,43/48,64/69 |
| Roar damage | Maximum 7 source-backed; zero-inclusive roll unverified | Original damage observations and source formula evidence |
| Roar debris flight | Reuses smoke's two-tick delay without proof | Projectile/graphic/loc timing |
| First-special tell | Side gfx disappear; no lasting tell objects | Establish side positions, object/graphic identity, lifetime and first-roar behavior |
| Bite region | Distance-plus-nonfloor heuristic can confuse outer walls with pool | Cache pool geometry, normal tile markers/video and capture actor positions |
| Bite timing | Instant damage, interval inherited | Verify interruption/resumption and facing sequence |
| Shadow stun | 15 ticks source-backed | Exact start, incoming-orb cancellation/persistence, idle seq and expiry packets |
| Stun reset damage | Current counter starts at stun, 25% wording ambiguous | Measure cumulative health thresholds and reset trigger; do not guess from wording |
| Rear weak spot | Cardinal approximation and ~65% floor | Facing/actor positions, rear region width and damage rounding |
| Special reduction | Current integer 2/3 damage | Source describes 33%; verify rounding rather than assume 0.67 |
| Lightning duration | Chosen 20 ticks | Start/loop/end sequences and strike packets |
| Lightning damage | Chosen maximum 30 | Need reliable bounds; observed samples establish observations, not automatically exact maximum |
| Lightning warning/impact | Chosen 2 ticks, reduced to 1 at <=25HP | Current change log supports one-tick difference; establish absolute offsets |
| Lightning side orbs | Implemented as temporary debris gfx/damage | Extract actual projectile/gfx/impact IDs, count/cadence, pool-adjacent exclusion |
| Smoke count/flight | Ten, one/tick and two-tick flight source-backed | Replay packet schedule and normal-video cross-check |
| Smoke blast delay | Chosen tick 13 | Last rock impact to blast packets |
| Smoke damage | Strategy says 59; boss infobox says 60 | Resolve with original evidence; do not silently choose a value |
| Smoke cover | All prior debris blocks via center ray | Verify eligible boulder set, origin and occlusion; quest guide distinguishes smoke boulders from regular boulders |
| Enrage entry | 20%=180HP,3tick pathfinder spawn,5tick orb delay,2tick cadence; debris every8ticks without interrupting orbs | Original normal actors3285/1751; smoke already in progress finishes |
| Pathfinder layout | Implemented size3 origins NW2074,6377; NE2086,6377; SE2086,6365; symmetric SW2074,6365 | Original actor packets; aura centre is actual NPC origin+1, not pending destination |
| Pathfinder movement | Ordinary cardinal walk step each tick after3tick initial delay, through debris | Quest capture1703 ordinary world independently confirms east/south/first-west and rubble overlap; full normal lap still needed |
| Pathfinder activation/glow | Registration gates effects; aura uses actual NPC position; spawn animation10296; player glow remains absent | Original spawn packets and real MovementQueue regressions |
| Arena and tails | Map copied correctly; tail actors absent | All tail IDs/coordinates/orientation/lifecycle and collision from original NPC packets |
| Attack animation cycle | Startup/single/loop sequence now used for orbs | Capture sequence10278 then10281 one tick later; special loops still require review |
| Normal respawn | Chosen 50 ticks after death event | Normal kill/death animation/loot/respawn footage; event respawn rules may differ |
| Timer/PB start/end | Constructor-to-lethal timer | Original boss timer messages/varps relative to attack/spawn/loot packets |
| Entry/exit presentation | Instant boat/handhold/stone travel | Actual movement/animation/fade/varp sequence, valid action/escape routes |
| Guardian and scoreboard | Guardian route exists; scoreboard unimplemented | Cache interface/script and original interactions; public quest-complete source state |
| Cannon/poison/thralls | Audit required | Wiki immunity and allowed thralls; inspect actual combat ownership/poison behavior |
| Unconventional CA | Implemented and20focused checks pass | Real HP transitions and launch-time ammunition; see below; shadow/thralls permitted and wooden blowpipe exceptions enforced |
| Other normal CAs | Generic counts/speed/perfect/stun hooks present | Verify exact boundaries, five perfect kills without leaving and timer/order semantics |
| Normal loot exclusivity | Canonical current rows roll independently | ROOT OWNS shared DT2 loot correction; no duplicate engine/generated patches here |
| Vestige progression | Missing shared three-roll state | ROOT OWNS: invisible 1/256 progression, first gold ring, second two rings, third vestige/reset |
| Tablet/quartz progression | Missing shared once-only/pity state | ROOT OWNS: scarred tablet once with unpublished pity; quartz 1/200 to1/50 at300KC before first, then1/200 |

## Current status

Branch `fix/leviathan-normal-fidelity` starts at `ef8813b1c`. No value is marked resolved merely because an implementation exists. This file is updated as each source, observed packet sequence and regression is verified.

### Unconventional

Implemented using launch-time resolved ammunition and a generic current-level-change event. The original Wiki task page (checked 24 October 2026) establishes the HP ceiling, mithril ammunition, allowed shadow stuns/thralls, loaded toxic blowpipe darts and the three wooden blowpipe exceptions. The core event captures transient healing above25 even when damage restores25 in the same tick; lethal completion freezes grading before post-fight regeneration. Twenty focused checks exercise real Player, PendingHit and HitQueue paths, loaded dart resolution, wrong/zero-damage shots, shadow spells, next-fight reset and the documented exception. Ten positive cases failed before implementation; all20 pass afterward. No account state is changed outside disposable tests.

### Original packet corpus

Decoder pinned to original RSProx source `d997d071bc2783664d1658a80f4d1f881b355119`, runtime1.0.5, helperSHA256 `e55de54f1ac6564e626f799de0cdffdd5492c3b4cafd924b8b290ad6adc6b2db`. Eight Leviathan recordings (3285,788,550,555,1751,1754,1750,100) contain306 completed fights whose observed damage sums to900, separately from2700HP and incomplete fights. These classify normal boss mode independently of player combat multipliers; they do not alone establish ordinary-world applicability. All quantities/timings below are pending normal-video corroboration where noted. Raw recordings stay in ignored research storage.

Capture3285 first normal actor, spawn17356/death17416/despawn17422: SW2078,6369; six shots17360/63/66/69/72/75; projectile start30/end150clientcycles (5ticks impact), height550/100, angle30, progress124, sourceIndex0. Sequence10278 on launch,10281one tick later. Roar17378; next volley17383. Initial roar's permanent player/south/north rocks arrive17385. Enrage roar17404, pathfinder17407 atbase2086,6377 because NW is obstructed; movement begins17410 then everytick. This boss has exactly900 observed damage, while the last actor in the same recording has2700 and an explicit1157combatlevel. Do not conflate them.

### Implemented opening, enrage and geometry corrections

Original normal guide `mhzvu8217oA` establishes opening counts6/8/8/12/12. Normal2024 full-fight frames independently show the opening and separate roar pauses; captures3285 and1751 supply server-tick schedules. Capture1751 normal900HP actor at13959: opening shots+4..+19 every3ticks, roar+22, next8shots+27..+41 every2ticks, roar+43, third8shots+48..+62 with4tick travel. The next faster attack has3tick travel. Implemented flight progression5/5/4/3/3/2/1; the final two12-shot counts remain extrapolated from the preceding12-shot tiers and need a slower original recording for independent confirmation.

Enrage in both recordings has a3tick pathfinder delay,5tick first-orb delay,2tick orb cadence with5tick projectile travel, and falling debris every8ticks. Subsequent debris waves do not interrupt orbs or replay the entry roar animation/chip. The recorded source geometry selects the mouth2tiles toward whichever side of the7x7 body the player stands beyond. Packet fields30/150clientcycles,550/100height,30angle,124progress and no source actor are now preserved through the real Projectile sender.

Pathfinder spawn bases are NW2074,6377; NE2086,6377; observed SE turn2086,6365. Authored centers are the3x3 NPC bases+1. First movement occurs3ticks after registration, then1tile/tick. Spawn selection checks the3x3 footprint. Movement deliberately ignores rubble: normal capture3285's second fight has a permanent rock2077,6378 before pathfinder spawn17491 atbase2074,6377; at17495 its base2076,6377 places its center directly on that rock. Therefore collision-detouring during movement, introduced in the earlier bounded fix, contradicted the newly acquired original evidence. The reconciled published branch sends ordinary cardinal walking updates through debris; its aura follows the registered NPC actual position. The disabled awakened tornado retains its original provisional greedy pursuit and separate spawn, avoiding an unrelated awakened change. The SW corner is the symmetric route continuation and still needs a complete normal-lap recording.

Validation checkpoint:6new volley/projectile checks and2recorded pathfinder checks added; cache-backed encounter suite65/65 passes. Opening/pathfinder/projectile regressions were observed failing before correction. Remaining ledger items above are still open; this checkpoint is installable for testing but is not a claim of exact complete parity.

### Published pathfinder reconciliation and independent verification

Merged published pathfinder commit `6ce88e831` into the normal-fidelity branch, preserving its ordinary walk packets, actual-position aura and original disabled tornado behavior alongside the opening/enrage/projectile changes. Ordinary-world **quest** recording[1703](https://rsprox.net/download/1703) independently shows pathfinder spawn8572 at2074,6377, first east step8575,12east steps through8586,12south steps through8598 and a west step8599. Rubble47590 at2082,6379, added8394, remains present during footprint overlap8580–8582. This is geometry/cadence evidence, not an ordinary post-quest balance sample.

Fresh immutable decoder outputs for1703 and3285 use helperSHA256 `7ca21602b38f3a2a8210cd7746c6e9671f5f10a166a618e08e7562e0481d2af7`; earlier measurements above retain their original helper provenance. Public archive[search](https://rsprox.net/database) was rechecked24October2026. Final verification is recorded below.

Fresh final verification: TypeScript build passes;66Leviathan encounter checks plus3generic current-level checks pass (69/69); complete server suite5,019/5,019 passes with zero failures/skips under `node --test --test-concurrency=4 "tests/*.test.cjs"` outside the sandbox. `git diff --check` is clean. The sandbox run encountered unrelated filesystem/loopback restrictions and was stopped; both affected files separately pass133/133 outside the sandbox, and the unrestricted complete run supersedes that attempt.
