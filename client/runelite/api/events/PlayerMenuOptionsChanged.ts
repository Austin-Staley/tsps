export class PlayerMenuOptionsChanged {
    constructor(private index: number) {}
    getIndex(): number { return this.index; }
    setIndex(value: number): void { this.index = value; }
}
