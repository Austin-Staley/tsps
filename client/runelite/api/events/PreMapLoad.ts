import type { WorldView } from "../WorldView";
import type { Scene } from "../Scene";
/** Main-thread completion boundary of the browser worker map load, before map residency commit. */
export class PreMapLoad {
    constructor(private readonly worldView: WorldView, private readonly scene: Scene) {}
    getWorldView(): WorldView { return this.worldView; }
    getScene(): Scene { return this.scene; }
}
