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
  const CELLS_PLACED = "desert-treasure-ii:charged-cells-placed";
  const ATTR = "desert-treasure-ii:boss";
  const ATTR_WAR_ROOM = "desert-treasure-ii:war-room";
  let quest;
  let spawned = new WeakMap();
  let WarRoomArea;

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
    if (stage(p) === S.STARTED && (Number(p.getAttribute("desert-treasure-ii:statues")) & 15) !== 15) {
      return p.sendMessage("Inspect all four statues and the plaque before speaking to Asgarnia Smith.");
    }
    if (stage(p) === S.MACHINE) {
      if ((Number(p.getAttribute(CELLS_PLACED)) || 0) < 8) return p.sendMessage("The golem is waiting for eight charged cells to be placed in its sockets.");
      return talkAsgarniaForBoss({ player: p, npcId });
    }
    const variant = stage(p) < S.VAULT ? "familiar-faces-talking-to-asgarnia-smith"
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
    talk(p, npcId, "familiar-faces-speaking-to-dr-banikan-again-after-he-decides-search-the-golem");
  }
  function talkAsgarniaForBoss({ player: p, npcId }) {
    const s = stage(p);
    if (s === S.MACHINE) { talk(p, npcId, "familiar-faces-operating-the-golem-to-find-out-what-dr-banikan-searched", S.VARDORVIS); spawnBoss(p, "vardorvis"); return; }
    if (s >= S.VARDORVIS && s < S.COMPLETE) talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-asgarnia-smith");
  }
  function handleObject({ player: p, objectId, location }) {
    const s = stage(p);
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
      p.sendMessage("You investigate the Ancient Vault. Asgarnia Smith follows you inside and asks what you have found.");
      quest.setStage(p, S.STARTED); return true;
    }
    if (s >= S.STARTED && s < S.VAULT && (STATUES.has(objectId) || objectId === O.PLAQUE_35)) {
      const bits = Number(p.getAttribute("desert-treasure-ii:statues")) || 0;
      const index = STATUES.get(objectId);
      const next = index === undefined ? bits | 16 : bits | (1 << index);
      p.setAttribute("desert-treasure-ii:statues", next);
      if (next === 31) p.sendMessage("The plaque identifies the four generals: Vardorvis, Perseriya, Sucellus and the Whisperer.");
      else if (index !== undefined) p.sendMessage(["The statue depicts Vardorvis.", "The statue depicts the Whisperer.", "The statue depicts Sucellus.", "The statue depicts Perseriya."][index]);
      else p.sendMessage("You inspect the plaque. It describes the fallen empire and its four generals.");
      return true;
    }
    if (s >= S.ROCKS && s < S.GUARDIAN && [O.ROCKS, O.ROCKS_2, O.ROCKS_3, O.ROCKSLIDE].includes(objectId)) {
      if (!has(p, I.BRONZE_PICKAXE) && !has(p, I.IRON_PICKAXE)) return p.sendMessage("You need a pickaxe to clear the rocks.");
      p.sendMessage("You mine away the rocks and uncover a passage into the installation.");
      setStage(p, S.GUARDIAN);
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
      if (p.getAttribute("desert-treasure-ii:cells-collected")) return p.sendMessage("The crate is empty.");
      p.setAttribute("desert-treasure-ii:cells-collected", true);
      p.getInventory().adds(I.UNCHARGED_CELL_2, 8);
      p.sendMessage("You search the crate and take eight uncharged cells.");
      return true;
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && [O.ALTAR_93, O.ALTAR_94].includes(objectId)
      && roomTile?.x === 2773 && roomTile?.y === 6442) {
      return p.sendMessage("Use each uncharged cell on the altar to charge it.");
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && [O.GOLEM, O.GOLEM_2].includes(objectId)
      && roomTile?.x === 2783 && roomTile?.y === 6444) {
      return (Number(p.getAttribute(CELLS_PLACED)) || 0) < 8
        ? p.sendMessage("Use a charged cell on an empty socket in the golem.")
        : p.sendMessage("The golem's eye is glowing. Speak to Asgarnia Smith.");
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
    if ([O.ALTAR_93, O.ALTAR_94].includes(objectId) && roomTile?.x === 2773 && roomTile?.y === 6442 && itemId === I.UNCHARGED_CELL_2) {
      if (!has(p, I.UNCHARGED_CELL_2)) return;
      p.getInventory().deleteNumber(I.UNCHARGED_CELL_2, 1);
      p.getInventory().adds(I.CHARGED_CELL, 1);
      p.sendMessage("The altar charges the cell.");
      return;
    }
    if ([O.GOLEM, O.GOLEM_2].includes(objectId) && roomTile?.x === 2783 && roomTile?.y === 6444 && itemId === I.CHARGED_CELL) {
      if (!has(p, I.CHARGED_CELL)) return;
      const placed = Number(p.getAttribute(CELLS_PLACED)) || 0;
      if (placed >= 8) return p.sendMessage("All eight sockets are already filled.");
      p.getInventory().deleteNumber(I.CHARGED_CELL, 1);
      p.setAttribute(CELLS_PLACED, placed + 1);
      p.sendMessage(`You place a charged cell in the machine (${placed + 1}/8).`);
      if (placed === 7) p.sendMessage("All eight cells are in place. Speak to Asgarnia Smith to operate the golem.");
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
    const entries = [["guardian", S.GUARDIAN], ["vardorvis", S.VARDORVIS], ["leviathan", S.LEVIATHAN], ["sucellus", S.SUCELLUS], ["whisperer", S.WHISPERER]];
    const key = entries.find(([name]) => owned[name] === npc)?.[0];
    if (!key) return;
    const idx = { vardorvis: 0, leviathan: 1, sucellus: 2, whisperer: 3 }[key];
    if (idx === undefined) {
      setStage(killer, S.MACHINE);
      const area = killer.getAttribute(ATTR_WAR_ROOM);
      if (area instanceof WarRoomArea && !area.isDestroyed()) {
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
    if (s === S.MACHINE) { talk(p, npcId, "familiar-faces-powering-up-the-golem-machine", S.VARDORVIS); spawnBoss(p, "vardorvis"); return; }
    if (s === S.VARDORVIS) return talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa");
    if (s === S.LEVIATHAN) return talk(p, npcId, "praefectus-classis-perseriya-talking-to-wizard-persten");
    if (s === S.SUCELLUS) return talk(p, npcId, "duke-sucellus-of-the-sixth-legion-talking-to-captain-malleta");
    if (s === S.WHISPERER) return talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to");
  }

  quest = registerQuest(api, {
    key: "desert_treasure_ii", name: "Desert Treasure II - The Fallen Empire", varpId: 3786, varbitId: 14862,
    startedValue: S.STARTED, completionValue: S.COMPLETE, questPoints: 5,
    xpRewards: [{ skillId: Skill.AGILITY.getIndex(), amount: 50000, label: "Agility" }, { skillId: Skill.HERBLORE.getIndex(), amount: 50000, label: "Herblore" }, { skillId: Skill.THIEVING.getIndex(), amount: 50000, label: "Thieving" }, { skillId: Skill.THIEVING.getIndex(), amount: 100000, label: "Chosen skill" }],
    rewardItemId: I.ANCIENT_LAMP, otherRewards: ["Access to Vardorvis, the Leviathan, Duke Sucellus and the Whisperer"], buildJournal,
  });
  ["desert-treasure-ii:statues", "desert-treasure-ii:cells-collected", CELLS_PLACED].forEach((key) => api.persistAttribute(key));
  api.persistAttribute(ATTR);
  api.onObjectInteraction(handleObject);
  api.onItemOnObject(handleItemOnObject, { noted: false });
  api.onNpcInteraction("Asgarnia Smith", { "Talk-to": talkSmith });
  api.onNpcInteraction("Terry Balando", { "Talk-to": talkTerry });
  api.onNpcInteraction("Dr Banikan", { "Talk-to": talkBanikan });
  api.onNpcInteraction("Elissa", { "Talk-to": progressBosses });
  api.onNpcInteraction("Wizard Persten", { "Talk-to": progressBosses });
  api.onNpcInteraction("Captain Malleta", { "Talk-to": progressBosses });
  api.onNpcInteraction("Ketla", { "Talk-to": progressBosses });
  api.onNpcInteraction("Vardorvis", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Leviathan", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("Duke Sucellus", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Whisperer", { "Talk-to": handleBossTalk });
  api.onNpcDeath(handleDeath);
};
