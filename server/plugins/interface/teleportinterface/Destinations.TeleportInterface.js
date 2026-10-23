/**
 * The ::teleports destinations from data/teleports.json, and the rows each tab shows.
 * A destination's row id is its position in the file, so ids only have to agree between a
 * player's open interface and the server; anything saved uses the destination's key.
 */
const DATA = require("../data/teleports.json");

const TAB = Object.fromEntries(DATA.tabs.map(({ key }) => [key.toUpperCase(), key]));
const TAB_ORDER = DATA.tabs.map(({ key }) => key);
const TAB_LABELS = Object.fromEntries(DATA.tabs.map(({ key, label }) => [key, label]));
// Header rows need ids the client accepts, clear of every destination's.
const HEADER_ID_BASE = 10000;

const DESTINATIONS = DATA.destinations.map((entry, index) => ({
  ...entry,
  id: index + 1,
  tabs: [].concat(entry.tab),
  type: entry.type ?? "NORMAL",
}));
const BY_ID = new Map(DESTINATIONS.map((entry) => [entry.id, entry]));
const BY_KEY = new Map(DESTINATIONS.map((entry) => [entry.key, entry]));

let core;
const iconIds = new Map();
const wildernessLevels = new Map();

function init(pluginApi) {
  core = pluginApi.core;
}

/** The item id a destination's icon names, or -1 when the cache does not know it. */
function iconId(entry) {
  if (!iconIds.has(entry.key)) iconIds.set(entry.key, core.CacheDefinitions.getObjId(entry.icon) ?? -1);
  return iconIds.get(entry.key);
}

function location(entry) {
  return new core.Location(...entry.tile);
}

/** The Wilderness level a destination lands in; 0 off PvP ground (Corp's cave sits in a levelled box). */
function wildernessLevel(entry) {
  if (!wildernessLevels.has(entry.key)) {
    const level = core.Wilderness.isInLocation(location(entry)) ? core.Wilderness.levelAt(entry.tile[0], entry.tile[1]) : 0;
    wildernessLevels.set(entry.key, level);
  }
  return wildernessLevels.get(entry.key);
}

function row(entry) {
  const level = wildernessLevel(entry);
  return { id: entry.id, name: entry.name, icon: iconId(entry), detail: level > 0 ? ` Lvl ${level}` : "", terms: entry.terms ?? "" };
}

/** Rows under headers, in the order each header first appears, each section sorted by name. */
function grouped(entries, headerOf) {
  const sections = new Map();
  for (const entry of entries) {
    const header = headerOf(entry);
    if (!sections.has(header)) sections.set(header, []);
    sections.get(header).push(entry);
  }
  const rows = [];
  for (const [header, members] of sections) {
    rows.push({ id: HEADER_ID_BASE + rows.length, name: header, header: true });
    for (const entry of [...members].sort((a, b) => a.name.localeCompare(b.name))) rows.push(row(entry));
  }
  return rows;
}

/** Favourites by name, then the most recent teleports, newest first. */
function savedRows(favouriteKeys, recentKeys) {
  const rows = [];
  const section = (name, entries) => {
    if (entries.length === 0) return;
    rows.push({ id: HEADER_ID_BASE + rows.length, name, header: true });
    for (const entry of entries) rows.push(row(entry));
  };
  const known = (keys) => keys.map((key) => BY_KEY.get(key)).filter(Boolean);
  section("Favourites", known(favouriteKeys).sort((a, b) => a.name.localeCompare(b.name)));
  section("Recent", known(recentKeys));
  return rows;
}

function rowsFor(tab, favouriteKeys = [], recentKeys = []) {
  if (tab === TAB.SAVED) return savedRows(favouriteKeys, recentKeys);
  if (tab === TAB.ALL) return grouped(DESTINATIONS, (entry) => TAB_LABELS[entry.tabs[0]]);
  return grouped(DESTINATIONS.filter((entry) => entry.tabs.includes(tab)), (entry) => entry.group ?? TAB_LABELS[tab]);
}

module.exports = {
  TAB, TAB_ORDER, TAB_LABELS, DESTINATIONS, init, iconId, location, wildernessLevel, rowsFor,
  byId: (id) => BY_ID.get(id),
  byKey: (key) => BY_KEY.get(key),
};
