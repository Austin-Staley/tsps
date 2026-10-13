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
import { Color, Dimension, Graphics2D, Point, Rectangle } from "../../../../awt";
import { TextComponent } from "./TextComponent";
import type { LayoutableRenderableEntity } from "./LayoutableRenderableEntity";
export class TitleComponent implements LayoutableRenderableEntity {
    private text = "";
    private color = Color.WHITE;
    private location = new Point();
    private size = new Dimension(129, 0);
    private bounds = new Rectangle();
    static builder(): TitleComponentBuilder { return new TitleComponentBuilder(); }
    setText(text: string): void { this.text = text; }
    setColor(color: Color): void { this.color = color; }
    setPreferredLocation(point: Point): void { this.location = point; }
    setPreferredSize(size: Dimension): void { this.size = size; }
    getBounds(): Rectangle { return this.bounds; }
    render(graphics: Graphics2D): Dimension { const metrics = graphics.getFontMetrics(); const text = new TextComponent(); text.setText(this.text); text.setColor(this.color); text.setPosition(this.location.x + (this.size.width - metrics.stringWidth(this.text)) / 2, this.location.y + metrics.getHeight()); const rendered = text.render(graphics); const result = new Dimension(this.size.width, rendered.height); this.bounds = new Rectangle(this.location, result); return result; }
}
class TitleComponentBuilder {
    private readonly component = new TitleComponent();
    text(value: string): this { this.component.setText(value); return this; }
    color(value: Color): this { this.component.setColor(value); return this; }
    build(): TitleComponent { return this.component; }
}
