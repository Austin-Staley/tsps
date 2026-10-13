import { GameState } from "../../api/GameState";
import type { Client } from "../../api/Client";
import { KeyEvent } from "../../awt/event/KeyEvent";
import type { InputManager } from "../../../game/InputManager";
export interface KeyListener {
    keyPressed?(event: KeyEvent): void;
    keyReleased?(event: KeyEvent): void;
    keyTyped?(event: KeyEvent): void;
    focusLost?(): void;
    isEnabledOnLoginScreen?(): boolean;
}
export class KeyManager {
    private readonly listeners = new Set<KeyListener>();
    constructor(private readonly client: Client) {}
    registerKeyListener(listener: KeyListener) { this.listeners.add(listener); }
    unregisterKeyListener(listener: KeyListener) { this.listeners.delete(listener); }
    processKeyPressed(event: KeyEvent) { this.process("keyPressed", event); }
    processKeyReleased(event: KeyEvent) { this.process("keyReleased", event); }
    processKeyTyped(event: KeyEvent) { this.process("keyTyped", event); }
    onFocusChanged(event: { isFocused(): boolean }) { if (!event.isFocused()) for (const listener of this.listeners) listener.focusLost?.(); }
    bind(input: InputManager) {
        return input.addInputFilter((type, raw) => {
            if (type !== "keyPressed" && type !== "keyReleased") return false;
            const event = new KeyEvent(raw as KeyboardEvent);
            this.process(type, event);
            if (type === "keyPressed" && (raw as KeyboardEvent).key.length === 1) {
                const typed = new KeyEvent(raw as KeyboardEvent, KeyEvent.KEY_TYPED);
                if (event.isConsumed()) typed.consume();
                this.processKeyTyped(typed);
                if (typed.isConsumed()) event.consume();
            }
            return event.isConsumed();
        });
    }
    private process(type: "keyPressed" | "keyReleased" | "keyTyped", event: KeyEvent) {
        if (event.isConsumed()) return;
        for (const listener of this.listeners) {
            if (this.client.getGameState() !== GameState.LOGGED_IN && !listener.isEnabledOnLoginScreen?.()) continue;
            listener[type]?.(event);
            if (event.isConsumed()) break;
        }
    }
}
