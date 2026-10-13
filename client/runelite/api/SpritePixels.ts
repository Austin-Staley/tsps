import type { BufferedImage } from "../awt/image/BufferedImage";
import type { Color } from "../awt/Color";
export interface SpritePixels {
    drawAt(x:number,y:number):void;
    getPixels():Int32Array; getWidth():number; getHeight():number; getMaxWidth():number; getMaxHeight():number;
    getOffsetX():number; getOffsetY():number; setMaxWidth(width:number):void; setMaxHeight(height:number):void; setOffsetX(x:number):void; setOffsetY(y:number):void;
    toBufferedImage(image?:BufferedImage):BufferedImage;
    toBufferedOutline(color:Color):BufferedImage;
    toBufferedOutline(image:BufferedImage,color:number):BufferedImage;
}

export namespace SpritePixels { export const DEFAULT_SHADOW_COLOR=3153952; }
