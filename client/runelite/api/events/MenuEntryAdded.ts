// RuneLite event API. Original notices: ../../LICENSE.txt.
import type { MenuEntry } from "../MenuEntry";
export class MenuEntryAdded {
    constructor(private readonly menuEntry: MenuEntry) {}
    getMenuEntry() { return this.menuEntry; }
    getOption() { return this.menuEntry.getOption(); }
    getTarget() { return this.menuEntry.getTarget(); }
    getType() { return this.menuEntry.getType().getId(); }
    getIdentifier() { return this.menuEntry.getIdentifier(); }
    getActionParam0() { return this.menuEntry.getParam0(); }
    getActionParam1() { return this.menuEntry.getParam1(); }
    getItemId() { return this.menuEntry.getItemId(); }
}
