# Whisperer Implementation Plan

**Goal:** A playable isolated post-quest normal Whisperer encounter using existing plugin APIs.
**Architecture:** A PrivateArea owns both cathedral mirrors and one session; session cleanup owns all actors, effects and timers. Fight owns attack and special state, while Common contains cache-derived IDs and damage helpers. The DT2 quest remains untouched.
**Tech Stack:** CommonJS plugins, TypeScript combat core, Node test runner, real rev241 cache.
**Dependency:** PR #882 (`fix/vardorvis-perfect-loot`) supplies actual-damage observers and the conditional-drop consumer; merged locally before implementation. Do not duplicate those foundations.

## Design and constraints

Entry requires completed `desert_treasure_ii` and a blackstone fragment. The public normal spawn becomes the cache Odd Figure; disturbing it creates a player-owned encounter. The private area includes both real map mirrors, restricts combat to its owner and actors, and restores outside location/UI on exit, teleport, death and logout. Graves use the Camdozaal rope location through the existing event.

Normal stats: 900 HP; specials at 720/495/270; 140 HP enrage. Triple projectiles use same/mixed/alternating patterns after special completion. Impact-time protection prevents damage; actual damage invalidates perfect loot. Tentacles move toward their captured tile and test their path each tick. Specials include light/dark seeds, three directional column screeches, twelve attackable souls in four reward sets. Specials retain damage reduction. Post-special binding can be countered with a successful freeze; adjacency causes mirrored double melee damage. Shadow sanity/prayer drain and real-world regeneration run every four ticks; zero sanity starts lethal insanity. Normal death freezes eligibility, restores sanity, counts/PB, and respawns the Odd Figure in 30 ticks.

Sources: official OSRS Wiki `The_Whisperer`, `The_Whisperer/Strategies`, and rev241 cache gamevals/configs. Quest implementations are integration examples, not gameplay truth. Exact seed/column layouts and animation timing need source/capture confirmation before parity claims. Awakened will not be offered or consume an orb without complete verified mechanics. No generated data, core API, quest, client, or world-definition edits.

## Tasks

- [x] Write focused failing real-core tests for prayer-at-impact damage/perfect eligibility; tentacle movement; sanity; special success/failure; enrage interception; quest gate/cleanup and cache IDs.
- [x] Implement `Common.Whisperer.js`, `Fight.Whisperer.js`, `Specials.Whisperer.js`, `Site.Whisperer.js`, plugin entry and authored data.
- [x] Run mechanic tests red then green; inspect real actor/queue integration, cancellation, running seed traversal, blocked tentacle origins and canonical CA count restoration.
- [x] Build server with `node node_modules/typescript/bin/tsc --build`; run focused and existing combat checks; document failures and limits. Full sandbox suite 4962/4970; all eight failures passed targeted unsandboxed checks (11 selected tests including matching SQLite cases).
- [x] Own postquest public rope/teleporter actions in `Travel.Whisperer.js` because the existing quest transport is stage-only. Preserve quest state, land on verified clear adjacent tiles, persist only postquest discoveries, and restore them after the quest login sync. Freeze PB at lethal damage and guard repeat death delivery.
- [ ] Request independent review, fix findings, then create separate PR with dependency and verification evidence.

## Review focus

No stale callbacks after cleanup/death; no public/quest boss ownership interception; realm changes preserve actor targets and damage sources; prayer is sampled at impact; grading freezes before loot; no reward or orb consumed on failed entry.
