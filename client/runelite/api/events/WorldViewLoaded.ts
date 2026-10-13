import type { WorldView } from "../WorldView";

export class WorldViewLoaded {
    constructor(private readonly worldView: WorldView) {}
    getWorldView(): WorldView { return this.worldView; }
}
