/** Dragon Slayer II: the transcript supplies the conversations; this plugin owns the quest state and world actions. */
module.exports = function registerDragonSlayerII(api) {
  const { Skill, Location, Boundary, PrivateArea, TemplatedInstanceArea, GameObject, ObjectManager, NPC, World, PrayerHandler, HitDamage, HitMask, ItemIdentifiers: I, NpcIdentifiers: N, ObjectIdentifiers: O } = api.core;
  const { registerQuest, startTranscript } = require("../QuestRuntime");
  const PAGE = "Dragon Slayer II";
  const S = { START: 1, KARAMJA: 2, TUNNEL: 3, MURAL: 4, DREAM: 5, KEYS: 6, FORGE: 7, LITHKREN: 8, LEADERS: 9, FLEET: 10, GALVEK: 11, COMPLETE: 12 };
  const KEY_PARTS = [I.DRAGON_KEY_PIECE, I.DRAGON_KEY_PIECE_2, I.DRAGON_KEY_PIECE_3, I.DRAGON_KEY_PIECE_4];
  const RELDO_BOOKCASE_IDS = [O.BOOKCASE_29, O.BOOKCASE_32];
  const UNGAEL_NOTES = [I.OLD_NOTES, I.OLD_NOTES_2, I.OLD_NOTES_3, I.OLD_NOTES_4, I.OLD_NOTES_5, I.OLD_NOTES_6];
  const UNGAEL_LAB_SOURCE_X = 2248;
  const UNGAEL_LAB_SOURCE_Y = 10448;
  const UNGAEL_NOTE_OBJECTS = new Map([
    [O.ANCIENT_MACHINERY_2, { x: 2254, y: 10465, item: UNGAEL_NOTES[0] }],
    [O.ANCIENT_MACHINERY_3, { x: 2288, y: 10456, item: UNGAEL_NOTES[1] }],
    [O.ANCIENT_EQUIPMENT, { x: 2290, y: 10474, item: UNGAEL_NOTES[2] }],
    [O.ANCIENT_INCUBATOR, { x: 2273, y: 10476, item: UNGAEL_NOTES[3] }],
    [O.ANCIENT_EQUIPMENT_2, { x: 2273, y: 10455, item: UNGAEL_NOTES[4] }],
    [O.ANCIENT_INCUBATOR_2, { x: 2279, y: 10464, item: UNGAEL_NOTES[5] }],
  ]);
  const ASSAULT_DRAGONS = [N.BLACK_DRAGON, N.STEEL_DRAGON, N.BRUTAL_RED_DRAGON,
    N.MITHRIL_DRAGON, N.ADAMANT_DRAGON, N.RUNE_DRAGON];
  const ATTR_LEADERS = "dragon-slayer-ii:leaders";
  const ATTR_PARTS = "dragon-slayer-ii:key-parts";
  const ATTR_AREA = "dragon-slayer-ii:instance-area";
  const ATTR_KARAMJA_INSTANCE_ACTIVE = "dragon-slayer-ii:karamja-instance-active";
  const ATTR_BOSS = "dragon-slayer-ii:instance-boss";
  const ATTR_ASSAULT_INDEX = "dragon-slayer-ii:assault-index";
  const ATTR_ASSAULT_CHECKPOINT = "dragon-slayer-ii:assault-checkpoint";
  const QUEST_POINTS_ATTRIBUTE = "quest.points";
  const ATTR_MORYTANIA = "dragon-slayer-ii:morytania-step";
  const ATTR_ORB_TARGET = "dragon-slayer-ii:locator-target";
  const ATTR_MURAL_READ = "dragon-slayer-ii:mural-read";
  const ATTR_MURAL_GUARDIAN_DEFEATED = "dragon-slayer-ii:mural-guardian-defeated";
  const ATTR_FORGE_HEADS = "dragon-slayer-ii:forge-heads";
  const ATTR_UNGAEL_TRIP = "dragon-slayer-ii:ungael-trip";
  const ATTR_VORKATH_DEFEATED = "dragon-slayer-ii:vorkath-defeated";
  const VARBIT_UNGAEL_EXIT = 6108;
  const ATTR_LAB_TIMER = "dragon-slayer-ii:lab-timer";
  const ATTR_UNGAEL_LAB_ACTIVE = "dragon-slayer-ii:ungael-lab-active";
  const ATTR_CRYPT_ACTIVE = "dragon-slayer-ii:kourend-crypt-active";
  const ATTR_CRYPT_READY = "dragon-slayer-ii:kourend-crypt-ready";
  const ATTR_CRYPT_ORDER = "dragon-slayer-ii:kourend-crypt-order";
  const ATTR_CRYPT_PLACED = "dragon-slayer-ii:kourend-crypt-placed";
  const ATTR_NOTES_READ = "dragon-slayer-ii:notes-read";
  const ATTR_KARAMJA_JOURNAL = "dragon-slayer-ii:malumac-journal";
  const ATTR_ROWBOAT_BUILT = "dragon-slayer-ii:lithkren-rowboat-built";
  const ATTR_LITHKREN_ARRIVED = "dragon-slayer-ii:lithkren-arrived";
  const ATTR_AIVAS_DIARY = "dragon-slayer-ii:aivas-diary";
  const ATTR_AIVAS_DIARY_FOUND = "dragon-slayer-ii:aivas-diary-found";
  const ATTR_GALVEK_DEFEATED = "dragon-slayer-ii:galvek-defeated";
  // No cached loc exists for the quest-built boat; place the space beside the
  // Lithkren NPC anchors on a shoreline tile confirmed reachable by normal routing.
  const ROWBOAT_SPACE_TILE = { x: 3661, y: 3847, z: 0 };
  const LITHKREN_LANDING = new Location(3760, 3869, 0);
  let rowboatObject;
  const KARAMJA_INSTANCE = { sourceChunkX: 352, sourceChunkY: 1150, widthChunks: 8, heightChunks: 13 };
  const KARAMJA_SOURCE = { x: 2816, y: 9200 };
  const KARAMJA_ENTRANCE = { x: 2943, y: 2894, z: 0 };
  const KARAMJA_EXIT = { x: 2942, y: 2892, z: 0 };
  const KARAMJA_START = { x: 2846, y: 9292, z: 0 };
  const KARAMJA_PLINTH = { x: 2848, y: 9248, z: 0 };
  const KARAMJA_GUARDIAN_BOX = { minX: 2816, maxX: 2880, minY: 9216, maxY: 9280 };
  const KARAMJA_TRAPS = new Set([O.TRAP_9, O.TRAP_10, O.TRAP_11, O.TRAP_12]);
  const spawnRows = require("../../../data/definitions/npc-spawns.json");
  let quest;
  let QuestArea;
  let KaramjaArea;
  let UngaelLabArea;
  let KourendCryptArea;

  function defineArea() {
    QuestArea = class DragonSlayerIIArea extends PrivateArea {
      constructor(ownerName, boundary) { super([boundary]); this.ownerName = ownerName; }
      process(mobile) {
        if (!mobile?.isPlayer?.()) return;
        const player = mobile.getAsPlayer();
        const boss = player.getAttribute(ATTR_BOSS);
        if (!boss) return;
        boss.setScriptedMovement(true);
        boss.getCombat().getLastAttack().reset();
        if (boss.getId?.() === N.GALVEK_2 && stage(player) === S.GALVEK) processGalvek(this, player, boss);
      }
      destroy() {
        if (this.isDestroyed?.()) return;
        const addQueue = World.getAddNPCQueue(), removeQueue = World.getRemoveNPCQueue();
        for (const entity of this.entities) {
          if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
          const npc = entity.getAsNpc();
          for (let i = addQueue.indexOf(npc); i >= 0; i = addQueue.indexOf(npc)) addQueue.splice(i, 1);
          if (npc.isRegistered?.() && !removeQueue.includes(npc)) removeQueue.push(npc);
        }
        super.destroy();
      }
      postLeave(mobile, logout) {
        if (mobile?.isPlayer?.()) {
          const player = mobile.getAsPlayer();
          if (player.getAttribute(ATTR_AREA) === this) player.setAttribute(ATTR_AREA, null);
          player.setAttribute(ATTR_BOSS, null);
        }
        super.postLeave(mobile, logout);
      }
    };
    KaramjaArea = class DragonSlayerIIKaramjaArea extends TemplatedInstanceArea {
      constructor(owner) {
        super(KARAMJA_INSTANCE.widthChunks, KARAMJA_INSTANCE.heightChunks);
        this.owner = owner;
        for (let chunkX = 0; chunkX < KARAMJA_INSTANCE.widthChunks; chunkX++) {
          for (let chunkY = 0; chunkY < KARAMJA_INSTANCE.heightChunks; chunkY++) {
            for (let plane = 0; plane < 4; plane++) {
              this.setChunk(plane, chunkX, chunkY, plane === 0 ? {
                sourceChunkX: KARAMJA_INSTANCE.sourceChunkX + chunkX,
                sourceChunkY: KARAMJA_INSTANCE.sourceChunkY + chunkY,
                sourcePlane: 0,
                rotation: 0,
              } : null);
            }
          }
        }
        this.plinth = null;
        let parts = Number(owner.getAttribute(ATTR_PARTS)) || 0;
        if ((parts & 1) && !has(owner, KEY_PARTS[0])) {
          parts &= ~1;
          owner.setAttribute(ATTR_PARTS, parts);
        }
        this.installPlinth(parts & 1 ? O.PLINTH_18 : O.PLINTH_17);
      }
      getName() { return "Karamjan Temple (Dragon Slayer II)"; }
      isMulti() { return true; }
      allowSummonPet() { return false; }
      installPlinth(id) {
        if (this.plinth) {
          ObjectManager.deregister(this.plinth, true);
          this.remove(this.plinth);
        }
        this.plinth = new GameObject(id, this.tile(KARAMJA_PLINTH.x - KARAMJA_SOURCE.x,
          KARAMJA_PLINTH.y - KARAMJA_SOURCE.y, KARAMJA_PLINTH.z), 10, 0, this);
        ObjectManager.register(this.plinth, true);
        this.add(this.plinth);
      }
      destroy() {
        if (this.isDestroyed()) return;
        for (const entity of [...this.entities]) {
          if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
          const npc = entity.getAsNpc();
          for (let i = World.getAddNPCQueue().indexOf(npc); i >= 0; i = World.getAddNPCQueue().indexOf(npc)) World.getAddNPCQueue().splice(i, 1);
          if (npc.isRegistered?.() && !World.getRemoveNPCQueue().includes(npc)) World.getRemoveNPCQueue().push(npc);
        }
        super.destroy();
      }
      postLeave(mobile, logout) {
        if (mobile?.isPlayer?.() && mobile.getAsPlayer().getAttribute(ATTR_AREA) === this) {
          mobile.getAsPlayer().setAttribute(ATTR_AREA, null);
          mobile.getAsPlayer().setAttribute(ATTR_BOSS, null);
        }
        super.postLeave(mobile, logout);
      }
    };
    UngaelLabArea = class DragonSlayerIIUngaelLabArea extends TemplatedInstanceArea {
      constructor(owner) {
        super(6, 4);
        this.owner = owner;
        for (let chunkX = 0; chunkX < 6; chunkX++) {
          for (let chunkY = 0; chunkY < 4; chunkY++) {
            for (let plane = 0; plane < 4; plane++) {
              this.setChunk(plane, chunkX, chunkY, plane === 0 ? {
                sourceChunkX: 281 + chunkX,
                sourceChunkY: 1306 + chunkY,
                sourcePlane: 0,
                rotation: 0,
              } : null);
            }
          }
        }
      }
      getName() { return "Ungael laboratory (Dragon Slayer II)"; }
      allowSummonPet() { return false; }
      destroy() {
        if (this.isDestroyed()) return;
        for (const entity of [...this.entities]) {
          if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
          const npc = entity.getAsNpc();
          for (let i = World.getAddNPCQueue().indexOf(npc); i >= 0; i = World.getAddNPCQueue().indexOf(npc)) World.getAddNPCQueue().splice(i, 1);
          if (npc.isRegistered?.() && !World.getRemoveNPCQueue().includes(npc)) World.getRemoveNPCQueue().push(npc);
        }
        super.destroy();
      }
      postLeave(mobile, logout) {
        if (mobile?.isPlayer?.() && mobile.getAsPlayer().getAttribute(ATTR_AREA) === this) {
          mobile.getAsPlayer().setAttribute(ATTR_AREA, null);
          mobile.getAsPlayer().setAttribute(ATTR_BOSS, null);
        }
        super.postLeave(mobile, logout);
      }
    };
    KourendCryptArea = class DragonSlayerIIKourendCryptArea extends TemplatedInstanceArea {
      constructor(owner) {
        super(12, 8);
        this.owner = owner;
        for (let chunkX = 0; chunkX < 12; chunkX++) {
          for (let chunkY = 0; chunkY < 8; chunkY++) {
            for (let plane = 0; plane < 4; plane++) {
              this.setChunk(plane, chunkX, chunkY, {
                sourceChunkX: 184 + chunkX,
                sourceChunkY: 1240 + chunkY,
                sourcePlane: plane,
                rotation: 0,
              });
            }
          }
        }
      }
      getName() { return "Shayzien Crypts (Dragon Slayer II)"; }
      isMulti() { return true; }
      allowSummonPet() { return false; }
      destroy() {
        if (this.isDestroyed()) return;
        for (const entity of [...this.entities]) {
          if (!entity?.isNpc?.() || !entity.getAsNpc) continue;
          const npc = entity.getAsNpc();
          for (let i = World.getAddNPCQueue().indexOf(npc); i >= 0; i = World.getAddNPCQueue().indexOf(npc)) World.getAddNPCQueue().splice(i, 1);
          if (npc.isRegistered?.() && !World.getRemoveNPCQueue().includes(npc)) World.getRemoveNPCQueue().push(npc);
        }
        for (const object of this.puzzleObjects ?? []) {
          ObjectManager.deregister(object, true);
          this.remove(object);
        }
        super.destroy();
      }
      postLeave(mobile, logout) {
        if (mobile?.isPlayer?.() && mobile.getAsPlayer().getAttribute(ATTR_AREA) === this) {
          mobile.getAsPlayer().setAttribute(ATTR_AREA, null);
          mobile.getAsPlayer().setAttribute(ATTR_BOSS, null);
        }
        super.postLeave(mobile, logout);
      }
    };
  }

  const stage = (p) => quest.getStage(p);
  const advance = (p, value) => { if (stage(p) < value) quest.setStage(p, value); };
  const has = (p, id, amount = 1) => p.getInventory().getAmount(id) >= amount;
  function give(p, id, amount = 1) {
    if (p.getInventory().getFreeSlots() < (amount > 1 ? 1 : 1)) { p.sendMessage("You need an empty inventory space."); return false; }
    p.getInventory().adds(id, amount); return true;
  }
  function remove(p, id, amount = 1) { p.getInventory().deleteNumber(id, amount); }
  function talk(p, npcId, variant) { return startTranscript(api, p, npcId, PAGE, variant); }
  function buildJournal(p) {
    const s = stage(p);
    if (s >= S.COMPLETE) return ["<str>I defeated Galvek and saved the kingdoms.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (s >= S.GALVEK) return [p.getAttribute(ATTR_GALVEK_DEFEATED)
      ? "Return to Alec Kincade at the Myths' Guild and report your victory."
      : "Defeat Galvek and report to the heroes aboard the ship."];
    if (s >= S.FLEET) return ["Help defend the allied fleet from Zorgoth and Galvek."];
    if (s >= S.LEADERS) return ["Gather the leaders of Misthalin, Asgarnia, Kandarin and the Fremennik Isles."];
    if (s >= S.LITHKREN) return ["Enter Lithkren with the completed dragon key and learn what Zorgoth plans."];
    if (s >= S.FORGE) return ["Take the dragon key to Lithkren."];
    if (s >= S.KEYS) return ["Find the four dragon key pieces and use an anvil to reforge them."];
    if (s >= S.DREAM) return ["Speak to Bob on Lunar Isle and investigate Robert the Strong's memories."];
    if (s >= S.MURAL) return ["Speak to Dallas Jones about the mural and report to the Oneiromancer."];
    if (s >= S.TUNNEL) return ["Investigate the ancient mural beyond the tunnel."];
    if (s >= S.KARAMJA) return ["Use a pickaxe on the northern wall in Elvarg's lair."];
    if (s >= S.START) return ["Meet Dallas Jones at the Karamja pub."];
    return ["Speak to Alec Kincade outside the Myths' Guild."];
  }
  function talkAlec({ player: p, npcId }) {
    if (stage(p) === 0) {
      const skills = p.getSkillManager();
      const requirements = [
        ["Magic", Skill.MAGIC, 75], ["Smithing", Skill.SMITHING, 70],
        ["Mining", Skill.MINING, 68], ["Crafting", Skill.CRAFTING, 62],
        ["Agility", Skill.AGILITY, 60], ["Thieving", Skill.THIEVING, 60],
        ["Construction", Skill.CONSTRUCTION, 50], ["Hitpoints", Skill.HITPOINTS, 50],
      ];
      const missingSkill = requirements.find(([, skill, level]) => skills.getMaxLevel(skill) < level);
      if (missingSkill) return p.sendMessage(`You need ${missingSkill[2]} ${missingSkill[0]} to begin this quest.`);
      if ((Number(p.getAttribute(QUEST_POINTS_ATTRIBUTE)) || 0) < 200) return p.sendMessage("You need at least 200 Quest Points to begin this quest.");
      const prerequisite = { player: p, key: "legends_quest", complete: false };
      api.emitCustomEvent("quest:is-complete", prerequisite);
      if (!prerequisite.complete) return p.sendMessage("You need to complete Legends' Quest before starting this quest.");
      talk(p, npcId, "starting-out-talking-to-alec-kincade"); advance(p, S.START);
    }
    else if (stage(p) === S.GALVEK && p.getAttribute(ATTR_GALVEK_DEFEATED)) talk(p, npcId, "finishing-up");
    else if (stage(p) < S.COMPLETE) talk(p, npcId, "starting-out-talking-to-alec-kincade-talking-to-alec-again");
    else talk(p, npcId, "finishing-up");
  }
  function talkDallas({ player: p, npcId }) {
    if (stage(p) < S.START) return;
    if (stage(p) === S.START) { talk(p, npcId, "starting-out-talking-to-dallas-jones"); advance(p, S.KARAMJA); }
    else if (stage(p) === S.MURAL) {
      talk(p, npcId, "starting-out-the-secret-laboratory-talking-to-dallas-after-inspecting-the-mural");
      if (p.getAttribute(ATTR_MURAL_READ)) {
        advance(p, S.DREAM);
      }
    }
    else if (stage(p) >= S.KEYS && stage(p) < S.LEADERS && p.getAttribute(ATTR_LITHKREN_ARRIVED)) {
      if (p.getAttribute(ATTR_AIVAS_DIARY_FOUND)) {
        startTranscript(api, p, npcId, PAGE, "to-lithkren-talking-to-dallas-after-finding-aivas-diary", (steps) => {
          const condition = steps.find((step) => step.id === "SguGCm");
          if (!condition) return steps;
          const branch = condition.steps[p.getAttribute(ATTR_AIVAS_DIARY) ? 1 : 0];
          return steps.flatMap((step) => step === condition ? (branch?.steps ?? []) : [step]);
        });
      } else talk(p, npcId, "to-lithkren-talking-to-dallas-at-the-ancient-doors");
    }
    else if (stage(p) >= S.KEYS && stage(p) < S.LEADERS && (!p.getAttribute(ATTR_LITHKREN_ARRIVED)
      && (stage(p) >= S.LITHKREN || nearRowboat(p)))) {
      talk(p, npcId, p.getAttribute(ATTR_ROWBOAT_BUILT)
        ? "to-lithkren-talking-to-dallas-at-the-rowboat-space-after-building-the-boat"
        : "to-lithkren-talking-to-dallas-at-the-rowboat-space");
    }
    else if (stage(p) >= S.KEYS && stage(p) < S.FORGE) talk(p, npcId, "the-house-on-the-hill-talking-to-dallas");
    else if (stage(p) >= S.LITHKREN) talk(p, npcId, "the-ultimate-weapon-talking-to-dallas");
  }
  function talkJardric({ player: p, npcId, location }) {
    if (stage(p) < S.KEYS || stage(p) >= S.COMPLETE) return;
    const here = location ?? p.getLocation();
    const x = here.getX?.() ?? here.x;
    const y = here.getY?.() ?? here.y;
    const atBoat = Math.max(Math.abs(x - ROWBOAT_SPACE_TILE.x), Math.abs(y - ROWBOAT_SPACE_TILE.y)) <= 12;
    const variant = atBoat ? "to-lithkren-talking-to-jardric-at-the-rowboat-space"
      : p.getAttribute(ATTR_ROWBOAT_BUILT) ? "to-lithkren-talking-to-jardric-talking-to-jardric-again"
        : "to-lithkren-talking-to-jardric";
    talk(p, npcId, variant);
  }
  function nearRowboat(p) {
    const loc = p.getLocation();
    return Math.max(Math.abs(loc.getX() - ROWBOAT_SPACE_TILE.x), Math.abs(loc.getY() - ROWBOAT_SPACE_TILE.y)) <= 20;
  }
  function installRowboatObject(id) {
    if (rowboatObject) ObjectManager.deregister(rowboatObject, true);
    rowboatObject = new GameObject(id, new Location(ROWBOAT_SPACE_TILE.x, ROWBOAT_SPACE_TILE.y, ROWBOAT_SPACE_TILE.z), 10, 0, null);
    ObjectManager.register(rowboatObject, true);
  }
  function buildLithkrenRowboat({ player: p, objectId, location }) {
    if (objectId !== O.ROWBOAT_SPACE || location.x !== ROWBOAT_SPACE_TILE.x || location.y !== ROWBOAT_SPACE_TILE.y || location.z !== 0
      || stage(p) < S.KEYS || stage(p) >= S.COMPLETE) return false;
    if (p.getAttribute(ATTR_ROWBOAT_BUILT)) return travelRowboat({ player: p, objectId, location });
    if (p.getSkillManager().getMaxLevel(Skill.CONSTRUCTION) < 50) return p.sendMessage("You need at least 50 Construction to build the rowboat.");
    if (!has(p, I.HAMMER) || !has(p, I.SAW)) return p.sendMessage("You need a hammer and a saw to build the rowboat.");
    if (!has(p, I.OAK_PLANK, 8) || !has(p, I.SWAMP_PASTE, 10)) return p.sendMessage("You need 8 oak planks and 10 swamp paste to build the rowboat.");
    const nails = [I.BRONZE_NAILS, I.IRON_NAILS, I.BLACK_NAILS, I.MITHRIL_NAILS, I.ADAMANTITE_NAILS, I.RUNE_NAILS];
    if (nails.reduce((total, id) => total + p.getInventory().getAmount(id), 0) < 12) return p.sendMessage("You need at least 12 nails of any kind.");
    remove(p, I.OAK_PLANK, 8); remove(p, I.SWAMP_PASTE, 10);
    let remaining = 12;
    for (const id of nails) {
      const used = Math.min(remaining, p.getInventory().getAmount(id));
      if (used > 0) remove(p, id, used);
      remaining -= used;
      if (remaining === 0) break;
    }
    p.setAttribute(ATTR_ROWBOAT_BUILT, true);
    p.sendMessage("You successfully build the boat.");
    return true;
  }
  function travelRowboat({ player: p, objectId, location }) {
    if (![O.ROWBOAT_SPACE, O.ROWBOAT_14].includes(objectId) || location.x !== ROWBOAT_SPACE_TILE.x || location.y !== ROWBOAT_SPACE_TILE.y || location.z !== 0
      || !p.getAttribute(ATTR_ROWBOAT_BUILT) || stage(p) < S.KEYS || stage(p) >= S.COMPLETE) return false;
    p.moveTo(LITHKREN_LANDING);
    p.setAttribute(ATTR_LITHKREN_ARRIVED, true);
    p.sendMessage("You row across to Lithkren and step ashore near the ancient fortress.");
    return true;
  }
  function onLithkrenDialogueAction({ player: p, stepId }) {
    if (stepId !== "wKz-eF" || !p.getAttribute(ATTR_ROWBOAT_BUILT) || stage(p) < S.KEYS || stage(p) >= S.COMPLETE) return;
    p.moveTo(LITHKREN_LANDING);
    p.setAttribute(ATTR_LITHKREN_ARRIVED, true);
  }
  function onQuestDialogueAction({ player: p, stepId }) {
    if (stepId === "b5j1wa" && stage(p) === S.GALVEK && p.getAttribute(ATTR_GALVEK_DEFEATED)) {
      quest.complete(p);
      p.setAttribute(ATTR_GALVEK_DEFEATED, false);
    }
  }
  function searchAivasSkeleton({ player: p, objectId }) {
    if (stage(p) < S.KEYS || stage(p) >= S.LEADERS || !p.getAttribute(ATTR_LITHKREN_ARRIVED)
      || ![O.SKELETON_82, O.SKELETON_83].includes(objectId)) return false;
    if (p.getAttribute(ATTR_AIVAS_DIARY_FOUND) || has(p, I.AIVAS_DIARY)) return p.sendMessage("You have already taken Aivas' diary.");
    if (!give(p, I.AIVAS_DIARY)) return true;
    p.setAttribute(ATTR_AIVAS_DIARY_FOUND, true);
    talk(p, N.DALLAS_JONES_2, "to-lithkren-searching-the-charred-skeleton");
    return true;
  }
  function readAivasDiary({ player: p, itemId }) {
    if (itemId !== I.AIVAS_DIARY || !p.getAttribute(ATTR_AIVAS_DIARY_FOUND) || stage(p) < S.KEYS || stage(p) >= S.LEADERS) return false;
    p.setAttribute(ATTR_AIVAS_DIARY, true);
    p.sendMessage("Aivas' diary describes Robert the Strong leading the battle against the Dragonkin on Lithkren.");
    return true;
  }
  function talkBob({ player: p, npcId }) {
    if (stage(p) >= S.DREAM && stage(p) < S.KEYS) talk(p, npcId, "robert-the-strong-talking-to-bob-on-lunar-isle");
    else if (stage(p) >= S.KEYS && stage(p) < S.LITHKREN) talk(p, npcId, "bob-the-cat-talking-to-bob");
    else if (stage(p) >= S.LITHKREN && stage(p) < S.LEADERS) talk(p, npcId, "the-ultimate-weapon-talking-to-bob");
    else if (stage(p) >= S.FLEET) talk(p, npcId, "the-assault-talking-to-bob-on-varrock-s-grand-ship");
  }
  function talkBrundtForKey({ player: p, npcId }) {
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE) return;
    talk(p, npcId, p.getAttribute(ATTR_UNGAEL_TRIP)
      ? "robert-s-ungael-key-piece-talking-to-brundt-the-chieftain-talking-to-brundt-again"
      : "robert-s-ungael-key-piece-talking-to-brundt-the-chieftain");
    p.setAttribute(ATTR_UNGAEL_TRIP, true);
  }
  function talkTorfinnForKey({ player: p, npcId }) {
    if (stage(p) === S.FLEET) {
      talk(p, npcId, "the-assault-talking-to-torfinn");
      startAssault(p);
      return;
    }
    if (stage(p) === S.GALVEK) {
      talk(p, npcId, "the-assault-talking-to-torfinn");
      enterArea(p, N.GALVEK_2, 1560, 5070, 20);
      return;
    }
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || !p.getAttribute(ATTR_UNGAEL_TRIP)) return;
    talk(p, npcId, "robert-s-ungael-key-piece-talking-to-torfinn");
    p.setAttribute(ATTR_UNGAEL_TRIP, true);
    p.sendMessage("Torfinn takes you to Ungael. Vorkath is ahead; prepare for the fight.");
    p.moveTo(new Location(2272, 4053, 0));
  }
  function talkHerbertForKey({ player: p, npcId }) {
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE) return;
    talk(p, npcId, "camorra-s-key-piece-talking-to-veos-cabin-boy-herbert");
  }
  function talkAmeliaForKey({ player: p, npcId }) {
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE) return;
    talk(p, npcId, p.getAttribute(ATTR_CRYPT_READY)
      ? "camorra-s-key-piece-talking-to-amelia-talking-to-amelia-again"
      : "camorra-s-key-piece-talking-to-amelia");
    p.setAttribute(ATTR_CRYPT_READY, true);
  }
  function talkKourendHistorian({ player: p, npcId, definition }) {
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE) return;
    const name = definition?.getName?.() || definition?.name;
    const variant = name === "Istoria" ? "camorra-s-key-piece-talking-to-istoria"
      : name === "Imerominia" ? "camorra-s-key-piece-talking-to-imerominia"
        : "camorra-s-key-piece-talking-to-jonathan";
    talk(p, npcId, variant);
  }
  function talkOneiromancer({ player: p, npcId }) {
    if (stage(p) < S.MURAL) return;
    if (stage(p) === S.DREAM && !has(p, I.DREAM_POTION) && !has(p, I.DREAM_VIAL_EMPTY_) && !has(p, I.DREAM_VIAL_WATER_) && !has(p, I.DREAM_VIAL_HERB_)) {
      give(p, I.DREAM_VIAL_EMPTY_);
    }
    talk(p, npcId, has(p, I.DREAM_POTION)
      ? "robert-the-strong-talking-to-the-oneiromancer-before-making-the-dream-potion-talking-to-her-after-making-the-dream-potion"
      : "robert-the-strong-talking-to-the-oneiromancer-before-making-the-dream-potion");
  }
  function talkReldo({ player: p, npcId }) {
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE) return;
    const step = Number(p.getAttribute(ATTR_MORYTANIA)) || 0;
    const variant = step === 0 ? "tristan-s-key-piece-talking-to-reldo"
      : step === 1 ? "tristan-s-key-piece-talking-to-reldo-talking-to-him-before-finding-the-book"
        : "tristan-s-key-piece-talking-to-reldo-with-the-book";
    talk(p, npcId, variant);
    if (step === 0) p.setAttribute(ATTR_MORYTANIA, 1);
  }
  function searchReldoBook({ player: p, objectId, location }) {
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || (Number(p.getAttribute(ATTR_MORYTANIA)) || 0) !== 1) return false;
    if (!RELDO_BOOKCASE_IDS.includes(objectId) || location.x !== 3207 || ![3491, 3492, 3493, 3495].includes(location.y)) return false;
    talk(p, N.RELDO, "tristan-s-key-piece-finding-the-book");
    p.setAttribute(ATTR_MORYTANIA, 2);
    return true;
  }
  function talkSarah({ player: p, npcId }) {
    const step = Number(p.getAttribute(ATTR_MORYTANIA)) || 0;
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || step < 2) return;
    talk(p, npcId, step < 3 ? "tristan-s-key-piece-talking-to-sarah-corvo" : "tristan-s-key-piece-talking-to-sarah-corvo-talking-to-her-again");
    p.setAttribute(ATTR_MORYTANIA, 3);
  }
  function talkAva({ player: p, npcId }) {
    const step = Number(p.getAttribute(ATTR_MORYTANIA)) || 0;
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || step < 3) return;
    if (step === 3) {
      talk(p, npcId, "tristan-s-key-piece-talking-to-ava");
      p.setAttribute(ATTR_MORYTANIA, 4);
    } else if (has(p, I.INERT_LOCATOR_ORB)) {
      finishLocatorOrb({ player: p, npcId });
    } else {
      talk(p, npcId, has(p, I.LOCATOR_ORB)
        ? "tristan-s-key-piece-talking-to-ava-after-making-the-orb-talking-to-her-again-after-receiving-the-orb"
        : "tristan-s-key-piece-talking-to-ava-talking-to-her-again-before-making-the-orb");
    }
  }
  function talkLeader({ player: p, npcId, definition }) {
    const name = definition?.getName?.() || definition?.name;
    if (name === "Brundt the Chieftain" && stage(p) >= S.KEYS && stage(p) < S.FORGE) {
      return talkBrundtForKey({ player: p, npcId });
    }
    if (stage(p) < S.LEADERS || stage(p) >= S.COMPLETE) return;
    const variants = {
      "Sir Amik Varze": "a-world-united-talking-to-sir-amik-varze",
      "King Lathas": "a-world-united-talking-to-king-lathas-thoros-king-lathas",
      "Brundt the Chieftain": "a-world-united-brundt-the-chieftain",
      "King Roald": "a-world-united-talking-to-king-roald",
    };
    const idx = ["Sir Amik Varze", "King Lathas", "Brundt the Chieftain", "King Roald"].indexOf(name);
    if (idx < 0) return;
    talk(p, npcId, variants[name]);
    const bits = Number(p.getAttribute(ATTR_LEADERS)) || 0;
    const next = bits | (1 << idx);
    p.setAttribute(ATTR_LEADERS, next);
    if (next === 15) advance(p, S.FLEET);
  }
  function enterArea(p, bossId, x, y, radius) {
    leaveArea(p);
    const area = new QuestArea(p.getUsername?.(), new Boundary(x - radius, x + radius, y - radius, y + radius, 0));
    p.setAttribute(ATTR_AREA, area);
    area.enter(p);
    const at = p.getLocation();
    if (Math.max(Math.abs(at.getX() - x), Math.abs(at.getY() - y)) > 8) p.moveTo(new Location(x - 1, y, 0));
    const boss = NPC.create(bossId, new Location(x, y, 0));
    boss.setOwner?.(p); boss.setOwnerOnly?.(true); boss.__skipDefaultRespawn = true;
    boss.setScriptedMovement(true);
    area.add(boss); World.getAddNPCQueue().push(boss);
    p.setAttribute(ATTR_BOSS, boss);
    return area;
  }
  function startAssault(p) {
    const index = Math.min(5, Number(p.getAttribute(ATTR_ASSAULT_CHECKPOINT)) || 0);
    enterArea(p, ASSAULT_DRAGONS[index], 1560, 5070, 20);
    p.setAttribute(ATTR_ASSAULT_INDEX, index);
    p.sendMessage(index >= 3
      ? "The second wave attacks: defeat the mithril, adamant and rune dragons."
      : "The first wave attacks: defeat the black, steel and brutal red dragons.");
  }
  function spawnAssaultDragon(p, index) {
    const area = p.getAttribute(ATTR_AREA);
    const dragon = NPC.create(ASSAULT_DRAGONS[index], new Location(1560, 5070, 0));
    dragon.setOwner?.(p); dragon.setOwnerOnly?.(true); dragon.__skipDefaultRespawn = true;
    dragon.setScriptedMovement(true);
    area.add(dragon); World.getAddNPCQueue().push(dragon);
    p.setAttribute(ATTR_BOSS, dragon);
    p.setAttribute(ATTR_ASSAULT_INDEX, index);
    if (index === 3) p.sendMessage("The allied leaders arrive to help defend the ship.");
  }
  function leaveArea(p) {
    const old = p.getAttribute(ATTR_AREA);
    if (old && typeof old.isDestroyed === "function" && !old.isDestroyed()) {
      old.leave(p, false); old.postLeave(p, false); old.destroy();
    }
    p.setAttribute(ATTR_AREA, null); p.setAttribute(ATTR_BOSS, null);
  }
  function processGalvek(area, player, boss) {
    const hp = boss.getHitpoints();
    const phase = hp > 900 ? 0 : hp > 600 ? 1 : hp > 300 ? 2 : 3;
    if (area.galvekPhase !== phase) {
      area.galvekPhase = phase;
      const names = ["fire", "air", "water", "earth"];
      player.sendMessage(`Galvek draws on the power of ${names[phase]}. Change your protection and watch for the special attack.`);
    }
    area.galvekTick = (area.galvekTick || 0) + 1;
    const pending = area.galvekHazard;
    if (pending && area.galvekTick >= pending.impactAt) {
      area.galvekHazard = null;
      const here = player.getLocation();
      const dx = Math.abs(here.getX() - pending.x);
      const dy = Math.abs(here.getY() - pending.y);
      if (pending.kind === "fireball") {
        if (Math.max(dx, dy) <= 1) {
          player.sendMessage("Galvek's fireball explodes beneath you!");
          player.getCombat().getHitQueue().addPendingDamage([new HitDamage(Math.max(1, player.getHitpoints()), HitMask.RED)]);
        } else player.sendMessage("Galvek's fireball crashes into the deck where you stood.");
      } else if (pending.kind === "hurricane") {
        if (Math.max(dx, dy) <= 1) {
          player.sendMessage("The hurricane catches you and drains your energy.");
          player.setRunEnergy(Math.max(0, player.getRunEnergy() - 35));
          player.getSkillManager().decreaseCurrentLevel(Skill.RANGED, 5, 0);
          player.getCombat().getHitQueue().addPendingDamage([new HitDamage(20, HitMask.RED)]);
        } else player.sendMessage("You avoid the worst of Galvek's hurricane.");
      } else if (pending.kind === "tsunami") {
        if (here.getY() === pending.y && here.getX() !== pending.gapX) {
          player.sendMessage("The tsunami sweeps you off your feet!");
          player.getCombat().getHitQueue().addPendingDamage([new HitDamage(109, HitMask.RED)]);
        } else player.sendMessage("You find the gap and the wave passes over the deck.");
      } else if (pending.kind === "earth") {
        if (Math.max(dx, dy) <= 1) {
          player.sendMessage("Galvek's earth attack entombs you in stone.");
          player.getCombat().getHitQueue().addPendingDamage([new HitDamage(30, HitMask.RED)]);
        } else player.sendMessage("The earth projectile smashes into the deck beside you.");
      }
    }
    if (area.galvekHazard || area.galvekTick < (area.galvekNextSpecial || 7)) return;
    const here = player.getLocation();
    const x = here.getX(); const y = here.getY();
    const count = area.galvekSpecialCount || 0;
    const kind = count % 2 === 0 ? "fireball" : ["fireball", "hurricane", "tsunami", "earth"][phase];
    area.galvekSpecialCount = count + 1;
    area.galvekNextSpecial = area.galvekTick + 9;
    if (count > 0 && count % 4 === 0) {
      PrayerHandler.deactivatePrayers(player);
      player.sendMessage("Galvek's purple dragonfire extinguishes your prayers!");
    }
    if (kind === "fireball") {
      player.sendMessage("Galvek launches a fireball into the air. Move at least two tiles away!");
      area.galvekHazard = { kind, x, y, impactAt: area.galvekTick + 3 };
    } else if (kind === "hurricane") {
      player.sendMessage("Galvek summons a hurricane. Move away before it reaches you!");
      area.galvekHazard = { kind, x, y, impactAt: area.galvekTick + 3 };
    } else if (kind === "tsunami") {
      const gapX = x + 2;
      player.sendMessage(`A tsunami sweeps across the ship. The one-tile gap is at ${gapX}, ${y}; get into it!`);
      area.galvekHazard = { kind, x, y, gapX, impactAt: area.galvekTick + 3 };
    } else {
      player.sendMessage("Galvek hurls a rock at you. Move aside before it entombs you!");
      area.galvekHazard = { kind, x, y, impactAt: area.galvekTick + 3 };
    }
  }
  function spawnKaramjaGuardians(area, player) {
    for (const row of spawnRows) {
      if (!KARAMJA_GUARDIAN_BOX || row.x < KARAMJA_GUARDIAN_BOX.minX || row.x >= KARAMJA_GUARDIAN_BOX.maxX
        || row.y < KARAMJA_GUARDIAN_BOX.minY || row.y >= KARAMJA_GUARDIAN_BOX.maxY
        || !String(row.name || "").startsWith("Stone Guardian")) continue;
      const npc = api.spawnNpc({
        id: row.id,
        x: area.getBaseX() + row.x - KARAMJA_SOURCE.x,
        y: area.getBaseY() + row.y - KARAMJA_SOURCE.y,
        z: row.level || 0,
        owner: player,
        ownerOnly: true,
        wanderRadius: 2,
      });
      if (npc) area.add(npc);
    }
  }
  function enterKaramjaMaze({ player: p, objectId, location }) {
    if (objectId !== O.CAVE_63 || location.x !== KARAMJA_ENTRANCE.x || location.y !== KARAMJA_ENTRANCE.y || location.z !== KARAMJA_ENTRANCE.z) return false;
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE) {
      p.sendMessage("The cave is too dangerous to explore until you have learned about Robert the Strong's key pieces.");
      return true;
    }
    leaveArea(p);
    const area = new KaramjaArea(p);
    area.enter(p);
    p.setAttribute(ATTR_AREA, area);
    p.setAttribute(ATTR_KARAMJA_INSTANCE_ACTIVE, true);
    p.moveTo(area.tile(KARAMJA_START.x - KARAMJA_SOURCE.x, KARAMJA_START.y - KARAMJA_SOURCE.y, 0));
    spawnKaramjaGuardians(area, p);
    p.sendMessage("You descend into the ancient Karamjan Temple.");
    return true;
  }
  function leaveKaramjaMaze(p, area = p.getAttribute(ATTR_AREA)) {
    if (!(area instanceof KaramjaArea)) return false;
    area.leave(p, false);
    area.postLeave(p, false);
    area.destroy();
    p.setAttribute(ATTR_KARAMJA_INSTANCE_ACTIVE, false);
    p.moveTo(new Location(KARAMJA_EXIT.x, KARAMJA_EXIT.y, KARAMJA_EXIT.z));
    return true;
  }
  const CRYPT_SOURCE = { x: 1472, y: 9920 };
  const CRYPT_PLINTHS = {
    north: [1503, 9964], south: [1503, 9958], west: [1500, 9961], east: [1506, 9961],
  };
  const CRYPT_BUSTS = [
    { item: I.AIVAS_BUST, object: O.BUST_8, placedObject: O.BUST_7, location: [1495, 9967], label: "Aivas", home: "Zartharim", weapon: "crossbow" },
    { item: I.CAMORRA_BUST, object: O.BUST_10, placedObject: O.BUST_9, location: [1511, 9967], label: "Camorra", home: "Saranthium", weapon: "axe" },
    { item: I.ROBERT_BUST, object: O.BUST_12, placedObject: O.BUST_11, location: [1495, 9955], label: "Robert", home: "Arkney", weapon: "bow" },
    { item: I.TRISTAN_BUST, object: O.BUST_14, placedObject: O.BUST_13, location: [1511, 9955], label: "Tristan", home: "Karville", weapon: "sword" },
  ];
  const CRYPT_PUZZLE_PLANE = 1;
  const CRYPT_ENTRANCE = { x: 1483, y: 3548, z: 0 };
  const CRYPT_STAIRS = new Map([
    [O.LADDER_370, [{ x: 1479, y: 9950, z: 2, to: [1479, 9950, 1] }, { x: 1528, y: 9950, z: 2, to: [1528, 9950, 1] }]],
    [O.LADDER_371, [{ x: 1479, y: 9950, z: 1, to: [1479, 9950, 2] }, { x: 1528, y: 9950, z: 1, to: [1528, 9950, 2] }]],
    [O.LADDER_372, [{ x: 1524, y: 9967, z: 3, to: [1524, 9967, 2] }]],
    [O.LADDER_373, [{ x: 1524, y: 9967, z: 2, to: [1524, 9967, 3] }]],
    [O.LADDER_374, [{ x: 1483, y: 9933, z: 3, to: [1483, 9933, 2] }]],
    [O.LADDER_375, [{ x: 1483, y: 9933, z: 2, to: [1483, 9933, 3] }]],
    [O.STAIRCASE_171, [{ x: 1503, y: 9927, z: 3, to: [1503, 9925, 2] }, { x: 1496, y: 9978, z: 2, to: [1494, 9978, 1] }, { x: 1510, y: 9978, z: 2, to: [1510, 9978, 1] }]],
    [O.STAIRCASE_170, [{ x: 1503, y: 9925, z: 2, to: [1503, 9927, 3] }, { x: 1494, y: 9978, z: 1, to: [1496, 9978, 2] }, { x: 1510, y: 9978, z: 1, to: [1510, 9978, 2] }]],
  ]);
  function cryptObjects(area) {
    area.puzzleObjects ??= [];
    return area.puzzleObjects;
  }
  function setCryptObject(area, id, sourceX, sourceY, plane = CRYPT_PUZZLE_PLANE) {
    const target = area.tile(sourceX - CRYPT_SOURCE.x, sourceY - CRYPT_SOURCE.y, plane);
    const current = cryptObjects(area).filter((object) => {
      const loc = object.getLocation();
      return loc.getX() === target.getX() && loc.getY() === target.getY() && loc.getZ() === target.getZ();
    });
    for (const object of current) {
      ObjectManager.deregister(object, true);
      area.remove(object);
      area.puzzleObjects.splice(area.puzzleObjects.indexOf(object), 1);
    }
    const object = new GameObject(id, target, 10, 0, area);
    ObjectManager.register(object, true);
    area.add(object);
    cryptObjects(area).push(object);
  }
  function resetCryptPuzzle(p, area, randomize = true, revealClues = true) {
    if (randomize || !Array.isArray(p.getAttribute(ATTR_CRYPT_ORDER))) {
      const order = CRYPT_BUSTS.map((bust) => bust.item);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      p.setAttribute(ATTR_CRYPT_ORDER, order);
    }
    const placed = randomize ? {} : (p.getAttribute(ATTR_CRYPT_PLACED) || {});
    p.setAttribute(ATTR_CRYPT_PLACED, placed);
    for (const bust of CRYPT_BUSTS) {
      if (!Object.values(placed).includes(bust.item)) setCryptObject(area, bust.object, bust.location[0], bust.location[1]);
    }
    for (const [direction, [x, y]] of Object.entries(CRYPT_PLINTHS)) {
      const item = placed[direction];
      setCryptObject(area, item ? CRYPT_BUSTS.find((bust) => bust.item === item).placedObject : O.PLINTH_10, x, y);
    }
    setCryptObject(area, Object.keys(placed).length === 4 ? O.TOMB_7 : O.TOMB_6, 1503, 9961);
    if (revealClues) {
      const [north, south, west] = p.getAttribute(ATTR_CRYPT_ORDER);
      const person = (item) => CRYPT_BUSTS.find((bust) => bust.item === item);
      const n = person(north), s = person(south), w = person(west);
      p.sendMessage(`The one from ${n.home} sat at the north of the table.`);
      p.sendMessage(`The ${s.weapon} bearer sat opposite ${n.label}.`);
      p.sendMessage(`The ${w.weapon} bearer sat at the west of the table; place the remaining bust east.`);
    }
  }
  function enterKourendCrypt({ player: p, objectId, location }) {
    if (objectId !== O.CRYPT_ENTRANCE || location.x !== CRYPT_ENTRANCE.x || location.y !== CRYPT_ENTRANCE.y) return false;
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || !p.getAttribute(ATTR_CRYPT_READY)) {
      p.sendMessage("You should find out what Camorra's clues say before entering the crypt.");
      return true;
    }
    leaveArea(p);
    const area = new KourendCryptArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_AREA, area);
    p.setAttribute(ATTR_CRYPT_ACTIVE, true);
    p.moveTo(area.tile(1483 - CRYPT_SOURCE.x, 9933 - CRYPT_SOURCE.y, 3));
    for (const row of spawnRows) {
      if (row.x < 1472 || row.x >= 1568 || row.y < 9920 || row.y >= 9984) continue;
      if (!/^(?:Skeleton|Zombie)/i.test(row.name || "")) continue;
      const npc = api.spawnNpc({
        id: row.id,
        x: area.getBaseX() + row.x - CRYPT_SOURCE.x,
        y: area.getBaseY() + row.y - CRYPT_SOURCE.y,
        z: row.level || 0,
        owner: p,
        ownerOnly: true,
      });
      if (npc) area.add(npc);
    }
    resetCryptPuzzle(p, area, !p.getAttribute(ATTR_CRYPT_ORDER), false);
    p.sendMessage("You descend into the Shayzien Crypts. The tomb lies on the lowest floor.");
    return true;
  }
  function handleCryptObject({ player: p, objectId, location }) {
    const area = p.getAttribute(ATTR_AREA);
    if (!(area instanceof KourendCryptArea) || stage(p) < S.KEYS || stage(p) >= S.FORGE) return false;
    const sourceX = CRYPT_SOURCE.x + location.x - area.getBaseX();
    const sourceY = CRYPT_SOURCE.y + location.y - area.getBaseY();
    const stair = CRYPT_STAIRS.get(objectId)?.find(({ x, y, z }) => x === sourceX && y === sourceY && z === location.z);
    if (stair) {
      p.moveTo(area.tile(stair.to[0] - CRYPT_SOURCE.x, stair.to[1] - CRYPT_SOURCE.y, stair.to[2]));
      p.sendMessage(stair.to[2] < location.z ? "You climb down." : "You climb up.");
      return true;
    }
    if (objectId === O.TOMB_6 && sourceX === 1503 && sourceY === 9961 && location.z === CRYPT_PUZZLE_PLANE) {
      resetCryptPuzzle(p, area, !p.getAttribute(ATTR_CRYPT_ORDER), true);
      p.sendMessage("You inspect Camorra's tomb and study the clues around the table.");
      return true;
    }
    if (objectId === O.TOMB_7 && sourceX === 1503 && sourceY === 9961 && location.z === CRYPT_PUZZLE_PLANE) {
      if (has(p, KEY_PARTS[3])) return p.sendMessage("The tomb has already yielded its dragon key piece.");
      if (!give(p, KEY_PARTS[3])) return true;
      const parts = (Number(p.getAttribute(ATTR_PARTS)) || 0) | (1 << 3);
      p.setAttribute(ATTR_PARTS, parts);
      if (parts === 15) advance(p, S.FORGE);
      p.sendMessage("You search Camorra's tomb and take the dragon key piece.");
      return true;
    }
    const bust = CRYPT_BUSTS.find((entry) => entry.object === objectId && entry.location[0] === sourceX && entry.location[1] === sourceY && location.z === CRYPT_PUZZLE_PLANE);
    if (bust) {
      if (!has(p, bust.item)) {
        if (!give(p, bust.item)) return true;
        const target = area.tile(sourceX - CRYPT_SOURCE.x, sourceY - CRYPT_SOURCE.y, CRYPT_PUZZLE_PLANE);
        for (const object of cryptObjects(area).filter((entry) => {
          const loc = entry.getLocation();
          return loc.getX() === target.getX() && loc.getY() === target.getY() && loc.getZ() === target.getZ();
        })) {
          ObjectManager.deregister(object, true); area.remove(object);
          area.puzzleObjects.splice(area.puzzleObjects.indexOf(object), 1);
        }
        p.sendMessage(`You pick up the bust of ${bust.label}.`);
      }
      return true;
    }
    return false;
  }
  function placeCryptBust({ player: p, itemId, objectId, location }) {
    const area = p.getAttribute(ATTR_AREA);
    if (!(area instanceof KourendCryptArea) || objectId !== O.PLINTH_10 || !CRYPT_BUSTS.some((bust) => bust.item === itemId)) return false;
    const sourceX = CRYPT_SOURCE.x + location.x - area.getBaseX();
    const sourceY = CRYPT_SOURCE.y + location.y - area.getBaseY();
    const direction = Object.entries(CRYPT_PLINTHS).find(([, [x, y]]) => x === sourceX && y === sourceY)?.[0];
    if (!direction) return false;
    const order = p.getAttribute(ATTR_CRYPT_ORDER);
    const expected = { north: order?.[0], south: order?.[1], west: order?.[2], east: order?.[3] }[direction];
    if (itemId !== expected) {
      p.sendMessage("The bust does not fit this clue. The puzzle resets and the crypt throws you back upstairs.");
      resetCryptPuzzle(p, area, true);
      p.moveTo(area.tile(1483 - CRYPT_SOURCE.x, 9933 - CRYPT_SOURCE.y, 3));
      return true;
    }
    remove(p, itemId);
    const placed = { ...(p.getAttribute(ATTR_CRYPT_PLACED) || {}), [direction]: itemId };
    p.setAttribute(ATTR_CRYPT_PLACED, placed);
    setCryptObject(area, CRYPT_BUSTS.find((bust) => bust.item === itemId).placedObject, sourceX, sourceY);
    p.sendMessage(`You place the bust at the ${direction} of the table.`);
    if (Object.keys(placed).length === 4) {
      setCryptObject(area, O.TOMB_7, 1503, 9961);
      p.sendMessage("The tomb unlocks. Search it for the dragon key piece.");
    }
    return true;
  }
  function enterUngaelLaboratory({ player: p, objectId, location }) {
    const current = p.getAttribute(ATTR_AREA);
    if (current instanceof UngaelLabArea) {
      const sourceX = 2256 + location.x - current.getBaseX();
      const sourceY = 10456 + location.y - current.getBaseY();
      if (objectId !== O.CAVE_62 || sourceX !== 2248 || sourceY !== 4077) return false;
      current.leave(p, false); current.postLeave(p, false); current.destroy();
      p.setAttribute(ATTR_UNGAEL_LAB_ACTIVE, false);
      p.moveTo(new Location(2248, 4077, 0));
      return true;
    }
    if (objectId !== O.CAVE_62 || location.x !== 2248 || location.y !== 4077) return false;
    if (stage(p) < S.KEYS || !p.getAttribute(ATTR_VORKATH_DEFEATED)) {
      p.sendMessage("Vorkath blocks the way into the Dragonkin laboratory.");
      return true;
    }
    leaveArea(p);
    const area = new UngaelLabArea(p.getUsername?.());
    area.enter(p);
    p.setAttribute(ATTR_AREA, area);
    p.setAttribute(ATTR_UNGAEL_LAB_ACTIVE, true);
    p.moveTo(area.tile(12, 16, 0));
    p.sendMessage("You enter the Ungael laboratory. Search the machinery, then find a way to the locked eastern room.");
    return true;
  }
  function handleUngaelLab({ player: p, objectId, location }) {
    const area = p.getAttribute(ATTR_AREA);
    if (!(area instanceof UngaelLabArea)) return false;
    const sourceX = UNGAEL_LAB_SOURCE_X + location.x - area.getBaseX();
    const sourceY = UNGAEL_LAB_SOURCE_Y + location.y - area.getBaseY();
    const note = UNGAEL_NOTE_OBJECTS.get(objectId);
    if (note && stage(p) >= S.KEYS && sourceX === note.x && sourceY === note.y) {
      if (has(p, note.item)) p.sendMessage("You have already taken this set of Dragonkin notes.");
      else if (give(p, note.item)) p.sendMessage("You search the ancient apparatus and find an old Dragonkin note.");
      return true;
    }
    if (objectId === O.LEVER_55 && sourceX === 2260 && sourceY === 10464) {
      if ((p.getRunEnergy?.() ?? 100) < 15) { p.sendMessage("You need at least 15% run energy to reach the other side in time."); return true; }
      p.setAttribute(ATTR_LAB_TIMER, World.getProcessCycle() + 30);
      p.sendMessage("You pull the lever. A door opens somewhere to the east!");
      return true;
    }
    if (objectId === O.STONE_CHEST_3 && sourceX === 2292 && sourceY === 10466) {
      if ((Number(p.getAttribute(ATTR_LAB_TIMER)) || 0) < World.getProcessCycle()) {
        p.sendMessage("The eastern door has shut. Pull the lever again and hurry.");
        return true;
      }
      if (!has(p, KEY_PARTS[2]) && p.getInventory().getFreeSlots() < 2) {
        p.sendMessage("You need two free inventory spaces for the key piece and ancient key.");
        return true;
      }
      if (!has(p, KEY_PARTS[2])) {
        give(p, KEY_PARTS[2]);
        const parts = (Number(p.getAttribute(ATTR_PARTS)) || 0) | (1 << 2);
        p.setAttribute(ATTR_PARTS, parts);
        if (parts === 15) advance(p, S.FORGE);
      }
      if (!has(p, I.ANCIENT_KEY)) give(p, I.ANCIENT_KEY);
      p.sendMessage("You search the stone chest and take the Ungael dragon key piece and ancient key.");
      return true;
    }
    return false;
  }
  function exitKaramjaStaircase({ player: p, objectId, location }) {
    if (objectId !== O.STAIRCASE_172 || !(p.getAttribute(ATTR_AREA) instanceof KaramjaArea)) return false;
    const area = p.getAttribute(ATTR_AREA);
    const sourceX = KARAMJA_SOURCE.x + location.x - area.getBaseX();
    const sourceY = KARAMJA_SOURCE.y + location.y - area.getBaseY();
    if (sourceX !== 2846 || sourceY !== 9293 || location.z !== 0) return false;
    p.sendMessage("You climb back out of the temple.");
    return leaveKaramjaMaze(p, area);
  }
  function handleKaramjaPlinth({ player: p, objectId, location }) {
    const area = p.getAttribute(ATTR_AREA);
    if (!(area instanceof KaramjaArea) || stage(p) < S.KEYS || stage(p) >= S.FORGE) return false;
    const sourceX = KARAMJA_SOURCE.x + location.x - area.getBaseX();
    const sourceY = KARAMJA_SOURCE.y + location.y - area.getBaseY();
    if (sourceX !== KARAMJA_PLINTH.x || sourceY !== KARAMJA_PLINTH.y || location.z !== KARAMJA_PLINTH.z) return false;
    if (objectId === O.PLINTH_17 || objectId === O.PLINTH_16) {
      if (has(p, KEY_PARTS[0])) {
        area.installPlinth(O.PLINTH_18);
        return true;
      }
      if (!give(p, KEY_PARTS[0])) return true;
      const parts = Number(p.getAttribute(ATTR_PARTS)) || 0;
      p.setAttribute(ATTR_PARTS, parts | 1);
      area.installPlinth(O.PLINTH_18);
      p.sendMessage("You take the dragon key piece from the plinth.");
      if ((parts | 1) === 15) advance(p, S.FORGE);
      return true;
    }
    if (objectId === O.PLINTH_18) {
      p.sendMessage("The plinth hums with ancient power and returns you to the temple entrance.");
      return leaveKaramjaMaze(p, area);
    }
    return false;
  }
  function searchKaramjaSkeleton({ player: p, objectId, location }) {
    const area = p.getAttribute(ATTR_AREA);
    if (!(area instanceof KaramjaArea) || objectId !== O.SKELETON_84 || stage(p) < S.KEYS || stage(p) >= S.FORGE) return false;
    const sourceX = KARAMJA_SOURCE.x + location.x - area.getBaseX();
    const sourceY = KARAMJA_SOURCE.y + location.y - area.getBaseY();
    if (sourceX !== 2838 || sourceY !== 9219 || location.z !== 0) return false;
    if (p.getAttribute(ATTR_KARAMJA_JOURNAL)) return p.sendMessage("You have already taken the journal from the skeleton.");
    if (!give(p, I.MALUMACS_JOURNAL)) return true;
    p.setAttribute(ATTR_KARAMJA_JOURNAL, true);
    p.sendMessage("You find Malumac's journal among the skeleton's remains.");
    return true;
  }
  function disableKaramjaTrap({ player: p, objectId, location, object }) {
    const area = p.getAttribute(ATTR_AREA);
    if (!(area instanceof KaramjaArea) || !KARAMJA_TRAPS.has(objectId)) return false;
    const acrossX = Number(object?.getFace?.() ?? 0) % 2 === 1;
    const axis = acrossX ? "x" : "y";
    const crossTrap = () => {
      const side = Math.sign(p.getLocation()[acrossX ? "getX" : "getY"]() - location[axis]);
      const offset = (side || -1) * 2;
      const destination = acrossX
        ? new Location(location.x - offset, location.y, location.z)
        : new Location(location.x, location.y - offset, location.z);
      p.getMovementQueue().reset();
      p.moveTo(destination);
    };
    if (objectId === O.TRAP_11 || objectId === O.TRAP_12) {
      if (p.getSkillManager().getMaxLevel(Skill.THIEVING) < 60) return p.sendMessage("You need at least 60 Thieving to disable these traps.");
      area.disabledTraps ??= new Set();
      const trapKey = `${location.x},${location.y}`;
      if (area.disabledTraps.has(trapKey)) return p.sendMessage("You have already disabled this trap.");
      if (Math.random() < Math.min(0.9, p.getSkillManager().getMaxLevel(Skill.THIEVING) / 100)) {
        p.sendMessage("You carefully disable the wall trap.");
        area.disabledTraps.add(trapKey);
        crossTrap();
      } else {
        p.sendMessage("You trigger the wall trap while trying to disable it.");
        p.getCombat().getHitQueue().addPendingDamage([new HitDamage(1 + Math.floor(Math.random() * 8), HitMask.RED)]);
      }
      return true;
    }
    if (p.getSkillManager().getMaxLevel(Skill.AGILITY) < 60) return p.sendMessage("You need at least 60 Agility to climb over these traps.");
    if (Math.random() < Math.min(0.9, p.getSkillManager().getMaxLevel(Skill.AGILITY) / 100)) {
      p.sendMessage("You nimbly climb over the floor trap.");
      crossTrap();
    } else {
      p.sendMessage("You misjudge the trap and are struck by its blades.");
      p.getCombat().getHitQueue().addPendingDamage([new HitDamage(1 + Math.floor(Math.random() * 8), HitMask.RED)]);
    }
    return true;
  }
  function routeKaramjaTrap(event) {
    if (!KARAMJA_TRAPS.has(event.objectId) || event.clickType !== 1
      || !(event.player.getAttribute(ATTR_AREA) instanceof KaramjaArea)) return;
    const area = event.player.getAttribute(ATTR_AREA);
    const { x, y, z } = event.object.getLocation();
    const position = event.player.getLocation();
    const route = new api.core.RsmodRouteFinding().findRoute({
      level: position.getZ(), srcX: position.getX(), srcY: position.getY(), srcSize: 1,
      destX: x, destY: y, privateArea: area, moveNear: true,
    });
    if (route.success) event.destination = { x: route.endX, y: route.endY, z };
  }
  function routeKourendEntrance(event) {
    if (event.objectId !== O.CRYPT_ENTRANCE || event.clickType !== 1) return;
    const { x, y, z } = event.object.getLocation();
    const position = event.player.getLocation();
    const route = new api.core.RsmodRouteFinding().findRoute({
      level: position.getZ(), srcX: position.getX(), srcY: position.getY(), srcSize: 1,
      destX: x, destY: y, privateArea: event.player.getArea?.() ?? null, moveNear: true,
    });
    if (route.success) event.destination = { x: route.endX, y: route.endY, z };
  }
  function routeKourendStairs(event) {
    const area = event.player.getAttribute(ATTR_AREA);
    if (!(area instanceof KourendCryptArea) || event.clickType !== 1) return;
    const { x, y, z } = event.object.getLocation();
    const sourceX = CRYPT_SOURCE.x + x - area.getBaseX();
    const sourceY = CRYPT_SOURCE.y + y - area.getBaseY();
    const stair = CRYPT_STAIRS.get(event.objectId)?.find((entry) => entry.x === sourceX && entry.y === sourceY && entry.z === z);
    if (!stair) return;
    const player = event.player.getLocation();
    const definition = event.definition;
    let width = definition?.getSizeX?.() ?? 1;
    let height = definition?.getSizeY?.() ?? 1;
    if ((event.object.getFace?.() ?? 0) & 1) [width, height] = [height, width];
    const candidates = [];
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        candidates.push({ x: x + dx, y: y - 1 }, { x: x + dx, y: y + height });
      }
    }
    for (let dy = 0; dy < height; dy++) {
      candidates.push({ x: x - 1, y: y + dy }, { x: x + width, y: y + dy });
    }
    const finder = new api.core.RsmodRouteFinding();
    const reachable = candidates
      .map((tile) => ({ ...tile, route: finder.findRoute({
        level: z, srcX: player.getX(), srcY: player.getY(), srcSize: 1,
        destX: tile.x, destY: tile.y, privateArea: area, moveNear: false,
      }) }))
      .filter((candidate) => candidate.route.success)
      .sort((a, b) => (Math.abs(a.x - player.getX()) + Math.abs(a.y - player.getY())) - (Math.abs(b.x - player.getX()) + Math.abs(b.y - player.getY())));
    if (reachable.length) event.destination = { x: reachable[0].x, y: reachable[0].y, z };
  }
  function handleNpcDeath({ killer, npc }) {
    if (killer && stage(killer) === S.KEYS && killer.getAttribute(ATTR_UNGAEL_TRIP)
      && npc?.getId?.() === N.VORKATH_5) {
      killer.setAttribute(ATTR_VORKATH_DEFEATED, true);
      syncUngaelExit(killer);
      killer.sendMessage("Vorkath falls. The cave to the north-west leads to the Dragonkin laboratory.");
      return;
    }
    if (!killer || killer.getAttribute(ATTR_BOSS) !== npc || !(killer.getAttribute(ATTR_AREA) instanceof QuestArea)) return;
    const s = stage(killer);
    if (s === S.FLEET) {
      const next = (Number(killer.getAttribute(ATTR_ASSAULT_INDEX)) || 0) + 1;
      if (next < ASSAULT_DRAGONS.length) {
        if (next === 3) {
          killer.setAttribute(ATTR_ASSAULT_CHECKPOINT, 3);
          killer.sendMessage("The first wave is defeated. The fleet holds while the next dragons approach.");
        }
        spawnAssaultDragon(killer, next);
      } else {
        killer.setAttribute(ATTR_ASSAULT_INDEX, 6);
        advance(killer, S.GALVEK);
        talk(killer, N.ZORGOTH, "the-assault-arrival-of-zorgoth-and-galvek");
        const area = killer.getAttribute(ATTR_AREA);
        const galvek = NPC.create(N.GALVEK_2, new Location(1560, 5070, 0));
        galvek.setOwner?.(killer); galvek.setOwnerOnly?.(true); galvek.__skipDefaultRespawn = true;
        galvek.setScriptedMovement(true); galvek.setMaxHitpoints?.(1200); galvek.setHitpoints?.(1200);
        area.add(galvek); World.getAddNPCQueue().push(galvek);
        killer.setAttribute(ATTR_BOSS, galvek);
        killer.sendMessage("Galvek lands on the ship. Change prayers and watch the dragon's attacks carefully.");
      }
      return;
    }
    if (s === S.TUNNEL) {
      killer.setAttribute(ATTR_MURAL_GUARDIAN_DEFEATED, true);
      killer.sendMessage("The Spawn collapses. You should investigate the mural again.");
    }
    if (s === S.DREAM) {
      advance(killer, S.KEYS);
      killer.sendMessage("Robert's memories return. Bob tells you he hid four dragon key pieces around Gielinor.");
    }
    else if (s === S.GALVEK) {
      killer.setAttribute(ATTR_GALVEK_DEFEATED, true);
      killer.sendMessage("Galvek falls. Speak to the heroes, then return to Alec Kincade at the Myths' Guild.");
      talk(killer, N.BRUNDT_THE_CHIEFTAIN_9, "the-assault-end-of-the-battle");
    }
    leaveArea(killer);
  }
  function syncUngaelExit(player) {
    // Cache loc 25337 at the north crater wall transforms to climbable loc
    // 31992 at varbit 6108 value 30.
    player.getPacketSender?.().sendVarbit?.(VARBIT_UNGAEL_EXIT,
      // The final transform is the default child after transform value 29.
      player.getAttribute(ATTR_VORKATH_DEFEATED) ? 30 : 0);
  }
  function handleObject({ player: p, objectId, location, clickType, definition }) {
    const s = stage(p);
    const option = definition?.getInteractions?.()?.[clickType - 1];
    if (objectId === O.ROWBOAT_SPACE && option === "Build") {
      return buildLithkrenRowboat({ player: p, objectId, location });
    }
    if (objectId === O.ROWBOAT_14 && option === "Travel") {
      return travelRowboat({ player: p, objectId, location });
    }
    if (handleUngaelLab({ player: p, objectId, location })) return true;
    if (enterUngaelLaboratory({ player: p, objectId, location })) return true;
    if (s >= S.KARAMJA && s < S.TUNNEL && objectId === O.WALL_161
      && [9635, 9636].includes(location.y) && location.x === 2846) {
      if (!has(p, I.BRONZE_PICKAXE) && !has(p, I.IRON_PICKAXE)) return p.sendMessage("You need a pickaxe to mine through the wall.");
      p.sendMessage("You mine through the northern wall and uncover a hidden passage.");
      advance(p, S.TUNNEL); return true;
    }
    if (s === S.TUNNEL && objectId === O.ANCIENT_MURAL && location.x === 2866 && location.y === 9680) {
      if (!p.getAttribute(ATTR_MURAL_GUARDIAN_DEFEATED)) {
        p.sendMessage("As you investigate the mural, a Spawn attacks!");
        enterArea(p, N.SPAWN_5, location.x + 2, location.y, 12);
        return true;
      }
      p.setAttribute(ATTR_MURAL_READ, true);
      advance(p, S.MURAL);
      p.sendMessage("You study the mural again and uncover the Dragonkin's hidden laboratory.");
      return true;
    }
    if (s === S.MURAL && objectId === O.ANCIENT_MURAL && location.x === 2866 && location.y === 9680) {
      p.sendMessage("You study the ancient mural and find a passage through the laboratory.");
      p.setAttribute(ATTR_MURAL_READ, true);
      return true;
    }
    if (s === S.MURAL && [O.ANCIENT_MACHINERY, O.ANCIENT_MACHINERY_2, O.ANCIENT_MACHINERY_3].includes(objectId)) {
      p.setAttribute(ATTR_NOTES_READ, true);
      p.sendMessage("You find notes describing the Dragonkin's experiments.");
      return true;
    }
    if (s === S.FORGE && [O.ANVIL, O.ANVIL_2, O.ANVIL_3, O.ANVIL_4, O.ANVIL_8].includes(objectId)) {
      if (!has(p, I.ANCIENT_KEY)) return p.sendMessage("You need the ancient key to reforge the dragon key.");
      if (!KEY_PARTS.every((id) => has(p, id))) return p.sendMessage("You need all four dragon key pieces.");
      if ((Number(p.getAttribute(ATTR_FORGE_HEADS)) || 0) !== 7) return p.sendMessage("The dragon forge is still cold. Cast Fire Wave or Fire Surge on all three dragon heads in the Ancient Cavern first.");
      if (!has(p, I.HAMMER)) return p.sendMessage("You need a hammer to reforge the dragon key.");
      KEY_PARTS.forEach((id) => remove(p, id)); remove(p, I.ANCIENT_KEY); give(p, I.DRAGON_KEY);
      advance(p, S.LITHKREN); return true;
    }
    if (s >= S.KEYS && s < S.LEADERS && p.getAttribute(ATTR_LITHKREN_ARRIVED)
      && [O.ANCIENT_DOORS, O.ANCIENT_DOORS_2, O.ANCIENT_DOORS_3, O.ANCIENT_DOORS_4].includes(objectId)) {
      if (!has(p, I.DRAGON_KEY)) return p.sendMessage("The lock requires a dragon key.");
      remove(p, I.DRAGON_KEY); p.sendMessage("The ancient doors unlock. Dallas and Bob enter the Lithkren laboratory.");
      advance(p, S.LEADERS); return true;
    }
    if (s === S.FLEET && [O.GANGPLANK_15, O.GANGPLANK_16, O.GANGPLANK_77, O.GANGPLANK_78].includes(objectId)) {
      p.sendMessage("Speak to Torfinn to rejoin the allied fleet."); return true;
    }
    return false;
  }
  function useItemOnObject({ player: p, itemId, objectId, handled }) {
    if (stage(p) === S.DREAM && itemId === I.DREAM_VIAL_EMPTY_ && [O.SINK, O.SINK_2, O.SINK_3, O.FOUNTAIN, O.FOUNTAIN_2].includes(objectId)) {
      remove(p, I.DREAM_VIAL_EMPTY_); give(p, I.DREAM_VIAL_WATER_); return true;
    }
    if (stage(p) === S.DREAM && itemId === I.DREAM_POTION && [O.BRAZIER, O.BRAZIER_2, O.BRAZIER_3].includes(objectId)) {
      remove(p, I.DREAM_POTION);
      talk(p, N.BOB, "robert-the-strong-using-the-potion-on-the-brazier");
      enterArea(p, N.ROBERT_THE_STRONG_2, 1761, 3850, 18);
      return true;
    }
    if (stage(p) >= S.KEYS && p.getAttribute(ATTR_LITHKREN_ARRIVED) && itemId === I.DRAGON_KEY
      && [O.ANCIENT_DOORS, O.ANCIENT_DOORS_2, O.ANCIENT_DOORS_3, O.ANCIENT_DOORS_4].includes(objectId)) {
      return handleObject({ player: p, objectId, handled });
    }
    return false;
  }
  function kindleDragonForge(event) {
    const { player: p, objectId, location } = event;
    if (stage(p) !== S.FORGE || ![O.DRAGON_HEAD_2, O.DRAGON_HEAD_3].includes(objectId)) return;
    const spell = String(api.core.CacheDefinitions?.getSpellName?.(event.spellWidget, event.spellItemId) ?? "");
    if (!/^fire wave$|^fire surge$/i.test(spell)) return;
    event.handled = true;
    if (!has(p, I.ANCIENT_KEY) || !KEY_PARTS.every((id) => has(p, id))) {
      p.sendMessage("The dragon heads remain dormant until you have the ancient key and all four key pieces.");
      return;
    }
    const surge = /^fire surge$/i.test(spell);
    const costs = surge ? [[I.FIRE_RUNE, 10], [I.AIR_RUNE, 7], [I.WRATH_RUNE, 1]]
      : [[I.FIRE_RUNE, 7], [I.AIR_RUNE, 5], [I.BLOOD_RUNE, 1]];
    if (costs.some(([id, amount]) => !has(p, id, amount))) {
      p.sendMessage("You do not have the runes to cast that spell.");
      return;
    }
    const tileKey = `${location.x},${location.y},${location.z}`;
    const headBit = { "1616,5284,1": 1, "1622,5279,1": 2, "1626,5284,1": 4 }[tileKey];
    if (!headBit) {
      p.sendMessage("The spell scorches the stone, but this is not one of the forge's three heads.");
      return;
    }
    costs.forEach(([id, amount]) => remove(p, id, amount));
    const lit = (Number(p.getAttribute(ATTR_FORGE_HEADS)) || 0) | headBit;
    p.setAttribute(ATTR_FORGE_HEADS, lit);
    p.sendMessage(lit === 7 ? "The three dragon heads blaze to life. The dragon forge is ready." : "The dragon head glows with the heat of the spell.");
  }
  function itemOnItem({ player: p, usedItemId, usedWithItemId }) {
    if (usedItemId !== usedWithItemId && UNGAEL_NOTES.includes(usedItemId) && UNGAEL_NOTES.includes(usedWithItemId)) {
      if (!UNGAEL_NOTES.every((id) => has(p, id))) {
        p.sendMessage("You need all six Ungael notes before you can combine them.");
        return true;
      }
      UNGAEL_NOTES.forEach((id) => remove(p, id));
      give(p, I.UNGAEL_LAB_NOTES);
      p.sendMessage("You combine the six old notes into a record of Zorgoth's Ungael experiments.");
      return true;
    }
    if (stage(p) >= S.DREAM && stage(p) < S.KEYS && [usedItemId, usedWithItemId].includes(I.ASTRAL_RUNE) && [usedItemId, usedWithItemId].includes(I.HAMMER)) {
      remove(p, I.ASTRAL_RUNE); give(p, I.ASTRAL_RUNE_SHARDS); p.sendMessage("You crush the astral rune into shards."); return true;
    }
    if (stage(p) >= S.DREAM && stage(p) < S.KEYS && [usedItemId, usedWithItemId].includes(I.ASTRAL_RUNE_SHARDS) && [usedItemId, usedWithItemId].includes(I.PESTLE_AND_MORTAR)) {
      remove(p, I.ASTRAL_RUNE_SHARDS); give(p, I.GROUND_ASTRAL_RUNE); return true;
    }
    if (stage(p) >= S.DREAM && stage(p) < S.KEYS && [usedItemId, usedWithItemId].includes(I.DREAM_VIAL_WATER_) && [usedItemId, usedWithItemId].includes(I.GOUTWEED)) {
      remove(p, I.DREAM_VIAL_WATER_); remove(p, I.GOUTWEED); give(p, I.DREAM_VIAL_HERB_); return true;
    }
    if (stage(p) >= S.DREAM && stage(p) < S.KEYS && [usedItemId, usedWithItemId].includes(I.DREAM_VIAL_HERB_) && [usedItemId, usedWithItemId].includes(I.GROUND_ASTRAL_RUNE)) {
      remove(p, I.DREAM_VIAL_HERB_); remove(p, I.GROUND_ASTRAL_RUNE); give(p, I.DREAM_POTION); p.sendMessage("You complete the dream potion."); return true;
    }
    return false;
  }
  function onLogin({ player: p }) {
    syncUngaelExit(p);
    const area = p.getAttribute(ATTR_AREA);
    if ((area instanceof QuestArea || area instanceof KaramjaArea || area instanceof UngaelLabArea || area instanceof KourendCryptArea) && !area.isDestroyed?.()) {
      leaveArea(p);
    }
    if (p.getAttribute(ATTR_KARAMJA_INSTANCE_ACTIVE)) {
      p.setAttribute(ATTR_KARAMJA_INSTANCE_ACTIVE, false);
      p.moveTo(new Location(KARAMJA_EXIT.x, KARAMJA_EXIT.y, KARAMJA_EXIT.z));
    }
    if (p.getAttribute(ATTR_UNGAEL_LAB_ACTIVE)) {
      p.setAttribute(ATTR_UNGAEL_LAB_ACTIVE, false);
      p.moveTo(new Location(2248, 4077, 0));
    }
    if (p.getAttribute(ATTR_CRYPT_ACTIVE)) {
      p.setAttribute(ATTR_CRYPT_ACTIVE, false);
      p.moveTo(new Location(CRYPT_ENTRANCE.x, CRYPT_ENTRANCE.y, CRYPT_ENTRANCE.z));
    }
  }
  function onPlayerDeath({ player: p }) {
    const area = p.getAttribute(ATTR_AREA);
    if ((area instanceof QuestArea || area instanceof KaramjaArea || area instanceof UngaelLabArea || area instanceof KourendCryptArea) && !area.isDestroyed?.()) leaveArea(p);
    p.setAttribute(ATTR_KARAMJA_INSTANCE_ACTIVE, false);
    p.setAttribute(ATTR_UNGAEL_LAB_ACTIVE, false);
    p.setAttribute(ATTR_CRYPT_ACTIVE, false);
  }
  function makeInertLocatorOrb({ player: p, usedItemId, usedWithItemId }) {
    const pair = [usedItemId, usedWithItemId];
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || (Number(p.getAttribute(ATTR_MORYTANIA)) || 0) < 4 || !pair.includes(I.GLASSBLOWING_PIPE) || !pair.includes(I.DRAGONSTONE)) return false;
    if (!has(p, I.CHISEL)) return p.sendMessage("You need a chisel to cut the dragonstone.");
    if (!has(p, I.MOLTEN_GLASS, 2)) return p.sendMessage("You need two molten glass to make a locator orb.");
    remove(p, I.DRAGONSTONE); remove(p, I.MOLTEN_GLASS, 2); give(p, I.INERT_LOCATOR_ORB);
    p.sendMessage("You use the pipe and molten glass to encase the dragonstone in an inert locator orb.");
    return true;
  }
  function finishLocatorOrb({ player: p, npcId }) {
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || !has(p, I.INERT_LOCATOR_ORB)) return;
    remove(p, I.INERT_LOCATOR_ORB); give(p, I.LOCATOR_ORB);
    p.setAttribute(ATTR_MORYTANIA, 5);
    const targets = [[3460, 3413], [3477, 3392], [3422, 3364], [3443, 3340], [3493, 3376]];
    p.setAttribute(ATTR_ORB_TARGET, targets[Math.floor(Math.random() * targets.length)]);
    talk(p, npcId, "tristan-s-key-piece-talking-to-ava-after-making-the-orb");
  }
  function feelLocatorOrb(event) {
    const { player: p } = event;
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || !has(p, I.LOCATOR_ORB) || (Number(p.getAttribute(ATTR_MORYTANIA)) || 0) < 5) return;
    const loc = p.getLocation();
    const [x, y] = p.getAttribute(ATTR_ORB_TARGET);
    const dx = x - loc.getX(), dy = y - loc.getY();
    const directions = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
    const direction = directions[((Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) % 8) + 8) % 8];
    const damage = Math.min(10, Math.max(0, p.getHitpoints() - 1));
    event.handled = true;
    if (damage > 0) p.getCombat().getHitQueue().addPendingDamage([new HitDamage(damage, HitMask.RED)]);
    p.sendMessage(Math.max(Math.abs(dx), Math.abs(dy)) <= 1
      ? "The locator orb pulses strongly. The key piece must be buried very close by."
      : `The locator orb glows and pulls you ${direction}. It shocks you as you use it.`);
  }
  function digForMorytaniaPiece(event) {
    const { player: p } = event;
    if (stage(p) < S.KEYS || stage(p) >= S.FORGE || !has(p, I.LOCATOR_ORB) || !has(p, I.SPADE) || (Number(p.getAttribute(ATTR_MORYTANIA)) || 0) < 5) return false;
    event.handled = true;
    const { x, y } = p.getLocation();
    const target = p.getAttribute(ATTR_ORB_TARGET);
    if (!target || Math.max(Math.abs(x - target[0]), Math.abs(y - target[1])) > 1) {
      p.sendMessage("You dig around, but the ground here does not seem right.");
      return true;
    }
    const parts = Number(p.getAttribute(ATTR_PARTS)) || 0;
    if (has(p, KEY_PARTS[1])) return p.sendMessage("You have already recovered this dragon key piece.");
    if (!give(p, KEY_PARTS[1])) return true;
    p.setAttribute(ATTR_PARTS, parts | (1 << 1));
    p.sendMessage("You dig up a dragon key piece from the swamp.");
    if ((parts | (1 << 1)) === 15) advance(p, S.FORGE);
    return true;
  }

  defineArea();
  quest = registerQuest(api, {
    key: "dragon_slayer_ii", name: "Dragon Slayer II", varpId: 1685, varbitId: 6104,
    startedValue: S.START, completionValue: S.COMPLETE, questPoints: 4,
    xpRewards: [
      { skillId: Skill.AGILITY.getIndex(), amount: 15000, label: "Agility" },
      { skillId: Skill.HITPOINTS.getIndex(), amount: 18000, label: "Hitpoints" },
      { skillId: Skill.MAGIC.getIndex(), amount: 15000, label: "Magic" },
      { skillId: Skill.RANGED.getIndex(), amount: 25000, label: "Ranged" },
      { skillId: Skill.SLAYER.getIndex(), amount: 18000, label: "Slayer" },
      { skillId: Skill.SMITHING.getIndex(), amount: 18000, label: "Smithing" },
    ],
    rewardItemId: I.ANTI_DRAGON_SHIELD,
    otherRewards: ["Access to the Myths' Guild", "Access to Lithkren", "The ability to fight Vorkath"],
    buildJournal,
  });
  api.persistAttribute(ATTR_LEADERS); api.persistAttribute(ATTR_PARTS);
  api.persistAttribute(ATTR_ASSAULT_INDEX); api.persistAttribute(ATTR_ASSAULT_CHECKPOINT);
  api.persistAttribute(ATTR_MORYTANIA); api.persistAttribute(ATTR_ORB_TARGET);
  api.persistAttribute(ATTR_MURAL_READ); api.persistAttribute(ATTR_NOTES_READ); api.persistAttribute(ATTR_KARAMJA_JOURNAL);
  api.persistAttribute(ATTR_MURAL_GUARDIAN_DEFEATED);
  api.persistAttribute(ATTR_KARAMJA_INSTANCE_ACTIVE);
  api.persistAttribute(ATTR_FORGE_HEADS);
  api.persistAttribute(ATTR_UNGAEL_TRIP); api.persistAttribute(ATTR_VORKATH_DEFEATED);
  api.persistAttribute(ATTR_LAB_TIMER); api.persistAttribute(ATTR_UNGAEL_LAB_ACTIVE);
  api.persistAttribute(ATTR_CRYPT_ACTIVE); api.persistAttribute(ATTR_CRYPT_READY);
  api.persistAttribute(ATTR_CRYPT_ORDER); api.persistAttribute(ATTR_CRYPT_PLACED);
  api.persistAttribute(ATTR_ROWBOAT_BUILT); api.persistAttribute(ATTR_LITHKREN_ARRIVED); api.persistAttribute(ATTR_AIVAS_DIARY);
  api.persistAttribute(ATTR_AIVAS_DIARY_FOUND);
  api.persistAttribute(ATTR_GALVEK_DEFEATED);
  installRowboatObject(O.ROWBOAT_SPACE);
  api.onNpcInteraction("Alec Kincade", { "Talk-to": talkAlec });
  api.onNpcInteraction("Dallas Jones", { "Talk-to": talkDallas });
  api.onNpcsInteraction(["Jardric"], { "Talk-to": talkJardric });
  api.onNpcInteraction("Bob the Cat", { "Talk-to": talkBob });
  api.onNpcInteraction("Oneiromancer", { "Talk-to": talkOneiromancer });
  api.onNpcInteraction("Reldo", { "Talk-to": talkReldo });
  api.onNpcInteraction("Sarah", { "Talk-to": talkSarah });
  api.onNpcInteraction("Ava", { "Talk-to": talkAva });
  api.onNpcInteraction("Torfinn", { "Talk-to": talkTorfinnForKey });
  api.onNpcInteraction("Cabin Boy Herbert", { "Talk-to": talkHerbertForKey });
  api.onNpcInteraction("Amelia", { "Talk-to": talkAmeliaForKey });
  api.onNpcsInteraction(["Istoria", "Imerominia", "Jonathan"], { "Talk-to": talkKourendHistorian });
  api.onNpcsInteraction(["Sir Amik Varze", "King Lathas", "Brundt the Chieftain", "King Roald"], { "Talk-to": talkLeader });
  api.onObjectInteraction(handleObject);
  api.onCustomEvent("npc-dialogue:action", onLithkrenDialogueAction);
  api.onCustomEvent("npc-dialogue:action", onQuestDialogueAction);
  api.onObjectFirstClick(O.CAVE_63, enterKaramjaMaze);
  api.onObjectInteraction(O.CAVE_62, enterUngaelLaboratory);
  api.onObjectFirstClick(O.CRYPT_ENTRANCE, enterKourendCrypt);
  api.onObjectFirstClick([O.TOMB_6, O.TOMB_7, ...CRYPT_BUSTS.map((bust) => bust.object), ...CRYPT_STAIRS.keys()], handleCryptObject);
  api.onObjectFirstClick([O.PLINTH_16, O.PLINTH_17, O.PLINTH_18], handleKaramjaPlinth);
  api.onObjectFirstClick(O.SKELETON_84, searchKaramjaSkeleton);
  api.onObjectFirstClick([O.SKELETON_82, O.SKELETON_83], searchAivasSkeleton);
  api.onObjectFirstClick([O.TRAP_9, O.TRAP_10, O.TRAP_11, O.TRAP_12], disableKaramjaTrap);
  api.onObjectRoute(routeKaramjaTrap);
  api.onObjectRoute(routeKourendEntrance);
  api.onObjectRoute(routeKourendStairs);
  api.onObjectFirstClick(O.STAIRCASE_172, exitKaramjaStaircase);
  api.onObjectInteraction("Bookcase", { Search: searchReldoBook });
  api.onItemOnObject(useItemOnObject, { noted: false });
  api.onItemOnObject(placeCryptBust, { noted: false });
  api.onSpellOnObject(kindleDragonForge);
  api.onItemOnItem(itemOnItem);
  api.onItemOnItem(makeInertLocatorOrb);
  api.onItemAction("Locator orb", { Feel: feelLocatorOrb });
  api.onItemAction("Aivas' diary", { Read: readAivasDiary });
  api.onItemAction("Spade", { Dig: digForMorytaniaPiece });
  api.onNpcDeath(handleNpcDeath);
  api.onPlayerLogin(onLogin);
  api.onPlayerDeath(onPlayerDeath);
};
