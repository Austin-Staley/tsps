"use strict";

/**
 * The Vanguards' room: three vanguards (melee, ranged, magic) burst from the ground and must be
 * worn down evenly; whenever one falls too far behind the others they all retreat into their
 * shells, swap places and heal.
 *
 * Wiki (Vanguard):
 * - They rise when a player comes near. Each attack is three: the melee one hits its target
 *   three times; the ranged and magic ones fire at their target and two tiles around it.
 *   Protection prayers reduce, not stop, the damage.
 * - A difference of more than 40% of their health (33.3% in parties of five or more) makes them
 *   shuffle at once and heal to full. Otherwise they shuffle every 20-36 ticks.
 * - In their shells they can't be hurt; a fatal hit landing in the shell leaves 1 hitpoint.
 *   Shuffling, they drop their targets.
 * Near-Reality: the tiles; rise anim 7428, then 7438 / 7443 / 7433 (melee / ranged / magic,
 *   whose form 7526 becomes 7529); falls 7442 / 7447 / 7437; shells walk (7526) to the next
 *   spot, clockwise or not, standing up 10 ticks later; walking over someone hurts 1-5; the
 *   ranged one never moves out of turn; attacks every 4 ticks: melee anim 7441 (3 x base 18),
 *   ranged 7446 with projectile 1332 and gfx 305 (base 22), magic 7436 with projectile 1331 and
 *   gfx 659 (base 22); prayers let a third through; "The Vanguard is protected by its shell.";
 *   the exit crystal 30017.
 */

const Shared = require("./CoxShared");
const Raid = require("./CoxRaid");
const Monsters = require("./CoxMonsters");

const FORM = { BURIED: 7525, SHELL: 7526, MELEE: 7527, RANGED: 7528, MAGIC: 7529 };
const CRYSTAL = 30017;
const STYLE = {
  [FORM.MELEE]: { rise: 7438, fall: 7442, attack: 7441, base: 18, stat: 1, style: "melee" },
  [FORM.RANGED]: { rise: 7443, fall: 7447, attack: 7446, base: 22, stat: 3, style: "ranged", projectile: 1332, impact: 305 },
  [FORM.MAGIC]: { rise: 7433, fall: 7437, attack: 7436, base: 22, stat: 4, style: "magic", projectile: 1331, impact: 659 },
};
const RISE = 7428;
const STAND_UP_TICKS = 10;

/** Cache tiles by version: the three spots' centres. */
const SPOTS = [
  [{ x: 3285, y: 5329 }, { x: 3277, y: 5334 }, { x: 3276, y: 5324 }],
  [{ x: 3317, y: 5330 }, { x: 3309, y: 5334 }, { x: 3309, y: 5324 }],
  [{ x: 3347, y: 5325 }, { x: 3341, y: 5334 }, { x: 3337, y: 5325 }],
];
const CRYSTAL_TILES = [{ x: 3268, y: 5327 }, { x: 3311, y: 5339 }, { x: 3350, y: 5328 }];

class VanguardRoom extends Raid.Room {
  constructor(raid, record) {
    super(raid, record);
    this.vanguards = [];
    this.stage = "buried";
  }

  load() {
    this.spots = SPOTS[this.record.variant].map((spot) => this.tile(spot.x - 1, spot.y - 1, 3));
    for (const spot of this.spots) {
      const vanguard = this.spawnNpc(FORM.BURIED, spot.clone());
      if (!vanguard) continue;
      vanguard.__coxShell = true;
      this.vanguards.push(vanguard);
    }
    this.blockExit(CRYSTAL_TILES, CRYSTAL);
  }

  combatPoints() {
    return Number.MAX_SAFE_INTEGER;
  }

  living() {
    return this.vanguards.filter((npc) => npc.isRegistered() && npc.getHitpoints() > 0);
  }

  /** Wiki: 40% of their health apart (33.3% with five or more raiders). */
  unbalanced() {
    const living = this.living();
    if (living.length < 2) return false;
    const limit = (this.raid.scale >= 5 ? 1 / 3 : 0.4) * Math.max(...living.map((npc) => npc.getMaxHitpoints()));
    const health = living.map((npc) => npc.getHitpoints());
    return Math.max(...health) - Math.min(...health) > limit;
  }

  tick() {
    if (this.stage === "buried") {
      if (this.raiders().some((player) => this.vanguards.some((npc) => player.getLocation().getDistance(npc.getLocation()) < 7))) this.rise();
      return;
    }
    if (this.stage !== "fighting") return;
    for (const npc of this.living()) this.engage(npc);
    if (this.unbalanced() || this.raid.ticks >= this.nextShuffle) this.shuffle();
  }

  rise() {
    this.stage = "rising";
    const forms = Shared.shuffle([FORM.SHELL, FORM.MELEE, FORM.RANGED]);
    this.vanguards.forEach((npc, index) => {
      npc.setNpcTransformationId(forms[index]);
      Shared.animate(npc, RISE);
      npc.__coxForm = forms[index] === FORM.SHELL ? FORM.MAGIC : forms[index];
      Monsters.restat(npc, npc.__coxForm, this.raid.scaling);
    });
    Shared.later(this.raid, 1, () => {
      for (const npc of this.living()) {
        npc.setNpcTransformationId(npc.__coxForm);
        Shared.animate(npc, STYLE[npc.__coxForm].rise);
      }
    });
    Shared.later(this.raid, 2, () => this.standUp());
  }

  standUp() {
    for (const npc of this.living()) npc.__coxShell = false;
    this.stage = "fighting";
    this.nextShuffle = this.raid.ticks + Shared.random(20, 36);
  }

  /** Into their shells; the unbalanced heal to full; each walks to the next spot. */
  shuffle() {
    const heal = this.unbalanced();
    this.stage = "shuffling";
    const clockwise = Shared.random(0, 1) === 0;
    for (const npc of this.living()) {
      npc.__coxShell = true;
      npc.getCombat().reset();
      Shared.animate(npc, STYLE[npc.__coxForm].fall);
      if (heal) npc.setHitpoints(npc.getMaxHitpoints());
    }
    Shared.later(this.raid, 1, () => {
      this.vanguards.forEach((npc) => {
        if (!npc.isRegistered() || npc.getHitpoints() <= 0) return;
        const index = this.spots.findIndex((spot) => spot.equals(npc.getLocation()));
        const from = index >= 0 ? index : this.vanguards.indexOf(npc);
        const to = (from + (clockwise ? 1 : 2)) % 3;
        npc.setNpcTransformationId(FORM.SHELL);
        Shared.walkStraight(npc, this.spots[to]);
      });
    });
    Shared.later(this.raid, 1 + STAND_UP_TICKS, () => {
      for (const npc of this.living()) {
        npc.setNpcTransformationId(npc.__coxForm);
        Shared.animate(npc, STYLE[npc.__coxForm].rise);
      }
      this.standUp();
    });
  }

  /** Shells crush whoever they walk over. */
  modifyHit(npc, hit) {
    if (!this.vanguards.includes(npc) || !npc.__coxShell) return;
    for (const part of hit.getHits()) part.setDamage(0);
    hit.updateTotalDamage();
    const attacker = hit.getAttacker?.();
    if (attacker?.isPlayer?.()) attacker.getAsPlayer().sendMessage("The Vanguard is protected by its shell.");
  }

  /** A fatal hit in the shell, or one that would leave the others out of balance, leaves 1. */
  beforeNpcDeath(npc) {
    if (!this.vanguards.includes(npc)) return false;
    const others = this.living().filter((other) => other !== npc);
    if (npc.__coxShell || (others.length === 2 && this.stage === "fighting" && this.unbalanced())) {
      npc.setHitpoints(1);
      return true;
    }
    return false;
  }

  onNpcDeath(npc) {
    if (!this.vanguards.includes(npc)) return;
    if (this.living().filter((other) => other !== npc).length === 0) this.clearExit();
  }

  shellsTrample() {
    for (const npc of this.living()) {
      if (!npc.__coxShell || !npc.getMovementQueue().isMovings()) continue;
      const at = npc.getLocation();
      for (const player of this.raiders()) {
        const x = player.getLocation().getX() - at.getX();
        const y = player.getLocation().getY() - at.getY();
        if (x >= 0 && x < 3 && y >= 0 && y < 3) Shared.damage(player, Shared.random(1, 5));
      }
    }
  }

  /** Three tiles: the target's and two free ones within 3 of it. */
  volleyTiles(npc, target) {
    const { Location, RegionManager } = Shared.core();
    const at = target.getLocation();
    const tiles = [at.clone()];
    for (let tries = 0; tries < 50 && tiles.length < 3; tries++) {
      const tile = new Location(at.getX() + Shared.random(-3, 3), at.getY() + Shared.random(-3, 3), at.getZ());
      if (tiles.some((other) => other.equals(tile)) || RegionManager.blocked(tile, this.map)) continue;
      const inside = tile.getX() >= npc.getLocation().getX() && tile.getX() < npc.getLocation().getX() + 3
        && tile.getY() >= npc.getLocation().getY() && tile.getY() < npc.getLocation().getY() + 3;
      if (!inside) tiles.push(tile);
    }
    return tiles;
  }

  attack(npc, target) {
    const form = STYLE[npc.__coxForm];
    if (!form) return;
    const max = Monsters.maxHitFor(npc, form.base, form.stat);
    Shared.animate(npc, form.attack);
    if (npc.__coxForm === FORM.MELEE) {
      Shared.sound(target, 3308);
      for (let i = 0; i < 3; i++) Shared.strike(npc, target, "melee", max, 0, { prayerMultiplier: 1 / 3 });
      return;
    }
    if (npc.__coxForm === FORM.MAGIC) Shared.sound(target, 3530);
    for (const tile of this.volleyTiles(npc, target)) {
      const delay = npc.__coxForm === FORM.RANGED ? 1
        : Shared.projectile(this.map, npc, tile, form.projectile, { delay: 15, duration: 85, startHeight: 43, endHeight: 0 });
      if (npc.__coxForm === FORM.RANGED) Shared.projectile(this.map, npc, tile, form.projectile, { delay: 0, duration: 25, startHeight: 20, endHeight: 0 });
      for (const player of this.raiders()) {
        if (player.getLocation().equals(tile)) Shared.strike(npc, player, form.style, max, delay, { prayerMultiplier: 1 / 3 });
      }
      Shared.later(this.raid, delay, () => {
        Shared.graphicAt(this.raiders(), form.impact, tile);
        if (npc.__coxForm === FORM.RANGED) for (const viewer of this.raiders()) Shared.sound(viewer, 360);
      });
    }
  }
}

Raid.registerRoom("VANGUARD", VanguardRoom);

Raid.onTick(function vanguardsTrample(raid) {
  for (const room of raid.rooms) if (room instanceof VanguardRoom && room.stage === "shuffling") room.shellsTrample();
});

function vanguardCombat(api) {
  const { CombatMethod, CombatType } = api.core;
  return class VanguardCombat extends CombatMethod {
    type() {
      return CombatType.MELEE;
    }

    attackDistance(npc) {
      return npc.__coxForm === FORM.MELEE ? 1 : 10;
    }

    attackSpeed() {
      return 4;
    }

    canAttack(npc) {
      return !npc.__coxShell;
    }

    canPursue(npc) {
      return npc.__coxForm === FORM.MELEE;
    }

    start(npc, target) {
      const room = npc.__coxRoom;
      if (room instanceof VanguardRoom && target?.isPlayer?.()) room.attack(npc, target.getAsPlayer());
    }

    hits() {
      return [];
    }
  };
}

module.exports = function registerCoxVanguards(api) {
  Shared.bind(api);
  api.registerNpcCombatMethodProvider(Object.values(FORM), vanguardCombat(api));
};

Object.assign(module.exports, { VanguardRoom });
