import { Callbacks } from "../api/hooks/Callbacks";
import type { EventBus } from "../client/eventbus/EventBus";
import type { MouseManager } from "../client/input/MouseManager";
import type { KeyManager } from "../client/input/KeyManager";
import type { KeyEvent } from "../awt/event/KeyEvent";
import type { MouseEvent } from "../awt/event/MouseEvent";
export type CallbackLifecycle = {
    tick(): void; tickEnd(): void; frame(): void; serverTick(): void;
    openUrl(url: string): void;
    isOutdated(): boolean;
};
export class CallbacksImpl extends Callbacks {
    private pending: object[] = [];
    private disposed = false;
    constructor(private readonly bus: EventBus, private readonly mouse: MouseManager, private readonly keys: KeyManager, private readonly lifecycle: CallbackLifecycle) { super(); }
    post(event: object): void { if (!this.disposed) this.bus.post(event); }
    postDeferred(event: object): void { if (!this.disposed) this.pending.push(event); }
    prepareDeferred(): () => void {
        const events = this.pending.splice(0);
        return () => { for (const event of events) { if (this.disposed) return; this.bus.post(event); } };
    }
    flushDeferred(): void { this.prepareDeferred()(); }
    tick(): void { this.lifecycle.tick(); } tickEnd(): void { this.lifecycle.tickEnd(); }
    frame(): void { this.lifecycle.frame(); } serverTick(): void { this.lifecycle.serverTick(); }
    mousePressed(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mousePressed", event); }
    mouseReleased(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mouseReleased", event); }
    mouseClicked(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mouseClicked", event); }
    mouseEntered(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mouseEntered", event); }
    mouseExited(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mouseExited", event); }
    mouseDragged(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mouseDragged", event); }
    mouseMoved(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mouseMoved", event); }
    mouseWheelMoved(event: MouseEvent): MouseEvent { return this.mouse.processEvent("mouseWheelMoved", event); }
    keyPressed(event: KeyEvent): void { this.keys.processKeyPressed(event); }
    keyReleased(event: KeyEvent): void { this.keys.processKeyReleased(event); }
    keyTyped(event: KeyEvent): void { this.keys.processKeyTyped(event); }
    error(message: string, reason: unknown): void { console.error(`[RuneLite] ${message}`, reason); }
    openUrl(url: string): void { this.lifecycle.openUrl(url); }
    isRuneLiteClientOutdated(): boolean { return this.lifecycle.isOutdated(); }
    dispose(): void { this.disposed = true; this.pending.length = 0; }
}
