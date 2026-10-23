# Vardorvis perfect-kill drop context

**Goal:** Connect the existing perfect-kill quantity selector to a correctly graded Vardorvis fight without changing canonical drop data or Claude's clue/client work.

**Source:** OSRS Wiki Vardorvis and Perfect Vardorvis: a perfect kill grants50% more standard-table loot; avoidable damage includes melee off prayer and damage from special attacks. Protected melee chip damage is excluded. Canonical table already distinguishes base/perfect quantities.

**Current evidence:** NpcDrops emits `npc-drops:context` with a defaultfalse `perfectKill`; there are no listeners. Conditional quantity tests prove manually supplied context chooses the larger row but do not establish fight-to-loot integration. Vardorvis implements an isolated fight and attack units; no perfection tracker is present. Sailing bounty tasks are explicitly not takeable yet, so that context must not be fabricated.

The user additionally supplied the maintainer's https://rsps.app/progress backlog. Its public JSON feed dated2026-10-22 explicitly lists Vardorvis perfect kills under The Forgotten Four as remaining work. The listed concatenated-quantity bug is already repaired in the current local data; do not repeat that fix. Fresh baseline compilation and all10conditional-quantity tests pass on this Codex branch. Current work is the missing fight-context connection, not changing the already canonical base/perfect values.

**Ownership:** Codex checkout `tsps-offline-fix-mime`, branch `fix/drop-context-producers`. Do not modify main, Claude-owned clue/plugin directories, PluginManager/PluginTypes, generated JSON, installed client, saves or deployment metadata.

- [x] Establish isolated base and inspect the existing quantity consumer and fight/loot lifecycle.
- [x] Pin death and loot ordering; determine when resolved damage is known and how it is attributed. Preserve post-death bleed behaviour without retroactively changing the completed kill grade.
- [x] Add failing regressions for flawless fight, protected chip damage, off-prayer melee, axe/dash/strangle damage, zero damage, stale fight, unrelated player/NPC and reset between kills.
- [x] Implement a fight-owned perfection ledger and a narrowly scoped custom-event answer. Keep mechanics in the Vardorvis plugin, not generic core content logic.
- [x] Verify real canonical base/perfect quantity outcomes through the event path; no manual context injection in the final integration regression.
- [ ] Build, run focused checks, review and commit. Broaden tests for meaningful integration risks; do not deploy while Claude owns the normal-game rollout.

This is the first bounded Codex task, not a claim that perfect-kill quantities, Sailing bounty tasks and Chasm preferred-method bonuses are all implemented.

## Verification and publication dependencies

Core observers report actual HP loss before Redemption. Ordinary melee captures the same prayer state as the damage roll; a prayer change during travel cannot relabel protected chip. Independent review found this mismatch and it was corrected with both-direction regressions. Real cached NPC lethal damage proves beforeDeath freezes the grade before the delayed loot event. Focused Vardorvis, combat, queue and achievement checks pass; final publication is pending canonical export and upstream-based packaging.

Upstream e7ff37b61 does not yet consume conditional quantities. A separate source/schema export is being built from osrsreboxed-db origin/master in osrsreboxed-db-drop-context; the old local export is not reused because it also contains unrelated mapping/table changes. TSPS consumer prerequisite is isolated in tsps-offline-preplay on fix/upstream-conditional-drop-quantities, slot1. Vardorvis will be published separately on top of that prerequisite. No main-game deployment while Claude owns the rollout.
