/**
 * The Blood Moon Rises (members, Myreque #6). Dialogue and action ids are
 * taken from the current OSRS Wiki transcript export in npc-dialogues.json;
 * quest state uses the cache's myq6 varbit (15464 in varp 5618).
 */
module.exports = function registerTheBloodMoonRises(api) {
  const { Boundary, HitDamage, HitMask, ItemIdentifiers, Location, NpcIdentifiers, PrayerHandler, PrivateArea, Skill, World } = api.core;
  const { registerQuest, loadTranscripts, startTranscript } = require("../QuestRuntime");
  const PAGE = "The Blood Moon Rises";
  const START_HOOK = "quest:the-blood-moon-rises:start";
  const TOME_ID = ItemIdentifiers.TOME_OF_EXPERIENCE_3;
  const ATTRIBUTE = "quest.the_blood_moon_rises.tome-uses";
  const STAGE = {
    NOT_STARTED: 0,
    STARTED: 10,
    HIDEOUT: 20,
    SLEPE: 30,
    CASTLE: 40,
    ESCAPE: 45,
    BLOOD_HUNT: 50,
    PREPARATIONS: 60,
    SIEGE: 70,
    THEATRE: 80,
    WYRDS: 90,
    WYRD_DEFEATED: 95,
    FENCE_FOUND: 96,
    FINAL: 100,
    COMPLETE: 110,
  };
  const WYRD_AREA_ATTRIBUTE = "quest.the_blood_moon_rises.wyrd-area";
  const WYRD_DEFEATED_ATTRIBUTE = "quest.the_blood_moon_rises.wyrd-defeated";
  const DRAKAN_AREA_ATTRIBUTE = "quest.the_blood_moon_rises.drakan-area";
  const DRAKAN_DEFEATED_ATTRIBUTE = "quest.the_blood_moon_rises.drakan-defeated";
  const wyrdEncounters = new Map();
  const drakanEncounters = new Map();
  const CHAPTERS = [
    [STAGE.STARTED, "starting-out"],
    [STAGE.HIDEOUT, "starting-out-in-the-myreque-hideout"],
    [STAGE.SLEPE, "the-truth-hurtz"],
    [STAGE.CASTLE, "escape-from-castle-drakan"],
    [STAGE.ESCAPE, "blood-hunt"],
    [STAGE.BLOOD_HUNT, "blood-hunt"],
    [STAGE.PREPARATIONS, "hallowed-preparations"],
    [STAGE.SIEGE, "drakan-s-siege"],
    [STAGE.THEATRE, "another-night-at-the-theatre"],
    [STAGE.WYRDS, "fighting-wyrds"],
    [STAGE.FINAL, "night-of-the-blood-moon"],
  ];
  const REQUIRED_QUESTS = [
    ["sins_of_the_father", "Sins of the Father"],
    ["a_night_at_the_theatre", "A Night at the Theatre"],
  ];
  const REQUIRED_SKILLS = [
    [Skill.SLAYER, 74, "Slayer"], [Skill.WOODCUTTING, 74, "Woodcutting"],
    [Skill.SMITHING, 72, "Smithing"], [Skill.COOKING, 72, "Cooking"],
    [Skill.FLETCHING, 70, "Fletching"], [Skill.MINING, 66, "Mining"],
    [Skill.HUNTER, 65, "Hunter"], [Skill.CRAFTING, 64, "Crafting"],
    [Skill.HERBLORE, 64, "Herblore"], [Skill.MAGIC, 57, "Magic"],
  ];
  let quest;

  class WyrdEncounterArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(2944, 3007, 7424, 7487, 0)]);
      this.owner = owner;
    }

    isMulti() { return true; }

    canAttack(attacker, target) {
      const attackerHere = attacker?.getArea?.() === this;
      const targetHere = target?.getArea?.() === this;
      if (attackerHere || targetHere) return attackerHere && targetHere;
      return null;
    }

    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed()) wyrdEncounters.delete(this);
    }

    process(mobile) {
      if (!mobile?.isNpc?.()) return;
      const encounter = wyrdEncounters.get(this);
      if (!encounter || mobile !== encounter.boss || encounter.finished || mobile.getHitpoints() <= 0) return;
      const now = World.getProcessCycle();
      if (encounter.lastCycle === now) return;
      encounter.lastCycle = now;
      mobile.setScriptedMovement(true);
      mobile.getCombat().getLastAttack().reset();
      const player = encounter.player;
      if (player.getArea?.() !== this || player.getHitpoints() <= 0) return;

      const hpPercent = mobile.getHitpoints() / mobile.getMaxHitpoints();
      const threshold = hpPercent <= 0.1 ? 10 : hpPercent <= 0.5 ? 50 : hpPercent <= 0.8 ? 80 : 0;
      if (threshold && !encounter.thresholdsSeen.has(threshold)) {
        encounter.thresholdsSeen.add(threshold);
        if (threshold === 10) encounter.ending = true;
        startTranscript(api, player, mobile.getId(), PAGE, `fighting-wyrds-upon-reaching-${threshold}-hp`);
        return;
      }
      if (encounter.ending) return;

      const phase = hpPercent <= 0.5 ? 2 : 1;
      if (phase === 2 && encounter.phase !== 2) {
        encounter.phase = 2;
        player.sendMessage("The Wyrd's body crackles with lightning. Leave its blood pools when it calls the storm, and lower every protection prayer during the screech.");
      }
      if (encounter.impactAt && now >= encounter.impactAt) {
        const warning = encounter.warning;
        encounter.impactAt = 0;
        encounter.warning = null;
        if (warning === "screech") {
          const prayers = player.getPrayerActive?.() ?? [];
          const overheadActive = [PrayerHandler.PROTECT_FROM_MAGIC, PrayerHandler.PROTECT_FROM_MISSILES,
            PrayerHandler.PROTECT_FROM_MELEE].some((id) => prayers[id] === true);
          const damage = overheadActive ? 30 : 0;
          if (damage) player.sendMessage("Your protection prayer amplifies the Wyrd's screech.");
          else player.sendMessage("The screech passes over you as you lower your prayers.");
          if (damage) player.getCombat().getHitQueue().addPendingDamage([
            new HitDamage(damage, HitMask.RED).setSource(mobile),
          ]);
          encounter.screeches++;
          return;
        }
        if (warning === "storm") {
          const distance = Math.max(Math.abs(player.getLocation().getX() - encounter.markedX),
            Math.abs(player.getLocation().getY() - encounter.markedY));
          const prayers = player.getPrayerActive?.() ?? [];
          const overheadActive = [PrayerHandler.PROTECT_FROM_MAGIC, PrayerHandler.PROTECT_FROM_MISSILES,
            PrayerHandler.PROTECT_FROM_MELEE].some((id) => prayers[id] === true);
          if (distance <= 2) {
            player.sendMessage("The lightning strikes around you. Move clear of the blood pools and turn off your protection prayers.");
            player.getCombat().getHitQueue().addPendingDamage([
              new HitDamage(overheadActive ? 24 : 16, HitMask.RED).setSource(mobile),
            ]);
          } else {
            player.sendMessage("You escape the lightning strike and its blood pools.");
          }
          return;
        }
        if (warning === "slam") {
          const distance = Math.max(Math.abs(player.getLocation().getX() - encounter.markedX),
            Math.abs(player.getLocation().getY() - encounter.markedY));
          if (distance <= 1) player.getCombat().getHitQueue().addPendingDamage([
            new HitDamage(35, HitMask.RED).setSource(mobile),
          ]);
          else player.sendMessage("The Wyrd's ground slam crashes where you stood.");
          return;
        }
      }
      if (encounter.impactAt) return;
      if (now < encounter.nextAttackAt) return;
      encounter.nextAttackAt = now + 4;
      if (phase === 1 && encounter.punches < 2) {
        encounter.punches++;
        const protectedFromMelee = (player.getPrayerActive?.() ?? [])[PrayerHandler.PROTECT_FROM_MELEE] === true;
        if (!protectedFromMelee) player.getCombat().getHitQueue().addPendingDamage([
          new HitDamage(5 + Math.floor(Math.random() * 7), HitMask.RED).setSource(mobile),
        ]);
        player.sendMessage("The Wyrd swings a heavy fist at you.");
        return;
      }
      if (phase === 1 && encounter.screeches < 2) {
        encounter.punches = 0;
        encounter.warning = "screech";
        encounter.impactAt = now + 2;
        player.sendMessage("The Wyrd draws breath for a screech. Turn off all protection prayers before it lands.");
        return;
      }
      encounter.screeches = 0;
      encounter.punches = 0;
      const loc = player.getLocation();
      encounter.markedX = loc.getX();
      encounter.markedY = loc.getY();
      encounter.warning = phase === 2 ? "storm" : "slam";
      encounter.impactAt = now + 2;
      player.sendMessage(phase === 2
        ? "The Wyrd calls down lightning around you. Move away from the marked ground and turn off your protection prayers."
        : "The Wyrd winds back for a ground slam. Move away from your current tile.");
    }
  }

  class DrakanEncounterArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(2495, 2514, 7823, 7853, 3)]);
      this.owner = owner;
    }
    isMulti() { return true; }
    canAttack(attacker, target) {
      const attackerHere = attacker?.getArea?.() === this;
      const targetHere = target?.getArea?.() === this;
      if (attackerHere || targetHere) return attackerHere && targetHere;
      return null;
    }
    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed()) drakanEncounters.delete(this);
    }
    process(mobile) {
      if (!mobile?.isNpc?.()) return;
      const fight = drakanEncounters.get(this);
      if (!fight || mobile !== fight.boss || fight.finished || mobile.getHitpoints() <= 0) return;
      const now = World.getProcessCycle();
      if (fight.lastCycle === now) return;
      fight.lastCycle = now;
      mobile.setScriptedMovement(true);
      mobile.getCombat().getLastAttack().reset();
      const player = fight.player;
      if (player.getArea?.() !== this || player.getHitpoints() <= 0 || fight.ending) return;
      const hpPercent = mobile.getHitpoints() / mobile.getMaxHitpoints();
      if (hpPercent <= 0.3 && !fight.thresholdSeen) {
        fight.thresholdSeen = true;
        fight.ending = true;
        startTranscript(api, player, mobile.getId(), PAGE, "night-of-the-blood-moon-upon-lowerniel-reaching-30-hp");
        return;
      }
      if (fight.impactAt && now >= fight.impactAt) {
        const warning = fight.warning;
        fight.impactAt = 0;
        fight.warning = null;
        const location = player.getLocation();
        const x = location.getX();
        const y = location.getY();
        const prayers = player.getPrayerActive?.() ?? [];
        const melee = prayers[PrayerHandler.PROTECT_FROM_MELEE] === true;
        const magic = prayers[PrayerHandler.PROTECT_FROM_MAGIC] === true;
        if (warning === "thrust") {
          const distance = Math.max(Math.abs(x - fight.markedX), Math.abs(y - fight.markedY));
          if (distance === 0) this.hit(player, mobile, 30, "The spear thrust catches you. Step away when Lowerniel draws the spear back.");
          else player.sendMessage("You sidestep Lowerniel's spear thrust.");
          return;
        }
        if (warning === "blood-spear") {
          if (!magic) this.hit(player, mobile, 32, "The blood spear strikes you. Protect from Magic when he fires it.");
          else player.sendMessage("Your Protect from Magic prayer turns aside the blood spear.");
          return;
        }
        if (warning === "wave") {
          if (y === fight.markedY) this.hit(player, mobile, 36, "The blood wave crashes through your lane. Move to another row when it gathers.");
          else player.sendMessage("You dodge sideways out of the blood wave's path.");
          return;
        }
        if (warning === "shadow") {
          const distance = Math.max(Math.abs(x - fight.markedX), Math.abs(y - fight.markedY));
          if (distance <= 1) this.hit(player, mobile, 28, "The shadow pool erupts beneath you. Move clear of the marked ground.");
          else player.sendMessage("You move clear before the shadow pool erupts.");
          return;
        }
        if (warning === "melee") {
          if (!melee) this.hit(player, mobile, 7 + Math.floor(Math.random() * 10), "Lowerniel's melee strike lands.");
          return;
        }
      }
      if (fight.impactAt || now < fight.nextAttackAt) return;
      fight.nextAttackAt = now + 4;
      fight.attackIndex++;
      const loc = player.getLocation();
      if (fight.attackIndex % 5 === 1) {
        fight.warning = "thrust"; fight.markedX = loc.getX(); fight.markedY = loc.getY(); fight.impactAt = now + 2;
        player.sendMessage("Lowerniel draws his spear back and lines up a thrust. Step at least one tile aside.");
      } else if (fight.attackIndex % 5 === 2) {
        fight.warning = "blood-spear"; fight.impactAt = now + 2;
        player.sendMessage("Lowerniel fires a blood spear. Protect from Magic before it lands.");
      } else if (fight.attackIndex % 5 === 3) {
        fight.warning = "wave"; fight.markedY = loc.getY(); fight.impactAt = now + 2;
        player.sendMessage("A blood wave gathers across your row. Move to another row before it sweeps through.");
      } else if (fight.attackIndex % 5 === 4) {
        fight.warning = "shadow"; fight.markedX = loc.getX(); fight.markedY = loc.getY(); fight.impactAt = now + 2;
        player.sendMessage("A shadow pool forms beneath you. Move more than one tile away.");
      } else {
        fight.warning = "melee"; fight.impactAt = now + 1;
        player.sendMessage("Lowerniel closes in with a melee strike. Protect from Melee.");
      }
    }
    hit(player, source, damage, message) {
      player.sendMessage(message);
      player.getCombat().getHitQueue().addPendingDamage([
        new HitDamage(damage, HitMask.RED).setSource(source),
      ]);
    }
  }

  function startDrakanBattle(player) {
    const existing = player.getAttribute(DRAKAN_AREA_ATTRIBUTE);
    if (existing && existing.isDestroyed?.() !== true) return true;
    const area = new DrakanEncounterArea(player.getUsername?.());
    const boss = api.spawnNpc({ id: NpcIdentifiers.LOWERNIEL_DRAKAN_17, x: 2505, y: 7838, z: 3,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!boss) { player.sendMessage("Lowerniel could not be reached. Return to the northern chamber door."); return false; }
    boss.setMultiCombat?.(true);
    boss.setMaxHitpoints(1600);
    boss.setHitpoints(1600);
    area.enter(player);
    area.enter(boss);
    player.setAttribute(DRAKAN_AREA_ATTRIBUTE, area);
    player.moveTo(new Location(2502, 7838, 3));
    drakanEncounters.set(area, { area, boss, player, lastCycle: -1,
      nextAttackAt: World.getProcessCycle() + 4, attackIndex: 0, impactAt: 0, warning: null,
      markedX: 2502, markedY: 7838, thresholdSeen: false, ending: false, finished: false });
    player.sendMessage("Lowerniel attacks. Dodge his spear thrust and blood wave, protect from Magic against blood spears, and leave the shadow pools.");
    return true;
  }

  function finishDrakanEncounter(player) {
    const area = player.getAttribute(DRAKAN_AREA_ATTRIBUTE);
    const fight = area && drakanEncounters.get(area);
    if (!fight) return false;
    fight.finished = true;
    api.removeNpc(fight.boss);
    area.leave(player, false);
    player.setAttribute(DRAKAN_AREA_ATTRIBUTE, null);
    player.setAttribute(DRAKAN_DEFEATED_ATTRIBUTE, true);
    drakanEncounters.delete(area);
    return true;
  }

  function handleDrakanDeath(event) {
    const npc = event?.npc;
    const area = npc?.getArea?.();
    const fight = area && drakanEncounters.get(area);
    if (!fight || npc !== fight.boss || fight.finished) return false;
    fight.ending = true;
    fight.thresholdSeen = true;
    startTranscript(api, fight.player, npc.getId(), PAGE, "night-of-the-blood-moon-upon-killing-lowerniel-drakan");
    return true;
  }

  function startWyrdBattle(player) {
    const existing = player.getAttribute(WYRD_AREA_ATTRIBUTE);
    if (existing && existing.isDestroyed?.() !== true) return true;
    const area = new WyrdEncounterArea(player.getUsername?.());
    const boss = api.spawnNpc({ id: NpcIdentifiers.WYRD_8, x: 2976, y: 7456, z: 0,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!boss) {
      player.sendMessage("The Wyrd could not be reached. Return to Veliaf and try again.");
      return false;
    }
    boss.setMultiCombat?.(true);
    boss.setMaxHitpoints(1100);
    boss.setHitpoints(1100);
    area.enter(player);
    area.enter(boss);
    player.setAttribute(WYRD_AREA_ATTRIBUTE, area);
    player.moveTo(new Location(2976, 7452, 0));
    wyrdEncounters.set(area, { area, boss, player, phase: 1, lastCycle: -1, nextAttackAt: World.getProcessCycle() + 4,
      impactAt: 0, warning: null, punches: 0, screeches: 0, markedX: 2976, markedY: 7452, finished: false,
      ending: false, thresholdsSeen: new Set() });
    player.sendMessage("The Wyrd breaks free. Protect from its fists, lower all protection prayers for the screech, and move away from the ground slam.");
    return true;
  }

  function handleWyrdDeath(event) {
    if (handleDrakanDeath(event)) return;
    const npc = event?.npc;
    const area = npc?.getArea?.();
    const encounter = area && wyrdEncounters.get(area);
    if (!encounter || npc !== encounter.boss || encounter.finished || event?.killer !== encounter.player) return;
    // A lethal hit can skip over 10% between NPC processing ticks. Keep the same
    // story outcome as the threshold trigger: Safalaan knocks the player out and flees.
    if (!encounter.ending) {
      encounter.ending = true;
      encounter.thresholdsSeen.add(10);
      startTranscript(api, encounter.player, npc.getId(), PAGE, "fighting-wyrds-upon-reaching-10-hp");
    }
  }

  function inspectWyrdFence(event) {
    const player = event?.player;
    const name = String(event?.definition?.getName?.() ?? "").toLowerCase();
    if (!player || !player.getAttribute(WYRD_DEFEATED_ATTRIBUTE) || name !== "broken fence") return false;
    const x = event.location?.getX?.() ?? event.location?.x;
    const y = event.location?.getY?.() ?? event.location?.y;
    if (x !== 3562 || y !== 3323) return false;
    event.handled = true;
    return startTranscript(api, player, 0, PAGE, "fighting-wyrds-inspecting-the-broken-fence");
  }

  function stage(player) { return quest.getStage(player); }
  function advance(player, value) {
    if (stage(player) < value) quest.setStage(player, value);
  }
  function hasQuest(player, key) {
    const request = { player, key, complete: null };
    api.emitCustomEvent("quest:is-complete", request);
    return request.complete === true;
  }
  function meetsRequirements(player) {
    return REQUIRED_QUESTS.every(([key]) => hasQuest(player, key)) &&
      REQUIRED_SKILLS.every(([skill, level]) => player.getSkillManager().getMaxLevel(skill) >= level);
  }
  function explainRequirements(player) {
    for (const [key, name] of REQUIRED_QUESTS) {
      if (!hasQuest(player, key)) player.sendMessage(`You must have completed ${name} to start this quest.`);
    }
    for (const [skill, level, name] of REQUIRED_SKILLS) {
      if (player.getSkillManager().getMaxLevel(skill) < level) player.sendMessage(`You need ${level} ${name} to start this quest.`);
    }
  }
  function currentChapter(value) {
    let selected = CHAPTERS[0][1];
    for (const [threshold, chapter] of CHAPTERS) if (value >= threshold) selected = chapter;
    return selected;
  }

  function selectVariant(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return null;
    const page = event.pages?.find((entry) => entry.page === PAGE);
    if (!page) return null;
    const value = stage(player);
    if (value === STAGE.NOT_STARTED) {
      if (event.definition?.getName?.() !== "Sarius Guile" || !meetsRequirements(player)) return null;
      return page.variants.includes("starting-out") ? { page: PAGE, variant: "starting-out" } : null;
    }
    const chapter = currentChapter(value);
    const candidates = page.variants.filter((variant) => variant.startsWith(`${chapter}-`));
    if (!candidates.length) return null;
    const useful = candidates.filter((variant) => !variant.includes("again"));
    return { page: PAGE, variant: (useful[0] ?? candidates[0]) };
  }

  function onStartHook(event) {
    if (event?.hook !== START_HOOK || !event.player) return;
    if (!meetsRequirements(event.player)) { explainRequirements(event.player); return; }
    advance(event.player, STAGE.STARTED);
  }

  // Transcript cutscenes mark the major route changes. The separate object,
  // puzzle and boss handlers below remain responsible for the actual mechanics.
  function onTranscriptAction(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return;
    const next = ACTION_STAGE[event.stepId];
    if (next) advance(player, next);
    if (event.stepId === "4G5OZg") startWyrdBattle(player);
    if (event.stepId === "t7FMNM") startDrakanBattle(player);
    if (event.stepId === "4ebW6l" || event.stepId === "BzMe5D") finishDrakanEncounter(player);
    if (event.stepId === "dJZbqF") {
      const area = player.getAttribute(WYRD_AREA_ATTRIBUTE);
      const encounter = area && wyrdEncounters.get(area);
      if (encounter) {
        encounter.finished = true;
        api.removeNpc(encounter.boss);
        area.leave(player, false);
      }
      player.setAttribute(WYRD_AREA_ATTRIBUTE, null);
      player.setAttribute(WYRD_DEFEATED_ATTRIBUTE, true);
      advance(player, STAGE.WYRD_DEFEATED);
      player.moveTo(new Location(3562, 3323, 0));
    }
    if (event.stepId === "xt3dPV") advance(player, STAGE.FENCE_FOUND);
    if (event.stepId === "2QgFZA" && player.getAttribute(WYRD_DEFEATED_ATTRIBUTE)) advance(player, STAGE.FINAL);
    if (event.stepId === "BzMe5D") quest.complete(player);
  }

  function onChoice(event) {
    if (!event?.player) return;
    const player = event.player;
    if (event.option === "Yes." && stage(player) === STAGE.NOT_STARTED &&
      event.definition?.getName?.() === "Sarius Guile" && meetsRequirements(player)) {
      advance(player, STAGE.STARTED);
    } else if (event.option === "I'm ready." && stage(player) === STAGE.STARTED) {
      advance(player, STAGE.HIDEOUT);
    }
  }

  function claimNightLamps(player) {
    const request = { player, handled: false };
    api.emitCustomEvent("night-at-the-theatre:claim-lamps", request);
    if (!request.handled) player.sendMessage("There are no unused Hallowed lamps to reclaim.");
  }

  function talkQuestNpc(event) {
    const player = event?.player;
    if (!player) return false;
    const npcName = String(event.definition?.getName?.() ?? "").toLowerCase();
    // Night at the Theatre owns this same Stranger until its story is complete.
    // Once Night is done, preserve its lamp reclaim service while Blood Moon is active.
    if (npcName === "mysterious stranger") {
      if (!hasQuest(player, "a_night_at_the_theatre")) return false;
      api.sendMultiChatboxPrompt(player, "What would you like to do?",
        "Claim unused Hallowed lamps", () => claimNightLamps(player),
        "I'm off", () => {});
      event.handled = true;
      return true;
    }
    if (quest.isComplete(player)) return false;
    if (stage(player) === STAGE.NOT_STARTED) {
      if (npcName !== "sarius guile") return false;
      if (!meetsRequirements(player)) { explainRequirements(player); return true; }
      return startTranscript(api, player, event.npcId, PAGE, "starting-out");
    }
    const chapter = currentChapter(stage(player));
    const alias = ({ "king roald": "king-roald", "the nylocas queen": "nylocas-queen" })[npcName] ?? npcName.replace(/[^a-z0-9]+/g, "-");
    const variants = Object.keys(loadTranscripts(api)[PAGE]?.variants ?? {});
    const candidates = variants.filter((variant) => variant.startsWith(`${chapter}-`) && variant.includes(alias));
    const selected = candidates.find((variant) => variant.includes("talking-to") && !variant.includes("again")) ??
      candidates.find((variant) => variant.includes("talking-to")) ?? candidates[0];
    return selected ? startTranscript(api, player, event.npcId, PAGE, selected) : false;
  }

  function buildJournal(player) {
    if (quest.isComplete(player)) return ["Lowerniel Drakan has fallen.", "The Myreque's long struggle is over."];
    const value = stage(player);
    if (value >= STAGE.FINAL) return ["The Myreque have set out for Castle Drakan.", "I must follow them and stop Lowerniel Drakan."];
    if (value >= STAGE.FENCE_FOUND) return ["Safalaan escaped toward Castle Drakan.", "I should join the Myreque in Burgh de Rott and prepare to pursue him."];
    if (value >= STAGE.WYRD_DEFEATED) return ["The Wyrd knocked me unconscious and fled north.", "I should inspect the broken fence beyond Barrows and follow Safalaan's trail."];
    if (value >= STAGE.THEATRE) return ["Safalaan is becoming a wyrd.", "I must help Veliaf defeat him before he loses himself."];
    if (value >= STAGE.SIEGE) return ["The aranei hideout is under attack.", "I must help defend the bridge and protect the portal."];
    if (value >= STAGE.PREPARATIONS) return ["Sugadinti's followers are preparing to face Lowerniel.", "I should speak to Veliaf when I am ready."];
    if (value >= STAGE.BLOOD_HUNT) return ["I have escaped into Vampyrium.", "I must find the group and survive the hunt."];
    if (value >= STAGE.ESCAPE) return ["I am fleeing Castle Drakan with the others.", "I must escape the vampyres and get clear of the castle."];
    if (value >= STAGE.CASTLE) return ["I am trapped inside Castle Drakan.", "I must find the others and escape."];
    if (value >= STAGE.SLEPE) return ["I need to investigate the events in Slepe and Castle Drakan.", "I should follow Ivan's leads."];
    if (value >= STAGE.HIDEOUT) return ["Ivan has agreed to help me reach Castle Drakan.", "I should make sure we are both disguised before we leave."];
    return ["Sarius Guile told me Lowerniel Drakan has taken Safalaan.", "I should find Ivan in the Myreque hideout."];
  }

  function readTome({ player, itemId, item, slot }) {
    if (itemId !== TOME_ID || !quest.isComplete(player) || player.getInventory().get(slot) !== item) return false;
    if ((Number(player.getAttribute(ATTRIBUTE)) || 0) >= 6) return true;
    api.emitCustomEvent("xpreward:open", {
      player,
      minLevel: 70,
      title: "Choose the stat you wish to be advanced!",
      onConfirm: (skill, name) => {
        if (player.getInventory().get(slot) !== item) return null;
        const used = (Number(player.getAttribute(ATTRIBUTE)) || 0) + 1;
        player.setAttribute(ATTRIBUTE, used);
        if (used >= 6) player.getInventory().deleteAtSlot(slot, 1);
        player.getSkillManager().addExperience(skill, 30000, false);
        return `You have been awarded 30,000 ${name} XP!`;
      },
    });
    return true;
  }

  const ACTION_STAGE = {
    "gzCVlH": STAGE.SLEPE,
    "fiqzZ7": STAGE.SLEPE,
    "XqVfhB": STAGE.ESCAPE,
    "D5qF0g": STAGE.BLOOD_HUNT,
    "sw9z49": STAGE.BLOOD_HUNT,
    "lKvIyH": STAGE.BLOOD_HUNT,
    "kfvYPl": STAGE.PREPARATIONS,
    "Sut83Q": STAGE.SIEGE,
    "vqg4qO": STAGE.SIEGE,
    "1JPVz5": STAGE.THEATRE,
    "4G5OZg": STAGE.WYRDS,
    "4ebW6l": STAGE.FINAL,
  };

  quest = registerQuest(api, {
    key: "the_blood_moon_rises",
    name: PAGE,
    varpId: 5618,
    varbitId: 15464,
    startedValue: STAGE.STARTED,
    completionValue: STAGE.COMPLETE,
    questPoints: 4,
    rewardItemId: TOME_ID,
    rewardItemLabel: "Tome of Experience (six chapters)",
    otherRewards: ["Access to Vampyrium", "A Hallowed flail", "Sunspear", "The vampyres of Morytania are tolerant of you"],
    buildJournal,
  });
  api.persistAttribute(ATTRIBUTE);
  api.onCustomEvent("npc-dialogue:hook", onStartHook);
  api.onCustomEvent("npc-dialogue:action", onTranscriptAction);
  api.onCustomEvent("npc-dialogue:choice", onChoice);
  api.onNpcDialogueVariant(selectVariant);
  api.onAnyNpcInteraction({ "Talk-to": talkQuestNpc });
  api.onObjectInteraction(inspectWyrdFence);
  api.onNpcDeath(handleWyrdDeath);
  api.persistAttribute(WYRD_DEFEATED_ATTRIBUTE);
  api.persistAttribute(DRAKAN_DEFEATED_ATTRIBUTE);
  api.onItemAction("Tome of Experience", { Read: readTome });
};
