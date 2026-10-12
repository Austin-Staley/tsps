/** Desert Treasure II - The Fallen Empire. */
module.exports = function registerDesertTreasureII(api) {
  const { Skill, ItemIdentifiers: I, NpcIdentifiers: N, ObjectIdentifiers: O } = api.core;
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
  const SCAR_PERSTEN_TALKED = "desert-treasure-ii:scar-persten-talked";
  const SCAR_PERSTEN_TALKED_BEFORE = "desert-treasure-ii:scar-persten-talked-before";
  const SCAR_PATH_COMPLETE = "desert-treasure-ii:scar-pathfinder-complete";
  const SCAR_TETHER_DESTROYED = "desert-treasure-ii:scar-tether-destroyed";
  const SCAR_VARBIT = 15128;
  const SCAR_TETHER_VARBIT = 15258;
  const SCAR_MAZE_ONE_ENTERED = "desert-treasure-ii:scar-maze-one-entered";
  const SCAR_GUARDIAN_ACCEPTED = "desert-treasure-ii:scar-guardian-accepted";
  const SCAR_PASSAGE_OPEN = 49205;
  const SCAR_RIFT_LIVE = "desert-treasure-ii:scar-rift-live-nerves";
  const SCAR_NERVES_BROKEN = "desert-treasure-ii:scar-nerves-broken";
  const SCAR_NERVE_LOCATIONS = [
    { object: 49182, item: I.EARTH_NERVE, tiles: [[2198, 6411], [2204, 6419]] },
    { object: 49183, item: I.AIR_NERVE, tiles: [[2195, 6418], [2206, 6416]] },
    { object: 49184, item: I.WATER_NERVE, tiles: [[2202, 6410], [2204, 6414]] },
    { object: 49185, item: I.FIRE_NERVE, tiles: [[2193, 6415], [2200, 6407]] },
    { object: 49186, item: I.MIND_NERVE, tiles: [[2194, 6410], [2205, 6408], [2205, 6411]] },
  ];
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
  const ASGARNIA_SMITH_VAULT_INITIAL = 12401;
  const TOTEMS = [
    { kind: "blood", inactive: 12343, active: 12344, x: 2775, y: 6445, spells: ["BLOOD_BURST", "BLOOD_BLITZ", "BLOOD_BARRAGE"] },
    { kind: "shadow", inactive: 12341, active: 12342, x: 2771, y: 6445, spells: ["SHADOW_BURST", "SHADOW_BLITZ", "SHADOW_BARRAGE"] },
    { kind: "smoke", inactive: 12339, active: 12340, x: 2771, y: 6439, spells: ["SMOKE_BURST", "SMOKE_BLITZ", "SMOKE_BARRAGE"] },
    { kind: "ice", inactive: 12345, active: 12346, x: 2775, y: 6439, spells: ["ICE_BURST", "ICE_BLITZ", "ICE_BARRAGE"] },
  ];
  const SCAR_PATHS = [
    { npc: N.CEREBRAL_PATHFINDER, points: [[2195, 6450], [2195, 6444], [2197, 6444]] },
    { npc: N.CEREBRAL_PATHBREAKER, points: [[2199, 6444], [2202, 6444], [2202, 6442]] },
    { npc: N.CEREBRAL_PATHBREAKER, points: [[2202, 6440], [2201, 6439], [2198, 6438]] },
    { npc: N.CEREBRAL_PATHBREAKER, points: [[2197, 6438], [2196, 6435]] },
    { npc: N.CEREBRAL_PATHBREAKER, points: [[2196, 6435], [2207, 6436]] },
    { npc: N.CEREBRAL_PATHBREAKER, points: [[2207, 6436], [2207, 6433], [2209, 6433]] },
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
      const movement = runner.getMovementQueue();
      movement.setBlockMovement?.(distance > 3);
      const points = SCAR_PATHS[this.pathIndex].points;
      const finish = this.tile(points.at(-1)[0] - 2160, points.at(-1)[1] - 6400, 0);
      const arrived = runnerLoc.getX() === finish.getX() && runnerLoc.getY() === finish.getY();
      if (!arrived || distance > 3) return;
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
      if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) spawnScarDemons(p, current);
      return current;
    }
    const area = new ScarArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_SCAR_AREA, area);
    setScarVarbit(p, 6);
    p.moveTo(area.tile(21, 33, 0));
    if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) spawnScarDemons(p, area);
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
    p.setAttribute(SCAR_PATH_COMPLETE, false);
    p.getPacketSender().sendVarbit(SCAR_TETHER_VARBIT, p.getAttribute(SCAR_TETHER_DESTROYED) ? 1 : 0);
    p.moveTo(area.tile(36, 54, 0));
    spawnScarPathRunner(p, area, 0);
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
    const movement = runner.getMovementQueue();
    for (const [x, y] of path.points.slice(1)) movement.addSteps(area.tile(x - 2160, y - 6400, 0));
    area.pathRunner = runner;
    owned.scarPathRunner = runner;
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
    if (stage(p) < S.LEVIATHAN) return;
    const value = p.getAttribute(SCAR_MAZE_ONE_ENTERED) ? 16
      : p.getAttribute(SCAR_PERSTEN_TALKED) ? 14
        : p.getAttribute(SCAR_BOAT_TRIED) ? 10
          : p.getAttribute(SCAR_DEMONS_DEFEATED) ? 8
            : p.getAttribute(SCAR_GUARDIAN_ACCEPTED) ? 6 : 2;
    setScarVarbit(p, value);
    p.getPacketSender().sendVarbit(SCAR_TETHER_VARBIT, p.getAttribute(SCAR_TETHER_DESTROYED) ? 1 : 0);
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

  function scarMazeSourceTile(p, location) {
    const area = p.getAttribute(ATTR_SCAR_MAZE_ONE);
    if (!(area instanceof ScarMazeOneArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 2160;
    const y = location.y - area.getBaseY() + 6400;
    return x >= 2160 && x < 2248 && y >= 6400 && y < 6472 ? { x, y } : null;
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
    for (const key of [ATTR_VAULT_AREA, ATTR_WAR_ROOM, ATTR_STRANGLEWOOD_HIDEOUT, ATTR_STRANGLEWOOD_TEMPLE, ATTR_VARDORVIS_AREA, ATTR_SCAR_AREA, ATTR_SCAR_MAZE_ONE]) {
      const area = p.getAttribute(key);
      if (area && !area.isDestroyed?.()) {
        area.leave?.(p, false);
        area.postLeave?.(p, false);
        area.destroy?.();
      }
      p.setAttribute(key, null);
    }
    p.setAttribute(SCAR_PATH_COMPLETE, false);
    spawned.delete(p);
  }

  function buildJournal(player) {
    const s = quest.getStage(player);
    if (s >= S.COMPLETE) return ["<str>I found the Elder Horn and stopped Sliske.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (s >= S.FINALE) return ["Return the four medallions to the Ancient Vault."];
    if (s >= S.WHISPERER) return ["Search the Lassar Undercity and defeat the Whisperer."];
    if (s >= S.SUCELLUS) return ["Investigate Ghorrock and defeat Duke Sucellus."];
    if (s >= S.LEVIATHAN) return ["Search the Scar and defeat the Leviathan."];
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
  function handleItemAction({ player: p, itemId, option }) {
    if (stage(p) !== S.VARDORVIS) return;
    const action = String(option || "").toLowerCase();
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
  function handleObject({ player: p, objectId, definition, location }) {
    const s = stage(p);
    const vaultTile = vaultSourceTile(p, location);
    const roomTile = warRoomSourceTile(p, location);
    const scarTile = scarSourceTile(p, location);
    const scarMazeTile = scarMazeSourceTile(p, location);
    const visibleId = definition?.id ?? objectId;
    if (s === S.LEVIATHAN && scarMazeTile && p.getAttribute(SCAR_TETHER_DESTROYED)) {
      if (objectId === 49415 && scarMazeTile.x === 2233 && scarMazeTile.y === 6461) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(31, 12, 0));
        p.sendMessage("The green neural teleporter carries you toward the catalyst chamber.");
        return true;
      }
      if (objectId === 49411 && scarMazeTile.x === 2190 && scarMazeTile.y === 6412) {
        p.setAttribute(SCAR_RIFT_LIVE, true);
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(39, 12, 0));
        p.sendMessage("You enter the catalyst chamber. Break the nerve endings and combine them to match its rune.");
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
      p.getPacketSender().sendVarbit(SCAR_TETHER_VARBIT, 1);
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
    if (s === S.LEVIATHAN && objectId === O.ROWBOAT_19 && scarTile?.x === 2065 && scarTile.y === 6435) {
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
  function handleItemOnObject({ player: p, itemId, objectId, location }) {
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
      sucellus: [N.DUKE_SUCELLUS_7, 3036, 6452],
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
    if (!npcs[key]) npcs[key] = api.spawnNpc({ id, x, y, z: 0, owner: p, ownerOnly: true });
    return npcs[key];
  }
  function handleBossTalk({ player: p, npcId, npc }) {
    const s = stage(p);
    if (s === S.VARDORVIS) { talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa"); return; }
    if (s === S.LEVIATHAN) {
      if (!p.getAttribute(SCAR_BOAT_TRIED)) return;
      p.setAttribute(SCAR_PERSTEN_TALKED, true);
      setScarVarbit(p, 14);
      talk(p, npcId, p.getAttribute(SCAR_PERSTEN_TALKED_BEFORE)
        ? "praefectus-classis-perseriya-talking-to-wizard-persten-talking-to-wizard-persten-again"
        : "praefectus-classis-perseriya-talking-to-wizard-persten");
      p.setAttribute(SCAR_PERSTEN_TALKED_BEFORE, true);
      return;
    }
    if (s === S.SUCELLUS) { talk(p, npcId, "duke-sucellus-of-the-sixth-legion-talking-to-captain-malleta"); return; }
    if (s === S.WHISPERER) { talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to"); }
  }
  function handleDeath({ killer, npc }) {
    if (!killer) return;
    const owned = spawned.get(killer);
    if (!owned) return;
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
  [SCAR_DEMONS_DEFEATED, SCAR_BOAT_TRIED, SCAR_PERSTEN_TALKED, SCAR_PERSTEN_TALKED_BEFORE].forEach((key) => api.persistAttribute(key));
  [SCAR_GUARDIAN_ACCEPTED, SCAR_MAZE_ONE_ENTERED, SCAR_TETHER_DESTROYED].forEach((key) => api.persistAttribute(key));
  [GOLEM_INSPECTED, ALTAR_INSPECTED, TOTEMS_CHARGED].forEach((key) => api.persistAttribute(key));
  [SCAR_DEMONS_DEFEATED, SCAR_BOAT_TRIED, SCAR_PERSTEN_TALKED, SCAR_PERSTEN_TALKED_BEFORE].forEach((key) => api.persistAttribute(key));
  api.onObjectInteraction(handleObject);
  api.onItemOnObject(handleItemOnObject, { noted: false });
  api.onItemOnItem(handleItemOnItem, { noted: false });
  api.onItemAction(handleItemAction);
  api.onCustomEvent("player:widget-action", onWidgetAction);
  api.onCustomEvent("npc-dialogue:action", handleDialogueAction);
  api.onCustomEvent("npc-dialogue:line", handleDialogueLine);
  api.onCustomEvent("magic:hit-effects", activateTotem);
  api.onCombatHitRoll(forceTotemAccuracy);
  api.onNpcHitModify(preventTotemDamage);
  api.onNpcInteraction("Asgarnia Smith", { "Talk-to": talkSmith });
  api.onNpcInteraction("Terry Balando", { "Talk-to": talkTerry });
  api.onNpcInteraction("Dr Banikan", { "Talk-to": talkBanikan });
  api.onNpcInteraction("Elissa", { "Talk-to": talkElissa });
  api.onNpcInteraction("Barus", { "Talk-to": talkBarus });
  api.onNpcInteraction("Kasonde", { "Talk-to": talkKasonde });
  api.onNpcInteraction("Wizard Persten", { "Talk-to": progressBosses });
  api.onNpcInteraction("Captain Malleta", { "Talk-to": progressBosses });
  api.onNpcInteraction("Ketla", { "Talk-to": progressBosses });
  api.onNpcInteraction("Catalytic Guardian", { "Talk-to": talkCatalyticGuardian });
  api.onNpcInteraction("Vardorvis", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Leviathan", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("Duke Sucellus", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Whisperer", { "Talk-to": handleBossTalk });
  api.onNpcDeath(handleDeath);
  api.onPlayerLogin(handleLogin);
  api.onPlayerLogout(handleLogout);
  api.onPlayerDisconnect(handleLogout);
};
