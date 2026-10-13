export interface StructComposition { getId(): number; getIntValue(paramId:number): number; getStringValue(paramId:number): string; setValue(paramId:number,value:number|string):void; }
