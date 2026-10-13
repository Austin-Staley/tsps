// RuneLite Menu API adapter. Original notices: ../LICENSE.txt.
import { Menu } from "../api/Menu";
import { MenuAction } from "../api/MenuAction";
import type { MenuEntry } from "../api/MenuEntry";
import type { Client } from "../api/Client";
import type { SimpleMenuEntry } from "../../ui/menu/MenuEngine";
import { MenuEntryImpl } from "./MenuEntryImpl";

export class MenuImpl extends Menu {
    private entries: MenuEntryImpl[] = [];
    private readonly wrappers = new WeakMap<SimpleMenuEntry, MenuEntryImpl>();
    onChange?: () => void;
    constructor(private readonly client: Client,
        private readonly bounds: () => { x: number; y: number; width: number; height: number } = () => ({ x: 0, y: 0, width: 0, height: 0 })) { super(); }
    setDisplayEntries(rows: SimpleMenuEntry[]) {
        this.entries = rows.map((row) => {
            let entry = this.wrappers.get(row);
            if (!entry) { entry = new MenuEntryImpl(row, this.client); this.wrappers.set(row, entry); }
            return entry;
        }).reverse();
    }
    toDisplayEntries() { return this.entries.map((entry) => entry.row).reverse(); }
    createMenuEntry(index: number): MenuEntryImpl {
        const position = index < 0 ? this.entries.length + index + 1 : index;
        if (!Number.isInteger(index) || position < 0 || position > this.entries.length) throw new RangeError("Menu entry index out of range");
        const entry = new MenuEntryImpl({ option: "", target: "", opcode: MenuAction.RUNELITE.getId() }, this.client);
        this.wrappers.set(entry.row, entry);
        this.entries.splice(position, 0, entry); this.onChange?.(); return entry;
    }
    getMenuEntries(): MenuEntryImpl[] { return this.entries.slice(); }
    setMenuEntries(entries: MenuEntry[]) {
        if (entries.some((entry) => !(entry instanceof MenuEntryImpl))) throw new TypeError("Entries must be created through this client");
        this.entries = entries.slice() as MenuEntryImpl[]; this.onChange?.();
    }
    removeMenuEntry(entry: MenuEntry) { this.entries = this.entries.filter((value) => value !== entry); this.onChange?.(); }
    getMenuX() { return this.bounds().x; }
    getMenuY() { return this.bounds().y; }
    getMenuWidth() { return this.bounds().width; }
    getMenuHeight() { return this.bounds().height; }
}
