# Postquest Duke Sucellus

This members-only plugin implements the repeatable normal encounter after Desert Treasure II. Quest progression and its separate NPCs remain unchanged. A completed player can skip Ghorrock Prison through the heavy door and enter an owner-only asylum. Leaving, disconnecting or dying clears temporary supplies; login recovery returns abandoned instance characters outside the gate. Awakened entry is unavailable and cannot consume an orb.

## Preparation and combat

Vats store each ingredient separately, accept partial fills and hand-crush raw mushrooms one-for-one when needed. Only a complete six-of-each recipe starts its six-tick fermentation. Check displays ingredient progress in a messagebox. Empty refunds the stored amounts; a refund or collection that cannot fit leaves the vat intact. Gathering repeats every three ticks until interrupted, depleted or full. Preparation actions now send the verified animations, sounds and messages.

Current resource retention, eight-pick depletion, level-dependent powder yields, five-point powder feeding, two-poison awakening and 10 Herblore XP per poison are retained. Feeding has animation, sound and a preparation hitsplat; its meter update cannot queue damage against the subsequently awakened boss.

Melee uses the captured boss effect and seven-tile visual row at cast time. The damage checks remain the current Wiki's 3x3 chip and aimed 1x1 slam; a visual row does not establish a row-shaped damaging attack. Magic sends the delayed player impact when cast and hits four ticks later. Prison eyes animate their original objects instead of replacing them. Gas effects attach to private vent NPCs, which are removed when their effects finish or the encounter stops. Gaze warning and successful-avoidance messages retain their captured colours.

Kill time freezes at lethal damage. Counts, personal bests and novice grave discounts persist. The existing drop roller receives the exact dead boss's perfect-kill context. Generic combat-achievement handling owns kill counts; the encounter awards five-perfect-kill and speed achievements, excluding speed awards on Slayer tasks. Cold Feet and Mirror Image remain unimplemented.

## Recording verification and its limits

The review was checked against the actual [RSProx recording 1703](https://rsprox.net/download/1703), listed in the [archive database](https://rsprox.net/database). Its header identifies revision 226.1 and an ordinary members world. Decoded Duke forms are **quest** variants 12193, 12194 and 12195. This is ordinary-world quest evidence, not a current postquest normal-mode recording.

A fresh archive search across the eight quest/postquest Duke variants found six recordings: 1703 is ordinary-world quest content; 91, 555, 1751 and 1827 are Leagues V; 3285 is Grid Master. No ordinary-world postquest recording was found. Event-world damage, XP and yields were not used to tune normal mode.

The recording was independently decoded using the [official revision-226 protocol definitions](https://github.com/blurite/rsprox/tree/d997d071bc2783664d1658a80f4d1f881b355119). Framing accounted for 351,274 packets and 18,184 server ticks. Relevant player-effect blocks decoded without warnings. Seventeen NPC packets with optional model-customisation blocks were excluded from claims. Raw logs and account data are not committed. Download SHA-256: `1480633019627ff48c26e1327c4cca4b3479ac8f8c132df52158a3506ad82d7a`.

Selected zero-based server-tick observations:

| Behaviour | Recording 1703 evidence |
| --- | --- |
| Picking | T10504, T10507, T10510: sequence 2282, sound 2581 and mushroom messages; three-tick repetition. |
| Grinding | T10647/10649/10652: sequence 364 and sound 2608. |
| Partial filling/refund | T10709 consumes three raw arder mushrooms; T10728 refunds three arder powder alongside six musca powder and six salt. T10756's Check interface shows 6/3/6 progress. |
| Fermentation | Last ingredient T10866, ready T10872; a second vat T10872 to T10878. |
| Collection | T10889/T10894: sequence 3572, sound 2434, poison and the collection message. |
| Feeding | Sequence 9401 at T10931/T10933; sound 7249 and hits 125/75 on the following ticks; awakening message T10935. Those hit amounts are quest observations. |
| Melee presentation | T10940/T10945: sequence 10176, boss effect 2439, row effects 2440/2441/2442/2443/2442/2441/2440 at cast time. A main hit at T10993 follows the T10991 cast by two ticks. |
| Magic | T10950 cast: projectile 2434, start/end cycles 50/120, heights 87/25; player impact 2435 in slot 2 with delay 120. Damage arrives T10954; a second sample also takes four ticks. |
| Gaze | T10965 warning and T10969 successful avoidance contain both existing messages and their purple/green colours. No failed-gaze sample occurs in this recording. |
| Eyes | In-place rouse sequences 10187–10189 stagger by two ticks, reset after five and repeat every fifteen. All six eyes wake with Duke at T10935 and use awake idle from T10936. |
| Vents | NPC 12198 spawns at T10930 with delayed effect 2431; idle 2432 at T+6/+8/+10, end 2433 at T+11, removal at T+15. |
| Freeze | T10479 and T10490 contain the coloured freeze message and effect 1575 in slot 4 at height 124; the latter also has effect 369 in slot 2. |

All captured identifiers used here were checked against the installed revision-241 cache. Matching presentation/timing is applied to the normal encounter, with the quest-recording boundary stated above.

## Current normal-mode sources and review qualifications

- [Duke Sucellus strategies](https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies): normal 485 HP, 101 maximum gaze damage, separate chip/slam damage shapes and powder feeding. A single recorded 70-damage hit cannot replace a current normal-mode maximum.
- [Arder-musca poison](https://oldschool.runescape.wiki/w/Arder-musca_poison): six of each ingredient, six ticks, two doses and 10 Herblore XP. Missing XP in an older recording does not establish zero XP today.
- [Musca powder](https://oldschool.runescape.wiki/w/Musca_powder): powder feeding and the 2 July 2025 left-click Feed change.
- [Summer Sweep Up: Combat](https://oldschool.runescape.wiki/w/Update%3ASummer_Sweep_Up%3A_Combat): June 2025 resource retention, depletion and combat changes. The older recording predates these changes.
- [Fermentation Vat](https://oldschool.runescape.wiki/w/Fermentation_Vat), [Arder powder](https://oldschool.runescape.wiki/w/Arder_powder) and [Salax salt](https://oldschool.runescape.wiki/w/Salax_salt) supply additional preparation context.

The claim that both gaze messages were invented does not apply: both appear repeatedly in the ordinary-world recording. Removing powder feeding, eight-pick depletion or the documented Herblore XP would also regress current mechanics.

Still provisional pending a current ordinary-world postquest capture: the configured normal poison amount per dose, chip's one-tick delay, protected magic/covered gas bounds, preparation vent/ice cadence, eye damage coverage and the ice-warning placeholder. Gas damage is aligned to the captured active visual window (T+6 through T+10); that alignment is an inference, not a measured damage sample. Gaze uses the current normal five-tick check/six-tick cycle; quest success-message timing is not substituted for that current rule. Feeding commits the inventory/meter atomically and delays the captured sound; its full server-tick interaction staging is not claimed capture-exact.

## Code scope and validation

Duke modules use descriptive names, readable formatting and authored encounter configuration. Asylum interactions use cache names. The Ghorrock entry's base multiloc is unnamed in cache 241, so its one generic fallback remains guarded by the configured identifier, exact tile and quest completion; it no longer intercepts every click before named handlers. Unused NPC stat-drain immunity and Slayer-veto foundations, plus the two Duke planning files, were removed from this PR.

Tests exercise actual cache definitions, inventories, templated areas, NPC death tasks, hit queues and canonical drop quantities. Added regressions cover partial fills, exact refunds without duplication or inventory loss, hand-crushing, preparation feedback, continuous gathering, supported powder feeding, magic timing, melee visuals, gaze feedback, in-place eye animation and vent cleanup. Build and final test results are recorded in the PR review reply.

PR #882 remains the prerequisite for conditional drop quantities and applied-damage observers. Its generated drop data is not hand-edited by these fixes. No live server deployment or game-client visual retest is claimed.
