# Region replacement packs

Each `<regionId>.pack` is loaded at startup by `MapRegionReplacementManager` and replaces the
cache map data for that region only. Format: version, archive ids, region x/y, then object map
bytes and terrain bytes (see `MapRegionReplacementManager.readPackSource`).

## 10821.pack — Haunted Mine flooded channel

This pack is frozen to cache revision 241 (`osrs-241_2026-09-30`) and changes exactly one
terrain setting: region 10821, plane 0, local (37,37) = world **2725,4453**, setting bit 0
`1 -> 0`. Overlay 156 and every other terrain field, the object map and all other planes are
unchanged.

Evidence: capture 1768 (rev 227.1) has lift 4938 Go-down land at 2725,4456, then ordinary
walk/run steps cross 2725,4453 with no teleport, force-walk, loc add/remove or varp/varbit
update on the way to the east stairs 4971 at 2746,4436. The pinned Quest Helper route
(06da90f982518a093f2fe1c9cfac5547fa7053d3) uses the same flooded-chamber route. Cache 241 marks
the whole y4453 row blocked, disconnecting the lift landing from the stairs; the capture proves
the single crossing tile was walkable. The adjacent water-row tiles stay blocked.

Validation: `server/tests/haunted-mine-terrain.test.cjs` compares all decoded terrain tiles and
object bytes against cache 241 (only the one setting differs, overlay 156 retained), then checks
that RegionManager loads the pack, PathFinder reaches the east-stairs approach tiles from
2725,4456, the neighbouring y4453 tiles remain blocked, and the boss door 4962 is still present
and must be opened normally. Regenerate from the pinned cache with the external script in the
fix report if the cache revision changes.
