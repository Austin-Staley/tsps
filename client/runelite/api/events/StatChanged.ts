import type { Skill } from "../Skill";

export class StatChanged {
    constructor(private readonly skill: Skill, private readonly xp: number, private readonly level: number, private readonly boostedLevel: number) {}
    getSkill(): Skill { return this.skill; }
    getXp(): number { return this.xp; }
    getLevel(): number { return this.level; }
    getBoostedLevel(): number { return this.boostedLevel; }
}
