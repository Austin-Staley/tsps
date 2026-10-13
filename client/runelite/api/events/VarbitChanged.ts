
export class VarbitChanged {
    constructor(private varpId: number, private varbitId: number, private value: number) {}
    getVarpId(): number { return this.varpId; }
    setVarpId(value: number): void { this.varpId = value; }
    getVarbitId(): number { return this.varbitId; }
    setVarbitId(value: number): void { this.varbitId = value; }
    getValue(): number { return this.value; }
    setValue(value: number): void { this.value = value; }
    getIndex(): number { return this.varpId; }
}
