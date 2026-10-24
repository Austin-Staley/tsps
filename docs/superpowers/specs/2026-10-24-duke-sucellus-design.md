# Duke Sucellus after Desert Treasure II

Implement a complete solo post-quest encounter using the existing plugin/templated-instance architecture. The quest's separate Sucellus instance, scripted progression and drops remain owned by the quest. Claude owns clues, client plugins and live deployment; this branch only owns Duke content, focused tests, authored boss configuration and the generic foundations below.

The user requested the three remaining Forgotten Four bosses in order, with individual tested PRs. Duke is first. Normal mode is the first complete milestone, including access, preparation hazards/resources, fermentation/feeding, combat, perfect-loot grading, death/exit cleanup, repeated kills and saved counts. Awakened mode may be offered only after all its additional hazards and immunity are implemented and tested; otherwise the orb must remain untouched and no fake awakened option is exposed.

## Sources and compatibility

- OSRS Wiki Duke Sucellus, Strategies, Perfect Duke Sucellus and the resource pages establish mechanics. Use the current post-June-2025 preparation rules: eight picks per mushroom patch, retained supplies between kills and Feed on the sleeping NPC.
- Cache gamevals and decoded NPC/item/object configs establish IDs, actions, animations and graphics. Local quest code can identify map coordinates but is not an OSRS behavior oracle.
- Shared dependency is TSPS PR882 (conditional quantities, per-kill context, applied-damage observers), whose branch is merged into this feature. Generated JSON is never patched by this feature.

## Content boundaries

- `DukeSucellus.plugin.js`: members-only attach-only registration.
- `dukesucellus/Common.DukeSucellus.js`: API/data references, scoped geometry and damage helpers.
- `dukesucellus/Site.DukeSucellus.js`: owner instance, quest gate, orb decision, login recovery, escape/leave/death hooks.
- `dukesucellus/Preparation.DukeSucellus.js`: item-safe gathering, grinding, brewing, Feed and preparation hazards.
- `dukesucellus/Fight.DukeSucellus.js`: deterministic attack schedule, chip/slam/projectile/gaze/gas, enrage, fight grade, death/respawn and saved statistics.
- `bosses/data/duke-sucellus.json`: authored cache IDs, source coordinates, timings and source-backed parameters.
- Focused tests exercise actual core hit queues/cache definitions and production event handlers, not just source text.

## Generic foundations

All three awakened bosses need per-NPC stat-drain immunity. Add an instance-scoped boolean setter at NPC's existing combat-level setter, restoring already drained values when enabled. No boss names, IDs or quest logic enter core; normal NPC drains remain unchanged.

All three strategies describe novice grave-fee reduction. Extend the existing grave-location response with an optional validated `feeMultiplier`, persist it on the grave and apply it only to gravestone fees. Normal/legacy graves default to one; Death's Office fees remain unchanged. Merging graves retains the greater multiplier so repeated deaths cannot move normal-fee items into a discounted grave. Document this conservative merge policy rather than implying capture-confirmed behavior for that edge case.

## Required behavior and evidence

Normal combat uses 485 HP, 5-tick attacks, 4 ticks below 25%, delayed melee icicles/slam, impact-time magic damage, fifth-auto gaze with a five-tick hide window, and HP-dependent gas count/cadence. Preparation damage invalidates perfection; protected or unprotected chip is unavoidable, while an applied standard magic hit invalidates even at zero. Every queued effect is scoped to its instance and fight, and cancellation/exit cannot consume more resources or damage another encounter.

The preparation meter requires two poisons in normal mode, six of each ingredient per vat and six ticks fermentation. Supplies persist across kills but are destroyed on leaving. Extra Feed clicks cannot consume poison after waking. Gather/brew/collect operations must preserve inputs or finished products when inventory capacity prevents the result.

Freeze the grade synchronously at lethal boss damage, answer `npc-drops:context` only for the exact current boss/killer, and use the canonical roller for loot. Show counts/time, persist normal/awakened records separately and reset the room for another attempt. Award combat achievements only from facts actually tracked.

## Verification and publication

Record red/green tests, validate all configured IDs against the installed cache, exercise repeated kills and cleanup, build TypeScript, run focused encounter/regression checks and the full server suite at bounded concurrency. Obtain independent review before publishing a ready PR. Push source periodically. No normal-world restart or save changes are part of this task.
