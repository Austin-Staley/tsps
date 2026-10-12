import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { QUEST_GUIDES } from "../game/plugins/questhelper/guides";
import catalog from "../game/plugins/questhelper/catalog.json";
import { requirementCount, type QuestContext, type ImportedGuide } from "../game/plugins/questhelper/types";
import { extractSteps, literalText, splitArguments } from "../scripts/import-quest-helper.mjs";
import * as Item from "../runelite/api/gameval/ItemID";
import * as Varbit from "../runelite/api/gameval/VarbitID";
import * as InterfaceID from "../runelite/api/gameval/InterfaceID";
import { Inventory } from "../rs/inventory/Inventory";
import { TileHighlightManager } from "../game/highlights/TileHighlightManager";
import { GroundItemStore } from "../game/data/ground/GroundItemStore";
import { clearHintArrow, getActiveHintArrow, getSceneHintArrows, hintArrow, questHintArrow, setHintArrowNpc } from "../game/HintArrow";
import { GameState } from "../runelite/api/GameState";
import { GameStateChanged } from "../runelite/api/events";
import { ClientState } from "../game/ClientState";

function context(stage: number, items: Array<[number, number]> = [], x = 3200, y = 3200, plane = 0): QuestContext {
    const counts = new Map(items);
    return { stage, count: (id) => counts.get(id) ?? 0, bankCount: () => 0, equipped: () => false,
        varbit: () => 0, seenDialog: () => false, hasNpc: () => false, hasObject: () => false,
        inventoryFull: false, position: { x, y, plane } };
}
const loadGuide = (key: string): ImportedGuide => JSON.parse(readFileSync(new URL(`../public/quest-helper/${key}.json`, import.meta.url), "utf8"));

assert.equal(catalog.length, 213, "Import every upstream quest and miniquest entry, including both Shield of Arrav routes");
assert.equal(new Set(catalog.map((quest) => quest.key)).size, catalog.length);
assert.equal(readdirSync(new URL("../public/quest-helper/", import.meta.url)).filter((name) => name.endsWith(".json")).length, catalog.length);
for (const quest of catalog) {
    const guide = loadGuide(quest.key);
    assert.equal(guide.source, quest.source);
    assert.ok(guide.steps.length > 0, quest.key);
    for (const step of guide.steps) {
        assert.ok(step.text.length > 0);
        assert.doesNotMatch(step.text, /TSPS|live journal|Select Fill/);
        if (step.target) assert.ok(Number.isInteger(step.target.x) && Number.isInteger(step.target.y) && step.target.plane >= 0 && step.target.plane <= 3);
        for (const item of step.items ?? []) assert.ok(Number.isInteger(item.id) && item.amount > 0);
    }
}
assert.ok(loadGuide("dragon_slayer_ii").steps.some((step) => /Galvek/.test(step.text)));
assert.ok(loadGuide("song_of_the_elves").steps.some((step) => /fragment|mirror|seal/i.test(step.text)));
assert.ok(loadGuide("waterfall_quest").steps.some((step) => /each of the 6 pillars/.test(step.text)));
assert.notDeepEqual(loadGuide("shield_of_arrav_phoenix_gang").steps, loadGuide("shield_of_arrav_black_arm_gang").steps, "Separate upstream routes must stay separate");

assert.deepEqual(splitArguments('this, new WorldPoint(1, 2, 0), "A, B", List.of(a, b)'), ['this', 'new WorldPoint(1, 2, 0)', '"A, B"', 'List.of(a, b)']);
assert.equal(literalText('"Use a rope on the rock to" + " the south."'), "Use a rope on the rock to the south.");
assert.equal(literalText('"Read " + unknownVariable'), undefined, "Never invent dynamic upstream text");
const parsed = extractSteps(`// fake = new NpcStep(this, 1, "Wrong");
egg = new ItemRequirement("Egg", ItemID.EGG);
go = new ObjectStep(this, 7, new WorldPoint(1, 2, 0), "Use, then \\"continue\\"." , egg);
go.addDialogStep("Yes.");`, { EGG: Item.EGG });
assert.equal(parsed.length, 1);
assert.equal(parsed[0].text, 'Use, then "continue".');
assert.equal(parsed[0].items?.[0].id, Item.EGG);
assert.deepEqual(parsed[0].choices, ["Yes."]);
const weapons = extractSteps(`List<String> text = Arrays.asList("Sword - Unicorn", "Mace - Rat");
fight = new DetailedQuestStep(this, ""); fight.setText(text);`, {});
assert.equal(weapons[0].text, "Sword - Unicorn Mace - Rat", "Preserve upstream multiline/setText instructions");
const coins = loadGuide("cooks_assistant").steps[0].items![0];
assert.equal(coins.amount, 2);
assert.ok(coins.alternates?.includes(Item.MAGICTRAINING_COINS), "Preserve upstream ItemCollections alternatives");

for (const [key, guide] of Object.entries(QUEST_GUIDES)) {
    const imported = loadGuide(key);
    for (const step of guide.steps) assert.ok(imported.steps.some((source) => JSON.stringify(source) === JSON.stringify(step)), `${key}: automatic step data must match imported upstream data`);
    for (const stage of guide.stages) assert.ok(guide.resolve(context(stage)).text);
}
const cook = QUEST_GUIDES.cooks_assistant;
assert.match(cook.resolve(context(0)).text, /Purchase a bucket/, "Upstream gathers before starting; no forced TSPS start step");
assert.equal(cook.resolve(context(1, [[Item.BUCKET_EMPTY, 1], [Item.POT_EMPTY, 1]])).target?.x, 3177, "Keep upstream egg tile even when TSPS spawn differs");
const flour = context(1, [[Item.EGG, 1], [Item.POT_EMPTY, 1], [Item.BUCKET_MILK, 1]], 3164, 3307, 2);
assert.match(cook.resolve(flour).text, /Operate the hopper controls/);
flour.varbit = (id) => id === Varbit.MILL_FLOUR ? 1 : 0;
assert.match(cook.resolve(flour).text, /Climb down/);
const handIn = context(1, [[Item.POT_FLOUR, 1], [Item.BUCKET_MILK, 1]]);
handIn.seenDialog = (text) => text === "Here's a fresh egg.";
assert.equal(cook.resolve(handIn).items?.some((item) => item.id === Item.EGG), false, "Track upstream partial hand-ins through dialogue");

assert.equal(QUEST_GUIDES.sheep_shearer.resolve(context(11, [[Item.BALL_OF_WOOL, 10]])).items?.[0].amount, 10);
assert.match(QUEST_GUIDES.sheep_shearer.resolve(context(1, [[Item.BALL_OF_WOOL, 2]])).text, /Bring Fred/, "Upstream permits partial hand-ins");
assert.match(QUEST_GUIDES.sheep_shearer.resolve(context(1)).text, /Pickup the shears/);
const fullWool = context(1, [[Item.WOOL, 3]], 3209, 3212, 1); fullWool.inventoryFull = true;
assert.match(QUEST_GUIDES.sheep_shearer.resolve(fullWool).text, /Spin your wool/);
assert.deepEqual(QUEST_GUIDES.dorics_quest.resolve(context(10)).items?.map((item) => item.amount), [6, 4, 2]);
assert.match(QUEST_GUIDES.imp_catcher.resolve(context(0)).text, /Collect one of each bead/, "No forced Mizgog start step");
const bankedTail = context(1); bankedTail.bankCount = (id) => id === Item.RATS_TAIL ? 1 : 0;
assert.match(QUEST_GUIDES.witchs_potion.resolve(bankedTail).text, /Bring the ingredients/);
assert.match(QUEST_GUIDES.rune_mysteries.resolve(context(3)).text, /accept the Research Package/, "Missing package varbit must not advance to Aubury");
const rune = context(5, [], 3104, 9571); rune.varbit = (id) => id === Varbit.RUNEMYSTERIES_NOTES || id === Varbit.RUNEMYSTERIES_NOTES_GIVEN ? 1 : 0;
assert.match(QUEST_GUIDES.rune_mysteries.resolve(rune).text, /finish the quest/);
const ghost = context(2, [[Item.AMULET_OF_GHOSTSPEAK, 1]]);
assert.match(QUEST_GUIDES.the_restless_ghost.resolve(ghost).text, /^Open the coffin/);
ghost.hasNpc = () => true;
const amulet = QUEST_GUIDES.the_restless_ghost.resolve(ghost).items![0];
assert.equal(requirementCount(amulet, ghost), 0);
ghost.equipped = () => true;
assert.equal(requirementCount(amulet, ghost), 1);
const skull = context(4, [[Item.GHOSTSKULL, 1]], 3104, 9571); skull.varbit = () => 1;
assert.match(QUEST_GUIDES.the_restless_ghost.resolve(skull).text, /Leave the basement/);
assert.match(QUEST_GUIDES.druidic_ritual.resolve(context(2, [], 2885, 9800)).text, /Prison door/);
assert.match(QUEST_GUIDES.druidic_ritual.resolve(context(2, [[Item.ENCHANTED_RAT_MEAT, 1]], 2893, 9831)).text, /bear meat/);
assert.match(QUEST_GUIDES.waterfall_quest.resolve(context(1)).text, /Board the log raft/);
assert.match(QUEST_GUIDES.waterfall_quest.resolve(context(2, [], 2512, 3470)).text, /rope on the dead tree/);
const tomb = context(4, [], 2530, 9844); tomb.varbit = () => 1;
assert.match(QUEST_GUIDES.waterfall_quest.resolve(tomb).text, /Search the chest/);
assert.match(QUEST_GUIDES.waterfall_quest.resolve(context(8, [], 2565, 9906)).text, /each of the 6 pillars/);
assert.match(QUEST_GUIDES.waterfall_quest.resolve(context(8, [], 2604, 9911)).text, /DO NOT LEFT-CLICK.*urn/);

const require = createRequire(import.meta.url);
require.extensions[".css"] = () => {};
void (async () => {
    const { QuestHelperPlugin, validGuide } = await import("../game/plugins/questhelper/QuestHelperPlugin");
    for (const quest of catalog) assert.equal(validGuide(loadGuide(quest.key), quest.source), true, quest.key);
    assert.equal(validGuide(null, ""), false);
    assert.equal(validGuide({ source: "bad", steps: [] }, "expected"), false);
    assert.equal(validGuide({ source: "expected", steps: [{ text: "Step", target: { x: 1, y: 2, plane: 4 } }] }, "expected"), false);
    assert.equal(QuestHelperPlugin.descriptor.enabledByDefault, false);
    const inventory = new Inventory(), equipment = new Inventory(14), bankInventory = new Inventory(1410);
    const groundItems = new GroundItemStore();
    const tileHighlightManager = new TileHighlightManager();
    const varps = new Map<number, number>(), varbits = new Map<number, number>();
    let loggedOut = true, scriptRuns = 0, loads = 0, dialogText = "", completedThroughSharedState = false;
    let playerX = 3200, playerY = 3200, playerPlane = 0;
    const pending = new Map<string, (guide: ImportedGuide) => void>();
    const vm = { context: { loadScript: () => ({}) }, intStack: [1], run: (_script: unknown, [questId]: number[]) => {
        scriptRuns++;
        const quest = catalog.find((row) => row.questId === questId)!;
        const stage = "varp" in quest ? varps.get(quest.varp!) ?? 0 : "varbit" in quest ? varbits.get(quest.varbit!) ?? 0 : 0;
        vm.intStack[0] = quest.key === "cooks_assistant" && (stage === 2 || completedThroughSharedState) ? 2 : stage === 0 ? 1 : 0;
    } };
    const client = { inventory, equipment, bankInventory, groundItems, tileHighlightManager, cs2Vm: vm,
        varManager: { getVarp: (id: number) => varps.get(id) ?? 0, getVarbit: (id: number) => varbits.get(id) ?? 0 },
        isLoggedIn: () => !loggedOut, controlledPlayerServerId: 1,
        playerEcs: { getIndexForServerId: () => 0, getX: () => playerX << 7, getY: () => playerY << 7, getLevel: () => playerPlane },
        widgetManager: { interfaceParents: new Map([[1, { group: InterfaceID.CHAT_RIGHT }]]),
            getWidgetsForGroup: () => [{ uid: 1, text: dialogText }], isEffectivelyHidden: () => false },
    };
    const plugin = new QuestHelperPlugin(client as any, (key) => { loads++; return new Promise((resolve) => pending.set(key, resolve)); });
    assert.equal(plugin.isEnabled(), false);
    plugin.onGameTick();
    assert.equal(scriptRuns, 0, "Disabled plugin does not query any quest");
    assert.equal(loads, 0, "Disabled plugin does not load guide data");
    plugin.setEnabledState(true);
    await plugin.start();
    assert.equal(plugin.getState().quests.length, 0);
    loggedOut = false;
    plugin.onGameTick();
    assert.equal(plugin.getState().quests.length, 213);
    const cookLoad = plugin.selectQuest("cooks_assistant");
    pending.get("cooks_assistant")!(loadGuide("cooks_assistant")); await cookLoad;
    assert.match(plugin.getState().step!.text, /Purchase a bucket/);
    inventory.setSlot(0, Item.BUCKET_EMPTY); inventory.setSlot(1, Item.POT_EMPTY);
    plugin.onGameTick();
    assert.equal(plugin.getTarget()?.x, 3177);
    assert.equal(tileHighlightManager.getRenderEntries().length, 0, "An ItemStep's navigation point is not a ground item");
    assert.equal(getSceneHintArrows().length, 0, "Do not draw an egg arrow on an empty tile");
    groundItems.update({ kind: "snapshot", stacks: [
        { id: 1, itemId: Item.EGG, quantity: 1, tile: { x: 3185, y: 3297, level: 0 } },
        { id: 2, itemId: Item.EGG, quantity: 1, tile: { x: 3175, y: 3305, level: 0 } },
        { id: 3, itemId: Item.EGG, quantity: 1, tile: { x: 3177, y: 3296, level: 1 } },
        { id: 4, itemId: Item.SHEARS, quantity: 1, tile: { x: 3177, y: 3296, level: 0 } },
    ] });
    plugin.onGameTick();
    assert.deepEqual(getSceneHintArrows().map((arrow) => [arrow.x, arrow.y, arrow.plane]), [[3185, 3297, 0], [3175, 3305, 0]], "Point at every actual required item on the player's floor");
    assert.equal(tileHighlightManager.getRenderEntries().length, 2);
    assert.equal(plugin.getTarget()?.x, 3177, "Keep upstream minimap/world-map navigation separate from scene items");
    groundItems.update({ kind: "delta", removes: [1], upserts: [] }); plugin.onGameTick();
    assert.equal(getSceneHintArrows().length, 1, "Despawned items lose their arrows");
    groundItems.clear(); plugin.onGameTick();
    assert.equal(getSceneHintArrows().length, 0);
    inventory.setSlot(2, Item.EGG); inventory.setSlot(3, Item.GRAIN);
    playerX = 3166; playerY = 3308; playerPlane = 1; plugin.onGameTick();
    assert.equal(plugin.getTarget()?.plane, 1, "Read the synced player's first floor");
    playerPlane = 2; ClientState.plane = 0; plugin.onGameTick();
    assert.match(plugin.getState().step!.text, /Fill the hopper/, "Top-floor state must come from the player, not the unused global plane");
    assert.equal(plugin.getTarget()?.plane, 2);
    inventory.setSlot(3, -1, 0); plugin.onGameTick();
    assert.match(plugin.getState().step!.text, /Operate the hopper controls/, "After filling on the top floor, do not send the player back for wheat");
    playerX = 3200; playerY = 3200; playerPlane = 0;
    inventory.setSlot(2, Item.EGG); inventory.setSlot(3, Item.BUCKET_MILK); inventory.setSlot(4, Item.POT_FLOUR);
    plugin.onGameTick();
    assert.deepEqual(plugin.getState().counts, [1, 1, 1]);
    assert.equal(plugin.getTarget()?.x, 3206);
    completedThroughSharedState = true; plugin.onGameTick();
    assert.equal(plugin.getState().step?.text, "Quest complete!", "Cache script status can change through shared state without changing this quest's primary varp");
    completedThroughSharedState = false; plugin.onGameTick();
    dialogText = "<col=ff0000>Here's a fresh egg.</col>";
    plugin.onClientTick(); plugin.onGameTick();
    assert.equal(plugin.getState().step!.items!.some((item) => item.id === Item.EGG), false, "Observe mounted OSRS dialogue widgets for partial hand-ins");
    setHintArrowNpc(42); assert.equal(getActiveHintArrow(), hintArrow);
    assert.deepEqual(getSceneHintArrows(), [hintArrow], "Server hints suppress all quest scene arrows");
    clearHintArrow(); assert.equal(getActiveHintArrow(), questHintArrow);
    ClientState.inInstance = true; plugin.onGameTick(); assert.equal(plugin.getTarget(), undefined);
    assert.equal(getSceneHintArrows().length, 0);
    ClientState.inInstance = false;
    varps.set(29, 37); plugin.onGameTick();
    assert.equal(plugin.getState().step, undefined, "Unknown stage must not be translated or replaced by a journal");
    varps.set(29, 2); plugin.onGameTick();
    assert.equal(plugin.getState().step?.text, "Quest complete!");
    assert.equal(tileHighlightManager.getRenderEntries().length, 0);
    const old = plugin.selectQuest("waterfall_quest"), next = plugin.selectQuest("dragon_slayer_ii");
    pending.get("waterfall_quest")!(loadGuide("waterfall_quest")); await old;
    assert.equal(plugin.getState().guide, undefined, "Ignore a late guide load after switching quest");
    pending.get("dragon_slayer_ii")!(loadGuide("dragon_slayer_ii")); await next;
    assert.equal(plugin.getState().step, undefined, "Manual guides must not fabricate automatic progress");
    plugin.selectStep(0); assert.ok(plugin.getState().step);
    plugin.selectStep(-1); assert.equal(plugin.getState().manualStep, 0);
    plugin.stopQuest(); assert.equal(questHintArrow.type, 0);
    const afterStop = plugin.selectQuest("waterfall_quest");
    plugin.stopQuest(); pending.get("waterfall_quest")!(loadGuide("waterfall_quest")); await afterStop;
    assert.equal(plugin.getState().guide, undefined);
    const malformed = plugin.selectQuest("waterfall_quest");
    pending.get("waterfall_quest")!({ source: "bad", steps: [] }); await malformed;
    assert.equal(plugin.getState().error, "Invalid quest guide data.");
    loggedOut = true; plugin.onGameStateChanged(new GameStateChanged(GameState.LOGIN_SCREEN));
    assert.equal(plugin.getState().quests.length, 0);
    loggedOut = false; plugin.onGameTick();
    assert.equal(plugin.getState().quests.length, 213, "Recover the catalog after login without depending on a login event");
    const selected = plugin.selectQuest("waterfall_quest"); pending.get("waterfall_quest")!(loadGuide("waterfall_quest")); await selected;
    assert.ok(plugin.getTarget());
    plugin.setEnabledState(false); await plugin.stop();
    assert.equal(plugin.getTarget(), undefined);
    assert.equal(plugin.getState().guide, undefined, "Disabling releases selected guide data");
    assert.equal(tileHighlightManager.getRenderEntries().length, 0);
    assert.equal(questHintArrow.type, 0);
    assert.equal(getSceneHintArrows().length, 0);
    console.log("Upstream guide catalog, OSRS conditions, default-off behavior, lazy loading and lifecycle passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
