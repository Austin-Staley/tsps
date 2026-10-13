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
import { Color, Dimension, Graphics2D, Rectangle } from "../../../../awt";
import { ComponentConstants } from "./ComponentConstants";
export class BackgroundComponent {
    private fill = true;
    constructor(private backgroundColor = ComponentConstants.STANDARD_BACKGROUND_COLOR, private rectangle = new Rectangle()) { }
    setBackgroundColor(color: Color): void { this.backgroundColor = color; }
    setRectangle(rectangle: Rectangle): void { this.rectangle = rectangle; }
    setFill(fill: boolean): void { this.fill = fill; }
    render(graphics: Graphics2D): Dimension {
        const color = this.backgroundColor, adjust = (factor: number) => new Color(Math.min(255, Math.trunc(color.getRed() * factor)), Math.min(255, Math.trunc(color.getGreen() * factor)), Math.min(255, Math.trunc(color.getBlue() * factor)), Math.min(255, Math.trunc(color.getAlpha() * 1.4)));
        if (this.fill) {
            graphics.setColor(color);
            graphics.fill(this.rectangle);
        }
        graphics.setColor(adjust(.8));
        graphics.draw(new Rectangle(this.rectangle.x, this.rectangle.y, this.rectangle.width - 1, this.rectangle.height - 1));
        graphics.setColor(adjust(1.2));
        graphics.draw(new Rectangle(this.rectangle.x + 1, this.rectangle.y + 1, this.rectangle.width - 3, this.rectangle.height - 3));
        return new Dimension(this.rectangle.width, this.rectangle.height);
    }
}
