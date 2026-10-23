const fs = require("fs");
const path = require("path");
const INSIDE_ATTRIBUTE = "leviathan:inside";
const KILLS_ATTRIBUTE = "leviathan:kills";
const AWAKENED_KILLS_ATTRIBUTE = "leviathan:awakened-kills";
const BEST_ATTRIBUTE = "leviathan:best-ticks";
const AWAKENED_BEST_ATTRIBUTE = "leviathan:awakened-best-ticks";
let api, core, data, ids;

function init(pluginApi) {
  api = pluginApi;
  core = api.core;
  data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "leviathan.json"), "utf8"));
  const C = core.CacheDefinitions;
  const lookup = { npcs: name => C.getNpcId(name), locs: name => C.getLocId(name), seqs: name => C.getSeqId(name),
    gfx: name => C.getSpotanimId(name), varps: name => C.getVarpId(name) };
  ids = {};
  for (const [group, values] of Object.entries(data.cache)) {
    ids[group] = {};
    for (const [key, name] of Object.entries(values)) {
      const id = lookup[group](name);
      if (!Number.isInteger(id) || id < 0) throw new Error(`Leviathan: missing ${group} ${name}`);
      ids[group][key] = id;
    }
  }
  ids.awakenerOrb = C.getObjId("dt2_awakener_orb");
  // The gameval spelling is cache-authoritative; the identifier fallback is also cache-derived.
  if (!Number.isInteger(ids.awakenerOrb)) ids.awakenerOrb = core.ItemIdentifiers.AWAKENERS_ORB;
}
const random = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = list => list[random(0, list.length - 1)];
const count = (player, key) => Math.max(0, Math.trunc(Number(player.getAttribute(key)) || 0));
const location = ([x, y, z = 0]) => new core.Location(x, y, z);
function tile(area, [x, y, z = 0]) {
  return area.tile(x - data.instance.sourceChunkX * 8, y - data.instance.sourceChunkY * 8, z);
}
function sourceTile(area, at) {
  return [at.getX() - area.getBaseX() + data.instance.sourceChunkX * 8,
    at.getY() - area.getBaseY() + data.instance.sourceChunkY * 8, at.getZ()];
}
function later(ticks, action) {
  const { Task, TaskManager } = core;
  TaskManager.submit(new (class extends Task {
    constructor() { super(Math.max(1, ticks), null, false); }
    execute() { this.stop(); action(); }
  })());
}
const animate = (npc, name) => npc.performAnimation(new core.Animation(ids.seqs[name]));
function graphic(name) { return new core.Graphic(ids.gfx[name]); }
function tileGraphic(player, area, at, name) { player.getPacketSender().sendGraphic(graphic(name), tile(area, at)); }
function damage(fight, amount, avoidable = true) {
  if (fight.stopped || fight.over || fight.session.ended || fight.session.fight !== fight || fight.player.getHitpoints() <= 0) return;
  const hit = new core.HitDamage(Math.max(0, Math.floor(amount)), core.HitMask.RED);
  hit.setSource(fight.boss);
  hit.onApplied(taken => {
    if (taken > 0 && avoidable && !fight.stopped && !fight.over && !fight.session.ended && fight.session.fight === fight) fight.perfect = false;
  });
  fight.player.getCombat().getHitQueue().addPendingDamage([hit]);
}
function protectedFrom(player, style) {
  const prayer = { magic: "PROTECT_FROM_MAGIC", ranged: "PROTECT_FROM_MISSILES", melee: "PROTECT_FROM_MELEE" }[style];
  return core.PrayerHandler.isActivated(player, core.PrayerHandler[prayer]);
}
function projectile(fight, style, flight) {
  const { Projectile } = core;
  fight.boss.performGraphic(graphic(`${style}Launch`));
  new Projectile(Projectile.centreOf(fight.boss), Projectile.centreOf(fight.player), fight.player,
    ids.gfx[style], 0, flight * 30, 60, 20, fight.session.area).withSource(fight.boss).sendProjectile();
}
module.exports = { init, random, pick, count, location, tile, sourceTile, later, animate, graphic, tileGraphic, damage, protectedFrom, projectile,
  INSIDE_ATTRIBUTE, KILLS_ATTRIBUTE, AWAKENED_KILLS_ATTRIBUTE, BEST_ATTRIBUTE, AWAKENED_BEST_ATTRIBUTE,
  get api() { return api; }, get core() { return core; }, get data() { return data; }, get ids() { return ids; } };
