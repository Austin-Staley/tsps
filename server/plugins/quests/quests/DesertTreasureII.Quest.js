/** Desert Treasure II - The Fallen Empire. */
module.exports = function registerDesertTreasureII(api) {
  const { Skill, Item, ItemIdentifiers: I, NpcIdentifiers: N, ObjectIdentifiers: O } = api.core;
  const { registerQuest, startTranscript } = require("../QuestRuntime");
  const PAGE = "Desert Treasure II - The Fallen Empire";
  const S = { STARTED: 1, VAULT: 2, DIG: 3, ROCKS: 4, GUARDIAN: 5, MACHINE: 6, VARDORVIS: 7, LEVIATHAN: 8, SUCELLUS: 9, WHISPERER: 10, FINALE: 11, COMPLETE: 12 };
  const IDS = [I.VARDORVIS_MEDALLION, I.PERSERIYAS_MEDALLION, I.SUCELLUS_MEDALLION, I.WHISPERERS_MEDALLION];
  const STATUE_ITEMS = [I.VARDORVIS_MEDALLION, I.WHISPERERS_MEDALLION, I.SUCELLUS_MEDALLION, I.PERSERIYAS_MEDALLION];
  const STATUES_PLACED = "desert-treasure-ii:medallions-placed";
  // Cache morphs in the Ancient Vault have no operation text, but the server
  // still dispatches their underlying object ids. The plaque is a separate
  // interaction and must also be read before the names are known.
  const STATUES = new Map([[49499, 0], [49501, 1], [49503, 2], [49505, 3]]);
  const PREREQUISITES = ["desert_treasure_i", "secrets_of_the_north", "enakhras_lament", "temple_of_the_eye", "the_garden_of_death", "below_ice_mountain"];
  const CELLS_INSERTED = "desert-treasure-ii:cells-inserted";
  const CELL_POSITIONS = "desert-treasure-ii:cell-positions";
  const GOLEM_SOLVED = "desert-treasure-ii:golem-solved";
  const GOLEM_INSPECTED = "desert-treasure-ii:golem-inspected";
  const ALTAR_INSPECTED = "desert-treasure-ii:altar-inspected";
  const TOTEMS_CHARGED = "desert-treasure-ii:totems-charged";
  const SEARCHED_NAMES = "desert-treasure-ii:searched-names";
  const BANIKAN_LEFT = "desert-treasure-ii:banikan-left";
  const VARDORVIS_PROGRESS = "desert-treasure-ii:vardorvis-progress";
  const SUCELLUS_AREA = "desert-treasure-ii:sucellus-area";
  const SUCELLUS_MUSHROOMS = "desert-treasure-ii:sucellus-mushrooms";
  const SUCELLUS_VATS = "desert-treasure-ii:sucellus-vats";
  const SUCELLUS_POISONS = "desert-treasure-ii:sucellus-poisons";
  const SUCELLUS_DEFEATED = "desert-treasure-ii:sucellus-defeated";
  const SUCELLUS_WEST_ROOM = "desert-treasure-ii:sucellus-west-room";
  const SUCELLUS_CELL_PROGRESS = "desert-treasure-ii:sucellus-cell-progress";
  const SUCELLUS_CELL_ENTERED = "desert-treasure-ii:sucellus-cell-entered";
  const SUCELLUS_CELL_ESCAPED = "desert-treasure-ii:sucellus-cell-escaped";
  const SUCELLUS_ASSASSIN_GONE = "desert-treasure-ii:sucellus-assassin-gone";
  const SUCELLUS_BOSS_GATE = 49138;
  const SUCELLUS_MEDALLION_GATE = 49140;
  const SUCELLUS_MEDALLION_CHEST = 49116;
  const PUZZLE_GROUP = 838;
  const CELL_VARBITS = [15165, 15166, 15167, 15168, 15169, 15170, 15171, 15172];
  // RuneLite QuestHelper reads these in reverse varbit order from the solution.
  const CELL_SOLUTION = [16, 10, 27, 33, 52, 5, 62, 47];
  const ATTR = "desert-treasure-ii:boss";
  const ATTR_WAR_ROOM = "desert-treasure-ii:war-room";
  const ATTR_STRANGLEWOOD_HIDEOUT = "desert-treasure-ii:stranglewood-hideout";
  const ATTR_STRANGLEWOOD_TEMPLE = "desert-treasure-ii:stranglewood-temple";
  const ATTR_VARDORVIS_AREA = "desert-treasure-ii:vardorvis-area";
  const ATTR_SCAR_AREA = "desert-treasure-ii:scar-area";
  const ATTR_SCAR_MAZE_ONE = "desert-treasure-ii:scar-maze-one";
  const ATTR_SCAR_MAZE_TWO = "desert-treasure-ii:scar-maze-two";
  const ATTR_SCAR_MAZE_THREE = "desert-treasure-ii:scar-maze-three";
  const ATTR_LEVIATHAN_AREA = "desert-treasure-ii:leviathan-area";
  const ATTR_VAULT_AREA = "desert-treasure-ii:ancient-vault";
  const ATTR_VAULT_SMITH = "desert-treasure-ii:vault-smith";
  const ATTR_SMITH_INTRO = "desert-treasure-ii:smith-intro";
  // These three cache locs have no stable cache names, so use the IDs verified
  // by dump:loc: desk 49490, inbound boat 49491, outbound Travel loc 48720.
  const KASONDE_DESK_LOC = 49490;
  const STRANGLEWOOD_BOAT_IN_LOC = 49491;
  const STRANGLEWOOD_BOAT_OUT_LOC = O.ROWBOAT_17;
  const KASONDE_NOTE = I.POTION_NOTE;
  const KASONDE_POTION = I.STRANGE_POTION_3;
  const VARDORVIS_ENTRY = 49495;
  const KASONDE_MEDALLION_CHEST = 49496;
  const SCAR_DEMONS_DEFEATED = "desert-treasure-ii:scar-demons-defeated";
  const SCAR_BOAT_TRIED = "desert-treasure-ii:scar-boat-tried";
  const SCAR_BOAT_ROOM = "desert-treasure-ii:scar-boat-room-entered";
  const SCAR_TINDERBOX_FOUND = "desert-treasure-ii:scar-tinderbox-found";
  const SCAR_SLIMY_KEY_FOUND = "desert-treasure-ii:scar-slimy-key-found";
  const SCAR_GUNPOWDER_FOUND = "desert-treasure-ii:scar-gunpowder-found";
  const SCAR_OLD_TABLET_READ = "desert-treasure-ii:scar-old-tablet-read";
  const SCAR_BOAT_CHEST_OPEN = "desert-treasure-ii:scar-boat-chest-open";
  const SCAR_BOAT_BURNED = "desert-treasure-ii:scar-boat-burned";
  const SCAR_PERSTEN_ROOM2_TALKED = "desert-treasure-ii:scar-persten-room2-talked";
  const SCAR_BOAT2_BURNED = "desert-treasure-ii:scar-boat2-burned";
  const SCAR_NERVE_ROOM_TWO_ACTIVE = "desert-treasure-ii:scar-nerve-room-two-active";
  const SCAR_NERVE_ROOM_TWO_BROKEN = "desert-treasure-ii:scar-nerve-room-two-broken";
  const SCAR_NERVE_ROOM_TWO_REPAIRED = "desert-treasure-ii:scar-nerve-room-two-repaired";
  const SCAR_NERVE_ROOM_TWO_COMPLETE = "desert-treasure-ii:scar-nerve-room-two-complete";
  const SCAR_NERVE_ROOM_TWO_AIR = "desert-treasure-ii:scar-nerve-room-two-air";
  const SCAR_MAZE_THREE_ACTIVE = "desert-treasure-ii:scar-maze-three-active";
  const SCAR_MAZE_THREE_AIR = "desert-treasure-ii:scar-maze-three-air";
  const SCAR_MEMORY_ORDER = "desert-treasure-ii:scar-memory-order";
  const SCAR_MEMORY_STEP = "desert-treasure-ii:scar-memory-step";
  const SCAR_MEMORY_COMPLETE = "desert-treasure-ii:scar-memory-complete";
  const SCAR_TREE_STARTED = "desert-treasure-ii:scar-tree-started";
  const SCAR_TREE_COMPLETE = "desert-treasure-ii:scar-tree-complete";
  const SCAR_LEECH_GROWTHS_REPAIRED = "desert-treasure-ii:scar-leech-growths";
  const SCAR_BLOOD_RED_COUNT = "desert-treasure-ii:scar-blood-red-count";
  const SCAR_BLOOD_WHITE_COUNT = "desert-treasure-ii:scar-blood-white-count";
  const SCAR_BLOOD_RED_REPAIRED = "desert-treasure-ii:scar-blood-red-repaired";
  const SCAR_BLOOD_WHITE_REPAIRED = "desert-treasure-ii:scar-blood-white-repaired";
  const SCAR_LEECH_COMPLETE = "desert-treasure-ii:scar-leech-complete";
  const SCAR_BOAT3_BURNED = "desert-treasure-ii:scar-boat3-burned";
  const SCAR_BOAT3_ROOM = "desert-treasure-ii:scar-boat-room-three";
  const SCAR_PERSTEN_ROOM3_TALKED = "desert-treasure-ii:scar-persten-room3-talked";
  const SCAR_LEVIATHAN_READY = "desert-treasure-ii:scar-leviathan-ready";
  const SCAR_LEVIATHAN_KILLED = "desert-treasure-ii:scar-leviathan-killed";
  const SCAR_PERSTEN_AT_SHIP = "desert-treasure-ii:persten-at-ship";
  const SCAR_PERSTEN_LEFT_SHIP = "desert-treasure-ii:persten-left-ship";
  const SCAR_LEVIATHAN_DEBRIS_SEARCHED = "desert-treasure-ii:leviathan-debris-searched";
  const SCAR_AXON_ROOM_COMPLETE = "desert-treasure-ii:scar-axon-room-complete";
  const SCAR_SUMMON_ROOM_STARTED = "desert-treasure-ii:scar-summoning-room-started";
  const SCAR_SUMMON_IMPS = "desert-treasure-ii:scar-summoning-imps";
  const SCAR_SUMMON_DEMONS = "desert-treasure-ii:scar-summoning-demons";
  const SCAR_SUMMON_ROOM_COMPLETE = "desert-treasure-ii:scar-summoning-room-complete";
  const SCAR_PERSTEN_TALKED = "desert-treasure-ii:scar-persten-talked";
  const SCAR_PERSTEN_ROOM1_TALKED = "desert-treasure-ii:scar-persten-room1-talked";
  const SCAR_PERSTEN_TALKED_BEFORE = "desert-treasure-ii:scar-persten-talked-before";
  const SCAR_PATH_COMPLETE = "desert-treasure-ii:scar-pathfinder-complete";
  const SCAR_TETHER_DESTROYED = "desert-treasure-ii:scar-tether-destroyed";
  const SCAR_VARBIT = 15128;
  const SCAR_MAZE_ONE_ENTERED = "desert-treasure-ii:scar-maze-one-entered";
  const SCAR_MAZE_TWO_ENTERED = "desert-treasure-ii:scar-maze-two-entered";
  const SCAR_GUARDIAN_ACCEPTED = "desert-treasure-ii:scar-guardian-accepted";
  const SCAR_PASSAGE_OPEN = 49205;
  const SCAR_RIFT_LIVE = "desert-treasure-ii:scar-rift-live-nerves";
  const SCAR_NERVES_BROKEN = "desert-treasure-ii:scar-nerves-broken";
  const SCAR_CATALYST_PROGRESS = "desert-treasure-ii:scar-catalyst-progress";
  const SCAR_CATALYST_BASE_HITS = "desert-treasure-ii:scar-catalyst-base-hits";
  const SCAR_CATALYST_ORDER = "desert-treasure-ii:scar-catalyst-order";
  const SCAR_CATALYST_NPC = "desert-treasure-ii:scar-catalyst-npc";
  const SCAR_GROWTH_LIVE = "desert-treasure-ii:scar-growth-live";
  const SCAR_GROWTH_LURES = "desert-treasure-ii:scar-growth-lures";
  const SCAR_GROWTH_STEP = "desert-treasure-ii:scar-growth-step";
  const SCAR_GROWTH_ORDER = "desert-treasure-ii:scar-growth-order";
  const SCAR_GROWTH_ORDER_VARBITS = [15203, 15204, 15205, 15206, 15207, 15208];
  const SCAR_GROWTH_STEP_VARBIT = 15209;
  const SCAR_GROWTH_LIT_VARBIT = 15210;
  const SCAR_GROWTHS = [[2219, 6435], [2220, 6423], [2231, 6423], [2232, 6435]];
  const SCAR_ENERGIES = [
    { visible: 49189, base: 49520, state: 15197, rune: 1, tile: [2227, 6430] },
    { visible: 49190, base: 49521, state: 15198, rune: 2, tile: [2224, 6433] },
    { visible: 49191, base: 49522, state: 15199, rune: 3, tile: [2227, 6433] },
    { visible: 49192, base: 49523, state: 15200, rune: 4, tile: [2224, 6427] },
    { visible: 49193, base: 49524, state: 15201, rune: 5, tile: [2227, 6427] },
    { visible: 49194, base: 49525, state: 15202, rune: 6, tile: [2224, 6430] },
  ];
  const SCAR_NERVE_LOCATIONS = [
    { object: 49182, item: I.EARTH_NERVE, tiles: [[2198, 6411], [2204, 6419]] },
    { object: 49183, item: I.AIR_NERVE, tiles: [[2195, 6418], [2206, 6416]] },
    { object: 49184, item: I.WATER_NERVE, tiles: [[2202, 6410], [2204, 6414]] },
    { object: 49185, item: I.FIRE_NERVE, tiles: [[2193, 6415], [2200, 6407]] },
    { object: 49186, item: I.MIND_NERVE, tiles: [[2194, 6410], [2205, 6408], [2205, 6411]] },
  ];
  const SCAR_NERVE_LOCATIONS_TWO = [
    { object: O.NERVE_ENDING_EARTH_, item: I.EARTH_NERVE, tiles: [[1780, 6440], [1784, 6423], [1789, 6435]] },
    { object: O.NERVE_ENDING_AIR_, item: I.AIR_NERVE, tiles: [[1770, 6432], [1789, 6429]] },
    { object: O.NERVE_ENDING_WATER_, item: I.WATER_NERVE, tiles: [[1772, 6436], [1775, 6426]] },
    { object: O.NERVE_ENDING_FIRE_, item: I.FIRE_NERVE, tiles: [[1773, 6433], [1777, 6422]] },
  ];
  const SCAR_NERVE_REPAIRS_TWO = [
    { object: 49445, item: I.SMOKE_NERVE, tile: [1778, 6431] },
    { object: 49446, item: I.STEAM_NERVE, tile: [1783, 6430] },
    { object: 49447, item: I.DUST_NERVE, tile: [1784, 6433] },
    { object: 49448, item: I.LAVA_NERVE, tile: [1779, 6435] },
  ];
  const SCAR_NERVE_AIR_BUBBLES = [[1779, 6437], [1780, 6425]];
  const SCAR_MEMORY_GROWTHS = [[1903, 6431], [1900, 6442], [1909, 6441], [1914, 6434]];
  const SCAR_MAZE_THREE_AIR_BUBBLES = [[1900, 6430], [1900, 6439], [1906, 6443], [1908, 6436], [1913, 6431]];
  const SCAR_LEECH_GROWTHS = [[1862, 6432], [1869, 6423], [1869, 6440], [1876, 6432]];
  const SCAR_BLOOD_RED_VEINS = [[1865, 6438], [1874, 6429], [1874, 6434]];
  const SCAR_BLOOD_WHITE_VEINS = [[1867, 6427], [1867, 6433], [1874, 6425]];
  const SCAR_AXON_PATHS = [
    { terminal: 49443, points: [[1749, 6419], [1747, 6419], [1747, 6414]] },
    { terminal: 49441, points: [[1744, 6413], [1744, 6421], [1742, 6421], [1742, 6424], [1740, 6424], [1740, 6427], [1747, 6427]] },
    { terminal: 49442, points: [[1743, 6424], [1740, 6424], [1740, 6422], [1734, 6422], [1734, 6425]] },
    { terminal: 49440, points: [[1735, 6422], [1743, 6422], [1743, 6417], [1736, 6417], [1736, 6414]] },
  ].map((path) => {
    const points = [path.points[0]];
    for (const [x, y] of path.points.slice(1)) {
      const [lastX, lastY] = points.at(-1);
      const steps = Math.max(Math.abs(x - lastX), Math.abs(y - lastY));
      const dx = Math.sign(x - lastX), dy = Math.sign(y - lastY);
      for (let step = 1; step <= steps; step++) points.push([lastX + dx * step, lastY + dy * step]);
    }
    return { ...path, points };
  });
  const SCAR_NERVE_RECIPES = [
    [I.AIR_NERVE, I.EARTH_NERVE, I.DUST_NERVE],
    [I.EARTH_NERVE, I.FIRE_NERVE, I.LAVA_NERVE],
    [I.FIRE_NERVE, I.AIR_NERVE, I.SMOKE_NERVE],
    [I.WATER_NERVE, I.FIRE_NERVE, I.STEAM_NERVE],
    [I.MIND_NERVE, I.MIND_NERVE, I.SOUL_NERVE],
    [I.WATER_NERVE, I.EARTH_NERVE, I.NATURE_NERVE],
    [I.MIND_NERVE, I.WATER_NERVE, I.BLOOD_NERVE],
    [I.SOUL_NERVE, I.NATURE_NERVE, I.COSMIC_NERVE],
    [I.COSMIC_NERVE, I.EARTH_NERVE, I.ASTRAL_NERVE],
    [I.SMOKE_NERVE, I.BLOOD_NERVE, I.WRATH_NERVE],
  ];
  const SCAR_CATALYST_RUNES = [I.SMOKE_NERVE, I.BLOOD_NERVE, I.SOUL_NERVE, I.NATURE_NERVE, I.COSMIC_NERVE, I.ASTRAL_NERVE];
  const SCAR_CATALYST_RUNE_NAMES = ["smoke", "blood", "soul", "nature", "cosmic", "astral"];
  const SCAR_CATALYST_BASE_PARTS = new Map([
    [I.SMOKE_NERVE, [I.FIRE_NERVE, I.AIR_NERVE]],
    [I.BLOOD_NERVE, [I.MIND_NERVE, I.WATER_NERVE]],
    [I.SOUL_NERVE, [I.MIND_NERVE, I.MIND_NERVE]],
    [I.NATURE_NERVE, [I.WATER_NERVE, I.EARTH_NERVE]],
    [I.COSMIC_NERVE, [I.MIND_NERVE, I.MIND_NERVE, I.WATER_NERVE, I.EARTH_NERVE]],
    [I.ASTRAL_NERVE, [I.MIND_NERVE, I.MIND_NERVE, I.WATER_NERVE, I.EARTH_NERVE, I.EARTH_NERVE]],
  ]);
  const SCAR_ENERGY_RUNES = [1, 2, 3, 4, 5, 6];

  function shuffled(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const ASGARNIA_SMITH_VAULT_INITIAL = 12401;
  const TOTEMS = [
    { kind: "blood", inactive: 12343, active: 12344, x: 2775, y: 6445, spells: ["BLOOD_BURST", "BLOOD_BLITZ", "BLOOD_BARRAGE"] },
    { kind: "shadow", inactive: 12341, active: 12342, x: 2771, y: 6445, spells: ["SHADOW_BURST", "SHADOW_BLITZ", "SHADOW_BARRAGE"] },
    { kind: "smoke", inactive: 12339, active: 12340, x: 2771, y: 6439, spells: ["SMOKE_BURST", "SMOKE_BLITZ", "SMOKE_BARRAGE"] },
    { kind: "ice", inactive: 12345, active: 12346, x: 2775, y: 6439, spells: ["ICE_BURST", "ICE_BLITZ", "ICE_BARRAGE"] },
  ];
  const SCAR_PATHS = [
    { npc: N.CEREBRAL_PATHFINDER, from: "north", points: [[2195, 6450], [2195, 6444], [2197, 6444]] },
    { npc: N.CEREBRAL_PATHFINDER, from: "west", points: [[2199, 6444], [2202, 6444], [2202, 6442]] },
    { npc: N.CEREBRAL_PATHBREAKER, from: "north", points: [[2202, 6440], [2201, 6439], [2198, 6438]] },
    { npc: N.CEREBRAL_PATHBREAKER, from: "west", points: [[2197, 6438], [2196, 6435]] },
    { npc: N.CEREBRAL_PATHBREAKER, from: "east", points: [[2196, 6435], [2207, 6436]] },
    { npc: N.CEREBRAL_PATHBREAKER, from: "south", points: [[2207, 6436], [2207, 6433], [2209, 6433]] },
  ];
  let quest;
  let spawned = new WeakMap();
  let WarRoomArea;
  let AncientVaultArea;
  let StranglewoodHideoutArea;
  let StranglewoodTempleArea;
  let VardorvisArea;
  let ScarArea;
  let ScarMazeOneArea;
  let ScarMazeTwoArea;
  let ScarMazeThreeArea;
  let LeviathanArea;
  let SucellusArea;
  const totemSpellIds = new Map(TOTEMS.map((totem) => [totem.kind, new Set(totem.spells.map((name) => api.core.CombatSpells[name]?.spellId?.()).filter(Number.isInteger))]));

  AncientVaultArea = class DesertTreasureIIAncientVaultArea extends api.core.TemplatedInstanceArea {
    constructor(owner) {
      super(4, 4);
      this.owner = owner;
      // Cache room coordinates 3920..3951, 9616..9647 occupy chunks 490..493,
      // 1202..1205 on plane 1. Copy the exact Ancient Vault cache template.
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 1 ? {
              sourceChunkX: 490 + x, sourceChunkY: 1202 + y, sourcePlane: 1, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "Ancient Vault (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  WarRoomArea = class DesertTreasureIIWarRoomArea extends api.core.TemplatedInstanceArea {
    constructor(owner) {
      super(6, 5);
      this.owner = owner;
      // RuneLite QuestHelper's golem-room zone is 2767..2807, 6425..6459.
      // Copy those cache chunks so the crate, altar, golem, collision and floor
      // all match the room the client displays.
      for (let x = 0; x < 6; x++) {
        for (let y = 0; y < 5; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 345 + x, sourceChunkY: 803 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "Ancient Vault war room (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  StranglewoodHideoutArea = class DesertTreasureIIStranglewoodHideoutArea extends api.core.TemplatedInstanceArea {
    constructor(owner, questPlayer) {
      super(7, 5);
      this.owner = owner;
      this.questPlayer = questPlayer;
      this.remainingTicks = 400;
      this.lastProcessCycle = -1;
      this.nextSpawnTick = 0;
      this.enemies = [];
      for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 5; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 145 + x, sourceChunkY: 1217 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "Kasonde's Hideout (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    process(actor) {
      if (!actor?.isPlayer?.() || actor.getAsPlayer?.() !== this.questPlayer) return;
      const cycle = api.core.World.getProcessCycle();
      if (cycle === this.lastProcessCycle) return;
      this.lastProcessCycle = cycle;
      if (this.remainingTicks <= 0) return;
      const kasonde = this.kasonde;
      if (!kasonde?.isRegistered?.() || kasonde.getHitpoints?.() <= 0) {
        this.remainingTicks = 0;
        this.failed = true;
        return;
      }
      this.remainingTicks--;
      if (this.remainingTicks <= 0) {
        this.defended = true;
        return;
      }
      const elapsed = 400 - this.remainingTicks;
      if (elapsed >= this.nextSpawnTick && this.enemies.filter((npc) => npc?.isRegistered?.() && npc.getHitpoints?.() > 0).length < 4) {
        this.spawnEnemy(elapsed);
        this.nextSpawnTick += 16;
      }
    }
    spawnEnemy(elapsed) {
      const tiles = [[13, 8], [20, 8], [39, 9], [44, 28], [10, 29], [27, 31]];
      const [x, y] = tiles[Math.floor(elapsed / 16) % tiles.length];
      const npc = api.core.NPC.create(N.STRANGLED, this.tile(x, y, 0));
      npc.setOwner?.(this.questPlayer);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      this.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      this.enemies.push(npc);
      npc.getCombat?.()?.attack?.(this.kasonde);
    }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  StranglewoodTempleArea = class DesertTreasureIIStranglewoodTempleArea extends api.core.TemplatedInstanceArea {
    constructor(owner) {
      super(2, 5);
      this.owner = owner;
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 5; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 147 + x, sourceChunkY: 1226 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "Stranglewood temple (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  VardorvisArea = class DesertTreasureIIVardorvisArea extends api.core.TemplatedInstanceArea {
    constructor(owner) {
      super(5, 5);
      this.owner = owner;
      // Copy the actual ritual site (including its walls, rocks and escape passage).
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 139 + x, sourceChunkY: 425 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "Vardorvis ritual site (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  ScarArea = class DesertTreasureIIScarArea extends api.core.TemplatedInstanceArea {
    constructor(owner) {
      super(9, 8);
      this.owner = owner;
      // The entry combat, stepping stones, Persten's camp and rowboat occupy
      // the cache's continuous 2000..2071, 6400..6463 Scar template.
      for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 8; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 250 + x, sourceChunkY: 800 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "The Scar (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  ScarMazeOneArea = class DesertTreasureIIScarMazeOneArea extends api.core.TemplatedInstanceArea {
    constructor(owner, questPlayer) {
      super(11, 9);
      this.owner = owner;
      this.questPlayer = questPlayer;
      this.pathIndex = 0;
      this.pathRunner = null;
      this.lastProcessCycle = -1;
      // The north-west passage contains the pathfinder, catalyst, growth and
      // first ship rooms. This is the full unmodified cache region the Wiki
      // route walks between; room progress intentionally resets on exit.
      for (let x = 0; x < 11; x++) {
        for (let y = 0; y < 9; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 270 + x, sourceChunkY: 800 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "The Scar north-west passage (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    process(actor) {
      if (!actor?.isPlayer?.() || actor.getAsPlayer?.() !== this.questPlayer) return;
      const cycle = api.core.World.getProcessCycle();
      if (cycle === this.lastProcessCycle || this.questPlayer.getAttribute(SCAR_PATH_COMPLETE)) return;
      this.lastProcessCycle = cycle;
      const runner = this.pathRunner;
      if (!runner?.isRegistered?.()) return;
      const playerLoc = actor.getLocation();
      const runnerLoc = runner.getLocation();
      const distance = Math.max(Math.abs(playerLoc.getX() - runnerLoc.getX()), Math.abs(playerLoc.getY() - runnerLoc.getY()));
      const points = SCAR_PATHS[this.pathIndex].points;
      if (runner.__dt2ScarMoving) {
        const target = points[runner.__dt2ScarRouteIndex];
        const targetTile = target && this.tile(target[0] - 2160, target[1] - 6400, 0);
        // OSRS pathing can settle on the nearest reachable tile when the marked
        // dot itself is clipped by a room edge. Treat the two-tile approach as
        // reached, then route to the next documented dot from the live position.
        if (targetTile && Math.max(Math.abs(runnerLoc.getX() - targetTile.getX()), Math.abs(runnerLoc.getY() - targetTile.getY())) <= 2) {
          runner.__dt2ScarRouteIndex++;
          const [nextX, nextY] = points[runner.__dt2ScarRouteIndex] ?? [];
          if (nextX !== undefined) {
            const next = this.tile(nextX - 2160, nextY - 6400, 0);
            api.core.PathFinder.calculateWalkRoute(runner, next.getX(), next.getY());
          }
        }
      }
      const finish = this.tile(points.at(-1)[0] - 2160, points.at(-1)[1] - 6400, 0);
      const arrived = Math.max(Math.abs(runnerLoc.getX() - finish.getX()), Math.abs(runnerLoc.getY() - finish.getY())) <= 2;
      if (!arrived || distance > 3) return;
      const remove = api.core.World.getRemoveNPCQueue();
      if (runner.isRegistered?.() && !remove.includes(runner)) remove.push(runner);
      this.remove(runner);
      this.pathRunner = null;
      if (this.pathIndex < SCAR_PATHS.length - 1) {
        this.pathIndex++;
        spawnScarPathRunner(this.questPlayer, this, this.pathIndex);
      } else {
        this.questPlayer.setAttribute(SCAR_PATH_COMPLETE, true);
        this.questPlayer.sendMessage("The pathfinders have reached the abyssal tether. Destroy it to continue.");
      }
    }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  ScarMazeTwoArea = class DesertTreasureIIScarMazeTwoArea extends api.core.TemplatedInstanceArea {
    constructor(owner, questPlayer) {
      super(12, 8);
      this.owner = owner;
      this.questPlayer = questPlayer;
      this.lastProcessCycle = -1;
      // Copy the middle passage as it appears in the cache. This is a separate
      // instance from the north-west room so no other quest player can see its
      // moving axons, underwater nerves or room state.
      for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 8; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 212 + x, sourceChunkY: 800 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "The Scar middle passage (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    process(actor) {
      if (!actor?.isPlayer?.() || actor.getAsPlayer?.() !== this.questPlayer
        || !this.questPlayer.getAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE)) return;
      const cycle = api.core.World.getProcessCycle();
      if (cycle === this.lastProcessCycle) return;
      this.lastProcessCycle = cycle;
      const air = Math.max(0, (Number(this.questPlayer.getAttribute(SCAR_NERVE_ROOM_TWO_AIR)) || 0) - 1);
      this.questPlayer.setAttribute(SCAR_NERVE_ROOM_TWO_AIR, air);
      this.questPlayer.getPacketSender().sendVarbit(15211, air);
      if (air > 0) return;
      this.questPlayer.setAttribute(SCAR_NERVE_ROOM_TWO_AIR, 100);
      this.questPlayer.getPacketSender().sendVarbit(15211, 100);
      this.questPlayer.moveTo(this.tile(60, 20, 0));
      this.questPlayer.getCombat().getHitQueue().addPendingDamage([
        new api.core.HitDamage(5 + Math.floor(Math.random() * 6), api.core.HitMask.RED),
      ]);
      this.questPlayer.sendMessage("You run out of air and are forced back to the entrance.");
    }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  ScarMazeThreeArea = class DesertTreasureIIScarMazeThreeArea extends api.core.TemplatedInstanceArea {
    constructor(owner, questPlayer) {
      super(9, 9);
      this.owner = owner;
      this.questPlayer = questPlayer;
      this.lastProcessCycle = -1;
      // The final passage contains the memory, Brain Pillar, leech and ship rooms.
      // These chunks preserve the actual cache layout and its collision.
      for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 9; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 232 + x, sourceChunkY: 800 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "The Scar final passage (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    canAttack(attacker, target) {
      if (attacker?.__dt2ScarTreeEnemy) return target?.__dt2ScarAntibody && target.getOwner?.() === this.questPlayer;
      if (attacker?.isPlayer?.() && attacker === this.questPlayer && target?.__dt2ScarTreeEnemy) return true;
      if (target?.__dt2ScarAntibody || target?.__dt2ScarTreeEnemy) return false;
      return null;
    }
    process(actor) {
      if (!actor?.isPlayer?.() || actor.getAsPlayer?.() !== this.questPlayer
        || !this.questPlayer.getAttribute(SCAR_MAZE_THREE_ACTIVE)) return;
      const cycle = api.core.World.getProcessCycle();
      if (cycle === this.lastProcessCycle) return;
      this.lastProcessCycle = cycle;
      const air = Math.max(0, (Number(this.questPlayer.getAttribute(SCAR_MAZE_THREE_AIR)) || 0) - 1);
      this.questPlayer.setAttribute(SCAR_MAZE_THREE_AIR, air);
      this.questPlayer.getPacketSender().sendVarbit(15211, air);
      if (air > 0) return;
      this.questPlayer.setAttribute(SCAR_MAZE_THREE_AIR, 100);
      this.questPlayer.getPacketSender().sendVarbit(15211, 100);
      this.questPlayer.moveTo(this.tile(41, 36, 0));
      this.questPlayer.getCombat().getHitQueue().addPendingDamage([
        new api.core.HitDamage(5 + Math.floor(Math.random() * 6), api.core.HitMask.RED),
      ]);
      this.questPlayer.sendMessage("You run out of air and are forced back to the passage entrance.");
    }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  LeviathanArea = class DesertTreasureIILeviathanArea extends api.core.TemplatedInstanceArea {
    constructor(owner, questPlayer) {
      super(6, 8);
      this.owner = owner;
      this.questPlayer = questPlayer;
      this.lastProcessCycle = -1;
      for (let x = 0; x < 6; x++) {
        for (let y = 0; y < 8; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane === 0 ? {
              sourceChunkX: 258 + x, sourceChunkY: 792 + y, sourcePlane: 0, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "The Leviathan's lair (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    canAttack(attacker, target) {
      if (attacker?.__dt2Leviathan) return false;
      if (target?.__dt2Leviathan) return attacker?.isPlayer?.() && attacker === this.questPlayer;
      return null;
    }
    process(actor) {
      if (!actor?.isPlayer?.() || actor.getAsPlayer?.() !== this.questPlayer) return;
      const cycle = api.core.World.getProcessCycle();
      if (cycle === this.lastProcessCycle) return;
      this.lastProcessCycle = cycle;
      const player = this.questPlayer;
      const boss = player.getAttribute(ATTR);
      if (!boss?.__dt2Leviathan || boss.getHitpoints?.() <= 0 || player.getAttribute(SCAR_LEVIATHAN_KILLED)) return;
      // The encounter owns its projectiles and overhead cues; reset the generic
      // out-of-combat timer so the cache NPC cannot heal through the real fight.
      boss.getCombat?.().getLastAttack?.().reset?.();
      if (cycle < (boss.__dt2LeviathanStunnedUntil ?? 0)) return;
      if (!Number.isFinite(boss.__dt2LeviathanNextAttack)) boss.__dt2LeviathanNextAttack = cycle + 2;
      if (boss.__dt2LeviathanPendingAttack && cycle >= boss.__dt2LeviathanPendingAttack.due) {
        const { style } = boss.__dt2LeviathanPendingAttack;
        const varbit = style === "magic" ? 4116 : style === "ranged" ? 4117 : 4118;
        if (player.getPacketSender().getVarbit(varbit) !== 1) {
          const nearPathfinder = boss.__dt2LeviathanEnraged
            && boss.__dt2LeviathanPathfinder?.isRegistered?.()
            && player.getLocation().getDistance(boss.__dt2LeviathanPathfinder.getLocation()) <= 4;
          const damage = nearPathfinder ? 2 + Math.floor(Math.random() * 4) : 8 + Math.floor(Math.random() * 13);
          player.getCombat().getHitQueue().addPendingDamage([
            new api.core.HitDamage(damage, api.core.HitMask.RED),
          ]);
        } else player.sendMessage(`You block the Leviathan's ${style} volley.`);
        boss.__dt2LeviathanPendingAttack = null;
      }
      if (boss.__dt2LeviathanSpecial && cycle >= boss.__dt2LeviathanSpecial.due) {
        const special = boss.__dt2LeviathanSpecial;
        const loc = player.getLocation();
        const dx = loc.getX() - special.x, dy = loc.getY() - special.y;
        if (special.type === "rocks" ? Math.max(Math.abs(dx), Math.abs(dy)) <= 1
          : (special.axis === "x" ? loc.getY() === special.y : loc.getX() === special.x)) {
          player.getCombat().getHitQueue().addPendingDamage([
            new api.core.HitDamage(12 + Math.floor(Math.random() * 11), api.core.HitMask.RED),
          ]);
          player.sendMessage(special.type === "rocks"
            ? "Falling rocks crash down around you. Keep moving and line them up as cover."
            : "A lightning blast tears across the marked lane. Move out of its path.");
        }
        boss.__dt2LeviathanSpecial = null;
      }
      if (cycle >= boss.__dt2LeviathanNextAttack && !boss.__dt2LeviathanPendingAttack) {
        const styles = ["magic", "ranged", "melee"];
        const style = styles[Math.floor(Math.random() * styles.length)];
        const names = { magic: "blue", ranged: "green", melee: "orange" };
        boss.performAnimation(new api.core.Animation(10278));
        player.sendMessage(`The Leviathan launches a ${names[style]} orb. Protect from ${style === "ranged" ? "missiles" : style} on impact.`);
        boss.__dt2LeviathanPendingAttack = { style, due: cycle + 2 };
        const max = Math.max(1, boss.getMaxHitpoints?.() ?? 593);
        const healthRatio = boss.getHitpoints() / max;
        boss.__dt2LeviathanNextAttack = cycle + (healthRatio < 0.2 ? 1 : healthRatio < 0.5 ? 2 : 4);
      }
      if (!boss.__dt2LeviathanSpecial && cycle % 13 === 0) {
        const loc = player.getLocation();
        const type = Math.random() < 0.5 ? "rocks" : "lane";
        boss.__dt2LeviathanSpecial = {
          type, x: loc.getX(), y: loc.getY(), axis: Math.random() < 0.5 ? "x" : "y", due: cycle + 2,
        };
        player.sendMessage(type === "rocks"
          ? "The Leviathan tears up the cavern roof. Move away from the falling rocks."
          : "The Leviathan charges a lightning strike along a line. Move out of the marked lane.");
      }
      if (boss.getHitpoints() <= Math.floor((boss.getMaxHitpoints?.() ?? 593) * 0.2) && !boss.__dt2LeviathanEnraged) {
        boss.__dt2LeviathanEnraged = true;
        const pathfinder = api.core.NPC.create(N.CEREBRAL_PATHFINDER, this.tile(26, 38, 0));
        pathfinder.setOwner?.(player);
        pathfinder.setOwnerOnly?.(true);
        pathfinder.setScriptedMovement?.(true);
        pathfinder.__skipDefaultRespawn = true;
        this.add(pathfinder);
        api.core.World.getAddNPCQueue().push(pathfinder);
        boss.__dt2LeviathanPathfinder = pathfinder;
        player.sendMessage("The Leviathan enrages. Stay near the cerebral pathfinder to blunt its attacks.");
      }
    }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  SucellusArea = class DesertTreasureIISucellusArea extends api.core.TemplatedInstanceArea {
    constructor(owner, questPlayer) {
      super(24, 17);
      this.owner = owner;
      this.questPlayer = questPlayer;
      // Reuse the cache prison and asylum on all three quest floors. This keeps
      // the cell, administrative rooms, gate and arena in their authentic map positions.
      for (let x = 0; x < 24; x++) {
        for (let y = 0; y < 17; y++) {
          for (let plane = 0; plane < 4; plane++) {
            this.setChunk(plane, x, y, plane < 3 ? {
              sourceChunkX: 359 + x, sourceChunkY: 792 + y, sourcePlane: plane, rotation: 0,
            } : null);
          }
        }
      }
    }
    getName() { return "Ghorrock Prison (Desert Treasure II)"; }
    allowSummonPet() { return false; }
    isMulti() { return true; }
    canAttack(attacker, target) {
      if (target?.__dt2Sucellus) return attacker?.isPlayer?.() && attacker === this.questPlayer && target.__dt2SucellusAwake;
      if (attacker?.__dt2Sucellus) return target?.isPlayer?.() && target === this.questPlayer && attacker.__dt2SucellusAwake;
      return null;
    }
    process(actor) {
      if (!actor?.isPlayer?.() || actor.getAsPlayer?.() !== this.questPlayer) return;
      const player = this.questPlayer;
      if (!player.getAttribute(SUCELLUS_CELL_ENTERED)) {
        const loc = player.getLocation();
        const x = loc.getX() - this.getBaseX() + 2872;
        const y = loc.getY() - this.getBaseY() + 6336;
        const z = loc.getZ?.() ?? loc.z ?? 0;
        if (z === 2 && Math.abs(x - 2912) <= 1 && Math.abs(y - 6348) <= 1) {
          player.setAttribute(SUCELLUS_CELL_ENTERED, true);
          player.setAttribute(SUCELLUS_CELL_PROGRESS, 0);
          player.moveTo(this.tile(168, 34, 0));
          player.sendMessage("A guard knocks you unconscious. You wake in a locked prison cell.");
        }
      }
      const boss = this.questPlayer.getAttribute(ATTR);
      if (boss?.__dt2Sucellus && boss.getHitpoints?.() > 0 && boss.__dt2SucellusAwake) {
        // Keep the ordinary combat hit queue and regeneration rules; only the
        // scripted wake-up phase is owned by the quest.
        boss.getCombat?.().getLastAttack?.().reset?.();
      }
    }
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
        const npc = entity.getAsNpc();
        const add = api.core.World.getAddNPCQueue();
        for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
        if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      }
      super.destroy();
    }
  };

  function enterWarRoom(p) {
    const current = p.getAttribute(ATTR_WAR_ROOM);
    if (current instanceof WarRoomArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(23, 7, 0));
      return current;
    }
    const area = new WarRoomArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_WAR_ROOM, area);
    // Source origin is chunk 345,803 = 2760,6424; the documented entrance
    // lands beside the Ancient Guardian at 2783,6431.
    p.moveTo(area.tile(23, 7, 0));
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (!owned.guardian) {
      const guardian = api.core.NPC.create(N.ANCIENT_GUARDIAN_3, area.tile(23, 7, 0));
      guardian.setOwner?.(p);
      guardian.setOwnerOnly?.(true);
      guardian.__skipDefaultRespawn = true;
      area.add(guardian);
      api.core.World.getAddNPCQueue().push(guardian);
      owned.guardian = guardian;
      p.setAttribute(ATTR, guardian);
    }
    return area;
  }

  function spawnTotems(player, area) {
    let owned = spawned.get(player);
    if (!owned) spawned.set(player, owned = {});
    if (owned.totems) return owned.totems;
    owned.totems = TOTEMS.map((totem) => {
      const npc = api.core.NPC.create(totem.inactive, area.tile(totem.x - 2760, totem.y - 6424, 0));
      npc.setOwner?.(player);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2Totem = totem.kind;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    return owned.totems;
  }

  function activateTotem({ attacker, target, spell, hit, allowed }) {
    const player = attacker?.isPlayer?.() ? attacker : null;
    const kind = target?.__dt2Totem;
    if (!player || !kind || !allowed || !hit?.isAccurate?.()) return;
    const s = stage(player);
    const area = player.getAttribute(ATTR_WAR_ROOM);
    if (s < S.MACHINE || s >= S.VARDORVIS || !(area instanceof WarRoomArea) || area.isDestroyed?.()
      || !area.entities?.includes(target) || target.getOwner?.() !== player
      || !player.getAttribute(GOLEM_INSPECTED) || !player.getAttribute(ALTAR_INSPECTED)) return;
    const totem = TOTEMS.find((entry) => entry.kind === kind);
    if (!totem || !totemSpellIds.get(kind)?.has(spell?.spellId?.())) {
      player.sendMessage(`That totem requires a ${kind} burst spell or higher.`);
      return;
    }
    if (target.__dt2TotemCharged) return;
    target.__dt2TotemCharged = true;
    target.setNpcTransformationId?.(totem.active);
    player.sendMessage(`The ${kind} totem ignites with ancient power.`);
    const owned = spawned.get(player);
    if (owned?.totems?.every((npc) => npc?.__dt2TotemCharged)) {
      player.setAttribute(TOTEMS_CHARGED, true);
      player.sendMessage("All four totems are active. The machine can now be powered.");
    }
  }

  function stunLeviathan({ attacker, target, spell }) {
    if (!attacker?.isPlayer?.() || !target?.__dt2Leviathan || attacker !== target.getOwner?.()) return;
    const name = spell?.getName?.() ?? spell?.name ?? "";
    if (!/shadow (burst|blitz|barrage|rush)/i.test(name)) return;
    target.__dt2LeviathanStunnedUntil = api.core.World.getProcessCycle() + 6;
    target.__dt2LeviathanPendingAttack = null;
    attacker.sendMessage("The shadow spell stuns the Leviathan, interrupting its attack.");
  }

  function forceTotemAccuracy(event) {
    const npc = event?.target;
    const player = event?.attacker;
    const kind = npc?.__dt2Totem;
    const area = player?.getAttribute?.(ATTR_WAR_ROOM);
    if (!kind || event.combatType !== api.core.CombatType.MAGIC || !player?.isPlayer?.()
      || stage(player) < S.MACHINE || stage(player) >= S.VARDORVIS
      || !(area instanceof WarRoomArea) || !area.entities?.includes(npc) || npc.getOwner?.() !== player
      || !player.getAttribute(GOLEM_INSPECTED) || !player.getAttribute(ALTAR_INSPECTED)) return;
    const combat = player.getCombat?.();
    const selected = combat?.getSelectedSpell?.() ?? combat?.getCastSpell?.() ?? combat?.getPreviousCast?.();
    if (totemSpellIds.get(kind)?.has(selected?.spellId?.())) event.forceAccurate = true;
  }

  function preventTotemDamage({ npc, hit }) {
    if (!npc?.__dt2Totem || !hit?.isAccurate?.()) return;
    for (const damage of hit.getHits?.() ?? []) damage.setDamage(0);
    hit.updateTotalDamage?.();
  }

  function handleScarAxonHit({ npc, hit }) {
    if (!npc?.__dt2ScarAxon || !hit?.isAccurate?.()) return;
    const attacker = hit.getAttacker?.();
    const p = npc.getOwner?.();
    const area = p?.getAttribute?.(ATTR_SCAR_MAZE_TWO);
    if (!p || attacker !== p || !(area instanceof ScarMazeTwoArea) || area.isDestroyed?.()
      || !area.entities?.includes(npc)) return;
    const path = npc.__dt2AxonPath;
    const index = Number(npc.__dt2AxonIndex) || 0;
    const next = Math.min(index + 1, path.points.length - 1);
    for (const damage of hit.getHits?.() ?? []) damage.setDamage(0);
    hit.updateTotalDamage?.();
    const [x, y] = path.points[index];
    const [nextX, nextY] = path.points[next];
    const directionX = Math.sign(nextX - x), directionY = Math.sign(nextY - y);
    const playerLocation = p.getLocation?.();
    const playerX = playerLocation ? playerLocation.getX() - area.getBaseX() + 1696 : NaN;
    const playerY = playerLocation ? playerLocation.getY() - area.getBaseY() + 6400 : NaN;
    const adjacent = Math.max(Math.abs(playerX - x), Math.abs(playerY - y)) === 1;
    const pushesTowardTerminal = (directionX === 0 || Math.sign(playerX - x) === -directionX)
      && (directionY === 0 || Math.sign(playerY - y) === -directionY);
    if (!adjacent || !pushesTowardTerminal) {
      p.sendMessage(`Push the ${npc.__dt2AxonElement} axon from the opposite side so it moves toward its terminal.`);
      return;
    }
    npc.__dt2AxonIndex = next;
    npc.getMovementQueue?.().addSteps(area.tile(nextX - 1696, nextY - 6400, 0));
    if (next !== path.points.length - 1 || npc.__dt2AxonComplete) return;
    npc.__dt2AxonComplete = true;
    const done = (Number(p.getAttribute("desert-treasure-ii:scar-axon-terminals")) || 0) + 1;
    p.setAttribute("desert-treasure-ii:scar-axon-terminals", done);
    p.getPacketSender().sendVarbit(15220, done);
    p.sendMessage(`The ${npc.__dt2AxonElement} axon reaches its terminal.`);
    if (done < SCAR_AXON_PATHS.length) return;
    p.setAttribute(SCAR_AXON_ROOM_COMPLETE, true);
    p.getPacketSender().sendVarbit(15258, 1);
    p.sendMessage("All four axons have reached their terminals. The passage to the nerve chamber opens.");
  }

  function preventScarSummonProtection({ npc, hit }) {
    if (!npc?.__dt2SummonDemon || !hit?.isAccurate?.()) return;
    const p = npc.getOwner?.();
    const owned = spawned.get(p);
    if (!p || (owned?.scarSummonImps ?? []).every((imp) => !imp?.isRegistered?.() || imp.getHitpoints?.() <= 0)) return;
    for (const damage of hit.getHits?.() ?? []) damage.setDamage(0);
    hit.updateTotalDamage?.();
  }

  function enterVault(p) {
    const current = p.getAttribute(ATTR_VAULT_AREA);
    if (current instanceof AncientVaultArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(15, 6, 1));
      return current;
    }
    const area = new AncientVaultArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_VAULT_AREA, area);
    p.moveTo(area.tile(15, 6, 1));
    const smith = api.core.NPC.create(ASGARNIA_SMITH_VAULT_INITIAL, area.tile(12, 15, 1));
    smith.setOwner?.(p);
    smith.setOwnerOnly?.(true);
    smith.__skipDefaultRespawn = true;
    area.add(smith);
    api.core.World.getAddNPCQueue().push(smith);
    p.setAttribute(ATTR_VAULT_SMITH, smith);
    return area;
  }

  function spawnSurfaceKasonde(p) {
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (owned.kasonde?.isRegistered?.()) return owned.kasonde;
    owned.kasonde = api.spawnNpc({ id: N.KASONDE, x: 1191, y: 3404, z: 0, wanderRadius: 0, owner: p, ownerOnly: true });
    return owned.kasonde;
  }

  function enterHideout(p) {
    const current = p.getAttribute(ATTR_STRANGLEWOOD_HIDEOUT);
    if (current instanceof StranglewoodHideoutArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(31, 20, 0));
      return current;
    }
    const area = new StranglewoodHideoutArea(p.getUsername?.(), p);
    area.enter(p);
    p.setAttribute(ATTR_STRANGLEWOOD_HIDEOUT, area);
    p.moveTo(area.tile(31, 20, 0));
    const kasonde = api.core.NPC.create(N.KASONDE, area.tile(24, 20, 0));
    kasonde.setOwner?.(p);
    kasonde.setOwnerOnly?.(true);
    kasonde.setMaxHitpoints?.(85);
    kasonde.setHitpoints?.(85);
    kasonde.__skipDefaultRespawn = true;
    area.kasonde = kasonde;
    area.add(kasonde);
    api.core.World.getAddNPCQueue().push(kasonde);
    area.spawnEnemy(0);
    area.nextSpawnTick = 16;
    return area;
  }

  function leaveHideout(p) {
    const area = p.getAttribute(ATTR_STRANGLEWOOD_HIDEOUT);
    if (!(area instanceof StranglewoodHideoutArea) || area.isDestroyed()) return false;
    if (area.failed) {
      p.setAttribute(VARDORVIS_PROGRESS, 6);
      p.sendMessage("Kasonde did not survive the horde. You will need to start the defence again.");
    } else if (area.defended) {
      p.setAttribute(VARDORVIS_PROGRESS, 9);
    }
    area.leave(p, false);
    area.postLeave(p, false);
    area.destroy();
    p.setAttribute(ATTR_STRANGLEWOOD_HIDEOUT, null);
    p.moveTo(new api.core.Location(1187, 3411, 0));
    return true;
  }

  function enterStranglewoodTemple(p) {
    const current = p.getAttribute(ATTR_STRANGLEWOOD_TEMPLE);
    if (current instanceof StranglewoodTempleArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(6, 16, 0));
      if ((Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 18 && has(p, I.TEMPLE_KEY_3)) spawnTempleKasonde(p, current);
      return current;
    }
    const area = new StranglewoodTempleArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_STRANGLEWOOD_TEMPLE, area);
    p.moveTo(area.tile(6, 16, 0));
    if ((Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 18 && has(p, I.TEMPLE_KEY_3)) {
      spawnTempleKasonde(p, area);
      return area;
    }
    const enemies = [[4, 13], [9, 15], [14, 20]].map(([x, y]) => {
      const npc = api.core.NPC.create(N.STRANGLED, area.tile(x, y, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2TempleEnemy = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    owned.templeEnemies = enemies;
    return area;
  }

  function enterVardorvisArena(p) {
    const current = p.getAttribute(ATTR_VARDORVIS_AREA);
    if (current instanceof VardorvisArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(13, 18, 0));
      spawnBoss(p, "vardorvis");
      return current;
    }
    const area = new VardorvisArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_VARDORVIS_AREA, area);
    p.moveTo(area.tile(13, 18, 0));
    spawnBoss(p, "vardorvis");
    return area;
  }

  function enterScar(p) {
    const current = p.getAttribute(ATTR_SCAR_AREA);
    if (current instanceof ScarArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(21, 33, 0));
      setScarVarbit(p, 6);
      if (p.getAttribute(SCAR_PERSTEN_TALKED)) revealScarMazeEntry(p, current);
      if (p.getAttribute(SCAR_PERSTEN_ROOM1_TALKED)) revealScarMazeTwoEntry(p, current);
      if (p.getAttribute(SCAR_BOAT_TRIED)) spawnScarPersten(p, current);
      if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) spawnScarDemons(p, current);
      return current;
    }
    const area = new ScarArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_SCAR_AREA, area);
    setScarVarbit(p, 6);
    p.moveTo(area.tile(21, 33, 0));
    if (p.getAttribute(SCAR_PERSTEN_TALKED)) revealScarMazeEntry(p, area);
    if (p.getAttribute(SCAR_PERSTEN_ROOM1_TALKED)) revealScarMazeTwoEntry(p, area);
    if (p.getAttribute(SCAR_BOAT_TRIED)) spawnScarPersten(p, area);
    if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) spawnScarDemons(p, area);
    return area;
  }

  function enterLeviathanArea(p) {
    let area = p.getAttribute(ATTR_LEVIATHAN_AREA);
    if (!(area instanceof LeviathanArea) || area.isDestroyed()) {
      area = new LeviathanArea(p.getUsername?.(), p);
      area.enter(p);
      p.setAttribute(ATTR_LEVIATHAN_AREA, area);
    } else area.enter(p);
    p.moveTo(area.tile(7, 41, 0));
    setScarVarbit(p, p.getAttribute(SCAR_LEVIATHAN_DEBRIS_SEARCHED) ? 48
      : p.getAttribute(SCAR_PERSTEN_LEFT_SHIP) ? 46
        : p.getAttribute(SCAR_LEVIATHAN_KILLED) ? 42 : 40);
    if (!p.getAttribute(SCAR_LEVIATHAN_KILLED)) spawnBoss(p, "leviathan");
    else {
      p.moveTo(area.tile(32, 46, 0));
      spawnScarPerstenAtShip(p, area);
    }
    return area;
  }

  function enterSucellusArea(p, atBossGate = true) {
    let area = p.getAttribute(SUCELLUS_AREA);
    if (!(area instanceof SucellusArea) || area.isDestroyed()) {
      area = new SucellusArea(p.getUsername?.(), p);
      area.enter(p);
      p.setAttribute(SUCELLUS_AREA, area);
      if (!Number.isFinite(Number(p.getAttribute(SUCELLUS_POISONS)))) p.setAttribute(SUCELLUS_POISONS, 0);
    } else area.enter(p);
    p.moveTo(atBossGate ? area.tile(167, 97, 0) : area.tile(55, 18, 2));
    if (atBossGate) {
      const boss = spawnBoss(p, "sucellus");
      if (boss && (Number(p.getAttribute(SUCELLUS_POISONS)) || 0) >= 2) {
        boss.__dt2SucellusAwake = true;
        boss.setScriptedMovement?.(false);
        boss.setNpcTransformationId?.(N.DUKE_SUCELLUS_7);
      }
    }
    return area;
  }

  function spawnSucellusCellAssassin(p, area) {
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (owned.sucellusAssassin?.isRegistered?.() && area.entities.includes(owned.sucellusAssassin)) return owned.sucellusAssassin;
    const npc = api.core.NPC.create(N.ASSASSIN_7, area.tile(48, 39, 2));
    npc.setOwner?.(p);
    npc.setOwnerOnly?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    owned.sucellusAssassin = npc;
    return npc;
  }

  function spawnScarPerstenAtShip(p, area) {
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (owned.scarPerstenShip?.isRegistered?.()) return owned.scarPerstenShip;
    const npc = api.core.NPC.create(N.WIZARD_PERSTEN_5, area.tile(34, 38, 0));
    npc.setOwner?.(p);
    npc.setOwnerOnly?.(true);
    npc.setScriptedMovement?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    owned.scarPerstenShip = npc;
    p.setAttribute(SCAR_PERSTEN_AT_SHIP, true);
    return npc;
  }

  function revealScarMazeEntry(p, area) {
    if (!(area instanceof ScarArea) || area.isDestroyed?.() || area.scarMazeEntry) return;
    // The live cache has only an unclickable wall at this tile; the quest opens
    // the passage after Persten's camp dialogue. Use the cache's canonical
    // Passage loc in this owner's Scar copy, matching the actual scene change.
    const passage = new api.core.GameObject(SCAR_PASSAGE_OPEN, area.tile(43, 41, 0), 10, 0, area);
    area.add(passage);
    area.scarMazeEntry = passage;
    p.getPacketSender().sendObject(passage);
  }

  function revealScarMazeTwoEntry(p, area) {
    if (!(area instanceof ScarArea) || area.isDestroyed?.()) return;
    const objectId = p.getAttribute(SCAR_PERSTEN_ROOM2_TALKED) ? 49410 : O.PASSAGE_15;
    if (area.scarMazeTwoEntry?.id === objectId) return;
    if (area.scarMazeTwoEntry) area.detach?.(area.scarMazeTwoEntry);
    const passage = new api.core.GameObject(objectId, area.tile(51, 34, 0), 10, 0, area);
    area.add(passage);
    area.scarMazeTwoEntry = passage;
    p.getPacketSender().sendObject(passage);
  }

  function enterScarMazeThree(p) {
    const current = p.getAttribute(ATTR_SCAR_MAZE_THREE);
    if (current instanceof ScarMazeThreeArea && !current.isDestroyed()) {
      current.enter(p);
      current.scarMazeThreeActive = true;
      p.setAttribute(SCAR_MAZE_THREE_ACTIVE, true);
      p.moveTo(current.tile(41, 36, 0));
      setScarVarbit(p, 32);
      return current;
    }
    const area = new ScarMazeThreeArea(p.getUsername?.(), p);
    area.enter(p);
    p.setAttribute(ATTR_SCAR_MAZE_THREE, area);
    p.setAttribute(SCAR_MAZE_THREE_ACTIVE, true);
    if (!Number.isFinite(Number(p.getAttribute(SCAR_MAZE_THREE_AIR)))) p.setAttribute(SCAR_MAZE_THREE_AIR, 100);
    if (!Array.isArray(p.getAttribute(SCAR_MEMORY_ORDER)) || p.getAttribute(SCAR_MEMORY_ORDER).length !== 4) {
      p.setAttribute(SCAR_MEMORY_ORDER, shuffled([0, 1, 2, 3]));
    }
    if (!Number.isFinite(Number(p.getAttribute(SCAR_MEMORY_STEP)))) p.setAttribute(SCAR_MEMORY_STEP, 0);
    area.scarMazeThreeActive = true;
    p.moveTo(area.tile(41, 36, 0));
    setScarVarbit(p, 32);
    p.getPacketSender().sendVarbit(15211, Number(p.getAttribute(SCAR_MAZE_THREE_AIR)) || 100);
    p.getPacketSender().sendVarbit(15212, Number(p.getAttribute(SCAR_MEMORY_STEP)) || 0);
    const order = p.getAttribute(SCAR_MEMORY_ORDER);
    order.forEach((growth, index) => p.getPacketSender().sendVarbit(15213 + index, growth));
    p.getPacketSender().sendVarbit(15258, p.getAttribute(SCAR_MEMORY_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15259, p.getAttribute(SCAR_LEECH_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15260, p.getAttribute(SCAR_TREE_COMPLETE) ? 1 : 0);
    return area;
  }

  function enterScarMazeTwo(p) {
    const current = p.getAttribute(ATTR_SCAR_MAZE_TWO);
    if (current instanceof ScarMazeTwoArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(60, 20, 0));
      setScarVarbit(p, 24);
      return current;
    }
    const area = new ScarMazeTwoArea(p.getUsername?.(), p);
    area.enter(p);
    p.setAttribute(ATTR_SCAR_MAZE_TWO, area);
    p.setAttribute(SCAR_MAZE_TWO_ENTERED, true);
    p.moveTo(area.tile(60, 20, 0));
    setScarVarbit(p, 24);
    p.getPacketSender().sendVarbit(15258, p.getAttribute(SCAR_AXON_ROOM_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15259, p.getAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15260, p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE) ? 1 : 0);
    return area;
  }

  function enterScarMazeOne(p) {
    const current = p.getAttribute(ATTR_SCAR_MAZE_ONE);
    if (current instanceof ScarMazeOneArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(36, 54, 0));
      return current;
    }
    const area = new ScarMazeOneArea(p.getUsername?.(), p);
    area.enter(p);
    p.setAttribute(ATTR_SCAR_MAZE_ONE, area);
    p.setAttribute(SCAR_MAZE_ONE_ENTERED, true);
    setScarVarbit(p, 16);
    p.getPacketSender().sendVarbit(15193, 1);
    p.getPacketSender().sendVarbit(15192, 2);
    p.getPacketSender().sendVarbit(15194, 1);
    if (!p.getAttribute(SCAR_PATH_COMPLETE)) p.setAttribute(SCAR_PATH_COMPLETE, false);
    p.moveTo(area.tile(36, 54, 0));
    if (!p.getAttribute(SCAR_PATH_COMPLETE)) spawnScarPathRunner(p, area, 0);
    if (p.getAttribute("desert-treasure-ii:scar-growth-complete")) revealScarBoatPassage(p);
    return area;
  }

  function spawnScarPathRunner(p, area, index) {
    const path = SCAR_PATHS[index];
    if (!path) return;
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    const [startX, startY] = path.points[0];
    const runner = api.core.NPC.create(path.npc, area.tile(startX - 2160, startY - 6400, 0));
    runner.setOwner?.(p);
    runner.setOwnerOnly?.(true);
    runner.setScriptedMovement?.(true);
    runner.__skipDefaultRespawn = true;
    area.add(runner);
    api.core.World.getAddNPCQueue().push(runner);
    runner.__dt2ScarPathPointIndex = 0;
    area.pathRunner = runner;
    owned.scarPathRunner = runner;
  }

  function pushScarPathRunner(event) {
    const { player, npc, npcId, definition, clickType } = event;
    if (stage(player) !== S.LEVIATHAN) return;
    const area = player.getAttribute(ATTR_SCAR_MAZE_ONE);
    if (!(area instanceof ScarMazeOneArea) || area.isDestroyed?.() || area.pathRunner !== npc
      || npc?.getOwner?.() !== player) return;
    const option = definition?.getActions?.()?.[clickType - 1];
    if (option !== "Move" || ![N.CEREBRAL_PATHFINDER, N.CEREBRAL_PATHBREAKER].includes(npcId)) return;
    event.handled = true;
    const path = SCAR_PATHS[area.pathIndex];
    const [fromX, fromY] = path?.points[0] ?? [];
    if (!path) {
      player.sendMessage("That pathfinder has reached the end of its marked route.");
      return;
    }
    if (npc.__dt2ScarMoving) {
      // The area process normally advances the next runner as soon as the player
      // catches up. Also check on interaction so a completed route cannot strand
      // the puzzle if the final movement and player process share a game cycle.
      const finish = area.tile(path.points.at(-1)[0] - 2160, path.points.at(-1)[1] - 6400, 0);
      const runnerLoc = npc.getLocation();
      const playerLoc = player.getLocation();
      const distance = Math.max(Math.abs(playerLoc.getX() - runnerLoc.getX()), Math.abs(playerLoc.getY() - runnerLoc.getY()));
      if (Math.max(Math.abs(runnerLoc.getX() - finish.getX()), Math.abs(runnerLoc.getY() - finish.getY())) <= 2 && distance <= 3) {
        area.lastProcessCycle = -1;
        area.process(player);
        if (area.pathRunner !== npc) return;
      }
      player.sendMessage("The pathfinder is already moving along its marked route.");
      return;
    }
    const side = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] }[path.from];
    const expectedPlayerX = fromX + side[0];
    const expectedPlayerY = fromY + side[1];
    const playerLoc = player.getLocation();
    const playerX = playerLoc.getX() - area.getBaseX() + 2160;
    const playerY = playerLoc.getY() - area.getBaseY() + 6400;
    if (playerX !== expectedPlayerX || playerY !== expectedPlayerY) {
      player.sendMessage(`Stand ${path.from} of the pathfinder and move it along the open path.`);
      return;
    }
    npc.__dt2ScarMoving = true;
    npc.__dt2ScarRouteIndex = 1;
    const [nextX, nextY] = path.points[1];
    const next = area.tile(nextX - 2160, nextY - 6400, 0);
    api.core.PathFinder.calculateWalkRoute(npc, next.getX(), next.getY());
  }

  function routeToScarPathRunner(event) {
    const area = event.player?.getAttribute?.(ATTR_SCAR_MAZE_ONE);
    if (stage(event.player) === S.LEVIATHAN && area instanceof ScarMazeOneArea
      && area.pathRunner === event.npc && [N.CEREBRAL_PATHFINDER, N.CEREBRAL_PATHBREAKER].includes(event.npcId)) {
      event.range = 1;
    }
  }

  function spawnScarDemons(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (owned.scarEnemies?.some((npc) => npc?.isRegistered?.() && npc.getHitpoints?.() > 0)) return;
    // The opening confrontation is one ordinary/scarred lesser, greater and
    // black demon. Their cache variants preserve the real combat stats.
    const enemies = [
      [N.LESSER_DEMON_15, 2017, 6436], [N.SCARRED_LESSER_DEMON, 2021, 6437],
      [N.GREATER_DEMON_15, 2025, 6435], [N.SCARRED_GREATER_DEMON, 2020, 6429],
      [N.BLACK_DEMON_18, 2016, 6429], [N.SCARRED_BLACK_DEMON, 2025, 6430],
    ].map(([id, x, y]) => {
      const npc = api.core.NPC.create(id, area.tile(x - 2000, y - 6400, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2ScarEnemy = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    owned.scarEnemies = enemies;
  }

  function talkCatalyticGuardian({ player: p, npcId }) {
    if (stage(p) !== S.LEVIATHAN || p.getAttribute(ATTR_SCAR_AREA)) return;
    talk(p, npcId, "praefectus-classis-perseriya-talking-to-the-catalytic-guardian");
  }

  function spawnScarPersten(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (owned.scarPersten?.isRegistered?.()) return owned.scarPersten;
    const npc = api.core.NPC.create(N.WIZARD_PERSTEN_5, area.tile(51, 43, 0));
    npc.setOwner?.(p);
    npc.setOwnerOnly?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    owned.scarPersten = npc;
    return npc;
  }

  function spawnScarAxons(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (owned.scarAxons?.some((npc) => npc?.isRegistered?.())) return owned.scarAxons;
    owned.scarAxons = SCAR_AXON_PATHS.map((path, index) => {
      const [x, y] = path.points[0];
      const npc = api.core.NPC.create(N.ABYSSAL_AXON, area.tile(x - 1696, y - 6400, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.setScriptedMovement?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2ScarAxon = true;
      npc.__dt2AxonPath = path;
      npc.__dt2AxonIndex = 0;
      npc.__dt2AxonElement = ["Cosmic", "Fire", "Nature", "Water"][index];
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    return owned.scarAxons;
  }

  function spawnScarSummoningRoom(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (p.getAttribute(SCAR_SUMMON_ROOM_STARTED)) return;
    p.setAttribute(SCAR_SUMMON_ROOM_STARTED, true);
    owned.scarSummonImps = [[1740, 6447], [1743, 6448], [1747, 6447]].map(([x, y]) => {
      const npc = api.core.NPC.create(N.SCARRED_IMP, area.tile(x - 1696, y - 6400, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2SummonImp = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    owned.scarSummonDemons = [[1743, 6444], [1747, 6444]].map(([x, y]) => {
      const npc = api.core.NPC.create(N.LESSER_DEMON_18, area.tile(x - 1696, y - 6400, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2SummonDemon = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    p.setAttribute(SCAR_SUMMON_IMPS, owned.scarSummonImps.length);
    p.setAttribute(SCAR_SUMMON_DEMONS, owned.scarSummonDemons.length);
  }

  function spawnScarCatalyst(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (owned.scarCatalyst?.isRegistered?.()) return owned.scarCatalyst;
    const npc = api.core.NPC.create(N.DT2_SCAR_MAZE_1_RITUAL_CATALYST, area.tile(40, 12, 0));
    npc.setOwner?.(p);
    npc.setOwnerOnly?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    owned.scarCatalyst = npc;
    return npc;
  }

  function revealScarBoatPassage(p) {
    const area = p.getAttribute(ATTR_SCAR_MAZE_ONE);
    if (!(area instanceof ScarMazeOneArea) || area.isDestroyed?.() || area.scarBoatPassage) return;
    // This passage is created by the room's completion state; it has no static map placement.
    const object = new api.core.GameObject(49418, area.tile(60, 2, 0), 10, 0, area);
    area.add(object);
    area.scarBoatPassage = object;
    p.getPacketSender().sendObject(object);
  }

  function spawnScarLightLeeches(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (owned.scarLightLeeches?.some((npc) => npc?.isRegistered?.())) return owned.scarLightLeeches;
    // Four leeches wait beside the cache's four damaged growths.
    owned.scarLightLeeches = [[2220, 6435], [2219, 6424], [2230, 6423], [2231, 6434]].map(([x, y]) => {
      const npc = api.core.NPC.create(N.DT2_SCAR_MAZE_LIGHT_LEECH, area.tile(x - 2160, y - 6400, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    return owned.scarLightLeeches;
  }

  function spawnScarTreeRoom(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (owned.scarTreeAntibodies?.some((npc) => npc?.isRegistered?.())) return;
    p.setAttribute(SCAR_TREE_STARTED, true);
    p.setAttribute("desert-treasure-ii:scar-tree-wave", 0);
    owned.scarTreeAntibodies = [[1902, 6412], [1905, 6412], [1908, 6412]].map(([x, y]) => {
      const npc = api.core.NPC.create(12377, area.tile(x - 1856, y - 6400, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2ScarAntibody = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    spawnScarTreeWave(p, area);
  }

  function spawnScarTreeWave(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    const wave = Number(p.getAttribute("desert-treasure-ii:scar-tree-wave")) || 0;
    if (wave >= 4 || (owned.scarTreeEnemies ?? []).some((npc) => npc?.isRegistered?.() && npc.getHitpoints?.() > 0)) return;
    const ids = wave % 2 === 0 ? [12379, 12378] : [12378, 12379];
    owned.scarTreeEnemies = ids.map((id, index) => {
      const npc = api.core.NPC.create(id, area.tile(41 + index * 2, 8 + (wave % 2) * 2, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2ScarTreeEnemy = true;
      npc.getCombat?.().attack?.(owned.scarTreeAntibodies?.[index % 3]);
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      return npc;
    });
    p.setAttribute("desert-treasure-ii:scar-tree-wave", wave + 1);
  }

  function enterScarTreeRoom(p, area) {
    const tile = area.tile(46, 11, 0);
    p.moveTo(tile);
    p.setAttribute("desert-treasure-ii:scar-tree-in-room", true);
    if (!p.getAttribute(SCAR_TREE_COMPLETE)) {
      spawnScarTreeRoom(p, area);
      p.sendMessage("Defend the abyssal antibodies from the Scarred hellhounds and lesser demons until the Brain Pillar is healed.");
    }
  }

  function enterScarLeechRoom(p, area) {
    p.moveTo(area.tile(6, 30, 0));
    p.setAttribute("desert-treasure-ii:scar-leech-in-room", true);
    if (!p.getAttribute(SCAR_LEECH_GROWTHS_REPAIRED)) p.setAttribute(SCAR_LEECH_GROWTHS_REPAIRED, []);
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (!owned.scarMazeThreeLightLeeches?.some((npc) => npc?.isRegistered?.())) {
      owned.scarMazeThreeLightLeeches = [[1868, 6430], [1864, 6430], [1872, 6430], [1877, 6430]].map(([x, y]) => {
        const npc = api.core.NPC.create(N.DT2_SCAR_MAZE_LIGHT_LEECH, area.tile(x - 1856, y - 6400, 0));
        npc.setOwner?.(p);
        npc.setOwnerOnly?.(true);
        npc.__skipDefaultRespawn = true;
        npc.__dt2ScarMazeThreeLeech = true;
        area.add(npc);
        api.core.World.getAddNPCQueue().push(npc);
        return npc;
      });
    }
    if (!owned.scarMazeThreeBloodCells?.some((npc) => npc?.isRegistered?.())) {
      owned.scarMazeThreeBloodCells = [
        ...Array.from({ length: 3 }, (_, i) => ({ id: 12369, x: 1866 + i * 2, y: 6436, type: "crimson" })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: 12370, x: 1866 + i * 2, y: 6425, type: "radiant" })),
      ].map(({ id, x, y, type }) => {
        const npc = api.core.NPC.create(id, area.tile(x - 1856, y - 6400, 0));
        npc.setOwner?.(p);
        npc.setOwnerOnly?.(true);
        npc.__skipDefaultRespawn = true;
        npc.__dt2ScarBloodCell = type;
        area.add(npc);
        api.core.World.getAddNPCQueue().push(npc);
        return npc;
      });
    }
    p.sendMessage("Take four illuminating lures from the light leeches and use them on the damaged growths.");
  }

  function handleScarMazeThreeObject(event, tile) {
    const p = event?.player;
    if (!p || stage(p) !== S.LEVIATHAN || !tile || !p.getAttribute(SCAR_MAZE_THREE_ACTIVE)) return false;
    const { objectId, definition } = event;
    const id = definition?.id ?? objectId;
    const area = p.getAttribute(ATTR_SCAR_MAZE_THREE);
    if (id === 49410 && tile.x === 1897 && tile.y === 6436) {
      if (p.getAttribute(SCAR_MEMORY_COMPLETE)) {
        p.sendMessage("The Abyssal Stem's sequence is already restored.");
        return true;
      }
      if (p.getAttribute(SCAR_BOAT3_BURNED)) {
        const scar = p.getAttribute(ATTR_SCAR_AREA);
        if (scar instanceof ScarArea && !scar.isDestroyed()) {
          area.leave(p, false);
          area.postLeave(p, false);
          p.moveTo(scar.tile(51, 43, 0));
          p.setAttribute(SCAR_MAZE_THREE_ACTIVE, false);
          setScarVarbit(p, 34);
          p.sendMessage("You leave the final passage and return to Persten's camp.");
        }
        return true;
      }
      let order = p.getAttribute(SCAR_MEMORY_ORDER);
      if (!Array.isArray(order) || order.length !== 4) {
        order = shuffled([0, 1, 2, 3]);
        p.setAttribute(SCAR_MEMORY_ORDER, order);
      }
      p.setAttribute(SCAR_MEMORY_STEP, 0);
      p.getPacketSender().sendVarbit(15212, 0);
      order.forEach((value, index) => p.getPacketSender().sendVarbit(15213 + index, value));
      p.sendMessage("The Abyssal Stem reveals a sequence. Touch the four growths in that order, surfacing at air bubbles as needed.");
      return true;
    }
    if (id === 49391 && SCAR_MEMORY_GROWTHS.some(([x, y]) => x === tile.x && y === tile.y)) {
      const index = SCAR_MEMORY_GROWTHS.findIndex(([x, y]) => x === tile.x && y === tile.y);
      const order = p.getAttribute(SCAR_MEMORY_ORDER) ?? [];
      const step = Number(p.getAttribute(SCAR_MEMORY_STEP)) || 0;
      if (p.getAttribute(SCAR_MEMORY_COMPLETE)) { p.sendMessage("The Abyssal Stem's sequence is already restored."); return true; }
      if (order[step] !== index) {
        p.setAttribute(SCAR_MEMORY_STEP, 0);
        p.getPacketSender().sendVarbit(15212, 0);
        p.sendMessage("The growths dim and the sequence resets. Touch the Abyssal Stem to observe it again.");
        return true;
      }
      const next = step + 1;
      p.setAttribute(SCAR_MEMORY_STEP, next);
      p.getPacketSender().sendVarbit(15212, next);
      if (next === 4) {
        p.setAttribute(SCAR_MEMORY_COMPLETE, true);
        p.getPacketSender().sendVarbit(15258, 1);
        p.sendMessage("The Abyssal Stem glows steadily. The memory puzzle is complete.");
      }
      return true;
    }
    if (id === 49412 && tile.x === 1902 && tile.y === 6411) {
      if (!p.getAttribute(SCAR_MEMORY_COMPLETE)) { p.sendMessage("The Brain Pillar room remains sealed until the Abyssal Stem is restored."); return true; }
      enterScarTreeRoom(p, area);
      return true;
    }
    if (id === 49416 && tile.x === 1891 && tile.y === 6457) {
      if (!p.getAttribute(SCAR_TREE_COMPLETE)) { p.sendMessage("Defend the Brain Pillar before entering the Unlit Veins."); return true; }
      enterScarLeechRoom(p, area);
      return true;
    }
    if (id === 49411 && tile.x === 1862 && tile.y === 6421) {
      if (!p.getAttribute(SCAR_TREE_COMPLETE)) { p.sendMessage("Defend the Brain Pillar before entering the Unlit Veins."); return true; }
      enterScarLeechRoom(p, area);
      return true;
    }
    if (id === 49415 && tile.x === 1861 && tile.y === 6410) {
      if (!p.getAttribute(SCAR_LEECH_COMPLETE)) { p.sendMessage("The Unlit Veins remain incomplete."); return true; }
      p.sendMessage("You return through the green neural portal.");
      return true;
    }
    if (id === 49419 && tile.x === 1899 && tile.y === 6456) {
      if (!p.getAttribute(SCAR_MEMORY_COMPLETE) || !p.getAttribute(SCAR_TREE_COMPLETE) || !p.getAttribute(SCAR_LEECH_COMPLETE)) {
        p.sendMessage("The shipwreck passage remains sealed until the three rooms are complete.");
        return true;
      }
      p.setAttribute(SCAR_BOAT3_ROOM, true);
      p.getPacketSender().sendVarbit(15261, 1);
      p.sendMessage("You enter the eastern shipwreck chamber.");
      return true;
    }
    if (p.getAttribute(SCAR_BOAT3_ROOM)) {
      if (id === 49425 && tile.x === 1915 && tile.y === 6460) {
        if (!has(p, I.TINDERBOX)) p.getInventory().adds(I.TINDERBOX, 1);
        p.sendMessage("You search the north-east crate and find a tinderbox.");
        return true;
      }
      if (id === 49427 && tile.x === 1912 && tile.y === 6446) {
        if (!has(p, I.GUNPOWDER_2)) p.getInventory().adds(I.GUNPOWDER_2, 1);
        p.sendMessage("You search the south-east skeleton and find gunpowder.");
        return true;
      }
      if (id === 49426 && tile.x === 1902 && tile.y === 6459) {
        if (!has(p, I.SLIMY_KEY)) p.getInventory().adds(I.SLIMY_KEY, 1);
        p.sendMessage("You search the north-west skeleton and find a slimy key.");
        return true;
      }
      if ([49420, 49421, 49422].includes(id) && tile.x === 1909 && tile.y === 6449) {
        if (!has(p, I.SLIMY_KEY)) { p.sendMessage("The chest is locked. A slimy key may fit it."); return true; }
        p.getInventory().deleteNumber(I.SLIMY_KEY, 1);
        if (!has(p, I.DAMP_TABLET_2)) p.getInventory().adds(I.DAMP_TABLET_2, 1);
        p.setAttribute("desert-treasure-ii:scar-boat3-chest-open", true);
        p.sendMessage("The slimy key opens the chest. You take a damp tablet.");
        return true;
      }
    }
    if (id === O.AIR_BUBBLE && SCAR_MAZE_THREE_AIR_BUBBLES.some(([x, y]) => x === tile.x && y === tile.y)) {
      p.setAttribute(SCAR_MAZE_THREE_AIR, 100);
      p.getPacketSender().sendVarbit(15211, 100);
      p.sendMessage("You surface at the air bubble and replenish your oxygen.");
      return true;
    }
    return false;
  }

  function takeScarLightLure({ player: p, npc }) {
    if (stage(p) !== S.LEVIATHAN || (!p.getAttribute(SCAR_GROWTH_LIVE) && !p.getAttribute("desert-treasure-ii:scar-leech-in-room"))) return;
    const owned = spawned.get(p);
    const mazeThree = owned?.scarMazeThreeLightLeeches?.includes(npc);
    if (!owned?.scarLightLeeches?.includes(npc) && !mazeThree) return;
    if (Math.random() < 0.5) {
      p.getInventory().adds(I.ILLUMINATING_LURE, 1);
      const area = mazeThree ? p.getAttribute(ATTR_SCAR_MAZE_THREE) : p.getAttribute(ATTR_SCAR_MAZE_ONE);
      area?.remove?.(npc);
      if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      if (mazeThree) owned.scarMazeThreeLightLeeches = owned.scarMazeThreeLightLeeches.filter((entry) => entry !== npc);
      else owned.scarLightLeeches = owned.scarLightLeeches.filter((entry) => entry !== npc);
      p.sendMessage("You take an illuminating lure from the light leech.");
      return true;
    }
    const damage = 2 + Math.floor(Math.random() * 5);
    p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(damage, api.core.HitMask.RED)]);
    p.sendMessage("The light leech lashes out before you can take its lure.");
    return true;
  }

  function finishScarGrowthRepair(p) {
    p.setAttribute(SCAR_GROWTH_LURES, 4);
    let order = p.getAttribute(SCAR_GROWTH_ORDER);
    if (!Array.isArray(order) || order.length !== SCAR_ENERGY_RUNES.length) {
      order = shuffled(SCAR_ENERGY_RUNES);
      p.setAttribute(SCAR_GROWTH_ORDER, order);
    }
    SCAR_GROWTH_ORDER_VARBITS.forEach((id, index) => p.getPacketSender().sendVarbit(id, order[index]));
    SCAR_ENERGIES.forEach((energy) => p.getPacketSender().sendVarbit(energy.state, 1));
    p.getPacketSender().sendVarbit(SCAR_GROWTH_STEP_VARBIT, 0);
    p.getPacketSender().sendVarbit(SCAR_GROWTH_LIT_VARBIT, 4);
    p.setAttribute(SCAR_GROWTH_STEP, 0);
    p.sendMessage("The room brightens. Touch the six runic energies in their hidden order.");
  }

  function touchScarEnergy({ player: p, objectId, definition, location }) {
    if (stage(p) !== S.LEVIATHAN || !p.getAttribute(SCAR_GROWTH_LIVE)
      || Number(p.getAttribute(SCAR_GROWTH_LURES)) < 4) return false;
    const tile = scarMazeSourceTile(p, location);
    if (!tile || tile.x < 2218 || tile.x > 2233 || tile.y < 6422 || tile.y > 6437) return false;
    const visibleId = definition?.id ?? objectId;
    const energy = SCAR_ENERGIES.find((entry) => entry.visible === visibleId || entry.base === objectId);
    if (!energy || tile.x !== energy.tile[0] || tile.y !== energy.tile[1]) return false;
    const step = Number(p.getAttribute(SCAR_GROWTH_STEP)) || 0;
    const order = p.getAttribute(SCAR_GROWTH_ORDER) ?? [];
    if (order[step] !== energy.rune) {
      p.sendMessage("The energy flares, but it isn't next in the sequence.");
      return true;
    }
    p.setAttribute(SCAR_GROWTH_STEP, step + 1);
    p.getPacketSender().sendVarbit(energy.state, 2);
    p.getPacketSender().sendVarbit(SCAR_GROWTH_STEP_VARBIT, step + 1);
    if (step + 1 === SCAR_ENERGY_RUNES.length) {
      p.setAttribute("desert-treasure-ii:scar-growth-complete", true);
      revealScarBoatPassage(p);
      p.sendMessage("The damaged growths restore the passage. The shipwreck chamber is now reachable.");
    }
    return true;
  }

  function inspectScarCatalyst({ player: p }) {
    if (stage(p) !== S.LEVIATHAN || !p.getAttribute(SCAR_RIFT_LIVE)) return;
    const progress = Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0;
    const order = p.getAttribute(SCAR_CATALYST_ORDER) ?? [];
    const expected = order[progress] ?? SCAR_CATALYST_RUNES[0];
    const name = SCAR_CATALYST_RUNE_NAMES[SCAR_CATALYST_RUNES.indexOf(expected)] ?? "unknown";
    p.sendMessage(`The Catalyst is currently resonating with ${name} nerve.`);
  }

  function handleNerveOnCatalyst(event) {
    const { player: p, npcId, itemId } = event ?? {};
    if (stage(p) !== S.LEVIATHAN || !p.getAttribute(SCAR_RIFT_LIVE)
      || npcId !== N.DT2_SCAR_MAZE_1_RITUAL_CATALYST) return false;
    event.handled = true;
    const progress = Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0;
    let order = p.getAttribute(SCAR_CATALYST_ORDER);
    if (!Array.isArray(order) || order.length !== SCAR_CATALYST_RUNES.length) {
      order = shuffled(SCAR_CATALYST_RUNES);
      p.setAttribute(SCAR_CATALYST_ORDER, order);
    }
    const expected = order[progress];
    if (itemId === expected && has(p, expected)) {
      p.getInventory().deleteNumber(expected, 1);
      p.setAttribute(SCAR_CATALYST_BASE_HITS, {});
    } else {
      const needed = SCAR_CATALYST_BASE_PARTS.get(expected) ?? [];
      const counts = { ...(p.getAttribute(SCAR_CATALYST_BASE_HITS) ?? {}) };
      const requiredCount = needed.filter((id) => id === itemId).length;
      if (!requiredCount || !has(p, itemId) || (Number(counts[itemId]) || 0) >= requiredCount) {
        p.sendMessage("That rune nerve does not match the symbol on the Catalyst.");
        return true;
      }
      p.getInventory().deleteNumber(itemId, 1);
      counts[itemId] = (Number(counts[itemId]) || 0) + 1;
      p.setAttribute(SCAR_CATALYST_BASE_HITS, counts);
      if (!needed.every((id) => (Number(counts[id]) || 0) >= needed.filter((part) => part === id).length)) {
        p.sendMessage("The elemental nerve weakens the Catalyst. Combine the remaining matching nerves to disrupt it fully.");
        return true;
      }
      p.setAttribute(SCAR_CATALYST_BASE_HITS, {});
    }
    const next = progress + 1;
    p.setAttribute(SCAR_CATALYST_PROGRESS, next);
    if (next >= order.length) {
      p.sendMessage("The matching rune nerves disrupt the Catalyst. The damaged growth room is exposed.");
      return true;
    }
    p.sendMessage("The rune nerve disrupts the Catalyst. Its symbol changes.");
    inspectScarCatalyst({ player: p });
    return true;
  }

  function handleSucellusItemOnNpc(event) {
    const { player: p, itemId } = event ?? {};
    const npc = event?.npc ?? event?.target;
    if (stage(p) !== S.SUCELLUS || itemId !== I.ARDER_MUSCA_POISON
      || !npc?.__dt2Sucellus || npc.getOwner?.() !== p || !has(p, itemId)) return false;
    event.handled = true;
    if (npc.__dt2SucellusAwake) {
      p.sendMessage("Duke Sucellus has already awakened.");
      return true;
    }
    p.getInventory().deleteNumber(I.ARDER_MUSCA_POISON, 1);
    const poisons = Math.min(2, (Number(p.getAttribute(SUCELLUS_POISONS)) || 0) + 1);
    p.setAttribute(SUCELLUS_POISONS, poisons);
    p.sendMessage(`The poison seeps into Duke Sucellus (${poisons}/2).`);
    if (poisons === 2) {
      npc.__dt2SucellusAwake = true;
      npc.setScriptedMovement?.(false);
      npc.setNpcTransformationId?.(N.DUKE_SUCELLUS_7);
      npc.getCombat?.()?.attack?.(p);
      p.sendMessage("Duke Sucellus stirs awake and attacks!");
    }
    return true;
  }

  function handleSucellusGroundItemPickup(event) {
    const { player: p, groundItemId } = event ?? {};
    if (groundItemId !== I.ODD_KEY || stage(p) !== S.SUCELLUS) return;
    if (!p.getAttribute(SUCELLUS_DEFEATED)) {
      event.handled = true;
      return p.sendMessage("The odd key is still in Duke Sucellus' possession.");
    }
    if (p.getInventory().getFreeSlots() < 1) {
      event.handled = true;
      return p.sendMessage("You need an empty inventory slot to take the odd key.");
    }
    p.sendMessage("You pick up the odd key from Duke Sucellus.");
  }

  function handleDialogueLine(event) {
    if (stage(event?.player) !== S.LEVIATHAN || event?.text !== "Yes.") return;
    if (![N.CATALYTIC_GUARDIAN, N.CATALYTIC_GUARDIAN_2].includes(event.npcId)) return;
    event.player.setAttribute(SCAR_GUARDIAN_ACCEPTED, true);
    setScarVarbit(event.player, 4);
    event.after = () => enterScar(event.player);
  }

  function setScarVarbit(p, value) {
    p.getPacketSender().sendVarbit(SCAR_VARBIT, value);
  }

  function handleLogin({ player: p }) {
    if (stage(p) === S.SUCELLUS) {
      const escaped = p.getAttribute(SUCELLUS_CELL_ESCAPED) === true;
      const defeated = p.getAttribute(SUCELLUS_DEFEATED) === true;
      if (p.getAttribute(SUCELLUS_CELL_ENTERED) || escaped || defeated) {
        const area = enterSucellusArea(p, false);
        if (!escaped && !defeated) p.moveTo(area.tile(168, 34, 0));
        else if (!defeated) {
          p.moveTo(area.tile(40, 12, 2));
          spawnSucellusCellAssassin(p, area);
        } else p.moveTo(area.tile(167, 97, 0));
      }
    }
    if (stage(p) < S.LEVIATHAN) return;
    const value = p.getAttribute(SCAR_LEVIATHAN_DEBRIS_SEARCHED) ? 48
      : p.getAttribute(SCAR_PERSTEN_LEFT_SHIP) ? 46
        : p.getAttribute(SCAR_LEVIATHAN_KILLED) ? 42
          : p.getAttribute(SCAR_LEVIATHAN_READY) ? 38
      : p.getAttribute(SCAR_PERSTEN_ROOM3_TALKED) ? 36
        : p.getAttribute(SCAR_BOAT3_BURNED) ? 34
          : p.getAttribute(SCAR_MAZE_THREE_ACTIVE) ? 32
            : p.getAttribute(SCAR_PERSTEN_ROOM2_TALKED) ? 30
      : p.getAttribute(SCAR_BOAT2_BURNED) ? 28
        : p.getAttribute(SCAR_MAZE_TWO_ENTERED) ? 24
          : p.getAttribute(SCAR_PERSTEN_ROOM1_TALKED) ? 22
            : p.getAttribute(SCAR_BOAT_BURNED) ? 20
              : p.getAttribute(SCAR_MAZE_ONE_ENTERED) ? 16
                : p.getAttribute(SCAR_PERSTEN_TALKED) ? 14
                  : p.getAttribute(SCAR_BOAT_TRIED) ? 10
                    : p.getAttribute(SCAR_DEMONS_DEFEATED) ? 8
                      : p.getAttribute(SCAR_GUARDIAN_ACCEPTED) ? 6 : 2;
    setScarVarbit(p, value);
    p.getPacketSender().sendVarbit(SCAR_GROWTH_STEP_VARBIT, Number(p.getAttribute(SCAR_GROWTH_STEP)) || 0);
    p.getPacketSender().sendVarbit(15220, Number(p.getAttribute("desert-treasure-ii:scar-axon-terminals")) || 0);
    p.getPacketSender().sendVarbit(15221, (p.getAttribute(SCAR_NERVE_ROOM_TWO_REPAIRED) ?? []).length);
    p.getPacketSender().sendVarbit(15258, p.getAttribute(SCAR_MAZE_THREE_ACTIVE)
      ? (p.getAttribute(SCAR_MEMORY_COMPLETE) ? 1 : 0) : p.getAttribute(SCAR_AXON_ROOM_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15259, p.getAttribute(SCAR_MAZE_THREE_ACTIVE)
      ? (p.getAttribute(SCAR_LEECH_COMPLETE) ? 1 : 0) : p.getAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15260, p.getAttribute(SCAR_MAZE_THREE_ACTIVE)
      ? (p.getAttribute(SCAR_TREE_COMPLETE) ? 1 : 0) : p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15261, p.getAttribute(SCAR_BOAT3_ROOM)
      ? 1 : p.getAttribute("desert-treasure-ii:scar-boat-room-two") ? 1 : 0);
    if (p.getAttribute(SCAR_MAZE_THREE_ACTIVE)) {
      p.getPacketSender().sendVarbit(15211, Number(p.getAttribute(SCAR_MAZE_THREE_AIR)) || 100);
      p.getPacketSender().sendVarbit(15212, Number(p.getAttribute(SCAR_MEMORY_STEP)) || 0);
      (p.getAttribute(SCAR_MEMORY_ORDER) ?? []).forEach((value, index) => p.getPacketSender().sendVarbit(15213 + index, value));
      p.getPacketSender().sendVarbit(15210, (p.getAttribute(SCAR_LEECH_GROWTHS_REPAIRED) ?? []).length);
      p.getPacketSender().sendVarbit(15219, Number(p.getAttribute(SCAR_BLOOD_RED_COUNT)) || 0);
      p.getPacketSender().sendVarbit(15218, Number(p.getAttribute(SCAR_BLOOD_WHITE_COUNT)) || 0);
    }
    if (!p.getAttribute(SCAR_CATALYST_ORDER)) p.setAttribute(SCAR_CATALYST_ORDER, shuffled(SCAR_CATALYST_RUNES));
    const repaired = p.getAttribute("desert-treasure-ii:scar-growth-repaired") ?? [];
    p.getPacketSender().sendVarbit(SCAR_GROWTH_LIT_VARBIT, repaired.length);
    if (repaired.length === SCAR_GROWTHS.length) {
      let order = p.getAttribute(SCAR_GROWTH_ORDER);
      if (!Array.isArray(order) || order.length !== SCAR_ENERGY_RUNES.length) {
        order = shuffled(SCAR_ENERGY_RUNES);
        p.setAttribute(SCAR_GROWTH_ORDER, order);
      }
      SCAR_GROWTH_ORDER_VARBITS.forEach((id, index) => p.getPacketSender().sendVarbit(id, order[index]));
      SCAR_ENERGIES.forEach((energy) => p.getPacketSender().sendVarbit(energy.state,
        (Number(p.getAttribute(SCAR_GROWTH_STEP)) || 0) > order.indexOf(energy.rune) ? 2 : 1));
      p.getPacketSender().sendVarbit(SCAR_GROWTH_STEP_VARBIT, Number(p.getAttribute(SCAR_GROWTH_STEP)) || 0);
    }
    if (p.getAttribute(SCAR_LEVIATHAN_READY)) {
      enterLeviathanArea(p);
    } else if (p.getAttribute(SCAR_MAZE_THREE_ACTIVE)
      && !(p.getAttribute(ATTR_SCAR_MAZE_THREE) instanceof ScarMazeThreeArea)) enterScarMazeThree(p);
    else if (p.getAttribute(SCAR_MAZE_TWO_ENTERED) && !p.getAttribute(SCAR_BOAT2_BURNED)
      && !(p.getAttribute(ATTR_SCAR_MAZE_TWO) instanceof ScarMazeTwoArea)) enterScarMazeTwo(p);
    else if (p.getAttribute(SCAR_MAZE_ONE_ENTERED) && !p.getAttribute(SCAR_BOAT_BURNED)
      && !(p.getAttribute(ATTR_SCAR_MAZE_ONE) instanceof ScarMazeOneArea)) enterScarMazeOne(p);
    else if (p.getAttribute(SCAR_BOAT_TRIED) && !p.getAttribute(ATTR_SCAR_AREA)) enterScar(p);
  }

  function spawnTempleKasonde(p, area) {
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (owned.kasondeBoss?.isRegistered?.()) return owned.kasondeBoss;
    const npc = api.core.NPC.create(N.KASONDE_7, area.tile(7, 16, 0));
    npc.setOwner?.(p);
    npc.setOwnerOnly?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    owned.kasondeBoss = npc;
    p.setAttribute(VARDORVIS_PROGRESS, 19);
    return npc;
  }

  function leaveVault(p) {
    const area = p.getAttribute(ATTR_VAULT_AREA);
    if (!(area instanceof AncientVaultArea) || area.isDestroyed()) return false;
    area.leave(p, false);
    area.postLeave(p, false);
    area.destroy();
    p.setAttribute(ATTR_VAULT_AREA, null);
    p.setAttribute(ATTR_VAULT_SMITH, null);
    p.moveTo(new api.core.Location(3510, 2969, 0));
    return true;
  }

  function leaveWarRoom(p) {
    const area = p.getAttribute(ATTR_WAR_ROOM);
    if (!(area instanceof WarRoomArea) || area.isDestroyed()) return false;
    area.leave(p, false);
    area.postLeave(p, false);
    area.destroy();
    p.setAttribute(ATTR_WAR_ROOM, null);
    p.moveTo(new api.core.Location(3411, 9811, 0));
    return true;
  }

  function warRoomSourceTile(p, location) {
    const area = p.getAttribute(ATTR_WAR_ROOM);
    if (!area || typeof area.getBaseX !== "function" || typeof area.getBaseY !== "function" || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 2760;
    const y = location.y - area.getBaseY() + 6424;
    return x >= 2760 && x < 2808 && y >= 6424 && y < 6464 ? { x, y } : null;
  }

  function vaultSourceTile(p, location) {
    const area = p.getAttribute(ATTR_VAULT_AREA);
    if (!area || typeof area.getBaseX !== "function" || typeof area.getBaseY !== "function" || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 3920;
    const y = location.y - area.getBaseY() + 9616;
    return x >= 3920 && x < 3952 && y >= 9616 && y < 9648 ? { x, y } : null;
  }

  function hideoutSourceTile(p, location) {
    const area = p.getAttribute(ATTR_STRANGLEWOOD_HIDEOUT);
    if (!(area instanceof StranglewoodHideoutArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 1160;
    const y = location.y - area.getBaseY() + 9740;
    return x >= 1160 && x < 1216 && y >= 9740 && y < 9780 ? { x, y } : null;
  }

  function templeSourceTile(p, location) {
    const area = p.getAttribute(ATTR_STRANGLEWOOD_TEMPLE);
    if (!(area instanceof StranglewoodTempleArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 1176;
    const y = location.y - area.getBaseY() + 9808;
    return x >= 1176 && x < 1192 && y >= 9808 && y < 9848 ? { x, y } : null;
  }

  function vardorvisSourceTile(p, location) {
    const area = p.getAttribute(ATTR_VARDORVIS_AREA);
    if (!(area instanceof VardorvisArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 1112;
    const y = location.y - area.getBaseY() + 3400;
    return x >= 1112 && x < 1152 && y >= 3400 && y < 3440 ? { x, y } : null;
  }

  function scarSourceTile(p, location) {
    const area = p.getAttribute(ATTR_SCAR_AREA);
    if (!(area instanceof ScarArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 2000;
    const y = location.y - area.getBaseY() + 6400;
    return x >= 2000 && x < 2072 && y >= 6400 && y < 6464 ? { x, y } : null;
  }

  function leviathanSourceTile(p, location) {
    const area = p.getAttribute(ATTR_LEVIATHAN_AREA);
    if (!(area instanceof LeviathanArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 2064;
    const y = location.y - area.getBaseY() + 6336;
    return x >= 2064 && x < 2112 && y >= 6336 && y < 6400 ? { x, y } : null;
  }

  function sucellusSourceTile(p, location) {
    const area = p.getAttribute(SUCELLUS_AREA);
    if (!(area instanceof SucellusArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 2872;
    const y = location.y - area.getBaseY() + 6336;
    const z = location.z ?? location.getZ?.() ?? 0;
    return x >= 2872 && x < 3064 && y >= 6336 && y < 6472 ? { x, y, z } : null;
  }

  function scarMazeSourceTile(p, location) {
    const area = p.getAttribute(ATTR_SCAR_MAZE_ONE);
    if (!(area instanceof ScarMazeOneArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 2160;
    const y = location.y - area.getBaseY() + 6400;
    return x >= 2160 && x < 2248 && y >= 6400 && y < 6472 ? { x, y } : null;
  }

  function scarMazeTwoSourceTile(p, location) {
    const area = p.getAttribute(ATTR_SCAR_MAZE_TWO);
    if (!(area instanceof ScarMazeTwoArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 1696;
    const y = location.y - area.getBaseY() + 6400;
    return x >= 1696 && x < 1792 && y >= 6400 && y < 6464 ? { x, y } : null;
  }

  function scarMazeThreeSourceTile(p, location) {
    const area = p.getAttribute(ATTR_SCAR_MAZE_THREE);
    if (!(area instanceof ScarMazeThreeArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 1856;
    const y = location.y - area.getBaseY() + 6400;
    return x >= 1856 && x < 1928 && y >= 6400 && y < 6472 ? { x, y } : null;
  }

  function handleScarStoneRoute(event) {
    if (event.clickType !== 1 || event.objectId !== 49209) return;
    const p = event.player;
    const area = p?.getAttribute(ATTR_SCAR_AREA);
    const objectLoc = event.object?.getLocation?.();
    if (!(area instanceof ScarArea) || area.isDestroyed?.() || !objectLoc) return;
    const stone = scarSourceTile(p, { x: objectLoc.getX(), y: objectLoc.getY() });
    if (!stone || ![[2031, 6430], [2033, 6430]].some(([x, y]) => stone.x === x && stone.y === y)) return;
    const current = p.getLocation();
    const sourceX = current.getX() - area.getBaseX() + 2000;
    const approachX = sourceX <= stone.x
      ? (stone.x === 2031 ? stone.x - 2 : stone.x - 1)
      : stone.x + 1;
    const approach = area.tile(approachX - 2000, stone.y - 6400, 0);
    event.destination = { x: approach.getX(), y: approach.getY(), z: 0 };
  }

  function leaveVardorvisArena(p) {
    const area = p.getAttribute(ATTR_VARDORVIS_AREA);
    if (!(area instanceof VardorvisArea) || area.isDestroyed()) return false;
    area.leave(p, false);
    area.postLeave(p, false);
    area.destroy();
    p.setAttribute(ATTR_VARDORVIS_AREA, null);
    p.moveTo(new api.core.Location(1147, 3433, 0));
    return true;
  }

  function handleLogout({ player: p }) {
    if (!p) return;
    for (const key of [ATTR_VAULT_AREA, ATTR_WAR_ROOM, ATTR_STRANGLEWOOD_HIDEOUT, ATTR_STRANGLEWOOD_TEMPLE, ATTR_VARDORVIS_AREA, ATTR_SCAR_AREA, ATTR_SCAR_MAZE_ONE, ATTR_SCAR_MAZE_TWO, ATTR_SCAR_MAZE_THREE, ATTR_LEVIATHAN_AREA, SUCELLUS_AREA]) {
      const area = p.getAttribute(key);
      if (area && !area.isDestroyed?.()) {
        area.leave?.(p, false);
        area.postLeave?.(p, false);
        area.destroy?.();
      }
      p.setAttribute(key, null);
    }
    p.setAttribute(SCAR_PATH_COMPLETE, false);
    p.setAttribute(SCAR_RIFT_LIVE, false);
    p.setAttribute(SCAR_GROWTH_LIVE, false);
    spawned.delete(p);
  }

  function buildJournal(player) {
    const s = quest.getStage(player);
    if (s >= S.COMPLETE) return ["<str>I found the Elder Horn and stopped Sliske.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (s >= S.FINALE) return ["Return the four medallions to the Ancient Vault."];
    if (s >= S.WHISPERER) return ["Search the Lassar Undercity and defeat the Whisperer."];
    if (s >= S.SUCELLUS) {
      if (player.getAttribute(SUCELLUS_DEFEATED)) {
        if (!has(player, I.ODD_KEY)) return ["Pick up the odd key from Duke Sucellus, unlock the western door, and take his medallion from the chest."];
        if (!player.getAttribute(SUCELLUS_WEST_ROOM)) return ["Use the odd key on the western door and search the chest beyond it."];
        return ["Open the chest in the western room for Sucellus' medallion."];
      }
      if (!player.getAttribute(SUCELLUS_AREA)) return ["Reach the Ghorrock asylum beneath Weiss and enter Duke Sucellus's chamber."];
      if ((Number(player.getAttribute(SUCELLUS_POISONS)) || 0) >= 2) return ["Use both Arder-musca poisons on Duke Sucellus, then defeat him."];
      if ((Number(player.getAttribute(SUCELLUS_POISONS)) || 0) === 1) return ["Use the second Arder-musca poison on Duke Sucellus."];
      if (player.getInventory().getAmount(I.ARDER_MUSCA_POISON) >= 2) return ["Use both Arder-musca poisons on Duke Sucellus to wake him."];
      if (player.getInventory().getAmount(I.SALAX_SALT) < 12) return ["Mine 12 salax salt in the asylum. Each fermentation vat needs six salt and both ground mushroom powders."];
      if (player.getInventory().getAmount(I.ARDER_POWDER) < 2 || player.getInventory().getAmount(I.MUSCA_POWDER) < 2) return ["Take the pestle and mortar, gather Arder and Musca mushrooms, and grind two of each into powder."];
      return ["Add both powders and six salax salt to each of two fermentation vats, then empty both to collect the poisons."];
    }
    if (s >= S.LEVIATHAN) {
      if (!player.getAttribute(SCAR_DEMONS_DEFEATED)) return ["Defeat the Scarred demons near the rowboat."];
      if (!player.getAttribute(SCAR_BOAT_TRIED)) return ["Try to board the rowboat at the Scar entrance."];
      if (!player.getAttribute(SCAR_PERSTEN_TALKED)) return ["Speak to Wizard Persten about entering the Scar."];
      if (!player.getAttribute(SCAR_MAZE_ONE_ENTERED)) return ["Enter the open passage in the north-west of the Scar."];
      if (!player.getAttribute(SCAR_TETHER_DESTROYED)) return ["Guide the pathfinders through the maze and sever the Abyssal Tether."];
      if ((Number(player.getAttribute(SCAR_CATALYST_PROGRESS)) || 0) < SCAR_CATALYST_RUNES.length) {
        return ["Break nerve endings, combine runes, and disrupt the Catalyst with matching nerves."];
      }
      const repaired = player.getAttribute("desert-treasure-ii:scar-growth-repaired") ?? [];
      if (repaired.length < SCAR_GROWTHS.length) return ["Take illuminating lures from the light leeches and repair the four damaged growths."];
      if (!player.getAttribute("desert-treasure-ii:scar-growth-complete")) return ["Touch the six runic energies in their revealed order."];
      if (!player.getAttribute(SCAR_BOAT_ROOM)) return ["Enter the southern passage to search the shipwreck chamber."];
      if (!has(player, I.SLIMY_KEY)) return ["Search the north-west skeleton for the slimy key."];
      if (!has(player, I.OLD_TABLET)) return ["Use the slimy key on the chest and read the old tablet."];
      if (!player.getAttribute(SCAR_OLD_TABLET_READ)) return ["Read the old tablet before burning the shipwreck."];
      if (!has(player, I.GUNPOWDER_2)) return ["Search the south-west skeleton for gunpowder."];
      if (!has(player, I.TINDERBOX)) return ["Search the south-east crate for a tinderbox."];
      if (!player.getAttribute(SCAR_BOAT_BURNED)) return ["Use the tinderbox on the shipwreck to ignite the gunpowder."];
      if (!player.getAttribute(SCAR_PERSTEN_ROOM1_TALKED)) return ["Report the destroyed shipwreck to Wizard Persten."];
      if (!player.getAttribute(SCAR_LEVIATHAN_READY)) return ["Complete the three Scar passages and report to Persten before boarding the ship."];
      if (!player.getAttribute(SCAR_LEVIATHAN_KILLED)) return ["Defeat the Leviathan. Switch protection prayers when its colored projectiles land and dodge its special attacks."];
      if (!player.getAttribute(SCAR_PERSTEN_LEFT_SHIP)) return ["Climb the northern handholds and cross the stepping stone to speak to Persten."];
      if (!player.getAttribute(SCAR_LEVIATHAN_DEBRIS_SEARCHED)) return ["Search the debris by the ship for Perseriya's medallion."];
      return ["Continue through the Scar and defeat the Leviathan."];
    }
    if (s >= S.VARDORVIS) return ["Follow Kasonde's trail and defeat Vardorvis."];
    if (s >= S.MACHINE) return ["Use the golem to learn the forgotten four's names."];
    if (s >= S.GUARDIAN) return ["Search the military installation beneath the Digsite."];
    if (s >= S.ROCKS) return ["Mine through the rocks and defeat the Ancient Guardian."];
    if (s >= S.DIG) return ["Find Dr Banikan at the Digsite excavation."];
    if (s >= S.VAULT) return ["Speak to Asgarnia Smith about the statues and plaque."];
    if (s >= S.STARTED) return ["Inspect the four statues and plaque in the Ancient Vault."];
    return ["Investigate the Ancient Vault north-east of Nardah."];
  }

  const stage = (p) => quest.getStage(p);
  const setStage = (p, v) => { if (stage(p) < v) quest.setStage(p, v); };
  const has = (p, id) => p.getInventory().getAmount(id) > 0;
  function talk(p, npcId, variant, next) {
    startTranscript(api, p, npcId, PAGE, variant);
    if (next) setStage(p, next);
  }
  function talkSmith({ player: p, npcId }) {
    if (stage(p) < S.STARTED) return p.sendMessage("Asgarnia Smith is studying the vault.");
    if (stage(p) === S.STARTED && !p.getAttribute(ATTR_SMITH_INTRO)) {
      p.setAttribute(ATTR_SMITH_INTRO, true);
      talk(p, npcId, "familiar-faces-talking-to-asgarnia-smith");
      return;
    }
    if (stage(p) === S.STARTED && (Number(p.getAttribute("desert-treasure-ii:statues")) & 31) !== 31) {
      return p.sendMessage("Asgarnia Smith asked you to inspect the four statues and plaque in the vault.");
    }
    const variant = stage(p) < S.VAULT ? "familiar-faces-talking-to-asgarnia-smith-after-inspecting-the-vault"
      : stage(p) < S.DIG ? "familiar-faces-talking-to-asgarnia-smith-after-inspecting-the-vault"
        : stage(p) < S.MACHINE ? "familiar-faces-talking-to-dr-banikan-after-clearing-rocks"
          : "familiar-faces-speaking-to-dr-banikan-again-after-he-decides-search-the-golem";
    talk(p, npcId, variant, stage(p) === S.STARTED ? S.VAULT : undefined);
  }
  function talkTerry({ player: p, npcId }) {
    if (stage(p) < S.VAULT) return p.sendMessage("Terry has no reason to discuss the vault yet.");
    talk(p, npcId, "familiar-faces-talking-to-terry-balando", S.DIG);
  }
  function talkBanikan({ player: p, npcId }) {
    if (stage(p) < S.DIG) return p.sendMessage("Dr Banikan is busy with the excavation.");
    if (stage(p) < S.ROCKS) return talk(p, npcId, "familiar-faces-talking-to-dr-banikan", S.ROCKS);
    if (stage(p) < S.MACHINE) return talk(p, npcId, "familiar-faces-talking-to-dr-banikan-after-clearing-rocks", S.MACHINE);
    if (!p.getAttribute(GOLEM_SOLVED)) return talk(p, npcId, "familiar-faces-talking-to-dr-banikan-before-powering-up-the-golem-machine");
    if ((Number(p.getAttribute(SEARCHED_NAMES)) || 0) !== 15) {
      return talk(p, npcId, "familiar-faces-powering-up-the-golem-machine-talking-to-dr-banikan-before-finishing-searching-for-all-of-the-names");
    }
    p.setAttribute(BANIKAN_LEFT, true);
    talk(p, npcId, "familiar-faces-speaking-to-dr-banikan-again-before-he-decides-search-the-golem");
  }
  function cellPositions(p) {
    const value = p.getAttribute(CELL_POSITIONS);
    return Array.isArray(value) && value.length === 8 ? value.map((x) => Number(x)) : null;
  }
  function syncCellPositions(p, positions) {
    p.setAttribute(CELL_POSITIONS, positions.slice());
    positions.forEach((position, index) => p.getPacketSender().sendVarbit(CELL_VARBITS[index], position));
  }
  function openGolemPuzzle(p) {
    let positions = cellPositions(p);
    if (!positions) {
      // A fresh board is deliberately unsolved. These are eight distinct cache
      // slots; the player must drag every cell into the correct 8x8 layout.
      positions = [0, 9, 18, 27, 36, 45, 54, 63];
    }
    syncCellPositions(p, positions);
    p.setAttribute(CELLS_INSERTED, true);
    p.setAttribute("desert-treasure-ii:puzzle-open", true);
    p.getPacketSender().sendInterface(PUZZLE_GROUP);
  }
  function wrongGolemSolution(p) {
    p.sendMessage("The machine crackles and shocks you. The cell arrangement is incorrect.");
    const damage = 5 + Math.floor(Math.random() * 6);
    p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(damage, api.core.HitMask.RED)]);
  }
  function onWidgetAction(event) {
    const p = event?.player, packet = event?.packet;
    if (!packet || stage(p) < S.MACHINE || stage(p) >= S.VARDORVIS || !p.getAttribute(CELLS_INSERTED)) return;
    if (packet.type === "widget_drag") {
      if ((packet.sourceWidgetId >>> 16) !== PUZZLE_GROUP || (packet.targetWidgetId >>> 16) !== PUZZLE_GROUP) return;
      const positions = cellPositions(p);
      const from = Number(packet.sourceSlot), to = Number(packet.targetSlot);
      if (!positions || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 63 || to < 0 || to > 63) return;
      const cell = positions.indexOf(from);
      if (cell >= 0 && !positions.includes(to)) {
        positions[cell] = to;
        syncCellPositions(p, positions);
      }
      event.handled = true;
      return;
    }
    if (packet.type !== "widget_action" || packet.groupId !== PUZZLE_GROUP || packet.childId !== 4) return;
    event.handled = true;
    const positions = cellPositions(p);
    if (!positions || !CELL_SOLUTION.every((value, index) => positions[index] === value)) return wrongGolemSolution(p);
    p.setAttribute(GOLEM_SOLVED, true);
    p.setAttribute("desert-treasure-ii:puzzle-open", false);
    p.getPacketSender().sendInterfaceRemoval();
    p.sendMessage("The golem powers up. It asks you to specify a search term.");
    promptGolemSearch(p);
  }
  function promptGolemSearch(p) {
    p.setEnteredSyntaxAction({ execute: (term) => searchGolem(p, term) });
    p.getPacketSender().sendEnterInputPrompt("Specify a search term");
  }
  function searchGolem(p, input) {
    const term = String(input ?? "").trim().toLowerCase();
    const names = new Map([["vardorvis", 1], ["perseriya", 2], ["sucellus", 4], ["whisperer", 8]]);
    const searched = Number(p.getAttribute(SEARCHED_NAMES)) || 0;
    if (term === "frostenhorn") {
      if (searched !== 15 || !p.getAttribute(BANIKAN_LEFT)) {
        p.sendMessage("Error: Access to data denied.");
        return promptGolemSearch(p);
      }
      p.sendMessage("Data found. The golem reveals Banikan's search term: Frostenhorn.");
      talk(p, N.GOLEM_3, "familiar-faces-operating-the-golem-to-find-out-what-dr-banikan-searched", S.VARDORVIS);
      p.setAttribute(VARDORVIS_PROGRESS, 0);
      p.setAttribute(ATTR, null);
      return;
    }
    const bit = names.get(term);
    if (!bit) {
      p.sendMessage("Error: No data found.");
      return promptGolemSearch(p);
    }
    if (searched & bit) {
      p.sendMessage("Data found. You have already searched that term.");
      return promptGolemSearch(p);
    }
    p.setAttribute(SEARCHED_NAMES, searched | bit);
    const variant = `familiar-faces-powering-up-the-golem-machine-${term}`;
    talk(p, N.GOLEM_3, variant);
  }
  function talkElissa({ player: p, npcId }) {
    if (stage(p) !== S.VARDORVIS || (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) !== 0) return;
    talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa");
    p.setAttribute(VARDORVIS_PROGRESS, 1);
  }
  function talkBarus({ player: p, npcId }) {
    if (stage(p) !== S.VARDORVIS || (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) !== 1) return;
    talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-barus");
    p.setAttribute(VARDORVIS_PROGRESS, 2);
  }
  function talkKasonde({ player: p, npcId }) {
    if (stage(p) !== S.VARDORVIS) return;
    const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
    if (progress === 6) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde");
      p.setAttribute(VARDORVIS_PROGRESS, 7);
      return;
    }
    if (progress === 7) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-talking-to-kasonde-again");
      p.setAttribute(VARDORVIS_PROGRESS, 8);
      return;
    }
    if (progress === 9) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-holding-back-the-horde");
      p.setAttribute(VARDORVIS_PROGRESS, 10);
      return;
    }
    if (progress === 10) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-back-on-the-surface-talking-to-kasonde-again-before-retrieving-the-ingredients");
      p.setAttribute(VARDORVIS_PROGRESS, 11);
      return;
    }
    if (progress === 13) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-killing-the-strangled-in-the-temple");
      if (!has(p, I.UNFINISHED_SERUM)) p.getInventory().adds(I.UNFINISHED_SERUM, 1);
      p.setAttribute(VARDORVIS_PROGRESS, 14);
      return;
    }
    if (progress === 15) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-killing-the-strangled-in-the-temple-talking-to-kasonde-after-making-the-potion");
      p.setAttribute("desert-treasure-ii:kasonde-serum-discussed", true);
      return;
    }
    if (progress === 16) talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-killing-the-strangled-in-the-temple-talking-to-kasonde-after-drinking-the-potion");
    if (progress === 20) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-defeating-him");
      p.setAttribute(VARDORVIS_PROGRESS, 21);
    }
  }
  function handleItemAction(event) {
    const { player: p, itemId, option } = event;
    const action = String(option || "").toLowerCase();
    if (stage(p) === S.LEVIATHAN && itemId === I.OLD_TABLET && action === "read"
      && p.getAttribute(SCAR_BOAT_ROOM) && has(p, I.OLD_TABLET)) {
      p.setAttribute(SCAR_OLD_TABLET_READ, true);
      p.sendMessage("The old tablet describes the shipwreck and the gunpowder needed to destroy it.");
      event.handled = true;
      return true;
    }
    if (stage(p) === S.LEVIATHAN && itemId === I.DAMP_TABLET && action === "read"
      && p.getAttribute("desert-treasure-ii:scar-boat-room-two") && has(p, I.DAMP_TABLET)) {
      p.setAttribute("desert-treasure-ii:scar-boat-room-two-tablet-read", true);
      p.sendMessage("The damp tablet describes the shipwreck and the gunpowder needed to destroy it.");
      event.handled = true;
      return true;
    }
    if (stage(p) === S.LEVIATHAN && itemId === I.DAMP_TABLET_2 && action === "read"
      && p.getAttribute(SCAR_BOAT3_ROOM) && has(p, I.DAMP_TABLET_2)) {
      p.setAttribute("desert-treasure-ii:scar-boat3-tablet-read", true);
      p.sendMessage("The damp tablet describes the shipwreck and the gunpowder needed to destroy it.");
      event.handled = true;
      return true;
    }
    if (stage(p) === S.SUCELLUS && itemId === I.PRISONERS_LETTER && action === "read"
      && p.getAttribute(SUCELLUS_CELL_ENTERED) && (Number(p.getAttribute(SUCELLUS_CELL_PROGRESS)) || 0) === 2) {
      p.setAttribute(SUCELLUS_CELL_PROGRESS, 3);
      p.sendMessage("You read the prisoner's letter. It describes how to signal the guard through the hole in the wall.");
      event.handled = true;
      return true;
    }
    if (stage(p) !== S.VARDORVIS) return;
    if (itemId === KASONDE_NOTE && action === "read"
      && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) === 3) {
      p.setAttribute(VARDORVIS_PROGRESS, 4);
      p.sendMessage("You read the botanist's note. It explains how to use the strange potion to enter the Stranglewood.");
      return true;
    }
    if (itemId === KASONDE_POTION && action === "drink") {
      const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (progress < 4) {
        talk(p, N.GOLEM_3, "carnifex-maximus-vardorvis-attempting-to-drink-the-potion-before-reading-the-note");
        return true;
      }
      if (progress === 4 && has(p, KASONDE_POTION)) {
        p.getInventory().deleteNumber(KASONDE_POTION, 1);
        p.setAttribute(VARDORVIS_PROGRESS, 5);
        p.sendMessage("You drink the strange potion. Its effects prepare you to enter the Stranglewood.");
        return true;
      }
    }
    if (itemId === I.STRANGLER_SERUM && action === "drink") {
      if (!has(p, I.STRANGLER_SERUM) || (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) < 15
        || !p.getAttribute("desert-treasure-ii:kasonde-serum-discussed")) return p.sendMessage("Talk to Kasonde about the completed serum before drinking it.");
      p.getInventory().deleteNumber(I.STRANGLER_SERUM, 1);
      p.setAttribute(VARDORVIS_PROGRESS, 16);
      p.sendMessage("You drink the Strangler serum. It lets you approach the ritual site.");
      return true;
    }
    return false;
  }
  function handleItemOnItem({ player: p, usedItemId: itemId1, usedWithItemId: itemId2 }) {
    if (stage(p) === S.SUCELLUS && has(p, I.PESTLE_AND_MORTAR)) {
      const pair = new Set([itemId1, itemId2]);
      const powder = pair.has(I.MUSCA_MUSHROOM) ? I.MUSCA_POWDER
        : pair.has(I.ARDER_MUSHROOM) ? I.ARDER_POWDER : null;
      const mushroom = pair.has(I.MUSCA_MUSHROOM) || pair.has(I.ARDER_MUSHROOM);
      if (powder && mushroom) {
        const raw = pair.has(I.MUSCA_MUSHROOM) ? I.MUSCA_MUSHROOM : I.ARDER_MUSHROOM;
        if (!has(p, raw)) return false;
        p.getInventory().deleteNumber(raw, 1);
        p.getInventory().adds(powder, 1);
        p.sendMessage(`You grind the ${powder === I.MUSCA_POWDER ? "Musca" : "Arder"} mushroom into powder.`);
        return true;
      }
    }
    if (stage(p) === S.LEVIATHAN && p.getAttribute(SCAR_RIFT_LIVE)) {
      const recipe = SCAR_NERVE_RECIPES.find(([first, second]) =>
        (itemId1 === first && itemId2 === second) || (itemId1 === second && itemId2 === first));
      if (recipe && has(p, recipe[0]) && has(p, recipe[1])) {
        p.getInventory().deleteNumber(recipe[0], 1);
        p.getInventory().deleteNumber(recipe[1], 1);
        p.getInventory().adds(recipe[2], 1);
        p.sendMessage("You combine the two nerve fibres into a stronger rune nerve.");
        return true;
      }
    }
    if (stage(p) !== S.VARDORVIS || (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) < 11) return false;
    const pair = new Set([itemId1, itemId2]);
    if (pair.has(I.UNFINISHED_SERUM) && pair.has(I.KORBAL_HERB) && has(p, I.UNFINISHED_SERUM) && has(p, I.KORBAL_HERB)) {
      p.getInventory().deleteNumber(I.UNFINISHED_SERUM, 1);
      p.getInventory().deleteNumber(I.KORBAL_HERB, 1);
      p.getInventory().adds(I.UNFINISHED_SERUM_2, 1);
      p.sendMessage("You add the Korbal herb to the unfinished serum.");
      return true;
    }
    if (pair.has(I.UNFINISHED_SERUM_2) && pair.has(I.ARGIAN_BERRIES) && has(p, I.UNFINISHED_SERUM_2) && has(p, I.ARGIAN_BERRIES)) {
      p.getInventory().deleteNumber(I.UNFINISHED_SERUM_2, 1);
      p.getInventory().deleteNumber(I.ARGIAN_BERRIES, 1);
      p.getInventory().adds(I.STRANGLER_SERUM, 1);
      p.setAttribute(VARDORVIS_PROGRESS, 15);
      p.sendMessage("You mix the Argian berries into the serum and make a Strangler serum.");
      return true;
    }
    return false;
  }
  function handleObject(event) {
    const { player: p, objectId, definition, location } = event;
    const s = stage(p);
    const vaultTile = vaultSourceTile(p, location);
    const roomTile = warRoomSourceTile(p, location);
    const scarTile = scarSourceTile(p, location);
    const scarMazeTile = scarMazeSourceTile(p, location);
    const scarMazeTwoTile = scarMazeTwoSourceTile(p, location);
    const scarMazeThreeTile = scarMazeThreeSourceTile(p, location);
    const leviathanTile = leviathanSourceTile(p, location);
    const sucellusTile = sucellusSourceTile(p, location);
    const visibleId = definition?.id ?? objectId;
    if (s === S.SUCELLUS) {
      const action = String(event.option ?? "").toLowerCase();
      const worldX = location?.x, worldY = location?.y, worldZ = location?.z ?? location?.getZ?.() ?? 0;
      if (!sucellusTile && visibleId === 49513 && worldX === 2926 && worldY === 10354 && worldZ === 0) {
        enterSucellusArea(p, false);
        p.setAttribute(SUCELLUS_CELL_ENTERED, false);
        p.setAttribute(SUCELLUS_CELL_PROGRESS, 0);
        p.sendMessage("You push through the heavy entrance into Ghorrock Prison.");
        return true;
      }
      // The cache's asylum entrance is at the far north-east of the prison.
      // Entering the boss gate copies the real arena template into an owner-only
      // instance so quest supplies and encounter state remain per player.
      if (!sucellusTile && visibleId === SUCELLUS_BOSS_GATE && worldX === 3039 && worldY === 6433 && worldZ === 0) {
        enterSucellusArea(p);
        p.sendMessage("You pass through the asylum gate into Duke Sucellus's chamber.");
        return true;
      }
      if (sucellusTile) {
        const cellProgress = Number(p.getAttribute(SUCELLUS_CELL_PROGRESS)) || 0;
        if (visibleId === SUCELLUS_BOSS_GATE && sucellusTile.x === 3039 && sucellusTile.y === 6433 && sucellusTile.z === 0) {
          spawnBoss(p, "sucellus");
          return false;
        }
        if (visibleId === 49120 && sucellusTile.x === 2945 && sucellusTile.y === 6389 && sucellusTile.z === 2) {
          if (!p.getAttribute(SUCELLUS_CELL_ESCAPED)) return p.sendMessage("The prison gate is inaccessible from inside the locked cell.");
          if (!has(p, I.LOCKPICK_4)) return p.sendMessage("The padlocked gate needs the lockpick from your cell.");
          p.setAttribute(SUCELLUS_ASSASSIN_GONE, true);
          p.sendMessage("You pick the padlock and open the gate into the prison administrative rooms.");
          return false;
        }
        if (p.getAttribute(SUCELLUS_CELL_ENTERED) && visibleId === 49099
          && sucellusTile.x === 3040 && sucellusTile.y === 6370 && worldZ === 0) {
          if (cellProgress === 0) {
            p.setAttribute(SUCELLUS_CELL_PROGRESS, 1);
            talk(p, N.ASSASSIN_7, "duke-sucellus-of-the-sixth-legion-inspecting-the-wall-in-the-prison-cell");
          } else p.sendMessage("You have already inspected the wall. Try signalling the guard through the hole.");
          return true;
        }
        if (p.getAttribute(SUCELLUS_CELL_ENTERED) && visibleId === 49094
          && sucellusTile.x === 3042 && sucellusTile.y === 6369 && cellProgress === 1) {
          if (!has(p, I.PRISONERS_LETTER)) p.getInventory().adds(I.PRISONERS_LETTER, 1);
          p.setAttribute(SUCELLUS_CELL_PROGRESS, 2);
          p.sendMessage("You search the skeleton and find a prisoner's letter.");
          return true;
        }
        if (p.getAttribute(SUCELLUS_CELL_ENTERED) && visibleId === 49095
          && sucellusTile.x === 3039 && sucellusTile.y === 6367 && cellProgress >= 3) {
          if (!has(p, I.KNIFE_5)) p.getInventory().adds(I.KNIFE_5, 1);
          p.setAttribute(SUCELLUS_CELL_PROGRESS, Math.max(cellProgress, 4));
          talk(p, N.ASSASSIN_7, "duke-sucellus-of-the-sixth-legion-inspecting-the-wall-in-the-prison-cell-searching-the-bucket");
          return true;
        }
        if (p.getAttribute(SUCELLUS_CELL_ENTERED) && visibleId === 49514
          && sucellusTile.x === 3041 && sucellusTile.y === 6367 && cellProgress >= 5 && has(p, I.CHISEL_5)) {
          if (!has(p, I.LOCKPICK_4)) p.getInventory().adds(I.LOCKPICK_4, 1);
          p.setAttribute(SUCELLUS_CELL_PROGRESS, 6);
          talk(p, N.ASSASSIN_7, "duke-sucellus-of-the-sixth-legion-searching-the-bed-with-a-chisel");
          return true;
        }
        if (sucellusTile.x === 3039 && sucellusTile.y === 6433 && visibleId === 49139) {
          const area = p.getAttribute(SUCELLUS_AREA);
          if (area instanceof SucellusArea && !area.isDestroyed()) p.moveTo(area.tile(101, 104, 2));
          return true;
        }
        const mushrooms = p.getAttribute(SUCELLUS_MUSHROOMS) ?? { musca: 0, arder: 0 };
        if (visibleId === O.PESTLE_AND_MORTAR_2) {
          if (!has(p, I.PESTLE_AND_MORTAR)) p.getInventory().adds(I.PESTLE_AND_MORTAR, 1);
          p.sendMessage("You take a pestle and mortar from the shelf.");
          return true;
        }
        if (visibleId === O.PICKAXE_3) {
          if (!has(p, I.IRON_PICKAXE)) p.getInventory().adds(I.IRON_PICKAXE, 1);
          p.sendMessage("You take a pickaxe from the rack.");
          return true;
        }
        if ([O.MUSCA_MUSHROOMS, O.MUSCA_MUSHROOMS_2].includes(visibleId)) {
          const count = Math.min(3, mushrooms.musca + 1);
          if (count === mushrooms.musca) return p.sendMessage("You have gathered enough Musca mushrooms.");
          mushrooms.musca = count;
          p.setAttribute(SUCELLUS_MUSHROOMS, mushrooms);
          p.getInventory().adds(I.MUSCA_MUSHROOM, 1);
          p.sendMessage(`You gather a Musca mushroom (${count}/3).`);
          return true;
        }
        if ([O.ARDER_MUSHROOMS, O.ARDER_MUSHROOMS_2].includes(visibleId)) {
          const count = Math.min(3, mushrooms.arder + 1);
          if (count === mushrooms.arder) return p.sendMessage("You have gathered enough Arder mushrooms.");
          mushrooms.arder = count;
          p.setAttribute(SUCELLUS_MUSHROOMS, mushrooms);
          p.getInventory().adds(I.ARDER_MUSHROOM, 1);
          p.sendMessage(`You gather an Arder mushroom (${count}/3).`);
          return true;
        }
        if (visibleId === O.SALT_DEPOSIT_2) {
          if (!has(p, I.IRON_PICKAXE) && !has(p, I.BRONZE_PICKAXE) && !has(p, I.STEEL_PICKAXE)
            && !has(p, I.MITHRIL_PICKAXE) && !has(p, I.ADAMANT_PICKAXE) && !has(p, I.RUNE_PICKAXE)) {
            return p.sendMessage("You need a pickaxe to mine the salax salt.");
          }
          const amount = p.getInventory().getAmount(I.SALAX_SALT);
          if (amount >= 12) return p.sendMessage("You have mined enough salax salt.");
          p.getInventory().adds(I.SALAX_SALT, 1);
          p.sendMessage(`You mine a piece of salax salt (${amount + 1}/12).`);
          return true;
        }
        if (visibleId === SUCELLUS_MEDALLION_GATE && sucellusTile.x === 3023 && sucellusTile.y === 6425) {
          if (!p.getAttribute(SUCELLUS_DEFEATED)) return p.sendMessage("The Duke still blocks the room beyond the gate.");
          if (!has(p, I.ODD_KEY)) return p.sendMessage("The gate is locked. The odd key from Duke Sucellus should fit.");
          p.getInventory().deleteNumber(I.ODD_KEY, 1);
          p.setAttribute(SUCELLUS_WEST_ROOM, true);
          p.sendMessage("You use the odd key to unlock the door to the west of the Duke's chamber.");
          return false;
        }
        if (visibleId === SUCELLUS_MEDALLION_CHEST && sucellusTile.x === 3021 && sucellusTile.y === 6420) {
          if (!p.getAttribute(SUCELLUS_WEST_ROOM)) return p.sendMessage("The chest is in the room beyond the locked western door.");
          if (!p.getAttribute(SUCELLUS_DEFEATED)) return p.sendMessage("The Duke must be defeated before you can take the medallion.");
          if (!has(p, I.SUCELLUS_MEDALLION)) p.getInventory().adds(I.SUCELLUS_MEDALLION, 1);
          p.sendMessage("You open the chest and take Sucellus' medallion.");
          setStage(p, S.WHISPERER);
          return true;
        }
        // OSRS Wiki's DT2 quick guide: gather both mushroom types, grind them,
        // mine 12 salax salt, fill two vats, and take two Arder-musca poisons.
        if ([47536, 47537, 47538, 47539, 47540, 47541, 47542, 47543].includes(visibleId)) {
          const vats = { ...(p.getAttribute(SUCELLUS_VATS) ?? {}) };
          const vatKey = `${visibleId}:${sucellusTile.x}:${sucellusTile.y}`;
          const vat = { ...(vats[vatKey] ?? { powders: [], salt: 0 }) };
          if (vat.powders?.includes(I.ARDER_POWDER) && vat.powders?.includes(I.MUSCA_POWDER)
            && vat.salt >= 6 && action.includes("empty")) {
            vat.powders = [];
            vat.salt = 0;
            vats[vatKey] = vat;
            p.setAttribute(SUCELLUS_VATS, vats);
            p.getInventory().adds(I.ARDER_MUSCA_POISON, 1);
            p.sendMessage(`You empty the vat and collect an Arder-musca poison (${Math.min(2, p.getInventory().getAmount(I.ARDER_MUSCA_POISON))}/2).`);
          } else if (vat.salt < 6) p.sendMessage(`This vat needs ${6 - vat.salt} more salax salt and both ground mushroom powders.`);
          else if (!vat.powders?.includes(I.ARDER_POWDER) || !vat.powders?.includes(I.MUSCA_POWDER)) p.sendMessage("Add both ground mushroom powders to this vat before emptying it.");
          else p.sendMessage("The vat is ready. Empty it to collect Arder-musca poison.");
          return true;
        }
      }
    }
    if (s === S.LEVIATHAN && leviathanTile) {
      if ([47594, 49210].includes(visibleId) && leviathanTile.x === 2091 && leviathanTile.y === 6380) {
        if (!p.getAttribute(SCAR_LEVIATHAN_KILLED)) { p.sendMessage("The Leviathan still bars your way."); return true; }
        const area = p.getAttribute(ATTR_LEVIATHAN_AREA);
        p.setAttribute(SCAR_PERSTEN_AT_SHIP, true);
        p.moveTo(area.tile(27, 44, 0));
        p.sendMessage("You climb the handholds onto the northern ledge.");
        setScarVarbit(p, 42);
        return true;
      }
      if ([49529, 49210].includes(visibleId) && leviathanTile.x === 2096 && leviathanTile.y === 6382) {
        if (!p.getAttribute(SCAR_LEVIATHAN_KILLED)) { p.sendMessage("The stepping stone is out of reach while the Leviathan attacks."); return true; }
        p.moveTo(p.getAttribute(ATTR_LEVIATHAN_AREA).tile(32, 46, 0));
        p.sendMessage("You cross the stepping stone to Persten's ship.");
        return true;
      }
      if ([49218, 49219].includes(visibleId) && leviathanTile.x === 2099 && leviathanTile.y === 6374) {
        if (!p.getAttribute(SCAR_PERSTEN_LEFT_SHIP)) { p.sendMessage("Persten asks you to search the debris for the medallion."); return true; }
        if (!p.getAttribute(SCAR_LEVIATHAN_DEBRIS_SEARCHED)) {
          if (p.getInventory().getFreeSlots() < 1 && !has(p, I.PERSERIYAS_MEDALLION)) {
            p.sendMessage("You need an empty inventory slot to take the medallion.");
            return true;
          }
          p.setAttribute(SCAR_LEVIATHAN_DEBRIS_SEARCHED, true);
          p.getInventory().adds(I.PERSERIYAS_MEDALLION, 1);
          setScarVarbit(p, 48);
          p.sendMessage("You search the debris and find Perseriya's medallion.");
        } else p.sendMessage("You find nothing else in the debris.");
        return true;
      }
    }
    if (touchScarEnergy(event)) return true;
    if (handleScarMazeThreeObject(event, scarMazeThreeTile)) return true;
    if (s === S.LEVIATHAN && scarMazeTwoTile) {
      if (objectId === O.PASSAGE_17 && scarMazeTwoTile.x === 1790 && scarMazeTwoTile.y === 6405) {
        const scar = p.getAttribute(ATTR_SCAR_AREA);
        const maze = p.getAttribute(ATTR_SCAR_MAZE_TWO);
        if (scar instanceof ScarArea && !scar.isDestroyed() && maze instanceof ScarMazeTwoArea && !maze.isDestroyed()) {
          maze.leave(p, false);
          maze.postLeave(p, false);
          p.moveTo(scar.tile(51, 43, 0));
          setScarVarbit(p, p.getAttribute(SCAR_BOAT2_BURNED) ? 28 : 24);
          p.sendMessage("You leave the middle passage and return to Persten's camp.");
        }
        return true;
      }
      if (objectId === O.PASSAGE_18 && scarMazeTwoTile.x === 1756 && scarMazeTwoTile.y === 6420) {
        if (!p.getAttribute(SCAR_AXON_ROOM_COMPLETE)) {
          spawnScarAxons(p, p.getAttribute(ATTR_SCAR_MAZE_TWO));
          p.sendMessage("Guide the four abyssal axons into their matching elemental terminals by attacking them.");
        } else p.sendMessage("All four axons have reached their terminals.");
        return true;
      }
      if (objectId === O.PASSAGE_19 && scarMazeTwoTile.x === 1782 && scarMazeTwoTile.y === 6420) {
        if (!p.getAttribute(SCAR_AXON_ROOM_COMPLETE)) {
          p.sendMessage("The axon terminals are still inactive.");
          return true;
        }
        p.setAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE, true);
        p.setAttribute(SCAR_RIFT_LIVE, true);
        p.setAttribute(SCAR_NERVE_ROOM_TWO_AIR, 100);
        p.setAttribute(SCAR_NERVE_ROOM_TWO_BROKEN, []);
        p.setAttribute(SCAR_NERVE_ROOM_TWO_REPAIRED, []);
        p.getPacketSender().sendVarbit(15211, 100);
        p.getPacketSender().sendVarbit(15259, 0);
        p.sendMessage("You dive into the nerve chamber. Break elemental endings, combine the matching nerves, and surface at the air bubbles.");
        return true;
      }
      if (objectId === O.PASSAGE_20 && scarMazeTwoTile.x === 1744 && scarMazeTwoTile.y === 6457) {
        if (!p.getAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE)) {
          p.sendMessage("The four broken nerve endings still need their matching combined nerves.");
          return true;
        }
        p.setAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE, false);
        p.setAttribute(SCAR_SUMMON_ROOM_STARTED, false);
        p.setAttribute(SCAR_SUMMON_ROOM_COMPLETE, false);
        p.getPacketSender().sendVarbit(15260, 0);
        spawnScarSummoningRoom(p, p.getAttribute(ATTR_SCAR_MAZE_TWO));
        p.sendMessage("Scarred imps shield the lesser demons with their prayers. Defeat the imps first, then the demons.");
        return true;
      }
      if (objectId === O.PASSAGE_23 && scarMazeTwoTile.x === 1771 && scarMazeTwoTile.y === 6459) {
        if (!p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE)) {
          p.sendMessage("The summoning circle still protects the shipwreck passage.");
          return true;
        }
        p.setAttribute("desert-treasure-ii:scar-boat-room-two", true);
        p.getPacketSender().sendVarbit(15261, 1);
        p.sendMessage("You enter the northern shipwreck chamber.");
        return true;
      }
      if (p.getAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE)) {
        if (objectId === O.AIR_BUBBLE && SCAR_NERVE_AIR_BUBBLES.some(([x, y]) => x === scarMazeTwoTile.x && y === scarMazeTwoTile.y)) {
          p.setAttribute(SCAR_NERVE_ROOM_TWO_AIR, 100);
          p.getPacketSender().sendVarbit(15211, 100);
          p.sendMessage("You surface at the air bubble and replenish your oxygen.");
          return true;
        }
        const nerve = SCAR_NERVE_LOCATIONS_TWO.find(({ object, tiles }) =>
          object === (definition?.id ?? objectId) && tiles.some(([x, y]) => x === scarMazeTwoTile.x && y === scarMazeTwoTile.y));
        if (nerve) {
          const broken = p.getAttribute(SCAR_NERVE_ROOM_TWO_BROKEN) ?? [];
          const key = `${nerve.object}:${scarMazeTwoTile.x}:${scarMazeTwoTile.y}`;
          if (broken.includes(key)) {
            p.sendMessage("That nerve ending has already been broken.");
            return true;
          }
          p.setAttribute(SCAR_NERVE_ROOM_TWO_BROKEN, [...broken, key]);
          p.getInventory().adds(nerve.item, 1);
          p.sendMessage(`You break the ${nerve.item === I.EARTH_NERVE ? "earth" : nerve.item === I.AIR_NERVE ? "air" : nerve.item === I.WATER_NERVE ? "water" : "fire"} nerve ending and take its rune nerve.`);
          return true;
        }
      }
      if (p.getAttribute("desert-treasure-ii:scar-boat-room-two")) {
        if (objectId === 49425 && scarMazeTwoTile.x === 1774 && scarMazeTwoTile.y === 6448) {
          if (!has(p, I.TINDERBOX)) p.getInventory().adds(I.TINDERBOX, 1);
          p.sendMessage("You search the south-west crate and find a tinderbox.");
          return true;
        }
        if (objectId === 49427 && scarMazeTwoTile.x === 1779 && scarMazeTwoTile.y === 6448) {
          if (!has(p, I.GUNPOWDER_2)) p.getInventory().adds(I.GUNPOWDER_2, 1);
          p.sendMessage("You search the skeleton near the crate and find gunpowder.");
          return true;
        }
        if (objectId === 49426 && scarMazeTwoTile.x === 1789 && scarMazeTwoTile.y === 6449) {
          if (!has(p, I.SLIMY_KEY)) p.getInventory().adds(I.SLIMY_KEY, 1);
          p.sendMessage("You search the south-east skeleton and find a slimy key.");
          return true;
        }
        if (objectId === 49420 && scarMazeTwoTile.x === 1775 && scarMazeTwoTile.y === 6460) {
          if (p.getAttribute("desert-treasure-ii:scar-boat-room-two-chest-open")) {
            if (!has(p, I.DAMP_TABLET)) p.getInventory().adds(I.DAMP_TABLET, 1);
            p.sendMessage("The chest is already open. You recover the damp tablet.");
            return true;
          }
          if (!has(p, I.SLIMY_KEY)) {
            p.sendMessage("The chest is locked. A slimy key may fit it.");
            return true;
          }
          if (!has(p, I.DAMP_TABLET)) p.getInventory().adds(I.DAMP_TABLET, 1);
          p.getInventory().deleteNumber(I.SLIMY_KEY, 1);
          p.setAttribute("desert-treasure-ii:scar-boat-room-two-chest-open", true);
          p.sendMessage("The slimy key opens the chest. You take a damp tablet.");
          return true;
        }
        if (objectId === O.SHIPWRECK && scarMazeTwoTile.x === 1786 && scarMazeTwoTile.y === 6453) {
          p.sendMessage("Use the tinderbox on the wreck after reading the damp tablet and collecting gunpowder.");
          return true;
        }
      }
    }
    if (s === S.LEVIATHAN && objectId === 49209 && scarTile
      && [[2031, 6430], [2033, 6430]].some(([x, y]) => scarTile.x === x && scarTile.y === y)) {
      if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) {
        p.sendMessage("The Scarred demons must be defeated before you cross these stones.");
      } else {
        const area = p.getAttribute(ATTR_SCAR_AREA);
        const sourceX = p.getLocation().getX() - area.getBaseX() + 2000;
        const destinationX = sourceX <= scarTile.x ? scarTile.x + 1 : scarTile.x - 1;
        p.moveTo(area.tile(destinationX - 2000, scarTile.y - 6400, 0));
        p.sendMessage("You carefully cross the stepping stone.");
      }
      event.handled = true;
      return true;
    }
    if (s === S.LEVIATHAN && scarMazeTile && objectId === 49418
      && scarMazeTile.x === 2220 && scarMazeTile.y === 6402) {
      if (!p.getAttribute("desert-treasure-ii:scar-growth-complete")) {
        p.sendMessage("The passage remains sealed until the damaged growths restore the neural route.");
        event.handled = true;
        return true;
      }
      p.setAttribute(SCAR_BOAT_ROOM, true);
      p.sendMessage("You enter the shipwreck chamber beyond the restored Scar passage.");
      event.handled = true;
      return true;
    }
    if (s === S.LEVIATHAN && scarMazeTile?.x === 2237 && scarMazeTile.y === 6443
      && objectId === O.NEURAL_TELEPORTER && p.getAttribute(SCAR_BOAT_BURNED)) {
      const passage = p.getAttribute(ATTR_SCAR_AREA);
      const maze = p.getAttribute(ATTR_SCAR_MAZE_ONE);
      if (passage instanceof ScarArea && !passage.isDestroyed() && maze instanceof ScarMazeOneArea && !maze.isDestroyed()) {
        maze.leave(p, false);
        maze.postLeave(p, false);
        p.moveTo(passage.tile(51, 43, 0));
        setScarVarbit(p, 20);
        p.sendMessage("The neural teleporter carries you back to Persten's camp.");
        return true;
      }
    }
    if (s === S.LEVIATHAN && p.getAttribute(SCAR_BOAT_ROOM) && scarMazeTile) {
      if (objectId === 49425 && scarMazeTile.x === 2236 && scarMazeTile.y === 6402) {
        if (!has(p, I.TINDERBOX)) {
          p.getInventory().adds(I.TINDERBOX, 1);
          p.setAttribute(SCAR_TINDERBOX_FOUND, true);
          p.sendMessage("You search the crate and find a tinderbox.");
        } else p.sendMessage("The crate is empty.");
        event.handled = true;
        return true;
      }
      if (objectId === 49426 && scarMazeTile.x === 2221 && scarMazeTile.y === 6414) {
        if (!has(p, I.SLIMY_KEY)) {
          p.getInventory().adds(I.SLIMY_KEY, 1);
          p.setAttribute(SCAR_SLIMY_KEY_FOUND, true);
          p.sendMessage("You search the north-west skeleton and find a slimy key.");
        } else p.sendMessage("The skeleton has nothing else of use.");
        event.handled = true;
        return true;
      }
      if (objectId === 49427 && scarMazeTile.x === 2223 && scarMazeTile.y === 6402) {
        if (!has(p, I.GUNPOWDER_2)) {
          p.getInventory().adds(I.GUNPOWDER_2, 1);
          p.setAttribute(SCAR_GUNPOWDER_FOUND, true);
          p.sendMessage("You search the south-west skeleton and find gunpowder.");
        } else p.sendMessage("The skeleton has nothing else of use.");
        event.handled = true;
        return true;
      }
      if (objectId === 49420 && scarMazeTile.x === 2231 && scarMazeTile.y === 6413) {
        if (p.getAttribute(SCAR_BOAT_CHEST_OPEN)) {
          if (!has(p, I.OLD_TABLET)) p.getInventory().adds(I.OLD_TABLET, 1);
          p.sendMessage("The chest is already open.");
          event.handled = true;
          return true;
        }
        if (!has(p, I.SLIMY_KEY)) {
          p.sendMessage("The chest is locked. A slimy key may fit it.");
          event.handled = true;
          return true;
        }
        p.getInventory().deleteNumber(I.SLIMY_KEY, 1);
        p.getInventory().adds(I.OLD_TABLET, 1);
        p.setAttribute(SCAR_BOAT_CHEST_OPEN, true);
        p.setAttribute(SCAR_SLIMY_KEY_FOUND, false);
        p.sendMessage("The slimy key opens the chest. You take an old tablet.");
        event.handled = true;
        return true;
      }
    }
    if (s === S.LEVIATHAN && scarMazeTile && p.getAttribute(SCAR_TETHER_DESTROYED)) {
      if (objectId === 49415 && scarMazeTile.x === 2233 && scarMazeTile.y === 6461) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(31, 12, 0));
        p.sendMessage("The green neural teleporter carries you toward the catalyst chamber.");
        return true;
      }
      if (objectId === 49411 && scarMazeTile.x === 2190 && scarMazeTile.y === 6412) {
        p.setAttribute(SCAR_RIFT_LIVE, true);
        if (!p.getAttribute(SCAR_CATALYST_ORDER)) p.setAttribute(SCAR_CATALYST_ORDER, shuffled(SCAR_CATALYST_RUNES));
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(39, 12, 0));
        spawnScarCatalyst(p, p.getAttribute(ATTR_SCAR_MAZE_ONE));
        p.sendMessage("You enter the catalyst chamber. Break the nerve endings and combine them to match its rune.");
        inspectScarCatalyst({ player: p });
        return true;
      }
      if (objectId === 49414 && scarMazeTile.x === 2181 && scarMazeTile.y === 6424
        && (Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0) >= SCAR_CATALYST_RUNES.length) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(64, 24, 0));
        p.sendMessage("The blue neural teleporter carries you toward the damaged growth room.");
        return true;
      }
      if (objectId === 49412 && scarMazeTile.x === 2225 && scarMazeTile.y === 6421
        && (Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0) >= SCAR_CATALYST_RUNES.length) {
        p.setAttribute(SCAR_GROWTH_LIVE, true);
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(66, 22, 0));
        spawnScarLightLeeches(p, p.getAttribute(ATTR_SCAR_MAZE_ONE));
        p.sendMessage("Four damaged growths need illuminating lures. The light leeches carry them.");
        return true;
      }
      const nerve = SCAR_NERVE_LOCATIONS.find(({ object, tiles }) => object === visibleId
        && tiles.some(([x, y]) => x === scarMazeTile.x && y === scarMazeTile.y));
      if (nerve && p.getAttribute(SCAR_RIFT_LIVE)) {
        const broken = p.getAttribute(SCAR_NERVES_BROKEN) ?? [];
        const tileKey = `${visibleId}:${scarMazeTile.x}:${scarMazeTile.y}`;
        if (broken.includes(tileKey)) return p.sendMessage("That nerve ending has already been broken.");
        p.setAttribute(SCAR_NERVES_BROKEN, [...broken, tileKey]);
        p.getInventory().adds(nerve.item, 1);
        p.sendMessage("You break the nerve ending and take its elemental rune nerve.");
        return true;
      }
    }
    if (s === S.LEVIATHAN && scarMazeTile?.x === 2210 && scarMazeTile.y === 6433 && objectId === O.ABYSSAL_TETHER) {
      if (!p.getAttribute(SCAR_PATH_COMPLETE)) return p.sendMessage("Follow each pathfinder through the maze to reach the tether.");
      p.setAttribute(SCAR_TETHER_DESTROYED, true);
      p.sendMessage("The abyssal tether is severed. The teleporter to the catalyst room is now reachable.");
      return true;
    }
    if (s === S.LEVIATHAN && scarMazeTile?.x === 2190 && scarMazeTile.y === 6412
      && !p.getAttribute(SCAR_TETHER_DESTROYED)) {
      return p.sendMessage("The abyssal tether still powers the barrier to this chamber.");
    }
    if (s === S.LEVIATHAN && scarTile?.x === 2043 && scarTile.y === 6441
      && (definition?.id ?? objectId) === SCAR_PASSAGE_OPEN) {
      if (!p.getAttribute(SCAR_PERSTEN_TALKED)) return p.sendMessage("Speak to Wizard Persten before entering the Scar passage.");
      enterScarMazeOne(p);
      return true;
    }
    if (s === S.LEVIATHAN && scarTile?.x === 2051 && scarTile.y === 6434
      && [O.PASSAGE_15, 49410].includes(definition?.id ?? objectId)) {
      if (!p.getAttribute(SCAR_PERSTEN_ROOM1_TALKED)) {
        p.sendMessage("Speak to Persten about the first passage before entering the middle passage.");
        return true;
      }
      if (p.getAttribute(SCAR_PERSTEN_ROOM2_TALKED)) {
        enterScarMazeThree(p);
        return true;
      }
      enterScarMazeTwo(p);
      return true;
    }
    if (s === S.LEVIATHAN && objectId === O.ROWBOAT_19 && scarTile?.x === 2065 && scarTile.y === 6435) {
      if (p.getAttribute(SCAR_BOAT3_BURNED) && p.getAttribute("desert-treasure-ii:scar-persten-room3-talked")) {
        p.setAttribute(SCAR_LEVIATHAN_READY, true);
        setScarVarbit(p, 38);
        enterLeviathanArea(p);
        p.sendMessage("You board Persten's ship and sail toward the Leviathan's lair.");
        return true;
      }
      if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) return p.sendMessage("The creatures fighting near the entrance still need to be dealt with.");
      p.setAttribute(SCAR_BOAT_TRIED, true);
      setScarVarbit(p, 10);
      const area = p.getAttribute(ATTR_SCAR_AREA);
      spawnScarPersten(p, area);
      talk(p, N.WIZARD_PERSTEN_5, "praefectus-classis-perseriya-attempting-to-board-the-rowboat-in-the-scar");
      return true;
    }
    if (s === 0 && [O.VAULT_DOOR_2, O.VAULT_DOOR_3].includes(objectId)) {
      // This is the cache entrance north-east of Nardah (loc 46743, 3511,2970).
      if (Math.abs(location.x - 3511) > 4 || Math.abs(location.y - 2970) > 4) return false;
      const skills = p.getSkillManager();
      const requirements = [["Firemaking", Skill.FIREMAKING, 75], ["Magic", Skill.MAGIC, 75], ["Thieving", Skill.THIEVING, 70], ["Herblore", Skill.HERBLORE, 62], ["Runecraft", Skill.RUNECRAFTING, 60], ["Construction", Skill.CONSTRUCTION, 60]];
      const missing = requirements.find(([, skill, level]) => skills.getMaxLevel(skill) < level);
      if (missing) return p.sendMessage(`You need ${missing[2]} ${missing[0]} to investigate the vault.`);
      const missingQuest = PREREQUISITES.find((key) => {
        const request = { player: p, key, complete: false };
        api.emitCustomEvent("quest:is-complete", request);
        return !request.complete;
      });
      if (missingQuest) return p.sendMessage(`You must complete ${missingQuest.replaceAll("_", " ")} first.`);
      quest.setStage(p, S.STARTED);
      p.setAttribute(ATTR_SMITH_INTRO, false);
      enterVault(p);
      return true;
    }
    if (s >= S.STARTED && s < S.COMPLETE && [O.VAULT_DOOR_2, O.VAULT_DOOR_3].includes(objectId)
      && !vaultTile && Math.abs(location.x - 3511) <= 4 && Math.abs(location.y - 2970) <= 4) {
      enterVault(p);
      return true;
    }
    if (s >= S.STARTED && s < S.VAULT && vaultTile
      && ((STATUES.has(objectId) && [[3941, 9635], [3931, 9635], [3931, 9625], [3941, 9625]].some(([x, y]) => vaultTile.x === x && vaultTile.y === y))
        || (objectId === O.PLAQUE_35 && vaultTile.x === 3944 && vaultTile.y === 9631))) {
      const bits = Number(p.getAttribute("desert-treasure-ii:statues")) || 0;
      const index = STATUES.get(objectId);
      const next = index === undefined ? bits | 16 : bits | (1 << index);
      p.setAttribute("desert-treasure-ii:statues", next);
      if (next === 31) p.sendMessage("The plaque identifies the four generals: Vardorvis, Perseriya, Sucellus and the Whisperer.");
      else if (index !== undefined) p.sendMessage(["The statue depicts Vardorvis.", "The statue depicts the Whisperer.", "The statue depicts Sucellus.", "The statue depicts Perseriya."][index]);
      else p.sendMessage("You inspect the plaque. It describes the fallen empire and its four generals.");
      return true;
    }
    if (vaultTile && [O.VAULT_DOOR, O.VAULT_DOOR_2, O.VAULT_DOOR_3].includes(objectId)) {
      leaveVault(p);
      return true;
    }
    if (s >= S.ROCKS && s < S.GUARDIAN && [O.ROCKS, O.ROCKS_2, O.ROCKS_3, O.ROCKSLIDE].includes(objectId)) {
      if (!has(p, I.BRONZE_PICKAXE) && !has(p, I.IRON_PICKAXE)) return p.sendMessage("You need a pickaxe to clear the rocks.");
      p.sendMessage("You mine away the rocks and uncover a passage into the installation.");
      setStage(p, S.GUARDIAN);
      return true;
    }
    if (s === S.VARDORVIS && objectId === KASONDE_DESK_LOC
      && Math.abs(location.x - 1781) <= 2 && Math.abs(location.y - 3619) <= 2
      && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) === 2) {
      if (!has(p, KASONDE_NOTE)) p.getInventory().adds(KASONDE_NOTE, 1);
      p.setAttribute(VARDORVIS_PROGRESS, 3);
      talk(p, N.GOLEM_3, "carnifex-maximus-vardorvis-searching-the-botanist-s-desk");
      return true;
    }
    if (s === S.VARDORVIS && objectId === STRANGLEWOOD_BOAT_IN_LOC
      && Math.abs(location.x - 1227) <= 2 && Math.abs(location.y - 3469) <= 2) {
      const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (progress < 4) {
        talk(p, N.GOLEM_3, "carnifex-maximus-vardorvis-boarding-the-rowboat-before-reading-the-note");
        return true;
      }
      if (progress < 5) {
        talk(p, N.GOLEM_3, "carnifex-maximus-vardorvis-boarding-the-rowboat-before-drinking-the-potion");
        return true;
      }
      talk(p, N.GOLEM_3, "carnifex-maximus-vardorvis-travelling-to-the-stranglewood-for-the-first-time");
      p.setAttribute(VARDORVIS_PROGRESS, 6);
      p.moveTo(new api.core.Location(1196, 3450, 0));
      spawnSurfaceKasonde(p);
      return true;
    }
    if (s === S.VARDORVIS && [O.ENTRY_20, O.ENTRY_21].includes(objectId)
      && Math.abs(location.x - 1191) <= 2 && Math.abs(location.y - 3411) <= 2) {
      if ((Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) < 8) {
        return p.sendMessage("Talk to Kasonde before entering the hideout.");
      }
      enterHideout(p);
      return true;
    }
    const hideoutTile = hideoutSourceTile(p, location);
    if (hideoutTile && [O.LADDER_439, O.LADDER_440].includes(objectId)
      && hideoutTile.x === 1187 && hideoutTile.y === 9764) {
      leaveHideout(p);
      return true;
    }
    if (s === S.VARDORVIS && objectId === O.ENTRY_21
      && Math.abs(location.x - 1174) <= 2 && Math.abs(location.y - 3428) <= 2) {
      const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (progress >= 18 && has(p, I.TEMPLE_KEY_3)) {
        enterStranglewoodTemple(p);
        return true;
      }
      if (progress < 12 || !has(p, I.KORBAL_HERB) || !has(p, I.ARGIAN_BERRIES)) {
        return p.sendMessage("Find the Korbal herb and Argian berries before entering Kasonde's temple.");
      }
      enterStranglewoodTemple(p);
      return true;
    }
    const templeTile = templeSourceTile(p, location);
    if (templeTile && [O.ENTRY_20, O.ENTRY_21, O.ENTRY_22, O.ENTRY_23].includes(objectId)) {
      const area = p.getAttribute(ATTR_STRANGLEWOOD_TEMPLE);
      area.leave(p, false);
      area.postLeave(p, false);
      area.destroy();
      p.setAttribute(ATTR_STRANGLEWOOD_TEMPLE, null);
      p.moveTo(new api.core.Location(1174, 3428, 0));
      return true;
    }
    const ritualTile = vardorvisSourceTile(p, location);
    if (s === S.VARDORVIS && ritualTile && [VARDORVIS_ENTRY, O.ROCKS_139].includes(objectId)
      && ritualTile.x === 1118 && ritualTile.y === 3428) {
      const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (progress >= 17) {
        if (!has(p, I.TEMPLE_KEY_3)) p.getInventory().adds(I.TEMPLE_KEY_3, 1);
        p.setAttribute(VARDORVIS_PROGRESS, 18);
        p.sendMessage("You search the rocks and find the Temple key.");
        return true;
      }
      return p.sendMessage("There is nothing useful among the rocks yet.");
    }
    if (s === S.VARDORVIS && ritualTile && [O.ENTRY_22, O.ENTRY_23].includes(objectId)) {
      return leaveVardorvisArena(p);
    }
    if (s === S.VARDORVIS && objectId === VARDORVIS_ENTRY
      && Math.abs(location.x - 1118) <= 2 && Math.abs(location.y - 3428) <= 2) {
      const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (progress < 16) return p.sendMessage("The ritual site is too dangerous until you have prepared the Strangler serum.");
      enterVardorvisArena(p);
      return true;
    }
    if (s === S.VARDORVIS && objectId === KASONDE_MEDALLION_CHEST
      && Math.abs(location.x - 1196) <= 2 && Math.abs(location.y - 3411) <= 2
      && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 21) {
      if (!has(p, I.VARDORVIS_MEDALLION)) p.getInventory().adds(I.VARDORVIS_MEDALLION, 1);
      p.setAttribute(VARDORVIS_PROGRESS, 22);
      p.sendMessage("You search Kasonde's chest and find Vardorvis' medallion.");
      return true;
    }
    if (s === S.VARDORVIS && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 11
      && objectId === O.KORBAL_HERBS && Math.abs(location.x - 1155) <= 2 && Math.abs(location.y - 3447) <= 2) {
      if (!has(p, I.KORBAL_HERB)) p.getInventory().adds(I.KORBAL_HERB, 1);
      if (has(p, I.KORBAL_HERB) && has(p, I.ARGIAN_BERRIES)) p.setAttribute(VARDORVIS_PROGRESS, 12);
      p.sendMessage("You pick a Korbal herb from the north-west of the Stranglewood.");
      return true;
    }
    if (s === S.VARDORVIS && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 11
      && objectId === O.ARGIAN_BUSH && Math.abs(location.x - 1126) <= 2 && Math.abs(location.y - 3323) <= 2) {
      if (!has(p, I.ARGIAN_BERRIES)) p.getInventory().adds(I.ARGIAN_BERRIES, 1);
      if (has(p, I.KORBAL_HERB) && has(p, I.ARGIAN_BERRIES)) p.setAttribute(VARDORVIS_PROGRESS, 12);
      p.sendMessage("You pick Argian berries from the south-west of the Stranglewood.");
      return true;
    }
    if (s === S.VARDORVIS && objectId === STRANGLEWOOD_BOAT_OUT_LOC
      && Math.abs(location.x - 1193) <= 2 && Math.abs(location.y - 3453) <= 2) {
      p.moveTo(new api.core.Location(1227, 3470, 0));
      p.sendMessage("You row back from the Stranglewood.");
      return true;
    }
    if (s === S.GUARDIAN && objectId === O.CREVICE_45) {
      if (location.x !== 3411 || location.y !== 9811) return false;
      enterWarRoom(p);
      return true;
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && objectId === O.RUBBLE_74
      && roomTile?.x === 2783 && roomTile?.y === 6425) {
      leaveWarRoom(p);
      return true;
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && objectId === O.CRATE_302
      && roomTile?.x === 2780 && roomTile?.y === 6440) {
      if (!p.getAttribute(TOTEMS_CHARGED)) return p.sendMessage("Activate all four elemental totems before searching the crate.");
      if (p.getAttribute("desert-treasure-ii:cells-collected")) return p.sendMessage("The crate is empty.");
      p.setAttribute("desert-treasure-ii:cells-collected", true);
      p.getInventory().adds(I.UNCHARGED_CELL_2, 8);
      p.sendMessage("You search the crate and take eight uncharged cells.");
      return true;
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && [O.ALTAR_93, O.ALTAR_94].includes(objectId)
      && roomTile?.x === 2773 && roomTile?.y === 6442) {
      p.setAttribute(ALTAR_INSPECTED, true);
      return p.sendMessage("You inspect the altar. Its elemental charge is now available.");
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && [O.GOLEM, O.GOLEM_2].includes(objectId)
      && roomTile?.x === 2783 && roomTile?.y === 6444) {
      if (p.getAttribute(GOLEM_SOLVED)) return promptGolemSearch(p);
      if (!p.getAttribute(GOLEM_INSPECTED)) {
        p.setAttribute(GOLEM_INSPECTED, true);
        talk(p, N.DR_BANIKAN_2, "familiar-faces-inspecting-the-golem-machine");
        return true;
      }
      if (!p.getAttribute(ALTAR_INSPECTED)) return p.sendMessage("Inspect the altar before operating the machine.");
      if (!p.getAttribute(TOTEMS_CHARGED)) return p.sendMessage("Cast the matching ancient burst spell or higher on each elemental totem.");
      if (p.getAttribute(CELLS_INSERTED)) { openGolemPuzzle(p); return true; }
      return p.sendMessage("Collect and charge eight cells before operating the golem.");
    }
    return false;
  }
  function handleItemOnObject(event) {
    const { player: p, itemId, objectId, location } = event;
    const sucellusTile = sucellusSourceTile(p, location);
    if (stage(p) === S.SUCELLUS && p.getAttribute(SUCELLUS_CELL_ESCAPED)
      && objectId === 49120 && sucellusTile?.x === 2945 && sucellusTile.y === 6389
      && sucellusTile.z === 2 && itemId === I.LOCKPICK_4 && has(p, I.LOCKPICK_4)) {
      p.setAttribute(SUCELLUS_ASSASSIN_GONE, true);
      p.sendMessage("You use the lockpick to open the padlocked gate and continue through the prison.");
      return false;
    }
    if (stage(p) === S.SUCELLUS && p.getAttribute(SUCELLUS_CELL_ENTERED)
      && objectId === 49099 && sucellusTile?.x === 3040 && sucellusTile.y === 6370) {
      const cellProgress = Number(p.getAttribute(SUCELLUS_CELL_PROGRESS)) || 0;
      if (itemId === I.KNIFE_5 && cellProgress >= 4 && has(p, I.KNIFE_5)) {
        event.handled = true;
        p.getInventory().deleteNumber(I.KNIFE_5, 1);
        p.getInventory().adds(I.CHISEL_5, 1);
        p.setAttribute(SUCELLUS_CELL_PROGRESS, 5);
        talk(p, N.ASSASSIN_7, "duke-sucellus-of-the-sixth-legion-talking-to-the-mysterious-voice-after-getting-a-knife");
        return true;
      }
      if (itemId === I.LOCKPICK_4 && cellProgress >= 6 && has(p, I.LOCKPICK_4)) {
        event.handled = true;
        p.setAttribute(SUCELLUS_CELL_PROGRESS, 7);
        p.setAttribute(SUCELLUS_CELL_ESCAPED, true);
        talk(p, N.ASSASSIN_7, "duke-sucellus-of-the-sixth-legion-escaping-the-prison-cell");
        const area = p.getAttribute(SUCELLUS_AREA);
        p.moveTo(area.tile(40, 12, 2));
        spawnSucellusCellAssassin(p, area);
        return true;
      }
      event.handled = true;
      p.sendMessage("The guard needs the knife or lockpick through the hole in the wall.");
      return true;
    }
    if (stage(p) === S.SUCELLUS && sucellusTile
      && [47536, 47537, 47538, 47539, 47540, 47541, 47542, 47543].includes(objectId)) {
      event.handled = true;
      const vats = { ...(p.getAttribute(SUCELLUS_VATS) ?? {}) };
      const vatKey = `${objectId}:${sucellusTile.x}:${sucellusTile.y}`;
      const vat = { ...(vats[vatKey] ?? { powders: [], salt: 0 }) };
      if (itemId === I.ARDER_POWDER || itemId === I.MUSCA_POWDER) {
        if (!has(p, itemId)) return true;
        if (itemId !== I.ARDER_POWDER && itemId !== I.MUSCA_POWDER) return true;
        if (vat.powders.includes(itemId)) return p.sendMessage("This vat already contains that mushroom powder.");
        p.getInventory().deleteNumber(itemId, 1);
        vat.powders.push(itemId);
        vats[vatKey] = vat;
        p.setAttribute(SUCELLUS_VATS, vats);
        p.sendMessage(`You add the ${itemId === I.ARDER_POWDER ? "Arder" : "Musca"} powder to the fermentation vat.`);
        return true;
      }
      if (itemId === I.SALAX_SALT) {
        if (!has(p, I.SALAX_SALT)) return true;
        if (!vat.powders.length) return p.sendMessage("Add ground mushroom powder to the vat before salax salt.");
        if (vat.salt >= 6) return p.sendMessage("This vat already has enough salax salt.");
        p.getInventory().deleteNumber(I.SALAX_SALT, 1);
        vat.salt++;
        vats[vatKey] = vat;
        p.setAttribute(SUCELLUS_VATS, vats);
        p.sendMessage(`You add salax salt to the vat (${vat.salt}/6).`);
        return true;
      }
      return true;
    }
    const vaultTile = vaultSourceTile(p, location);
    if (vaultTile && STATUES.has(objectId)) {
      const index = STATUES.get(objectId);
      const locations = [[3941, 9635], [3931, 9635], [3931, 9625], [3941, 9625]];
      const medal = STATUE_ITEMS[index];
      const expectedStage = [S.VARDORVIS, S.WHISPERER, S.SUCELLUS, S.LEVIATHAN][index];
      if (vaultTile.x === locations[index][0] && vaultTile.y === locations[index][1]
        && stage(p) === expectedStage && itemId === medal && has(p, medal)) {
        p.getInventory().deleteNumber(medal, 1);
        const placed = (Number(p.getAttribute(STATUES_PLACED)) || 0) | (1 << index);
        p.setAttribute(STATUES_PLACED, placed);
        p.sendMessage(`You place ${index === 0 ? "Vardorvis'" : index === 1 ? "the Whisperer's" : index === 2 ? "Sucellus'" : "Perseriya's"} medallion on the statue.`);
        if (placed === 15) setStage(p, S.FINALE);
        else if (index === 0) {
          setStage(p, S.LEVIATHAN);
          setScarVarbit(p, 2);
        }
        else if (index === 3) setStage(p, S.SUCELLUS);
        else if (index === 2) setStage(p, S.WHISPERER);
        return true;
      }
    }
    const mazeTile = scarMazeSourceTile(p, location);
    const mazeTwoTile = scarMazeTwoSourceTile(p, location);
    const mazeThreeTile = scarMazeThreeSourceTile(p, location);
    if (stage(p) === S.LEVIATHAN && mazeThreeTile && p.getAttribute(SCAR_MAZE_THREE_ACTIVE)) {
      if (objectId === 49436 && itemId === I.ILLUMINATING_LURE) {
        const index = SCAR_LEECH_GROWTHS.findIndex(([x, y]) => x === mazeThreeTile.x && y === mazeThreeTile.y);
        if (index < 0 || !has(p, I.ILLUMINATING_LURE)) return false;
        const fixed = p.getAttribute(SCAR_LEECH_GROWTHS_REPAIRED) ?? [];
        event.handled = true;
        if (fixed.includes(index)) return p.sendMessage("That damaged growth already glows.");
        p.getInventory().deleteNumber(I.ILLUMINATING_LURE, 1);
        fixed.push(index);
        p.setAttribute(SCAR_LEECH_GROWTHS_REPAIRED, fixed);
        p.getPacketSender().sendVarbit(15210, fixed.length);
        if (fixed.length === SCAR_LEECH_GROWTHS.length) p.sendMessage("The damaged growths light the room. Crimson and Radiant Veins appear.");
        return true;
      }
      const vein = [...SCAR_BLOOD_RED_VEINS.map((tile) => ({ color: "crimson", item: I.CRIMSON_FIBRE, tile })),
        ...SCAR_BLOOD_WHITE_VEINS.map((tile) => ({ color: "radiant", item: I.RADIANT_FIBRE, tile }))]
        .find(({ tile }) => tile[0] === mazeThreeTile.x && tile[1] === mazeThreeTile.y);
      if (vein) {
        event.handled = true;
        if ((p.getAttribute(SCAR_LEECH_GROWTHS_REPAIRED) ?? []).length !== 4) return p.sendMessage("Light all four damaged growths first.");
        if (itemId !== vein.item || !has(p, vein.item)) return p.sendMessage(`That vein needs ${vein.color} fibre.`);
        const key = vein.color === "crimson" ? SCAR_BLOOD_RED_REPAIRED : SCAR_BLOOD_WHITE_REPAIRED;
        const repaired = p.getAttribute(key) ?? [];
        const id = vein.color === "crimson" ? 49537 : 49536;
        if (repaired.includes(vein.tile.join(","))) return p.sendMessage("That vein has already been repaired.");
        p.getInventory().deleteNumber(vein.item, 1);
        repaired.push(vein.tile.join(","));
        p.setAttribute(key, repaired);
        p.getPacketSender().sendVarbit(vein.color === "crimson" ? 15219 : 15218, repaired.length);
        if (repaired.length === 3) p.sendMessage(`All three ${vein.color} veins are repaired.`);
        if ((p.getAttribute(SCAR_BLOOD_RED_REPAIRED) ?? []).length === 3
          && (p.getAttribute(SCAR_BLOOD_WHITE_REPAIRED) ?? []).length === 3) {
          p.setAttribute(SCAR_LEECH_COMPLETE, true);
          p.getPacketSender().sendVarbit(15259, 1);
          p.sendMessage("The Unlit Veins are restored. The shipwreck passage is now accessible.");
        }
        return true;
      }
    }
    if (stage(p) === S.LEVIATHAN && mazeTwoTile && p.getAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE)) {
      const nerve = SCAR_NERVE_REPAIRS_TWO.find(({ object, tile }) =>
        object === objectId && tile[0] === mazeTwoTile.x && tile[1] === mazeTwoTile.y);
      if (nerve) {
        event.handled = true;
        if (itemId !== nerve.item || !has(p, nerve.item)) {
          p.sendMessage("That combined nerve does not match this broken ending.");
          return true;
        }
        const fixed = p.getAttribute(SCAR_NERVE_ROOM_TWO_REPAIRED) ?? [];
        if (fixed.includes(nerve.object)) {
          p.sendMessage("That nerve ending has already been repaired.");
          return true;
        }
        p.getInventory().deleteNumber(nerve.item, 1);
        fixed.push(nerve.object);
        p.setAttribute(SCAR_NERVE_ROOM_TWO_REPAIRED, fixed);
        p.getPacketSender().sendVarbit(15221, fixed.length);
        p.sendMessage("You repair the matching combined nerve ending.");
        if (fixed.length === SCAR_NERVE_REPAIRS_TWO.length) {
          p.setAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE, true);
          p.setAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE, false);
          p.getPacketSender().sendVarbit(15259, 1);
          p.sendMessage("All four nerve endings are restored. The summoning chamber has opened.");
        }
        return true;
      }
    }
    if (stage(p) === S.LEVIATHAN && p.getAttribute(SCAR_GROWTH_LIVE)
      && objectId === 49436 && itemId === I.ILLUMINATING_LURE && mazeTile) {
      const growthIndex = SCAR_GROWTHS.findIndex(([x, y]) => x === mazeTile.x && y === mazeTile.y);
      if (growthIndex < 0 || !has(p, I.ILLUMINATING_LURE)) return false;
      const fixed = p.getAttribute("desert-treasure-ii:scar-growth-repaired") ?? [];
      if (fixed.includes(growthIndex)) return p.sendMessage("That damaged growth already glows.");
      p.getInventory().deleteNumber(I.ILLUMINATING_LURE, 1);
      const next = [...fixed, growthIndex];
      p.setAttribute("desert-treasure-ii:scar-growth-repaired", next);
      p.setAttribute(SCAR_GROWTH_LURES, next.length);
      p.getPacketSender().sendVarbit(SCAR_GROWTH_LIT_VARBIT, next.length);
      p.sendMessage("You use the illuminating lure to repair a damaged growth.");
      if (next.length === SCAR_GROWTHS.length) finishScarGrowthRepair(p);
      return true;
    }
    if (stage(p) === S.LEVIATHAN && p.getAttribute(SCAR_BOAT_ROOM)
      && objectId === 49423 && mazeTile?.x === 2235 && mazeTile.y === 6409 && itemId === I.TINDERBOX) {
      if (p.getAttribute(SCAR_BOAT_BURNED)) return p.sendMessage("The shipwreck has already been destroyed.");
      if (!p.getAttribute(SCAR_OLD_TABLET_READ) || !has(p, I.OLD_TABLET)) {
        return p.sendMessage("Read the old tablet before trying to destroy the shipwreck.");
      }
      if (!has(p, I.GUNPOWDER_2)) return p.sendMessage("You need gunpowder to destroy the shipwreck.");
      if (!has(p, I.TINDERBOX)) return p.sendMessage("You need a tinderbox to light the gunpowder.");
      p.getInventory().deleteNumber(I.GUNPOWDER_2, 1);
      p.setAttribute(SCAR_BOAT_BURNED, true);
      setScarVarbit(p, 20);
      p.sendMessage("You spread the gunpowder around the wreck and ignite it. The shipwreck burns away.");
      return true;
    }
    if (stage(p) === S.LEVIATHAN && p.getAttribute("desert-treasure-ii:scar-boat-room-two")
      && objectId === O.SHIPWRECK && mazeTwoTile?.x === 1786 && mazeTwoTile.y === 6453 && itemId === I.TINDERBOX) {
      event.handled = true;
      if (p.getAttribute(SCAR_BOAT2_BURNED)) {
        p.sendMessage("The shipwreck has already been destroyed.");
        return true;
      }
      if (!p.getAttribute("desert-treasure-ii:scar-boat-room-two-tablet-read") || !has(p, I.DAMP_TABLET)) {
        p.sendMessage("Read the damp tablet before trying to destroy the shipwreck.");
        return true;
      }
      if (!has(p, I.GUNPOWDER_2) || !has(p, I.TINDERBOX)) {
        p.sendMessage("You need gunpowder and a tinderbox to destroy the shipwreck.");
        return true;
      }
      p.getInventory().deleteNumber(I.GUNPOWDER_2, 1);
      p.setAttribute(SCAR_BOAT2_BURNED, true);
      setScarVarbit(p, 28);
      p.sendMessage("You spread the gunpowder around the wreck and ignite it. The shipwreck burns away.");
      return true;
    }
    if (stage(p) === S.LEVIATHAN && p.getAttribute(SCAR_BOAT3_ROOM)
      && mazeThreeTile && objectId === O.SHIPWRECK && mazeThreeTile.x === 1914 && mazeThreeTile.y === 6455 && itemId === I.TINDERBOX) {
      event.handled = true;
      if (p.getAttribute(SCAR_BOAT3_BURNED)) return p.sendMessage("The shipwreck has already been destroyed.");
      if (!p.getAttribute("desert-treasure-ii:scar-boat3-tablet-read") || !has(p, I.DAMP_TABLET_2)) return p.sendMessage("Read the damp tablet before trying to destroy the shipwreck.");
      if (!has(p, I.GUNPOWDER_2) || !has(p, I.TINDERBOX)) return p.sendMessage("You need gunpowder and a tinderbox to destroy the shipwreck.");
      p.getInventory().deleteNumber(I.GUNPOWDER_2, 1);
      p.setAttribute(SCAR_BOAT3_BURNED, true);
      setScarVarbit(p, 34);
      p.sendMessage("You spread the gunpowder around the wreck and ignite it. The shipwreck burns away.");
      return true;
    }
    if (stage(p) < S.MACHINE || stage(p) >= S.VARDORVIS) return;
    const roomTile = warRoomSourceTile(p, location);
    if ([O.GOLEM, O.GOLEM_2].includes(objectId) && roomTile?.x === 2783 && roomTile?.y === 6444 && itemId === I.UNCHARGED_CELL_2) {
      talk(p, N.GOLEM_3, "familiar-faces-inspecting-the-golem-machine-using-uncharged-cells-on-the-golem-machine");
      return true;
    }
    if ([O.ALTAR_93, O.ALTAR_94].includes(objectId) && roomTile?.x === 2773 && roomTile?.y === 6442 && itemId === I.UNCHARGED_CELL_2) {
      if (!has(p, I.UNCHARGED_CELL_2)) return;
      p.getInventory().deleteNumber(I.UNCHARGED_CELL_2, 1);
      p.getInventory().adds(I.CHARGED_CELL, 1);
      p.sendMessage("The altar charges the cell.");
      return;
    }
    if ([O.GOLEM, O.GOLEM_2].includes(objectId) && roomTile?.x === 2783 && roomTile?.y === 6444 && itemId === I.CHARGED_CELL) {
      if (!p.getAttribute(TOTEMS_CHARGED)) return p.sendMessage("Activate all four elemental totems before powering the machine.");
      if (p.getAttribute(CELLS_INSERTED)) return openGolemPuzzle(p);
      if (p.getInventory().getAmount(I.CHARGED_CELL) < 8) return p.sendMessage("You need all eight charged cells to power the golem.");
      p.getInventory().deleteNumber(I.CHARGED_CELL, 8);
      p.setAttribute(CELLS_INSERTED, true);
      talk(p, N.GOLEM_3, "familiar-faces-inspecting-the-golem-machine-using-charged-cells-on-the-golem-machine");
      return true;
    }
  }
  function spawnBoss(p, key) {
    const table = {
      vardorvis: [N.VARDORVIS_2, 1129, 3419],
      leviathan: [N.THE_LEVIATHAN_3, 2078, 6368],
      sucellus: [N.DUKE_SUCELLUS_6, 3036, 6452],
      whisperer: [N.THE_WHISPERER_3, 2399, 6369],
    };
    const [id, x, y] = table[key];
    let npcs = spawned.get(p);
    if (!npcs) spawned.set(p, npcs = {});
    if (key === "vardorvis") {
      const area = p.getAttribute(ATTR_VARDORVIS_AREA);
      if (!(area instanceof VardorvisArea) || area.isDestroyed()) return;
      if (npcs[key]?.isRegistered?.() && area.entities.includes(npcs[key])) return;
      const npc = api.core.NPC.create(id, area.tile(x - 1112, y - 3400, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      npcs[key] = npc;
      p.setAttribute(ATTR, npc);
      return npc;
    }
    if (key === "leviathan") {
      const area = p.getAttribute(ATTR_LEVIATHAN_AREA);
      if (!(area instanceof LeviathanArea) || area.isDestroyed() || p.getAttribute(SCAR_LEVIATHAN_KILLED)) return;
      if (npcs[key]?.isRegistered?.() && area.entities.includes(npcs[key])) return npcs[key];
      const npc = api.core.NPC.create(id, area.tile(x - 2064, y - 6336, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.setScriptedMovement?.(true);
      npc.setMaxHitpoints?.(600);
      npc.setHitpoints?.(600);
      npc.__dt2Leviathan = true;
      npc.__skipDefaultRespawn = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      npcs[key] = npc;
      p.setAttribute(ATTR, npc);
      return npc;
    }
    if (key === "sucellus") {
      const area = p.getAttribute(SUCELLUS_AREA);
      if (!(area instanceof SucellusArea) || area.isDestroyed() || p.getAttribute(SUCELLUS_DEFEATED)) return;
      if (npcs[key]?.isRegistered?.() && area.entities.includes(npcs[key])) return npcs[key];
      const npc = api.core.NPC.create(id, area.tile(167, 118, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.setScriptedMovement?.(true);
      npc.setMaxHitpoints?.(440);
      npc.setHitpoints?.(440);
      npc.__dt2Sucellus = true;
      npc.__dt2SucellusAwake = false;
      npc.__skipDefaultRespawn = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      npcs[key] = npc;
      p.setAttribute(ATTR, npc);
      return npc;
    }
    if (!npcs[key]) npcs[key] = api.spawnNpc({ id, x, y, z: 0, owner: p, ownerOnly: true });
    return npcs[key];
  }
  function handleBossTalk({ player: p, npcId, npc }) {
    const s = stage(p);
    if (s === S.VARDORVIS) { talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa"); return; }
    if (s === S.LEVIATHAN) {
      if (!p.getAttribute(SCAR_BOAT_TRIED)) return;
      if (p.getAttribute(SCAR_LEVIATHAN_KILLED) && p.getAttribute(SCAR_PERSTEN_AT_SHIP)) {
        p.setAttribute(SCAR_PERSTEN_LEFT_SHIP, true);
        setScarVarbit(p, 46);
        talk(p, npcId, "praefectus-classis-perseriya-crossing-the-stones-after-defeating-the-leviathan");
        return;
      }
      p.setAttribute(SCAR_PERSTEN_TALKED, true);
      const scarArea = p.getAttribute(ATTR_SCAR_AREA);
      if (p.getAttribute(SCAR_BOAT3_BURNED)) {
        setScarVarbit(p, 36);
        p.setAttribute(SCAR_PERSTEN_ROOM3_TALKED, true);
        talk(p, npcId, "praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-third-passage");
      } else if (p.getAttribute(SCAR_BOAT2_BURNED)) {
        setScarVarbit(p, 30);
        p.setAttribute(SCAR_PERSTEN_ROOM2_TALKED, true);
        if (scarArea instanceof ScarArea && !scarArea.isDestroyed()) revealScarMazeTwoEntry(p, scarArea);
        talk(p, npcId, "praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-second-passage");
      } else if (p.getAttribute(SCAR_BOAT_BURNED)) {
        setScarVarbit(p, 22);
        p.setAttribute(SCAR_PERSTEN_ROOM1_TALKED, true);
        if (scarArea instanceof ScarArea && !scarArea.isDestroyed()) revealScarMazeTwoEntry(p, scarArea);
        talk(p, npcId, "praefectus-classis-perseriya-talking-to-wizard-persten-after-completing-the-first-passage");
      } else {
        if (scarArea instanceof ScarArea && !scarArea.isDestroyed()) revealScarMazeEntry(p, scarArea);
        setScarVarbit(p, 14);
        talk(p, npcId, p.getAttribute(SCAR_PERSTEN_TALKED_BEFORE)
          ? "praefectus-classis-perseriya-talking-to-wizard-persten-talking-to-wizard-persten-again"
          : "praefectus-classis-perseriya-talking-to-wizard-persten");
        p.setAttribute(SCAR_PERSTEN_TALKED_BEFORE, true);
      }
      return;
    }
    if (s === S.SUCELLUS) {
      if (npc?.__dt2Sucellus && !npc.__dt2SucellusAwake) return p.sendMessage("The Duke is in a deep slumber. Weaken him with two Arder-musca poisons first.");
      return p.sendMessage("Duke Sucellus turns his attention to you.");
    }
    if (s === S.WHISPERER) { talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to"); }
  }
  function handleDeath({ killer, npc }) {
    if (npc?.__dt2ScarAntibody) {
      const owner = npc.getOwner?.();
      const owned = spawned.get(owner);
      if (owner && Array.isArray(owned?.scarTreeAntibodies)) {
        owned.scarTreeAntibodies = owned.scarTreeAntibodies.filter((ally) => ally !== npc);
        const alive = owned.scarTreeAntibodies.some((ally) => ally?.isRegistered?.() && ally.getHitpoints?.() > 0);
        if (!alive) {
          const area = owner.getAttribute(ATTR_SCAR_MAZE_THREE);
          for (const enemy of owned.scarTreeEnemies ?? []) {
            if (enemy?.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(enemy)) api.core.World.getRemoveNPCQueue().push(enemy);
          }
          owned.scarTreeEnemies = [];
          owner.setAttribute(SCAR_TREE_STARTED, false);
          owner.setAttribute("desert-treasure-ii:scar-tree-wave", 0);
          if (area instanceof ScarMazeThreeArea && !area.isDestroyed()) owner.moveTo(area.tile(41, 36, 0));
          owner.getCombat().getHitQueue().addPendingDamage([
            new api.core.HitDamage(20, api.core.HitMask.RED),
          ]);
          owner.sendMessage("The antibodies fall. The Scar ejects you from the Brain Pillar room.");
        }
      }
      return;
    }
    if (!killer) return;
    const owned = spawned.get(killer);
    if (!owned) return;
    if (owned.leviathan === npc && stage(killer) === S.LEVIATHAN) {
      owned.leviathan = null;
      killer.setAttribute(ATTR, null);
      killer.setAttribute(SCAR_LEVIATHAN_KILLED, true);
      killer.setAttribute(SCAR_PERSTEN_AT_SHIP, true);
      setScarVarbit(killer, 42);
      const area = killer.getAttribute(ATTR_LEVIATHAN_AREA);
      if (area instanceof LeviathanArea && !area.isDestroyed()) spawnScarPerstenAtShip(killer, area);
      killer.sendMessage("The Leviathan is defeated. Climb the northern handholds and cross the stepping stone to Persten's ship.");
      return;
    }
    if (owned.sucellus === npc && stage(killer) === S.SUCELLUS) {
      owned.sucellus = null;
      killer.setAttribute(ATTR, null);
      killer.setAttribute(SUCELLUS_DEFEATED, true);
      if (!has(killer, I.ODD_KEY)) {
        const location = npc.getLocation?.() ?? npc.getSpawnLocation?.();
        const groundItems = api.getItemOnGroundManager?.();
        if (location && groundItems?.registerLocation) groundItems.registerLocation(killer, new Item(I.ODD_KEY, 1), location.clone?.() ?? location);
        else killer.getInventory().adds(I.ODD_KEY, 1);
      }
      killer.sendMessage("Duke Sucellus falls. Pick up the odd key and use it on the western door.");
      return;
    }
    if (Array.isArray(owned.scarTreeEnemies) && owned.scarTreeEnemies.includes(npc)) {
      npc.__dt2ScarTreeEnemy = false;
      owned.scarTreeEnemies = owned.scarTreeEnemies.filter((enemy) => enemy !== npc);
      if (owned.scarTreeEnemies.some((enemy) => enemy?.isRegistered?.() && enemy.getHitpoints?.() > 0)) return;
      const area = killer.getAttribute(ATTR_SCAR_MAZE_THREE);
      const wave = Number(killer.getAttribute("desert-treasure-ii:scar-tree-wave")) || 0;
      if (wave >= 4) {
        killer.setAttribute(SCAR_TREE_COMPLETE, true);
        killer.getPacketSender().sendVarbit(15260, 1);
        killer.sendMessage("The Brain Pillar finishes healing. The Unlit Veins can now be reached.");
      } else if (area instanceof ScarMazeThreeArea && !area.isDestroyed()) {
        spawnScarTreeWave(killer, area);
        killer.sendMessage(`The antibodies hold. Another wave enters the chamber (${wave + 1} of 4).`);
      }
      return;
    }
    if (Array.isArray(owned.scarMazeThreeBloodCells) && owned.scarMazeThreeBloodCells.includes(npc)) {
      owned.scarMazeThreeBloodCells = owned.scarMazeThreeBloodCells.filter((entry) => entry !== npc);
      const type = npc.__dt2ScarBloodCell;
      if (type === "crimson") {
        const count = Math.min(3, (Number(killer.getAttribute(SCAR_BLOOD_RED_COUNT)) || 0) + 1);
        killer.setAttribute(SCAR_BLOOD_RED_COUNT, count);
        killer.getPacketSender().sendVarbit(15219, count);
        killer.getInventory().adds(I.CRIMSON_FIBRE, 1);
        killer.sendMessage("The crimson sanguisphera leaves a crimson fibre.");
      } else if (type === "radiant") {
        const count = Math.min(3, (Number(killer.getAttribute(SCAR_BLOOD_WHITE_COUNT)) || 0) + 1);
        killer.setAttribute(SCAR_BLOOD_WHITE_COUNT, count);
        killer.getPacketSender().sendVarbit(15218, count);
        killer.getInventory().adds(I.RADIANT_FIBRE, 1);
        killer.sendMessage("The radiant sanguisphera leaves a radiant fibre.");
      }
      return;
    }
    if (Array.isArray(owned.scarMazeThreeLightLeeches) && owned.scarMazeThreeLightLeeches.includes(npc)) {
      owned.scarMazeThreeLightLeeches = owned.scarMazeThreeLightLeeches.filter((entry) => entry !== npc);
      return;
    }
    if (Array.isArray(owned.scarSummonImps) && owned.scarSummonImps.includes(npc)) {
      owned.scarSummonImps = owned.scarSummonImps.filter((imp) => imp !== npc);
      killer.setAttribute(SCAR_SUMMON_IMPS, owned.scarSummonImps.filter((imp) => imp?.isRegistered?.() && imp.getHitpoints?.() > 0).length);
      if (killer.getAttribute(SCAR_SUMMON_IMPS) === 0) killer.sendMessage("The Scarred imps' prayers fade. The lesser demons can now be hurt.");
      return;
    }
    if (Array.isArray(owned.scarSummonDemons) && owned.scarSummonDemons.includes(npc)) {
      owned.scarSummonDemons = owned.scarSummonDemons.filter((demon) => demon !== npc);
      const left = owned.scarSummonDemons.filter((demon) => demon?.isRegistered?.() && demon.getHitpoints?.() > 0).length;
      killer.setAttribute(SCAR_SUMMON_DEMONS, left);
      if (left === 0 && stage(killer) === S.LEVIATHAN) {
        killer.setAttribute(SCAR_SUMMON_ROOM_COMPLETE, true);
        killer.getPacketSender().sendVarbit(15260, 1);
        killer.sendMessage("The summoning circle is quiet. The shipwreck passage is now accessible.");
      }
      return;
    }
    if (Array.isArray(owned.scarEnemies) && owned.scarEnemies.includes(npc) && stage(killer) === S.LEVIATHAN) {
      owned.scarEnemies = owned.scarEnemies.filter((enemy) => enemy !== npc);
      if (owned.scarEnemies.length === 0) {
        killer.setAttribute(SCAR_DEMONS_DEFEATED, true);
        setScarVarbit(killer, 8);
        killer.sendMessage("The Scarred demons are defeated. The stepping stones to the rowboat are now safe to cross.");
      }
      return;
    }
    if (owned.kasondeBoss === npc && stage(killer) === S.VARDORVIS) {
      owned.kasondeBoss = null;
      killer.setAttribute(VARDORVIS_PROGRESS, 20);
      const area = killer.getAttribute(ATTR_STRANGLEWOOD_TEMPLE);
      if (area instanceof StranglewoodTempleArea && !area.isDestroyed()) {
        const injured = api.core.NPC.create(N.KASONDE_9, area.tile(7, 16, 0));
        injured.setOwner?.(killer);
        injured.setOwnerOnly?.(true);
        injured.__skipDefaultRespawn = true;
        area.add(injured);
        api.core.World.getAddNPCQueue().push(injured);
        owned.kasondeInjured = injured;
      }
      return;
    }
    if (owned.vardorvis === npc && stage(killer) === S.VARDORVIS) {
      owned.vardorvis = null;
      owned.vardorvisDead = true;
      killer.setAttribute(VARDORVIS_PROGRESS, 17);
      killer.setAttribute(ATTR, null);
      killer.sendMessage("Vardorvis collapses. Search the rocks at the ritual site's entrance for the Temple key.");
      return;
    }
    if (Array.isArray(owned.templeEnemies) && owned.templeEnemies.includes(npc)) {
      owned.templeEnemies = owned.templeEnemies.filter((enemy) => enemy !== npc);
      if (owned.templeEnemies.length === 0 && stage(killer) === S.VARDORVIS) {
        killer.setAttribute(VARDORVIS_PROGRESS, 13);
        const area = killer.getAttribute(ATTR_STRANGLEWOOD_TEMPLE);
        if (area instanceof StranglewoodTempleArea && !area.isDestroyed()) {
          const kasonde = api.core.NPC.create(N.KASONDE, area.tile(7, 16, 0));
          kasonde.setOwner?.(killer);
          kasonde.setOwnerOnly?.(true);
          kasonde.__skipDefaultRespawn = true;
          area.add(kasonde);
          api.core.World.getAddNPCQueue().push(kasonde);
          owned.templeKasonde = kasonde;
        }
        killer.sendMessage("The Strangled stop attacking. Kasonde is safe; speak to him in the temple.");
      }
      return;
    }
    const entries = [["guardian", S.GUARDIAN], ["vardorvis", S.VARDORVIS], ["leviathan", S.LEVIATHAN], ["sucellus", S.SUCELLUS], ["whisperer", S.WHISPERER]];
    const key = entries.find(([name]) => owned[name] === npc)?.[0];
    if (!key) return;
    const idx = { vardorvis: 0, leviathan: 1, sucellus: 2, whisperer: 3 }[key];
    if (idx === undefined) {
      setStage(killer, S.MACHINE);
      const area = killer.getAttribute(ATTR_WAR_ROOM);
      if (area instanceof WarRoomArea && !area.isDestroyed()) {
        spawnTotems(killer, area);
        let banikan = api.core.NPC.create(N.DR_BANIKAN_2, area.tile(23, 7, 0));
        banikan.setOwner?.(killer);
        banikan.setOwnerOnly?.(true);
        banikan.__skipDefaultRespawn = true;
        area.add(banikan);
        api.core.World.getAddNPCQueue().push(banikan);
        owned.banikan = banikan;
      }
      owned.guardian = null;
      killer.setAttribute(ATTR, null);
      return;
    }
    if (!has(killer, IDS[idx])) killer.getInventory().adds(IDS[idx], 1);
    owned[key] = null;
    killer.sendMessage("The medallion has fallen. Take it back to the Ancient Vault and place it on its statue.");
  }
  function progressBosses({ player: p, npcId }) {
    const s = stage(p);
    if (s === S.VARDORVIS) { talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa"); spawnBoss(p, "vardorvis"); return; }
    if (s === S.LEVIATHAN) return handleBossTalk({ player: p, npcId });
    if (s === S.SUCELLUS) return talk(p, npcId, "duke-sucellus-of-the-sixth-legion-talking-to-captain-malleta");
    if (s === S.WHISPERER) return talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to");
  }

  function handleDialogueAction({ player: p, stepId }) {
    if (stepId === "EDEdng" && stage(p) === S.MACHINE && p.getAttribute(CELLS_INSERTED)) openGolemPuzzle(p);
    if (stepId === "4b6oDl" && stage(p) === S.LEVIATHAN && p.getAttribute(SCAR_BOAT_TRIED)) {
      const area = p.getAttribute(ATTR_SCAR_AREA);
      if (area instanceof ScarArea && !area.isDestroyed()) p.moveTo(area.tile(51, 43, 0));
    }
  }

  quest = registerQuest(api, {
    key: "desert_treasure_ii", name: "Desert Treasure II - The Fallen Empire", varpId: 3786, varbitId: 14862,
    startedValue: S.STARTED, completionValue: S.COMPLETE, questPoints: 5,
    xpRewards: [{ skillId: Skill.AGILITY.getIndex(), amount: 50000, label: "Agility" }, { skillId: Skill.HERBLORE.getIndex(), amount: 50000, label: "Herblore" }, { skillId: Skill.THIEVING.getIndex(), amount: 50000, label: "Thieving" }, { skillId: Skill.THIEVING.getIndex(), amount: 100000, label: "Chosen skill" }],
    rewardItemId: I.ANCIENT_LAMP, otherRewards: ["Access to Vardorvis, the Leviathan, Duke Sucellus and the Whisperer"], buildJournal,
  });
  ["desert-treasure-ii:statues", "desert-treasure-ii:cells-collected", CELLS_INSERTED, CELL_POSITIONS,
    GOLEM_SOLVED, SEARCHED_NAMES, BANIKAN_LEFT].forEach((key) => api.persistAttribute(key));
  api.persistAttribute(ATTR);
  api.persistAttribute(VARDORVIS_PROGRESS);
  api.persistAttribute(ATTR_SMITH_INTRO);
  api.persistAttribute(STATUES_PLACED);
  [SUCELLUS_MUSHROOMS, SUCELLUS_VATS, SUCELLUS_POISONS, SUCELLUS_DEFEATED, SUCELLUS_WEST_ROOM,
    SUCELLUS_CELL_PROGRESS, SUCELLUS_CELL_ENTERED, SUCELLUS_CELL_ESCAPED, SUCELLUS_ASSASSIN_GONE].forEach((key) => api.persistAttribute(key));
  [SCAR_DEMONS_DEFEATED, SCAR_BOAT_TRIED, SCAR_PERSTEN_TALKED, SCAR_PERSTEN_TALKED_BEFORE,
    SCAR_PERSTEN_ROOM1_TALKED, SCAR_BOAT_ROOM, SCAR_TINDERBOX_FOUND, SCAR_SLIMY_KEY_FOUND,
    SCAR_GUNPOWDER_FOUND, SCAR_OLD_TABLET_READ, SCAR_BOAT_CHEST_OPEN, SCAR_BOAT_BURNED,
    SCAR_PERSTEN_ROOM2_TALKED, SCAR_BOAT2_BURNED, SCAR_MAZE_TWO_ENTERED, SCAR_AXON_ROOM_COMPLETE,
    SCAR_NERVE_ROOM_TWO_COMPLETE, SCAR_NERVE_ROOM_TWO_REPAIRED, SCAR_SUMMON_ROOM_COMPLETE,
    "desert-treasure-ii:scar-boat-room-two-chest-open", "desert-treasure-ii:scar-growth-complete",
    SCAR_MAZE_THREE_ACTIVE, SCAR_MEMORY_ORDER, SCAR_MEMORY_STEP, SCAR_MEMORY_COMPLETE,
    SCAR_TREE_COMPLETE, SCAR_LEECH_GROWTHS_REPAIRED, SCAR_BLOOD_RED_COUNT, SCAR_BLOOD_WHITE_COUNT,
    SCAR_BLOOD_RED_REPAIRED, SCAR_BLOOD_WHITE_REPAIRED, SCAR_LEECH_COMPLETE, SCAR_BOAT3_BURNED,
    SCAR_BOAT3_ROOM, SCAR_PERSTEN_ROOM3_TALKED, SCAR_LEVIATHAN_READY, SCAR_LEVIATHAN_KILLED,
    SCAR_PERSTEN_AT_SHIP, SCAR_PERSTEN_LEFT_SHIP, SCAR_LEVIATHAN_DEBRIS_SEARCHED,
    "desert-treasure-ii:scar-boat3-chest-open", "desert-treasure-ii:scar-boat3-tablet-read"].forEach((key) => api.persistAttribute(key));
  [SCAR_GUARDIAN_ACCEPTED, SCAR_MAZE_ONE_ENTERED, SCAR_TETHER_DESTROYED, SCAR_PATH_COMPLETE].forEach((key) => api.persistAttribute(key));
  api.persistAttribute(SCAR_CATALYST_PROGRESS);
  api.persistAttribute(SCAR_CATALYST_ORDER);
  api.persistAttribute(SCAR_GROWTH_LURES);
  api.persistAttribute(SCAR_GROWTH_STEP);
  api.persistAttribute(SCAR_GROWTH_ORDER);
  api.persistAttribute("desert-treasure-ii:scar-growth-repaired");
  [GOLEM_INSPECTED, ALTAR_INSPECTED, TOTEMS_CHARGED].forEach((key) => api.persistAttribute(key));
  api.onObjectInteraction((event) => {
    const handled = handleObject(event);
    if (handled === true) event.handled = true;
    return handled;
  });
  api.onObjectRoute(handleScarStoneRoute);
  api.onItemOnObject(handleItemOnObject, { noted: false });
  api.onItemOnItem(handleItemOnItem, { noted: false });
  api.onItemAction(handleItemAction);
  api.onCustomEvent("player:widget-action", onWidgetAction);
  api.onCustomEvent("npc-dialogue:action", handleDialogueAction);
  api.onCustomEvent("npc-dialogue:line", handleDialogueLine);
  api.onCustomEvent("magic:hit-effects", activateTotem);
  api.onCustomEvent("magic:hit-effects", stunLeviathan);
  api.onCombatHitRoll(forceTotemAccuracy);
  api.onNpcHitModify(preventTotemDamage);
  api.onNpcHitModify(handleScarAxonHit);
  api.onNpcHitModify(preventScarSummonProtection);
  api.onNpcInteraction("Asgarnia Smith", { "Talk-to": talkSmith });
  api.onNpcInteraction("Cerebral pathfinder", { Move: pushScarPathRunner });
  api.onNpcInteraction("Cerebral pathbreaker", { Move: pushScarPathRunner });
  api.onNpcRoute(routeToScarPathRunner);
  api.onNpcInteraction("Terry Balando", { "Talk-to": talkTerry });
  api.onNpcInteraction("Dr Banikan", { "Talk-to": talkBanikan });
  api.onNpcInteraction("Elissa", { "Talk-to": talkElissa });
  api.onNpcInteraction("Barus", { "Talk-to": talkBarus });
  api.onNpcInteraction("Kasonde", { "Talk-to": talkKasonde });
  api.onNpcInteraction("Wizard Persten", { "Talk-to": progressBosses });
  api.onNpcInteraction("Captain Malleta", { "Talk-to": progressBosses });
  api.onNpcInteraction("Ketla", { "Talk-to": progressBosses });
  api.onNpcInteraction("Catalytic Guardian", { "Talk-to": talkCatalyticGuardian });
  api.onNpcInteraction("Catalyst", { Observe: inspectScarCatalyst });
  api.onNpcInteraction("Light leech", { "Take-lure": takeScarLightLure });
  api.onNpcInteraction("Vardorvis", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Leviathan", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("Duke Sucellus", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Whisperer", { "Talk-to": handleBossTalk });
  api.onNpcDeath(handleDeath);
  api.onItemOnNpc(handleNerveOnCatalyst);
  api.onItemOnNpc(handleSucellusItemOnNpc);
  api.onGroundItemPickup(handleSucellusGroundItemPickup);
  api.onPlayerLogin(handleLogin);
  api.onPlayerLogout(handleLogout);
  api.onPlayerDisconnect(handleLogout);
};
