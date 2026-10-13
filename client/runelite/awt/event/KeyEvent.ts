import { InputEvent } from "./InputEvent";
export class KeyEvent extends InputEvent {
    static readonly KEY_TYPED = 400;
    static readonly KEY_PRESSED = 401;
    static readonly KEY_RELEASED = 402;
    static readonly VK_UNDEFINED = 0;
    static readonly VK_SHIFT = 16;
    static readonly VK_CONTROL = 17;
    static readonly VK_ALT = 18;
    static readonly VK_META = 157;
    static readonly VK_ESCAPE = 27;
    static readonly VK_SPACE = 32;
    static readonly VK_ENTER = 10;
    constructor(source: KeyboardEvent, private readonly id = source.type === "keyup" ? KeyEvent.KEY_RELEASED : KeyEvent.KEY_PRESSED) { super(source); }
    getID() { return this.id; }
    getKeyCode() {
        const source = this.source as KeyboardEvent;
        if (source.key === "Meta") return KeyEvent.VK_META;
        if (source.key === "Enter") return KeyEvent.VK_ENTER;
        return source.keyCode;
    }
    getExtendedKeyCode() { return this.getKeyCode(); }
    getKeyChar() { const key = (this.source as KeyboardEvent).key; return key.length === 1 ? key : "\uffff"; }
}
