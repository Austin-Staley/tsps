# Teleport tablets

Breaking a teleport tablet (a spell tablet such as Varrock teleport, Teleport to house, or Teleport to boat) uses the `TELE_TAB` teleport type (`server/src/main/typescript/elvarg/game/model/teleportation/TeleportType.ts`). The tablet plugins are `server/plugins/combat/SpellTeleports.plugin.js` and `server/plugins/skills/sailing/BoatTeleport.plugin.js`.

## What OSRS sends

Facts from a live OSRS capture (rsprox) of a player breaking a Varrock teleport tablet (inventory slot 14). Tick 0 is the tick of the click (`if_buttonx` on `inventory:items`, op 2):

| Tick | Sent |
| --- | --- |
| 0 | varbit `busy` (12393) = 1; animation `poh_smash_magic_tablet` (4069) with delay 16; `synth_sound` 965 with delay 15 |
| 2 | spotanim `poh_absorb_tablet_magic` (678); animation `poh_absorb_tablet_teleport` (4071); the tablet leaves its inventory slot |
| 4 | varbit `busy` = 0; the teleport (to 3212, 3423); animation reset (-1) |
| 5 | animation reset (-1) again |

There is no teleport sound of the player's own: a `sound_area` 200 on tick 1 of the capture is at another tile (a nearby player's teleport).

## Implementation

- `TELE_TAB` plays 4069 (delay 16) on the click with sound 965 (delay 15), then 4071 and spotanim 678 as its middle step, lands with the reset animation and resets again the tick after.
- `TeleportTypeOptions` carries what only some teleports do: their own sound instead of the spell teleport sound, the `busy` varbit, and the repeated end animation.
- `TeleportHandler.teleport` takes an `onMiddle` callback; the tablet plugins use it to remove the tablet on tick 2. The usual checks (Wilderness level, teleblock, busy) still run before anything happens, so a refused tablet is never used up.
- `TeleportTask` runs step 0 when the click is handled and step n on the click's tick + n: `World.process` runs the task pass before it handles packets, so the click's own tick has no task pass left. `TELE_TAB`'s start tick is 4 so that it lands on tick 4, with the absorb (start tick - 2) on tick 2; `NORMAL` (3) and `TELE_SCROLL` (3) land on tick 3 as their captures do. Checked on a running server: Break on tick 12, tablet used up on 14, landing on 16. The tests model this order (the click after tick 0's task pass). Other teleport types are unchanged until a capture of them shows their timing.
- Before this, the tests modelled a click handled before the task pass, which the real loop never does, so tablets were absorbed and landed a tick late: in the client, a tick of nothing between the throw and the absorb (the throw's delay of 16 cycles plus its 880 ms ends exactly on tick 2 in OSRS).
- Every teleport type frees the player on the landing tick (movement, untargetable, click delay), as the capture's `busy` = 0 on tick 4 shows; it used to hold them two more ticks. The release comes before the arrival callback, so a plugin can still hold the player there (boarding a boat, entering a house).
- `server/tests/teleport-tablets.test.cjs` runs a tablet teleport through the real task manager and checks each tick against the table above.

## Which tablets go where

`server/plugins/combat/data/teleport-tablets.json` holds what the spells don't:

- **Spell tablets** land where their spell does, from the standard, Lunar and Arceuus spell tables. The Ape Atoll tablet (`teletab_ape`) is the Arceuus one, so it goes to the Ape Atoll Dungeon, not the town.
- **Redirected house tablets** (`redirects`) land at that town's house portal; Trollheim's lands where the Trollheim spell does. Revert turns one back into a Teleport to house tablet; the scroll of redirection isn't returned (Wiki).
- **Varrock, Camelot and Watchtower** (`alternates`) have their own options: the town, its alternate (Grand Exchange, Seers' Village, Yanille) and Toggle. The alternate and Toggle need the medium Varrock, hard Kandarin or hard Ardougne Diary (Wiki). Toggle makes Break go to the alternate and sets the varbit the spellbook reads for it (`varrock_ge_teleport`, `seers_camelot_teleport`, `yanille_teleport_location`; client script 2615 treats 1 as the alternate). The alternate tiles are the middles of the captured spell landings the portal nexus already uses (GE around 3162-3165, 3476-3480; Seers' 2724-2727, 3483-3486).
- **Teleport scrolls** (`scrolls`) use the scroll's Teleport option. Landing tiles come from captures where there are any (Lunar Isle, Pest Control, Iorwerth Camp, Mos Le'Harmless, Watson, Spider cave, Chasm of Fire) and from RuneLite's world map teleport data otherwise. Nardah keeps its tile beside the carpet merchant; its only capture is from a Leagues world.

## Teleport scrolls

Facts from rsprox captures of teleport scrolls (Spider cave, 20 attempts in 14 recordings, rev 237-238; the others agree). Tick 0 is the click:

| Tick | Sent |
| --- | --- |
| 0 | animation `teleport_scroll_open` (3864); map_anim `telescroll_teleport` (1039) on the player's tile; sound 200 (the spell teleport sound); the scroll leaves the inventory; varbit `busy` = 1 |
| 3 | the teleport; animation reset; varbit `busy` = 0 |
| 4 | animation reset again |

`TELE_SCROLL` plays these, with the map_anim sent as a spotanim on the player. The scroll is used up on the click, after the usual teleport checks.

## Not yet done

- The Ancient, Cemetery, Ice plateau and Wilderness crabs tablets' Configure option (the Wilderness warning).
- Volcanic mine and Guthixian temple teleports: no capture or RuneLite tile for their landing.
- Quest requirements for using a tablet (Desert Treasure for Ancient tablets, Lunar Diplomacy, Watchtower).
- The messages for a missing diary and for Toggle aren't captured; the text is ours.

## Not yet checked

The landing tile: the capture landed one tile from our fixed Varrock teleport destination (3213, 3424). OSRS may pick a random tile around the destination; one capture can't tell.
