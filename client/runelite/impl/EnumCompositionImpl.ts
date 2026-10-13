import type { EnumType } from "../../rs/config/enumtype/EnumType";
import type { EnumComposition } from "../api/EnumComposition";
export class EnumCompositionImpl implements EnumComposition {
    constructor(private readonly value:EnumType) {}
    getId():number { return this.value.id; } getKeys():number[] { return this.value.keys; }
    getIntVals():number[]|null { return this.value.intValues ?? null; } getStringVals():string[]|null { return this.value.stringValues ?? null; }
    getDefaultInt():number { return this.value.defaultInt; } getDefaultString():string { return this.value.defaultString; }
    getIntValue(key:number):number { const i=this.value.keys?.indexOf(key) ?? -1; return i<0 ? this.value.defaultInt : this.value.intValues?.[i] ?? this.value.defaultInt; }
    getStringValue(key:number):string { const i=this.value.keys?.indexOf(key) ?? -1; return i<0 ? this.value.defaultString : this.value.stringValues?.[i] ?? this.value.defaultString; }
    size():number { return this.value.outputCount; }
}
