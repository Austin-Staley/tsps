/*
 * Copyright (c) 2018, Joshua Filby <joshua@filby.me>
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
export class Text {
    static removeTags(value: string): string { return value.replace(/<[^>]*>/g, ""); }
    static standardize(value: string): string { return Text.removeTags(value).replace(/\u00a0/g, " ").trim().toLowerCase(); }
    static sanitize(value: string): string { return (value.includes("<img") ? value.slice(value.lastIndexOf(">") + 1) : value).replace(/\u00a0/g, " "); }
    static toJagexName(value: string): string { return value.replace(/[\u00a0_-]/g, " ").replace(/[^\x00-\x7f]/g, "").trim(); }
    static escapeJagex(value: string): string { return value.replace(/[<>@\n\r]/g, character => ({ "<": "<lt>", ">": "<gt>", "@": "<at>", "\n": "<br>", "\r": "" }[character]!)); }
    static toCSV(values: Iterable<string>): string { return [...values].join(","); }
    static fromCSV(value: string): string[] { return value.split(",").map(part => part.trim()).filter(Boolean); }
    static titleCase(value: string): string { return value.toLowerCase().replace(/(^|_)\S/g, part => part.toUpperCase()).replace(/_/g, " "); }
    static unescapeJagex(value: string): string { return value.replace(/<([^>]*)>/g, (_tag, kind: string) => ({ br: "\n", n: "\n", lt: "<", gt: ">", at: "@", nbh: "-" }[kind] ?? "")); }
    static removeFormattingTags(value: string): string { return value.replace(/<([^>]*)>/g, (tag, kind: string) => ["lt", "gt", "at", "nbh"].includes(kind) ? tag : ""); }
    static sanitizeMultilineText(value: string): string { return this.removeTags(value.replace(/-<(br|n)>/g, "-").replace(/<(br|n)>/g, " ").replace(/ +/g, " ")); }
    static matchesSearchTerms(terms: Iterable<string>, keywords: Iterable<string>): boolean { const words = [...keywords]; return [...terms].every(term => words.some(word => word.includes(term) || this.jaroWinkler(word, term) > .9)); }
    private static jaroWinkler(a: string, b: string): number {
        if (a === b)
            return 1;
        if (!a.length || !b.length)
            return 0;
        const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1), am = new Array(a.length).fill(false), bm = new Array(b.length).fill(false);
        let matches = 0;
        for (let i = 0; i < a.length; i++)
            for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++)
                if (!bm[j] && a[i] === b[j]) {
                    am[i] = bm[j] = true;
                    matches++;
                    break;
                }
        if (!matches)
            return 0;
        let transpositions = 0, index = 0;
        for (let i = 0; i < a.length; i++)
            if (am[i]) {
                while (!bm[index])
                    index++;
                if (a[i] !== b[index++])
                    transpositions++;
            }
        const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
        let prefix = 0;
        while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix])
            prefix++;
        return jaro < .7 ? jaro : jaro + .1 * prefix * (1 - jaro);
    }
}
