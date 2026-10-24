"use strict";

/**
 * One trawl (Wiki: Fishing Trawler), on the trawler at sea - one at a time per world:
 * - five minutes of fishing while the net is whole; a Kraken tentacle slows the catch, rips the
 *   net and breaks a rail if it is left alone, and leaks let water in until it is bailed out;
 * - leaks, torn nets and kraken attacks come more often with a bigger crew;
 * - the water reaching the top sinks the trawler: everyone ends up in the sea by the barrels,
 *   with nothing caught; otherwise the trawler comes back to port and every player with 50
 *   contribution or more (and 15 Fishing) has their share of the catch in the net;
 * - the share is the boat's catch per player at the start, up to 50% more for a full meter
 *   (trawler_overlay's own scale: x1 at 100 contribution, x1.5 at 255).
 * The HUD is trawler_overlay, drawn by the client from varp 391 (water, net, contribution, time
 * and catch); the leaks, rails and tentacles are varbit-driven locs and NPCs.
 */

const Shared = require("./Shared.FishingTrawler");

const SIDES = ["port", "starboard"];

class Voyage {
  constructor(players, random = Math.random) {
    this.random = random;
    this.crew = new Set(players);
    this.crewAtStart = Math.max(1, players.length);
    this.contribution = new Map(players.map((player) => [player, 0]));
    this.tickCount = 0;
    this.water = 0;
    this.leaks = new Array(16).fill(Shared.DATA.values.hull.default);
    this.netRipped = false;
    this.tentacles = { port: idleTentacle(), starboard: idleTentacle() };
    this.rails = { port: Shared.DATA.values.rail.intact, starboard: Shared.DATA.values.rail.intact };
    this.nextSide = "port";
    this.catch = 0;
    this.ended = false;
    this.result = null;
  }

  // --- The crew

  crewList() {
    return [...this.crew].filter((player) => player.isRegistered?.() !== false);
  }

  addPoints(player, points) {
    if (!this.contribution.has(player)) return;
    const max = Shared.DATA.points.max;
    this.contribution.set(player, Math.min(max, this.contribution.get(player) + points));
  }

  leave(player) {
    this.crew.delete(player);
  }

  // --- A tick at sea

  tick() {
    if (this.ended) return;
    this.tickCount += 1;
    const t = Shared.DATA.timing;
    const crew = this.crewList().length;
    if (this.tickCount % t.leakEvery === 0 && this.random() < Math.min(0.95, t.leakChanceBase + t.leakChancePerPlayer * crew)) {
      this.springLeak();
    }
    this.water = Math.min(100, this.water + this.openLeaks() * t.waterPerLeakTick);
    if (!this.netRipped && this.random() < t.netRipChancePerTick + t.netRipChancePerPlayer * crew) this.ripNet();
    this.tickTentacles();
    this.tickCatch();
    if (this.water >= 100) {
      this.end("sunk");
      return;
    }
    if (this.tickCount >= t.trawlTicks) this.end("returned");
  }

  openLeaks() {
    return this.leaks.filter((state) => state === Shared.DATA.values.hull.leak).length;
  }

  springLeak() {
    const { hull } = Shared.DATA.values;
    const open = this.leaks.flatMap((state, index) => (state === hull.leak ? [] : [index]));
    if (open.length === 0) return null;
    const index = open[Math.floor(this.random() * open.length)];
    this.leaks[index] = hull.leak;
    this.tell(Shared.message("leak"));
    return index;
  }

  ripNet() {
    this.netRipped = true;
    this.tell(Shared.message("netRipped"));
  }

  tickTentacles() {
    const t = Shared.DATA.timing;
    const v = Shared.DATA.values.tentacle;
    const active = SIDES.some((side) => this.tentacles[side].state !== v.none);
    if (!active && this.tickCount % t.tentacleEvery === 0) {
      const side = this.nextSide;
      this.nextSide = side === "port" ? "starboard" : "port";
      this.tentacles[side] = { state: v.rising, since: this.tickCount, chops: 0 };
      this.tell(Shared.message("kraken"));
    }
    for (const side of SIDES) {
      const tentacle = this.tentacles[side];
      const age = this.tickCount - tentacle.since;
      if (tentacle.state === v.rising && age >= t.tentacleRiseTicks) {
        tentacle.state = v.attacking;
        tentacle.since = this.tickCount;
      } else if (tentacle.state === v.attacking && age >= t.tentacleWreckTicks) {
        // Left alone, it tears the net and smashes the rail on its side, then sinks back.
        this.rails[side] = Shared.DATA.values.rail.broken;
        if (!this.netRipped) this.ripNet();
        this.retreat(side);
      } else if (tentacle.state === v.leaving && age >= t.tentacleRiseTicks) {
        this.tentacles[side] = idleTentacle();
      }
    }
  }

  retreat(side) {
    this.tentacles[side] = { state: Shared.DATA.values.tentacle.leaving, since: this.tickCount, chops: 0 };
  }

  krakenAttacking() {
    return SIDES.some((side) => this.tentacles[side].state === Shared.DATA.values.tentacle.attacking);
  }

  /** Fish per player at the start: none while the net is torn, slowed by an attacking tentacle. */
  tickCatch() {
    if (this.netRipped) return;
    const c = Shared.DATA.catch;
    const crewFactor = Math.max(c.crewFloor, 1 - c.crewFalloff * (this.crewAtStart - 1));
    this.catch += c.basePerTick * crewFactor * (this.krakenAttacking() ? c.krakenRate : 1);
  }

  // --- What the crew does (Actions.FishingTrawler.js checks items and skills first)

  patch(player, index) {
    const { hull } = Shared.DATA.values;
    if (this.leaks[index] !== hull.leak) return false;
    this.leaks[index] = hull.patched;
    this.addPoints(player, Shared.DATA.points.patch);
    return true;
  }

  bail(player) {
    if (this.water <= 0) return false;
    this.water = Math.max(0, this.water - Shared.DATA.timing.bailWater);
    this.addPoints(player, Shared.DATA.points.bail);
    return true;
  }

  mendNet(player) {
    if (!this.netRipped) return false;
    this.netRipped = false;
    this.addPoints(player, Shared.DATA.points.net);
    return true;
  }

  /** One successful chop; enough of them drive the tentacle off. */
  chop(player, side) {
    const tentacle = this.tentacles[side];
    if (tentacle.state !== Shared.DATA.values.tentacle.attacking) return null;
    tentacle.chops += 1;
    this.addPoints(player, Shared.DATA.points.chop);
    if (tentacle.chops >= Shared.DATA.timing.tentacleChops) {
      this.retreat(side);
      return "drove";
    }
    return "hit";
  }

  fixRail(player, side) {
    if (this.rails[side] !== Shared.DATA.values.rail.broken) return false;
    this.rails[side] = Shared.DATA.values.rail.intact;
    this.addPoints(player, Shared.DATA.points.rail);
    return true;
  }

  // --- The end

  /** A player's fish from the catch: x1 at 100 contribution, rising to x1.5 at 255. */
  shareFor(player) {
    const c = Shared.DATA.catch;
    const points = this.contribution.get(player) ?? 0;
    const meter = Math.min(1, Math.max(0, (points - c.meterLow) / (c.meterHigh - c.meterLow)));
    return Math.floor(this.catch * (1 + c.meterBonus * meter));
  }

  end(result) {
    if (this.ended) return;
    this.ended = true;
    this.result = result;
  }

  tell(text) {
    for (const player of this.crewList()) player.sendMessage(text);
  }

  // --- The HUD and the boat as each player sees it

  /** Every varbit the crew's client draws from, sent where it changed. */
  sync(player) {
    const v = Shared.ids().varbits;
    const set = (varbit, value) => Shared.setVarbit(player, varbit, value);
    const remaining = Math.max(0, Shared.DATA.timing.trawlTicks - this.tickCount);
    set(v.water, Math.min(100, Math.round(this.water)));
    set(v.netRipped, this.netRipped ? 1 : 0);
    set(v.minutes, Math.floor(remaining / 100));
    set(v.catch, Math.min(4095, Math.floor(this.catch)));
    set(v.contribution, this.contribution.get(player) ?? 0);
    this.leaks.forEach((state, index) => set(v.hull[index], state));
    set(v.tentaclePort, this.tentacles.port.state);
    set(v.tentacleStarboard, this.tentacles.starboard.state);
    set(v.railPort, this.rails.port);
    set(v.railStarboard, this.rails.starboard);
  }
}

function idleTentacle() {
  return { state: Shared.DATA.values.tentacle.none, since: 0, chops: 0 };
}

/** Every trawler varbit back to how the boat looks in port. */
function clearHud(player) {
  const v = Shared.ids().varbits;
  for (const varbit of [v.water, v.netRipped, v.minutes, v.catch, v.contribution, v.tentaclePort, v.tentacleStarboard, v.railPort, v.railStarboard, ...v.hull]) {
    Shared.setVarbit(player, varbit, 0);
  }
}

module.exports = { Voyage, SIDES, clearHud };
