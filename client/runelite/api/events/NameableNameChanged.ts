import type { Nameable } from "../Nameable";
export class NameableNameChanged {
    constructor(private readonly nameable: Nameable) {}
    getNameable(): Nameable { return this.nameable; }
}
