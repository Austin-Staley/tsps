"use strict";

const Common = require("./Common.DukeSucellus");
const Model = require("./Model.DukeSucellus");

class Fight {
  constructor(session, boss) {
    this.session = session;
    this.player = session.player;
    this.boss = boss;
    this.active = false;
    this.over = false;
    this.stopped = false;
    this.perfect = true;
    this.events = [];
    this.pending = new Set();
    this.vents = new Set();
    this.clock = new Model.AttackClock();
    this.nextAttack = Infinity;
    this.started = 0;
    this.respawnAt = Infinity;
    this.wonAlready = false;
    this.baselineKills = Common.kills(this.player);
    this.sleepEyes();
  }

  valid() {
    return !this.over && !this.stopped && !this.session.ended &&
      this.session.fight === this && this.player.getHitpoints() > 0;
  }

  at(delay, action) {
    this.events.push({ due: this.session.tick + delay, action });
  }

  wake() {
    if (this.active || !this.valid()) return;
    this.active = true;
    this.started = Common.core.World.getProcessCycle();
    this.events = [];
    this.clearVents();
    for (const eye of Common.data.extremities) this.animateEye(eye, Common.data.animations.eyeWake);
    this.at(1, () => {
      for (const eye of Common.data.extremities) this.animateEye(eye, Common.data.animations.eyeAwake);
    });
    this.boss.setNpcTransformationId(Common.data.npcs.awake);
    this.boss.setCombatOverride({ stats: Common.data.normal.stats });
    this.boss.setMaxHitpoints(Common.data.normal.hitpoints);
    this.boss.setHitpoints(Common.data.normal.hitpoints);
    this.boss.performAnimation(new Common.core.Animation(Common.data.animations.wake));
    this.boss.setAttribute(Common.DEMONBANE, 0.7);
    this.nextAttack = this.session.tick + Common.data.timing.wake;
    this.session.setExit(true);
    Common.api.emitCustomEvent("boss-hud:show", {
      player: this.player,
      npcId: Common.data.npcs.awake,
      current: Common.data.normal.hitpoints,
      maximum: Common.data.normal.hitpoints,
    });
  }

  process() {
    if (this.over) {
      if (this.session.tick >= this.respawnAt && !this.session.ended) this.session.reset();
      return;
    }
    if (!this.valid()) return;
    const due = this.events.filter((event) => event.due <= this.session.tick);
    this.events = this.events.filter((event) => event.due > this.session.tick);
    for (const event of due) {
      if (!this.valid()) break;
      event.action();
    }
    if (!this.valid()) return;
    if (!this.active) {
      this.preparationHazards();
      return;
    }
    Common.api.emitCustomEvent("boss-hud:update", {
      player: this.player,
      current: this.boss.getHitpoints(),
    });
    if (this.session.tick < this.nextAttack) return;
    const action = this.clock.next(this.boss.getHitpoints());
    if (action === "gaze") this.gaze();
    else if (action === "gas") this.gas();
    else this.auto();
    this.nextAttack = this.session.tick + (action === "gaze"
      ? Common.data.timing.gaze : Model.attackTicks(this.boss.getHitpoints()));
  }

  auto() {
    const { normal, timing, graphics, animations, magic } = Common.data;
    const target = Common.source(this.session, this.player.getLocation());
    this.boss.setPositionToFace(this.player.getLocation());
    if (Model.melee(target)) {
      this.boss.performAnimation(new Common.core.Animation(animations.melee));
      this.boss.performGraphic(new Common.core.Graphic(graphics.meleeNpc));
      // Normal-world recording 1703: the whole visual row is sent with the attack.
      // It does not establish a seven-tile damaging slam; the current Wiki describes
      // a 3x3 chip followed by an aimed 1x1 main hit.
      const [bossX, bossY] = Common.data.site.boss;
      graphics.meleeRow.forEach((id, offset) => {
        Common.graphic(this.session, id, [bossX + offset, bossY - 1]);
      });
      this.at(timing.chip, () => {
        if (!Model.near(Common.source(this.session, this.player.getLocation()), target)) return;
        const maximum = Common.protectedFrom(this.player, "PROTECT_FROM_MELEE")
          ? normal.protectedChip : normal.chip;
        Common.strike(this, "melee", maximum, { accurate: false, avoidable: false });
      });
      this.at(timing.slam, () => {
        if (!Model.near(Common.source(this.session, this.player.getLocation()), target, 0) ||
            Model.hidden(target)) return;
        const maximum = Common.protectedFrom(this.player, "PROTECT_FROM_MELEE")
          ? normal.protectedSlam : normal.slam;
        Common.strike(this, "melee", maximum);
      });
      return;
    }

    this.boss.performAnimation(new Common.core.Animation(animations.magic));
    const destination = this.player.getLocation().clone();
    this.player.getPacketSender().sendProjectile(
      this.boss.getLocation(), destination, 0, magic.endCycle, graphics.magicProjectile,
      magic.startHeight, magic.endHeight, this.player, magic.startCycle,
      magic.slope, magic.distanceOffset, this.boss,
    );
    this.player.performGraphicInSlot(magic.impactSlot,
      new Common.core.Graphic(graphics.magicImpact, magic.endCycle));
    this.at(timing.magic, () => {
      const maximum = Common.protectedFrom(this.player, "PROTECT_FROM_MAGIC")
        ? normal.protectedMagic : normal.magic;
      Common.strike(this, "magic", maximum, { evenZero: true });
    });
  }

  gaze() {
    this.boss.performAnimation(new Common.core.Animation(Common.data.animations.gaze));
    this.player.sendMessage("<col=6800bf>Duke Sucellus turns his gaze upon you...");
    this.at(Common.data.timing.gazeWarning, () => {
      if (Model.hidden(Common.source(this.session, this.player.getLocation()))) {
        this.player.sendMessage("<col=06600c>You manage to avoid Duke Sucellus' gaze.");
      } else {
        this.player.sendMessage("You failed to avoid Duke Sucellus' gaze.");
        this.at(1, () => Common.hurt(this, Common.data.normal.gaze));
      }
    });
  }

  removeVent(vent) {
    if (!this.vents.delete(vent)) return;
    this.session.area.detach(vent);
    Common.api.removeNpc(vent);
  }

  clearVents() {
    for (const vent of [...this.vents]) this.removeVent(vent);
  }

  ignite(tile, delay = Common.data.timing.gasWarning) {
    const { timing, graphics } = Common.data;
    // The holder is 3x3, so its south-west origin is one tile below the vent centre.
    const location = this.session.tile([tile[0] - 1, tile[1] - 1]);
    const vent = Common.api.spawnNpc({
      id: Common.data.npcs.vent,
      x: location.getX(),
      y: location.getY(),
      z: location.getZ(),
      owner: this.player,
      wanderRadius: 0,
    });
    if (vent) {
      vent.__skipDefaultRespawn = true;
      vent.setScriptedMovement(true);
      vent.setOwnerOnly(true);
      this.session.area.add(vent);
      this.vents.add(vent);
      vent.performGraphic(new Common.core.Graphic(graphics.gasSpawn, timing.gasVisualDelay));
      for (let offset = 0; offset < timing.gasVisualDuration; offset += 2) {
        this.at(timing.gasVisualStart + offset, () => {
          if (this.vents.has(vent)) vent.performGraphic(new Common.core.Graphic(graphics.gasIdle));
        });
      }
      this.at(timing.gasVisualStart + timing.gasVisualDuration, () => {
        if (!this.vents.has(vent)) return;
        vent.performGraphic(new Common.core.Graphic(graphics.gasEnd));
        this.at(timing.gasDespawn, () => this.removeVent(vent));
      });
    }

    // Damage bounds/cadence remain normal-mode settings, independent of a captured
    // visual's client-cycle delay. A quest/event sample cannot establish normal damage.
    for (let tick = 0; tick < timing.gasDuration; tick++) {
      this.at(delay + tick, () => {
        if (!Model.near(Common.source(this.session, this.player.getLocation()), tile)) return;
        Common.hurt(this, Common.faceCovered(this.player) ? 4 : 12);
        Common.drainPrayer(this.player, 4);
      });
    }
  }

  gas() {
    const count = Model.gasCount(this.boss.getHitpoints());
    for (let index = 0; index < count; index++) {
      this.at(index * 2, () => {
        const here = Common.source(this.session, this.player.getLocation());
        const vents = [...Common.data.vents].sort((left, right) =>
          Math.hypot(left[0] - here[0], left[1] - here[1]) -
          Math.hypot(right[0] - here[0], right[1] - here[1]));
        this.ignite(vents[0]);
      });
    }
  }

  animateEye(eye, animation) {
    const object = new Common.core.GameObject(
      eye.id, this.session.tile(eye.tile), 10, eye.face, this.session.area,
    );
    this.player.getPacketSender().sendObjectAnimation(object, new Common.core.Animation(animation));
  }

  rouseEyes(ordinal) {
    const { animations, timing, preparation } = Common.data;
    const eyeIds = [...new Set(Common.data.extremities.map((eye) => eye.id))].sort((a, b) => a - b);
    for (const eye of [Common.data.extremities[ordinal], Common.data.extremities[ordinal + 3]]) {
      this.animateEye(eye, animations.eyeRouse[eyeIds.indexOf(eye.id)]);
      this.at(timing.eyeWarning, () => {
        const [x, y] = Common.source(this.session, this.player.getLocation());
        const band = eye.face === 3 ? preparation.eyeBands.west : preparation.eyeBands.east;
        if (x < band[0] || x > band[1] || Math.abs(y - (eye.tile[1] + 1)) > 1) return;
        Common.hurt(this, 70);
        const skills = this.player.getSkillManager();
        Common.drainPrayer(this.player,
          Math.floor(skills.getCurrentLevel(Common.core.Skill.PRAYER) / 4));
        this.freeze(5);
      });
      this.at(timing.eyeReset, () => this.animateEye(eye, animations.eyeSleep));
    }
  }

  sleepEyes() {
    for (const eye of Common.data.extremities) this.animateEye(eye, Common.data.animations.eyeSleep);
  }

  freeze(ticks, ice = false) {
    const { graphics, preparation } = Common.data;
    this.player.getTimers().registers(Common.core.TimerKey.FREEZE, ticks);
    this.player.sendMessage("<col=e00a19>You've been frozen in place!");
    this.player.performGraphicInSlot(preparation.freezeSlot,
      new Common.core.Graphic(graphics.freeze, 0, preparation.freezeHeight));
    if (ice) this.player.performGraphicInSlot(preparation.iceFreezeSlot,
      new Common.core.Graphic(graphics.iceFreeze));
  }

  preparationHazards() {
    const { timing, preparation } = Common.data;
    const tick = this.session.tick;
    if (tick === 0) return;
    if (tick % timing.eyeCycle === 0) {
      this.rouseEyes(0);
      this.at(timing.eyeStagger, () => this.rouseEyes(1));
      this.at(timing.eyeStagger * 2, () => this.rouseEyes(2));
    }
    if (tick % timing.prepCycle !== 0) return;
    const column = (Math.floor(tick / timing.prepCycle) - 1) % preparation.ventColumns.length;
    for (const vent of Common.data.vents.filter((at) => at[0] === preparation.ventColumns[column])) {
      this.ignite(vent);
    }
    const here = Common.source(this.session, this.player.getLocation());
    const ice = preparation.ice;
    if (ice.columns.includes(here[0]) && here[1] >= ice.minY && here[1] <= ice.maxY) {
      const aim = [...here];
      // Provisional warning retained until a current normal-mode icefall capture supplies its graphic.
      Common.graphic(this.session, Common.data.graphics.chip, aim);
      this.at(timing.iceWarning, () => {
        if (!Model.near(Common.source(this.session, this.player.getLocation()), aim, 0)) return;
        Common.hurt(this, 18);
        this.freeze(2, true);
      });
    }
  }

  fell() {
    if (this.over || this.stopped || !this.active) return;
    this.over = true;
    this.events = [];
    this.clearVents();
    Common.cancelPending(this);
    this.finishedTicks = Math.max(1, Common.core.World.getProcessCycle() - this.started);
    this.respawnAt = this.session.tick + Common.data.timing.respawn;
    this.session.setExit(false);
    Common.api.emitCustomEvent("boss-hud:update", { player: this.player, current: 0 });
  }

  won(killer) {
    if (!this.over || this.wonAlready || killer !== this.player || this.session.fight !== this) return;
    this.wonAlready = true;
    const count = Math.max(this.baselineKills + 1,
      Common.count(this.player, Common.KILLS) + 1, Common.kills(this.player));
    const ticks = this.finishedTicks;
    this.player.setAttribute(Common.KILLS, count);
    this.player.getPacketSender().sendConfig(Common.data.killCountVarp, count);
    this.player.sendMessage(`Your Duke Sucellus kill count is: ${count}.`);
    const previous = Common.count(this.player, Common.BEST);
    if (!previous || ticks < previous) this.player.setAttribute(Common.BEST, ticks);
    this.player.sendMessage(`Fight duration: ${(ticks * 0.6).toFixed(1)} seconds.`);
    if (this.perfect) this.session.perfectKills++;
    if (this.session.perfectKills >= 5) {
      Common.api.emitCustomEvent("combat-achievements:complete", {
        player: this.player, task: "Perfect Duke Sucellus",
      });
    }
    const task = { player: this.player, npc: this.boss, onTask: false };
    Common.api.emitCustomEvent("slayer:on-task", task);
    if (!task.onTask) {
      for (const [rank, seconds] of [["Trialist", 60], ["Chaser", 50], ["Runner", 40]]) {
        if (ticks * 0.6 < seconds) {
          Common.api.emitCustomEvent("combat-achievements:complete", {
            player: this.player, task: `Duke Sucellus Speed-${rank}`,
          });
        }
      }
    }
    this.boss.setNpcTransformationId(Common.data.npcs.dead);
    Common.api.emitCustomEvent("boss-hud:hide", { player: this.player, fade: false, afterTicks: 0 });
  }

  stop() {
    this.stopped = true;
    this.events = [];
    this.clearVents();
    Common.cancelPending(this);
  }
}

function fightOf(npc) {
  return npc?.__dukeSucellusFight;
}

function beforeDeath({ npc }) {
  fightOf(npc)?.fell();
}

function death({ npc, killer }) {
  fightOf(npc)?.won(killer);
}

function context({ player, npc, context }) {
  const fight = fightOf(npc);
  if (fight?.over && fight.boss === npc && !fight.stopped && fight.player === player &&
      fight.session.fight === fight && !fight.session.ended && npc.getHitpoints() <= 0) {
    context.perfectKill = fight.perfect;
  }
}

function lootLocation(event) {
  const fight = fightOf(event.npc);
  if (fight && fight.boss === event.npc && !fight.stopped && !fight.session.ended &&
      fight.session.fight === fight && event.player === fight.player) {
    event.location = fight.session.tile(Common.data.site.loot);
  }
}

function noDefaultCombat() {
  const { CombatMethod, CombatType } = Common.core;
  return class extends CombatMethod {
    hits() { return []; }
    type() { return CombatType.MELEE; }
    attackSpeed() { return 1; }
    attackDistance() { return 1; }
  };
}

function attach(api) {
  api.registerNpcCombatMethodProvider(Common.data.npcs.awake, noDefaultCombat());
  api.onNpcBeforeDeath(beforeDeath);
  api.onNpcDeath(death);
  api.onCustomEvent("npc-drops:context", context);
  api.onCustomEvent("npc-drops:location", lootLocation);
}

module.exports = { Fight, attach, context, beforeDeath, death };
