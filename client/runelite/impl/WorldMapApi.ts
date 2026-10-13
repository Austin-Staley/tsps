import { WorldMapArea, WorldMapState, unpackWorldMapCoord } from "../../rs/map/WorldMapArea";
import type { MapElementType } from "../../rs/config/meltype/MapElementType";
import { Point } from "../awt/Point";
import { WorldPoint } from "../api/coords/WorldPoint";
import type { RenderOverview } from "../api/RenderOverview";
import type { WorldMapData } from "../api/worldmap/WorldMapData";
import type { WorldMapRenderer } from "../api/worldmap/WorldMapRenderer";
import type { WorldMapRegion } from "../api/worldmap/WorldMapRegion";
import type { WorldMapIcon } from "../api/worldmap/WorldMapIcon";
import type { MapElementConfig } from "../api/worldmap/MapElementConfig";
import type { SpritePixels } from "../api/SpritePixels";
export interface WorldMapApiSource {
    getState(): WorldMapState;
    getElement(id: number): MapElementType;
    getSprite(id: number): SpritePixels | null;
    invalidate(): void;
}
class WorldMapDataImpl implements WorldMapData {
    constructor(readonly area: WorldMapArea) { }
    surfaceContainsPosition(x: number, y: number): boolean { return this.area.containsPosition(x, y); }
}
class MapElementConfigImpl implements MapElementConfig {
    constructor(private readonly element: MapElementType, private readonly source: WorldMapApiSource) { }
    getCategory(): number { return this.element.category; }
    getMapIcon(_unused: boolean): SpritePixels | null { return this.element.spriteId < 0 ? null : this.source.getSprite(this.element.spriteId); }
}
class WorldMapRegionImpl implements WorldMapRegion {
    constructor(private readonly state: WorldMapState, private readonly area: WorldMapArea, private readonly x: number, private readonly y: number, private readonly source: WorldMapApiSource) { }
    getMapIcons(): readonly WorldMapIcon[] {
        if (!this.state.elementsEnabled)
            return [];
        const result: WorldMapIcon[] = [], seen = new Set<string>();
        for (let plane = 0; plane < 4; plane++)
            for (const icon of this.state.getIconsForAreaTile(this.area.id, this.x, this.y, plane)) {
                const element = this.source.getElement(icon.element), category = element.category >= 0 ? element.category : typeof icon.category === "number" ? icon.category : -1;
                if (!element.worldMapVisible || !this.state.isElementEnabled(icon.element) || (category >= 0 && !this.state.isCategoryEnabled(category)))
                    continue;
                const coord = unpackWorldMapCoord(icon.coord), display = icon.displayCoord === undefined ? this.area.position(coord.plane, coord.x, coord.y) : unpackWorldMapCoord(icon.displayCoord);
                if (!display)
                    continue;
                const point = new WorldPoint(display.x, display.y, icon.displayCoord === undefined ? coord.plane : unpackWorldMapCoord(icon.displayCoord).plane), key = `${icon.element}:${point.getX()}:${point.getY()}:${point.getPlane()}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                result.push({ getType: () => icon.element, getCoordinate: () => point });
            }
        return result;
    }
}
class WorldMapRendererImpl implements WorldMapRenderer {
    private regions?: WorldMapRegion[][];
    constructor(readonly state: WorldMapState, readonly area: WorldMapArea, private readonly source: WorldMapApiSource) { }
    isLoaded(): boolean { return this.state.isLoaded(); }
    getMapRegions(): WorldMapRegion[][] {
        return this.regions ??= Array.from({ length: this.area.regionHighX - this.area.regionLowX + 1 }, (_, dx) => Array.from({ length: this.area.regionHighY - this.area.regionLowY + 1 }, (_, dy) => new WorldMapRegionImpl(this.state, this.area, this.area.regionLowX + dx, this.area.regionLowY + dy, this.source)));
    }
}
/** Adapts the same map position, region data, icons and cache sprites used by CS2 and native rendering. */
export class WorldMapApi implements RenderOverview {
    private readonly data = new WeakMap<WorldMapArea, WorldMapDataImpl>();
    private readonly elements = new WeakMap<MapElementType, MapElementConfigImpl>();
    private renderer: WorldMapRendererImpl | null = null;
    constructor(private readonly source: WorldMapApiSource) { }
    getWorldMapPosition(): Point { const state = this.source.getState(); return new Point(state.displayX, state.displayY); }
    getWorldMapZoom(): number { return this.source.getState().getZoomScale(); }
    setWorldMapPositionTarget(point: WorldPoint): void { this.source.getState().setWorldMapPositionTarget(point.getX(), point.getY()); this.source.invalidate(); }
    getWorldMapRenderer(): WorldMapRenderer | null { const state = this.source.getState(), area = state.currentArea; if (!area)
        return null; if (this.renderer?.state !== state || this.renderer.area !== area)
        this.renderer = new WorldMapRendererImpl(state, area, this.source); return this.renderer; }
    getWorldMapData(): WorldMapData | null { const area = this.source.getState().currentArea; if (!area)
        return null; let data = this.data.get(area); if (!data) {
        data = new WorldMapDataImpl(area);
        this.data.set(area, data);
    } return data; }
    initializeWorldMap(data: WorldMapData): void {
        const state = this.source.getState();
        if (!(data instanceof WorldMapDataImpl) || state.areasById.get(data.area.id) !== data.area)
            throw new Error("World map data must belong to this client's loaded cache");
        state.setCurrentMapAreaId(data.area.id);
        this.renderer = null;
        this.source.invalidate();
    }
    getMapElementConfig(id: number): MapElementConfig { const element = this.source.getElement(id); let wrapper = this.elements.get(element); if (!wrapper) {
        wrapper = new MapElementConfigImpl(element, this.source);
        this.elements.set(element, wrapper);
    } return wrapper; }
}
