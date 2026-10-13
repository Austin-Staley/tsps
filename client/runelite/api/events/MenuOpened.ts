// RuneLite event API. Original notices: ../../LICENSE.txt.
import type { MenuEntry } from "../MenuEntry";
export class MenuOpened {
    constructor(private menuEntries: MenuEntry[]) {}
    getMenuEntries() { return this.menuEntries; }
    setMenuEntries(entries: MenuEntry[]) { this.menuEntries = entries; }
    getFirstEntry() { return this.menuEntries[this.menuEntries.length - 1] ?? null; }
}
