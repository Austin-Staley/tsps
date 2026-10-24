# Duke normal-mode achievement follow-up

The combined local build is installed and verified; user authorized continuing normal-mode gaps. This branch depends on PR891 and owns Duke modules/tests/docs only. No client, clue, generated-data or live checkout edits.

Primary sources: [Cold Feet](https://oldschool.runescape.wiki/w/Cold_Feet) requires no actual running and no avoidable damage, including preparation, with eligibility reset after each kill. [Mirror Image](https://oldschool.runescape.wiki/w/Mirror_Image) compares player attack initiation with Duke attack initiation in the same tick; recoil-only kills and thralls are allowed. Neither a delayed hitsplat nor a missed player attack changes what counts as initiating an attack.

- [ ] Add red/green real-core tests for Cold Feet: preparation running fails, standing with run enabled does not fail, avoidable preparation damage fails, a new kill resets eligibility, and movement during respawn belongs to the next kill.
- [ ] Record actual running in the owner-only area's process after movement, not a global player hook or the earlier task scheduler. Carry next-kill eligibility across respawn.
- [ ] Add red/green Mirror Image tests through real PendingHit queue-time roll hooks: correct launch tick succeeds, a miss off-cycle fails, delayed hits use launch rather than impact, NPC/thrall damage is excluded, and recoil-only victory succeeds.
- [ ] Record Duke's implemented attack starts, including scheduled gas launches, and validate player-origin attack rolls only against the exact current owned boss. No NPC-ID core special case. Track only the latest relevant cycle; no global/permanent per-tick collections.
- [ ] Award achievements only after final owner kill, preserve perfect loot/speed/KC behavior, and verify cache task identities.
- [ ] Build, run Duke/CA/hit queue regressions, obtain independent review, push and open one ready follow-up PR. Integrate into the already verified local branch at a controlled server update after the other normal fixes are reviewed.

Uncaptured numeric timings, normal protected magic/covered gas bounds, absolute prep hazard timing and dedicated icefall graphics remain explicitly provisional. Do not replace them with guesses under this achievement change.
