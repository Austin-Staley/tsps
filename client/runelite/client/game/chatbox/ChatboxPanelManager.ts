/*
 * Copyright (c) 2018 Abex
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
import { GameState } from "../../../api/GameState";
import { ClientThread } from "../../callback/ClientThread";
import { KeyManager } from "../../input/KeyManager";
import { ChatboxTextInput } from "./ChatboxTextInput";
export interface ChatboxSource {
    open(value: string): void;
    update(value: string): void;
    close(): void;
    isAvailable(): boolean;
}
export class ChatboxPanelManager {
    private current: ChatboxTextInput | null = null;
    constructor(private readonly clientThread: ClientThread, private readonly keys: KeyManager, private readonly source: ChatboxSource) { }
    openTextInput(prompt: string): ChatboxTextInput { return new ChatboxTextInput(this).prompt(prompt); }
    openInput(input: ChatboxTextInput): void { this.clientThread.invokeLater(() => { this.close(); this.source.open(input.getValue()); this.current = input; this.keys.registerKeyListener(input); }); }
    onGameStateChanged(event: {
        getGameState(): GameState;
    }): void {
        if (event.getGameState() !== GameState.LOGGED_IN)
            this.close();
    }
    onWidgetClosed(event: {
        getGroupId(): number;
    }): void {
        if (event.getGroupId() === 162)
            this.close();
    }
    getCurrentInput(): ChatboxTextInput | null { return this.current; }
    shouldTakeInput(): boolean { return this.current !== null && this.source.isAvailable(); }
    updateInput(value: string): void {
        if (this.current)
            this.source.update(value);
    }
    close(): void {
        const input = this.current;
        if (!input)
            return;
        this.current = null;
        this.keys.unregisterKeyListener(input);
        this.source.close();
        input.close();
    }
}
