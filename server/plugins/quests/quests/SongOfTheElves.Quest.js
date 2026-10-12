/**
 * Song of the Elves (members, Elf series #8). The Wiki transcript is the source
 * for dialogue and cutscene ids; quest state mirrors the cache's sote varbit.
 */
module.exports = function registerSongOfTheElves(api) {
  const { Area, Boundary, Equipment, GameObject, HitDamage, HitMask, ItemIdentifiers, Location, NpcIdentifiers, ObjectIdentifiers, ObjectManager, PrivateArea, Skill, World } = api.core;
  const { registerQuest, loadTranscripts, startTranscript } = require("../QuestRuntime");
  const PAGE = "Song of the Elves";
  const START_HOOK = "quest:song-of-the-elves:start";
  const CHEMICAL_CHOICE = "quest.song_of_the_elves.chemical-choice";
  const FALLS_PILLARS = "quest.song_of_the_elves.falls-pillars";
  const FALLS_ORDER = "quest.song_of_the_elves.falls-order";
  const INCITEMENTS = "quest.song_of_the_elves.incitements";
  const RESISTANCE_MEMBERS = "quest.song_of_the_elves.resistance-members";
  const RESISTANCE_BRIEFING = "quest.song_of_the_elves.resistance-briefing";
  const WEST_BATTLE_KILLS = "quest.song_of_the_elves.west-battle-kills";
  const EAST_BATTLE_KILLS = "quest.song_of_the_elves.east-battle-kills";
  const BATTLE_AREA = "quest.song_of_the_elves.battle-area";
  const LATE_CHAPTER = "quest.song_of_the_elves.late-chapter";
  const VALLEY_FIGURE = "quest.song_of_the_elves.valley-figure";
  const LIBRARY_INSTANCE = "quest.song_of_the_elves.library-instance";
  const LIBRARY_SEALS = "quest.song_of_the_elves.library-seals";
  const LIBRARY_PUZZLE = "quest.song_of_the_elves.library-puzzle";
  const LIBRARY_MIRRORS = "quest.song_of_the_elves.library-mirrors";
  const LIBRARY_CRYSTALS = "quest.song_of_the_elves.library-crystals";
  const LIBRARY_PILLAR_STATE = "quest.song_of_the_elves.library-pillar-state";
  const RECRUITED_ELDERS = "quest.song_of_the_elves.recruited-elders";
  const REVELATIONS_MEETING_STARTED = "quest.song_of_the_elves.revelations-meeting-started";
  const MEILYR_CLUE = "quest.song_of_the_elves.meilyr-clue";
  const LLETYA_GUIDE_SPAWNED = "quest.song_of_the_elves.lletya-guide-spawned";
  const LLETYA_ARIANWYN_NPC = "quest.song_of_the_elves.lletya-arianwyn-npc";
  const FRAGMENT_DEFEATED = "quest.song_of_the_elves.fragment-defeated";
  const CAMP_AREA = "quest.song_of_the_elves.camp-area";
  const CAMP_HOLES = "quest.song_of_the_elves.camp-holes";
  const CAMP_EXPLOSIVES = "quest.song_of_the_elves.camp-explosives";
  const CAMP_DEFENSE = "quest.song_of_the_elves.camp-defense";
  const CAMP_DEFENSE_COMPLETE = "quest.song_of_the_elves.camp-defense-complete";
  const CAMP_BATTLE = "quest.song_of_the_elves.camp-battle";
  const CAMP_ARRIVAL_STARTED = "quest.song_of_the_elves.camp-arrival-started";
  const TEMPLE_CUTSCENE_STARTED = "quest.song_of_the_elves.temple-cutscene-started";
  const CAMP_HOLE_ID = 35887;
  const CAMP_CAVE_ID = ObjectIdentifiers.CAVE_STAIRS_2;
  const CAMP_HOLE_TILES = [[2439, 6126], [2444, 6129], [2450, 6127], [2452, 6122], [2456, 6119], [2459, 6114], [2457, 6109]];
  const CAMP_CENTER = new Location(2445, 6092, 0);
  const LIBRARY_SEAL_DATA = [
    { name: "ithell", id: ObjectIdentifiers.SEAL_OF_ITHELL, mapId: 36730, memory: NpcIdentifiers.MEMORY_OF_SEREN_2, tile: [2676, 6101, 1], tileRotation: 1, source: [2651, 6102, 1], sourceDirection: "south", steps: ["E", "N", "E", "N", "E", "S", "W", "S", "E", "N", "E", "N", "E"], targets: [[2651, 6098, 1], [2655, 6098, 1], [2655, 6106, 1], [2659, 6106, 1], [2659, 6110, 1], [2663, 6110, 1], [2663, 6098, 1], [2659, 6098, 1], [2659, 6094, 1], [2667, 6094, 1], [2667, 6098, 1], [2671, 6098, 1], [2671, 6102, 1]] },
    { name: "cadarn", id: ObjectIdentifiers.SEAL_OF_CADARN, mapId: 36725, memory: NpcIdentifiers.MEMORY_OF_SEREN_3, tile: [2622, 6097, 0], tileRotation: 2, source: [2609, 6130, 1], sourceDirection: "north", steps: ["E", "D", "S", "W", "S", "red", "E", "S"], targets: [[2609, 6158, 1], [2623, 6158, 1], [2623, 6158, 0], [2623, 6130, 0], [2609, 6130, 0], [2609, 6116, 0], [2609, 6102, 0], [2623, 6102, 0]] },
    { name: "crwys", id: ObjectIdentifiers.SEAL_OF_CRWYS, mapId: 36726, memory: NpcIdentifiers.MEMORY_OF_SEREN_4, tile: [2576, 6171, 1], tileRotation: 3, source: [2609, 6158, 1], sourceDirection: "south", steps: ["W", "N", "W", "fractured", "N", "green", "D", "E", "U", "cyan", "S", "D", "S"], targets: [[2609, 6144, 1], [2595, 6144, 1], [2595, 6158, 1], [2581, 6158, 1], [2567, 6158, 1], [2567, 6172, 1], [2567, 6200, 1], [2567, 6200, 0], [2581, 6200, 0], [2581, 6200, 1], [2581, 6200, 2], [2581, 6186, 2], [2581, 6186, 1]] },
    { name: "amlodd", id: ObjectIdentifiers.SEAL_OF_AMLODD, mapId: 36727, memory: NpcIdentifiers.MEMORY_OF_SEREN_5, tile: [2614, 6157, 0], tileRotation: 1, source: [2623, 6144, 1], sourceDirection: "west", steps: ["fractured", "N", "red", "E", "N", "W", "D", "S", "E", "D", "S", "W", "S", "W", "N", "green", "yellow", "E", "E", "S"], targets: [[2609, 6144, 1], [2595, 6144, 1], [2595, 6158, 1], [2595, 6172, 1], [2609, 6172, 1], [2609, 6186, 1], [2595, 6186, 1], [2595, 6186, 0], [2609, 6158, 1], [2623, 6158, 1], [2623, 6158, 0], [2623, 6130, 0], [2609, 6130, 0], [2609, 6116, 0], [2595, 6116, 0], [2595, 6130, 0], [2595, 6144, 0], [2595, 6158, 0], [2595, 6172, 0], [2609, 6172, 0]], branches: { 8: { fromStep: 0 }, 18: { fromStep: 7 } } },
    { name: "meilyr", id: ObjectIdentifiers.SEAL_OF_MEILYR, mapId: 36731, memory: NpcIdentifiers.MEMORY_OF_SEREN_6, tile: [2580, 6163, 2], tileRotation: 0, source: [2595, 6158, 1], sourceDirection: "east", steps: ["E", "D", "S", "W", "S", "W", "N", "W", "N", "U", "red", "N", "U", "N", "W", "N", "W", "S", "W"], targets: [[2609, 6158, 1], [2623, 6158, 1], [2623, 6158, 0], [2623, 6130, 0], [2609, 6130, 0], [2609, 6116, 0], [2595, 6116, 0], [2595, 6130, 0], [2581, 6130, 0], [2581, 6144, 0], [2581, 6144, 1], [2581, 6144, 2], [2637, 6144, 1], [2637, 6144, 2], [2637, 6158, 2], [2609, 6158, 2], [2609, 6172, 2], [2595, 6172, 2], [2595, 6158, 2]], branches: { 12: { source: [2637, 6130, 1], direction: "north" } } },
    { name: "hefin", id: ObjectIdentifiers.SEAL_OF_HEFIN, mapId: 36728, memory: NpcIdentifiers.MEMORY_OF_SEREN_7, tile: [2562, 6129, 2], tileRotation: 3, source: [2595, 6158, 1], sourceDirection: "east", steps: ["E", "D", "S", "W", "S", "W", "N", "W", "S", "W", "N", "D", "E", "U", "N", "W", "U", "N", "W", "S"], targets: [[2609, 6158, 1], [2623, 6158, 1], [2623, 6158, 0], [2623, 6130, 0], [2609, 6130, 0], [2609, 6116, 0], [2595, 6116, 0], [2595, 6130, 0], [2595, 6102, 1], [2595, 6088, 1], [2567, 6088, 1], [2567, 6116, 1], [2567, 6116, 0], [2581, 6116, 0], [2581, 6130, 0], [2581, 6144, 0], [2567, 6144, 0], [2581, 6116, 2], [2581, 6130, 2], [2567, 6144, 2]], branches: { 8: { source: [2595, 6116, 1], direction: "south" }, 14: { source: [2581, 6116, 0], direction: "north" }, 17: { source: [2581, 6102, 2], direction: "north" }, 19: { source: [2567, 6172, 2], direction: "south" } } },
    { name: "trahaearn", id: ObjectIdentifiers.SEAL_OF_TRAHAEARN, mapId: 36732, memory: NpcIdentifiers.MEMORY_OF_SEREN_8, tile: [2646, 6143, 2], tileRotation: 3, source: [2595, 6116, 1], sourceDirection: "south", steps: ["S", "W", "N", "D", "E", "U", "N", "E", "S", "E", "blue", "S", "E", "N", "W", "N", "N", "E", "U", "E", "N", "W", "S"], targets: [[2595, 6102, 1], [2595, 6088, 1], [2567, 6088, 1], [2567, 6116, 1], [2567, 6116, 0], [2581, 6116, 0], [2581, 6116, 2], [2581, 6130, 2], [2609, 6130, 2], [2609, 6102, 2], [2637, 6102, 2], [2651, 6102, 2], [2651, 6094, 2], [2665, 6094, 2], [2665, 6110, 2], [2651, 6110, 2], [2651, 6130, 1], [2651, 6144, 1], [2665, 6144, 1], [2665, 6144, 2], [2679, 6144, 2], [2679, 6158, 2], [2651, 6158, 2]], branches: { 16: { source: [2651, 6116, 1], direction: "north" } } },
    { name: "iorwerth", id: ObjectIdentifiers.SEAL_OF_IORWERTH, mapId: 36729, memory: NpcIdentifiers.MEMORY_OF_SEREN_9, tile: [2650, 6167, 1], tileRotation: 2, source: [2637, 6130, 1], sourceDirection: "north", steps: ["cyan", "blue", "W", "D", "N", "fractured", "E", "U", "S", "E", "yellow", "N", "W", "N", "U", "S", "magenta", "N", "E", "red", "N", "W", "N", "E", "N", "U", "N", "W", "S", "D", "S", "D"], targets: [[2637, 6144, 1], [2637, 6158, 1], [2637, 6172, 1], [2623, 6172, 1], [2623, 6172, 0], [2623, 6186, 0], [2623, 6200, 0], [2637, 6200, 0], [2637, 6186, 0], [2637, 6172, 0], [2651, 6172, 0], [2665, 6172, 0], [2665, 6186, 0], [2651, 6186, 0], [2651, 6200, 0], [2651, 6200, 1], [2637, 6200, 1], [2651, 6130, 1], [2651, 6144, 1], [2665, 6144, 1], [2679, 6144, 1], [2679, 6158, 1], [2665, 6158, 1], [2665, 6172, 1], [2679, 6172, 1], [2679, 6186, 1], [2679, 6186, 2], [2679, 6200, 2], [2665, 6200, 2], [2665, 6186, 2], [2637, 6200, 2], [2637, 6186, 2]], branches: { 8: { fromStep: 5 }, 16: { source: [2637, 6186, 1], direction: "north" }, 17: { source: [2651, 6116, 1], direction: "north" }, 30: { source: [2637, 6186, 2], direction: "north" } } },
  ];
  const LIBRARY_OPERATIONS = { E: "east", W: "west", N: "north", S: "south", U: "up", D: "down" };
  const LIBRARY_CRYSTAL_ITEMS = {
    red: ItemIdentifiers.RED_CRYSTAL_2, yellow: ItemIdentifiers.YELLOW_CRYSTAL_2,
    green: ItemIdentifiers.GREEN_CRYSTAL_2, cyan: ItemIdentifiers.CYAN_CRYSTAL_2,
    blue: ItemIdentifiers.BLUE_CRYSTAL_2, magenta: ItemIdentifiers.MAGENTA_CRYSTAL_2,
    fractured: ItemIdentifiers.FRACTURED_CRYSTAL_3,
  };
  const LIBRARY_PILLAR_IDS = new Set(Object.entries(ObjectIdentifiers)
    .filter(([name]) => name.startsWith("PILLAR_OF_LIGHT"))
    .map(([, id]) => id)
    // The cache substitutes these ids into its static library beam pillars.
    .concat(Array.from({ length: 20 }, (_, index) => 36705 + index)));
  const LIBRARY_DIRECTIONS = { east: "E", west: "W", north: "N", south: "S", up: "U", down: "D" };
  const PILLAR_ITEMS = [
    [ItemIdentifiers.ADAMANT_CHAINBODY, "Adamant chainbody"],
    [ItemIdentifiers.WINE_OF_ZAMORAK, "Wine of zamorak"],
    [ItemIdentifiers.NATURE_RUNE, "Nature rune"],
    [ItemIdentifiers.BLACK_DAGGER, "Black dagger"],
    [ItemIdentifiers.CABBAGE, "Cabbage"],
  ];
  const FALLS_PILLAR_LOCATIONS = [
    [1869, 4628, 2], [1869, 4650, 2], [1881, 4639, 2],
    [1869, 4628, 0], [1869, 4650, 0],
  ];
  const CHEMICALS = [ItemIdentifiers.BLUE_LIQUID, ItemIdentifiers.GREEN_POWDER, ItemIdentifiers.CLEAR_LIQUID, ItemIdentifiers.RED_POWDER];
  const SULPHURIC_ACID = ItemIdentifiers.SULPHURIC_ACID;
  const DISGUISE = {
    STEEL_HELM: ItemIdentifiers.STEEL_FULL_HELM,
    STEEL_BODY: ItemIdentifiers.STEEL_PLATEBODY,
    STEEL_LEGS: ItemIdentifiers.STEEL_PLATELEGS,
    RED_DYE: ItemIdentifiers.RED_DYE,
    PURPLE_DYE: ItemIdentifiers.PURPLE_DYE,
    SILK: ItemIdentifiers.SILK,
    HELM: ItemIdentifiers.ARDOUGNE_KNIGHT_HELM,
    BODY: ItemIdentifiers.ARDOUGNE_KNIGHT_PLATEBODY,
    LEGS: ItemIdentifiers.ARDOUGNE_KNIGHT_PLATELEGS,
    TABARD: ItemIdentifiers.ARDOUGNE_KNIGHT_TABARD,
  };
  const MOURNER_OUTFIT = [
    [Equipment.HEAD_SLOT, ItemIdentifiers.GAS_MASK],
    [Equipment.BODY_SLOT, ItemIdentifiers.MOURNER_TOP],
    [Equipment.LEG_SLOT, ItemIdentifiers.MOURNER_TROUSERS_2],
  ];
  const CITIZEN_SUPPORT = {
    "Priest": 6, "Nurse Sarah": 6, Chadwell: 4,
    "Silk merchant": 2, "Western baker": 4, "Eastern baker": 4,
    "Silver merchant": 2, "Gem merchant": 2, "Fur trader": 2,
    "Spice seller": 2, "Town Crier": 8, Zenesha: 3, Probita: 2,
    "Estate agent": 2, Aemad: 4, Kortan: 4,
    "Doctor Orbon": 6, Richard: 4, Bartender: 6,
  };
  const FIRE_SUPPORT = { "y9pqh3": 8, "Nn3EkA": 8, "AWdFbp": 8 };
  const STAGE = { NOT_STARTED: 0, STARTED: 10, COMPLETE: 200 };
  const CHAPTERS = [
    "starting-out", "making-a-knightly-disguise", "freeing-elena",
    "meet-the-ardougne-resistance", "causing-an-insurrection",
    "vive-la-ardougne-r-volution", "battle-of-two-ardougnes",
    "face-to-face-with-lord-iorwerth", "retreating-to-lletya",
    "the-first-meeting", "visiting-baxtorian-falls",
    "preparing-to-enter-prifddinas", "the-grand-library-of-prifddinas",
    "reporting-back-after-the-revelations", "recovering-the-orb",
    "attack-on-lletya", "after-the-attack", "preparations-at-the-dwarf-camp",
    "sealing-the-underground-pass", "the-fragment-of-seren", "the-war-s-end",
  ];
  const REQUIRED_QUESTS = [
    ["mournings_end_part_ii", "Mourning's End Part II"],
    ["making_history", "Making History"],
    ["druidic_ritual", "Druidic Ritual"],
  ];
  const REQUIRED_SKILLS = [
    [Skill.AGILITY, "Agility"], [Skill.CONSTRUCTION, "Construction"],
    [Skill.FARMING, "Farming"], [Skill.HERBLORE, "Herblore"],
    [Skill.HUNTER, "Hunter"], [Skill.MINING, "Mining"],
    [Skill.SMITHING, "Smithing"], [Skill.WOODCUTTING, "Woodcutting"],
  ];
  const REWARD_SKILLS = [
    [Skill.AGILITY, "Agility"], [Skill.CONSTRUCTION, "Construction"],
    [Skill.FARMING, "Farming"], [Skill.HERBLORE, "Herblore"],
    [Skill.HUNTER, "Hunter"], [Skill.MINING, "Mining"],
    [Skill.SMITHING, "Smithing"], [Skill.WOODCUTTING, "Woodcutting"],
  ];
  let quest;
  const battleInstances = new Map();
  const libraryInstances = new Map();
  const fragmentInstances = new Map();
  const campInstances = new Map();

  class LletyaStoryArea extends Area {
    process(mobile) {
      if (!mobile?.isPlayer?.()) return;
      const player = mobile.getAsPlayer();
      if (quest.isComplete(player)) return;
      if (currentChapter(player) === 12 && player.getAttribute(LLETYA_GUIDE_SPAWNED) !== true) {
        player.setAttribute(LLETYA_GUIDE_SPAWNED, true);
        const guide = api.spawnNpc({ id: NpcIdentifiers.LORD_IEUAN_AMLODD_2, x: 2349, y: 3170, z: 0,
          wanderRadius: 0, owner: player, ownerOnly: true });
        if (!guide) player.setAttribute(LLETYA_GUIDE_SPAWNED, false);
      }
      // Lletya's map NPC is a cache scenery variant (5292) with no Talk-to
      // action. Use the cache's actual Talk-to Arianwyn variant for this chapter.
      if (currentChapter(player) === 13 && !player.getAttribute(LLETYA_ARIANWYN_NPC)) {
        const arianwyn = api.spawnNpc({ id: NpcIdentifiers.ARIANWYN_6, x: 2354, y: 3172, z: 0,
          wanderRadius: 0, owner: player, ownerOnly: true });
        if (arianwyn) player.setAttribute(LLETYA_ARIANWYN_NPC, arianwyn);
      }
      if (currentChapter(player) !== 13) {
        const arianwyn = player.getAttribute(LLETYA_ARIANWYN_NPC);
        if (arianwyn) api.removeNpc(arianwyn);
        player.setAttribute(LLETYA_ARIANWYN_NPC, null);
      }
    }
  }

  class ArdougneBattleArea extends PrivateArea {
    constructor(battle, owner) {
      const bounds = battle === "west"
        ? new Boundary(2519, 2569, 3270, 3339, 0)
        : new Boundary(2568, 2615, 3268, 3340, 0);
      super([bounds]);
      this.battle = battle;
      this.owner = owner;
    }

    canAttack(attacker, target) {
      const attackerInBattle = attacker?.getArea?.() === this;
      const targetInBattle = target?.getArea?.() === this;
      if (attackerInBattle || targetInBattle) return attackerInBattle && targetInBattle;
      return null;
    }

    isMulti() {
      return true;
    }

    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed?.()) battleInstances.delete(this);
    }
  }

  class GrandLibraryArea extends PrivateArea {
    constructor(owner) {
      super([
        new Boundary(2548, 2690, 6078, 6220, 0),
        new Boundary(2548, 2690, 6078, 6220, 1),
        new Boundary(2548, 2690, 6078, 6220, 2),
      ]);
      this.owner = owner;
    }

    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed()) libraryInstances.delete(this.owner);
    }

    resolveObject(id, location) {
      return this.getObjects().find((object) => object.getId() === id &&
        object.getLocation().equals(location)) ?? null;
    }
  }

  class FragmentArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(3282, 3307, 5906, 5930, 1)]);
      this.owner = owner;
    }

    isMulti() { return true; }

    canAttack(attacker, target) {
      const attackerHere = attacker?.getArea?.() === this;
      const targetHere = target?.getArea?.() === this;
      if (attackerHere || targetHere) return attackerHere && targetHere;
      return null;
    }

    process(mobile) {
      if (!mobile?.isNpc?.()) return;
      const state = fragmentInstances.get(this);
      if (!state || mobile !== state.boss || state.finished) return;
      const now = World.getProcessCycle();
      if (state.lastCycle === now) return;
      state.lastCycle = now;
      mobile.setScriptedMovement(true);
      mobile.getCombat().getLastAttack().reset();
      if (!state.introStarted) {
        state.introStarted = true;
        startTranscript(api, state.player, NpcIdentifiers.FRAGMENT_OF_SEREN_3, PAGE,
          "the-fragment-of-seren-the-fragment-enraged");
      }
      if (state.healers.size > 0 && state.boss.getHitpoints() > 0) {
        const heal = state.healers.size * (4 + Math.floor(Math.random() * 5));
        state.boss.setHitpoints(Math.min(state.boss.getMaxHitpoints(), state.boss.getHitpoints() + heal));
      }
      if (now >= state.nextBasicAttackAt) {
        state.nextBasicAttackAt = now + 4;
        state.player.getCombat().getHitQueue().addPendingDamage([
          new HitDamage(2 + Math.floor(Math.random() * 7), HitMask.RED).setSource(state.boss),
        ]);
      }
      const hp = state.boss.getHitpoints();
      if (state.cloneThresholds.length && state.healers.size === 0 &&
        hp <= state.cloneThresholds[0]) spawnFragmentClones(this, state);
      if (now >= state.nextSpecialAt) {
        resolveFragmentSpecial(this, state, now);
      }
    }
  }

  class FragmentThresholdArea extends Area {
    process(mobile) {
      if (!mobile?.isPlayer?.()) return;
      const player = mobile.getAsPlayer();
      if (currentChapter(player) !== 19 || player.getAttribute(CAMP_BATTLE) !== true ||
        player.getAttribute(FRAGMENT_DEFEATED) === true || player.getAttribute(TEMPLE_CUTSCENE_STARTED) === true) return;
      player.setAttribute(TEMPLE_CUTSCENE_STARTED, true);
      startTranscript(api, player, NpcIdentifiers.LORD_IORWERTH_2, PAGE,
        "the-fragment-of-seren-the-fragment-freed-at-last");
    }
  }

  class DwarvenCampArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(2424, 2472, 6078, 6142, 0)]);
      this.owner = owner;
    }
    isMulti() { return true; }
    canAttack(attacker, target) {
      const a = attacker?.getArea?.() === this;
      const t = target?.getArea?.() === this;
      if (a || t) return a && t;
      return null;
    }
    process(mobile) {
      const state = campInstances.get(this);
      if (!state) return;
      // Drive the siege from its owner so it keeps advancing after the last
      // add dies; relying on an NPC tick can strand the timer when the Set
      // still contains a dead or despawned attacker.
      if (mobile !== state.player) return;
      const cycle = World.getProcessCycle();
      if (state.lastCycle === cycle) return;
      state.lastCycle = cycle;
      if (state.pendingArrivalAt && cycle >= state.pendingArrivalAt) {
        state.pendingArrivalAt = 0;
        state.arrivalTranscriptStarted = true;
        state.player.setAttribute(CAMP_ARRIVAL_STARTED, true);
        startTranscript(api, state.player, NpcIdentifiers.ELENA_3, PAGE,
          "sealing-the-underground-pass-attack-of-the-iorwerth-upon-killing-essyllt");
        return;
      }
      if (state.pendingEssylltAt && cycle >= state.pendingEssylltAt) {
        state.pendingEssylltAt = 0;
        startTranscript(api, state.player, NpcIdentifiers.ELENA_3, PAGE,
          "sealing-the-underground-pass-attack-of-the-iorwerth-upon-successfully-defending-the-dwarf-camp");
        return;
      }
      if (!state.defending || state.finished) return;
      for (const npc of state.attackers) {
        if (npc.getHitpoints?.() <= 0 || npc.getArea?.() !== this) state.attackers.delete(npc);
      }
      if (cycle >= state.endsAt) finishCampDefense(this, state);
      else if (cycle >= state.nextWaveAt && state.attackers.size < 3) spawnCampAttacker(this, state);
    }
    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed()) campInstances.delete(this);
    }
  }

  class DwarvenCampAccessArea extends Area {
    process(mobile) {
      if (!mobile?.isPlayer?.()) return;
      const player = mobile.getAsPlayer();
      if (currentChapter(player) < 17 || currentChapter(player) > 19 || quest.isComplete(player)) return;
      if (player.getArea?.() instanceof DwarvenCampArea) return;
      ensureDwarvenCamp(player);
    }
  }

  function hasQuest(player, key) {
    const request = { player, key, complete: null };
    api.emitCustomEvent("quest:is-complete", request);
    return request.complete === true;
  }
  function requirementsMet(player) {
    return REQUIRED_QUESTS.every(([key]) => hasQuest(player, key)) &&
      REQUIRED_SKILLS.every(([skill]) => player.getSkillManager().getMaxLevel(skill) >= 70);
  }
  function explainRequirements(player) {
    for (const [key, name] of REQUIRED_QUESTS) if (!hasQuest(player, key)) {
      player.sendMessage(`You must have completed ${name} to start this quest.`);
    }
    for (const [skill, name] of REQUIRED_SKILLS) if (player.getSkillManager().getMaxLevel(skill) < 70) {
      player.sendMessage(`You need 70 ${name} to start this quest.`);
    }
  }
  function onStart(event) {
    if (event?.hook !== START_HOOK || !event.player) return;
    if (!requirementsMet(event.player)) { explainRequirements(event.player); return; }
    quest.setStage(event.player, STAGE.STARTED);
  }
  function chapterFor(variant) {
    return CHAPTERS.findIndex((chapter) => variant === chapter || variant.startsWith(`${chapter}-`));
  }
  function selectVariant(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return null;
    const page = event.pages?.find((entry) => entry.page === PAGE);
    if (!page) return null;
    const value = quest.getStage(player);
    if (value === STAGE.NOT_STARTED) {
      if (event.definition?.getName?.() !== "Edmond" || !requirementsMet(player)) return null;
      return page.variants.includes("starting-out-talking-to-edmond")
        ? { page: PAGE, variant: "starting-out-talking-to-edmond" } : null;
    }
    const candidates = page.variants.map((variant) => ({ variant, chapter: chapterFor(variant) }))
      .filter((entry) => entry.chapter >= 0);
    if (!candidates.length) return null;
    const current = candidates.filter((entry) => entry.chapter === currentChapter(player));
    const selected = current.find((entry) => !entry.variant.includes("again")) ?? current[0] ?? candidates[0];
    return { page: PAGE, variant: selected.variant };
  }
  function currentChapter(player) {
    if (quest.isComplete(player)) return CHAPTERS.length - 1;
    const lateChapter = Number(player.getAttribute(LATE_CHAPTER));
    if (Number.isInteger(lateChapter) && lateChapter >= 19) return Math.min(lateChapter, 20);
    const value = quest.getStage(player);
    if (value >= STAGE.COMPLETE) return 18;
    // Stage is advanced by the transcript milestones below; cap it to the final chapter.
    return Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor((value - STAGE.STARTED) / 10)));
  }
  function onAction(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return;
    const inventory = player.getInventory();
    if (event.kind === "message") {
      const itemByMessage = {
        "5Ndx0y": ItemIdentifiers.ODE_TO_ETERNITY,
        "eS601c": ItemIdentifiers.CRYSTAL_SEED_3,
        "0lNCRc": ItemIdentifiers.ELDER_CADANTINE,
        "edE31_": ItemIdentifiers.CRYSTAL_5,
        "_Q1RaJ": ItemIdentifiers.ORB_OF_LIGHT_5,
        "vh7Q_s": ItemIdentifiers.CLUE_SCROLL_HARD_,
      };
      const itemId = itemByMessage[event.stepId];
      if (itemId) {
        if (inventory.getFreeSlots() > 0 && inventory.getAmount(itemId) === 0) {
          inventory.adds(itemId, 1);
          event.box = { items: [itemId] };
          if (itemId === ItemIdentifiers.ODE_TO_ETERNITY) {
            const order = PILLAR_ITEMS.map((_, index) => index);
            for (let index = order.length - 1; index > 0; index--) {
              const swap = Math.floor(Math.random() * (index + 1));
              [order[index], order[swap]] = [order[swap], order[index]];
            }
            player.setAttribute(FALLS_ORDER, order.join(","));
            player.sendMessage(`Ode to Eternity's riddle: place ${order.map((index) => PILLAR_ITEMS[index][1]).join(", then ")}.`);
          }
        } else if (inventory.getFreeSlots() === 0) {
          event.handled = true;
          player.sendMessage("You need an empty inventory slot before you can take that.");
        }
      }
      if (event.stepId === "ITn7ep") {
        inventory.deleteNumber(ItemIdentifiers.HAMMER, 1);
        inventory.deleteNumber(ItemIdentifiers.RUNITE_BAR, 1);
      }
      if (event.stepId === "koxQh3") player.setAttribute(REVELATIONS_MEETING_STARTED, true);
      if (event.stepId === "UNrb5z") recordElder(player, 1);
      if (event.stepId === "K9K0W4") recordElder(player, 2);
      if (event.stepId === "U-Vihn") recordElder(player, 4);
      if (event.stepId === "S3ME_F") {
        inventory.deleteNumber(ItemIdentifiers.CLUE_SCROLL_HARD_, 1);
        recordElder(player, 8);
      }
      if (event.stepId === "gBRsQm") {
        if (inventory.getFreeSlots() < 7) {
          event.handled = true;
          player.sendMessage("You need seven empty inventory slots for the explosives.");
          return;
        }
        if (inventory.getAmount(ItemIdentifiers.EXPLOSIVE_POTION) === 0) inventory.adds(ItemIdentifiers.EXPLOSIVE_POTION, 7);
        event.box = { items: [ItemIdentifiers.EXPLOSIVE_POTION] };
        player.setAttribute(CAMP_EXPLOSIVES, 7);
        player.sendMessage("You take seven explosive potions from Elena.");
      }
      return;
    }
    if (event.stepId === "_moa2Q" && hasItems(player, [DISGUISE.STEEL_HELM, DISGUISE.RED_DYE])) {
      inventory.deleteNumber(DISGUISE.STEEL_HELM, 1);
      inventory.deleteNumber(DISGUISE.RED_DYE, 1);
      inventory.adds(DISGUISE.HELM, 1);
    } else if (event.stepId === "I5Jusz" && hasItems(player, [DISGUISE.STEEL_BODY, DISGUISE.TABARD])) {
      inventory.deleteNumber(DISGUISE.STEEL_BODY, 1);
      inventory.deleteNumber(DISGUISE.TABARD, 1);
      inventory.adds(DISGUISE.BODY, 1);
    } else if (["tNiXqt", "0nVxB-"].includes(event.stepId) && hasItems(player, [DISGUISE.SILK, DISGUISE.PURPLE_DYE])) {
      inventory.deleteNumber(DISGUISE.SILK, 1);
      inventory.deleteNumber(DISGUISE.PURPLE_DYE, 1);
    } else if (["Y45282", "bGd6H8"].includes(event.stepId) && !hasItems(player, [DISGUISE.TABARD])) {
      inventory.deleteNumber(DISGUISE.SILK, 1);
      inventory.deleteNumber(DISGUISE.PURPLE_DYE, 1);
      inventory.adds(DISGUISE.TABARD, 1);
    } else if (["QMXa3C", "taCC98"].includes(event.stepId)) {
      if (event.stepId === "taCC98") {
        for (const id of CHEMICALS) inventory.deleteNumber(id, inventory.getAmount(id));
      }
      const chemical = Number(player.getAttribute(CHEMICAL_CHOICE)) || ItemIdentifiers.CLEAR_LIQUID;
      if (inventory.getAmount(chemical) === 0) inventory.adds(chemical, 1);
      player.setAttribute(CHEMICAL_CHOICE, 0);
    } else if (event.stepId === "PZ3EOG") {
      inventory.deleteNumber(ItemIdentifiers.CLEAR_LIQUID, 1);
      inventory.deleteNumber(SULPHURIC_ACID, 1);
    }
    if (FIRE_SUPPORT[event.stepId] && currentChapter(player) === 4) {
      addResistanceSupport(player, FIRE_SUPPORT[event.stepId], `fire:${event.stepId}`);
    }
    const chapter = ACTION_CHAPTER[event.stepId];
    if (chapter !== undefined && (event.stepId !== "jtPiC1" || wearingDisguise(player))) {
      setChapter(player, chapter);
    }
    if (event.stepId === "UeAKgA") {
      player.moveTo(new Location(2440, 6090, 0));
      player.setAttribute(VALLEY_FIGURE, true);
      const figure = api.spawnNpc({ id: NpcIdentifiers.MYSTERIOUS_FIGURE, x: 2440, y: 6092, z: 0,
        wanderRadius: 0, owner: player, ownerOnly: true });
      if (figure) player.getArea?.()?.enter?.(figure);
    }
    if (event.stepId === "v3r3p_") player.moveTo(new Location(2353, 3172, 0));
    if (event.stepId === "D1wXY6") {
      player.setAttribute(VALLEY_FIGURE, false);
      player.moveTo(new Location(2353, 3172, 0));
    }
    if (["9yLw8T", "o4CmGU", "eIlh1C"].includes(event.stepId)) setChapter(player, 15);
    if (event.stepId === "6nBDUf") setChapter(player, 16);
    if (event.stepId === "xfnkES") {
      event.handled = true;
      setChapter(player, 19);
      if (!startFragmentBattle(player)) player.setAttribute(TEMPLE_CUTSCENE_STARTED, false);
    }
    if (event.stepId === "YAPX-R") {
      event.handled = true;
      beginEssylltEncounter(player);
    }
    if (event.stepId === "vdBzNa") spawnPostEssylltArrival(player);
    if (event.stepId === "FK0kOz") {
      setChapter(player, 19);
      player.sendMessage("Lord Iorwerth and Arianwyn have entered the Temple of Light. Follow them through the Underground Pass.");
    }
    if (event.stepId === "yR9ETJ" && player.getAttribute(FRAGMENT_DEFEATED) === true) setChapter(player, 20);
    if (event.stepId === "eOtNFO") setChapter(player, 12);
    if (event.stepId === "W-ainS") {
      if (player.getAttribute(FRAGMENT_DEFEATED) !== true || currentChapter(player) !== 20) {
        event.handled = true;
        player.sendMessage("The Fragment must be defeated before the quest can end.");
        return;
      }
      quest.complete(player);
    }
  }

  function recordElder(player, bit) {
    const recruited = (Number(player.getAttribute(RECRUITED_ELDERS)) || 0) | bit;
    player.setAttribute(RECRUITED_ELDERS, recruited);
    if ((recruited & 3) === 3 && currentChapter(player) === 13) {
      const arianwyn = player.getAttribute(LLETYA_ARIANWYN_NPC);
      if (arianwyn) api.removeNpc(arianwyn);
      player.setAttribute(LLETYA_ARIANWYN_NPC, null);
      setChapter(player, 14);
      player.sendMessage("Lord Crwys and Lady Hefin are on their way to Lletya. Return to Baxtorian for the next part of the plan.");
    }
    if ((recruited & 15) === 15 && currentChapter(player) === 16) {
      setChapter(player, 17);
      player.sendMessage("The clan elders are reunited. Return to Baxtorian and help the dwarves prepare to seal the Pass.");
    }
  }

  function setChapter(player, chapter) {
    if (chapter >= 19) {
      // Stage 200 is the cache completion value; retain stage 190 through the
      // final battle and store its late chapters separately.
      quest.setStage(player, 190);
      player.setAttribute(LATE_CHAPTER, chapter);
      return;
    }
    player.setAttribute(LATE_CHAPTER, 0);
    quest.setStage(player, Math.max(10, STAGE.STARTED + chapter * 10));
  }
  function claimArianwynAfterLibrary(event) {
    const player = event?.player;
    if (!player || currentChapter(player) !== 13) return false;
    event.handled = true;
    return startTranscript(api, player, event.npcId, PAGE,
      "reporting-back-after-the-revelations-the-curse-of-seren");
  }

  function onTalk(event) {
    const player = event?.player;
    if (!player) return false;
    const npcName = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (quest.getStage(player) === STAGE.NOT_STARTED) {
      if (npcName !== "edmond") return false;
      if (!requirementsMet(player)) { explainRequirements(player); return true; }
      return startTranscript(api, player, event.npcId, PAGE, "starting-out-talking-to-edmond");
    }
    if (quest.isComplete(player)) return false;
    const camp = player.getArea?.() instanceof DwarvenCampArea ? player.getArea() : null;
    const campState = camp && campInstances.get(camp);
    if (npcName === "elena" && campState?.finished) {
      if (player.getAttribute(CAMP_BATTLE) === true) {
        if (player.getAttribute(CAMP_ARRIVAL_STARTED) !== true && !campState.arrivalTranscriptStarted && !campState.pendingArrivalAt) {
          campState.pendingArrivalAt = World.getProcessCycle() + 2;
        } else if (player.getAttribute(CAMP_ARRIVAL_STARTED) === true || campState.arrivalTranscriptStarted) {
          player.sendMessage("The elven leaders have gone into the Temple of Light. Follow them through the Underground Pass.");
        }
        return true;
      }
      return startTranscript(api, player, event.npcId, PAGE,
        "sealing-the-underground-pass-attack-of-the-iorwerth-upon-successfully-defending-the-dwarf-camp");
    }
    if (currentChapter(player) === 13 && npcName === "arianwyn") {
      return startTranscript(api, player, event.npcId, PAGE,
        "reporting-back-after-the-revelations-the-curse-of-seren");
    }
    if (currentChapter(player) === 13 && npcName === "baxtorian") {
      const variant = player.getAttribute(REVELATIONS_MEETING_STARTED) === true
        ? "reporting-back-after-the-revelations-talking-to-baxtorian-after-the-meeting"
        : "reporting-back-after-the-revelations-dialogue-with-npcs-post-library-visit-talking-to-baxtorian";
      return startTranscript(api, player, event.npcId, PAGE, variant);
    }
    if (npcName === "baxtorian" && currentChapter(player) === 17) {
      const wasAtCamp = player.getArea?.() instanceof DwarvenCampArea;
      ensureDwarvenCamp(player);
      return startTranscript(api, player, event.npcId, PAGE, wasAtCamp
        ? "preparations-at-the-dwarf-camp-talking-to-baxtorian"
        : "preparations-at-the-dwarf-camp-talking-to-baxtorian-at-lletya");
    }
    if (npcName === "elena" && currentChapter(player) === 17 && player.getArea?.() instanceof DwarvenCampArea) {
      if (!player.getInventory().getAmount(ItemIdentifiers.EXPLOSIVE_POTION)) {
        if (player.getInventory().getFreeSlots() < 7) {
          player.sendMessage("Make seven inventory spaces so Elena can hand you the explosive potions.");
          return true;
        }
        player.getInventory().adds(ItemIdentifiers.EXPLOSIVE_POTION, 7);
        player.setAttribute(CAMP_EXPLOSIVES, 7);
      }
      return startTranscript(api, player, event.npcId, PAGE, "preparations-at-the-dwarf-camp-talking-to-elena-after-talking-to-baxtorian");
    }
    if (npcName === "baxtorian" && currentChapter(player) === 18 && player.getArea?.() instanceof DwarvenCampArea) {
      if ((Number(player.getAttribute(CAMP_HOLES)) || 0) !== 127) {
        player.sendMessage("Fill all seven holes with Elena's explosive potions before the final meeting.");
        return true;
      }
      return startTranscript(api, player, event.npcId, PAGE, "preparations-at-the-dwarf-camp-a-final-meeting");
    }
    if (npcName === "lord ieuan amlodd" && player.getArea?.() instanceof GrandLibraryArea) {
      const area = player.getArea();
      area.leave(player, false);
      player.setAttribute(LIBRARY_INSTANCE, null);
      player.moveTo(new Location(2353, 3172, 0));
      player.sendMessage("Lord Ieuan guides you back to Lletya. You can return to the library when you are ready.");
      return true;
    }
    if (npcName === "elena" && currentChapter(player) === 4) {
      const enoughSupport = resistanceSupport(player) >= 80;
      return startTranscript(api, player, event.npcId, PAGE, enoughSupport
        ? "vive-la-ardougne-r-volution-talking-to-elena-or-councillor-halgrive"
        : "meet-the-ardougne-resistance-planning-a-revolution-talking-to-elena-before-recruiting-enough-people");
    }
    if ((npcName === "elena" || npcName === "councillor halgrive") && currentChapter(player) === 6 &&
      (Number(player.getAttribute(WEST_BATTLE_KILLS)) || 0) >= 21) {
      return startTranscript(api, player, event.npcId, PAGE, "battle-of-two-ardougnes-west-ardougne-returning-to-base");
    }
    if (currentChapter(player) === 4 && Object.keys(CITIZEN_SUPPORT).some((name) => name.toLowerCase() === npcName)) {
      const aliases = {
        "nurse sarah": "retraining-nurse-sarah",
        chadwell: "taxing-chadwell-the-general-store-owner",
        "town crier": "talking-to-the-town-crier",
        bartender: "taxing-the-bar",
        probita: "taxing-the-pet-insurance-bureau",
        "doctor orbon": "retraining-doctor-orbon",
        "silk merchant": "taxing-the-silk-merchant",
        "western baker": "taxing-the-western-baker",
        "eastern baker": "taxing-the-eastern-baker",
        "silver merchant": "taxing-the-silver-merchant",
        "gem merchant": "taxing-the-gem-merchant",
        "fur trader": "taxing-the-fur-merchant",
        "spice seller": "taxing-the-spice-seller",
        zenesha: "taxing-zenesha-the-armour-store-owner",
        aemad: "taxing-aemad-or-kortan-the-general-store-owners",
        kortan: "taxing-aemad-or-kortan-the-general-store-owners",
        richard: "taxing-richard",
        "priest": event.npc?.getLocation?.()?.getX?.() >= 2570
          ? "east-ardougne-taxing-the-priest" : "west-ardougne-taxing-the-priest",
      };
      const match = aliases[npcName] ?? (npcName === "estate agent"
        ? "taxing-the-estate-agent" : `taxing-${npcName.replace(/[^a-z0-9]+/g, "-")}`);
      const variant = Object.keys(loadTranscripts(api)[PAGE]?.variants ?? {})
        .find((name) => name.startsWith("causing-an-insurrection-") && name.endsWith(match));
      if (variant) return startTranscript(api, player, event.npcId, PAGE, variant);
    }
    if (npcName === "king thoros" && quest.getStage(player) === STAGE.STARTED) {
      // In this world state Thoros occupies the post-quest castle throne room;
      // use the Lathas transcript only while the player is beginning SOTE.
      quest.setStage(player, 20);
      return startTranscript(api, player, event.npcId, PAGE, "talking-to-the-king");
    }
    if (npcName === "king lathas") {
      const variant = quest.getStage(player) === STAGE.STARTED
        ? "talking-to-the-king"
        : "talking-to-the-king-talking-to-him-again";
      if (quest.getStage(player) === STAGE.STARTED) quest.setStage(player, 20);
      return startTranscript(api, player, event.npcId, PAGE, variant);
    }
    if (npcName === "elena" && currentChapter(player) === 2) {
      const inventory = player.getInventory();
      const hasChemical = CHEMICALS.some((id) => inventory.getAmount(id) > 0) || inventory.getAmount(SULPHURIC_ACID) > 0;
      return startTranscript(api, player, event.npcId, PAGE,
        hasChemical ? "freeing-elena-returning-to-elena" : "freeing-elena-talking-to-elena");
    }
    if (currentChapter(player) === 11 && npcName === "elena") {
      const finishedPotion = player.getInventory().getAmount(ItemIdentifiers.INVERSION_POTION) > 0;
      return startTranscript(api, player, event.npcId, PAGE, finishedPotion
        ? "preparing-to-enter-prifddinas-making-the-inversion-potion-talking-to-elena-after-finishing-the-potion"
        : "preparing-to-enter-prifddinas-making-the-inversion-potion-talking-to-elena-again");
    }
    if (currentChapter(player) === 11 && npcName === "arianwyn") {
      const inventory = player.getInventory();
      if (inventory.getAmount(ItemIdentifiers.INVERSION_POTION) > 0) {
        inventory.deleteNumber(ItemIdentifiers.INVERSION_POTION, 1);
        return startTranscript(api, player, event.npcId, PAGE,
          "preparing-to-enter-prifddinas-making-the-inversion-potion-talking-to-arianwyn-after-finishing-the-potion");
      }
      return startTranscript(api, player, event.npcId, PAGE, inventory.getAmount(ItemIdentifiers.CRYSTAL_5) > 0
        ? "preparing-to-enter-prifddinas-making-the-inversion-potion-talking-to-arianwyn-again"
        : "preparing-to-enter-prifddinas-making-the-inversion-potion-talking-to-arianwyn");
    }
    if (currentChapter(player) === 11 && npcName === "baxtorian") {
      const finishedPotion = player.getInventory().getAmount(ItemIdentifiers.INVERSION_POTION) > 0;
      return startTranscript(api, player, event.npcId, PAGE, finishedPotion
        ? "preparing-to-enter-prifddinas-making-the-inversion-potion-talking-to-baxtorian-after-finishing-the-potion"
        : "preparing-to-enter-prifddinas-making-the-inversion-potion-talking-to-baxtorian");
    }
    if (currentChapter(player) === 11 && npcName === "mysterious figure" && player.getAttribute(VALLEY_FIGURE) === true) {
      return startTranscript(api, player, event.npcId, PAGE, "preparing-to-enter-prifddinas-a-mysterious-figure");
    }
    if (currentChapter(player) === 16 && npcName === "lady ffion meilyr") {
      if (!player.getInventory().getAmount(ItemIdentifiers.CLUE_SCROLL_HARD_)) {
        player.sendMessage("Ask Baxtorian for Lady Meilyr's clue scroll before following it.");
        return true;
      }
      return startTranscript(api, player, event.npcId, PAGE, "after-the-attack-finding-lady-meilyr");
    }
    if (currentChapter(player) === 11 && npcName === "lord ieuan amlodd" && player.getAttribute(VALLEY_FIGURE) === true) {
      player.setAttribute(VALLEY_FIGURE, false);
      player.moveTo(new Location(2353, 3172, 0));
      return startTranscript(api, player, event.npcId, PAGE,
        "preparing-to-enter-prifddinas-a-mysterious-figure-talking-to-lord-amlodd-once-he-is-in-lletya");
    }
    if (npcName === "edmond" && currentChapter(player) === 2) {
      quest.setStage(player, STAGE.STARTED + 30);
      return startTranscript(api, player, event.npcId, PAGE, "freeing-elena-telling-edmond-the-good-news");
    }
    if ((npcName === "knight of ardougne" || npcName === "ardougne knight" || npcName === "guard") && currentChapter(player) === 2) {
      const variant = "freeing-elena-talking-to-the-knight-of-ardougne";
      return startTranscript(api, player, event.npcId, PAGE, variant);
    }
    if ((npcName === "knight of ardougne" || npcName === "ardougne knight" || npcName === "guard") && currentChapter(player) === 1) {
      if (!wearingDisguise(player)) {
        return startTranscript(api, player, event.npcId, PAGE,
          "talking-to-the-king-talking-to-the-knight-of-ardougne-talking-to-knight-without-knight-armour");
      }
      quest.setStage(player, STAGE.STARTED + 20);
      return startTranscript(api, player, event.npcId, PAGE, "freeing-elena-upon-entering-the-prison");
    }
    if (["martha rehnison", "ted rehnison", "milli rehnison"].includes(npcName) && currentChapter(player) === 3) {
      const variants = {
        "martha rehnison": "meet-the-ardougne-resistance-the-rehnisons-talking-to-martha-or-ted-rehnison",
        "ted rehnison": "meet-the-ardougne-resistance-the-rehnisons-talking-to-martha-or-ted-rehnison-again",
        "milli rehnison": "meet-the-ardougne-resistance-the-rehnisons-talking-to-milli-rehnison",
      };
      return startTranscript(api, player, event.npcId, PAGE, variants[npcName]);
    }
    const chapterName = CHAPTERS[currentChapter(player)];
    if (npcName === "edmond" && currentChapter(player) === 1) {
      const hasDisguise = wearingDisguise(player);
      if (hasDisguise) quest.setStage(player, STAGE.STARTED + 20);
      const variant = hasDisguise
        ? "making-a-knightly-disguise-talking-to-edmond-after-completing-the-disguise-2"
        : "making-a-knightly-disguise-talking-to-edmond-after-completing-the-disguise-talking-to-him-again";
      return startTranscript(api, player, event.npcId, PAGE,
        variant);
    }
    const alias = ({ "king lathas": "king", "ted rehnison": "martha-or-ted", "martha rehnison": "martha-or-ted" })[npcName] ?? npcName.replace(/[^a-z0-9]+/g, "-");
    const variants = Object.keys(loadTranscripts(api)[PAGE]?.variants ?? {});
    const candidates = variants.filter((variant) => variant.startsWith(`${chapterName}-`) && variant.includes(alias));
    const selected = candidates.find((variant) => variant.includes("talking-to") && !variant.includes("again")) ??
      candidates.find((variant) => variant.includes("talking-to")) ?? candidates[0];
    return selected ? startTranscript(api, player, event.npcId, PAGE, selected) : false;
  }

  function hasItems(player, ids) {
    const inventory = player.getInventory();
    return ids.every((id) => inventory.getAmount(id) > 0);
  }

  function equippedId(player, slot) {
    return player.getEquipment().get(slot)?.getId?.();
  }

  function wearingDisguise(player) {
    return equippedId(player, Equipment.HEAD_SLOT) === DISGUISE.HELM &&
      equippedId(player, Equipment.BODY_SLOT) === DISGUISE.BODY &&
      [DISGUISE.STEEL_LEGS, DISGUISE.LEGS].includes(equippedId(player, Equipment.LEG_SLOT));
  }

  function wearingMourner(player) {
    return MOURNER_OUTFIT.every(([slot, id]) => equippedId(player, slot) === id);
  }

  function resistanceSupport(player) {
    return Number(player.getAttribute(RESISTANCE_MEMBERS)) || 0;
  }

  function addResistanceSupport(player, amount, key) {
    const completed = new Set(String(player.getAttribute(INCITEMENTS) ?? "").split(",").filter(Boolean));
    if (completed.has(key)) return;
    completed.add(key);
    player.setAttribute(INCITEMENTS, [...completed].join(","));
    player.setAttribute(RESISTANCE_MEMBERS, Math.min(80, resistanceSupport(player) + amount));
    if (resistanceSupport(player) >= 80 && currentChapter(player) === 4) {
      player.sendMessage("The resistance has recruited 80 people. Report back to Elena.");
    }
  }

  function recordIncitement(event) {
    const text = String(event.text ?? "");
    const wearsKnight = text.includes("wearing Knight of Ardougne armour") && wearingDisguise(event.player);
    const wearsMourner = text.includes("wearing a mourner's outfit") && wearingMourner(event.player);
    if (!wearsKnight && !wearsMourner) return null;
    if (currentChapter(event.player) !== 4) return true;
    const name = String(event.definition?.getName?.() ?? "");
    const amount = Object.entries(CITIZEN_SUPPORT).find(([candidate]) => candidate.toLowerCase() === name.toLowerCase())?.[1];
    if (amount) {
      const tile = event.npc?.getLocation?.();
      const key = `npc:${event.npcId}:${tile?.getX?.() ?? 0}:${tile?.getY?.() ?? 0}`;
      addResistanceSupport(event.player, amount, key);
    }
    return true;
  }

  function disguiseCondition(event) {
    if (event.stepId === "H43Lmv") return wearingDisguise(event.player);
    if (event.stepId === "H5jIPU") return event.player.getSkillManager().getMaxLevel(Skill.DEFENCE) >= 5;
    if (event.stepId === "bQLjI3") return event.player.getSkillManager().getMaxLevel(Skill.DEFENCE) < 5;
    if (event.stepId === "kiR0oJ") return hasItems(event.player, [DISGUISE.SILK, DISGUISE.PURPLE_DYE]);
    if (event.stepId === "Ne_wSN") {
      return event.player.getInventory().getAmount(ItemIdentifiers.CLEAR_LIQUID) > 0 ||
        event.player.getInventory().getAmount(SULPHURIC_ACID) > 0;
    }
    if (event.stepId === "IqvKw7") {
      return CHEMICALS.some((id) => id !== ItemIdentifiers.CLEAR_LIQUID && event.player.getInventory().getAmount(id) > 0);
    }
    if (event.stepId === "3T9hP1") {
      return CHEMICALS.every((id) => event.player.getInventory().getAmount(id) === 0);
    }
    if (event.stepId === "_iv2oi") {
      return CHEMICALS.some((id) => event.player.getInventory().getAmount(id) > 0);
    }
    return null;
  }

  function handleDialogueChoice(event) {
    if (!event?.player) return;
    if (event.option === "Yes please." && inLibrary(event.player) &&
      String(event.definition?.getName?.() ?? "").toLowerCase() === "memory of seren") {
      event.player.moveTo(new Location(2623, 6144, 0));
      event.player.sendMessage("Seren's memory returns you to the central chamber of the Grand Library.");
      return;
    }
    if (event.option === "Yes" && currentChapter(event.player) === 12 &&
      String(event.definition?.getName?.() ?? "").toLowerCase() === "lord ieuan amlodd") {
      if (event.player.getInventory().getFreeSlots() < 6) {
        event.player.sendMessage("You need at least six free inventory spaces before entering the Grand Library.");
        return;
      }
      const player = event.player;
      const username = player.getUsername?.();
      const area = new GrandLibraryArea(username);
      libraryInstances.set(username, area);
      player.setAttribute(LIBRARY_INSTANCE, area);
      area.enter(player);
      const guide = api.spawnNpc({ id: NpcIdentifiers.LORD_IEUAN_AMLODD, x: 2625, y: 6144, z: 0,
        wanderRadius: 0, owner: player, ownerOnly: true });
      if (guide) area.enter(guide);
      player.moveTo(new Location(2623, 6144, 0));
      player.sendMessage("You enter the Grand Library. Its doors seal behind you; find the Seal of the Forgotten in the central chamber.");
      return;
    }
    if (event.option === "I'm ready." && currentChapter(event.player) === 18 &&
      String(event.definition?.getName?.() ?? "").toLowerCase() === "baxtorian") {
      const player = event.player;
      const area = ensureDwarvenCamp(player);
      const holes = Number(player.getAttribute(CAMP_HOLES)) || 0;
      if (holes < 7) {
        player.sendMessage(`The dwarves are not ready. You have filled ${holes} of the seven explosive holes.`);
        return;
      }
      spawnCampNpc(area, NpcIdentifiers.LORD_IORWERTH_2, 2448, 6110);
      startTranscript(api, player, NpcIdentifiers.LORD_IORWERTH_2, PAGE, "sealing-the-underground-pass-meeting-with-lord-iorwerth");
      beginCampDefense(player, area);
      return;
    }
    if (event.player.getAttribute(RESISTANCE_BRIEFING) === true && currentChapter(event.player) === 3) {
      event.player.setAttribute(RESISTANCE_BRIEFING, false);
      if (event.option === "I am.") quest.setStage(event.player, STAGE.STARTED + 50);
      return;
    }
    if (event.option === "I'm ready." && currentChapter(event.player) === 4 && resistanceSupport(event.player) >= 80) {
      quest.setStage(event.player, STAGE.STARTED + 50);
      event.player.setAttribute(WEST_BATTLE_KILLS, 0);
      startBattle(event.player, "west");
    } else if (event.option === "I'm ready." && currentChapter(event.player) === 6 &&
      (Number(event.player.getAttribute(WEST_BATTLE_KILLS)) || 0) >= 21) {
      event.player.setAttribute(EAST_BATTLE_KILLS, 0);
      startBattle(event.player, "east");
    }
    const chemical = {
      "The thin blue liquid.": ItemIdentifiers.BLUE_LIQUID,
      "The light green powder.": ItemIdentifiers.GREEN_POWDER,
      "The thick clear liquid.": ItemIdentifiers.CLEAR_LIQUID,
      "The dark red powder.": ItemIdentifiers.RED_POWDER,
    }[event.option];
    if (!chemical || currentChapter(event.player) !== 2) return;
    const inventory = event.player.getInventory();
    for (const id of CHEMICALS) inventory.deleteNumber(id, inventory.getAmount(id));
    inventory.adds(chemical, 1);
    event.player.setAttribute(CHEMICAL_CHOICE, chemical);
  }

  function inLibrary(player) {
    return player.getArea?.() instanceof GrandLibraryArea;
  }

  function currentLibrarySeal(player) {
    const completed = Number(player.getAttribute(LIBRARY_SEALS)) || 0;
    return LIBRARY_SEAL_DATA.findIndex((_, index) => !(completed & (1 << (index + 1))));
  }

  function libraryPuzzleState(player) {
    const [seal, step] = String(player.getAttribute(LIBRARY_PUZZLE) ?? "0:0").split(":").map(Number);
    return { seal: Number.isInteger(seal) ? seal : 0, step: Number.isInteger(step) ? step : 0 };
  }

  function libraryPillarState(player) {
    try { return JSON.parse(String(player.getAttribute(LIBRARY_PILLAR_STATE) || "{}")); }
    catch { return {}; }
  }
  function resetLibraryPuzzle(player, sealIndex) {
    player.setAttribute(LIBRARY_PUZZLE, `${sealIndex}:0`);
    player.setAttribute(LIBRARY_PILLAR_STATE, "{}");
  }

  function beamReaches(previous, location, area, placements) {
    const direction = previous?.operation === "fractured" ? "fractured" :
      (LIBRARY_OPERATIONS[previous?.operation] ?? previous?.direction);
    if (!previous || !location || !direction) return true;
    const { x, y, z } = previous;
    const dx = location.x - x;
    const dy = location.y - y;
    const dz = location.z - z;
    let step;
    switch (direction) {
      case "east": if (dz === 0 && dy === 0 && dx > 0) step = [1, 0, 0]; break;
      case "west": if (dz === 0 && dy === 0 && dx < 0) step = [-1, 0, 0]; break;
      case "north": if (dz === 0 && dx === 0 && dy > 0) step = [0, 1, 0]; break;
      case "south": if (dz === 0 && dx === 0 && dy < 0) step = [0, -1, 0]; break;
      case "up": if (dx === 0 && dy === 0 && dz > 0) step = [0, 0, 1]; break;
      case "down": if (dx === 0 && dy === 0 && dz < 0) step = [0, 0, -1]; break;
      // A fractured crystal sends light down both branches; the next mirror
      // must be on one of those rays. Its own direction is checked afterward.
      case "fractured":
        if (dz === 0 && dx !== 0 && dy === 0) step = [Math.sign(dx), 0, 0];
        else if (dz === 0 && dy !== 0 && dx === 0) step = [0, Math.sign(dy), 0];
        break;
    }
    if (!step) return false;
    for (let x = previous.x + step[0], y = previous.y + step[1], z = previous.z + step[2];
      x !== location.x || y !== location.y || z !== location.z;
      x += step[0], y += step[1], z += step[2]) {
      // A placed mirror/crystal intercepts the outgoing beam. Ground walking
      // collision is unrelated: the puzzle's light travels above scenery.
      if (Object.values(placements ?? {}).some((placed) =>
        placed.x === x && placed.y === y && placed.z === z)) return false;
    }
    return true;
  }

  // Keep every numbered solution honest, including the independent cyan and
  // blue rays that branch away from a route's last mirror. This runs at plugin
  // load so a bad later-puzzle source cannot survive until a full live replay.
  function validateLibraryRoutes() {
    for (const seal of LIBRARY_SEAL_DATA) {
      if (seal.steps.length !== seal.targets.length) {
        throw new Error(`Incomplete ${seal.name} light-puzzle route: every operation needs a pillar.`);
      }
      const placements = {};
      for (let step = 0; step < seal.steps.length; step++) {
        const operation = seal.steps[step];
        const [x, y, z] = seal.targets[step] ?? [];
        if ((!LIBRARY_OPERATIONS[operation] && !Object.hasOwn(LIBRARY_CRYSTAL_ITEMS, operation)) ||
          !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
          throw new Error(`Invalid ${seal.name} light-puzzle step ${step + 1}.`);
        }
        const branch = seal.branches?.[step];
        const previous = branch?.fromStep !== undefined
          ? Object.values(placements).find((placed) => placed.step === branch.fromStep) ?? null
          : branch?.source
            ? { x: branch.source[0], y: branch.source[1], z: branch.source[2], direction: branch.direction }
            : Object.values(placements).at(-1) ?? {
              x: seal.source[0], y: seal.source[1], z: seal.source[2], direction: seal.sourceDirection,
            };
        const key = `${x},${y},${z}`;
        if (Object.hasOwn(placements, key) || !beamReaches(previous, { x, y, z }, null, placements)) {
          throw new Error(`Unreachable ${seal.name} light-puzzle step ${step + 1}; check its independent beam source.`);
        }
        placements[key] = {
          operation,
          direction: LIBRARY_OPERATIONS[operation] ?? previous?.direction ?? "",
          x, y, z, step,
        };
      }
    }
  }
  validateLibraryRoutes();

  function dispenserCollect(event) {
    const player = event?.player;
    if (!player || !inLibrary(player) || quest.isComplete(player)) return false;
    const sealIndex = currentLibrarySeal(player);
    if (sealIndex < 0) return false;
    event.handled = true;
    const inventory = player.getInventory();
    const seal = LIBRARY_SEAL_DATA[sealIndex];
    const mirrors = seal.steps.filter((step) => LIBRARY_OPERATIONS[step]).length;
    const colors = seal.steps.filter((step) => LIBRARY_CRYSTAL_ITEMS[step]);
    const supplies = [[ItemIdentifiers.HAND_MIRROR_2, mirrors], ...[...new Set(colors)].map((color) =>
      [LIBRARY_CRYSTAL_ITEMS[color], colors.filter((entry) => entry === color).length])];
    const neededSlots = supplies.filter(([id, amount]) => inventory.getAmount(id) < amount).length;
    if (inventory.getFreeSlots() < neededSlots) {
      player.sendMessage(`You need ${neededSlots} free inventory spaces to collect the ${seal.name} puzzle tools.`);
      return true;
    }
    for (const [id, amount] of supplies) {
      const missing = amount - inventory.getAmount(id);
      if (missing > 0) inventory.adds(id, missing);
    }
    player.setAttribute(LIBRARY_MIRRORS, mirrors);
    player.setAttribute(LIBRARY_CRYSTALS, colors.join(","));
    player.setAttribute(LIBRARY_PUZZLE, `${sealIndex}:0`);
    player.setAttribute(LIBRARY_PILLAR_STATE, "{}");
    player.sendMessage(`You collect ${mirrors} hand mirrors and the crystals needed to direct light to the Seal of ${seal.name[0].toUpperCase()}${seal.name.slice(1)}.`);
    return true;
  }

  function isLibraryPillar(player, objectId, location, seal) {
    if (!inLibrary(player) || !location || !seal) return false;
    const definition = api.core.ObjectDefinition?.forPlayer?.(objectId, player);
    const cacheName = definition?.getName?.() ?? definition?.name;
    // The item-on-object hook already selected the visible Pillar of Light
    // name. Static library locs can have a different raw map id from their
    // resolved menu variant, so do not require that variant id to equal the
    // map object's parent id here; the exact seal route validates the tile.
    return cacheName === "Pillar of Light" || LIBRARY_PILLAR_IDS.has(objectId);
  }

  function submitLibraryOperation(player, sealIndex, operation, location) {
    const seal = LIBRARY_SEAL_DATA[sealIndex];
    const state = libraryPuzzleState(player);
    if (currentLibrarySeal(player) !== sealIndex || state.seal !== sealIndex || state.step >= seal.steps.length) return;
    const target = seal.targets?.[state.step];
    if (target && (!location || target[0] !== location.x || target[1] !== location.y || target[2] !== location.z)) {
      resetLibraryPuzzle(player, sealIndex);
      player.sendMessage("The light has reached a different pillar. Return to the numbered route and direct it from the correct pillar.");
      return;
    }
    if (seal.steps[state.step] !== operation) {
      resetLibraryPuzzle(player, sealIndex);
      player.sendMessage("The light scatters. The seal's mirror sequence has reset; follow the beam from its source and try again.");
      return;
    }
    const next = state.step + 1;
    if (location) {
      const key = `${location.x},${location.y},${location.z}`;
      const placements = libraryPillarState(player);
      if (Object.hasOwn(placements, key)) {
        resetLibraryPuzzle(player, sealIndex);
        player.sendMessage("The beam returns to a mirror you have already placed. The seal's route resets; use a fresh pillar for each turn.");
        return;
      }
      const branch = seal.branches?.[state.step];
      const previous = branch?.fromStep !== undefined
        ? Object.values(placements).find((placed) => placed.step === branch.fromStep) ?? null
        : branch?.source
          ? { x: branch.source[0], y: branch.source[1], z: branch.source[2], direction: branch.direction }
          : Object.values(placements).at(-1) ?? (seal.source ? {
            x: seal.source[0], y: seal.source[1], z: seal.source[2], direction: seal.sourceDirection,
          } : null);
      if (!beamReaches(previous, location, player.getArea(), placements)) {
        resetLibraryPuzzle(player, sealIndex);
        player.sendMessage("The beam cannot reach that pillar from the previous mirror. The seal's route resets; follow the lit beam to the next pillar.");
        return;
      }
      placements[key] = { operation, direction: LIBRARY_OPERATIONS[operation] ?? previous?.direction ?? "", x: location.x, y: location.y, z: location.z, step: state.step };
      player.setAttribute(LIBRARY_PILLAR_STATE, JSON.stringify(placements));
    }
    player.setAttribute(LIBRARY_PUZZLE, `${sealIndex}:${next}`);
    player.sendMessage(next === seal.steps.length
      ? `The beam reaches the Seal of ${seal.name[0].toUpperCase()}${seal.name.slice(1)}. Touch it to receive the memory.`
      : "The light bends along the passage. Follow its new direction to the next pillar.");
  }

  function useLibraryMirror(event) {
    const player = event?.player;
    if (!player || !inLibrary(player)) return false;
    const sealIndex = currentLibrarySeal(player);
    if (sealIndex < 0) return false;
    const seal = LIBRARY_SEAL_DATA[sealIndex];
    const state = libraryPuzzleState(player);
    const loc = event.location;
    // A library pillar is commonly a transformed loc. The generic item-on-
    // object event retains the raw parent id in objectId; its definition is
    // the visible cache variant the player actually used.
    const visibleObjectId = event.definition?.id ??
      api.core.ObjectDefinition?.forPlayer?.(event.objectId, player)?.id ?? event.objectId;
    if (!isLibraryPillar(player, visibleObjectId, loc, seal)) return false;
    if (state.seal !== sealIndex || !LIBRARY_OPERATIONS[seal.steps[state.step]]) {
      player.sendMessage("This pillar is not where the current beam needs to be redirected.");
      return true;
    }
    if (player.getInventory().getAmount(ItemIdentifiers.HAND_MIRROR_2) < 1) {
      player.sendMessage("You need a hand mirror from the crystal dispenser.");
      return true;
    }
    const choose = (direction) => {
      const current = libraryPuzzleState(player);
      if (current.seal !== sealIndex) return;
      player.getInventory().deleteNumber(ItemIdentifiers.HAND_MIRROR_2, 1);
      submitLibraryOperation(player, sealIndex, LIBRARY_DIRECTIONS[direction], loc);
    };
    api.sendMultiChatboxPrompt(player, "Which direction should the mirror face?",
      "Reflect east", () => choose("east"),
      "Reflect south", () => choose("south"),
      "Reflect west", () => choose("west"),
      "Reflect north", () => choose("north"),
      "More directions...", () => api.sendMultiChatboxPrompt(player, "Choose a vertical direction.",
        "Reflect up", () => choose("up"),
        "Reflect down", () => choose("down"),
        "Back", () => useLibraryMirror(event)));
    event.handled = true;
    return true;
  }

  function useLibraryCrystal(event) {
    const player = event?.player;
    if (!player || !inLibrary(player)) return false;
    const color = Object.keys(LIBRARY_CRYSTAL_ITEMS).find((name) => LIBRARY_CRYSTAL_ITEMS[name] === event.itemId);
    const sealIndex = currentLibrarySeal(player);
    if (!color || sealIndex < 0) return false;
    const seal = LIBRARY_SEAL_DATA[sealIndex];
    const state = libraryPuzzleState(player);
    if (!isLibraryPillar(player, event.objectId, event.location, seal)) return false;
    if (state.seal !== sealIndex || seal.steps[state.step] !== color) {
      player.sendMessage("The crystal colour does not match the light at this pillar.");
      event.handled = true;
      return true;
    }
    player.getInventory().deleteNumber(event.itemId, 1);
    submitLibraryOperation(player, sealIndex, color, event.location);
    event.handled = true;
    return true;
  }

  function touchLibrarySeal(event) {
    const player = event?.player;
    if (!player || !inLibrary(player)) return false;
    const completed = Number(player.getAttribute(LIBRARY_SEALS)) || 0;
    if (event.objectId === ObjectIdentifiers.SEAL_OF_THE_FORGOTTEN) {
      if (completed & 1) return startTranscript(api, player, NpcIdentifiers.MEMORY_OF_SEREN, PAGE,
        "the-grand-library-of-prifddinas-the-seal-of-the-forgotten-talking-to-the-memory-again");
      player.setAttribute(LIBRARY_SEALS, completed | 1);
      resetLibraryPuzzle(player, 0);
      return startTranscript(api, player, NpcIdentifiers.MEMORY_OF_SEREN, PAGE, "the-grand-library-of-prifddinas-the-seal-of-the-forgotten");
    }
    const index = LIBRARY_SEAL_DATA.findIndex((seal) => seal.id === event.objectId || seal.mapId === event.objectId);
    if (index < 0) return false;
    const seal = LIBRARY_SEAL_DATA[index];
    if (completed & (1 << (index + 1))) {
      return startTranscript(api, player, seal.memory, PAGE, `the-grand-library-of-prifddinas-the-seal-of-${seal.name}`);
    }
    const state = libraryPuzzleState(player);
    if (currentLibrarySeal(player) !== index || state.seal !== index || state.step < seal.steps.length ||
      Object.keys(libraryPillarState(player)).length !== seal.steps.length) {
      player.sendMessage("The seal remains dark. Direct every beam of light to it first.");
      return true;
    }
    player.setAttribute(LIBRARY_SEALS, completed | (1 << (index + 1)));
    resetLibraryPuzzle(player, index + 1);
    const done = LIBRARY_SEAL_DATA.every((_, sealIndex) => (Number(player.getAttribute(LIBRARY_SEALS)) & (1 << (sealIndex + 1))) !== 0);
    if (done) setChapter(player, 13);
    startTranscript(api, player, seal.memory, PAGE, `the-grand-library-of-prifddinas-the-seal-of-${seal.name}`);
    return true;
  }

  function handleLibraryObject(event) {
    const player = event?.player;
    if (!player || !inLibrary(player)) return false;
    if (event.objectId === ObjectIdentifiers.CRYSTAL_DISPENSER_3) return dispenserCollect(event);
    if (event.objectId === ObjectIdentifiers.SEAL_OF_THE_FORGOTTEN ||
      LIBRARY_SEAL_DATA.some((seal) => seal.id === event.objectId || seal.mapId === event.objectId)) return touchLibrarySeal(event);
    return false;
  }

  function crossLibraryFloatingBooks(event) {
    const player = event?.player;
    const location = event?.location;
    if (!player || !inLibrary(player) || !location || location.z !== 2 ||
      player.getSkillManager().getMaxLevel(Skill.AGILITY) < 70) return false;
    // The cache models the two ends of the top-floor handhold as separate
    // climbable objects. Crossing the books is an Agility shortcut, not a
    // ground collision bypass: land on the matching far-end cache tile.
    const endpoints = new Map([
      ["2598,6173", [2606, 6173]], ["2606,6173", [2598, 6173]],
      ["2640,6101", [2648, 6101]], ["2648,6101", [2640, 6101]],
    ]);
    const destination = endpoints.get(`${location.x},${location.y}`);
    if (!destination) return false;
    event.handled = true;
    player.moveTo(new Location(destination[0], destination[1], 2));
    player.sendMessage("You cross the floating books to the other side of the library.");
    return true;
  }

  function enterTemplePassage(event) {
    const player = event?.player;
    const location = event?.location;
    const x = location?.x ?? location?.getX?.();
    const y = location?.y ?? location?.getY?.();
    if (!player || event.objectId !== CAMP_CAVE_ID || x !== 2464 || y !== 6081 ||
      !(player.getArea?.() instanceof DwarvenCampArea) || currentChapter(player) !== 19 ||
      player.getAttribute(CAMP_BATTLE) !== true) return false;
    event.handled = true;
    if (player.getAttribute(FRAGMENT_DEFEATED) === true) {
      player.moveTo(CAMP_CENTER);
      player.sendMessage("You return through the passage to the dwarven camp.");
      return true;
    }
    player.setAttribute(TEMPLE_CUTSCENE_STARTED, false);
    // The cache's Ascend cave is the passage the elves used to enter the temple.
    // The tunnel lands west of the Fragment chamber; the player still walks in.
    player.moveTo(new Location(3278, 5918, 1));
    player.sendMessage("You climb through the crack and follow the old passage toward the Temple of Light.");
    return true;
  }

  function ensureDwarvenCamp(player) {
    const existing = player.getAttribute(CAMP_AREA);
    if (existing && !existing.isDestroyed?.()) {
      existing.enter(player);
      return existing;
    }
    const area = new DwarvenCampArea(player.getUsername?.());
    player.setAttribute(CAMP_AREA, area);
    area.enter(player);
    const atFinalBattle = (player.getAttribute(CAMP_DEFENSE_COMPLETE) === true || currentChapter(player) >= 19) &&
      player.getAttribute(FRAGMENT_DEFEATED) !== true;
    const postEssyllt = atFinalBattle && player.getAttribute(CAMP_BATTLE) === true;
    const retryingEssyllt = atFinalBattle && !postEssyllt;
    campInstances.set(area, { player, attackers: new Set(), nextWaveAt: 0, endsAt: 0,
      lastCycle: -1, defending: false, finished: atFinalBattle, essyllt: null,
      pendingArrivalAt: postEssyllt && player.getAttribute(CAMP_ARRIVAL_STARTED) !== true
        ? World.getProcessCycle() + 2 : 0,
      pendingEssylltAt: retryingEssyllt ? World.getProcessCycle() + 2 : 0 });
    const holesFilled = Number(player.getAttribute(CAMP_HOLES)) || 0;
    for (const [index, [x, y]] of CAMP_HOLE_TILES.entries()) {
      const id = holesFilled & (1 << index) ? ObjectIdentifiers.HOLE_59 : CAMP_HOLE_ID;
      const object = new GameObject(id, new Location(x, y, 0), 10, 0, area);
      area.add(object);
      ObjectManager.register(object, true);
      player.getPacketSender().sendObject(object);
    }
    for (const [id, x, y] of [
      [NpcIdentifiers.BAXTORIAN_2, 2444, 6092], [NpcIdentifiers.ELENA_3, 2454, 6091],
      [NpcIdentifiers.NILOOF_2, 2437, 6084], [NpcIdentifiers.KAMEN_2, 2453, 6087],
      [NpcIdentifiers.THORGEL_2, 2441, 6083], [NpcIdentifiers.KLANK_2, 2451, 6094],
      [NpcIdentifiers.GENERAL_HINING_2, 2446, 6094], [NpcIdentifiers.LORD_IEUAN_AMLODD, 2437, 6092],
      [NpcIdentifiers.LADY_CARYS_HEFIN, 2440, 6088], [NpcIdentifiers.LADY_TANGWEN_TRAHAEARN_2, 2442, 6087],
      [NpcIdentifiers.LADY_KELYN_ITHELL_2, 2444, 6097], [NpcIdentifiers.LADY_FFION_MEILYR_2, 2452, 6090],
      [NpcIdentifiers.LORD_PIQUAN_CRWYS_2, 2450, 6084], [NpcIdentifiers.ISLWYN_4, 2438, 6110],
      [NpcIdentifiers.ELUNED_4, 2448, 6089], [NpcIdentifiers.IESTIN_3, 2459, 6089],
    ]) {
      const npc = api.spawnNpc({ id, x, y, z: 0, wanderRadius: 0, owner: player, ownerOnly: true });
      if (npc) area.enter(npc);
    }
    player.moveTo(CAMP_CENTER);
    player.sendMessage("You follow the winding pass to the dwarven camp. The clan elders and resistance are gathering there.");
    return area;
  }

  function spawnCampNpc(area, id, x, y) {
    const state = campInstances.get(area);
    if (!state) return null;
    const npc = api.spawnNpc({ id, x, y, z: 0, wanderRadius: 0, owner: state.player, ownerOnly: true });
    if (npc) area.enter(npc);
    return npc;
  }

  function placeCampExplosive(event) {
    const player = event?.player;
    if (!player || currentChapter(player) !== 17 || event.itemId !== ItemIdentifiers.EXPLOSIVE_POTION) return false;
    const area = player.getArea?.();
    if (!(area instanceof DwarvenCampArea) || area.owner !== player.getUsername?.()) return false;
    const targetLocation = event.location ?? event.object?.getLocation?.();
    const x = targetLocation?.x ?? targetLocation?.getX?.();
    const y = targetLocation?.y ?? targetLocation?.getY?.();
    const index = CAMP_HOLE_TILES.findIndex(([hx, hy]) => hx === x && hy === y);
    if (![CAMP_HOLE_ID, ObjectIdentifiers.HOLE_58].includes(event.objectId) || index < 0) return false;
    event.handled = true;
    const placed = Number(player.getAttribute(CAMP_HOLES)) || 0;
    if (placed & (1 << index)) {
      player.sendMessage("This hole has already been filled with an explosive potion.");
      return true;
    }
    const inventory = player.getInventory();
    if (inventory.getAmount(ItemIdentifiers.EXPLOSIVE_POTION) < 1) {
      player.sendMessage("You need one of Elena's explosive potions to fill this hole.");
      return true;
    }
    inventory.deleteNumber(ItemIdentifiers.EXPLOSIVE_POTION, 1);
    player.setAttribute(CAMP_HOLES, placed | (1 << index));
    const object = event.object;
    const location = object?.getLocation?.() ?? new Location(x, y, 0);
    if (object) ObjectManager.deregister(object, true);
    const filled = new GameObject(ObjectIdentifiers.HOLE_59, location.clone(), 10, object?.getFace?.() ?? 0, area);
    area.add(filled);
    ObjectManager.register(filled, true);
    player.getPacketSender().sendObject(filled);
    player.sendMessage("You place the potion in the hole and gently cover the top with dirt.");
    if ((placed | (1 << index)) === 127) {
      setChapter(player, 18);
      player.sendMessage("All seven charges are in place. Return to Baxtorian and report that the camp is ready.");
    }
    return true;
  }

  function beginCampDefense(player, area) {
    if (!area) return;
    const state = campInstances.get(area);
    if (!state || state.defending || state.finished) return;
    state.defending = true;
    state.endsAt = World.getProcessCycle() + 400; // 240 seconds at the 600ms world tick.
    state.nextWaveAt = World.getProcessCycle();
    state.lastCycle = -1;
    player.setAttribute(CAMP_DEFENSE, state.endsAt);
    player.sendMessage("Iorwerth's forces attack the barricade. Hold the camp for four minutes; draw their warriors and archers away from the barrier.");
    spawnCampAttacker(area, state);
  }

  function spawnCampAttacker(area, state) {
    const cycle = World.getProcessCycle();
    state.nextWaveAt = cycle + 7;
    const ranged = Math.random() < 0.45;
    const index = state.attackers.size;
    const npc = api.spawnNpc({ id: ranged ? NpcIdentifiers.IORWERTH_ARCHER_10 : NpcIdentifiers.IORWERTH_WARRIOR_12,
      // The statue line north of the camp blocks direct melee routes. Keep the
      // spawned raiders on the open approach beside the player's barricade.
      x: 2444 + (index % 2), y: 6105 + (index % 3), z: 0, wanderRadius: 0,
      owner: state.player, ownerOnly: true });
    if (!npc) return;
    npc.setMultiCombat?.(true);
    area.enter(npc);
    state.attackers.add(npc);
    npc.getCombat().attack(state.player);
  }

  function finishCampDefense(area, state) {
    if (state.finished) return;
    state.defending = false;
    state.finished = true;
    state.player.setAttribute(CAMP_DEFENSE_COMPLETE, true);
    for (const npc of state.attackers) api.removeNpc(npc);
    state.attackers.clear();
    state.player.setAttribute(CAMP_DEFENSE, 0);
    state.player.sendMessage("The dwarves finish sealing the tunnel. The camp has held for four minutes.");
    state.rebel = spawnCampNpc(area, NpcIdentifiers.REBEL_WARRIOR_8, 2444, 6096);
    state.player.sendMessage("Elena has an urgent message after the siege. Speak to her.");
  }

  function beginEssylltEncounter(player) {
    const area = player.getAttribute(CAMP_AREA);
    const state = area && campInstances.get(area);
    if (!state || !state.finished || state.essyllt) return;
    const boss = api.spawnNpc({ id: NpcIdentifiers.ESSYLLT_5, x: 2448, y: 6118, z: 0, wanderRadius: 0,
      owner: player, ownerOnly: true });
    if (!boss) {
      player.sendMessage("Essyllt could not be reached in the chaos. Speak to Elena to draw him out again.");
      return;
    }
    boss.setMultiCombat?.(true);
    area.enter(boss);
    state.essyllt = boss;
    setChapter(player, 19);
    for (const [id, x, y] of [[NpcIdentifiers.IORWERTH_WARRIOR_12, 2446, 6117],
      [NpcIdentifiers.IORWERTH_WARRIOR_12, 2449, 6117]]) {
      const guard = api.spawnNpc({ id, x, y, z: 0, wanderRadius: 0, owner: player, ownerOnly: true });
      if (!guard) continue;
      guard.setMultiCombat?.(true);
      area.enter(guard);
      (state.essylltAdds ??= new Set()).add(guard);
      guard.getCombat().attack(player);
    }
    boss.getCombat().attack(player);
  }

  function spawnPostEssylltArrival(player) {
    const area = player.getAttribute(CAMP_AREA);
    const state = area && campInstances.get(area);
    if (!state || state.arrivals) return;
    state.arrivals = true;
    for (const [id, x, y] of [[NpcIdentifiers.LORD_IORWERTH_2, 2448, 6110],
      [NpcIdentifiers.ARIANWYN_2, 2447, 6112], [NpcIdentifiers.IORWERTH_WARRIOR_12, 2446, 6112],
      [NpcIdentifiers.IORWERTH_WARRIOR_12, 2449, 6112], [NpcIdentifiers.IORWERTH_ARCHER_10, 2445, 6113],
      [NpcIdentifiers.IORWERTH_ARCHER_10, 2450, 6113]]) spawnCampNpc(area, id, x, y);
  }

  function handleCampDeath(event) {
    const npc = event?.npc;
    const area = npc?.getArea?.();
    const state = area && campInstances.get(area);
    if (!state || !state.player || event?.killer !== state.player) return false;
    if (state.attackers.delete(npc)) return true;
    if (state.essylltAdds?.delete(npc)) return true;
    if (npc !== state.essyllt) return false;
    state.essyllt = null;
    state.player.setAttribute(CAMP_BATTLE, true);
    // Let the death animation and combat cleanup finish before the cutscene
    // replaces the active dialogue manager. Its first action owns the arrivals.
    state.pendingArrivalAt = World.getProcessCycle() + 2;
    return true;
  }

  function handleQuestPlayerDeath(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return;
    const camp = player.getAttribute(CAMP_AREA);
    const campState = camp && campInstances.get(camp);
    if (campState?.essyllt) {
      api.removeNpc(campState.essyllt);
      campState.essyllt = null;
      for (const npc of campState.essylltAdds ?? []) api.removeNpc(npc);
      campState.essylltAdds?.clear();
      campState.pendingEssylltAt = World.getProcessCycle() + 4;
    }
    const area = player.getAttribute(FRAGMENT_AREA);
    const state = area && fragmentInstances.get(area);
    if (!state || state.player !== player || state.finished) return;
    state.finished = true;
    for (const npc of [...state.healers, ...state.clones, state.boss]) api.removeNpc(npc);
    state.healers.clear();
    state.clones = [];
    fragmentInstances.delete(area);
    area.leave(player, false);
    player.setAttribute(FRAGMENT_AREA, null);
    player.setAttribute(TEMPLE_CUTSCENE_STARTED, false);
    ensureDwarvenCamp(player);
    player.moveTo(CAMP_CENTER);
    player.sendMessage("You can return through the cave by the camp and face the Fragment again.");
  }

  function spawnBattleWave(player, area, wave) {
    const westWaveOne = Array.from({ length: 10 }, (_, i) => ({
      id: NpcIdentifiers.MOURNER_2,
      x: 2531 + (i % 5) * 2,
      y: 3297 + Math.floor(i / 5) * 3,
    }));
    const westWaveTwo = Array.from({ length: 11 }, (_, i) => ({
      id: i < 6 ? NpcIdentifiers.MOURNER_3 : NpcIdentifiers.MOURNER_4,
      x: 2530 + (i % 4) * 2,
      y: 3311 + Math.floor(i / 4) * 2,
    }));
    const eastWave = Array.from({ length: 15 }, (_, i) => ({
      id: i < 8 ? NpcIdentifiers.PALADIN_5 : (i < 12 ? NpcIdentifiers.PALADIN_6 : NpcIdentifiers.KNIGHT_OF_ARDOUGNE),
      x: 2581 + (i % 5) * 2,
      y: 3290 + Math.floor(i / 5) * 3,
    }));
    const waveNpcs = area.battle === "west" ? (wave === 0 ? westWaveOne : westWaveTwo) : eastWave;
    let target = 0;
    for (const spawn of waveNpcs) {
      const npc = api.spawnNpc({ ...spawn, z: 0, wanderRadius: 2, owner: player, ownerOnly: true });
      if (npc) {
        npc.setMultiCombat?.(true);
        area.enter(npc);
        target++;
      }
    }
    battleInstances.set(area, { player, battle: area.battle, wave, kills: 0, target });
  }

  function startBattle(player, battle) {
    const existing = player.getAttribute(BATTLE_AREA);
    if (existing && existing.isDestroyed?.() !== true) return;
    const area = new ArdougneBattleArea(battle, player.getUsername?.());
    player.setAttribute(BATTLE_AREA, area);
    area.enter(player);
    const start = battle === "west" ? new Location(2529, 3293, 0) : new Location(2579, 3286, 0);
    player.moveTo(start);
    spawnBattleWave(player, area, 0);
    player.sendMessage(battle === "west"
      ? "The resistance storms the Mourner headquarters. Defeat the mourners on the ground floor."
      : "The resistance storms East Ardougne. Defeat the paladins and knights protecting the castle.");
  }

  function handleBattleDeath(event) {
    if (handleFragmentDeath(event)) return;
    if (handleCampDeath(event)) return;
    const player = event?.killer;
    const npc = event?.npc;
    if (!player || !npc || quest.isComplete(player)) return;
    const area = npc.getArea?.();
    const instance = area && battleInstances.get(area);
    if (instance && instance.player === player) {
      instance.kills++;
      if (instance.kills < instance.target) return;
      if (instance.battle === "west" && instance.wave === 0) {
        player.sendMessage("The mourners on the ground floor have fallen. Continue into the basement.");
        startTranscript(api, player, 0, PAGE, "battle-of-two-ardougnes-west-ardougne-after-killing-10-mourners-on-the-ground-level");
        spawnBattleWave(player, area, 1);
        return;
      }
      if (instance.battle === "west") {
        player.setAttribute(WEST_BATTLE_KILLS, 21);
        quest.setStage(player, STAGE.STARTED + 60);
        player.sendMessage("The Mourner headquarters is clear. Return to Elena and Councillor Halgrive.");
        startTranscript(api, player, 0, PAGE, "battle-of-two-ardougnes-west-ardougne-after-killing-11-mourners-in-the-basement");
        area.leave(player, false);
        player.setAttribute(BATTLE_AREA, null);
        player.moveTo(new Location(2535, 3304, 0));
        return;
      }
      player.setAttribute(EAST_BATTLE_KILLS, 15);
      quest.setStage(player, STAGE.STARTED + 70);
      player.sendMessage("The paladins and knights have fallen. King Lathas is exposed.");
      startTranscript(api, player, 0, PAGE, "battle-of-two-ardougnes-east-ardougne-after-killing-15-paladins-and-knights");
      area.leave(player, false);
      player.setAttribute(BATTLE_AREA, null);
      player.moveTo(new Location(2585, 3295, 0));
      return;
    }
  }

  function startFragmentBattle(player) {
    const existing = player.getAttribute(FRAGMENT_AREA);
    if (existing && existing.isDestroyed?.() !== true) return true;
    const area = new FragmentArea(player.getUsername?.());
    const spawn = new Location(3294, 5918, 1);
    const boss = api.spawnNpc({ id: NpcIdentifiers.FRAGMENT_OF_SEREN_3, x: 3294, y: 5918, z: 1,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!boss) {
      player.sendMessage("The Fragment of Seren could not be reached. Return to Arianwyn and try again.");
      return false;
    }
    boss.setMultiCombat?.(true);
    boss.setMaxHitpoints(1000);
    boss.setHitpoints(1000);
    area.enter(player);
    area.enter(boss);
    player.setAttribute(FRAGMENT_AREA, area);
    player.setAttribute(FRAGMENT_DEFEATED, false);
    player.moveTo(spawn);
    fragmentInstances.set(area, {
      player, boss, area, lastCycle: -1, nextSpecialAt: World.getProcessCycle() + 12,
      nextBasicAttackAt: World.getProcessCycle() + 4,
      clones: [], realClone: null, cloneThresholds: [666, 333], introStarted: false,
      healerThresholds: [666, 333], healers: new Set(), specialImpactAt: 0, finished: false,
    });
    player.sendMessage("The Fragment of Seren emerges. Watch for its teleport, true echo, healing whirlwinds, and devastating blast.");
    return true;
  }

  const FRAGMENT_AREA = "quest.song_of_the_elves.fragment-area";

  function spawnFragmentAdds(area, ids, points) {
    const state = fragmentInstances.get(area);
    if (!state) return [];
    const spawned = [];
    for (const [index, id] of ids.entries()) {
      const [x, y] = points[index];
      const npc = api.spawnNpc({ id, x, y, z: 1, wanderRadius: 0, owner: state.player, ownerOnly: true });
      if (!npc) continue;
      npc.setMultiCombat?.(true);
      npc.setMaxHitpoints(1);
      npc.setHitpoints(1);
      area.enter(npc);
      spawned.push(npc);
    }
    return spawned;
  }

  function spawnFragmentClones(area, state) {
    state.cloneThresholds.shift();
    state.clones = spawnFragmentAdds(area, [
      NpcIdentifiers.FRAGMENT_OF_SEREN, NpcIdentifiers.FRAGMENT_OF_SEREN_2,
    ], [[3290, 5918], [3298, 5918]]);
    state.realClone = state.clones[Math.floor(Math.random() * state.clones.length)] ?? null;
    state.boss.sendMessage?.("The Fragment splits into two echoes. One is real; strike the true one before they fade.");
    state.player.sendMessage("The Fragment divides. Strike the true echo; the false one cannot be harmed.");
  }

  function spawnFragmentHealers(area, state) {
    state.healerThresholds.shift();
    state.healers = new Set(spawnFragmentAdds(area, [NpcIdentifiers.COL_00FFFF_CRYSTAL_WHIRLWIND_COL, NpcIdentifiers.COL_00FFFF_CRYSTAL_WHIRLWIND_COL],
      [[3289, 5922], [3299, 5922]]));
    state.player.sendMessage("Two Crystal Whirlwinds appear. They heal the Fragment while they remain; attack them to stop the healing.");
  }

  function zeroHit(hit) {
    for (const part of hit?.getHits?.() ?? []) part.setDamage(0);
    hit?.updateTotalDamage?.();
  }

  function handleFragmentHit(event) {
    const npc = event?.npc;
    const hit = event?.hit;
    const state = npc && fragmentInstances.get(npc.getArea?.());
    if (!state || state.finished || !hit) return;
    const attacker = hit.getAttacker?.();
    if (!attacker?.isPlayer?.() || attacker.getUsername?.() !== state.player.getUsername?.()) {
      zeroHit(hit);
      return;
    }
    if (state.healers.has(npc)) {
      const remaining = npc.getHitpoints?.() ?? 1;
      const damage = hit.getTotalDamage?.() ?? 0;
      if (damage > 0) {
        for (const part of hit.getHits?.() ?? []) if (part.getDamage() > 0) part.setDamage(Math.max(remaining, part.getDamage()));
        hit.updateTotalDamage?.();
      }
      return;
    }
    if (state.clones.includes(npc)) {
      if (npc !== state.realClone) zeroHit(hit);
      return;
    }
    if (npc !== state.boss) return;
    if (state.realClone) {
      zeroHit(hit);
      attacker.sendMessage("Destroy the true echo before attacking the Fragment again.");
      return;
    }
    // Seren's fragment has a hard 24 damage cap per hit, regardless of style.
    for (const part of hit.getHits?.() ?? []) {
      if (part.getDamage() > 24) part.setDamage(22 + Math.floor(Math.random() * 3));
    }
    hit.updateTotalDamage?.();
  }

  function queueFragmentBlast(state) {
    const player = state.player;
    const max = player.getSkillManager().getMaxLevel(Skill.HITPOINTS);
    const hp = player.getSkillManager().getCurrentLevel(Skill.HITPOINTS);
    const damage = Math.max(1, max - 1);
    player.getCombat().getHitQueue().addPendingDamage([new HitDamage(damage, HitMask.RED).setSource(state.boss)]);
    player.sendMessage(hp <= damage
      ? "The Fragment's blast leaves you barely standing."
      : "Your overhealed vitality lets you endure the Fragment's blast.");
  }

  function resolveFragmentSpecial(area, state, now) {
    if (state.followupAt && now >= state.followupAt) {
      state.followupAt = 0;
      if (state.player.getLocation().getDistance(state.boss.getLocation()) <= 1) {
        const damage = 8 + Math.floor(Math.random() * 13);
        state.player.getCombat().getHitQueue().addPendingDamage([
          new HitDamage(damage, HitMask.RED).setSource(state.boss),
        ]);
        state.player.sendMessage("The Fragment's melee strike catches you before you can escape.");
      } else {
        state.player.sendMessage("You dodge the Fragment's follow-up strike.");
      }
      state.nextSpecialAt = now + 22;
      return;
    }
    state.nextSpecialAt = now + 24;
    if (state.specialImpactAt && now >= state.specialImpactAt) {
      state.specialImpactAt = 0;
      queueFragmentBlast(state);
      return;
    }
    if (state.specialImpactAt) return;
    state.specialCount = (state.specialCount || 0) + 1;
    if (state.specialCount % 4 === 0) {
      state.player.sendMessage("The Fragment gathers a devastating burst of magic. Restore your health before it lands!");
      state.specialImpactAt = now + 3;
      state.nextSpecialAt = now + 3;
      return;
    }
    const loc = state.player.getLocation();
    if (loc.getDistance(state.boss.getLocation()) > 3) {
      state.player.sendMessage("The Fragment tries to pull you close, but you are out of its reach.");
      return;
    }
    state.player.sendMessage("The Fragment teleports you beside it and winds up a melee strike. Step away before it lands!");
    state.player.moveTo(new Location(3294, 5918, 1));
    state.followupAt = now + 2;
    state.nextSpecialAt = now + 2;
  }

  function handleFragmentDeath(event) {
    const npc = event?.npc;
    const state = npc && fragmentInstances.get(npc.getArea?.());
    if (!state || state.finished) return false;
    if (state.healers.delete(npc)) return true;
    if (state.clones.includes(npc)) {
      if (npc !== state.realClone) return true;
      state.realClone = null;
      for (const clone of state.clones) if (clone !== npc) api.removeNpc(clone);
      state.clones = [];
      state.player.sendMessage("The false echoes vanish. The Fragment is vulnerable again.");
      if (state.healerThresholds.length && state.boss.getHitpoints() <= state.healerThresholds[0]) {
        spawnFragmentHealers(state.area, state);
      }
      return true;
    }
    if (npc !== state.boss) return false;
    state.finished = true;
    state.player.setAttribute(FRAGMENT_DEFEATED, true);
    for (const add of [...state.healers, ...state.clones]) api.removeNpc(add);
    state.healers.clear();
    state.clones = [];
    const area = npc.getArea?.();
    area?.leave(state.player, false);
    state.player.setAttribute(FRAGMENT_AREA, null);
    fragmentInstances.delete(area);
    state.player.moveTo(new Location(3278, 5918, 1));
    startTranscript(api, state.player, NpcIdentifiers.LORD_IORWERTH, PAGE, "the-fragment-of-seren-the-fragment-defeated");
    return true;
  }

  function searchElenaCabinet(event) {
    const player = event?.player;
    const loc = event?.location;
    if (!player || currentChapter(player) !== 2 || quest.isComplete(player)) return false;
    if (loc && (loc.x < 2588 || loc.x > 2597 || loc.y < 3328 || loc.y > 3342)) return false;
    return startTranscript(api, player, 0, PAGE, "freeing-elena-searching-her-cabinet");
  }

  function searchRehnisonBed(event) {
    const player = event?.player;
    if (!player || currentChapter(player) !== 3 || quest.isComplete(player)) return false;
    const loc = event.location;
    if (loc && (loc.x < 2522 || loc.x > 2541 || loc.y < 3320 || loc.y > 3344)) return false;
    return startTranscript(api, player, 0, PAGE, "meet-the-ardougne-resistance-planning-a-revolution-searching-the-bed");
  }

  function enterResistanceBasement(event) {
    const player = event?.player;
    const loc = event?.location;
    if (!player || !loc || currentChapter(player) !== 3 || quest.isComplete(player) ||
      loc.x < 2522 || loc.x > 2541 || loc.y < 3320 || loc.y > 3344) return;
    event.handled = true;
    player.moveTo(new api.core.Location(2537, 9745, 0));
    player.setAttribute(RESISTANCE_BRIEFING, true);
    startTranscript(api, player, 0, PAGE, "meet-the-ardougne-resistance-planning-a-revolution-entering-the-hidden-basement");
  }

  function enterPrison(event) {
    const player = event?.player;
    const loc = event?.location;
    if (!player || !loc || loc.x !== 2569 || loc.y !== 3295 || currentChapter(player) > 2 || currentChapter(player) < 1) return;
    if (currentChapter(player) === 1 && !wearingDisguise(player)) {
      event.handled = true;
      player.sendMessage("Only Knights of Ardougne are allowed in the prison.");
      return;
    }
    if (currentChapter(player) === 1) {
      event.handled = true;
      quest.setStage(player, STAGE.STARTED + 20);
      // The castle stairs enter the separate basement map square; place the
      // player by Elena's northern cell so the next step is an actual NPC talk.
      player.moveTo(new Location(2541, 9672, 0));
      startTranscript(api, player, NpcIdentifiers.KNIGHT_OF_ARDOUGNE_3, PAGE, "freeing-elena-upon-entering-the-prison");
    }
  }

  // These cache staircases are partly blocked by the castle collision map. Send
  // the click to the open side of the stair, then let the normal climb task play
  // with the landing paired to the opposite floor's stair.
  function routeCastleThroneStairs(event) {
    const object = event?.object;
    const tile = object?.getLocation?.();
    const x = tile?.getX?.();
    const y = tile?.getY?.();
    const z = event?.sourceLocation?.z;
    const up = event?.objectId === 15645 && x === 2571 && y === 3295 && z === 0;
    const down = event?.objectId === 15648 && x === 2571 && y === 3295 && z === 1;
    if (!up && !down) return;
    // There is no walkable interaction tile beside the colliding staircase.
    // Keep the click at the player's current tile; `ladders:climb` performs the
    // same paired-floor transition as the cache staircase action.
    event.destination = { ...event.sourceLocation };
  }

  function claimCastleThroneStairs(event) {
    const tile = event?.object?.getLocation?.();
    const x = tile?.getX?.();
    const y = tile?.getY?.();
    const z = event?.player?.getLocation?.()?.getZ?.();
    if (x !== 2571 || y !== 3295) return;
    if (event.objectId === 15645 && z === 0) {
      api.emitCustomEvent("ladders:climbUp", { player: event.player, destination: new Location(2575, 3293, 1) });
      event.handled = true;
    } else if (event.objectId === 15648 && z === 1) {
      api.emitCustomEvent("ladders:climbDown", { player: event.player, destination: new Location(2575, 3293, 0) });
      event.handled = true;
    }
  }

  function handleItemOnItem(event) {
    if (!event?.player || quest.getStage(event.player) < 20 || quest.isComplete(event.player)) return;
    const pair = [event.usedItemId, event.usedWithItemId];
    const inventory = event.player.getInventory();
    const hasPair = (first, second) => pair.includes(first) && pair.includes(second);
    if (hasPair(ItemIdentifiers.PESTLE_AND_MORTAR, ItemIdentifiers.CRYSTAL_5) && currentChapter(event.player) === 11) {
      event.handled = true;
      inventory.deleteNumber(ItemIdentifiers.CRYSTAL_5, 1);
      inventory.adds(ItemIdentifiers.CRYSTAL_DUST, 1);
      event.player.sendMessage("You grind the old crystal into crystal dust.");
      return;
    }
    if (hasPair(ItemIdentifiers.ELDER_CADANTINE, ItemIdentifiers.VIAL_OF_WATER) && currentChapter(event.player) === 11) {
      event.handled = true;
      inventory.deleteNumber(ItemIdentifiers.ELDER_CADANTINE, 1);
      inventory.deleteNumber(ItemIdentifiers.VIAL_OF_WATER, 1);
      inventory.adds(ItemIdentifiers.ELDER_CADANTINE_POTION_UNF_, 1);
      event.player.sendMessage("You add the elder cadantine to the vial of water.");
      return;
    }
    if (hasPair(ItemIdentifiers.CRYSTAL_DUST, ItemIdentifiers.ELDER_CADANTINE_POTION_UNF_) && currentChapter(event.player) === 11) {
      event.handled = true;
      inventory.deleteNumber(ItemIdentifiers.CRYSTAL_DUST, 1);
      inventory.deleteNumber(ItemIdentifiers.ELDER_CADANTINE_POTION_UNF_, 1);
      inventory.adds(ItemIdentifiers.INVERSION_POTION, 1);
      event.player.sendMessage("You mix the crystal dust into the unfinished potion, making an inversion potion.");
      return;
    }
    const isHelm = pair.includes(DISGUISE.RED_DYE) && pair.includes(DISGUISE.STEEL_HELM);
    const isBody = pair.includes(DISGUISE.TABARD) && pair.includes(DISGUISE.STEEL_BODY);
    if (!isHelm && !isBody) return;
    event.handled = true;
    const variant = isHelm
      ? "making-a-knightly-disguise-dying-the-steel-full-helm"
      : "making-a-knightly-disguise-using-tabard-on-steel-platebody";
    startTranscript(api, event.player, 0, PAGE, variant);
  }

  function handleItemOnNpc(event) {
    const player = event?.player;
    if (!player || currentChapter(player) !== 11 || quest.isComplete(player)) return;
    const npcName = String(event.target?.getName?.() ?? event.target?.getCurrentDefinition?.(player)?.getName?.() ?? "");
    if (!/^Elderly Elf$/i.test(npcName) || ![ItemIdentifiers.HAMMER, ItemIdentifiers.RUNITE_BAR].includes(event.itemId)) return;
    event.handled = true;
    startTranscript(api, player, event.npcId, PAGE, "preparing-to-enter-prifddinas-finding-lady-trahaearn-repairing-the-exoskeleton");
  }

  function handleCrystalSeedAction(event) {
    const player = event?.player;
    if (!player || event.itemId !== ItemIdentifiers.CRYSTAL_SEED_3 || currentChapter(player) !== 11 || quest.isComplete(player)) return;
    event.handled = true;
    startTranscript(api, player, 0, PAGE, "preparing-to-enter-prifddinas-a-mysterious-figure");
  }

  function placeFallsPillarItem(event) {
    const player = event?.player;
    if (!player || currentChapter(player) !== 10 || quest.isComplete(player)) return false;
    const index = PILLAR_ITEMS.findIndex(([id]) => id === event.itemId);
    if (index < 0) return false;
    const location = event.location ?? event.object?.getLocation?.();
    const x = location?.x ?? location?.getX?.();
    const y = location?.y ?? location?.getY?.();
    const z = location?.z ?? location?.getZ?.();
    const pillarIndex = FALLS_PILLAR_LOCATIONS.findIndex(([px, py, pz]) => px === x && py === y && pz === z);
    if (pillarIndex < 0) return false;
    const inventory = player.getInventory();
    if (inventory.getAmount(event.itemId) < 1) return false;
    const order = String(player.getAttribute(FALLS_ORDER) ?? "").split(",").map(Number);
    if (order.length !== PILLAR_ITEMS.length || order.some((value) => !Number.isInteger(value))) {
      player.sendMessage("The riddle in Ode to Eternity is incomplete. Speak to Arianwyn for another copy.");
      return true;
    }
    const bit = 1 << pillarIndex;
    const placed = Number(player.getAttribute(FALLS_PILLARS)) || 0;
    if (placed & bit) {
      player.sendMessage("You have already placed that item on a pillar.");
      return true;
    }
    if (order[pillarIndex] !== index) {
      inventory.deleteNumber(event.itemId, 1);
      player.sendMessage("The light rejects the item. You will need another one to try that pillar again.");
      return true;
    }
    inventory.deleteNumber(event.itemId, 1);
    player.setAttribute(FALLS_PILLARS, placed | bit);
    player.sendMessage(`The ${PILLAR_ITEMS[index][1]} disappears into the numbered pillar.`);
    if ((placed | bit) === (1 << PILLAR_ITEMS.length) - 1) {
      quest.setStage(player, STAGE.STARTED + 110);
      player.sendMessage("A hidden passage opens beneath the waterfall.");
    }
    return true;
  }

  function searchFallsPillar(event) {
    const player = event?.player;
    if (!player || currentChapter(player) !== 10 || quest.isComplete(player)) return false;
    const location = event.object?.getLocation?.();
    const index = FALLS_PILLAR_LOCATIONS.findIndex(([x, y, z]) =>
      x === location?.getX?.() && y === location?.getY?.() && z === location?.getZ?.());
    if (index < 0) return false;
    event.handled = true;
    const order = String(player.getAttribute(FALLS_ORDER) ?? "").split(",").map(Number);
    if (order.length !== PILLAR_ITEMS.length) {
      player.sendMessage("The markings are too faint to read without Ode to Eternity.");
      return true;
    }
    player.sendMessage(`This is pillar ${index + 1}. The riddle calls for ${PILLAR_ITEMS[order[index]][1]} here.`);
    return true;
  }

  function claimFallsPillarLocation(event) {
    const location = event?.location;
    if (FALLS_PILLAR_LOCATIONS.some(([x, y, z]) =>
      x === location?.x && y === location?.y && z === location?.z)) event.claimed = true;
  }

  function lightWestArdougneSacks(event) {
    const player = event?.player;
    const loc = event?.location;
    if (!player || !loc || currentChapter(player) !== 4 || quest.isComplete(player)) return false;
    if (loc.x >= 2628 && loc.x <= 2637 && loc.y >= 3384 && loc.y <= 3388) return lightEastFarmSacks(event);
    const variant = loc.x >= 2540 && loc.x <= 2542 && loc.y >= 3268 && loc.y <= 3278
      ? "causing-an-insurrection-west-ardougne-setting-the-grain-sacks-inside-the-church-on-fire"
      : loc.x >= 2488 && loc.x <= 2490 && loc.y >= 3295 && loc.y <= 3297
        ? "causing-an-insurrection-west-ardougne-setting-the-grain-sacks-outside-the-general-store-on-fire"
        : loc.x >= 2554 && loc.x <= 2556 && loc.y >= 3304 && loc.y <= 3307
          ? "causing-an-insurrection-west-ardougne-setting-the-grain-sacks-in-the-central-civic-office-on-fire"
          : null;
    if (!variant) return false;
    event.handled = true;
    if (!wearingMourner(player)) {
      player.sendMessage("You should wear your mourner disguise before setting the sacks on fire.");
      return true;
    }
    return startTranscript(api, player, 0, PAGE, variant);
  }

  function lightEastFarmSacks(event) {
    const player = event?.player;
    const { x, y } = event?.location ?? {};
    if (!player || currentChapter(player) !== 4 || x < 2628 || x > 2637 || y < 3384 || y > 3388) return false;
    event.handled = true;
    if (!wearingDisguise(player)) {
      player.sendMessage("You should wear your Knight of Ardougne disguise before setting the sacks on fire.");
      return true;
    }
    addResistanceSupport(player, 4, "fire:east-farm");
    player.sendMessage("You set the grain sacks on fire, upsetting the farmers.");
    return true;
  }

  function lightEastDockBarrels(event) {
    const player = event?.player;
    const { x, y } = event?.location ?? {};
    if (!player || currentChapter(player) !== 4 || x < 2600 || x > 2700 || y < 3200 || y > 3400) return false;
    event.handled = true;
    if (!wearingDisguise(player)) {
      player.sendMessage("You should wear your Knight of Ardougne disguise before setting the fish barrels on fire.");
      return true;
    }
    addResistanceSupport(player, 4, "fire:east-docks");
    player.sendMessage("You set the fish barrels on fire, upsetting the dock workers.");
    return true;
  }
  function buildJournal(player) {
    if (quest.isComplete(player)) return ["Prifddinas has been restored.", "The war against the Iorwerth Clan is over."];
    const chapter = currentChapter(player);
    const names = [
      "Free Elena from the Ardougne prison.", "Disguise yourself as a Knight of Ardougne.",
      "Free Elena from the Ardougne prison.", "Meet the Ardougne resistance.",
      "Turn the people against King Lathas.", "Help the resistance overthrow the king.",
      "Fight the battle for East and West Ardougne.", "Confront Lord Iorwerth.",
      "Retreat to Lletya.", "Attend the first meeting.", "Visit Baxtorian Falls.",
      "Prepare to enter Prifddinas.", "Explore the Grand Library.",
      "Report back after the revelations.", "Recover the orb.",
      "Defend Lletya from the Iorwerth Clan.", "Help reunite the elven clans.",
      "Prepare at the dwarf camp.", "Seal the Underground Pass.",
      "Defeat the Fragment of Seren.", "Help rebuild Prifddinas.",
    ];
    const objective = names[Math.max(0, chapter)] ?? names[0];
    return chapter === 4 ? [`${objective} (${resistanceSupport(player)}/80 recruited)`] : [objective];
  }

  const ACTION_CHAPTER = {
    "jtPiC1": 2, "LeWWCS": 3,
    "Rc0W1H": 7, "UeAKgA": 11,
    "x04RMY": 10, "D1wXY6": 11, "EMxiFg": 11,
    "ycGZ1J": 12, "eOtNFO": 12, "koxQh3": 13, "FoLVmk": 14,
    "ZYvQiu": 18, "YAPX-R": 19, "FK0kOz": 19,
  };
  quest = registerQuest(api, {
    key: "song_of_the_elves",
    name: PAGE,
    varpId: 2305,
    varbitId: 9016,
    startedValue: STAGE.STARTED,
    completionValue: STAGE.COMPLETE,
    questPoints: 4,
    otherRewards: [
      "40,000 XP in Agility, Construction, Farming, Herblore, Hunter, Mining, Smithing and Woodcutting",
      "Access to Prifddinas",
      "Ability to change your respawn point to Prifddinas",
    ],
    buildJournal,
    onReward(player) {
      for (const [skill] of REWARD_SKILLS) player.getSkillManager().addExperience(skill, 40000, false);
    },
  });
  api.onNpcDialogueVariant(selectVariant);
  api.onNpcDialogueCondition((event) => {
    if (!event?.player) return null;
    const answer = disguiseCondition(event);
    if (answer !== null) return answer;
    const incitement = recordIncitement(event);
    if (incitement !== null) return incitement;
    if (event.text?.startsWith("If the player") && !requirementsMet(event.player)) return false;
    return null;
  });
  api.onCustomEvent("npc-dialogue:hook", onStart);
  api.onCustomEvent("quest-song-of-the-elves:claim-arianwyn", claimArianwynAfterLibrary);
  api.onCustomEvent("npc-dialogue:action", onAction);
  api.onCustomEvent("npc-dialogue:choice", handleDialogueChoice);
  api.onItemOnItem(handleItemOnItem);
  api.onItemOnNpc(handleItemOnNpc);
  api.onItemOnObject("Explosive potion", "Hole", placeCampExplosive, { noted: false });
  api.onItemAction(handleCrystalSeedAction);
  api.onItemOnObject("Hand mirror", "Pillar of Light", useLibraryMirror, { noted: false });
  for (const color of Object.keys(LIBRARY_CRYSTAL_ITEMS)) {
    const name = color === "fractured" ? "Fractured crystal" : `${color[0].toUpperCase()}${color.slice(1)} crystal`;
    api.onItemOnObject(name, "Pillar of Light", useLibraryCrystal, { noted: false });
  }
  api.onObjectInteraction(handleLibraryObject);
  api.onObjectInteraction("Floating Book", { Climb: crossLibraryFloatingBooks });
  api.onObjectInteraction("Cave", { Ascend: enterTemplePassage });
  api.persistAttribute(CHEMICAL_CHOICE);
  api.persistAttribute(REVELATIONS_MEETING_STARTED);
  api.persistAttribute(FALLS_PILLARS);
  api.persistAttribute(FALLS_ORDER);
  api.persistAttribute(INCITEMENTS);
  api.persistAttribute(RESISTANCE_MEMBERS);
  api.persistAttribute(RESISTANCE_BRIEFING);
  api.persistAttribute(WEST_BATTLE_KILLS);
  api.persistAttribute(EAST_BATTLE_KILLS);
  api.persistAttribute(LATE_CHAPTER);
  api.persistAttribute(VALLEY_FIGURE);
  api.persistAttribute(LIBRARY_SEALS);
  api.persistAttribute(LIBRARY_PUZZLE);
  api.persistAttribute(LIBRARY_MIRRORS);
  api.persistAttribute(LIBRARY_CRYSTALS);
  api.persistAttribute(LIBRARY_PILLAR_STATE);
  api.persistAttribute(RECRUITED_ELDERS);
  api.persistAttribute(MEILYR_CLUE);
  api.persistAttribute(CAMP_HOLES);
  api.persistAttribute(CAMP_EXPLOSIVES);
  api.persistAttribute(CAMP_DEFENSE);
  api.persistAttribute(CAMP_DEFENSE_COMPLETE);
  api.persistAttribute(CAMP_BATTLE);
  api.persistAttribute(CAMP_ARRIVAL_STARTED);
  api.persistAttribute(TEMPLE_CUTSCENE_STARTED);
  api.persistAttribute(FRAGMENT_DEFEATED);
  for (const [, itemName] of PILLAR_ITEMS) {
    api.onItemOnObject(itemName, "Pillar of Light", placeFallsPillarItem, { noted: false });
    api.onItemOnObject(itemName, "Pillar", placeFallsPillarItem, { noted: false });
  }
  api.onItemOnObject("Tinderbox", "Sacks", lightWestArdougneSacks, { noted: false });
  api.onItemOnObject("Tinderbox", "Barrel of fish", lightEastDockBarrels, { noted: false });
  api.onObjectInteraction("Pillar of Light", { Search: searchFallsPillar });
  api.onObjectInteraction("Cabinet", { Search: searchElenaCabinet });
  api.onObjectInteraction("Bed", { Search: searchRehnisonBed });
  api.onObjectInteraction("Trapdoor", { Open: enterResistanceBasement, "Climb-down": enterResistanceBasement });
  api.onObjectInteraction("Staircase", { "Climb-down": enterPrison });
  api.onObjectRoute(routeCastleThroneStairs);
  api.onCustomEvent("ladders:climb", claimCastleThroneStairs);
  api.onCustomEvent("quest:song-of-the-elves:claims-light-pillar", claimFallsPillarLocation);
  api.registerArea(new LletyaStoryArea([new Boundary(2320, 2390, 3150, 3210, 0)]));
  api.registerArea(new DwarvenCampAccessArea([new Boundary(2424, 2472, 6078, 6142, 0)]));
  api.registerArea(new FragmentThresholdArea([new Boundary(3282, 3307, 5906, 5930, 1)]));
  api.onNpcInteraction("Alrena", { "Talk-to": onTalk });
  api.onNpcInteraction("Edmond", { "Talk-to": onTalk });
  api.onNpcInteraction("Elena", { "Talk-to": onTalk });
  api.onNpcInteraction("Knight of Ardougne", { "Talk-to": onTalk });
  for (const name of ["King Lathas", "King Thoros", "Councillor Halgrive", "Arianwyn", "Baxtorian", "Ysgawyn", "Lord Ieuan Amlodd", "Lord Iorwerth", "General Hining", "Essyllt"]) {
    api.onNpcInteraction(name, { "Talk-to": onTalk });
  }
  api.onNpcsInteraction(Object.keys(CITIZEN_SUPPORT), { "Talk-to": onTalk });
  api.onAnyNpcInteraction({ "Talk-to": onTalk });
  api.onNpcDeath(handleBattleDeath);
  api.onPlayerDeath(handleQuestPlayerDeath);
  api.onNpcHitModify(handleFragmentHit);
};
