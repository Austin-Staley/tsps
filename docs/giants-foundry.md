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
| `Kovac.GiantsFoundry.js` | Commissions; Talk-to's commission conditions and `[sword style]` blanks. |
| `Mould.GiantsFoundry.js` | The mould jig and its setup interface (718); the mould score. |
| `Crucible.GiantsFoundry.js` | Filling (Fill menu, item-on), Check, Empty, Pour; the metal score. |
| `data/giants-foundry.json` | Crucible metals (tier, smelting level) and what smithed equipment is worth. |

**Changes outside the plugin:**
- **Kovac** is `kovac_multi` (11560) in `npc-spawns.json`, at the captured tile (3369, 11486) facing north-west. The cache resolves it from varbit 13902: 11470 (Talk-to only) until the quest reads 30, then 11472 with Hand-in, Commission and Shop.
- **`npc-dialogues.json`**: "Transcript:Kovac"'s plain "I'm not sure what something does." option is now conditioned on having no commission (id `Gf7nCm`). The live menu with a commission shows only the ", can you help me?" form (recording 565).
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

**Commissions** (all four recordings)
- Commission (op4) sets 13907/13908 on the click's tick, then Kovac says "Make <col=ef1020>Light Spiked</col> sword.".
- The first word is Broad, Narrow, Heavy or Light; the second is Heavy, Light, Flat or Spiked; they never share an axis. That gives twelve pairs, eleven of them seen.
- With a commission, Commission answers "Kovac give commission already. Go make me … sword." (Wiki transcript).

**Mould setup** (all four recordings)
- The jig's Setup:
  - opens 718 in the main modal after `toplevel_mainmodal_open [-1, -3]`;
  - sets OP1 events on side_menu (0-63) and content (0-544).
- A side_menu click is tab `sub / 9`; a content click is part `sub / 17 + 1`. Each is answered with its varbit on the same tick.
- The list is in enum order (script 6096 does not sort it).
- Picks are checked as script 6100 does: the mould is bought (script 6099's varbit, for the five highest struct ids of each kind) and the player's Smithing level is at least param 1622.
- Set: mould_state 0→1, and 718 closes. Without a commission, a message box says "You need a commission before you can set up the mould." (recording 96).
- Score (script 6105):
  - Each part scores, for each commission word, the size of its stat on that word's end of the axis.
  - Example (recording 565): Spiker! + Choppa! + Serrated Tip for Light Spiked score 22 + 22 + 16 + 4 = 64. With the alloy's 20, that gives the captured start quality 84.

**The crucible** (recordings 96 and 565)
- Fill opens the make-x menu "What metal would you like to add?" with the six bars; its quantity cap is the space left.
- A bar the player doesn't hold gets an item box: "You have no Bronze bars to add to the crucible.".
- Item-on asks "How many would you like to add?" with 1, 5, X and All (one item: no question).
- Then the player pulls the lever (4909, synth 2725). Three ticks later:
  - the metal count and crucible state change;
  - an item box says "You add 6 Iron bars to the crucible." or, for equipment, "You add 7 Bronze platelegss to the crucible,<br>worth 14 Bronze bars.". Live adds an "s" to the item name even when it already ends in one.
- When the metal would overflow, it asks first ("No./Yes."): "Adding this item will overflow the crucible. You will lose 12 bars worth of Steel. Are you sure you want to add it?".
- After the box:
  - if the crucible is full, a message box says "The crucible is now full of molten metal, it is ready to be poured into the mould jig.";
  - otherwise the game message "You need to add 10 more metal bars worth of material to pour the crucible into the mould jig.".
- Pour:
  - The player pushes (810, synth 5605) and the crucible plays 9447.
  - The next tick sets alloy difficulty (13913) to the metal score.
  - Six ticks after the push, the jig goes 1→2, the counts clear and the crucible empties.
  - Without a set-up jig, the player says "I'll need to set the mould up before pouring metal into it."
- Metal score (Wiki):
  - Vₙ = 10·tier·amount/28 for the two most common metals, ties going to the better metal.
  - Score = ⌊(⌊10V₁⌋ + ⌊10V₂⌋ + ⌊V₁V₂⌋)/10⌋.
  - 14 bronze + 14 iron score 20, as captured.

**Picking up the preform** (recording 565)
- The jig goes 1→2 on pouring and 2→3 two ticks later.
- On pickup:
  - "Your Ice gloves cool the preform as you reach for it.";
  - preform difficulty, quality and start quality are set;
  - seeds 1-6 are set, temperature becomes about 990, and alloy difficulty and the selected parts clear;
  - the jig returns to 0;
  - the preform is worn in the weapon slot, synth 1051 plays, and the combat tab header becomes "Preform" ("Category: Unarmed");
  - HUD 754 opens in the overlay slot.

**Stage seeds** (54 captured preforms)
- Stage 0 is always the trip hammer.
- Each later stage is one of the two tools that differ from the stage before it, chosen at random.
- Unused seeds are 0.

## Not captured

- The crucible's Check and Empty: Check reports its contents, and Empty asks before destroying them (Wiki: emptying loses the metal).
- Pouring while a preform is still to be handed in (the Wiki says it can't be done): a placeholder message.
- The level check for adding a metal (the Wiki says it needs the smelting level, boostable): a placeholder message.
- Picking the preform up with a bucket of water (every capture used ice gloves): the bucket is emptied, with a placeholder message.
- The temperature at pickup is 1000 minus a degree per tick since the pour (captured: 980-998).

- "Check" on a set-up jig: it reopens the setup.

- The refusal when the preform is unequipped anywhere but the storage: it is refused silently.
- Store-preform with no preform worn, and Take-preform with nothing stored: placeholder messages.
