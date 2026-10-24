# Complete the remaining normal encounter audit

Scope: Duke Sucellus, Leviathan and Whisperer; isolated server branches, individual reviewable PRs, followed by a combined local deployment preserving Claude's client and clues. Existing user authorization covers planning and implementation in the current mode.

## Ownership and sequence

1. Duke owner: `fix/duke-normal-fidelity`. Verify preparation, combat, records, achievements, rewards, death and re-entry against current Wiki, installed revision-241 cache and filtered original OSRS captures. Fix documented functional omissions before numeric fidelity work.
2. Leviathan owner: `fix/leviathan-normal-fidelity`. Same audit, including volley lengths, timing, terrain, pathfinder and restriction achievements.
3. Whisperer owner: `fix/whisperer-normal-fidelity`. Same audit, including special layouts, enrage, shadow management and every normal achievement.
4. Shared evidence/data owner: official RSProx decoder tooling and canonical DT2 reward generation. Keep raw captures private and untracked. Repair canonical source/parser, never generated JSON by hand.
5. Each owner writes failing behavioral regressions, implements fixes, builds and checks focused tests, then publishes source checkpoints. Review the complete changes rather than treating passing implementation-shaped tests as proof of OSRS fidelity.
6. Integrate into a separate staging checkout based on fresh local main. Run combined checks and a real client smoke on staging ports. Compare the entire client tree and served build with Claude's newest baseline. Gracefully save, back up and install only after checks; never force-stop or overwrite another worktree.

## Duke gap ledger at audit start

| Area | Evidence / required work |
| --- | --- |
| Powder feeding | July 2025 powder pages explicitly allow left-click Feed; currently only poison is selected. Add inventory fallback and bounded feed behavior. |
| Automatic grinding | Powder creation pages specify immediate, then 2, then 3 ticks; currently one mushroom only. Use a player-keyed cancellable action, preserving atomic inventory checks. |
| Vats and yields | Six-tick fermentation and existing level yield equations corroborated by current item pages; retain with boundary/interrupt tests. |
| Combat and preparation timings | Capture audit needed for wake, projectile impacts, vents, eyes, icefall and respawn. Existing provisional numbers are not evidence. |
| Effects | Check native icefall warning/effect, gas launch, eye transitions and HUD against cache/capture. Do not substitute unrelated effects and claim parity. |
| Defences | Verify protected magic and gas-mask bounds; Ward behavior, demonbane vulnerability, first-hit behavior and accuracy. |
| Records | Cache scoreboard is Read but currently has no handler. Verify native interface and implement appropriate records. |
| Lifecycle | Re-entry, task cancellation, owner restrictions, supply retention/removal, death fees and late hits. |
| Achievements | Existing Cold Feet/Mirror Image/speeds/perfect must remain source-correct; audit Slayer last-kill ordering and preparation/corpse boundaries. |
| Loot | Shared normal DT2 priority pool, hidden three-roll vestige, first-only tablet and first-quartz rules are missing in generated/runtime handling. Fix through canonical pipeline and persisted gameplay state. |

## Completion evidence

Every resolved finding must link behavior to primary evidence and regression coverage. Keep unresolved exact parameters explicit while investigating; do not call normal modes complete merely because a bounded patch or unit suite passes. PRs must state dependency and validation results accurately. Local deployment metadata records actual commits, canonical artifact hashes, backup and preserved client build.
