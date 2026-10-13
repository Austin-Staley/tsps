/*
 * Copyright (c) 2016-2017, Adam <Adam@sigterm.info>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// Ported to TypeScript; Canvas2D and browser scheduling replace desktop implementations.
import { ChatMessageType } from "../../api/ChatMessageType";
export class QueuedMessage {
    constructor(private readonly type: ChatMessageType, private readonly value = "", private readonly name = "", private readonly sender = "", private readonly formatted: string | null = null, private readonly timestamp = 0) { }
    static builder(): QueuedMessageBuilder { return new QueuedMessageBuilder(); }
    getType(): ChatMessageType { return this.type; }
    getValue(): string { return this.value; }
    getName(): string { return this.name; }
    getSender(): string { return this.sender; }
    getRuneLiteFormattedMessage(): string | null { return this.formatted; }
    getTimestamp(): number { return this.timestamp; }
}
class QueuedMessageBuilder {
    private kind = ChatMessageType.GAMEMESSAGE;
    private message = "";
    private author = "";
    private from = "";
    private formatted: string | null = null;
    private time = 0;
    type(value: ChatMessageType): this { this.kind = value; return this; }
    value(value: string): this { this.message = value; return this; }
    name(value: string): this { this.author = value; return this; }
    sender(value: string): this { this.from = value; return this; }
    runeLiteFormattedMessage(value: string): this { this.formatted = value; return this; }
    timestamp(value: number): this { this.time = value; return this; }
    build(): QueuedMessage { return new QueuedMessage(this.kind, this.message, this.author, this.from, this.formatted, this.time); }
}
