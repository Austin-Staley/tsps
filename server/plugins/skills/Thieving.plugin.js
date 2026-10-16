const { Skill } = require("../../src/main/typescript/elvarg/game/model/Skill");
const { Item } = require("../../src/main/typescript/elvarg/game/model/Item");
const { Animation } = require("../../src/main/typescript/elvarg/game/model/Animation");
const { ItemIds } = require("../../src/main/typescript/elvarg/util/IdEnums");
const Pickpocket = require("./thieving/Pickpocket.Thieving");
const CoinPouch = require("./thieving/CoinPouch.Thieving");

const THIEVING_ANIMATION = new Animation(881);

const STALLS = new Map([
  [
    "Bakery stall",
    {
      petBase: 124066,
      level: 5,
      xp: 16,
      rewards: [
        [ItemIds.CAKE, 1, 13],
        [ItemIds.BREAD, 1, 5],
        [ItemIds.CHOCOLATE_SLICE, 1, 2],
      ],
    },
  ],
  ["Silk stall", { petBase: 68926, level: 20, xp: 24, rewards: [[ItemIds.SILK, 1, 1]] }],
  ["Tea stall", { petBase: 68926, level: 5, xp: 16, rewards: [[ItemIds.CUP_OF_TEA, 1, 1]] }],
  ["Fur stall", { petBase: 36490, level: 35, xp: 45, rewards: [[ItemIds.GREY_WOLF_FUR, 1, 1]] }],
  [
    "Gem stall",
    {
      petBase: 36490,
      level: 75,
      xp: 408,
      rewards: [
        [ItemIds.UNCUT_SAPPHIRE, 1, 105],
        [ItemIds.UNCUT_EMERALD, 1, 17],
        [ItemIds.UNCUT_RUBY, 1, 5],
        [ItemIds.UNCUT_DIAMOND, 1, 1],
      ],
    },
  ],
  [
    "Seed Stall",
    {
      petBase: 36490,
      level: 27,
      xp: 10,
      rewards: [
        [ItemIds.HAMMERSTONE_SEED, 1, 120],
        [ItemIds.POTATO_SEED, 1, 119],
        [ItemIds.MARIGOLD_SEED, 1, 119],
        [ItemIds.BARLEY_SEED, 1, 118],
        [ItemIds.ONION_SEED, 1, 89],
        [ItemIds.ASGARNIAN_SEED, 1, 83],
        [ItemIds.CABBAGE_SEED, 1, 71],
        [ItemIds.YANILLIAN_SEED, 1, 47],
        [ItemIds.ROSEMARY_SEED, 1, 36],
        [ItemIds.NASTURTIUM_SEED, 1, 35],
        [ItemIds.TOMATO_SEED, 1, 35],
        [ItemIds.JUTE_SEED, 1, 35],
        [ItemIds.SWEETCORN_SEED, 1, 30],
        [ItemIds.KRANDORIAN_SEED, 1, 24],
        [ItemIds.STRAWBERRY_SEED, 1, 18],
        [ItemIds.WILDBLOOD_SEED, 1, 12],
        [ItemIds.WATERMELON_SEED, 1, 9],
      ],
    },
  ],
]);

STALLS.set("Baker's stall", STALLS.get("Bakery stall"));
STALLS.set("Baker's Stall", STALLS.get("Bakery stall"));
STALLS.set("Gem Stall", STALLS.get("Gem stall"));

function randomReward(rewards) {
  const totalWeight = rewards.reduce((sum, [, , weight]) => sum + weight, 0);
  let roll = Math.floor(Math.random() * totalWeight);
  for (const reward of rewards) {
    roll -= reward[2];
    if (roll < 0) {
      return new Item(reward[0], reward[1]);
    }
  }
  const [itemId, amount] = rewards[rewards.length - 1];
  return new Item(itemId, amount);
}

let pluginApi;

function handleStealFromStall(event) {
  const stall = STALLS.get(event.definition.getName());
  if (!stall) {
    return;
  }

  const player = event.player;
  if (player.getSkillManager().getCurrentLevel(Skill.THIEVING) < stall.level) {
    player.sendMessage(`You need a Thieving level of at least ${stall.level} to do this.`);
    event.handled = true;
    return;
  }
  if (!player.getClickDelay().elapsedTime(1000)) {
    event.handled = true;
    return;
  }
  if (player.getInventory().isFull()) {
    player.getInventory().full();
    event.handled = true;
    return;
  }

  player.getClickDelay().reset();
  player.setPositionToFace(event.object.getLocation());
  player.performAnimation(THIEVING_ANIMATION);
  const reward = randomReward(stall.rewards);
  player.getInventory().addItem(reward);
  player.getSkillManager().addExperiences(Skill.THIEVING, stall.xp);
  player.sendMessage(`You steal ${reward.getAmount()} x ${reward.getDefinition().getName()}.`);
  pluginApi.emitCustomEvent("thieving:success", { player, skill: Skill.THIEVING, petBase: stall.petBase });
  event.handled = true;
}

module.exports = {
  name: "Thieving",
  members: true,
  register(api) {
    pluginApi = api;
    Pickpocket.register(api);
    CoinPouch.register(api);

    for (const name of STALLS.keys()) {
      api.onObjectInteraction(name, { [name === "Seed Stall" ? "Steal from" : "Steal-from"]: handleStealFromStall });
    }

    api.log("registered", {
      pickpocketTargets: Pickpocket.TARGETS.length,
      stallNames: STALLS.size,
    });
  },
};

module.exports._test = Pickpocket._test;
