/**
 * Forestry: what the units share - the plugin api, the data from plugins/minigames/data/forestry.json,
 * tick timing, placed locs, nearby players, and the bark and XP rewards.
 */
const fs = require("fs");
const path = require("path");

let api = null;
let core = null;
let data = null;

/** Set once by the plugin before any unit attaches. */
function init(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
  data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "forestry.json"), "utf8"));
}

/** Runs `action` `ticks` ticks from now (at least one). */
function later(ticks, action) {
  const { Task, TaskManager } = core;
  TaskManager.submit(new (class extends Task {
    constructor() {
      super(Math.max(1, ticks), null, false);
    }
    execute() {
      this.stop();
      action();
    }
  })());
}

/** Runs `action(tick)` every tick until it returns false. */
function every(action) {
  const { Task, TaskManager } = core;
  let tick = 0;
  TaskManager.submit(new (class extends Task {
    constructor() {
      super(1, null, false);
    }
    execute() {
      if (action(++tick) === false) this.stop();
    }
  })());
}

const randomInt = (low, high) => low + Math.floor(Math.random() * (high - low + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function message(name, values = {}) {
  return String(data.messages[name]).replace(/\{(\w+)\}/g, (_, field) => String(values[field] ?? ""));
}

/** A filterable line, as live sends the per-action lines. */
function spam(player, text) {
  player.getPacketSender().sendTypedMessage(core.ChatType.SPAM, text);
}

function level(player, skill) {
  return player.getSkillManager().getCurrentLevel(core.Skill[skill]);
}

function xp(player, skill, amount) {
  if (amount > 0) player.getSkillManager().addExperience(core.Skill[skill], amount);
}

/** Bark into the pack (on the floor when there's no room), with the award line. */
function bark(player, amount, lump = false) {
  if (amount <= 0) return;
  const item = new core.Item(data.items.bark, amount);
  if (player.getInventory().getAddableAmount(item) >= amount) player.getInventory().add(item, true);
  else core.ItemOnGroundManager.registers(player, item);
  const text = message("bark", { amount });
  if (lump) player.sendMessage(text);
  else spam(player, text);
}

function give(player, id, amount) {
  const item = new core.Item(id, amount);
  if (player.getInventory().getAddableAmount(item) >= amount) player.getInventory().add(item, true);
  else core.ItemOnGroundManager.registers(player, item);
}

function hasKit(player) {
  return player.getInventory().contains(data.items.kit);
}

function distance(a, b) {
  return Math.max(Math.abs(a.getX() - b.getX()), Math.abs(a.getY() - b.getY()));
}

function nearbyPlayers(location, range) {
  const players = [];
  for (const player of core.World.getPlayers()) {
    if (!player?.isRegistered?.()) continue;
    const at = player.getLocation();
    if (at.getZ() === location.getZ() && distance(at, location) <= range) players.push(player);
  }
  return players;
}

function areaSound(location, id, radius = 10) {
  for (const player of nearbyPlayers(location, 15)) {
    player.getPacketSender().sendAreaSound(id, location.getX(), location.getY(), location.getZ(), 1, 0, radius);
  }
}

function tileGraphic(location, id) {
  for (const player of nearbyPlayers(location, 15)) player.getPacketSender().sendGraphic(new core.Graphic(id), location);
}

function locAnim(object, seq) {
  for (const player of nearbyPlayers(object.getLocation(), 15)) {
    player.getPacketSender().sendObjectAnimation(object, new core.Animation(seq));
  }
}

/** A loc of ours on the map (shape 10, as recorded). */
function placeLoc(id, location, face = 0) {
  const object = new core.GameObject(id, location.clone(), 10, face, null);
  core.ObjectManager.register(object, true);
  return object;
}

function removeLoc(object) {
  if (object) core.ObjectManager.deregister(object, true);
}

/** Whether (x, y, z) is free for a loc of ours: walkable, with no map scenery there to hide. */
function walkable(x, y, z) {
  const tile = new core.Location(x, y, z);
  return !core.RegionManager.blocked(tile, null) && !core.MapObjects.getType(tile, 10, null);
}

const ORDINALS = ["first", "second", "third"];

module.exports = {
  init,
  get api() {
    return api;
  },
  get core() {
    return core;
  },
  get data() {
    return data;
  },
  later,
  every,
  randomInt,
  pick,
  message,
  spam,
  level,
  xp,
  bark,
  give,
  hasKit,
  distance,
  nearbyPlayers,
  areaSound,
  tileGraphic,
  locAnim,
  placeLoc,
  removeLoc,
  walkable,
  ORDINALS,
};
