# Issue 196 play-through checkpoint

This draft covers the remaining quests in [issue 196](https://github.com/RSPSApp/tsps/issues/196). While Guthix Sleeps has reached its first complete integrated MCP play-through. Song of the Elves and The Blood Moon Rises are included as work in progress; the other four quest branches still need integration and final checks.

## While Guthix Sleeps

The `Wgsnatural` actor followed quest actions through Movario's base, the fellowship, Black Knight HQ and Dark Squall infiltration, Surok's fight, Lucien's camp, the chasm, all eight temple statues, the Balance Elemental and both tormented demons. Fixes were checked by continuing from earned checkpoints. WGS stages and puzzle items were not granted through commands.

Preparation fixtures supplied prerequisite quest flags/skills and ordinary equipment, runes, food, tools, gems, fuel and transport outside battles. The actor crafted, fuelled and lit its sapphire lantern, used the Games necklace and northern rock crossing, collected chasm/temple ingredients, and used normal spells and attacks in combat. Separate component runs used explicit starting checkpoints; those are additional coverage rather than fresh-account completions.

The final alliance dialogue awarded exactly 5 QP, 80,000 Thieving XP, 75,000 Farming XP, 75,000 Herblore XP and 50,000 Hunter XP. Logout saved stage 900 and the earned rewards in SQLite. Headless MCP screenshots were inspected for Black Knight HQ and the Tears of Guthix arrival route.

## Blood Moon component checks

The preparation component collects materials from the palace and performs the stew, sickle, flail and stake recipes, including their confirmation menus. The bridge component uses the supplied ballista/javelins to defeat portals through ordinary ranged attacks. The hall component takes a potion from the crate, heals its owned injured Aranei and repairs pillars; the natural integrity timer reaches the breach and creates Lowerniel's encounter. The saved defence checkpoint retains participation, repairs/healing, zero integrity and the breach phase after logout.

Blood Moon's earlier/later story chapters, the remaining bosses still need further checks. MCP also verified that relog restores the barricade and passing it resumes Lowerniel's owned encounter. The hall timer and some scripted placements are inferred and marked `shortcut:` for later calibration against live OSRS recordings.

## Checks

The server build passes. The focused quest, quest dialogue, NPC dialogue, rune pouch, disconnect, object teleport and death-item regression suites pass: 361 tests, zero failures.

For manual WGS testing, use this worktree's client URL, complete its prerequisites and start with Ivy Sophista in Taverley. Follow the quest journal and check that re-entering completed puzzle rooms or talking after completion does not duplicate rewards. Source references are the [OSRS Wiki quest guide](https://oldschool.runescape.wiki/w/While_Guthix_Sleeps) and transcript, with IDs validated against this repository's cache.
