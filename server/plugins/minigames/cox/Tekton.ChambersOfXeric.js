"use strict";

/**
 * Tekton's room: he smiths at his anvil until someone comes near, walks to a raider, plants
 * himself and swings; after a while (or with nobody in reach) he goes back to the anvil to
 * repair himself while sparks fly, then comes back enraged.
 *
 * Wiki (Tekton; Chambers of Xeric/Strategies, Tekton):
 * - Immune to Ranged; Magic does a fifth. Immune to binding.
 * - He walks to a player until he reaches them, then stands solid in a combat stance and
 *   attacks the side in front of him (and with a slash, the side to his right too). Max hit
 *   52, 59 enraged (78 / 87 in Challenge Mode); attack speed 3.
 * - After 10-14 attacks, or nobody in melee range when he looks, he returns to the anvil,
 *   repairing about 1.33% of his health every few ticks while two sparks fly at each player
 *   (3x3, 10-20 damage). Anyone under him as he walks is stomped.
 * - Done repairing he is enraged (higher max hit and defences) for a short while.
 * - Drops: 5 stinkhorn mushrooms, 2 overload (+), a revitalisation (+) and a prayer enhance
 *   (+) (its drop table).
 * Not on the Wiki (to check against a capture): the tiles; anims (rise 7474 / 7487 enraged, stance 7478 / 7488, leave stance
 *   7479 / 7489, lean to anvil 7475, stab 7482 / 7493, slash 7483 / 7494, crush 7484 / 7492);
 *   forms 7540 idle, 7541 walking, 7542 fighting, 7543 / 7544 enraged, 7545 at the anvil
 *   (untouchable: "Tekton's anvil protects him from your attacks."); a fire (30021) shuts the
 *   way in once he wakes; the solid block (30023) while he fights; sparks every 4 ticks for 20
 *   ticks (projectile 660, gfx 659, sounds 155 and 156) from fixed spots, none at the safe tile
 *   by the entrance; the enraged form lasts 18 ticks of fighting; stomps 1-3; protect from
 *   melee lets half through; the exit crystal 30017.
 */

const Shared = require("./CoxShared");
const Raid = require("./CoxRaid");
const Monsters = require("./CoxMonsters");

const FORM = { IDLE: 7540, WALKING: 7541, FIGHTING: 7542, ENRAGED_WALKING: 7543, ENRAGED_FIGHTING: 7544, ANVIL: 7545 };
const OBJECT = { CRYSTAL: 30017, FIRE: 30021, BLOCK: 30023 };
const ANIM = {
  RISE: [7474, 7487], STANCE: [7478, 7488], LEAVE: [7479, 7489], LEAN: 7475,
  STAB: [7482, 7493], SLASH: [7483, 7494], CRUSH: [7484, 7492],
};
const SPARK = { PROJECTILE: 660, GFX: 659, MIN: 10, MAX: 20, EVERY: 4, FOR: 20 };
const ENRAGED_TICKS = 18;
const HEAL_SHARE = 0.0133;

/** Cache tiles by version. */
const ANVIL_TILES = [{ x: 3279, y: 5298 }, { x: 3307, y: 5294 }, { x: 3341, y: 5298 }];
const CRYSTAL_TILES = [{ x: 3270, y: 5294 }, { x: 3310, y: 5304 }, { x: 3352, y: 5296 }];
const FIRE_TILES = [{ x: 3279, y: 5281 }, { x: 3311, y: 5281 }, { x: 3343, y: 5281 }];
const SAFE_TILES = [{ x: 3280, y: 5280 }, { x: 3312, y: 5280 }, { x: 3344, y: 5280 }];
const SPARK_TILES = [
  [{ x: 3273, y: 5288 }, { x: 3273, y: 5302 }, { x: 3280, y: 5305 }, { x: 3289, y: 5303 }, { x: 3288, y: 5289 }],
  [{ x: 3320, y: 5289 }, { x: 3321, y: 5303 }, { x: 3317, y: 5302 }, { x: 3303, y: 5295 }, { x: 3305, y: 5288 }, { x: 3305, y: 5301 }],
  [{ x: 3350, y: 5289 }, { x: 3334, y: 5288 }, { x: 3335, y: 5302 }, { x: 3343, y: 5304 }, { x: 3350, y: 5303 }],
];
/** Facing south, west, north, east; the side to his right is the next one. */
const FACINGS = ["south", "west", "north", "east"];

class TektonRoom extends Raid.Room {
  constructor(raid, record) {
    super(raid, record);
    this.state = "idle";
    this.enraged = 0;
  }

  load() {
    const variant = this.record.variant;
    const anvil = ANVIL_TILES[variant];
    this.tekton = this.spawnNpc(FORM.IDLE, this.tile(anvil.x, anvil.y, 6));
    this.home = this.tekton?.getLocation().clone();
    this.safeTile = this.tile(SAFE_TILES[variant].x, SAFE_TILES[variant].y);
    this.sparkTiles = SPARK_TILES[variant].map((spot) => this.tile(spot.x, spot.y));
    this.blockExit(CRYSTAL_TILES, OBJECT.CRYSTAL);
  }

  combatPoints() {
    return this.tekton ? Math.floor(5 * this.tekton.getMaxHitpoints() * 1.05) : 0;
  }

  alive() {
    return this.tekton?.isRegistered() && this.tekton.getHitpoints() > 0;
  }

  form(normal, enraged) {
    this.tekton.setNpcTransformationId(this.enraged > 0 ? enraged : normal);
  }

  anim(pair) {
    Shared.animate(this.tekton, Array.isArray(pair) ? pair[this.enraged > 0 ? 1 : 0] : pair);
  }

  /** Raiders in reach of a melee swing: beside him, not under him nor on a corner. */
  reachable() {
    const npc = this.tekton;
    const at = npc.getLocation();
    const size = npc.getSize();
    return this.raiders().filter((player) => {
      if (player.getHitpoints() <= 0) return false;
      const x = player.getLocation().getX() - at.getX();
      const y = player.getLocation().getY() - at.getY();
      const inX = x >= 0 && x < size;
      const inY = y >= 0 && y < size;
      if (inX && inY) return false;
      return (inX && (y === -1 || y === size)) || (inY && (x === -1 || x === size));
    });
  }

  tick() {
    if (!this.alive()) return;
    if (this.enraged > 0 && this.state === "fighting" && --this.enraged === 0) {
      this.form(FORM.FIGHTING, FORM.ENRAGED_FIGHTING);
      Monsters.restat(this.tekton, FORM.FIGHTING, this.raid.scaling);
    }
    if (this.tekton.getMovementQueue().isMovings()) this.stomp();
    switch (this.state) {
      case "idle": return this.watch();
      case "engaging": return this.approach();
      case "fighting": return this.fight();
      case "returning": return this.returnHome();
      case "anvil": return this.smith();
      default: return undefined;
    }
  }

  /** Anyone within 3 tiles of him wakes him; the fire then shuts the way in. */
  watch() {
    const at = this.tekton.getLocation();
    const size = this.tekton.getSize();
    const near = this.raiders().some((player) => {
      const x = player.getLocation().getX();
      const y = player.getLocation().getY();
      return x >= at.getX() - 3 && x < at.getX() + size + 3 && y >= at.getY() - 3 && y < at.getY() + size + 3;
    });
    if (!near) return;
    if (!this.fire) {
      const spot = FIRE_TILES[this.record.variant];
      const { GameObject, ObjectManager } = Shared.core();
      this.fire = new GameObject(OBJECT.FIRE, this.tile(spot.x, spot.y, 2), 10, this.record.rotation, this.map);
      ObjectManager.register(this.fire, true);
    }
    this.engage();
  }

  engage() {
    this.state = "engaging";
    this.stage = 0;
    this.inStance = false;
    this.target = null;
    this.anim(ANIM.RISE);
    this.form(FORM.WALKING, FORM.ENRAGED_WALKING);
  }

  /** Rises, picks a raider and walks to them; in reach, takes his stance, then fights. */
  approach() {
    if (++this.stage < 2) return undefined;
    if (!this.target || !this.raid.players.has(this.target) || this.raid.roomAt(this.target.getLocation()) !== this) {
      const raiders = this.raiders().filter((player) => player.getHitpoints() > 0 && !player.getLocation().equals(this.safeTile));
      if (raiders.length === 0) return this.retreat();
      this.target = Shared.randomOf(raiders);
    }
    this.tekton.setPositionToFace(this.target.getLocation());
    if (this.reachable().includes(this.target)) {
      if (this.inStance) return this.startFighting();
      this.anim(ANIM.STANCE);
      this.inStance = true;
      return undefined;
    }
    this.inStance = false;
    if (!this.tekton.getMovementQueue().isMovings()) {
      Shared.core().PathFinder.calculateEntityRoute(this.tekton, this.target);
      if (!this.tekton.getMovementQueue().isMovings() && this.stage > 4) return this.retreat();
    }
    return undefined;
  }

  startFighting() {
    this.state = "fighting";
    this.attacks = 0;
    this.attackLimit = Shared.random(10, 14);
    this.cooldown = 0;
    if (this.foughtBefore && this.enraged > 0) this.enraged = ENRAGED_TICKS;
    this.foughtBefore = true;
    this.form(FORM.FIGHTING, FORM.ENRAGED_FIGHTING);
    this.solid(true);
  }

  /** A solid block where he stands while fighting (no walking under him). */
  solid(on) {
    const { GameObject, ObjectManager } = Shared.core();
    if (on && !this.block) {
      this.block = new GameObject(OBJECT.BLOCK, this.tekton.getLocation().clone(), 10, 0, this.map);
      ObjectManager.register(this.block, true);
    } else if (!on && this.block) {
      ObjectManager.deregister(this.block, true);
      this.block = null;
    }
  }

  fight() {
    if (this.cooldown-- > 0) return undefined;
    if (this.attacks >= this.attackLimit) return this.retreat();
    const reachable = this.reachable();
    if (reachable.length === 0) return this.retreat();
    if (!reachable.includes(this.target)) this.target = Shared.randomOf(reachable);
    const style = Shared.random(0, 2);
    this.anim([ANIM.STAB, ANIM.SLASH, ANIM.CRUSH][style]);
    const facing = this.facingTowards(this.target.getLocation());
    this.tekton.setPositionToFace(this.target.getLocation());
    Shared.later(this.raid, 1, () => this.swing(facing, style === 1));
    this.attacks++;
    this.cooldown = 2;
    return undefined;
  }

  facingTowards(location) {
    const npc = this.tekton;
    const size = npc.getSize();
    const dx = location.getX() - (npc.getLocation().getX() + (size - 1) / 2);
    const dy = location.getY() - (npc.getLocation().getY() + (size - 1) / 2);
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "east" : "west";
    return dy > 0 ? "north" : "south";
  }

  /** The swing lands on the side he faces (and with a slash the side to his right). */
  swing(facing, slash) {
    if (!this.alive()) return;
    const sides = [facing];
    if (slash) sides.push(FACINGS[(FACINGS.indexOf(facing) + 1) % 4]);
    const npc = this.tekton;
    const at = npc.getLocation();
    const size = npc.getSize();
    const maxHit = npc.getDefinition().getMaxHit();
    for (const player of this.reachable()) {
      const x = player.getLocation().getX() - at.getX();
      const y = player.getLocation().getY() - at.getY();
      const side = y === -1 ? "south" : y === size ? "north" : x === -1 ? "west" : "east";
      if (sides.includes(side)) Shared.strike(npc, player, "melee", maxHit, 0, { prayerMultiplier: 0.5 });
    }
  }

  /** Raiders under him as he walks take 1-3. */
  stomp() {
    const at = this.tekton.getLocation();
    const size = this.tekton.getSize();
    for (const player of this.raiders()) {
      const x = player.getLocation().getX() - at.getX();
      const y = player.getLocation().getY() - at.getY();
      if (x >= 0 && x < size && y >= 0 && y < size) Shared.damage(player, Shared.random(1, 3));
    }
  }

  retreat() {
    this.state = "returning";
    this.solid(false);
    this.anim(ANIM.LEAVE);
    this.form(FORM.WALKING, FORM.ENRAGED_WALKING);
    Shared.core().PathFinder.calculateWalkRoute(this.tekton, this.home.getX(), this.home.getY());
  }

  returnHome() {
    if (this.tekton.getMovementQueue().isMovings()) return;
    if (!this.tekton.getLocation().equals(this.home)) {
      Shared.walkStraight(this.tekton, this.home);
      return;
    }
    this.state = "anvil";
    this.enraged = 0;
    Monsters.restat(this.tekton, FORM.FIGHTING, this.raid.scaling);
    this.anim(ANIM.LEAN);
    this.anvilTicks = -2;
  }

  smith() {
    const tick = this.anvilTicks++;
    if (tick === -2) this.tekton.setNpcTransformationId(FORM.ANVIL);
    if (tick < 0) return;
    const targets = this.raiders().filter((player) => !player.getLocation().equals(this.safeTile) && player.getLocation().getDistance(this.safeTile) > 1);
    if (targets.length === 0) {
      this.state = "idle";
      this.tekton.setNpcTransformationId(FORM.IDLE);
      return;
    }
    if (tick % SPARK.EVERY === 0) {
      for (const player of targets) this.sparks(player, 2);
      this.tekton.heal(Math.max(1, Math.floor(this.tekton.getMaxHitpoints() * HEAL_SHARE)));
    }
    if (tick >= SPARK.FOR) {
      this.enraged = 100;
      Monsters.restat(this.tekton, FORM.ENRAGED_FIGHTING, this.raid.scaling);
      this.engage();
    }
  }

  sparks(player, count) {
    const to = player.getLocation().clone();
    const spots = Shared.shuffle(this.sparkTiles).slice(0, count);
    for (const from of spots) {
      Shared.sound(player, 155);
      const delay = Shared.projectile(this.map, from, to, SPARK.PROJECTILE, { delay: 0, duration: 60, startHeight: 100, endHeight: 0 });
      Shared.later(this.raid, delay, () => {
        Shared.graphicAt(this.raiders(), SPARK.GFX, to);
        for (const raider of this.raiders()) {
          if (raider.getLocation().getDistance(to) <= 1) {
            Shared.sound(raider, 156);
            Shared.damage(raider, Shared.random(SPARK.MIN, SPARK.MAX));
          }
        }
      });
    }
  }

  /** Wiki: immune to Ranged, a fifth from Magic; nothing while he repairs at the anvil. */
  modifyHit(npc, hit) {
    if (npc !== this.tekton) return;
    const { CombatType } = Shared.core();
    const type = hit.getCombatType?.();
    let factor = type === CombatType.RANGED ? 0 : type === CombatType.MAGIC ? 0.2 : 1;
    if (npc.getNpcTransformationId() === FORM.ANVIL) {
      factor = 0;
      const attacker = hit.getAttacker?.();
      if (attacker?.isPlayer?.()) attacker.getAsPlayer().sendMessage("Tekton's anvil protects him from your attacks.");
    }
    if (factor === 1) return;
    for (const part of hit.getHits()) part.setDamage(Math.floor(part.getDamage() * factor));
    hit.updateTotalDamage();
  }

  onNpcDeath(npc) {
    if (npc !== this.tekton) return;
    this.state = "dead";
    this.solid(false);
    this.clearExit();
    const fire = this.fire;
    this.fire = null;
    if (fire) Shared.later(this.raid, 2, () => Shared.core().ObjectManager.deregister(fire, true));
  }
}

Raid.registerRoom("TEKTON", TektonRoom);

/** His attacks are the room's; the core combat only keeps him targeting. */
function tektonCombat(api) {
  const { CombatMethod, CombatType } = api.core;
  return class TektonCombat extends CombatMethod {
    type() {
      return CombatType.MELEE;
    }

    canAttack() {
      return false;
    }

    hits() {
      return [];
    }
  };
}

/** The fire at the way in: crossing it puts you on its other side. */
function crossFire(event) {
  const room = Raid.raidOf(event.player)?.roomAt(event.player.getLocation());
  if (!(room instanceof TektonRoom)) return false;
  Shared.crossFire(event.player, event.object);
  return true;
}

module.exports = function registerCoxTekton(api) {
  Shared.bind(api);
  api.registerNpcCombatMethodProvider(Object.values(FORM), tektonCombat(api));
  Shared.onObjectIds(api, [OBJECT.FIRE], crossFire);
};

Object.assign(module.exports, { TektonRoom });
