# Poison and venom task lifecycle

24 October 2026 audit of the progress tracker's Status effects task 4.

The authoritative logout calls `TaskManager.cancelTasks(player)` before taking
the save snapshot. `CombatPoisonEffect.stop()` currently clears the affliction,
so logout saves a cured player. Loading an existing poisoned save restores the
fields but `Player.onLogin()` does not restart their damage task. The task also
does not reject a registered actor already at zero HP.

Plan: first reproduce these paths through real Player logout, PlayerSave loading,
and the poison task. Separate stopping a scheduled callback from curing the
affliction, give each actor one current poison-task owner, and resume that owner
after login. Explicit cure, immunity, death and natural expiry must still clear
the affliction; stale/replaced or unregistered tasks must not damage or erase it.
Keep save schema and existing poison/venom progression unchanged. Do not import
the separately published NPC-immunity or cadence changes into this PR.

Independent review also found `State.PlayerBots.resetMovementState` cancelling
all player-keyed tasks while the player remains registered. The status task must
therefore own a distinct key and be explicitly suspended at logout; otherwise
separating cancellation from cure would leave a poisoned bot without damage.
Reproduce this cancellation before changing task ownership. Ordinary activity
cancellation must retain both affliction and its existing countdown.

Primary rules: [Poison](https://oldschool.runescape.wiki/w/Poison) and
[Venom](https://oldschool.runescape.wiki/w/Venom), retrieved 24 October 2026.
The tracker explicitly requires persisted affliction and orb state across relog
and no delayed status damage after departure/death. This change preserves the
existing saved severity contract; it does not infer a new logout damage reset or
claim to recover the exact residual timer phase from public evidence.

Four lifecycle regressions and the activity-cancellation regression were observed
failing before their respective corrections. Fresh TypeScript build, 56 focused
checks and all 4,925 server tests pass, with no failures or skips. Independent
review cleared the complete delta, including the private task key and explicit
logout suspension.

An isolated slot-24 server also verified actual headless login/logout, SQLite
saves, and the damage loop through the existing owner-only `poisonme` command.
Ordinary poison orb severity 30 survived logout/login and became 29 after the
restored task's next hit. A debug-applied venom orb of 1,000,003 survived relog and
became 1,000,004 after its next hit. The latter starts at the debug command's
12-damage test severity; it does not change normal venom application rules.
The QA server saved and stopped cleanly. Live installation is separate and must
preserve the latest main and Claude client assets.
