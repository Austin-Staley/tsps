import type { MessageNode } from "./MessageNode";
export interface ChatLineBuffer {
    getLines(): Array<MessageNode | null>;
    getLength(): number;
    removeMessageNode(node: MessageNode): void;
}
