/**
 * Tai Bwo Wannai Cleanup: the villagers' favour, 0-1000 points saved per player and shown as a
 * percentage (favour_percentage is points / 10, rsprox 227/01858). vill_comm_max follows the
 * highest total and does not drop on a claim. The village_community_score overlay shows inside the
 * four map squares around the village once the player has started (it opened at the first favour
 * gain in 01858 and closed on leaving them).
 */
const Common = require("./Common.TaiBwoWannaiCleanup");

const { ATTR } = Common;
const points = (player) => Number(player.getAttribute(ATTR.POINTS)) || 0;
const percentage = (player) => Math.floor(points(player) / 10);

let area = null;

function send(player) {
  Common.varbit(player, "points", points(player));
  Common.varbit(player, "max", Number(player.getAttribute(ATTR.MAX)) || 0);
  Common.varbit(player, "favour", percentage(player));
}

function setPoints(player, value) {
  const total = Math.max(0, Math.min(Common.data.maxPoints, Math.floor(value)));
  player.setAttribute(ATTR.POINTS, total);
  if (total > (Number(player.getAttribute(ATTR.MAX)) || 0)) player.setAttribute(ATTR.MAX, total);
  send(player);
}

/** Adds `amount` points; at the cap the player is told to cash in instead. */
function gain(player, amount) {
  const before = points(player);
  const room = Common.data.maxPoints - before;
  setPoints(player, before + amount);
  if (amount > room) player.sendMessage(Common.message("favourFull"));
  showOverlay(player);
}

/** Spends `amount` points (a claim). */
function spend(player, amount) {
  setPoints(player, points(player) - amount);
}

const started = (player) => Common.progress(player) >= Common.data.progress.hacked || points(player) > 0;
const inVillage = (player) => area !== null && area.getBoundaries().some((bounds) => bounds.inside(player.getLocation()));

function showOverlay(player) {
  if (!started(player) || !inVillage(player) || player.getAttribute(ATTR.OVERLAY) === true) return;
  const cache = Common.core.CacheDefinitions;
  player.setAttribute(ATTR.OVERLAY, true);
  Common.varbit(player, "overlay", 1);
  player.getPacketSender().sendSubInterface(cache.getComponentId(Common.data.interfaces.hud), cache.getInterfaceId(Common.data.interfaces.overlay), 1);
}

function hideOverlay(player) {
  if (player.getAttribute(ATTR.OVERLAY) !== true) return;
  player.setAttribute(ATTR.OVERLAY, false);
  Common.varbit(player, "overlay", 0);
  player.getPacketSender().closeSubInterface(Common.core.CacheDefinitions.getComponentId(Common.data.interfaces.hud));
}

function createArea() {
  const { Area, Boundary } = Common.core;
  return new (class TaiBwoWannaiVillage extends Area {
    constructor() {
      super(Common.data.regions.map(([minX, maxX, minY, maxY]) => new Boundary(minX, maxX, minY, maxY, 0)));
    }
    getName() {
      return "Tai Bwo Wannai";
    }
    postEnter(mobile) {
      if (mobile.isPlayer?.()) showOverlay(mobile.getAsPlayer());
    }
    postLeave(mobile) {
      if (mobile.isPlayer?.()) hideOverlay(mobile.getAsPlayer());
    }
  })();
}

function sendOnLogin({ player }) {
  send(player);
  Common.varbit(player, "progress", Common.progress(player));
  showOverlay(player);
}

function attachFavour(api) {
  api.persistAttribute(ATTR.POINTS, 0);
  api.persistAttribute(ATTR.MAX, 0);
  api.persistAttribute(ATTR.PROGRESS, 0);
  area = createArea();
  api.registerArea(area);
  api.onPlayerLogin(sendOnLogin);
}

module.exports = { attachFavour, gain, spend, points, percentage, showOverlay, hideOverlay, inVillage, area: () => area };
