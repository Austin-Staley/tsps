/*
 * Copyright (c) 2017, Tyler <https://github.com/tylerthardy>
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
import { Font } from "../../awt";
export class FontManager {
    private static readonly regular = new Font("RuneScape", Font.PLAIN, 16);
    private static readonly small = new Font("RuneScape Small", Font.PLAIN, 16);
    private static readonly bold = new Font("RuneScape Bold", Font.BOLD, 16);
    private static loaded: Promise<void> | undefined;
    static getFallbackFont(family: string, style: number, size: number): Font { return new Font(family, style, size); }
    static getRunescapeFont(): Font { return this.regular; }
    static getRunescapeSmallFont(): Font { return this.small; }
    static getRunescapeBoldFont(): Font { return this.bold; }
    static load(): Promise<void> { return this.loaded ??= this.loadFaces(); }
    private static async loadFaces(): Promise<void> {
        if (typeof document === "undefined" || typeof FontFace === "undefined")
            return;
        for (const [name, file] of [["RuneScape", "runescape.ttf"], ["RuneScape Small", "runescape_small.ttf"], ["RuneScape Bold", "runescape_bold.ttf"]]) {
            const face = new FontFace(name, `url(${process.env.PUBLIC_URL ?? ""}/runelite/fonts/${file})`,{weight:name.endsWith("Bold")?"bold":"normal"});
            await face.load();
            document.fonts.add(face);
        }
    }
}
