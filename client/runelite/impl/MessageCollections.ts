import { chatHistory, type ChatHistoryStore } from "../../rs/cs2/ChatHistory";
import type { IterableHashTable } from "../api/IterableHashTable";
import type { ChatLineBuffer } from "../api/ChatLineBuffer";
import type { MessageNode } from "../api/MessageNode";
import { MessageNodeImpl } from "./MessageNodeImpl";
export class MessageHashTable implements IterableHashTable<MessageNode> {
    constructor(private readonly history: ChatHistoryStore = chatHistory) {}
    get(hash: bigint | number): MessageNode | null { const message = this.history.getMessageByHash(BigInt(hash)); return message ? MessageNodeImpl.wrap(message, this.history) : null; }
    put(node: MessageNode, hash: bigint | number): void {
        if (!(node instanceof MessageNodeImpl) || node.history !== this.history) throw new TypeError("Message node belongs to another history");
        this.history.putMessageHash(node.message, BigInt(hash));
    }
    [Symbol.iterator](): Iterator<MessageNode> { return this.history.getAllMessageNodes().map(message => MessageNodeImpl.wrap(message, this.history))[Symbol.iterator](); }
}
export class ChatLineBufferImpl implements ChatLineBuffer {
    constructor(private readonly type: number, private readonly history: ChatHistoryStore = chatHistory) {}
    getLines(): Array<MessageNode | null> { const lines: Array<MessageNode | null> = new Array(100).fill(null); this.history.getMessagesOfType(this.type).forEach((message, i) => { lines[i] = MessageNodeImpl.wrap(message, this.history); }); return lines; }
    getLength(): number { return this.history.getLength(this.type); }
    removeMessageNode(node: MessageNode): void { if (!(node instanceof MessageNodeImpl) || node.history !== this.history) throw new TypeError("Message node belongs to another history"); if (node.message.type === this.type) this.history.removeMessage(node.message); }
}
export class ChatLineMap extends Map<number, ChatLineBuffer> {
    constructor(private readonly history: ChatHistoryStore = chatHistory) { super(); }
    sync(): this { const types = new Set(this.history.getMessageTypes()); for (const key of this.keys()) if (!types.has(key)) this.delete(key); for (const type of types) if (!this.has(type)) this.set(type, new ChatLineBufferImpl(type, this.history)); return this; }
}
