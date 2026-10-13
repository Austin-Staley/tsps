import { Keybind } from "./Keybind";
import type { KeyEvent } from "../../awt/event/KeyEvent";
export class ModifierlessKeybind extends Keybind {
    constructor(key: number | KeyEvent, modifiers = 0) { super(key, modifiers, true); }
}
