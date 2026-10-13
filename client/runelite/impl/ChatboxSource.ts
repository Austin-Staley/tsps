import type { OsrsClient } from "../../game/OsrsClient";
import type { ChatboxSource } from "../client/game/chatbox/ChatboxPanelManager";
/** Uses the existing CS2 input mode/buffer, restoring a pre-existing dialog on close. */
export function createChatboxSource(engine: OsrsClient): ChatboxSource {
    let saved: {
        type: number;
        widget: number;
        value: string;
        varc: string;
    } | null = null;
    return {
        open(value) {
            if (engine.cs2Vm.inputDialogType > 1)
                throw new Error("A game dialog already owns keyboard input");
            saved = { type: engine.cs2Vm.inputDialogType, widget: engine.cs2Vm.inputDialogWidgetId, value: engine.cs2Vm.inputDialogString, varc: engine.varManager.getVarcString(335) ?? "" };
            engine.cs2Vm.inputDialogType = 1;
            this.update(value);
        },
        update(value) { engine.cs2Vm.inputDialogString = value; engine.varManager.setVarcString(335, value); engine.widgetManager.invalidateAll(); },
        close() {
            if (!saved)
                return;
            if (engine.cs2Vm.inputDialogType !== 1 || !engine.isLoggedIn()) {
                saved = null;
                return;
            }
            engine.cs2Vm.inputDialogType = saved.type;
            engine.cs2Vm.inputDialogWidgetId = saved.widget;
            engine.cs2Vm.inputDialogString = saved.value;
            engine.varManager.setVarcString(335, saved.varc);
            saved = null;
            engine.widgetManager.invalidateAll();
        },
        isAvailable() { return engine.isLoggedIn() && engine.cs2Vm.inputDialogType === 1; },
    };
}
