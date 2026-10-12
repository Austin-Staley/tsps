export type QuestSummary = { key: string; name: string; status: 0 | 1 | 2 };
export type QuestCatalogEntry = {
    key: string;
    name: string;
    type: string;
    difficulty?: string;
    skills?: string[];
    questPoints?: number;
    questId?: number;
    varp?: number;
    varbit?: number;
    completeValue?: number;
    source: string;
};
export type GuideRequirement = ItemRequirement | { name: string; amount?: number };
export type GuidePanel = { header: string; steps: number[]; substeps?: number[]; items?: GuideRequirement[]; recommended?: GuideRequirement[] };
export type GuideOverview = { required: GuideRequirement[]; recommended: GuideRequirement[]; general: string[];
    generalRecommended: string[]; combat: string[]; notes: string[]; rewards: string[] };
export type ImportedGuide = { source: string; steps: QuestStep[]; panels?: GuidePanel[]; overview?: GuideOverview };
export type QuestTarget = { x: number; y: number; plane: number };
export type ItemRequirement = { id: number; name: string; amount: number; equipped?: boolean; alternates?: number[] };
export type QuestStep = {
    text: string;
    target?: QuestTarget;
    items?: ItemRequirement[];
    choices?: string[];
    type?: "item";
};
export type QuestContext = {
    stage: number;
    count(id: number): number;
    bankCount(id: number): number;
    equipped(id: number): boolean;
    varbit(id: number): number;
    seenDialog(text: string): boolean;
    hasNpc(id: number): boolean;
    hasObject(id: number, target: QuestTarget): boolean;
    inventoryFull: boolean;
    position: QuestTarget;
};
export type QuestGuide = {
    stages: readonly number[];
    steps: QuestStep[];
    resolve(context: QuestContext): QuestStep;
};

export function requirementCount(requirement: ItemRequirement, context: QuestContext): number {
    const ids = [requirement.id, ...(requirement.alternates ?? [])];
    return requirement.equipped ? Number(ids.some((id) => context.equipped(id)))
        : ids.reduce((total, id) => total + context.count(id), 0);
}

export function inZone(position: QuestTarget, x1: number, y1: number, x2: number, y2: number, plane = 0): boolean {
    return position.plane === plane && position.x >= Math.min(x1, x2) && position.x <= Math.max(x1, x2) &&
        position.y >= Math.min(y1, y2) && position.y <= Math.max(y1, y2);
}
