import type { MessageNode } from "../MessageNode";
import type { ChatMessageType } from "../ChatMessageType";
/** Writes through to the pending history node, before insertion and chat-transmit scripts. */
export class ChatMessage {
    constructor(private readonly node: MessageNode) {}
    getMessageNode(): MessageNode { return this.node; }
    getType(): ChatMessageType { return this.node.getType(); }
    getName(): string { return this.node.getName(); }
    setName(value: string): void { this.node.setName(value); }
    getMessage(): string { return this.node.getValue(); }
    setMessage(value: string): void { this.node.setValue(value); }
    getSender(): string { return this.node.getSender(); }
    setSender(value: string): void { this.node.setSender(value); }
    getTimestamp(): number { return this.node.getTimestamp(); }
    setTimestamp(value: number): void { this.node.setTimestamp(value); }
}
