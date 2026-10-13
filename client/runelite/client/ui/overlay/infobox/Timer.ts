/*
 * Copyright (c) 2017, Adam <Adam@sigterm.info>
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
import { BufferedImage, Color } from "../../../../awt";
import type { Plugin } from "../../../plugins/Plugin";
import { InfoBox } from "./InfoBox";
export type TimerUnit = "MILLIS" | "SECONDS" | "MINUTES" | "HOURS";
export class Timer extends InfoBox {
    private readonly startTime: number;
    private endTime: number;
    private duration: number;
    constructor(period: number, unit: TimerUnit, image: BufferedImage, plugin: Plugin, private readonly now: () => number = Date.now) {
        super(image, plugin);
        if (period <= 0)
            throw new RangeError("Non-positive timer period");
        this.startTime = now();
        this.duration = period * ({ MILLIS: 1, SECONDS: 1000, MINUTES: 60000, HOURS: 3600000 }[unit]);
        this.endTime = this.startTime + this.duration;
    }
    getText(): string { const seconds = Math.max(0, Math.trunc((this.endTime - this.now()) / 1000)); return `${Math.trunc(seconds % 3600 / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
    getTextColor(): Color { return Math.floor((this.endTime - this.now()) / 1000) < Math.floor(this.duration / 1000) * .1 ? Color.RED.brighter() : Color.WHITE; }
    render(): boolean { return this.now() <= this.endTime; }
    cull(): boolean { return this.now() >= this.endTime; }
    getStartTime(): number { return this.startTime; }
    getEndTime(): number { return this.endTime; }
    getDuration(): number { return this.duration; }
    setDuration(durationMillis: number): void {
        if (durationMillis < 0)
            throw new RangeError("Negative duration");
        this.duration = durationMillis;
        this.endTime = this.startTime + durationMillis;
    }
    updateDuration(durationMillis: number): void {
        if (durationMillis < 0)
            throw new RangeError("Negative duration");
        this.endTime = this.now() + durationMillis;
        this.duration = this.endTime - this.startTime;
    }
}
