export interface TextureProvider {
    getBrightness():number;
    setBrightness(brightness:number):void;
    load(textureId:number):Int32Array;
    getDefaultColor(textureId:number):number;
}
