// Ported from RuneLite HotkeyListener; original notices: ../../LICENSE.txt.
import { Keybind } from "../config/Keybind";
import type { KeyEvent } from "../../awt/event/KeyEvent";
export class HotkeyListener {
    private pressed = false;
    private consumingTyped = false;
    private enabledOnLoginScreen = false;
    constructor(private readonly keybind: () => Keybind) {}
    setEnabledOnLoginScreen(value: boolean) { this.enabledOnLoginScreen = value; }
    isEnabledOnLoginScreen() { return this.enabledOnLoginScreen; }
    focusLost() { if (this.pressed) { this.pressed = false; this.consumingTyped = false; this.hotkeyReleased(); } }
    keyTyped(event: KeyEvent) { if (this.consumingTyped) event.consume(); }
    keyPressed(event: KeyEvent) {
        if (!this.keybind().matches(event)) return;
        const wasPressed = this.pressed; this.pressed = true;
        if (!wasPressed) this.hotkeyPressed();
        if (Keybind.getModifierForKeyCode(event.getKeyCode()) === null) { this.consumingTyped = true; event.consume(); }
    }
    keyReleased(event: KeyEvent) { if (this.keybind().matches(event) && this.pressed) { this.pressed = false; this.consumingTyped = false; this.hotkeyReleased(); } }
    hotkeyPressed() {}
    hotkeyReleased() {}
}
