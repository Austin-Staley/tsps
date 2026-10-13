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
import { Dimension, Graphics2D, Point, Rectangle, Color } from "../../../../awt";
import { Text } from "../../../util/Text";
import { Overlay } from "../Overlay";
import { OverlayLayer } from "../OverlayLayer";
import { OverlayPosition } from "../OverlayPosition";
import { TooltipManager } from "./TooltipManager";
import { TextComponent } from "../components/TextComponent";
export class TooltipOverlay extends Overlay {
    constructor(private readonly manager: TooltipManager, private readonly mouse: () => Point, private readonly canvas: () => Rectangle) { super(); this.setPosition(OverlayPosition.TOOLTIP); this.setLayer(OverlayLayer.ALWAYS_ON_TOP); }
    render(graphics: Graphics2D): Dimension | null {
        const tips = this.manager.getTooltips();
        if (!tips.length)
            return null;
        try {
            const lines = tips.flatMap(tip => tip.getText().split(/<br\s*\/?>(?:\r?\n)?|\r?\n/i));
            const metrics = graphics.getFontMetrics();
            const width = Math.max(...lines.map(line => metrics.stringWidth(Text.removeTags(line)))) + 8, height = lines.length * metrics.getHeight() + 8;
            const mouse = this.mouse(), canvas = this.canvas();
            const x = Math.max(canvas.x, Math.min(mouse.x + 8, canvas.getMaxX() - width)), y = Math.max(canvas.y, Math.min(mouse.y + 24, canvas.getMaxY() - height));
            graphics.setColor(new Color(70, 61, 50, 230));
            graphics.fillRect(x, y, width, height);
            graphics.setColor(Color.BLACK);
            graphics.drawRect(x, y, width, height);
            for (let i = 0; i < lines.length; i++) {
                const text = new TextComponent();
                text.setText(lines[i]);
                text.setPosition(x + 4, y + 4 + (i + 1) * metrics.getHeight());
                text.render(graphics);
            }
            return new Dimension(width, height);
        }
        finally {
            this.manager.clear();
        }
    }
}
