import { chatHistory, type ChatHistoryStore, type ChatMessage } from "../../rs/cs2/ChatHistory";
import type { MessageNode } from "../api/MessageNode";
import type { ChatMessageType } from "../api/ChatMessageType";
export class MessageNodeImpl implements MessageNode {
    private static readonly wrappers = new WeakMap<ChatMessage, MessageNodeImpl>();
    static wrap(message: ChatMessage, history: ChatHistoryStore = chatHistory): MessageNodeImpl {
        let wrapper = this.wrappers.get(message);
        if (!wrapper) { wrapper = new MessageNodeImpl(message, history); this.wrappers.set(message, wrapper); }
        return wrapper;
    }
    constructor(readonly message: ChatMessage, readonly history: ChatHistoryStore = chatHistory) {}
    getHash(): bigint { return this.history.getMessageHash(this.message); }
    getNext(): MessageNodeImpl | null { const message = this.history.getMessageNext(this.message); return message ? MessageNodeImpl.wrap(message, this.history) : null; }
    getPrevious(): MessageNodeImpl | null { const message = this.history.getMessagePrevious(this.message); return message ? MessageNodeImpl.wrap(message, this.history) : null; }
    getId(): number { return this.message.uid; }
    getType(): ChatMessageType { return this.message.type; }
    getName(): string { return this.message.from; }
    setName(value: string): void { this.message.from = value; }
    getSender(): string { return this.message.prefix; }
    setSender(value: string): void { this.message.prefix = value; }
    getValue(): string { return this.message.text; }
    setValue(value: string): void { this.message.text = value; }
    getTimestamp(): number { return Math.floor(this.message.timestamp / 1000); }
    setTimestamp(value: number): void { this.message.timestamp = value * 1000; }
    getRuneLiteFormatMessage(): string | null { return this.message.runeLiteFormatMessage ?? null; }
    setRuneLiteFormatMessage(value: string | null): void { this.message.runeLiteFormatMessage = value; }
}
