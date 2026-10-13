# Giants' Foundry

Kovac's sword-smithing minigame in the cave under the Giants' Plateau. Sleeping Giants unlocks it. Behaviour follows the OSRS Wiki for XP, reputation and rates; ids, messages, animations, sounds, varbits and tick timing come from live rsprox captures and the rev 241 cache. It is one plugin, `server/plugins/minigames/GiantsFoundry.plugin.js`, which delegates to one unit per station in `server/plugins/minigames/giantsfoundry/`.

All four recordings with foundry play were made on Leagues V worlds (rev 227): 96, 100, 101 and 565. Recording 96 also holds a full Sleeping Giants playthrough. Their rules may differ from the main game, so the numbers the Wiki gives (XP, reputation, rates) win over them.

## Layout

| File | What it owns |
| --- | --- |
| `Shared.GiantsFoundry.js` | Ids, varbits, the player's varbit-backed state, helpers, and the per-tick hooks the stations use. |
| `State.GiantsFoundry.js` | Persistence and the login sync of every foundry varbit. |
| `Area.GiantsFoundry.js` | The cave as an Area: the room's machinery, per-tick work, storing the preform on leaving. |
| `Preform.GiantsFoundry.js` | Wearing the preform, the HUD, the preform storage. |

**Changes outside the plugin:**
- **Kovac** is `kovac_multi` (11560) in `npc-spawns.json`, at the captured tile (3369, 11486) facing north-west. The cache resolves it from varbit 13902: 11470 (Talk-to only) until the quest reads 30, then 11472 with Hand-in, Commission and Shop.
- **Sleeping Giants** now completes at stage 30, the live value. Saves completed at the old 13 move to 30 at login. The quest no longer spawns its own foundry Kovac (11468).

## Cache

The client draws everything from varbits; the server keeps them right.

**Varps**
- 3429-3433: the varbits below.
- 3435: shop selection.
- 3436: Foundry Reputation.

**Varbits**

| Varbit | Name | Values |
| --- | --- | --- |
| 13902 | `sleeping_giants` | quest stage, 30 = complete |
| 13903 | `sleeping_giants_tutorial` | 0-65 in fives |
| 13907, 13908 | commission words | enum 4372: 1 Narrow, 2 Light, 3 Flat, 4 Broad, 5 Heavy, 6 Spiked |
| 13909 | mould tab | 0 forte, 1 blade, 2 tip |
| 13910-13912 | selected forte / blade / tip | index into enums 4373 / 4374 / 4375 |
| 13913 | alloy difficulty | the poured metal's score |
| 13914 | jig state (multiloc 44777) | 0 empty, 1 set, 2 poured, 3 cooled |
| 13916-13930 | bought moulds | one per mould |
| 13931-13936 | metal counts | bronze to rune |
| 13937 | crucible state (multiloc 44776) | 0 empty, 1 partial, 2 full |
| 13938, 13939, 13950 | preform difficulty, quality, start quality | |
| 13940-13945 | stage seeds 1-6 | 0 hammer, 1 grind, 2 polish |
| 13947 | preform stored (multiloc 44778) | |
| 13948, 13949 | temperature, completion | 0-1000 |
| 13957 | collection log completed | |

**Interfaces and scripts**
- HUD 754, mould setup 718, reward shop 753.
- 6119: difficulty → stage count.
  - below 20: 3 stages
  - 20-59: 4
  - 60-89: 5
  - 90-119: 6
  - 120 and up: 7
- 6121: each tool's heat zone. It is centred on 832 (hammer), 499 (grind) and 166 (polish), with width `333 - difficulty * 167 / 130`.
- 6122 `giants_foundry_hud_set_sweetspot`: 1 gold, 2 green, 0 clears.

**Enums and structs**
- Mould parts: enums 4373-4375 point to structs.
  - Param 1621 is the name and 1622 the level.
  - Params 1625 / 1626 / 1627 are signed stats on the Broad−Narrow, Heavy−Light and Spiked−Flat axes.
- Shop list: enum 4379 points to structs.
  - Param 1636 is the item, 1637 the mould and 1638 the cost.

**Room locs** (`dump:loc`)

| Loc | Id | Tile |
| --- | --- | --- |
| trip hammer | 44619 | (3363, 11496) |
| grindstone | 44620 | (3361, 11491) |
| polishing wheel | 44621 | (3362, 11484) |
| lava pool | 44631 | (3372, 11497) |
| waterfall | 44632 | (3357, 11488) |
| bank chest | 44630 | (3375, 11493) |
| crucible multiloc | 44776 | (3373, 11488) |
| mould jig multiloc | 44777 | (3370, 11488) |
| preform storage multiloc | 44778 | (3369, 11501) |
| quest crate multiloc | 44779 | (3370, 11483) |

## Captured behaviour

**The room**
- Everyone inside hears area sounds 5602 at (3364, 11485) and 5600 at (3363, 11492) every second tick.
- Every fifth tick, sound 5603 plays at (3367, 11497) and `giants_foundry_hammer01` (9446) plays on the trip hammer and its belt system (44763).
- The loc animations that appear around each station are all this one loop.

**Login** re-sends every foundry varbit and varp 3436, wherever the player logs in. The state persists: a stored preform keeps its temperature between sessions.

**Preform storage** (recording 101)
- Store-preform:
  - plays `human_furnace` (899);
  - says "<col=229628>You place the preform in the handy storage area. It should stay nice and warm there.";
  - removes the worn preform and sets 13947 to 1;
  - resets the combat tab header and closes the HUD.
- Take-preform does the reverse, with "You take the preform from the handy storage area. It will start to get cold now."

**Picking up the preform** (recording 565)
- The jig goes 1→2 on pouring and 2→3 two ticks later.
- On pickup:
  - "Your Ice gloves cool the preform as you reach for it.";
  - preform difficulty, quality and start quality are set;
  - seeds 1-6 are set, temperature becomes about 990, and alloy difficulty and the selected parts clear;
  - the jig returns to 0;
  - the preform is worn in the weapon slot, synth 1051 plays, and the combat tab header becomes "Preform" ("Category: Unarmed");
  - HUD 754 opens in the overlay slot.

## Not captured

- The refusal when the preform is unequipped anywhere but the storage: it is refused silently.
- Store-preform with no preform worn, and Take-preform with nothing stored: placeholder messages.
