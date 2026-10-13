import type { ParamsMap } from "../../rs/config/Type";
import type { OsrsClient } from "../../game/OsrsClient";
export class CompositionImpl {
    constructor(protected readonly engine: OsrsClient, protected readonly value: { id:number; params?:ParamsMap }) {}
    getId():number { return this.value.id; }
    getIntValue(id:number):number { const v=this.value.params?.get(id); return typeof v === "number" ? v : this.engine.loaderFactory.getParamTypeLoader().load(id).defaultInt; }
    getStringValue(id:number):string { const v=this.value.params?.get(id); return typeof v === "string" ? v : this.engine.loaderFactory.getParamTypeLoader().load(id).defaultString; }
    setValue(id:number,v:number|string):void { (this.value.params ??= new Map()).set(id,v); }
}
