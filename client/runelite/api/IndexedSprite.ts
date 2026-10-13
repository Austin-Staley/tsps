export interface IndexedSprite {
    getPixels():Uint8Array; setPixels(pixels:Uint8Array):void; getPalette():Int32Array; setPalette(palette:Int32Array):void;
    getOffsetX():number; setOffsetX(x:number):void; getOffsetY():number; setOffsetY(y:number):void;
    getWidth():number; setWidth(width:number):void; getHeight():number; setHeight(height:number):void;
    getOriginalWidth():number; setOriginalWidth(width:number):void; getOriginalHeight():number; setOriginalHeight(height:number):void;
}
