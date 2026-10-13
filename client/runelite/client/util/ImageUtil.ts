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
import { BufferedImage } from "../../awt";
export class ImageUtil {
    static async loadImageResource(path: string): Promise<BufferedImage> {
        if (typeof Image !== "undefined") {
            const image = new Image();
            image.src = path;
            await image.decode();
            return new BufferedImage(image);
        }
        const response = await fetch(path);
        if (!response.ok)
            throw new Error(`Unable to load image ${path}: ${response.status}`);
        return new BufferedImage(await createImageBitmap(await response.blob()));
    }
    static resizeImage(image: BufferedImage, width: number, height: number): BufferedImage {
        const result = new BufferedImage(width, height), g = result.createGraphics();
        try {
            g.drawImage(image, 0, 0, width, height, null);
        }
        finally {
            g.dispose();
        }
        return result;
    }
    static rotateImage(image: BufferedImage, radians: number): BufferedImage {
        const result = new BufferedImage(image.getWidth(), image.getHeight()), g = result.createGraphics();
        try {
            g.rotate(radians, image.getWidth() / 2, image.getHeight() / 2);
            g.drawImage(image, 0, 0, null);
        }
        finally {
            g.dispose();
        }
        return result;
    }
    static alphaOffset(image: BufferedImage, offset: number): BufferedImage { return this.mapPixels(image, (r, g, b, a) => [r, g, b, Math.max(0, Math.min(255, a + offset))]); }
    static luminanceOffset(image: BufferedImage, offset: number): BufferedImage { return this.mapPixels(image, (r, g, b, a) => [Math.max(0, Math.min(255, r + offset)), Math.max(0, Math.min(255, g + offset)), Math.max(0, Math.min(255, b + offset)), a]); }
    private static mapPixels(image: BufferedImage, map: (r: number, g: number, b: number, a: number) => number[]): BufferedImage {
        const result = this.resizeImage(image, image.getWidth(), image.getHeight()), g = result.createGraphics();
        try {
            const data = g.context.getImageData(0, 0, result.getWidth(), result.getHeight());
            for (let i = 0; i < data.data.length; i += 4)
                data.data.set(map(...Array.from(data.data.slice(i, i + 4)) as [
                    number,
                    number,
                    number,
                    number
                ]), i);
            g.context.putImageData(data, 0, 0);
        }
        finally {
            g.dispose();
        }
        return result;
    }
}
