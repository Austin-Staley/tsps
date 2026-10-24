"use strict";

/**
 * The trawler at sea and the wreck it can become (Wiki: Fishing Trawler):
 * - the crew sails on the trawler (an Area round the boat), with trawler_overlay up;
 * - each tick runs the voyage and sends every player's HUD and boat varbits;
 * - back in port, each player's share goes to the net (Rewards.FishingTrawler.js);
 * - sunk, the crew is in the sea by the barrels; climbing one swims them ashore north of Port
 *   Khazard for 2 damage, as does logging out at sea (the player comes back there);
 * - a player leaving the trawler (logging out, teleporting) is out of the trip; when nobody is
 *   left the trip is over.
 */

const Shared = require("./Shared.FishingTrawler");
const Rewards = require("./Rewards.FishingTrawler");
const { Voyage, clearHud } = require("./Voyage.FishingTrawler");

const sea = { voyage: null, task: null, boatArea: null, wreckArea: null, overListeners: [] };

const atSea = () => Boolean(sea.voyage);

function onOver(listener) {
  sea.overListeners.push(listener);
}

function launch(players, random = Math.random) {
  if (sea.voyage || players.length === 0) return null;
  const voyage = new Voyage(players, random);
  sea.voyage = voyage;
  const { arrive } = Shared.DATA.boat;
  for (const player of players) {
    player.setAttribute(Shared.AT_SEA_ATTRIBUTE, true);
    player.moveTo(Shared.loc(arrive));
    player.sendMessage(Shared.message("depart"));
    player.getPacketSender().sendSubInterface(Shared.OVERLAY_HUD_UID, Shared.ids().interfaces.overlay, 1);
    voyage.sync(player);
  }
  sea.task = Shared.everyTick(tickSea);
  return voyage;
}

function tickSea() {
  const voyage = sea.voyage;
  if (!voyage) {
    sea.task = null;
    return false;
  }
  voyage.tick();
  for (const player of voyage.crewList()) voyage.sync(player);
  if (voyage.crewList().length === 0) voyage.end("abandoned");
  if (voyage.ended) {
    finish(voyage);
    return false;
  }
  return true;
}

function finish(voyage) {
  sea.voyage = null;
  sea.task = null;
  const crew = voyage.crewList();
  try {
    endFor(voyage, crew);
  } finally {
    for (const listener of sea.overListeners) listener(voyage);
  }
}

/** Everyone off the trawler, whatever one player's ending does. */
function endFor(voyage, crew) {
  for (const player of crew) {
    player.getPacketSender().closeSubInterface?.(Shared.OVERLAY_HUD_UID);
    clearHud(player);
  }
  if (voyage.result === "returned") {
    for (const player of crew) {
      player.setAttribute(Shared.AT_SEA_ATTRIBUTE, false);
      player.moveTo(Shared.loc(Shared.DATA.port));
      try {
        Rewards.award(player, voyage);
      } catch (error) {
        console.error("[FishingTrawler] reward failed", error);
      }
    }
  } else if (voyage.result === "sunk") {
    for (const player of crew) {
      player.sendMessage(Shared.message("sinking"));
      player.moveTo(Shared.loc(Shared.DATA.wreck.arrive));
      player.sendMessage(Shared.message("sunk"));
    }
  }
}

/** Ashore north of Port Khazard, for the 2 damage of the swim. */
function swimAshore(player) {
  const { HitDamage, HitMask } = Shared.core();
  player.setAttribute(Shared.AT_SEA_ATTRIBUTE, false);
  player.moveTo(Shared.loc(Shared.DATA.shore));
  player.getCombat().getHitQueue().addPendingDamage([new HitDamage(2, HitMask.RED)]);
  player.sendMessage(Shared.message("swim"));
}

function climbBarrel({ player, objectId }) {
  if (!Shared.ids().locs.barrels.includes(objectId)) return false;
  swimAshore(player);
  return true;
}

function createBoatArea() {
  const { Area, Boundary } = Shared.core();
  const [minX, maxX, minY, maxY] = Shared.DATA.boat.bounds;
  class TrawlerAtSea extends Area {
    constructor() {
      super([new Boundary(minX, maxX, minY, maxY, 0), new Boundary(minX, maxX, minY, maxY, 1)]);
    }

    getName() {
      return "Fishing Trawler";
    }

    postLeave(mobile, logout) {
      if (!mobile.isPlayer?.()) return;
      sea.voyage?.leave(mobile);
      mobile.getPacketSender?.().closeSubInterface?.(Shared.OVERLAY_HUD_UID);
      clearHud(mobile);
      // A player logging out at sea comes back ashore (Wiki); one sunk stays at sea until ashore.
      if (logout) mobile.moveTo(Shared.loc(Shared.DATA.shore));
      if (logout || !Shared.inBounds(Shared.DATA.wreck.bounds, mobile.getLocation())) mobile.setAttribute(Shared.AT_SEA_ATTRIBUTE, false);
    }

    canAttack() {
      return false;
    }

    canTeleport() {
      return null;
    }
  }
  return new TrawlerAtSea();
}

function createWreckArea() {
  const { Area, Boundary } = Shared.core();
  const [minX, maxX, minY, maxY] = Shared.DATA.wreck.bounds;
  class TrawlerWreck extends Area {
    constructor() {
      super([new Boundary(minX, maxX, minY, maxY, 0)]);
    }

    getName() {
      return "Fishing Trawler (wreck)";
    }

    postLeave(mobile, logout) {
      if (!mobile.isPlayer?.()) return;
      if (logout) mobile.moveTo(Shared.loc(Shared.DATA.shore));
      mobile.setAttribute(Shared.AT_SEA_ATTRIBUTE, false);
    }
  }
  return new TrawlerWreck();
}

/** Saved at sea (a crash, an old save): back ashore north of Port Khazard. */
function recoverOnLogin({ player }) {
  if (player.getAttribute(Shared.AT_SEA_ATTRIBUTE) !== true) return;
  player.setAttribute(Shared.AT_SEA_ATTRIBUTE, false);
  const location = player.getLocation();
  if (Shared.inBounds(Shared.DATA.boat.bounds, location) || Shared.inBounds(Shared.DATA.wreck.bounds, location)) {
    player.moveTo(Shared.loc(Shared.DATA.shore));
  }
}

function attachSea(api) {
  Shared.bind(api);
  sea.boatArea = createBoatArea();
  sea.wreckArea = createWreckArea();
  api.registerArea(sea.boatArea);
  api.registerArea(sea.wreckArea);
  api.persistAttribute(Shared.AT_SEA_ATTRIBUTE, false);
  api.onObjectInteraction("Barrel", { "Climb-on": climbBarrel });
  api.onPlayerLogin(recoverOnLogin);
}

module.exports = { attachSea, sea, atSea, launch, tickSea, finish, onOver, swimAshore, climbBarrel, recoverOnLogin };
