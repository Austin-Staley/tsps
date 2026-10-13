/*
 * Copyright (c) 2017, Levi <me@levischuck.com>
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
import { Color, Point, Dimension, type Graphics2D } from "../../../awt";
import { Client } from "../../../api/Client";
import { Overlay } from "../../ui/overlay/Overlay";
import { OverlayLayer } from "../../ui/overlay/OverlayLayer";
import { OverlayPosition } from "../../ui/overlay/OverlayPosition";
import { OverlayUtil } from "../../ui/overlay/OverlayUtil";
import type { ConfigOf } from "../../config/ConfigItem";
import { FpsConfig } from "./FpsConfig";
import * as InterfaceID from "../../../api/gameval/InterfaceID";
export class FpsOverlay extends Overlay {
    private focused = true;
    constructor(private readonly config: ConfigOf<typeof FpsConfig>, private readonly client: Client) { super(); this.setLayer(OverlayLayer.ABOVE_WIDGETS); this.setPriority(Overlay.PRIORITY_HIGH); this.setPosition(OverlayPosition.DYNAMIC); }
    onFocusChanged(event: {
        isFocused(): boolean;
    }): void { this.focused = event.isFocused(); }
    render(graphics: Graphics2D): Dimension | null {
        if (!this.config.drawFps())
            return null;
        const logout = this.client.getWidget(InterfaceID.ToplevelPreEoc.ICON10), xOffset = 1 + (logout && !logout.isHidden() ? logout.getWidth() : 0);
        const text = this.client.getFPS() + " FPS", metrics = graphics.getFontMetrics(), point = new Point(this.client.getRealDimensions().getWidth() - metrics.stringWidth(text) - xOffset, metrics.getAscent() - metrics.getDescent() + 1);
        const enforced = this.config.limitFps() || (this.config.limitFpsUnfocused() && !this.focused);
        OverlayUtil.renderTextLocation(graphics, point, text, enforced ? Color.RED : Color.YELLOW);
        return new Dimension(this.client.getRealDimensions().getWidth(), metrics.getHeight() + 2);
    }
}
