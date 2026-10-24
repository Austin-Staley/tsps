# Postquest Duke Sucellus

## Normal fidelity audit, 24 October 2026

### Capture-backed corrections

The expanded audit uses original OSRS recordings [1751](https://rsprox.net/download/1751), [1827](https://rsprox.net/download/1827) and [3285](https://rsprox.net/download/3285), decoded with official RSProx source `d997d071bc2783664d1658a80f4d1f881b355119` and verified launcher runtime 1.0.5. Only anonymized numeric boss events were inspected; raw recordings are not committed. These are Leagues V/Grid Master worlds. Mode is classified per encounter: normal Duke explicitly reports combat level 758; 3285's Duke reports 1099 and a 370-point poison meter and is awakened. Player damage, healing, loot and mastery-modified statistics are not imported as normal values. The current Wiki corroborates the normal five/four-tick cycles, five-tick gaze warning/six-tick attack, preparation ordering and June/July 2025 preparation changes.

Normal 1827 ticks 1657/1662/1667 show waking, the first melee launch five ticks later, and another launch five ticks after that. Chip hits are in the launch update. Seven ground effects at x3036..3042,y6451 use 2440/2441/2442/2443/2442/2441/2440, with body effect 2439. The implementation now uses those effects rather than placing unused chip/slam graphics on the player's tile. Normal magic at tick 1973 originates at 3039,6453, uses projectile 2434 with start/end cycles 50/120, fine heights 350/100, angle 5 and start position 32, and hits at 1977. The source location has no actor attachment. Normal 1751 ticks 10121/10124/10127 and 10915/10918/10922 establish the three-tick second gas spit and the following auto interval at enrage/normal speeds. Gas now has its native projectile, faster casting animation and passive vent actor.

Normal 1827's first room clock begins asleep at 1248. Middle/south/north cones start at 1250/1252/1254 and repeat every 15 ticks, independently of vents. Vent actors begin at 1263 then 1288/1313, with each row progressing east independently. Native cone NPCs 12199..12201 and vent NPC 12198 are cache verified; cones last four ticks and the eye returns to its sleeping sequence five ticks after rousing. The later footprint follow-up below replaces the original centre-line approximation with the published one/three/five cone; its narrow wall-side tips retain the documented run-through route. Preparation vent graphics start with a 120-client-cycle delay, idle at +6/+8/+10 and end at +11. Actors expire independently, including after fight-event cancellation.

Ice uses native shadow 1447 and impact 538 four ticks later; warnings occur throughout both corridors rather than only on the player's occupied tile. The captured three-on/three-off warning cadence and mushroom safe tiles replace the old unrelated melee-chip warning. The observed density is represented by an explicit empirical per-tile roll; a finite recording does not reveal Jagex's exact random selection algorithm. Likewise, observed normal combat vents last 12–14 ticks from their passive actor spawn to their end effect, but their exact lifetime distribution is not published. These are empirical choices, not a claim to have recovered the original random algorithm.

Poison now uses green hitsplats and headbar 62, width 160, without changing sleeping hitpoints. A full meter wakes Duke on the next cycle, preventing extra doses. Vats use timer NPC 12197 with headbar 33 filling 0→50 over 180 client cycles. Awake resource objects are inactive and stale preparation clicks cannot harvest them; original vat/salt rotations and taken wall tools are preserved when the room refreshes. The native gaze overlay 829 mounts on the atmosphere slot and is removed on resolution, lethal damage or exit, without closing a replacement teleport overlay. Normal recordings consistently reset the dead form 23 ticks after its first death-animation update, 24 ticks after lethal damage. The body is retained with the existing generic remains contract until that boundary.

Fresh build and all 66 focused Duke tests pass. Shared loot and combined local/client checks are verified separately during integration. Protected magic max 24 and covered gas max 4 remain explicitly unconfirmed numerical reductions; the prose establishes reduction but does not publish both exact bounds. Mining uses the existing pickaxe cadence; actual cancellation now follows the same player-keyed task mechanism as other skills. Awakened mode remains disabled.

Ordinary-world quest recording [1703](https://rsprox.net/download/1703), revision 226, independently corroborates retained preparation behavior: repeated picking at ticks 10504/10507/10510 (sequence 2282), grinding at 10647/10649/10652 (364), vat collection at 10889/10894 (3572), and feeding at 10931/10933 (9401). Its decoded manifest records capture SHA-256 `b01024aea91c23e4be68f4a75116ae37753ac4d51eb0e0217432ea748e5cbc2d` and official decoder source/runtime above. This quest recording does not establish current postquest poison quantities or the later eight-pick limit. Vats now retain partial additions, accept raw mushrooms at their hand-crushed yield, show stored counts through Check, and refund exactly those stored quantities through Empty. Failed refunds retain the original inventory and vat. Picking repeats every three ticks and stops on depletion, interruption, movement out of range or waking. These changes preserve the current postquest recipe and the June/July 2025 changes described by the current Wiki.

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

### Remaining normal-mode audit plan, 24 October 2026

This bounded pass checks the primary protection-prayer exception references
and indexed Jagex developer answers for exact protected magic/covered gas
rules; then checks native feeding, hazard timing and records against any new
explicit source facts. Existing ordinary videos are reused only when they can
distinguish a specific mechanic, with decoded PTS checked before timestamps.
Only reproduced owned-plugin mismatches will change code. Unpublished random
selection or unmeasured distributions will remain separately identified from
functional completion; another finite sample is not treated as an exact RNG
formula. Focused regression/build checks and independent review precede any
local commit, and the parent task owns publication and installation.

### Quest-gated records and a confirmed gathering gap, 24 October 2026

The native scoreboard transform unlock depends on Desert Treasure II completion.
A forged raw-parent Read could previously open interface 828 before completion,
even though the client displays the inactive board. Records now requires the
authoritative `quest:is-complete` response to be exactly true for both 46091 and
47563. Existing kill counts do not substitute for completion. The new regression
failed before the guard and passes for both routes after completion. Personal
death and local-world kill/death totals now say `(recorded)`, matching their
prospective accounting; personal kill counts and best times retain their saved
values. The records-label assertion also failed before this correction.

The current [normal strategies page](https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies)
explicitly describes delaying the skilling timer with an action such as cutting
celastrus bark while approaching a resource, then obtaining two resource yields.
Its original [salt clip](https://oldschool.runescape.wiki/images/Duke_Sucellus_-_tick_manip_%28salt%29.mp4?2237c)
was uploaded 14 February 2024 at 01:38:27 UTC (30 fps, 6.037188 seconds), and its
[mushroom clip](https://oldschool.runescape.wiki/images/Duke_Sucellus_-_tick_manip_%28mushroom%29.mp4?dda52)
at 01:38:31 UTC (30 fps, 10.031020 seconds). Actual decoded inventory frames
show the salt stack changing from absent at the 2.8-second sample to 12 at 2.9
seconds, without an intermediate six in that 0.1-second sampling; the mushroom
clip shows two mushrooms before grinding. Salt's first decoded PTS is zero.
These are historical preparation demonstrations referenced by current normal
instructions; their cropped scenes alone do not distinguish quest from postquest.
They establish the published double-yield behavior, not its exact timer phase.
Salt SHA-256 is `df88a1965f84f0d1ff052a699a7f4194938ea0cb5e0c9cbe3e10173024b1377f`;
mushroom SHA-256 is `87efba562a0cf63f2e49013681e9e0660fae88e1298c8fe6e0185b381d147a82`.

This is a remaining functional gap, distinct from unidentified RNG. Duke gathering
and generic Fletching currently use separate action counters; there is no shared
skilling-clock event to preserve the bark action's phase across arrival. A correct
implementation needs an evidenced start/delay/arrival contract and shared skill
regressions. An isolated bark-triggered extra Duke yield would not implement that
contract. No generic skill or Duke action-timer behavior changes in this batch.

Fresh checks of Protection prayers, Protect from Magic, Gas mask, Slayer helmet,
Ward of Arceuus and indexed Duke/JagexAsh protection answers did not publish exact
normal protected magic or covered gas bounds. The Ward reference concerns spell
applicability, not either maximum. No new source identified an exact extremity
check window, vent initialization/tie/lifetime rule or salt/ice RNG formula.
Those numerical gaps remain as documented below; the new footage does not resolve
them. Fresh TypeScript build and all 81 focused Duke tests pass.

### Awake Slayer eligibility and native scoreboard Read, 24 October 2026

The current [Duke Sucellus Speed-Runner page](https://oldschool.runescape.wiki/w/Duke_Sucellus_Speed-Runner?oldid=15307346)
(19 August 2026 at 16:29:14 UTC) requires an off-task kill and explicitly starts
timing when Duke wakes. The
previous implementation queried Slayer only at lethal damage: cancelling an
assignment after using it during the fight could restore all three speed
awards. The encounter now retains a matching assignment observed at wake,
while processing awake combat, or immediately before lethal completion. A
later cancellation cannot restore eligibility. Preparation alone is outside
that speed attempt, and a new kill gets fresh eligibility. Three regressions
use the real Slayer assignment state, packet sender and matching query; both
awake-cancellation cases failed before the fix, while the preparation-only
control and the following off-task kill remain eligible. The existing final
assignment/death-hook guard remains in place.

The revision-241 cache's Duke scoreboard parent is `duke_sucellus_scoreboard`
(46091), with a null parent name. Its transforms are inactive 47562, normal
Read 47563 and awakened Read 47564. The existing named Scoreboard handler
only accepted 47563, so a native parent-ID click could not reach it. An early
object hook now accepts parent 46091's first/Read action and opens the same
normal records interface 828. The explicit normal transform remains accepted;
inactive, awakened and other parent action slots remain excluded. The raw
parent-click regression failed before this correction. The shared
`dt2_scoreboards` access varbit is supplied by a separate world-level change;
this plugin does not duplicate that unlock or enable awakened mode.

Fresh TypeScript build and all 80 focused Duke tests pass. These corrections
come from the published restriction, actual cache definitions and reproduced
native/state transitions; no additional protected-damage maximum, hazard
window or random formula is inferred.

### Mining timeout and further ordinary footage, 24 October 2026

The [salt-deposit page, revision 15202330](https://oldschool.runescape.wiki/w/Salt_Deposit?oldid=15202330)
(29 April 2026 at 05:39:49 UTC) explicitly describes the five-minute mining
limit and its tired-arms message. The plugin already stopped gathering at
500 game ticks but did so silently. It now sends
`Your arms get tired from all the mining.` exactly once when uninterrupted
mining expires. Interruption, walking away or waking Duke remains a different
stop condition. A regression failed on the missing message, then passed after
the fix: no message at tick 499, one message and no active action at tick 500,
no subsequent salt or duplicate message, and a new click resumes gathering.
Fresh TypeScript build and all 76 focused Duke tests pass; independent read-only
review cleared the boundary and action cleanup.

Further source inspection used [Extile's original normal guide](https://www.youtube.com/watch?v=1QjdtcregEQ)
(16 January 2024) and [Theoatrix's original guide](https://www.youtube.com/watch?v=M0GroGCHNlI)
(29 August 2025). Extile's displayed normal 440 HP belongs to the historical
postquest encounter. Frames at 00:38–00:48 show preparation movement and eye
avoidance, but do not supply a controlled eye-damage check or protected gas
sample. Theoatrix's 01:47–04:20 preparation segment is 1920×1080 at
30000/1001 fps; it visibly switches loadouts/inventories during the salt
discussion. Its edited presentation lacks a verified real-time clock for
those mining intervals, so its screen-time salt changes are not used to infer
a pickaxe algorithm. The 2025 normal combat footage displays 485 maximum HP.
These additional original sources corroborate ordinary presentation without
establishing the previously unmeasured numeric bounds or random formulas.

The additional [TheEdB0ys ordinary session](https://www.youtube.com/watch?v=HozIDuwMShw)
(8 March 2025) supplies an uninterrupted sample with an on-screen wall clock.
The 03:00–05:00 excerpt starts at decoded PTS zero; the inventory and the
introductory equipment tooltip identify a dragon pickaxe. Sampling the salt
inventory every 0.1 seconds first shows six at 03:18.8 and twelve at 03:20.6,
with a five-XP Mining update. Sampling has 0.1-second resolution; the
1.8-second repeat is three game ticks.
This establishes one ordinary dragon-pickaxe interval, not its complete
distribution or whether shortened cycles occur. The displayed 440 HP and
normal 200-point meter identify the historical normal encounter; later
preparation updates still limit claims about current unobserved behavior.
Excerpt SHA-256 is
`ca55799a97d8df1acd51070e7feeb3f1d8dbc379fcf67c8a6d9c474305ec4792`.

Timestamp calibration also corrected the earlier 10Boot salt notes below:
the 03:20–03:40 downloaded excerpt retains a keyframe beginning at PTS -2.0
seconds. The earlier contact sheet counted that preroll as time zero and
therefore placed its absolute source timestamps two seconds late. Regenerating
the sheet after `trim=start=0,setpts=PTS-STARTPTS` gives first five salt at
03:22.4, then eight three-tick repeats through 03:36.8. The rune tooltip is
around 03:25.2. This corrects the absolute timestamps; the measured 1.8-second
intervals and existing rune implementation remain unchanged.

### Extremity footprint follow-up, 24 October 2026

The current [Desert Treasure II walkthrough, Duking it Out](https://oldschool.runescape.wiki/w/Desert_Treasure_II_-_The_Fallen_Empire?oldid=15374592#Duking_it_Out)
explicitly describes the extremity footprint as one tile nearest the eye,
then three tiles and then five on successive outward rows. This is a quest
walkthrough (revision 15374592, 17 October 2026 at 15:34:08 UTC), not a newly
measured postquest damage sample. The shared
[Extremity description](https://oldschool.runescape.wiki/w/Extremity) and
ordinary [strategy video](https://oldschool.runescape.wiki/images/Duke_Sucellus_-_running_past_extremities.mp4?c9b16)
show the same outward-widening cone. Original video frames at 2.0–3.0 seconds
visibly show the narrow wall-side tip and wider fence-side edge; the green
true-tile marker's safe route follows the wall-side column. The earlier
ordinary quest capture's north-eye hit at `3047,6451` also falls within the
published three-tile row and outside the previous centre-line approximation.

Cache revision 241 objects 47544/47545/47546 are 3×2, rotated so that the wall
footprint occupies two x-columns and three y-rows. Thus a west eye at x3028
has its nearest cone tile at x3030, widening at x3031 and x3032; an east eye at
x3049 mirrors this at x3048, x3047 and x3046. The y-centre is one tile north
of the object's origin. The model now implements those nine dangerous tiles
for all six eyes. The safe-run regression now checks x3030/x3048, where the
odd-y true tiles skip the cone tips; the previous test incorrectly certified
the same parity across the wider outer columns. Mushroom tiles remain clear.

Three new regressions failed against the previous model: exhaustive mirrored
one/three/five coverage and actual queued damage/freeze at both off-centre
north-eye tiles. The damage check remains at its existing cycle; the geometry
correction does not establish an exact active-window/check algorithm. All
75 focused Duke tests and a fresh TypeScript build pass.

The [dragon-pickaxe page](https://oldschool.runescape.wiki/w/Dragon_pickaxe)
publishes a generic one-in-six shortened mining cycle, and the
[salt-deposit page](https://oldschool.runescape.wiki/w/Salt_Deposit) quotes
different rune/dragon experience rates. These are a useful lead, but do not
alone establish the exact current Duke-specific roll or other tiers' rates.
The confirmed rune/iron intervals remain separate from that unresolved lead;
no generic Mining plugin or unpublished RNG formula is changed here.

### Wiki and original-video follow-up, 24 October 2026

The ordinary [Extremity page](https://oldschool.runescape.wiki/w/Extremity)
publishes a 50–70 damage range, reduced to 40–55 with Protect from Magic.
The previous implementation rolled 0–70 regardless of prayer. It now uses
the published inclusive ranges at the damage check. Four endpoint regressions
exercise both prayer states; three failed against the previous implementation.
Prayer drain and freeze remain on the existing check cycle. These published
ranges do not establish a different footprint or check cycle.

The Wiki's original [running-past-extremities clip](https://oldschool.runescape.wiki/images/Duke_Sucellus_-_running_past_extremities.mp4?c9b16)
was uploaded on 16 February 2024 at 17:34:37 UTC. It is 7.035646 seconds,
600×400 at 30 fps. Actual frames at 2.0–5.0 seconds show the green true-tile
marker skipping across the active cones; at 5.5–6.5 seconds it reaches the
mushroom-side safe tile. The clip corroborates the documented running route,
but contains no unsafe damage sample or complete tile-by-tile coverage test.
It does not display a boss-health or quest discriminator, so it cannot alone
distinguish ordinary postquest preparation from the quest. The video alone
does not certify every tile; the later footprint follow-up above supplies the
explicit published geometry.

The Wiki's [melee-flinching clip](https://oldschool.runescape.wiki/images/Duke_Sucellus_-_melee_flinching.mp4?e5666),
uploaded on 14 February 2024 at 01:37:16 UTC, is 25.123946 seconds at 30 fps.
Its visible 440 HP maximum is **ordinary postquest Duke at that date**, not the
quest variant: [the 12 February 2024 boss revision](https://oldschool.runescape.wiki/w/Duke_Sucellus?oldid=14546029)
lists normal 758/440, awakened 1099/1540 and quest 538/200. The
[25 June 2025 update](https://oldschool.runescape.wiki/w/Update:Summer_Sweep_Up:_Combat)
later added 45 normal HP alongside the preparation changes. Old poison
quantities and preparation speeds are therefore not imported. Sampling the
original combat clip every 0.2 seconds shows the first cloud visible at
10.8 seconds and the second at 12.6 seconds, corroborating the three-tick
separation. The first cloud is fully absent at 20.0 seconds while the second
remains visible at 20.8. Rendered visibility includes native effect tails;
these timestamps cannot be substituted for a packet-measured actor lifetime
or used to infer its random distribution.

[10Boot OSRS's original guide](https://www.youtube.com/watch?v=O1V5U4E20pY),
published 11 July 2025, provides a current ordinary postquest preparation
sample (level 758 and the normal 200-point meter, without Leagues indicators).
The 03:20–03:40 segment is 1920×1080 at 30 fps; the visible item tooltip
identifies a rune pickaxe around 03:25.2. Inspecting the inventory every 0.2
seconds first shows salt quantities 5/10/15/20/25/30/35/40/45 at
03:22.4/03:24.2/03:26.0/03:27.8/03:29.6/03:31.4/03:33.2/03:35.0/03:36.8.
Eight successive 1.8-second intervals corroborate the existing rune-pickaxe
three-tick repeat cadence. This closes that tier's repeat-cadence check;
it does not establish every other pickaxe tier or the first click response.

The current gas-mask, facemask, salax-salt and salt-deposit pages were also
checked. They do not publish the protected boss-magic or covered-gas bounds.
The strategy page adds that the initial preparation-vent pattern can differ
when the player is already in the vent area, without publishing that area's
selection boundary or the phase-selection algorithm. Protected magic 24,
covered gas 4, exact extremity check timing, remaining pickaxe
tiers, vent tie ordering/lifetime distribution/initial selection and ice RNG
therefore remain explicit evidence limits. Finite footage is not proof of an
unpublished random formula. Fresh build and all 72 focused Duke tests pass.

### Remaining-gap measurement, 24 October 2026

The follow-up inspects immutable decoder helper `7ca21602b38f` outputs using the
official source/runtime pinned above. Ordinary quest recording 1703 contains
1,077 ice warnings on 232 distinct warning ticks (10469–10933), covering 94
distinct tiles. Normal 758 recording 1827 independently contains 2,289 warnings
on 502 distinct ticks, also covering those 94 tiles. Both include four southern
entrance corners omitted by the original six-column implementation:
`3033,6435`, `3033,6436`, `3045,6435`, `3045,6436`. Counts in that order are
2/1/5/7 in 1703 and 12/13/7/10 in 1827. Representative ordinary ticks are
10674/10673/10549/10723. The warning coverage now includes these corners without
extending either narrow corridor, crossing the y6438 stair gap, or reaching
y6451 and above. The [ordinary strategies description](https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies)
independently places icefalls before the second stairs. A regression failed on
the omitted first corner before the fix and passes with all four included.

The 1703 warning-tick gaps are 153 one-tick, one two-tick, 76 four-tick and one
five-tick gap, consistent with a three-on/three-off opportunity clock with empty
random selections. These observations establish coverage and cadence; they do
not identify the random sample count, independent per-tile probability, weighting,
or seed. In particular, the sparse corner counts do not justify treating the
current uniform per-tile roll as recovered OSRS RNG.

The coherent ordinary 1703 window above has 234 warning opportunities, including
two empty opportunities at 10679/10782. Its count histogram for 0 through 11
warnings per opportunity is `2/7/15/43/53/46/29/24/11/2/1/1`. Normal 1827's
first uninterrupted preparation window, 1252–1656, has 204 opportunities,
900 warnings and histogram `3/10/14/37/44/41/31/13/7/3/1/0`; its empty
opportunities are 1260/1362/1656. Both windows cover 94 distinct tiles. Counts
vary, so they do not support a fixed warning count; the observed maximum of 11
does not establish an actual cap. Neither window repeats a tile within one tick,
consistent with the current independent per-tile roll, but also with sampling
without replacement. Later 1827 preparation clocks have different phases, so
the first window's phase cannot supply a whole-recording opportunity count.

Packet observability limits spatial-frequency inference. Restricting each
opportunity to a player position where all 94 tiles are within Chebyshev distance
15 leaves 139 opportunities/640 warnings/10 corner warnings in 1703, and
99/434/9 in the first 1827 window. At distance 12 the counts are 96/439/6 and
38/167/2. A uniform independent 1/20 roll would expect 27.8/19.8 corner warnings
in the distance-15 subsets and 19.2/7.6 in the distance-12 subsets. The remaining
packet-frequency bias after these distance controls is not proof of unequal RNG
weights: server zone visibility, line of sight and actual tile eligibility remain
uncontrolled. The existing 1/20 roll remains provisional; these finite samples
do not justify a replacement algorithm.

Combat vents also cannot be assigned a recovered lifetime distribution. In 1751,
the normal two-spit sequence at 11037/11040 creates actors at 11039/11042 and
ends them at 11053/11054 (14/12 ticks). Several shorter observed lifetimes end
together when the boss dies and are censored, not random lifetime samples.
Ordinary **quest** 1703 instead has 13 matched spawn/end pairs: six 16-tick,
five 14-tick and two 12-tick lifetimes. Quest timings must not silently replace
the current postquest implementation. Nearest-vent selection remains supported
by the ordinary Wiki; equidistant tie ordering is unidentifiable here.

At this earlier checkpoint, complete extremity coverage remained unresolved;
the footprint follow-up above supersedes its centre-line approximation.
Ordinary quest 1703 starts a
north cone at 10486; the player reaches `3047,6451` at 10489, receives freeze
graphic 369 at 10490 and a 56-damage hit at 10491. No ice warning targets that
row. This observation warrants checking the existing centre-line approximation,
but one route does not establish the full cone footprint, damage-check cycle or
whether quest and current postquest coverage differ. The documented safe
run-through route alone is insufficient to certify every off-centre tile.

The additional privacy-filtered decoder helper
`9d836fe28973fa4f22cca49ef0d7519be37a01c7c6196aa075b46c91889692b7`
exports only salt item 28349's inventory deltas and Mining stat 14 for this
measurement. Ordinary 1703's iron-pickaxe sequence 626 starts at
10673/10679/10686/10693 while stationary at `3034,6447`. Salt first changes
0→6 at 10679, then 6→12 at 10686 and 12→18 at 10693; the latter two Mining
XP updates each increase by 5, with Mining level 99. These three successful
yields distinguish the initial animation from collection: the first response
has no salt, the first yield arrives six ticks after it, then repeats every
seven ticks. Mining now starts its animation on the click response and waits
the pickaxe interval for its first yield, fixing the previous immediate grant.
The regression failed on the early six-salt grant before the fix. Other pickaxe
tiers and tick-manipulated gathering still lack controlled ordinary samples.

Protected magic maximum 24 and covered gas maximum 4 remain
unconfirmed: these captures do not supply a controlled ordinary postquest sample
with verified equipment, prayer and damage modifiers. No Leagues damage value is
used to set either bound, and no awakened value is imported.

These coverage/mining corrections pass a fresh TypeScript build and all 68 focused Duke
tests. The additional measurement narrows the evidence gaps; it does not close
the unidentified algorithms or the unresolved cone coverage.

Primary behavior sources:

- [Duke Sucellus](https://oldschool.runescape.wiki/w/Duke_Sucellus)
- [Strategies](https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies)
- [Arder powder](https://oldschool.runescape.wiki/w/Arder_powder)
- [Salax salt](https://oldschool.runescape.wiki/w/Salax_salt)
- [Arder-musca poison](https://oldschool.runescape.wiki/w/Arder-musca_poison)
- [Fermentation Vat](https://oldschool.runescape.wiki/w/Fermentation_Vat)

Installed revision-241 gamevals, definitions and map placements establish NPC/item/object IDs, options, animations, the 7x7 boss footprint, pillars, vents and resource coordinates. The authored `bosses/data/duke-sucellus.json` is encounter configuration, not a generated drop artifact.

This is a functional normal-mode implementation, not a claim of capture-exact OSRS parity. The capture-backed corrections above supersede the initial provisional visual effects and timing choices. Iron-pickaxe salt gathering now follows the ordinary measured first-yield delay and seven-tick repeats; other pickaxe tiers and tick manipulation remain unverified. Exact icefall selection, vent lifetime distributions and extremity check timing remain empirical; the cone geometry now follows the explicit primary description above. Normal protected magic max 24 and covered gas max 4 are provisional reductions; the source establishes reduced damage but does not explicitly give both bounds. A future capture can replace these values without changing the instance or reward contracts. Awakened hazards and achievements are intentionally not offered.

The generic grave multiplier defaults to one, accepts only finite values from zero through one, and affects gravestone reclamation rather than Death's Office. Duke supplies .25 until five normal kills. Merged graves retain the larger multiplier, a conservative policy preventing discounting previously normal-fee contents; that merge policy is not asserted as capture-confirmed OSRS behavior.

## Object interaction footprint correction

Staging MCP interactions reproduced a silent east-side vat click: revision-241 vats are 2x2, and salt deposits are 3x1, while the original handler measured distance from the origin tile. Preparation handlers now measure distance from the rotated cache footprint. Two RED/GREEN regressions cover every vat edge, out-of-range rejection and the salt deposit's far edge.

## Verification

Focused tests use actual cache definitions, players, NPCs, inventories, templated areas and hit queues. Packet-shaped object events reproduce gate/resource interactions. Regression tests cover full-inventory retention, feeding spam, per-owner access, zero magic grading, a single positive equipment reaction per hit, gaze and slam avoidance, queued-hit cancellation, respawn, saved statistics and death/exit cleanup. Independent review covers the encounter and canonical reward integration. Full-suite outcomes and remaining environment failures are recorded in the PR.

Final build and all 27 Duke tests pass. The broad server run passed 4,959 of 4,967 tests. Eight failures were confined to sandbox-dependent bot-index, localhost WebSocket and temporary-save-file cases; complete affected files passed outside the sandbox (133 bot/network and 28 save tests). This is not represented as an entirely green broad run. Later Duke review corrections received the fresh focused run, including actual canonical quantities, real NPC death tasks, source-cache walkable entry tiles and cache-named achievement targets.

The normal achievement follow-up adds ten regressions using actual MovementQueue, PendingHit and hit queues, including teleport/run state and death-animation eligibility. Fresh build and 61 Duke/Combat Achievement/hit-queue checks pass. The original combined local server installation separately passed all 4,961 server tests before these follow-ups.

This branch depends on TSPS #882 for conditional drop quantities and applied-damage observers. It includes generic per-NPC stat-drain immunity and grave-fee foundations also used by the other normal-mode boss branches. No live game restart, account edit or Claude-owned client/clue deployment is performed here.
