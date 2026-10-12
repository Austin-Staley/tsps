/**
 * The Blood Moon Rises (members, Myreque #6). Dialogue and action ids are
 * taken from the current OSRS Wiki transcript export in npc-dialogues.json;
 * quest state uses the cache's myq6 varbit (15464 in varp 5618).
 */
module.exports = function registerTheBloodMoonRises(api) {
  const { Boundary, HitDamage, HitMask, Item, ItemIdentifiers, Location, NpcIdentifiers, ObjectIdentifiers, PrayerHandler, PrivateArea, Skill, World } = api.core;
  const { registerQuest, loadTranscripts, startTranscript } = require("../QuestRuntime");
  const PAGE = "The Blood Moon Rises";
  const START_HOOK = "quest:the-blood-moon-rises:start";
  const TOME_ID = ItemIdentifiers.TOME_OF_EXPERIENCE_3;
  const PREP_ATTRIBUTE = "quest.the_blood_moon_rises.preparations";
  const THRONE_PUZZLE_ATTRIBUTE = "quest.the_blood_moon_rises.castle-throne-puzzle";
  const BASIN_PUZZLE_ATTRIBUTE = "quest.the_blood_moon_rises.castle-basin-puzzle";
  const SOLID_KEY_ATTRIBUTE = "quest.the_blood_moon_rises.castle-solid-key-puzzle";
  const CLOCK_ATTRIBUTE = "quest.the_blood_moon_rises.castle-clocks";
  const GALLERY_CHEST_ATTRIBUTE = "quest.the_blood_moon_rises.gallery-chest";
  const REFINER_ATTRIBUTE = "quest.the_blood_moon_rises.castle-refiner";
  const HUNT_ATTRIBUTE = "quest.the_blood_moon_rises.blood-hunt";
  const HUNT_ITEMS = {
    crank: ItemIdentifiers.CRANK_WHEEL, dustyBook: ItemIdentifiers.DUSTY_BOOK, viturKey: ItemIdentifiers.VITUR_KEY,
    boltCutters: ItemIdentifiers.BOLT_CUTTERS, toothHalf: ItemIdentifiers.TOOTH_HALF_OF_KEY_6,
    loopHalf: ItemIdentifiers.LOOP_HALF_OF_KEY_6, myrmelKey: ItemIdentifiers.MYRMEL_KEY,
    bucket: ItemIdentifiers.BUCKET, bucketWater: ItemIdentifiers.BUCKET_OF_WATER,
    shadumKey: ItemIdentifiers.SHADUM_KEY, trapdoorKey: ItemIdentifiers.TRAPDOOR_KEY,
    jovkaiKey: ItemIdentifiers.JOVKAI_KEY, oldCog: ItemIdentifiers.OLD_COG,
  };
  const PREP = {
    leaves: ItemIdentifiers.AMITIRE_LEAVES,
    stew: ItemIdentifiers.AMITIRE_STEW,
    bowl: ItemIdentifiers.BOWL,
    bowlWater: ItemIdentifiers.BOWL_OF_WATER,
    potato: ItemIdentifiers.POTATO,
    incompleteStew: ItemIdentifiers.INCOMPLETE_STEW,
    rawMeat: ItemIdentifiers.RAW_IMPALER_MEAT,
    cookedMeat: ItemIdentifiers.COOKED_MEAT,
    uncookedStew: ItemIdentifiers.UNCOOKED_STEW,
    cookedStew: ItemIdentifiers.STEW,
    hammer: ItemIdentifiers.HAMMER,
    chisel: ItemIdentifiers.CHISEL,
    knife: ItemIdentifiers.KNIFE,
    logs: ItemIdentifiers.BLISTERWOOD_LOGS,
    blessedSickle: ItemIdentifiers.SILVER_SICKLE_B_,
    diamond: ItemIdentifiers.DIAMOND,
    diamondTablet: ItemIdentifiers.ENCHANT_DIAMOND,
    diamondSickle: ItemIdentifiers.DIAMOND_SICKLE_B_,
    enchantedSickle: ItemIdentifiers.ENCHANTED_DIAMOND_SICKLE_B_,
    enhancedSickle: ItemIdentifiers.BLISTERWOOD_SICKLE_E_,
    marks: ItemIdentifiers.HALLOWED_MARKS,
    blisterwoodFlail: ItemIdentifiers.BLISTERWOOD_FLAIL,
    flail: ItemIdentifiers.HALLOWED_FLAIL,
    stakes: ItemIdentifiers.BLISTERWOOD_STAKE,
  };
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
  const DRAKAN_ENCOUNTER_COMPLETE = "quest.the_blood_moon_rises.drakan-defeated";
  const SIEGE_DRAKAN_AREA_ATTRIBUTE = "quest.the_blood_moon_rises.siege-drakan-area";
  const SIEGE_DRAKAN_COMPLETE = "quest.the_blood_moon_rises.siege-drakan-defeated";
  const SIEGE_DEFENCE_ATTRIBUTE = "quest.the_blood_moon_rises.siege-defence";
  const TOB_CHALLENGE_ATTRIBUTE = "quest.the_blood_moon_rises.tob-challenge";
  const PREP_COMPLETE = "quest.the_blood_moon_rises.preparations-complete";
  const wyrdEncounters = new Map();
  const drakanEncounters = new Map();
  const siegeDrakanEncounters = new Map();
  const siegeHallInjured = new Map();
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

  class SiegeDrakanArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(3155, 3181, 7823, 7863, 1)]);
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
      if (this.isDestroyed()) siegeDrakanEncounters.delete(this);
    }
    process(mobile) {
      if (!mobile?.isNpc?.()) return;
      const fight = siegeDrakanEncounters.get(this);
      if (!fight || mobile !== fight.boss || fight.finished || mobile.getHitpoints() <= 0) return;
      const now = World.getProcessCycle();
      if (fight.lastCycle === now) return;
      fight.lastCycle = now;
      mobile.setScriptedMovement(true);
      mobile.getCombat().getLastAttack().reset();
      const player = fight.player;
      if (player.getArea?.() !== this || player.getHitpoints() <= 0 || fight.ending) return;
      if (mobile.getHitpoints() <= fight.thresholdHp) {
        fight.ending = true;
        startTranscript(api, player, mobile.getId(), PAGE,
          "drakan-s-siege-fighting-lowerniel-upon-lowerniel-reaching-58-hp");
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
          if (distance === 0) this.hit(player, mobile, 30, "The spear thrust catches you. Step aside when Lowerniel draws the spear back.");
          else player.sendMessage("You sidestep Lowerniel's spear thrust.");
          return;
        }
        if (warning === "blood-spear") {
          if (!magic) this.hit(player, mobile, 32, "The blood spear strikes you. Protect from Magic before it lands.");
          else player.sendMessage("Your Protect from Magic prayer turns aside the blood spear.");
          return;
        }
        if (warning === "front-back") {
          const distance = Math.max(Math.abs(x - fight.markedX), Math.abs(y - fight.markedY));
          if (distance <= 2 && x === fight.markedX) {
            this.hit(player, mobile, 25, "Drakan's blood burst catches you in front of him. Move to either side.");
          } else player.sendMessage("You move to the side and avoid Drakan's blood burst.");
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
      if (fight.attackIndex % 4 === 1) {
        fight.warning = "thrust";
        fight.markedX = loc.getX();
        fight.markedY = loc.getY();
        fight.impactAt = now + 2;
        player.sendMessage("Lowerniel draws his spear back and lines up a thrust. Step to either side.");
      } else if (fight.attackIndex % 4 === 2) {
        fight.warning = "front-back";
        fight.markedX = loc.getX();
        fight.markedY = loc.getY();
        fight.impactAt = now + 2;
        player.sendMessage("Lowerniel gathers blood in front of and behind him. Move to one of his sides.");
      } else if (fight.attackIndex % 4 === 3) {
        fight.warning = "blood-spear";
        fight.impactAt = now + 2;
        player.sendMessage("Lowerniel fires a blood spear. Protect from Magic before it lands.");
      } else {
        fight.warning = "melee";
        fight.impactAt = now + 1;
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
    player.setAttribute(DRAKAN_ENCOUNTER_COMPLETE, true);
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

  function startSiegeDrakanBattle(player) {
    const existing = player.getAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE);
    if (existing && existing.isDestroyed?.() !== true) return true;
    if (stage(player) !== STAGE.SIEGE) return false;
    const area = new SiegeDrakanArea(player.getUsername?.());
    const boss = api.spawnNpc({ id: NpcIdentifiers.LOWERNIEL_DRAKAN_19, x: 3168, y: 7853, z: 1,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!boss) {
      player.sendMessage("Lowerniel could not be reached. Pass through the barricade into the palace hall and try again.");
      return false;
    }
    boss.setMultiCombat?.(true);
    boss.setMaxHitpoints(3000);
    boss.setHitpoints(2550);
    area.enter(player);
    area.enter(boss);
    player.setAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE, area);
    player.setAttribute(SIEGE_DRAKAN_COMPLETE, false);
    siegeDrakanEncounters.set(area, { area, boss, player, thresholdHp: 1740, lastCycle: -1,
      nextAttackAt: World.getProcessCycle() + 4, attackIndex: 0, impactAt: 0, warning: null,
      markedX: 3168, markedY: 7853, ending: false, finished: false });
    player.sendMessage("Lowerniel has breached the entrance hall. Dodge his spear thrusts and front-and-back blood bursts, and protect from Magic against his blood spears.");
    return true;
  }

  function finishSiegeDrakanBattle(player) {
    const area = player.getAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE);
    const fight = area && siegeDrakanEncounters.get(area);
    if (!fight || fight.player !== player) return false;
    fight.finished = true;
    api.removeNpc(fight.boss);
    area.leave(player, false);
    player.setAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE, null);
    player.setAttribute(SIEGE_DRAKAN_COMPLETE, true);
    siegeDrakanEncounters.delete(area);
    advance(player, STAGE.THEATRE);
    // The cutscene sends the party to the Haunted Woods; this is its canonical
    // post-scene checkpoint from the Quest Helper route.
    api.spawnNpc({ id: NpcIdentifiers.IVAN_STROM_13, x: 3606, y: 3416, z: 0,
      wanderRadius: 0, owner: player, ownerOnly: true });
    player.moveTo(new Location(3605, 3416, 0));
    return true;
  }

  const SIEGE_HALL = {
    hammerCrate: ObjectIdentifiers.CRATE_OF_HAMMERS_2,
    potionCrate: ObjectIdentifiers.CRATE_OF_POTIONS,
    damagedPillar: ObjectIdentifiers.DAMAGED_PILLAR_2,
    pillar: ObjectIdentifiers.PILLAR_150,
    damagedWindow: ObjectIdentifiers.DAMAGED_WINDOW,
    window: ObjectIdentifiers.WINDOW_20,
    barricade: ObjectIdentifiers.BARRICADE_60,
    hammer: ItemIdentifiers.HAMMER,
    healingPotion: ItemIdentifiers.HEALING_POTION,
    injuredAranei: [NpcIdentifiers.ARANEI_108, NpcIdentifiers.ARANEI_109, NpcIdentifiers.ARANEI_110,
      NpcIdentifiers.ARANEI_111, NpcIdentifiers.ARANEI_112, NpcIdentifiers.ARANEI_113],
    repairLocations: new Map([
      ["3174,7855", [ObjectIdentifiers.DAMAGED_PILLAR_2, ObjectIdentifiers.PILLAR_150]],
      ["3162,7855", [ObjectIdentifiers.DAMAGED_PILLAR_2, ObjectIdentifiers.PILLAR_150]],
      ["3176,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
      ["3174,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
      ["3162,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
      ["3164,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
    ]),
  };

  function hallDefenceState(player) {
    return player.getAttribute(SIEGE_DEFENCE_ATTRIBUTE) ?? { phase: "bridge", integrity: 100, healed: [], repaired: [] };
  }

  // The live defense uses a continuously falling integrity meter. Cache data
  // and the transcript expose the 50% story threshold, but not its server tick
  // cadence or exact repair gains. These two timing/gain values are shortcuts
  // pending live calibration; integrity, rather than a repair-count gate, is
  // the actual win condition.
  const HALL_INTEGRITY_INTERVAL = 20;
  const HALL_INTEGRITY_LOSS = 1;
  const HALL_INTEGRITY_THRESHOLD = 50;
  // shortcut: the Wiki says a player must participate but does not publish a
  // count; require three distinct repair/heal actions before the breach scene.
  const HALL_PARTICIPATION_REQUIRED = 3;

  function applyHallIntegrity(player, delta, participated = false) {
    const state = hallDefenceState(player);
    if (state.phase !== "hall") return;
    const integrity = Math.max(0, Math.min(100, (state.integrity ?? 100) + delta));
    const updated = { ...state, integrity,
      participation: (state.participation ?? 0) + (participated ? 1 : 0) };
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, updated);
    if (integrity <= HALL_INTEGRITY_THRESHOLD && state.phase === "hall") {
      if (updated.participation < HALL_PARTICIPATION_REQUIRED) {
        updated.integrity = HALL_INTEGRITY_THRESHOLD + 1;
        player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, updated);
        player.sendMessage("The Aranei need more help before the doors give way. Repair another damaged window or pillar, or heal a fallen Aranei.");
        return;
      }
      updated.phase = "breach";
      player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, updated);
      startTranscript(api, player, NpcIdentifiers.LOWERNIEL_DRAKAN_19, PAGE,
        "drakan-s-siege-upon-reaching-0-hideout-integrity");
    }
  }

  function processSiegeDefence({ player }) {
    if (!player || stage(player) !== STAGE.SIEGE) return;
    const state = hallDefenceState(player);
    if (state.phase !== "hall") return;
    const cycle = World.getProcessCycle();
    if (cycle < (state.nextIntegrityLossCycle ?? cycle + HALL_INTEGRITY_INTERVAL)) {
      if (state.nextIntegrityLossCycle === undefined) player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE,
        { ...state, nextIntegrityLossCycle: cycle + HALL_INTEGRITY_INTERVAL });
      return;
    }
    applyHallIntegrity(player, -HALL_INTEGRITY_LOSS);
    const updated = hallDefenceState(player);
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE,
      { ...updated, nextIntegrityLossCycle: cycle + HALL_INTEGRITY_INTERVAL });
  }

  function injuredAraneiKey(npc) {
    const location = npc.getLocation?.();
    return `aranei:${location?.getX?.()},${location?.getY?.()},${location?.getZ?.()}`;
  }

  function spawnSiegeInjuredAranei(player) {
    const state = hallDefenceState(player);
    if (state.phase !== "hall" || (state.healed ?? []).includes("aranei:3173,7855,1")) return;
    const key = player.getUsername?.() ?? player.getIndex?.();
    const old = siegeHallInjured.get(key);
    if (old && old.isRegistered?.() && old.getHitpoints?.() > 0) return;
    const npc = api.spawnNpc({ id: NpcIdentifiers.ARANEI_112, x: 3173, y: 7855, z: 1,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (npc) siegeHallInjured.set(key, npc);
  }

  function handleSiegeLogin({ player }) {
    if (!player || stage(player) !== STAGE.SIEGE) return;
    const state = hallDefenceState(player);
    if (state.phase === "hall") player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE,
      { ...state, nextIntegrityLossCycle: World.getProcessCycle() + HALL_INTEGRITY_INTERVAL });
    spawnSiegeInjuredAranei(player);
  }

  function handleSiegeLogout({ player }) {
    if (!player) return;
    const key = player.getUsername?.() ?? player.getIndex?.();
    const npc = siegeHallInjured.get(key);
    if (npc) api.removeNpc(npc);
    siegeHallInjured.delete(key);
  }

  function replaceHallObject(event, replacementId) {
    const object = event.object;
    if (!object) return false;
    const location = object.getLocation();
    const replacement = new api.core.GameObject(replacementId, location.clone(), object.getType(), object.getFace(),
      object.getPrivateArea?.() ?? null);
    api.core.ObjectManager.deregister(object, true);
    api.core.ObjectManager.register(replacement, true);
    return true;
  }

  function handleSiegeHallObject(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.SIEGE) return;
    const objectId = event.definition?.id ?? event.objectId;
    const { x, y, z } = event.location ?? {};
    const state = hallDefenceState(player);
    const inventory = player.getInventory();
    if (state.phase !== "hall") return;

    if (objectId === SIEGE_HALL.hammerCrate || objectId === SIEGE_HALL.potionCrate) {
      event.handled = true;
      const item = objectId === SIEGE_HALL.hammerCrate ? SIEGE_HALL.hammer : SIEGE_HALL.healingPotion;
      if (!inventory.contains(item)) inventory.adds(item, 1);
      player.sendMessage(item === SIEGE_HALL.hammer ? "You take a hammer from the crate." : "You take a healing potion from the crate.");
      return;
    }

    if (objectId === SIEGE_HALL.barricade && x === 3167 && y === 7844 && z === 1 && state.phase === "hall") {
      event.handled = true;
      player.sendMessage("The reinforced door is still holding. Keep repairing the hall and helping the Aranei until its integrity falls to half.");
      return;
    }

    if (z !== 1) return;
    const repairKey = `${x},${y}`;
    const repair = SIEGE_HALL.repairLocations.get(repairKey);
    if (!repair || objectId !== repair[0]) return;
    event.handled = true;
    if (!(state.repaired ?? []).includes(repairKey) && !inventory.contains(SIEGE_HALL.hammer)) {
      player.sendMessage("You need a hammer from the crate in the hall to repair this.");
      return;
    }
    if ((state.repaired ?? []).includes(repairKey)) {
      player.sendMessage("You have already repaired this part of the hall.");
      return;
    }
    if (!replaceHallObject(event, repair[1])) return;
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, { ...state, repaired: [...(state.repaired ?? []), repairKey] });
    applyHallIntegrity(player, 8, true);
    player.sendMessage(repair[0] === SIEGE_HALL.damagedPillar ? "You brace and repair the damaged pillar." : "You repair the damaged window.");
  }

  function healSiegeAranei(event) {
    const player = event?.player;
    const npc = event?.npc ?? event?.target;
    const npcId = event?.npcId ?? npc?.getId?.();
    if (!player || !npc || !SIEGE_HALL.injuredAranei.includes(npcId) ||
      stage(player) !== STAGE.SIEGE || hallDefenceState(player).phase !== "hall") return;
    event.handled = true;
    const state = hallDefenceState(player);
    const key = injuredAraneiKey(npc);
    if ((state.healed ?? []).includes(key)) return;
    const inventory = player.getInventory();
    if (!inventory.contains(SIEGE_HALL.healingPotion)) {
      player.sendMessage("The Aranei needs a healing potion from the crate in the hall.");
      return;
    }
    inventory.deleteNumber(SIEGE_HALL.healingPotion, 1);
    npc.setNpcTransformationId?.(NpcIdentifiers.ARANEI_106);
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, { ...state, healed: [...(state.healed ?? []), key] });
    applyHallIntegrity(player, 12, true);
    siegeHallInjured.delete(player.getUsername?.() ?? player.getIndex?.());
    player.sendMessage("You give the healing potion to the Aranei and help them back to their feet.");
  }

  function handleSiegeDrakanHit(event) {
    const npc = event?.npc;
    const hit = event?.hit;
    const fight = npc && siegeDrakanEncounters.get(npc.getArea?.());
    if (!fight || npc !== fight.boss || fight.ending || !hit) return;
    let remaining = Math.max(0, npc.getHitpoints() - fight.thresholdHp);
    for (const part of hit.getHits?.() ?? []) {
      const damage = part.getDamage?.() ?? 0;
      if (damage <= 0) continue;
      const allowed = Math.min(remaining, damage);
      if (allowed < damage) part.setDamage(allowed);
      remaining -= allowed;
    }
    hit.updateTotalDamage?.();
  }

  function handleSiegeDrakanDeath(event) {
    const npc = event?.npc;
    const fight = npc && siegeDrakanEncounters.get(npc.getArea?.());
    if (!fight || npc !== fight.boss || fight.finished) return false;
    // The story exits at 58% health; never let the combat hit skip its cutscene.
    npc.setHitpoints(Math.max(1, fight.thresholdHp));
    fight.ending = true;
    startTranscript(api, fight.player, npc.getId(), PAGE,
      "drakan-s-siege-fighting-lowerniel-upon-lowerniel-reaching-58-hp");
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
    if (handleSiegeDrakanDeath(event)) return;
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

  function nativeStage(value, player) {
    if (value === STAGE.COMPLETE) return 176;
    if (value === STAGE.PREPARATIONS) {
      const prep = player?.getAttribute(PREP_ATTRIBUTE) ?? {};
      if (prep.flail && prep.stakes) return 114;
      if (prep.flail) return 112;
      if (prep.stewFed) return 110;
      return player?.getInventory?.().contains(PREP.stew) ? 104 : 102;
    }
    if (value === STAGE.SIEGE) {
      const phase = player?.getAttribute(SIEGE_DEFENCE_ATTRIBUTE)?.phase;
      return ({ 'fall-back': 118, hall: 120, breach: 122 })[phase] ?? 116;
    }
    return value;
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

  function enterVampyriumCastle(event) {
    const player = event?.player;
    const { x, y, z } = event?.location ?? {};
    const name = String(event?.definition?.getName?.() ?? "").toLowerCase();
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.SLEPE ||
      x !== 3161 || y !== 7710 || z !== 0 || !name.includes("portal")) return;
    // The story's portal interaction has no transcript action. This is the
    // actual transition into the Vampyrium castle chapter.
    advance(player, STAGE.CASTLE);
  }

  // Transcript cutscenes mark the major route changes. The separate object,
  // puzzle and boss handlers below remain responsible for the actual mechanics.
  function onTranscriptAction(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return;
    const next = ACTION_STAGE[event.stepId];
    if (event.stepId === "vqg4qO") {
      bridge.finish(player);
      player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, { phase: "hall", integrity: 100, healed: [], repaired: [] });
      quest.setStage(player, STAGE.SIEGE);
      spawnSiegeInjuredAranei(player);
    }
    if (event.stepId === "Sut83Q") {
      const prep = player.getAttribute(PREP_ATTRIBUTE) ?? {};
      if (!prep.flail || !prep.stakes) {
        player.sendMessage("Before the siege, finish the hallowed flail and cut blisterwood stakes for the defence.");
        return;
      }
      player.setAttribute(PREP_COMPLETE, true);
      advance(player, STAGE.SIEGE);
      bridge.start(player);
    }
    if (event.stepId === "XqVfhB" && !player.getAttribute(THRONE_PUZZLE_ATTRIBUTE)?.keyClaimed) {
      player.sendMessage("Solve the throne-room bust puzzle and take the half moon key before leaving the castle.");
      return;
    }
    if (next) advance(player, next);
    if (event.stepId === "4G5OZg") startWyrdBattle(player);
    if (event.stepId === "t7FMNM") startDrakanBattle(player);
    if (event.stepId === "4ebW6l" || event.stepId === "BzMe5D") finishDrakanEncounter(player);
    if (event.stepId === "Xz7d4O") startSiegeDrakanBattle(player);
    if (event.stepId === "zPiZ9c") finishSiegeDrakanBattle(player);
    if (event.stepId === "1Z5SGt" && stage(player) === STAGE.THEATRE &&
      !player.getAttribute(TOB_CHALLENGE_ATTRIBUTE)?.started) {
      player.setAttribute(TOB_CHALLENGE_ATTRIBUTE, { started: true, completed: false });
      api.emitCustomEvent("tob:bmr:start", { player });
    }
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

  function onBloodMoonTobCompleted(event) {
    const player = event?.player;
    const challenge = player?.getAttribute(TOB_CHALLENGE_ATTRIBUTE);
    if (!player || stage(player) !== STAGE.THEATRE || !challenge?.started || challenge.completed) return;
    player.setAttribute(TOB_CHALLENGE_ATTRIBUTE, { ...challenge, completed: true });
    advance(player, STAGE.WYRDS);
    startTranscript(api, player, NpcIdentifiers.SUGADINTI_VITUR_6, PAGE,
      "another-night-at-the-theatre-after-killing-the-nylocas-vasilias");
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
    if (quest.isComplete(player)) return ["The confrontation at the blood moon is over.", "The Myreque have survived the battle and must regroup."];
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

  function hasItem(player, itemId) {
    return player.getInventory().contains(itemId) || player.getEquipment?.().contains?.(itemId) === true;
  }

  function replaceItems(player, required, removed, added) {
    const inventory = player.getInventory();
    if (!required.every((itemId) => inventory.contains(itemId))) return false;
    for (const itemId of removed) inventory.deleteNumber(itemId, 1);
    for (const [itemId, amount] of added) inventory.adds(itemId, amount);
    return true;
  }

  function prepAction(player, variant, npcId = 0) {
    return startTranscript(api, player, npcId, PAGE, variant);
  }

  function prepObjectAt(event, x, y, z) {
    const tile = event?.location;
    return tile?.x === x && tile?.y === y && tile?.z === z;
  }

  function handleCastleThronePuzzle(event) {
    const player = event?.player;
    const value = player && stage(player);
    if (!player || quest.isComplete(player) || value < STAGE.CASTLE || value > STAGE.ESCAPE) return;
    const tile = event.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    const state = player.getAttribute(THRONE_PUZZLE_ATTRIBUTE) ?? { step: 0, solved: false, keyClaimed: false };
    if (name.includes("throne") && x === 2313 && y === 7392 && z === 0) {
      event.handled = true;
      const throneOption = String(event.option ?? "").toLowerCase();
      if (["investigate", "search"].includes(throneOption) && !state.started && !state.solved) {
        player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, { ...state, started: true });
        player.sendMessage("The four busts conceal a mechanism. Their levers must be pulled in the right order.");
        return;
      }
      if (state.solved && !state.keyClaimed && ["search", "take", "investigate"].includes(throneOption)) {
        if (player.getInventory().adds(ItemIdentifiers.HALF_MOON_KEY, 1)) {
          player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, { ...state, keyClaimed: true });
          player.sendMessage("You find a half moon key inside the throne.");
        }
        return;
      }
      player.sendMessage(state.solved ? "The throne's hidden compartment is empty." : "There is nothing more to learn from the throne yet.");
      return;
    }
    const leverRow = x === 2317 && [7393, 7392, 7391, 7390].indexOf(y);
    if (!name.includes("bust") || !name.includes("lever") || z !== 0 || leverRow < 0) return;
    event.handled = true;
    if (!state.started) {
      player.sendMessage("Investigate the throne first; the busts must be part of its mechanism.");
      return;
    }
    if (state.solved) {
      player.sendMessage("The busts are already set in the correct order.");
      return;
    }
    // The OSRS puzzle order is the third bust, fourth, first, then second.
    const order = [2, 3, 0, 1];
    if (leverRow !== order[state.step]) {
      player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, { ...state, step: 0 });
      player.sendMessage("The mechanism clicks back into place. The bust sequence has reset.");
      return;
    }
    const step = state.step + 1;
    const solved = step === order.length;
    player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, { ...state, step, solved });
    player.sendMessage(solved ? "The busts turn into alignment, and a compartment opens beneath the throne." : "The bust lever locks into place.");
  }

  function handleCastleBasinPuzzle(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (name !== "shelves" || x !== 2380 || y !== 7396 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    const inventory = player.getInventory();
    const potions = [ItemIdentifiers.CLOUDY_GREY_POTION, ItemIdentifiers.WEIGHTLESS_BLACK_POTION,
      ItemIdentifiers.THICK_RED_POTION, ItemIdentifiers.COLD_BLUISH_WHITE_POTION];
    for (const potion of potions) if (!inventory.contains(potion)) inventory.adds(potion, 1);
    player.sendMessage("You search the north-west shelves and take one potion of each colour.");
  }

  function handleBasinPotion(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const basin = `${x},${y}`;
    const correctBasin = new Map([
      [ItemIdentifiers.THICK_RED_POTION, "2380,7389"], // north-west: blood
      [ItemIdentifiers.WEIGHTLESS_BLACK_POTION, "2387,7389"], // north-east: shadow
      [ItemIdentifiers.CLOUDY_GREY_POTION, "2380,7384"], // south-west: smoke
      [ItemIdentifiers.COLD_BLUISH_WHITE_POTION, "2387,7384"], // south-east: ice
    ]);
    const expected = correctBasin.get(event.itemId);
    if (!expected || !["61702", "61703", "61704", "61705"].includes(String(event.objectId))) return;
    event.handled = true;
    const state = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    if (!player.getInventory().contains(event.itemId)) return;
    if (basin !== expected) {
      player.sendMessage("The basin rejects the potion. Read its inscription and choose another basin.");
      return;
    }
    if (state.basins[basin]) {
      player.sendMessage("A potion has already been poured into this basin.");
      return;
    }
    player.getInventory().deleteNumber(event.itemId, 1);
    const basins = { ...state.basins, [basin]: true };
    player.setAttribute(BASIN_PUZZLE_ATTRIBUTE, { ...state, basins });
    player.sendMessage("You pour the potion into the basin. The liquid settles beneath its inscription.");
  }

  function handleBasinAltar(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (name !== "altar" || x !== 2382 || y !== 7393 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    if (!Object.values(state.basins).length || Object.keys(state.basins).length !== 4) {
      player.sendMessage("The altar remains still. The four inscriptions must each receive the correct potion.");
      return;
    }
    if (!player.getInventory().contains(ItemIdentifiers.ANCIENT_SYMBOL)) {
      player.getInventory().adds(ItemIdentifiers.ANCIENT_SYMBOL, 1);
      player.setAttribute(BASIN_PUZZLE_ATTRIBUTE, { ...state, symbol: true });
      player.sendMessage("You search the altar and take an ancient symbol.");
    } else {
      player.sendMessage("The altar's ancient symbol is already in your inventory.");
    }
  }

  function handleSolidKeyObjects(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    const basinState = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    const state = player.getAttribute(SOLID_KEY_ATTRIBUTE) ?? { shield: false, mounted: false, key: false };
    if (name === "crate" && x === 2439 && y === 7378) {
      event.handled = true;
      if (!basinState.symbol || !player.getInventory().contains(ItemIdentifiers.ANCIENT_SYMBOL)) {
        player.sendMessage("The ancient shield's room lies beyond the chapel. Find the ancient symbol first.");
        return;
      }
      if (!player.getInventory().contains(ItemIdentifiers.ANCIENT_SHIELD)) player.getInventory().adds(ItemIdentifiers.ANCIENT_SHIELD, 1);
      player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...state, shield: true });
      player.sendMessage("You search the crate and take an ancient shield.");
      return;
    }
    if (x !== 2543 || y !== 7361) return;
    if (state.mounted) {
      event.handled = true;
      if (!state.key && player.getInventory().adds(ItemIdentifiers.SOLID_KEY, 1)) {
        player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...state, key: true });
        player.sendMessage("You search the mounted shield and take the solid key.");
      }
    }
  }

  function setClockValue(player, side, hand, value) {
    const state = player.getAttribute(CLOCK_ATTRIBUTE) ?? { west: {}, east: {}, emblem: false };
    const clock = { ...(state[side] ?? {}), [hand]: value };
    player.setAttribute(CLOCK_ATTRIBUTE, { ...state, [side]: clock });
    player.sendMessage(`You set the ${hand === "large" ? "large" : "small"} clock hand to ${value}.`);
  }

  function promptClockValue(player, side, hand) {
    const choices = [];
    for (let value = 0; value < 12; value++) {
      choices.push(String(value), () => setClockValue(player, side, hand, value));
    }
    api.sendMultiChatboxPrompt(player, `Set the ${side} ${hand} clock hand`, ...choices);
  }

  function handleCastleClocks(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const state = player.getAttribute(CLOCK_ATTRIBUTE) ?? { west: {}, east: {}, emblem: false };
    if (event.objectId === 61752 && x === 2323 && y === 7386) {
      event.handled = true;
      if (!player.getInventory().contains(ItemIdentifiers.SMALL_CLOCK_HAND)) {
        player.getInventory().adds(ItemIdentifiers.SMALL_CLOCK_HAND, 1);
      }
      player.sendMessage("You search the shelves and take a small clock hand.");
      return;
    }
    if (event.objectId === 61751 && x === 2466 && y === 7370) {
      event.handled = true;
      if (!player.getInventory().contains(ItemIdentifiers.LARGE_CLOCK_HAND)) {
        player.getInventory().adds(ItemIdentifiers.LARGE_CLOCK_HAND, 1);
      }
      player.sendMessage("You search the crate and take a large clock hand.");
      return;
    }
    const side = event.objectId === 61656 && x === 2344 && y === 7372 ? "west" :
      event.objectId === 61657 && x === 2350 && y === 7372 ? "east" : null;
    if (side) {
      event.handled = true;
      const clock = state[side] ?? {};
      if (!clock.installed) {
        player.sendMessage("The clock is missing its hand. Fit the small hand to the western clock and the large hand to the eastern clock.");
        return;
      }
      api.sendMultiChatboxPrompt(player, `Adjust the ${side} grandfather clock`,
        "Set the large hand", () => promptClockValue(player, side, "large"),
        "Set the small hand", () => promptClockValue(player, side, "small"));
      return;
    }
    if (event.objectId === 61662 && x === 2346 && y === 7372) {
      event.handled = true;
      const west = state.west ?? {};
      const east = state.east ?? {};
      if (west.large !== 11 || west.small !== 9 || east.large !== 0 || east.small !== 4) {
        player.sendMessage("The fireplace mechanism remains locked. The western clock must show 11:45 and the eastern clock 12:20.");
        return;
      }
      if (!player.getInventory().contains(ItemIdentifiers.DRAKAN_EMBLEM_2)) {
        player.getInventory().adds(ItemIdentifiers.DRAKAN_EMBLEM_2, 1);
        player.setAttribute(CLOCK_ATTRIBUTE, { ...state, emblem: true });
        player.sendMessage("You search the fireplace and take a second Drakan emblem.");
      }
    }
  }

  function handleClockHandOnClock(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE || event.location?.z !== 0) return;
    const side = event.objectId === 61656 && event.location.x === 2344 && event.location.y === 7372 ? "west" :
      event.objectId === 61657 && event.location.x === 2350 && event.location.y === 7372 ? "east" : null;
    const itemId = event.itemId;
    const expectedItem = side === "west" ? ItemIdentifiers.SMALL_CLOCK_HAND :
      side === "east" ? ItemIdentifiers.LARGE_CLOCK_HAND : null;
    if (!side || itemId !== expectedItem) return;
    event.handled = true;
    const inventory = player.getInventory();
    if (!inventory.contains(itemId)) return;
    const state = player.getAttribute(CLOCK_ATTRIBUTE) ?? { west: {}, east: {}, emblem: false };
    if (state[side]?.installed) {
      player.sendMessage("A clock hand is already fitted there.");
      return;
    }
    inventory.deleteNumber(itemId, 1);
    player.setAttribute(CLOCK_ATTRIBUTE, { ...state, [side]: { ...(state[side] ?? {}), installed: true } });
    player.sendMessage(`You fit the ${side === "west" ? "small" : "large"} clock hand to the ${side} clock.`);
  }

  function promptGalleryChest(player) {
    const state = player.getAttribute(GALLERY_CHEST_ATTRIBUTE) ?? { step: 0, solved: false, key: false };
    const solution = ["right", "down", "right", "left", "left"];
    if (state.step >= solution.length) {
      player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...state, solved: true });
      player.sendMessage("The chest's arrow mechanism clicks open. Search it for the crescent moon key.");
      return;
    }
    const options = ["Up", "Right", "Down", "Left"];
    const callbacks = options.map((label) => () => {
      const direction = label.toLowerCase();
      const current = player.getAttribute(GALLERY_CHEST_ATTRIBUTE) ?? { step: 0, solved: false, key: false };
      if (direction !== solution[current.step]) {
        player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...current, step: 0, solved: false });
        player.sendMessage("The arrows click back to their starting positions. The chest puzzle resets.");
        return;
      }
      const step = current.step + 1;
      player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...current, step, solved: step === solution.length });
      if (step === solution.length) {
        player.sendMessage("The chest's arrow mechanism clicks open. Search it for the crescent moon key.");
      } else {
        player.sendMessage(`One arrow locks into place (${step} of ${solution.length}).`);
        promptGalleryChest(player);
      }
    });
    const pairs = [];
    options.forEach((label, index) => pairs.push(label, callbacks[index]));
    api.sendMultiChatboxPrompt(player, `Chest arrows (${state.step + 1} of ${solution.length})`, ...pairs);
  }

  function handleGalleryChest(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      event.objectId !== 61681 || event.location?.x !== 2379 || event.location?.y !== 7372 || event.location?.z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(GALLERY_CHEST_ATTRIBUTE) ?? { step: 0, solved: false, key: false };
    if (!state.solved) {
      promptGalleryChest(player);
      return;
    }
    if (state.key) {
      player.sendMessage("The chest is empty now.");
      return;
    }
    if (player.getInventory().adds(ItemIdentifiers.CRESCENT_MOON_KEY, 1)) {
      player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...state, key: true });
      player.sendMessage("You search the chest and take the crescent moon key.");
    }
  }

  function syncHuntGroundItems(event) {
    const player = event?.player ?? event;
    if (!player || player.isPlayerBot?.() === true || stage(player) !== STAGE.BLOOD_HUNT) return;
    const hunt = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
    if (hunt.crankStarted || hasItem(player, HUNT_ITEMS.crank)) return;
    const manager = api.getItemOnGroundManager();
    const tile = new Location(2603, 7847, 0);
    if (!manager?.registerLocation || manager.getGroundItem(player.getUsername(), HUNT_ITEMS.crank, tile, player.getPrivateArea?.() ?? null)) return;
    manager.registerLocation(player, new Item(HUNT_ITEMS.crank, 1), tile);
  }

  function promptHuntCode(player, kind) {
    const code = kind === "shed" ? "TOOLS" : "35158";
    const key = kind === "shed" ? "shedDigits" : "chestDigits";
    const state = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
    const entered = state[key] ?? "";
    const options = kind === "shed" ? ["T", "O", "L", "S"] : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    const pairs = [];
    for (const label of options) pairs.push(label, () => {
      const current = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
      const value = (current[key] ?? "") + label;
      if (value !== code.slice(0, value.length)) {
        player.setAttribute(HUNT_ATTRIBUTE, { ...current, [key]: "" });
        player.sendMessage("The lock clicks and resets.");
        return;
      }
      player.setAttribute(HUNT_ATTRIBUTE, { ...current, [key]: value });
      if (value === code) {
        player.setAttribute(HUNT_ATTRIBUTE, { ...current, [key]: value, [`${kind}Open`]: true });
        if (kind === "shed" && !player.getInventory().contains(HUNT_ITEMS.boltCutters)) player.getInventory().adds(HUNT_ITEMS.boltCutters, 1);
        if (kind === "chest" && !player.getInventory().contains(HUNT_ITEMS.jovkaiKey)) player.getInventory().adds(HUNT_ITEMS.jovkaiKey, 1);
        player.sendMessage(kind === "shed" ? "The shed lock opens. You take a pair of bolt cutters." : "The altar chest opens. You take the Jovkai key.");
        return;
      }
      promptHuntCode(player, kind);
    });
    api.sendMultiChatboxPrompt(player, `${kind === "shed" ? "Shed" : "Altar chest"} combination (${entered.length + 1} of ${code.length})`, ...pairs);
  }

  function handleBloodHuntObjects(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const state = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
    const inventory = player.getInventory();
    const has = (itemId) => inventory.contains(itemId);
    const locked = (message) => { event.handled = true; player.sendMessage(message); };
    if (x === 2612 && y === 7853 && !has(HUNT_ITEMS.viturKey)) return locked("The Vitur manor is locked. Find the key in the bookcase north-west of the crank.");
    if ((x === 2612 && y === 7852 || x === 2598 && y === 7843) && !has(HUNT_ITEMS.viturKey)) return locked("The door is locked. You need the Vitur key.");
    if (x === 2590 && y === 7818) {
      if (!has(HUNT_ITEMS.boltCutters)) return locked("The clothes-shop door is chained shut. You need bolt cutters.");
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, chainCut: true });
      player.sendMessage("You cut through the chain on the clothes-shop door.");
      return;
    }
    if (x === 2599 && y === 7826 && !has(HUNT_ITEMS.myrmelKey)) return locked("The pub door is locked. Join the two halves of the key to make a Myrmel key.");
    if (x === 2614 && y === 7814 && !has(HUNT_ITEMS.shadumKey)) return locked("The house is locked. The barrel in the Myrmel pub may hold a key.");
    if (x === 2580 && y === 7812 && !has(HUNT_ITEMS.jovkaiKey)) return locked("The smithy is locked. Search the altar chest for its key.");
    if (x === 2580 && y === 7835 && (!has(HUNT_ITEMS.myrmelKey) || !has(HUNT_ITEMS.trapdoorKey) || !has(HUNT_ITEMS.crank))) {
      return locked("The bank requires the Myrmel key, trapdoor key, and crank wheel.");
    }
    if (x === 2582 && y === 7834) {
      if (!has(HUNT_ITEMS.trapdoorKey) || !has(HUNT_ITEMS.crank)) return locked("The bank crank needs the trapdoor key and crank wheel.");
      inventory.deleteNumber(HUNT_ITEMS.crank, 1);
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, bankCrank: true });
      player.sendMessage("You fit the wheel and turn the bank crank; the trapdoor latch releases.");
      return;
    }
    if (x === 2579 && y === 7830) {
      if (!has(HUNT_ITEMS.trapdoorKey) || !state.bankCrank) return locked("The trapdoor is locked. Find its key and operate the bank crank.");
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, enteredTrapdoor: true });
      return;
    }
    if (x === 2588 && y === 7855) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.crank)) { player.sendMessage("The crank base needs its wheel."); return; }
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, crankStarted: true });
      player.sendMessage("You fit the wheel and turn the crank. A presence stirs behind you. Run!");
      return;
    }
    if (x === 2585 && y === 7861) {
      event.handled = true;
      if (!state.crankStarted) { player.sendMessage("You should get the nearby crank working first."); return; }
      if (!inventory.contains(HUNT_ITEMS.dustyBook)) inventory.adds(HUNT_ITEMS.dustyBook, 1);
      player.sendMessage("You search the bookcase and find a dusty book. Read it to discover the Vitur key.");
      return;
    }
    if (x === 2616 && y === 7855) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.viturKey)) { player.sendMessage("The shed lock needs the Vitur key."); return; }
      if (!state.shedOpen) promptHuntCode(player, "shed");
      else if (!inventory.contains(HUNT_ITEMS.boltCutters)) inventory.adds(HUNT_ITEMS.boltCutters, 1);
      return;
    }
    if (x === 2600 && y === 7845) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.viturKey)) { player.sendMessage("The manor's doors are locked. Find the Vitur key in the bookcase north-west of here."); return; }
      if (!inventory.contains(HUNT_ITEMS.toothHalf)) inventory.adds(HUNT_ITEMS.toothHalf, 1);
      player.sendMessage("You take the tooth half of a key from the table.");
      return;
    }
    if (x === 2588 && y === 7816) {
      event.handled = true;
      if (!state.chainCut || !inventory.contains(HUNT_ITEMS.boltCutters)) { player.sendMessage("The door is chained shut. Cut the chain with bolt cutters first."); return; }
      if (!inventory.contains(HUNT_ITEMS.loopHalf)) inventory.adds(HUNT_ITEMS.loopHalf, 1);
      player.sendMessage("You cut the chain and take the loop half of a key.");
      return;
    }
    if (x === 2596 && y === 7833) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.myrmelKey)) { player.sendMessage("The pub door's lock needs the Myrmel key."); return; }
      if (!inventory.contains(HUNT_ITEMS.bucket) && !inventory.contains(HUNT_ITEMS.bucketWater)) inventory.adds(HUNT_ITEMS.bucket, 1);
      player.sendMessage("You take a bucket from the house.");
      return;
    }
    if (x === 2592 && y === 7825) {
      if (!event.itemId && !event.usedItemId) return;
      const itemId = event.itemId ?? event.usedItemId;
      if (itemId !== HUNT_ITEMS.bucket) return;
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.bucket)) return;
      inventory.deleteNumber(HUNT_ITEMS.bucket, 1);
      inventory.adds(HUNT_ITEMS.bucketWater, 1);
      player.sendMessage("You fill the bucket with water from the well.");
      return;
    }
    if (x === 2592 && y === 7833 && event.itemId === HUNT_ITEMS.bucketWater) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.bucketWater)) return;
      inventory.deleteNumber(HUNT_ITEMS.bucketWater, 1);
      inventory.adds(HUNT_ITEMS.shadumKey, 1);
      player.sendMessage("The water washes away the grime on the barrel and reveals a Shadum key.");
      return;
    }
    if (x === 2619 && y === 7812) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.shadumKey)) { player.sendMessage("The locked house needs its Shadum key."); return; }
      if (!inventory.contains(HUNT_ITEMS.trapdoorKey)) inventory.adds(HUNT_ITEMS.trapdoorKey, 1);
      player.sendMessage("You find the trapdoor key inside the house.");
      return;
    }
    if (x === 2576 && y === 7846) {
      event.handled = true;
      if (!state.enteredTrapdoor || !inventory.contains(HUNT_ITEMS.trapdoorKey)) { player.sendMessage("The chest is below the bank. Operate the crank and enter with the trapdoor key first."); return; }
      if (!state.chestOpen) promptHuntCode(player, "chest");
      else if (!inventory.contains(HUNT_ITEMS.jovkaiKey)) inventory.adds(HUNT_ITEMS.jovkaiKey, 1);
      return;
    }
    if (x === 2582 && y === 7817) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.jovkaiKey)) { player.sendMessage("The smithy lock needs the Jovkai key."); return; }
      if (!inventory.contains(HUNT_ITEMS.oldCog)) inventory.adds(HUNT_ITEMS.oldCog, 1);
      player.sendMessage("You take the old cog from the table.");
    }
  }

  function routeBloodHuntObjects(event) {
    const player = event?.player;
    if (!player || stage(player) !== STAGE.BLOOD_HUNT || event.objectId !== 61818) return;
    const location = event.object?.getLocation?.() ?? event.object?.location ?? {};
    const x = location.getX?.() ?? location.x;
    const y = location.getY?.() ?? location.y;
    const z = location.getZ?.() ?? location.z;
    if (x === 2585 && y === 7861 && z === 0) event.destination = { x: 2584, y: 7862, z: 0 };
  }

  function handleBloodHuntItemOnObject(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const itemId = event.itemId;
    const inventory = player.getInventory();
    if (x === 2592 && y === 7825 && itemId === HUNT_ITEMS.bucket) {
      handleBloodHuntObjects({ ...event, player, itemId });
    } else if (x === 2592 && y === 7833 && itemId === HUNT_ITEMS.bucketWater) {
      handleBloodHuntObjects({ ...event, player, itemId });
    } else if (x === 2582 && y === 7834 && itemId === HUNT_ITEMS.crank) {
      event.handled = true;
      if (inventory.contains(HUNT_ITEMS.trapdoorKey)) {
        inventory.deleteNumber(HUNT_ITEMS.crank, 1);
        player.setAttribute(HUNT_ATTRIBUTE, { ...(player.getAttribute(HUNT_ATTRIBUTE) ?? {}), bankCrank: true });
        player.sendMessage("You fit the wheel to the bank's crank. The mechanism lifts the trapdoor latch.");
      }
    }
  }

  function handleBloodHuntItemOnItem(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT) return;
    const pair = new Set([event.usedItemId, event.usedWithItemId]);
    const inventory = player.getInventory();
    if (pair.has(HUNT_ITEMS.toothHalf) && pair.has(HUNT_ITEMS.loopHalf)) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.toothHalf) || !inventory.contains(HUNT_ITEMS.loopHalf)) return;
      inventory.deleteNumber(HUNT_ITEMS.toothHalf, 1);
      inventory.deleteNumber(HUNT_ITEMS.loopHalf, 1);
      inventory.adds(HUNT_ITEMS.myrmelKey, 1);
      player.sendMessage("The two halves fit together to make a Myrmel key.");
    }
  }

  function readDustyBook(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT || event.itemId !== HUNT_ITEMS.dustyBook) return;
    event.handled = true;
    if (!player.getInventory().contains(HUNT_ITEMS.dustyBook)) return;
    player.getInventory().deleteNumber(HUNT_ITEMS.dustyBook, 1);
    player.getInventory().adds(HUNT_ITEMS.viturKey, 1);
    player.setAttribute(HUNT_ATTRIBUTE, { ...(player.getAttribute(HUNT_ATTRIBUTE) ?? {}), readBook: true });
    player.sendMessage("A key falls from the dusty book. It is marked with the Vitur crest.");
  }

  function handleAncientShieldAssembly(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const pair = new Set([event.usedItemId, event.usedWithItemId]);
    if (!pair.has(ItemIdentifiers.ANCIENT_SYMBOL) || !pair.has(ItemIdentifiers.ANCIENT_SHIELD)) return;
    event.handled = true;
    const inventory = player.getInventory();
    if (!inventory.contains(ItemIdentifiers.ANCIENT_SYMBOL) || !inventory.contains(ItemIdentifiers.ANCIENT_SHIELD)) return;
    inventory.deleteNumber(ItemIdentifiers.ANCIENT_SYMBOL, 1);
    inventory.deleteNumber(ItemIdentifiers.ANCIENT_SHIELD, 1);
    if (!inventory.adds(ItemIdentifiers.SHIELD_WITH_SYMBOL, 1)) {
      inventory.adds(ItemIdentifiers.ANCIENT_SYMBOL, 1);
      inventory.adds(ItemIdentifiers.ANCIENT_SHIELD, 1);
      player.sendMessage("Make room for the shield with symbol.");
      return;
    }
    player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...(player.getAttribute(SOLID_KEY_ATTRIBUTE) ?? {}), assembled: true });
    player.sendMessage("You fit the ancient symbol onto the shield.");
  }

  function handleMountShield(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      event.itemId !== ItemIdentifiers.SHIELD_WITH_SYMBOL) return;
    const { x, y, z } = event.location ?? {};
    if (x !== 2543 || y !== 7361 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(SOLID_KEY_ATTRIBUTE) ?? { shield: false, mounted: false, key: false };
    if (!state.assembled || !player.getInventory().contains(ItemIdentifiers.SHIELD_WITH_SYMBOL)) {
      player.sendMessage("The shield is missing its ancient symbol.");
      return;
    }
    player.getInventory().deleteNumber(ItemIdentifiers.SHIELD_WITH_SYMBOL, 1);
    player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...state, mounted: true });
    player.sendMessage("You mount the shield on the southern wall.");
  }

  function handleRefiner(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (name === "shelves" && x === 2513 && y === 7387 && z === 0) {
      event.handled = true;
      const inventory = player.getInventory();
      for (const [id, amount] of [[ItemIdentifiers.VIAL_OF_WATER_6, 2],
        [ItemIdentifiers.VIAL_OF_BLOOD_5, 3], [ItemIdentifiers.PURE_ESSENCE_4, 3]]) {
        const missing = amount - (inventory.getAmount?.(id) ?? (inventory.contains(id) ? 1 : 0));
        if (missing > 0) inventory.adds(id, missing);
      }
      player.sendMessage("You search the north-west shelves and take two vials of water, three vials of blood, and three pure essences.");
      return;
    }
    if (name !== "blood stockpile" || x !== 2535 || y !== 7385 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(REFINER_ATTRIBUTE) ?? { mixtures: [], made: [], used: 0, total: 0, destroyed: false };
    if (state.used !== 4 || state.total !== 53) {
      player.sendMessage("The stockpile is protected by the refiner. Make mixtures totalling 53 haemalchemic potential and use all four on the basin.");
      return;
    }
    player.setAttribute(REFINER_ATTRIBUTE, { ...state, destroyed: true });
    player.sendMessage("You destroy the blood stockpile. The refiner's north door is now clear.");
  }

  function handleRefinerMixture(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE || event.objectId !== 61709) return;
    const { x, y, z } = event.location ?? {};
    if (x !== 2520 || y !== 7385 || z !== 0) return;
    const inventory = player.getInventory();
    const state = player.getAttribute(REFINER_ATTRIBUTE) ?? { mixtures: [], used: 0, total: 0, destroyed: false };
    const made = state.made ?? state.mixtures;
    const candidates = [
      { items: [ItemIdentifiers.VIAL_OF_BLOOD_5, ItemIdentifiers.PURE_ESSENCE_4], value: 17, max: 2 },
      { items: [ItemIdentifiers.VIAL_OF_BLOOD_5, ItemIdentifiers.VIAL_OF_WATER_6], value: 13, max: 1 },
      { items: [ItemIdentifiers.PURE_ESSENCE_4, ItemIdentifiers.VIAL_OF_WATER_6], value: 6, max: 1 },
    ];
    const recipe = candidates.find(({ items, value, max }) => items.includes(event.itemId) &&
      items.every((id) => inventory.contains(id)) && made.filter((entry) => entry === value).length < max);
    if (!recipe) return;
    event.handled = true;
    for (const id of recipe.items) inventory.deleteNumber(id, 1);
    if (!inventory.adds(ItemIdentifiers.CHEMICAL_VIAL, 1)) {
      for (const id of recipe.items) inventory.adds(id, 1);
      player.sendMessage("Make room in your inventory for the chemical vial.");
      return;
    }
    const mixtures = [...state.mixtures, recipe.value];
    player.setAttribute(REFINER_ATTRIBUTE, { ...state, mixtures, made: [...made, recipe.value] });
    player.sendMessage(`The refiner fills a chemical vial with ${recipe.value} haemalchemic potential.`);
  }

  function handleRefinerVial(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      event.itemId !== ItemIdentifiers.CHEMICAL_VIAL || event.objectId !== 61707) return;
    const { x, y, z } = event.location ?? {};
    if (x !== 2518 || y !== 7389 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(REFINER_ATTRIBUTE) ?? { mixtures: [], used: 0, total: 0, destroyed: false };
    if (!state.mixtures.length || !player.getInventory().contains(ItemIdentifiers.CHEMICAL_VIAL)) {
      player.sendMessage("The refiner's basin is waiting for a prepared chemical vial.");
      return;
    }
    player.getInventory().deleteNumber(ItemIdentifiers.CHEMICAL_VIAL, 1);
    const [value, ...mixtures] = state.mixtures;
    const total = state.total + value;
    player.setAttribute(REFINER_ATTRIBUTE, { ...state, mixtures, used: state.used + 1, total });
    player.sendMessage(`The basin absorbs the vial. Haemalchemic potential: ${total} HP.`);
  }

  function handlePrepObject(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) < STAGE.PREPARATIONS || stage(player) >= STAGE.SIEGE) return;
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    const option = String(event.option ?? "").toLowerCase();
    const inventory = player.getInventory();
    let variant = null;
    let changed = false;
    if (name === "amitire plant" && prepObjectAt(event, 2982, 7679, 0) && !hasItem(player, PREP.leaves)) {
      changed = inventory.adds(PREP.leaves, 1);
      variant = "hallowed-preparations-picking-the-amitire-plant";
    } else if (name === "shelves" && prepObjectAt(event, 3159, 7824, 1) && !hasItem(player, PREP.bowl)) {
      changed = inventory.adds(PREP.bowl, 1);
      variant = "hallowed-preparations-searching-the-shelves";
    } else if (name === "cupboard" && prepObjectAt(event, 3155, 7832, 1)) {
      event.handled = true;
      api.sendMultiChatboxPrompt(player, "What would you like to take?",
        "Potato.", () => takePrepItem(player, PREP.potato, "You take a potato from the cupboard."),
        "Raw meat.", () => takePrepItem(player, PREP.rawMeat, "You take some raw meat from the cupboard."),
        "Nothing.", () => {});
      return;
    } else if (name === "workbench" && prepObjectAt(event, 3176, 7841, 1)) {
      event.handled = true;
      api.sendMultiChatboxPrompt(player, "What would you like to take?",
        "Hammer.", () => takePrepItem(player, PREP.hammer, "You take a hammer from the workbench."),
        "Chisel.", () => takePrepItem(player, PREP.chisel, "You take a chisel from the workbench."),
        "Knife.", () => takePrepItem(player, PREP.knife, "You take a knife from the workbench."),
        "Nothing.", () => {});
      return;
    } else if ((name.includes("crate") || name.includes("blisterwood")) && prepObjectAt(event, 3177, 7843, 1) && !hasItem(player, PREP.logs)) {
      changed = inventory.adds(PREP.logs, 1);
      variant = "hallowed-preparations-searching-the-blisterwood-crate";
    } else if ((name.includes("crate") || name.includes("sickle")) && prepObjectAt(event, 3181, 7841, 1) && !hasItem(player, PREP.blessedSickle)) {
      changed = inventory.adds(PREP.blessedSickle, 1);
      variant = "hallowed-preparations-searching-the-sickle-crate";
    } else if (name === "chest" && !hasItem(player, PREP.diamond) && hasItem(player, PREP.blessedSickle) &&
      prepObjectAt(event, 3181, 7835, 1)) {
      changed = inventory.adds(PREP.diamond, 1);
      variant = "hallowed-preparations-searching-the-workshop-s-eastern-chest";
    } else if (name === "chest" && !hasItem(player, PREP.diamondTablet) && hasItem(player, PREP.diamondSickle) &&
      prepObjectAt(event, 3175, 7836, 1)) {
      changed = inventory.adds(PREP.diamondTablet, 1);
      variant = "hallowed-preparations-searching-the-workshop-s-western-chest";
    } else if (name.includes("range") && prepObjectAt(event, 3160, 7826, 1) && inventory.contains(PREP.rawMeat)) {
      changed = replaceItems(player, [PREP.rawMeat], [PREP.rawMeat], [[PREP.cookedMeat, 1]]);
    } else if (name.includes("range") && prepObjectAt(event, 3160, 7826, 1) && inventory.contains(PREP.uncookedStew)) {
      changed = replaceItems(player, [PREP.uncookedStew], [PREP.uncookedStew], [[PREP.cookedStew, 1]]);
    } else if (name === "anvil" && prepObjectAt(event, 3179, 7842, 1) && inventory.contains(PREP.enhancedSickle) && inventory.contains(PREP.marks) &&
      inventory.contains(PREP.blisterwoodFlail) && inventory.contains(PREP.hammer) &&
      player.getSkillManager().getMaxLevel(Skill.SMITHING) >= 72) {
      event.handled = true;
      api.sendMultiChatboxPrompt(player, "Upgrade your flail?", "Yes.", () => {
        if (stage(player) !== STAGE.PREPARATIONS || player.getSkillManager().getMaxLevel(Skill.SMITHING) < 72) return;
        if (replaceItems(player, [PREP.enhancedSickle, PREP.marks, PREP.blisterwoodFlail, PREP.hammer],
          [PREP.enhancedSickle, PREP.marks, PREP.blisterwoodFlail], [[PREP.flail, 1]])) {
          player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), flail: true });
          quest.setStage(player, STAGE.PREPARATIONS);
          player.sendMessage("You upgrade your flail by swapping out the sickle and shortening the shaft before enhancing it with pure silvthrill.");
        }
      }, "No.", () => {});
      return;
    }
    if (!changed) return;
    event.handled = true;
    if (variant) prepAction(player, variant);
    else player.sendMessage(`You ${option === "search" ? "search" : "use"} the ${name}.`);
  }

  function handlePrepItemOnObject(event) {
    const player = event?.player;
    if (!player || stage(player) !== STAGE.PREPARATIONS) return;
    let result;
    if (event.objectId === ObjectIdentifiers.SINK_40 && prepObjectAt(event, 3156, 7824, 1) && event.itemId === PREP.bowl) result = PREP.bowlWater;
    if (event.objectId === ObjectIdentifiers.RANGE_24 && prepObjectAt(event, 3160, 7826, 1)) {
      if (event.itemId === PREP.rawMeat) result = PREP.cookedMeat;
      if (event.itemId === PREP.uncookedStew) result = PREP.cookedStew;
    }
    if (!result || !replaceItems(player, [event.itemId], [event.itemId], [[result, 1]])) return;
    event.handled = true;
    player.sendMessage(result === PREP.bowlWater ? 'You fill the bowl with water.' : 'You cook the ingredient for Safalaan’s stew.');
  }

  function handlePrepItemOnItem(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) < STAGE.PREPARATIONS || stage(player) >= STAGE.SIEGE) return;
    const pair = new Set([event.usedItemId, event.usedWithItemId]);
    const inventory = player.getInventory();
    let recipe = null;
    if (pair.has(PREP.bowlWater) && pair.has(PREP.potato)) {
      recipe = [[PREP.bowlWater, PREP.potato], [PREP.bowlWater, PREP.potato], [[PREP.incompleteStew, 1]]];
    } else if (pair.has(PREP.incompleteStew) && pair.has(PREP.cookedMeat)) {
      recipe = [[PREP.incompleteStew, PREP.cookedMeat], [PREP.incompleteStew, PREP.cookedMeat], [[PREP.uncookedStew, 1]]];
    } else if (pair.has(PREP.cookedStew) && pair.has(PREP.leaves)) {
      recipe = [[PREP.cookedStew, PREP.leaves], [PREP.cookedStew, PREP.leaves], [[PREP.stew, 1]]];
    } else if (pair.has(PREP.blessedSickle) && pair.has(PREP.diamond)) {
      recipe = [[PREP.blessedSickle, PREP.diamond], [PREP.blessedSickle, PREP.diamond], [[PREP.diamondSickle, 1]]];
    } else if (pair.has(PREP.diamondSickle) && pair.has(PREP.diamondTablet)) {
      recipe = [[PREP.diamondSickle, PREP.diamondTablet], [PREP.diamondSickle, PREP.diamondTablet], [[PREP.enchantedSickle, 1]]];
    } else if (pair.has(PREP.enchantedSickle) && pair.has(PREP.logs)) {
      recipe = [[PREP.enchantedSickle, PREP.logs], [PREP.enchantedSickle, PREP.logs], [[PREP.enhancedSickle, 1]]];
    } else if (pair.has(PREP.logs) && pair.has(PREP.knife)) {
      recipe = [[PREP.logs, PREP.knife], [PREP.logs], [[PREP.stakes, 5]]];
    }
    if (!recipe) return;
    event.handled = true;
    if (pair.has(PREP.blessedSickle) || pair.has(PREP.enchantedSickle)) {
      const diamond = pair.has(PREP.blessedSickle);
      api.sendMultiChatboxPrompt(player, diamond ? "Craft a diamond sickle?" : "Craft an enhanced blisterwood sickle?",
        "Yes.", () => craftPrepRecipe(player, recipe, pair), "No.", () => {});
    } else craftPrepRecipe(player, recipe, pair);
  }

  function takePrepItem(player, id, message) {
    if (stage(player) !== STAGE.PREPARATIONS || hasItem(player, id)) return;
    if (player.getInventory().adds(id, 1)) player.sendMessage(message);
  }

  function craftPrepRecipe(player, recipe, pair) {
    if (stage(player) !== STAGE.PREPARATIONS || !replaceItems(player, ...recipe)) return;
    if (pair.has(PREP.logs) && pair.has(PREP.knife)) {
      player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), stakes: true });
      player.sendMessage("You cut the blisterwood logs into five stakes.");
    } else if (pair.has(PREP.blessedSickle)) {
      player.sendMessage("You embed the diamond into the sickle.");
    } else if (pair.has(PREP.diamondSickle)) {
      player.sendMessage("You enchant the diamond sickle.");
    } else if (pair.has(PREP.enchantedSickle)) {
      player.sendMessage("You enhance the diamond sickle with blisterwood, making an enhanced blisterwood sickle.");
      player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), sickle: true });
    } else if (pair.has(PREP.cookedStew)) {
      prepAction(player, "hallowed-preparations-making-the-amitire-stew");
    } else player.sendMessage("You combine the ingredients.");
    quest.setStage(player, STAGE.PREPARATIONS);
  }

  function feedSafalaan(event) {
    const player = event?.player;
    const targetName = String(event?.target?.getDefinition?.()?.getName?.() ?? event?.target?.getName?.() ?? "").toLowerCase();
    if (!player || !targetName.includes("safalaan") || event.itemId !== PREP.stew || stage(player) < STAGE.PREPARATIONS || stage(player) >= STAGE.SIEGE) return;
    event.handled = true;
    if (!player.getInventory().contains(PREP.stew)) return;
    player.getInventory().deleteNumber(PREP.stew, 1);
    player.getInventory().adds(PREP.marks, 1);
    player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), stewFed: true });
    quest.setStage(player, STAGE.PREPARATIONS);
    prepAction(player, "hallowed-preparations-feeding-safalaan-the-stew", event.npcId);
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
    // shortcut: other chapter native stages need their cache morphs validated before mapping.
    varpValue: nativeStage,
    startedValue: STAGE.STARTED,
    completionValue: STAGE.COMPLETE,
    questPoints: 4,
    rewardItemId: TOME_ID,
    rewardItemLabel: "Tome of Experience (six chapters)",
    otherRewards: ["Access to Vampyrium", "A Hallowed flail", "Sunspear", "The vampyres of Morytania are tolerant of you"],
    buildJournal,
  });
  require("../bmr/Palace.TheBloodMoonRises")({ api, stage, preparationAttribute: PREP_ATTRIBUTE });
  const bridge = require("../bmr/Bridge.TheBloodMoonRises")({ api, stage, attribute: SIEGE_DEFENCE_ATTRIBUTE,
    sync: player => quest.setStage(player, STAGE.SIEGE),
    ready: player => { const prep = player.getAttribute(PREP_ATTRIBUTE) ?? {}; return prep.flail && prep.stakes; },
    play: (player, npc, variant) => startTranscript(api, player, npc, PAGE, variant) });
  api.persistAttribute(ATTRIBUTE);
  api.onCustomEvent("npc-dialogue:hook", onStartHook);
  api.onCustomEvent("npc-dialogue:action", onTranscriptAction);
  api.onCustomEvent("npc-dialogue:choice", onChoice);
  api.onCustomEvent("tob:bmr:completed", onBloodMoonTobCompleted);
  api.onNpcDialogueVariant(selectVariant);
  api.onAnyNpcInteraction({ "Talk-to": talkQuestNpc });
  api.onObjectInteraction(enterVampyriumCastle);
  api.onObjectInteraction(handleSiegeHallObject);
  api.onObjectInteraction(inspectWyrdFence);
  api.onObjectInteraction(handleCastleThronePuzzle);
  api.onObjectInteraction(handleCastleBasinPuzzle);
  api.onObjectInteraction(handleBasinAltar);
  api.onObjectInteraction(handleSolidKeyObjects);
  api.onObjectInteraction(handleCastleClocks);
  api.onObjectInteraction(handleGalleryChest);
  api.onObjectInteraction(handleBloodHuntObjects);
  api.onObjectRoute(routeBloodHuntObjects);
  api.onItemOnObject(handlePrepItemOnObject, { noted: false });
  api.onItemOnObject(handleBasinPotion, { noted: false });
  api.onItemOnObject(handleMountShield, { noted: false });
  api.onItemOnObject(handleClockHandOnClock, { noted: false });
  api.onItemOnObject(handleRefinerVial, { noted: false });
  api.onObjectInteraction(handlePrepObject);
  api.onObjectInteraction(handleRefiner);
  api.onItemOnObject(handleRefinerMixture, { noted: false });
  api.onItemOnObject(handleBloodHuntItemOnObject, { noted: false });
  api.onItemOnItem(handleAncientShieldAssembly);
  api.onItemOnItem(handlePrepItemOnItem);
  api.onItemOnItem(handleBloodHuntItemOnItem);
  api.onItemOnNpc(feedSafalaan);
  api.onItemAction("Dusty book", { Read: readDustyBook });
  for (const id of SIEGE_HALL.injuredAranei) {
    api.onNpcInteraction(id, { Heal: healSiegeAranei });
  }
  api.onPlayerProcess(syncHuntGroundItems);
  api.onPlayerProcess(processSiegeDefence);
  api.onPlayerLogin(handleSiegeLogin);
  api.onPlayerLogout(handleSiegeLogout);
  api.onNpcDeath(handleWyrdDeath);
  api.onNpcHitModify(handleSiegeDrakanHit);
  api.persistAttribute(WYRD_DEFEATED_ATTRIBUTE);
  api.persistAttribute(DRAKAN_ENCOUNTER_COMPLETE);
  api.persistAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE);
  api.persistAttribute(SIEGE_DRAKAN_COMPLETE);
  api.persistAttribute(SIEGE_DEFENCE_ATTRIBUTE);
  api.persistAttribute(TOB_CHALLENGE_ATTRIBUTE);
  api.persistAttribute(PREP_ATTRIBUTE);
  api.persistAttribute(PREP_COMPLETE);
  api.persistAttribute(THRONE_PUZZLE_ATTRIBUTE);
  api.persistAttribute(BASIN_PUZZLE_ATTRIBUTE);
  api.persistAttribute(SOLID_KEY_ATTRIBUTE);
  api.persistAttribute(CLOCK_ATTRIBUTE);
  api.persistAttribute(GALLERY_CHEST_ATTRIBUTE);
  api.persistAttribute(REFINER_ATTRIBUTE);
  api.persistAttribute(HUNT_ATTRIBUTE);
  api.onItemAction("Tome of Experience", { Read: readTome });
};
