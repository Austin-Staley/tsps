import type { OsrsClient } from "../../game/OsrsClient";
import { ClientState } from "../../game/ClientState";
import type { ClientImpl } from "./ClientImpl";
import type { Preferences } from "../api/Preferences";
import type { Widget } from "../api/widgets/Widget";
import { WidgetImpl } from "./WidgetImpl";
import { getClientPreference, setClientPreference } from "../../game/preferences/ClientPreferences";
import { MenuAction } from "../api/MenuAction";
import { menuAction } from "../../ui/menu/MenuAction";

/** UI adapters share the native controller state, including drags and selected spells. */
export class ClientUiService {
    readonly preferences: Preferences;
    constructor(private readonly engine: OsrsClient, private readonly client: ClientImpl) {
        const volume = (value: number) => Math.max(0, Math.min(127, value | 0));
        this.preferences = {
            getRememberedUsername: () => getClientPreference("rememberedUsername") ?? null,
            setRememberedUsername: (username) => setClientPreference("rememberedUsername", username ?? undefined),
            getSoundEffectVolume: () => engine.cs2Vm.context.getSoundVolume!(),
            setSoundEffectVolume: value => engine.cs2Vm.context.setSoundVolume!(volume(value)),
            getAreaSoundEffectVolume: () => engine.cs2Vm.context.getAreaSoundVolume!(),
            setAreaSoundEffectVolume: value => engine.cs2Vm.context.setAreaSoundVolume!(volume(value)),
            getHideUsername: () => engine.loginState.isUsernameHidden,
        };
    }
    isDraggingWidget(): boolean { return this.engine.getWidgetInteractionState()?.isDraggingWidget ?? false; }
    getDraggedWidget(): Widget | null {
        const widget = this.engine.getWidgetInteractionState()?.clickedWidget;
        return widget ? this.client.wrapWidget(widget) : null;
    }
    getDraggedOnWidget(): Widget | null {
        const widget = this.engine.getWidgetInteractionState()?.draggedOnWidget;
        return widget ? this.client.wrapWidget(widget) : null;
    }
    setDraggedOnWidget(widget: Widget | null): void {
        const state = this.engine.getWidgetInteractionState();
        if (state) state.draggedOnWidget = widget instanceof WidgetImpl ? widget.node : null;
    }
    getDragTime(): number { return this.engine.getWidgetInteractionState()?.widgetDragDuration ?? 0; }
    isWidgetSelected(): boolean { return ClientState.isSpellSelected; }
    setWidgetSelected(selected: boolean): void { ClientState.isSpellSelected = selected; }
    getSelectedWidget(): Widget | null {
        if (!ClientState.isSpellSelected) return null;
        const parent = this.client.getWidget(ClientState.selectedSpellWidget);
        return ClientState.selectedSpellChildIndex >= 0
            ? parent?.getChild(ClientState.selectedSpellChildIndex) ?? null : parent;
    }
    getWorldHost(): string { return this.engine.loginState.serverAddress; }
    menuAction(param0: number, param1: number, type: MenuAction, id: number, itemId: number, option: string, target: string): void {
        const mouse = this.client.getMouseCanvasPosition();
        menuAction(param0, param1, type.getId(), id, itemId, option, target, mouse.x, mouse.y);
    }
}
