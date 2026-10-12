import { GameState } from "@runelite/api/GameState";
import { ConfigChanged, GameStateChanged } from "@runelite/api/events";
import { ConfigGroup, ConfigItem } from "@runelite/client/config/ConfigItem";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";
import { CLIENT_TOKEN, inject } from "@runelite/client/plugins/PluginInjector";
import { ClientToolbar } from "@runelite/client/ui/ClientToolbar";
import type { NavigationButton } from "@runelite/client/ui/NavigationButton";
import * as InterfaceID from "../../../runelite/api/gameval/InterfaceID";
import type { OsrsClient } from "../../OsrsClient";
import { ClientState } from "../../ClientState";
import { questHintArrow, questSceneHintArrows } from "../../HintArrow";
import { COOK_DIALOGS, QUEST_GUIDES } from "./guides";
import catalog from "./catalog.json";
import { createQuestHelperNavigationButton } from "./QuestHelperPanel";
import { requirementCount, type ImportedGuide, type ItemRequirement, type QuestCatalogEntry, type QuestContext, type QuestStep, type QuestSummary } from "./types";

const HIGHLIGHT_SLOT = 65000;
const QUEST_ARROW_HEIGHT = 15; // RuneLite's 30-unit offset, encoded as an OSRS height byte.
// RuneLite ScriptID.QUEST_STATUS_GET, also used by upstream QuestHelperQuest.getQuestState().
const QUEST_STATUS_GET = 4029;
export const QuestHelperConfig = ConfigGroup("questhelper", {
    showOverlay: ConfigItem({ name: "Show current step", description: "Show the active step over the game view.", default: true }),
    showTarget: ConfigItem({ name: "Highlight target", description: "Mark the target tile and show an arrow on the scene, minimap and world map.", default: true }),
    showCompletedQuests: ConfigItem({ name: "Show Completed Quests", description: "Include completed quests in the selected filters.", default: false }),
});

type HelperState = {
    quests: QuestSummary[];
    selectedKey?: string;
    quest?: QuestSummary;
    guide?: ImportedGuide;
    manualStep?: number;
    error?: string;
    step?: QuestStep;
    counts: number[];
    showOverlay: boolean;
    showCompletedQuests: boolean;
};

const validText = (text: unknown): text is string => typeof text === "string" && text.length > 0 && text.length <= 20000;
const validItem = (item: ItemRequirement): boolean => !!item && Number.isInteger(item.id) && item.id >= 0 &&
    validText(item.name) && Number.isInteger(item.amount) && item.amount > 0 &&
    (item.equipped === undefined || typeof item.equipped === "boolean") &&
    (!item.alternates || (Array.isArray(item.alternates) && item.alternates.length <= 1000 && item.alternates.every((id) => Number.isInteger(id) && id >= 0)));
const validRequirements = (items: unknown): boolean => Array.isArray(items) && items.length <= 100 && items.every((item) =>
    !!item && validText(item.name) && ("id" in item ? validItem(item) :
        Object.keys(item).every((key) => key === "name" || key === "amount") && (item.amount === undefined || (Number.isInteger(item.amount) && item.amount > 0))));

export function validGuide(value: unknown, source: string): value is ImportedGuide {
    const guide = value as ImportedGuide | null;
    return !!guide && guide.source === source && Array.isArray(guide.steps) && guide.steps.length > 0 && guide.steps.length <= 1000 &&
        guide.steps.every((step) => !!step && typeof step.text === "string" && step.text.length > 0 && step.text.length <= 20000 &&
            (step.type === undefined || step.type === "item") &&
            (!step.target || (Number.isInteger(step.target.x) && Number.isInteger(step.target.y) && Number.isInteger(step.target.plane) && step.target.plane >= 0 && step.target.plane <= 3)) &&
            (!step.choices || (Array.isArray(step.choices) && step.choices.length <= 100 && step.choices.every((text) => typeof text === "string" && text.length <= 2000))) &&
            (!step.items || (Array.isArray(step.items) && step.items.length <= 100 && step.items.every(validItem)))) &&
        (!guide.panels || (Array.isArray(guide.panels) && guide.panels.length <= 200 && guide.panels.every((panel) =>
            !!panel && validText(panel.header) && Array.isArray(panel.steps) && panel.steps.length <= 1000 &&
            panel.steps.every((index) => Number.isInteger(index) && index >= 0 && index < guide.steps.length) &&
            (!panel.substeps || (Array.isArray(panel.substeps) && panel.substeps.length <= 1000 && panel.substeps.every((index) => Number.isInteger(index) && index >= 0 && index < guide.steps.length))) &&
            (!panel.items || validRequirements(panel.items)) && (!panel.recommended || validRequirements(panel.recommended))))) &&
        (!guide.overview || (validRequirements(guide.overview.required) && validRequirements(guide.overview.recommended) &&
            [guide.overview.general, guide.overview.generalRecommended, guide.overview.combat, guide.overview.notes, guide.overview.rewards]
                .every((lines) => Array.isArray(lines) && lines.length <= 200 && lines.every(validText))));
}

export class QuestHelperPlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "Quest Helper",
        description: "Upstream OSRS quest guides, item checks and target markers.",
        tags: ["quest", "guide", "overlay"],
        enabledByDefault: false,
        configKey: "questhelperplugin",
    };
    static config = QuestHelperConfig;
    private readonly toolbar = inject(ClientToolbar);
    private readonly configManager = inject(ConfigManager);
    private readonly config = this.configManager.getConfig(QuestHelperConfig);
    private readonly listeners = new Set<() => void>();
    private readonly dialogs = new Set<string>();
    private nav?: NavigationButton;
    private state: HelperState = { quests: [], counts: [], showOverlay: true, showCompletedQuests: false };
    private signature = "";
    private targetCoords = "";
    private selectionVersion = 0;

    constructor(
        private readonly client: OsrsClient = inject<OsrsClient>(CLIENT_TOKEN),
        private readonly loadGuide: (key: string) => Promise<ImportedGuide> = async (key) => {
            const response = await fetch(`${process.env.PUBLIC_URL ?? ""}/quest-helper/${key}.json`);
            if (!response.ok) throw new Error(`Could not load guide (${response.status}).`);
            return response.json();
        },
    ) { super(); }

    protected async startUp(): Promise<void> {
        this.nav = createQuestHelperNavigationButton(this);
        this.toolbar.addNavigation(this.nav);
        this.refresh();
    }

    protected async shutDown(): Promise<void> {
        if (this.nav) this.toolbar.removeNavigation(this.nav);
        this.nav = undefined;
        this.clearSelection();
        this.state = { ...this.state, quests: [] };
        this.refresh();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    getState(): HelperState { return this.state; }
    getConfigManager(): ConfigManager { return this.configManager; }
    getItemCount(item: ItemRequirement): number { return requirementCount(item, this.getContext(0)); }
    getBankCount(item: ItemRequirement): number {
        const context = this.getContext(0);
        return [item.id, ...(item.alternates ?? [])].reduce((count, id) => count + context.bankCount(id), 0);
    }
    getTarget(): QuestStep["target"] {
        // shortcut: targets use world tiles; map instance templates before enabling instance markers.
        return this.isEnabled() && this.isStarted() && this.config.showTarget() && !ClientState.inInstance ? this.state.step?.target : undefined;
    }

    async selectQuest(key: string): Promise<void> {
        if (!this.isEnabled() || !this.isStarted() || !this.client.isLoggedIn() || !catalog.some((quest) => quest.key === key)) return;
        const version = ++this.selectionVersion;
        this.dialogs.clear();
        this.state = { ...this.state, selectedKey: key, quest: undefined, guide: undefined, manualStep: undefined, error: undefined, step: undefined };
        this.refresh();
        try {
            const guide = await this.loadGuide(key);
            if (version !== this.selectionVersion) return;
            if (!validGuide(guide, catalog.find((quest) => quest.key === key)!.source)) throw new Error("Invalid quest guide data.");
            this.state = { ...this.state, guide };
        } catch (error) {
            if (version !== this.selectionVersion) return;
            this.state = { ...this.state, error: error instanceof Error ? error.message : "Could not load guide." };
        }
        this.refresh();
    }

    selectStep(index: number | undefined): void {
        if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= (this.state.guide?.steps.length ?? 0))) return;
        this.state = { ...this.state, manualStep: index };
        this.refresh();
    }

    stopQuest(): void { this.clearSelection(); }
    onGameTick(): void { if (this.isEnabled() && this.isStarted()) this.refresh(); }
    onClientTick(): void {
        if (!this.isEnabled() || this.state.selectedKey !== "cooks_assistant") return;
        const manager = this.client.widgetManager;
        for (const { group } of manager.interfaceParents.values()) {
            if (group !== InterfaceID.CHAT_LEFT && group !== InterfaceID.CHAT_RIGHT) continue;
            for (const widget of manager.getWidgetsForGroup(group)) {
                if (manager.isEffectivelyHidden(widget.uid) || !widget.text) continue;
                const text = widget.text.replace(/<[^>]*>/g, "");
                for (const dialog of Object.values(COOK_DIALOGS)) if (text.includes(dialog)) this.dialogs.add(dialog);
            }
        }
    }
    onConfigChanged(event: ConfigChanged): void {
        if (event.getGroup() === QuestHelperConfig.group) this.refresh();
    }
    onGameStateChanged(event: GameStateChanged): void {
        if ([GameState.LOGIN_SCREEN, GameState.CONNECTION_LOST, GameState.HOPPING].includes(event.getGameState())) {
            this.clearSelection();
            this.state = { quests: [], counts: [], showOverlay: this.config.showOverlay(), showCompletedQuests: this.config.showCompletedQuests() };
            this.refresh();
        } else if (event.getGameState() === GameState.LOGGED_IN) {
            this.refresh();
        }
    }

    private stage(quest: QuestCatalogEntry): number {
        return quest.varp !== undefined ? this.client.varManager.getVarp(quest.varp)
            : quest.varbit !== undefined ? this.client.varManager.getVarbit(quest.varbit) : -1;
    }

    private status(quest: QuestCatalogEntry): 0 | 1 | 2 {
        // Status can depend on several vars, including both Shield of Arrav routes.
        const stage = this.stage(quest);
        const vm = this.client.cs2Vm;
        const script = quest.questId === undefined ? undefined : vm.context.loadScript(QUEST_STATUS_GET);
        if (!script) return quest.completeValue !== undefined && stage === quest.completeValue ? 2 : stage === 0 ? 1 : 0;
        vm.run(script, [quest.questId!]);
        return vm.intStack[0] === 2 ? 2 : vm.intStack[0] === 1 ? 1 : 0;
    }

    private getContext(stage: number): QuestContext {
        const inventory = this.client.inventory.getSlots();
        const equipment = this.client.equipment.getSlots();
        const bank = this.client.bankInventory.getSlots();
        const player = this.client.playerEcs.getIndexForServerId(this.client.controlledPlayerServerId);
        const count = (slots: typeof inventory, id: number) => slots.reduce((total, slot) => total + (slot.itemId === id ? slot.quantity : 0), 0);
        return {
            stage,
            count: (id) => count(inventory, id) + count(equipment, id),
            bankCount: (id) => count(bank, id),
            equipped: (id) => equipment.some((slot) => slot.itemId === id && slot.quantity > 0),
            varbit: (id) => this.client.varManager.getVarbit(id),
            seenDialog: (text) => this.dialogs.has(text),
            hasNpc: (id) => {
                let found = false;
                this.client.npcEcs.forEachActive((index) => {
                    const npc = this.client.npcTypeLoader.load(this.client.npcEcs.getNpcTypeId(index));
                    if ((npc.transform(this.client.varManager, this.client.npcTypeLoader) ?? npc).id === id) found = true;
                });
                return found;
            },
            hasObject: (id, target) => {
                const map = this.client.renderer.mapManager.getMapForWorldTile(target.x, target.y) as
                    { getLocIdsAtLocal?(plane: number, x: number, y: number): number[]; getRenderBaseTileX?(): number; getRenderBaseTileY?(): number } | undefined;
                return map?.getLocIdsAtLocal?.(target.plane, target.x - (map.getRenderBaseTileX?.() ?? (target.x & ~63)), target.y - (map.getRenderBaseTileY?.() ?? (target.y & ~63))).some((locId) => {
                    const loc = this.client.locTypeLoader.load(locId);
                    return (loc.transform(this.client.varManager, this.client.locTypeLoader) ?? loc).id === id;
                }) ?? false;
            },
            inventoryFull: inventory.filter((slot) => slot.itemId >= 0 && slot.quantity > 0).length === 28,
            position: {
                x: player === undefined ? 0 : this.client.playerEcs.getX(player) >> 7,
                y: player === undefined ? 0 : this.client.playerEcs.getY(player) >> 7,
                plane: player === undefined ? 0 : this.client.playerEcs.getLevel(player),
            },
        };
    }

    private clearSelection(): void {
        ++this.selectionVersion;
        this.dialogs.clear();
        this.state = { ...this.state, selectedKey: undefined, quest: undefined, guide: undefined, manualStep: undefined, error: undefined, step: undefined, counts: [] };
        this.refresh();
    }

    private refresh(): void {
        const active = this.isEnabled() && this.isStarted() && this.client.isLoggedIn();
        const quests = active ? catalog.map((quest) => ({ key: quest.key, name: quest.name, status: this.status(quest) })) : [];
        const selected = catalog.find((quest) => quest.key === this.state.selectedKey);
        const quest = quests.find((quest) => quest.key === this.state.selectedKey);
        const context = active && selected ? this.getContext(this.stage(selected)) : undefined;
        const resolver = selected ? QUEST_GUIDES[selected.key] : undefined;
        const step = context && quest && this.state.guide
            ? quest.status === 2 ? { text: "Quest complete!" }
                : this.state.manualStep !== undefined ? this.state.guide.steps[this.state.manualStep]
                    : resolver?.stages.includes(context.stage) ? resolver.resolve(context) : undefined
            : undefined;
        const counts = (step?.items ?? []).map((item) => requirementCount(item, context!));
        this.state = { ...this.state, quests, quest, step, counts, showOverlay: this.config.showOverlay(), showCompletedQuests: this.config.showCompletedQuests() };
        const target = this.getTarget();
        questHintArrow.type = target ? 2 : 0;
        if (target) Object.assign(questHintArrow, { ...target, height: QUEST_ARROW_HEIGHT, position: 2 });
        const sceneTargets = active && this.config.showTarget() && !ClientState.inInstance && step?.type === "item"
            ? this.client.groundItems.getAllStacks()
                .filter((stack) => stack.tile.level === context!.position.plane && step.items?.some((item) => item.id === stack.itemId || item.alternates?.includes(stack.itemId)))
                .map((stack) => ({ x: stack.tile.x, y: stack.tile.y, plane: stack.tile.level }))
            : target ? [target] : [];
        const tiles = new Map(sceneTargets.map((tile) => [(tile.plane << 28) | (tile.x << 14) | tile.y, tile]));
        questSceneHintArrows.length = 0;
        for (const tile of tiles.values()) questSceneHintArrows.push({ ...questHintArrow, ...tile, type: 2, height: QUEST_ARROW_HEIGHT });
        const targetCoords = [...tiles.keys()].join(",");
        if (targetCoords !== this.targetCoords) {
            this.client.tileHighlightManager.clear(HIGHLIGHT_SLOT);
            if (tiles.size) {
                this.client.tileHighlightManager.configure(HIGHLIGHT_SLOT, 0x00ffff, 2, 35, 0x10);
                for (const coord of tiles.keys()) this.client.tileHighlightManager.set(coord, HIGHLIGHT_SLOT, 0);
            }
            this.targetCoords = targetCoords;
        }
        const signature = JSON.stringify(this.state);
        if (signature === this.signature) return;
        this.signature = signature;
        for (const listener of this.listeners) listener();
    }
}
