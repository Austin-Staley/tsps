# Vardorvis perfect-kill loot

**Goal:** Award the source-stated perfect-kill quantities from actual Vardorvis fight outcomes, with a complete canonical import and regressions for existing reward handlers.

**Sources:** [Vardorvis](https://oldschool.runescape.wiki/w/Vardorvis) and [Perfect Vardorvis](https://oldschool.runescape.wiki/w/Perfect_Vardorvis). Avoidable damage means off-prayer melee and special-attack damage; protected melee chip does not invalidate perfection. The perfect-kill standard-table bonus is 50%, using exact exported quantities.

**Ownership:** Isolated Codex branch `fix/vardorvis-perfect-loot`, slot 1. Claude owns Treasure Trails, NPC Indicators and the current normal-game deployment. No changes to client code, PluginManager/PluginTypes, accounts, saves or main deployment.

- [x] Prove missing fight context and establish an upstream-based consumer branch.
- [x] Add failing queue, quantity, fight and reward-ownership regressions before implementation.
- [x] Observe actual HP loss before Redemption; cancelled hits do not report damage.
- [x] Capture the same melee protection state as the damage roll; track special damage and freeze the grade at lethal boss damage.
- [x] Answer the drop-context query only for the current fight, exact boss and killer.
- [x] Regenerate canonical source twice, compare bytes, and import its complete output without JSON patches.
- [x] Preserve Nex bundles and existing quest/Mimic reward ownership; keep pre-roll odds executable and exact.
- [ ] Finish the final full-suite run and publish the reviewed PR.

## Canonical import contract

Exporter branch: `RSPSApp/osrsreboxed-db`, `fix/drop-quantity-context`, based on upstream master `41cecd6f`.

The complete export retains 3,092 NPC mappings and 1,112 table identities. It carries 116 quantity-alternative rows: 99 perfect-kill, two bounty, three preferred-method and 12 with an unknown distribution. The consumer reports its uniform-choice assumption for the latter at load; missing gameplay condition producers remain false.

Source-declared dropped-together pairs are preserved. The exporter also serializes 114 pre-roll denominators across 66 tables, preserving exact source fractions instead of rounding decimal denominators. Overall, 87 tables differ from TSPS's older import. This is a full canonical artifact import, not a Vardorvis-only JSON edit.

Existing cross-repository differences are retained and covered: Amoxliatl quest variant 13686 and Vorkath quest variants 8058/8060 retain empty table lists, generated from their explicit Post-quest drop-version selectors; Mimic NPC tables contain the plank while the existing arena/casket handler owns rewards; Bandit champion retains its conditional rows while The Feud's death handler owns the exclusive reward. A per-kill `handledItemIds` set prevents duplicate loot independently of hook order. Other quest-drop paths are untouched.

Both complete release runs have SHA-256 `5fe1ca11fde74497fb3f6b0a50fa30fe00a60d3f3245619fed1ef8cf9fd4aa8f` for `npc-drops.json`. Subtables and unresolved items are unchanged. The imported bytes match that hash exactly.

## Verification

Independent review caught and resolved a prayer-snapshot mismatch and canonical bundle eligibility/adjacency problems. Real cached NPC lethal damage verifies that the grade freezes before delayed loot. Canonical Coal resolves to 195 for a perfect kill and 130 otherwise. Tests cover specials, bleeds, zero/cancelled/immune damage, successive fights, quest ownership in both hook orders, Mimic payouts and the occult pre-roll boundary.