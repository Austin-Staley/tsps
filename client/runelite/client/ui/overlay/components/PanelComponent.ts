/*
 * Copyright (c) 2017, Tomas Slusny <slusnucky@gmail.com>
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
import { Color, Dimension, Graphics2D, Point, Rectangle } from "../../../../awt";
import type { LayoutableRenderableEntity } from "./LayoutableRenderableEntity";
import { BackgroundComponent } from "./BackgroundComponent";
import { ComponentConstants } from "./ComponentConstants";
import { ComponentOrientation } from "./ComponentOrientation";
export class PanelComponent implements LayoutableRenderableEntity {
    private bounds = new Rectangle();
    private location = new Point();
    private size = new Dimension(ComponentConstants.STANDARD_WIDTH, 0);
    private background: Color | null = ComponentConstants.STANDARD_BACKGROUND_COLOR;
    private border = new Rectangle(4, 4, 4, 4);
    private gap = new Point();
    private orientation = ComponentOrientation.VERTICAL;
    private wrap = false;
    private dimensions = new Dimension();
    private readonly children: LayoutableRenderableEntity[] = [];
    getChildren(): LayoutableRenderableEntity[] { return this.children; }
    getBounds(): Rectangle { return this.bounds; }
    setPreferredLocation(point: Point): void { this.location = point; }
    setPreferredSize(size: Dimension): void { this.size = size; }
    getPreferredSize(): Dimension { return this.size; }
    setBackgroundColor(color: Color | null): void { this.background = color; }
    getBackgroundColor(): Color | null { return this.background; }
    setBorder(border: Rectangle): void { this.border = border; }
    setGap(gap: Point): void { this.gap = gap; }
    setOrientation(orientation: ComponentOrientation): void { this.orientation = orientation; }
    setWrap(wrap: boolean): void { this.wrap = wrap; }
    render(graphics: Graphics2D): Dimension | null {
        if (!this.children.length)
            return null;
        if (this.background)
            new BackgroundComponent(this.background, new Rectangle(this.location.x, this.location.y, this.border.x + this.dimensions.width + this.border.width, this.border.y + this.dimensions.height + this.border.height)).render(graphics);
        const available = new Dimension(this.size.width - this.border.x - this.border.width, this.size.height - this.border.y - this.border.height);
        const baseX = this.location.x + this.border.x, baseY = this.location.y + this.border.y;
        let x = 0, y = 0, row = 0, width = 0, height = 0;
        for (const child of this.children) {
            if (!this.wrap)
                child.setPreferredSize(this.orientation === ComponentOrientation.VERTICAL ? new Dimension(available.width, 0) : new Dimension(0, available.height));
            child.setPreferredLocation(new Point(baseX + x, baseY + y));
            const d = child.render(graphics);
            if (!d)
                continue;
            width = Math.max(width, x + d.width);
            height = Math.max(height, y + d.height);
            if (this.orientation === ComponentOrientation.VERTICAL) {
                y += d.height + this.gap.y;
                row = Math.max(row, d.width);
                if (this.wrap && available.height > 0 && y >= available.height) {
                    y = 0;
                    x += row + this.gap.x;
                    row = 0;
                }
            }
            else {
                x += d.width + this.gap.x;
                row = Math.max(row, d.height);
                if (this.wrap && available.width > 0 && x >= available.width) {
                    x = 0;
                    y += row + this.gap.y;
                    row = 0;
                }
            }
        }
        this.dimensions = new Dimension(width, height);
        const result = new Dimension(width + this.border.x + this.border.width, height + this.border.y + this.border.height);
        this.bounds = new Rectangle(this.location, result);
        return result;
    }
}
