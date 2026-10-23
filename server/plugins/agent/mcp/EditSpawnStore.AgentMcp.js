const fs = require("fs");

// Reads and writes the definition files the edit tools persist to
// (object-spawns.json, npc-spawns.json).
//
// The files are large and hand-maintained, so a write must not reformat untouched
// entries: every entry stays on its own line, exactly as the file already had it,
// and the file keeps its line endings. A tool that adds one spawn then shows a diff
// of one line, not of thirty thousand.

function readEntries(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw new Error(`Cannot read ${file}: ${error?.message ?? error}`);
  }
}

function writeEntries(file, entries) {
  let newline = "\n";
  let trailing = false;
  try {
    const original = fs.readFileSync(file, "utf8");
    if (original.includes("\r\n")) newline = "\r\n";
    trailing = original.endsWith("\n");
  } catch {
    // New file: LF, no trailing newline.
  }
  const body = entries.length === 0
    ? "[]"
    : `[${newline}${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(`,${newline}`)}${newline}]`;
  fs.writeFileSync(file, body + (trailing ? newline : ""));
}

/** Object spawns: { id, position: { x, y, z }, type, face, remove?, source? }. */
function createObjectSpawnStore(file) {
  const key = (entry) => `${entry?.position?.x},${entry?.position?.y},${entry?.position?.z}`;
  const matches = (entry, id, x, y, z, type) =>
    entry.id === id && key(entry) === `${x},${y},${z}` && (entry.type ?? 10) === type;
  return {
    file,
    read: () => readEntries(file),
    write: (entries) => writeEntries(file, entries),
    /**
     * The placement entry for this object on this tile, or undefined. Removal markers
     * do not count: the object is not placed by the file, so re-placing it has to add
     * an entry (and clear the marker) rather than treat it as already saved.
     */
    find: (entries, id, x, y, z, type, face) => entries.find((entry) =>
      matches(entry, id, x, y, z, type) && entry.remove !== true
      && (face === undefined || (entry.face ?? 0) === face)),
    /** Drops a placement entry, so the object is no longer placed by this file. */
    dropPlacement: (entries, id, x, y, z, type) => {
      const before = entries.length;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (matches(entry, id, x, y, z, type) && entry.remove !== true) entries.splice(i, 1);
      }
      return entries.length !== before;
    },
    /**
     * Drops a removal marker for this object on this tile. A razed tile keeps its
     * marker, which would delete a fresh placement of the same id and type on the
     * next load; placing therefore clears it first.
     */
    dropRemoval: (entries, id, x, y, z, type) => {
      const before = entries.length;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (matches(entry, id, x, y, z, type) && entry.remove === true) entries.splice(i, 1);
      }
      return entries.length !== before;
    },
  };
}

/** NPC spawns: { level, name, x, y, id, wanderRadius?, direction?, source? }. */
function createNpcSpawnStore(file) {
  return {
    file,
    read: () => readEntries(file),
    write: (entries) => writeEntries(file, entries),
    find: (entries, id, x, y, z) => entries.find((entry) =>
      entry.id === id && entry.x === x && entry.y === y && (entry.level ?? 0) === z),
  };
}

module.exports = { readEntries, writeEntries, createObjectSpawnStore, createNpcSpawnStore };
