# Issue 196 play-through checkpoint

This draft covers the remaining quests in [issue 196](https://github.com/RSPSApp/tsps/issues/196). While Guthix Sleeps has reached its first complete integrated MCP play-through. Song of the Elves, The Blood Moon Rises, Dragon Slayer II and Desert Treasure II are included as work in progress; Recipe for Disaster and A Night at the Theatre still need integration and final checks.

## While Guthix Sleeps

The `Wgsnatural` actor followed quest actions through Movario's base, the fellowship, Black Knight HQ and Dark Squall infiltration, Surok's fight, Lucien's camp, the chasm, all eight temple statues, the Balance Elemental and both tormented demons. Fixes were checked by continuing from earned checkpoints. WGS stages and puzzle items were not granted through commands.

Preparation fixtures supplied prerequisite quest flags/skills and ordinary equipment, runes, food, tools, gems, fuel and transport outside battles. The actor crafted, fuelled and lit its sapphire lantern, used the Games necklace and northern rock crossing, collected chasm/temple ingredients, and used normal spells and attacks in combat. Separate component runs used explicit starting checkpoints; those are additional coverage rather than fresh-account completions.

The final alliance dialogue awarded exactly 5 QP, 80,000 Thieving XP, 75,000 Farming XP, 75,000 Herblore XP and 50,000 Hunter XP. Logout saved stage 900 and the earned rewards in SQLite. Headless MCP screenshots were inspected for Black Knight HQ and the Tears of Guthix arrival route.

## Blood Moon component checks

The preparation component collects materials from the palace and performs the stew, sickle, flail and stake recipes, including their confirmation menus. The bridge component uses the supplied ballista/javelins to defeat portals through ordinary ranged attacks. The hall component takes a potion from the crate, heals its owned injured Aranei and repairs pillars; the natural integrity timer reaches the breach and creates Lowerniel's encounter. The saved defence checkpoint retains participation, repairs/healing, zero integrity and the breach phase after logout.

Blood Moon's earlier/later story chapters and remaining bosses still need further checks. MCP also verified that relog restores the barricade and passing it resumes Lowerniel's owned encounter. The hall timer and some scripted placements are inferred and marked `shortcut:` for later calibration against live OSRS recordings.

## Desert Treasure II opening

The fresh `Dt2natural` actor earns the Ancient Vault opening, Smith's conversations, all four statue inspections, the plaque and Terry Balando's Digsite hand-off. Its native progress reaches 12 without DT2 stage or puzzle-item commands. Initial fixtures supply skills and prerequisite completions; ordinary transport fixtures move between quest locations. Repairs were verified by continuing the earned checkpoint. The actual vault steps and logout/relogin return the player to the recorded public entrance with progress retained.

The cache's quest dbrow 2343 confirms native completion at 118. Progress mapping, Ancient Magicks entry requirements, and three usable 100,000-XP combat lamps are covered by regressions; final battles and reward use still need MCP verification. The excavation winch currently blocks further natural progress and is being implemented.

## Checks

The server build passes. The focused quest, quest dialogue, NPC dialogue, rune pouch, disconnect, object teleport, death-item, door, charter, pet, consumable, ammunition and Vorkath suites cover 536 passing regressions after updating the war-room return expectation to its recorded tile. The agent MCP smoke also passes in the DT2 integration worktree.

For manual WGS testing, use this worktree's client URL, complete its prerequisites and start with Ivy Sophista in Taverley. Follow the quest journal and check that re-entering completed puzzle rooms or talking after completion does not duplicate rewards. Source references are the [OSRS Wiki quest guide](https://oldschool.runescape.wiki/w/While_Guthix_Sleeps) and transcript, with IDs validated against this repository's cache.
