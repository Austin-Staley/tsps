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

### Make-X and timing

Recordings 239, 3140, 4098, 4100, 4213. Using one ingredient on the other opens the skillmulti
menu in the chatbox: clientscript 2046 (`skillmulti_setup`) with first argument 0, the title "How
many do you wish to make?" and the product, and the most the inventory makes as both the limit and
the amount it opens on. With only one to make there is no menu.

Ticks count from the click in the menu:

| Tick | Captured |
| --- | --- |
| 0 | the menu closes; `human_herbing_vial` and synth 2608, no product yet |
| 1 | the first product, with the animation, the sound and the message |
| then | one more every 1 tick (unfinished potions), 2 ticks (potions) or 3 ticks (forgotten brew, extended anti-venom+), each with the animation and sound |

The Herblore cape's grimy herbs (recording 3140) start on tick 0 and go every tick. The Wiki's
recipe data gives the same ticks per recipe.

### Potions made from potions

The Wiki's recipes, one row per dose where the dose count matters:

- **One secondary per dose:** stamina (amylase), extended antifire and extended super antifire
  (lava scale shards), extended stamina (marlin scales), extreme energy (yellow fin), the divine
  potions (crystal dust), extended anti-venom+ (araxyte venom sac). Anti-venom takes 5 Zulrah's
  scales per dose, forgotten brew 20 ancient essence. The message counts them: "You mix 4
  crystals of amylase into your potion.", "You mix 4 pieces of crushed crystal into your potion.",
  "You mix 4 lava scale shards into your potion." (captured).
- **Four-dose only:** super combat (super attack, strength and defence (4) with a torstol or torstol
  potion (unf); captured: "You carefully mix the potions and torstol together.", the attack and
  strength potions leave empty vials), super antifire (crushed superior dragon bones, captured
  message), anti-venom+ (torstol).
- **Sanfew serum** in three steps, each its own XP (Wiki): unicorn horn dust into a super restore,
  then snake weed, then a nail beast nail: "You mix the nail beast nail into your potion and make a
  3-dose Sanfew Serum." (captured).
- **Below the level:** "You need level 77 Herblore to upgrade the potion." (captured).
- **Quests (Wiki):** super antifire and extended super antifire need Dragon Slayer II, with the
  captured "You don't know how to make super antifire potions yet. Maybe someone can teach you.";
  the divine potions need Song of the Elves; the sanfew steps need Zogre Flesh Eaters started, the
  last one finished. Those other refusals have no capture and say "Nothing interesting happens."
  as a missing ingredient does.

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
- "You mix the ancient essence into your potion." (forgotten brew)
- "You mix the torstol into your potion." (anti-venom+)
- A super combat made with a torstol potion (unf) leaving three empty vials, not two
- Superantipoison reuses antipoison's "You mix the unicorn horn into your potion."
- Goading and prayer regeneration were both captured with aldarium, once as "the Aldarium" and
  once as "the aldarium"; which is which is a guess.

## Experience

tsps stores whole XP: `SkillManager` floors the stored value on the next gain, so a potion's half
XP point (antipoison's 37.5) is lost. The data keeps the Wiki's values for when tsps stores tenths
as live does.
