/**
 * Song of the Elves (members, Elf series #8). The Wiki transcript is the source
 * for dialogue and cutscene ids; quest state mirrors the cache's sote varbit.
 */
module.exports = function registerSongOfTheElves(api) {
  const { Skill } = api.core;
  const { registerQuest, loadTranscripts, startTranscript } = require("../QuestRuntime");
  const PAGE = "Song of the Elves";
  const START_HOOK = "quest:song-of-the-elves:start";
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
    const value = quest.getStage(player);
    if (value >= STAGE.COMPLETE) return CHAPTERS.length - 1;
    // Stage is advanced by the transcript milestones below; cap it to the final chapter.
    return Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor((value - STAGE.STARTED) / 10)));
  }
  function onAction(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return;
    const chapter = ACTION_CHAPTER[event.stepId];
    if (chapter !== undefined) {
      const next = STAGE.STARTED + chapter * 10;
      if (quest.getStage(player) < next) quest.setStage(player, next);
    }
    if (event.stepId === "W-ainS") quest.complete(player);
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
    if (npcName === "king lathas") {
      const variant = quest.getStage(player) === STAGE.STARTED
        ? "talking-to-the-king"
        : "talking-to-the-king-talking-to-him-again";
      if (quest.getStage(player) === STAGE.STARTED) quest.setStage(player, 20);
      return startTranscript(api, player, event.npcId, PAGE, variant);
    }
    const chapterName = CHAPTERS[currentChapter(player)];
    if (npcName === "edmond" && currentChapter(player) === 1) {
      return startTranscript(api, player, event.npcId, PAGE,
        "making-a-knightly-disguise-talking-to-edmond-after-completing-the-disguise-talking-to-him-again");
    }
    const alias = ({ "king lathas": "king", "ted rehnison": "martha-or-ted", "martha rehnison": "martha-or-ted" })[npcName] ?? npcName.replace(/[^a-z0-9]+/g, "-");
    const variants = Object.keys(loadTranscripts(api)[PAGE]?.variants ?? {});
    const candidates = variants.filter((variant) => variant.startsWith(`${chapterName}-`) && variant.includes(alias));
    const selected = candidates.find((variant) => variant.includes("talking-to") && !variant.includes("again")) ??
      candidates.find((variant) => variant.includes("talking-to")) ?? candidates[0];
    return selected ? startTranscript(api, player, event.npcId, PAGE, selected) : false;
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
    return [names[Math.max(0, chapter)] ?? names[0]];
  }

  const ACTION_CHAPTER = {
    "jtPiC1": 2, "LeWWCS": 3, "Nn3EkA": 4, "AWdFbp": 4,
    "zMz1Ng": 6, "QS01XB": 6, "Rc0W1H": 7, "UeAKgA": 8,
    "x04RMY": 10, "D1wXY6": 11, "EMxiFg": 11,
    "ycGZ1J": 12, "koxQh3": 13, "FoLVmk": 14,
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
    if (event?.player && event.text?.startsWith("If the player") && !requirementsMet(event.player)) return false;
    return null;
  });
  api.onCustomEvent("npc-dialogue:hook", onStart);
  api.onCustomEvent("npc-dialogue:action", onAction);
  api.onNpcInteraction("Edmond", { "Talk-to": onTalk });
  api.onAnyNpcInteraction({ "Talk-to": onTalk });
};
