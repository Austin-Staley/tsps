import { useCallback, useState, useSyncExternalStore } from "react";
import { NavigationButton } from "@runelite/client/ui/NavigationButton";
import type { QuestHelperPlugin } from "./QuestHelperPlugin";
import { QUEST_GUIDES } from "./guides";
import { journalText } from "./types";
import "./QuestHelper.css";

export function useQuestHelper(plugin: QuestHelperPlugin) {
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const snapshot = useCallback(() => plugin.getState(), [plugin]);
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function QuestHelperPanel({ plugin }: { plugin: QuestHelperPlugin }): JSX.Element {
    const state = useQuestHelper(plugin);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("unfinished");
    const guide = state.quest ? QUEST_GUIDES[state.quest.key] : undefined;
    return <div className="rl-sidebar-panel-content quest-helper-panel">
        <h2>Quest Helper</h2>
        {state.selectedKey ? <>
            <button onClick={() => plugin.stopQuest()}>Stop helper / Quest list</button>
            <h3>{state.quest?.name ?? "Loading quest…"}</h3>
            {state.step && <p className="quest-helper-current" aria-live="polite">{state.step.text}</p>}
            {state.step?.target && <p>Target: {state.step.target.x}, {state.step.target.y}, floor {state.step.target.plane}</p>}
            {state.step?.items && <><h3>Items for this step</h3><ul>{state.step.items.map((item, index) =>
                <li key={item.id} className={state.counts[index] >= item.amount ? "quest-helper-met" : "quest-helper-missing"}>
                    {state.counts[index] >= item.amount ? "✓" : "○"} {item.name}: {state.counts[index]}/{item.amount}{item.equipped ? " equipped" : ""}
                </li>)}</ul></>}
            {state.step?.choices && <p>Dialogue: {state.step.choices.join(" → ")}</p>}
            {guide ? <><p className="quest-helper-note">{guide.note}</p><details><summary>All steps</summary><ol>{guide.steps.map((text) => <li key={text}>{text}</li>)}</ol></details></>
                : state.quest && <p className="quest-helper-note">Live TSPS journal. This quest still needs an adapted step guide and target markers.</p>}
            {state.quest && <details open={!guide}><summary>Live quest journal</summary>{state.quest.journal.map((line, index) =>
                <p key={index} className={line.includes("<str>") ? "quest-helper-done" : undefined}>{journalText(line) || "\u00a0"}</p>)}</details>}
        </> : <>
            <input aria-label="Search quests" placeholder="Search quests…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter quests" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="unfinished">Unfinished</option><option value="started">In progress</option><option value="all">All quests</option>
            </select>
            {state.quests.length === 0 && <p>Log in to see this world's available quests.</p>}
            <ul className="quest-helper-list">{state.quests.filter((quest) => quest.name.toLowerCase().includes(search.toLowerCase()) &&
                (filter === "all" || (filter === "started" ? quest.status === 0 : quest.status !== 2))).map((quest) =>
                <li key={quest.key}><button onClick={() => plugin.selectQuest(quest.key)}>
                    <span>{quest.status === 2 ? "✓ " : quest.status === 0 ? "◐ " : "○ "}{quest.name}</span>
                    <small>{QUEST_GUIDES[quest.key] ? "Step guide" : "Live journal"}</small>
                </button></li>)}</ul>
        </>}
    </div>;
}

export function QuestHelperOverlay({ plugin }: { plugin: QuestHelperPlugin }): JSX.Element | null {
    const state = useQuestHelper(plugin);
    if (!plugin.isEnabled() || !state.showOverlay || !state.step) return null;
    return <div className="quest-helper-overlay"><strong>{state.quest?.name}</strong><p>{state.step.text}</p></div>;
}

export function createQuestHelperNavigationButton(plugin: QuestHelperPlugin): NavigationButton {
    return NavigationButton.builder().tooltip("Quest Helper").priority(4)
        .icon(({ label }) => <svg className="rl-sidebar-icon-svg" viewBox="0 0 24 24" role="img" aria-label={label}>
            <path d="M7 3h10v18H7zM10 7h4M10 11h4M10 15h4M4 5h3M17 19h3" />
        </svg>)
        .panel(() => <QuestHelperPanel plugin={plugin} />).build();
}
