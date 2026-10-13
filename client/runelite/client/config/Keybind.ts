// Ported from RuneLite Keybind; original notices: ../../LICENSE.txt.
import { KeyEvent } from "../../awt/event/KeyEvent";
const MODIFIERS = new Map([[17, 128], [18, 512], [16, 64], [157, 256]]);
export class Keybind {
    static readonly NOT_SET = new Keybind(0, 0);
    static readonly CTRL = new Keybind(0, 128);
    static readonly ALT = new Keybind(0, 512);
    static readonly SHIFT = new Keybind(0, 64);
    private readonly keyCode: number;
    private readonly modifiers: number;
    constructor(key: number | KeyEvent, modifiers = 0, private readonly ignoreModifiers = false) {
        const code = typeof key === "number" ? key : key.getExtendedKeyCode();
        this.keyCode = MODIFIERS.has(code) ? 0 : code;
        this.modifiers = ((typeof key === "number" ? modifiers : key.getModifiersEx()) & 960);
        if (ignoreModifiers && this.keyCode !== 0) this.modifiers = 0;
    }
    getKeyCode() { return this.keyCode; }
    getModifiers() { return this.modifiers; }
    static getModifierForKeyCode(code: number) { return MODIFIERS.get(code) ?? null; }
    matches(event: KeyEvent) {
        if (!this.keyCode && !this.modifiers) return false;
        let code = event.getExtendedKeyCode();
        let modifiers = event.getModifiersEx() & 960;
        const modifier = MODIFIERS.get(code);
        if (modifier !== undefined) { modifiers |= modifier; code = 0; }
        if (event.getID() === KeyEvent.KEY_RELEASED) {
            if (code !== 0) return this.keyCode === code;
            if (modifier !== undefined) return this.keyCode === code && (this.modifiers & modifiers) === this.modifiers && (modifier & this.modifiers) === modifier;
        }
        return this.keyCode === code && (this.ignoreModifiers && code !== 0 || this.modifiers === modifiers);
    }
    equals(other: unknown) { return other instanceof Keybind && this.keyCode === other.keyCode && this.modifiers === other.modifiers; }
    toString() {
        if (!this.keyCode && !this.modifiers) return "Not set";
        const names = [[128, "Ctrl"], [512, "Alt"], [64, "Shift"], [256, "Meta"]] as const;
        const parts: string[] = names.filter(([mask]) => this.modifiers & mask).map(([, name]) => name);
        if (this.keyCode) parts.push(this.keyCode >= 112 && this.keyCode <= 123 ? `F${this.keyCode - 111}` : this.keyCode === 32 ? "Space" : String.fromCharCode(this.keyCode));
        return parts.join("+");
    }
}
