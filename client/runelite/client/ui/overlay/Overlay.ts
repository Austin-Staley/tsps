/*
 * Copyright (c) 2016-2017, Adam <Adam@sigterm.info>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// Ported to TypeScript; Canvas2D and browser scheduling replace desktop implementations.
import { Dimension, Point, Rectangle, type Graphics2D } from "../../../awt";
import type { Plugin } from "../../plugins/Plugin";
import { OverlayLayer } from "./OverlayLayer";
import { OverlayPosition } from "./OverlayPosition";
import { OverlayMenuEntry } from "./OverlayMenuEntry";
import type { MenuAction } from "../../../api/MenuAction";
/** Browser counterpart of RuneLite Overlay; draw hooks are dispatched by the widget renderer. */
export abstract class Overlay {
    static readonly PRIORITY_LOW = 0;
    static readonly PRIORITY_DEFAULT = .25;
    static readonly PRIORITY_MED = .5;
    static readonly PRIORITY_HIGH = .75;
    static readonly PRIORITY_HIGHEST = 1;
    private preferredLocation: Point | null = null;
    private preferredSize: Dimension | null = null;
    private preferredPosition: OverlayPosition | null = null;
    private bounds = new Rectangle();
    private position = OverlayPosition.TOP_LEFT;
    private layer = OverlayLayer.UNDER_WIDGETS;
    private priority = .25;
    private movable = true;
    private resizable = false;
    private snappable = true;
    private resettable = true;
    private minimumSize = 32;
    private readonly drawHooks: number[] = [];
    private readonly menuEntries: OverlayMenuEntry[] = [];
    protected constructor(private readonly plugin: Plugin | null = null) { }
    abstract render(graphics: Graphics2D): Dimension | null;
    getParentBounds(): Rectangle | null { return null; }
    onDrag(_other: Overlay): boolean { return false; }
    revalidate(): void { }
    reset(): void { this.preferredLocation = null; this.preferredSize = null; this.preferredPosition = null; }
    getName(): string { return this.constructor.name; }
    getPlugin(): Plugin | null { return this.plugin; }
    getBounds(): Rectangle { return this.bounds; }
    setBounds(bounds: Rectangle): void { this.bounds = bounds; }
    getPosition(): OverlayPosition { return this.position; }
    setPosition(position: OverlayPosition): void { this.position = position; this.movable = position !== OverlayPosition.DYNAMIC && position !== OverlayPosition.TOOLTIP; this.snappable = this.movable && position !== OverlayPosition.DETACHED; }
    getPreferredPosition(): OverlayPosition | null { return this.preferredPosition; }
    setPreferredPosition(position: OverlayPosition | null): void { this.preferredPosition = position; }
    getPreferredLocation(): Point | null { return this.preferredLocation; }
    setPreferredLocation(location: Point | null): void { this.preferredLocation = location; }
    getPreferredSize(): Dimension | null { return this.preferredSize; }
    setPreferredSize(size: Dimension | null): void { this.preferredSize = size; }
    getLayer(): OverlayLayer { return this.layer; }
    setLayer(layer: OverlayLayer): void { this.layer = layer; }
    getPriority(): number { return this.priority; }
    setPriority(priority: number): void { this.priority = priority; }
    isMovable(): boolean { return this.movable; }
    setMovable(value: boolean): void { this.movable = value; }
    isResizable(): boolean { return this.resizable; }
    setResizable(value: boolean): void { this.resizable = value; }
    isSnappable(): boolean { return this.snappable; }
    setSnappable(value: boolean): void { this.snappable = value; }
    isResettable(): boolean { return this.resettable; }
    setResettable(value: boolean): void { this.resettable = value; }
    getMinimumSize(): number { return this.minimumSize; }
    setMinimumSize(value: number): void { this.minimumSize = value; }
    getDrawHooks(): readonly number[] { return this.drawHooks; }
    getMenuEntries(): OverlayMenuEntry[] { return this.menuEntries; }
    addMenuEntry(action: MenuAction, option: string, target: string): void { this.menuEntries.push(new OverlayMenuEntry(action, option, target)); }
    protected drawAfterInterface(interfaceId: number): void { this.drawHooks.push((interfaceId << 16) | 0xffff); }
    protected drawAfterLayer(groupOrPackedId: number, childId?: number): void {
        if (childId === undefined) {
            this.drawHooks.push(groupOrPackedId);
            return;
        }
        if (groupOrPackedId < 0 || groupOrPackedId > 65535 || childId < 0 || childId > 65535)
            throw new RangeError("Invalid widget ID");
        this.drawHooks.push((groupOrPackedId << 16) | childId);
    }
}
