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
import { Color, Dimension, Font, Graphics2D, Point, Rectangle } from "../../../../awt";
import { Text } from "../../../util/Text";
export class TextComponent {
    private text = "";
    private color = Color.WHITE;
    private position = new Point();
    private font: Font | null = null;
    private shadow = true;
    private outline = false;
    setText(text: string): void { this.text = text; }
    getText(): string { return this.text; }
    setColor(color: Color): void { this.color = color; }
    setPosition(point: Point): void;
    setPosition(x: number, y: number): void;
    setPosition(x: Point | number, y?: number): void { this.position = x instanceof Point ? x : new Point(x, y!); }
    setFont(font: Font): void { this.font = font; }
    setShadow(shadow: boolean): void { this.shadow = shadow; }
    setOutline(outline: boolean): void { this.outline = outline; }
    render(graphics: Graphics2D): Dimension {
        const g = graphics.create();
        try {
            if (this.font)
                g.setFont(this.font);
            const metrics = g.getFontMetrics();
            let x = this.position.x;
            const y = this.position.y;
            let color = this.color;
            for (const part of this.text.split(/(<[^>]+>)/g)) {
                const match = /^<col=([\da-f]+)>$/i.exec(part);
                if (match) {
                    color = new Color(parseInt(match[1], 16));
                    continue;
                }
                if (part === "</col>") {
                    color = this.color;
                    continue;
                }
                if (part.startsWith("<") && part !== "<lt>" && part !== "<gt>")
                    continue;
                const text = part === "<lt>" ? "<" : part === "<gt>" ? ">" : part;
                if (this.shadow || this.outline) {
                    g.setColor(Color.BLACK);
                    if (this.outline)
                        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
                            g.drawString(text, x + dx, y + dy);
                    else
                        g.drawString(text, x + 1, y + 1);
                }
                g.setColor(color);
                g.drawString(text, x, y);
                x += metrics.stringWidth(text);
            }
            return new Dimension(metrics.stringWidth(Text.removeTags(this.text)), metrics.getHeight());
        }
        finally {
            g.dispose();
        }
    }
    getBounds(): Rectangle { return new Rectangle(this.position.x, this.position.y, 0, 0); }
}
