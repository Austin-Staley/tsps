/**
 * Shared Wilderness boss constants and helpers: the cave data (plugins/bosses/data/
 * wilderness-bosses.json), the fee's attribute keys and varbits, and small tick helpers.
 *
 * Behaviour: https://oldschool.runescape.wiki/w/Wilderness_bosses and the lairs' pages,
 * checked against rsprox captures (docs/wilderness-bosses.md).
 */
const DATA = require("../data/wilderness-bosses.json");

/** Varbits as captured: the fee paid, the discount earned, and "don't ask again". */
const VARBIT = Object.freeze({
  FEE_PAID: 14693, // wbr_entrance_fee_paid
  DISCOUNT: 14694, // wbr_entrance_discount
  FEE_WARNING: 14695, // wbr_entrance_fee_warning
  SINGLES_PLUS: 5961, // singleway_plus_indicator
});

const COINS = 995;
/** coins_10000, the item the fee boxes show. */
const COINS_ICON = 1004;

const ANIMATION = Object.freeze({
  CRAWL: 7041, // godwars_human_crawling
  LAND: 767, // human_falling_end
});

/** Persisted: whether the fee is paid, and how much of the next one is waived. */
const FEE_PAID_ATTRIBUTE = "wilderness-bosses:fee-paid";
const DISCOUNT_ATTRIBUTE = "wilderness-bosses:discount";
/** Persisted: what the player paid, which a player killer gets when the fee is lost. */
const FEE_AMOUNT_ATTRIBUTE = "wilderness-bosses:fee-amount";
/** Persisted: "Yes, and don't ask again." */
const NO_WARNING_ATTRIBUTE = "wilderness-bosses:no-fee-warning";
/** Persisted: been in a lair or the Escape Caves since last leaving the Wilderness. */
const VISITED_ATTRIBUTE = "wilderness-bosses:visited";
/** Persisted kill counts, by lair key: { callisto: 3, artio: 12 }. */
const KILLS_ATTRIBUTE = "wilderness-bosses:kills";

const LAIRS = DATA.lairs;
const LAIR_BY_KEY = new Map(LAIRS.map((lair) => [lair.key, lair]));
const ESCAPE = DATA.escapeCaves;
/** lair key -> the boss fight's lair hooks: spawned(npc, lair), playerTick(player, lair). */
const FIGHTS = new Map();

let api = null;
let core = null;
let wildernessRules = null;

function attach(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
}

function inBox(box, plane, location) {
  if (!location) return false;
  const x = location.getX?.() ?? location.x;
  const y = location.getY?.() ?? location.y;
  const z = location.getZ?.() ?? location.z;
  return z === plane && x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
}

/** The lair a tile is in, or null. */
function lairAt(location) {
  return LAIRS.find((lair) => inBox(lair.box, lair.plane, location)) ?? null;
}

function inEscapeCaves(location) {
  return inBox(ESCAPE.box, ESCAPE.plane, location);
}

/** A random tile of a [minX, minY, maxX, maxY, plane] box. */
function randomTile(box) {
  const x = box[0] + Math.floor(Math.random() * (box[2] - box[0] + 1));
  const y = box[1] + Math.floor(Math.random() * (box[3] - box[1] + 1));
  return new core.Location(x, y, box[4]);
}

function boundary(box, plane) {
  return new core.Boundary(box[0], box[2], box[1], box[3], plane);
}

function later(ticks, action, owner = null) {
  core.TaskManager.submit(new (class extends core.Task {
    constructor() {
      super(Math.max(1, ticks), owner, false);
    }

    execute() {
      this.stop();
      action();
    }
  })());
}

/**
 * The Wilderness plugin's area rules ("wilderness:rules"): an actor holds one area, so the caves'
 * own areas run these first. Asked on first use, once every plugin has registered.
 */
function rules() {
  if (!wildernessRules) {
    const request = { rules: null };
    api.emitCustomEvent("wilderness:rules", request);
    wildernessRules = request.rules;
  }
  return wildernessRules;
}

/**
 * A summoned NPC (a hellhound, a spiderling) attacks `target` once it is in the world: the add
 * queue only registers it at the end of the tick.
 */
function engage(npc, target, tries = 5) {
  later(1, () => {
    if (!target?.isRegistered?.() || target.getHitpoints() <= 0 || npc.getHitpoints() <= 0) return;
    if (!npc.isRegistered()) {
      if (tries > 1) engage(npc, target, tries - 1);
      return;
    }
    npc.getCombat().attack(target);
  });
}

function isDiaryComplete(player, tier) {
  const request = { player, diary: "wilderness", tier, complete: false };
  api.emitCustomEvent("diary:is-complete", request);
  return request.complete === true;
}

function kills(player, key) {
  return Number(player.getAttribute(KILLS_ATTRIBUTE)?.[key]) || 0;
}

module.exports = {
  DATA,
  VARBIT,
  COINS,
  COINS_ICON,
  ANIMATION,
  FEE_PAID_ATTRIBUTE,
  DISCOUNT_ATTRIBUTE,
  FEE_AMOUNT_ATTRIBUTE,
  NO_WARNING_ATTRIBUTE,
  VISITED_ATTRIBUTE,
  KILLS_ATTRIBUTE,
  LAIRS,
  LAIR_BY_KEY,
  ESCAPE,
  FIGHTS,
  attach,
  get api() {
    return api;
  },
  get core() {
    return core;
  },
  inBox,
  lairAt,
  inEscapeCaves,
  randomTile,
  boundary,
  later,
  rules,
  engage,
  isDiaryComplete,
  kills,
};
