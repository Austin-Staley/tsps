// RuneLite Menu API. Original notices: ../LICENSE.txt.
import type { MenuEntry } from "./MenuEntry";
export abstract class Menu {
    abstract createMenuEntry(index: number): MenuEntry;
    abstract getMenuEntries(): MenuEntry[];
    abstract setMenuEntries(entries: MenuEntry[]): void;
    abstract removeMenuEntry(entry: MenuEntry): void;
    abstract getMenuX(): number;
    abstract getMenuY(): number;
    abstract getMenuWidth(): number;
    abstract getMenuHeight(): number;
}
