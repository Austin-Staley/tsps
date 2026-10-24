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
| Volley counts | Uniform 8 is incorrect | Normal video establishes first five as 6/8/8/12/12; packet/video corroboration and late-tier counts required |
| Volley speed/styles | Seven tiers, Wiki 3/2/2/1/1/1/1 | Retain source-backed tiers; verify transitions at packet boundaries |
| Early projectile flight | 4/4/4/3/3 chosen without capture | Extract projectile start/end cycles and normal footage |
| Late projectile flight | Wiki explicitly 2 ticks then 1 tick | Verify client-cycle offsets and damage timing |
| Enrage projectile flight | Hardcoded 2 ticks, not established | Packet/video measurement separately from attack interval |
| First attack | Chosen 5 ticks | Spawn sequence, first projectile and normal-world timing |
| Volley roar gap | Chosen 4 ticks plus attack interval | Last projectile/roar/next projectile packet offsets |
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
| Enrage entry | 20%=180HP source-backed | Verify stun/special interruption, roar, spawn delay and incoming projectiles |
| Pathfinder layout | Chosen centers and center-based blocked test | Actual NPC base/size/spawn corner coordinates; align aura with 3x3 NPC and 5x5 area |
| Pathfinder movement | Chosen two-tick interval and rectangular corners | Extract actor movement and normal video; bounded detour fix is not proof of OSRS route tie-breaking |
| Pathfinder activation/glow | Registration gate fixed; player glow absent | Capture NPC/player graphics and effect boundaries |
| Arena and tails | Map copied correctly; tail actors absent | All tail IDs/coordinates/orientation/lifecycle and collision from original NPC packets |
| Attack animation cycle | Single-projectile seq used everywhere | Startup/loop/end/single sequencing from original packets |
| Normal respawn | Chosen 50 ticks after death event | Normal kill/death animation/loot/respawn footage; event respawn rules may differ |
| Timer/PB start/end | Constructor-to-lethal timer | Original boss timer messages/varps relative to attack/spawn/loot packets |
| Entry/exit presentation | Instant boat/handhold/stone travel | Actual movement/animation/fade/varp sequence, valid action/escape routes |
| Guardian and scoreboard | Guardian route exists; scoreboard unimplemented | Cache interface/script and original interactions; public quest-complete source state |
| Cannon/poison/thralls | Audit required | Wiki immunity and allowed thralls; inspect actual combat ownership/poison behavior |
| Unconventional CA | Missing | Mithril ammo only, HP never above 25 throughout; thralls allowed; current wooden blowpipe exception; real health/ammo provenance |
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
