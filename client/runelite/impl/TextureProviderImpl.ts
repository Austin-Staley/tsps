import type { OsrsClient } from "../../game/OsrsClient";
import type { TextureLoader } from "../../rs/texture/TextureLoader";
import type { TextureProvider } from "../api/TextureProvider";
/** CPU pixels use the same cache texture loader and brightness as the rendered scene. */
export class TextureProviderImpl implements TextureProvider {
    private loader:TextureLoader|null=null;
    private brightness=NaN;
    private readonly pixels=new Map<number,Int32Array>();
    constructor(private readonly engine:OsrsClient) {}
    getBrightness():number { return this.engine.renderer.brightness; }
    setBrightness(value:number):void { if(!Number.isFinite(value)||value<=0)throw new RangeError("Texture brightness must be positive");this.engine.renderer.brightness=value;this.pixels.clear(); }
    load(id:number):Int32Array {
        const loader=this.engine.textureLoader,brightness=this.getBrightness();
        if(loader!==this.loader || brightness!==this.brightness){this.loader=loader;this.brightness=brightness;this.pixels.clear();}
        let pixels=this.pixels.get(id);
        if(!pixels){pixels=loader.getPixelsRgb(id,128,false,brightness);this.pixels.set(id,pixels);}
        return pixels;
    }
    getDefaultColor(id:number):number { return this.engine.textureLoader.getAverageHsl(id); }
}
