"use strict";

const { Skill, ItemIdentifiers: Items, DialogueChainBuilder, NpcDialogue, ActionDialogue, EndDialogue } = require("./Core.Construction");
const Estate = require("./Estate.Construction");
const House = require("./House.Construction");
const MENU = 187;
const MENU_OPTIONS = (MENU << 16) | 3;
const pendingMenus = new WeakMap();

function say(event, text, next) {
  event.player.getDialogueManager().startDialogues(new DialogueChainBuilder().add(
    new NpcDialogue(0, event.npcId, text),
    next ? new ActionDialogue(1, { execute: next }) : new EndDialogue(1),
  ));
}

function stillAtAgent(event) {
  const current = event.player.getLocation(), npc = event.npc.getLocation();
  return !event.player.getPrivateArea() && current.getZ() === npc.getZ()
    && Math.max(Math.abs(current.getX() - npc.getX()), Math.abs(current.getY() - npc.getY())) <= 6;
}

function saveHouse(player) {
  player.setAttribute("construction:house", House.houseStateFor(player));
  House.syncHouseOptions(player);
}

function pay(event, amount) {
  if (!stillAtAgent(event)) return false;
  if (event.player.getInventory().getAmount(Items.COINS) < amount) {
    say(event, `You need ${amount.toLocaleString("en-US")} coins to do that.`);
    return false;
  }
  if (amount) event.player.getInventory().delete(Items.COINS, amount);
  return true;
}

function giveGuide(event) {
  if (!stillAtAgent(event)) return;
  const inventory = event.player.getInventory();
  if (inventory.contains(Items.CONSTRUCTION_GUIDE) || event.player.getBanks().some(bank => bank?.contains(Items.CONSTRUCTION_GUIDE))) {
    say(event, "You already have a Construction guide.");
  } else if (inventory.getFreeSlots() === 0) {
    say(event, "Make some space in your inventory and I can give you a Construction guide.");
  } else {
    inventory.adds(Items.CONSTRUCTION_GUIDE, 1);
    say(event, "This book will help you to start building your house.");
  }
}

function buyHouse(event) {
  const saved = House.houseStateFor(event.player);
  if (saved.owned !== false || !pay(event, 1000)) return;
  saved.owned = true;
  saved.location = 1;
  saved.style = 0;
  saveHouse(event.player);
  say(event, "Thank you. Go through the Rimmington house portal and you will find your house ready for you to start building in it.", () => giveGuide(event));
}

function offerHouse(api, event) {
  say(event, "I can sell you a starting house in Rimmington for 1000 coins. As your Construction level increases, you can have it moved to other areas and redecorated in other styles.", () =>
    api.sendMultiChatboxPrompt(event.player, "Do you want to buy a starter house?",
      "Yes please!", () => buyHouse(event), "No thanks", () => {}));
}

function describeHouses(api, event) {
  api.sendMultiChatboxPrompt(event.player, "What would you like to know?",
    "How do I get started?", () => say(event, "Enter your house in building mode. Bring a hammer, a saw and materials, then select a hotspot to build furniture. Your Construction guide explains the rooms and furniture you can build."),
    "How do I get building materials?", () => say(event, "Take logs to a sawmill to have them made into planks. You can buy nails and a saw there. Different furniture requires different materials, which are shown in the build menu."),
    "How do I add rooms?", () => say(event, "In building mode, use a door hotspot or the House Viewer to add a room. More rooms become available as your Construction level increases."),
    "How can friends visit?", () => say(event, "Your friends can use the portal where your house is located. Open your house in normal mode, unlock the portal and set your Private chat to allow them to visit."),
    "That's all, thanks.", () => {});
}

function buyCape(event) {
  const player = event.player;
  if (player.getSkillManager().getMaxLevel(Skill.CONSTRUCTION) < 99) {
    say(event, "You need a Construction level of 99 to buy a cape of accomplishment.");
    return;
  }
  const inventory = player.getInventory();
  const coins = inventory.getAmount(Items.COINS);
  if (inventory.getFreeSlots() + (coins === 99000 ? 1 : 0) < 2) {
    say(event, "You'll need room for both the cape and its hood.");
    return;
  }
  if (!pay(event, 99000)) return;
  const trimmed = Skill.values().filter(skill => player.getSkillManager().getMaxLevel(skill) >= 99).length > 1;
  inventory.adds(trimmed ? Items.CONSTRUCT_CAPE_T_ : Items.CONSTRUCT_CAPE, 1);
  inventory.adds(Items.CONSTRUCT_HOOD, 1);
  say(event, "Wear your cape with pride! You have mastered Construction.");
}

function offerCape(api, event) {
  if (event.player.getSkillManager().getMaxLevel(Skill.CONSTRUCTION) < 99) {
    say(event, "This is a cape of accomplishment. When you reach level 99 Construction, I can sell you one for 99,000 coins.");
    return;
  }
  api.sendMultiChatboxPrompt(event.player, "Buy a Construction cape for 99,000 coins?",
    "Yes, please.", () => buyCape(event), "No, thanks.", () => {});
}

function showMenu(api, event, kind) {
  if (House.houseStateFor(event.player).owned === false) { offerHouse(api, event); return true; }
  const choices = kind === "location" ? Estate.HOUSE_LOCATIONS : Estate.HOUSE_STYLES;
  const sender = event.player.getPacketSender();
  sender.sendInterfaceRemoval();
  sender.sendInterface(MENU);
  sender.sendClientScript(217, 1, kind === "location" ? "Move house" : "Redecorate house",
    choices.map(choice => `${choice.name} (level ${choice.level}) - ${choice.cost.toLocaleString("en-US")} coins`).join("|"));
  sender.sendInterfaceFlagsRange(MENU_OPTIONS, 0, choices.length - 1, 1);
  pendingMenus.set(event.player, { event, kind });
  return true;
}

function relocate(api, event) { return showMenu(api, event, "location"); }
function redecorate(api, event) { return showMenu(api, event, "style"); }

function changeHouse(event, kind, index) {
  if (!stillAtAgent(event)) return;
  const player = event.player, saved = House.houseStateFor(player);
  if (saved.owned === false) return;
  const choice = kind === "location" ? Estate.HOUSE_LOCATIONS[index] : Estate.HOUSE_STYLES[index];
  if (!choice) return;
  if (player.getSkillManager().getMaxLevel(Skill.CONSTRUCTION) < choice.level) {
    say(event, `You need a Construction level of ${choice.level} for that. A temporary boost will not help.`);
    return;
  }
  if (kind === "location") {
    const destination = Estate.HOUSE_LOCATIONS[index];
    if ((saved.location ?? 1) === destination.id) { say(event, "Your house is already there."); return; }
    if (destination.id === 8 && !saved.visitedKourend && player.getPacketSender().getVarbit(4897) === 0) {
      say(event, "You must visit Great Kourend before moving your house to Hosidius."); return;
    }
    if (destination.id === 13 && !saved.visitedVarlamore && player.getPacketSender().getVarbit(9650) === 0) {
      say(event, "You must visit Varlamore before moving your house to Aldarin."); return;
    }
    if (destination.id === 9 && player.getPacketSender().getVarbit(9016) < 200) {
      say(event, "Prifddinas? I've never heard of it. Are you sure it's a real place?"); return;
    }
    if (!pay(event, choice.cost)) return;
    House.releaseHouse(player, false);
    saved.location = destination.id;
  } else {
    const style = Estate.HOUSE_STYLES[index], oldStyle = Estate.houseStyleIndex(saved);
    if (oldStyle === index) { say(event, "Your house is already decorated in that style."); return; }
    const unlocked = saved.unlockedStyles?.includes(index) || (index === 9 && player.getPacketSender().getVarbit(11723) === 1)
      || (index === 12 && player.getPacketSender().getVarbit(19672) === 1);
    if (style.holiday && !unlocked) { say(event, `You must complete a ${style.holiday} event to unlock that house style.`); return; }
    const inventory = player.getInventory();
    const blueprint = style.blueprint && (index === 7 || !unlocked) ? style.blueprint : 0;
    if (blueprint && !inventory.contains(blueprint)) { say(event, "Bring me the blueprints for that style first."); return; }
    const returnedBlueprint = oldStyle === 7;
    const freedSlots = (blueprint && inventory.getAmount(blueprint) === 1 ? 1 : 0)
      + (choice.cost > 0 && inventory.getAmount(Items.COINS) === choice.cost ? 1 : 0);
    if (returnedBlueprint && inventory.getFreeSlots() + freedSlots < 1) {
      say(event, "Make room for me to return your Twisted blueprints before changing styles."); return;
    }
    if (!pay(event, choice.cost)) return;
    House.releaseHouse(player, false);
    if (blueprint) inventory.delete(blueprint, 1);
    if (returnedBlueprint) inventory.adds(Items.TWISTED_BLUEPRINTS, 1);
    if ((style.blueprint && index !== 7) || style.holiday) saved.unlockedStyles = [...new Set([...(saved.unlockedStyles ?? []), index])];
    saved.style = index;
  }
  saveHouse(player);
  say(event, kind === "location" ? `Your house has been moved to ${choice.name}.` : `Your house has been redecorated in the ${choice.name} style.`);
}

function selectMenu(api, event) {
  if (event.groupId !== MENU || event.childId !== 3) return;
  const pending = pendingMenus.get(event.player);
  if (!pending) return;
  event.handled = true;
  if (event.player.getInterfaceId() !== MENU || !stillAtAgent(pending.event)) return;
  const index = event.slot ?? event.action;
  const choices = pending.kind === "location" ? Estate.HOUSE_LOCATIONS : Estate.HOUSE_STYLES;
  if (!Number.isInteger(index) || index < 0 || index >= choices.length) return;
  pendingMenus.delete(event.player);
  event.player.getPacketSender().sendInterfaceRemoval();
  const choice = choices[index];
  const style = pending.kind === "style" ? Estate.HOUSE_STYLES[index] : undefined;
  const usesBlueprint = style?.blueprint && (index === 7 || (!House.houseStateFor(event.player).unlockedStyles?.includes(index)
    && !(index === 12 && event.player.getPacketSender().getVarbit(19672) === 1)));
  api.sendMultiChatboxPrompt(event.player, `${pending.kind === "location" ? "Move" : "Redecorate"} your house: ${choice.name}?`,
    `Yes (${choice.cost.toLocaleString("en-US")} coins${usesBlueprint ? " and blueprints" : ""}).`, () => changeHouse(pending.event, pending.kind, index),
    "No, thanks.", () => {});
}

function talk(api, event) {
  say(event, "Hello. Welcome to the Gielinor Housing Agency! What can I do for you?", () => {
    if (House.houseStateFor(event.player).owned === false) {
      api.sendMultiChatboxPrompt(event.player, "What would you like to say?",
        "How can I get a house?", () => offerHouse(api, event),
        "Tell me about houses.", () => describeHouses(api, event));
    } else {
      api.sendMultiChatboxPrompt(event.player, "What would you like to say?",
        "Can you move my house please?", () => relocate(api, event),
        "Can you redecorate my house please?", () => redecorate(api, event),
        "Could I have a Construction guidebook?", () => giveGuide(event),
        "Tell me about houses.", () => describeHouses(api, event),
        "Tell me about your skillcape.", () => offerCape(api, event));
    }
  });
  return true;
}

function closeMenu({ player }) { pendingMenus.delete(player); }

function attachEstateAgents(api) {
  api.onNpcInteraction("Estate agent", { "Talk-to": talk.bind(null, api), Relocate: relocate.bind(null, api), Redecorate: redecorate.bind(null, api) });
  api.onNpcInteraction("Estate Agent", { "Talk-to": talk.bind(null, api), Relocate: relocate.bind(null, api), Redecorate: redecorate.bind(null, api) });
  api.onNpcInteraction("Alwyn", { "Talk-to": talk.bind(null, api), Relocate: relocate.bind(null, api), Redecorate: redecorate.bind(null, api) });
  api.onInterfaceActionClick(selectMenu.bind(null, api));
  api.onCustomEvent("interface:close", closeMenu);
  api.onPlayerLogout(closeMenu);
}

Object.assign(module.exports, { attachEstateAgents });
