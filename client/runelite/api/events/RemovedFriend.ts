import type { Nameable } from "../Nameable";
export class RemovedFriend {
    constructor(private readonly nameable: Nameable) {}
    getNameable(): Nameable { return this.nameable; }
}
