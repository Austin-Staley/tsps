import type { OsrsClient } from "../../game/OsrsClient";
import type { LocType } from "../../rs/config/loctype/LocType";
import type { ObjectComposition } from "../api/ObjectComposition";
import { CompositionImpl } from "./CompositionImpl";
export class ObjectCompositionImpl extends CompositionImpl implements ObjectComposition {
    constructor(engine:OsrsClient, protected readonly value:LocType) { super(engine,value); }
    getName():string { return this.value.name; } getActions():string[] { return this.value.actions; }
    getSizeX():number { return this.value.sizeX; } getSizeY():number { return this.value.sizeY; }
    getMapSceneId():number { return this.value.mapSceneId; } getMapIconId():number { return this.value.mapFunctionId; }
    getImpostorIds():number[]|null { return this.value.transforms ?? null; }
    getImpostor():ObjectComposition|null { const v=this.value.transform(this.engine.varManager,this.engine.locTypeLoader); return v ? new ObjectCompositionImpl(this.engine,v) : null; }
    getAnimationId():number { return this.value.seqId; }
}
