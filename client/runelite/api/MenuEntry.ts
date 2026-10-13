// RuneLite MenuEntry API. Original notices: ../LICENSE.txt.
import type { MenuAction } from "./MenuAction";
import type { Menu } from "./Menu";
import type { NPC } from "./NPC";
import type { Player } from "./Player";
import type { Actor } from "./Actor";
import type { Widget } from "./widgets/Widget";

export interface MenuEntry {
    getOption(): string; setOption(option: string): MenuEntry;
    getTarget(): string; setTarget(target: string): MenuEntry;
    getIdentifier(): number; setIdentifier(identifier: number): MenuEntry;
    getType(): MenuAction; setType(type: MenuAction): MenuEntry;
    getParam0(): number; setParam0(param0: number): MenuEntry;
    getParam1(): number; setParam1(param1: number): MenuEntry;
    getItemId(): number; setItemId(itemId: number): MenuEntry;
    getWorldViewId(): number; setWorldViewId(worldViewId: number): MenuEntry;
    isForceLeftClick(): boolean; setForceLeftClick(force: boolean): MenuEntry;
    isDeprioritized(): boolean; setDeprioritized(value: boolean): MenuEntry;
    onClick(): ((entry: MenuEntry) => void) | undefined;
    onClick(callback: (entry: MenuEntry) => void): MenuEntry;
    isItemOp(): boolean; getItemOp(): number;
    getWidget(): Widget | null; getNpc(): NPC | null; getPlayer(): Player | null; getActor(): Actor | null;
    getSubMenu(): Menu | null; createSubMenu(): Menu; deleteSubMenu(): void;
}
