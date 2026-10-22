# Quest Helper 728 native verification ledger

This ledger preserves native playthrough evidence across service epochs. A native proof is tied to the quest plugin, focused test, and actually loaded plugin revision below; the matching values are full SHA-256 hashes. A checkpoint continuation counts once with its verified parent prefix, never as a fresh run. Root/source review acceptance is stated separately from the worker's report status. Temporary report paths are included for audit, but this file contains the essential result and no account credentials or raw account logs.

Cache: `osrs-241_2026-10-20`. Quest Helper reference used for these routes: pinned checkout `06da90f982518a093f2fe1c9cfac5547fa7053d3`. Cache data and shared runtime revisions are named where material. The epoch-3 shared MovementQueue footprint fix was `62eefaee16e32f2df54181ac71618c6b7808a2a6fb28022c8b4d9f34cee0bab4`, from source `b1bfa4f36636195e12ae089ee12db13bbb0ec3e9a476c62e50ac9db8d1c85d08` (accepted offline build/tests 19/19). Later service epochs captured loaded plugin hashes and cache hashes independently. These shared revisions do not replace the per-quest source/loaded hashes below.

## Original 128: accepted natural main-route proofs

Five quests have accepted natural main-route completion evidence: **5 / 128 (3.90625%)** (q003, q008, q041, q063, q074). These results include declared ordinary setup/prerequisites; they do not claim those fixtures as quest progress.

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

## Original 128: completion observations not yet accepted

Six original-128 quests have native evidence of the target completion action/state (**6 / 128 = 4.6875%**), while five are accepted in the main-route category above. q004 remains the additional completion that is overall incomplete.

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
| q006 Big Chompy Bird Hunting | Attempt: source = loaded `8043381031fd2f574d926fb3f099fe7f9cca49d88524ada102a94ae3daa13b18`; test `287ce5877577eaad87a0da614e06923b5bb3f94b14ee43e4685ecfb96d4c2422`. Later cave-exit correction: `1d22033d066ba1af26f833f3146da6e6a5f0bf50063bbac952822ff6ea6487a7`; focused test `f4bad7f8406e5731a82a9c5f12a561eb3b09c648df45aed7c5a16f02b8208205`. | Epoch 3 stopped at stage 20. Epoch 9 loaded the corrected plugin, resumed that same save, and used ordinary Home Teleport plus cache-backed travel from `(3088,3250,0)` to `(3007,3179,0)`; stage 20/QP 0 remain unchanged. Westward routing beyond the local planner window is unresolved; no swamp/toad/hunt/completion claim. `/tmp/tsps-728/native/jobs/q006-epoch9-travel-checkpoint.json`, `/tmp/tsps-728/native/jobs/q006-epoch9.raw.jsonl`. |
| q007 Biohazard | Native attempt source = loaded `725069673e079e73ef8a1f0519123ec723341369f54502a99814dce754294aa1`; focused source review later recorded plugin/test `110975c408fc982cd4c5efc62cfb59c610a18a53ce2287131c9318031a3ab8f3` / `b96a622f16b63f3df8e9af61ab3bf4692251e62ec048260867dec3c8d82c5f2e`. | Incomplete before the target route completed; no final reward/QP/XP proof. Later source corrections/review do not retroactively validate the old loaded run. `/tmp/tsps-728/native/jobs/q007.report.json`. |
| q011 Clock Tower | Native source = loaded `48a7cb0c9ffa5a3ee2fd861c67a747c7284675fe7b3073ebcb9dc8a022a62986`; test `8d35c5110e0696048b5b5d1997f1fa87ce923432a9afee20997b910094b4c3c1`. | Incomplete at stage 3 before obtaining the black cog; no completion/reward. The white ladder is a one-way surface exit, not a second-floor shortcut. No accepted natural route retry is recorded. `/tmp/tsps-728/native/jobs/q011.report.json`. |
| q055 Hazeel Cult | Native source = loaded `1382f02587ff5ade66a950b99f8ad7b7182517e999160d501e02a7f6d1b07cd9`; native focused-test candidate `bcea58442f505a28052c7d17b77ae878f9510487803553ec7afad0b9b89810ff`. | Incomplete at a natural route blocker; no completion/reward. Subsequent route diagnosis does not upgrade this attempt. `/tmp/tsps-728/native/jobs/q055-epoch3.report.json`. |
| q128 Zogre Flesh Eaters | Native source `78f10f0e62c9f67408c12b48a714c5f68a1039b8a11d4a0a468550d975ca1fb6`; test `a1883397b108d473f1ff282a018ea27497992d673b10575e63b346d2d5caa5f9`. | Stopped at stage 3 after repeated identical unreachable responses for the tankard/NPC interaction; no workaround or completion. Exact failed route remains an owner diagnosis item. `/tmp/tsps-728/native/jobs/q128.report.json`. |
| q129 epoch 5 | Tutorial-plugin-disabled runtime; no valid loaded quest-plugin hash for the intended tutorial proof. | Blocked before meaningful route proof. Superseded only for the bounded epoch-6 completion facts above, not retroactively erased. `/tmp/tsps-728/native/jobs/q129-epoch5.report.json`. |

## Recent checkpoint continuation

### q063 — Jungle Potion (epochs 7–8; accepted natural main-route continuation)

- **Revision:** source = loaded = exact-hash peer-reviewed `8ea7b34ff9261686084a51006f13593c65b0dd0625513c0e377c78d20fd38b61`; focused test `3a0d34892796b16e6e2e2e84cf3cb7c62defca9484f53572311fdb10f0e38c08`; Quest Helper pin `06da90f982518a093f2fe1c9cfac5547fa7053d3`. Epoch-8 loaded shared components included NpcDialogues `252da523…54c723`, MovementQueue `62eefaee…0bab4`, dialogue data `7b596997…298237` and index `e1bd3116…1664f`.
- **Natural route and completion:** epoch 7 established the fresh stage-0 prefix through varp 175=9 (all four initial herb hand-ins). Epoch 8 resumed that same account/checkpoint at stage 9, naturally walked to and entered Pothole Cave, searched the Fungus-covered Cavern Wall for the Rogue’s Purse, climbed out, cleaned it normally, and handed it to Trufitus. Cache quest row 80 uses varp 175 with threshold 12; natural completion UI appeared at 12. QP +1 (varp 101: 4→5); Herblore +775 quest XP and +10 cleaning XP across five herbs; no item reward, clean purse consumed. Repeated canonical post-quest talk did not duplicate rewards. Relog preserved completion/rewards; official save history showed baseline #242 followed by quest-completion #246 and logout #349; final offline was confirmed. Trufitus’s canonical post-quest lines were heard after relog. A supported lost-herb recovery was exercised: re-search after completion returned a grimy purse without progress/reward changes; it was dropped normally.
- **Limits:** full-bag, interrupted hand-in, pre-start/stale-slot recovery and overlay remain unchecked. One grimy Rogue’s Purse remains on the ground at `(2809,3085,0)` after the documented recovery cleanup. The epoch-7 portion and epoch-8 completion are one checkpoint-linked route, not two quests. The source coordinator accepted the combined checkpoint and continuation evidence; the ready entry was revoked after the final offline boundary. Evidence: `/tmp/tsps-728/native/jobs/q063-epoch7-checkpoint.json`, `/tmp/tsps-728/native/jobs/q063-epoch8.report.json`, `/tmp/tsps-728/native/jobs/native-q063.raw.jsonl`, `/tmp/tsps-728/native/evidence/service-epoch8.json`, `/tmp/tsps-728/native/evidence/q063-epoch8-root-release.json`.

## Epoch 9 active continuations (scoped; not full-quest completion)

The current workspace source commit at this checkpoint is `800f4a074` (the earlier source checkpoint was `947625c56`). Epoch 9 was loaded and hashed independently before either commit; do not treat either commit as the epoch-9 runtime. Service capture: `/tmp/tsps-728/native/service-epoch9.json` and `/tmp/tsps-728/native/loaded-epoch9.jsonl`. The bots were disabled, the local world override was absent, and the MCP preflight found no players. The loaded service matched the saved candidate/plugin/test/review hashes for q006, q049, q094, q074 and q083.

### q094 — Recipe for Disaster (Mountain Dwarf rescue only)

- **Revision:** epoch-9 loaded/source plugin `6e67b885489c741fe03a0c7c56d6dc9e84b1a29b8d3cd40dd25dad3c04ff6ddd`; focused test `3db09b4e01cf516371d3ecb895185703bcfff118a8635340cab853bc4efe9934`; peer review `/tmp/tsps-728/reviews/q094-postowner.json` is reviewed with no findings at those hashes; One Small Favour dependency `8c964561c3540c827b5dab6fa21f968c3f5d69ee5bd3b5e46ad27b6f5227fcc6`; dialogue plugin/data/index `252da523e2030a046e29ba6b31a6eef76b0aa762b69a4d30eeaf49b96e54c723` / `7b59699785ae53a974656b5431ae4aee375f9f311045c21c95a6baab4b298237` / `e1bd3116b4901ab3873d648c193f4646436cca3c423f0ad01120182f3e51664f`.
- **Scoped natural route and result:** continuation of the prior stage-4 account, not a fresh run. From Falador the account naturally opened the observed double gate, crossed it, descended the Quest Helper White Wolf Mountain stairs, and spoke with Rohak. Four separate Asgoldian ale talks each consumed one ale; the later drunk/sober conversations deducted 100 coins and accepted the milk, flour, egg and bowl. Rohak made hot cake 7509; ordinary item use on the Mountain Dwarf with Ice gloves cooled it to 7510, then a second normal item use freed him. QP varp 101 increased 237→238; Cooking XP increased 13,045,551→13,046,551 and Slayer XP 13,214,431→13,215,431; the cooled cake was consumed and Ice gloves retained. Stage/rfd wire value remained 4. This proves only the Mountain Dwarf rescue action/reward, not the whole RFD route.
- **Current checkpoint and limits:** Aris's “Free the goblin generals” option was selected naturally, opening the goblin rescue route. The account then followed cache-backed normal walk segments north-west from Lumbridge, settling at `(3038,3391,0)` with stage 4 and QP 238 unchanged. It has not reached Goblin Village or spoken with the Goblin Cook/generals. Remaining rescues, finale, exact completion rewards, repeat/relog/offline save proof, postquest dialogue and overlay remain unverified. Evidence: `/tmp/tsps-728/native/jobs/q094-epoch9.raw.jsonl`, `/tmp/tsps-728/native/jobs/q094-epoch9.notes.log`, `/tmp/tsps-728/native/service-epoch9.json`.

### q006 — Big Chompy Bird Hunting (continuation checkpoint)

- **Revision:** epoch-9 loaded/source `1d22033d066ba1af26f833f3146da6e6a5f0bf50063bbac952822ff6ea6487a7`; focused test `f4bad7f8406e5731a82a9c5f12a561eb3b09c648df45aed7c5a16f02b8208205`; exact-hash peer review `/tmp/tsps-728/reviews/q006.json` passed.
- **Current state:** resumed the same saved stage-20 account; after the earlier Home Teleport continuation to `(3088,3250,0)`, it is now progressing on ordinary cache-backed waypoints at `(3007,3179,0)`. Stage 20 and QP 0 are unchanged. A planner no-path result beyond the earlier local map window remains unresolved; continue with a different natural route/transport rather than repeating that failed plan. No full quest completion claim. Evidence: `/tmp/tsps-728/native/jobs/q006-epoch9-travel-checkpoint.json`, `/tmp/tsps-728/native/jobs/q006-epoch9.raw.jsonl`, `/tmp/tsps-728/native/jobs/q006-epoch9.notes.log`.

### q049 — Getting Ahead (doorway checkpoint)

- **Revision:** epoch-9 loaded/source `bfb0851f889a94c136b15abc29cc471cecd4c536fee9fcea1ac051fbc2af058e`; focused test `e0472a034830bddd51a57bc970cc92d2de6b6da998eb3abe61382091576656ed`; peer review `/tmp/tsps-728/reviews/q049.json` has two nonblocking findings (dead stage-6 legacy recovery branch and duplicate overnight closing prose).
- **Current state:** saved stage 2 remains at the farmhouse door `(1237,3683,0)`. A natural Open click on object 24369 from its threshold left it unchanged. Cache inspection identifies it as `canafis_door_ground`, with a reverse-ID open form 24368; the epoch-9 generic door catalog did not pair it. Root has since committed the generic reverse-ID catalog fix in source commit `800f4a074`, backed by a 52/52 door suite, but that fix was not loaded in epoch 9. Keep the account at the threshold for the next captured epoch; prove the normal click, swing and entry there before attributing route resolution to the catalog change. No full quest completion claim. Evidence: `/tmp/tsps-728/native/jobs/q049-epoch9.raw.jsonl`, `/tmp/tsps-728/native/jobs/q049-epoch9.notes.log`.

### q074 and q083 — epoch-9 reviewed candidates, native recheck pending

- q074 source/loaded candidate `c3d1a7e61649e8a65c8259ced55ad63adf67a6d5126a75be8d07fd255a0d9954`, test `cfaa09d11e3bbfeb2c6c33aa1c74aeead5e01bbfb0b43727715835b4f4e37cfb`, peer review `/tmp/tsps-728/reviews/q074.json` passed. Its earlier accepted route remains historical at the earlier hash. The revised full-bag dual-wood handover recovery leg still needs targeted natural recheck; do not replay unchanged route prefixes unless needed.
- q083 source/loaded candidate `e676c31901497997f2699914693971e222380d017a2c3a9595e9d882f2cb15de`, test `5d79a810585493a4c21af2807343508d7f3a94cb7d9e2b9ced52215429e1c142`, peer review `/tmp/tsps-728/reviews/q083.json` passed. Theatre of Blood rewards, entry data and tests matched the epoch capture. No fresh native route has started; unsupported Sinhaza shroud tiers and peer-noted key/flail recovery boundaries remain unverified natively.

## Evidence and revalidation policy

### Provider checkpoint — 22 October 2026

OpenCode workers stopped after MiniMax Free returned HTTP 410 (model retired).
Read-only probes of DeepSeek V4.1 Flash Free, GLM 5.3 Flash Free and Mimo v2.6
Flash Free returned `free_tier_limit`; none supplied a successful replacement.
No paid fallback was used. q006, q049 and q094 were logged out normally and
confirmed offline; preserve their existing saves and baselines on resumption.
Their last recorded tiles were `(2912,3327,0)`, `(1245,3682,0)` and
`(2945,3368,0)` respectively. q049 is Getting Ahead; q094 is Recipe for Disaster.
These are interrupted attempts, not failed quests or completed proofs.
The detailed source/loaded hashes and log references are retained in
`/tmp/tsps-728/native/jobs/provider-quota-checkpoint.json`; the prepared next-epoch
queue also includes q074 and q083 at their newer reviewed revisions. Earlier
accepted q003/q074 results above remain historical evidence; changes to their
plugins require checking the affected claims against the new loaded revisions.

- A completion is counted only when the native report, actual loaded plugin hash, reward/state deltas, persistence evidence, normal offline boundary, and independent/root acceptance agree. A source report/test or review by itself is not native evidence.
- Retain each historical result against its recorded source/test/loaded hashes. When a quest plugin changes, mark only claims depending on that plugin as requiring recheck; a changed unrelated plugin does not invalidate the whole ledger. Shared-core or data changes require targeted revalidation of affected routes/claims, not an automatic replay of every unchanged quest prefix.
- Prefixes resumed across epochs remain one checkpoint-linked route with provenance. Supplemental routes, post-quest checks and retries never increment the whole-quest count.
- `PASS` for a scoped contract means only that scope. Do not infer untested branches, overlay visibility, timing, full-bag behavior or recovery from a different branch.
- The historical reconciliation inventory found four accepted natural main-route proofs and five original-128 completion observations before the q063 epoch-8 continuation recorded above. The q129 tutorial result is additional and outside the original 128. See `/tmp/tsps-728/native/history-reconciliation.md` for the inventory cross-check.
