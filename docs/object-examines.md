# Object examines

OSRS sends a loc's examine text from the server; the cache has none of it. The server reads it from `server/data/definitions/object-examines.json` (object id → text), which `ObjectDefinition.getExamine()` answers from. An object it doesn't cover still gets the generic `It's a/an <name>.`.

## Where the text comes from

- **The OSRS Wiki.** `yarn dump:object-examines` lists every scenery page from the Wiki's `infobox_scenery` bucket (6,101 pages), reads their `{{Infobox Scenery}}`, and pairs each version's ids with that version's examine (`|id1 = 1276` / `|examine1 = One of the most common trees in Gielinor.`). Links, formatting and refs are stripped; `N/A` means no examine. The Fireplace page gives one text for both states ("(Unlit) … (Lit) …"); a fireplace with a Light option gets the first half. When two pages give one id different texts, the first is kept and the script lists them (16 at the last run, all Wiki slips).
- **Live captures.** `object-examines-captured.json` holds the 163 examines recorded in rsprox captures (https://rsprox.net/database) on normal worlds, each paired with the object examined. They win over the Wiki: of the 163, 94 were missing from the Wiki pages' id lists (mostly Construction furniture and Sailing parts) or worded differently. Alpha, beta, Leagues and other event worlds are left out; a Sailing Alpha world's ids didn't match its revision's names.

The last run gave 15,304 objects. Rerun the script after a cache update or to pick up Wiki fixes; the captured file is kept as it is.

## The examine packet

A multi-loc's text can be recorded under the variant the player sees (a farming patch's growing state, as the captures show), so when the id the client sent has no text, the examine answers from the player's variant.

## Not modelled

- **The message type:** OSRS sends examines as their own chat type (`loc_examine`); they're sent as game messages.
