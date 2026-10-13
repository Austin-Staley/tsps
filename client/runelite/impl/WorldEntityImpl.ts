import type { WorldEntity as EngineWorldEntity } from "../../game/worldview/WorldEntity";
import type { WorldEntity } from "../api/WorldEntity";
import { LocalPoint } from "../api/coords/LocalPoint";
import type { WorldView } from "../api/WorldView";
import type { ClientImpl } from "./ClientImpl";
export class WorldEntityImpl implements WorldEntity {
    private readonly view: WorldView;
    constructor(private readonly client: ClientImpl, readonly value: EngineWorldEntity) { this.view = client.getWorldView(value.worldViewId)!; }
    getWorldView(): WorldView { return this.view; }
    getLocalLocation(): LocalPoint { const top = this.client.getTopLevelWorldView(); return new LocalPoint(this.value.position.x - (top.getBaseX() << 7), this.value.position.y - (top.getBaseY() << 7), top); }
    getOrientation(): number { return this.value.position.orientation; }
    getTargetLocation(): LocalPoint { const top = this.client.getTopLevelWorldView(), target = this.value.pathSteps[0].position; return new LocalPoint(target.x - (top.getBaseX() << 7), target.y - (top.getBaseY() << 7), top); }
    getTargetOrientation(): number { return this.value.pathSteps[0].position.orientation; }
}
