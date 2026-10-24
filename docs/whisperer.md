# The Whisperer

The members-only plugin owns the postquest normal encounter after Desert Treasure II. A completed player needs a real Blackstone fragment; the bank placeholder does not qualify. Ketla's generated reclaim conversation grants a lost plain fragment at its handout step. The owner-only private cathedral includes both realms, inherits cache clipping and preserves each approach tile. North/south wakes push three tiles away from the figure; no east/west/diagonal displacement is invented. Public rope/teleporter access uses named hooks independently of quest progress.

## Current behavior

Normal combat has900HP, threshold specials at720/495/270, impact-time prayer checks, increasingly mixed three-projectile volleys, static four-tile tentacle rays, mirrored melee hits, binding pursuit, sanity/prayer changes and140HP enrage. Each shot animates its alternating hand and uses fixed cycles30/90 with raw heights350/100. Launched shots survive a later melee recovery or phase transition; final death, departure and stop cancel all remaining encounter damage. Tentacles show spawn/attack/path/hit/removal at+0/+1/+2/+3/+4, with one hit per wave across realm transfers.

Specials retain teleport preparation and actor materialization at+6 seeds/+5 columns/+4 souls. Seeds use all four24/28-tile patterns and40ticks after materialization. Screech uses eight20/40/60HP columns, native40-pixel headbar2 and blasts at+17/+23/+29. Water-wave graphics, delayed column projectile/HP impacts and removal remain separate phases. Souls use twelve one-HP actors in2/3/3/4 sets, vulnerable in shadow, with per-set rewards. Completing a special emits depletion/result messages. Fragment switching begins with materialization; screech closes switching at+14.

Binding uses the melee transformation, cast sequence10254 and cast/impact graphics177/2466. Captured Chebyshev distances3/4/5-or-more select200/180/170cycles; the corresponding impact occurs at+7/+6/+6. A real freeze counter cancels the impact and releases the player. After the third special, below100HP cancels pursuit and restores autos two ticks later while preserving the launched bind's original deadline. Crossing the next special threshold replaces the post-special bind. No optional-bind skip probability is invented.

Every owned boss, figure, tentacle, column and soul has `combat:no-regen` before area ownership through removal. Final death freezes kill time, restores sanity and grades actual avoidable damage; protected melee chip preserves perfection. Death/exit/logout removes actors and resets realm/HUD state. Counts, PBs, first-five-kill grave discounts, native personal/world statistics and normal combat achievements persist. Slayer assignments exclude speed awards. Awakened entry and achievements remain unavailable.

## Primary sources and capture boundaries

The current [Whisperer](https://oldschool.runescape.wiki/w/The_Whisperer), [strategies](https://oldschool.runescape.wiki/w/The_Whisperer/Strategies), [Floating Column](https://oldschool.runescape.wiki/w/Floating_Column), [Blackstone fragment](https://oldschool.runescape.wiki/w/Blackstone_fragment) and [Tentacular](https://oldschool.runescape.wiki/w/Tentacular) pages supply normal mechanics and restrictions. Cache241 establishes IDs: plain fragment28357, active28356, placeholder28358; NPC12203–12212; sanity interface834; varbits15064/15162/15067. The fragment and transport corrections from the later base review are retained.

The original source audits decoded [1703](https://rsprox.net/download/1703) (revision226, ordinary-world quest) and [3281](https://rsprox.net/download/3281), [3285](https://rsprox.net/download/3285), [3299](https://rsprox.net/download/3299) (revision234, Grid Master) using [official source d997d071](https://github.com/blurite/rsprox/tree/d997d071bc2783664d1658a80f4d1f881b355119), runtime1.0.5. No ordinary-world postquest packet recording was found. Quest and event recordings corroborate presentation; they do not establish ordinary damage, healing, prayer, attack rates or RNG.

Normal variants in the event recordings are independently classified by level791, three-shot volleys, three screeches and twelve souls. Later level1146 actors are awakened and excluded. Capture3285 SHA256 is `8cfd915cc9172769c3b871b17640f5b6141468f8e3796abf75d3ff461dace3da`;3281 is `f5c74b17e6d3b96380b11f76eb8cbd07c444f4aeec951f25e60ba7093a111b92`;3299 is `2cdae59cc4d39fe356137483853b3d66021f675854ee801c7f3d4c9434b478b8`. Raw account-bearing logs are not committed.

| Behavior | Retained evidence |
| --- | --- |
| Fragment/feedback |1703 updates15925/15957 show active28356/plain28357. It establishes pulse/depletion, special/result, bind and enrage wording. Later captures establish current pink/purple/red/green colors |
| Wake |1703 pickup827 at15841, flyback9799/spawn10227/sound3201 at15842, transform at15846. Normal event actors corroborate north three-tile displacement and transform+4 |
| Volleys |1703 ranged2444 at15850/51/52 and magic2445 at15860/61/62 alternate10237/38 and10243/44. Old byte heights87/25 cannot distinguish raw348 from350; later234 packets establish350/100, angle254, progress128 and a tile source |
| Tentacles |3285 example20914 spawn,20915 attack,20916 path graphics2447–2450 with5/10/15/20cycle delays,20917 hit,20918 removal |
| Screech |3285 normal actor47055 teleports20971, appears20972, charges20974, materializes columns20976 and blasts20988/20994/21000. All21 normal water waves corroborate the footprint and protected column rectangles |
| Binding |3285 casts21405/21484/21929/22106/22149/22553/22603/22776/23058 show form12205, sequence10254, launch80, heights580/0, angle16, progress150. Across22 classified casts, distances3/4/5+ match200/180/170cycle arrivals |
| Enrage |Normal event sequences separate HP restoration, appearance+4, realm transfer+5 and first shot+7, retaining shots already launched |

Ordinary footage supplies independent normal-world bounds:

- [Noob Friendly2024 guide](https://www.youtube.com/watch?v=Xc3_IIKmEKI), SHA256 `4c2d11881d5addc43c6f8d75b3d7a2524f3ed89a9209122b9471a597432182f1`: a stationary675HP special exit omits a visible bind. This does not establish its optional selection rule.
- [Ordinary thralls kills](https://www.youtube.com/watch?v=_tSCuWmbjos), SHA256 `468d2346a27ec0030b9f85c533cfda1b63211db48286838d84230b7d9f818840`: bind graphics and uncountered movement constrain natural freeze below the former12ticks. Eight remains a provisional choice; attacks/camera prevent an exact expiry measurement.
- [Max-mage footage](https://www.youtube.com/watch?v=JUi2ZBkEih0), first600s SHA256 `fb84b719ab92302ade2bd25e70210897e1057bbfe29ddaa91f941ce902783ac2`: approach preservation, south-side wake displacement and clean column bars. The roughly three-tile distance is a calibrated visual inference, not a packet measurement.
- [Wiki screech clip](https://oldschool.runescape.wiki/images/The_Whisperer_-_screech_dodging.mp4), SHA256 `bc6791a81881aafcd5d85d4fd5d13fd11113c4e378543b13036a927ee9645407`: waves precede column hits by about two ticks and columns disappear afterward. Approximate frame times are not exact tick timestamps.
- [2026 ordinary guide](https://www.youtube.com/watch?v=RfZ8Sp28EEA), SHA256 `ccb12c27e2dce0c24f2054329888b5be4428dfea6c7cfe3054c567a276e8411d`: walk-up mirrored melee corroboration; edited segments do not establish optional-bind RNG or below100HP timings.

## Remaining source limits

This is functional normal content, not complete1:1 parity. The28–42 melee distribution, floored two-thirds protected share, zero-sanity damage ramp, column-health distribution beyond published guarantees, bind selection, exact freeze expiry and distances below3 remain provisional. General east/west/diagonal wake behavior is unmeasured. Wiki30tick respawn remains despite shorter historical/event observations. Soul-result branches beyond no/some/all completed sets remain unverified. Awakened mechanics are not offered.

## Integration and validation

The branch retains PR893 `a92357d8add71092ec5618f710e1f5b6744cca1c` and PR896 `ca5a794d7fda0bcf39491d1e32b6cc94566708ad`. Named transport/fragment hooks, generated Ketla dialogue integration, messages, visited varbit and colored duration/PB output coexist with the later phase/achievement/record work. Only unnamed scoreboard parents need a guarded generic fallback. Source-generated JSON is unchanged from main.

Tests use real cache definitions, players, NPC processing, inventories, private areas and hit queues. Added integration regressions preserve launched volleys during melee recovery and cancel them on stop; existing real-NPC clocks verify boss/column/soul HP. The own-worktree MCP smoke verified north6371→6374 wake,900HP boss, a threshold screech with all eight columns, and exit reset of realm/HUD with no visible encounter actors. Client animation feel was not visually retested. Final build/suite totals are in the integration PR.
