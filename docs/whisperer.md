# The Whisperer

`plugins/bosses/Whisperer.plugin.js` owns a post-quest normal encounter. The DT2 quest's own scene and progress are unchanged. Depends on PR #882 for conditional loot and actual-damage observers. Awakened is deliberately unavailable: no orb prompt or consumption occurs.

The public normal Whisperer spawn is replaced at load with the cache's Odd Figure. Disturb requires completed Desert Treasure II and a real Blackstone fragment; the bank placeholder does not qualify. Ketla can replace a lost fragment. A PrivateArea isolates the cathedral and its Shadow Realm mirror per player. Tentacle exit/quick-escape, teleport, logout and death clean the session; login recovery returns a saved occupant outside. Graves relocate to the Camdozaal rope, with a 0.25 fee multiplier before five normal kills through the shared grave contract.

Normal mechanics include 900 HP, three threshold specials (720/495/270), progressively mixed prayer volleys checked at scheduled impact, moving tentacle paths, mirrored double melee hits, binding pursuit countered with ice/standard binding spells, sanity/prayer drain, insanity damage, 140 HP enrage, loot grading, kill count, PB and a 30-tick Odd Figure respawn. Actual HP loss drives perfect loot; queued encounter damage is cancelled on final death or cleanup. Souls count at lethal damage before delayed NPC death callbacks. The special damage reduction is 70% outside / 60% inside the Shadow Realm. Thrall damage uses the core's direct-hit path and therefore bypasses this PendingHit modifier.

Corrupted seeds use all four Wiki diagram patterns (24 or 28 seeds), shown with light/dark cache locs in the Shadow Realm and uniform locs outside. Screech uses eight columns, with one 60-HP column, one to three 40-HP columns and the rest 20 HP; cover is the two-by-two immediately behind a column, and every blast damages every surviving column. Soul Siphon has 12 one-HP souls in the Wiki's 2/3/3/4 sets, with healing, prayer, sanity and boss-damage rewards; souls are vulnerable only in the Shadow Realm.

## Source evidence

- [The Whisperer](https://oldschool.runescape.wiki/w/The_Whisperer): normal HP/max hits, 10-tick attack cycle, 30-tick respawn and standard drops.
- [Strategies](https://oldschool.runescape.wiki/w/The_Whisperer/Strategies): thresholds, projectile patterns, impact prayers, tentacle damage/sanity, special mechanics, enrage, grave placement and first-five-kills discount.
- [Floating Column](https://oldschool.runescape.wiki/w/Floating_Column): eight columns, normal health guarantees/cap and damage per screech.
- [Blackstone fragment](https://oldschool.runescape.wiki/w/Blackstone_fragment): required entry item, yellow special indicator, Ketla replacement.
- The four seed-route diagrams and screech video on the strategy page were inspected directly. Tile patterns are transcribed in `Specials.Whisperer.js`.

Rev241 cache gamevals/configs were inspected directly: NPCs 12203–12212, sequences 10227–10267, projectile spotanims 2444/2445/2467, seeds 47573–47575, escape/exit 47584–47586, sanity interface 834, and varbits 15064/15162/15067. Widget 834 loads CS2 1827; its 1828/1829 update path reads the sanity varbit (under varp 3939). Fragment 28356 is normal, 28357 glowing, and 28358 is a bank placeholder. Quest code's old tentacle animation constants 2452/2454 are spotanims, not the correct NPC sequences; this plugin uses the cache sequences.

## Verification limits

This is not a verified 1:1 implementation. Absolute seed anchoring/orientation, eight-column placement and the distribution beyond published health constraints are inferred from diagrams/video. Special animation timings, seed duration and binding flight timing need a packet capture. Normal melee's 28–42 roll and 75% protected share are provisional; the obtained source confirms max 42, mirrored double hits and partial protection but does not establish the complete distribution. Realm switching is permitted during specials; the exact fragment deactivation window is not captured. No in-game client smoke run has been performed.

Awakened geometry, timing, full five-projectile patterns, stat/slayer immunity integration, prayer/sanity changes, special rotations and final-phase mechanics are not implemented. No Awakened CA is awarded. Only kill-count/PB CA contracts are supplied; other CAs require full tracking before being enabled.

Focused tests use real rev241 cache configs, Player/NPC instances, equipment/inventory, HitDamage/HitQueue, skill levels, private areas and source hooks. Rendering/scheduling and deterministic accuracy are doubled only where the unit under test requires it. Build with `node node_modules/typescript/bin/tsc --build` and run `node --test tests/whisperer.test.cjs` from `server/`.
