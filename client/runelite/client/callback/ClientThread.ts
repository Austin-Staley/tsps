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
export type ClientTask = () => boolean | void;
/** Client-thread invocation and retry semantics over the browser's single client loop. */
export class ClientThread {
    private queued: ClientTask[] = [];
    private tickEnd: ClientTask[] = [];
    private active = false;
    private disposed = false;
    constructor(private readonly onError: (error: unknown) => void = error => console.error("[ClientThread]", error)) { }
    isClientThread(): boolean { return this.active; }
    beginClientTick(beforeTasks?: () => void): void {
        if (this.disposed) return;
        this.active = true;
        beforeTasks?.();
        if (!this.disposed) this.drain(this.queued);
    }
    endClientTick(): void { this.active = false; }
    invoke(task: ClientTask): void {
        if (this.disposed) return;
        if (this.active) {
            this.run(task, this.queued);
        }
        else
            this.invokeLater(task);
    }
    invokeLater(task: ClientTask): void { if (!this.disposed) this.queued.push(task); }
    invokeAtTickEnd(task: ClientTask): void { if (!this.disposed) this.tickEnd.push(task); }
    runClientTick(callback: () => void): void {
        if (this.disposed) return;
        const previous = this.active;
        this.active = true;
        try {
            this.drain(this.queued);
            callback();
        }
        finally {
            this.active = this.disposed ? false : previous;
        }
    }
    runTickEnd(): void {
        if (this.disposed) return;
        const previous = this.active;
        this.active = true;
        try {
            this.drain(this.tickEnd);
        }
        finally {
            this.active = this.disposed ? false : previous;
        }
    }
    dispose(): void { this.disposed = true; this.active = false; this.queued.length = 0; this.tickEnd.length = 0; }
    private drain(queue: ClientTask[]): void {
        const tasks = queue.splice(0);
        for (const task of tasks) {
            if (this.disposed) return;
            this.run(task, queue);
        }
    }
    private run(task: ClientTask, queue: ClientTask[]): void {
        try {
            if (task() === false && !this.disposed)
                queue.push(task);
        }
        catch (error) {
            this.onError(error);
        }
    }
}
