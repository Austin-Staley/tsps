/** Desert Treasure II - The Fallen Empire. */
module.exports = function registerDesertTreasureII(api) {
  const { Skill, Item, MagicSpellbook, ItemIdentifiers: I, NpcIdentifiers: N, ObjectIdentifiers: O } = api.core;
  const { registerQuest, startTranscript } = require("../QuestRuntime");
  const PAGE = "Desert Treasure II - The Fallen Empire";
  const { findBestPickaxe } = require("../../skills/Mining.plugin");
  const WAR_ROOM_GOLEM_LOC = 49511; // Cache multiloc bases are the actual map objects.
  const WAR_ROOM_ALTAR_LOC = 49512;
  const DIGSITE_CREVICE_LOC = 49510; // Cache dt2_digsite_crevice multiloc has no generated constant.
  const KORBAL_HERBS_LOC = 49494;
  const ARGIAN_BUSH_LOC = 49493;
  const S = { STARTED: 1, VAULT: 2, DIG: 3, ROCKS: 4, GUARDIAN: 5, MACHINE: 6, VARDORVIS: 7, LEVIATHAN: 8, SUCELLUS: 9, WHISPERER: 10, FINALE: 11, COMPLETE: 12 };
  // Cache quest dbrow 2343, column 19 completes at 118; QuestHelper records the intervening milestones.
  function nativeProgress(stage, player) {
    const attr = key => player?.getAttribute(key);
    if (stage >= S.COMPLETE) return 118;
    if (stage === S.FINALE) {
      if (attr(FINAL_WIGHTS_COMPLETE)) return 112;
      if (attr(FINAL_WIGHTS_STARTED)) return 102 + 2 * (Number(attr(FINAL_WIGHT_INDEX)) || 0);
      return 100;
    }
    if (stage === S.WHISPERER) {
      if (attr(FINAL_FIGURE_DEFEATED)) return 94;
      if (attr(FINAL_FIGURE_STARTED)) return 92;
      if (attr(FINAL_CELL_ACTIVE)) return attr(FINAL_CELL_OPEN) ? 90 : 88;
      if (attr(LASSAR)?.medallion) return 86;
      return 76;
    }
    if (stage === S.SUCELLUS && attr(SUCELLUS_CELL_ENTERED)) return 68;
    if (stage === S.MACHINE) {
      if (attr(BANIKAN_LEFT)) return 40;
      if (Number(attr(SEARCHED_NAMES)) === 15) return 38;
      if (attr(GOLEM_SOLVED)) return 36;
      if (attr(CELLS_INSERTED)) return 32;
      if (attr(GOLEM_INSPECTED)) return 30;
      if (attr(BANIKAN_BRIEFED)) return 28;
      return 24;
    }
    if (stage === S.STARTED) {
      if ((Number(attr("desert-treasure-ii:statues")) & 31) === 31) return 8;
      return attr(ATTR_SMITH_INTRO) ? 6 : 4;
    }
    return ({ 0: 0, 2: 10, 3: 12, 4: 18, 5: 20, 7: 42, 8: 54, 9: 66 })[stage] ?? 0;
  }
  const nativeProgressSent = new WeakMap();
  function syncNativeProgress(player) {
    const value = nativeProgress(stage(player), player);
    // QuestHelper DT2_STRANGLEWOOD milestones drive the cache desk, boat and later scenery.
    const progress = Number(player.getAttribute(VARDORVIS_PROGRESS)) || 0;
    const stranglewood = [0, 4, 6, 6, 8, 10, player.getAttribute(STRANGLEWOOD_CITY_ENTERED) ? 16 : 12, 18, 18, 22, 24, 24, 24, 34, 36, 36, 38, 42, 44, 48, 50, 52, 54][progress] ?? 0;
    const prison = Number(player.getAttribute(SUCELLUS_PRISON_PROGRESS)) || (player.getAttribute(SUCELLUS_ASSASSIN_GONE) ? 22
      : player.getAttribute(SUCELLUS_CELL_ESCAPED) ? 20
        : player.getAttribute(SUCELLUS_CELL_ENTERED) ? [8, 10, 10, 12, 14, 16, 18, 20][Number(player.getAttribute(SUCELLUS_CELL_PROGRESS)) || 0]
          : stage(player) >= S.SUCELLUS ? 2 : 0);
    const state = `${value}:${stranglewood}:${prison}`;
    if (nativeProgressSent.get(player) === state) return;
    nativeProgressSent.set(player, state);
    player.getPacketSender().sendVarbit(15125, stranglewood);
    player.getPacketSender().sendVarbit(15127, prison);
    player.getPacketSender().sendVarbit(14862, value);
  }
  const IDS = [I.VARDORVIS_MEDALLION, I.PERSERIYAS_MEDALLION, I.SUCELLUS_MEDALLION, I.WHISPERERS_MEDALLION];
  const STATUE_ITEMS = [I.VARDORVIS_MEDALLION, I.WHISPERERS_MEDALLION, I.SUCELLUS_MEDALLION, I.PERSERIYAS_MEDALLION];
  const STATUES_PLACED = "desert-treasure-ii:medallions-placed";
  // Cache morphs in the Ancient Vault have no operation text, but the server
  // still dispatches their underlying object ids. The plaque is a separate
  // interaction and must also be read before the names are known.
  const STATUES = new Map([[49499, 0], [49501, 1], [49503, 2], [49505, 3]]);
  const PREREQUISITES = ["desert_treasure_i", "secrets_of_the_north", "enakhras_lament", "temple_of_the_eye", "the_garden_of_death", "below_ice_mountain"];
  const CELLS_INSERTED = "desert-treasure-ii:cells-inserted";
  const PUZZLE_OPEN = "desert-treasure-ii:puzzle-open";
  const CELL_POSITIONS = "desert-treasure-ii:cell-positions";
  const GOLEM_SOLVED = "desert-treasure-ii:golem-solved";
  const GOLEM_INSPECTED = "desert-treasure-ii:golem-inspected";
  const ALTAR_INSPECTED = "desert-treasure-ii:altar-inspected";
  const TOTEMS_CHARGED = "desert-treasure-ii:totems-charged";
  const TOTEM_MASK = "desert-treasure-ii:totem-mask";
  const BANIKAN_BRIEFED = "desert-treasure-ii:banikan-briefed";
  const SEARCHED_NAMES = "desert-treasure-ii:searched-names";
  const BANIKAN_LEFT = "desert-treasure-ii:banikan-left";
  const VARDORVIS_PROGRESS = "desert-treasure-ii:vardorvis-progress";
  const STRANGLEWOOD_CITY_ENTERED = "desert-treasure-ii:city-entered";
  const SUCELLUS_AREA = "desert-treasure-ii:sucellus-area";
  const SUCELLUS_MUSHROOMS = "desert-treasure-ii:sucellus-mushrooms";
  const SUCELLUS_VATS = "desert-treasure-ii:sucellus-vats";
  const SUCELLUS_POISONS = "desert-treasure-ii:sucellus-poisons";
  const SUCELLUS_DEFEATED = "desert-treasure-ii:sucellus-defeated";
  const SUCELLUS_WEST_ROOM = "desert-treasure-ii:sucellus-west-room";
  const SUCELLUS_CAPTAIN_ACCEPTED = "desert-treasure-ii:sucellus-captain-accepted";
  const SUCELLUS_PRISON_GEAR = "desert-treasure-ii:sucellus-prison-gear";
  const SUCELLUS_PRISON_PROGRESS = "desert-treasure-ii:sucellus-prison-progress";
  const SUCELLUS_PRISON_CHECKPOINT = "desert-treasure-ii:sucellus-prison-checkpoint";
  const SUCELLUS_PRISON_COMPLETE = "desert-treasure-ii:sucellus-prison-complete";
  const SUCELLUS_CELL_PROGRESS = "desert-treasure-ii:sucellus-cell-progress";
  const SUCELLUS_CELL_ENTERED = "desert-treasure-ii:sucellus-cell-entered";
  const SUCELLUS_CELL_ESCAPED = "desert-treasure-ii:sucellus-cell-escaped";
  const SUCELLUS_ASSASSIN_GONE = "desert-treasure-ii:sucellus-assassin-gone";
  const SUCELLUS_BOSS_GATE = 49138;
  const SUCELLUS_BOSS_GATE_OPEN = O.GATE_281;
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
  const SERUM_DISCUSSED = "desert-treasure-ii:kasonde-serum-discussed";
  const ATTR_VARDORVIS_AREA = "desert-treasure-ii:vardorvis-area";
  const ATTR_SCAR_AREA = "desert-treasure-ii:scar-area";
  const ATTR_SCAR_MAZE_ONE = "desert-treasure-ii:scar-maze-one";
  const ATTR_SCAR_MAZE_TWO = "desert-treasure-ii:scar-maze-two";
  const ATTR_SCAR_MAZE_THREE = "desert-treasure-ii:scar-maze-three";
  const ATTR_LEVIATHAN_AREA = "desert-treasure-ii:leviathan-area";
  const ATTR_VAULT_AREA = "desert-treasure-ii:ancient-vault";
  const ATTR_VAULT_SMITH = "desert-treasure-ii:vault-smith";
  const ATTR_SMITH_INTRO = "desert-treasure-ii:smith-intro";
  const ATTR_FIRST_MEDALLION_MEETING = "desert-treasure-ii:first-medallion-meeting";
  const FINAL_CELL_ACTIVE = "desert-treasure-ii:final-cell-active";
  const FINAL_CELL_SOLUTION = "desert-treasure-ii:final-cell-solution";
  const FINAL_CELL_GUESS = "desert-treasure-ii:final-cell-guess";
  const FINAL_CELL_ATTEMPTS = "desert-treasure-ii:final-cell-attempts";
  const FINAL_CELL_GEAR = "desert-treasure-ii:final-cell-gear";
  const FINAL_CELL_OPEN = "desert-treasure-ii:final-cell-open";
  const FINAL_CELL_CHEST = "desert-treasure-ii:final-cell-chest";
  const FINAL_FIGURE_STARTED = "desert-treasure-ii:final-figure-started";
  const FINAL_FIGURE_DEFEATED = "desert-treasure-ii:final-figure-defeated";
  const FINAL_ROOM = "desert-treasure-ii:final-room";
  const FINAL_WIGHT_INDEX = "desert-treasure-ii:final-wight-index";
  const FINAL_WIGHTS_STARTED = "desert-treasure-ii:final-wights-started";
  const FINAL_WIGHTS_COMPLETE = "desert-treasure-ii:final-wights-complete";
  const LASSAR = "desert-treasure-ii:lassar";
  const LASSAR_TELEPORTERS = [
    [2593, 6424, 49479], [2617, 6417, 49480], [2611, 6379, 49482], [2599, 6341, 49483],
    [2643, 6434, 49484], [2652, 6405, 49481], [2691, 6415, 49485],
  ];
  const LASSAR_ACTIONS = { ramarno: "xu7yT_", rope: "em2ULK", ropeAgain: "ws5gAK" };
  const LASSAR_TELEPORTER_VARBITS = [15088, 15089, 15091, 15092, 15093, 15090, 15094];
  const LASSAR_SCHEMATIC_VARBITS = [
    ["blockerDesigned", 15082], ["idolSchematic", 15083], ["animaSchematic", 15084],
    ["torchSchematic", 15085], ["superiorTorchSchematic", 15086], ["perfectTorchSchematic", 15087],
  ];
  // These three cache locs have no stable cache names, so use the IDs verified
  // by dump:loc: desk 49490, inbound boat 49491, outbound Travel loc 48720.
  const KASONDE_DESK_LOC = 49490;
  const STRANGLEWOOD_BOAT_IN_LOC = 49491;
  const STRANGLEWOOD_BOAT_OUT_LOC = O.ROWBOAT_17;
  const KASONDE_NOTE = I.POTION_NOTE;
  const KASONDE_POTION = I.STRANGE_POTION_3;
  const VARDORVIS_ENTRY = 49495;
  const KASONDE_MEDALLION_CHEST = 49496;
  const STRANGLEWOOD_BARRICADE_LOC = 49492;
  const VARDORVIS_QTE_GROUP = 833;
  const VARDORVIS_QTE_INIT_SCRIPT = 1816;
  const VARDORVIS_MELEE_ANIMATION = 10340;
  const VARDORVIS_STRANGLE_ANIMATION = 10342;
  const VARDORVIS_SPIKE_WARNING = 2510;
  const VARDORVIS_HEAD_ANIMATION = 10348;
  const VARDORVIS_HEAD_PROJECTILE = 2521;
  const VARDORVIS_AXE_NPC = 12227; // Cache gameval vardorvis_axe has no generated identifier.
  const vardorvisBleeds = new WeakMap();
  function startVardorvisBleed(player) {
    const previous = vardorvisBleeds.get(player);
    if (previous) api.core.TaskManager.cancelTasks(previous);
    const key = {};
    vardorvisBleeds.set(player, key);
    let left = 5, last = player.getLocation().clone();
    // The bleed continues after leaving the ritual site.
    api.core.TaskManager.submit(new (class extends api.core.Task {
      constructor() { super(2, key); }
      execute() {
        if (!player.isRegistered() || player.getHitpoints() <= 0) { vardorvisBleeds.delete(player); this.stop(); return; }
        player.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(3, api.core.HitMask.RED)]);
        if (player.getLocation().equals(last)) left--;
        last = player.getLocation().clone();
        if (left <= 0) { vardorvisBleeds.delete(player); this.stop(); }
      }
    })());
  }

  const KASONDE_THROW_ANIMATION = 385;
  const KASONDE_EXPLOSION_ANIMATION = 10384;
  const KASONDE_POISON_PROJECTILE = 2296;
  const KASONDE_EXPLOSIVE_PROJECTILE = 2526;
  const KASONDE_ACID_POOL = 48747;
  const KASONDE_EXPLOSIVE_POOL = 48749;
  class KasondeCombat extends api.core.RangedCombatMethod {
    attackSpeed() { return 3; }
    attackDistance() { return 8; }
    start(npc, target) {
      const melee = npc.getLocation().getDistance(target.getLocation()) <= 1;
      npc.performAnimation(new api.core.Animation(melee ? 422 : KASONDE_THROW_ANIMATION));
      if (!melee) api.core.Projectile.createProjectile(npc, target, KASONDE_POISON_PROJECTILE, 40, 57, 43, 31).sendProjectile();
    }
    hits(npc, target) {
      return npc.getLocation().getDistance(target.getLocation()) <= 1
        ? [new api.core.PendingHit(npc, target, new api.core.MeleeCombatMethod(), 1)] : super.hits(npc, target);
    }
  }
  function kasondePoolDamage(p, orange, direct) {
    const damage = orange ? 10 + Math.floor(Math.random() * 11) : direct ? 35 + Math.floor(Math.random() * 6) : 6;
    p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(damage, api.core.HitMask.RED)]);
    if (orange) for (const prayer of [16, 17, 18]) api.core.PrayerHandler.deactivatePrayer(p, prayer);
    else api.core.CombatFactory.poisonEntity(p, 6, 2);
  }
  function processKasonde(area, p) {
    const boss = spawned.get(p)?.kasondeBoss;
    if (Number(p.getAttribute(VARDORVIS_PROGRESS)) !== 19 || !boss?.isRegistered?.() || boss.getHitpoints() <= 0) return;
    const tick = api.core.World.getProcessCycle();
    if (area.lastKasondeCycle === tick) return;
    area.lastKasondeCycle = tick;
    if (!area.kasondeFight) area.kasondeFight = { nextSpecial: tick + 18, nextHeal: tick + 15, special: 0, throws: [], pools: [], nextPoolHit: tick };
    const fight = area.kasondeFight;
    // shortcut: special intervals and heal amounts are inferred, calibrate against a live OSRS fight capture.
    if (tick >= fight.nextHeal) {
      boss.setHitpoints(Math.min(boss.getMaxHitpoints(), boss.getHitpoints() + (boss.getHitpoints() <= 80 ? 16 : 8)));
      fight.nextHeal = tick + 15;
      p.sendMessage("Kasonde drinks a potion and recovers some health.");
    }
    for (const thrown of [...fight.throws]) {
      if (tick < thrown.lands) continue;
      fight.throws.splice(fight.throws.indexOf(thrown), 1);
      if (p.getLocation().equals(thrown.tile)) kasondePoolDamage(p, thrown.orange, true);
      const previous = fight.pools.find(pool => pool.tile.equals(thrown.tile));
      if (previous) { p.getPacketSender().sendObjectRemoval(previous.object); api.core.ObjectManager.deregister(previous.object, false); fight.pools.splice(fight.pools.indexOf(previous), 1); }
      const object = new api.core.GameObject(thrown.orange ? KASONDE_EXPLOSIVE_POOL : KASONDE_ACID_POOL, thrown.tile, 10, 0, area);
      p.getPacketSender().sendObject(object);
      fight.pools.push({ ...thrown, object });
    }
    if (tick >= fight.nextPoolHit) {
      const pool = fight.pools.find(pool => pool.tile.equals(p.getLocation()));
      if (pool) kasondePoolDamage(p, pool.orange, false);
      fight.nextPoolHit = tick + 5;
    }
    if (fight.explosion && tick >= fight.explosion) {
      const rangedLine = { type: () => api.core.CombatType.RANGED, attackDistance: () => 64 };
      if (p.getLocation().equals(boss.getLocation()) || api.core.CombatRange.canReach(boss, rangedLine, p)) {
        p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(35 + Math.floor(Math.random() * 6), api.core.HitMask.RED)]);
        p.sendMessage("Kasonde's explosion hits you. Hide behind a pillar to break his line of sight!");
      } else p.sendMessage("The pillar shields you from Kasonde's explosion.");
      fight.explosion = null;
      boss.setScriptedMovement(false);
      boss.getCombat().attack(p);
    }
    if (tick < fight.nextSpecial) return;
    const special = fight.special++ % 4;
    fight.nextSpecial = tick + 18;
    if (special === 3) {
      boss.performAnimation(new api.core.Animation(KASONDE_EXPLOSION_ANIMATION));
      boss.setScriptedMovement(true);
      fight.explosion = tick + 5;
      p.sendMessage("Kasonde charges an explosion. Hide behind a pillar!");
      return;
    }
    boss.performAnimation(new api.core.Animation(KASONDE_THROW_ANIMATION));
    if (special === 2) {
      const localY = p.getLocation().getY() - area.getBaseY();
      boss.moveTo(area.tile(7, localY < 16 ? 24 : 4, 0));
      p.sendMessage("Kasonde dashes away and throws a barrage of green and orange potions. Keep moving!");
    } else p.sendMessage("Kasonde throws a potion at your feet. Move away before it lands!");
    const targets = special === 2 ? [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[1,-1]] : [[0,0]];
    targets.forEach(([dx,dy], index) => {
      const tile = p.getLocation().clone().addX(dx).addY(dy);
      const orange = special === 2 ? index % 2 === 1 : special === 1;
      new api.core.Projectile(boss.getLocation(), tile, null, orange ? KASONDE_EXPLOSIVE_PROJECTILE : KASONDE_POISON_PROJECTILE, 40, 80, 43, 31, area).sendProjectile();
      fight.throws.push({ tile, orange, lands: tick + 3 });
    });
  }

  class VardorvisCombat extends api.core.MeleeCombatMethod {
    start(npc) { npc.performAnimation(new api.core.Animation(VARDORVIS_MELEE_ANIMATION)); }
    attackSpeed() { return 5; }
    hits(npc, target) {
      const hits = super.hits(npc, target);
      const ratio = Math.max(0, npc.getHitpoints() / npc.getMaxHitpoints());
      const maximum = 30 + Math.round(7 * (1 - ratio));
      const protection = target.getPacketSender().getVarbit(4118) === 1 ? 0.25 : 1;
      for (const hit of hits) {
        for (const damage of hit.getHits()) damage.setDamage(hit.isAccurate()
          ? Math.min(target.getHitpoints(), Math.floor(Math.random() * (maximum + 1) * protection)) : 0);
        hit.updateTotalDamage();
      }
      return hits;
    }
  }
  function vardorvisHitRoll(event) {
    if (event.attacker?.__dt2Vardorvis) event.bypassProtectionPrayer = true;
  }
  function vardorvisHitResolved({ attacker, target, hit }) {
    if (!attacker?.__dt2Vardorvis || !target?.isPlayer?.()) return;
    attacker.setHitpoints(Math.min(attacker.getMaxHitpoints(), attacker.getHitpoints() + Math.floor(hit.getTotalDamage() / 2)));
  }
  function vardorvisPrayerDisabled(event) {
    const area = event.player?.getAttribute(ATTR_VARDORVIS_AREA);
    if (area && event.player.getPrivateArea?.() === area && api.core.World.getProcessCycle() < (area.prayerLockUntil ?? 0)
      && [4116, 4117, 4118].includes(event.prayer?.configId)) {
      event.disabled = true;
      event.message = "Vardorvis' head has briefly disabled your protection prayers.";
    }
  }
  function endVardorvisStrangle(area, player) {
    if (!area.spores) return;
    area.spores = null;
    player.getMovementQueue().setBlockMovement(false);
    player.getAttribute(ATTR)?.setScriptedMovement?.(false);
    player.getPacketSender().closeInterface(VARDORVIS_QTE_GROUP);
  }
  function processVardorvis(area, player) {
    const cycle = api.core.World.getProcessCycle();
    if (area.lastProcessCycle === cycle) return;
    area.lastProcessCycle = cycle;
    const boss = player.getAttribute(ATTR);
    if (!boss?.__dt2Vardorvis || boss.getHitpoints() <= 0) { endVardorvisStrangle(area, player); return; }
    if (player.getCombat().getTarget() !== boss && boss.getHitpoints() === boss.getMaxHitpoints()) return;
    const ratio = boss.getHitpoints() / boss.getMaxHitpoints();
    boss.setDefenceLevel(130 + Math.floor(50 * ratio));
    const loc = player.getLocation(), sender = player.getPacketSender();
    const hit = damage => player.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(damage, api.core.HitMask.RED)]);
    for (const axe of area.axes ?? []) {
      if (cycle < axe.starts) continue;
      const step = cycle - axe.starts;
      if (step > 17) { api.removeNpc(axe.npc); continue; }
      const tile = area.tile(axe.x + axe.dx * step, axe.y + axe.dy * step, 0);
      axe.npc.moveTo(tile);
      if (!axe.hit && loc.getDistance(tile) <= 1) {
        axe.hit = true;
        const damage = 1 + Math.floor(Math.random() * 35);
        hit(sender.getVarbit(4118) === 1 ? Math.floor(damage / 2) : damage);
        startVardorvisBleed(player);
        player.sendMessage("The swinging axe cuts you. Moving will prolong the bleeding.");
      }
    }
    area.axes = (area.axes ?? []).filter(axe => cycle - axe.starts <= 17);
    if (area.spike && cycle >= area.spike.due) {
      if (loc.equals(area.spike.location)) {
        const damage = Math.floor(Math.random() * 26);
        hit(damage);
        boss.setHitpoints(Math.min(boss.getMaxHitpoints(), boss.getHitpoints() + Math.floor(damage / 2)));
      }
      area.spike = null;
    }
    if (area.head && cycle >= area.head.due) {
      if (sender.getVarbit(4117) !== 1) {
        for (const prayer of [api.core.PrayerHandler.PROTECT_FROM_MAGIC, api.core.PrayerHandler.PROTECT_FROM_MISSILES, api.core.PrayerHandler.PROTECT_FROM_MELEE])
          api.core.PrayerHandler.deactivatePrayer(player, prayer);
        player.getSkillManager().setCurrentLevel(Skill.PRAYER, Math.max(0, player.getSkillManager().getCurrentLevel(Skill.PRAYER) - 10));
        area.prayerLockUntil = cycle + 3;
        player.sendMessage("Vardorvis' head disables your protection prayers and drains 10 Prayer points.");
      } else player.sendMessage("You block Vardorvis' head gaze.");
      api.removeNpc(area.head.npc);
      area.head = null;
    }
    if (area.spores && cycle >= area.strangleDue) {
      hit(50);
      player.sendMessage("The tendrils tighten around you. Destroy every spore before time runs out!");
      endVardorvisStrangle(area, player);
    }
    // shortcut: special selection, axe timing and quest axe/strangle damage need calibration against a live OSRS capture.
    if (cycle < (area.nextSpecial ?? 0) || area.spores) return;
    area.nextSpecial = cycle + (ratio < 0.33 ? 10 : 18);
    const options = ratio < 0.8 ? ["axes", "spike", "head", "strangle"] : ["axes", "spike"];
    let special = options[Math.floor(Math.random() * options.length)];
    if (special === "strangle" && area.lastSpecial === "strangle") special = "axes";
    area.lastSpecial = special;
    if (special === "spike") {
      area.spike = { location: loc.clone(), due: cycle + 3 };
      sender.sendGraphic(new api.core.Graphic(VARDORVIS_SPIKE_WARNING), loc);
      player.sendMessage("Cracks appear beneath your feet. Move before the spikes erupt!");
    } else if (special === "head") {
      const npc = api.core.NPC.create(N.VARDORVIS_HEAD, area.tile(24, 25, 0));
      npc.setOwner(player); npc.setOwnerOnly(true); npc.setScriptedMovement(true);
      npc.__skipDefaultRespawn = true;
      area.add(npc); api.core.World.getAddNPCQueue().push(npc);
      npc.performAnimation(new api.core.Animation(VARDORVIS_HEAD_ANIMATION));
      api.core.Projectile.createProjectile(npc, player, VARDORVIS_HEAD_PROJECTILE, 30, 60, 40, 36).sendProjectile();
      area.head = { npc, due: cycle + 3 };
      player.sendMessage("Vardorvis' head gazes upon you. Protect from Missiles against the green projectile!");
    } else if (special === "strangle") {
      area.spores = new Set([6, 7, 8, 9, 10, 11]);
      area.strangleDue = cycle + 9;
      boss.performAnimation(new api.core.Animation(VARDORVIS_STRANGLE_ANIMATION));
      boss.setScriptedMovement(true);
      player.getMovementQueue().reset();
      player.getMovementQueue().setBlockMovement(true);
      sender.sendSubInterface((161 << 16) | 15, VARDORVIS_QTE_GROUP, 1);
      sender.sendInterfaceScript(VARDORVIS_QTE_INIT_SCRIPT, [6]);
      player.sendMessage("Vardorvis entangles you. Destroy the six spores before the tendrils tighten!");
    } else {
      const paths = [[8, 8, 1, 1], [25, 8, -1, 1], [8, 25, 1, -1]];
      area.axes ??= [];
      for (const [x, y, dx, dy] of paths.slice(0, ratio < 0.5 ? 3 : ratio < 0.8 ? 2 : 1)) {
        const npc = api.core.NPC.create(VARDORVIS_AXE_NPC, area.tile(x, y, 0));
        npc.setOwner(player); npc.setOwnerOnly(true); npc.setScriptedMovement(true);
        npc.__skipDefaultRespawn = true;
        area.add(npc); api.core.World.getAddNPCQueue().push(npc);
        area.axes.push({ npc, x, y, dx, dy, starts: cycle + 3, hit: false });
      }
      player.sendMessage("Axes rise at the edges of the arena. Avoid their diagonal paths!");
    }
  }
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
  const SCAR_MEMORY_UNDERWATER = "desert-treasure-ii:scar-memory-underwater";
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
  const SCAR_SHIP_REACHED = "desert-treasure-ii:scar-ship-reached";
  const SCAR_PERSTEN_LEFT_SHIP = "desert-treasure-ii:persten-left-ship";
  const SCAR_LEVIATHAN_DEBRIS_SEARCHED = "desert-treasure-ii:leviathan-debris-searched";
  const SCAR_AXON_TERMINALS = "desert-treasure-ii:scar-axon-terminals";
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
  const SCAR_CATALYST_RUNES = [I.SMOKE_NERVE, I.BLOOD_NERVE, I.SOUL_NERVE, I.NATURE_NERVE, I.COSMIC_NERVE, I.ASTRAL_NERVE, I.WRATH_NERVE];
  const SCAR_CATALYST_RUNE_NAMES = ["smoke", "blood", "soul", "nature", "cosmic", "astral", "wrath"];
  const SCAR_CATALYST_BASE_PARTS = new Map([
    [I.SMOKE_NERVE, [I.FIRE_NERVE, I.AIR_NERVE]],
    [I.BLOOD_NERVE, [I.MIND_NERVE, I.WATER_NERVE]],
    [I.SOUL_NERVE, [I.MIND_NERVE, I.MIND_NERVE]],
    [I.NATURE_NERVE, [I.WATER_NERVE, I.EARTH_NERVE]],
    [I.COSMIC_NERVE, [I.MIND_NERVE, I.MIND_NERVE, I.WATER_NERVE, I.EARTH_NERVE]],
    [I.ASTRAL_NERVE, [I.MIND_NERVE, I.MIND_NERVE, I.WATER_NERVE, I.EARTH_NERVE, I.EARTH_NERVE]],
    [I.WRATH_NERVE, [I.FIRE_NERVE, I.AIR_NERVE, I.MIND_NERVE, I.WATER_NERVE]],
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
    { kind: "blood", mask: 4, inactive: 12343, active: 12344, x: 2775, y: 6445, spells: ["BLOOD_BURST", "BLOOD_BLITZ", "BLOOD_BARRAGE"] },
    { kind: "shadow", mask: 2, inactive: 12341, active: 12342, x: 2771, y: 6445, spells: ["SHADOW_BURST", "SHADOW_BLITZ", "SHADOW_BARRAGE"] },
    { kind: "smoke", mask: 1, inactive: 12339, active: 12340, x: 2771, y: 6439, spells: ["SMOKE_BURST", "SMOKE_BLITZ", "SMOKE_BARRAGE"] },
    { kind: "ice", mask: 8, inactive: 12345, active: 12346, x: 2775, y: 6439, spells: ["ICE_BURST", "ICE_BLITZ", "ICE_BARRAGE"] },
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
  let FinalVaultArea;
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
  const LEVIATHAN_SHADOW_SPELL_IDS = new Set(["SHADOW_RUSH", "SHADOW_BURST", "SHADOW_BLITZ", "SHADOW_BARRAGE"]
    .map(name => api.core.CombatSpells[name].spellId()));

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

  FinalVaultArea = class DesertTreasureIIFinalVaultArea extends api.core.TemplatedInstanceArea {
    constructor(owner) {
      // The lower chamber is the cache's instanced vault room at
      // 3264..3319, 6400..6463 (Quest Helper's final-room bounds include the
      // adjacent entry row at y=6397). Copy the real map palette and collision.
      super(7, 8);
      this.owner = owner;
      this.actors = [];
      for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 8; y++) {
          this.setChunk(0, x, y, { sourceChunkX: 408 + x, sourceChunkY: 800 + y, sourcePlane: 0, rotation: 0 });
        }
      }
    }
    getName() { return "Elder Vault (Desert Treasure II)"; }
    allowSummonPet() { return false; }
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
    canAttack(attacker, target) {
      if (attacker?.__dt2Guardian) return false;
      if (target?.__dt2Guardian) return attacker?.isPlayer?.() && attacker.getUsername() === this.owner;
      return null;
    }
    canCastOnNpc(player, npc, spell) {
      if (!npc?.__dt2Totem) return null;
      if (player.getUsername() !== this.owner || npc.getOwner?.() !== player || !this.entities.includes(npc)
        || stage(player) < S.MACHINE || stage(player) >= S.VARDORVIS
        || !player.getAttribute(GOLEM_INSPECTED) || !player.getAttribute(ALTAR_INSPECTED)) return false;
      if (!totemSpellIds.get(npc.__dt2Totem)?.has(spell?.spellId?.())) {
        player.sendMessage(`That totem requires a ${npc.__dt2Totem} burst spell or higher.`);
        return false;
      }
      return true;
    }
    process(actor) {
      if (actor?.isPlayer?.() && actor.getUsername() === this.owner) processGuardian(this, actor.getAsPlayer());
    }
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
      this.remainingTicks = 300;
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
      if (!kasonde?.isRegistered?.()) return;
      if (kasonde.getHitpoints?.() <= 0) {
        this.remainingTicks = 0;
        this.failed = true;
        return;
      }
      this.remainingTicks--;
      if (this.remainingTicks <= 0) {
        this.defended = true;
        for (const enemy of this.enemies) if (enemy.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(enemy)) api.core.World.getRemoveNPCQueue().push(enemy);
        this.questPlayer.sendMessage("Kasonde has survived the horde for three minutes. Speak to him, then climb out of the hideout.");
        return;
      }
      const elapsed = 300 - this.remainingTicks;
      if (elapsed >= this.nextSpawnTick && this.enemies.filter((npc) => npc?.isRegistered?.() && npc.getHitpoints?.() > 0).length < 4) {
        this.spawnEnemy(elapsed);
        this.nextSpawnTick += 16;
      }
    }
    spawnEnemy(elapsed) {
      // shortcut: entrances use walkable cache corridors, calibrate the wave positions from a live capture.
      const tiles = [[13, 8], [20, 8], [39, 9], [37, 24], [13, 24], [24, 27]];
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
    process(actor) {
      if (actor?.isPlayer?.() && actor.getUsername() === this.owner) processKasonde(this, actor.getAsPlayer());
    }
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
    process(actor) {
      if (actor?.isPlayer?.() && actor.getUsername() === this.owner) processVardorvis(this, actor.getAsPlayer());
    }
    postLeave(actor, logout) {
      if (actor?.isPlayer?.()) endVardorvisStrangle(this, actor.getAsPlayer());
      super.postLeave(actor, logout);
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
      // route walks between; completed puzzles are restored on re-entry.
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
      const location = this.questPlayer.getLocation();
      const x = location.getX() - this.getBaseX() + 1696;
      const y = location.getY() - this.getBaseY() + 6400;
      const atBubble = SCAR_NERVE_AIR_BUBBLES.some(([bubbleX, bubbleY]) =>
        x >= bubbleX && x < bubbleX + 2 && y >= bubbleY && y < bubbleY + 2);
      const air = atBubble ? 100 : Math.max(0, (Number(this.questPlayer.getAttribute(SCAR_NERVE_ROOM_TWO_AIR)) || 0) - 1);
      this.questPlayer.setAttribute(SCAR_NERVE_ROOM_TWO_AIR, air);
      this.questPlayer.getPacketSender().sendVarbit(15211, air);
      if (air > 0) return;
      this.questPlayer.setAttribute(SCAR_NERVE_ROOM_TWO_AIR, 100);
      this.questPlayer.getPacketSender().sendVarbit(15211, 100);
      this.questPlayer.setAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE, false);
      this.questPlayer.moveTo(this.tile(86, 19, 0));
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
      if (attacker?.__dt2ScarTreeEnemy) return !!target?.__dt2ScarAntibody && target.getOwner?.() === this.questPlayer;
      if (attacker?.isPlayer?.() && attacker === this.questPlayer && target?.__dt2ScarTreeEnemy) return true;
      if (target?.__dt2ScarAntibody || target?.__dt2ScarTreeEnemy || target?.__dt2ScarBrainPillar) return false;
      return null;
    }
    process(actor) {
      if (!actor?.isPlayer?.() || actor.getAsPlayer?.() !== this.questPlayer
        || !this.questPlayer.getAttribute(SCAR_MAZE_THREE_ACTIVE)) return;
      const cycle = api.core.World.getProcessCycle();
      if (cycle === this.lastProcessCycle) return;
      this.lastProcessCycle = cycle;
      const playback = this.scarMemoryPlayback;
      if (playback && cycle >= playback.next) {
        if (playback.lit !== null) {
          showScarMemoryGrowth(this.questPlayer, this, playback.lit, false);
          playback.lit = null;
          playback.next = cycle + 1;
          if (playback.index === playback.order.length) this.scarMemoryPlayback = null;
        } else {
          const growth = playback.order[playback.index++];
          showScarMemoryGrowth(this.questPlayer, this, growth, true);
          playback.lit = growth;
          // shortcut: two-tick flashes need timing calibration from an OSRS capture.
          playback.next = cycle + 2;
          this.questPlayer.sendMessage(`The ${["south-western", "north-western", "north-eastern", "south-eastern"][growth]} growth glows.`);
        }
      }
      if (!this.questPlayer.getAttribute(SCAR_MEMORY_UNDERWATER)) return;
      const location = this.questPlayer.getLocation();
      const x = location.getX() - this.getBaseX() + 1856;
      const y = location.getY() - this.getBaseY() + 6400;
      const atBubble = SCAR_MAZE_THREE_AIR_BUBBLES.some(([bubbleX, bubbleY]) =>
        x >= bubbleX && x < bubbleX + 2 && y >= bubbleY && y < bubbleY + 2);
      const air = atBubble ? 100 : Math.max(0, (Number(this.questPlayer.getAttribute(SCAR_MAZE_THREE_AIR)) || 0) - 1);
      this.questPlayer.setAttribute(SCAR_MAZE_THREE_AIR, air);
      this.questPlayer.getPacketSender().sendVarbit(15211, air);
      if (air > 0) return;
      this.questPlayer.setAttribute(SCAR_MAZE_THREE_AIR, 100);
      this.questPlayer.getPacketSender().sendVarbit(15211, 100);
      this.questPlayer.setAttribute(SCAR_MEMORY_UNDERWATER, false);
      stopScarMemoryPlayback(this.questPlayer, this);
      this.questPlayer.moveTo(this.tile(40, 36, 0));
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
      super(7, 8);
      this.owner = owner;
      this.questPlayer = questPlayer;
      this.lastProcessCycle = -1;
      for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 8; y++) {
          for (let plane = 0; plane < 4; plane++) {
            // Copy the bridge plane too: it lowers the arena floor meshes out of collision.
            this.setChunk(plane, x, y, plane <= 1 ? {
              sourceChunkX: 257 + x, sourceChunkY: 792 + y, sourcePlane: plane, rotation: 0,
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
        const nearPathfinder = nearLeviathanPathfinder(player, boss);
        if (player.getPacketSender().getVarbit(varbit) !== 1
          || (boss.__dt2LeviathanEnraged && !nearPathfinder)) {
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
        const pathfinder = api.core.NPC.create(N.CEREBRAL_PATHFINDER, this.tile(34, 38, 0));
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
      const cycle = api.core.World.getProcessCycle();
      if (cycle === this.lastProcessCycle) return;
      this.lastProcessCycle = cycle;
      const player = this.questPlayer;
      saveSucellusPrisonCheckpoint(player, this);
      if (!player.getAttribute(SUCELLUS_CELL_ENTERED)) {
        const loc = player.getLocation();
        const x = loc.getX() - this.getBaseX() + 2872;
        const y = loc.getY() - this.getBaseY() + 6336;
        const z = loc.getZ?.() ?? loc.z ?? 0;
        if (z === 2 && Math.abs(x - 2912) <= 1 && Math.abs(y - 6348) <= 2) {
          storeSucellusPrisonGear(player);
          player.setAttribute(SUCELLUS_CELL_ENTERED, true);
          player.setAttribute(SUCELLUS_CELL_PROGRESS, 0);
          player.moveTo(this.tile(168, 33, 0));
          player.sendMessage("A guard knocks you unconscious. You wake in a locked prison cell.");
        }
      }
      api.emitCustomEvent("dt2:sucellus-prison-process", { player, area: this, cycle });
      const boss = this.questPlayer.getAttribute(ATTR);
      if (boss?.__dt2Sucellus && boss.getHitpoints?.() > 0 && boss.__dt2SucellusAwake) {
        // Keep the ordinary combat hit queue and regeneration rules; only the
        // scripted wake-up phase is owned by the quest.
        boss.getCombat?.().getLastAttack?.().reset?.();
        if (!Number.isFinite(boss.__dt2SucellusNextAttack)) boss.__dt2SucellusNextAttack = cycle + 6;
        if (!Number.isFinite(boss.__dt2SucellusAttackCount)) boss.__dt2SucellusAttackCount = 0;
        if (cycle >= boss.__dt2SucellusNextAttack) {
          boss.__dt2SucellusNextAttack = cycle + 6;
          boss.__dt2SucellusAttackCount++;
          if (boss.__dt2SucellusAttackCount % 5 === 0) {
            boss.__dt2SucellusGaze = { due: cycle + 5 };
            boss.forceChat?.("Duke Sucellus turns his gaze upon you...");
            player.sendMessage("Duke Sucellus turns his gaze upon you. Hide directly behind a pillar before the gaze lands!");
          }
        }
        if (boss.__dt2SucellusGaze && cycle >= boss.__dt2SucellusGaze.due) {
          const source = boss.getLocation?.();
          const destination = player.getLocation?.();
          const clearShot = source && destination && api.core.RegionManager?.canProjectileAttackBounds?.(
            source, destination, boss.getSize?.() ?? 1, boss.getSize?.() ?? 1,
            player.getSize?.() ?? 1, player.getSize?.() ?? 1, this,
          );
          if (clearShot) {
            player.getCombat().getHitQueue().addPendingDamage([
              new api.core.HitDamage(1 + Math.floor(Math.random() * 99), api.core.HitMask.RED),
            ]);
            player.sendMessage("Duke Sucellus' freezing gaze strikes you!");
          } else player.sendMessage("You manage to avoid Duke Sucellus' gaze behind the pillar.");
          boss.__dt2SucellusGaze = null;
        }
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
    if (stage(p) === S.GUARDIAN && !owned.guardian) {
      const guardian = api.core.NPC.create(N.ANCIENT_GUARDIAN_3, area.tile(23, 7, 0));
      guardian.setOwner?.(p);
      guardian.setOwnerOnly?.(true);
      guardian.__skipDefaultRespawn = true;
      guardian.setScriptedMovement?.(true);
      guardian.setMaxHitpoints?.(200);
      guardian.setHitpoints?.(200);
      const cycle = api.core.World.getProcessCycle?.() ?? 0;
      guardian.__dt2Guardian = { shielded: true, bodyHp: 100, lastAttack: cycle, nextAttack: cycle + 5, attacks: 0, rocks: [] };
      area.add(guardian);
      api.core.World.getAddNPCQueue().push(guardian);
      owned.guardian = guardian;
      p.setAttribute(ATTR, guardian);
    }
    if (stage(p) === S.MACHINE) {
      spawnTotems(p, area);
      spawnWarRoomBanikan(p, area);
    }
    return area;
  }

  function modifyGuardianHit({ npc, hit }) {
    const state = npc?.__dt2Guardian;
    const player = hit.getAttacker?.();
    if (!state || player !== npc.getOwner?.()) return;
    const type = hit.getCombatMethod?.().type();
    const melee = type === api.core.CombatType.MELEE;
    const allowed = melee || (type === api.core.CombatType.MAGIC && player.getSpellbook() === MagicSpellbook.ANCIENT);
    if (state.shielded && !allowed) {
      for (const damage of hit.getHits()) damage.setDamage(0);
      hit.updateTotalDamage();
      return;
    }
    if (allowed) state.lastAttack = api.core.World.getProcessCycle();
    if (hit.getTotalDamage() <= 0) return;
    if (!state.shielded) return;
    if (hit.getTotalDamage() < npc.getHitpoints() - state.bodyHp) return;
    // Cache shielded HP includes the retained body: shield overkill must not kill it.
    for (const damage of hit.getHits()) damage.setDamage(0);
    hit.updateTotalDamage();
    state.shielded = false;
    npc.setNpcTransformationId(N.ANCIENT_GUARDIAN_4);
    npc.setMaxHitpoints(100);
    npc.setHitpoints(state.bodyHp);
    player.sendMessage("The Guardian's shield crumbles. Keep attacking before it reforms!");
  }

  function processGuardian(area, player) {
    const boss = spawned.get(player)?.guardian;
    const state = boss?.__dt2Guardian;
    if (!state || boss.getHitpoints() <= 0 || player.getHitpoints() <= 0) return;
    const cycle = api.core.World.getProcessCycle();
    if (state.lastCycle === cycle) return;
    state.lastCycle = cycle;
    boss.getCombat().getLastAttack().reset();
    const here = player.getLocation();
    for (const rock of state.rocks.filter(rock => rock.due <= cycle)) {
      if (here.getX() === rock.x && here.getY() === rock.y) {
        player.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(15 + Math.floor(Math.random() * 11), api.core.HitMask.RED)]);
      }
    }
    state.rocks = state.rocks.filter(rock => rock.due > cycle);
    // shortcut: shield recharge and the three-tick rock warning need live OSRS timing calibration.
    if (cycle - state.lastAttack > 4) {
      if (!state.shielded) {
        state.bodyHp = boss.getHitpoints();
        state.shielded = true;
        boss.setNpcTransformationId(N.ANCIENT_GUARDIAN_3);
        boss.setMaxHitpoints(200);
        boss.setHitpoints(state.bodyHp + 20);
        player.sendMessage("The Guardian's shield reforms.");
      } else boss.setHitpoints(Math.min(state.bodyHp + 100, boss.getHitpoints() + 20));
    }
    if (boss.calculateDistance(player) > 1) {
      if (boss.getMovementQueue().size() === 0) api.core.PathFinder.calculateEntityRoute(boss, player);
      return;
    }
    if (cycle < state.nextAttack) return;
    state.nextAttack = cycle + 5;
    state.attacks++;
    if (state.attacks % 5 === 0) {
      boss.performAnimation(new api.core.Animation(10403)); // Cache guardian ground smash.
      for (const [dx,dy] of [[0,0],[-2,0],[2,0]]) {
        const tile = new api.core.Location(here.getX()+dx, here.getY()+dy, here.getZ());
        player.getPacketSender().sendGraphic(new api.core.Graphic(2529), tile); // Cache dt2_guardian_rock_fall.
        state.rocks.push({ x:tile.getX(), y:tile.getY(), due:cycle+3 });
      }
      player.sendMessage("Boulders fall from above. Move away from the shadows!");
    } else {
      boss.performAnimation(new api.core.Animation(10402)); // Cache guardian melee attack.
      if (player.getPacketSender().getVarbit(4118) !== 1) {
        player.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(Math.floor(Math.random()*13), api.core.HitMask.RED)]);
      }
    }
  }

  function spawnWarRoomBanikan(player, area) {
    if (player.getAttribute(BANIKAN_LEFT)) return;
    const owned = spawned.get(player) ?? {};
    if (owned.banikan && area.entities.includes(owned.banikan)) return owned.banikan;
    const banikan = api.core.NPC.create(N.DR_BANIKAN, area.tile(23, 7, 0));
    banikan.setOwner?.(player);
    banikan.setOwnerOnly?.(true);
    banikan.__skipDefaultRespawn = true;
    area.add(banikan);
    api.core.World.getAddNPCQueue().push(banikan);
    owned.banikan = banikan;
    spawned.set(player, owned);
    return banikan;
  }

  function spawnTotems(player, area) {
    let owned = spawned.get(player);
    if (!owned) spawned.set(player, owned = {});
    if (owned.totems?.every(npc => area.entities.includes(npc))) return owned.totems;
    const mask = Number(player.getAttribute(TOTEM_MASK)) || (player.getAttribute(TOTEMS_CHARGED) ? 15 : 0);
    player.getPacketSender().sendVarbit(15116, mask);
    owned.totems = TOTEMS.map((totem) => {
      const npc = api.core.NPC.create(totem.inactive, area.tile(totem.x - 2760, totem.y - 6424, 0));
      npc.setOwner?.(player);
      npc.setOwnerOnly?.(true);
      npc.__skipDefaultRespawn = true;
      npc.__dt2Totem = totem.kind;
      npc.__dt2TotemCharged = Boolean(mask & totem.mask);
      if (npc.__dt2TotemCharged) npc.setNpcTransformationId?.(totem.active);
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
    const mask = (Number(player.getAttribute(TOTEM_MASK)) || 0) | totem.mask;
    player.setAttribute(TOTEM_MASK, mask);
    player.getPacketSender().sendVarbit(15116, mask);
    target.__dt2TotemCharged = true;
    target.setNpcTransformationId?.(totem.active);
    player.sendMessage(`The ${kind} totem ignites with ancient power.`);
    const owned = spawned.get(player);
    if (owned?.totems?.every((npc) => npc?.__dt2TotemCharged)) {
      player.setAttribute(TOTEMS_CHARGED, true);
      player.sendMessage("All four totems are active. The machine can now be powered.");
    }
  }

  function nearLeviathanPathfinder(player, boss) {
    return boss?.__dt2LeviathanEnraged && player === boss.getOwner?.()
      && boss.__dt2LeviathanPathfinder?.isRegistered?.()
      && player.getLocation().getDistance(boss.__dt2LeviathanPathfinder.getLocation()) <= 4;
  }

  function leviathanHitRoll(event) {
    const boss = event.target;
    if (!boss?.__dt2Leviathan || event.attacker !== boss.getOwner?.()) return;
    const combat = event.attacker.getCombat?.();
    const spell = combat?.getCastSpell?.() ?? combat?.getSelectedSpell?.();
    // Shadow spells always stun this boss, including casts in ranged equipment.
    if ((!boss.__dt2LeviathanEnraged && event.combatType === api.core.CombatType.MAGIC
        && LEVIATHAN_SHADOW_SPELL_IDS.has(spell?.spellId?.()))
      || nearLeviathanPathfinder(event.attacker, boss)) event.forceAccurate = true;
  }

  function modifyLeviathanHit({ npc, hit }) {
    const player = hit?.getAttacker?.();
    if (!npc?.__dt2Leviathan || !nearLeviathanPathfinder(player, npc)) return;
    const minimum = Math.floor(api.core.DamageFormulas.sourceMaxHit(player, hit.getCombatType()) * 0.2);
    for (const damage of hit.getHits()) damage.setDamage(Math.max(minimum, damage.getDamage()));
    hit.updateTotalDamage();
  }

  function stunLeviathan({ attacker, target, spell }) {
    if (!attacker?.isPlayer?.() || !target?.__dt2Leviathan || attacker !== target.getOwner?.()
      || target.__dt2LeviathanEnraged) return;
    if (!LEVIATHAN_SHADOW_SPELL_IDS.has(spell?.spellId?.())) return;
    target.__dt2LeviathanStunnedUntil = api.core.World.getProcessCycle() + 15;
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

  function hitScarAxon({ player: p, npc }) {
    if (!npc?.__dt2ScarAxon || npc.getOwner?.() !== p) return false;
    const area = p?.getAttribute?.(ATTR_SCAR_MAZE_TWO);
    if (!(area instanceof ScarMazeTwoArea) || area.isDestroyed?.() || !area.entities?.includes(npc)) return false;
    if (npc.__dt2AxonComplete || (npc.getMovementQueue?.().size?.() ?? 0) > 0) return;
    const path = npc.__dt2AxonPath;
    const index = Number(npc.__dt2AxonIndex) || 0;
    const next = Math.min(index + 1, path.points.length - 1);
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
    const done = (Number(p.getAttribute(SCAR_AXON_TERMINALS)) || 0) + 1;
    p.setAttribute(SCAR_AXON_TERMINALS, done);
    p.getPacketSender().sendVarbit(15220, done);
    p.sendMessage(`The ${npc.__dt2AxonElement} axon reaches its terminal.`);
    if (done < SCAR_AXON_PATHS.length) return;
    p.setAttribute(SCAR_AXON_ROOM_COMPLETE, true);
    p.getPacketSender().sendVarbit(15258, 1);
    p.sendMessage("All four axons have reached their terminals. The passage to the nerve chamber opens.");
  }

  function resetScarAxon({ player: p, npc }) {
    const area = p?.getAttribute?.(ATTR_SCAR_MAZE_TWO);
    if (!npc?.__dt2ScarAxon || npc.getOwner?.() !== p || !(area instanceof ScarMazeTwoArea)
      || area.isDestroyed?.() || !area.entities?.includes(npc)) return false;
    if (p.getAttribute(SCAR_AXON_ROOM_COMPLETE)) return;
    if (npc.__dt2AxonComplete) {
      const done = Math.max(0, (Number(p.getAttribute(SCAR_AXON_TERMINALS)) || 0) - 1);
      p.setAttribute(SCAR_AXON_TERMINALS, done);
      p.getPacketSender().sendVarbit(15220, done);
    }
    npc.__dt2AxonComplete = false;
    npc.__dt2AxonIndex = 0;
    npc.getMovementQueue?.().reset?.();
    const [x, y] = npc.__dt2AxonPath.points[0];
    npc.moveTo(area.tile(x - 1696, y - 6400, 0));
    p.sendMessage(`The ${npc.__dt2AxonElement} axon returns to its starting point.`);
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
    // shortcut: arrival beside the cache entrance steps is collision-verified; calibrate the exact tile against a live OSRS entry capture.
    const current = p.getAttribute(ATTR_VAULT_AREA);
    if (current instanceof AncientVaultArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(10, 15, 1));
      return current;
    }
    const area = new AncientVaultArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_VAULT_AREA, area);
    p.moveTo(area.tile(10, 15, 1));
    const smith = api.core.NPC.create(ASGARNIA_SMITH_VAULT_INITIAL, area.tile(12, 15, 1));
    smith.setOwner?.(p);
    smith.setOwnerOnly?.(true);
    smith.__skipDefaultRespawn = true;
    area.add(smith);
    api.core.World.getAddNPCQueue().push(smith);
    p.setAttribute(ATTR_VAULT_SMITH, smith);
    return area;
  }

  function enterFinalRoom(p) {
    let area = p.getAttribute(FINAL_ROOM);
    if (!(area instanceof FinalVaultArea) || area.isDestroyed()) {
      area = new FinalVaultArea(p.getUsername?.());
      p.setAttribute(FINAL_ROOM, area);
    }
    area.enter(p);
    // The cutscene places the player just south of Sliske and the Elder Horn.
    p.moveTo(area.tile(32, 44, 0));
    return area;
  }

  function spawnFinalActor(p, id, sourceX, sourceY) {
    const area = p.getAttribute(FINAL_ROOM);
    if (!(area instanceof FinalVaultArea) || area.isDestroyed()) return null;
    const npc = api.core.NPC.create(id, area.tile(sourceX - 3264, sourceY - 6400, 0));
    if (!npc) return null;
    npc.setOwner?.(p);
    npc.setOwnerOnly?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    area.actors.push(npc);
    api.core.World.getAddNPCQueue().push(npc);
    return npc;
  }

  function spawnFinalWight(p, index) {
    const ids = [N.THE_FORSAKEN_ASSASSIN, N.KETLA_THE_UNWORTHY, N.KASONDE_THE_CRAVEN, N.PERSTEN_THE_DECEITFUL];
    const id = ids[index];
    if (!Number.isInteger(id)) return null;
    const npc = spawnFinalActor(p, id, 3296, 6444);
    if (!npc) return null;
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    owned.finalWight = npc;
    p.setAttribute(FINAL_WIGHT_INDEX, index);
    npc.__dt2FinalWight = index;
    p.sendMessage(["The Forsaken Assassin steps forward.", "Ketla the Unworthy steps forward.", "Kasonde the Craven steps forward.", "Persten the Deceitful steps forward."][index]);
    return npc;
  }

  function startFinalWights(p) {
    if (p.getAttribute(FINAL_WIGHTS_COMPLETE)) return;
    p.setAttribute(FINAL_WIGHTS_STARTED, true);
    p.setAttribute(FINAL_WIGHT_INDEX, 0);
    spawnFinalWight(p, 0);
  }

  function rewardFinalQuest(p) {
    if (quest.isComplete(p)) return;
    p.setAttribute(FINAL_WIGHTS_COMPLETE, true);
    const inventory = p.getInventory();
    const equipment = p.getEquipment();
    const wornVisibility = equipment.getAmount(I.RING_OF_VISIBILITY) > 0;
    for (const container of [inventory, equipment]) {
      for (const id of [I.RING_OF_VISIBILITY, I.RING_OF_SHADOWS]) {
        if (container.getAmount(id) > 0) container.deleteNumber(id, container.getAmount(id));
      }
    }
    (wornVisibility ? equipment : inventory).adds(I.RING_OF_SHADOWS, 1);
    for (let i = 0; i < 3; i++) {
      if ((inventory.getFreeSlots?.() ?? 0) > 0) inventory.adds(I.ANCIENT_LAMP, 1);
      else {
        const groundItems = api.getItemOnGroundManager?.();
        const location = p.getLocation?.();
        if (location && groundItems?.registerLocation) groundItems.registerLocation(p, new Item(I.ANCIENT_LAMP, 1), location.clone?.() ?? location);
        else inventory.adds(I.ANCIENT_LAMP, 1);
      }
    }
    quest.complete(p);
  }

  const ruinsStarted = new WeakSet();
  function enterStranglewoodRuins(p) {
    if (stage(p) !== S.VARDORVIS || Number(p.getAttribute(VARDORVIS_PROGRESS)) !== 6
      || p.getAttribute(STRANGLEWOOD_CITY_ENTERED) || ruinsStarted.has(p)) return;
    ruinsStarted.add(p);
    p.getMovementQueue?.().reset?.();
    spawnSurfaceKasonde(p);
    talk(p, N.KASONDE, "carnifex-maximus-vardorvis-entering-the-stranglewood-ruins");
  }
  class StranglewoodRuinsArea extends api.core.Area {
    getName() { return "The Stranglewood"; }
    postEnter(actor) { if (actor.isPlayer()) enterStranglewoodRuins(actor.getAsPlayer()); }
    process(actor) { if (actor.isPlayer()) enterStranglewoodRuins(actor.getAsPlayer()); }
    postLeave(actor) { if (actor.isPlayer()) ruinsStarted.delete(actor.getAsPlayer()); }
  }

  function crossStranglewoodBarricade({ player: p, objectId, location }) {
    if (objectId !== STRANGLEWOOD_BARRICADE_LOC || location.x !== 1193 || location.y !== 3401) return false;
    if (!p.getAttribute(STRANGLEWOOD_CITY_ENTERED)) {
      p.sendMessage("Follow Kasonde's voice from the ruins before crossing the barricade.");
      return true;
    }
    p.getMovementQueue?.().reset?.();
    p.moveTo(new api.core.Location(1193, p.getLocation().getY() <= 3401 ? 3405 : 3399, 0));
    return true;
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
      p.moveTo(current.tile(31, 24, 0));
      return current;
    }
    const area = new StranglewoodHideoutArea(p.getUsername?.(), p);
    area.enter(p);
    p.setAttribute(ATTR_STRANGLEWOOD_HIDEOUT, area);
    p.moveTo(area.tile(31, 24, 0));
    const kasonde = api.core.NPC.create(N.KASONDE, area.tile(24, 20, 0));
    kasonde.setOwner?.(p);
    kasonde.setOwnerOnly?.(true);
    kasonde.setMaxHitpoints?.(85);
    kasonde.setHitpoints?.(85);
    kasonde.__skipDefaultRespawn = true;
    area.kasonde = kasonde;
    area.add(kasonde);
    api.core.World.getAddNPCQueue().push(kasonde);
    if (Number(p.getAttribute(VARDORVIS_PROGRESS)) >= 9) {
      area.defended = true;
      area.remainingTicks = 0;
    } else {
      area.spawnEnemy(0);
      area.nextSpawnTick = 16;
    }
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
      if ((Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 13) spawnTempleKasonde(p, current);
      return current;
    }
    const area = new StranglewoodTempleArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_STRANGLEWOOD_TEMPLE, area);
    p.moveTo(area.tile(6, 16, 0));
    if ((Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 13) {
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
      if (Number(p.getAttribute(VARDORVIS_PROGRESS)) === 16) spawnBoss(p, "vardorvis");
      return current;
    }
    const area = new VardorvisArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_VARDORVIS_AREA, area);
    p.moveTo(area.tile(13, 18, 0));
    const rocks = new api.core.GameObject(O.ROCKS_139, area.tile(6, 28, 0), 10, 0, area);
    p.getPacketSender().sendObject(rocks);
    if (Number(p.getAttribute(VARDORVIS_PROGRESS)) === 16) spawnBoss(p, "vardorvis");
    return area;
  }

  function enterScar(p) {
    const current = p.getAttribute(ATTR_SCAR_AREA);
    if (current instanceof ScarArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(21, 33, 0));
      if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) setScarVarbit(p, 6);
      if (p.getAttribute(SCAR_PERSTEN_TALKED)) revealScarMazeEntry(p, current);
      if (p.getAttribute(SCAR_PERSTEN_ROOM1_TALKED)) revealScarMazeTwoEntry(p, current);
      if (p.getAttribute(SCAR_BOAT_TRIED)) spawnScarPersten(p, current);
      if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) spawnScarDemons(p, current);
      return current;
    }
    const area = new ScarArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_SCAR_AREA, area);
    if (!p.getAttribute(SCAR_DEMONS_DEFEATED)) setScarVarbit(p, 6);
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
    p.moveTo(area.tile(15, 41, 0));
    setScarVarbit(p, p.getAttribute(SCAR_LEVIATHAN_DEBRIS_SEARCHED) ? 48
      : p.getAttribute(SCAR_PERSTEN_LEFT_SHIP) ? 46
        : p.getAttribute(SCAR_LEVIATHAN_KILLED) ? 42 : 40);
    if (!p.getAttribute(SCAR_LEVIATHAN_KILLED)) spawnBoss(p, "leviathan");
    else {
      if (p.getAttribute(SCAR_SHIP_REACHED) || p.getAttribute(SCAR_PERSTEN_LEFT_SHIP)) p.moveTo(area.tile(42, 46, 0));
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
    p.moveTo(atBossGate ? area.tile(167, 97, 0) : area.tile(40, 18, 2));
    activateSucellusSupplies(area);
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

  function activateSucellusSupplies(area) {
    const supplies = [
      [O.SALT_DEPOSIT, 3033, 6448, 0], [O.SALT_DEPOSIT, 3043, 6448, 0],
      [O.MUSCA_MUSHROOMS, 3048, 6453, 0], [O.ARDER_MUSHROOMS, 3030, 6453, 0],
      [O.FERMENTATION_VAT, 3034, 6438, 0], [O.FERMENTATION_VAT, 3043, 6438, 0],
      [O.PESTLE_AND_MORTAR, 3034, 6434, 0], [O.PICKAXE_2, 3044, 6434, 0],
    ];
    for (const [id, sourceX, sourceY, z] of supplies) {
      const tile = area.tile(sourceX - 2872, sourceY - 6336, z);
      if (area.getObjects?.().some((object) => object.getId() === id && object.getLocation().equals(tile))) continue;
      const template = area.getTemplateObjects?.(tile)?.find((object) => object.getLocation().equals(tile));
      if (!template) continue;
      const object = new api.core.GameObject(id, tile, template.getType(), template.getFace(), area);
      api.core.ObjectManager.register(object, true);
    }
  }

  function openSucellusGate({ player, object, objectId, definition, location }) {
    const area = player?.getAttribute(SUCELLUS_AREA);
    const tile = sucellusSourceTile(player, location);
    const id = definition?.id ?? objectId;
    if (stage(player) !== S.SUCELLUS || area !== player.getPrivateArea?.() || !(area instanceof SucellusArea)
      || !player.getAttribute(SUCELLUS_PRISON_COMPLETE) || id !== SUCELLUS_BOSS_GATE
      || tile?.x !== 3039 || tile?.y !== 6433 || tile?.z !== 0 || !object) return false;
    const opened = new api.core.GameObject(
      SUCELLUS_BOSS_GATE_OPEN, object.getLocation(), object.getType(), object.getFace(), area,
    );
    api.core.ObjectManager.register(opened, true);
    api.core.ObjectManager.deregister(object, true);
    return true;
  }

  function saveSucellusPrisonCheckpoint(player, area) {
    if (stage(player) !== S.SUCELLUS || player.getAttribute(SUCELLUS_DEFEATED)
      || !player.getAttribute(SUCELLUS_CELL_ESCAPED) || player.getAttribute(SUCELLUS_AREA) !== area
      || player.getPrivateArea?.() !== area) return;
    const location = player.getLocation();
    const z = location.getZ?.() ?? location.z ?? 0;
    if (z !== 2) return;
    const checkpoint = {
      x: location.getX() - area.getBaseX() + 2872,
      y: location.getY() - area.getBaseY() + 6336,
      z,
      progress: Number(player.getAttribute(SUCELLUS_PRISON_PROGRESS)) || 22,
    };
    if (checkpoint.x < 2872 || checkpoint.x >= 3064 || checkpoint.y < 6336 || checkpoint.y >= 6472) return;
    const previous = player.getAttribute(SUCELLUS_PRISON_CHECKPOINT);
    if (previous?.x === checkpoint.x && previous?.y === checkpoint.y && previous?.z === checkpoint.z
      && previous?.progress === checkpoint.progress) return;
    player.setAttribute(SUCELLUS_PRISON_CHECKPOINT, checkpoint);
  }

  function restoredSucellusPrisonTile(player, area) {
    const checkpoint = player.getAttribute(SUCELLUS_PRISON_CHECKPOINT);
    const progress = Number(player.getAttribute(SUCELLUS_PRISON_PROGRESS)) || 22;
    if (!checkpoint || checkpoint.progress !== progress || progress === 54 || checkpoint.z !== 2
      || checkpoint.x < 2872 || checkpoint.x >= 3064 || checkpoint.y < 6336 || checkpoint.y >= 6472) return null;
    return area.tile(checkpoint.x - 2872, checkpoint.y - 6336, checkpoint.z);
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
    const npc = api.core.NPC.create(N.WIZARD_PERSTEN_5, area.tile(42, 38, 0));
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
    const thirdPassage = p.getAttribute(SCAR_PERSTEN_ROOM2_TALKED);
    const objectId = thirdPassage ? O.PASSAGE_16 : O.PASSAGE_15;
    if (area.scarMazeTwoEntry?.id === objectId) return;
    if (area.scarMazeTwoEntry) area.detach?.(area.scarMazeTwoEntry);
    const passage = new api.core.GameObject(objectId, area.tile(thirdPassage ? 51 : 47, thirdPassage ? 34 : 27, 0), 10, 0, area);
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
      p.moveTo(current.tile(40, 36, 0));
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
    p.moveTo(area.tile(40, 36, 0));
    setScarVarbit(p, 32);
    p.getPacketSender().sendVarbit(15211, Number(p.getAttribute(SCAR_MAZE_THREE_AIR)) || 100);
    p.getPacketSender().sendVarbit(15212, Number(p.getAttribute(SCAR_MEMORY_STEP)) || 0);
    p.getPacketSender().sendVarbit(15217, Number(p.getAttribute(SCAR_MEMORY_STEP)) || 0);
    const order = p.getAttribute(SCAR_MEMORY_ORDER);
    order.forEach((growth, index) => p.getPacketSender().sendVarbit(15213 + index, growth));
    p.getPacketSender().sendVarbit(15258, p.getAttribute(SCAR_MEMORY_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15259, p.getAttribute(SCAR_LEECH_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15260, p.getAttribute(SCAR_TREE_COMPLETE) ? 1 : 0);
    if (p.getAttribute(SCAR_LEECH_COMPLETE) && p.getAttribute(SCAR_TREE_COMPLETE)) revealScarBoatPassageThree(p);
    return area;
  }

  function enterScarMazeTwo(p) {
    const current = p.getAttribute(ATTR_SCAR_MAZE_TWO);
    if (current instanceof ScarMazeTwoArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(62, 20, 0));
      setScarVarbit(p, 24);
      return current;
    }
    const area = new ScarMazeTwoArea(p.getUsername?.(), p);
    area.enter(p);
    p.setAttribute(ATTR_SCAR_MAZE_TWO, area);
    p.setAttribute(SCAR_MAZE_TWO_ENTERED, true);
    p.moveTo(area.tile(62, 20, 0));
    setScarVarbit(p, 24);
    p.getPacketSender().sendVarbit(15258, p.getAttribute(SCAR_AXON_ROOM_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15259, p.getAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE) ? 1 : 0);
    p.getPacketSender().sendVarbit(15260, p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE) ? 1 : 0);
    if (p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE)) revealScarBoatPassageTwo(p);
    return area;
  }

  function enterScarMazeOne(p) {
    if (p.getAttribute(SCAR_TETHER_DESTROYED)) p.setAttribute(SCAR_PATH_COMPLETE, true);
    const current = p.getAttribute(ATTR_SCAR_MAZE_ONE);
    if (current instanceof ScarMazeOneArea && !current.isDestroyed()) {
      current.enter(p);
      p.moveTo(current.tile(18, 57, 0));
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
    p.moveTo(area.tile(18, 57, 0));
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
    if (stage(p) !== S.LEVIATHAN || p.getAttribute(ATTR_SCAR_AREA)) return false;
    talk(p, npcId, p.getAttribute(SCAR_GUARDIAN_ACCEPTED)
      ? "praefectus-classis-perseriya-talking-to-the-catalytic-guardian-talking-to-the-catalytic-guardian-after-exiting-the-scar-for-the-first-time"
      : "praefectus-classis-perseriya-talking-to-the-catalytic-guardian");
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
    p.setAttribute(SCAR_AXON_TERMINALS, 0);
    p.getPacketSender().sendVarbit(15220, 0);
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
    const npc = api.core.NPC.create(N.COL_00FFFF_CATALYST_COL, area.tile(40, 12, 0));
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

  function revealScarBoatPassageTwo(p) {
    const area = p.getAttribute(ATTR_SCAR_MAZE_TWO);
    if (!(area instanceof ScarMazeTwoArea) || area.isDestroyed?.() || area.scarBoatPassage) return;
    const object = new api.core.GameObject(O.PASSAGE_22, area.tile(75, 59, 0), 10, 2, area);
    area.add(object);
    area.scarBoatPassage = object;
    p.getPacketSender().sendObject(object);
  }

  function revealScarBoatPassageThree(p) {
    const area = p.getAttribute(ATTR_SCAR_MAZE_THREE);
    if (!(area instanceof ScarMazeThreeArea) || area.isDestroyed?.() || area.scarBoatPassage) return;
    const object = new api.core.GameObject(O.PASSAGE_22, area.tile(43, 56, 0), 10, 0, area);
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
      const npc = api.core.NPC.create(N.LIGHT_LEECH, area.tile(x - 2160, y - 6400, 0));
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
    if (!owned.scarBrainPillar?.isRegistered?.()) {
      const pillar = api.core.NPC.create(N.COL_00FFFF_BRAIN_PILLAR_COL, area.tile(33, 5, 0));
      pillar.setOwner?.(p);
      pillar.setOwnerOnly?.(true);
      pillar.__skipDefaultRespawn = true;
      pillar.__dt2ScarBrainPillar = true;
      area.add(pillar);
      api.core.World.getAddNPCQueue().push(pillar);
      owned.scarBrainPillar = pillar;
    }
    p.setAttribute(SCAR_TREE_STARTED, true);
    p.setAttribute("desert-treasure-ii:scar-tree-wave", 0);
    // shortcut: four fixed waves approximate pillar healing; calibrate against a live capture.
    owned.scarTreeAntibodies = [[1894, 6406], [1894, 6408], [1894, 6410]].map(([x, y]) => {
      const npc = api.core.NPC.create(N.ABYSSAL_ANTIBODY, area.tile(x - 1856, y - 6400, 0));
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
    const tile = area.tile(46, 10, 0);
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
    if ((p.getAttribute(SCAR_LEECH_GROWTHS_REPAIRED) ?? []).length < 4
      && !owned.scarMazeThreeLightLeeches?.some((npc) => npc?.isRegistered?.())) {
      owned.scarMazeThreeLightLeeches = [[1868, 6430], [1864, 6430], [1872, 6430], [1875, 6430]].map(([x, y]) => {
        const npc = api.core.NPC.create(N.LIGHT_LEECH, area.tile(x - 1856, y - 6400, 0));
        npc.setOwner?.(p);
        npc.setOwnerOnly?.(true);
        npc.__skipDefaultRespawn = true;
        npc.__dt2ScarMazeThreeLeech = true;
        area.add(npc);
        api.core.World.getAddNPCQueue().push(npc);
        return npc;
      });
    }
    if ((p.getAttribute(SCAR_LEECH_GROWTHS_REPAIRED) ?? []).length === 4) spawnScarMazeThreeBloodCells(p, area);
    p.sendMessage("Take four illuminating lures from the light leeches and use them on the damaged growths.");
  }

  function spawnScarMazeThreeBloodCells(p, area) {
    const owned = spawned.get(p) ?? {};
    spawned.set(p, owned);
    if (!owned.scarMazeThreeBloodCells?.some((npc) => npc?.isRegistered?.())) {
      owned.scarMazeThreeBloodCells = [
        ...Array.from({ length: Math.max(0, 3 - (p.getAttribute(SCAR_BLOOD_RED_REPAIRED) ?? []).length) }, (_, i) => ({ id: N.CRIMSON_SANGUISPHERA, x: 1866 + i * 2, y: 6436, type: "crimson" })),
        ...Array.from({ length: Math.max(0, 3 - (p.getAttribute(SCAR_BLOOD_WHITE_REPAIRED) ?? []).length) }, (_, i) => ({ id: N.RADIANT_SANGUISPHERA, x: 1866 + i * 2, y: 6425, type: "radiant" })),
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
  }

  function handleScarMazeThreeObject(event, tile) {
    const p = event?.player;
    if (!p || stage(p) !== S.LEVIATHAN || !tile || !p.getAttribute(SCAR_MAZE_THREE_ACTIVE)) return false;
    const { objectId, definition } = event;
    const id = definition?.id ?? objectId;
    const area = p.getAttribute(ATTR_SCAR_MAZE_THREE);
    if (id === O.FLESHY_STRAND && tile.x === 1879 && tile.y === 6436) {
      stopScarMemoryPlayback(p, area);
      area.leave(p, false);
      const scar = enterScar(p);
      p.moveTo(scar.tile(51, 43, 0));
      p.setAttribute(SCAR_MAZE_THREE_ACTIVE, false);
      p.setAttribute(SCAR_MEMORY_UNDERWATER, false);
      setScarVarbit(p, p.getAttribute(SCAR_BOAT3_BURNED) ? 34 : 32);
      p.sendMessage("You leave the final passage and return to Persten's camp.");
      return true;
    }
    if (id === O.PASSAGE_18 && ((tile.x === 1897 && tile.y === 6436) || (tile.x === 1912 && tile.y === 6427))) {
      const source = scarMazeThreeSourceTile(p, p.getLocation());
      const west = tile.x === 1897;
      const inside = west ? source.x >= 1899 : source.y >= 6429;
      if (inside) {
        stopScarMemoryPlayback(p, area);
        p.setAttribute(SCAR_MEMORY_UNDERWATER, false);
        p.moveTo(west ? area.tile(40, 36, 0) : area.tile(57, 26, 0));
        return true;
      }
      const equipment = p.getEquipment();
      if (equipment.isSlotOccupied(api.core.Equipment.WEAPON_SLOT) || equipment.isSlotOccupied(api.core.Equipment.SHIELD_SLOT)) {
        p.sendMessage("Free both hands before diving into the memory chamber.");
        return true;
      }
      p.moveTo(west ? area.tile(43, 36, 0) : area.tile(57, 29, 0));
      if (!p.getAttribute(SCAR_MEMORY_COMPLETE)) {
        p.setAttribute(SCAR_MEMORY_UNDERWATER, true);
        p.setAttribute(SCAR_MAZE_THREE_AIR, 100);
        p.getPacketSender().sendVarbit(15211, 100);
      }
      return true;
    }
    if (id === O.ABYSSAL_STEM && tile.x === 1907 && tile.y === 6436) {
      if (p.getAttribute(SCAR_MEMORY_COMPLETE)) {
        p.sendMessage("The Abyssal Stem's sequence is already restored.");
        return true;
      }
      let order = p.getAttribute(SCAR_MEMORY_ORDER);
      if (!Array.isArray(order) || order.length !== 4) {
        order = shuffled([0, 1, 2, 3]);
        p.setAttribute(SCAR_MEMORY_ORDER, order);
      }
      p.setAttribute(SCAR_MEMORY_STEP, 0);
      stopScarMemoryPlayback(p, area);
      area.scarMemoryPlayback = { order: [...order], index: 0, lit: null, next: api.core.World.getProcessCycle() + 1 };
      p.getPacketSender().sendVarbit(15212, 0);
      p.getPacketSender().sendVarbit(15217, 0);
      order.forEach((value, index) => p.getPacketSender().sendVarbit(15213 + index, value));
      p.sendMessage("The Abyssal Stem reveals a sequence. Touch the four growths in that order, surfacing at air bubbles as needed.");
      return true;
    }
    if (id === 49391 && SCAR_MEMORY_GROWTHS.some(([x, y]) => x === tile.x && y === tile.y)) {
      if (area.scarMemoryPlayback) {
        p.sendMessage("Watch the glowing growths before repeating their sequence.");
        return true;
      }
      const index = SCAR_MEMORY_GROWTHS.findIndex(([x, y]) => x === tile.x && y === tile.y);
      const order = p.getAttribute(SCAR_MEMORY_ORDER) ?? [];
      const step = Number(p.getAttribute(SCAR_MEMORY_STEP)) || 0;
      if (p.getAttribute(SCAR_MEMORY_COMPLETE)) { p.sendMessage("The Abyssal Stem's sequence is already restored."); return true; }
      if (order[step] !== index) {
        p.setAttribute(SCAR_MEMORY_STEP, 0);
        p.getPacketSender().sendVarbit(15212, 0);
        p.getPacketSender().sendVarbit(15217, 0);
        p.sendMessage("The growths dim and the sequence resets. Touch the Abyssal Stem to observe it again.");
        return true;
      }
      const next = step + 1;
      p.setAttribute(SCAR_MEMORY_STEP, next);
      p.getPacketSender().sendVarbit(15212, next);
      p.getPacketSender().sendVarbit(15217, next);
      if (next === 4) {
        p.setAttribute(SCAR_MEMORY_COMPLETE, true);
        p.setAttribute(SCAR_MEMORY_UNDERWATER, false);
        p.getPacketSender().sendVarbit(15258, 1);
        p.sendMessage("The Abyssal Stem glows steadily. The memory puzzle is complete.");
      }
      return true;
    }
    if (id === 49412 && tile.x === 1902 && tile.y === 6411) {
      const source = scarMazeThreeSourceTile(p, p.getLocation());
      if (source.y <= 6410) {
        p.moveTo(area.tile(46, 13, 0));
        return true;
      }
      if (!p.getAttribute(SCAR_MEMORY_COMPLETE)) { p.sendMessage("The Brain Pillar room remains sealed until the Abyssal Stem is restored."); return true; }
      enterScarTreeRoom(p, area);
      return true;
    }
    if (id === O.PASSAGE_20 && tile.x === 1907 && tile.y === 6406) {
      const source = scarMazeThreeSourceTile(p, p.getLocation());
      p.moveTo(area.tile(source.x <= 1906 ? 53 : 50, 6, 0));
      return true;
    }
    if (id === O.NEURAL_TELEPORTER && tile.x === 1917 && tile.y === 6404) {
      p.moveTo(area.tile(17, 59, 0));
      return true;
    }
    if (id === O.NEURAL_TELEPORTER_2 && tile.x === 1871 && tile.y === 6460) {
      p.moveTo(area.tile(60, 4, 0));
      return true;
    }
    if (id === 49416 && tile.x === 1891 && tile.y === 6457) {
      if (!p.getAttribute(SCAR_TREE_COMPLETE)) { p.sendMessage("Defend the Brain Pillar before entering the Unlit Veins."); return true; }
      p.moveTo(area.tile(6, 9, 0));
      return true;
    }
    if (id === 49411 && tile.x === 1862 && tile.y === 6421) {
      const source = scarMazeThreeSourceTile(p, p.getLocation());
      if (source.y >= 6423) {
        p.moveTo(area.tile(6, 20, 0));
        return true;
      }
      if (!p.getAttribute(SCAR_TREE_COMPLETE)) { p.sendMessage("Defend the Brain Pillar before entering the Unlit Veins."); return true; }
      enterScarLeechRoom(p, area);
      return true;
    }
    if (id === 49415 && tile.x === 1861 && tile.y === 6410) {
      p.moveTo(area.tile(35, 56, 0));
      p.sendMessage("You return through the green neural portal.");
      return true;
    }
    if ([O.PASSAGE_22, O.PASSAGE_23].includes(id) && tile.x === 1899 && tile.y === 6456) {
      if (!p.getAttribute(SCAR_MEMORY_COMPLETE) || !p.getAttribute(SCAR_TREE_COMPLETE) || !p.getAttribute(SCAR_LEECH_COMPLETE)) {
        p.sendMessage("The shipwreck passage remains sealed until the three rooms are complete.");
        return true;
      }
      const source = scarMazeThreeSourceTile(p, p.getLocation());
      p.moveTo(area.tile(source.x >= 1901 ? 42 : 45, 56, 0));
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

  function showScarMemoryGrowth(p, area, index, glowing) {
    const [x, y] = SCAR_MEMORY_GROWTHS[index];
    p.getPacketSender().sendObject(new api.core.GameObject(
      glowing ? O.ABYSSAL_GROWTH_3 : O.ABYSSAL_GROWTH,
      area.tile(x - 1856, y - 6400, 0), 10, 2, area));
  }

  function stopScarMemoryPlayback(p, area) {
    if (area.scarMemoryPlayback?.lit !== null && area.scarMemoryPlayback?.lit !== undefined) {
      showScarMemoryGrowth(p, area, area.scarMemoryPlayback.lit, false);
    }
    area.scarMemoryPlayback = null;
  }

  function takeScarLightLure({ player: p, npc }) {
    if (stage(p) !== S.LEVIATHAN || (!p.getAttribute(SCAR_GROWTH_LIVE) && !p.getAttribute("desert-treasure-ii:scar-leech-in-room"))) return false;
    const owned = spawned.get(p);
    const mazeThree = owned?.scarMazeThreeLightLeeches?.includes(npc);
    if (!owned?.scarLightLeeches?.includes(npc) && !mazeThree) return false;
    if (Math.random() < 0.5) {
      if (p.getInventory().adds(I.ILLUMINATING_LURE, 1) === false) {
        p.sendMessage("You need inventory space to take the illuminating lure.");
        return true;
      }
      const area = mazeThree ? p.getAttribute(ATTR_SCAR_MAZE_THREE) : p.getAttribute(ATTR_SCAR_MAZE_ONE);
      area?.remove?.(npc);
      if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
      if (mazeThree) owned.scarMazeThreeLightLeeches = owned.scarMazeThreeLightLeeches.filter((entry) => entry !== npc);
      else owned.scarLightLeeches = owned.scarLightLeeches.filter((entry) => entry !== npc);
      p.sendMessage("You take an illuminating lure from the light leech.");
      return true;
    }
    if (!p.getPrayerActive?.()?.[api.core.PrayerHandler.PROTECT_FROM_MELEE]) {
      const damage = 2 + Math.floor(Math.random() * 5);
      p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(damage, api.core.HitMask.RED)]);
    }
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
      p.setAttribute(SCAR_GROWTH_STEP, 0);
      p.getPacketSender().sendVarbit(SCAR_GROWTH_STEP_VARBIT, 0);
      SCAR_ENERGIES.forEach((entry) => p.getPacketSender().sendVarbit(entry.state, 1));
      p.sendMessage("The energy flares, but it isn't next in the sequence.");
      return true;
    }
    p.setAttribute(SCAR_GROWTH_STEP, step + 1);
    p.getPacketSender().sendVarbit(energy.state, 2);
    p.getPacketSender().sendVarbit(SCAR_GROWTH_STEP_VARBIT, step + 1);
    if (step + 1 === SCAR_ENERGY_RUNES.length) {
      p.setAttribute("desert-treasure-ii:scar-growth-complete", true);
      p.getPacketSender().sendVarbit(15260, 1);
      revealScarBoatPassage(p);
      p.sendMessage("The damaged growths restore the passage. The shipwreck chamber is now reachable.");
    }
    return true;
  }

  function scarCatalystOrder(p) {
    let order = p.getAttribute(SCAR_CATALYST_ORDER);
    if (!Array.isArray(order)) order = shuffled(SCAR_CATALYST_RUNES);
    else if (order.length === 6 && !order.includes(I.WRATH_NERVE)) order = [...order, I.WRATH_NERVE];
    p.setAttribute(SCAR_CATALYST_ORDER, order);
    return order;
  }

  function inspectScarCatalyst({ player: p }) {
    if (stage(p) !== S.LEVIATHAN || !p.getAttribute(SCAR_RIFT_LIVE)) return false;
    const progress = Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0;
    const order = scarCatalystOrder(p);
    if (progress >= order.length) {
      p.sendMessage("The Catalyst has been disrupted. Continue to the damaged growth room.");
      return true;
    }
    const expected = order[progress] ?? SCAR_CATALYST_RUNES[0];
    const name = SCAR_CATALYST_RUNE_NAMES[SCAR_CATALYST_RUNES.indexOf(expected)] ?? "unknown";
    p.sendMessage(`The Catalyst is currently resonating with ${name} nerve.`);
  }

  function collectScarNerve(p, itemId, attribute, tileKey) {
    const regrowAt = p.getAttribute(attribute) ?? {};
    const now = api.core.World.getProcessCycle();
    if ((Number(regrowAt[tileKey]) || 0) > now) {
      p.sendMessage("That nerve ending is still regrowing.");
      return true;
    }
    if (p.getInventory().adds(itemId, 1) === false) {
      p.sendMessage("You need inventory space to take the rune nerve.");
      return true;
    }
    // shortcut: the Wiki says endings regrow shortly; calibrate these four ticks against a live capture.
    p.setAttribute(attribute, { ...regrowAt, [tileKey]: now + 4 });
    p.sendMessage("You break the nerve ending and take its rune nerve.");
    return true;
  }

  function handleNerveOnCatalyst(event) {
    const { player: p, npcId, itemId } = event ?? {};
    if (stage(p) !== S.LEVIATHAN || !p.getAttribute(SCAR_RIFT_LIVE)
      || npcId !== N.COL_00FFFF_CATALYST_COL) return false;
    event.handled = true;
    const progress = Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0;
    const order = scarCatalystOrder(p);
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
      p.getPacketSender().sendVarbit(15259, 1);
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
  function handleVardorvisGroundItemPickup(event) {
    const { player: p, groundItemId } = event;
    const area = p.getAttribute(ATTR_VARDORVIS_AREA);
    if (groundItemId !== I.TEMPLE_KEY_3 || stage(p) !== S.VARDORVIS
      || Number(p.getAttribute(VARDORVIS_PROGRESS)) !== 17 || !area || p.getPrivateArea?.() !== area) return;
    if (p.getInventory().getFreeSlots() < 1) {
      event.handled = true;
      p.sendMessage("You need inventory space for the Temple key.");
      return;
    }
    p.setAttribute(VARDORVIS_PROGRESS, 18);
  }

  function handleDialogueLine(event) {
    if (stage(event.player) === S.SUCELLUS && event.npcId === N.ASSASSIN_7) {
      if (event.text === "Eugh! I can't believe I'm doing this.") event.after = () => {
        const p = event.player;
        if (Number(p.getAttribute(SUCELLUS_CELL_PROGRESS)) !== 3) return;
        if (!has(p, I.KNIFE_5)) p.getInventory().adds(I.KNIFE_5, 1);
        p.setAttribute(SUCELLUS_CELL_PROGRESS, 4);
      };
      if (event.text === "sigh*" && event.player.getAttribute(SUCELLUS_CELL_ESCAPED)) event.after = () => {
        event.player.setAttribute(SUCELLUS_ASSASSIN_GONE, true);
        event.player.setAttribute(SUCELLUS_PRISON_PROGRESS, 22);
        api.emitCustomEvent("dt2:sucellus-prison-start", { player: event.player, area: event.player.getAttribute(SUCELLUS_AREA) });
      };
    }
    if (stage(event.player) === S.SUCELLUS && event.npcId === N.CAPTAIN_MALLETA
      && event.text === "Lovely! Thank you for your time.") {
      event.after = () => {
        event.player.setAttribute(SUCELLUS_CAPTAIN_ACCEPTED, true);
        enterSucellusArea(event.player, false);
      };
    }
    if (stage(event.player) === S.VARDORVIS) {
      const progress = Number(event.player.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (event.npcId === N.ELISSA && progress === 0 && event.text === "Great! Thanks for the help.")
        event.after = () => event.player.setAttribute(VARDORVIS_PROGRESS, 1);
      if (event.npcId === N.BARUS && progress === 1 && event.text === "Don't mention it!")
        event.after = () => event.player.setAttribute(VARDORVIS_PROGRESS, 2);
      if (event.npcId === N.KASONDE && progress === 6 && event.text === "They'll be coming. We've got no chance up here. Head down below! Now!")
        event.after = () => event.player.setAttribute(VARDORVIS_PROGRESS, 7);
      if (event.npcId === N.KASONDE && progress === 7 && event.text === "What are you waiting for? They're coming! Quick, head down below!")
        event.after = () => event.player.setAttribute(VARDORVIS_PROGRESS, 8);
      if (event.npcId === N.KASONDE && progress === 9 && event.text === "I need to gather some additional ingredients from within the temple. I will meet you back here once I'm done.")
        event.after = () => event.player.setAttribute(VARDORVIS_PROGRESS, 11);
      if (event.npcId === N.KASONDE && progress === 10 && event.text === "Okay, I'll see if I can find them.")
        event.after = () => event.player.setAttribute(VARDORVIS_PROGRESS, 11);
      if (event.npcId === N.KASONDE && progress === 15 && event.text === "We're running out of time! I'm running out of time! Drink that potion. It should strengthen your immunity against the Strangler. Now go!")
        event.after = () => event.player.setAttribute(SERUM_DISCUSSED, true);
    }
    if (event?.player?.getAttribute(FINAL_FIGURE_STARTED)
      && event?.npcId === N.MYSTERIOUS_FIGURE_2 && event?.text === "Very well...") {
      event.after = () => spawnFinalFigure(event.player);
    }
    if (stage(event?.player) !== S.LEVIATHAN) return;
    if (![N.CATALYTIC_GUARDIAN, N.CATALYTIC_GUARDIAN_2].includes(event.npcId)) return;
    if (event.text === "Then may your death come quick, human. Good luck."
      || event.text === "Very well. Good luck.") {
      event.after = () => {
        event.player.setAttribute(SCAR_GUARDIAN_ACCEPTED, true);
        enterScar(event.player);
      };
    }
  }

  function setScarVarbit(p, value) {
    p.getPacketSender().sendVarbit(SCAR_VARBIT, value);
  }

  function handleLogin({ player: p }) {
    syncNativeProgress(p);
    p.getPacketSender().sendVarbit(15116, Number(p.getAttribute(TOTEM_MASK)) || (p.getAttribute(TOTEMS_CHARGED) ? 15 : 0));
    if (stage(p) === S.VARDORVIS && p.getAttribute(STRANGLEWOOD_CITY_ENTERED)
      && Number(p.getAttribute(VARDORVIS_PROGRESS)) >= 6 && Number(p.getAttribute(VARDORVIS_PROGRESS)) <= 16) spawnSurfaceKasonde(p);
    if (stage(p) === S.WHISPERER) {
      setLassar(p, p.getAttribute(LASSAR) ?? {});
      ensurePrescott(p);
    }
    if (stage(p) === S.FINALE && p.getAttribute("desert-treasure-ii:final-cutscene-started")
      && !p.getAttribute(FINAL_WIGHTS_COMPLETE)) {
      enterFinalRoom(p);
      // The official sequence resets if the player leaves the chamber.
      p.setAttribute(FINAL_WIGHT_INDEX, 0);
      startFinalWights(p);
    }
    if (stage(p) === S.SUCELLUS) {
      const escaped = p.getAttribute(SUCELLUS_CELL_ESCAPED) === true;
      const defeated = p.getAttribute(SUCELLUS_DEFEATED) === true;
      if (p.getAttribute(SUCELLUS_CELL_ENTERED) || escaped || defeated) {
        if (!escaped && !defeated && !p.getAttribute(SUCELLUS_PRISON_GEAR)) storeSucellusPrisonGear(p);
        const area = enterSucellusArea(p, false);
        if (!escaped && !defeated) p.moveTo(area.tile(168, 33, 0));
        else if (!defeated) {
          p.moveTo(restoredSucellusPrisonTile(p, area) ?? area.tile(40, 14, 2));
          spawnSucellusCellAssassin(p, area);
          api.emitCustomEvent("dt2:sucellus-prison-resume", { player: p, area });
        } else p.moveTo(area.tile(167, 97, 0));
      }
    }
    if (stage(p) !== S.LEVIATHAN) return;
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
    if (p.getAttribute(SCAR_AXON_ROOM_COMPLETE)) p.setAttribute(SCAR_AXON_TERMINALS, SCAR_AXON_PATHS.length);
    p.getPacketSender().sendVarbit(15220, Number(p.getAttribute(SCAR_AXON_TERMINALS)) || 0);
    p.getPacketSender().sendVarbit(15221, (p.getAttribute(SCAR_NERVE_ROOM_TWO_REPAIRED) ?? []).length);
    scarCatalystOrder(p);
    const challenges = p.getAttribute(SCAR_MAZE_THREE_ACTIVE)
      ? [p.getAttribute(SCAR_MEMORY_COMPLETE), p.getAttribute(SCAR_LEECH_COMPLETE), p.getAttribute(SCAR_TREE_COMPLETE)]
      : p.getAttribute(SCAR_MAZE_TWO_ENTERED)
        ? [p.getAttribute(SCAR_AXON_ROOM_COMPLETE), p.getAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE), p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE)]
        : [p.getAttribute(SCAR_TETHER_DESTROYED), (Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0) >= SCAR_CATALYST_RUNES.length,
          p.getAttribute("desert-treasure-ii:scar-growth-complete")];
    challenges.forEach((done, index) => p.getPacketSender().sendVarbit(15258 + index, done ? 1 : 0));
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
    if (!p.getAttribute(SCAR_MAZE_TWO_ENTERED) && !p.getAttribute(SCAR_MAZE_THREE_ACTIVE)) {
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
    }
    if (p.getAttribute(SCAR_BOAT_TRIED) && !p.getAttribute(ATTR_SCAR_AREA)) enterScar(p);
    if (p.getAttribute(SCAR_LEVIATHAN_KILLED)) {
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
    const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
    if (progress >= 21) return null;
    const key = progress >= 20 ? "kasondeInjured" : progress >= 19 ? "kasondeBoss" : "templeKasonde";
    if (owned[key]?.isRegistered?.()) return owned[key];
    const npcId = progress >= 20 ? N.KASONDE_9 : progress >= 19 ? N.KASONDE_7 : N.KASONDE;
    const npc = api.core.NPC.create(npcId, area.tile(7, 16, 0));
    npc.setOwner?.(p);
    npc.setOwnerOnly?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    owned[key] = npc;
    if (progress === 18) talk(p, N.KASONDE, "carnifex-maximus-vardorvis-entering-the-temple-after-defeating-vardorvis");
    if (progress === 19) npc.getCombat?.()?.attack?.(p);
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
    p.moveTo(new api.core.Location(3510, 2971, 0));
    return true;
  }

  function leaveWarRoom(p) {
    const area = p.getAttribute(ATTR_WAR_ROOM);
    if (!(area instanceof WarRoomArea) || area.isDestroyed()) return false;
    area.leave(p, false);
    area.postLeave(p, false);
    area.destroy();
    p.setAttribute(ATTR_WAR_ROOM, null);
    p.moveTo(new api.core.Location(3411, 9813, 0));
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

  function finalRoomSourceTile(p, location) {
    const area = p.getAttribute(FINAL_ROOM);
    if (!(area instanceof FinalVaultArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 3264;
    const y = location.y - area.getBaseY() + 6400;
    return x >= 3264 && x < 3320 && y >= 6400 && y < 6464 ? { x, y } : null;
  }

  function hideoutSourceTile(p, location) {
    const area = p.getAttribute(ATTR_STRANGLEWOOD_HIDEOUT);
    if (!(area instanceof StranglewoodHideoutArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 1160;
    const y = location.y - area.getBaseY() + 9736;
    return x >= 1160 && x < 1216 && y >= 9736 && y < 9776 ? { x, y } : null;
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
    const x = location.x - area.getBaseX() + 2056;
    const y = location.y - area.getBaseY() + 6336;
    return x >= 2056 && x < 2112 && y >= 6336 && y < 6400 ? { x, y } : null;
  }

  function sucellusSourceTile(p, location) {
    const area = p.getAttribute(SUCELLUS_AREA);
    if (!(area instanceof SucellusArea) || area.isDestroyed?.() || !location) return null;
    const x = location.x - area.getBaseX() + 2872;
    const y = location.y - area.getBaseY() + 6336;
    const z = location.z ?? location.getZ?.() ?? 0;
    return x >= 2872 && x < 3064 && y >= 6336 && y < 6472 ? { x, y, z } : null;
  }

  function routeSucellusVat(event) {
    const p = event.player;
    const area = p?.getAttribute(SUCELLUS_AREA);
    if (stage(p) !== S.SUCELLUS || !(area instanceof SucellusArea) || area !== p.getPrivateArea?.()
      || ![O.FERMENTATION_VAT, O.FERMENTATION_VAT_2, O.FERMENTATION_VAT_3, O.FERMENTATION_VAT_4,
        O.FERMENTATION_VAT_5, O.FERMENTATION_VAT_6, O.FERMENTATION_VAT_7, O.FERMENTATION_VAT_8].includes(event.objectId)) return;
    const location = event.object?.getLocation?.();
    const source = sucellusSourceTile(p, location && {
      x: location.getX(), y: location.getY(), z: location.getZ(),
    });
    if (source?.z !== 0 || source.x !== 3034 || source.y !== 6438) return;

    // The west cache vat's rotation puts every vanilla path endpoint behind its solid
    // footprint. This is the clear, reachable tile immediately east of the vat.
    const approach = area.tile(164, 103, 0);
    event.destination = { x: approach.getX(), y: approach.getY(), z: 0 };
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
    if (event.clickType !== 1) return;
    const p = event.player;
    const leviathan = p?.getAttribute(ATTR_LEVIATHAN_AREA);
    const loc = event.object?.getLocation?.();
    if (leviathan instanceof LeviathanArea && !leviathan.isDestroyed() && loc) {
      const source = leviathanSourceTile(p, { x: loc.getX(), y: loc.getY() });
      let approach;
      if ([47594, 49210].includes(event.objectId) && source?.x === 2091 && source.y === 6380) {
        approach = leviathan.tile(34, 44, 0);
      } else if ([49529, 49210].includes(event.objectId) && source?.x === 2096 && source.y === 6382) {
        approach = leviathan.tile(38, 46, 0);
      }
      if (approach) {
        event.destination = { x: approach.getX(), y: approach.getY(), z: 0 };
        return;
      }
    }
    if (event.objectId !== 49209) return;
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
    p.moveTo(new api.core.Location(1117, 3429, 0));
    return true;
  }

  function handleLogout({ player: p }) {
    if (!p) return;
    const current = p.getPrivateArea?.();
    const returnToVaultEntrance = current && [p.getAttribute(ATTR_VAULT_AREA), p.getAttribute(FINAL_ROOM)].includes(current);
    const returnToDigsite = current && current === p.getAttribute(ATTR_WAR_ROOM);
    const returnToPrison = current && current === p.getAttribute(SUCELLUS_AREA);
    if (returnToPrison) saveSucellusPrisonCheckpoint(p, current);
    const returnToGuardian = current && [ATTR_SCAR_AREA, ATTR_SCAR_MAZE_ONE, ATTR_SCAR_MAZE_TWO,
      ATTR_SCAR_MAZE_THREE, ATTR_LEVIATHAN_AREA].some((key) => current === p.getAttribute(key));
    const stranglewoodExit = current && (current === p.getAttribute(ATTR_STRANGLEWOOD_HIDEOUT) ? [1193, 3405]
      : current === p.getAttribute(ATTR_STRANGLEWOOD_TEMPLE) ? [1174, 3427]
        : current === p.getAttribute(ATTR_VARDORVIS_AREA) ? [1117, 3429] : null);
    if (current && current === p.getAttribute(ATTR_STRANGLEWOOD_HIDEOUT) && current.defended) p.setAttribute(VARDORVIS_PROGRESS, 9);
    const owned = spawned.get(p);
    if (owned?.prescott) api.removeNpc(owned.prescott);
    if (owned?.lassarKetla) api.removeNpc(owned.lassarKetla);
    for (const key of [ATTR_VAULT_AREA, FINAL_ROOM, ATTR_WAR_ROOM, ATTR_STRANGLEWOOD_HIDEOUT, ATTR_STRANGLEWOOD_TEMPLE, ATTR_VARDORVIS_AREA, ATTR_SCAR_AREA, ATTR_SCAR_MAZE_ONE, ATTR_SCAR_MAZE_TWO, ATTR_SCAR_MAZE_THREE, ATTR_LEVIATHAN_AREA, SUCELLUS_AREA]) {
      const area = p.getAttribute(key);
      if (area && !area.isDestroyed?.()) {
        area.leave?.(p, false);
        area.postLeave?.(p, false);
        area.destroy?.();
      }
      p.setAttribute(key, null);
    }
    if (returnToVaultEntrance) p.moveTo(new api.core.Location(3510, 2971, 0));
    else if (returnToDigsite) p.moveTo(new api.core.Location(3411, 9813, 0));
    else if (returnToPrison) p.moveTo(new api.core.Location(2927, 10353, 0));
    else if (returnToGuardian) p.moveTo(new api.core.Location(3610, 9473, 0));
    else if (stranglewoodExit) p.moveTo(new api.core.Location(...stranglewoodExit, 0));
    p.setAttribute(SCAR_PATH_COMPLETE, p.getAttribute(SCAR_TETHER_DESTROYED) === true);
    p.setAttribute(SCAR_RIFT_LIVE, false);
    p.setAttribute(SCAR_GROWTH_LIVE, false);
    p.setAttribute(ATTR, null);
    p.setAttribute(PUZZLE_OPEN, false);
    const kasonde = spawned.get(p)?.kasonde;
    if (kasonde) api.removeNpc(kasonde);
    ruinsStarted.delete(p);
    spawned.delete(p);
  }

  function buildJournal(player) {
    const s = quest.getStage(player);
    if (s >= S.COMPLETE) return ["<str>I found the Elder Horn and stopped Sliske.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (s >= S.FINALE) {
      if (player.getAttribute(FINAL_WIGHTS_COMPLETE)) return ["Speak to Azzanadra as Sliske's plan concludes."];
      if (player.getAttribute(FINAL_WIGHTS_STARTED)) return [`Defeat Sliske's four wights (${Math.min(4, (Number(player.getAttribute(FINAL_WIGHT_INDEX)) || 0) + 1)}/4).`];
      if (player.getAttribute("desert-treasure-ii:final-cutscene-started")) return ["Descend into the vault and stop Sliske taking the Elder Horn."];
      return ["Return to the Ancient Vault and speak to Asgarnia Smith."];
    }
    if (s === S.WHISPERER && player.getAttribute(FINAL_FIGURE_DEFEATED)) return ["Return the Whisperer's medallion to the Ancient Vault."];
    if (s === S.WHISPERER && player.getAttribute(FINAL_CELL_ACTIVE)) {
      if (!has(player, I.HAIR_CLIP_3)) return ["Search the bed in the temple prison cell for a hair clip."];
      if (!player.getAttribute(FINAL_CELL_OPEN)) return ["Use the hair clip to pick the cell lock, then work out its four-number combination."];
      if (!player.getAttribute(FINAL_CELL_CHEST)) return ["Escape the cell and search the chest in the eastern room for your equipment."];
      if (!player.getAttribute(FINAL_FIGURE_DEFEATED)) return ["Inspect the altar in the western room and defeat the Mysterious Figure to recover the last medallion."];
      return ["Return the Whisperer's medallion to the Ancient Vault."];
    }
    if (s === S.WHISPERER) {
      const lassar = player.getAttribute(LASSAR) ?? {};
      if (!lassar.ramarno) return ["In Camdozaal, ask Ramarno whether he has seen the archaeologists investigating Lassar."];
      if (!has(player, I.VERY_LONG_ROPE) && !lassar.ropeTied && !lassar.entered) return ["Speak to Prescott in Camdozaal about the Lassar sinkhole and take his very long rope."];
      if (!lassar.ropeTied) return ["Tie Prescott's very long rope to the rock beside the sinkhole in Camdozaal."];
      if (!lassar.entered) return ["Descend into the Lassar Undercity through the sinkhole."];
      const portals = lassar.teleporters ?? [];
      if (portals.filter(Boolean).length < 3) return [`Activate the first three Lassar teleporters (${portals.filter(Boolean).length}/3).`];
      if (!lassar.blockerSchematic) return ["Search the Science District for the shadow blocker schematic."];
      if (!lassar.greenKey || !lassar.purpleKey) return ["Search the northern and southern Science District rooms for the green and purple shadow keys."];
      if (portals.filter(Boolean).length < 6) return [`Activate the remaining Science and Residential teleporters (${portals.filter(Boolean).length}/6).`];
      if (!lassar.blackstone) return ["Show Ketla the Ring of visibility so she can make the blackstone fragment safe to use."];
      if (!lassar.blockerDesigned) return ["Give Ketla the shadow blocker schematic, then take the finished device from her workbench."];
      if (!lassar.blockerPlaced) return ["Place the shadow blocker beside the locked doors in the Science District furnace house."];
      if (!lassar.doorUnlocked) return ["Enter the shadow realm with the blackstone fragment, stay near the blocker, and unlock the furnace-house door with the purple key."];
      if (!lassar.basicTorch) return ["Take the basic shadow torch schematic beyond the locked furnace-house door and have Ketla build the torch."];
      if (!lassar.tentacles?.["2417,6413"]) return ["Burn the western residential tentacles with the basic shadow torch, using the blocker to stay safe from lost souls."];
      if (!lassar.idolPlaced) return ["Find the revitalising idol schematic in the newly opened house, have Ketla build the idol, and place it beside the eastern teleporter."];
      if (!lassar.tentacles?.["2424,6439"]) return ["Activate the eastern teleporter, return through the shadow puddle, and burn the tentacle barrier to reach the blue key."];
      if (!lassar.superiorTorch) return ["Use the blue key and blocker to open the pub in the shadow realm, then take its superior torch schematic to Ketla."];
      if (!lassar.animaPortal) return ["Use the superior torch to clear the deeper Science District tentacles, then have Ketla build an anima portal from the schematic."];
      if (!lassar.plazaTentacle) return ["Use the superior torch to clear the plaza tentacles, then search the opened house for the white shadow key."];
      if (!lassar.whiteKey) return ["Search the opened western palace house for the white shadow key."];
      if (!lassar.whiteBlockerPlaced || !lassar.whiteAnimaPlaced || !lassar.whiteIdolPlaced) return ["Place the shadow blocker, anima portal and revitalising idol at the marked palace chest tiles."];
      if (!lassar.braziersComplete) return [`Enter the Shadow Realm and light the four braziers around the palace chest (${Object.keys(lassar.braziers ?? {}).length}/4). Use the idol to restore sanity.`];
      if (!lassar.perfectSchematicGiven) return ["Take the marked perfected-torch schematic from the palace chest and show it to Ketla."];
      if (!lassar.pubRemnant) return ["Enter the shadow pub upstairs and touch the remnant to learn where the Silent Choir gathers."];
      if (!lassar.redKeyUsed) return ["Clear the southern and western residential tentacles, take the red key, and open the square-room chest with a blocker beside it."];
      if (!lassar.greenKeyUsed) return ["In the southern Science District, burn the small-house tentacles and use the green key on its chest for the second icon segment."];
      if (!lassar.strangeIcon) return ["Combine the two icon segments into Prescott's strange icon."];
      if (!lassar.iconPresented) return ["Show Ketla the strange icon before entering the cistern drain."];
      if (!lassar.escapedVision) return ["Enter the Residential District drain, pass its icon-marked gate, descend the ladder and inspect the ancient pillar."];
      if (!lassar.perfectTorch) return ["Take the perfected shadow torch from Ketla's workbench."];
      if (!lassar.cathedralTentacles) return ["Enter the Shadow Realm and burn away the Sunken Cathedral tentacles with the perfected torch."];
      if (!lassar.whispererDefeated) return ["Disturb the Odd Figure in the Sunken Cathedral and defeat the Whisperer."];
      if (!lassar.medallion && !has(player, I.WHISPERERS_MEDALLION)) return ["Search the Whisperer's remains for her medallion."];
      return ["Return the Whisperer's medallion to the Ancient Vault."];
    }
    if (s >= S.WHISPERER) return ["Search the Lassar Undercity and defeat the Whisperer."];
    if (s >= S.SUCELLUS) {
      if (player.getAttribute(SUCELLUS_DEFEATED)) {
        if (!has(player, I.ODD_KEY)) return ["Pick up the odd key from Duke Sucellus, unlock the western door, and take his medallion from the chest."];
        if (!player.getAttribute(SUCELLUS_WEST_ROOM)) return ["Use the odd key on the western door and search the chest beyond it."];
        return ["Open the chest in the western room for Sucellus' medallion."];
      }
      if (!player.getAttribute(SUCELLUS_CELL_ESCAPED)) {
        if (!player.getAttribute(SUCELLUS_CELL_ENTERED)) return ["Enter the heavy door beneath Weiss, convince Captain Malleta, then walk deeper into Ghorrock Prison."];
        const cellProgress = Number(player.getAttribute(SUCELLUS_CELL_PROGRESS)) || 0;
        return [["Inspect the wall to speak to the prisoner in the next cell."], ["Search the skeleton for a letter."], ["Read the prisoner's letter."], ["Search the latrine bucket for a knife."], ["Pass the knife through the hole in the wall."], ["Search the bed with the chisel for a lockpick."], ["Pass the lockpick through the hole to escape."]][cellProgress] ?? ["Speak to the Assassin outside the cell."];
      }
      if (!player.getAttribute(SUCELLUS_PRISON_COMPLETE)) {
        const journal = { player, lines: [] };
        api.emitCustomEvent("dt2:sucellus-prison-journal", journal);
        return journal.lines.length ? journal.lines : ["Finish the Assassin's conversation, then explore Ghorrock Prison for the keys to your equipment."];
      }
      if (!player.getAttribute(SUCELLUS_AREA)) return ["Return to Ghorrock Prison beneath Weiss."];
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
    if (s === S.VARDORVIS) {
      const progress = Number(player.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (progress >= 22) return ["Return Vardorvis' medallion to its statue in the Ancient Vault."];
      if (progress === 21) return ["Cross the barricade into Kasonde's hideout and search the north-east stone chest for Vardorvis' medallion."];
      if (progress === 20) return ["Speak to the defeated Kasonde in the Stranglewood temple."];
      if (progress === 19) return ["Defeat Kasonde in the temple. Dodge his potions and hide behind pillars when he charges an explosion."];
      if (progress === 18) return ["Take the Temple key back to Kasonde in the Stranglewood temple."];
      if (progress === 17) return ["Take the Temple key dropped by Vardorvis and leave the ritual site through the rocks."];
      if (progress === 16) return ["Climb over the rocks into Vardorvis' ritual site and defeat him."];
      return ["Follow Kasonde's trail and defeat Vardorvis."];
    }
    if (s >= S.MACHINE) return ["Use the golem to learn the forgotten four's names."];
    if (s >= S.GUARDIAN) return ["Search the military installation beneath the Digsite."];
    if (s >= S.ROCKS) return ["Mine through the rocks and defeat the Ancient Guardian."];
    if (s >= S.DIG) return ["Find Dr Banikan at the Digsite excavation."];
    if (s >= S.VAULT) return ["Speak to Asgarnia Smith about the statues and plaque."];
    if (s >= S.STARTED) return ["Inspect the four statues and plaque in the Ancient Vault."];
    return ["Investigate the Ancient Vault north-east of Nardah."];
  }

  const stage = (p) => quest.getStage(p);
  function setLassar(p, state) {
    if (state.entered && !Number.isFinite(Number(state.sanity))) state = { ...state, sanity: 100 };
    p.setAttribute(LASSAR, state);
    const sender = p.getPacketSender?.();
    if (!sender?.sendVarbit) return;
    const progress = state.medallion ? 46 : state.whispererDefeated ? 44 : state.cathedralEntered ? 42
      : state.perfectTorch ? 40 : state.escapedVision ? 38 : state.iconUsed ? 36 : state.pubRemnant ? 32
      : state.silentChoir ? 30 : state.perfectSchematicGiven ? 28 : state.fakeSchematicFound || state.perfectTorchSchematic ? 26
          : state.animaSchematic || state.animaSchematicFound ? 24 : state.superiorTorchSchematic || state.superiorSchematicFound ? 22
            : state.torchSchematic || state.torchSchematicFound ? 20 : state.blockerDesigned ? 18
              : state.blackstone ? 14 : state.ringShown ? 12 : state.cameTo ? 10 : state.entered ? 8
                : state.ropeTied ? 6 : state.rope ? 4 : state.ramarno ? 2 : 0;
    sender.sendVarbit(15126, progress);
    LASSAR_TELEPORTER_VARBITS.forEach((varbit, index) => sender.sendVarbit(varbit, state.teleporters?.[index] ? 1 : 0));
    LASSAR_SCHEMATIC_VARBITS.forEach(([key, varbit]) => sender.sendVarbit(varbit, state[key] ? 1 : 0));
    sender.sendVarbit(15162, state.inShadow ? 1 : 0);
    sender.sendVarbit(15064, Math.max(0, Math.min(100, Number(state.sanity ?? (state.entered ? 100 : 0)) || 0)));
  }
  function handleLassarProcess({ player: p }) {
    if (p && stage(p) > 0) syncNativeProgress(p);
    if (!p || p.isPlayerBot?.() === true || stage(p) !== S.WHISPERER) return;
    const lassarState = p.getAttribute(LASSAR) ?? {};
    ensureLassarIntroItems(p, lassarState);
    const position = p.getLocation?.();
    if (lassarState.cameTo && position
      && Math.abs(position.getX?.() - 2648) <= 16 && Math.abs(position.getY?.() - 6442) <= 16
      && (position.getZ?.() ?? 0) === 0) ensureLassarKetla(p);
    if (!lassarState.cameTo && (lassarState.teleporters ?? []).slice(0, 6).length === 6
      && lassarState.teleporters.slice(0, 6).every(Boolean)
      && position?.getX?.() === 2656 && position?.getY?.() === 6386 && position?.getZ?.() === 0) {
      setLassar(p, { ...lassarState, cameTo: true });
      p.moveTo(new api.core.Location(2648, 6442, 0));
      talk(p, N.KETLA, "the-whisperer-talking-to-ketla-after-coming-to");
      return;
    }
    if (!spawned.get(p)?.whisperer && lassarState.whispererStarted && !lassarState.whispererDefeated) {
      if (spawnBoss(p, "whisperer")) p.sendMessage("The Whisperer returns to the cathedral.");
    }
    const boss = spawned.get(p)?.whisperer;
    if (boss?.isRegistered?.() && boss.getHitpoints?.() > 0) {
      boss.getCombat?.()?.getLastAttack?.()?.reset?.();
      if (!boss.__dt2WhispererEnraged && boss.getHitpoints() <= 440 && !boss.__dt2WhispererSpecialStarted) {
        boss.__dt2WhispererSpecialStarted = true;
        // The quest encounter selects one of its three shadow-realm specials.
        // Keeping the choice stable for a character also makes a failed attempt
        // recoverable without silently changing the mechanic on re-entry.
        const username = String(p.getUsername?.() ?? "");
        const variant = [...username].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) | 0, 0);
        const special = ["soul-siphon", "corrupted-seeds", "screech"][(((variant + 1) % 3) + 3) % 3];
        if (special === "soul-siphon") startWhispererSoulSiphon(p, boss);
        else if (special === "corrupted-seeds") startWhispererSeeds(p, boss);
        else startWhispererScreech(p, boss);
      }
      if (boss.__dt2WhispererSpecial === "soul-siphon" && lassarState.inShadow) {
        boss.__dt2WhispererSpecialTicks--;
        if (boss.__dt2WhispererSpecialTicks <= 0) {
          boss.__dt2WhispererSpecial = null;
          boss.__dt2WhispererBindingTicks = 5;
          removeWhispererSouls(p);
          boss.setHitpoints?.(Math.min(boss.getMaxHitpoints?.() ?? 660, boss.getHitpoints() + 75));
          p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(30, api.core.HitMask.RED)]);
          const current = p.getAttribute(LASSAR) ?? {};
          setLassar(p, { ...current, sanity: Math.max(0, Number(current.sanity ?? 100) - 30) });
          p.sendMessage("The Whisperer siphons the remaining souls, heals 75 hitpoints and blasts you for 30 damage, draining 30% sanity.");
        }
      } else if (boss.__dt2WhispererSpecial === "corrupted-seeds") {
        processWhispererSeeds(p, boss);
      } else if (boss.__dt2WhispererSpecial === "screech") {
        processWhispererScreech(p, boss);
      }
      if (Number(boss.__dt2WhispererBindingTicks) > 0) {
        boss.__dt2WhispererBindingTicks--;
        if (boss.__dt2WhispererBindingTicks === 0) {
          const location = p.getLocation?.();
          const px = (location?.getX?.() ?? location?.x) - (lassarState.inShadow ? 256 : 0);
          const py = location?.getY?.() ?? location?.y;
          const distance = Math.max(Math.abs(px - 2656), Math.abs(py - 6370));
          if (Number.isFinite(distance) && distance <= 10) {
            p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(20, api.core.HitMask.RED)]);
            p.sendMessage("The Whisperer's binding blow catches you as she closes in.");
          } else p.sendMessage("You outrun the Whisperer's binding blow.");
          boss.__dt2WhispererBindingTicks = -1;
        }
      }
    }
    const state = p.getAttribute(LASSAR);
    if (!state?.entered) return;
    const sanity = Math.max(0, Math.min(100, Number(state.sanity ?? 100)));
    const here = p.getLocation?.();
    const px = here?.getX?.() ?? here?.x;
    const py = here?.getY?.() ?? here?.y;
    const protectedByBlocker = state.inShadow && state.blockerPlaced
      && px != null && py != null && Math.max(Math.abs(px - 2350), Math.abs(py - 6360)) <= 1;
    const nextSanity = state.inShadow && !protectedByBlocker
      ? Math.max(0, sanity - 1)
      : Math.min(100, sanity + (state.inShadow ? 0 : 10));
    if (nextSanity === sanity) {
      if (state.inShadow && sanity === 0) {
        p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(2, api.core.HitMask.RED)]);
      }
      return;
    }
    setLassar(p, { ...state, sanity: nextSanity });
  }
  const setStage = (p, v) => { if (stage(p) < v) quest.setStage(p, v); };
  const has = (p, id) => p.getInventory().getAmount(id) > 0;
  function talk(p, npcId, variant, next) {
    startTranscript(api, p, npcId, PAGE, variant);
    if (next) setStage(p, next);
  }
  function talkSmith({ player: p, npcId }) {
    if (![S.STARTED, S.VAULT, S.FINALE].includes(stage(p))) return false;
    if (stage(p) === S.STARTED && !p.getAttribute(ATTR_SMITH_INTRO)) {
      p.setAttribute(ATTR_SMITH_INTRO, true);
      talk(p, npcId, "familiar-faces-talking-to-asgarnia-smith");
      return;
    }
    if (stage(p) === S.STARTED && (Number(p.getAttribute("desert-treasure-ii:statues")) & 31) !== 31) {
      return p.sendMessage("Asgarnia Smith asked you to inspect the four statues and plaque in the vault.");
    }
    if (stage(p) === S.FINALE && p.getAttribute("desert-treasure-ii:final-cutscene-started")
      && !p.getAttribute(FINAL_WIGHTS_COMPLETE)) {
      enterFinalRoom(p);
      p.setAttribute(FINAL_WIGHT_INDEX, 0);
      p.setAttribute(FINAL_WIGHTS_STARTED, true);
      spawnFinalWight(p, 0);
      return;
    }
    if (stage(p) === S.FINALE && !p.getAttribute("desert-treasure-ii:final-cutscene-started")) {
      p.setAttribute("desert-treasure-ii:final-cutscene-started", true);
      talk(p, npcId, "the-desert-treasure-disputes-of-the-mahjarrat");
      return;
    }
    const variant = stage(p) < S.VAULT ? "familiar-faces-talking-to-asgarnia-smith-after-inspecting-the-vault"
      : stage(p) < S.DIG ? "familiar-faces-talking-to-asgarnia-smith-after-inspecting-the-vault"
        : stage(p) < S.MACHINE ? "familiar-faces-talking-to-dr-banikan-after-clearing-rocks"
          : "familiar-faces-speaking-to-dr-banikan-again-after-he-decides-search-the-golem";
    talk(p, npcId, variant, stage(p) === S.STARTED ? S.VAULT : undefined);
  }
  function talkTerry({ player: p, npcId }) {
    if (stage(p) !== S.VAULT) return false;
    talk(p, npcId, "familiar-faces-talking-to-terry-balando", S.DIG);
  }
  function talkBanikan({ player: p, npcId }) {
    if (stage(p) < S.DIG || stage(p) >= S.VARDORVIS || npcId !== N.DR_BANIKAN) return false;
    if (stage(p) < S.ROCKS) return talk(p, npcId, "familiar-faces-talking-to-dr-banikan", S.ROCKS);
    if (stage(p) === S.ROCKS) return talk(p, npcId, "familiar-faces-talking-to-dr-banikan");
    if (stage(p) === S.GUARDIAN) return p.sendMessage("Defeat the Ancient Guardian in the military installation first.");
    if (!p.getAttribute(BANIKAN_BRIEFED)) {
      p.setAttribute(BANIKAN_BRIEFED, true);
      return talk(p, npcId, "familiar-faces-entering-the-military-installation");
    }
    if (!p.getAttribute(GOLEM_SOLVED)) return talk(p, npcId, "familiar-faces-talking-to-dr-banikan-before-powering-up-the-golem-machine");
    if ((Number(p.getAttribute(SEARCHED_NAMES)) || 0) !== 15) {
      return talk(p, npcId, "familiar-faces-powering-up-the-golem-machine-talking-to-dr-banikan-before-finishing-searching-for-all-of-the-names");
    }
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
    p.setAttribute(PUZZLE_OPEN, true);
    p.getPacketSender().sendInterface(PUZZLE_GROUP);
  }
  function wrongGolemSolution(p) {
    p.sendMessage("The machine crackles and shocks you. The cell arrangement is incorrect.");
    const damage = 5 + Math.floor(Math.random() * 6);
    p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(damage, api.core.HitMask.RED)]);
  }
  function onWidgetAction(event) {
    const p = event?.player, packet = event?.packet;
    const ritual = p?.getAttribute(ATTR_VARDORVIS_AREA);
    if (packet?.type === "widget_action" && packet.groupId === VARDORVIS_QTE_GROUP && ritual?.spores
      && p.getPrivateArea?.() === ritual && ritual.spores.has(packet.childId)) {
      event.handled = true;
      ritual.spores.delete(packet.childId);
      p.getPacketSender().sendInterfaceDisplayState((VARDORVIS_QTE_GROUP << 16) | packet.childId, true);
      if (ritual.spores.size === 0) { endVardorvisStrangle(ritual, p); p.sendMessage("You destroy the spores and break free of the tendrils."); }
      return;
    }
    const area = p?.getAttribute(ATTR_WAR_ROOM);
    if (!packet || stage(p) < S.MACHINE || stage(p) >= S.VARDORVIS || !p.getAttribute(CELLS_INSERTED)
      || !p.getAttribute(PUZZLE_OPEN) || !area || area.isDestroyed?.() || p.getPrivateArea?.() !== area) return;
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
    p.setAttribute(PUZZLE_OPEN, false);
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
    p.setAttribute(SEARCHED_NAMES, searched | bit);
    // shortcut: archive reports use golem dialogue until the cache's data interface is mapped.
    const variant = `familiar-faces-powering-up-the-golem-machine-${term === "whisperer" ? "the-whisperer-true-name-classified" : term}`;
    talk(p, N.GOLEM_3, variant);
  }
  function resolveGolemSearchCondition({ player, text }) {
    if (stage(player) !== S.MACHINE) return null;
    if (!/^If (Vardorvis|Perseriya|Sucellus|The Whisperer) was (not )?the final term for which the player searched$/i.test(text)) return null;
    const finished = Number(player.getAttribute(SEARCHED_NAMES)) === 15;
    return /was not /i.test(text) ? !finished : finished;
  }
  function talkElissa({ player: p, npcId }) {
    if (stage(p) !== S.VARDORVIS) return false;
    if (Number(p.getAttribute(VARDORVIS_PROGRESS)) > 0) return talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa-again");
    talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-elissa");
  }
  function talkBarus({ player: p, npcId }) {
    if (stage(p) !== S.VARDORVIS) return false;
    const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
    if (progress === 0) return p.sendMessage("Speak to Elissa at the Digsite about Vardorvis first.");
    if (progress > 1) return talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-barus-talking-to-barus-again");
    talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-barus");
  }
  function talkKasonde({ player: p, npcId }) {
    if (stage(p) !== S.VARDORVIS) return false;
    const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
    const hideout = p.getAttribute(ATTR_STRANGLEWOOD_HIDEOUT);
    if (hideout) {
      if (hideout.defended) return talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-holding-back-the-horde");
      return p.sendMessage("Keep the Strangled away from Kasonde until the horde is held back.");
    }
    if (progress === 6) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde");
      return;
    }
    if (progress === 7 || progress === 8) return talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-talking-to-kasonde-again");
    if (progress === 9) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-back-on-the-surface");
      return;
    }
    if (progress === 10 || progress === 11) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-back-on-the-surface-talking-to-kasonde-again-before-retrieving-the-ingredients");
      return;
    }
    if (progress === 13 || progress === 14) {
      const carried = [I.UNFINISHED_SERUM, I.UNFINISHED_SERUM_2, I.STRANGLER_SERUM].some(id => has(p, id));
      if (progress === 14 && carried) return p.sendMessage("Mix the Korbal herb into the unfinished serum, then add the Argian berries.");
      if (!carried && p.getInventory().getFreeSlots() < 1) return p.sendMessage("You need inventory space for Kasonde's unfinished serum.");
      return talk(p, npcId, progress === 13
        ? "carnifex-maximus-vardorvis-talking-to-kasonde-after-killing-the-strangled-in-the-temple"
        : "carnifex-maximus-vardorvis-talking-to-kasonde-after-killing-the-strangled-in-the-temple-reclaiming-the-unfinished-serum");
    }
    if (progress === 15) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-killing-the-strangled-in-the-temple-talking-to-kasonde-after-making-the-potion");
      return;
    }
    if (progress === 16) talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-killing-the-strangled-in-the-temple-talking-to-kasonde-after-drinking-the-potion");
    if (progress === 18) return talk(p, npcId, "carnifex-maximus-vardorvis-entering-the-temple-after-defeating-vardorvis");
    if (progress === 20) {
      talk(p, npcId, "carnifex-maximus-vardorvis-talking-to-kasonde-after-defeating-him");
    }
  }
  function handleItemAction(event) {
    const { player: p, itemId, option } = event;
    const action = String(option || "").toLowerCase();
    if (itemId === I.ANCIENT_LAMP && action === "rub") {
      if (!quest.isComplete(p)) return false;
      const { item, slot } = event;
      const inventory = p.getInventory();
      if (!item || inventory.get(slot) !== item) return true;
      const skills = [Skill.ATTACK, Skill.STRENGTH, Skill.DEFENCE, Skill.HITPOINTS, Skill.RANGED, Skill.MAGIC, Skill.PRAYER];
      api.emitCustomEvent("xpreward:open", {
        player: p, minLevel: 60, skills,
        onConfirm: (skill, name) => {
          if (inventory.get(slot) !== item || !skills.includes(skill)) return null;
          const manager = p.getSkillManager();
          if (manager.getMaxLevel(skill) < 60) return null;
          const before = manager.getExperience(skill);
          manager.addExperience(skill, 100000, false);
          if (manager.getExperience(skill) === before) return null;
          inventory.deleteAtSlot(slot, 1);
          return `You have been awarded 100,000 ${name} XP!`;
        },
      });
      return true;
    }
    if (stage(p) === S.WHISPERER && [I.BLACKSTONE_FRAGMENT, I.BLACKSTONE_FRAGMENT_2, I.BLACKSTONE_FRAGMENT_3].includes(itemId)
      && (action === "activate" || action === "use") && has(p, itemId)) {
      const state = p.getAttribute(LASSAR) ?? {};
      const location = p.getLocation?.();
      const x = location?.getX?.() ?? location?.x;
      const y = location?.getY?.() ?? location?.y;
      const z = location?.getZ?.() ?? location?.z ?? 0;
      const whisperer = spawned.get(p)?.whisperer;
      if (whisperer?.__dt2WhispererSpecial === "soul-siphon") {
        if (state.inShadow) {
          p.sendMessage("The Whisperer still siphons souls. Kill all three Lost Souls chanting the same phrase before leaving the Shadow Realm.");
        } else {
          p.moveTo(new api.core.Location(x - 256, y, z));
          setLassar(p, { ...state, inShadow: true });
          p.sendMessage("The blackstone fragment draws you into the cathedral's Shadow Realm. Kill a complete set of chanting souls.");
        }
        event.handled = true;
        return true;
      }
      if (whisperer?.__dt2WhispererSpecial && !state.inShadow) {
        p.moveTo(new api.core.Location(x - 256, y, z));
        setLassar(p, { ...state, inShadow: true });
        showWhispererSpecial(p, whisperer);
        p.sendMessage("The blackstone fragment draws you into the cathedral's Shadow Realm. Face the Whisperer's special attack.");
        event.handled = true;
        return true;
      }
      if (!state.inShadow) { p.sendMessage("The blackstone fragment is quiet in the material world."); event.handled = true; return true; }
      p.moveTo(new api.core.Location(x + 256, y, z));
      setLassar(p, { ...state, inShadow: false });
      p.sendMessage("The blackstone fragment pulls you out of the shadow realm.");
      event.handled = true;
      return true;
    }
    if (stage(p) === S.WHISPERER && [I.BLACKSTONE_FRAGMENT, I.BLACKSTONE_FRAGMENT_2, I.BLACKSTONE_FRAGMENT_3].includes(itemId)
      && action === "recall" && has(p, itemId)) {
      const state = p.getAttribute(LASSAR) ?? {};
      const next = { ...state };
      let recalled = 0;
      const devices = [
        ["blockerPlaced", I.SHADOW_BLOCKER], ["pubBlocker", I.SHADOW_BLOCKER], ["redBlockerPlaced", I.SHADOW_BLOCKER],
        ["whiteBlockerPlaced", I.SHADOW_BLOCKER], ["whiteAnimaPlaced", I.ANIMA_PORTAL],
        ["whiteIdolPlaced", I.REVITALISING_IDOL], ["idolPlaced", I.REVITALISING_IDOL],
      ];
      for (const [key, id] of devices) {
        if (!state[key]) continue;
        if (!has(p, id)) p.getInventory().adds(id, 1);
        next[key] = false;
        recalled++;
      }
      if (recalled) {
        setLassar(p, next);
        p.sendMessage(`The blackstone fragment recalls ${recalled} placed shadow device${recalled === 1 ? "" : "s"}.`);
      } else p.sendMessage("The blackstone fragment has no placed device to recall here.");
      event.handled = true;
      return true;
    }
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
      event.handled = true;
      return true;
    }
    if (itemId === KASONDE_POTION && action === "drink") {
      const progress = Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0;
      if (progress < 4) {
        talk(p, N.GOLEM_3, "carnifex-maximus-vardorvis-attempting-to-drink-the-potion-before-reading-the-note");
        event.handled = true;
        return true;
      }
      if (progress === 4 && has(p, KASONDE_POTION)) {
        p.getInventory().deleteNumber(KASONDE_POTION, 1);
        p.setAttribute(VARDORVIS_PROGRESS, 5);
        p.sendMessage("You drink the strange potion. Its effects prepare you to enter the Stranglewood.");
        event.handled = true;
        return true;
      }
    }
    if (itemId === I.STRANGLER_SERUM && action === "drink") {
      event.handled = true;
      if (!has(p, I.STRANGLER_SERUM) || (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) < 15
        || !p.getAttribute(SERUM_DISCUSSED)) return p.sendMessage("Talk to Kasonde about the completed serum before drinking it.");
      p.getInventory().deleteNumber(I.STRANGLER_SERUM, 1);
      p.setAttribute(VARDORVIS_PROGRESS, 16);
      p.sendMessage("You drink the Strangler serum. It lets you approach the ritual site.");
      return true;
    }
    return false;
  }
  function handleItemOnItem(event) {
    const { player: p, usedItemId: itemId1, usedWithItemId: itemId2 } = event;
    if (stage(p) === S.WHISPERER) {
      const pair = new Set([itemId1, itemId2]);
      if (pair.has(I.ICON_SEGMENT) && pair.has(I.ICON_SEGMENT_2)
        && has(p, I.ICON_SEGMENT) && has(p, I.ICON_SEGMENT_2)) {
        p.getInventory().deleteNumber(I.ICON_SEGMENT, 1);
        p.getInventory().deleteNumber(I.ICON_SEGMENT_2, 1);
        p.getInventory().adds(I.STRANGE_ICON, 1);
        setLassar(p, { ...(p.getAttribute(LASSAR) ?? {}), strangeIcon: true });
        p.sendMessage("You fit the two icon segments together into Prescott's strange icon.");
        event.handled = true;
        return true;
      }
    }
    if (stage(p) === S.SUCELLUS && has(p, I.PESTLE_AND_MORTAR)) {
      const pair = new Set([itemId1, itemId2]);
      const powder = pair.has(I.MUSCA_MUSHROOM) ? I.MUSCA_POWDER
        : pair.has(I.ARDER_MUSHROOM) ? I.ARDER_POWDER : null;
      const mushroom = pair.has(I.MUSCA_MUSHROOM) || pair.has(I.ARDER_MUSHROOM);
      if (powder && mushroom) {
        const raw = pair.has(I.MUSCA_MUSHROOM) ? I.MUSCA_MUSHROOM : I.ARDER_MUSHROOM;
        if (!has(p, raw)) return false;
        const herblore = p.getSkillManager?.().getCurrentLevel?.(Skill.HERBLORE) ?? 62;
        const quantity = Math.max(1, Math.min(6, Math.floor((herblore - 20) / 10)));
        p.getInventory().deleteNumber(raw, 1);
        p.getInventory().adds(powder, quantity);
        p.sendMessage(`You grind the ${powder === I.MUSCA_POWDER ? "Musca" : "Arder"} mushroom into ${quantity} powder.`);
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
  function handleObjectInteraction(event) {
    const handled = handleObject(event);
    if (handled === true) event.handled = true;
    return handled;
  }
  function handleObject(event) {
    const { player: p, objectId, definition, location } = event;
    const s = stage(p);
    const vaultTile = vaultSourceTile(p, location);
    const finalTile = finalRoomSourceTile(p, location);
    const roomTile = warRoomSourceTile(p, location);
    const scarTile = scarSourceTile(p, location);
    const scarMazeTile = scarMazeSourceTile(p, location);
    const scarMazeTwoTile = scarMazeTwoSourceTile(p, location);
    const scarMazeThreeTile = scarMazeThreeSourceTile(p, location);
    const leviathanTile = leviathanSourceTile(p, location);
    const sucellusTile = sucellusSourceTile(p, location);
    const visibleId = definition?.id ?? objectId;
    const option = String(event.option ?? "").toLowerCase();
    if (handleLassarObject(event, visibleId, option)) return true;
    if (s === S.WHISPERER && [47578, 47579, 49555, 49556].includes(visibleId)
      && p.getAttribute(LASSAR)?.whispererDefeated
      && (option === "search" || option === "take" || option === "inspect")) {
      const state = p.getAttribute(LASSAR) ?? {};
      if (!state.medallion && !has(p, I.WHISPERERS_MEDALLION)) p.getInventory().adds(I.WHISPERERS_MEDALLION, 1);
      setLassar(p, { ...state, medallion: true });
      p.sendMessage("You search the Whisperer's remains and recover her medallion.");
      return true;
    }
    if (s === S.WHISPERER && visibleId === 48310 && p.getAttribute(LASSAR)?.medallion
      && (option === "exit" || option === "climb" || option === "leave")) {
      p.moveTo(new api.core.Location(2587, 6436, 0));
      p.sendMessage("You leave the Sunken Cathedral with the Whisperer's medallion.");
      return true;
    }
    if ((s === S.FINALE || s === S.COMPLETE) && finalTile && visibleId === 48890 && finalTile.x === 3294 && finalTile.y === 6411 && option === "climb") {
      const finalRoom = p.getAttribute(FINAL_ROOM);
      finalRoom?.leave?.(p);
      finalRoom?.destroy?.();
      p.setAttribute(FINAL_ROOM, null);
      if (!p.getAttribute(FINAL_WIGHTS_COMPLETE)) p.setAttribute(FINAL_WIGHTS_STARTED, false);
      enterVault(p);
      p.sendMessage(p.getAttribute(FINAL_WIGHTS_COMPLETE)
        ? "You climb back into the Ancient Vault."
        : "You retreat from the chamber. Sliske's wight trial will restart when you return.");
      return true;
    }
    if (!vaultTile && location?.x === 3511 && Math.abs(location.y - 2970) <= 1
      && [O.VAULT_DOOR_2, O.VAULT_DOOR_3].includes(objectId)
      && s === S.WHISPERER && has(p, I.WHISPERERS_MEDALLION)
      && !p.getAttribute(FINAL_CELL_ACTIVE) && !p.getAttribute(FINAL_FIGURE_DEFEATED)) {
      p.setAttribute("desert-treasure-ii:final-cell-pending", true);
      talk(p, N.MYSTERIOUS_FIGURE_2, "the-desert-treasure-entering-the-ancient-vault-with-the-last-medallion");
      return true;
    }
    if (p.getAttribute(FINAL_CELL_ACTIVE) && location?.z === 0) {
      if (visibleId === 48777 && location.x === 3103 && location.y === 9246 && option === "search") {
        if (!has(p, I.HAIR_CLIP_3)) p.getInventory().adds(I.HAIR_CLIP_3, 1);
        p.sendMessage("You find a hair clip under the bed. It should be thin enough to pick the lock.");
        return true;
      }
      if (visibleId === 48774 && location.x === 3107 && location.y === 9248 && option === "open") {
        if (!has(p, I.HAIR_CLIP_3)) { p.sendMessage("The cell door is locked. A hair clip might pick it."); return true; }
        if (!p.getAttribute(FINAL_CELL_OPEN)) { startFinalCellLock(p); return true; }
        return false;
      }
      if (visibleId === 48771 && location.x === 3115 && location.y === 9263 && option === "search") {
        if (!p.getAttribute(FINAL_CELL_OPEN)) { p.sendMessage("The chest is beyond the locked cell door."); return true; }
        restoreFinalCellGear(p);
        p.setAttribute(FINAL_CELL_CHEST, true);
        p.sendMessage("You search the chest and recover your equipment. The Whisperer's medallion is missing.");
        return true;
      }
      if (location.x === 3086 && location.y === 9260 && option === "inspect"
        && p.getAttribute(FINAL_CELL_CHEST) && !p.getAttribute(FINAL_FIGURE_STARTED)) {
        p.setAttribute(FINAL_FIGURE_STARTED, true);
        talk(p, N.MYSTERIOUS_FIGURE_2, "the-desert-treasure-inspecting-the-altar-in-the-temple");
        return true;
      }
    }
    if (s === S.SUCELLUS) {
      const action = String(event.option ?? "").toLowerCase();
      const worldX = location?.x, worldY = location?.y, worldZ = location?.z ?? location?.getZ?.() ?? 0;
      if (!sucellusTile && objectId === 49513 && worldX === 2926 && worldY === 10354 && worldZ === 0) {
        if (!p.getAttribute(SUCELLUS_CAPTAIN_ACCEPTED)) {
          talk(p, N.CAPTAIN_MALLETA, "duke-sucellus-of-the-sixth-legion-talking-to-captain-malleta");
          return true;
        }
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
        if (!p.getAttribute(SUCELLUS_PRISON_COMPLETE)) {
          p.sendMessage("Work with the Assassin to reach the asylum first.");
          return true;
        }
        enterSucellusArea(p);
        p.sendMessage("You pass through the asylum gate into Duke Sucellus's chamber.");
        return true;
      }
      if (sucellusTile) {
        const cellProgress = Number(p.getAttribute(SUCELLUS_CELL_PROGRESS)) || 0;
        if (visibleId === SUCELLUS_BOSS_GATE && sucellusTile.x === 3039 && sucellusTile.y === 6433 && sucellusTile.z === 0) {
          if (!p.getAttribute(SUCELLUS_PRISON_COMPLETE)) {
            p.sendMessage("Work with the Assassin to reach the asylum first.");
            return true;
          }
          spawnBoss(p, "sucellus");
          return false;
        }
        if (visibleId === 49120 && sucellusTile.x === 2945 && sucellusTile.y === 6389 && sucellusTile.z === 2) {
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
          talk(p, N.ASSASSIN_7, "duke-sucellus-of-the-sixth-legion-inspecting-the-wall-in-the-prison-cell-searching-the-bucket");
          return true;
        }
        if (p.getAttribute(SUCELLUS_CELL_ENTERED) && objectId === 49514
          && sucellusTile.x === 3041 && sucellusTile.y === 6367 && cellProgress >= 5 && has(p, I.CHISEL_5)) {
          if (!has(p, I.LOCKPICK_4)) p.getInventory().adds(I.LOCKPICK_4, 1);
          p.getInventory().deleteNumber(I.CHISEL_5, 1);
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
        if ([O.PESTLE_AND_MORTAR, O.PESTLE_AND_MORTAR_2].includes(visibleId)) {
          if (!has(p, I.PESTLE_AND_MORTAR)) p.getInventory().adds(I.PESTLE_AND_MORTAR, 1);
          p.sendMessage("You take a pestle and mortar from the shelf.");
          return true;
        }
        if ([O.PICKAXE_2, O.PICKAXE_3].includes(visibleId)) {
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
        if ([O.SALT_DEPOSIT, O.SALT_DEPOSIT_2].includes(visibleId)) {
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
        p.moveTo(area.tile(36, 44, 0));
        p.sendMessage("You climb the handholds onto the northern ledge.");
        setScarVarbit(p, 42);
        return true;
      }
      if ([49529, 49210].includes(visibleId) && leviathanTile.x === 2096 && leviathanTile.y === 6382) {
        if (!p.getAttribute(SCAR_LEVIATHAN_KILLED)) { p.sendMessage("The stepping stone is out of reach while the Leviathan attacks."); return true; }
        p.setAttribute(SCAR_SHIP_REACHED, true);
        p.moveTo(p.getAttribute(ATTR_LEVIATHAN_AREA).tile(42, 46, 0));
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
        const maze = p.getAttribute(ATTR_SCAR_MAZE_TWO);
        if (maze instanceof ScarMazeTwoArea && !maze.isDestroyed()) {
          maze.leave(p, false);
          const scar = enterScar(p);
          p.moveTo(scar.tile(51, 43, 0));
          setScarVarbit(p, p.getAttribute(SCAR_BOAT2_BURNED) ? 28 : 24);
          p.sendMessage("You leave the middle passage and return to Persten's camp.");
        }
        return true;
      }
      if (objectId === O.PASSAGE_18 && scarMazeTwoTile.x === 1756 && scarMazeTwoTile.y === 6420) {
        const maze = p.getAttribute(ATTR_SCAR_MAZE_TWO);
        const sourceX = p.getLocation().getX() - maze.getBaseX() + 1696;
        p.moveTo(maze.tile(sourceX < 1756 ? 62 : 59, 20, 0));
        if (sourceX < 1756) return true;
        if (!p.getAttribute(SCAR_AXON_ROOM_COMPLETE)) {
          spawnScarAxons(p, maze);
          p.sendMessage("Guide the four abyssal axons into their matching elemental terminals by attacking them.");
        } else p.sendMessage("All four axons have reached their terminals.");
        return true;
      }
      if (objectId === O.NEURAL_TELEPORTER_2 && scarMazeTwoTile.x === 1730 && scarMazeTwoTile.y === 6434) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_TWO).tile(92, 18, 0));
        return true;
      }
      if (objectId === O.NEURAL_TELEPORTER && scarMazeTwoTile.x === 1789 && scarMazeTwoTile.y === 6417) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_TWO).tile(36, 35, 0));
        return true;
      }
      if (objectId === O.NEURAL_TELEPORTER_3 && scarMazeTwoTile.x === 1741 && scarMazeTwoTile.y === 6402) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_TWO).tile(36, 59, 0));
        return true;
      }
      if (objectId === O.NEURAL_TELEPORTER_4 && scarMazeTwoTile.x === 1730 && scarMazeTwoTile.y === 6458) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_TWO).tile(46, 3, 0));
        return true;
      }
      if (objectId === O.PASSAGE_19 && scarMazeTwoTile.x === 1783 && scarMazeTwoTile.y === 6441) {
        const maze = p.getAttribute(ATTR_SCAR_MAZE_TWO);
        const sourceY = p.getLocation().getY() - maze.getBaseY() + 6400;
        p.setAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE, false);
        p.moveTo(maze.tile(88, sourceY <= 6440 ? 44 : 40, 0));
        return true;
      }
      if (objectId === O.PASSAGE_19 && scarMazeTwoTile.x === 1782 && scarMazeTwoTile.y === 6420) {
        const maze = p.getAttribute(ATTR_SCAR_MAZE_TWO);
        const sourceY = p.getLocation().getY() - maze.getBaseY() + 6400;
        if (sourceY >= 6422) {
          p.setAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE, false);
          p.moveTo(maze.tile(86, 19, 0));
          return true;
        }
        if (!p.getAttribute(SCAR_AXON_ROOM_COMPLETE)) {
          p.sendMessage("The axon terminals are still inactive.");
          return true;
        }
        const equipment = p.getEquipment();
        if (equipment.isSlotOccupied(api.core.Equipment.WEAPON_SLOT) || equipment.isSlotOccupied(api.core.Equipment.SHIELD_SLOT)) {
          p.sendMessage("Free both hands before diving into the nerve chamber.");
          return true;
        }
        p.moveTo(maze.tile(86, 22, 0));
        if (p.getAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE)) return true;
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
        const maze = p.getAttribute(ATTR_SCAR_MAZE_TWO);
        const sourceY = p.getLocation().getY() - maze.getBaseY() + 6400;
        if (sourceY <= 6456) {
          p.moveTo(maze.tile(48, 60, 0));
          return true;
        }
        if (!p.getAttribute(SCAR_NERVE_ROOM_TWO_COMPLETE)) {
          p.sendMessage("The four broken nerve endings still need their matching combined nerves.");
          return true;
        }
        p.setAttribute(SCAR_NERVE_ROOM_TWO_ACTIVE, false);
        p.moveTo(maze.tile(48, 56, 0));
        if (p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE)) return true;
        p.getPacketSender().sendVarbit(15260, 0);
        spawnScarSummoningRoom(p, maze);
        p.sendMessage("Scarred imps shield the lesser demons with their prayers. Defeat the imps first, then the demons.");
        return true;
      }
      if ([O.PASSAGE_22, O.PASSAGE_23].includes(objectId) && scarMazeTwoTile.x === 1771 && scarMazeTwoTile.y === 6459) {
        if (!p.getAttribute(SCAR_SUMMON_ROOM_COMPLETE)) {
          p.sendMessage("The summoning circle still protects the shipwreck passage.");
          return true;
        }
        const maze = p.getAttribute(ATTR_SCAR_MAZE_TWO);
        const sourceX = p.getLocation().getX() - maze.getBaseX() + 1696;
        p.moveTo(maze.tile(sourceX >= 1773 ? 74 : 77, 59, 0));
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
          const key = `${nerve.object}:${scarMazeTwoTile.x}:${scarMazeTwoTile.y}`;
          event.handled = true;
          return collectScarNerve(p, nerve.item, SCAR_NERVE_ROOM_TWO_BROKEN, key);
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
      const maze = p.getAttribute(ATTR_SCAR_MAZE_ONE);
      const sourceX = p.getLocation().getX() - maze.getBaseX() + 2160;
      if (sourceX >= 2222) {
        p.moveTo(maze.tile(59, 3, 0));
        event.handled = true;
        return true;
      }
      p.moveTo(maze.tile(62, 3, 0));
      p.setAttribute(SCAR_BOAT_ROOM, true);
      p.sendMessage("You enter the shipwreck chamber beyond the restored Scar passage.");
      event.handled = true;
      return true;
    }
    if (s === S.LEVIATHAN && scarMazeTile?.x === 2237 && scarMazeTile.y === 6443
      && objectId === O.NEURAL_TELEPORTER) {
      p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(22, 25, 0));
      p.sendMessage("The blue neural teleporter carries you back to the western corridor.");
      return true;
    }
    if (s === S.LEVIATHAN && scarMazeTile?.x === 2177 && scarMazeTile.y === 6459
      && objectId === 49408) {
      const maze = p.getAttribute(ATTR_SCAR_MAZE_ONE);
      if (maze instanceof ScarMazeOneArea && !maze.isDestroyed()) {
        maze.leave(p, false);
        const passage = enterScar(p);
        p.moveTo(passage.tile(51, 43, 0));
        setScarVarbit(p, p.getAttribute(SCAR_BOAT_BURNED) ? 20 : 14);
        p.sendMessage("You leave the passage and return to Persten's camp.");
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
    if (s === S.LEVIATHAN && scarMazeTile && objectId === 49410
      && scarMazeTile.x === 2196 && scarMazeTile.y === 6454) {
      const maze = p.getAttribute(ATTR_SCAR_MAZE_ONE);
      const sourceY = p.getLocation().getY() - maze.getBaseY() + 6400;
      p.moveTo(maze.tile(36, sourceY >= 6456 ? 53 : 56, 0));
      event.handled = true;
      return true;
    }
    if (s === S.LEVIATHAN && scarMazeTile && p.getAttribute(SCAR_TETHER_DESTROYED)) {
      if (objectId === 49415 && scarMazeTile.x === 2233 && scarMazeTile.y === 6461) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(29, 12, 0));
        p.sendMessage("The green neural teleporter carries you toward the catalyst chamber.");
        return true;
      }
      if (objectId === 49411 && scarMazeTile.x === 2190 && scarMazeTile.y === 6412) {
        const maze = p.getAttribute(ATTR_SCAR_MAZE_ONE);
        const sourceX = p.getLocation().getX() - maze.getBaseX() + 2160;
        if (sourceX >= 2192) {
          p.moveTo(maze.tile(29, 12, 0));
          return true;
        }
        p.setAttribute(SCAR_RIFT_LIVE, true);
        scarCatalystOrder(p);
        p.moveTo(maze.tile(32, 12, 0));
        spawnScarCatalyst(p, maze);
        p.sendMessage("You enter the catalyst chamber. Break the nerve endings and combine them to match its rune.");
        inspectScarCatalyst({ player: p });
        return true;
      }
      if (objectId === 49414 && scarMazeTile.x === 2181 && scarMazeTile.y === 6424
        && (Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0) >= SCAR_CATALYST_RUNES.length) {
        p.moveTo(p.getAttribute(ATTR_SCAR_MAZE_ONE).tile(76, 44, 0));
        p.sendMessage("The blue neural teleporter carries you toward the damaged growth room.");
        return true;
      }
      if (objectId === 49412 && scarMazeTile.x === 2225 && scarMazeTile.y === 6421
        && (Number(p.getAttribute(SCAR_CATALYST_PROGRESS)) || 0) >= SCAR_CATALYST_RUNES.length) {
        const maze = p.getAttribute(ATTR_SCAR_MAZE_ONE);
        const sourceY = p.getLocation().getY() - maze.getBaseY() + 6400;
        if (sourceY >= 6423) {
          p.moveTo(maze.tile(66, 20, 0));
          return true;
        }
        p.setAttribute(SCAR_GROWTH_LIVE, true);
        p.moveTo(maze.tile(66, 23, 0));
        spawnScarLightLeeches(p, maze);
        p.sendMessage("Four damaged growths need illuminating lures. The light leeches carry them.");
        return true;
      }
      const nerve = SCAR_NERVE_LOCATIONS.find(({ object, tiles }) => object === visibleId
        && tiles.some(([x, y]) => x === scarMazeTile.x && y === scarMazeTile.y));
      if (nerve && p.getAttribute(SCAR_RIFT_LIVE)) {
        const tileKey = `${visibleId}:${scarMazeTile.x}:${scarMazeTile.y}`;
        event.handled = true;
        return collectScarNerve(p, nerve.item, SCAR_NERVES_BROKEN, tileKey);
      }
    }
    if (s === S.LEVIATHAN && scarMazeTile?.x === 2210 && scarMazeTile.y === 6433 && objectId === O.ABYSSAL_TETHER) {
      if (!p.getAttribute(SCAR_PATH_COMPLETE)) return p.sendMessage("Follow each pathfinder through the maze to reach the tether.");
      p.setAttribute(SCAR_TETHER_DESTROYED, true);
      p.getPacketSender().sendVarbit(15258, 1);
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
    if (s === S.LEVIATHAN && scarTile?.x === 2047 && scarTile.y === 6427
      && (definition?.id ?? objectId) === O.PASSAGE_15) {
      if (!p.getAttribute(SCAR_PERSTEN_ROOM1_TALKED)) {
        p.sendMessage("Speak to Persten about the first passage before entering the middle passage.");
        return true;
      }
      enterScarMazeTwo(p);
      return true;
    }
    if (s === S.LEVIATHAN && scarTile?.x === 2051 && scarTile.y === 6434
      && (definition?.id ?? objectId) === O.PASSAGE_16) {
      if (!p.getAttribute(SCAR_PERSTEN_ROOM2_TALKED)) return p.sendMessage("Speak to Persten about the second passage before entering the middle passage.");
      enterScarMazeThree(p);
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
      if (p.getSpellbook() !== MagicSpellbook.ANCIENT) {
        p.sendMessage("You need to be on the Ancient Magicks spellbook to investigate the vault.");
        return true;
      }
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
      // The first return with Vardorvis' medallion is interrupted by the
      // Mysterious Figure before the player enters the vault. Keep the
      // transcript's final action as the point where the vault scene resumes.
      if (s === S.VARDORVIS && has(p, I.VARDORVIS_MEDALLION)
        && !p.getAttribute(ATTR_FIRST_MEDALLION_MEETING)) {
        p.setAttribute(ATTR_FIRST_MEDALLION_MEETING, true);
        p.setAttribute("desert-treasure-ii:first-medallion-meeting-pending", true);
        talk(p, N.MYSTERIOUS_FIGURE_2, "carnifex-maximus-vardorvis-returning-the-first-medallion");
        return true;
      }
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
    if (vaultTile && ([O.VAULT_DOOR, O.VAULT_DOOR_2, O.VAULT_DOOR_3].includes(objectId)
      || (objectId === O.STEPS_23 && vaultTile.x === 3925 && vaultTile.y === 9630))) {
      leaveVault(p);
      return true;
    }
    if (objectId === O.WINCH_14 && location.x === 3384 && location.y === 3418 && location.z === 0 && option === "operate") {
      if (s < S.DIG) return false;
      p.moveTo(new api.core.Location(3404, 9804, 0));
      p.sendMessage("You descend the winch into the excavation.");
      return true;
    }
    if (objectId === O.CRATE_301 && location.x === 3414 && location.y === 9819 && location.z === 0 && option === "search") {
      if (s < S.DIG) return false;
      if (findBestPickaxe(p)) p.sendMessage("You already have a pickaxe you can use.");
      else if (p.getInventory().getFreeSlots() < 1) p.sendMessage("You need a free inventory slot for the pickaxe.");
      else {
        p.getInventory().adds(I.BRONZE_PICKAXE, 1);
        p.sendMessage("You take a bronze pickaxe from the crate.");
      }
      return true;
    }
    if (s === S.ROCKS && (visibleId === O.ROCKS_141 || objectId === DIGSITE_CREVICE_LOC)
      && location.x === 3411 && location.y === 9811 && location.z === 0 && option === "mine") {
      const pickaxe = findBestPickaxe(p);
      if (!pickaxe) {
        p.sendMessage("You need a pickaxe you can use to clear the rocks.");
        return true;
      }
      p.performAnimation?.(pickaxe.animation);
      p.sendMessage("You mine away the rocks and uncover a passage into the installation.");
      setStage(p, S.GUARDIAN);
      return true;
    }
    if (s === S.VARDORVIS && objectId === KASONDE_DESK_LOC
      && Math.abs(location.x - 1781) <= 2 && Math.abs(location.y - 3619) <= 2
      && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 2) {
      const progress = Number(p.getAttribute(VARDORVIS_PROGRESS));
      if (progress >= 5) return true;
      const missing = [KASONDE_NOTE, KASONDE_POTION].filter(id => !has(p, id));
      if (p.getInventory().getFreeSlots() < missing.length) {
        p.sendMessage("You need enough inventory space for the note and potion.");
        return true;
      }
      for (const id of missing) p.getInventory().adds(id, 1);
      if (progress === 2) p.setAttribute(VARDORVIS_PROGRESS, 3);
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
      if (progress < 6) p.setAttribute(VARDORVIS_PROGRESS, 6);
      p.moveTo(new api.core.Location(1196, 3450, 0));
      if (p.getAttribute(STRANGLEWOOD_CITY_ENTERED)) spawnSurfaceKasonde(p);
      return true;
    }
    if (s === S.VARDORVIS && [O.ENTRY_20, O.ENTRY_21].includes(objectId)
      && Math.abs(location.x - 1191) <= 2 && Math.abs(location.y - 3411) <= 2) {
      if ((Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) < 7) {
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
      if ((progress >= 13 && progress <= 16) || (progress === 18 && has(p, I.TEMPLE_KEY_3)) || progress >= 19) {
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
    if (templeTile && ([O.ENTRY_20, O.ENTRY_21, O.ENTRY_22, O.ENTRY_23].includes(objectId)
      || (objectId === O.STAIRS_254 && option === "climb-up"))) {
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
      if (option === "leave" || option === "climb-over") return leaveVardorvisArena(p);
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
      if (progress >= 17 && !has(p, I.TEMPLE_KEY_3)) {
        if (p.getInventory().getFreeSlots() < 1) return p.sendMessage("You need inventory space for the Temple key.");
        p.getInventory().adds(I.TEMPLE_KEY_3, 1);
        p.setAttribute(VARDORVIS_PROGRESS, Math.max(18, progress));
        p.sendMessage("You search the rocks and recover the Temple key.");
        return true;
      }
      enterVardorvisArena(p);
      return true;
    }
    if (s === S.VARDORVIS && objectId === KASONDE_MEDALLION_CHEST
      && Math.abs(location.x - 1196) <= 2 && Math.abs(location.y - 3411) <= 2
      && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 21) {
      if (!has(p, I.VARDORVIS_MEDALLION)) {
        if (p.getInventory().getFreeSlots() < 1) {
          p.sendMessage("You need inventory space for Vardorvis' medallion.");
          return true;
        }
        p.getInventory().adds(I.VARDORVIS_MEDALLION, 1);
      }
      p.setAttribute(VARDORVIS_PROGRESS, 22);
      p.sendMessage("You search Kasonde's chest and find Vardorvis' medallion.");
      return true;
    }
    if (s === S.VARDORVIS && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 11
      && (objectId === KORBAL_HERBS_LOC || visibleId === O.KORBAL_HERBS)) {
      if (!has(p, I.KORBAL_HERB) && p.getInventory().getFreeSlots() < 1) {
        p.sendMessage("You need inventory space for a Korbal herb.");
        return true;
      }
      if (!has(p, I.KORBAL_HERB)) p.getInventory().adds(I.KORBAL_HERB, 1);
      if (Number(p.getAttribute(VARDORVIS_PROGRESS)) === 11 && has(p, I.KORBAL_HERB) && has(p, I.ARGIAN_BERRIES)) p.setAttribute(VARDORVIS_PROGRESS, 12);
      p.sendMessage("You pick a Korbal herb from the north-west of the Stranglewood.");
      return true;
    }
    if (s === S.VARDORVIS && (Number(p.getAttribute(VARDORVIS_PROGRESS)) || 0) >= 11
      && (objectId === ARGIAN_BUSH_LOC || visibleId === O.ARGIAN_BUSH)) {
      if (!has(p, I.ARGIAN_BERRIES) && p.getInventory().getFreeSlots() < 1) {
        p.sendMessage("You need inventory space for Argian berries.");
        return true;
      }
      if (!has(p, I.ARGIAN_BERRIES)) p.getInventory().adds(I.ARGIAN_BERRIES, 1);
      if (Number(p.getAttribute(VARDORVIS_PROGRESS)) === 11 && has(p, I.KORBAL_HERB) && has(p, I.ARGIAN_BERRIES)) p.setAttribute(VARDORVIS_PROGRESS, 12);
      p.sendMessage("You pick Argian berries from the south-west of the Stranglewood.");
      return true;
    }
    if (s === S.VARDORVIS && objectId === STRANGLEWOOD_BOAT_OUT_LOC
      && Math.abs(location.x - 1193) <= 2 && Math.abs(location.y - 3453) <= 2) {
      p.moveTo(new api.core.Location(1227, 3470, 0));
      p.sendMessage("You row back from the Stranglewood.");
      return true;
    }
    if (s >= S.GUARDIAN && s <= S.MACHINE && (visibleId === O.CREVICE_45 || objectId === DIGSITE_CREVICE_LOC)) {
      if (location.x !== 3411 || location.y !== 9811) return false;
      enterWarRoom(p);
      return true;
    }
    if (s >= S.MACHINE && objectId === O.RUBBLE_74
      && roomTile?.x === 2783 && roomTile?.y === 6425) {
      leaveWarRoom(p);
      return true;
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && objectId === O.CRATE_302
      && roomTile?.x === 2780 && roomTile?.y === 6440) {
      const inventory = p.getInventory();
      const missing = 8 - inventory.getAmount(I.UNCHARGED_CELL_2) - inventory.getAmount(I.CHARGED_CELL);
      if (p.getAttribute(CELLS_INSERTED) || missing <= 0) return p.sendMessage("You already have the cells needed for the machine.");
      if (!inventory.getAmount(I.UNCHARGED_CELL_2) && inventory.getFreeSlots() < 1) return p.sendMessage("You need a free inventory slot for the cells.");
      inventory.adds(I.UNCHARGED_CELL_2, missing);
      p.sendMessage(`You search the crate and take ${missing} uncharged cells.`);
      return true;
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && [O.ALTAR_93, O.ALTAR_94, WAR_ROOM_ALTAR_LOC].includes(objectId)
      && roomTile?.x === 2772 && roomTile?.y === 6441) {
      p.setAttribute(ALTAR_INSPECTED, true);
      talk(p, N.DR_BANIKAN, "familiar-faces-inspecting-the-altar");
      return true;
    }
    if (s >= S.MACHINE && s < S.VARDORVIS && [O.GOLEM, O.GOLEM_2, WAR_ROOM_GOLEM_LOC].includes(objectId)
      && roomTile?.x === 2782 && roomTile?.y === 6443) {
      if (p.getAttribute(GOLEM_SOLVED)) {
        if (p.getAttribute(BANIKAN_LEFT) && Number(p.getAttribute(SEARCHED_NAMES)) === 15) searchGolem(p, "frostenhorn");
        else promptGolemSearch(p);
        return true;
      }
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
    const lassar = p.getAttribute(LASSAR) ?? {};
    if (stage(p) === S.WHISPERER && lassar.inShadow && itemId === I.SHADOW_BLOCKER
      && location?.x === 2649 && location?.y === 6406) {
      event.handled = true;
      if (!lassar.choirSouth || !lassar.choirWest || !lassar.redKey || !has(p, itemId)) {
        p.sendMessage("Clear the two residential tentacle barriers and take the red shadow key before placing the blocker by this chest.");
        return true;
      }
      p.getInventory().deleteNumber(I.SHADOW_BLOCKER, 1);
      setLassar(p, { ...lassar, redBlockerPlaced: true });
      p.sendMessage("You place the shadow blocker beside the red-key chest to hold back the lost souls.");
      return true;
    }
    if (stage(p) === S.WHISPERER && itemId === I.SHADOW_BLOCKER && location?.x === 2574 && location?.y === 6449) {
      event.handled = true;
      if (!lassar.whiteKey || !has(p, itemId)) { p.sendMessage("The palace chest is still sealed. Find the white shadow key first."); return true; }
      p.getInventory().deleteNumber(I.SHADOW_BLOCKER, 1);
      setLassar(p, { ...lassar, whiteBlockerPlaced: true });
      p.sendMessage("You place the shadow blocker in front of the palace chest.");
      return true;
    }
    if (stage(p) === S.WHISPERER && itemId === I.ANIMA_PORTAL && location?.x === 2576 && location?.y === 6447) {
      event.handled = true;
      if (!lassar.whiteKey || !has(p, itemId)) { p.sendMessage("The palace chest is still sealed. Find the white shadow key first."); return true; }
      p.getInventory().deleteNumber(I.ANIMA_PORTAL, 1);
      setLassar(p, { ...lassar, whiteAnimaPlaced: true });
      p.sendMessage("You place the anima portal between the palace chest's braziers.");
      return true;
    }
    if (stage(p) === S.WHISPERER && itemId === I.REVITALISING_IDOL && location?.x === 2578 && location?.y === 6445) {
      event.handled = true;
      if (!lassar.whiteKey || !has(p, itemId)) { p.sendMessage("The palace chest is still sealed. Find the white shadow key first."); return true; }
      p.getInventory().deleteNumber(I.REVITALISING_IDOL, 1);
      setLassar(p, { ...lassar, whiteIdolPlaced: true });
      p.sendMessage("You place the revitalising idol south-east of the anima portal.");
      return true;
    }
    if (stage(p) === S.WHISPERER && location?.x === 2922 && location.y === 5827 && itemId === I.VERY_LONG_ROPE
      && [49477, 48195, 48196, 48197].includes(objectId)) {
      event.handled = true;
      if (!lassar.ramarno || !has(p, I.VERY_LONG_ROPE)) {
        p.sendMessage("Ask Ramarno about the Lassar archaeologists before tying a rope to the sinkhole rock.");
        return true;
      }
      p.getInventory().deleteNumber(I.VERY_LONG_ROPE, 1);
      setLassar(p, { ...lassar, ropeTied: true });
      p.sendMessage("You tie Prescott's very long rope to the sinkhole rock.");
      return true;
    }
    if (stage(p) === S.WHISPERER && itemId === I.SHADOW_BLOCKER && has(p, itemId)
      && [48228, 48229, 48230, 48231, 48232, 48233, 48234, 48235, 48254, 48255, 48256, 48257, 48258, 48259, 48260, 48261, 48262, 48263, 48264, 48265, 48266, 48267, 48278, 48279, 48289, 48290].includes(objectId)
      && ((location?.x === 2606 && location?.y === 6359) || (location?.x === 2350 && location?.y === 6360)
        || (location?.x === 2641 && location?.y === 6428) || (location?.x === 2385 && location?.y === 6427)
        || (location?.x === 2649 && location?.y === 6406))) {
      const state = p.getAttribute(LASSAR) ?? {};
      event.handled = true;
      if ((location.x === 2641 || location.x === 2385) && !state.blueKey) {
        p.sendMessage("Clear the eastern residential tentacles and take their blue key before opening the pub passage.");
        return true;
      }
      p.getInventory().deleteNumber(I.SHADOW_BLOCKER, 1);
      setLassar(p, location.x === 2641 || location.x === 2385
        ? { ...state, pubBlocker: true }
        : location.x === 2649
          ? { ...state, redBlockerPlaced: true }
        : { ...state, blockerPlaced: true });
      p.sendMessage(location.x === 2641 || location.x === 2385
        ? "You place the shadow blocker by the pub doors, containing the lost souls that guard the passage."
        : "You place the shadow blocker beside the furnace-house doors. It creates a small safe zone from the lost souls.");
      return true;
    }
    if (stage(p) === S.WHISPERER && itemId === I.REVITALISING_IDOL && has(p, itemId)
      && (location?.x === 2689 || location?.x === 2691) && location?.y === 6415
      && [49485, 48201, 48202, 48203].includes(objectId)) {
      event.handled = true;
      if (!lassar.idol || !lassar.basicTorch || !(lassar.teleporters ?? []).slice(0, 6).every(Boolean)) {
        p.sendMessage("The idol belongs by the eastern teleporter, after Ketla has made it and you have cleared the residential path.");
        return true;
      }
      p.getInventory().deleteNumber(I.REVITALISING_IDOL, 1);
      setLassar(p, { ...lassar, idolPlaced: true });
      p.sendMessage("You place the revitalising idol beside the eastern teleporter. Its light steadies your sanity in the Shadow Realm.");
      return true;
    }
    const sucellusTile = sucellusSourceTile(p, location);
    if (stage(p) === S.SUCELLUS && p.getAttribute(SUCELLUS_CELL_ESCAPED)
      && objectId === 49120 && sucellusTile?.x === 2945 && sucellusTile.y === 6389
      && sucellusTile.z === 2 && itemId === I.LOCKPICK_4 && has(p, I.LOCKPICK_4)) {
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
        p.moveTo(area.tile(40, 14, 2));
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
        if (p.getInventory().getAmount(itemId) < 6) {
          p.sendMessage("You need six portions of this mushroom powder to fill the vat.");
          return true;
        }
        if (itemId !== I.ARDER_POWDER && itemId !== I.MUSCA_POWDER) return true;
        if (vat.powders.includes(itemId)) return p.sendMessage("This vat already contains that mushroom powder.");
        p.getInventory().deleteNumber(itemId, 6);
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
        event.handled = true;
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
        if (fixed.length === SCAR_LEECH_GROWTHS.length) {
          spawnScarMazeThreeBloodCells(p, p.getAttribute(ATTR_SCAR_MAZE_THREE));
          p.sendMessage("The damaged growths light the room. Crimson and Radiant Veins appear.");
        }
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
          revealScarBoatPassageThree(p);
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
      event.handled = true;
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
      && objectId === 49423 && mazeTile?.x === 2234 && mazeTile.y === 6407 && itemId === I.TINDERBOX) {
      event.handled = true;
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
      && mazeThreeTile && objectId === O.SHIPWRECK && mazeThreeTile.x === 1912 && mazeThreeTile.y === 6454 && itemId === I.TINDERBOX) {
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
    if ([O.GOLEM, O.GOLEM_2, WAR_ROOM_GOLEM_LOC].includes(objectId) && roomTile?.x === 2782 && roomTile?.y === 6443 && itemId === I.UNCHARGED_CELL_2) {
      event.handled = true;
      talk(p, N.GOLEM_3, "familiar-faces-inspecting-the-golem-machine-using-uncharged-cells-on-the-golem-machine");
      return true;
    }
    if ([O.ALTAR_93, O.ALTAR_94, WAR_ROOM_ALTAR_LOC].includes(objectId) && roomTile?.x === 2772 && roomTile?.y === 6441 && itemId === I.UNCHARGED_CELL_2) {
      event.handled = true;
      if (!has(p, I.UNCHARGED_CELL_2)) return;
      if (!p.getAttribute(TOTEMS_CHARGED)) return p.sendMessage("Activate all four elemental totems before charging the cells.");
      const inventory = p.getInventory();
      if (!inventory.getAmount(I.CHARGED_CELL) && inventory.getAmount(I.UNCHARGED_CELL_2) > 1 && inventory.getFreeSlots() < 1) return p.sendMessage("You need a free inventory slot for the charged cells.");
      p.getInventory().deleteNumber(I.UNCHARGED_CELL_2, 1);
      p.getInventory().adds(I.CHARGED_CELL, 1);
      p.sendMessage("The altar charges the cell.");
      return;
    }
    if ([O.GOLEM, O.GOLEM_2, WAR_ROOM_GOLEM_LOC].includes(objectId) && roomTile?.x === 2782 && roomTile?.y === 6443 && itemId === I.CHARGED_CELL) {
      event.handled = true;
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
      leviathan: [N.THE_LEVIATHAN_2, 2078, 6368],
      sucellus: [N.DUKE_SUCELLUS_7, 3036, 6452],
      whisperer: [N.THE_WHISPERER_3, 2656, 6370],
    };
    const [id, x, y] = table[key];
    let npcs = spawned.get(p);
    if (!npcs) spawned.set(p, npcs = {});
    if (key === "vardorvis") {
      const area = p.getAttribute(ATTR_VARDORVIS_AREA);
      if (!(area instanceof VardorvisArea) || area.isDestroyed()) return;
      if (npcs[key]?.isRegistered?.() && area.entities.includes(npcs[key])) return;
      const npc = api.core.NPC.create(id, area.tile(x - 1112, y - 3400, 0));
      npc.__dt2Vardorvis = true;
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
      const npc = api.core.NPC.create(id, area.tile(x - 2056, y - 6336, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.setScriptedMovement?.(true);
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
      // QH's (3039, 6454) marker falls inside the 7x7 footprint, not at its
      // south-west corner. The cache walls leave only x3036..3042 / y6452..6458
      // clear, so place the footprint there to keep the full NPC reachable.
      const npc = api.core.NPC.create(id, area.tile(164, 116, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.setScriptedMovement?.(true);
      npc.setNpcTransformationId?.(N.DUKE_SUCELLUS_6);
      npc.setMaxHitpoints?.(330);
      npc.setHitpoints?.(330);
      npc.__dt2Sucellus = true;
      npc.__dt2SucellusAwake = false;
      npc.__skipDefaultRespawn = true;
      area.add(npc);
      api.core.World.getAddNPCQueue().push(npc);
      npcs[key] = npc;
      p.setAttribute(ATTR, npc);
      return npc;
    }
    if (key === "whisperer") {
      const state = p.getAttribute(LASSAR) ?? {};
      if (!state.cathedralTentacles || state.whispererDefeated) return;
      if (npcs[key]?.isRegistered?.() && npcs[key].getHitpoints?.() > 0) return npcs[key];
      const npc = api.core.NPC.create(N.THE_WHISPERER_3,
        new api.core.Location(state.whispererEnraged ? 2400 : x, y, 0));
      npc.setOwner?.(p);
      npc.setOwnerOnly?.(true);
      npc.setScriptedMovement?.(true);
      npc.setMaxHitpoints?.(state.whispererEnraged ? 100 : 660);
      npc.setHitpoints?.(state.whispererEnraged ? 100 : 660);
      npc.__dt2Whisperer = true;
      npc.__dt2WhispererEnraged = Boolean(state.whispererEnraged);
      npc.__dt2WhispererSpecial = 0;
      npc.__skipDefaultRespawn = true;
      api.core.World.getAddNPCQueue().push(npc);
      npcs[key] = npc;
      p.setAttribute(ATTR, npc);
      p.sendMessage("The Whisperer rises from the cathedral. Watch her changing attacks and protect your sanity in the Shadow Realm.");
      return npc;
    }
    if (!npcs[key]) npcs[key] = api.spawnNpc({ id, x, y, z: 0, owner: p, ownerOnly: true });
    return npcs[key];
  }
  function startWhispererSoulSiphon(p, boss) {
    if (boss.__dt2WhispererSpecial) return;
    boss.__dt2WhispererSpecial = "soul-siphon";
    boss.__dt2WhispererSpecialTicks = 25;
    boss.forceChat?.("The souls will feed me!");
    p.sendMessage("The blackstone fragment glows yellow. Activate it, enter the Shadow Realm and kill all three souls chanting the same phrase before the siphon completes.");
    const owned = spawned.get(p) ?? {};
    const souls = [];
    const chants = ["Vita!", "Mors!", "Umbra!", "Aeternus!"];
    for (let group = 0; group < chants.length; group++) {
      for (let member = 0; member < 3; member++) {
        const x = 2411 + group * 3 + (member % 2);
        const y = 6365 + member * 3 + Math.floor(group / 2) * 2;
        const soul = api.core.NPC.create(N.LOST_SOUL, new api.core.Location(x, y, 0));
        soul.setOwner?.(p);
        soul.setOwnerOnly?.(true);
        soul.setScriptedMovement?.(true);
        soul.setMaxHitpoints?.(20);
        soul.setHitpoints?.(20);
        soul.forceChat?.(chants[group]);
        soul.__dt2WhispererSoul = true;
        soul.__dt2WhispererSoulSet = group;
        soul.__skipDefaultRespawn = true;
        souls.push(soul);
        api.core.World.getAddNPCQueue().push(soul);
      }
    }
    owned.whispererSouls = souls;
    spawned.set(p, owned);
  }
  function whispererEffectObject(p, id, x, y, type = 22) {
    const object = new api.core.GameObject(id, new api.core.Location(x, y, 0), type, 0, null);
    p.getPacketSender?.()?.sendObject?.(object);
    return object;
  }
  function clearWhispererObjects(p, objects) {
    for (const object of objects ?? []) p.getPacketSender?.()?.sendObjectRemoval?.(object);
  }
  function showWhispererSpecial(p, boss) {
    if (boss.__dt2WhispererSpecial === "corrupted-seeds") {
      for (const seed of boss.__dt2WhispererSeeds ?? []) {
        if (seed.active !== false) seed.object = whispererEffectObject(p, seed.id, seed.x, seed.y);
      }
    } else if (boss.__dt2WhispererSpecial === "screech") {
      for (const column of boss.__dt2WhispererColumns ?? []) {
        if (column.active) column.object = whispererEffectObject(p, O.FLOATING_COLUMN, column.x, column.y, 10);
      }
    }
  }
  function startWhispererSeeds(p, boss) {
    boss.__dt2WhispererSpecial = "corrupted-seeds";
    boss.__dt2WhispererSpecialTicks = 50;
    boss.forceChat?.("Let the seeds of fear take root!");
    // These are the cache loc variants used by the real encounter. The pattern
    // is centered on the cathedral's mirrored boss tile in the Shadow Realm.
    const seeds = [
      { x: 2398, y: 6368, light: true, id: O.CORRUPTED_SEED },
      { x: 2402, y: 6368, light: true, id: O.CORRUPTED_SEED },
      { x: 2400, y: 6372, light: true, id: O.CORRUPTED_SEED },
      { x: 2398, y: 6371, light: false, id: O.CORRUPTED_SEED_3 },
      { x: 2402, y: 6371, light: false, id: O.CORRUPTED_SEED_3 },
      { x: 2400, y: 6366, light: false, id: O.CORRUPTED_SEED_3 },
    ].map((seed) => ({ ...seed, object: null, active: true }));
    boss.__dt2WhispererSeeds = seeds;
    p.sendMessage("The Whisperer scatters corrupted seeds. Activate the blackstone fragment, step on every light-green seed, and avoid the dark-green seeds.");
  }
  function finishWhispererSeeds(p, boss, success) {
    clearWhispererObjects(p, boss.__dt2WhispererSeeds?.map((seed) => seed.object));
    boss.__dt2WhispererSeeds = [];
    boss.__dt2WhispererSpecial = null;
    boss.__dt2WhispererBindingTicks = 5;
    if (success) {
      const state = p.getAttribute(LASSAR) ?? {};
      setLassar(p, { ...state, sanity: Math.min(100, Number(state.sanity ?? 100) + 15) });
      p.sendMessage("You stamp out each light-green seed. The Whisperer's attack is broken and your sanity steadies.");
    } else {
      p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(75, api.core.HitMask.RED)]);
      const state = p.getAttribute(LASSAR) ?? {};
      setLassar(p, { ...state, sanity: Math.max(0, Number(state.sanity ?? 100) - 75) });
      p.sendMessage("The corrupted seeds erupt before you can stop them, blasting you and draining your sanity.");
    }
  }
  function processWhispererSeeds(p, boss) {
    if (!(p.getAttribute(LASSAR) ?? {}).inShadow) return;
    boss.__dt2WhispererSpecialTicks--;
    const location = p.getLocation?.();
    const x = location?.getX?.() ?? location?.x;
    const y = location?.getY?.() ?? location?.y;
    const seed = boss.__dt2WhispererSeeds?.find((entry) => entry.active !== false && entry.x === x && entry.y === y);
    if (seed) {
      seed.active = false;
      p.getPacketSender?.()?.sendObjectRemoval?.(seed.object);
      if (!seed.light) p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(20, api.core.HitMask.RED)]);
      const remaining = boss.__dt2WhispererSeeds.filter((entry) => entry.light && entry.active !== false);
      if (!remaining.length) return finishWhispererSeeds(p, boss, true);
    }
    if (boss.__dt2WhispererSpecialTicks <= 0) finishWhispererSeeds(p, boss, false);
  }
  function startWhispererScreech(p, boss) {
    boss.__dt2WhispererSpecial = "screech";
    boss.__dt2WhispererSpecialTicks = 5;
    boss.__dt2WhispererScreeches = 3;
    boss.forceChat?.("Hear my screech!");
    const columns = [[2397, 6370, 20], [2401, 6373, 40], [2404, 6369, 60]];
    boss.__dt2WhispererColumns = columns.map(([x, y, hp]) => ({
      x, y, hp, object: null, active: true,
    }));
    p.sendMessage("The Whisperer unleashes three screeches. Take cover behind a floating column; the weakest columns will fall first.");
  }
  function processWhispererScreech(p, boss) {
    if (!(p.getAttribute(LASSAR) ?? {}).inShadow) return;
    boss.__dt2WhispererSpecialTicks--;
    if (boss.__dt2WhispererSpecialTicks > 0) return;
    const location = p.getLocation?.();
    const x = location?.getX?.() ?? location?.x;
    const y = location?.getY?.() ?? location?.y;
    const columns = boss.__dt2WhispererColumns ?? [];
    const cover = columns.find((column) => column.active && Math.max(Math.abs(x - column.x), Math.abs(y - column.y)) <= 1);
    if (!cover) {
      p.getCombat().getHitQueue().addPendingDamage([new api.core.HitDamage(35, api.core.HitMask.RED)]);
      const state = p.getAttribute(LASSAR) ?? {};
      setLassar(p, { ...state, sanity: Math.max(0, Number(state.sanity ?? 100) - 35) });
      p.sendMessage("The screech catches you in the open, tearing at your body and sanity.");
    } else {
      p.sendMessage("A floating column absorbs the Whisperer's screech.");
    }
    cover && clearWhispererObjects(p, [cover.object]);
    if (cover) cover.active = false;
    boss.__dt2WhispererScreeches--;
    if (boss.__dt2WhispererScreeches <= 0) {
      clearWhispererObjects(p, columns.filter((column) => column.active).map((column) => column.object));
      boss.__dt2WhispererColumns = [];
      boss.__dt2WhispererSpecial = null;
      boss.__dt2WhispererBindingTicks = 5;
      p.sendMessage("The Whisperer finishes her screeching sequence and prepares a binding blow.");
    } else {
      boss.__dt2WhispererSpecialTicks = 5;
    }
  }
  function removeWhispererSouls(p, keepSet = -1) {
    const owned = spawned.get(p);
    if (!owned) return;
    for (const soul of owned.whispererSouls ?? []) {
      if (!soul?.isRegistered?.() || soul.__dt2WhispererSoulSet === keepSet) continue;
      const add = api.core.World.getAddNPCQueue();
      for (let i = add.indexOf(soul); i >= 0; i = add.indexOf(soul)) add.splice(i, 1);
      if (!api.core.World.getRemoveNPCQueue().includes(soul)) api.core.World.getRemoveNPCQueue().push(soul);
    }
    owned.whispererSouls = keepSet < 0
      ? []
      : (owned.whispererSouls ?? []).filter((soul) => soul?.isRegistered?.() && soul.__dt2WhispererSoulSet === keepSet);
  }
  function handleWhispererHit({ npc, hit }) {
    if (!npc?.__dt2Whisperer || npc.__dt2WhispererSpecial !== "soul-siphon" || !hit) return;
    for (const damage of hit.getHits?.() ?? []) damage.setDamage(0);
    hit.updateTotalDamage?.();
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
    if (s === S.WHISPERER) {
      const state = p.getAttribute(LASSAR) ?? {};
      if ([N.ODD_FIGURE, N.THE_WHISPERER, N.THE_WHISPERER_2, N.THE_WHISPERER_3, N.THE_WHISPERER_4].includes(npcId)) {
        if (!state.cathedralTentacles || !state.perfectTorch) {
          return p.sendMessage("Clear the cathedral tentacles with Ketla's perfected shadow torch before disturbing the figure.");
        }
        if (state.whispererDefeated) return p.sendMessage("Search the Whisperer's remains for her medallion.");
        spawnBoss(p, "whisperer");
        setLassar(p, { ...state, cathedralEntered: true, whispererStarted: true });
        return;
      }
      if (npcId === N.KETLA || npcId === N.KETLA_2) {
        if (state.fakeSchematicFound && !state.perfectSchematicGiven && has(p, I.PERFECTED_SHADOW_TORCH_SCHEMATIC_2))
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-a-schematic-2");
        if (state.strangeIcon && !state.iconPresented) {
          setLassar(p, { ...state, iconPresented: true });
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-the-icon");
        }
        if (state.escapedVision && state.perfectTorchSchematic)
          return talk(p, npcId, "the-whisperer-inspecting-the-totem-in-the-cistern-talking-to-ketla-again");
        if (state.cameTo && !state.blackstone && state.ringShown) {
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-the-ring-of-visibility-reclaiming-the-blackstone-fragment");
        }
        if (state.cameTo && !state.blackstone && has(p, I.RING_OF_VISIBILITY)) {
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-the-ring-of-visibility");
        }
        if (state.blockerSchematic && !state.ketlaBriefed) {
          setLassar(p, { ...state, ketlaBriefed: true });
          talk(p, npcId, "the-whisperer-talking-to-ketla-with-a-schematic");
          return;
        }
        if (state.entered && !state.blockerSchematic) { talk(p, npcId, "the-whisperer-while-in-the-shadow-realm"); return; }
        talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to");
        return;
      }
      talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to");
    }
  }
  function giveScarFibre(p, npc, itemId) {
    if (p.getInventory().adds(itemId, 1) !== false) return;
    api.getItemOnGroundManager().registerLocation(p, new Item(itemId, 1), npc.getLocation());
    p.sendMessage("Your bag is full. The fibre falls to the ground.");
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
          if (area instanceof ScarMazeThreeArea && !area.isDestroyed()) owner.moveTo(area.tile(46, 13, 0));
          owner.getCombat().getHitQueue().addPendingDamage([
            new api.core.HitDamage(20, api.core.HitMask.RED),
          ]);
          owner.sendMessage("The antibodies fall. The Scar ejects you from the Brain Pillar room.");
        }
      }
      return;
    }
    if (npc?.__dt2WhispererSoul) {
      const owner = npc.getOwner?.();
      const actors = owner && spawned.get(owner);
      if (!owner || !actors) return;
      const group = npc.__dt2WhispererSoulSet;
      actors.whispererSouls = (actors.whispererSouls ?? []).filter((soul) => soul !== npc);
      const remaining = actors.whispererSouls.filter((soul) => soul?.isRegistered?.() && soul.__dt2WhispererSoulSet === group);
      if (!remaining.length) {
        removeWhispererSouls(owner);
        const boss = actors.whisperer;
        if (boss?.isRegistered?.()) {
          boss.__dt2WhispererSpecial = null;
          boss.__dt2WhispererBindingTicks = 5;
          boss.forceChat?.("The souls are silenced!");
        }
        owner.sendMessage("You silence one complete set of souls. The Whisperer's siphon fails; leave the Shadow Realm with the blackstone fragment.");
      }
      return;
    }
    if (!killer) return;
    const owned = spawned.get(killer);
    if (!owned) return;
    if (owned.finalWight === npc && stage(killer) === S.FINALE) {
      owned.finalWight = null;
      const next = (Number(killer.getAttribute(FINAL_WIGHT_INDEX)) || 0) + 1;
      if (next < 4) {
        spawnFinalWight(killer, next);
        return;
      }
      killer.setAttribute(FINAL_WIGHTS_COMPLETE, true);
      killer.sendMessage("Sliske's four wights are defeated. Speak with Azzanadra as the Mahjarrat's dispute concludes.");
      talk(killer, N.SLISKE_2, "the-desert-treasure-aftermath");
      return;
    }
    if (owned.finalFigure === npc && stage(killer) === S.WHISPERER) {
      owned.finalFigure = null;
      killer.setAttribute(FINAL_FIGURE_STARTED, false);
      killer.setAttribute(FINAL_FIGURE_DEFEATED, true);
      killer.setAttribute(FINAL_CELL_ACTIVE, false);
      if (!has(killer, I.WHISPERERS_MEDALLION)) killer.getInventory().adds(I.WHISPERERS_MEDALLION, 1);
      killer.sendMessage("The Mysterious Figure falls. You recover the Whisperer's medallion and can now return to the Ancient Vault.");
      return;
    }
    if (owned.whisperer === npc && stage(killer) === S.WHISPERER) {
      owned.whisperer = null;
      const state = killer.getAttribute(LASSAR) ?? {};
      if (!state.whispererEnraged) {
        setLassar(killer, { ...state, whispererEnraged: true, inShadow: true });
        const here = killer.getLocation?.();
        const x = here?.getX?.() ?? here?.x;
        const y = here?.getY?.() ?? here?.y;
        const z = here?.getZ?.() ?? here?.z ?? 0;
        if (x != null && y != null) killer.moveTo(new api.core.Location(x - 256, y, z));
        killer.sendMessage("The Whisperer surges back with 100 hitpoints and drags you into the Shadow Realm. Finish her enrage phase.");
      } else {
        setLassar(killer, { ...state, whispererDefeated: true, inShadow: false });
        killer.sendMessage("The Whisperer is defeated. Search her remains for the medallion before returning to the Ancient Vault.");
      }
      return;
    }
    if (owned.leviathan === npc && stage(killer) === S.LEVIATHAN) {
      owned.leviathan = null;
      killer.setAttribute(ATTR, null);
      killer.setAttribute(SCAR_LEVIATHAN_KILLED, true);
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
        giveScarFibre(killer, npc, I.CRIMSON_FIBRE);
        killer.sendMessage("The crimson sanguisphera leaves a crimson fibre.");
      } else if (type === "radiant") {
        const count = Math.min(3, (Number(killer.getAttribute(SCAR_BLOOD_WHITE_COUNT)) || 0) + 1);
        killer.setAttribute(SCAR_BLOOD_WHITE_COUNT, count);
        killer.getPacketSender().sendVarbit(15218, count);
        giveScarFibre(killer, npc, I.RADIANT_FIBRE);
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
        revealScarBoatPassageTwo(killer);
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
      for (const pool of area?.kasondeFight?.pools ?? []) {
        killer.getPacketSender().sendObjectRemoval(pool.object);
        api.core.ObjectManager.deregister(pool.object, false);
      }
      if (area) area.kasondeFight = null;
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
      const area = killer.getAttribute(ATTR_VARDORVIS_AREA);
      const manager = api.getItemOnGroundManager?.();
      if (area && manager?.registerLocation) manager.registerLocation(killer, new Item(I.TEMPLE_KEY_3, 1), npc.getLocation?.() ?? area.tile(17, 19, 0), area);
      killer.sendMessage("Vardorvis collapses and drops a Temple key. Take it back to Kasonde.");
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
        spawnWarRoomBanikan(killer, area);
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
    if (s === S.LEVIATHAN && [N.WIZARD_PERSTEN_5, N.WIZARD_PERSTEN_6, N.WIZARD_PERSTEN_7].includes(npcId)) return handleBossTalk({ player: p, npcId });
    if (s === S.SUCELLUS && npcId === N.CAPTAIN_MALLETA) return talk(p, npcId, "duke-sucellus-of-the-sixth-legion-talking-to-captain-malleta");
    if (s === S.WHISPERER && [N.KETLA, N.KETLA_2].includes(npcId)) {
      const state = p.getAttribute(LASSAR) ?? {};
      if (npcId === N.KETLA || npcId === N.KETLA_2) {
        if (state.fakeSchematicFound && !state.perfectSchematicGiven && has(p, I.PERFECTED_SHADOW_TORCH_SCHEMATIC_2))
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-a-schematic-2");
        if (state.strangeIcon && !state.iconPresented) {
          setLassar(p, { ...state, iconPresented: true });
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-the-icon");
        }
        if (state.escapedVision && state.perfectTorchSchematic)
          return talk(p, npcId, "the-whisperer-inspecting-the-totem-in-the-cistern-talking-to-ketla-again");
        if (state.cameTo && !state.blackstone && state.ringShown) {
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-the-ring-of-visibility-reclaiming-the-blackstone-fragment");
        }
        if (state.cameTo && !state.blackstone && has(p, I.RING_OF_VISIBILITY)) {
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-the-ring-of-visibility");
        }
        if (has(p, I.SHADOW_BLOCKER_SCHEMATIC) || has(p, I.BASIC_SHADOW_TORCH_SCHEMATIC) || has(p, I.REVITALISING_IDOL_SCHEMATIC)
          || has(p, I.SUPERIOR_SHADOW_TORCH_SCHEMATIC) || has(p, I.ANIMA_PORTAL_SCHEMATIC)) {
          setLassar(p, { ...state, ketlaBriefed: true });
          return talk(p, npcId, "the-whisperer-talking-to-ketla-with-a-schematic");
        }
        return talk(p, npcId, "the-whisperer-talking-to-ketla-after-coming-to");
      }
    }
    return false;
  }

  function talkRamarno({ player: p, npcId }) {
    if (stage(p) !== S.WHISPERER) return false;
    const state = p.getAttribute(LASSAR) ?? {};
    if (state.entered) return p.sendMessage("Ramarno's directions brought you to the Lassar Undercity. Continue through its shadow devices.");
    talk(p, npcId, "the-whisperer-talking-to-ramarno");
  }
  function talkPrescott({ player: p, npcId }) {
    if (stage(p) !== S.WHISPERER) return false;
    const state = p.getAttribute(LASSAR) ?? {};
    if (!state.ramarno) return p.sendMessage("Prescott points you toward Ramarno by the Sacred Forge.");
    const variant = state.entered
      ? "the-whisperer-talking-to-prescott-talking-to-prescott-after-entering-the-undercity"
      : state.rope ? "the-whisperer-talking-to-prescott-talking-to-prescott-again" : "the-whisperer-talking-to-prescott";
    talk(p, npcId, variant);
  }

  function answerPrescottCondition({ player: p, npcId, stepId }) {
    if (npcId !== N.PRESCOTT || stage(p) !== S.WHISPERER) return null;
    const state = p.getAttribute(LASSAR) ?? {};
    if (stepId === "kMM5yZ") return !state.ramarno;
    if (stepId === "yRRbfR") return Boolean(state.ramarno);
    if (stepId === "1os4H_") return !has(p, I.VERY_LONG_ROPE);
    if (stepId === "G_Oyly") return has(p, I.VERY_LONG_ROPE);
    return null;
  }

  function ensurePrescott(p) {
    if (stage(p) !== S.WHISPERER || !(p.getAttribute(LASSAR) ?? {}).ramarno) return null;
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (owned.prescott?.isRegistered?.()) return owned.prescott;
    owned.prescott = api.spawnNpc({ id: N.PRESCOTT, x: 2975, y: 5794, z: 0, wanderRadius: 0, owner: p, ownerOnly: true });
    return owned.prescott;
  }

  function ensureLassarKetla(p) {
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (owned.lassarKetla?.isRegistered?.()) return owned.lassarKetla;
    owned.lassarKetla = api.spawnNpc({ id: N.KETLA, x: 2648, y: 6442, z: 0, wanderRadius: 0, owner: p, ownerOnly: true });
    return owned.lassarKetla;
  }

  function startFinalCellLock(p) {
    if (!p.getAttribute(FINAL_CELL_SOLUTION)) {
      p.setAttribute(FINAL_CELL_SOLUTION, Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join(","));
      p.setAttribute(FINAL_CELL_ATTEMPTS, 0);
    }
    p.sendMessage("You work the hair clip into the lock and begin testing four-number combinations.");
    chooseFinalLockDigit(p, 0, 0);
  }
  function chooseFinalLockDigit(p, slot, offset) {
    const options = [];
    for (const digit of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].slice(offset, offset + 4)) {
      options.push(String(digit), () => setFinalLockDigit(p, slot, digit));
    }
    if (offset + 4 < 10) options.push("More...", () => chooseFinalLockDigit(p, slot, offset + 4));
    else if (offset) options.push("Back...", () => chooseFinalLockDigit(p, slot, 0));
    options.push("Cancel", () => {});
    api.sendMultiChatboxPrompt(p, `Cell lock - number ${slot + 1} of 4`, ...options);
  }
  function setFinalLockDigit(p, slot, digit) {
    const guess = String(p.getAttribute(FINAL_CELL_GUESS) ?? "").split(",").filter(Boolean);
    guess[slot] = String(digit);
    p.setAttribute(FINAL_CELL_GUESS, guess.join(","));
    if (slot < 3) return chooseFinalLockDigit(p, slot + 1, 0);
    const solution = String(p.getAttribute(FINAL_CELL_SOLUTION) ?? "").split(",").map(Number);
    const attempt = guess.slice(0, 4).map(Number);
    p.setAttribute(FINAL_CELL_GUESS, "");
    let exact = 0;
    const remainingSolution = [], remainingAttempt = [];
    for (let i = 0; i < 4; i++) {
      if (attempt[i] === solution[i]) exact++;
      else { remainingSolution.push(solution[i]); remainingAttempt.push(attempt[i]); }
    }
    let misplaced = 0;
    for (const value of remainingAttempt) {
      const index = remainingSolution.indexOf(value);
      if (index >= 0) { misplaced++; remainingSolution.splice(index, 1); }
    }
    if (exact === 4) {
      p.setAttribute(FINAL_CELL_OPEN, true);
      p.sendMessage("The four numbers are correct. The cell lock clicks open; open the gate to escape.");
      return;
    }
    p.setAttribute(FINAL_CELL_ATTEMPTS, (Number(p.getAttribute(FINAL_CELL_ATTEMPTS)) || 0) + 1);
    p.sendMessage(`The lock rejects that combination: ${exact} number${exact === 1 ? "" : "s"} in the correct place, ${misplaced} in the wrong place.`);
    chooseFinalLockDigit(p, 0, 0);
  }
  function spawnFinalFigure(p) {
    if (p.getAttribute(FINAL_FIGURE_DEFEATED)) return;
    let owned = spawned.get(p);
    if (!owned) spawned.set(p, owned = {});
    if (owned.finalFigure?.isRegistered?.()) return owned.finalFigure;
    owned.finalFigure = api.spawnNpc({ id: N.MYSTERIOUS_FIGURE_4, x: 3086, y: 9260, z: 0, wanderRadius: 0, owner: p, ownerOnly: true });
    if (owned.finalFigure) {
      owned.finalFigure.setMaxHitpoints?.(450);
      owned.finalFigure.setHitpoints?.(450);
      owned.finalFigure.__dt2FinalFigure = true;
      owned.finalFigure.__skipDefaultRespawn = true;
      p.sendMessage("The Mysterious Figure attacks. Protect from Magic and change combat styles when she prays against yours.");
    }
    return owned.finalFigure;
  }
  function handleFinalFigureHit({ npc, hit }) {
    if (!npc?.__dt2FinalFigure || !hit) return;
    const attacker = hit.getAttacker?.();
    if (attacker?.isPlayer?.() !== true) return;
    const attackType = attacker.getAsPlayer?.().getFightType?.()?.getBonusType?.();
    if (!Number.isInteger(attackType)) return;
    const style = attackType === 3 ? 3 : attackType === 4 ? 4 : 0;
    if (npc.__dt2FinalFigurePrayer === style) {
      for (const damage of hit.getHits?.() ?? []) damage.setDamage(0);
      hit.updateTotalDamage?.();
    }
    npc.__dt2FinalFigureHits = (npc.__dt2FinalFigureHits || 0) + 1;
    if (npc.__dt2FinalFigureHits % 3 === 0) {
      npc.__dt2FinalFigurePrayer = style;
      npc.forceChat?.("You will not break my defences so easily!");
      attacker.sendMessage?.("The Mysterious Figure prays against your current attack style.");
    }
  }
  function storeFinalCellGear(p, attribute = FINAL_CELL_GEAR) {
    const save = (container) => container.getItems().map((item) => [item.getId(), item.getAmount(), item.meta ?? null]);
    p.setAttribute(attribute, { inventory: save(p.getInventory()), equipment: save(p.getEquipment()) });
    const clear = (container) => {
      container.setItems(container.getItems().map(() => new Item(-1, 0)));
      container.refreshItems();
    };
    clear(p.getInventory());
    clear(p.getEquipment());
  }
  function storeSucellusPrisonGear(p) {
    if (p.getAttribute(SUCELLUS_PRISON_GEAR)) return;
    // Preserve earned cell items when upgrading a save captured before confiscation existed.
    const cellItems = new Set([I.PRISONERS_LETTER, I.KNIFE_5, I.CHISEL_5, I.LOCKPICK_4]);
    const kept = p.getInventory().getItems().filter(item => cellItems.has(item.getId()));
    storeFinalCellGear(p, SUCELLUS_PRISON_GEAR);
    const gear = p.getAttribute(SUCELLUS_PRISON_GEAR);
    gear.inventory = gear.inventory.map(item => cellItems.has(item[0]) ? [-1, 0, null] : item);
    for (const item of kept) p.getInventory().adds(item.getId(), item.getAmount());
  }
  function returnSucellusPrisonStash(request) {
    const { player } = request;
    if (stage(player) !== S.SUCELLUS) return;
    const gear = player.getAttribute(SUCELLUS_PRISON_GEAR);
    if (!gear) { request.restored = true; return; }
    if (!Array.isArray(gear.inventory) || !Array.isArray(gear.equipment)) return;
    const inventory = player.getInventory(), equipment = player.getEquipment();
    const bag = inventory.getItems().map(item => item.clone());
    const worn = equipment.getItems().map(item => item.clone());
    const overflow = [];
    const place = (items, item, stackable) => {
      if (item.getId() <= 0 || item.getAmount() <= 0) return true;
      const matching = stackable ? items.find(slot => slot.getId() === item.getId()
        && JSON.stringify(slot.getMeta() ?? null) === JSON.stringify(item.getMeta() ?? null)) : null;
      if (matching && Number.isSafeInteger(matching.getAmount() + item.getAmount())) {
        matching.setAmount(matching.getAmount() + item.getAmount());
        return true;
      }
      const empty = items.findIndex(slot => slot.getId() <= 0 || slot.getAmount() <= 0);
      if (empty < 0) return false;
      items[empty] = item.clone();
      return true;
    };
    const recover = item => {
      if (item.getId() <= 0 || item.getAmount() <= 0) return;
      if (!place(bag, item, item.getDefinition().isStackable())) overflow.push(item);
    };
    for (const [id, amount, meta] of gear.inventory) {
      if (id > 0 && amount > 0) recover(new Item(id, amount, meta));
    }
    for (let slot = 0; slot < gear.equipment.length; slot++) {
      const [id, amount, meta] = gear.equipment[slot];
      if (id <= 0 || amount <= 0) continue;
      if (slot >= worn.length) return;
      recover(worn[slot]);
      worn[slot] = new Item(id, amount, meta);
    }
    // Keep prison keys and notes in the bag; recover excess confiscated supplies to the bank.
    if (overflow.some(item => item.getMetaValue(Item.UNBANKABLE_META) === true)) {
      player.sendMessage("Make room in your inventory for belongings that cannot be banked. Nothing has been moved.");
      return;
    }
    const bank = overflow.length ? player.getBank(0) : null;
    const bankItems = bank?.getItems().map(item => item.clone());
    for (const item of overflow) {
      if (!place(bankItems, item, true)) {
        player.sendMessage("Make room in your bank before recovering your belongings. Nothing has been moved.");
        return;
      }
    }
    inventory.setItems(bag);
    equipment.setItems(worn);
    if (bank) { bank.setItems(bankItems); bank.refreshItems(); }
    inventory.refreshItems();
    equipment.refreshItems();
    player.setAttribute(SUCELLUS_PRISON_GEAR, null);
    request.restored = true;
    if (overflow.length) player.sendMessage("Your belongings have been recovered. Supplies that would not fit were sent to your bank.");
  }
  function completeSucellusPrison({ player }) {
    if (stage(player) !== S.SUCELLUS) return;
    player.setAttribute(SUCELLUS_PRISON_COMPLETE, true);
    player.setAttribute(SUCELLUS_PRISON_PROGRESS, 58);
    syncNativeProgress(player);
  }
  function resolveSucellusCellCondition({ player, npcId, text }) {
    if (stage(player) !== S.SUCELLUS || npcId !== N.ASSASSIN_7) return null;
    const progress = Number(player.getAttribute(SUCELLUS_CELL_PROGRESS)) || 0;
    if (text === "If the player has not read the letter:") return progress < 3;
    if (text === "If the player has read the letter:") return progress === 3;
    if (text === "If the player tries to search the bucket again:") return progress >= 4;
    return null;
  }
  function restoreFinalCellGear(p, attribute = FINAL_CELL_GEAR) {
    const gear = p.getAttribute(attribute);
    if (!gear?.inventory || !gear?.equipment) return;
    if (has(p, I.HAIR_CLIP_3)) p.getInventory().deleteNumber(I.HAIR_CLIP_3, p.getInventory().getAmount(I.HAIR_CLIP_3));
    const restore = (container, saved) => {
      const items = saved.slice(0, container.capacity()).map(([id, amount, meta]) => new Item(Number(id), Number(amount), meta));
      while (items.length < container.capacity()) items.push(new Item(-1, 0));
      container.setItems(items);
      container.refreshItems();
    };
    restore(p.getInventory(), gear.inventory);
    restore(p.getEquipment(), gear.equipment);
    p.setAttribute(attribute, null);
  }

  function handleDialogueAction(event) {
    const { player: p, stepId } = event;
    if (stage(p) === S.VARDORVIS && Number(p.getAttribute(VARDORVIS_PROGRESS)) === 18 && stepId === "4muMDK") {
      const area = p.getAttribute(ATTR_STRANGLEWOOD_TEMPLE);
      if (!(area instanceof StranglewoodTempleArea) || area.isDestroyed() || !has(p, I.TEMPLE_KEY_3)) {
        event.handled = true;
        event.end = true;
        return;
      }
      p.getInventory().deleteNumber(I.TEMPLE_KEY_3, 1);
      const owned = spawned.get(p);
      if (owned?.templeKasonde) { api.removeNpc(owned.templeKasonde); owned.templeKasonde = null; }
      p.setAttribute(VARDORVIS_PROGRESS, 19);
      spawnTempleKasonde(p, area);
    }
    if (stage(p) === S.VARDORVIS && Number(p.getAttribute(VARDORVIS_PROGRESS)) === 20 && stepId === "ZEXv_C") {
      p.setAttribute(VARDORVIS_PROGRESS, 21);
      const owned = spawned.get(p);
      if (owned?.kasondeInjured) { api.removeNpc(owned.kasondeInjured); owned.kasondeInjured = null; }
    }
    if (stage(p) === S.VARDORVIS && [13, 14].includes(Number(p.getAttribute(VARDORVIS_PROGRESS)))
      && ["ixrOLP", "e7yS62"].includes(stepId)) {
      if (![I.UNFINISHED_SERUM, I.UNFINISHED_SERUM_2, I.STRANGLER_SERUM].some(id => has(p, id))) {
        if (p.getInventory().getFreeSlots() < 1) {
          event.handled = true;
          event.end = true;
          p.sendMessage("You need inventory space for Kasonde's unfinished serum.");
          return;
        }
        p.getInventory().adds(I.UNFINISHED_SERUM, 1);
      }
      p.setAttribute(VARDORVIS_PROGRESS, 14);
    }
    if (stage(p) === S.VARDORVIS && Number(p.getAttribute(VARDORVIS_PROGRESS)) === 6 && stepId === "nJRAbJ") {
      p.setAttribute(STRANGLEWOOD_CITY_ENTERED, true);
      // shortcut: adjacent house landing is inferred from the cache, calibrate against a live cutscene capture.
      p.moveTo(new api.core.Location(1193, 3405, 0));
    }
    if (stepId === "T24jg_" && stage(p) === S.MACHINE && Number(p.getAttribute(SEARCHED_NAMES)) === 15) {
      p.setAttribute(BANIKAN_LEFT, true);
      const owned = spawned.get(p);
      if (owned?.banikan) { api.removeNpc(owned.banikan); delete owned.banikan; }
    }
    const lassar = p.getAttribute(LASSAR) ?? {};
    if (stepId === "AYDmc1" && stage(p) === S.WHISPERER && has(p, I.PERFECTED_SHADOW_TORCH_SCHEMATIC_2)) {
      p.getInventory().deleteNumber(I.PERFECTED_SHADOW_TORCH_SCHEMATIC_2, 1);
      setLassar(p, { ...lassar, perfectSchematicGiven: true, silentChoir: true });
    }
    if (stepId === "1Y6l8H" && stage(p) === S.WHISPERER) {
      setLassar(p, { ...(p.getAttribute(LASSAR) ?? {}), visionStarted: true });
    }
    if (stepId === "dUbk4i" && stage(p) === S.WHISPERER) {
      p.moveTo(new api.core.Location(3232, 6308, 0));
    }
    if (stepId === "8nNqFG" && stage(p) === S.WHISPERER) {
      const current = p.getAttribute(LASSAR) ?? {};
      p.moveTo(new api.core.Location(2648, 6442, 0));
      setLassar(p, { ...current, escapedVision: true, perfectTorchSchematic: true });
    }
    if (stepId === LASSAR_ACTIONS.ramarno) {
      setLassar(p, { ...lassar, ramarno: true });
    }
    if (stepId === LASSAR_ACTIONS.rope || stepId === LASSAR_ACTIONS.ropeAgain) {
      if (stage(p) === S.WHISPERER && !has(p, I.VERY_LONG_ROPE)) {
        p.getInventory().adds(I.VERY_LONG_ROPE, 1);
        p.sendMessage("Prescott gives you a very long rope.");
        setLassar(p, { ...lassar, ramarno: true, rope: true });
      }
    }
    if (stepId === "JQeeJF") {
      const current = p.getAttribute(LASSAR) ?? {};
      setLassar(p, { ...current, ringShown: true });
    }
    if ((stepId === "5mQjA2" || stepId === "FLyW0o") && stage(p) === S.WHISPERER) {
      const current = p.getAttribute(LASSAR) ?? {};
      if (!has(p, I.BLACKSTONE_FRAGMENT) && !has(p, I.BLACKSTONE_FRAGMENT_2) && !has(p, I.BLACKSTONE_FRAGMENT_3)) p.getInventory().adds(I.BLACKSTONE_FRAGMENT, 1);
      setLassar(p, { ...current, blackstone: true });
    }
    if (stepId === "tOep7b" && stage(p) === S.WHISPERER) {
      const current = p.getAttribute(LASSAR) ?? {};
      if (has(p, I.SHADOW_BLOCKER_SCHEMATIC)) {
        p.getInventory().deleteNumber(I.SHADOW_BLOCKER_SCHEMATIC, 1);
        setLassar(p, { ...current, blockerSchematic: true, blockerDesigned: true });
      } else if (has(p, I.BASIC_SHADOW_TORCH_SCHEMATIC)) {
        p.getInventory().deleteNumber(I.BASIC_SHADOW_TORCH_SCHEMATIC, 1);
        setLassar(p, { ...current, torchSchematic: true });
      } else if (has(p, I.REVITALISING_IDOL_SCHEMATIC)) {
        p.getInventory().deleteNumber(I.REVITALISING_IDOL_SCHEMATIC, 1);
        setLassar(p, { ...current, idolSchematic: true });
      } else if (has(p, I.SUPERIOR_SHADOW_TORCH_SCHEMATIC)) {
        p.getInventory().deleteNumber(I.SUPERIOR_SHADOW_TORCH_SCHEMATIC, 1);
        setLassar(p, { ...current, superiorTorchSchematic: true });
      } else if (has(p, I.ANIMA_PORTAL_SCHEMATIC)) {
        p.getInventory().deleteNumber(I.ANIMA_PORTAL_SCHEMATIC, 1);
        setLassar(p, { ...current, animaSchematic: true });
      }
    }
    if (stepId === "qEMxBM" && p.getAttribute("desert-treasure-ii:final-cell-pending")) {
      p.setAttribute("desert-treasure-ii:final-cell-pending", false);
      p.setAttribute(FINAL_CELL_ACTIVE, true);
      p.getInventory().deleteNumber(I.WHISPERERS_MEDALLION, 1);
      storeFinalCellGear(p);
      p.moveTo(new api.core.Location(3103, 9246, 0));
    }
    if (stepId === "NoRYcT" && p.getAttribute("desert-treasure-ii:first-medallion-meeting-pending")) {
      p.setAttribute("desert-treasure-ii:first-medallion-meeting-pending", false);
      enterVault(p);
    }
    if (stage(p) === S.FINALE) {
      const actors = spawned.get(p) ?? {};
      if (stepId === "lnBBaf") {
        const area = enterFinalRoom(p);
        const smith = spawnFinalActor(p, ASGARNIA_SMITH_VAULT_INITIAL, 3296, 6444);
        actors.finalSmith = smith;
      } else if (stepId === "2ucP4K") {
        actors.finalBanikan = spawnFinalActor(p, N.DR_BANIKAN_2, 3298, 6441);
        spawned.set(p, actors);
      } else if (stepId === "s3g1xZ" && actors.finalBanikan) {
        actors.finalBanikan.setNpcTransformationId?.(N.AZZANADRA_2);
        actors.finalAzzanadra = actors.finalBanikan;
      } else if (stepId === "CQXcy8") {
        actors.finalHazeel = spawnFinalActor(p, N.HAZEEL_5, 3294, 6441);
        spawned.set(p, actors);
      } else if (stepId === "F2TgOo") {
        actors.finalEnakhra = spawnFinalActor(p, N.ENAKHRA_4, 3292, 6441);
        spawned.set(p, actors);
      } else if (stepId === "t8wSqb") {
        actors.finalAkthanakos = spawnFinalActor(p, N.AKTHANAKOS_2, 3300, 6441);
        spawned.set(p, actors);
      } else if (stepId === "fknd65") {
        actors.finalSliske = spawnFinalActor(p, N.SLISKE, 3296, 6444);
        spawned.set(p, actors);
      } else if (stepId === "VyE7pP" && actors.finalSliske) {
        actors.finalSliske.setNpcTransformationId?.(N.WIZARD_PERSTEN);
      } else if (stepId === "j4r_NI" && actors.finalSliske) {
        actors.finalSliske.setNpcTransformationId?.(N.ASSASSIN);
      } else if (stepId === "2PDmE7" && actors.finalSliske) {
        actors.finalSliske.setNpcTransformationId?.(N.KETLA);
      } else if (stepId === "-qlPgg" && actors.finalSliske) {
        actors.finalSliske.setNpcTransformationId?.(N.KASONDE);
      } else if (stepId === "3rolVc" && actors.finalSliske) {
        actors.finalSliske.setNpcTransformationId?.(N.SLISKE);
      } else if (stepId === "2at3Ae") {
        startFinalWights(p);
        spawned.set(p, actors);
      }
    }
    if (stepId === "acAj3M" && p.getAttribute(FINAL_WIGHTS_COMPLETE)) {
      p.sendMessage("Sliske completes the spell and the Elder Horn vanishes in a burst of shadow.");
    }
    if (stepId === "xGIiPZ" && p.getAttribute(FINAL_WIGHTS_COMPLETE)) rewardFinalQuest(p);
    if (stepId === "EDEdng" && stage(p) === S.MACHINE && p.getAttribute(CELLS_INSERTED)) openGolemPuzzle(p);
    if (stepId === "4b6oDl" && stage(p) === S.LEVIATHAN && p.getAttribute(SCAR_BOAT_TRIED)) {
      const area = p.getAttribute(ATTR_SCAR_AREA);
      if (area instanceof ScarArea && !area.isDestroyed()) p.moveTo(area.tile(51, 43, 0));
    }
  }

  function handleDialogueChoice({ player: p, option }) {
    // The wiki transcript encodes this branch's continuation as a jump marker,
    // so it never emits the action id handled above. Record the conversation
    // when the player actually chooses the archaeologist question.
    if (stage(p) !== S.WHISPERER || option !== "Have you seen any archeologists around here?") return;
    const state = p.getAttribute(LASSAR) ?? {};
    if (!state.ramarno) setLassar(p, { ...state, ramarno: true });
    ensurePrescott(p);
  }

  function handleLassarObject(event, visibleId, option) {
    const { player: p, location } = event;
    const state = p.getAttribute(LASSAR) ?? {};
    const x = location?.x, y = location?.y, z = location?.z ?? 0;
    if (stage(p) !== S.WHISPERER || !location) return false;

    // Prescott's route starts on the real Camdozaal sinkhole. Tying the rope
    // consumes his rope, and descending lands at Lassar's cache rope entrance.
    if (x === 2922 && y === 5827 && z === 0 && [49477, 48195, 48196, 48197].includes(visibleId)) {
      if (option === "use" || option === "tie" || option === "attach-rope") {
        if (!state.ramarno || !has(p, I.VERY_LONG_ROPE)) {
          p.sendMessage("Ask Ramarno about the archaeologists, then get Prescott's very long rope.");
          return true;
        }
        p.getInventory().deleteNumber(I.VERY_LONG_ROPE, 1);
        setLassar(p, { ...state, ropeTied: true });
        p.sendMessage("You tie Prescott's very long rope securely to the rock.");
        return true;
      }
      if (option === "climb-down" || option === "climb down" || option === "climb-rope" || option === "enter" || option === "climb") {
        if (!state.ropeTied) { p.sendMessage("The sinkhole is too deep to descend without a rope."); return true; }
        setLassar(p, { ...state, entered: true });
        p.moveTo(new api.core.Location(2587, 6436, 0));
        p.sendMessage("You descend into the Lassar Undercity. The rope remains tied above.");
        return true;
      }
    }
    if (!state.entered) return false;
    if (visibleId === 48198 && state.medallion && (option === "climb" || option === "exit" || option === "leave")) {
      setLassar(p, { ...state, exited: true });
      p.moveTo(new api.core.Location(2922, 5827, 0));
      p.sendMessage("You climb out of Lassar through the sinkhole and return to Camdozaal with the Whisperer's medallion.");
      return true;
    }

    // The Silent Choir's entry clue is the remnant above the pub. The cache's
    // stairs are one tile below the upper-floor remnant and preserve the real
    // plane transition instead of jumping directly to later puzzle stages.
    if (x === 2372 && y === 6430 && z === 0 && option.startsWith("climb")) {
      if (!state.pubOpened) { p.sendMessage("The pub is still sealed in the material realm."); return true; }
      p.moveTo(new api.core.Location(2372, 6430, 1));
      return true;
    }
    if (x === 2380 && y === 6430 && z === 1 && state.inShadow
      && visibleId === 48245 && option.startsWith("touch")) {
      setLassar(p, { ...state, pubRemnant: true });
      talk(p, N.MYSTERIOUS_VOICE_8, "the-whisperer-viewing-the-remnant-in-the-pub");
      p.sendMessage("The remnant reveals the Silent Choir's church beneath Lassar. An icon is needed to pass its gate.");
      return true;
    }

    // Later Shadow Realm tentacle rows require the superior torch. Their doors
    // open only after both barriers are cleared, matching the Silent Choir route.
    if (state.inShadow && has(p, I.SUPERIOR_SHADOW_TORCH)
      && [48205, 48208, 48211].includes(visibleId)) {
      const tentacles = { ...(state.tentacles ?? {}) };
      const key = `${x},${y}`;
      const barriers = new Map([["2392,6411", "choirSouth"], ["2383,6408", "choirWest"], ["2349,6343", "green"]]);
      const barrier = barriers.get(key);
      if (barrier && !tentacles[key]) {
        tentacles[key] = true;
        const next = { ...state, tentacles, [barrier]: true };
        if (barrier === "choirWest" && next.choirSouth && !next.redKeyFound) {
          registerLassarGroundItem(p, I.SHADOW_KEY_4, 2638, 6405);
          next.redKeyFound = true;
        }
        setLassar(p, next);
        p.sendMessage("The superior shadow torch burns through the deeper tentacles.");
        return true;
      }
    }

    if (x === 2392 && y === 6405 && state.inShadow && [48232, 48233, 48234, 48235].includes(visibleId)
      && (option === "open" || option === "search")) {
      if (!state.choirSouth || !state.choirWest || !state.redBlockerPlaced) {
        p.sendMessage("The square chest is still guarded. Clear both nearby tentacle doors and place the shadow blocker beside it.");
        return true;
      }
      if (!state.redKey || !has(p, I.SHADOW_KEY_4)) { p.sendMessage("The chest needs the red shadow key from the south-western house."); return true; }
      p.getInventory().deleteNumber(I.SHADOW_KEY_4, 1);
      setLassar(p, { ...state, redKey: false, redKeyUsed: true, iconSegment1: true });
      p.getInventory().adds(I.ICON_SEGMENT, 1);
      p.sendMessage("The chest opens with the red shadow key. You take the first icon segment.");
      return true;
    }

    if (x === 2354 && y === 6339 && state.inShadow && [48232, 48233, 48234, 48235].includes(visibleId)
      && (option === "open" || option === "search")) {
      if (!state.green || !state.greenKey || !has(p, I.SHADOW_KEY_5)) {
        p.sendMessage("The south Science District chest is sealed until you clear its tentacles and bring the green shadow key.");
        return true;
      }
      p.getInventory().deleteNumber(I.SHADOW_KEY_5, 1);
      setLassar(p, { ...state, greenKey: false, greenKeyUsed: true, iconSegment2: true });
      p.getInventory().adds(I.ICON_SEGMENT_2, 1);
      p.sendMessage("The chest opens with the green shadow key. You take the second icon segment.");
      return true;
    }
    if (x === 2351 && y === 6386 && state.inShadow && visibleId === 48208
      && (option === "burn" || option === "clear" || option === "open")) {
      if (!has(p, I.SUPERIOR_SHADOW_TORCH)) { p.sendMessage("The deeper tentacles only yield to the superior shadow torch."); return true; }
      setLassar(p, { ...state, plazaTentacle: true });
      p.sendMessage("The superior torch burns through the tentacles south of the Plaza.");
      return true;
    }
    if (x === 2597 && y === 6392 && !state.inShadow && [48228, 48229, 48230, 48231].includes(visibleId)
      && (option === "open" || option === "search")) {
      if (!state.plazaTentacle) { p.sendMessage("The white-key house is still sealed by shadow tentacles."); return true; }
      if (!has(p, I.SHADOW_KEY_3)) p.getInventory().adds(I.SHADOW_KEY_3, 1);
      setLassar(p, { ...state, whiteKey: true });
      p.sendMessage("You search the opened house and take the white shadow key.");
      return true;
    }
    if (state.inShadow && visibleId === 48253 && x >= 2308 && x <= 2321 && y >= 6440 && y <= 6455
      && (option === "light" || option === "ignite" || option === "activate")) {
      if (!state.whiteBlockerPlaced || !state.whiteAnimaPlaced || !state.whiteIdolPlaced) {
        p.sendMessage("The lost souls still guard this chest. Place the blocker, anima portal and revitalising idol at the marked tiles first.");
        return true;
      }
      const braziers = { ...(state.braziers ?? {}) };
      braziers[`${x},${y}`] = true;
      setLassar(p, { ...state, braziers });
      const count = Object.keys(braziers).length;
      p.sendMessage(`You light a shadow brazier near the chest (${count}/4).`);
      if (count >= 4) setLassar(p, { ...p.getAttribute(LASSAR), braziersComplete: true });
      return true;
    }
    if (state.inShadow && x === 2316 && y === 6450 && [48232, 48233, 48234, 48235].includes(visibleId)
      && (option === "open" || option === "search")) {
      if (!state.braziersComplete) { p.sendMessage("The four braziers around the palace chest must be lit first."); return true; }
      if (!has(p, I.PERFECTED_SHADOW_TORCH_SCHEMATIC_2)) p.getInventory().adds(I.PERFECTED_SHADOW_TORCH_SCHEMATIC_2, 1);
      setLassar(p, { ...state, fakeSchematicFound: true });
      p.sendMessage("The chest opens. Its perfected shadow torch schematic bears a black mark.");
      return true;
    }

    if ((x === 2656 && y === 6424 && (option === "enter" || option === "climb-down" || option === "climb down"))
      && (visibleId === 49488 || visibleId === 48295 || visibleId === 48296)) {
      if (!state.strangeIcon || !has(p, I.STRANGE_ICON)) {
        p.sendMessage("A strange icon matching the mark Prescott described is needed to enter the cistern.");
        return true;
      }
      setLassar(p, { ...state, drainEntered: true });
      p.moveTo(new api.core.Location(2784, 6287, 1));
      return true;
    }
    if (x === 2784 && y === 6287 && z === 1 && state.drainEntered
      && (visibleId === 48301 || visibleId === 48302) && (option === "open" || option === "pass")) {
      if (!has(p, I.STRANGE_ICON)) { p.sendMessage("The cistern gate is marked with the icon. Carry it to pass."); return true; }
      setLassar(p, { ...state, drainGateOpen: true, iconUsed: true });
      p.moveTo(new api.core.Location(2790, 6287, 1));
      return true;
    }
    if (x === 2806 && y === 6303 && z === 1 && state.drainGateOpen && visibleId === 48304
      && (option === "climb-down" || option === "climb down" || option === "descend")) {
      p.moveTo(new api.core.Location(2806, 6303, 0));
      setLassar(p, { ...state, drainLower: true });
      return true;
    }
    if (x === 2784 && y === 6304 && z === 0 && state.drainLower && [47734, 48305].includes(visibleId)
      && (option === "inspect" || option === "search")) {
      if (!has(p, I.STRANGE_ICON)) { p.sendMessage("The pillar's inscription only responds to the strange icon."); return true; }
      setLassar(p, { ...state, visionStarted: true });
      talk(p, N.KETLA, "the-whisperer-inspecting-the-totem-in-the-cistern");
      return true;
    }

    if (x === 2350 && y === 6360 && state.inShadow && [48254, 48255, 48256, 48257, 48258, 48259, 48260, 48261, 48262, 48263, 48264, 48265, 48266, 48267].includes(visibleId)
      && (option === "open" || option === "unlock")) {
      if (!state.blockerPlaced) { p.sendMessage("The lost souls overwhelm you here. Place the shadow blocker beside the locked doors before crossing the furnace building."); return true; }
      if (!has(p, I.SHADOW_KEY) || !state.purpleKey) { p.sendMessage("The shadow realm door needs its purple shadow key."); return true; }
      p.getInventory().deleteNumber(I.SHADOW_KEY, 1);
      setLassar(p, { ...state, doorUnlocked: true, purpleKey: false });
      const manager = api.getItemOnGroundManager?.();
      const tile = new api.core.Location(2353, 6367, 0);
      if (manager?.registerLocation && !manager.getGroundItem?.(p.getUsername(), I.BASIC_SHADOW_TORCH_SCHEMATIC, tile, p.getPrivateArea?.() ?? null)) {
        manager.registerLocation(p, new Item(I.BASIC_SHADOW_TORCH_SCHEMATIC, 1), tile);
      }
      p.sendMessage("You unlock the furnace-house door with the purple key. Beyond it, you see a basic shadow torch schematic.");
      return false;
    }

    const teleporter = LASSAR_TELEPORTERS.find(([tx, ty, id]) => x === tx && y === ty
      && (visibleId === id || visibleId === 48201 || visibleId === 48202 || visibleId === 48203));
    if (teleporter && (option === "activate" || option === "travel" || option === "use" || option === "")) {
      const portalIndex = LASSAR_TELEPORTERS.indexOf(teleporter);
      const active = [...(state.teleporters ?? [])];
      const available = portalIndex < 3 || (state.blockerSchematic && state.greenKey && state.purpleKey)
        || (portalIndex === 6 && state.idolPlaced && state.basicTorch);
      if (!available) { p.sendMessage("This teleporter is still beyond a sealed district. Follow the Lassar devices and shadow keys first."); return true; }
      if (active[portalIndex]) {
        if (option === "activate") {
          p.sendMessage(`This Lassar teleporter is already active (${active.filter(Boolean).length}/7).`);
          return true;
        }
        const destinations = LASSAR_TELEPORTERS
          .map(([dx, dy], index) => active[index] ? [`${["Palace", "Plaza", "Northern Science District", "Southern Science District", "Western Residential District", "Cathedral", "Eastern Residential District"][index]}.`, () => {
            p.moveTo(new api.core.Location(dx, dy, 0));
            p.sendMessage(`The teleporter carries you to the ${["Palace", "Plaza", "Northern Science District", "Southern Science District", "Western Residential District", "Cathedral", "Eastern Residential District"][index]}.`);
          }] : null)
          .filter(Boolean);
        if (destinations.length) showLassarTeleporterDestinations(p, destinations);
        return true;
      }
      // The city record routes the first six teleporters in the same order as
      // the cache quest varbits; the final eastern device is unlocked by the idol.
      if (active.slice(0, portalIndex).length !== portalIndex || !active.slice(0, portalIndex).every(Boolean)) {
        p.sendMessage("Activate the earlier Lassar teleporters before this one.");
        return true;
      }
      active[portalIndex] = true;
      setLassar(p, { ...state, teleporters: active });
      p.sendMessage(`You activate the Lassar teleporter (${active.filter(Boolean).length}/7). Its routes now answer to the shadow network.`);
      return true;
    }

    if (state.inShadow && [48278, 48279, 48205, 48206, 48207, 48208, 48209, 48210, 48211, 48212].includes(visibleId)
      && ((x === 2417 && y === 6413) || (x === 2424 && y === 6439))) {
      const tentacles = { ...(state.tentacles ?? {}) };
      const key = `${x},${y}`;
      if (tentacles[key]) { p.sendMessage("The shadow tentacles have already been burned away."); return true; }
      if (!has(p, I.BASIC_SHADOW_TORCH)) { p.sendMessage("The tentacles only yield to the cleansing flame of the basic shadow torch."); return true; }
      if (x === 2417 && !state.blockerPlaced) { p.sendMessage("First place the shadow blocker beside the furnace-house doors, where it can protect you from lost souls."); return true; }
      if (x === 2424 && (!(state.teleporters ?? [])[6] || !state.idolPlaced || !tentacles["2417,6413"])) {
        p.sendMessage("The eastern tentacle path is sealed until the idol is placed beside its teleporter and the western tentacles are burned.");
        return true;
      }
      tentacles[key] = true;
      const next = { ...state, tentacles };
      if (x === 2417) {
        const manager = api.getItemOnGroundManager?.();
        if (manager?.registerLocation) registerLassarGroundItem(p, I.REVITALISING_IDOL_SCHEMATIC, 2677, 6422);
        p.sendMessage("The shadow tentacles recoil from the torch. The newly accessible residential house contains a revitalising idol schematic.");
      } else {
        if (!has(p, I.SHADOW_KEY_2)) registerLassarGroundItem(p, I.SHADOW_KEY_2, 2416, 6443);
        p.sendMessage("The second tentacle barrier burns away, revealing the blue shadow key beyond it.");
      }
      setLassar(p, next);
      return true;
    }
    if (state.inShadow && x === 2385 && y === 6427 && [48278, 48279, 48289, 48290].includes(visibleId)
      && (option === "open" || option === "enter")) {
      if (!state.pubBlocker) { p.sendMessage("Place the shadow blocker at the pub entrance in the material world before approaching these doors."); return true; }
      if (!has(p, I.SHADOW_KEY_2) || !state.blueKey) { p.sendMessage("The pub's shadow doors need the blue shadow key."); return true; }
      p.getInventory().deleteNumber(I.SHADOW_KEY_2, 1);
      const manager = api.getItemOnGroundManager?.();
      if (manager?.registerLocation) registerLassarGroundItem(p, I.SUPERIOR_SHADOW_TORCH_SCHEMATIC, 2381, 6423);
      setLassar(p, { ...state, pubOpened: true, blueKey: false });
      p.sendMessage("The blue key opens the shadow pub. You find a superior shadow torch schematic upstairs.");
      return false;
    }
    if (state.inShadow && visibleId === 48216 && option
      && (option === "restore sanity" || option === "touch" || option === "activate")) {
      if (!state.idolPlaced) { p.sendMessage("The revitalising idol has not been placed in Lassar yet."); return true; }
      const sanity = Math.max(0, Math.min(100, Number(state.sanity ?? 100)));
      setLassar(p, { ...state, sanity: Math.min(100, sanity + 50) });
      p.sendMessage("You draw strength from the revitalising idol, restoring 50% sanity.");
      return true;
    }
    if (state.inShadow && x === 2324 && y === 6402 && [48205, 48206, 48207, 48208, 48209, 48210, 48211, 48212].includes(visibleId)
      && (option === "open" || option === "burn" || option === "clear")) {
      if (!has(p, I.SUPERIOR_SHADOW_TORCH) || !state.superiorTorch) { p.sendMessage("Only the superior shadow torch can clear the deeper tentacles."); return true; }
      if (state.animaSchematicFound) { p.sendMessage("The tentacles have already been burned away here."); return true; }
      const manager = api.getItemOnGroundManager?.();
      if (manager?.registerLocation) registerLassarGroundItem(p, I.ANIMA_PORTAL_SCHEMATIC, 2324, 6402);
      setLassar(p, { ...state, animaSchematicFound: true });
      p.sendMessage("The superior torch burns through the tentacles and reveals an anima portal schematic.");
      return true;
    }
    if (state.inShadow && x === 2400 && y === 6393 && visibleId === 48211
      && (option === "burn" || option === "clear" || option === "open")) {
      if (!state.perfectTorch || !has(p, I.PERFECTED_SHADOW_TORCH)) {
        p.sendMessage("The cathedral's tentacles resist every light except the perfected shadow torch.");
        return true;
      }
      setLassar(p, { ...state, cathedralTentacles: true });
      p.sendMessage("The perfected torch burns away the tentacles sealing the Sunken Cathedral.");
      return true;
    }

    // The Ketla workshop and the real mirrored puddles are the puzzle's
    // intended device and realm transitions; retain their cache locations.
    if (x === 2645 && y >= 6438 && y <= 6442 && [48163, 49486].includes(visibleId)
      && (option === "search" || option === "make" || option === "operate")) {
      if (!state.ketlaBriefed) { p.sendMessage("Talk to Ketla and give her the appropriate schematic first."); return true; }
      if (state.blockerDesigned && !has(p, I.SHADOW_BLOCKER)) {
        p.getInventory().adds(I.SHADOW_BLOCKER, 1);
        setLassar(p, { ...state, blocker: true });
        p.sendMessage("You take the shadow blocker Ketla assembled from her workbench.");
        return true;
      }
      if (state.torchSchematic && !has(p, I.BASIC_SHADOW_TORCH)) {
        p.getInventory().adds(I.BASIC_SHADOW_TORCH, 1);
        setLassar(p, { ...state, basicTorch: true });
        p.sendMessage("You take the basic shadow torch Ketla assembled from her workbench.");
        return true;
      }
      if (state.idolSchematic && !has(p, I.REVITALISING_IDOL)) {
        p.getInventory().adds(I.REVITALISING_IDOL, 1);
        setLassar(p, { ...state, idol: true });
        p.sendMessage("You take the revitalising idol Ketla assembled from her workbench.");
        return true;
      }
      if (state.superiorTorchSchematic && !has(p, I.SUPERIOR_SHADOW_TORCH)) {
        p.getInventory().adds(I.SUPERIOR_SHADOW_TORCH, 1);
        setLassar(p, { ...state, superiorTorch: true });
        p.sendMessage("You take the superior shadow torch Ketla assembled from her workbench.");
        return true;
      }
      if (state.animaSchematic && !has(p, I.ANIMA_PORTAL)) {
        p.getInventory().adds(I.ANIMA_PORTAL, 1);
        setLassar(p, { ...state, animaPortal: true });
        p.sendMessage("You take the anima portal Ketla assembled from her workbench.");
        return true;
      }
      if (state.perfectTorchSchematic && !has(p, I.PERFECTED_SHADOW_TORCH)) {
        p.getInventory().adds(I.PERFECTED_SHADOW_TORCH, 1);
        setLassar(p, { ...state, perfectTorch: true });
        p.sendMessage("You take the perfected shadow torch from Ketla's workbench.");
        return true;
      }
      p.sendMessage("The workbench is clear. Bring Ketla another Lassar schematic to assemble.");
      return true;
    }
    if (visibleId === 48200 && option && (option === "enter" || option === "touch" || option === "activate")) {
      const inShadow = Boolean(state.inShadow);
      if (!has(p, I.BLACKSTONE_FRAGMENT) && !has(p, I.BLACKSTONE_FRAGMENT_2) && !has(p, I.BLACKSTONE_FRAGMENT_3)) {
        p.sendMessage("The blackstone fragment is needed to cross safely into the shadow realm.");
        return true;
      }
      const worldSide = x >= 2560;
      const nextX = worldSide ? x - 256 : x + 256;
      setLassar(p, { ...state, inShadow: !inShadow });
      p.moveTo(new api.core.Location(nextX, y, z));
      p.sendMessage(inShadow ? "You step back into the material world." : "You pass through the puddle into Lassar's shadow realm.");
      return true;
    }
    return false;
  }

  // Chatbox prompts support at most five choices. Keep four destinations visible
  // and use the fifth slot to page through the remaining active portals.
  function showLassarTeleporterDestinations(p, destinations, offset = 0) {
    const visible = destinations.slice(offset, offset + 4);
    const options = visible.flat();
    if (offset + visible.length < destinations.length) {
      options.push("More...", () => showLassarTeleporterDestinations(p, destinations, offset + visible.length));
    }
    api.sendMultiChatboxPrompt(p, "Choose an active Lassar teleporter", ...options);
  }

  function routeLassarSinkhole(event) {
    const location = event.object?.getLocation?.();
    if (stage(event.player) !== S.WHISPERER || event.clickType !== 1 || !location
      || location.getX() !== 2922 || location.getY() !== 5827 || location.getZ() !== 0
      || ![49477, 48195, 48196, 48197].includes(event.objectId)) return;
    // The cache rock occupies the only tile adjacent to the hole. Route the
    // normal Attach-rope/Climb-rope click to its walkable southern approach.
    event.destination = { x: 2922, y: 5826, z: 0 };
  }

  function registerLassarGroundItem(p, itemId, x, y, z = 0) {
    const manager = api.getItemOnGroundManager?.();
    if (!manager?.registerLocation) return;
    const tile = new api.core.Location(x, y, z);
    if (!manager.getGroundItem?.(p.getUsername(), itemId, tile, p.getPrivateArea?.() ?? null)) {
      manager.registerLocation(p, new Item(itemId, 1), tile);
    }
  }

  function ensureLassarIntroItems(p, state) {
    if (!state.entered || !(state.teleporters ?? []).slice(0, 3).every(Boolean)) return;
    // shortcut: QuestHelper's item markers overlap blocking cache barrels/crates/tables,
    // so these real ground drops use the nearest collision-walkable floor tiles.
    if (!state.blockerSchematic && !has(p, I.SHADOW_BLOCKER_SCHEMATIC)) {
      registerLassarGroundItem(p, I.SHADOW_BLOCKER_SCHEMATIC, 2591, 6380);
    }
    if (state.blockerSchematic && !state.greenKey && !has(p, I.SHADOW_KEY_5)) {
      registerLassarGroundItem(p, I.SHADOW_KEY_5, 2581, 6388);
    }
    if (state.greenKey && !state.purpleKey && !has(p, I.SHADOW_KEY)) {
      registerLassarGroundItem(p, I.SHADOW_KEY, 2592, 6352);
    }
  }

  function handleLassarGroundItemPickup(event) {
    const { player: p, groundItemId, location } = event;
    if (stage(p) !== S.WHISPERER || ![I.BASIC_SHADOW_TORCH_SCHEMATIC, I.REVITALISING_IDOL_SCHEMATIC, I.SHADOW_KEY_2,
      I.SHADOW_KEY_4, I.SHADOW_BLOCKER_SCHEMATIC, I.SHADOW_KEY_5, I.SHADOW_KEY,
      I.SUPERIOR_SHADOW_TORCH_SCHEMATIC, I.ANIMA_PORTAL_SCHEMATIC].includes(groundItemId)) return;
    const state = p.getAttribute(LASSAR) ?? {};
    const x = location?.getX?.() ?? location?.x;
    const y = location?.getY?.() ?? location?.y;
    const basicTorchSchematic = groundItemId === I.BASIC_SHADOW_TORCH_SCHEMATIC;
    const idolSchematic = groundItemId === I.REVITALISING_IDOL_SCHEMATIC;
    const blueKey = groundItemId === I.SHADOW_KEY_2;
    const redKey = groundItemId === I.SHADOW_KEY_4;
    const superiorSchematic = groundItemId === I.SUPERIOR_SHADOW_TORCH_SCHEMATIC;
    const animaSchematic = groundItemId === I.ANIMA_PORTAL_SCHEMATIC;
    const blockerSchematic = groundItemId === I.SHADOW_BLOCKER_SCHEMATIC;
    const greenShadowKey = groundItemId === I.SHADOW_KEY_5;
    const purpleShadowKey = groundItemId === I.SHADOW_KEY;
    const firstThree = state.entered && (state.teleporters ?? []).slice(0, 3).every(Boolean);
    const accessible = basicTorchSchematic ? x === 2353 && y === 6367 && state.doorUnlocked && state.inShadow
      : idolSchematic ? x === 2677 && y === 6422 && state.tentacles?.["2417,6413"]
        : blueKey ? x === 2416 && y === 6443 && state.tentacles?.["2424,6439"] && state.inShadow
          : redKey ? x === 2638 && y === 6405 && state.redKeyFound
      : blockerSchematic ? x === 2591 && y === 6380 && firstThree
            : greenShadowKey ? x === 2581 && y === 6388 && state.blockerSchematic
              : purpleShadowKey ? x === 2592 && y === 6352 && state.greenKey
          : superiorSchematic ? x === 2381 && y === 6423 && state.pubOpened && state.inShadow
            : x === 2324 && y === 6402 && state.animaSchematicFound && state.inShadow;
    if (!accessible) {
      event.handled = true;
      p.sendMessage("That Lassar item is not accessible yet. Complete the shadow devices blocking its room.");
      return;
    }
    setLassar(p, { ...state,
      ...(basicTorchSchematic ? { torchSchematicFound: true } : {}),
      ...(idolSchematic ? { idolSchematicFound: true } : {}),
      ...(blueKey ? { blueKey: true } : {}),
      ...(redKey ? { redKey: true } : {}),
      ...(superiorSchematic ? { superiorSchematicFound: true } : {}),
      ...(animaSchematic ? { animaSchematicFound: true } : {}),
      ...(blockerSchematic ? { blockerSchematic: true } : {}),
      ...(greenShadowKey ? { greenKey: true } : {}),
      ...(purpleShadowKey ? { purpleKey: true } : {}),
    });
  }

  quest = registerQuest(api, {
    key: "desert_treasure_ii", name: "Desert Treasure II - The Fallen Empire", varpId: 3786, varbitId: 14862,
    startedValue: S.STARTED, completionValue: S.COMPLETE, questPoints: 5, varbitValue: nativeProgress,
    otherRewards: ["Ring of shadows", "Three ancient lamps", "Access to Vardorvis, the Leviathan, Duke Sucellus and the Whisperer"], buildJournal,
  });
  ["desert-treasure-ii:statues", CELLS_INSERTED, CELL_POSITIONS,
    GOLEM_SOLVED, SEARCHED_NAMES, BANIKAN_LEFT].forEach((key) => api.persistAttribute(key));
  api.persistAttribute(LASSAR);
  api.persistAttribute(VARDORVIS_PROGRESS);
  api.persistAttribute(STRANGLEWOOD_CITY_ENTERED);
  api.persistAttribute(ATTR_SMITH_INTRO);
  api.persistAttribute(STATUES_PLACED);
  api.persistAttribute(ATTR_FIRST_MEDALLION_MEETING);
  [FINAL_CELL_ACTIVE, FINAL_CELL_SOLUTION, FINAL_CELL_GUESS, FINAL_CELL_ATTEMPTS, FINAL_CELL_OPEN, FINAL_CELL_GEAR,
    FINAL_CELL_CHEST, FINAL_FIGURE_STARTED, FINAL_FIGURE_DEFEATED, "desert-treasure-ii:final-cell-pending",
    "desert-treasure-ii:final-cutscene-started", FINAL_WIGHT_INDEX, FINAL_WIGHTS_STARTED, FINAL_WIGHTS_COMPLETE].forEach((key) => api.persistAttribute(key));
  [SUCELLUS_MUSHROOMS, SUCELLUS_VATS, SUCELLUS_POISONS, SUCELLUS_DEFEATED, SUCELLUS_WEST_ROOM,
    SUCELLUS_CELL_PROGRESS, SUCELLUS_CELL_ENTERED, SUCELLUS_CELL_ESCAPED, SUCELLUS_ASSASSIN_GONE, SUCELLUS_CAPTAIN_ACCEPTED,
    SUCELLUS_PRISON_GEAR, SUCELLUS_PRISON_PROGRESS, SUCELLUS_PRISON_CHECKPOINT, SUCELLUS_PRISON_COMPLETE].forEach((key) => api.persistAttribute(key));
  [SCAR_DEMONS_DEFEATED, SCAR_BOAT_TRIED, SCAR_PERSTEN_TALKED, SCAR_PERSTEN_TALKED_BEFORE,
    SCAR_PERSTEN_ROOM1_TALKED, SCAR_BOAT_ROOM, SCAR_TINDERBOX_FOUND, SCAR_SLIMY_KEY_FOUND,
    SCAR_GUNPOWDER_FOUND, SCAR_OLD_TABLET_READ, SCAR_BOAT_CHEST_OPEN, SCAR_BOAT_BURNED,
    SCAR_PERSTEN_ROOM2_TALKED, SCAR_BOAT2_BURNED, SCAR_MAZE_TWO_ENTERED, SCAR_AXON_ROOM_COMPLETE, SCAR_AXON_TERMINALS,
    SCAR_NERVE_ROOM_TWO_COMPLETE, SCAR_NERVE_ROOM_TWO_REPAIRED, SCAR_SUMMON_ROOM_COMPLETE,
    "desert-treasure-ii:scar-boat-room-two-chest-open", "desert-treasure-ii:scar-growth-complete",
    SCAR_MAZE_THREE_ACTIVE, SCAR_MEMORY_ORDER, SCAR_MEMORY_STEP, SCAR_MEMORY_COMPLETE,
    SCAR_TREE_COMPLETE, SCAR_LEECH_GROWTHS_REPAIRED, SCAR_BLOOD_RED_COUNT, SCAR_BLOOD_WHITE_COUNT,
    SCAR_BLOOD_RED_REPAIRED, SCAR_BLOOD_WHITE_REPAIRED, SCAR_LEECH_COMPLETE, SCAR_BOAT3_BURNED,
    SCAR_BOAT3_ROOM, SCAR_PERSTEN_ROOM3_TALKED, SCAR_LEVIATHAN_READY, SCAR_LEVIATHAN_KILLED,
    SCAR_PERSTEN_AT_SHIP, SCAR_SHIP_REACHED, SCAR_PERSTEN_LEFT_SHIP, SCAR_LEVIATHAN_DEBRIS_SEARCHED,
    "desert-treasure-ii:scar-boat3-chest-open", "desert-treasure-ii:scar-boat3-tablet-read"].forEach((key) => api.persistAttribute(key));
  [SCAR_GUARDIAN_ACCEPTED, SCAR_MAZE_ONE_ENTERED, SCAR_TETHER_DESTROYED, SCAR_PATH_COMPLETE].forEach((key) => api.persistAttribute(key));
  api.persistAttribute(SCAR_CATALYST_PROGRESS);
  api.persistAttribute(SCAR_CATALYST_ORDER);
  api.persistAttribute(SCAR_GROWTH_LURES);
  api.persistAttribute(SCAR_GROWTH_STEP);
  api.persistAttribute(SCAR_GROWTH_ORDER);
  api.persistAttribute("desert-treasure-ii:scar-growth-repaired");
  [GOLEM_INSPECTED, ALTAR_INSPECTED, TOTEMS_CHARGED, TOTEM_MASK, BANIKAN_BRIEFED].forEach((key) => api.persistAttribute(key));
  api.onObjectInteraction(handleObjectInteraction);
  api.onObjectInteraction("Gate", { Open: openSucellusGate });
  api.onObjectRoute(handleScarStoneRoute);
  api.onObjectRoute(routeLassarSinkhole);
  api.onObjectRoute(routeSucellusVat);
  api.onItemOnObject(handleItemOnObject, { noted: false });
  api.onGroundItemPickup(handleLassarGroundItemPickup);
  api.onItemOnItem(handleItemOnItem, { noted: false });
  api.onItemAction(handleItemAction);
  api.onCustomEvent("player:widget-action", onWidgetAction);
  api.onCustomEvent("npc-dialogue:action", handleDialogueAction);
  api.onNpcDialogueCondition(resolveGolemSearchCondition);
  api.onNpcDialogueCondition(resolveSucellusCellCondition);
  api.onCustomEvent("dt2:sucellus-prison-return-stash", returnSucellusPrisonStash);
  api.onCustomEvent("dt2:sucellus-prison-complete", completeSucellusPrison);
  api.onCustomEvent("npc-dialogue:line", handleDialogueLine);
  api.onCustomEvent("npc-dialogue:choice", handleDialogueChoice);
  api.onCustomEvent("magic:hit-effects", activateTotem);
  api.onCustomEvent("magic:hit-effects", stunLeviathan);
  api.onCombatHitRoll(forceTotemAccuracy);
  api.onCombatHitRoll(leviathanHitRoll);
  api.onNpcHitModify(modifyLeviathanHit);
  api.onNpcHitModify(modifyGuardianHit);
  api.onNpcHitModify(preventTotemDamage);
  api.onNpcInteraction("Abyssal axon", { Hit: hitScarAxon, Reset: resetScarAxon });
  api.onNpcHitModify(preventScarSummonProtection);
  api.onNpcHitModify(handleWhispererHit);
  api.onNpcHitModify(handleFinalFigureHit);
  api.onNpcInteraction("Asgarnia Smith", { "Talk-to": talkSmith });
  api.onNpcInteraction("Cerebral pathfinder", { Move: pushScarPathRunner });
  api.onNpcInteraction("Cerebral pathbreaker", { Move: pushScarPathRunner });
  api.onNpcRoute(routeToScarPathRunner);
  api.onNpcInteraction("Terry Balando", { "Talk-to": talkTerry });
  api.onNpcInteraction("Dr Banikan", { "Talk-to": talkBanikan });
  // QuestHelper marks the ruins approach at 1194,3394.
  api.registerArea(new StranglewoodRuinsArea([new api.core.Boundary(1189, 1200, 3392, 3398, 0)]));
  api.onNpcInteraction("Elissa", { "Talk-to": talkElissa });
  api.onNpcInteraction("Barus", { "Talk-to": talkBarus });
  api.onNpcInteraction("Kasonde", { "Talk-to": talkKasonde });
  api.onObjectInteraction("Barricade", { "Climb-over": crossStranglewoodBarricade });
  api.onNpcInteraction("Ramarno", { "Talk-to": talkRamarno });
  api.onNpcInteraction("Prescott", { "Talk-to": talkPrescott });
  api.onNpcDialogueCondition(answerPrescottCondition);
  api.onNpcInteraction("Wizard Persten", { "Talk-to": progressBosses });
  api.onNpcInteraction("Captain Malleta", { "Talk-to": progressBosses });
  api.onNpcInteraction("Ketla", { "Talk-to": progressBosses });
  api.onNpcInteraction("Catalytic Guardian", { "Talk-to": talkCatalyticGuardian });
  api.onNpcInteraction("<col=00ffff>Catalyst</col>", { Observe: inspectScarCatalyst });
  api.onNpcInteraction("Light leech", { "Take-lure": takeScarLightLure });
  api.onNpcInteraction("Vardorvis", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Leviathan", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("Duke Sucellus", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("The Whisperer", { "Talk-to": handleBossTalk });
  api.onNpcInteraction("Odd Figure", { Disturb: handleBossTalk, "Talk-to": handleBossTalk });
  api.onNpcDeath(handleDeath);
  api.registerNpcCombatMethodProvider(N.VARDORVIS_2, VardorvisCombat);
  api.registerNpcCombatMethodProvider(N.KASONDE_7, KasondeCombat);
  api.onCombatHitRoll(vardorvisHitRoll);
  api.onCombatHitResolved(vardorvisHitResolved);
  api.onPrayerDisabled(vardorvisPrayerDisabled);
  api.onItemOnNpc(handleNerveOnCatalyst);
  api.onItemOnNpc(handleSucellusItemOnNpc);
  api.onGroundItemPickup(handleSucellusGroundItemPickup);
  api.onGroundItemPickup(handleVardorvisGroundItemPickup);
  api.onPlayerLogin(handleLogin);
  api.onPlayerProcess(handleLassarProcess);
  api.onPlayerLogout(handleLogout);
  api.onPlayerDisconnect(handleLogout);
  require("../dt2/Prison.DesertTreasureII")(api);
};
