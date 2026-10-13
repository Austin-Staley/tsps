import { Rasterizer2D } from "../../rs/graphics/Rasterizer2D";
import type { IndexedSprite as NativeIndexed } from "../../rs/sprite/IndexedSprite";
import { SpritePixels as NativeSprite } from "../../rs/sprite/SpritePixels";
import type { SpritePixels } from "../api/SpritePixels";
import { BufferedImage } from "../awt/image/BufferedImage";
import { Color } from "../awt/Color";
export class SpritePixelsImpl implements SpritePixels {
    constructor(readonly value:NativeSprite,private readonly alpha?:Uint8Array) {}
    static fromIndexed(value:NativeIndexed):SpritePixelsImpl { const native=NativeSprite.fromPixels(Int32Array.from(value.pixels,i=>value.palette[i]),value.subWidth,value.subHeight);native.width=value.width;native.height=value.height;native.xOffset=value.xOffset;native.yOffset=value.yOffset;return new SpritePixelsImpl(native,value.alpha); }
    getPixels():Int32Array { return this.value.pixels; } getWidth():number { return this.value.subWidth; } getHeight():number { return this.value.subHeight; }
    getMaxWidth():number { return this.value.width; } getMaxHeight():number { return this.value.height; }
    getOffsetX():number { return this.value.xOffset; } getOffsetY():number { return this.value.yOffset; }
    setMaxWidth(v:number):void { this.value.width=v; } setMaxHeight(v:number):void { this.value.height=v; }
    setOffsetX(v:number):void { this.value.xOffset=v; } setOffsetY(v:number):void { this.value.yOffset=v; }
    drawAt(x:number,y:number):void {
        const target=Rasterizer2D.pixels;if(!target)throw new Error("Rasterizer has no bound drawing buffer");
        x+=this.getOffsetX();y+=this.getOffsetY();const w=this.getWidth(),h=this.getHeight(),source=this.getPixels();
        for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++){const dx=x+sx,dy=y+sy,color=source[sy*w+sx];if(color!==0 && dx>=Rasterizer2D.xClipStart && dx<Rasterizer2D.xClipEnd && dy>=Rasterizer2D.yClipStart && dy<Rasterizer2D.yClipEnd)target[dy*Rasterizer2D.width+dx]=color;}
    }
    toBufferedImage(image=new BufferedImage(this.getWidth(),this.getHeight())):BufferedImage {
        if(image.getWidth()!==this.getWidth() || image.getHeight()!==this.getHeight())throw new RangeError("Sprite image dimensions differ");
        const graphics=image.createGraphics(),data=graphics.context.createImageData(this.getWidth(),this.getHeight());
        this.value.pixels.forEach((color,i)=>{data.data[i*4]=color>>>16&255;data.data[i*4+1]=color>>>8&255;data.data[i*4+2]=color&255;data.data[i*4+3]=this.alpha?.[i] ?? (color===0 ? 0:255);});
        graphics.context.putImageData(data,0,0);graphics.dispose();return image;
    }
    toBufferedOutline(color:Color):BufferedImage;
    toBufferedOutline(image:BufferedImage,color:number):BufferedImage;
    toBufferedOutline(colorOrImage:Color|BufferedImage,color?:number):BufferedImage {
        const rgb=colorOrImage instanceof Color ? colorOrImage.getRGB() : color!,image=colorOrImage instanceof BufferedImage ? colorOrImage:new BufferedImage(this.getWidth(),this.getHeight());
        const pixels=new Int32Array(this.getPixels().length),alpha=new Uint8Array(this.getPixels().length),w=this.getWidth(),h=this.getHeight(),source=this.getPixels();
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(source[i]!==0)continue;if((x>0 && source[i-1]!==0)||(x+1<w && source[i+1]!==0)||(y>0 && source[i-w]!==0)||(y+1<h && source[i+w]!==0)){pixels[i]=rgb&0xffffff;alpha[i]=255;}}
        return new SpritePixelsImpl(NativeSprite.fromPixels(pixels,w,h),alpha).toBufferedImage(image);
    }
}
