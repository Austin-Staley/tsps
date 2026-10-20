# Guardians of the Rift

The Runecraft minigame in the Temple of the Eye, built from the OSRS Wiki, live rsprox captures and
the cache. It is one plugin, `server/plugins/minigames/GuardiansOfTheRift.plugin.js`, with one
unit per part of the game in `server/plugins/minigames/guardiansoftherift/` (the Wintertodt layout).

Status: phase 1 (lobby, barrier, game loop, HUD, Power-up, end-of-game rewards) is built. The
phases are at the end.

## Sources

- **rsprox captures, rev 241 (normal worlds):** a recording on world 409 with three full games
  (October 2026) is the main source for timings, numbers and messages. A second one covers the
  temple entrance, the Bank Chest and the tarnished locket. The world was busy: Peek and the
  end of game say "lots of adventurers", and the power maximum was 91,800 to 108,000.
- **rsprox captures, rev 227 (Leagues V):** recordings 566, 1840 and 1848, used for structure
  only where rev 241 has nothing (their amounts can be relic-boosted). Recording 1693 (rev 226)
  is the Temple of the Eye tutorial.
- **OSRS Wiki:** Guardians of the Rift (and /Strategies), Rewards Guardian, the cell, stone,
  pouch and reward item pages. The Wiki sets the numbers no capture shows.
- **Cache (rev 241):** ids by gameval name, the HUD interface and its scripts, loc placements
  (`yarn dump:widget 746`, `dump:cs2 5980`, `dump:loc`). The plugin looks every id up by its
  gameval name.

## Ids

### Varbits and varps

| Name | Id | Notes |
| --- | --- | --- |
| `gotr_is_playing` | varbit 13691 | 1 while the player is in the current game. |
| `gotr_game_id_on_player` | varp 3400 | A random game id on joining, 0 on leaving or at the end. |
| `gotr_elemental_earned_this_game` | varbit 13686 | Elemental energy this game (0-1000). |
| `gotr_catalytic_earned_this_game` | varbit 13685 | Catalytic energy this game (0-1000). |
| `gotr_mining_count` | varbit 5667 | Fragments mined this game; Mining XP stops at 250. |
| `gotr_player_has_finished_game` | varbit 13688 | Set at the end of a game, cleared on joining the next. |
| `gotr_portal_bottom_visible` | varbit 13687 | 1 while the player is in the huge-remains area, so its exit portal shows. |
| `gotr_talisman_toggle_<rune>` | varbits 13693-13704 | "Toggle-talisman" per Portal Guardian (air ... blood). |
| `gotr_unlocked_needle` | varbit 13690 | |
| `gotr_colourful_fade_disabled` | varbit 13814 | Barrier "Visual-effects". |
| `gotr_cordelia_repair_pouch` | varbit 14672 | |
| `gotr_*` varps | 3395 (perm), 3399 (temp), 3402 (rewards perm) | The varbits above pack into these. |

`total_gotr_kills` (varp 3397) is the rifts closed. Points ("Total elemental energy"), searches
and the `gotr_perm_0` settings aren't in a var the server saves, so they are attributes
(`guardians-of-the-rift:*`, `Records.GuardiansOfTheRift.js`) re-sent at login.

### Interfaces and scripts

- **`gotr_hud` (746)**, opened in `toplevel:overlay_hud` while playing. Its onLoad is script 5979.
- **`gotr_overlay` (745)**, opened in `overlay_atmosphere` for a portal's colour fade. The fade is
  run by script 5984 (`gotr_overlay_portal [model, colour]`) and ended by 5985 (`gotr_remove_portal`).
  The pairs in the captures are:
  - `[44090, 15855475]` for the huge-remains portals;
  - `[44091, 527582]` for water, body and law;
  - `[44092, 16293385]` for fire and chaos.
- **Script 5980 `gotr_hud_update`**, sent every 2 ticks while playing, takes 11 ints:

| Arg | Meaning |
| --- | --- |
| 0, 1 | Elemental, catalytic energy this game. |
| 2, 3 | Great Guardian power and its maximum, in guardian stones. The bar and "Guardian's Power: N%" are 2/3. A game starts at 10% (9180/91800, 9420/94200 at rev 241). The maximum moves by 200 as players join or leave mid-game, which fits the Wiki's 250 stones a player and 200 past the 20th. After the close, arg 2 is 0. |
| 4 | Huge-remains portal direction (enum 4254: 1 E, 2 SE, 3 SW, 4 S), 0 for none. |
| 5 | Active elemental altar (enum 4270: 1 air, 2 water, 3 earth, 4 fire), 0 before the rift opens. |
| 6 | Active catalytic altar (enum 4271: 1 mind, 2 body, 3 cosmic, 4 chaos, 5 nature, 6 law, 7 death, 8 blood). |
| 7, 8 | Rift guardians alive / the cap (10), drawn as "7/10". |
| 9 | In the lobby, ticks to the rift opening; then ticks to the creatures' attack (200 from the open); then ticks to the altars' next change (33). Negative hides the timer. |
| 10 | Ticks the huge-remains portal stays open (44 from its opening). Negative hides it: live sends minus the ticks since it closed. |

### Locs (rev 241, the temple's own map; the copies around 2440,5720 are the tutorial's)

| Loc | Id | Where |
| --- | --- | --- |
| Barrier: open, closed, finishing up | 43700, 43849, 53263 | 3613,9483 (5x1) |
| Rewards Guardian | 43695 | 3610,9479 |
| Bank Chest | 43697 | 3619,9473 |
| Deposit Pool | 43696 | 3609,9487 |
| Workbench | 43754 | 3611,9486 |
| Weak cells / Uncharged cells | 43733 / 43732 | 3618,9486 / 3618,9488 |
| Essence pile (elemental / catalytic) | 43722 / 43723 | 3618,9490 / 3611,9490 |
| Guardians of Air, Water, Earth, Fire | 43701-43704 | 3617,9494; 3623,9500; 3623,9505; 3617,9511 |
| Guardians of Mind, Chaos, Death, Blood | 43705-43708 | 3612,9494; 3606,9500; 3606,9505; 3612,9511 |
| Guardians of Body, Cosmic, Nature, Law | 43709-43712 | 3608,9496; 3621,9496; 3621,9509; 3608,9509 |
| Inactive cell tiles | 43739, tiers 1-4 43740-43743 | 3608,9503 ... 3622,9503 (7 tiles) |
| Barriers on the tiles | `gotr_barrier_tier1..4` (+ `_3x3`) | |
| Abyssal Rift | 43713 | 3612,9526 |
| Guardian parts / remains | 43715-43718 | the temple's edges |
| Large guardian remains | 43719 | 3639,9497 and 3639,9508 (past the rubble) |
| Rubble shortcut (56 Agility) | 43724 / 43726 | 3634,9503 / 3636,9503 |
| Huge guardian remains | 43720 | 3589,9497 and 3589,9508 |
| Huge-remains exit portal | 38044 | 3593,9503 |
| Huge-remains entry portal | 43729 | spawned at the directions above |

### NPCs

The Great Guardian is 11403, Apprentice Felix (reward trader) is 11404, Apprentice Cordelia is
6717 and Tamara is 11426.

The rift guardians are 11408-11417: mind, body, cosmic, chaos, nature, law, death, blood, air,
water, earth and fire, in the order the captures name them.

The abyssal creatures are 11405 (pyramid/guardian), 11406 (walker) and 11407 (leech). The barrier
NPCs are 11418-11425 (tiers 1-4, each with a `_large` variant).

## The game (rev 241 captures)

Ticks from the rift opening:

| Event | Tick | Message |
| --- | --- | --- |
| Lobby countdown | -50, -16, -8, -3, -2, -1 | "The rift will become active in 30 seconds." / "...10 seconds." / "...5 seconds." / "3..." / "2..." / "1..." |
| Rift opens | 0 | Everyone north of the barrier joins: a new `gotr_game_id_on_player`, `gotr_is_playing` 1, `gotr_player_has_finished_game` 0, the HUD; `<col=ef1020>The rift becomes active!` (no closing tag) |
| | +1 | "Creatures from the Abyss will attack in 120 seconds." |
| Creatures attack | +200 | `<col=ef1020>Creatures from the Abyss begin their attack!</col>`; the first altar pair opens |
| First huge-remains portal | +256 to +266 | `<col=ef1020>A portal to the huge guardian fragment mine has opened to the <dir>!</col>` |
| Later portals | every 230-240 ticks | the same; each is open 44 ticks |
| 60% power | | `<col=ef1020>The rift burns intensely... More creatures from the Abyss are emerging!</col>` |
| 100% power (C) | | `@mes_hl_gre@The Great Guardian is fully charged.</col>`; the creatures die on C+1 |
| | C+2, C+18, C+27 | The Great Guardian says "Humans, I now have the power to close the rift. Thank you, brave ones.", "Now, for the final blow. Let the Scar be no more!", "Brace yourselves!" |
| Rift closed | C+32 | `@mes_hl_gre@The Great Guardian successfully closed the rift!</col>`, the four reward lines (see Rewards), `gotr_player_has_finished_game` 1, jingle 292, "The Portal Guardians will keep their rifts open for another 30 seconds." Players stay in until they leave or the next game opens. |
| Altars close | close +51 | "The Portal Guardians close their rifts."; the HUD's altars go to 0 |
| Next game | close +104 | |

- A game lasted about 860 ticks on the captured world.
- `@mes_hl_gre@` is coloured by the chatbox's transparency: 229628 on a transparent chatbox
  (Leagues capture), 06600c on the opaque one (the same green Mastering Mixology captured).
- **Loss (no capture):** the Wiki says the game fails at 0%. The plugin closes the rift without
  rewards and says "The Great Guardian has been defeated. The rift remains open." (our wording).
- **Altars:** one elemental and one catalytic Portal Guardian are active at a time, from the
  creatures' attack until 51 ticks after the close. The pair changes every 33 ticks, and each
  new altar differs from the one before (rev 241 captures). Active
  guardians play `statue_runestone01_active`, inactive ones `statue_runestone01_inactive` (loc anims).
- **Power:** each guardian stone fed adds one to the power (the HUD's units). The maximum is
  250 per player in the game and 200 for each past the 20th (Wiki). A solo game needs 250 stones.
- **NPC chatter** (Tamara, Cordelia, Felix): "We need to power up the Great Guardian!", "We need
  more rift guardians!", "Take uncharged cells with you to charge them at altars!", "The cells here
  can be used to power up barriers and rift guardians!", "Remember to combine guardian fragments
  with pure essence!", "Imbued essence can only be made at altars. Keep an eye out for the right
  altars to open!", "We need to protect the Great Guardian!", "We need shield barriers up before
  anything comes through that rift!", "Don't forget that different cells produce different rift
  guardians!", "We need to assemble rift guardian before those creatures arrive!", "The essence
  piles here contain lots of rift guardian parts.", "Smashing!"

## Interactions (captures)

### The barrier

- **Quick-pass from the lobby:** the player steps two tiles through (3616,9482 -> 3616,9484 in one
  tick), `gotr_is_playing` 1 and the HUD opens. During a game the game id is set too: rev 241
  worlds let players join mid-game. In the lobby the id comes when the rift opens.
- **Pass:** no capture; it does what Quick-pass does.
- **Requirements (Wiki):** Temple of the Eye and 27 Runecraft. The refusal wording isn't captured:
  "You need to complete Temple of the Eye to help guard the rift." and "You need a Runecraft
  level of at least 27 to help guard the rift." are ours.
- **Closed barrier (`gotr_barrier_closed`, Leagues: worlds that lock the game):** mesbox "It looks
  like the rift is already being guarded. You must wait until they are done to join." Not used:
  only themed worlds can lock it.
- **From the full charge until the Portal Guardians close their rifts, from outside:** mesbox "It looks like the adventurers
  within are just finishing up. You must wait until they are done to join."
- **Leaving through the barrier:** `gotr_is_playing` 0, game id 0, both energies 0,
  `gotr_mining_count` 0, the colossal pouch's guardian essence (`colossal_essence_pouch` 0) and
  the game's items go, and the HUD closes. The Wiki lists fragments, essence and portal talismans;
  the plugin also takes stones and cells.
- **Logging in** inside the game side puts the player in the lobby (3615,9480).
- **Peek** gives one of these mesboxes ("lots of adventurers" on a busy world; the plugin says
  it from 50):
  - "The rift is wide open. Creatures are flooding through from the Abyss! There were N adventurers inside when it opened. Great Guardian power: N%"
  - "Creatures from the Abyss are coming through the rift. There were N adventurers inside when it opened. Great Guardian power: N%"
  - "The rift was successfully closed. There were N adventurers inside when it opened."
  - "The adventurers within are recovering from guarding the rift. There were N adventurers inside when the rift opened."
- **Visual-effects:** a chat menu: "Your current preference is to not see colourful full screen
  effects." with "Enable them." and "Disable them.".

### Fragments, essence and the workbench

- **Mine guardian parts / remains / large remains:**
  - The pickaxe animation and "You swing your pick at the rock.".
  - Fragments arrive with "You manage to mine some guardian fragments.", sound 3600 and `gotr_mining_count` +1.
  - At 250 fragments: "You have reached the limit of 250 resources mined for this game and will not be receiving further XP."
- **Huge guardian remains:**
  - "You manage to mine some guardian essence."
  - When full: mesbox "Your inventory is too full to hold any more guardian essence." with sound 2277.
- **Mining before the rift opens:** "There's no need to do that right now." (essence tier 2).
- **Workbench, Work-at:** anim `gotr_chisel_essence`, sound 2586, and one fragment becomes one
  guardian essence each action until none are left ("You have no more guardian fragments to combine.").
- **Rubble, Climb:**
  - Anim `death_human_climbing_down`, then exactmove 4 tiles over 90 client cycles (3633 <-> 3637, y 9503) with sound 2454.
  - Wiki: 56 Agility, unboostable.
- **Huge-remains portals:**
  - Enter: sound 1098, then the `gotr_overlay` fade.
  - 2 ticks later: teleport to 3592,9503, "You step through the portal and find yourself in another part of the temple.", and `gotr_portal_bottom_visible` 1.
  - The exit portal (38044) returns the player to the main area and sets the varbit to 0.

### Portal Guardians and altars

- **Enter an active guardian:** anim, sound 1098 and the overlay fade. 2 ticks later the player is
  teleported to the altar with "You step through the rift and find yourself at the <Rune> Altar."
- **Captured altar tiles:**

  | Altar | Tile |
  | --- | --- |
  | Air | 2841,4829 |
  | Water | 2726,4832 |
  | Fire | 2574,4849 |
  | Mind | 2793,4828 |
  | Body | 2521,4834 |
  | Law | only the rebuild zone (308,602) |
  | Chaos | only the rebuild zone (285,604) |

  Earth, Nature, Cosmic, Death and Blood are not in the captures yet.
- **Inactive guardian:** mesbox "The Guardian is dormant. Its energy might return soon."
- **Without the stones handed in:**
  - The Great Guardian's dialogue: "Human, I need the power of the guardian stones."
  - Mesbox: "You should feed the guardian stones to the Great Guardian before making more of them."
- **Crafting at the altar** turns each guardian essence into a rune and one guardian stone of the
  altar's type (Wiki). Elemental altars give elemental stones; catalytic altars give catalytic
  stones; combination runes give polyelemental stones.
  - An uncharged cell becomes the altar's tier of charged cell.
  - Each essence has a 1/250 chance of a portal talisman.
  - "You discover a strange talisman during the runecrafting process!" (capture) is the talisman message.
- **Power-up on the Great Guardian (rev 241):**
  - Two ticks after the click: anim `human_runecraft_walkmerge`, spotanim `runecrafting` (height 92),
    sound 5369 and a `pyramid_waterstrike_travel` projectile to the Guardian (start 25, end 60,
    heights 100 to 146).
  - A tick later every stone leaves the inventory, the energy varbit rises and the XP lands:
    5 Runecraft XP a stone (64 stones: 320).
  - Energy is 2 a stone for air, water, fire, nature and body stones (64 -> 128, 61 -> 122,
    13 -> 26). Twice in the recording, 62-64 law stones gave 4 a stone (256 and 248); the Wiki
    says 2 for every stone and the stones are the same item, so the plugin gives 2 (3 for
    polyelemental and polycatalytic, Wiki). Worth a recheck with death or blood stones.
  - Wiki: 1% run energy a stone, plus 1-11% from the special attack bar.
  - Without stones or while it rests, the Guardian's transcript (npc-dialogues.json): "The Great
    Guardian seems to be resting. You should probably not disturb it." (captured), "My power level
    is too low. Bring me guardian stones." or "Thanks, adventurer. I am now fully powered up."
- **Deposit Pool, Deposit-runes:** anim `human_leverdown_walkmerge`, every rune banked, and "You
  deposit all of your runes into the pool."

### Cells, barriers and rift guardians

- **Weak cells, Take:** anim `human_pickuptable_walkmerge`, sound 2581, +1 weak cell.
- **Uncharged cells:** Take-10 and Take-1 (up to 10 held, Wiki).
- **Place-cell on a cell tile:**
  - Anim `human_pickupfloor` and sound 5428.
  - "The <tier> cell is consumed as it <col=ff0000>recharges</col> the barrier." and both energies go up.
  - Wiki energy per cell:

    | Cell | Placing | Strengthening | Recharging | Health restored |
    | --- | --- | --- | --- | --- |
    | Weak | 17 | - | 2 | 10 |
    | Medium | 20 | 7 | 5 | 25 |
    | Strong | 24 | 13 | 9 | 50 |
    | Overcharged | 30 | 22 | 15 | 100 |

  - Runecraft XP for barriers is 30/100/180/250 (Wiki).
  - Repairing a broken tile costs 12 guardian fragments and gives 25 of each energy.
  - On a tile where a barrier is already standing: "Your cell absorbs a small / high amount of excess energy."
- **Assemble at an essence pile:**
  - Needs a chisel and a charged cell.
  - Anim `gotr_chisel_guardian`, sounds 942 and 956.
  - Messages: "You scrape together what usable components you can find." then "You carve out a place for the cell and carefully place it inside the guardian." and then "The powers of the <tier> cell extend into the essence. A Guardian comes to life."
  - The cap is 10 rift guardians.
  - Energy is 2x+1 of the strengthening value, of the pile's type only, plus 80 Crafting XP (Wiki).

### Rewards

- **End of game (rev 241 captures, on the close's tick):**
  - `@mes_hl_gre@The Great Guardian successfully closed the rift!</col>`
  - "Amount of rifts you have closed: <col=ff0000>1,713</col>." (`total_gotr_kills` +1)
  - "Elemental energy attuned: <col=ef1020>2</col>. Catalytic energy attuned: <col=ef1020>4</col>."
    (this game's points: 165 and 407 energy gave 2 and 4; 343/150 gave 3/2; 11/393 gave 0/4)
  - "Total elemental energy: <col=ef1020>5</col>. Total catalytic energy: <col=ef1020>7</col>."
    (the banked points)
  - "You've been awarded 4,410 bonus Runecraft XP for closing the rift." (45 x level 98)
  - Wiki: the XP needs 300 energy in the game; a point per 100 energy of each type, with the
    remainder as a chance of one more.
  - Energy is capped at 1,000 per type and 1,200 in all. At the cap: "You are fully attuned with runic energy and cannot earn anymore until the rift has been closed."
- **Rewards Guardian, Check:** mesbox "You have N catalytic energy and N elemental energy. You can
  use them to search the rift N times. You have searched the rift N times."
- **Search / Big-search:**
  - Anim `picking_low_shorter` and sound 2581. Then one reward every 3 ticks, 5 per Big-search (Wiki).
  - Each reward: "You found some loot: N x <item>" (or "You found some loot: <item>").
  - When the searches run out: mesbox "There doesn't seem to be anything else in the rift for you." (or "...anything in the rift for you.").
  - Also: "You can find N more rewards in the rift.".
  - Each search costs one point of each type, or 25 abyssal pearls.
  - The loot table is on the Wiki's Rewards Guardian page: rare table, pouches, runes, talismans, pearls, intricate pouch, ashes, needle and the pet.
- **Intricate pouch, Open:**
  - Objectbox "You open the intricate pouch and find something inside!".
  - Needs two free slots: "You need at least two free inventory spaces to open this pouch."
- **Apprentice Felix:**
  - Trade opens the existing "Temple Supplies" shop (shops.json 1466).
  - Talk-to: "Hey, <name>. Got any abyssal pearls you want to trade?"
  - Selling a lantern: "You present the Abyssal lantern to Felix.", then "An abyssal lantern? I can offer you 100 abyssal pearls for that." and "You sell your abyssal lantern for 100 abyssal pearls."
  - A dye sells for 50 pearls (Wiki).

## Existing code it touches

- **`plugins/quests/quests/TempleOfTheEye.Quest.js`** already runs the tutorial in this temple.
  It covers the workbench, cells, essence piles, the Guardians of Mind and Water, and the Great
  Guardian 11456. Its handlers only claim an action while the quest is at the matching stage, so
  the minigame handles the same locs once the quest is complete. Playing needs the quest complete.
- **`plugins/skills/Runecrafting.plugin.js`** crafts runes at the altars and handles essence pouches.
  Guardian essence has to be crafted at the altars and stored in pouches ("The pouch contains
  guardian essence, so you can fill it only with more guardian essence.").
- **`plugins/interface/data/minigame-teleports.json`** already lists Guardians of the Rift (3615,9477).
- **`data/definitions/shops.json`** already has Temple Supplies (1466).

## Phases

1. **Lobby, barrier and the game loop:**
   - The temple `Area` and the barrier's four options.
   - One game per world: lobby, the rift opening, creatures attacking, the end of the game.
   - Power and its scaling, the HUD (746 + script 5980), the game varbits and the messages.
   - Power-up on the Great Guardian, and the end-of-game points and XP.
2. **Essence:**
   - Mining fragments (parts, remains, large remains past the rubble), with the 250 cap.
   - The workbench, the huge-remains portals and the huge remains.
   - The Deposit Pool, and guardian essence in pouches.
3. **Portal Guardians:**
   - Altar rotation and Enter, with the overlay fade.
   - Crafting guardian essence into runes, stones and charged cells; portal talismans; the altar exit back to the temple.
4. **Cells, barriers and rift guardians:**
   - The cell tables; placing, strengthening, recharging and repairing barriers.
   - Assembling rift guardians and the rift guardians' AI.
5. **Abyssal creatures:**
   - Spawning from the rift and attacking barriers and the Great Guardian, with power drain.
   - The 60% surge and losing the game.
6. **Rewards:**
   - The Rewards Guardian (Check, Search, Big-search and the loot table) and the intricate pouch.
   - Felix's trades, Cordelia's pouch repair and the collection log.
