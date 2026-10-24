# Treasure Trails: easy to master

Beginner clues are in [beginner-treasure-trails.md](beginner-treasure-trails.md). This page covers
the members tiers, built in `server/plugins/treasuretrails/TreasureTrails.plugin.js`
(`members: true`) and its `trails/` units. Easy and medium are implemented. Hard, elite and master
add their step families to the same engine.

## Where the content comes from

The installed cache (revision 241) holds Jagex's whole clue-helper catalogue: the
`cluehelper_clue_*` DB tables, filtered by their `difficulty` column (1 easy … 5 master).

From easy upwards, every step is its own "Clue scroll (<tier>)" item, and item param 623 names
that step's clue-helper row. `Catalogue.TreasureTrails.js` joins the two, so the item in the
player's hand *is* the step. For each step it resolves:
- the target: an NPC (with its live morphs), a loc, a tile, or a keyed loc with the NPCs that drop
  its key;
- the outfit: one requirement per worn slot. It is either "any of these items", "any item of this
  clue item group" (item param 258: ring of dueling is 18, amulet of glory 6), or "nothing worn
  here". The cache writes the last as its `blankobject` item: "Have nothing equipped at all",
  "… and no boots";
- the challenge, if any: its question and answer come from the same `cluehelper_challenge_question`
  row, and its "Challenge scroll (<tier>)" item points back at the step's row;
- the emote slot and the STASH loc;
- the music track (DB table `music`, `midi` column).

Only rows with a "Clue scroll (<tier>)" item are clue steps. Quest scrolls such as the treasure
scroll share the tables.

Easy has 166 steps:

| Family | Target | Steps |
| --- | --- | --- |
| Cryptic | NPC | 41 |
| Cryptic | Loc (search/open) | 71 |
| Cryptic | Dig | 8 |
| Emote | Tile, outfit, Uri | 33 |
| Map | Dig | 7 |
| Music (Cecilia) | NPC | 6 |

Medium has 167 steps, 44 of them with a challenge scroll:

| Family | Target | Steps |
| --- | --- | --- |
| Anagram | NPC | 47 |
| Cipher | NPC | 6 |
| Coordinate | Dig | 44 |
| Cryptic | NPC / loc / key | 8 / 8 / 11 |
| Emote | Tile, outfit, two emotes, Uri | 25 |
| Map | Dig / crate | 10 / 2 |
| Music (Cecilia) | NPC | 6 |

The challenge answers are read from the cache. They agree with the Wiki's challenge-scroll guide
(the osrsreboxed-db `clue-challenges.json` export) on 89 of 90 questions. The exception is the Old
Crone's Slayer Tower question: the cache says 623, the Wiki 619. The game uses the cache.

## Trail state

A trail's state lives in the scroll's item metadata, under `treasure-trails:<tier>`:
`{version, token, revision, completed, length, row}`.

**Starting a trail:**
- A scroll with no trail (a drop, box or vessel gives the tier's first cache item, 2677 for easy)
  starts one the first time it is read or used.
- The trail starts on a uniformly random step, and the scroll becomes that step's item.

**Solving a step:**
- Each solved step replaces the scroll in the same slot with the next step's item, carrying the trail.
- The last step leaves a reward casket.
- Stale tokens and revisions cannot advance a trail twice.
- Banking, dropping, death and saves keep the trail, because they keep item metadata. A scroll
  read before a logout resumed at the same step after logging in again.

**Trail length:** easy trails are 2–4 steps and medium 3–5 (Wiki, "Clue scroll (<tier>)"). The
Wiki publishes no per-length weights, so the length is chosen uniformly; this is an implementation
assumption.

## Steps

- **NPC:** talk to the target NPC; the step completes after the dialogue, within 3 tiles.
  - NPCs speak their own transcript: the `treasure-trails-<tier>` variant in `npc-dialogues.json`,
    read through NpcDialogues' `npc-dialogue:start` with a `select` that only captures the steps.
  - Where the transcript has nothing, a shared fallback line is used.
- **Challenge scroll** (Wiki "Challenge scroll"):
  - The first talk hands over the step's challenge scroll in place of the clue.
  - Reading the challenge scroll shows the question.
  - The next talk asks for the answer through the number prompt. A wrong answer costs nothing; the
    right one gives the next clue or the casket.
  - The words come from the NPC's transcript. The "talk again" variant goes under nine names
    (`when-talked-to-again`, `answering-the-clue`, …), and the wrong/correct branches under several
    wordings; any missing part uses the most common transcript wording.
- **Key** (medium cryptic): killing one of the step's NPCs drops its key (`npc-drops:add`) while
  the trail is held and the player has no key. The target loc then opens only with the key, which
  is used up.
- **Search:** a new generic core hook, `onBeforeObjectInteraction`, claims an interaction on the
  target loc at its exact tile before ordinary object handlers. It mirrors `onBeforeNpcInteraction`,
  and unclaimed interactions fall through.
- **Dig:** a spade (or Eastfloor spade) on the exact tile and plane.
- **Map:** Read opens the step's map interface; the dig is as above.
- **Emote:**
  - The player performs the step's emote within 3 tiles of its target while wearing the full outfit.
  - That spawns that tier's Uri for the player only; talking to him completes the step.
  - Medium steps need a second emote after Uri appears and before he is spoken to.
  - Uri speaks his transcript. With the wrong outfit or a missing emote he says "I do not believe we
    have any business, Comrade."; otherwise a random phrase, the player's "What?", then "You have
    been given a new clue!" (or a casket).
  - The cache gives a target tile but no area, so the 3-tile radius follows the beginner runtime's
    usual value. This is an assumption.
- **Music:** from Cecilia's Wiki transcript, the player selects the requested track, then speaks to
  her.
  - "Select the song I asked you to play, and speak to me again."
  - "Thank you, I love that song!" then completes the step.
  - The track is tracked from `audio:play-song`.

### Map interfaces

No cache data links a map step to its map interface, so `trails/data/map-interfaces.json` records
them. Each was matched by opening every candidate interface on an isolated test world, capturing
it with the agent MCP's vision clip, and comparing it with the Wiki's map images.

| Step | Location | Interface |
| --- | --- | --- |
| `cluehelper_map_easy_0` | Al Kharid mine | `trail_map18` |
| `cluehelper_map_easy_1` | West of the Champions' Guild | `trail_map01` |
| `cluehelper_map_easy_2` | South-east Varrock mine | `trail_map02` |
| `cluehelper_map_easy_3` | Falador standing stones | `trail_map06` |
| `cluehelper_map_easy_4` | Galahad's house | `trail_map09` |
| `cluehelper_map_easy_5` | Behind the Wizards' Tower | `trail_map11` |
| `cluehelper_map_easy_6` | Falador statue crossroads | `trail_clue_easy_map006` |
| `cluehelper_map_medium_0` | Draynor willows | `trail_map03` |
| `cluehelper_map_medium_1` | West of the Crafting Guild (hobgoblin peninsula) | `trail_map07` |
| `cluehelper_map_medium_2` | McGrubor's Wood crate | `trail_map10` |
| `cluehelper_map_medium_3` | North of the Tower of Life | `trail_map15` |
| `cluehelper_map_medium_4` | Crate west of the Clock Tower | `trail_map16` |
| `cluehelper_map_medium_5` | Chemist's house, Rimmington | `trail_map17` |
| `cluehelper_map_medium_6` | Miscellania | `trail_clue_medium_map008` |
| `cluehelper_map_medium_7` | Mort Myre Swamp | `trail_clue_medium_map009` |
| `cluehelper_map_medium_8` | Ourania Cave entrance | `trail_clue_medium_map010` |
| `cluehelper_map_medium_9` | South-east of the Lighthouse | `trail_clue_medium_map011` |
| `cluehelper_map_medium_10` | Between Seers' Village and Rellekka | `trail_clue_medium_map012` |
| `cluehelper_map_medium_11` | East of the Ranging Guild | `trail_map04` |

The named `trail_clue_medium_map008`–`012` interfaces were rendered too, not assumed from their
names. `trail_map19` looks like the Lighthouse map but belongs to another tier.

The same captures show that the beginner runtime's `MAP_INTERFACES` gets four of its five maps
wrong:

| Beginner map | Beginner shows | Should show |
| --- | --- | --- |
| South-east Varrock mine | `trail_map06` | `trail_map02` |
| Draynor willows | `trail_map15` | `trail_map03` |
| Falador stones | `trail_map05` | `trail_map06` |
| Wizards' Tower | `trail_map03` | `trail_map11` |

That is a separate fix; this change leaves beginner untouched.

## STASH units

`Stash.TreasureTrails.js` handles the STASH units. Each emote step's `hidey_hole_loc` is a multiloc
on its own `hh_constructed_*` varbit. Easy has 31 units and medium 25; the Wiki "STASH" page has the
rules:

- **Build:** a hammer, any saw and 10 nails of one metal (not dragon), plus:
  - easy: Construction 27 (boostable) and 2 planks, for 150 Construction XP;
  - medium: Construction 42 and 2 oak planks, for 250 XP.

  Building sets the unit's varbit.
- **Search a built unit:** it stores the step's complete outfit, or returns it if the inventory has
  room for all of it. Item-group slots take any item of the group; "nothing worn" slots store
  nothing.
- **Saved state:** built units and their contents are saved per player
  (`treasure-trails:stash-built`, `treasure-trails:stash-stored`), and the varbits are re-sent at
  login.

Not yet implemented:
- the "STASH units take equipped items" setting;
- cosmetic variants, such as (g) or (or) items;
- the S.T.A.S.H chart and Watson's noticeboard.

## Reward caskets

`Caskets.TreasureTrails.js` opens tier caskets with the shared `Rolls.RewardCaskets` roller over
`clue-caskets.json`.

**Before anything is consumed,** it:
- rolls the base rewards;
- rolls chance-based tertiaries using their exact `probability`;
- asks ClueCapacity for milestone rewards (`treasure-trails:milestone-rewards`);
- checks that every reward resolves to an item.

**Then it:**
- consumes the casket once;
- counts the completion;
- feeds the collection log;
- hands over overflow through `forceAdd`;
- shows the reward screen.

**Entrana** (Wiki): armour and weapon rolls are removed, and non-shared clue uniques can't be
obtained. This uses the exporter's section names: easy keeps Food, Runes and Shared treasure trail
items.

**Milestones:**
- ClueCapacity owns the scroll cases (minor at 100, major at 200), including their recovery.
- Any other milestone item, the easy Large spade at 500, comes with the casket whose completion
  reaches it.

**The rewarded 1/50 master clue** obeys clue capacity (`treasure-trails:can-receive`). After X Marks
the Spot it becomes a scroll box (`treasure-trails:clue-item`).

**The table:** `clue-caskets.json` is imported unedited from the `osrsreboxed-db` exporter
(`scripts/drops/clue_caskets.py`, RSPSApp/osrsreboxed-db#13 at `efbf4bbe`, SHA-256
`87d26369d2408d11b19cb4bace5c741d628ac3283d29bcc2f6cc80b4df560c29`; two generations byte-identical).
- It adds the easy, medium and hard pools and structured `milestones` for every tier.
- The elite and master pools are unchanged apart from their new `milestones`.
- Without a tier's table, its casket says "You can't open this casket right now." and is kept.
- Generated JSON is never hand-edited.

## Verification

- `tests/treasure-trails-easy.test.cjs` runs on the real cache and checks:
  - the object-hook contract;
  - all 166 steps resolving to distinct items and targets;
  - trail start and lengths;
  - every NPC, search, dig, map, emote and music step solved from the right place and refused from
    the wrong one;
  - stale advances;
  - STASH build, store and withdraw;
  - the imported easy table: every reward resolves, the casket opens once, and a missing table keeps it;
  - the Entrana filter over 300 seeded caskets;
  - the master clue's capacity and box rules;
  - the Large spade on exactly the 500th casket.
- `tests/treasure-trails-medium.test.cjs` covers all 167 medium steps and every one of the 44
  challenge NPCs: hand-over, the question on Read, a wrong answer kept, and the cache's answer
  accepted. It also covers:
  - the transcript words, including Ali's differently named variant;
  - an NPC with no transcript lines;
  - all 11 keyed steps (key drop only during the trail, locked without the key, key used up);
  - crate maps, coordinate and map digs;
  - all 25 double emotes with item groups and Uri's transcript;
  - "no boots";
  - the medium casket and medium STASH units.
- Clue, casket and Mimic tests pass 128/128 with the imported tables.
- Beginner, beginner-casket and clue-capacity tests still pass unchanged.
- **Natural route:** on the isolated slot-8 world (game 43708, agent MCP 49808), a headless test
  account completed three full easy trails through real packets: 7 NPC, 5 search, 2 dig and 1 emote
  steps. Each ended in a reward casket.
- Two closed chests failed only because the test teleported onto their walled side. Both open
  normally from the open side.
- A clue read before a logout resumed at the same step after logging in again.
- With the table imported, two more trails ended in real casket openings. Each showed the reward
  screen (group 73), new collection-log entries and "You have completed 2 easy Treasure Trails."
- **Medium natural route** on the isolated slot-10 world (game 43710, agent MCP 49810): a headless
  account finished nine medium trails through real packets. Along the way it:
  - answered 13 challenge scrolls through the number prompt (Teicuh, Nicholas, Zoo keeper,
    Captain Tobias, Aretha, Hickton, Cook, Dunstan, Nieve, Marisi …);
  - performed double emotes with Uri's transcript phrases;
  - solved coordinate, map and crate steps.
  - Each trail opened a real medium casket.
- Live checks found three bugs the fixture-based tests had missed, all now fixed and covered by tests:
  - an empty dialogue never ran its action;
  - the "nothing worn" `blankobject` outfits were treated as an item to wear;
  - a wandering NPC could walk out of range before the challenge hand-over.
- Torgan's anagram step stalled because no Torgan stands at the cache's target tile in this
  world. That is an NPC-spawn gap, not a clue rule.
- Keyed steps were left to the unit tests in the walk, because they need a kill.

Sources:
- [Clue scroll (easy)](https://oldschool.runescape.wiki/w/Clue_scroll_(easy))
- [STASH](https://oldschool.runescape.wiki/w/STASH)
- [Cecilia](https://oldschool.runescape.wiki/w/Cecilia) and [her transcript](https://oldschool.runescape.wiki/w/Transcript:Cecilia)
- [Easy maps](https://oldschool.runescape.wiki/w/Treasure_Trails/Guide/Maps/Easy)
- [Beginner maps](https://oldschool.runescape.wiki/w/Treasure_Trails/Guide/Maps/Beginner)
- [Clue scroll (medium)](https://oldschool.runescape.wiki/w/Clue_scroll_(medium))
- [Challenge scroll](https://oldschool.runescape.wiki/w/Challenge_scroll)
- [Coordinate clues](https://oldschool.runescape.wiki/w/Treasure_Trails/Guide/Coordinates)
- [Emote clues](https://oldschool.runescape.wiki/w/Treasure_Trails/Guide/Emote_clues)
- [Uri's transcript](https://oldschool.runescape.wiki/w/Transcript:Uri)
- [Medium maps](https://oldschool.runescape.wiki/w/Treasure_Trails/Guide/Maps/Medium)
- installed cache revision 241
