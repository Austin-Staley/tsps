# Whisperer normal fidelity audit and implementation

**Base:** `6ebb7ea24`, isolated `fix/whisperer-normal-fidelity`. Prior PRs #893/#896 are preserved dependencies. User explicitly authorized planning and implementation without another gate. Ownership is Whisperer modules, authored data, tests and docs only; no live/main/client/generated files or shared spell/decoder changes.

**Design:** Keep the owner/session architecture and actual-damage ledger. Replace provisional encounter parameters only with reproducible primary-source/cache/capture evidence. Shared RSProx decoding belongs to the source worker; retain derived anonymous facts and capture/world/revision hashes, never account headers. Event-world captures may establish behavior only after official event modifications and normal video evidence support the specific inference. Stats, damage and reward rates are never assumed equivalent.

## Audit and tasks

1. Read current Wiki mechanics, individual normal achievements, cache task descriptions and sequence/config IDs. Create an evidence matrix covering entry/knockback, attack timing/style/animations, tentacle paths, sanity, seeds/anchors/deadline, screech positions/health/phases, souls/positions/deadline, bind/fragment window, melee distribution/prayer, enrage/death/respawn and all normal achievements.
2. Implement missing normal achievement tracking with RED/GREEN real-core tests: cache speed names/strict limits 180/145/125 seconds and no Slayer task; Tentacular requires Arceuus throughout the fight; Dark Memories requires fewer than 10 pre-enrage Shadow Realm ticks; five perfect kills within one session. Keep generic kill-count ownership and frozen lethal PB time intact. Verify imperfect/interrupted/duplicate death and leave/reset boundaries.
3. Obtain ordered capture evidence and inspect original OSRS Wiki videos/diagrams. Cross-reference rev234 capture IDs against rev241 cache names. Derive exact seed/pillar/soul anchors, animation phase mapping, projectile/tentacle timings and fragment toggle window when evidence is sufficient. Add failing behavior tests before each sourced correction. Inspect normal video/official event rules before extrapolating an event-world mechanic.
4. Resolve normal melee roll/protection from primary observations or authoritative mechanics; do not replace provisional values with another guess. Audit other uncovered behaviors surfaced by captures and source pages. Track which facts are proven, contradicted or still require evidence.
5. Build and run focused Whisperer/core integration checks after each coherent checkpoint. Push checkpoints to the authorized fork. Obtain independent review at a frozen final hash, fix findings with regressions, publish a ready follow-up PR and send exact commits for root's separate local integration.

## Review focus

Sampling a spellbook only at kill time is insufficient; a changed-away-and-back fight must fail Tentacular. Enrage ticks cannot count toward Dark Memories. Speed thresholds are strict and must use lethal time rather than death animation time. Perfect-session tracking must reset on leave and cannot double-count repeated death. Capture-derived geometry/timings must identify event modifiers and retain an explicit evidence trail. Do not claim normal mode complete with provisional combat parameters.
