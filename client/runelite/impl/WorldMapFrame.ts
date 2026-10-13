import type { OsrsClient } from "../../game/OsrsClient";
import type { Client } from "../api/Client";
import { Point } from "../awt";
import type { WorldMapFrame } from "../client/ui/overlay/worldmap/WorldMapOverlay";
export function getWorldMapFrame(engine: OsrsClient, client: Client): WorldMapFrame | null {
    const state = engine.worldMapState, groups = new Set([engine.widgetManager.rootInterface, ...[...engine.widgetManager.interfaceParents.values()].map(parent => parent.group)]);
    const node = [...groups].flatMap(group => engine.widgetManager.getWidgetsForGroup(group)).find(widget => widget.contentType === 1400 && !widget.isHidden);
    const widget = node ? client.getWidget(node.uid) : null;
    if (!state?.isLoaded() || !state.currentArea || !widget || widget.isHidden())
        return null;
    const group = widget.getId() >>> 16;
    if (engine.widgetManager.rootInterface !== group && ![...engine.widgetManager.interfaceParents.values()].some(parent => parent.group === group))
        return null;
    const bounds = widget.getBounds();
    if (bounds.isEmpty())
        return null;
    const zoom = state.getZoomScale();
    const sx = zoom * bounds.width / widget.getWidth(), sy = zoom * bounds.height / widget.getHeight();
    return { bounds, mouse: client.getMouseCanvasPosition(), project(point) { const position = state.currentArea!.position(point.getPlane(), point.getX(), point.getY()); return position ? new Point(bounds.getCenterX() + (position.x - state.displayX) * sx, bounds.getCenterY() - (position.y - state.displayY) * sy) : null; }, jump(point) { state.jumpToSourceCoord(point.getPlane(), point.getX(), point.getY()); engine.widgetManager.invalidateAll(); } };
}
