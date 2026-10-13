import { chatHistory, type ChatHistoryStore, type ChatMessage as HistoryMessage } from "../../../rs/cs2/ChatHistory";
import { ChatMessage } from "../../api/events/ChatMessage";
import type { EventBus } from "../../client/eventbus/EventBus";
import { MessageNodeImpl } from "../MessageNodeImpl";
export function bindChatEvents(bus: EventBus, history: ChatHistoryStore = chatHistory): () => void {
    const onInsert = (message: HistoryMessage) => {
        if (bus.hasSubscribers(ChatMessage)) bus.post(new ChatMessage(MessageNodeImpl.wrap(message, history)));
    };
    history.beforeInsertListeners.add(onInsert);
    return () => history.beforeInsertListeners.delete(onInsert);
}
