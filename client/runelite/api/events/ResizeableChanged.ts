export class ResizeableChanged {
    constructor(private resized: boolean) {}
    isResized() { return this.resized; }
    setResized(value: boolean) { this.resized = value; }
}
