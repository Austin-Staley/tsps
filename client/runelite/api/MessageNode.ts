import type { Node } from "./Node";
import type { ChatMessageType } from "./ChatMessageType";
export interface MessageNode extends Node {
    getId(): number;
    getType(): ChatMessageType;
    getName(): string;
    setName(value: string): void;
    getSender(): string;
    setSender(value: string): void;
    getValue(): string;
    setValue(value: string): void;
    getTimestamp(): number;
    setTimestamp(value: number): void;
    getRuneLiteFormatMessage(): string | null;
    setRuneLiteFormatMessage(value: string | null): void;
}
