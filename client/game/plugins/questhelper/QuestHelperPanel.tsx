import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { NavigationButton } from "@runelite/client/ui/NavigationButton";
import { ConfigPanel } from "@runelite/client/ui/config/ConfigPanel";
import { QuestHelperConfig, type QuestHelperPlugin } from "./QuestHelperPlugin";
import { QUEST_GUIDES } from "./guides";
import catalog from "./catalog.json";
import orders from "./orders.json";
import type { GuidePanel, GuideRequirement, QuestCatalogEntry, QuestSummary } from "./types";
import "./QuestHelper.css";

const assets = `${process.env.PUBLIC_URL ?? ""}/quest-helper/icons`;
const skills = ["Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"];
const metadata = new Map<string, QuestCatalogEntry>(catalog.map((quest) => [quest.key, quest]));
const titleCase = (text: string) => text.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function useQuestHelper(plugin: QuestHelperPlugin) {
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const snapshot = useCallback(() => plugin.getState(), [plugin]);
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function filterQuests(quests: QuestSummary[], search: string, filter: string, difficulty: string, ordering: string, excludedSkills: string[], showCompleted = false): QuestSummary[] {
    const terms = search.trim().toLowerCase().split(/\s+/);
    const result = quests.filter((quest) => {
        const entry = metadata.get(quest.key)!;
        return (showCompleted || quest.status !== 2) && terms.every((term) => quest.name.toLowerCase().includes(term)) &&
            (!ordering.startsWith("QUEST_POINTS") || entry.type !== "MINIQUEST") &&
            (filter === "SHOW_ALL" || (filter === "FREE_TO_PLAY" ? entry.type === "F2P" : filter === "MEMBERS" ? entry.type === "P2P" : filter === "MINIQUEST" ? entry.type === "MINIQUEST" : entry.type !== "MINIQUEST")) &&
            (difficulty === "ALL" || entry.difficulty === difficulty) && !entry.skills?.some((skill) => excludedSkills.includes(skill));
    });
    const ranked = ordering === "OPTIMAL" ? orders.OptimalQuestGuide : ordering === "OPTIMAL_IRONMAN" ? orders.IronmanOptimalQuestGuide : ordering === "RELEASE_DATE" ? orders.ReleaseDate : [];
    return result.sort((a, b) => {
        if (ranked.length) {
            const rank = (key: string) => { const index = ranked.indexOf(key); return index < 0 ? ranked.length : index; };
            return rank(a.key) - rank(b.key) || a.name.localeCompare(b.name);
        }
        if (ordering.startsWith("QUEST_POINTS")) return ((metadata.get(a.key)?.questPoints ?? 0) - (metadata.get(b.key)?.questPoints ?? 0)) * (ordering === "QUEST_POINTS_DESC" ? -1 : 1) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name) * (ordering === "Z_TO_A" ? -1 : 1);
    });
}

function Icon({ name }: { name: string }): JSX.Element {
    return <img src={`${assets}/${name}.png`} alt="" aria-hidden="true" />;
}

function Requirements({ title, items, plugin, showEmpty = false }: { title: string; items?: GuideRequirement[]; plugin: QuestHelperPlugin; showEmpty?: boolean }): JSX.Element | null {
    if (!items?.length && !showEmpty) return null;
    return <section className="qh-requirements"><h3>{title}</h3><div>{items?.length ? items.map((item, index) => {
        const count = "id" in item ? plugin.getItemCount(item) : undefined;
        const amount = item.amount ?? 1;
        const color = count === undefined ? "" : count >= amount ? "qh-passed" :
            "id" in item && plugin.getBankCount(item) + count >= item.amount ? "qh-banked" : "qh-failed";
        return <p key={index} className={color}>{amount > 1 ? `${amount} x ` : ""}{item.name}</p>;
    }) : <p className="qh-muted">None</p>}</div></section>;
}

function TextGroup({ title, lines, showEmpty = false }: { title: string; lines?: string[]; showEmpty?: boolean }): JSX.Element | null {
    if (!lines?.length && !showEmpty) return null;
    return <section className="qh-requirements"><h3>{title}</h3><div>{lines?.length ? lines.map((text, index) => <p key={index}>{text}</p>) : <p className="qh-muted">None</p>}</div></section>;
}

function StepSection({ panel, plugin, activeIndex, automatic }: { panel: GuidePanel; plugin: QuestHelperPlugin; activeIndex: number; automatic: boolean }): JSX.Element {
    const guide = plugin.getState().guide!;
    const active = panel.steps.includes(activeIndex) || !!panel.substeps?.includes(activeIndex);
    const [expanded, setExpanded] = useState(active);
    useEffect(() => { if (active) setExpanded(true); }, [active]);
    return <section className={`qh-section${active ? " qh-active-section" : ""}`}>
        <button className="qh-section-header" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            <span>{panel.header}</span><Icon name={expanded ? "expanded" : "collapsed"} />
        </button>
        {expanded && <div className="qh-section-body">
            <Requirements title="Bring the following items:" items={panel.items} plugin={plugin} />
            <Requirements title="Optionally bring the following items:" items={panel.recommended} plugin={plugin} />
            {panel.steps.map((index) => <button key={index} className={`qh-step${index === activeIndex ? " qh-current-step" : ""}`}
                aria-pressed={index === activeIndex} onClick={() => plugin.selectStep(index)}>{guide.steps[index].text}</button>)}
            {active && !panel.steps.includes(activeIndex) && <p className="qh-step qh-current-step" aria-live="polite">{plugin.getState().step?.text}</p>}
        </div>}
        {!automatic && !expanded && <span className="qh-sr-only">Expand to select a step manually</span>}
    </section>;
}

export function QuestHelperPanel({ plugin }: { plugin: QuestHelperPlugin }): JSX.Element {
    const state = useQuestHelper(plugin);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("SHOW_ALL");
    const [difficulty, setDifficulty] = useState("ALL");
    const [ordering, setOrdering] = useState("A_TO_Z");
    const [excludedSkills, setExcludedSkills] = useState<string[]>([]);
    const [skillFiltering, setSkillFiltering] = useState(false);
    const [settings, setSettings] = useState(false);
    const automatic = state.selectedKey ? !!QUEST_GUIDES[state.selectedKey] : false;
    const activeIndex = state.manualStep ?? state.guide?.steps.findIndex((step) => step.text === state.step?.text) ?? -1;
    const quests = filterQuests(state.quests, search, filter, difficulty, ordering, excludedSkills, state.showCompletedQuests);
    const panels = state.guide?.panels?.length ? state.guide.panels : state.guide ? [{ header: "Quest steps", steps: state.guide.steps.map((_, index) => index) }] : [];
    const overview = state.guide?.overview;
    return <div className="quest-helper-panel">
        <header className="qh-title"><span>Quest Helper</span><nav aria-label="Quest Helper links">
            <button title="Change your settings" aria-label="Quest Helper settings" aria-pressed={settings} onClick={() => setSettings(!settings)}><Icon name="settings_icon" /></button>
            <a title="Get help with the Quest Helper or make suggestions on Discord" href="https://discord.gg/XCfwNnz6RB" target="_blank" rel="noreferrer"><Icon name="discord" /><span className="qh-sr-only">Quest Helper Discord</span></a>
            <a title="Report issues or contribute on GitHub" href="https://github.com/Zoinkwiz/quest-helper" target="_blank" rel="noreferrer"><Icon name="github" /><span className="qh-sr-only">Quest Helper GitHub</span></a>
            <a title="Support development on Patreon" href="https://www.patreon.com/zoinkwiz" target="_blank" rel="noreferrer"><Icon name="patreon" /><span className="qh-sr-only">Quest Helper Patreon</span></a>
        </nav></header>
        {settings ? <ConfigPanel descriptor={QuestHelperConfig} configManager={plugin.getConfigManager()} /> : state.selectedKey ? <div className="qh-overview" key={state.selectedKey}>
            <div className="qh-quest-title"><span>{state.quest?.name ?? "Loading quest…"}</span><button title="Close helper" aria-label="Close helper" onClick={() => plugin.stopQuest()}><Icon name="close" /></button></div>
            {state.error && <p role="alert" className="qh-message">{state.error}</p>}
            {!state.guide && !state.error && <p className="qh-message">Loading guide…</p>}
            {state.guide && !automatic && <p className="qh-message">Select a step manually. Automatic quest conditions have not been ported for this guide.</p>}
            {state.guide && automatic && !state.step && <p className="qh-message">No upstream step matches the current quest state.</p>}
            {state.manualStep !== undefined && automatic && <button className="qh-resume" onClick={() => plugin.selectStep(undefined)}>Resume automatic steps</button>}
            {overview && <div className="qh-intro">
                <TextGroup title="General requirements:" lines={overview.general} />
                <TextGroup title="Recommended:" lines={overview.generalRecommended} />
                <Requirements title="Item requirements:" items={overview.required} plugin={plugin} showEmpty />
                <Requirements title="Recommended items:" items={overview.recommended} plugin={plugin} showEmpty />
                <TextGroup title="Enemies to defeat:" lines={overview.combat} showEmpty />
                <TextGroup title="Notes:" lines={overview.notes} />
                <TextGroup title="Rewards:" lines={overview.rewards} showEmpty />
                <section className="qh-requirements"><h3>External Resources:</h3><div><a href={`https://oldschool.runescape.wiki/w/${encodeURIComponent(state.quest?.name?.replace(/ /g, "_") ?? "Quests")}`} target="_blank" rel="noreferrer">Open RuneScape Wiki</a></div></section>
            </div>}
            {state.quest?.status === 2 && <p className="qh-message qh-passed">Quest complete!</p>}
            {panels.map((panel, index) => <StepSection key={index} panel={panel} plugin={plugin} activeIndex={activeIndex} automatic={automatic} />)}
        </div> : <>
            <div className="qh-filters">
                <label>Filters<select aria-label="Filter quests" value={filter} onChange={(event) => setFilter(event.target.value)}>{["SHOW_ALL", "FREE_TO_PLAY", "MEMBERS", "QUEST", "MINIQUEST"].map((value) => <option key={value} value={value}>{value === "QUEST" ? "Quests" : value === "MINIQUEST" ? "Miniquests" : titleCase(value)}</option>)}</select></label>
                <label>Difficulty<select aria-label="Quest difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>{["ALL", "NOVICE", "INTERMEDIATE", "EXPERIENCED", "MASTER", "GRANDMASTER", "MINIQUEST"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
                <label>Ordering<select aria-label="Quest ordering" value={ordering} onChange={(event) => setOrdering(event.target.value)}>{["A_TO_Z", "Z_TO_A", "OPTIMAL", "OPTIMAL_IRONMAN", "RELEASE_DATE", "QUEST_POINTS_ASC", "QUEST_POINTS_DESC"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
                <button className="qh-skill-filter" aria-expanded={skillFiltering} onClick={() => setSkillFiltering(!skillFiltering)}><span>Skill filtering</span><span>{excludedSkills.length ? `${excludedSkills.length} active` : ""}</span><Icon name={skillFiltering ? "expanded" : "collapsed"} /></button>
                {skillFiltering && <div className="qh-skills">{skills.map((skill) => <button key={skill} aria-label={`Hide quests requiring or rewarding ${skill}`} aria-pressed={excludedSkills.includes(skill)} title={skill}
                    onClick={() => setExcludedSkills(excludedSkills.includes(skill) ? excludedSkills.filter((value) => value !== skill) : [...excludedSkills, skill])}>
                    <img src={`${assets}/skills/${skill === "Runecraft" ? "runecraft" : skill.toLowerCase()}.png`} alt="" /></button>)}</div>}
                <div className="qh-search"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6" cy="6" r="4" /><path d="m9 9 5 5" /></svg><input aria-label="Search quests" value={search} onChange={(event) => setSearch(event.target.value)} /><button aria-label="Clear quest search" onClick={() => setSearch("")} hidden={!search}><Icon name="close" /></button></div>
                {state.quests.length === 0 && <p className="qh-message">Please log in to see available quests</p>}
                {state.quests.length > 0 && quests.length === 0 && <p className="qh-message">There are no quests available that match your current filters</p>}
            </div>
            <div className="qh-quest-list">{(ordering.startsWith("OPTIMAL") ? ["Optimal ordering"] : ["Quests", "Miniquests"]).map((section) => {
                const rows = section === "Optimal ordering" ? quests : quests.filter((quest) => (metadata.get(quest.key)?.type === "MINIQUEST") === (section === "Miniquests"));
                return rows.length > 0 && <section key={section}><h3>{section}</h3>{rows.map((quest) => <div key={quest.key} className={`qh-quest-row qh-status-${quest.status}`}>
                    <span title={QUEST_GUIDES[quest.key] ? quest.name : `${quest.name} — manual step selection`}>{quest.name}</span>
                    <button aria-label={`Start ${quest.name}`} title={QUEST_GUIDES[quest.key] ? "Start helper" : "Start helper (manual step selection)"} onClick={() => { setSearch(""); void plugin.selectQuest(quest.key); }}><Icon name="start" /></button>
                </div>)}</section>;
            })}</div>
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
        .icon(({ label }) => <img width={17} height={17} src={`${assets}/quest_icon.png`} alt={label} />)
        .panel(() => <QuestHelperPanel plugin={plugin} />).build();
}
