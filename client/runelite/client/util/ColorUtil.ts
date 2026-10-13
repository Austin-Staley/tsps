/*
 * Copyright (c) 2018, Jordan Atwood <jordan.atwood423@gmail.com>
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
import { decodeJavaInteger } from "../../awt/Color";
import { Color } from "../../awt";
export class ColorUtil {
    static readonly CLOSING_COLOR_TAG = "</col>";
    static readonly MAX_RGB_VALUE = 255;
    static readonly MIN_RGB_VALUE = 0;
    static colorWithAlpha(color: Color, alpha: number): Color { return new Color(color.getRed(), color.getGreen(), color.getBlue(), alpha); }
    static colorToHexCode(color: Color): string { return (color.getRGB() & 0xffffff).toString(16).padStart(6, "0"); }
    static colorToAlphaHexCode(color: Color): string { return (color.getRGB() >>> 0).toString(16).padStart(8, "0"); }
    static fromHex(value: string): Color | null {
        const cleaned = value.replace(/^#/, "").replace(/^0x/i, "");
        if (!/^[\da-f]{1,8}$/i.test(cleaned))
            return null;
        return new Color(parseInt(cleaned, 16), cleaned.length > 6);
    }
    static toHexColor(color: Color): string { return "#" + this.colorToHexCode(color); }
    static toHexColorWithAlpha(color: Color): string { return "#" + this.colorToAlphaHexCode(color); }
    static colorTag(color: Color): string { return `<col=${this.colorToHexCode(color)}>`; }
    static colorLerp(a: Color, b: Color, t: number): Color { return this.lerp(a, b, t); }
    static isHex(value: string): boolean { return /^(?:#|0x)?[\da-f]{1,8}$/i.test(value); }
    static isAlphaHex(value: string): boolean { return /^(?:#|0x)?[\da-f]{7,8}$/i.test(value); }
    static constrainValue(value: number): number { return Math.max(0, Math.min(255, value)); }
    static fromString(value: string): Color | null {
        try {
            return new Color(decodeJavaInteger(value), true);
        }
        catch {
            return null;
        }
    }
    static prependColorTag(value: string, color: Color): string { return `<col=${ColorUtil.colorToHexCode(color)}>${value}`; }
    static wrapWithColorTag(value: string, color: Color): string { return ColorUtil.prependColorTag(value, color) + "</col>"; }
    static lerp(a: Color, b: Color, t: number): Color { return new Color(Math.round(a.getRed() + (b.getRed() - a.getRed()) * t), Math.round(a.getGreen() + (b.getGreen() - a.getGreen()) * t), Math.round(a.getBlue() + (b.getBlue() - a.getBlue()) * t), Math.round(a.getAlpha() + (b.getAlpha() - a.getAlpha()) * t)); }
}
