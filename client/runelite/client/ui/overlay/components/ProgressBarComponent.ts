/*
 * Copyright (c) 2018, Cameron <moberg@tuta.io>
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
import { TextComponent } from "./TextComponent";
export enum LabelDisplayMode {
    PERCENTAGE,
    FULL,
    TEXT_ONLY,
    BOTH
}
export class ProgressBarComponent implements LayoutableRenderableEntity {
    static readonly LabelDisplayMode = LabelDisplayMode;
    private value = 0;
    private minimum = 0;
    private maximum = 100;
    private labelDisplayMode = LabelDisplayMode.PERCENTAGE;
    private centerLabel = "";
    private leftLabel: string | null = null;
    private rightLabel: string | null = null;
    private location = new Point();
    private size = new Dimension(129, 16);
    private bounds = new Rectangle();
    private foreground = new Color(82, 161, 82);
    private background = new Color(255, 255, 255, 127);
    private fontColor = Color.WHITE;
    setValue(value: number): void { this.value = value; }
    setMinimum(value: number): void { this.minimum = value; }
    setMaximum(value: number): void { this.maximum = value; }
    setForegroundColor(color: Color): void { this.foreground = color; }
    setBackgroundColor(color: Color): void { this.background = color; }
    setFontColor(color: Color): void { this.fontColor = color; }
    setLabelDisplayMode(mode: LabelDisplayMode): void { this.labelDisplayMode = mode; }
    setCenterLabel(label: string): void { this.centerLabel = label; }
    setLeftLabel(label: string): void { this.leftLabel = label; }
    setRightLabel(label: string): void { this.rightLabel = label; }
    setPreferredLocation(point: Point): void { this.location = point; }
    setPreferredSize(size: Dimension): void { this.size = size; }
    getBounds(): Rectangle { return this.bounds; }
    render(graphics: Graphics2D): Dimension {
        const metrics = graphics.getFontMetrics(), span = this.maximum - this.minimum, current = this.value - this.minimum, ratio = current / span, width = this.size.width, height = Math.max(this.size.height, 16);
        const percent = (ratio * 100).toFixed(1) + "%", full = Math.floor(current) + "/" + this.maximum;
        let label = this.labelDisplayMode === LabelDisplayMode.TEXT_ONLY ? "" : this.labelDisplayMode === LabelDisplayMode.PERCENTAGE ? percent : this.labelDisplayMode === LabelDisplayMode.BOTH ? `${full} (${percent})` : full;
        if (this.centerLabel)
            label += (label ? " " : "") + this.centerLabel;
        const fill = Number.isNaN(ratio) ? 0 : Math.trunc(width * Math.min(1, ratio)), x = this.location.x, y = this.location.y;
        graphics.setColor(this.background);
        graphics.fillRect(x + fill, y, width - fill, height);
        graphics.setColor(this.foreground);
        graphics.fillRect(x, y, fill, height);
        const baseline = y + (height - metrics.getHeight()) / 2 + metrics.getHeight(), draw = (text: string, tx: number) => { const component = new TextComponent(); component.setText(text); component.setColor(this.fontColor); component.setPosition(tx, baseline); component.render(graphics); };
        draw(label, x + (width - metrics.stringWidth(label)) / 2);
        if (this.leftLabel !== null)
            draw(this.leftLabel, x + 4);
        if (this.rightLabel !== null)
            draw(this.rightLabel, x + width - metrics.stringWidth(this.rightLabel) - 4);
        const result = new Dimension(width, height);
        this.bounds = new Rectangle(this.location, result);
        return result;
    }
}
