import { Dimension, Point, Rectangle } from "../../../awt";
import { MouseEvent } from "../../../awt/event/MouseEvent";
import { Overlay } from "./Overlay";
import { OverlayManager } from "./OverlayManager";
import { OverlayPosition } from "./OverlayPosition";
import type { OverlayFrame } from "./OverlayRenderer";
/** Alt-drag and edge resizing use the same rendered bounds as overlay hit testing. */
export class OverlayInteraction {
    private drag: {
        overlay: Overlay;
        start: Point;
        bounds: Rectangle;
        edges: number;
    } | null = null;
    constructor(private readonly manager: OverlayManager, private readonly frame: () => OverlayFrame) { }
    mousePressed(event: MouseEvent): MouseEvent {
        if (!event.isAltDown())
            return event;
        const point = event.getPoint(), overlay = [...this.manager.getOverlays()].reverse().find(item => !item.getBounds().isEmpty() && item.getBounds().contains(point) && (item.isMovable() || item.isResizable()));
        if (!overlay)
            return event;
        if (event.getButton() === MouseEvent.BUTTON3) {
            if (overlay.isResettable())
                this.manager.resetOverlay(overlay);
            event.consume();
            return event;
        }
        if (event.getButton() !== MouseEvent.BUTTON1)
            return event;
        const bounds = overlay.getBounds();
        let edges = 0;
        if (overlay.isResizable()) {
            if (point.x - bounds.x < 5)
                edges |= 1;
            if (bounds.getMaxX() - point.x < 5)
                edges |= 2;
            if (point.y - bounds.y < 5)
                edges |= 4;
            if (bounds.getMaxY() - point.y < 5)
                edges |= 8;
        }
        if (!edges && !overlay.isMovable())
            return event;
        this.drag = { overlay, start: point, bounds: new Rectangle(bounds), edges };
        event.consume();
        return event;
    }
    mouseDragged(event: MouseEvent): MouseEvent {
        if (!this.drag)
            return event;
        const { overlay, start, bounds, edges } = this.drag, point = event.getPoint(), dx = point.x - start.x, dy = point.y - start.y;
        let x = bounds.x, y = bounds.y, width = bounds.width, height = bounds.height;
        if (edges) {
            if (edges & 1) {
                x += dx;
                width -= dx;
            }
            if (edges & 2)
                width += dx;
            if (edges & 4) {
                y += dy;
                height -= dy;
            }
            if (edges & 8)
                height += dy;
            const minimum = overlay.getMinimumSize();
            if (width < minimum) {
                if (edges & 1)
                    x -= minimum - width;
                width = minimum;
            }
            if (height < minimum) {
                if (edges & 4)
                    y -= minimum - height;
                height = minimum;
            }
            overlay.setPreferredSize(new Dimension(width, height));
        }
        else {
            x += dx;
            y += dy;
        }
        const parent = overlay.getParentBounds() ?? this.frame().canvas;
        x = Math.max(parent.x, Math.min(x, parent.getMaxX() - width));
        y = Math.max(parent.y, Math.min(y, parent.getMaxY() - height));
        overlay.setPreferredPosition(null);
        overlay.setPreferredLocation(new Point(x, y));
        overlay.setBounds(new Rectangle(x, y, width, height));
        event.consume();
        return event;
    }
    mouseReleased(event: MouseEvent): MouseEvent {
        if (!this.drag)
            return event;
        const { overlay, edges } = this.drag;
        if (!edges && overlay.isSnappable()) {
            const frame = this.frame(), point = event.getPoint(), area = frame.viewport, chat = frame.chatbox;
            const anchors: [
                OverlayPosition,
                Point
            ][] = [[OverlayPosition.TOP_LEFT, new Point(area.x, area.y)], [OverlayPosition.TOP_CENTER, new Point(area.getCenterX(), area.y)], [OverlayPosition.TOP_RIGHT, new Point(area.getMaxX(), area.y)], [OverlayPosition.BOTTOM_LEFT, new Point(area.x, area.getMaxY())], [OverlayPosition.BOTTOM_RIGHT, new Point(area.getMaxX(), area.getMaxY())], [OverlayPosition.CANVAS_TOP_RIGHT, new Point(frame.canvas.getMaxX(), frame.canvas.y)]];
            if (chat)
                anchors.push([OverlayPosition.ABOVE_CHATBOX_RIGHT, new Point(chat.getMaxX(), chat.y)]);
            const target = anchors.find(([, anchor]) => Math.abs(point.x - anchor.x) < 30 && Math.abs(point.y - anchor.y) < 30);
            if (target) {
                overlay.setPreferredLocation(null);
                overlay.setPreferredPosition(target[0] === overlay.getPosition() ? null : target[0]);
            }
        }
        this.manager.saveOverlay(overlay);
        this.drag = null;
        event.consume();
        return event;
    }
}
