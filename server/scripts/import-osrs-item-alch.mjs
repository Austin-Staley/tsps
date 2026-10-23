#!/usr/bin/env node
/**
 * Regenerate server/data/definitions/item-alch.json from the osrsreboxed item dump.
 *
 * Input: ../osrsreboxed-db/docs/items-complete.json (highalch/lowalch per item id).
 * Only the alchemy values are kept; the rest of the dump is not used at runtime.
 *
 * Usage:
 *   node scripts/import-osrs-item-alch.mjs [--items <items-complete.json>] [--check]
 *
 * Default items path: ../osrsreboxed-db/docs/items-complete.json relative to
 * the repo root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const destination = path.join(repoRoot, "server", "data", "definitions", "item-alch.json");

function parseArgs(argv) {
  let items;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--items") items = argv[++i];
    else if (argv[i] === "--check") check = true;
  }
  return {
    items: items
      ? path.resolve(items)
      : path.resolve(repoRoot, "..", "osrsreboxed-db", "docs", "items-complete.json"),
    check,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const args = parseArgs(process.argv.slice(2));
const dump = readJson(args.items);
if (!dump || typeof dump !== "object" || Array.isArray(dump)) {
  throw new Error(`${args.items}: expected an object of items`);
}

const rows = new Map();
for (const item of Object.values(dump)) {
  if (!item || !Number.isSafeInteger(item.id) || item.id < 0) continue;
  const highAlch = Number.isSafeInteger(item.highalch) ? item.highalch : null;
  const lowAlch = Number.isSafeInteger(item.lowalch) ? item.lowalch : null;
  if (highAlch == null || lowAlch == null) continue;
  rows.set(item.id, { highAlch, lowAlch });
}

const data = {};
for (const id of [...rows.keys()].sort((a, b) => a - b)) {
  data[id] = rows.get(id);
}

const json = JSON.stringify({ data });
if (args.check) {
  const current = fs.existsSync(destination) ? fs.readFileSync(destination, "utf8") : "";
  if (current !== json) {
    console.error(`${path.relative(repoRoot, destination)} is out of date; rerun without --check`);
    process.exit(1);
  }
  console.info(`${path.relative(repoRoot, destination)} is up to date (${rows.size} items)`);
} else {
  fs.writeFileSync(destination, json);
  console.info(`Saved ${rows.size} alchemy values to ${path.relative(repoRoot, destination)}`);
}
