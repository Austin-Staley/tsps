# Whisperer normal corrections

**Base/dependency:** `62ab2cb12`, PR #893. Native execution authorized after the combined local installation; this branch edits Whisperer modules/tests/docs only.

**Evidence:** Rev241 item examines identify 28356 as glowing and 28357 as normal. The Wiki's Whisperer loot section excludes protected melee chip from avoidable damage; its fight description queues threshold specials for the next attack. Strategies states that post-third-special pursuit stops below 100 HP and that marked Undead Grasp guarantees a bind. Existing core handles marked Grasp's bind roll; verify its accuracy contract before changing plugin behavior.

1. Add failing real-cache fragment conversion/replacement regression; use the correct normal/glowing identities in Common/Site and correct the documentation.
2. Add failing real-HitQueue protected/unprotected melee tests, including prayer changes before HP application and both mirrored hits. Capture protection with the damage roll and let only avoidable applied damage invalidate perfection.
3. Add a failing threshold-during-volley regression. Start specials at `nextAttack`, retaining launched impacts rather than cancelling the volley on threshold crossing.
4. Add a failing third-special pursuit regression at 99/100 HP; stop movement below 100 without changing the player's remaining bind timer or earlier pursuit behavior.
5. Inspect and exercise existing marked Undead Grasp accuracy/bind behavior; only change a demonstrated plugin-owned omission. Leave unmarked Grasp and other spells unchanged.
6. Run fresh server build, focused Whisperer/HitQueue/Arceuus checks, diff check and independent review. Publish a ready follow-up PR with feature-only commits for later root integration.

**Limits:** No new guessed melee distribution, protected damage share, fragment lock tick, special timing or geometry. No main/live/client/generated-data changes or restart. Preserve other workers' edits and runtime artifacts.

**Review focus:** Cancelled/zero damage never spoils loot; both melee hits share the original prayer snapshot; in-flight impacts survive threshold crossing; pursuit stops only below 100 after the third special; item placeholders remain rejected.
