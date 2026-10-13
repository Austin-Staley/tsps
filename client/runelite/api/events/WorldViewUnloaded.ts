import type { WorldView } from "../WorldView";

export class WorldViewUnloaded {
    constructor(private readonly worldView: WorldView) {}
    getWorldView(): WorldView { return this.worldView; }
}
