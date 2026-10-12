import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { QUEST_GUIDES } from "../game/plugins/questhelper/guides";
import { currentJournal, journalText, requirementMet, type QuestContext, type QuestSnapshot } from "../game/plugins/questhelper/types";
import * as Item from "../runelite/api/gameval/ItemID";
import { Inventory } from "../rs/inventory/Inventory";
import { TileHighlightManager } from "../game/highlights/TileHighlightManager";
import { clearHintArrow, getActiveHintArrow, hintArrow, questHintArrow, setHintArrowNpc } from "../game/HintArrow";
import { GameState } from "../runelite/api/GameState";
import { GameStateChanged } from "../runelite/api/events";
import { ClientState } from "../game/ClientState";

function context(key: string, stage: number, items: Array<[number, number]> = [], plane = 0): QuestContext {
    const counts = new Map(items);
    return {
        quest: { key, name: key, stage, status: stage ? 0 : 1, journal: [], facts: {} },
        count: (id) => counts.get(id) ?? 0,
        equipped: () => false,
        position: { x: 3200, y: 3200, plane },
    };
}

assert.equal(Object.keys(QUEST_GUIDES).length, 9);
for (const [key, guide] of Object.entries(QUEST_GUIDES)) {
    assert.ok(guide.steps.length);
    for (let stage = 0; stage < (key === "dorics_quest" ? 100 : key === "sheep_shearer" ? 21 : 10); stage++) {
        const result = guide.resolve(context(key, stage));
        assert.ok(result.text, `${key}/${stage} needs guidance`);
        assert.ok(!result.target || (Number.isInteger(result.target.x) && Number.isInteger(result.target.y) && result.target.plane >= 0 && result.target.plane <= 3));
        for (const requirement of result.items ?? []) {
            assert.ok(Number.isInteger(requirement.id) && requirement.amount > 0, `${key}: valid item requirement`);
        }
    }
}

const cook = context("cooks_assistant", 1, [[Item.EGG, 1], [Item.POT_EMPTY, 1], [Item.BUCKET_MILK, 1]]);
cook.quest.facts.hopper = true;
assert.match(QUEST_GUIDES.cooks_assistant.resolve(cook).text, /controls/);
cook.quest.facts.flour = 1;
assert.match(QUEST_GUIDES.cooks_assistant.resolve(cook).text, /flour bin/);
assert.match(QUEST_GUIDES.cooks_assistant.resolve(context("cooks_assistant", 1)).text, /Pick up an egg/);
assert.match(QUEST_GUIDES.cooks_assistant.resolve(context("cooks_assistant", 1, [[Item.EGG, 1], [Item.BUCKET_EMPTY, 1], [Item.POT_EMPTY, 1], [Item.GRAIN, 1]], 2)).text, /Select Fill/);
assert.equal(QUEST_GUIDES.cooks_assistant.resolve(context("cooks_assistant", 1, [[Item.EGG, 1], [Item.POT_FLOUR, 1], [Item.BUCKET_MILK, 1]])).items?.length, 3);

const wool = QUEST_GUIDES.sheep_shearer.resolve(context("sheep_shearer", 11, [[Item.BALL_OF_WOOL, 10]]));
assert.equal(wool.items?.[0].amount, 10, "ten wool were already handed in");
assert.match(QUEST_GUIDES.sheep_shearer.resolve(context("sheep_shearer", 20, [[Item.WOOL, 1]], 1)).text, /Spin/);
assert.deepEqual(QUEST_GUIDES.dorics_quest.resolve(context("dorics_quest", 10)).items?.map((item) => item.amount), [6, 4, 2]);
assert.equal(QUEST_GUIDES.rune_mysteries.resolve(context("rune_mysteries", 3)).items?.[0].id, Item.RESEARCH_PACKAGE);
assert.equal(QUEST_GUIDES.waterfall_quest.resolve(context("waterfall_quest", 5)).items?.length, 2);
assert.deepEqual(QUEST_GUIDES.waterfall_quest.resolve(context("waterfall_quest", 8)).items?.map((item) => item.amount), [6, 6, 6]);
const ghost = context("the_restless_ghost", 2, [[Item.AMULET_OF_GHOSTSPEAK, 1]]);
const amulet = QUEST_GUIDES.the_restless_ghost.resolve(ghost).items![0];
assert.equal(requirementMet(amulet, ghost), false, "carrying the amulet is insufficient");
ghost.equipped = () => true;
assert.equal(requirementMet(amulet, ghost), true);
assert.equal(journalText("<col=ff0000>Hello</col><br>world"), "Hello world");
assert.equal(currentJournal({ ...cook.quest, journal: ["<str>Old step</str>", "", "<col=ff0000>New step</col>"] }), "New step");

// The plugin panel imports CSS; Node has no style renderer.
const require = createRequire(import.meta.url);
require.extensions[".css"] = () => {};
void (async () => {
    const { QuestHelperPlugin, validSnapshot } = await import("../game/plugins/questhelper/QuestHelperPlugin");
    const commands: string[] = [];
    const inventory = new Inventory();
    const equipment = new Inventory(14);
    const tileHighlightManager = new TileHighlightManager();
    let loggedOut = false;
    const client = {
        inventory, equipment, tileHighlightManager,
        isOnLoginScreen: () => loggedOut,
        controlledPlayerServerId: 1,
        playerEcs: { getIndexForServerId: () => 0, getX: () => 3200 << 7, getY: () => 3200 << 7 },
    };
    const plugin = new QuestHelperPlugin(client as any, (text) => commands.push(text));
    await plugin.start();
    plugin.receive([{ kind: "catalog", quests: [{ key: "cooks_assistant", name: "Cook's Assistant", status: 1 }, { key: "waterfall_quest", name: "Waterfall Quest", status: 1 }] }]);
    plugin.selectQuest("cooks_assistant");
    plugin.receive([{ kind: "quest", ...context("cooks_assistant", 1).quest }]);
    assert.equal(plugin.getTarget()?.x, 3185);
    assert.equal(tileHighlightManager.getRenderEntries().length, 1);
    inventory.setSlot(0, Item.EGG);
    plugin.onGameTick();
    assert.match(plugin.getState().step!.text, /bucket/);
    inventory.setSlot(1, Item.BUCKET_MILK);
    inventory.setSlot(2, Item.POT_FLOUR);
    plugin.onGameTick();
    assert.deepEqual(plugin.getState().counts, [1, 1, 1]);
    assert.equal(plugin.getTarget()?.x, 3209);
    setHintArrowNpc(42);
    assert.equal(getActiveHintArrow(), hintArrow, "server arrows take precedence");
    clearHintArrow();
    assert.equal(getActiveHintArrow(), questHintArrow);
    ClientState.inInstance = true;
    plugin.onGameTick();
    assert.equal(plugin.getTarget(), undefined, "world coordinates must not mark an unrelated instance tile");
    ClientState.inInstance = false;
    plugin.selectQuest("waterfall_quest");
    plugin.receive([{ kind: "quest", ...context("cooks_assistant", 1).quest }]);
    assert.equal(plugin.getState().quest, undefined, "ignore a late response for the previous quest");
    plugin.receive([{ kind: "quest", ...context("waterfall_quest", 8).quest }]);
    assert.ok(plugin.getTarget());
    plugin.receive([{ kind: "quest", ...context("waterfall_quest", 10).quest, status: 2 }]);
    assert.equal(plugin.getState().step!.text, "Quest complete!");
    assert.equal(plugin.getTarget(), undefined);
    assert.equal(tileHighlightManager.getRenderEntries().length, 0);
    assert.equal(validSnapshot(null), false);
    assert.equal(validSnapshot({ ...cook.quest, journal: [42] }), false);
    assert.equal(validSnapshot({ ...cook.quest, stage: -1 }), false);
    assert.equal(validSnapshot({ ...cook.quest, key: "bad; command" }), false);
    loggedOut = true;
    plugin.onGameStateChanged(new GameStateChanged(GameState.LOGIN_SCREEN));
    assert.equal(plugin.getState().quests.length, 0);
    assert.equal(plugin.getState().selectedKey, undefined);
    assert.equal(questHintArrow.type, 0);
    loggedOut = false;
    plugin.receive([{ kind: "catalog", quests: [{ key: "cooks_assistant", name: "Cook's Assistant", status: 0 }] }]);
    plugin.selectQuest("cooks_assistant");
    plugin.receive([{ kind: "quest", ...context("cooks_assistant", 1).quest }]);
    assert.ok(plugin.getTarget());
    plugin.setEnabledState(false);
    await plugin.stop();
    assert.equal(plugin.getTarget(), undefined);
    assert.equal(tileHighlightManager.getRenderEntries().length, 0);
    assert.equal(questHintArrow.type, 0);
    assert.ok(commands.includes("cooks_assistant") && commands.includes("waterfall_quest"));
    console.log("Quest Helper guides, item checks, markers and lifecycle passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
