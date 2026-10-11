/**
 * Song of the Elves (members, Elf series #8). The Wiki transcript is the source
 * for dialogue and cutscene ids; quest state mirrors the cache's sote varbit.
 */
module.exports = function registerSongOfTheElves(api) {
  const { Boundary, Equipment, ItemIdentifiers, Location, NpcIdentifiers, PrivateArea, Skill } = api.core;
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
  const LIBRARY_INSTANCE = "quest.song_of_the_elves.library-instance";
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
      };
      const itemId = itemByMessage[event.stepId];
      if (itemId) {
        if (inventory.getFreeSlots() > 0 && inventory.getAmount(itemId) === 0) {
          inventory.adds(itemId, 1);
          event.box = { items: [itemId] };
          if (itemId === ItemIdentifiers.ODE_TO_ETERNITY) {
            const order = PILLAR_ITEMS.map((_, index) => index).sort(() => Math.random() - 0.5);
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
    if (event.stepId === "v3r3p_") player.moveTo(new Location(2353, 3172, 0));
    if (["9yLw8T", "o4CmGU", "eIlh1C"].includes(event.stepId)) setChapter(player, 15);
    if (event.stepId === "6nBDUf") setChapter(player, 16);
    if (event.stepId === "xfnkES") setChapter(player, 19);
    if (event.stepId === "yR9ETJ") setChapter(player, 20);
    if (event.stepId === "eOtNFO") setChapter(player, 12);
    if (event.stepId === "W-ainS") quest.complete(player);
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
      if (guide) area.add(guide);
      player.moveTo(new Location(2623, 6144, 0));
      player.sendMessage("You enter the Grand Library. Its doors seal behind you; find the Seal of the Forgotten in the central chamber.");
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
    for (const spawn of waveNpcs) {
      const npc = api.spawnNpc({ ...spawn, z: 0, wanderRadius: 2, owner: player, ownerOnly: true });
      if (npc) {
        npc.setMultiCombat?.(true);
        area.add(npc);
      }
    }
    battleInstances.set(area, { player, battle: area.battle, wave, kills: 0, target: waveNpcs.length });
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
    "Rc0W1H": 7, "UeAKgA": 8,
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
  api.onCustomEvent("npc-dialogue:action", onAction);
  api.onCustomEvent("npc-dialogue:choice", handleDialogueChoice);
  api.onItemOnItem(handleItemOnItem);
  api.onItemOnNpc(handleItemOnNpc);
  api.persistAttribute(CHEMICAL_CHOICE);
  api.persistAttribute(FALLS_PILLARS);
  api.persistAttribute(FALLS_ORDER);
  api.persistAttribute(INCITEMENTS);
  api.persistAttribute(RESISTANCE_MEMBERS);
  api.persistAttribute(RESISTANCE_BRIEFING);
  api.persistAttribute(WEST_BATTLE_KILLS);
  api.persistAttribute(EAST_BATTLE_KILLS);
  api.persistAttribute(LATE_CHAPTER);
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
};
