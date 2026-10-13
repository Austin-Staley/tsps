// RuneLite event API. Original notices: ../../LICENSE.txt.
import type { MenuEntry } from "../MenuEntry";
export class MenuOptionClicked {
    private consumed = false;
    constructor(private readonly menuEntry: MenuEntry) {}
    getMenuEntry() { return this.menuEntry; }
    getParam0() { return this.menuEntry.getParam0(); }
    getParam1() { return this.menuEntry.getParam1(); }
    getMenuOption() { return this.menuEntry.getOption(); }
    getMenuTarget() { return this.menuEntry.getTarget(); }
    getMenuAction() { return this.menuEntry.getType(); }
    getId() { return this.menuEntry.getIdentifier(); }
    isItemOp() { return this.menuEntry.isItemOp(); }
    getItemOp() { return this.menuEntry.getItemOp(); }
    getItemId() { return this.menuEntry.getItemId(); }
    getWidget() { return this.menuEntry.getWidget(); }
    getActionParam() { return this.getParam0(); }
    getWidgetId() { return this.getParam1(); }
    consume() { this.consumed = true; }
    isConsumed() { return this.consumed; }
}
