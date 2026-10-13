/*
 * Copyright (c) 2017, Levi <me@levischuck.com>
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
import { Client } from "../../../api/Client";
import { Plugin } from "../Plugin";
import { inject } from "../PluginInjector";
import { OverlayManager } from "../../ui/overlay/OverlayManager";
import { DrawManager } from "../../ui/DrawManager";
import { FpsConfig } from "./FpsConfig";
import { FpsOverlay } from "./FpsOverlay";
export class FpsPlugin extends Plugin {
    static descriptor = { name: "FPS Control", description: "Show current FPS and/or set an FPS limit", tags: ["frames", "framerate", "limit", "overlay"], enabledByDefault: false, configKey: "fpsplugin" };
    static config = FpsConfig;
    private readonly config = inject(FpsConfig);
    private readonly overlays = inject(OverlayManager);
    private readonly draws = inject(DrawManager);
    private readonly overlay = new FpsOverlay(this.config, inject(Client));
    private focused = true;
    protected async startUp(): Promise<void> { this.overlays.add(this.overlay); this.reloadConfig(); }
    protected async shutDown(): Promise<void> { this.overlays.remove(this.overlay); this.draws.setFpsLimit(null); }
    onConfigChanged(event: {
        getGroup(): string;
    }): void {
        if (event.getGroup() === "fpscontrol")
            this.reloadConfig();
    }
    onFocusChanged(event: {
        isFocused(): boolean;
    }): void { this.focused = event.isFocused(); this.overlay.onFocusChanged(event); this.reloadConfig(); }
    private reloadConfig(): void { const limited = this.config.limitFps() || (this.config.limitFpsUnfocused() && !this.focused); const fps = this.config.limitFpsUnfocused() && !this.focused ? this.config.maxFpsUnfocused() : this.config.maxFps(); this.draws.setFpsLimit(limited ? Math.max(1, fps) : null); }
}
