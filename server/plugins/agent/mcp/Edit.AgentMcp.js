const path = require("path");
const { createObjectSpawnStore, createNpcSpawnStore } = require("./EditSpawnStore.AgentMcp");

// Map-editing tools for the agent MCP server: search the object (loc) cache, describe
// definitions, and place/remove live objects.
//
// Placements persist in data/definitions/object-spawns.json, so they survive restarts and
// show up in the ?edit map editor (spawn overlay after a sync, full scene for cache-map
// objects). Bulk building lives in EditBuild.AgentMcp.js (place_objects, build_shape,
// build_preset); this file is the single-object toolset it builds on.
module.exports = function registerEditTools(ctx) {
  const { core, tool, z } = ctx;
  const { GameObject, ObjectManager, Location, ObjectDefinition, CacheDefinitions, World, MapObjects } = core;

  // Overridable for tests; the server resolves it against its own working directory.
  const spawnsFile = () =>
    process.env.AGENT_MCP_SPAWNS_FILE ??
    path.resolve(process.cwd(), "data/definitions/object-spawns.json");
  const npcSpawnsFile = () =>
    process.env.AGENT_MCP_NPC_SPAWNS_FILE ??
    path.resolve(process.cwd(), "data/definitions/npc-spawns.json");

  const objectStore = () => createObjectSpawnStore(spawnsFile());
  const npcStore = () => createNpcSpawnStore(npcSpawnsFile());
  const readSpawns = () => objectStore().read();
  const writeSpawns = (spawns) => objectStore().write(spawns);
  const readNpcSpawnsFile = () => npcStore().read();
  const writeNpcSpawnsFile = (spawns) => npcStore().write(spawns);

  const sameTile = (entry, x, y, z) =>
    entry?.position?.x === x && entry?.position?.y === y && entry?.position?.z === z;

  const objectCount = () => CacheDefinitions.getCounts().objects;

  const checkBounds = (id, x, y, z, type, face) => {
    if (!Number.isInteger(id) || id < 0 || id >= objectCount()) {
      throw new Error(`Unknown object id ${id}; search_objects finds valid ids`);
    }
    for (const [name, value] of [["x", x], ["y", y]]) {
      if (!Number.isInteger(value) || value < 0 || value > 16383) {
        throw new Error(`Tile ${name}=${value} is outside the world (0-16383)`);
      }
    }
    if (!Number.isInteger(z) || z < 0 || z > 3) throw new Error(`Plane z=${z} is outside 0-3`);
    if (!Number.isInteger(type) || type < 0 || type > 22) {
      throw new Error(`Type ${type} is outside 0-22 (10 is a normal standing object)`);
    }
    if (!Number.isInteger(face) || face < 0 || face > 3) {
      throw new Error(`Face ${face} is outside 0-3`);
    }
  };

  tool(
    "search_objects",
    "Find placeable objects (locs) by name: walls, doors, trees, furniture, decorations. Matches substrings case-insensitively; a numeric query matches ids by prefix. Returns up to `limit` {id, name} pairs for place_object.",
    { query: z.string().min(1).describe("Name fragment (e.g. \"marble wall\") or id prefix"), limit: z.number().int().min(1).max(50).default(20) },
    ({ query, limit }) => {
      const trimmed = query.trim().toLowerCase();
      const byId = Number(trimmed);
      const results = [];
      const total = objectCount();
      for (let id = 0; id < total; id++) {
        let entry;
        try {
          entry = CacheDefinitions.getObject(id);
        } catch {
          continue;
        }
        const name = entry?.name;
        if (!name || name === "null") continue;
        if (Number.isInteger(byId) && byId >= 0) {
          if (id !== byId && !String(id).startsWith(trimmed)) continue;
        } else if (!name.toLowerCase().includes(trimmed)) {
          continue;
        }
        results.push({ id, name });
        if (results.length >= limit) break;
      }
      return { query, count: results.length, results };
    }
  );

  tool(
    "describe_object",
    "Object definition details for placing well: footprint (sizeX/sizeY), whether it blocks movement (solid) or projectiles, whether it is interactive and its options.",
    { id: z.number().int().min(0).describe("Object id from search_objects") },
    ({ id }) => {
      if (id >= objectCount()) throw new Error(`Unknown object id ${id}`);
      const definition = ObjectDefinition.forId(id);
      if (!definition) throw new Error(`No definition for object id ${id}`);
      return {
        id,
        name: definition.getName(),
        sizeX: definition.getSizeX(),
        sizeY: definition.getSizeY(),
        solid: definition.isSolid(),
        blocksProjectiles: definition.isImpenetrable(),
        interactive: definition.hasActions(),
        options: definition.getInteractions() ?? [],
      };
    }
  );

  tool(
    "place_object",
    "Place one object live in the world: every online player (and the ?edit map editor after a sync) sees it at once. Persists to object-spawns.json, so it survives restarts. type 10 is a normal standing object; face 0-3 rotates it. For more than a handful of tiles use place_objects or build_shape instead.",
    {
      id: z.number().int().min(0).describe("Object id from search_objects"),
      x: z.number().int().describe("World tile x"),
      y: z.number().int().describe("World tile y"),
      z: z.number().int().min(0).max(3).default(0).describe("Plane, 0 is ground level"),
      type: z.number().int().min(0).max(22).default(10),
      face: z.number().int().min(0).max(3).default(0),
    },
    ({ id, x, y, z = 0, type = 10, face = 0 }) => {
      checkBounds(id, x, y, z, type, face);
      const definition = ObjectDefinition.forId(id);
      if (!definition) throw new Error(`No definition for object id ${id}`);
      ObjectManager.register(new GameObject(id, new Location(x, y, z), type, face, null), true);
      const spawns = readSpawns();
      const already = spawns.some(
        (entry) => entry.id === id && sameTile(entry, x, y, z)
          && (entry.type ?? 10) === type && (entry.face ?? 0) === face && entry.remove !== true,
      );
      if (!already) {
        spawns.push({ id, position: { x, y, z }, type, face, source: "agent-mcp" });
        writeSpawns(spawns);
      }
      return { placed: { id, name: definition.getName(), x, y, z, type, face }, persisted: !already };
    }
  );

  tool(
    "remove_object",
    "Remove live object(s) on a tile and persist the removal, so they stay gone after a restart. Without `type` every object on the tile is removed.",
    {
      x: z.number().int().describe("World tile x"),
      y: z.number().int().describe("World tile y"),
      z: z.number().int().min(0).max(3).default(0),
      type: z.number().int().min(0).max(22).optional().describe("Only remove this object type"),
    },
    ({ x, y, z = 0, type }) => {
      if (!Number.isInteger(x) || x < 0 || x > 16383 || !Number.isInteger(y) || y < 0 || y > 16383) {
        throw new Error(`Tile ${x},${y} is outside the world (0-16383)`);
      }
      if (!Number.isInteger(z) || z < 0 || z > 3) throw new Error(`Plane z=${z} is outside 0-3`);
      const at = new Location(x, y, z);
      const matches = ObjectManager.objectsAt(at).filter((object) => type === undefined || object.getType() === type);
      if (matches.length === 0) {
        const present = ObjectManager.objectsAt(at).map((object) => ({ id: object.getId(), type: object.getType() }));
        throw new Error(`Nothing to remove on ${x},${y},${z}${type === undefined ? "" : ` with type ${type}`}; present: ${JSON.stringify(present)}`);
      }
      const spawns = readSpawns();
      let changed = false;
      const removed = [];
      for (const object of matches) {
        ObjectManager.deregister(object, true);
        removed.push({ id: object.getId(), type: object.getType(), x, y, z });
        // Entries this file placed for the object are dropped; a cache-map object
        // needs an explicit removal marker to stay gone on the next load.
        const covered = spawns.some(
          (entry) => entry.id === object.getId() && sameTile(entry, x, y, z)
            && (entry.type ?? 10) === object.getType() && entry.remove !== true,
        );
        if (objectStore().dropPlacement(spawns, object.getId(), x, y, z, object.getType())) changed = true;
        if (!covered) {
          spawns.push({
            id: object.getId(), position: { x, y, z },
            type: object.getType(), face: object.getFace(), remove: true, source: "agent-mcp",
          });
          changed = true;
        }
      }
      if (changed) writeSpawns(spawns);
      return { removed };
    }
  );

  tool(
    "clear_area",
    "Raze a rectangle to bare ground: removes every live object on all planes in it and every NPC standing in it. Removals reach all players (present and late joiners) and persist: object removals go to object-spawns.json (the ?edit editor hides them after a sync), NPC removals drop their npc-spawns.json entries. Cache-map NPCs with no spawn-file entry return on restart and are reported. Collision goes with the objects. Combine with paint_ground/set_height for a building site.",
    {
      x1: z.number().int().describe("Rectangle corner x"),
      y1: z.number().int().describe("Rectangle corner y"),
      x2: z.number().int().describe("Opposite corner x"),
      y2: z.number().int().describe("Opposite corner y"),
      includeNpcs: z.boolean().default(true).describe("Also remove NPCs standing in the rectangle"),
    },
    ({ x1, y1, x2, y2, includeNpcs = true }) => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      for (const [name, value] of [["x1", minX], ["x2", maxX], ["y1", minY], ["y2", maxY]]) {
        if (!Number.isInteger(value) || value < 0 || value > 16383) {
          throw new Error(`Tile ${name}=${value} is outside the world (0-16383)`);
        }
      }
      const tiles = (maxX - minX + 1) * (maxY - minY + 1);
      if (tiles > 4096) throw new Error(`Rectangle covers ${tiles} tiles; split it under 4096`);

      const spawns = readSpawns();
      let spawnsChanged = false;
      // Cache objects live in MapObjects, runtime ones in ObjectManager: clear both.
      // Player-owned (fires, traps) and private-area objects are left alone.
      const candidates = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = 0; z <= 3; z++) {
            const at = new Location(x, y, z);
            const onTile = [
              ...ObjectManager.objectsAt(at),
              ...(MapObjects.mapObjects.get(MapObjects.getHash(x, y, z)) ?? []),
            ];
            for (const object of onTile) {
              if (candidates.includes(object)) continue;
              if (object.getOwner?.() || object.getPrivateArea?.()) continue;
              candidates.push(object);
            }
          }
        }
      }
      const removedObjects = [];
      for (const object of candidates) {
        const at = object.getLocation();
        const x = at.getX();
        const y = at.getY();
        const z = at.getZ();
        const type = object.getType();
        ObjectManager.deregister(object, true);
        removedObjects.push({ id: object.getId(), type, x, y, z });
        objectStore().dropPlacement(spawns, object.getId(), x, y, z, type);
        spawnsChanged = true;
        const covered = spawns.some((entry) => entry.id === object.getId()
          && sameTile(entry, x, y, z) && (entry.type ?? 10) === type && entry.remove !== true);
        if (!covered) {
          spawns.push({
            id: object.getId(), position: { x, y, z },
            type, face: object.getFace(), remove: true, source: "agent-mcp",
          });
        }
      }
      if (spawnsChanged) writeSpawns(spawns);

      const removedNpcs = [];
      const unpersistedCacheNpcs = [];
      if (includeNpcs) {
        const npcSpawns = readNpcSpawnsFile();
        let npcsChanged = false;
        const center = new Location(Math.floor((minX + maxX) / 2), Math.floor((minY + maxY) / 2), 0);
        const radius = Math.max(maxX - minX, maxY - minY);
        for (const npc of World.getNpcsNear(center, radius, null)) {
          const at = npc.getLocation();
          if (at.getX() < minX || at.getX() > maxX || at.getY() < minY || at.getY() > maxY) continue;
          if (npc.getPrivateArea() || npc.isOwnerOnly?.()) continue;
          World.getRemoveNPCQueue().push(npc);
          removedNpcs.push({ id: npc.getId(), x: at.getX(), y: at.getY(), z: at.getZ() });
          let covered = false;
          for (let i = npcSpawns.length - 1; i >= 0; i--) {
            const entry = npcSpawns[i];
            if (entry.id === npc.getId() && entry.x === at.getX() && entry.y === at.getY()
              && (entry.level ?? 0) === at.getZ()) {
              npcSpawns.splice(i, 1);
              npcsChanged = true;
              covered = true;
            }
          }
          if (!covered) unpersistedCacheNpcs.push({ id: npc.getId(), x: at.getX(), y: at.getY() });
        }
        if (npcsChanged) writeNpcSpawnsFile(npcSpawns);
      }

      return {
        cleared: { x1: minX, y1: minY, x2: maxX, y2: maxY },
        removedObjects: removedObjects.length,
        removedObjectSample: removedObjects.slice(0, 10),
        removedNpcs: removedNpcs.length,
        unpersistedCacheNpcs,
      };
    }
  );

  tool(
    "list_placed_objects",
    "Objects persisted in object-spawns.json (the file the ?edit editor overlays). Filter by source: agent-mcp entries are this toolset's, others are hand- or editor-made.",
    { source: z.string().optional().describe("Only entries with this source tag") },
    ({ source }) => {
      const spawns = readSpawns().filter((entry) => source === undefined || entry.source === source);
      return { count: spawns.length, objects: spawns };
    }
  );
};
