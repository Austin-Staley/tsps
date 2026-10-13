/** RuneLite skill ordinal equals the engine's OSRS stat id. */
export enum Skill { ATTACK, DEFENCE, STRENGTH, HITPOINTS, RANGED, PRAYER, MAGIC, COOKING, WOODCUTTING, FLETCHING, FISHING, FIREMAKING, CRAFTING, SMITHING, MINING, HERBLORE, AGILITY, THIEVING, SLAYER, FARMING, RUNECRAFT, HUNTER, CONSTRUCTION, SAILING }
export namespace Skill {
    export function getName(skill: Skill): string { return Skill[skill][0] + Skill[skill].slice(1).toLowerCase(); }
    export function values(): Skill[] { return Object.values(Skill).filter(v => typeof v === "number") as Skill[]; }
}
