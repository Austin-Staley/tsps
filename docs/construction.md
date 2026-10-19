# Construction

Player-owned houses: rooms, furniture and what the furniture does. The plugin is
`server/plugins/skills/Construction.plugin.js`, with one unit per part in
`server/plugins/skills/construction/` and its tables in `construction/data/`.

Behaviour follows the [OSRS Wiki](https://oldschool.runescape.wiki/w/Construction) and
[rsprox.net captures](https://rsprox.net/database); ids come from the cache. Where neither
covers something, this page says so.

## Layout

| Unit | What it does |
| --- | --- |
| `House` | Hooks, house entry and exit, building and removing furniture, guests, adverts, house options, chairs |
| `Instance` | `PlayerHouseInstance`: the instanced house (an `Area`), its palette, doors, hotspots and furniture |
| `Data`, `Estate` | Tables from `data/*.json`; house locations and styles |
| `Stairs` | Climbing between floors, building a room through a staircase |
| `Portals`, `Altars`, `Storage`, `Servants`, `EstateAgent` | Portal chamber and nexus, altars and burners, costume storage, servants, Estate agents |
| `JewelleryBox`, `Mounted`, `SuperiorGarden`, `Lectern` | Teleport furniture and teleport tablets |
| `Workshop`, `Workbench`, `Kitchen`, `Study`, `CombatRoom` | Tool stores, clockmaker's bench, repair stand, flatpacks, larders, shelves, barrels, telescope, crystal ball, clock, adventure log, combat dummies |
| `Menu`, `Commands` | The generic option menu (script 217); `::hotspots` |

The house runs as an `Area`: per-tick work (chairs, servants, burners, the owner's Kick option,
combat dummies) happens in `PlayerHouseInstance.process` for occupants only.

## Data

`yarn dump:construction` (in `server/`) refreshes the furniture, rooms and house viewer data from
the cache's POH tables: 110 `furniture` (name, level, materials, menu icon, hidden-in-menu),
111 `poh_room` (cost, level, hotspot rows) and 112 `poh_hotspot` (furniture per hotspot). It
lists table rows the data doesn't have yet. Experience, built loc ids, build animations, tools
and upgrade sources are not in those tables and are kept by hand. `--check` only reports. The
cache revision update guide has the step.

Hotspot locs are shared between some rooms (the hall and dungeon stair spaces), so a loc is
resolved to a hotspot through its room (`Data.hotspotIn`). Building on a hotspot furnishes every
placement of it in the room (all tiles of a rug, every window's curtains); Remove takes them all.

## Furniture with behaviour

### Teleports

- **Jewellery boxes:** Teleport Menu opens interface 590 through its init script (1685: tier,
  name, requirement bits); a pick is `resume_pausebutton` on 590:0 with the slot (captures). The
  teleport lands on the third tick and sets varbit 2308 to slot + 1, which picks the box's
  multiloc and so names its quick-teleport op (last destination). Tiles are the jewellery's own
  (`plugins/items/Teleports.Jewellery.js`). The requirement bits (Tears of Guthix, Kourend,
  Miscellania, Dondakan's Rock, Fortis Colosseum) are all sent set, as the jewellery itself
  doesn't gate them here.
- **Mounted amulet of glory, mythical cape:** one op per destination.
- **Mounted Xeric's talisman and digsite pendant** (portal nexus room): Teleport menu and
  Configuration use the generic menu ("Xeric's Talisman teleports" / "... left click", from
  captures). Each left-click setting is a separate loc, swapped in as the furniture's displayed
  loc. Xeric's casts `arceuus_necromancy_anim` with `xeric_teleport_spotanim`; its tiles are the
  middle of the captured landing spots (tsps has no Xeric's talisman item yet).
- **Superior garden spirit tree, fairy ring, spiritual fairy tree:** hand the player to the
  networks (`spirit-trees:open`, `spirit-trees:last-destination`, `fairy-rings:configure`,
  `fairy-rings:zanaris`, `fairy-rings:last-destination`), whose rules apply.
- **Lecterns:** Study opens `teletabs_craft_if` (403) after setting varp 4074 to the lectern's
  tablet enum (4108, 4178, 4179, 5267-5271 by lectern) and varp 2224 (quantity). Tabs set varbit
  10600; confirm makes one tablet every 4 ticks (`poh_create_magic_tablet`, synth 228), each
  taking soft clay and runes (staves and the rune pouch count). Levels, runes and experience per
  tablet are the Wiki's (Magic tablet).

### Floors

Staircases (Climb-up, Climb-down, Climb on spiral staircases) and the garden's dungeon entrance
move the player a floor, keeping their tile. The room at the other end must have connecting
stairs, and two halls must face the same way. Otherwise the captured messages say why. In
building mode a staircase that leads nowhere offers to build the matching room with its
staircase ("These stairs do not lead anywhere. Do you want to build a room at the top?").

### Workshop and kitchen

- **Tool stores:** each rack's tools ("Select a tool"; tiers from the Wiki's Tool space).
- **Clockmaker's bench:** menus by table tier, then "Select a toy" / "Select a horsey colour"
  (captures); 15 Crafting experience per product, levels from the Wiki. The watch's
  missing-materials message is inferred from the captured ones.
- **Workbench:** Work-at opens the flatpack categories (enum 3526), then the category's
  furniture; a pick makes the flatpack with the furniture's materials and experience, up to the
  bench's level. Using a flatpack on a hotspot installs it in building mode.
- **Armour repair stand:** Barrows repair at Bob's price x (1 - Smithing / 200) (Wiki), through
  the `barrows:repair` event.
- **Larders, shelves:** "Select an option", four at a time with More... (captures; contents
  from the Wiki). The shelves' cup is from captures (the Wiki's table leaves it out).
- **Barrels:** a beer glass on a barrel fills it, with the barrel's pour animation.
- **Stoves:** the firepits cook as fires, the ovens and ranges as ranges (Cooking). Kettles
  fill at sinks (WaterSources).

### Study, gallery, combat room

- **Telescopes:** the next shooting star's region and a landing window as wide as the
  telescope's accuracy (Wiki: oak 24, teak 9, mahogany 2 minutes), via
  `shooting-stars:forecast`. Which regions take "the" is inferred beyond the captured
  "the Kharidian Desert".
- **Crystal ball, elemental sphere, crystal of power:** change an elemental staff's element;
  battlestaffs cost 100 and mystic staffs 1,000 runes of the new element (Wiki).
- **Clocks:** "It's Rune o'clock." (captures).
- **Adventure logs:** the owner's log menu; Collection log opens the collection log.
- **Combat dummies:** Attach swaps the loc for the dummy NPC, which takes hits, never
  retaliates and never falls; Detach swaps back (captures).

Already there before this page: portal chamber and nexus teleports, altars and incense burners,
spellbook and occult altars, pools, costume room storage, servants, the Estate agent, guests and
adverts, house options, the house viewer, chairs.

## Not done yet

- Kettles on stoves and tea making; the scrying pool; bookcases; tip jars; cape hangers.
- The reworked trophy displays (Trophies menu, teak/mahogany/gilded displays). The cache hides
  the old trophy rows from build menus, so those spaces offer nothing for now.
- Menagerie (pet houses, roaming pets), games room games, combat room rings.
- Dungeon guards, traps and doors, oubliette, treasure room, throne room lever and trapdoor,
  Mahogany Homes, the League hall.

## Testing

`::hotspots` (developer) lists the build hotspots of the room you stand in, with their tiles, so
furniture can be built with the agent MCP: `object_option` Build on the hotspot, then
`send_packet` `dialogue_continue` on 458:2 with the menu choice (1-based) once 458 is open. Rooms
are built from a door hotspot the same way with 212:4 and the room id.
