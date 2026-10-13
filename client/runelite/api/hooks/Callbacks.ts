import type { KeyEvent } from "../../awt/event/KeyEvent";
import type { MouseEvent } from "../../awt/event/MouseEvent";
/** Browser-backed client callbacks. Java2D framebuffer callbacks belong to the renderer adapter. */
export abstract class Callbacks {
    abstract post(event: object): void;
    abstract postDeferred(event: object): void;
    abstract tick(): void;
    abstract tickEnd(): void;
    abstract frame(): void;
    abstract serverTick(): void;
    abstract mousePressed(event: MouseEvent): MouseEvent;
    abstract mouseReleased(event: MouseEvent): MouseEvent;
    abstract mouseClicked(event: MouseEvent): MouseEvent;
    abstract mouseEntered(event: MouseEvent): MouseEvent;
    abstract mouseExited(event: MouseEvent): MouseEvent;
    abstract mouseDragged(event: MouseEvent): MouseEvent;
    abstract mouseMoved(event: MouseEvent): MouseEvent;
    abstract mouseWheelMoved(event: MouseEvent): MouseEvent;
    abstract keyPressed(event: KeyEvent): void;
    abstract keyReleased(event: KeyEvent): void;
    abstract keyTyped(event: KeyEvent): void;
    abstract error(message: string, reason: unknown): void;
    abstract openUrl(url: string): void;
    abstract isRuneLiteClientOutdated(): boolean;
}
