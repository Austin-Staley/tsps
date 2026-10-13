/*
 * Copyright (c) 2018, Jasper Ketelaar <jasper0781@gmail.com>
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
import { Dimension, Graphics2D, Point, Rectangle } from "../../../../awt";
import type { LayoutableRenderableEntity } from "./LayoutableRenderableEntity";
import { ComponentOrientation } from "./ComponentOrientation";
export class SplitComponent implements LayoutableRenderableEntity {
    private location = new Point();
    private size = new Dimension(129, 0);
    private bounds = new Rectangle();
    private orientation = ComponentOrientation.VERTICAL;
    private gap = new Point();
    constructor(private first: LayoutableRenderableEntity, private second: LayoutableRenderableEntity) { }
    static builder(): SplitComponentBuilder { return new SplitComponentBuilder(); }
    setFirst(first: LayoutableRenderableEntity): void { this.first = first; }
    setSecond(second: LayoutableRenderableEntity): void { this.second = second; }
    setOrientation(orientation: ComponentOrientation): void { this.orientation = orientation; }
    setGap(gap: Point): void { this.gap = gap; }
    setPreferredLocation(point: Point): void { this.location = point; }
    setPreferredSize(size: Dimension): void { this.size = size; }
    getBounds(): Rectangle { return this.bounds; }
    render(graphics: Graphics2D): Dimension | null {
        this.first.setPreferredLocation(this.location);
        this.first.setPreferredSize(this.size);
        const first = this.first.render(graphics);
        if (!first)
            return null;
        const x = this.orientation === ComponentOrientation.HORIZONTAL ? first.width + this.gap.x : 0, y = this.orientation === ComponentOrientation.VERTICAL ? first.height + this.gap.y : 0;
        this.second.setPreferredLocation(new Point(this.location.x + x, this.location.y + y));
        this.second.setPreferredSize(new Dimension(this.size.width - x, this.size.height - y));
        const second = this.second.render(graphics);
        if (!second)
            return first;
        const result = new Dimension(this.orientation === ComponentOrientation.VERTICAL ? Math.max(first.width, second.width) : x + second.width, this.orientation === ComponentOrientation.HORIZONTAL ? Math.max(first.height, second.height) : y + second.height);
        this.bounds = new Rectangle(this.location, result);
        return result;
    }
}
class SplitComponentBuilder {
    private firstComponent?: LayoutableRenderableEntity;
    private secondComponent?: LayoutableRenderableEntity;
    private direction = ComponentOrientation.VERTICAL;
    private spacing = new Point();
    first(component: LayoutableRenderableEntity): this { this.firstComponent = component; return this; }
    second(component: LayoutableRenderableEntity): this { this.secondComponent = component; return this; }
    orientation(value: ComponentOrientation): this { this.direction = value; return this; }
    gap(value: Point): this { this.spacing = value; return this; }
    build(): SplitComponent {
        if (!this.firstComponent || !this.secondComponent)
            throw new Error("SplitComponent requires two components");
        const component = new SplitComponent(this.firstComponent, this.secondComponent);
        component.setOrientation(this.direction);
        component.setGap(this.spacing);
        return component;
    }
}
