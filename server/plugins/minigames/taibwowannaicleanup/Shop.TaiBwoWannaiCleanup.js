/**
 * Tai Bwo Wannai Cleanup: Gabooty's shops, where the trading sticks are spent.
 *
 * The Cooperative (https://oldschool.runescape.wiki/w/Gabooty%27s_Tai_Bwo_Wannai_Cooperative.)
 * sells at 120% of an item's value and buys at 60%; with Karamja gloves worn, 100% and 80%
 * (Wiki). It lists 30 lines in the order rsprox 227/01858 shows them (tick 17116), the gems and
 * the gout tuber at 0: they are bought (red topaz +120, jade +90 in 01858) but never join the
 * stock, which stays at 0 after a sale. The generated shops.json has only the 23 stocked lines and
 * no prices, so both versions are given here (registerDefinitionSource), with the Wiki's store
 * multipliers. The two versions keep their own stock.
 *
 * Both of Gabooty's shops open only once the player has asked him "What do you do here?" (Wiki);
 * his transcript's "Can you open the shop please?" is guarded by that. Trade-Co-op and
 * Trade-Drinks before it play his conversation instead (not recorded). The generated data binds
 * both shops to op 3, which Shopkeepers drops as a conflict, so the ops are bound here.
 */
const fs = require("fs");
const path = require("path");
const Common = require("./Common.TaiBwoWannaiCleanup");

const ASKED_ATTRIBUTE = "tai-bwo-wannai-cleanup:asked-gabooty";

const shopData = () => Common.data.shop;
const versionName = (shop, version) => `${shop}${shopData().versions[version]}`;

function wearsKaramjaGloves(player) {
  const worn = player.getEquipment().getItems()[Common.core.Equipment.HANDS_SLOT];
  const id = worn ? worn.getId() : -1;
  return id > 0 && shopData().gloves.some((name) => Common.objId(name) === id);
}

const asked = (player) => player.getAttribute(ASKED_ATTRIBUTE) === true;

/** The version of `shop` (a base name) this player is served: the gloves one while they're worn. */
function versionFor(player, shop) {
  return versionName(shop, wearsKaramjaGloves(player) ? "gloves" : "default");
}

function shopId(name) {
  return Common.core.ShopDefinition.all().find((definition) => definition.getName() === name)?.getId() ?? null;
}

/** The generated ids of the Cooperative's two versions, read from shops.json by name. */
function generatedIds() {
  const file = path.join(Common.core.GameConstants.DEFINITIONS_DIRECTORY, "shops.json");
  const shops = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = new Map();
  for (const version of Object.keys(shopData().versions)) {
    const found = shops.find((shop) => shop?.name === versionName(shopData().coop, version));
    if (found) ids.set(version, found.id);
  }
  return ids;
}

/** Both Cooperative versions, with the recorded stock order and the Wiki's multipliers. */
function cooperativeDefinitions() {
  const { currency, coop, multipliers, stock } = shopData();
  const originalStock = stock.map(([item, amount, restockTicks]) => ({ id: Common.objId(item), amount, restockTicks }));
  return [...generatedIds()].map(([version, id]) => ({
    id,
    name: versionName(coop, version),
    currency,
    originalStock,
    sellMultiplier: multipliers[version].sell,
    buyMultiplier: multipliers[version].buy,
    stocksSoldItems: false,
  }));
}

const isGabooty = (event) => event.definition?.getName?.() === "Gabooty";
const gabootyShop = (name) => [shopData().coop, shopData().drinks].some((shop) =>
  Object.keys(shopData().versions).some((version) => versionName(shop, version) === name));

/** Opens `shop` (a base name) for the player, or plays Gabooty's conversation until they've asked. */
function trade(event, shop) {
  const { player } = event;
  event.handled = true;
  if (!asked(player)) {
    Common.api.emitCustomEvent("npc-dialogue:start", { player, npc: event.npc, npcId: event.npcId, handled: false });
    return true;
  }
  const id = shopId(versionFor(player, shop));
  if (id !== null) Common.core.ShopManager.open(player, id, true);
  return true;
}

const tradeCoop = (event) => trade(event, shopData().coop);
const tradeDrinks = (event) => trade(event, shopData().drinks);

/** His "What do you do here?" unlocks the shops. */
function onChoice(event) {
  if (isGabooty(event) && event.option === shopData().asked.option) event.player.setAttribute(ASKED_ATTRIBUTE, true);
}

function answerCondition(event) {
  if (!isGabooty(event) || event.text !== shopData().asked.condition) return undefined;
  return asked(event.player);
}

/** His transcript's open_shop steps list both versions: the gloves one while they're worn. */
function pickVersion(request) {
  if (!gabootyShop(request.shops?.[0])) return;
  request.shop = versionFor(request.player, request.target);
}

/** Every way into either shop waits for the question. */
function canShop(event) {
  if (event.shopId == null) return;
  const name = Common.core.ShopDefinition.forId(event.shopId)?.getName?.();
  if (gabootyShop(name) && !asked(event.player)) event.allow = false;
}

function attachShop(api) {
  api.persistAttribute(ASKED_ATTRIBUTE, false);
  api.registerDefinitionSource("shops", { name: "tai-bwo-wannai-cooperative", load: cooperativeDefinitions });
  api.onNpcInteraction("Gabooty", { "Trade-Co-op": tradeCoop, "Trade-Drinks": tradeDrinks });
  api.onCustomEvent("npc-dialogue:choice", onChoice);
  api.onNpcDialogueCondition(answerCondition);
  api.onCustomEvent("npc-dialogue:shop", pickVersion);
  api.onCanShop(canShop);
}

module.exports = { attachShop, ASKED_ATTRIBUTE, wearsKaramjaGloves, versionFor, shopId, cooperativeDefinitions, answerCondition };
