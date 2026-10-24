# Duke Sucellus implementation plan

Design: `docs/superpowers/specs/2026-10-24-duke-sucellus-design.md`. User explicitly authorized planning and implementation in the current mode; no repeated approval gate.

1. Record primary Wiki mechanics and cache IDs/actions; map the asylum from cache/quest coordinates. Resolve evidence gaps before exposing a mechanic.
2. Add failing NPC stat-immunity regressions; implement the generic instance flag, build, run existing special-attack/stat-drain tests, and commit the isolated foundation for the other boss branches.
3. Add failing grave discount/persistence/merge regressions; implement the optional existing-event response, retain legacy fees and Office behavior, verify and commit independently.
4. Add focused Duke model tests for preparation yield/capacity/fermentation/Feed, scheduler HP thresholds, hide geometry and applied-damage grade.
5. Implement authored data and modules from the design. Register only named scoped handlers; isolate the post-quest instance from quest progression.
6. Implement normal encounter entry through repeated-kill rewards and exit/relogin/death cleanup. Verify real cache/core and canonical loot integration.
7. Complete and verify awakened additions only with source-backed parameters; never consume an orb for an incomplete mode.
8. Independently review, correct findings, build and run the full server suite. Publish a ready individual Duke PR with sources, dependency PR882, validation and any material limitations.

Leviathan and Whisperer are owned by separate workers/worktrees. The God Wars publication audit is a fourth independent workstream. Do not edit their modules or Claude's active work.

## Completed normal-mode milestone

Steps 1–6 are implemented. Step 7 deliberately leaves awakened entry unavailable; source gaps are listed in `docs/duke-sucellus.md`, with no orb consumption. Step 8: encounter and canonical reward integration received separate independent reviews, review findings have red/green regressions, and the final build plus 27 Duke checks pass. The full-server run passed 4,959 of 4,967 checks; all eight unrelated sandbox failures passed whole-file reruns outside the sandbox (133 bot/network checks and 28 save checks). Final Duke review changes were followed by the fresh focused run. Ready PR publication follows the final incremental review.
