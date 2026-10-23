import { writeFile, rename } from "node:fs/promises";

const destination = new URL("../data/definitions/item-prices.json", import.meta.url);
const temporary = new URL("../data/definitions/item-prices.json.tmp", import.meta.url);
const headers = { "User-Agent": "elvarg-typescript item-price fetcher" };
const signal = AbortSignal.timeout(30_000);

const ENDPOINTS = {
  latest: "https://prices.runescape.wiki/api/v2/osrs/latest",
  day: "https://prices.runescape.wiki/api/v2/osrs/24h",
  mapping: "https://prices.runescape.wiki/api/v2/osrs/mapping",
};

async function fetchJson(label, url) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) throw new Error(`${label} fetch failed: HTTP ${response.status}`);
  return response.json();
}

function requireData(label, payload) {
  if (!payload?.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    throw new Error(`${label} API returned no data object`);
  }
  return payload.data;
}

const safeInt = (value) => (Number.isSafeInteger(value) ? value : null);
const volume = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);

const [latestPayload, dayPayload, mapping] = await Promise.all([
  fetchJson("latest", ENDPOINTS.latest),
  fetchJson("24h", ENDPOINTS.day),
  fetchJson("mapping", ENDPOINTS.mapping),
]);

const latest = requireData("latest", latestPayload);
const day = requireData("24h", dayPayload);
if (!Object.keys(latest).length) throw new Error("Latest price API returned no item prices");
if (!Array.isArray(mapping) || !mapping.length) throw new Error("Mapping API returned no items");

const mapped = new Map();
for (const item of mapping) {
  if (item && Number.isSafeInteger(item.id)) mapped.set(item.id, item);
}
if (!mapped.size) throw new Error("Mapping API returned no item ids");

const ids = [...new Set([...Object.keys(latest).map(Number), ...mapped.keys()])]
  .filter((id) => Number.isSafeInteger(id) && id >= 0)
  .sort((a, b) => a - b);

const data = {};
for (const id of ids) {
  const live = latest[id] ?? {};
  const recent = day[id] ?? {};
  const item = mapped.get(id);
  const quote = {
    high: safeInt(live.high),
    highTime: safeInt(live.highTime),
    low: safeInt(live.low),
    lowTime: safeInt(live.lowTime),
    highVolume: volume(recent.highPriceVolume),
    lowVolume: volume(recent.lowPriceVolume),
    limit: item ? safeInt(item.limit) : null,
  };
  // Only mapped ids get alch keys: the loader overrides its export alch values for these,
  // and leaves items the mapping does not know untouched.
  if (item) {
    quote.highAlch = safeInt(item.highalch);
    quote.lowAlch = safeInt(item.lowalch);
  }
  data[id] = quote;
}

const json = JSON.stringify({ data });
await writeFile(temporary, json);
await rename(temporary, destination);
console.info(
  `Saved ${ids.length} item prices to ${destination.pathname} ` +
    `(latest=${Object.keys(latest).length}, 24h=${Object.keys(day).length}, mapping=${mapped.size})`
);
