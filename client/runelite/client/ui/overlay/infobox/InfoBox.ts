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
import { InfoBoxPriority } from "./InfoBoxPriority";
import type { OverlayMenuEntry } from "../OverlayMenuEntry";
export abstract class InfoBox {
    private priority = InfoBoxPriority.NONE;
    private tooltip = "";
    private menuEntries: OverlayMenuEntry[] = [];
    constructor(private image: BufferedImage, private readonly plugin: Plugin) { }
    abstract getText(): string;
    abstract getTextColor(): Color;
    render(): boolean { return true; }
    cull(): boolean { return false; }
    getImage(): BufferedImage { return this.image; }
    setImage(image: BufferedImage): void { this.image = image; }
    getPlugin(): Plugin { return this.plugin; }
    getName(): string { return this.plugin.constructor.name + "_" + this.constructor.name; }
    getPriority(): InfoBoxPriority { return this.priority; }
    setPriority(priority: InfoBoxPriority): void { this.priority = priority; }
    getTooltip(): string { return this.tooltip; }
    setTooltip(text: string): void { this.tooltip = text; }
    getMenuEntries(): OverlayMenuEntry[] { return this.menuEntries; }
    setMenuEntries(entries: OverlayMenuEntry[]): void { this.menuEntries = entries; }
}
