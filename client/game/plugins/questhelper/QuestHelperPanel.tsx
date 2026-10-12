import { useCallback, useState, useSyncExternalStore } from "react";
import { NavigationButton } from "@runelite/client/ui/NavigationButton";
import type { QuestHelperPlugin } from "./QuestHelperPlugin";
import { QUEST_GUIDES } from "./guides";
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
    const automatic = state.selectedKey ? !!QUEST_GUIDES[state.selectedKey] : false;
    return <div className="rl-sidebar-panel-content quest-helper-panel">
        <h2>Quest Helper</h2>
        {state.selectedKey ? <>
            <button onClick={() => plugin.stopQuest()}>Stop helper / Quest list</button>
            <h3>{state.quest?.name ?? "Loading quest…"}</h3>
            {state.error && <p role="alert">{state.error}</p>}
            {!state.guide && !state.error && <p>Loading guide…</p>}
            {state.guide && !state.step && <p>{automatic ? "No upstream step matches the current quest state." : "Select a step below to follow this guide."}</p>}
            {state.manualStep !== undefined && automatic && <button onClick={() => plugin.selectStep(undefined)}>Resume automatic steps</button>}
            {state.step && <p className="quest-helper-current" aria-live="polite">{state.step.text}</p>}
            {state.step?.target && <p>Target: {state.step.target.x}, {state.step.target.y}, floor {state.step.target.plane}</p>}
            {state.step?.items && <><h3>Items for this step</h3><ul>{state.step.items.map((item, index) =>
                <li key={item.id} className={state.counts[index] >= item.amount ? "quest-helper-met" : "quest-helper-missing"}>
                    {state.counts[index] >= item.amount ? "✓" : "○"} {item.name}: {state.counts[index]}/{item.amount}{item.equipped ? " equipped" : ""}
                </li>)}</ul></>}
            {state.step?.choices && <p>Dialogue: {state.step.choices.join(" → ")}</p>}
            {state.guide && <><p><a href={state.guide.source} target="_blank" rel="noreferrer">RuneLite guide source</a></p>
                <details open={!automatic}><summary>All upstream steps</summary><ol>{state.guide.steps.map((step, index) =>
                    <li key={index}><button aria-pressed={state.manualStep === index} onClick={() => plugin.selectStep(index)}>{step.text}</button></li>)}</ol></details></>}
        </> : <>
            <input aria-label="Search quests" placeholder="Search quests…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter quests" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="unfinished">Unfinished</option><option value="started">In progress</option><option value="all">All quests</option>
            </select>
            {state.quests.length === 0 && <p>Log in to see the OSRS quest guides.</p>}
            <ul className="quest-helper-list">{state.quests.filter((quest) => quest.name.toLowerCase().includes(search.toLowerCase()) &&
                (filter === "all" || (filter === "started" ? quest.status === 0 : quest.status !== 2))).map((quest) =>
                <li key={quest.key}><button onClick={() => plugin.selectQuest(quest.key)}>
                    <span>{quest.status === 2 ? "✓ " : quest.status === 0 ? "◐ " : "○ "}{quest.name}</span>
                    <small>{QUEST_GUIDES[quest.key] ? "Automatic steps" : "Select steps manually"}</small>
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
