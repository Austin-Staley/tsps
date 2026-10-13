import { MenuAction } from "../api/MenuAction";
import type { Client } from "../api/Client";
import { MenuEntryAdded } from "../api/events/MenuEntryAdded";
import { MenuOpened } from "../api/events/MenuOpened";
import { MenuOptionClicked } from "../api/events/MenuOptionClicked";
import { MenuShouldLeftClick } from "../api/events/MenuShouldLeftClick";
import { PostMenuSort } from "../api/events/PostMenuSort";
import type { EventBus } from "../client/eventbus/EventBus";
import { setMenuEventHooks, type MenuActionData } from "../../ui/menu/menuEvents";
import { MenuEntryImpl } from "./MenuEntryImpl";
import { MenuImpl } from "./MenuImpl";

export function bindMenuEvents(client: Client, menu: MenuImpl, bus: EventBus): () => void {
    return setMenuEventHooks({
        prepare(rows, context) {
            if (context.surface !== "world") {
                for (const row of rows) {
                    row.param0 ??= context.childIndex;
                    row.param1 ??= context.widgetId;
                    row.itemId ??= context.itemId;
                    const op = (row as { opIndex?: number }).opIndex;
                    row.identifier ??= op ?? (row.opcode === 25 ? 0 : 1);
                    row.opcode ??= row.option === "Cancel" ? 1006 : op === 0 ? 25 : row.option === "Continue" ? 30 : 57;
                }
            }
            menu.setDisplayEntries([]);
            for (const row of [...rows].reverse()) {
                menu.setDisplayEntries([row, ...menu.toDisplayEntries()]);
                bus.post(new MenuEntryAdded(menu.getMenuEntries().at(-1)!));
            }
            return menu.toDisplayEntries();
        },
        build(rows) {
            menu.setDisplayEntries(rows);
            bus.post(new PostMenuSort());
            return menu.toDisplayEntries();
        },
        opened(rows) {
            menu.setDisplayEntries(rows);
            const entries = menu.getMenuEntries();
            const event = new MenuOpened(entries);
            bus.post(event);
            if (event.getMenuEntries() !== entries) menu.setMenuEntries(event.getMenuEntries());
            return menu.toDisplayEntries();
        },
        shouldOpen(open) {
            const event = new MenuShouldLeftClick();
            bus.post(event);
            return open || event.isForceRightClick();
        },
        click(action: MenuActionData) {
            const entry = menu.getMenuEntries().find((candidate) =>
                candidate.getOption() === action.option && candidate.getIdentifier() === action.identifier &&
                candidate.getParam0() === action.param0 && candidate.getParam1() === action.param1 &&
                candidate.getType().getId() === (action.opcode >= 2000 ? action.opcode - 2000 : action.opcode)) ??
                new MenuEntryImpl({ option: action.option, target: action.target, identifier: action.identifier,
                    param0: action.param0, param1: action.param1, opcode: action.opcode, itemId: action.itemId }, client);
            const event = new MenuOptionClicked(entry);
            bus.post(event);
            if (event.isConsumed()) return true;
            entry.onClick()?.(entry);
            Object.assign(action, { option: entry.getOption(), target: entry.getTarget(), identifier: entry.getIdentifier(),
                param0: entry.getParam0(), param1: entry.getParam1(), itemId: entry.getItemId(), opcode: entry.getType().getId() });
            return [MenuAction.RUNELITE, MenuAction.RUNELITE_HIGH_PRIORITY, MenuAction.RUNELITE_LOW_PRIORITY,
                MenuAction.RUNELITE_WIDGET, MenuAction.RUNELITE_PLAYER, MenuAction.RUNELITE_OVERLAY,
                MenuAction.RUNELITE_OVERLAY_CONFIG, MenuAction.RUNELITE_INFOBOX].includes(entry.getType());
        },
    });
}
