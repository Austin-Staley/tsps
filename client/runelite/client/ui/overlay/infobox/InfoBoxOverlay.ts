/*
 * Copyright (c) 2017, Seth <Sethtroll3@gmail.com>
 * Copyright (c) 2017, Adam <Adam@sigterm.info>
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
import { Overlay } from "../Overlay";
import { OverlayLayer } from "../OverlayLayer";
import { OverlayPosition } from "../OverlayPosition";
import { InfoBoxManager } from "./InfoBoxManager";
import { Tooltip } from "../tooltip/Tooltip";
import { TooltipManager } from "../tooltip/TooltipManager";
import { TextComponent } from "../components/TextComponent";
export class InfoBoxOverlay extends Overlay {
    constructor(private readonly manager: InfoBoxManager, private readonly tooltips: TooltipManager, private readonly mouse: () => Point) { super(); this.setLayer(OverlayLayer.ABOVE_WIDGETS); this.setPosition(OverlayPosition.TOP_LEFT); }
    render(graphics: Graphics2D): Dimension | null {
        this.manager.cull();
        const boxes = this.manager.getInfoBoxes().filter(box => box.render());
        if (!boxes.length)
            return null;
        const side = 35, gap = 2;
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i], x = i * (side + gap);
            graphics.setColor(new Color(70, 61, 50, 156));
            graphics.fillRect(x, 0, side, side);
            const image = box.getImage();
            graphics.drawImage(image, x + (side - image.getWidth()) / 2, (side - image.getHeight()) / 2, null);
            const text = new TextComponent();
            text.setText(box.getText());
            text.setColor(box.getTextColor());
            text.setPosition(x + (side - graphics.getFontMetrics().stringWidth(box.getText())) / 2, side - 2);
            text.render(graphics);
            const bounds = this.getBounds();
            if (box.getTooltip() && new Rectangle(bounds.x + x, bounds.y, side, side).contains(this.mouse()))
                this.tooltips.add(new Tooltip(box.getTooltip()));
        }
        return new Dimension(boxes.length * (side + gap) - gap, side);
    }
}
