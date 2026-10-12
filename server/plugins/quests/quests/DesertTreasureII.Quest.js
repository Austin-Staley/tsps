/** Desert Treasure II - The Fallen Empire. */
module.exports = function registerDesertTreasureII(api) {
  const { Skill, ItemIdentifiers: I, NpcIdentifiers: N, ObjectIdentifiers: O } = api.core;
  const { registerQuest, startTranscript } = require("../QuestRuntime");
  const PAGE = "Desert Treasure II - The Fallen Empire";
  const S = { STARTED: 1, VAULT: 2, DIG: 3, ROCKS: 4, GUARDIAN: 5, MACHINE: 6, VARDORVIS: 7, LEVIATHAN: 8, SUCELLUS: 9, WHISPERER: 10, FINALE: 11, COMPLETE: 12 };
  const IDS = [I.VARDORVIS_MEDALLION, I.PERSERIYAS_MEDALLION, I.SUCELLUS_MEDALLION, I.WHISPERERS_MEDALLION];
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
  const ASGARNIA_SMITH_VAULT_INITIAL = 12401;
  const TOTEMS = [
    { kind: "blood", inactive: 12343, active: 12344, x: 2775, y: 6445, spells: ["BLOOD_BURST", "BLOOD_BLITZ", "BLOOD_BARRAGE"] },
    { kind: "shadow", inactive: 12341, active: 12342, x: 2771, y: 6445, spells: ["SHADOW_BURST", "SHADOW_BLITZ", "SHADOW_BARRAGE"] },
    { kind: "smoke", inactive: 12339, active: 12340, x: 2771, y: 6439, spells: ["SMOKE_BURST", "SMOKE_BLITZ", "SMOKE_BARRAGE"] },
    { kind: "ice", inactive: 12345, active: 12346, x: 2775, y: 6439, spells: ["ICE_BURST", "ICE_BLITZ", "ICE_BARRAGE"] },
  ];
  let quest;
  let spawned = new WeakMap();
  let WarRoomArea;
  let AncientVaultArea;
  let StranglewoodHideoutArea;
  let StranglewoodTempleArea;
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
      return current;
    }
    const area = new StranglewoodTempleArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_STRANGLEWOOD_TEMPLE, area);
    p.moveTo(area.tile(6, 16, 0));
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
  function handleItemOnItem({ player: p, itemId1, itemId2 }) {
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
  function handleObject({ player: p, objectId, location }) {
    const s = stage(p);
    const vaultTile = vaultSourceTile(p, location);
    const roomTile = warRoomSourceTile(p, location);
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
    if (s >= S.STARTED && s < S.DIG && [O.VAULT_DOOR_2, O.VAULT_DOOR_3].includes(objectId)
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
      if ((Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) < 12
        || !has(p, I.KORBAL_HERB) || !has(p, I.ARGIAN_BERRIES)) {
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
    if (s >= S.FINALE && [O.VAULT_DOOR, O.VAULT_DOOR_2, O.VAULT_DOOR_3].includes(objectId) && IDS.every((id) => has(p, id))) {
      IDS.forEach((id) => p.getInventory().deleteNumber(id, 1));
      setStage(p, S.COMPLETE);
      quest.complete(p);
      return true;
    }
    return false;
  }
  function handleItemOnObject({ player: p, itemId, objectId, location }) {
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
      vardorvis: [N.VARDORVIS_3, 1128, 3417],
      leviathan: [N.THE_LEVIATHAN_3, 2078, 6368],
      sucellus: [N.DUKE_SUCELLUS_7, 3036, 6452],
      whisperer: [N.THE_WHISPERER_3, 2399, 6369],
    };
    const [id, x, y] = table[key];
    let npcs = spawned.get(p);
    if (!npcs) spawned.set(p, npcs = {});
    if (!npcs[key]) npcs[key] = api.spawnNpc({ id, x, y, z: 0, owner: p, ownerOnly: true });
  }
  function handleBossTalk({ player: p, npcId, npc }) {
    const s = stage(p);
    if (s === S.VARDORVIS) { talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa"); return; }
    if (s === S.LEVIATHAN) { talk(p, npcId, "praefectus-classis-perseriya-talking-to-wizard-persten"); return; }
    if (s === S.SUCELLUS) { talk(p, npcId, "duke-sucellus-of-the-sixth-legion-talking-to-captain-malleta"); return; }
    if (s === S.WHISPERER) { talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to"); }
  }
  function handleDeath({ killer, npc }) {
    if (!killer) return;
    const owned = spawned.get(killer);
    if (!owned) return;
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
    const next = [S.LEVIATHAN, S.SUCELLUS, S.WHISPERER, S.FINALE][idx];
    setStage(killer, next);
    owned[key] = null;
    if (next === S.LEVIATHAN) spawnBoss(killer, "leviathan");
    if (next === S.SUCELLUS) spawnBoss(killer, "sucellus");
    if (next === S.WHISPERER) spawnBoss(killer, "whisperer");
  }
  function progressBosses({ player: p, npcId }) {
    const s = stage(p);
    if (s === S.VARDORVIS) { talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa"); spawnBoss(p, "vardorvis"); return; }
    if (s === S.LEVIATHAN) return talk(p, npcId, "praefectus-classis-perseriya-talking-to-wizard-persten");
    if (s === S.SUCELLUS) return talk(p, npcId, "duke-sucellus-of-the-sixth-legion-talking-to-captain-malleta");
    if (s === S.WHISPERER) return talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to");
  }

  function handleDialogueAction({ player: p, stepId }) {
    if (stepId === "EDEdng" && stage(p) === S.MACHINE && p.getAttribute(CELLS_INSERTED)) openGolemPuzzle(p);
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
  [GOLEM_INSPECTED, ALTAR_INSPECTED, TOTEMS_CHARGED].forEach((key) => api.persistAttribute(key));
  api.onObjectInteraction(handleObject);
  api.onItemOnObject(handleItemOnObject, { noted: false });
  api.onItemOnItem(handleItemOnItem, { noted: false });
  api.onItemAction(handleItemAction);
  api.onCustomEvent("player:widget-action", onWidgetAction);
  api.onCustomEvent("npc-dialogue:action", handleDialogueAction);
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
  api.onNpcInteraction("Vardorvis", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Leviathan", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("Duke Sucellus", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Whisperer", { "Talk-to": handleBossTalk });
  api.onNpcDeath(handleDeath);
};
