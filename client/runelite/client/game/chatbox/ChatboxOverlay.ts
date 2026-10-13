import { Color, type Dimension, type Graphics2D, Rectangle } from "../../../awt";
import { Overlay } from "../../ui/overlay/Overlay";
import { OverlayLayer } from "../../ui/overlay/OverlayLayer";
import { OverlayPosition } from "../../ui/overlay/OverlayPosition";
import { OverlayUtil } from "../../ui/overlay/OverlayUtil";
import { Point } from "../../../awt/Point";
import { ChatboxPanelManager } from "./ChatboxPanelManager";
export class ChatboxOverlay extends Overlay {
    constructor(private readonly manager: ChatboxPanelManager, private readonly chatBounds: () => Rectangle | null) { super(); this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); this.setPriority(Overlay.PRIORITY_HIGHEST); }
    render(graphics: Graphics2D): Dimension | null {
        const input = this.manager.getCurrentInput(), rect = this.chatBounds();
        if (!input || !rect)
            return null;
        graphics.setColor(new Color(217, 206, 180));
        graphics.fillRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8);
        const metrics = graphics.getFontMetrics(), center = rect.getCenterX();
        const prompt = input.getPrompt(), value = input.getValue() + "*";
        OverlayUtil.renderTextLocation(graphics, new Point(center - metrics.stringWidth(prompt) / 2, rect.y + rect.height * .4), prompt, Color.BLACK);
        OverlayUtil.renderTextLocation(graphics, new Point(center - metrics.stringWidth(value) / 2, rect.y + rect.height * .65), value, Color.BLUE);
        return null;
    }
}
