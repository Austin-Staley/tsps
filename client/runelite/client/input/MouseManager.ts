import type { InputManager } from "../../../game/InputManager";
import { getMousePos } from "../../../game/InputManager";
import { MouseEvent } from "../../awt/event/MouseEvent";
export interface MouseListener {
    mousePressed?(event: MouseEvent): MouseEvent;
    mouseReleased?(event: MouseEvent): MouseEvent;
    mouseClicked?(event: MouseEvent): MouseEvent;
    mouseEntered?(event: MouseEvent): MouseEvent;
    mouseExited?(event: MouseEvent): MouseEvent;
    mouseMoved?(event: MouseEvent): MouseEvent;
    mouseDragged?(event: MouseEvent): MouseEvent;
    mouseWheelMoved?(event: MouseEvent): MouseEvent;
}
export class MouseManager {
    private readonly listeners = new Set<MouseListener>();
    registerMouseListener(listener: MouseListener) { this.listeners.add(listener); }
    unregisterMouseListener(listener: MouseListener) { this.listeners.delete(listener); }
    registerMouseWheelListener(listener: MouseListener) { this.listeners.add(listener); }
    unregisterMouseWheelListener(listener: MouseListener) { this.listeners.delete(listener); }
    processEvent(type: keyof MouseListener, event: MouseEvent): MouseEvent {
        for (const listener of this.listeners) {
            event = listener[type]?.(event) ?? event;
            if (event.isConsumed()) break;
        }
        return event;
    }
    bind(input: InputManager) {
        return input.addInputFilter((type, raw) => {
            if (!type.startsWith("mouse") || !input.element) return false;
            const source = raw as globalThis.MouseEvent;
            const [x, y] = getMousePos(input.element, source);
            let event = new MouseEvent(source, x, y);
            const name = (type === "mouseMoved" && source.buttons ? "mouseDragged" : type) as keyof MouseListener;
            event = this.processEvent(name, event);
            return event.isConsumed();
        });
    }
}
