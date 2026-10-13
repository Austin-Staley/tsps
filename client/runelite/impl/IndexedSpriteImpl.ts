import type { IndexedSprite } from "../api/IndexedSprite";
import { IndexedSprite as NativeSprite } from "../../rs/sprite/IndexedSprite";
export class IndexedSpriteImpl implements IndexedSprite {
    constructor(readonly value:NativeSprite) {}
    getPixels():Uint8Array { return this.value.pixels; } setPixels(v:Uint8Array):void { this.value.pixels=v; }
    getPalette():Int32Array { return this.value.palette; } setPalette(v:Int32Array):void { this.value.palette=v; }
    getOffsetX():number { return this.value.xOffset; } setOffsetX(v:number):void { this.value.xOffset=v; }
    getOffsetY():number { return this.value.yOffset; } setOffsetY(v:number):void { this.value.yOffset=v; }
    getWidth():number { return this.value.subWidth; } setWidth(v:number):void { this.value.subWidth=v; }
    getHeight():number { return this.value.subHeight; } setHeight(v:number):void { this.value.subHeight=v; }
    getOriginalWidth():number { return this.value.width; } setOriginalWidth(v:number):void { this.value.width=v; }
    getOriginalHeight():number { return this.value.height; } setOriginalHeight(v:number):void { this.value.height=v; }
}
