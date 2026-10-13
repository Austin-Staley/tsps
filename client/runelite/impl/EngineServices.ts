import type { OsrsClient } from "../../game/OsrsClient";
import { IndexType } from "../../rs/cache/IndexType";
import { SpriteLoader } from "../../rs/sprite/SpriteLoader";
import { ItemIconRenderer } from "../../ui/item/ItemIconRenderer";
import { guidePrice } from "../../network/serverConnection/domain/itemPrices";
import { BufferedImage } from "../awt";
import type { Client } from "../api/Client";
import { ClientThread } from "../client/callback/ClientThread";
import { ChatMessageManager } from "../client/chat/ChatMessageManager";
import { ItemManager } from "../client/game/ItemManager";
import { SpriteManager } from "../client/game/SpriteManager";
import { SkillIconManager } from "../client/game/SkillIconManager";
import { ImageUtil } from "../client/util/ImageUtil";
/** Adapts real cache/icon/price services without exposing engine types to plugins. */
export function createGameServices(engine: OsrsClient, client: Client, clientThread: ClientThread) {
    const sprites = new Map<string, BufferedImage>();
    let spriteCache = engine.cacheSystem;
    const itemManager = new ItemManager({
        getItemComposition: id => client.getItemDefinition(id),
        getItemPrice: id => guidePrice(id) ?? 0,
        getImage: (id, quantity, stackable, scale) => {
            const host = engine.renderer as unknown as {
                itemIconRenderer?: ItemIconRenderer;
                overlayHost?: {
                    itemIconRenderer?: ItemIconRenderer;
                };
                overlays?: {
                    getHost(): {
                        itemIconRenderer?: ItemIconRenderer;
                    } | undefined;
                };
            };
            const renderer = host.overlayHost ?? host.overlays?.getHost() ?? host;
            if (!renderer.itemIconRenderer && engine.objTypeLoader && engine.modelLoader && engine.textureLoader)
                renderer.itemIconRenderer = new ItemIconRenderer(engine.objTypeLoader, engine.modelLoader, engine.textureLoader, engine.cacheSystem);
            const canvas = renderer.itemIconRenderer?.renderToCanvas(id, quantity, { outline: 1, shadow: 0x302020, quantityMode: stackable ? 1 : 0 });
            if (!canvas)
                return null;
            const image = new BufferedImage(canvas);
            return scale === 1 ? image : ImageUtil.resizeImage(image, Math.max(1, Math.round(canvas.width * scale)), Math.max(1, Math.round(canvas.height * scale)));
        },
    }, clientThread);
    const spriteManager = new SpriteManager((id, file) => {
        if (id < 0 || file < 0 || !engine.cacheSystem)
            return null;
        if (spriteCache !== engine.cacheSystem) {
            sprites.clear();
            spriteCache = engine.cacheSystem;
        }
        const key = id + ":" + file, cached = sprites.get(key);
        if (cached)
            return cached;
        const sprite = SpriteLoader.loadIntoIndexedSprites(engine.cacheSystem.getIndex(IndexType.DAT2.sprites), id)?.[file];
        if (!sprite)
            return null;
        const image = new BufferedImage(sprite.width, sprite.height), graphics = image.createGraphics();
        try {
            const pixels = graphics.context.createImageData(sprite.width, sprite.height);
            for (let y = 0; y < sprite.subHeight; y++)
                for (let x = 0; x < sprite.subWidth; x++) {
                    const index = x + y * sprite.subWidth, palette = sprite.pixels[index] & 255, rgb = sprite.palette[palette], destination = ((y + sprite.yOffset) * sprite.width + x + sprite.xOffset) * 4;
                    pixels.data[destination] = rgb >>> 16 & 255;
                    pixels.data[destination + 1] = rgb >>> 8 & 255;
                    pixels.data[destination + 2] = rgb & 255;
                    pixels.data[destination + 3] = sprite.alpha?.[index] ?? (palette ? 255 : 0);
                }
            graphics.context.putImageData(pixels, 0, 0);
        }
        finally {
            graphics.dispose();
        }
        sprites.set(key, image);
        return image;
    }, clientThread);
    return { itemManager, spriteManager, skillIconManager: new SkillIconManager(), chatMessageManager: new ChatMessageManager(client, clientThread) };
}
