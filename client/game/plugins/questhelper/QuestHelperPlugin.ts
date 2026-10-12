import { GameState } from "@runelite/api/GameState";
import { ConfigChanged, GameStateChanged } from "@runelite/api/events";
import { ConfigGroup, ConfigItem } from "@runelite/client/config/ConfigItem";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";
import { CLIENT_TOKEN, inject } from "@runelite/client/plugins/PluginInjector";
import { ClientToolbar } from "@runelite/client/ui/ClientToolbar";
import type { NavigationButton } from "@runelite/client/ui/NavigationButton";
import type { OsrsClient } from "../../OsrsClient";
import { ClientState } from "../../ClientState";
import { questHintArrow } from "../../HintArrow";
import { sendChat } from "../../../network/ServerConnection";
import { QUEST_GUIDES } from "./guides";
import { createQuestHelperNavigationButton } from "./QuestHelperPanel";
import { currentJournal, type QuestContext, type QuestSnapshot, type QuestStep, type QuestSummary } from "./types";

const HIGHLIGHT_SLOT = 65000;
export const QuestHelperConfig = ConfigGroup("questhelper", {
    showOverlay: ConfigItem({ name: "Show current step", description: "Show the active step over the game view.", default: true }),
    showTarget: ConfigItem({ name: "Highlight target", description: "Mark the target tile and show an arrow on the scene, minimap and world map.", default: true }),
});

type HelperState = {
    quests: QuestSummary[];
    selectedKey?: string;
    quest?: QuestSnapshot;
    step?: QuestStep;
    counts: number[];
    showOverlay: boolean;
};

function validSummary(value: unknown): value is QuestSummary {
    const row = value as QuestSummary | null;
    return !!row && typeof row.key === "string" && /^[a-z0-9_]{1,100}$/.test(row.key) &&
        typeof row.name === "string" && row.name.length <= 200 && [0, 1, 2].includes(row.status);
}

export function validSnapshot(value: unknown): value is QuestSnapshot {
    const row = value as QuestSnapshot | null;
    return validSummary(row) && Number.isInteger(row?.stage) && row!.stage >= 0 &&
        Array.isArray(row?.journal) && row.journal.length <= 200 &&
        row.journal.every((line) => typeof line === "string" && line.length <= 4000) &&
        !!row.facts && typeof row.facts === "object" &&
        (row.facts.flour === undefined || (Number.isFinite(row.facts.flour) && row.facts.flour >= 0)) &&
        (row.facts.hopper === undefined || typeof row.facts.hopper === "boolean");
}

export class QuestHelperPlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "Quest Helper",
        description: "Live TSPS quest journals, with adapted RuneLite step guides, item checks and target markers.",
        tags: ["quest", "guide", "overlay"],
        configKey: "questhelperplugin",
    };
    static config = QuestHelperConfig;
    private readonly toolbar = inject(ClientToolbar);
    private readonly config = inject(ConfigManager).getConfig(QuestHelperConfig);
    private readonly listeners = new Set<() => void>();
    private nav?: NavigationButton;
    private state: HelperState = { quests: [], counts: [], showOverlay: true };
    private signature = "";
    private targetCoord: number | undefined;

    constructor(
        private readonly client: OsrsClient = inject<OsrsClient>(CLIENT_TOKEN),
        private readonly command: (text: string) => void = (text) => sendChat(`::questhelper ${text}`),
    ) { super(); }

    protected async startUp(): Promise<void> {
        this.nav = createQuestHelperNavigationButton(this);
        this.toolbar.addNavigation(this.nav);
        if (!this.client.isOnLoginScreen()) this.command("list");
        this.refresh();
    }

    protected async shutDown(): Promise<void> {
        if (this.nav) this.toolbar.removeNavigation(this.nav);
        this.nav = undefined;
        if (!this.client.isOnLoginScreen()) this.command("stop");
        this.clearSelection();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    getState(): HelperState { return this.state; }
    getTarget(): QuestStep["target"] {
        // shortcut: targets use world tiles; map instance templates before enabling instance markers.
        return this.isEnabled() && this.config.showTarget() && !ClientState.inInstance ? this.state.step?.target : undefined;
    }

    selectQuest(key: string): void {
        if (!this.isEnabled() || this.client.isOnLoginScreen() || !this.state.quests.some((quest) => quest.key === key)) return;
        this.state = { ...this.state, selectedKey: key, quest: undefined, step: undefined };
        this.command(key);
        this.refresh();
    }

    stopQuest(): void {
        if (!this.client.isOnLoginScreen()) this.command("stop");
        this.clearSelection();
    }

    receive(rows: unknown[]): void {
        for (const value of rows) {
            const row = value as { kind?: string; quests?: unknown[] };
            if (row?.kind === "catalog" && Array.isArray(row.quests) && row.quests.length <= 500) {
                this.state = { ...this.state, quests: row.quests.filter(validSummary) };
                if (this.state.selectedKey && !this.state.quests.some((quest) => quest.key === this.state.selectedKey)) this.clearSelection();
            } else if (row?.kind === "quest" && validSnapshot(row) && this.isEnabled() && row.key === this.state.selectedKey) {
                this.state = { ...this.state, quest: row };
            } else if (row?.kind === "stop" && !this.state.selectedKey) {
                this.clearSelection();
            }
        }
        this.refresh();
    }

    onGameTick(): void { if (this.state.quest) this.refresh(); }
    onConfigChanged(event: ConfigChanged): void {
        if (event.getGroup() === QuestHelperConfig.group) this.refresh();
    }
    onGameStateChanged(event: GameStateChanged): void {
        if ([GameState.LOGIN_SCREEN, GameState.CONNECTION_LOST, GameState.HOPPING].includes(event.getGameState())) {
            this.state = { quests: [], counts: [], showOverlay: this.config.showOverlay() };
            this.refresh();
        } else if (event.getGameState() === GameState.LOGGED_IN) {
            this.command("list");
        }
    }

    private getContext(quest: QuestSnapshot): QuestContext {
        const inventory = this.client.inventory.getSlots();
        const equipment = this.client.equipment.getSlots();
        const player = this.client.playerEcs.getIndexForServerId(this.client.controlledPlayerServerId);
        return {
            quest,
            count: (id) => inventory.reduce((total, slot) => total + (slot.itemId === id ? slot.quantity : 0), 0),
            equipped: (id) => equipment.some((slot) => slot.itemId === id && slot.quantity > 0),
            position: {
                x: player === undefined ? 0 : this.client.playerEcs.getX(player) >> 7,
                y: player === undefined ? 0 : this.client.playerEcs.getY(player) >> 7,
                plane: ClientState.plane,
            },
        };
    }

    private clearSelection(): void {
        this.state = { ...this.state, selectedKey: undefined, quest: undefined, step: undefined, counts: [] };
        this.refresh();
    }

    private refresh(): void {
        const quest = this.state.quest;
        const context = quest ? this.getContext(quest) : undefined;
        const step = context && this.isEnabled() && !this.client.isOnLoginScreen()
            ? quest!.status === 2 ? { text: "Quest complete!" }
                : QUEST_GUIDES[quest!.key]?.resolve(context) ?? { text: currentJournal(quest!) || "No guidance in this quest's journal yet." }
            : undefined;
        const counts = (step?.items ?? []).map((item) => item.equipped ? (context!.equipped(item.id) ? 1 : 0) : context!.count(item.id));
        this.state = { ...this.state, step, counts, showOverlay: this.config.showOverlay() };
        const target = this.getTarget();
        questHintArrow.type = target ? 2 : 0;
        if (target) {
            Object.assign(questHintArrow, { ...target, height: 60, position: 2 });
        }
        const coord = target ? (target.plane << 28) | (target.x << 14) | target.y : undefined;
        if (coord !== this.targetCoord) {
            this.client.tileHighlightManager.clear(HIGHLIGHT_SLOT);
            if (coord !== undefined) {
                this.client.tileHighlightManager.configure(HIGHLIGHT_SLOT, 0x00ffff, 2, 35, 0x10);
                this.client.tileHighlightManager.set(coord, HIGHLIGHT_SLOT, 0);
            }
            this.targetCoord = coord;
        }
        const signature = JSON.stringify(this.state);
        if (signature === this.signature) return;
        this.signature = signature;
        for (const listener of this.listeners) listener();
    }
}
