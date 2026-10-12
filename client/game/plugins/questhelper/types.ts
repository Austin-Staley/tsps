export type QuestSummary = { key: string; name: string; status: 0 | 1 | 2 };
export type QuestSnapshot = QuestSummary & {
    stage: number;
    journal: string[];
    facts: { flour?: number; hopper?: boolean };
};
export type QuestTarget = { x: number; y: number; plane: number };
export type ItemRequirement = { id: number; name: string; amount: number; equipped?: boolean };
export type QuestStep = {
    text: string;
    target?: QuestTarget;
    items?: ItemRequirement[];
    choices?: string[];
};
export type QuestContext = {
    quest: QuestSnapshot;
    count(id: number): number;
    equipped(id: number): boolean;
    position: QuestTarget;
};
export type QuestGuide = {
    steps: string[];
    note?: string;
    resolve(context: QuestContext): QuestStep;
};

export function journalText(line: string): string {
    return line.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]*>/g, "");
}

export function currentJournal(quest: QuestSnapshot): string {
    return quest.journal.filter((line) => line.trim() && !line.includes("<str>")).map(journalText).join(" ");
}

export function requirementMet(requirement: ItemRequirement, context: QuestContext): boolean {
    return requirement.equipped ? context.equipped(requirement.id) : context.count(requirement.id) >= requirement.amount;
}
