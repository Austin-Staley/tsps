# Map editing over MCP

The agent MCP can read the object/NPC cache, place and remove things in the live world, and
repaint or re-level terrain — all from tool calls, all persisted, all visible in the `?edit`
map editor. This is how an agent builds a structure (or a city) without a human clicking tiles.

Everything here is development-only: the tools register on the agent MCP server
(`AGENT_MCP=1`), which already only listens on `127.0.0.1`.

## The mental model

Three separate stores, and it matters which one you are touching:

| What | Where it lives | Who sees it |
| --- | --- | --- |
| Live objects/NPCs | the running world (`ObjectManager`, `World`) | players connected now |
| Persisted spawns | `data/definitions/object-spawns.json`, `npc-spawns.json` | everyone, after a server restart |
| Terrain | `data/regions/<id>.terrain.dat` or `<id>.pack` | players on scene rebuild; editor after sync |

A placement tool does the first two together: it registers the object immediately *and*
appends it to the spawn file. Terrain tools register a region replacement and write the pack.
Nothing needs a manual restart.

## Tools

### Objects

| Tool | Purpose |
| --- | --- |
| `search_objects` | Find cache locs by name fragment or id prefix |
| `describe_object` | Footprint, solid, blocks projectiles, options |
| `place_object` | Place one object (live + persisted) |
| `place_objects` | Place a batch in one call, one file write |
| `remove_object` | Remove object(s) on a tile, persisted |
| `clear_area` | Raze a rectangle: all objects on all planes + NPCs |
| `list_placed_objects` | What the spawn file holds, filterable by `source` |

### Building at a higher level

Element-by-element placement is fine for a door and wrong for a city. These tools take a
*shape* or a *preset* and expand it internally:

| Tool | Purpose |
| --- | --- |
| `build_shape` | One material, one shape: `line`, `ring`, `box`, `tower`, `repeated`, `avenue`, `column` |
| `build_preset` | A named structure from `plugins/agent/data/edit-presets.json` |
| `plan_build` | Dry run: counts, bounds, object mix — changes nothing |
| `list_presets` | Presets, their parameters, and the material names |

Shape semantics, so the coordinates are never a guess:

- `line`, `avenue`, `repeated` — `(x, y)` is the start, `(x2, y2)` the end.
- `ring` — `(x, y)` is the centre, plus `radius`, `thickness`, `gapDegrees`, `gapAngle`
  (`gapAngle` 0 = east, 90 = north).
- `box` — `(x, y)` is the low corner plus `width`, `height`, `doorSide`, `doorWidth`.
- `tower` — `(x, y)` low corner plus `width`, `height`; filled footprint.

Presets ship with `house`, `tower`, `gatehouse`, `plaza` and `tiered_city` (the ringed hill
city: four concentric walls with east gates, cardinal towers, keep). Example:

```jsonc
// one call: a 7x7 house shell with a south door
build_preset { "preset": "house", "x": 3090, "y": 3485, "params": { "width": 7, "height": 7 } }

// a whole ringed city, then check it before spending time
plan_build   { "preset": "tiered_city", "x": 3090, "y": 3485 }
build_preset { "preset": "tiered_city", "x": 3090, "y": 3485 }
```

#### Adding a preset or a material

Presets and materials are data, not code — edit `plugins/agent/data/edit-presets.json`. A
material is `{ "name": { "id": <cache id>, "about": "..." } }`; a preset is a list of parts:

```json
"gatehouse": {
  "about": "Gate flanked by battlement piers",
  "params": { "wall": "battlement", "gate": "gate" },
  "parts": [
    { "shape": "column", "material": "$wall", "dx": 0, "dy": -2 },
    { "shape": "column", "material": "$gate", "dx": 0, "dy": 0, "face": 1 }
  ]
}
```

`"$name"` reads a call parameter, `"-$name"` reads it negated. A preset with
`"repeat": { "radius": "$radii" }` runs its parts once per value of that parameter —
that is how `tiered_city` builds four rings. Keep material ids verified (`search_objects` /
`yarn dump:loc`); never hard-code ids in tool code.

### NPCs

`search_npcs`, `describe_npc`, `spawn_npc`, `remove_npc`, `list_spawned_npcs` — same pattern
as objects, persisted to `npc-spawns.json` with `level` (plane) and `wanderRadius`.

### Terrain

| Tool | Purpose |
| --- | --- |
| `describe_tile` | Overlay, underlay, height and flag for one tile |
| `paint_ground` | Overlay (paths/floors) and/or underlay over a rectangle |
| `set_height` | Raise/lower/flatten heights, one plane or all |
| `clear_terrain` | Restore a rectangle to the cache's own terrain |
| `list_region_packs` | Regions with active replacements |

Terrain is **visual only**: collision still comes from objects and the base map. If you level
a hill, build the floor you want to walk on with objects, or accept that movement follows the
cache.

## The 65 KB packet budget

This is the constraint that shapes larger builds, so it is worth understanding.

A region replacement is not a delta — the server sends the whole encoded 64×64×4-plane
terrain blob in one `REGION_REPLACEMENT` packet, and the client stores it wholesale. Packet
payload ceiling: `MapRegionReplacementManager.MAX_PACKET_PAYLOAD = 0xfffd` (65,533 bytes).

Cost per edited tile, on top of the cache's own encoding:

| Edit | Approx. cost |
| --- | --- |
| height | 3 bytes |
| overlay | 4 bytes |
| underlay | 4 bytes |

Dense regions (Edgeville, Lumbridge) start near 45 KB from the cache alone, leaving room for
roughly a few thousand tile edits — not enough to repaint and terrace a 90×71 site.

What actually works:

1. **Terrain-only replacements** — the tools never send object bytes for terrain edits, and the
   client falls back to the cache's objects. Keeps regions ~8 KB smaller.
2. **Clear first** — `clear_terrain` restores the cache encoding, the smallest form, freeing
   everything the previous edits added.
3. **Edit a smaller footprint** — paint the plateau and terraces, not every tile of a rectangle.
4. **Use more regions** — each region has its own budget and its own packet. Spreading a city
   across regions buys space linearly.

When a region overflows, the tool fails with
`region replacement is too large: region=<id> bytes=<n> max=65533`; nothing is half-applied.
Clean up with `clear_terrain` and try a smaller footprint. Removing the cap entirely would need
a chunked replacement protocol (split the terrain stream, reassemble client-side) — not
implemented here.

## Persistence format rules

`object-spawns.json` and `npc-spawns.json` are large, hand-maintained files. Writes preserve
them: one compact entry per line, the file's own line endings, untouched entries byte-identical.
Adding one spawn shows a one-line diff, not a 30,000-line reformat. Do not "tidy" these files
from a tool.

Object entry: `{ id, position: { x, y, z }, type?, face?, remove?, source? }`.
`remove: true` means "this cache object is gone" and is applied before placements on load.

## Editor integration

The standalone editor (`/?edit`, `/?editor`) is a logged-out scene preview. It pulls server
state on open and on **Refresh map**:

- `GET /regions` → active replacement ids
- `GET /regions/<id>.pack` or `/regions/<id>.terrain` → terrain bytes
- `GET /api/world/object-spawns` → persisted placements (rendered as spawn edits)

So an agent build appears in the editor without a login, and the same edits appear in-game to
logged-in players on scene rebuild (walk, teleport, relog).

## What the cache will and will not give you

Verified by building with them in-game; save yourself the round trip:

| Object | Verdict |
| --- | --- |
| `Castle wall` (16519), `Battlement` (2832) | Looks like proper grey crenellated stone |
| `Pillar` (6283, 3×3), `Column` (5228) | Render as huge dark monoliths — avoid at scale |
| `Marble wall` (5907) | Player-owned-house object; renders as brown wood outside |
| `Tower` (1939) | Brown ruined wooden cone, not a stone tower |
| `Fountain` (153) | Dark spiky shape |
| `White Tree patch` (9210) | A black spiky bush, not a tree |

Screenshot before committing to a look: the `vision_screenshot` tool captures what a headless
client sees, which is far cheaper than rebuilding a city twice.

## A worked build

```js
// 1. Site: flatten, then pave a plateau that fits the budget.
clear_area      { x1, y1, x2, y2 }                 // objects only, keeps terrain
clear_terrain   { x1, y1, x2, y2 }                 // back to cache encoding (frees bytes)
paint_ground    { x1, y1, x2, y2, overlay: 1 }     // dirt
set_height      { x1, y1, x2, y2, height: 57 }     // outer terrace
set_height      { x1, y1, x2, y2, height: 59 }     // inner terrace (nested)

// 2. Structure: presets and shapes, not single tiles.
build_preset    { preset: "tiered_city", x: 3090, y: 3485 }
build_shape     { shape: "avenue", material: "brazier", x: 3100, y: 3485, x2: 3120, y2: 3485, offset: 3 }
build_preset    { preset: "house", x: 3104, y: 3498, params: { width: 5, height: 5 } }

// 3. Life.
spawn_npc       { id: 3254, x: 3092, y: 3485, wanderRadius: 3 }
```

## Testing

```bash
node --test server/tests/edit-mcp.test.cjs          # objects
node --test server/tests/edit-world-mcp.test.cjs    # NPCs + terrain
node --test server/tests/edit-build-mcp.test.cjs    # geometry + presets + batches
```

The tests use fake cores and temp files, so they need no server. For a live check, start the
server with `AGENT_MCP=1` and drive the tools over HTTP; `observe` on a logged-in player
confirms a placement reached the world, and `describe_tile` confirms terrain.

## Conventions for new tools

- One file per area (`Edit*.AgentMcp.js`), registered in `AgentMcp.plugin.js`, helpers in
  `EditGeometry`/`EditSpawnStore` rather than copy-pasted.
- Validate in the handler, not only in the zod schema: the schema is not applied when a
  handler is called directly.
- Read paths from `process.env.AGENT_MCP_*` with the server's real path as the default, so
  tests never touch repo data.
- Never write a definition file per item; batch, then write once.
- Report counts and bounds, not thousands of entries.
