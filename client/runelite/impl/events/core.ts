import { ClientState } from "../../../game/ClientState";
import { WidgetInteractionController } from "../../../game/widgets/WidgetInteractionController";
import type { Cs2Vm } from "../../../rs/cs2/Cs2Vm";
import { GrandExchangeSearched, PlayerMenuOptionsChanged, WidgetDrag } from "../../api/events";
import type { EventBus } from "../../client/eventbus/EventBus";
export function bindCoreInputEvents(bus: EventBus): () => void {
    const options = (index: number) => bus.post(new PlayerMenuOptionsChanged(index));
    const drag = () => bus.post(new WidgetDrag());
    ClientState.playerOptionsChangedListeners.add(options);
    WidgetInteractionController.dragListeners.add(drag);
    return () => { ClientState.playerOptionsChangedListeners.delete(options); WidgetInteractionController.dragListeners.delete(drag); };
}
export function bindSearchEvents(vm: Cs2Vm, bus: EventBus): () => void {
    const search = () => { const event = new GrandExchangeSearched(); bus.post(event); return event.isConsumed(); };
    vm.itemSearchListeners.add(search);
    return () => vm.itemSearchListeners.delete(search);
}
