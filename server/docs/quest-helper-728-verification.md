# Quest Helper 728 native verification ledger

This ledger preserves native playthrough evidence across service epochs. A native proof is tied to the quest plugin, focused test, and actually loaded plugin revision below; the matching values are full SHA-256 hashes. A checkpoint continuation counts once with its verified parent prefix, never as a fresh run. Root/source review acceptance is stated separately from the worker's report status. Temporary report paths are included for audit, but this file contains the essential result and no account credentials or raw account logs.

Cache: `osrs-241_2026-10-20`. Quest Helper reference used for these routes: pinned checkout `06da90f982518a093f2fe1c9cfac5547fa7053d3`. Cache data and shared runtime revisions are named where material. The epoch-3 shared MovementQueue footprint fix was `62eefaee16e32f2df54181ac71618c6b7808a2a6fb28022c8b4d9f34cee0bab4`, from source `b1bfa4f36636195e12ae089ee12db13bbb0ec3e9a476c62e50ac9db8d1c85d08` (accepted offline build/tests 19/19). Later service epochs captured loaded plugin hashes and cache hashes independently. These shared revisions do not replace the per-quest source/loaded hashes below.

## Original 128: accepted natural main-route proofs

Four quests have accepted natural main-route completion evidence: **4 / 128 (3.125%)**. The accepted set is q003, q008, q041, and q074. These results include declared ordinary setup/prerequisites; they do not claim those fixtures as quest progress.

### q003 — The Ascent of Arceuus

- **Revision:** plugin/source = loaded = peer-reviewed `24e8e4911d25fa2198820ec88fa324b71219099dcfa666f383fa7dd9ccfee16a`; focused test `46cc17a9aaf8e2a0f23192a716493c12672041bff7cc3c5c1f7c96b363122ddf`; location teleport data `72aad9a81af613a2a5c23e7054edd72159956d68ada7933bd091cb0adb997117`; shared MovementQueue source/runtime `b1bfa4f36636195e12ae089ee12db13bbb0ec3e9a476c62e50ac9db8d1c85d08` / `62eefaee16e32f2df54181ac71618c6b7808a2a6fb28022c8b4d9f34cee0bab4`.
- **Natural route and result:** epoch 2 proved the natural prefix from stage 0 through stage 8; epoch 3 resumed that same account/checkpoint, traversed the six-object trail (34622, 34623, 34623, 34621, 34624, 34625), altar and Trobin handoff, and reached stage 14. Cache varbits 7859-7865 record the grave/trail/device steps. Completion UI appeared; QP +1, Hunter +1500 XP, Runecrafting +500 XP and coins +2000 were observed. Repeat did not duplicate reward. Page use/replay persisted; official save history and final offline boundary were recorded. Source coordinator accepted the combined prefix and continuation.
- **Cache/path fact:** Grave loc 34602 at `(1347,3736)` is a 4×2 placed object, while its active varbit child 33578 is 1×1. The shared MovementQueue footprint correction restored natural interaction reachability for this parent-sized collision target; the accepted retry used the real grave interaction, not a teleport or handler shortcut.
- **Limits/recheck:** full-bag, ambient Mori recovery, and visual quest overlay remain unchecked. This claim is for the exact plugin/data hashes above. Evidence: `/tmp/tsps-728/native/prior/q003-epoch1/q003.report.json`, `/tmp/tsps-728/native/jobs/q003-epoch3.report.json`, `/tmp/tsps-728/native/evidence/q003-root-release.json`.

### q008 — Bone Voyage

- **Revision:** plugin/source = loaded = peer-reviewed `4a0656ff904a18720472ea8f121b8ffef7b9fbdca555d9da48592f852cba5cdd`; focused test `395aa164379a038ad557c11ecac4047520b172787f0ee6b182033df94f2bd09d`.
- **Natural route and result:** epoch 5 exercised the dialogue/scene handoffs, canal barge and copied sailing instance, voyage, arrival, Junior Navigator completion, and completion UI. Cache quest row 11 uses varbit 5795 with completion wire value 50; durable stage 11 was verified. QP +1; no skill XP reward; Fossil island notebook +1 and declared consumables were reconciled. Museum Kudos were earned in the run through ten Historian Minas reports and five real finds; they were not a setup fixture. Ordinary non-target prerequisites were declared as setup. The completed Junior Navigator despawned; a same-target repeat attempt could not reopen completion and caused no duplicate QP, XP or notebook. Relog preserved stage/rewards; completion save #220 and logout save #221 were recorded. Post-quest Curator dialogue and barge travel to Fossil Island worked after relog.
- **Limits/recheck:** lost-item reclaims, full-bag, interrupted voyage/conversation and overlay remain unchecked (the scoped source tests cover several recovery branches, which is not native proof). Evidence: `/tmp/tsps-728/native/jobs/q008-epoch5.report.json`, `/tmp/tsps-728/native/prior/q008-epoch5/release.json`.

### q041 — Fishing Contest

- **Revision:** plugin/source = loaded = peer-reviewed `1ee13dcdd61f32e5326ebd81961509dfaf521efb43eb32183be492980340771d`; focused test `cca7cc9ea5e1f4dc862b7dd3cfb3734ba9e251afeff985bb1b627787992b7b17`.
- **Natural route and result:** epoch 3 preserved the natural prefix from stage 0 to 1; epoch 4 continued naturally to stage 4; epoch 5 resumed that checkpoint and completed the route and Vestri trophy hand-in. Cache quest row 52 uses varp 11 with completion threshold 5. QP +1, Fishing XP +2437.5, and the trophy was consumed. Repeat did not duplicate the reward; relog/save and the post-quest tunnel descent were verified. The source coordinator accepted the combined proof.
- **Limits/recheck:** recovery, full-bag and overlay remain unchecked. Evidence: `/tmp/tsps-728/native/jobs/q041-epoch3.report.json`, `/tmp/tsps-728/native/jobs/q041-epoch5.report.json`, `/tmp/tsps-728/native/prior/q041-epoch5/release.json`.

### q074 — Monk's Friend

- **Revision:** plugin/source = loaded = peer-reviewed `a529c99739ebd4f4eb238ac7867f62ee64bf555f4789bbb53738250fcf423523`; focused test `359f3365a3717682acbb6e030a4ea505ea120e8b154a37fc034e5229b4f6092b`.
- **Natural route and result:** the accepted epoch-2 run started fresh at stage 0 and naturally completed the route. Cache quest row 97 uses varp 30 with completion value 80; live completion reached 80. It verified the full-inventory rune drop (eight law runes on the floor), normal logout/relogin interruption after rune handover, party completion, and pickup/reconciliation. QP +1 and Woodcutting quest XP +2000 (ordinary chopping XP is separately accounted); repeat/relog/save evidence showed no duplicate reward. Root accepted the bounded functional evidence.
- **Limits/recheck:** a Wiki-marked later dialogue and visual overlay remain unchecked. The accepted run is scoped to this exact revision; it does not assert exact uncaptured presentation cadence. Evidence: `/tmp/tsps-728/native/jobs/q074-recovery.report.json`, `/tmp/tsps-728/root-reviews/q074-recovery.json`.

## Original 128: additional completion observed, main-route proof incomplete

Five original-128 quests have native evidence of the target completion action/state (**5 / 128 = 3.90625%**), but only four satisfy the accepted main-route category above. q004 is the additional completion and remains explicitly incomplete overall.

### q004 — At First Light (completion observed; overall INCOMPLETE)

- **Revision:** plugin/source = loaded = peer-reviewed `442c311503a6898cb7e6377848bba3661e40fe03e0b79556614c5482ffc4b368`; focused test `2ac8b1c5ae0c439ec9b8f35d8d67364e0478641ae8707ac88331eb20b34c7d7a`.
- **Observed:** epoch 1 reached stage 12 and recorded completion/reward UI, QP +1, Hunter +4774, Construction +800, Herblore +500, Crafting +10, and relog persistence. Epoch 3 separately proved the affected hammer pickup from the verified south tile `(1696,3069,0)`, with inventory +1; north/east approaches are cache-wall blocked.
- **Why not accepted as full natural:** the original route used a noncanonical `::teleports` recovery and did not select the second post-quest history choice. The later pickup retry is a bounded affected-leg proof only and does not upgrade the whole route. Evidence: `/tmp/tsps-728/native/prior/q004-epoch1/q004.report.json`, `/tmp/tsps-728/native/jobs/q004-epoch3.report.json`, `/tmp/tsps-728/root-reviews/q004-epoch2.json`.

## Supplemental evidence outside the original 128

### q129 — Learning the Ropes (outside original 128; completion observed; overall INCOMPLETE)

- **Revision:** plugin/source = loaded = peer-reviewed `d9aca8b1af77a62e616ad9e41a7d7ae56e7a9578998018fca5cded52d288eb9f`; focused test `1255fe3191b1dae3bcccbd89056decda41f4bc3487d2aeb9fd9a169d762dd8d0`.
- **Observed:** fresh epoch-6 tutorial account naturally reached varp 281=1000, QP +1 and the quest-completion save-history row. Relog preserved completion and the 25-coin bank balance. The pinned Quest Helper has no route for this tutorial quest; no helper steps were invented.
- **Why not accepted as full natural:** the report contract's Lumbridge destination and optional repeat dialogue were not verified; the normal shared spawn resolves elsewhere. Overlay remains unchecked. This supplemental result does not change the original-128 denominator or numerator. Evidence: `/tmp/tsps-728/native/prior/q129-epoch6/report.json`, `/tmp/tsps-728/native/evidence/q129-epoch6-final-boundary.json`.

### q131 — Waterfall Quest (scoped route evidence only)

- **Revision:** plugin/source = loaded = peer-reviewed `11e8beb5e61094f295cbbe2c7d779f83892fef630f45bd8575f765978561c3f6`; focused test `25a93c67007a0ac8b02f9254a7648c676b4354d20999718ca961b5aa1b045a99`.
- **Observed:** the scoped route used raft 1987 at `(2509,3493,0)`, crossing rock 1996 at `(2512,3468,0)` (transformed to 1997 while roped), rope-piece locs 1998, dead tree 2020 at `(2512,3465,0)`, and ledge door 2010 at `(2511,3464,0)`. It reached the ledge at `(2511,3463,0)` and, without Glarial's amulet, observed the canonical flood messages and push to `(2527,3413,0)` rather than dungeon entry. A separate continuation proved the ordinary River Swim action and settled downstream transition. Both are supplemental affected-route evidence; stage varp 65 remained at 2 and no completion was claimed.
- **Limits:** no whole-quest completion, reward, QP or XP claim. Evidence: `/tmp/tsps-728/native/jobs/q131-epoch3.report.json`, `/tmp/tsps-728/native/jobs/q131-riverswim.report.json`, `/tmp/tsps-728/root-reviews/q041-q131-integration.json`.

## Incomplete or blocked native checkpoints

These are real attempts, not completed quests. A clean source test or peer review does not convert a blocked native route into a playthrough proof.

| Quest | Native source/test/loaded revision | Checkpoint and current disposition |
| --- | --- | --- |
| q006 Big Chompy Bird Hunting | Attempt: source = loaded `8043381031fd2f574d926fb3f099fe7f9cca49d88524ada102a94ae3daa13b18`; test `287ce5877577eaad87a0da614e06923b5bb3f94b14ee43e4685ecfb96d4c2422`. Later cave-exit correction: `1d22033d066ba1af26f833f3146da6e6a5f0bf50063bbac952822ff6ea6487a7`; test `f4bad7f8406e5731a82a9c5f12a561eb3b09c648df45aed7c5a16f02b8208205`. | Epoch 3 stopped at stage 20 before swamp/toad/hunt/completion. The corrected source has focused tests/review, but this record is not a native rerun of that correction. Preserve the old stranded checkpoint as historical evidence; do not call the correction natively proven. `/tmp/tsps-728/native/jobs/q006-r1-epoch3.report.json`. |
| q007 Biohazard | Native attempt source = loaded `725069673e079e73ef8a1f0519123ec723341369f54502a99814dce754294aa1`; focused source review later recorded plugin/test `110975c408fc982cd4c5efc62cfb59c610a18a53ce2287131c9318031a3ab8f3` / `b96a622f16b63f3df8e9af61ab3bf4692251e62ec048260867dec3c8d82c5f2e`. | Incomplete before the target route completed; no final reward/QP/XP proof. Later source corrections/review do not retroactively validate the old loaded run. `/tmp/tsps-728/native/jobs/q007.report.json`. |
| q011 Clock Tower | Native source = loaded `48a7cb0c9ffa5a3ee2fd861c67a747c7284675fe7b3073ebcb9dc8a022a62986`; test `8d35c5110e0696048b5b5d1997f1fa87ce923432a9afee20997b910094b4c3c1`. | Incomplete at stage 3 before obtaining the black cog; no completion/reward. The white ladder is a one-way surface exit, not a second-floor shortcut. No accepted natural route retry is recorded. `/tmp/tsps-728/native/jobs/q011.report.json`. |
| q055 Hazeel Cult | Native source = loaded `1382f02587ff5ade66a950b99f8ad7b7182517e999160d501e02a7f6d1b07cd9`; native focused-test candidate `bcea58442f505a28052c7d17b77ae878f9510487803553ec7afad0b9b89810ff`. | Incomplete at a natural route blocker; no completion/reward. Subsequent route diagnosis does not upgrade this attempt. `/tmp/tsps-728/native/jobs/q055-epoch3.report.json`. |
| q128 Zogre Flesh Eaters | Native source `78f10f0e62c9f67408c12b48a714c5f68a1039b8a11d4a0a468550d975ca1fb6`; test `a1883397b108d473f1ff282a018ea27497992d673b10575e63b346d2d5caa5f9`. | Stopped at stage 3 after repeated identical unreachable responses for the tankard/NPC interaction; no workaround or completion. Exact failed route remains an owner diagnosis item. `/tmp/tsps-728/native/jobs/q128.report.json`. |
| q129 epoch 5 | Tutorial-plugin-disabled runtime; no valid loaded quest-plugin hash for the intended tutorial proof. | Blocked before meaningful route proof. Superseded only for the bounded epoch-6 completion facts above, not retroactively erased. `/tmp/tsps-728/native/jobs/q129-epoch5.report.json`. |

## Evidence and revalidation policy

- A completion is counted only when the native report, actual loaded plugin hash, reward/state deltas, persistence evidence, normal offline boundary, and independent/root acceptance agree. A source report/test or review by itself is not native evidence.
- Retain each historical result against its recorded source/test/loaded hashes. When a quest plugin changes, mark only claims depending on that plugin as requiring recheck; a changed unrelated plugin does not invalidate the whole ledger. Shared-core or data changes require targeted revalidation of affected routes/claims, not an automatic replay of every unchanged quest prefix.
- Prefixes resumed across epochs remain one checkpoint-linked route with provenance. Supplemental routes, post-quest checks and retries never increment the whole-quest count.
- `PASS` for a scoped contract means only that scope. Do not infer untested branches, overlay visibility, timing, full-bag behavior or recovery from a different branch.
- The historical reconciliation inventory found four accepted natural main-route proofs and five original-128 completion observations. The q129 tutorial result is additional and outside the original 128. See `/tmp/tsps-728/native/history-reconciliation.md` for the inventory cross-check.
