/*
 * Copyright (c) 2017, Tomas Slusny <slusnucky@gmail.com>
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
import { Client } from "../../api/Client";
import { ChatMessageType } from "../../api/ChatMessageType";
import { Color } from "../../awt";
import { ColorUtil } from "../util/ColorUtil";
import { ClientThread } from "../callback/ClientThread";
import { ChatColorType } from "./ChatColorType";
import { QueuedMessage } from "./QueuedMessage";
export class ChatMessageManager {
    private readonly colors = new Map<string, Color>();
    constructor(private readonly client: Client, private readonly clientThread: ClientThread) { }
    cacheColor(type: ChatMessageType, colorType: ChatColorType, color: Color, transparent: boolean): void { this.colors.set(`${type}:${colorType}:${transparent}`, color); }
    queue(message: QueuedMessage): void {
        this.clientThread.invokeLater(() => {
            const value = this.format(message.getType(), message.getRuneLiteFormattedMessage() ?? message.getValue());
            const node = this.client.addChatMessage(message.getType(), message.getName(), value, message.getSender());
            if (message.getTimestamp())
                node.setTimestamp(message.getTimestamp());
            this.client.refreshChat();
        });
    }
    private format(type: ChatMessageType, value: string): string { return value.replace(/<col(NORMAL|HIGHLIGHT)>/g, (_tag, kind: string) => { const color = this.colors.get(`${type}:${kind}:false`); return color ? `<col=${ColorUtil.colorToHexCode(color)}>` : "</col>"; }); }
}
