// Ported from the pinned upstream loadSteps() tables; BSD notices: LICENSE-QuestHelper.txt.
import * as Item from "../../../runelite/api/gameval/ItemID";
import * as Varbit from "../../../runelite/api/gameval/VarbitID";
import * as Npc from "../../../runelite/api/gameval/NpcID";
import * as ObjectID from "../../../runelite/api/gameval/ObjectID";
import { CooksAssistant as cook, SheepShearer as sheep, DoricsQuest as doric, ImpCatcher as imp,
    WitchsPotion as witch, RuneMysteries as rune, TheRestlessGhost as ghost,
    DruidicRitual as druid, WaterfallQuest as waterfall } from "./steps";
import { inZone, type QuestGuide, type QuestStep } from "./types";

export const COOK_DIALOGS = {
    all: "You've brought me everything I need! I am saved!",
    milk: "Here's a bucket of milk.",
    flour: "Here's a pot of flour.",
    egg: "Here's a fresh egg.",
};

export const QUEST_GUIDES: Readonly<Record<string, QuestGuide>> = {
    cooks_assistant: {
        stages: [0, 1], steps: Object.values(cook),
        resolve(c) {
            const all = c.seenDialog(COOK_DIALOGS.all);
            const milk = c.count(Item.BUCKET_MILK) || c.count(Item.BOTTOMLESS_MILK_BUCKET_FILLED) || c.seenDialog(COOK_DIALOGS.milk);
            const flour = c.count(Item.POT_FLOUR) || c.seenDialog(COOK_DIALOGS.flour);
            const egg = c.count(Item.EGG) || c.seenDialog(COOK_DIALOGS.egg);
            if (!all) {
                if (!milk && !c.count(Item.BUCKET_EMPTY)) return cook.getBucket;
                if (!flour && !c.count(Item.POT_EMPTY)) return cook.getPot;
                if (!egg) return cook.getEgg;
                if (!flour) {
                    const second = inZone(c.position, 3162, 3311, 3171, 3302, 1);
                    const third = inZone(c.position, 3162, 3311, 3171, 3302, 2);
                    if (c.varbit(Varbit.MILL_FLOUR) === 1) return third ? cook.climbLadderThree : second ? cook.climbLadderTwoDown : cook.collectFlour;
                    if (c.count(Item.GRAIN) && third) return cook.fillHopper;
                    if (third) return cook.operateControls;
                    if (c.count(Item.GRAIN) && second) return cook.climbLadderTwoUp;
                    if (c.count(Item.GRAIN)) return cook.climbLadderOne;
                    return cook.getWheat;
                }
                if (!milk) return cook.milkCow;
            }
            return { ...cook.finishQuest, items: cook.finishQuest.items!.filter((item) => !all && !c.seenDialog(
                item.id === Item.EGG ? COOK_DIALOGS.egg : item.id === Item.BUCKET_MILK ? COOK_DIALOGS.milk : COOK_DIALOGS.flour)) };
        },
    },
    sheep_shearer: {
        stages: Array.from({ length: 21 }, (_, i) => i), steps: Object.values(sheep),
        resolve(c) {
            if (c.stage === 0) return sheep.startStep;
            const remaining = c.stage > 1 ? 21 - c.stage : 20;
            const balls = c.count(Item.BALL_OF_WOOL), wool = c.count(Item.WOOL);
            const upstairs = inZone(c.position, 3200, 3232, 3220, 3205, 1);
            let step: QuestStep;
            if (balls >= remaining || (!wool && balls > 0)) step = upstairs ? sheep.climbStairsDown : sheep.turnInBalls;
            else if (balls + wool >= remaining || (balls + wool > 0 && c.inventoryFull)) step = upstairs ? sheep.spinBalls : sheep.climbStairsUp;
            else step = c.count(Item.SHEARS) ? sheep.shearSheep : sheep.getSheers;
            return { ...step, items: step.items?.map((item) => item.id === Item.WOOL || item.id === Item.BALL_OF_WOOL ? { ...item, amount: remaining } : item) };
        },
    },
    dorics_quest: { stages: [0, 10], steps: Object.values(doric), resolve: () => doric.talkToDoric },
    imp_catcher: {
        stages: [0, 1], steps: Object.values(imp),
        resolve(c) {
            if (!imp.collectBeads.items!.every((item) => c.count(item.id))) return imp.collectBeads;
            if (inZone(c.position, 3089, 3176, 3126, 3146, 2)) return imp.turnInQuest;
            return inZone(c.position, 3089, 3176, 3126, 3146, 1) ? imp.climbUpF1 : imp.moveToTower;
        },
    },
    witchs_potion: {
        stages: [0, 1, 2], steps: Object.values(witch),
        resolve: (c) => c.stage === 0 ? witch.talkToWitch : c.stage === 2 ? witch.drinkPotion
            : c.count(Item.RATS_TAIL) + c.bankCount(Item.RATS_TAIL) > 0 ? witch.returnToWitch : witch.killRat,
    },
    rune_mysteries: {
        stages: [0, 1, 2, 3, 4, 5], steps: Object.values(rune),
        resolve(c) {
            const upstairs = inZone(c.position, 3203, 3206, 3218, 3231, 1);
            const basement = inZone(c.position, 3094, 9553, 3125, 9582);
            if (c.stage === 0) return upstairs ? rune.talkToHoracio : rune.goUpToHoracio;
            if (c.stage === 1) return c.count(Item.AIR_TALISMAN) && upstairs ? rune.goF1ToF0LumbridgeCastle : basement ? rune.bringTalismanToSedridor : rune.goDownToSedridor;
            if (c.stage === 2 || (c.stage === 3 && c.varbit(Varbit.RUNEMYSTERIES_PACKAGE) === 0)) return basement ? rune.getResearchPackageFromSedridor : rune.goDownToSedridorAfterHandingInAirTalisman;
            if (c.stage === 3) return rune.deliverPackageToAubury;
            if (c.stage === 4 || c.varbit(Varbit.RUNEMYSTERIES_NOTES) === 0) return rune.talkToAudburyAgain;
            if (basement && c.varbit(Varbit.RUNEMYSTERIES_NOTES_GIVEN) === 1) return rune.talkToSedridorAfterGivingHimTheNotes;
            return basement ? rune.deliverResearchNotesToSedridor : rune.goDownToSedridor2;
        },
    },
    the_restless_ghost: {
        stages: [0, 1, 2, 3, 4], steps: Object.values(ghost),
        resolve(c) {
            if (c.stage === 0) return ghost.talkToAereck;
            if (c.stage === 1) return ghost.talkToUrhney;
            const open = c.hasObject(ObjectID.OPENGHOSTCOFFIN, ghost.searchCoffin.target!);
            if (c.stage === 2) return c.hasNpc(Npc.GHOSTX) ? ghost.speakToGhost : open ? ghost.searchCoffin : ghost.openCoffin;
            const basement = inZone(c.position, 3094, 9553, 3125, 9582);
            if (c.stage === 4 && c.varbit(Varbit.RESTLESS_GHOST_ALTAR_VAR) === 1) return basement ? ghost.exitWizardsTowerBasement : open ? ghost.putSkullInCoffin : ghost.openCoffinToPutSkullIn;
            return basement ? ghost.searchAltarAndRun : ghost.enterWizardsTowerBasement;
        },
    },
    druidic_ritual: {
        stages: [0, 1, 2, 3], steps: Object.values(druid),
        resolve(c) {
            if (c.stage === 0) return druid.talkToKaqemeex;
            if (c.stage === 3) return druid.talkToKaqemeexToFinish;
            const sanfew = inZone(c.position, 2893, 3423, 2903, 3433, 1);
            if (c.stage === 1) return sanfew ? druid.talkToSanfew : druid.goUpToSanfew;
            const rat = c.count(Item.ENCHANTED_RAT_MEAT), bear = c.count(Item.ENCHANTED_BEAR_MEAT), beef = c.count(Item.ENCHANTED_BEEF);
            if (rat && bear && beef && c.count(Item.ENCHANTED_CHICKEN)) return sanfew ? druid.talkToSanfewWithMeat : druid.goUpToSanfewWithMeat;
            if (inZone(c.position, 2889, 9825, 2898, 9839)) return rat && bear && beef ? druid.useChickenOnCauldron : rat && bear ? druid.useBeefOnCauldron : rat ? druid.useBearOnCauldron : druid.useRatOnCauldron;
            if (inZone(c.position, 2816, 9668, 2973, 9855)) return druid.enterCauldronRoom;
            return sanfew ? druid.climbDownToEnterDungeon : druid.enterDungeon;
        },
    },
    waterfall_quest: {
        stages: [0, 1, 2, 3, 4, 5, 6, 7, 8], steps: Object.values(waterfall),
        resolve(c) {
            const hudon = inZone(c.position, 2510, 3476, 2515, 3482);
            const tree = inZone(c.position, 2512, 3465, 2513, 3475);
            const ledge = inZone(c.position, 2510, 3462, 2513, 3464);
            const house = inZone(c.position, 2516, 3424, 2520, 3431, 1);
            if (c.stage === 0) return waterfall.talkToAlmera;
            if (c.stage === 1) return hudon ? waterfall.talkToHudon : waterfall.boardRaft;
            if (c.stage === 2) {
                if (c.count(Item.BAXTORIAN_BOOK_WATERFALL_QUEST)) return waterfall.readBook;
                return house ? waterfall.searchBookcase : ledge ? waterfall.getInBarrel : tree ? waterfall.useRopeOnTree : hudon ? waterfall.useRopeOnRock : waterfall.goUpstairsHadley;
            }
            const urn = c.count(Item.GLARIALS_URN_FULL_WATERFALL_QUEST) + c.bankCount(Item.GLARIALS_URN_FULL_WATERFALL_QUEST);
            const equippedAmulet = c.equipped(Item.GLARIALS_AMULET_WATERFALL_QUEST);
            const amuletWithBank = equippedAmulet || c.bankCount(Item.GLARIALS_AMULET_WATERFALL_QUEST) > 0;
            if (c.stage < 5 && !(urn && amuletWithBank)) {
                if (c.varbit(Varbit.WATERFALL_GOLRIE_CHAT) === 1) {
                    if (inZone(c.position, 2524, 9801, 2557, 9849)) return c.count(Item.GLARIALS_AMULET_WATERFALL_QUEST) + c.bankCount(Item.GLARIALS_AMULET_WATERFALL_QUEST) > 0 ? waterfall.searchGlarialCoffin : waterfall.searchGlarialChest;
                    return waterfall.usePebble;
                }
                if (inZone(c.position, 2502, 9576, 2523, 9593)) return waterfall.talkToGolrie;
                if (inZone(c.position, 2497, 9552, 2559, 9593)) return c.count(Item.GOLRIE_KEY_WATERFALL_QUEST) ? waterfall.enterGnomeDoor : waterfall.searchGnomeCrate;
                return house ? waterfall.leaveHouse : waterfall.enterGnomeDungeon;
            }
            if (inZone(c.position, 2599, 9890, 2608, 9916)) return waterfall.useUrnOnChalice;
            if (inZone(c.position, 2561, 9902, 2570, 9917)) return waterfall.useRunes;
            if (inZone(c.position, 2556, 9861, 2595, 9920)) return c.count(Item.BAXTORIAN_KEY_WATERFALL_QUEST) ? waterfall.useKeyOnFallsDoor : waterfall.searchFallsCrate;
            if (ledge) return equippedAmulet ? waterfall.enterFalls : waterfall.equipAmulet;
            if (tree) return waterfall.useRopeOnTreeFinal;
            if (hudon) return waterfall.useRopeOnRockFinal;
            return c.count(Item.GLARIALS_URN_FULL_WATERFALL_QUEST) && equippedAmulet && c.count(Item.AIRRUNE) >= 6 && c.count(Item.EARTHRUNE) >= 6 && c.count(Item.WATERRUNE) >= 6 && c.count(Item.ROPE) ? waterfall.boardRaftFinal : waterfall.getFinalItems;
        },
    },
};
