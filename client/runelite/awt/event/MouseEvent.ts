import { InputEvent } from "./InputEvent";
import { Point } from "../Point";
export class MouseEvent extends InputEvent {
    static readonly BUTTON1 = 1;
    static readonly BUTTON2 = 2;
    static readonly BUTTON3 = 3;
    constructor(source: globalThis.MouseEvent, private readonly x: number, private readonly y: number) { super(source); }
    getX() { return this.x; }
    getY() { return this.y; }
    getPoint() { return new Point(this.x, this.y); }
    getButton() { return (this.source as globalThis.MouseEvent).button + 1; }
    getClickCount() { return this.source.detail; }
    getWheelRotation() { return Math.sign((this.source as WheelEvent).deltaY ?? 0); }
    getPreciseWheelRotation() { return ((this.source as WheelEvent).deltaY ?? 0) / 100; }
}
