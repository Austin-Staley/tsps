const Common = require("./Common.Leviathan");
const Model = require("./Model.Leviathan");
const { Hazards } = require("./Hazards.Leviathan");

class Fight {
  constructor(session) {
    this.session = session; this.player = session.player; this.awakened = session.awakened;
    this.stats = Common.data[this.awakened ? "awakened" : "normal"];
    this.normalKillsAtStart = Common.normalKills(this.player);
    this.tick = 0; this.events = []; this.pendingDamage = new Set(); this.tier = 0; this.shots = 0; this.stuns = 0;
    this.stunnedUntil = 0; this.special = null; this.nextSpecial = Common.pick(["lightning", "smoke"]);
    this.enraged = false; this.perfect = true; this.over = false; this.stopped = false;
    this.rewarded = false; this.nextAttack = Common.data.inferred.firstAttackTicks;
    this.startCycle = Common.core.World.getProcessCycle();
    this.hazards = new Hazards(this);
  }
  at(ticks, action) { this.events.push({ at: this.tick + Math.max(1, ticks), action }); }
  alive() { return !this.over && !this.stopped && !this.session.ended && this.session.fight === this && this.boss?.isRegistered() && this.boss.getHitpoints() > 0 && this.player.getHitpoints() > 0; }
  start() {
    const boss = this.session.spawn(Common.ids.npcs.boss, Common.data.arena.boss);
    if (!boss) { this.stopped = true; return; }
    this.boss = boss; boss.__leviathanFight = this; boss.__skipDefaultRespawn = true;
    boss.setMaxHitpoints(this.stats.hitpoints); boss.setHitpoints(this.stats.hitpoints);
    const stats = [...boss.getDefinition().getStats()];
    [stats[0], stats[1], stats[2], stats[3], stats[4]] = [this.stats.attack, this.stats.strength, this.stats.defence, this.stats.ranged, this.stats.magic];
    boss.setCombatOverride({ stats, maxHit: Common.data.damage.melee });
    boss.setStatDrainImmune(this.awakened);
    boss.setScriptedMovement(true); boss.getMovementQueue().setBlockMovement(true);
    boss.setPositionToFace(this.player.getLocation());
    Common.animate(boss, "spawn");
    Common.api.emitCustomEvent("boss-hud:show", { player: this.player, npcId: Common.ids.npcs.boss, current: this.stats.hitpoints, maximum: this.stats.hitpoints });
  }
  process() {
    if (this.stopped) return;
    this.tick++;
    const due = this.events.filter(e => e.at <= this.tick);
    this.events = this.events.filter(e => e.at > this.tick);
    for (const event of due) if (!this.stopped) event.action();
    if (!this.alive()) return;
    this.boss.getCombat().getLastAttack().reset();
    if (!this.enraged && this.boss.getHitpoints() <= this.stats.hitpoints * 0.2) this.enterEnrage();
    this.hazards.process();
    Common.api.emitCustomEvent("boss-hud:update", { player: this.player, current: this.boss.getHitpoints() });
    if (this.stunnedUntil) {
      if (this.tick < this.stunnedUntil) return;
      this.stunnedUntil = 0;
      this.nextAttack = this.tick + Model.volley(this.tier).interval;
    }
    if (this.special || this.tick < this.nextAttack) return;
    this.boss.setPositionToFace(this.player.getLocation());
    if (this.hazards.nearPool()) {
      Common.animate(this.boss, "bite");
      if (!Common.protectedFrom(this.player, "melee")) Common.damage(this, Common.random(0, Common.data.damage.melee));
      this.nextAttack = this.tick + (this.enraged ? this.stats.enrageInterval : Model.volley(this.tier).interval);
      return;
    }
    const pattern = this.enraged ? { interval: this.stats.enrageInterval, styles: ["magic", "ranged"], flight: 2 } : Model.volley(this.tier);
    this.orb(Common.pick(pattern.styles), pattern.flight);
    this.nextAttack = this.tick + pattern.interval;
    if (++this.shots >= Common.data.inferred.volleyShots) {
      this.shots = 0;
      this.roar();
      if (!this.enraged) {
        this.tier = Math.min(6, this.tier + 1);
        this.nextAttack += Common.data.inferred.roarGapTicks;
      }
    }
  }
  orb(style, flight) {
    if (!this.alive()) return;
    Common.animate(this.boss, "orb"); Common.projectile(this, style, flight);
    this.at(flight, () => {
      if (!this.alive()) return;
      this.player.performGraphic(Common.graphic(`${style}Impact`));
      const pierces = this.enraged && this.hazards.pathReady() && !this.hazards.inAura();
      if (pierces || !Common.protectedFrom(this.player, style)) Common.damage(this, Common.random(0, Common.data.damage[style]));
    });
  }
  roar() {
    if (!this.alive()) return;
    Common.animate(this.boss, "roar");
    Common.damage(this, Common.random(0, Common.data.damage.roar), false);
    this.hazards.roar();
  }
  stun() {
    if (!this.alive() || this.enraged || this.special || this.stunnedUntil > this.tick) return false;
    this.stuns++;
    this.stunFace = Model.facing(Common.data.arena.centre, this.hazards.playerTile());
    this.stunHealth = this.boss.getHitpoints();
    this.stunnedUntil = this.tick + this.stats.stunTicks;
    Common.animate(this.boss, "stun");
    this.player.getCombat().setAttackDelay(0);
    return true;
  }
  beginSpecial() {
    if (!this.alive() || this.enraged) return;
    this.special = this.nextSpecial;
    this.nextSpecial = this.special === "lightning" ? "smoke" : "lightning";
    this.hazards[this.special]();
  }
  endSpecial() {
    this.special = null;
    this.nextAttack = this.tick + (this.enraged ? this.stats.enrageInterval : Model.volley(this.tier).interval);
  }
  enterEnrage() {
    this.enraged = true; this.stunnedUntil = 0; this.shots = 0;
    // Smoke already in progress must resolve. Other outstanding impacts remain in flight.
    if (this.special !== "smoke") this.special = null;
    this.hazards.spawnPathfinder();
    this.roar();
    this.nextAttack = this.tick + this.stats.enrageInterval;
    this.player.sendMessage("The Leviathan focuses on you. Stay within the abyssal pathfinder's aura!");
  }
  afterDamage(taken, rear) {
    if (!this.alive() || !taken || !this.stunnedUntil) return;
    if (rear || this.stunHealth - this.boss.getHitpoints() >= this.stats.hitpoints * 0.25) {
      this.stunnedUntil = 0; this.tier = Model.resetTier(this.stuns); this.shots = 0;
      this.beginSpecial();
    }
  }
  fell() {
    if (this.over || this.stopped) return;
    this.over = true; this.finishedTicks = Math.max(1, Common.core.World.getProcessCycle() - this.startCycle);
    this.events = []; this.cancelDamage(); this.hazards.clear();
    Common.api.emitCustomEvent("boss-hud:hide", { player: this.player, fade: false, afterTicks: 0 });
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.events = []; this.cancelDamage(); this.hazards.clear();
    if (this.boss?.isRegistered()) {
      if (this.boss.getPrivateArea() === this.session.area) this.session.area.remove(this.boss);
      Common.api.removeNpc(this.boss);
    }
    Common.api.emitCustomEvent("boss-hud:hide", { player: this.player, fade: false, afterTicks: 0 });
  }
  cancelDamage() {
    for (const hit of this.pendingDamage) hit.setDamage(0);
    this.pendingDamage.clear();
  }
}
const own = npc => npc?.__leviathanFight ?? null;
function shadowSpell(spell) {
  const spells = Common.core.CombatSpells;
  return ["SHADOW_RUSH", "SHADOW_BURST", "SHADOW_BLITZ", "SHADOW_BARRAGE"].some(name => spells[name].getSpell().spellId() === spell?.spellId?.());
}
function magicHit({ attacker, target, spell }) {
  const fight = own(target);
  if (fight && attacker === fight.player && shadowSpell(spell)) fight.stun();
}
function hitRoll(event) {
  const fight = own(event.target);
  if (!fight?.alive() || event.attacker !== fight.player) return;
  const { CombatType } = Common.core;
  const spell = event.attacker.getCombat().getCastSpell() ?? event.attacker.getCombat().getSelectedSpell();
  if (!fight.enraged && !fight.special && event.combatType === CombatType.MAGIC && shadowSpell(spell)) event.forceAccurate = true;
  const rear = fight.stunnedUntil > fight.tick && Model.behind(Common.data.arena.centre, fight.stunFace, fight.hazards.playerTile());
  if (event.combatType === CombatType.RANGED && (rear || fight.enraged && fight.hazards.inAura())) event.forceAccurate = true;
}
function modifyHit({ npc, hit }) {
  const fight = own(npc);
  if (!fight?.alive() || hit.getAttacker() !== fight.player) return;
  const type = hit.getCombatType(), { CombatType, DamageFormulas } = Common.core;
  const stunned = fight.stunnedUntil > fight.tick;
  const rear = stunned && Model.behind(Common.data.arena.centre, fight.stunFace, fight.hazards.playerTile());
  const aura = fight.enraged && fight.hazards.inAura();
  const maximum = DamageFormulas.sourceMaxHit(fight.player, type);
  for (const part of hit.getHits()) {
    let damage = part.getDamage();
    if (type === CombatType.RANGED && (rear || aura)) damage = Math.max(damage, Math.floor(maximum * (rear ? 0.65 : 0.2)));
    if (type === CombatType.MAGIC && (rear || aura)) damage *= 2;
    if (stunned && !rear) damage = Math.min(10, damage);
    if (fight.special) damage = Math.floor(damage * 2 / 3);
    part.setDamage(damage);
    part.onApplied(taken => fight.afterDamage(taken, rear));
  }
  hit.updateTotalDamage();
}
function beforeDeath({ npc }) { own(npc)?.fell(); }
function canAttack(event) {
  const fight = own(event.target);
  if (!fight) return;
  if (event.attacker !== fight.player || !fight.alive()) { event.allow = false; return; }
  if (event.method?.type?.() === Common.core.CombatType.MELEE) {
    event.allow = false;
    fight.player.sendMessage("Your melee attacks can't reach the lure!");
  }
}
function eligibility(request) { if (own(request.npc)?.awakened) request.eligible = false; }
function combatClass() {
  const { CombatMethod, CombatType } = Common.core;
  return class LeviathanCombat extends CombatMethod {
    type() { return CombatType.MAGIC; }
    hits() { return []; }
    start() {}
  };
}
function attach(api) {
  api.registerNpcCombatMethodProvider(Common.ids.npcs.boss, combatClass());
  api.onCombatHitRoll(hitRoll);
  api.onNpcHitModify(modifyHit);
  api.onNpcBeforeDeath(beforeDeath);
  api.onCanAttack(canAttack);
  api.onCustomEvent("magic:hit-effects", magicHit);
  api.onCustomEvent("slayer:target-eligible", eligibility);
}
module.exports = { Fight, attach, own };
