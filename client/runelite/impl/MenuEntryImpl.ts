// RuneLite MenuEntry API adapter. Original notices: ../LICENSE.txt.
import { MenuAction } from "../api/MenuAction";
import type { MenuEntry } from "../api/MenuEntry";
import type { Menu } from "../api/Menu";
import type { Client } from "../api/Client";
import type { SimpleMenuEntry } from "../../ui/menu/MenuEngine";
import { inferMenuOpcode } from "../../ui/menu/MenuState";
import { MenuTargetType } from "../../rs/MenuEntry";
import { MenuImpl } from "./MenuImpl";

export class MenuEntryImpl implements MenuEntry {
    private callback?: (entry: MenuEntry) => void;
    private subMenu?: MenuImpl;
    constructor(readonly row: SimpleMenuEntry, private readonly client: Client) {}
    getOption() { return this.row.option; }
    setOption(value: string): this { this.row.option = value; return this; }
    getTarget() { return this.row.target ?? ""; }
    setTarget(value: string): this { this.row.target = value; return this; }
    getIdentifier() { return this.row.identifier ?? this.row.npcServerId ?? this.row.playerServerId ?? this.row.targetId ?? 0; }
    setIdentifier(value: number): this {
        this.row.identifier = value; this.row.targetId = value;
        if (this.getNpc()) this.row.npcServerId = value;
        if (this.getPlayer()) this.row.playerServerId = value;
        return this;
    }
    getType() {
        const opcode = inferMenuOpcode(this.row);
        return MenuAction.of(opcode >= 2000 ? opcode - 2000 : opcode);
    }
    setType(value: MenuAction): this { this.row.opcode = value.getId(); return this; }
    getParam0() { return this.row.param0 ?? this.row.mapX ?? 0; }
    setParam0(value: number): this { this.row.param0 = value; this.row.mapX = value; return this; }
    getParam1() { return this.row.param1 ?? this.row.mapY ?? 0; }
    setParam1(value: number): this { this.row.param1 = value; this.row.mapY = value; return this; }
    getItemId() { return this.row.itemId ?? -1; }
    setItemId(value: number): this { this.row.itemId = value; return this; }
    getWorldViewId() { return this.row.worldViewId ?? -1; }
    setWorldViewId(value: number): this { this.row.worldViewId = value; return this; }
    isForceLeftClick() { return this.row.forceLeftClick ?? false; }
    setForceLeftClick(value: boolean): this { this.row.forceLeftClick = value; return this; }
    isDeprioritized() { return this.row.deprioritized ?? (this.row.opcode ?? 0) >= 2000; }
    setDeprioritized(value: boolean): this {
        this.row.deprioritized = value;
        this.row.opcode = this.getType().getId() + (value ? 2000 : 0);
        return this;
    }
    onClick(): ((entry: MenuEntry) => void) | undefined;
    onClick(callback: (entry: MenuEntry) => void): this;
    onClick(callback?: (entry: MenuEntry) => void): this | ((entry: MenuEntry) => void) | undefined {
        if (callback === undefined) return this.callback;
        this.callback = callback; return this;
    }
    isItemOp() { return this.getItemOp() > 0; }
    getItemOp() {
        const opcode = this.getType().getId();
        if (opcode >= 33 && opcode <= 37) return opcode - 32;
        if (opcode === 57 || opcode === 1007) {
            const widget = this.getWidget();
            if (widget && widget.getItemId() !== -1) {
                const operation = [2, 3, 4, 6, 7].indexOf(this.getIdentifier());
                return operation < 0 ? -1 : operation + 1;
            }
        }
        return -1;
    }
    getWidget() {
        const opcode = this.getType().getId();
        if (!((opcode >= 24 && opcode <= 43) || [57, 58, 1007].includes(opcode))) return null;
        const parent = this.client.getWidget(this.getParam1());
        return [57, 58, 1007].includes(opcode) && this.getParam0() >= 0
            ? parent?.getChild(this.getParam0()) ?? null : parent;
    }
    getNpc() {
        const opcode = this.getType().getId();
        return ((opcode >= 7 && opcode <= 13) || opcode === 1003 || this.row.targetType === MenuTargetType.NPC)
            ? this.client.getNpcs().find((npc) => npc.getIndex() === this.getIdentifier()) ?? null : null;
    }
    getPlayer() {
        const opcode = this.getType().getId();
        return ([14, 15].includes(opcode) || (opcode >= 44 && opcode <= 51) || this.row.targetType === MenuTargetType.PLAYER)
            ? this.client.getPlayers().find((player) => player.getId() === this.getIdentifier()) ?? null : null;
    }
    getActor() { return this.getNpc() ?? this.getPlayer(); }
    getSubMenu(): Menu | null { return this.subMenu ?? null; }
    createSubMenu(): Menu {
        const subMenu = this.subMenu = new MenuImpl(this.client);
        this.row.subEntries = [];
        subMenu.onChange = () => { this.row.subEntries = subMenu.toDisplayEntries(); };
        return this.subMenu;
    }
    deleteSubMenu() { this.subMenu = undefined; this.row.subEntries = undefined; }
}
