export class Hitsplat {
    constructor(private readonly type: number, private readonly amount: number, private readonly disappears: number) {}
    getHitsplatType(): number { return this.type; }
    getAmount(): number { return this.amount; }
    getDisappearsOnGameCycle(): number { return this.disappears; }
    isMine(): boolean { return [12, 16, 18, 20, 22, 24, 43, 44, 45, 46, 47, 53, 55].includes(this.type); }
    isOthers(): boolean { return [13, 17, 19, 21, 23, 25, 54].includes(this.type); }
}
