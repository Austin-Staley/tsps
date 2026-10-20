# Herblore

`server/plugins/skills/Herblore.plugin.js` (members), with one unit per activity in
`server/plugins/skills/herblore/`. Herbs and recipes are data, in
`server/plugins/skills/data/herblore.json`, named by cache gameval.

## Sources

- **Recipes, levels, XP and ticks:** the OSRS Wiki's recipe data (the `recipe` bucket behind each
  item's Creation section, https://oldschool.runescape.wiki/w/Herblore and the potion pages).
  The cache has no recipe table, and nothing in it holds XP.
- **Levels:** also checked against the cache's own skill guide (dbtable 213
  `skill_feature_herblore_*`) by `tests/herblore.test.cjs`.
- **Messages, animation, sounds and timing:** rsprox captures (https://rsprox.net/database).
  Normal-world recordings: 239, 3140, 4098, 4100, 4213 (rev 227-238). Many Herblore recordings are
  Leagues worlds, where potions come out with 4 doses; they were used for message text only.

## Cleaning

Recording 4213; the level message is from recordings 1757 and 1835.

- **Clean** swaps the grimy herb for the clean one in the same slot. There is no delay: several
  clicks in one tick each clean a herb.
- **Sound:** one of synth 3920, 3921, 3922 or 3923, picked at random.
- **Message:** "You clean the Grimy ranarr weed." (spam filter), naming the grimy herb.
- **Below the level:** "You need level 25 Herblore to clean the Grimy ranarr weed."
- **XP** is the Wiki's: guam 2.5 up to torstol 15. Huasca, toadflax, snapdragon and lantadyme are
  included.

## Mixing

- **Unfinished potions** give no XP (111 captured makes, no XP drop). The message names the herb
  in title case: "You put the Ranarr Weed into the vial of water."; the vial of blood one is
  "You put the Cadantine into the vial of blood.". Corals keep their case ("Pillar coral").
- **Finished potions:** "You mix the snape grass into your potion." Each secondary has its own
  wording ("the eggs", "the wine", "the Mort Myre fungi", "the dragon scale", "the unicorn horn"
  for antipoison); blood potions say "into your blood potion"; the Sailing potions say "into the
  potion" (haddock eye, rainbow crab paste).
- **Animation and sound:** `human_herbing_vial` (363) and synth 2608 with every step.
  `Sound.POTION_MIX` (2611), which the old plugin used, is not it.
- **Below the level:** "You need a Herblore level of 38 to combine those." (captured).
- **Herblore cape:** a grimy herb goes straight into a vial of water. Recording 3140 shows both
  messages, "You clean the Grimy marrentill." then "You put the Marrentill into the vial of
  water.", with the cleaning XP and no animation or sound.

## Druidic Ritual

Herblore needs Druidic Ritual (dbrow `skill_feature_herblore_overview_0`). Without it, cleaning and
mixing say the skill guide's sentence, "You must complete the Druidic Ritual quest to unlock the
Herblore skill." Live's message has no capture. A world without the quest system does not lock
Herblore.

## Not captured

These messages follow the captured pattern but have no recording of their own:

- "You mix the cotton yarn into your potion." (haemostatic dressing)
- "You mix the crab paste into the potion." (super hunter potion)
- "You mix the squid paste into the potion." (haemostatic poultice)
- "You mix the kebbit teeth dust into your potion." (hunter potion)
- "You mix the yew roots into your potion.", "You mix the magic roots into your potion." (antidotes)
- "You mix the poison ivy berries into your potion." (weapon poison++)
- "You mix the nihil dust into your potion." (ancient brew)
- "You put the Toadflax into the coconut milk." (the four coconut milk unfinished potions)
- Superantipoison reuses antipoison's "You mix the unicorn horn into your potion."
- Goading and prayer regeneration were both captured with aldarium, once as "the Aldarium" and
  once as "the aldarium"; which is which is a guess.

## Experience

tsps stores whole XP: `SkillManager` floors the stored value on the next gain, so a potion's half
XP point (antipoison's 37.5) is lost. The data keeps the Wiki's values for when tsps stores tenths
as live does.
