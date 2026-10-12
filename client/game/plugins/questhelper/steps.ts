// Step text, world points and item requirements from Zoinkwiz/quest-helper at
// 08bb7c55ffc5aa61b7f4df61820967d63157e389; BSD notices: LICENSE-QuestHelper.txt.
import * as Item from "../../../runelite/api/gameval/ItemID";
import type { QuestStep } from "./types";

export const CooksAssistant: Record<string, QuestStep> = {
    getBucket: { text: "Purchase a bucket from the Lumbridge General Store.", target: { x: 3212, y: 3246, plane: 0 }, items: [{ id: Item.COINS, name: "Coins", amount: 2, alternates: [Item.MAGICTRAINING_COINS, Item.CERT_ROLL] }] },
    getPot: { text: "Purchase a pot from the Lumbridge General Store.", target: { x: 3212, y: 3246, plane: 0 }, items: [{ id: Item.COINS, name: "Coins", amount: 1, alternates: [Item.MAGICTRAINING_COINS, Item.CERT_ROLL] }] },
    getEgg: { text: "Grab an egg from the farm north of Lumbridge.", target: { x: 3177, y: 3296, plane: 0 }, items: [{ id: Item.EGG, name: "Egg", amount: 1 }], type: "item" },
    getWheat: { text: "Pick some wheat north of Lumbridge.", target: { x: 3161, y: 3292, plane: 0 } },
    climbLadderOne: { text: "Climb up the ladder in the Mill north of Lumbridge to the top floor.", target: { x: 3164, y: 3307, plane: 0 }, items: [{ id: Item.POT_EMPTY, name: "Pot", amount: 1 }, { id: Item.GRAIN, name: "Grain", amount: 1 }] },
    climbLadderTwoUp: { text: "Climb up the ladder in the Mill north of Lumbridge to the top floor.", target: { x: 3164, y: 3307, plane: 1 }, items: [{ id: Item.POT_EMPTY, name: "Pot", amount: 1 }, { id: Item.GRAIN, name: "Grain", amount: 1 }], choices: ["Climb Up."] },
    fillHopper: { text: "Fill the hopper with your grain.", target: { x: 3166, y: 3307, plane: 2 }, items: [{ id: Item.POT_EMPTY, name: "Pot", amount: 1 }, { id: Item.GRAIN, name: "Grain", amount: 1 }] },
    operateControls: { text: "Operate the hopper controls.", target: { x: 3166, y: 3305, plane: 2 }, items: [{ id: Item.POT_EMPTY, name: "Pot", amount: 1 }] },
    climbLadderThree: { text: "Climb down the ladder in the Mill to the ground floor.", target: { x: 3164, y: 3307, plane: 2 }, items: [{ id: Item.POT_EMPTY, name: "Pot", amount: 1 }] },
    climbLadderTwoDown: { text: "Climb down the ladder in the Mill to the ground floor.", target: { x: 3164, y: 3307, plane: 1 }, items: [{ id: Item.POT_EMPTY, name: "Pot", amount: 1 }], choices: ["Climb Down."] },
    collectFlour: { text: "Collect the flour in the bin.", target: { x: 3166, y: 3306, plane: 0 }, items: [{ id: Item.POT_EMPTY, name: "Pot", amount: 1 }] },
    milkCow: { text: "Milk the dairy cow north of Lumbridge.", target: { x: 3172, y: 3317, plane: 0 }, items: [{ id: Item.BUCKET_EMPTY, name: "Bucket", amount: 1 }] },
    finishQuest: { text: "Give the Cook in Lumbridge Castle's kitchen the required items to finish the quest.", target: { x: 3206, y: 3214, plane: 0 }, items: [{ id: Item.EGG, name: "Egg", amount: 1 }, { id: Item.BUCKET_MILK, name: "Bucket of milk", amount: 1, alternates: [Item.BOTTOMLESS_MILK_BUCKET_FILLED] }, { id: Item.POT_FLOUR, name: "Pot of flour", amount: 1 }], choices: ["What's wrong?", "Can I help?", "Yes."] },
};

export const SheepShearer: Record<string, QuestStep> = {
    startStep: { text: "Talk to Fred the Farmer north of Lumbridge to start the quest. Bring 20 balls of wool to autocomplete the quest.", target: { x: 3190, y: 3273, plane: 0 }, choices: ["I'm looking for a quest.", "Yes, okay. I can do that.", "Yes."] },
    getSheers: { text: "Pickup the shears in Fred's house.", target: { x: 3190, y: 3273, plane: 0 }, items: [{ id: Item.SHEARS, name: "Shears", amount: 1 }], type: "item" },
    shearSheep: { text: "Shear sheep in the nearby field.", target: { x: 3201, y: 3268, plane: 0 }, items: [{ id: Item.SHEARS, name: "Shears", amount: 1 }, { id: Item.WOOL, name: "Wool", amount: 20, alternates: [Item.BALL_OF_WOOL] }] },
    climbStairsUp: { text: "Climb the staircase in the Lumbridge Castle to spin the wool in your inventory into balls of wool.", target: { x: 3204, y: 3207, plane: 0 }, items: [{ id: Item.WOOL, name: "Wool", amount: 20, alternates: [Item.BALL_OF_WOOL] }] },
    spinBalls: { text: "Spin your wool into balls.", target: { x: 3209, y: 3212, plane: 1 }, items: [{ id: Item.WOOL, name: "Wool", amount: 20, alternates: [Item.BALL_OF_WOOL] }] },
    climbStairsDown: { text: "Climb down the staircase.", target: { x: 3204, y: 3207, plane: 1 }, items: [{ id: Item.BALL_OF_WOOL, name: "Balls of wool", amount: 20 }], choices: ["Climb down the stairs."] },
    turnInBalls: { text: "Bring Fred the Farmer north of Lumbridge your balls of wool (UNNOTED) to progress the quest. If you only have some of the balls needed, you can still deposit them with him.", target: { x: 3190, y: 3273, plane: 0 }, items: [{ id: Item.BALL_OF_WOOL, name: "Balls of wool", amount: 20 }], choices: ["I need to talk to you about shearing these sheep!"] },
};

export const DoricsQuest: Record<string, QuestStep> = {
    talkToDoric: { text: "Bring Doric north of Falador all the required items. You can mine them all in the Dwarven Mines, or buy them from the Grand Exchange.", target: { x: 2951, y: 3451, plane: 0 }, items: [{ id: Item.CLAY, name: "Clay (UNNOTED)", amount: 6 }, { id: Item.COPPER_ORE, name: "Copper ore (UNNOTED)", amount: 4 }, { id: Item.IRON_ORE, name: "Iron ore (UNNOTED)", amount: 2 }], choices: ["I wanted to use your anvils.", "Yes.", "Yes, I will get you the materials."] },
};

export const ImpCatcher: Record<string, QuestStep> = {
    collectBeads: { text: "Collect one of each bead. You can kill imps for these beads, or buy them on the Grand Exchange.", items: [{ id: Item.BLACK_BEAD, name: "Black bead", amount: 1 }, { id: Item.WHITE_BEAD, name: "White bead", amount: 1 }, { id: Item.RED_BEAD, name: "Red bead", amount: 1 }, { id: Item.YELLOW_BEAD, name: "Yellow bead", amount: 1 }] },
    moveToTower: { text: "Head to the Wizards' Tower and climb up the staircase with the required beads.", target: { x: 3103, y: 3159, plane: 0 }, items: [{ id: Item.BLACK_BEAD, name: "Black bead", amount: 1 }, { id: Item.WHITE_BEAD, name: "White bead", amount: 1 }, { id: Item.RED_BEAD, name: "Red bead", amount: 1 }, { id: Item.YELLOW_BEAD, name: "Yellow bead", amount: 1 }] },
    climbUpF1: { text: "Head to the Wizards' Tower and climb up the staircase with the required beads.", target: { x: 3103, y: 3159, plane: 1 }, items: [{ id: Item.BLACK_BEAD, name: "Black bead", amount: 1 }, { id: Item.WHITE_BEAD, name: "White bead", amount: 1 }, { id: Item.RED_BEAD, name: "Red bead", amount: 1 }, { id: Item.YELLOW_BEAD, name: "Yellow bead", amount: 1 }], choices: ["Up"] },
    turnInQuest: { text: "Talk to Wizard Mizgog with the required beads to finish the quest.", target: { x: 3103, y: 3163, plane: 2 }, items: [{ id: Item.BLACK_BEAD, name: "Black bead", amount: 1 }, { id: Item.WHITE_BEAD, name: "White bead", amount: 1 }, { id: Item.RED_BEAD, name: "Red bead", amount: 1 }, { id: Item.YELLOW_BEAD, name: "Yellow bead", amount: 1 }], choices: ["Give me a quest please.", "Yes."] },
};

export const WitchsPotion: Record<string, QuestStep> = {
    talkToWitch: { text: "Talk to Hetty in Rimmington.", target: { x: 2968, y: 3205, plane: 0 }, items: [{ id: Item.ONION, name: "Onion", amount: 1 }, { id: Item.EYE_OF_NEWT, name: "Eye of newt", amount: 1 }, { id: Item.BURNT_MEAT, name: "Burnt meat", amount: 1 }], choices: ["I am in search of a quest.", "Yes."] },
    killRat: { text: "Kill a rat in the house to the west for a rat tail.", target: { x: 2956, y: 3203, plane: 0 }, items: [{ id: Item.RATS_TAIL, name: "Rat's tail", amount: 1 }] },
    returnToWitch: { text: "Bring the ingredients to Hetty.", target: { x: 2968, y: 3205, plane: 0 }, items: [{ id: Item.ONION, name: "Onion", amount: 1 }, { id: Item.EYE_OF_NEWT, name: "Eye of newt", amount: 1 }, { id: Item.BURNT_MEAT, name: "Burnt meat", amount: 1 }, { id: Item.RATS_TAIL, name: "Rat's tail", amount: 1 }] },
    drinkPotion: { text: "Drink from the cauldron to finish off the quest.", target: { x: 2967, y: 3205, plane: 0 } },
};

export const RuneMysteries: Record<string, QuestStep> = {
    goUpToHoracio: { text: "Talk to Duke Horacio on the first floor of Lumbridge castle.", target: { x: 3205, y: 3208, plane: 0 } },
    talkToHoracio: { text: "Talk to Duke Horacio on the first floor of Lumbridge castle.", target: { x: 3209, y: 3222, plane: 1 }, choices: ["Have you any quests for me?", "Yes."] },
    goF1ToF0LumbridgeCastle: { text: "Bring the Air Talisman to Sedridor in the Wizard Tower's basement.", target: { x: 3204, y: 3207, plane: 1 }, items: [{ id: Item.AIR_TALISMAN, name: "Air talisman", amount: 1 }], choices: ["Climb down the stairs."] },
    goDownToSedridor: { text: "Bring the Air Talisman to Sedridor in the Wizard Tower's basement.", target: { x: 3104, y: 3162, plane: 0 }, items: [{ id: Item.AIR_TALISMAN, name: "Air talisman", amount: 1 }], choices: ["Have you any quests for me?"] },
    bringTalismanToSedridor: { text: "Bring the Air Talisman to Sedridor in the Wizard Tower's basement.", target: { x: 3104, y: 9571, plane: 0 }, items: [{ id: Item.AIR_TALISMAN, name: "Air talisman", amount: 1 }], choices: ["I'm looking for the head wizard.", "Okay, here you are."] },
    goDownToSedridorAfterHandingInAirTalisman: { text: "Talk to Sedridor in the Wizard Tower's basement and accept the Research Package.", target: { x: 3104, y: 3162, plane: 0 }, choices: ["Have you any quests for me?"] },
    getResearchPackageFromSedridor: { text: "Talk to Sedridor in the Wizard Tower's basement and accept the Research Package.", target: { x: 3104, y: 9571, plane: 0 }, choices: ["Go ahead.", "Actually, I'm not interested.", "Yes, certainly."] },
    deliverPackageToAubury: { text: "Bring the Research Package to Aubury in south east Varrock.", target: { x: 3253, y: 3401, plane: 0 }, items: [{ id: Item.RESEARCH_PACKAGE, name: "Research package", amount: 1 }], choices: ["I've been sent here with a package for you."] },
    talkToAudburyAgain: { text: "Talk to Aubury again in south east Varrock.", target: { x: 3253, y: 3401, plane: 0 } },
    goDownToSedridor2: { text: "Bring the research notes to Sedridor in the Wizard Tower's basement.", target: { x: 3104, y: 3162, plane: 0 }, items: [{ id: Item.RESEARCH_NOTES, name: "Research notes", amount: 1 }] },
    deliverResearchNotesToSedridor: { text: "Bring the notes to Sedridor in the Wizard Tower's basement.", target: { x: 3104, y: 9571, plane: 0 }, items: [{ id: Item.RESEARCH_NOTES, name: "Research notes", amount: 1 }] },
    talkToSedridorAfterGivingHimTheNotes: { text: "Talk to Sedridor in the Wizard Tower's basement to finish the quest.", target: { x: 3104, y: 9571, plane: 0 } },
};

export const TheRestlessGhost: Record<string, QuestStep> = {
    talkToAereck: { text: "Talk to Father Aereck in the Lumbridge Church.", target: { x: 3243, y: 3206, plane: 0 }, choices: ["I'm looking for a quest!", "Yes."] },
    talkToUrhney: { text: "Talk to Father Urhney, west of the Lumbridge Swamp.", target: { x: 3147, y: 3175, plane: 0 }, choices: ["Father Aereck sent me to talk to you.", "He's got a ghost haunting his graveyard."] },
    openCoffin: { text: "Open the coffin in the Lumbridge Graveyard to spawn the ghost.", target: { x: 3250, y: 3193, plane: 0 }, items: [{ id: Item.AMULET_OF_GHOSTSPEAK, name: "Ghostspeak amulet", amount: 1, equipped: true }] },
    searchCoffin: { text: "Search the coffin in the Lumbridge Graveyard to spawn the ghost.", target: { x: 3250, y: 3193, plane: 0 }, items: [{ id: Item.AMULET_OF_GHOSTSPEAK, name: "Ghostspeak amulet", amount: 1, equipped: true }] },
    speakToGhost: { text: "Speak to the Ghost that appears whilst wearing your Ghostspeak Amulet.", target: { x: 3250, y: 3195, plane: 0 }, items: [{ id: Item.AMULET_OF_GHOSTSPEAK, name: "Ghostspeak amulet", amount: 1, equipped: true }], choices: ["Yep, now tell me what the problem is.", "Yep, clever aren't I?.", "Yes, ok. Do you know WHY you're a ghost?", "Yes, ok. Do you know why you're a ghost?"] },
    enterWizardsTowerBasement: { text: "Enter the Wizards' Tower basement, south of Draynor village.", target: { x: 3104, y: 3162, plane: 0 } },
    searchAltarAndRun: { text: "Search the Altar. A skeleton (level 13) will appear and attack you, but you can just run away.", target: { x: 3120, y: 9567, plane: 0 } },
    exitWizardsTowerBasement: { text: "Leave the basement.", target: { x: 3103, y: 9576, plane: 0 }, items: [{ id: Item.GHOSTSKULL, name: "Ghost's skull", amount: 1 }] },
    openCoffinToPutSkullIn: { text: "Open the ghost's coffin in the Lumbridge graveyard.", target: { x: 3250, y: 3193, plane: 0 }, items: [{ id: Item.GHOSTSKULL, name: "Ghost's skull", amount: 1 }] },
    putSkullInCoffin: { text: "Search the coffin to put the skull back and finish the quest.", target: { x: 3250, y: 3193, plane: 0 }, items: [{ id: Item.GHOSTSKULL, name: "Ghost's skull", amount: 1 }] },
};

export const DruidicRitual: Record<string, QuestStep> = {
    talkToKaqemeex: { text: "Talk to Kaqemeex in the Druids' Circle in Taverley.", target: { x: 2925, y: 3486, plane: 0 }, choices: ["I'm in search of a quest.", "Yes."] },
    goUpToSanfew: { text: "Talk to Sanfew upstairs in the Taverley herblore store.", target: { x: 2899, y: 3429, plane: 0 } },
    talkToSanfew: { text: "Talk to Sanfew upstairs in the Taverley herblore store.", target: { x: 2899, y: 3429, plane: 1 }, choices: ["I've been sent to help purify the Varrock stone circle."] },
    enterDungeon: { text: "Enter Taverley Dungeon south of Taverley.", target: { x: 2884, y: 3397, plane: 0 }, items: [{ id: Item.RAW_RAT_MEAT, name: "Raw rat meat", amount: 1, alternates: [Item.ENCHANTED_RAT_MEAT] }, { id: Item.RAW_BEAR_MEAT, name: "Raw bear meat", amount: 1, alternates: [Item.ENCHANTED_BEAR_MEAT] }, { id: Item.RAW_BEEF, name: "Raw beef", amount: 1, alternates: [Item.ENCHANTED_BEEF] }, { id: Item.RAW_CHICKEN, name: "Raw chicken", amount: 1, alternates: [Item.ENCHANTED_CHICKEN] }], choices: ["Ok, I'll do that then."] },
    climbDownToEnterDungeon: { text: "Enter Taverley Dungeon south of Taverley.", target: { x: 2898, y: 3428, plane: 1 }, items: [{ id: Item.RAW_RAT_MEAT, name: "Raw rat meat", amount: 1, alternates: [Item.ENCHANTED_RAT_MEAT] }, { id: Item.RAW_BEAR_MEAT, name: "Raw bear meat", amount: 1, alternates: [Item.ENCHANTED_BEAR_MEAT] }, { id: Item.RAW_BEEF, name: "Raw beef", amount: 1, alternates: [Item.ENCHANTED_BEEF] }, { id: Item.RAW_CHICKEN, name: "Raw chicken", amount: 1, alternates: [Item.ENCHANTED_CHICKEN] }] },
    enterCauldronRoom: { text: "Spam-click the Prison door to enter the room with the cauldron in Taverley dungeon. Spam-clicking lets you skip the fight with the suits of armour standing nearby.", target: { x: 2889, y: 9830, plane: 0 }, items: [{ id: Item.RAW_RAT_MEAT, name: "Raw rat meat", amount: 1, alternates: [Item.ENCHANTED_RAT_MEAT] }, { id: Item.RAW_BEAR_MEAT, name: "Raw bear meat", amount: 1, alternates: [Item.ENCHANTED_BEAR_MEAT] }, { id: Item.RAW_BEEF, name: "Raw beef", amount: 1, alternates: [Item.ENCHANTED_BEEF] }, { id: Item.RAW_CHICKEN, name: "Raw chicken", amount: 1, alternates: [Item.ENCHANTED_CHICKEN] }] },
    useRatOnCauldron: { text: "Use the rat meat on the cauldron in Taverley dungeon.", target: { x: 2893, y: 9831, plane: 0 }, items: [{ id: Item.RAW_RAT_MEAT, name: "Raw rat meat", amount: 1, alternates: [Item.ENCHANTED_RAT_MEAT] }] },
    useBeefOnCauldron: { text: "Use the beef meat on the cauldron in Taverley dungeon.", target: { x: 2893, y: 9831, plane: 0 }, items: [{ id: Item.RAW_BEEF, name: "Raw beef", amount: 1, alternates: [Item.ENCHANTED_BEEF] }] },
    useBearOnCauldron: { text: "Use the bear meat on the cauldron in Taverley dungeon.", target: { x: 2893, y: 9831, plane: 0 }, items: [{ id: Item.RAW_BEAR_MEAT, name: "Raw bear meat", amount: 1, alternates: [Item.ENCHANTED_BEAR_MEAT] }] },
    useChickenOnCauldron: { text: "Use the chicken meat on the cauldron in Taverley dungeon.", target: { x: 2893, y: 9831, plane: 0 }, items: [{ id: Item.RAW_CHICKEN, name: "Raw chicken", amount: 1, alternates: [Item.ENCHANTED_CHICKEN] }] },
    enchantMeats: { text: "Use the four meats on the cauldron in Taverley dungeon.", target: { x: 2893, y: 9831, plane: 0 } },
    goUpToSanfewWithMeat: { text: "Bring the enchanted meats to Sanfew upstairs in the Taverley herblore store.", target: { x: 2899, y: 3429, plane: 0 }, items: [{ id: Item.ENCHANTED_RAT_MEAT, name: "Enchanted rat", amount: 1 }, { id: Item.ENCHANTED_BEAR_MEAT, name: "Enchanted bear", amount: 1 }, { id: Item.ENCHANTED_BEEF, name: "Enchanted beef", amount: 1 }, { id: Item.ENCHANTED_CHICKEN, name: "Enchanted chicken", amount: 1 }] },
    talkToSanfewWithMeat: { text: "Bring the enchanted meats to Sanfew upstairs in the Taverley herblore store.", target: { x: 2899, y: 3429, plane: 1 }, items: [{ id: Item.ENCHANTED_RAT_MEAT, name: "Enchanted rat", amount: 1 }, { id: Item.ENCHANTED_BEAR_MEAT, name: "Enchanted bear", amount: 1 }, { id: Item.ENCHANTED_BEEF, name: "Enchanted beef", amount: 1 }, { id: Item.ENCHANTED_CHICKEN, name: "Enchanted chicken", amount: 1 }] },
    talkToKaqemeexToFinish: { text: "Return to Kaqemeex in the Druids' Circle to finish the quest.", target: { x: 2925, y: 3486, plane: 0 } },
};

export const WaterfallQuest: Record<string, QuestStep> = {
    talkToAlmera: { text: "Talk to Almera on top of Baxtorian Falls, south of Barbarian Outpost.", target: { x: 2521, y: 3495, plane: 0 }, choices: ["Yes."] },
    boardRaft: { text: "Board the log raft west of Almera.", target: { x: 2509, y: 3494, plane: 0 }, items: [{ id: Item.ROPE, name: "Rope", amount: 1 }] },
    talkToHudon: { text: "Talk to Hudon.", target: { x: 2511, y: 3484, plane: 0 }, items: [{ id: Item.ROPE, name: "Rope", amount: 1 }] },
    useRopeOnRock: { text: "Use a rope on the rock to the south.", target: { x: 2512, y: 3468, plane: 0 }, items: [{ id: Item.ROPE, name: "Rope", amount: 1 }] },
    useRopeOnTree: { text: "Use a rope on the dead tree.", target: { x: 2512, y: 3465, plane: 0 }, items: [{ id: Item.ROPE, name: "Rope", amount: 1 }] },
    getInBarrel: { text: "Get in the barrel.", target: { x: 2512, y: 3463, plane: 0 } },
    goUpstairsHadley: { text: "Go up the stairs in the house south of Almera's house.", target: { x: 2518, y: 3430, plane: 0 } },
    searchBookcase: { text: "Search the south east bookcase.", target: { x: 2520, y: 3427, plane: 1 } },
    readBook: { text: "Read the book.", items: [{ id: Item.BAXTORIAN_BOOK_WATERFALL_QUEST, name: "Book on baxtorian", amount: 1 }] },
    enterGnomeDungeon: { text: "Go to the centre of the Tree Gnome Village and go down the ladder at the entrance.", target: { x: 2533, y: 3155, plane: 0 } },
    leaveHouse: { text: "Go to the centre of the Tree Gnome Village and go down the ladder at the entrance.", target: { x: 2518, y: 3430, plane: 1 } },
    searchGnomeCrate: { text: "Search the off-coloured crate in the east room.", target: { x: 2548, y: 9565, plane: 0 } },
    enterGnomeDoor: { text: "Go through the gate in the west room.", target: { x: 2515, y: 9575, plane: 0 }, items: [{ id: Item.GOLRIE_KEY_WATERFALL_QUEST, name: "Key", amount: 1 }] },
    talkToGolrie: { text: "Talk to Golrie.", target: { x: 2514, y: 9580, plane: 0 } },
    usePebble: { text: "Bank everything besides the pebble and some food. Then use Glarial's pebble on Glarial's Tombstone east of Baxtorian Falls.", target: { x: 2559, y: 3445, plane: 0 }, items: [{ id: Item.GLARIALS_PEBBLE_WATERFALL_QUEST, name: "Glarial's pebble", amount: 1 }] },
    searchGlarialChest: { text: "Search the chest in the western room for Glarial's amulet.", target: { x: 2530, y: 9844, plane: 0 } },
    searchGlarialCoffin: { text: "Search Glarial's Tomb in the south room for Glarial's urn.", target: { x: 2542, y: 9812, plane: 0 } },
    getFinalItems: { text: "Leave Glarial's Tomb and get 6 air, water, and earth runes, a rope, glarial's amulet, glarial's urn, and some food.", items: [{ id: Item.AIRRUNE, name: "Air runes", amount: 6 }, { id: Item.EARTHRUNE, name: "Earth runes", amount: 6 }, { id: Item.WATERRUNE, name: "Water runes", amount: 6 }, { id: Item.GLARIALS_AMULET_WATERFALL_QUEST, name: "Glarial's amulet", amount: 1, equipped: true }, { id: Item.GLARIALS_URN_FULL_WATERFALL_QUEST, name: "Glarial's urn", amount: 1 }, { id: Item.ROPE, name: "Rope", amount: 1 }] },
    boardRaftFinal: { text: "Board the log raft west of Almera.", target: { x: 2509, y: 3494, plane: 0 } },
    useRopeOnRockFinal: { text: "Use a rope on the rock to the south.", target: { x: 2512, y: 3468, plane: 0 }, items: [{ id: Item.ROPE, name: "Rope", amount: 1 }] },
    useRopeOnTreeFinal: { text: "Use a rope on the dead tree.", target: { x: 2512, y: 3465, plane: 0 }, items: [{ id: Item.ROPE, name: "Rope", amount: 1 }] },
    equipAmulet: { text: "Equip Glarial's amulet.", items: [{ id: Item.GLARIALS_AMULET_WATERFALL_QUEST, name: "Glarial's amulet", amount: 1, equipped: true }] },
    enterFalls: { text: "Enter the falls with Glarial's amulet equipped.", target: { x: 2511, y: 3464, plane: 0 }, items: [{ id: Item.GLARIALS_AMULET_WATERFALL_QUEST, name: "Glarial's amulet", amount: 1, equipped: true }] },
    searchFallsCrate: { text: "Search the crate in the east room for a key.", target: { x: 2589, y: 9888, plane: 0 } },
    useKeyOnFallsDoor: { text: "Enter the west room with the key.", target: { x: 2566, y: 9901, plane: 0 }, items: [{ id: Item.BAXTORIAN_KEY_WATERFALL_QUEST, name: "Key", amount: 1 }] },
    useRunes: { text: "Use 1 earth, water and air rune on each of the 6 pillars in the room. Afterwards, use Glarial's amulet on the statue of Glarial.", items: [{ id: Item.AIRRUNE, name: "Air rune", amount: 1 }, { id: Item.WATERRUNE, name: "Water rune", amount: 1 }, { id: Item.EARTHRUNE, name: "Earth rune", amount: 1 }] },
    useAmuletOnStatue: { text: "Use Glarial's amulet on the Statue of Glarial", target: { x: 2603, y: 9915, plane: 0 }, items: [{ id: Item.GLARIALS_AMULET_WATERFALL_QUEST, name: "Glarial's amulet", amount: 1 }] },
    useUrnOnChalice: { text: "DO NOT LEFT-CLICK THE CHALICE! Use Glarial's urn on the Chalice to finish the quest.", target: { x: 2604, y: 9911, plane: 0 }, items: [{ id: Item.GLARIALS_URN_FULL_WATERFALL_QUEST, name: "Glarial's urn", amount: 1 }] },
};
