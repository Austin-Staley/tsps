export class GrandExchangeSearched {
    private consumed = false;
    isConsumed(): boolean { return this.consumed; }
    setConsumed(value: boolean): void { this.consumed = value; }
    consume(): void { this.consumed = true; }
}
