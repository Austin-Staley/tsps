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
import { WORN_ITEMS } from "./WornItems";
import { ClientThread } from "../callback/ClientThread";
import { AsyncBufferedImage } from "../util/AsyncBufferedImage";
import type { ItemComposition } from "../../api/ItemComposition";
import type { BufferedImage } from "../../awt";
export interface ItemManagerSource {
    getItemComposition(id: number): ItemComposition;
    getItemPrice(id: number): number;
    getImage(id: number, quantity: number, stackable: boolean, scale: number): BufferedImage | null;
}
export class ItemManager {
    private readonly images = new Map<string, {
        image: AsyncBufferedImage;
        accessed: number;
    }>();
    constructor(private readonly source: ItemManagerSource, private readonly clientThread: ClientThread) { }
    getItemComposition(id: number): ItemComposition { return this.source.getItemComposition(id); }
    canonicalize(id: number): number {
        const item = this.getItemComposition(id);
        if (item.getNote() !== -1)
            return item.getLinkedNoteId();
        if (item.getPlaceholderTemplateId() !== -1)
            return item.getPlaceholderId();
        return WORN_ITEMS.get(id) ?? id;
    }
    getItemPrice(id: number): number { return this.source.getItemPrice(this.canonicalize(id)); }
    getImage(id: number, quantity = 1, stackable = false, scale = 1): AsyncBufferedImage | null {
        const key = `${id}:${quantity}:${stackable}:${scale}`, cached = this.images.get(key), now = Date.now();
        if (cached && now - cached.accessed < 3600000) {
            this.images.delete(key);
            cached.accessed = now;
            this.images.set(key, cached);
            return cached.image;
        }
        if (cached)
            this.images.delete(key);
        const image = new AsyncBufferedImage(this.clientThread, Math.max(1, Math.round(36 * scale)), Math.max(1, Math.round(32 * scale)));
        this.images.set(key, { image, accessed: now });
        if (this.images.size > 128)
            this.images.delete(this.images.keys().next().value!);
        this.clientThread.invoke(() => {
            const native = this.source.getImage(id, quantity, stackable, scale);
            if (!native)
                return false;
            const graphics = image.createGraphics();
            try {

                graphics.drawImage(native, 0, 0, null);
            }
            finally {
                graphics.dispose();
            }
            image.loaded();
            return true;
        });
        return image;
    }
    getItemStack(id: number, quantity: number, stackable: boolean): BufferedImage | null { return this.getImage(id, quantity, stackable); }
}
