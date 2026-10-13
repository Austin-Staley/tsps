/**
 * The Truth Hurtz: Ivandis' tomb blockage and the Daeyalt refinery.
 * Coordinates/objectives follow Quest Helper; encounter advice follows the OSRS Wiki quick guide.
 */
module.exports = function registerRefinery(api) {
  const {
    Area, Boundary, Equipment, GameObject, HitDamage, HitMask, ItemIdentifiers: I,
    Location, NpcIdentifiers: N, ObjectIdentifiers: O, ObjectManager, PrivateArea,
  } = api.core;
  const { startTranscript } = require("../QuestRuntime");
  const mining = require("../../skills/Mining.plugin");

  const PAGE = "The Blood Moon Rises";
  const START_EVENT = "bmr:refinery-start";
  const COMPLETED_EVENT = "bmr:refinery-completed";
  const PROGRESS_ATTRIBUTE = "the-blood-moon-rises:refinery-progress";
  const STORY_ATTRIBUTE = "quest.the_blood_moon_rises.slepe-story";
  const STAGE_VARBIT = 15464;
  const STAGE = Object.freeze({
    ROUTE: 48, TOMB: 50, PICKAXE: 52, MINED: 54, TUNNEL: 56,
    FIGHT: 58, FREED: 60, ESCAPED: 62,
  });
  const TOMBSTILE = Object.freeze({ x: 3505, y: 9857, z: 0 });
  const TUNNEL_TILE = Object.freeze({ x: 3117, y: 7472, z: 2 });
  const ROOM_BOUNDS = [new Boundary(3164, 3196, 7447, 7469, 0)];
  const TOMB_BOUNDS = [new Boundary(3485, 3516, 9853, 9879, 0)];
  const INVESTIGATE = O.BLOCKAGE_9;
  const MINE_THROUGH = O.BLOCKAGE_10;
  const TOMB_ENTRANCE = O.CAVE_ENTRANCE_98;
  const MINE_TUNNEL = O.TUNNEL_71;
  const CASTLE_EXIT = O.ENTRY_28;
  // The QH objective points at a cutscene variant with no Talk-to cache action;
  // use the cache's talkable Ivan model at the same canonical objective tile.
  const IVAN = N.IVAN_STROM_13;
  const IVAN_AFTER_FIGHT = N.IVAN_STROM_13;
  const VELIAF_AFTER_FIGHT = N.VELIAF_HURTZ_25;
  const PICKAXE_ITEM = I.BRONZE_PICKAXE;
  const VYREWEAPONS = new Set([I.IVANDIS_FLAIL, I.IVANDIS_FLAIL_2, I.BLISTERWOOD_FLAIL, I.BLISTERWOOD_FLAIL_2]);
  const ENEMIES = Object.freeze([
    [N.VYREWATCH_82, 3171, 7464],
    [N.VYREWATCH_83, 3175, 7467],
    [N.VYREWATCH_82, 3182, 7464],
    [N.VYREWATCH_SENTINEL_17, 3177, 7460],
    [N.VYREWATCH_SENTINEL_18, 3184, 7461],
  ]);
  const BLOOD_ORB = O.BLOOD_ORB;
  // The Wiki describes periodic orbs and their effects, but does not publish tick values.
  // shortcut: approximate the orb interval/pulse damage until calibrated against a live capture.
  const ORB_INTERVAL = 40, ORB_LIFETIME = 20, ORB_PULSE_INTERVAL = 4;
  const ORB_TILES = [[3174, 7463], [3180, 7466], [3185, 7459]];
  const sessions = new WeakMap();
  const tombIvans = new WeakMap();
  const orbOwners = new WeakMap();

  const progress = player => player.getAttribute(PROGRESS_ATTRIBUTE) ?? {};
  function setStage(player, value) {
    player.getPacketSender().sendVarbit(STAGE_VARBIT, value);
  }
  function setProgress(player, update) {
    const next = { ...progress(player), ...update };
    player.setAttribute(PROGRESS_ATTRIBUTE, next);
    const nativeStage = ({ route: STAGE.ROUTE, tomb: STAGE.TOMB, pickaxe: STAGE.PICKAXE,
      mined: STAGE.MINED, tunnel: STAGE.TUNNEL, fight: STAGE.FIGHT,
      cleared: STAGE.FREED, freed: STAGE.FREED, escaped: STAGE.ESCAPED })[next.phase];
    if (nativeStage !== undefined) setStage(player, nativeStage);
    return next;
  }
  function isInRoom(player) {
    const p = player.getLocation();
    return p.getZ() === 0 && p.getX() >= 3164 && p.getX() <= 3196 && p.getY() >= 7447 && p.getY() <= 7469;
  }
  function cleanTombIvan(player) {
    const npc = tombIvans.get(player);
    if (npc) api.removeNpc(npc);
    tombIvans.delete(player);
  }
  function ensureTombIvan(player) {
    if (tombIvans.get(player)) return;
    const npc = api.spawnNpc({ id: IVAN, x: 3505, y: 9861, z: 0, wanderRadius: 0, owner: player, ownerOnly: true });
    if (npc) {
      npc.setScriptedMovement(true);
      npc.getMovementQueue().setBlockMovement(true);
      tombIvans.set(player, npc);
    }
  }
  function sync(player) {
    const current = progress(player);
    const nativeStage = ({ route: STAGE.ROUTE, tomb: STAGE.TOMB, pickaxe: STAGE.PICKAXE,
      mined: STAGE.MINED, tunnel: STAGE.TUNNEL, fight: STAGE.FIGHT,
      cleared: STAGE.FREED, freed: STAGE.FREED, escaped: STAGE.ESCAPED })[current.phase];
    if (nativeStage !== undefined) setStage(player, nativeStage);
  }

  class TombArea extends Area {
    constructor() { super(TOMB_BOUNDS); }
    process(mobile) {
      if (!mobile.isPlayer?.()) return;
      const player = mobile.getAsPlayer();
      const current = progress(player);
      if (!current.started || ["freed", "escaped"].includes(current.phase)) return;
      if (current.phase === "route") setProgress(player, { phase: "tomb" });
      else sync(player);
      ensureTombIvan(player);
    }
    postLeave(mobile, logout) {
      if (mobile.isPlayer?.()) cleanTombIvan(mobile.getAsPlayer());
      super.postLeave(mobile, logout);
    }
  }

  function clearArea(area) {
    for (const npc of area.cast) api.removeNpc(npc);
    area.cast.clear();
    for (const orb of area.orbs) {
      ObjectManager.deregister(orb.object, true);
      orbOwners.delete(orb.object);
    }
    area.orbs.length = 0;
  }
  function alive(npc) { return npc && npc.getHitpoints() > 0; }
  function spawnRoomActors(area) {
    const player = area.player;
    const current = progress(player);
    area.cast.clear();
    if (current.phase === "cleared" || current.phase === "freed" || current.phase === "escaped") {
      spawnRefineryResidents(area);
      return;
    }
    const killed = new Set(current.killed ?? []);
    for (let slot = 0; slot < ENEMIES.length; slot++) {
      if (killed.has(slot)) continue;
      const [id, x, y] = ENEMIES[slot];
      const npc = api.spawnNpc({ id, x, y, z: 0, wanderRadius: 0, owner: player, ownerOnly: true });
      if (!npc) {
        player.sendMessage("The refinery guards could not be restored. Leave and re-enter the tunnel to try again.");
        continue;
      }
      area.enter(npc);
      area.cast.set(slot, npc);
    }
    area.nextOrbTick = area.ticks + ORB_INTERVAL;
  }
  function spawnResident(area, id, x, y) {
    const npc = api.spawnNpc({ id, x, y, z: 0, wanderRadius: 0, owner: area.player, ownerOnly: true });
    if (!npc) return null;
    npc.setScriptedMovement(true);
    npc.getMovementQueue().setBlockMovement(true);
    area.enter(npc);
    area.residents.push(npc);
    return npc;
  }
  function spawnRefineryResidents(area) {
    if (area.residents.length) return;
    spawnResident(area, IVAN_AFTER_FIGHT, 3178, 7459);
    spawnResident(area, VELIAF_AFTER_FIGHT, 3176, 7459);
    spawnResident(area, N.MALE_SLAVE, 3179, 7461);
    spawnResident(area, N.FEMALE_SLAVE, 3180, 7461);
  }
  function spawnOrb(area) {
    const [x, y] = ORB_TILES[area.orbIndex++ % ORB_TILES.length];
    const object = new GameObject(BLOOD_ORB, new Location(x, y, 0), 10, 0, area);
    ObjectManager.register(object, true);
    area.orbs.push({ object, expires: area.ticks + ORB_LIFETIME, pulse: area.ticks });
    orbOwners.set(object, area);
  }
  function distanceTo(player, object) {
    const p = player.getLocation(), o = object.getLocation();
    return Math.max(Math.abs(p.getX() - o.getX()), Math.abs(p.getY() - o.getY()));
  }
  function pulseOrb(area, orb) {
    const source = [...area.cast.values()].find(npc => npc.getId() === N.VYREWATCH_SENTINEL_17 || npc.getId() === N.VYREWATCH_SENTINEL_18);
    for (const npc of area.cast.values()) {
      if (npc.getId() === N.VYREWATCH_SENTINEL_17 || npc.getId() === N.VYREWATCH_SENTINEL_18) continue;
      const p = npc.getLocation(), o = orb.object.getLocation();
      if (Math.max(Math.abs(p.getX() - o.getX()), Math.abs(p.getY() - o.getY())) <= 1) {
        const hit = new HitDamage(Math.max(1, Math.floor(npc.getMaxHitpoints() * 0.5)), HitMask.RED);
        if (source) hit.setSource(source);
        npc.getCombat().getHitQueue().addPendingDamage([hit]);
      }
    }
    if (distanceTo(area.player, orb.object) <= 1) {
      const hit = new HitDamage(4, HitMask.RED);
      if (source) hit.setSource(source);
      area.player.getCombat().getHitQueue().addPendingDamage([hit]);
    }
  }

  class RefineryArea extends PrivateArea {
    constructor(player) {
      super(ROOM_BOUNDS);
      this.player = player; this.cast = new Map(); this.residents = []; this.orbs = [];
      this.ticks = 0; this.nextOrbTick = 0; this.orbIndex = 0;
    }
    canAttack(attacker, target) {
      if (attacker === this.player && [...this.cast.values()].includes(target)) return null;
      if (target === this.player && [...this.cast.values()].includes(attacker)) return null;
      return false;
    }
    process(member) {
      if (member !== this.player) return;
      this.ticks++;
      const current = progress(member);
      if (current.phase !== "fight") return;
      for (const orb of [...this.orbs]) {
        if (this.ticks >= orb.expires) {
          ObjectManager.deregister(orb.object, true); orbOwners.delete(orb.object);
          this.orbs.splice(this.orbs.indexOf(orb), 1); continue;
        }
        if (this.ticks >= orb.pulse) { pulseOrb(this, orb); orb.pulse = this.ticks + ORB_PULSE_INTERVAL; }
      }
      const sentinelAlive = [...this.cast.values()].some(npc =>
        npc.getId() === N.VYREWATCH_SENTINEL_17 || npc.getId() === N.VYREWATCH_SENTINEL_18);
      if (this.ticks >= this.nextOrbTick && sentinelAlive) {
        spawnOrb(this);
        this.nextOrbTick = this.ticks + ORB_INTERVAL;
      }
    }
    postLeave(member, logout) {
      if (member === this.player) {
        clearArea(this);
        sessions.delete(member);
      }
      super.postLeave(member, logout);
    }
  }

  function enterRoom(player, moveInside = true) {
    if (sessions.has(player)) return sessions.get(player);
    const current = progress(player);
    if (!current.started || !["tunnel", "fight", "cleared", "freed", "escaped"].includes(current.phase)) return null;
    const area = new RefineryArea(player);
    sessions.set(player, area);
    area.enter(player);
    if (moveInside) player.moveTo(new Location(3173, 7464, 0));
    if (current.phase === "tunnel") setProgress(player, { phase: "fight", killed: [] });
    spawnRoomActors(area);
    return area;
  }
  function start({ player }) {
    if (!player) return;
    if (!progress(player).started) setProgress(player, { started: true, phase: "route", killed: [] });
    else sync(player);
  }
  function tombPassage(event) {
    const player = event?.player;
    if (!player) return false;
    const id = event.definition?.id ?? event.objectId;
    const option = event.option;
    const tile = event.location ?? event.object?.getLocation?.();
    const x = tile?.getX?.() ?? tile?.x, y = tile?.getY?.() ?? tile?.y, z = tile?.getZ?.() ?? tile?.z;
    if (id === INVESTIGATE && option === "Investigate" && x === TOMBSTILE.x && y === TOMBSTILE.y && z === TOMBSTILE.z) {
      if (!progress(player).started || ["mined", "tunnel", "fight", "cleared", "freed", "escaped"].includes(progress(player).phase)) return false;
      event.handled = true;
      return startTranscript(api, player, IVAN, PAGE, "the-truth-hurtz-investigating-the-blockage");
    }
    if (id === MINE_THROUGH && option === "Mine-through" && x === TOMBSTILE.x && y === TOMBSTILE.y && z === TOMBSTILE.z) {
      if (!progress(player).started || progress(player).phase !== "pickaxe") return false;
      event.handled = true;
      if (!mining.findBestPickaxe(player)) { player.sendMessage("You need a pickaxe. Ivan said he has a spare one."); return true; }
      return startTranscript(api, player, IVAN, PAGE, "the-truth-hurtz-mining-the-blockage");
    }
    if (id === TOMB_ENTRANCE && option === "Enter" && x === TOMBSTILE.x && y === TOMBSTILE.y && z === TOMBSTILE.z) {
      if (progress(player).phase !== "mined") return false;
      event.handled = true;
      setProgress(player, { phase: "tunnel" });
      player.getCombat().reset();
      player.moveTo(new Location(TUNNEL_TILE.x, TUNNEL_TILE.y, TUNNEL_TILE.z));
      return true;
    }
    if (id === MINE_TUNNEL && option === "Enter" && x === TUNNEL_TILE.x && y === TUNNEL_TILE.y && z === TUNNEL_TILE.z) {
      if (!["tunnel", "fight", "cleared", "freed"].includes(progress(player).phase)) return false;
      event.handled = true;
      enterRoom(player);
      return true;
    }
    if (id === CASTLE_EXIT && option === "Enter" && x === 3182 && y === 7470 && z === 0) {
      if (progress(player).phase !== "freed") return false;
      event.handled = true;
      setProgress(player, { phase: "escaped" });
      player.getCombat().reset();
      player.moveTo(new Location(3182, 7571, 0));
      return true;
    }
    return false;
  }
  function answerCondition({ player, stepId, pages }) {
    if (!player || stepId !== "e9a7zZ" || (Array.isArray(pages) && !pages.some(entry => entry?.page === PAGE))) return null;
    const missingPickaxe = !mining.findBestPickaxe(player);
    if (missingPickaxe && progress(player).phase === "tomb") setProgress(player, { phase: "pickaxe" });
    return missingPickaxe;
  }
  function talkIvan(event) {
    const player = event?.player;
    if (!player || !["Ivan Strom", "Veliaf Hurtz"].includes(event.definition?.getName?.())) return false;
    const current = progress(player);
    if (current.phase === "cleared") return talkRefinery(event);
    if (!current.started || current.phase !== "pickaxe") return false;
    const location = event.npc?.getLocation?.();
    if (!location || location.getZ() !== 0 || location.getX() < 3485 || location.getX() > 3516 || location.getY() < 9853 || location.getY() > 9879) return false;
    event.handled = true;
    if (player.getInventory().isFull() && !player.getInventory().contains(PICKAXE_ITEM)) {
      player.sendMessage("Make room in your inventory before asking Ivan for his spare pickaxe."); return true;
    }
    return startTranscript(api, player, event.npc.getId(), PAGE,
      "the-truth-hurtz-talking-to-ivan-after-finding-the-blockage-without-a-pickaxe");
  }
  function talkRefinery(event) {
    const player = event?.player;
    const npc = event?.npc;
    const name = event?.definition?.getName?.();
    const current = player && progress(player);
    if (!player || !npc || !["Ivan Strom", "Veliaf Hurtz"].includes(name) || current?.phase !== "cleared") return false;
    if (!sessions.get(player)?.residents.includes(npc)) return false;
    event.handled = true;
    return startTranscript(api, player, npc.getId(), PAGE,
      "the-truth-hurtz-talking-to-ivan-and-veliaf-in-the-daeyalt-refinery");
  }
  function action(event) {
    const player = event?.player;
    if (!player) return;
    if (event.stepId === "O3RVAV" && progress(player).phase === "pickaxe") {
      if (!player.getInventory().contains(PICKAXE_ITEM)) player.getInventory().adds(PICKAXE_ITEM, 1);
      setProgress(player, { phase: "pickaxe", borrowedPickaxe: true });
    } else if (event.stepId === "iYSMco" && progress(player).phase === "tomb" && mining.findBestPickaxe(player)) {
      setProgress(player, { phase: "mined" });
    } else if (event.stepId === "qZsfi4" && progress(player).phase === "pickaxe" && mining.findBestPickaxe(player)) {
      setProgress(player, { phase: "mined" });
    } else if (event.stepId === "jYDLQy" && progress(player).phase === "cleared") {
      setProgress(player, { phase: "freed", slavesEscaped: true });
      api.emitCustomEvent(COMPLETED_EVENT, { player });
    }
  }
  function npcDeath({ npc }) {
    const player = npc?.getOwner?.();
    const area = player && sessions.get(player);
    if (!area) return;
    const slot = [...area.cast].find(([, actor]) => actor === npc)?.[0];
    if (slot === undefined) return;
    area.cast.delete(slot);
    const killed = new Set(progress(player).killed ?? []);
    killed.add(slot);
    const updated = [...killed].sort((a, b) => a - b);
    if (updated.length === ENEMIES.length) {
      setProgress(player, { phase: "cleared", killed: updated });
      clearArea(area);
      spawnRefineryResidents(area);
      player.sendMessage("The vyrewatches are defeated. Speak to Ivan and Veliaf.");
    } else setProgress(player, { killed: updated });
  }
  function modifyPlayerHit({ npc, hit }) {
    const player = hit?.getAttacker?.();
    const area = player && sessions.get(player);
    if (!area || ![...area.cast.values()].includes(npc)) return;
    const weapon = player.getEquipment().getItems()[Equipment.WEAPON_SLOT];
    if (weapon && VYREWEAPONS.has(weapon.getId())) return;
    hit.setTotalDamage(0);
    if (!area.flailWarned) {
      area.flailWarned = true;
      player.sendMessage("The vampyres can only be harmed by an Ivandis flail or a blisterwood flail.");
    }
  }
  function syncLogin({ player }) {
    if (!player) return;
    if (player.getAttribute(STORY_ATTRIBUTE)?.tombRouteStarted && !progress(player).started) start({ player });
    sync(player);
    if (isInRoom(player)) enterRoom(player, false);
  }
  function stageChanged(event) {
    if (event?.key !== "the_blood_moon_rises" || !event.player) return;
    sync(event.player);
  }

  api.persistAttribute(PROGRESS_ATTRIBUTE);
  api.registerArea(new TombArea());
  api.onCustomEvent(START_EVENT, start);
  api.onCustomEvent("quest:stage-changed", stageChanged);
  api.onCustomEvent("npc-dialogue:action", action);
  api.onNpcDialogueCondition(answerCondition);
  api.onNpcInteraction("Ivan Strom", { "Talk-to": talkIvan });
  api.onNpcInteraction("Veliaf Hurtz", { "Talk-to": talkRefinery });
  api.onObjectInteraction(tombPassage);
  api.onNpcDeath(npcDeath);
  api.onNpcHitModify(modifyPlayerHit);
  api.onPlayerLogin(syncLogin);
  return { start, sync, tombPassage, answerCondition, talkIvan, talkRefinery, action, npcDeath,
    modifyPlayerHit, enterRoom, sessions, progress, RefineryArea, TombArea, ENEMIES, STAGE };
};
