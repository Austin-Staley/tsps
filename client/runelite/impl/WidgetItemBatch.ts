import type { WidgetItem } from "../api/widgets/WidgetItem";
import type { Widget } from "../api/widgets/Widget";
/** Interface hooks see the whole batch; layer hooks see only their drawn subtree. */
export function widgetItemsForHook(id: number, items: WidgetItem[]): WidgetItem[] {
    if ((id & 65535) === 65535) return items;
    return items.filter(item => {
        const seen = new Set<Widget>();
        for (let widget: Widget | null = item.getWidget(); widget && !seen.has(widget); widget = widget.getParent()) {
            if (widget.getId() === id) return true;
            seen.add(widget);
        }
        return false;
    });
}
