"use strict";

const Common = require("./Common.DukeSucellus");
const Model = require("./Model.DukeSucellus");
const vatKey = (tile) => tile[0] + "," + tile[1];
const ANIMATION = {
  PICK: "picking_low", GRIND: "human_herbing_grind", VAT: "qip_cook_hopper_grain",
  FEED: "human_pickuptable_walkmerge",
};
const SOUND = { PICK: 2581, GRIND: 2608, FILL: 2447, EMPTY: 2431, READY: 2655, COLLECT: 2434, FEED: 7249 };
const MUSHROOM_PICK_TICKS = 3;

function animate(player, name) {
  player.performAnimation(new Common.core.Animation(Common.core.CacheDefinitions.getSeqId(name)));
}

function ingredients() {
  const { items } = Common.data;
  return [
    { id: items.muscaPowder, raw: items.musca, name: "musca powder", mushroom: "musca mushroom", label: "Musca powder" },
    { id: items.arderPowder, raw: items.arder, name: "arder powder", mushroom: "arder mushroom", label: "Arder powder" },
    { id: items.salt, name: "salax salt", label: "Salax salt" },
  ];
}

function refresh(session) {
  const { objects, resources } = Common.data;
  session.place(objects.arder, resources.arder);
  session.place(objects.musca, resources.musca);
  for (const tile of resources.salts) session.place(objects.salt, tile);
  for (const tile of resources.vats) {
    session.place(session.vats.get(vatKey(tile))?.ready ? objects.readyVat : objects.vat, tile);
  }
  session.place(objects.pestle, resources.pestle, 1);
  session.place(objects.pickaxe, resources.pickaxe, 1);
}

function near(session, tile, range = 1) {
  return Model.near(Common.source(session, session.player.getLocation()), tile, range);
}

function pick(session, type) {
  session.action = null;
  const { resources, items, objects } = Common.data;
  if (!near(session, resources[type])) return false;
  if (session.picks[type] >= resources.picks) return true;
  if (Common.give(session.player, items[type])) {
    session.picks[type]++;
    animate(session.player, ANIMATION.PICK);
    Common.sound(session.player, SOUND.PICK);
    session.player.sendMessage("You pick a mushroom.");
    if (session.picks[type] === resources.picks) session.place(objects[type + "Depleted"], resources[type]);
    else session.action = {
      kind: "mushroom", type, at: resources[type],
      start: Common.source(session, session.player.getLocation()), next: session.tick + MUSHROOM_PICK_TICKS,
      interval: MUSHROOM_PICK_TICKS, until: Infinity,
    };
  }
  return true;
}

function mine(session, tile) {
  if (!Common.data.resources.salts.some((salt) => Model.near(salt, tile, 0)) || !near(session, tile)) return false;
  const request = { player: session.player, pickaxe: null };
  Common.api.emitCustomEvent("mining:best-pickaxe", request);
  if (!request.pickaxe) {
    session.player.sendMessage("You need a pickaxe you can use to mine the salt.");
    return true;
  }
  session.action = {
    kind: "salt", at: tile, start: Common.source(session, session.player.getLocation()),
    next: session.tick + 1, interval: Math.max(2, request.pickaxe.attemptIntervalTicks || 4),
    until: session.tick + 500, pickaxe: request.pickaxe,
  };
  session.player.getCombat().reset();
  session.player.sendMessage("You swing your pick at the rock.");
  return true;
}

function grind(event) {
  const session = Common.sessionOf(event.player);
  if (!session) return false;
  const used = new Set([event.usedItemId, event.usedWithItemId]);
  const { items } = Common.data;
  if (!used.has(items.pestle)) return false;
  const raw = used.has(items.arder) ? items.arder : used.has(items.musca) ? items.musca : null;
  if (raw === null) return false;
  event.handled = true;
  session.action = null;
  const inventory = event.player.getInventory();
  if (inventory.getAmount(raw) < 1 || inventory.getAmount(items.pestle) < 1) return true;
  const result = raw === items.arder ? items.arderPowder : items.muscaPowder;
  const amount = Model.powderYield(event.player.getSkillManager().getCurrentLevel(Common.core.Skill.HERBLORE));
  const before = inventory.getCopiedItems();
  inventory.deleteNumber(raw, 1);
  if (inventory.getAddableAmount(new Common.core.Item(result, amount)) < amount) {
    inventory.setItems(before);
    inventory.refreshItems();
    event.player.sendMessage("You don't have enough inventory space.");
    return true;
  }
  inventory.add(new Common.core.Item(result, amount), true);
  animate(event.player, ANIMATION.GRIND);
  Common.sound(event.player, SOUND.GRIND);
  event.player.sendMessage("You grind the mushroom into dust.");
  return true;
}

/** Keep each ingredient independently; fermentation starts only after the final addition. */
function fill(session, tile) {
  if (!near(session, tile)) return false;
  session.action = null;
  const key = vatKey(tile);
  const { resources } = Common.data;
  const player = session.player;
  const inventory = player.getInventory();
  const vat = session.vats.get(key) ?? { amounts: {}, readyAt: Infinity, ready: false, tile };
  if (Number.isFinite(vat.readyAt)) {
    Common.messageBox(player, "The vat is currently fermenting.");
    return true;
  }
  let added = false;
  const recipe = ingredients();
  // The normal-world capture adds musca, salt, then arder. Raw mushrooms can be
  // crushed by hand directly into the vat, yielding one powder each (not the pestle yield).
  for (const ingredient of [recipe[0], recipe[2], recipe[1]]) {
    const current = vat.amounts[ingredient.id] ?? 0;
    const amount = Math.min(resources.ingredients - current, inventory.getAmount(ingredient.id));
    if (amount > 0) {
      inventory.deleteNumber(ingredient.id, amount);
      vat.amounts[ingredient.id] = current + amount;
      player.sendMessage("You add some " + ingredient.name + " to the vat.");
      added = true;
    }
    if (ingredient.raw != null) {
      const held = vat.amounts[ingredient.id] ?? 0;
      const crushed = Math.min(resources.ingredients - held, inventory.getAmount(ingredient.raw));
      if (crushed > 0) {
        inventory.deleteNumber(ingredient.raw, crushed);
        vat.amounts[ingredient.id] = held + crushed;
        player.sendMessage("You crush some " + ingredient.mushroom + " into to the vat with your hands.");
        added = true;
      }
    }
  }
  if (!added) {
    Common.messageBox(player, "You don't appear to have any ingredients to add.");
    return true;
  }
  session.vats.set(key, vat);
  animate(player, ANIMATION.VAT);
  Common.sound(player, SOUND.FILL);
  if (ingredients().every(({ id }) => vat.amounts[id] === resources.ingredients)) {
    vat.readyAt = session.tick + resources.fermentTicks;
    player.sendMessage("The mixture in the vat begins to ferment.");
  }
  return true;
}

function collect(session, tile) {
  if (!near(session, tile)) return false;
  session.action = null;
  const key = vatKey(tile);
  const vat = session.vats.get(key);
  if (!vat?.ready) {
    Common.messageBox(session.player, "The vat is currently fermenting.");
    return true;
  }
  if (Common.give(session.player, Common.data.items.poison)) {
    session.vats.delete(key);
    session.place(Common.data.objects.vat, tile);
    animate(session.player, ANIMATION.VAT);
    Common.sound(session.player, SOUND.COLLECT);
    session.player.sendMessage("You collect some poison from the vat.");
    // Current normal-mode Wiki recipes award 10 Herblore XP per poison.
    session.player.getSkillManager().addExperiences(Common.core.Skill.HERBLORE, 10);
  }
  return true;
}

/** Refund atomically: a full inventory must never destroy or duplicate part of a recipe. */
function empty(session, tile) {
  if (!near(session, tile)) return false;
  session.action = null;
  const key = vatKey(tile);
  const vat = session.vats.get(key);
  if (!vat) return true;
  const inventory = session.player.getInventory();
  const before = inventory.getCopiedItems();
  for (const { id } of ingredients()) {
    const amount = vat.amounts[id] ?? 0;
    if (amount <= 0) continue;
    const item = new Common.core.Item(id, amount);
    if (inventory.getAddableAmount(item) < amount) {
      inventory.setItems(before);
      inventory.refreshItems();
      session.player.sendMessage("You don't have enough inventory space.");
      return true;
    }
    inventory.add(item, false);
  }
  inventory.refreshItems();
  session.vats.delete(key);
  session.place(Common.data.objects.vat, tile);
  Common.sound(session.player, SOUND.EMPTY);
  session.player.sendMessage("You empty all of the ingredients from the vat.");
  return true;
}

function check(session, tile) {
  if (!near(session, tile)) return false;
  const vat = session.vats.get(vatKey(tile));
  const lines = ingredients().map(({ id, label }, index) => label + (index === 0 ? ": " : ":  ") + (vat?.amounts[id] ?? 0) + " / " + Common.data.resources.ingredients);
  Common.messageBox(session.player, lines.join("<br>"));
  return true;
}

function object(event) {
  const session = Common.sessionOf(event.player);
  if (!session || event.player.getPrivateArea?.() !== session.area) return false;
  const id = event.objectId ?? event.definition?.id;
  const { objects, resources, items } = Common.data;
  const tile = Common.source(session, event.location ?? event.object?.getLocation());
  if (id === objects.arder) return pick(session, "arder");
  if (id === objects.musca) return pick(session, "musca");
  if (id === objects.salt) return mine(session, tile);
  const vat = resources.vats.find((candidate) => Model.near(candidate, tile, 0));
  if (vat && (id === objects.vat || id === objects.readyVat)) {
    const option = String(event.definition?.getActions?.()?.[event.clickType - 1] ?? event.option ?? "").toLowerCase();
    if (option === "empty") return empty(session, vat);
    if (option === "check") return check(session, vat);
    return id === objects.readyVat ? collect(session, vat) : fill(session, vat);
  }
  if ((id === objects.pestle || id === objects.pickaxe) && near(session, tile) && !session.tools.has(id)) {
    if (Common.give(event.player, id === objects.pestle ? items.pestle : items.ironPickaxe)) {
      session.tools.add(id);
      const emptyName = id === objects.pestle ? "duke_sucellus_pestle_mortar_noop" : "duke_sucellus_pickaxe_noop";
      const emptyObject = Common.core.CacheDefinitions.getLocId(emptyName);
      if (emptyObject != null) session.place(emptyObject, tile, 1);
    }
    return true;
  }
  return false;
}

function process(session) {
  for (const vat of session.vats.values()) {
    if (!vat.ready && session.tick >= vat.readyAt) {
      vat.ready = true;
      session.place(Common.data.objects.readyVat, vat.tile);
      Common.sound(session.player, SOUND.READY);
      session.player.sendMessage("<col=06600c>A fermentation vat is ready to be emptied.</col>");
    }
  }
  const action = session.action;
  if (!action) return;
  const player = session.player;
  const here = Common.source(session, player.getLocation());
  if (session.tick >= action.until || !Model.near(here, action.start, 0) || !near(session, action.at)) {
    session.action = null;
    return;
  }
  if (session.tick < action.next) return;
  if (action.kind === "mushroom") {
    if (session.fight.active || session.fight.over) session.action = null;
    else pick(session, action.type);
    return;
  }
  action.next = session.tick + action.interval;
  const amount = Model.saltYield(player.getSkillManager().getCurrentLevel(Common.core.Skill.MINING));
  if (!Common.give(player, Common.data.items.salt, amount)) {
    session.action = null;
    return;
  }
  player.performAnimation(action.pickaxe.animation);
  player.sendMessage("You manage to mine some salt.");
  player.getSkillManager().addExperiences(Common.core.Skill.MINING, 5);
}

function feed(event) {
  const session = Common.sessionOf(event.player);
  if (!session || (event.npc ?? event.target) !== session.boss || !Model.melee(Common.source(session, event.player.getLocation()))) return false;
  const { items, normal } = Common.data;
  const accepted = [items.poison, items.arderPowder, items.muscaPowder];
  if (event.itemId != null && !accepted.includes(event.itemId)) return false;
  event.handled = true;
  session.action = null;
  if (session.fight.active || session.fight.over) return true;
  const inventory = event.player.getInventory();
  const item = event.itemId ?? accepted.find((candidate) => inventory.getAmount(candidate) > 0);
  if (!item || inventory.getAmount(item) < 1) {
    event.player.sendMessage("You don't have anything to feed him.");
    return true;
  }
  const result = Model.feed(session.meter, item === items.poison ? normal.poison : 5, normal.meter);
  if (!result.consumed) return true;
  const damage = result.meter - session.meter;
  inventory.deleteNumber(item, 1);
  session.meter = result.meter;
  animate(event.player, ANIMATION.FEED);
  Common.sound(event.player, SOUND.FEED, 30);
  // Feeding changes the preparation meter, not combat HP. Its hitsplat must not queue
  // damage that could land after wake() replaces the sleeping NPC's hitpoints.
  const hit = new Common.core.HitDamage(damage, Common.core.HitMask.RED);
  hit.setSource(event.player);
  session.boss.addTickHit(hit);
  session.boss.setHitpoints(Math.max(0, normal.meter - session.meter));
  if (result.awake) {
    session.picks = { arder: 0, musca: 0 };
    refresh(session);
    session.fight.wake();
    event.player.sendMessage("<col=ef0083>Duke Sucellus awakens...");
  }
  return true;
}

function attach(api) {
  api.onItemOnItem("Pestle and mortar", "Arder mushroom", grind, { noted: false });
  api.onItemOnItem("Pestle and mortar", "Musca mushroom", grind, { noted: false });
  api.onItemOnNpc(feed);
  api.onNpcInteraction("Duke Sucellus", { Feed: feed });
}

module.exports = { refresh, pick, mine, grind, fill, collect, empty, check, object, process, feed, attach };
