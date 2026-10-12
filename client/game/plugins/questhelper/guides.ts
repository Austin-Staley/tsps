// Adapted from Zoinkwiz/quest-helper; authors and BSD notices are in LICENSE-QuestHelper.txt.
import * as Item from "../../../runelite/api/gameval/ItemID";
import type { ItemRequirement, QuestGuide, QuestStep } from "./types";

const item = (id: number, name: string, amount = 1): ItemRequirement => ({ id, name, amount });
const step = (text: string, x: number, y: number, plane = 0, items?: ItemRequirement[], choices?: string[]): QuestStep =>
    ({ text, target: { x, y, plane }, items, choices });
const ingredients = [item(Item.EGG, "Egg"), item(Item.BUCKET_MILK, "Bucket of milk"), item(Item.POT_FLOUR, "Pot of flour")];
const ores = [item(Item.CLAY, "Clay", 6), item(Item.COPPER_ORE, "Copper ore", 4), item(Item.IRON_ORE, "Iron ore", 2)];
const beads = [item(Item.BLACK_BEAD, "Black bead"), item(Item.RED_BEAD, "Red bead"), item(Item.WHITE_BEAD, "White bead"), item(Item.YELLOW_BEAD, "Yellow bead")];
const potion = [item(Item.RATS_TAIL, "Rat's tail"), item(Item.BURNT_MEAT, "Burnt meat"), item(Item.ONION, "Onion"), item(Item.EYE_OF_NEWT, "Eye of newt")];
const meats = [item(Item.RAW_BEEF, "Raw beef"), item(Item.RAW_RAT_MEAT, "Raw rat meat"), item(Item.RAW_BEAR_MEAT, "Raw bear meat"), item(Item.RAW_CHICKEN, "Raw chicken")];
const enchanted = [item(Item.ENCHANTED_BEEF, "Enchanted beef"), item(Item.ENCHANTED_RAT_MEAT, "Enchanted rat meat"), item(Item.ENCHANTED_BEAR_MEAT, "Enchanted bear meat"), item(Item.ENCHANTED_CHICKEN, "Enchanted chicken")];

// These stages are TSPS's persisted stages, including Doric's 10/100 and Sheep Shearer's partial hand-ins.
// shortcut: other quests use live journals; add detailed guides after checking their TSPS interactions.
export const QUEST_GUIDES: Readonly<Record<string, QuestGuide>> = {
    cooks_assistant: {
        steps: ["Talk to the Cook in Lumbridge Castle.", "Buy a bucket and pot at the Lumbridge General Store; collect an egg at a farm.", "Pick wheat, fill the mill hopper, operate the controls and collect flour.", "Milk a dairy cow with the bucket.", "Bring all three ingredients to the Cook."],
        note: "TSPS requires all three ingredients together. Eggs spawn at farms; the general store sells the bucket and pot.",
        resolve({ quest, count, position }) {
            if (quest.status === 1) return step("Talk to the Cook in Lumbridge Castle's kitchen to start.", 3209, 3215, 0, undefined, ["What's wrong?", "Yes."]);
            if (!count(Item.EGG)) return step("Pick up an egg at the farm north-west of Lumbridge.", 3185, 3297);
            if (!count(Item.BUCKET_MILK) && !count(Item.BUCKET_EMPTY)) return step("Buy an empty bucket at the Lumbridge General Store.", 3212, 3246);
            if (!count(Item.POT_FLOUR)) {
                if (!count(Item.POT_EMPTY)) return step("Buy an empty pot at the Lumbridge General Store.", 3212, 3246);
                if ((quest.facts.flour ?? 0) > 0) return step("Go to the ground floor of Mill Lane Mill and empty the flour bin into your pot.", 3166, 3306, 0, [item(Item.POT_EMPTY, "Pot")]);
                if (quest.facts.hopper) return step("Operate the hopper controls on the mill's top floor.", 3166, 3305, 2);
                if (!count(Item.GRAIN)) return step("Pick wheat in the field south of Mill Lane Mill.", 3161, 3292);
                if (position.plane < 2) return step("Climb the ladder in Mill Lane Mill to the top floor.", 3164, 3307, position.plane);
                return step("Select Fill on the hopper with grain in your inventory.", 3166, 3307, 2, [item(Item.GRAIN, "Grain")]);
            }
            if (!count(Item.BUCKET_MILK)) return step("Select Milk on the dairy cow north of Lumbridge with an empty bucket in your inventory.", 3172, 3317, 0, [item(Item.BUCKET_EMPTY, "Bucket")]);
            return step("Give the Cook all three ingredients to finish.", 3209, 3215, 0, ingredients);
        },
    },
    sheep_shearer: {
        steps: ["Start with Fred the Farmer.", "Use shears on sheep north of Lumbridge.", "Spin the wool on Lumbridge Castle's first floor.", "Deliver 20 balls of wool to Fred; partial deliveries count."],
        resolve({ quest, count, position }) {
            const remaining = 20 - Math.max(0, quest.stage - 1);
            if (quest.status === 1) return step("Talk to Fred the Farmer north of Lumbridge.", 3190, 3273);
            if (count(Item.BALL_OF_WOOL) >= remaining) return step("Deliver the remaining balls of wool to Fred.", 3190, 3273, 0, [item(Item.BALL_OF_WOOL, "Ball of wool", remaining)]);
            if (count(Item.BALL_OF_WOOL) + count(Item.WOOL) >= remaining) return position.plane === 0
                ? step("Climb the stairs in Lumbridge Castle to the first-floor spinning wheel.", 3204, 3207)
                : step("Spin your wool at the spinning wheel on Lumbridge Castle's first floor.", 3209, 3212, 1);
            if (!count(Item.SHEARS)) return step("Buy shears at the Lumbridge General Store.", 3212, 3246);
            return step(`Shear sheep north of Lumbridge until you have ${remaining} wool or balls of wool.`, 3201, 3268, 0, [item(Item.SHEARS, "Shears")]);
        },
    },
    dorics_quest: {
        steps: ["Bring Doric six clay, four copper ore and two iron ore, all unnoted.", "Talk to Doric north of Falador to start and hand over the ores."],
        resolve: () => step("Bring Doric north of Falador 6 clay, 4 copper ore and 2 iron ore (unnoted). Mine or trade for missing ores.", 2951, 3451, 0, ores),
    },
    imp_catcher: {
        steps: ["Talk to Wizard Mizgog on the Wizards' Tower's second floor.", "Collect all four coloured beads from imps or trade.", "Give Mizgog all four beads together."],
        resolve({ quest, count }) {
            if (quest.status === 1) return step("Talk to Wizard Mizgog on the Wizards' Tower's second floor.", 3103, 3163, 2);
            if (beads.some((bead) => !count(bead.id))) return { text: "Kill imps or trade to obtain all four coloured beads, then return to Mizgog.", items: beads };
            return step("Give Mizgog all four beads together.", 3103, 3163, 2, beads);
        },
    },
    witchs_potion: {
        steps: ["Start with Hetty in Rimmington.", "Collect a rat's tail, burnt meat, onion and eye of newt.", "Give Hetty the ingredients.", "Drink from Hetty's cauldron."],
        resolve({ quest, count }) {
            if (quest.stage >= 2) return step("Drink from Hetty's cauldron to finish.", 2967, 3205);
            if (quest.status === 1) return step("Talk to Hetty in Rimmington to start.", 2968, 3205);
            if (!count(Item.RATS_TAIL)) return step("Kill a rat in Rimmington for its tail. Bring the other ingredients to Hetty.", 2956, 3203, 0, potion);
            return step("Bring Hetty the rat's tail, burnt meat, onion and eye of newt.", 2968, 3205, 0, potion);
        },
    },
    rune_mysteries: {
        steps: ["Talk to Duke Horacio on Lumbridge Castle's first floor.", "Deliver the air talisman to Sedridor in the Wizards' Tower basement.", "Take Sedridor's research package to Aubury in Varrock.", "Ask Aubury for his notes and return them to Sedridor."],
        resolve({ quest, position }) {
            if (quest.stage === 0) return step("Talk to Duke Horacio on Lumbridge Castle's first floor.", 3209, 3222, 1);
            if ([1, 2, 5].includes(quest.stage) && position.y < 9000) return step("Climb down into the Wizards' Tower basement to speak to Sedridor.", 3104, 3162);
            if (quest.stage === 1) return step("Bring the air talisman to Sedridor in the Wizards' Tower basement.", 3104, 9571, 0, [item(Item.AIR_TALISMAN, "Air talisman")]);
            if (quest.stage === 2) return step("Ask Sedridor for his research package.", 3104, 9571);
            if (quest.stage === 3) return step("Deliver the research package to Aubury in south-east Varrock.", 3253, 3401, 0, [item(Item.RESEARCH_PACKAGE, "Research package")]);
            if (quest.stage === 4) return step("Talk to Aubury again to obtain his research notes.", 3253, 3401);
            return step("Bring Aubury's notes back to Sedridor in the Wizards' Tower basement.", 3104, 9571, 0, [item(Item.RESEARCH_NOTES, "Research notes")]);
        },
    },
    the_restless_ghost: {
        steps: ["Start with Father Aereck in Lumbridge church.", "Get a ghostspeak amulet from Father Urhney in Lumbridge Swamp.", "Wear it and talk to the ghost in the graveyard.", "Search the altar in the Wizards' Tower basement.", "Use the ghost's skull on the open coffin."],
        note: "TSPS keeps the skull in the Wizards' Tower basement.",
        resolve({ quest, count, equipped, position }) {
            if (quest.stage === 0) return step("Talk to Father Aereck in Lumbridge church.", 3243, 3206);
            if (quest.stage === 1 || (!count(Item.AMULET_OF_GHOSTSPEAK) && !equipped(Item.AMULET_OF_GHOSTSPEAK))) return step("Get a ghostspeak amulet from Father Urhney in the shack in Lumbridge Swamp.", 3147, 3175);
            if (quest.stage === 2) return step("Wear the ghostspeak amulet. Open/search the coffin in Lumbridge graveyard and talk to the ghost.", 3250, 3193, 0, [{ ...item(Item.AMULET_OF_GHOSTSPEAK, "Ghostspeak amulet"), equipped: true }]);
            if (quest.stage >= 3 && !count(Item.GHOSTSKULL)) return position.y < 9000
                ? step("Enter the Wizards' Tower basement south of Draynor to find the ghost's skull.", 3104, 3162)
                : step("Search the altar for the ghost's skull. You can reclaim a lost skull here.", 3120, 9567);
            return step("Use the ghost's skull on the open coffin in Lumbridge graveyard.", 3250, 3193, 0, [item(Item.GHOSTSKULL, "Ghost's skull")]);
        },
    },
    druidic_ritual: {
        steps: ["Talk to Kaqemeex in Taverley's stone circle.", "Talk to Sanfew upstairs in the herb shop.", "Use four raw meats on the Cauldron of Thunder in Taverley Dungeon.", "Bring the enchanted meats to Sanfew, then return to Kaqemeex."],
        resolve({ quest, count, position }) {
            if (quest.stage === 0 || quest.stage >= 3) return step(quest.stage === 0 ? "Talk to Kaqemeex in Taverley's stone circle." : "Return to Kaqemeex to finish the quest.", 2925, 3486);
            if (quest.stage === 1) return step("Talk to Sanfew upstairs in the Taverley herb shop.", 2899, 3429, 1);
            if (enchanted.every((meat) => count(meat.id))) return step("Give Sanfew all four enchanted meats.", 2899, 3429, 1, enchanted);
            if (position.y < 9000) return step("Enter Taverley Dungeon with the raw meats you still need to enchant.", 2884, 3397, 0, meats.filter((_, index) => !count(enchanted[index].id)));
            return step("Use each missing raw meat on the Cauldron of Thunder in Taverley Dungeon.", 2893, 9831, 0, meats.filter((_, index) => !count(enchanted[index].id)));
        },
    },
    waterfall_quest: {
        steps: ["Talk to Almera and Hudon.", "Ask Hadley about the elven king to get and read the book.", "Talk to Golrie for Glarial's pebble.", "Use the pebble on Glarial's tombstone to receive both relics.", "Interact with Glarial's statue with both relics in your inventory.", "Interact with the chalice with six air, water and earth runes."],
        note: "TSPS gives both relics at the tombstone and takes both at the statue. Raft/barrel travel, dungeon doors and rune-on-pillar placements need server work for OSRS parity; use the live journal if a route is blocked.",
        resolve({ quest }) {
            if (quest.stage === 0) return step("Talk to Almera beside Baxtorian Falls.", 2521, 3495);
            if (quest.stage === 1) return step("Speak to Hudon near the waterfall. Raft travel is incomplete in TSPS.", 2511, 3484);
            if (quest.stage === 2) return step("Talk to Hadley south of the falls about the elven king to obtain/read the Book on Baxtorian.", 2516, 3428);
            if (quest.stage === 3) return step("Talk to Golrie in the gnome maze dungeon for Glarial's pebble.", 2514, 9580);
            if (quest.stage === 4) return step("Use Glarial's pebble on her tombstone. Leave an inventory space for the relics.", 2559, 3445, 0, [item(Item.GLARIALS_PEBBLE_WATERFALL_QUEST, "Glarial's pebble")]);
            if (quest.stage < 8) return step("Interact with Glarial's statue with both relics in your inventory.", 2603, 9915, 0, [item(Item.GLARIALS_AMULET_WATERFALL_QUEST, "Glarial's amulet"), item(Item.GLARIALS_URN_FULL_WATERFALL_QUEST, "Glarial's urn")]);
            return step("Interact with Baxtorian's chalice carrying six of each rune to finish.", 2604, 9911, 0, [item(Item.AIRRUNE, "Air rune", 6), item(Item.WATERRUNE, "Water rune", 6), item(Item.EARTHRUNE, "Earth rune", 6)]);
        },
    },
};
