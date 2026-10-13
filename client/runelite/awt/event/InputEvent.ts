// Browser adapter for java.awt.event.InputEvent. Original notices: ../../LICENSE.txt.
export class InputEvent {
    static readonly SHIFT_DOWN_MASK = 64;
    static readonly CTRL_DOWN_MASK = 128;
    static readonly META_DOWN_MASK = 256;
    static readonly ALT_DOWN_MASK = 512;
    protected consumed = false;
    constructor(protected readonly source: KeyboardEvent | MouseEvent) {}
    getModifiersEx() {
        return (this.source.shiftKey ? 64 : 0) | (this.source.ctrlKey ? 128 : 0) |
            (this.source.metaKey ? 256 : 0) | (this.source.altKey ? 512 : 0);
    }
    isShiftDown() { return this.source.shiftKey; }
    isControlDown() { return this.source.ctrlKey; }
    isAltDown() { return this.source.altKey; }
    isMetaDown() { return this.source.metaKey; }
    getWhen() { return this.source.timeStamp; }
    consume() { this.consumed = true; this.source.preventDefault(); }
    isConsumed() { return this.consumed; }
}
