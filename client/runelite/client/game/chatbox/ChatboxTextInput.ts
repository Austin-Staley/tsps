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
import type { KeyEvent } from "../../../awt/event/KeyEvent";
import { KeyEvent as Keys } from "../../../awt/event/KeyEvent";
import type { ChatboxPanelManager } from "./ChatboxPanelManager";
// shortcut: single-line input without clipboard/IME, port the remaining editing actions when a plugin needs them.
/** Browser text editing for RuneLite's chatbox input contract. */
export class ChatboxTextInput {
    private promptText = "";
    private text = "";
    private selectionStart = 0;
    private selectionEnd = 0;
    private validator: (code: number) => boolean = code => code >= 32 && code !== 127;
    private done: ((value: string) => boolean | void) | null = null;
    private changed: ((value: string) => void) | null = null;
    private closed: (() => void) | null = null;
    constructor(private readonly manager: ChatboxPanelManager) { }
    prompt(value: string): this { this.promptText = value; return this; }
    getPrompt(): string { return this.promptText; }
    value(value: string): this { this.text = value; this.cursorAt(value.length); return this; }
    getValue(): string { return this.text; }
    cursorAt(start: number, end = start): this {
        if (start < 0 || end < start || end > this.text.length)
            throw new RangeError("Invalid text selection");
        this.selectionStart = start;
        this.selectionEnd = end;
        return this;
    }
    charValidator(validator: (code: number) => boolean): this { this.validator = validator; return this; }
    addCharValidator(validator: (code: number) => boolean): this { const previous = this.validator; this.validator = code => previous(code) && validator(code); return this; }
    onDone(callback: (value: string) => boolean | void): this { this.done = callback; return this; }
    onChanged(callback: (value: string) => void): this { this.changed = callback; return this; }
    onClose(callback: () => void): this { this.closed = callback; return this; }
    build(): this { this.manager.openInput(this); return this; }
    keyPressed(event: KeyEvent): void {
        if (!this.manager.shouldTakeInput())
            return;
        const key = event.getKeyCode();
        if (key === Keys.VK_ESCAPE) {
            this.manager.close();
            event.consume();
            return;
        }
        if (key === Keys.VK_ENTER) {
            if (this.done?.(this.text) !== false)
                this.manager.close();
            event.consume();
            return;
        }
        if (event.isControlDown() || event.isMetaDown()) {
            if (key === 65)
                this.cursorAt(0, this.text.length);
            else
                return;
            event.consume();
            return;
        }
        if (key === 8) {
            if (this.selectionStart === this.selectionEnd && this.selectionStart > 0)
                this.selectionStart--;
            this.replaceSelection("");
        }
        else if (key === 46) {
            if (this.selectionStart === this.selectionEnd && this.selectionEnd < this.text.length)
                this.selectionEnd++;
            this.replaceSelection("");
        }
        else if (key === 37)
            this.cursorAt(Math.max(0, this.selectionStart - 1));
        else if (key === 39)
            this.cursorAt(Math.min(this.text.length, this.selectionEnd + 1));
        else if (key === 36)
            this.cursorAt(0);
        else if (key === 35)
            this.cursorAt(this.text.length);
        else {
            const character = event.getKeyChar();
            if (character !== "\uffff" && this.validator(character.codePointAt(0)!))
                this.replaceSelection(character);
        }
        event.consume();
    }
    keyReleased(event: KeyEvent): void {
        if (this.manager.shouldTakeInput())
            event.consume();
    }
    close(): void { this.closed?.(); }
    private replaceSelection(value: string): void { this.text = this.text.slice(0, this.selectionStart) + value + this.text.slice(this.selectionEnd); this.cursorAt(this.selectionStart + value.length); this.manager.updateInput(this.text); this.changed?.(this.text); }
}
