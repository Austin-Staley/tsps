/*
 * Copyright (c) 2018, Tomas Slusny <slusnucky@gmail.com>
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
import { Color, Dimension, Font, Graphics2D, Point, Rectangle } from "../../../../awt";
import { Text } from "../../../util/Text";
import { TextComponent } from "./TextComponent";
import type { LayoutableRenderableEntity } from "./LayoutableRenderableEntity";
export class LineComponent implements LayoutableRenderableEntity {
    private left = "";
    private right = "";
    private leftColor = Color.WHITE;
    private rightColor = Color.WHITE;
    private leftFont: Font | null = null;
    private rightFont: Font | null = null;
    private location = new Point();
    private size = new Dimension(129, 0);
    private bounds = new Rectangle();
    static builder(): LineComponentBuilder { return new LineComponentBuilder(); }
    setLeft(value: string): void { this.left = value; }
    setRight(value: string): void { this.right = value; }
    setLeftColor(color: Color): void { this.leftColor = color; }
    setRightColor(color: Color): void { this.rightColor = color; }
    setLeftFont(font: Font): void { this.leftFont = font; }
    setRightFont(font: Font): void { this.rightFont = font; }
    setPreferredLocation(point: Point): void { this.location = point; }
    setPreferredSize(size: Dimension): void { this.size = size; }
    getBounds(): Rectangle { return this.bounds; }
    render(graphics: Graphics2D): Dimension {
        const lf = this.leftFont ?? graphics.getFont(), rf = this.rightFont ?? graphics.getFont();
        const lm = graphics.getFontMetrics(lf), rm = graphics.getFontMetrics(rf);
        const height = Math.max(lm.getHeight(), rm.getHeight());
        const split = (text: string, width: number, metrics: typeof lm): string[] => {
            const result: string[] = [];
            let line = "";
            for (const word of text.split(" ")) {
                const next = line ? line + " " + word : word;
                if (line && metrics.stringWidth(Text.removeTags(next)) > width) {
                    result.push(line);
                    line = word;
                }
                else
                    line = next;
            }
            result.push(line);
            return result;
        };
        const wrap = lm.stringWidth(Text.removeTags(this.left)) + rm.stringWidth(Text.removeTags(this.right)) > this.size.width;
        const rightWidth = this.right ? Math.floor(this.size.width / 3) : 0;
        const left = wrap ? split(this.left, this.size.width - rightWidth, lm) : [this.left], right = wrap ? split(this.right, rightWidth, rm) : [this.right];
        const count = Math.max(left.length, right.length);
        for (let i = 0; i < count; i++) {
            const y = this.location.y + (i + 1) * height;
            if (left[i]) {
                const text = new TextComponent();
                text.setText(left[i]);
                text.setPosition(this.location.x, y);
                text.setColor(this.leftColor);
                text.setFont(lf);
                text.render(graphics);
            }
            if (right[i]) {
                const text = new TextComponent();
                text.setText(right[i]);
                text.setPosition(this.location.x + this.size.width - rm.stringWidth(Text.removeTags(right[i])), y);
                text.setColor(this.rightColor);
                text.setFont(rf);
                text.render(graphics);
            }
        }
        const result = new Dimension(this.size.width, count * height);
        this.bounds = new Rectangle(this.location, result);
        return result;
    }
}
class LineComponentBuilder {
    private readonly component = new LineComponent();
    left(value: string): this { this.component.setLeft(value); return this; }
    right(value: string): this { this.component.setRight(value); return this; }
    leftColor(value: Color): this { this.component.setLeftColor(value); return this; }
    rightColor(value: Color): this { this.component.setRightColor(value); return this; }
    leftFont(value: Font): this { this.component.setLeftFont(value); return this; }
    rightFont(value: Font): this { this.component.setRightFont(value); return this; }
    build(): LineComponent { return this.component; }
}
