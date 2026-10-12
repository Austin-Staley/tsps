# Quest Helper

A TSPS adaptation of [Zoinkwiz's RuneLite Quest Helper](https://github.com/Zoinkwiz/quest-helper),
reviewed at commit `08bb7c55ffc5aa61b7f4df61820967d63157e389`.
The original copyright notices and BSD terms are in `LICENSE-QuestHelper.txt`.

Enable **Quest Helper** in Configuration, open its sidebar icon, search for a quest and select it.
The sidebar shows the current step, required item counts, the live journal and, for adapted guides,
the full step list. Cyan targets appear in the scene, minimap and world map. Server hint arrows
take precedence. Stop, disable or log out to remove the helper's markers.

## Coverage and compatibility

This is a partial port of RuneLite's detailed guides, with live TSPS journal support for every
registered quest. On this branch there are **177 registered quests: nine detailed guides and
168 journal guides**. The sidebar labels these modes. Newly registered quests become available
automatically as journal guides, including on worlds that load only free-to-play quests.

| Detailed guide | TSPS adaptation |
| --- | --- |
| Cook's Assistant | Requires all three ingredients together. Uses a real farm egg spawn at 3185,3297; the general store supplies the bucket and pot. Uses the mill ladder, hopper, controls and per-player flour state. |
| Sheep Shearer | Tracks partial wool deliveries through saved stages 1–21 and subtracts wool already delivered. |
| Doric's Quest | Uses TSPS stages 10/100 and checks unnoted ore quantities 6/4/2. |
| Imp Catcher | Checks four separate bead IDs and the complete hand-in. |
| Witch's Potion | Separates the ingredient hand-in from drinking the cauldron at stage 2. |
| Rune Mysteries | Tracks all six stages; guides through the Wizards' Tower basement entrance. |
| The Restless Ghost | Checks that the ghostspeak amulet is equipped. Uses the basement altar and supports reclaiming a lost skull. |
| Druidic Ritual | Checks each enchanted meat, highlights only missing raw meats, and uses the dungeon entrance. |
| Waterfall Quest | Uses TSPS's stages and simplified relic/puzzle interactions. Its known travel gaps are shown in the panel. |

The server supplies its own saved stage and completion status. The client never assumes that a
RuneLite varp or varbit encodes the same stage. This avoids parent-varp bitfield collisions,
custom completion values and the server's mapped cache varps. Only the selected quest's journal
is evaluated each tick, and a compressed update is sent only when its snapshot changes.
The helper does not set quest stages, consume items or grant rewards.

## What needs work for full RuneLite parity

- **168 quests still need detailed guide ports.** Their current journal is live and usable,
  but automatic item requirements, dialogue recommendations and target markers need explicit
  mappings against the corresponding `server/plugins/quests/quests/*.Quest.js` handlers.
  Copying the upstream stage table directly is unsafe because TSPS stages differ.
- **Waterfall Quest needs server travel/content work:** raft/barrel/swimming access, dungeon
  doors and rune-on-pillar placements are documented as missing in its existing quest file.
  TSPS currently grants both relics at the tombstone, consumes both at the statue, then checks
  six air/water/earth runes at the chalice. The helper follows that implementation, but cannot
  supply a missing route. Complete those handlers before using the upstream route unchanged.
- **Windmill item-use parity:** using grain on the hopper currently says "Nothing interesting
  happens"; the hopper's **Fill** option works. The guide uses **Fill**. Add an item-on-object
  handler delegating to the existing milling handler if the upstream item-use interaction is wanted.
- **Instance markers need template-coordinate mapping.** Guidance continues inside instances,
  but static world markers are suppressed to avoid highlighting an unrelated tile.
- **RuneLite's puzzle solvers, bank checking, quest ordering, inventory/widget highlighting and
  NPC/object model outlines are not ported.** This version provides live text, inventory/equipment
  checks for the adapted steps, tile highlights and arrows. It does not automate gameplay.
- **Not every quest has been played end to end.** Journal validation proves the read path and
  registration, not that every quest's existing server interactions can be completed.

The Cook's Assistant file contains an outdated comment saying eggs are sold at the general store;
canonical `ground-items.json` and `shops.json` were checked instead. No egg-shop workaround or
ladder gameplay change is needed.

## Verification

- `yarn --cwd client typecheck`
- `yarn --cwd client test quest-helper hint-arrow-tile`
- `yarn --cwd client build`
- `yarn --cwd server build`
- From `server/`: `node --test tests/quest-plugins.test.cjs tests/quest-command.test.cjs tests/quest-dialogue.test.cjs tests/quest-helper.test.cjs`

The server tests cover all 177 journals at unstarted, started and completed stages, catalog
membership, inventory-driven updates, unchanged-snapshot suppression and read-only tracking.
Client checks cover all nine resolvers, partial wool deliveries, item quantities, equipped
requirements, late responses, completion, logout, disable, malformed data and hint precedence.

Live checks on this workspace's agent MCP and browser confirmed login, the sidebar catalog,
selection and current-step overlay, picking up the farm egg and advancing the helper, and the
mill ladder's floor 0→1→2 transitions. The grain/pot/bucket for milling were admin test fixtures;
the egg was taken from the actual ground spawn. Hopper **Fill** and controls **Operate** were
tested through real interaction handlers; grain-on-hopper was also tested and exposed the gap above.
The flour bin's **Empty** and the cow's **Milk** actions produced the remaining ingredients;
the Cook's real hand-in then completed the quest and removed the helper's target markers.
The starting stage was set with the admin quest command, so this was a gathering/hand-in check,
not a full walkthrough of the starting dialogue.
