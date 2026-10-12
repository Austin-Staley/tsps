# Quest Helper

OSRS guide content from [Zoinkwiz's RuneLite Quest Helper](https://github.com/Zoinkwiz/quest-helper),
pinned to `08bb7c55ffc5aa61b7f4df61820967d63157e389`.
**Disabled by default.** Enable Quest Helper in Configuration to open its sidebar.
An existing saved enablement preference still follows the normal plugin settings behavior.

## Coverage

The catalog includes all **213 F2P, P2P and miniquest entries** in the pinned upstream catalog,
including separate Shield of Arrav routes, RFD subquests and the additional balloon guides.
Guide assets contain upstream authored static instructions, literal world points, dialogue
choices and statically resolvable item requirements/alternatives. No guide is adapted to this
server's quest implementations. The catalog includes guides regardless of server registration.

**This is not yet a complete executable port of RuneLite Quest Helper.** Nine guides have
automatic step selection: Cook's Assistant, Sheep Shearer, Doric's Quest, Imp Catcher,
Witch's Potion, Rune Mysteries, The Restless Ghost, Druidic Ritual and Waterfall Quest.
These resolvers follow upstream's stage tables and ordered conditions, using the client's
OSRS varps/varbits, inventory, equipment, observed bank, dialogue and scene state.
Player location, including the floor, comes from the synced local player. Item steps keep
their upstream minimap/world-map navigation point, while scene arrows and highlights follow
actual matching ground items on the player's floor. Empty navigation tiles are not marked
as item spawns, and despawned items lose their markers.
The sidebar identifies the other **204 guides as manual step selection** in their start-button tooltip and displays a notice when selected. Select an upstream
step to show its instructions, item checks and available target markers. Importing their
text does not port their Java condition graphs, computed instructions or puzzle solvers.
Each distributed guide asset retains its exact upstream source URL for comparison.

Quest status comes from the same cache script as RuneLite (`QUEST_STATUS_GET`, 4029).
The helper has no server plugin, saved-stage translation, mill facts, journal fallback or
`::questhelper` command. Unknown stages have no automatic step: there is no replacement
walkthrough that conceals a quest-state mismatch. The helper never changes quest progress.

Examples of upstream behavior retained:

- Cook's Assistant gathers ingredients before starting, uses egg tile **3177,3296**, checks
  `MILL_FLOUR`, and remembers partial hand-ins through the original dialogue messages.
- Sheep Shearer uses OSRS varp 179 for remaining wool, picks up shears from Fred's house,
  allows partial hand-ins, and handles a full inventory. Doric's stage 10 is also upstream.
- Rune Mysteries checks package/notes varbits rather than treating the stage alone as sufficient.
- The Restless Ghost checks the spawned ghost, open coffin and skull varbit. The Wizards'
  Tower basement altar is upstream behavior, not a server workaround.
- Waterfall includes the raft, rope crossings, barrel, bookcase, separate tomb relics,
  equipped amulet, dungeon key, six pillars and **urn-on-chalice** interaction. It does not
  bypass missing server interactions or replace this route with the simplified TSPS route.

Server quest bugs are deliberately left for separate gameplay fixes. Static world markers
are still suppressed inside instances until template-coordinate mapping is implemented.
Bank observations only cover the client's bank container; potion/group storage, inventory
and widget highlighting, model outlines and puzzle overlays remain unported.
Not every quest has been played end to end.

## Sidebar and navigation

The web sidebar follows the pinned upstream `QuestHelperPanel`, `QuestSelectPanel`,
`QuestOverviewPanel`, `QuestRequirementsPanel` and `QuestStepPanel`: 225-pixel content,
original RuneLite fonts and plugin icons, compact status-colored quest rows, the
Filters/Difficulty/Ordering controls, a collapsible skill filter, search, overview requirements
and rewards, and collapsible authored step sections. Active section headings and instructions
use RuneLite's orange. Required item checks use inventory/equipment and observed bank state.
Completed quests are hidden by default, following upstream. Source quest-order lists provide
optimal, ironman and release ordering; quest-point ordering uses the authored point rewards.

The importer extracts literal overview data and authored `PanelDetails` groups alongside the
steps. It resolves groups for 208 entries; five with dynamic/inherited panel construction use
an ungrouped steps section. General requirement descriptions are static text. Requirements
without a resolvable item ID remain text rather than fabricated item checks. This is a visual
port of the supported catalog, **not full UI feature parity**: requirements-based availability,
transitive skill filtering, seasonal region filters, advanced assistance settings, per-profile
filter persistence and dynamically constructed panels remain unported.

Quest minimap arrows now use the upstream `DirectionArrow` shape and placement: nearby arrows
point down at the target, and distant arrows point outward from the minimap rim with no maximum
range. The native server hint marker retains its own distance behavior and priority. Rotation,
zoom, render scaling and flashing still apply. Scene item arrows remain a separate collection
of actual ground-item positions.

## Representative quest check

Only Waterfall Quest was sampled for gameplay compatibility in the sidebar/navigation update.
The first upstream instruction loads correctly, but its server implementation is not yet an
OSRS walkthrough: Hadley supplies the book through a dialogue choice instead of searching the
bookcase; the tomb entrance immediately grants both relics; the statue consumes them; and the
chalice directly consumes runes instead of the six pillars and urn-on-chalice route. Exercising
the production Golrie action granted the pebble and sent varp 65 = 4, but did not send OSRS
`WATERFALL_GOLRIE_CHAT` (9110), which upstream uses to select the next section. These are
server gameplay/state discrepancies, left unchanged for separate quest fixes. The Cook's
windmill fix therefore does not establish compatibility for other quests.

## Importing and memory

From the repository root:

```sh
node client/scripts/import-quest-helper.mjs <pinned-quest-helper-checkout> <RuneLite-Quest.java>
```

The current import uses RuneLite `3bcd3ce4ddd3490394a9a3dec72b6aa3c4462e91`, matching
the generated gameval identifiers. The importer refuses a different quest-helper revision.
It writes the catalog, ordering presets, original icons/fonts and separate JSON guide assets in `client/public/quest-helper/`.
BSD notices are retained in `LICENSE-QuestHelper.txt` and the distributed `quest-helper/LICENSE.txt`.

Only the selected JSON guide is fetched and retained. Switching, stopping, disabling or
logging out releases it; stale fetch responses are ignored. Disabled plugins do not fetch
guides or run quest checks. Guide JSON totals approximately 1.52 MB (396 KB gzip across all guides); overview data stays in the selected guide. Guide assets are outside the initial JavaScript bundle.
Asset byte sizes are not measurements of browser heap usage.

## Verification

- `yarn --cwd client typecheck`
- `yarn --cwd client test quest-helper hint-arrow-tile minimap-redraw`
- `yarn --cwd client build`
- `yarn --cwd server build`
- From `server/`: `node --test tests/quest-plugins.test.cjs tests/quest-command.test.cjs tests/quest-dialogue.test.cjs`

Client tests also check imported sections/overview metadata, index validation, rendered sidebar content, filtering/ordering, completed-quest defaults and long-range minimap geometry. Client tests validate every catalog asset, parser edge cases, alternative items, OSRS
conditional examples for all nine resolvers, unknown stages, CS2 completion, default-off
behavior, manual selection, lazy loading, malformed data, stale responses, logout/disable
cleanup and server hint precedence. Regression checks also cover synced floor changes,
the mill's Fill/Operate steps, multiple actual egg spawns, despawn cleanup and wrong-floor
items. The server quest suites have 190 passing tests.

Live checks used this worktree's browser client and agent MCP at port 49812. The plugin
was visibly off before enabling; the catalog, Cook's raw-varp status and upstream egg tile,
Dragon Slayer II manual selection, overlay and disable cleanup were checked. Inventory and
starting stage were admin fixtures, not an end-to-end quest walkthrough. The removed
`::questhelper` command was confirmed unavailable. Quest Helper was disabled again after testing.
