# Shared poison and venom protection clock audit

This records evidence for replacing the current wall-clock protection policy.
It is not a completed runtime correction or a claim that all antidotes match OSRS.

## Established counter contract

RuneLite's official [TimersAndBuffsPlugin](https://github.com/runelite/runelite/blob/9fad2c588ca957ae47d883b09544725a796ed9fe/runelite-client/src/main/java/net/runelite/client/plugins/timersandbuffs/TimersAndBuffsPlugin.java#L124),
pinned to commit `9fad2c588ca957ae47d883b09544725a796ed9fe`, interprets varp 102
using a 30-game-tick poison period and a venom cutoff of -38. Negative values
represent poison protection; values below -38 additionally represent venom
protection. The timer calculation preserves an already-known next poison tick
when the value changes before that deadline.

This is primary client observation code, not another private server. Its
separate item-stat duration tooltips are not treated as authoritative: the
project has an [open tooltip-duration report](https://github.com/runelite/runelite/issues/20333)
describing incorrect Antidote++ and Anti-venom ranges.

The [Poison](https://oldschool.runescape.wiki/w/Poison) and
[Venom](https://oldschool.runescape.wiki/w/Venom) Wiki pages separately describe
the protection tiers, venom-to-poison treatment, variable initial venom
protection windows and interface-held counter updates.

## Captured ordinary-world phase and modal behaviour

The reduced numeric fixture is
`server/tests/fixtures/poison-protection-clock-1637.json`. Its provenance records
the [public RSProx capture](https://rsprox.net/download/1637) hash, revision 226,
world flags 1, activity `-`, extraction-adapter hash and pinned RuneLite source
hash. No special-world activity is indicated. Only selected cure IDs, varp 102
and numeric interface transitions are retained; no account identities, chat,
appearance, unrelated inventory or raw packets are included.

| Tick | Observation |
| --- | --- |
| 4945 | Poison severity 20 appears. |
| 4975 | Severity becomes 19: the next ordinary pulse is due at 5005. |
| 4979 | Drink action on anti-venom+(4), cache item 12913. |
| 4980 | Protection becomes -50; that vessel becomes item 12915, the 3-dose form. |
| 5005 | Protection becomes -49, only 25 ticks after consumption. |
| 5147 | Protection becomes -45; the next pulse is due at 5177. |
| 5162 | A modal chatbox opens on parent 162:565. |
| 5177 | The chatbox remains modal; no protection decrement is sent. |
| 5184 | Protection becomes -44 in the same recorded tick that the modal closes. |

The first interval establishes phase preservation across treatment. A new
independent 30-tick countdown on the drink would instead update at 5010.
The later interval rules out pausing the entire fractional countdown when the
modal opens: that model would defer the next update to 5199. It also rules out
unconditionally decrementing while the modal remains open. The supported model
continues towards the deadline, holds an overdue pulse, then applies one pulse
when the modal ends. There is no evidence here for catching up multiple missed
pulses at once.

Other recorded intervals also stretch across modal dialogue. They must not be
used as unpaused timer durations. Permanent sidebar overlays are type 1; the
relevant chatbox transitions are type 0. The fixture preserves all selected
modal transitions in the observation window, including replacements, so the
continuous held interval can be checked without assuming that every open packet
starts a new pause.

## Reproduced local gap

The existing native staging harness has a `poison-clock-modal` mode. Against
the installed release `f87107ce42a8e79f4e5d4fb7c811a6d483c1d4b9`, an actual
anti-venom+ dose followed by an NPC dialogue changed varp 102 from -50 to -49
while the same modal remained open for 40 ticks. This contradicts the held-pulse
behaviour above. The separate QA world was saved and stopped; the user's live
world was not restarted or changed during this reproduction.

This also narrows the limitation of the earlier interface-pause correction:
`Player.getInterfaceId()` does not cover every modal chatbox, and a fractional
wall-clock pause is not the captured shared-counter policy.

## Required correction and verification

The first runtime correction extends the existing positive poison/venom
held-hit gate to `PacketSender.hasInterruptibleInterface()`, alongside the
legacy main-interface ID. This covers native chatbox replacements and tracked
type-0/type-3 modals, while leaving type-1 sidebar overlays out. Regression
tests use actual PacketSender mounting/closing methods and verify no burst,
the original short-dialogue deadline and the next 30-tick hit. This bounded
correction does **not** replace the negative protection countdown below.

Replace the independent protection stopwatch with a shared discrete poison
pulse that survives ordinary poison, venom conversion and protection renewal.
Keep the current counter and next-pulse remainder explicit. A modal may hold an
overdue pulse; it must not reset the phase, consume protection counters in the
background or release a burst on closing. Include modal dialogue, not permanent
sidebar overlays. Preserve registration/death/logout ownership rules and save
the phase needed to resume accurately.

Apply the negative-counter cutoff to venom protection instead of treating every
ordinary antipoison as a venom shield. Ordinary antipoison treatment of venom is
a downgrade, not a full cure. Keep full anti-venom treatment distinct, and do not
shorten stronger existing protection with a weaker dose. Use canonical item
chains for missing mixtures or upgraded potions rather than special-case IDs.

Short non-counter protection from charged serpentine equipment and restorative
food needs an explicit compatible policy. Do not turn a short refresh into a
full negative-counter tier or infer universal venom immunity from a nonzero
poison timer. Audit all existing callers before replacing their timer facade.

Verify the captured phase transitions with a meaningful regression, then cover
new/renewed doses, the -39/-38 boundary, modal open/replace/close, logout/load,
cure/conversion/death, real NPC venom application and current poison lifecycle
tests. Repeat native modal and actual dose checks on the combined candidate;
retain the existing backup, client and account-preservation installation gates.

Unverified points remain explicit: a missing historical phase in an old save
cannot be reconstructed; the capture does not prove every potion's initial
counter; and short equipment/food protection must be checked independently.
