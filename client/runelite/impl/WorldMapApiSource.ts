import type { OsrsClient } from "../../game/OsrsClient";
import { IndexType } from "../../rs/cache/IndexType";
import { SpriteLoader } from "../../rs/sprite/SpriteLoader";
import { SpritePixelsImpl } from "./SpritePixelsImpl";
import { WorldMapApi } from "./WorldMapApi";
export function createWorldMapApi(engine: OsrsClient): WorldMapApi {
    const sprites = new Map<number, SpritePixelsImpl>();
    let cache = engine.cacheSystem;
    return new WorldMapApi({ getState: () => engine.worldMapState, getElement(id) { if (!engine.mapElementTypeLoader)
            throw new Error("Map element definitions are not loaded yet"); return engine.mapElementTypeLoader.load(id); }, getSprite(id) { if (cache !== engine.cacheSystem) {
            sprites.clear();
            cache = engine.cacheSystem;
        } const cached = sprites.get(id); if (cached) {
            sprites.delete(id);
            sprites.set(id, cached);
            return cached;
        } const sprite = SpriteLoader.loadIntoIndexedSprite(engine.cacheSystem.getIndex(IndexType.DAT2.sprites), id); if (!sprite)
            return null; const wrapper = SpritePixelsImpl.fromIndexed(sprite); sprites.set(id, wrapper); if (sprites.size > 256)
            sprites.delete(sprites.keys().next().value!); return wrapper; }, invalidate: () => engine.widgetManager.invalidateAll() });
}
