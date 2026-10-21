import type { WidgetManager } from "../../widgets/WidgetManager";

/** The inventory interface (group 149). */
const INVENTORY_GROUP_ID = 149;
/** Longest the fade waits for the server's answer: one game tick. */
const INVENTORY_OP_FADE_MS = 600;

type InventoryOpFade = {
    widget: any;
    uid: number;
    itemId: number;
    quantity: number;
    until: number;
};

let fade: InventoryOpFade | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * An inventory item whose op was just sent (eaten, drunk, buried...) stays semi-transparent,
 * like it is while clicked, until the server changes the slot or a tick passes.
 */
export function markInventoryOpFade(widgetManager: WidgetManager | undefined, widget: any): void {
    if (!widget || ((widget.uid >>> 16) & 0xffff) !== INVENTORY_GROUP_ID) return;
    const itemId = typeof widget.itemId === "number" ? widget.itemId | 0 : -1;
    if (itemId <= 0) return;
    if (fade && fade.widget !== widget) widgetManager?.invalidateWidgetRender(fade.widget);
    fade = {
        widget,
        uid: widget.uid | 0,
        itemId,
        quantity: (widget.itemQuantity ?? 1) | 0,
        until: performance.now() + INVENTORY_OP_FADE_MS,
    };
    widgetManager?.invalidateWidgetRender(widget);
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => {
        expiryTimer = undefined;
        const expired = fade;
        fade = undefined;
        if (expired) widgetManager?.invalidateWidgetRender(expired.widget);
    }, INVENTORY_OP_FADE_MS);
}

/** Whether `w` is the faded inventory item, still holding what was clicked. */
export function isInventoryOpFaded(w: any, now: number = performance.now()): boolean {
    if (!fade || now >= fade.until || ((w?.uid ?? 0) | 0) !== fade.uid) return false;
    return (w.itemId | 0) === fade.itemId && ((w.itemQuantity ?? 1) | 0) === fade.quantity;
}
