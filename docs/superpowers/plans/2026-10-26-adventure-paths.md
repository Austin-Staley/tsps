# Adventure Paths Implementation Plan

> Execute inline using superpowers:executing-plans; independent Codex review before every PR.

**Goal:** Implement current-cache Combat/Gatherer Adventure Paths end to end.
**Architecture:** Plugin-first cachecatalogue, canonical persisted progress/claims, native interfaces, shared dialogue/reward services.
**Tech Stack:** Existing JSplugins, TSserver, cache241, node:test and worktreeMCP.
**Spec:** ../specs/2026-10-26-adventure-paths-design.md

## Global constraints

- Ownworktree only; no generatedJSON or Claude/live edits.
- Wiki for behaviour, cache forIDs/layout; recording absence disclosed.
- Named handlers/members split according toF2Pcontent; no perplayer polling.
- Real-object/native-input tests, independentreview, separatePR, ownservicesstopped.

## Review focus

- Boosted/drainedstats cannot fake orerase baselevelmilestones.
- F2P claim must retain laterP2Pentitlement and neverdoublegrant either component.
- Full inventory/stackcaps/metadata/staleNPCstate cannot consume entitlement orduplicate reward.
- Logout/reload restores progress andsettings; replacedmodals cannot execute savedcallbacks.
- New/returning eligibility excludes experienced/ironman; no invented A/B variants.

### Task1: Canonical data/eligibility and milestones

- [x] Decode cachepath/task/rewardenums andbitmapping; saveevidence.
- [x] Add failing realobject tests for eligibility/18milestones/relog/baselevels.
- [x] Implement focused Data/Progress units andnamedhooks; runRED/GREEN.

### Task2: Native Jon UI and atomic rewardclaims

- [x] Add failing tests for actualNPC/nativeUIclicks, task/path rewards, memberclaims andcapacities.
- [x] Implement641-era current642/643/644 wiring fromCS2, rewardplans, staleguards, tutorquery.
- [x] Verify nativeUI/render/cacheVM andallrewardrows.

### Task3: Kits, voucher andlamp

- [x] Verify Wiki contents/redemptionpages/cache andgenerateddialogueconditions.
- [x] Add real tests for singleuse kitcontents, voucherNPCpartial/memberclaims andlamp150XPchoices.
- [x] Implement exactslot sharedservice flows; rechecklatecallbacks.

### Task4: Ship

- [ ] Final exact-source full suite (build, focused tests, native walkthrough and client VM have passed).
- [x] IndependentCodex review, fix/retest anddescribe limitations accurately.
- [ ] Commit, push fork, open ready PR, attach and update coordination. Owned QA servers are stopped.
