import type { Mesh } from "./Mesh";
import type { Model } from "./Model";
export interface ModelData extends Mesh<ModelData> {
    getFaceColors():Uint16Array; recolor(from:number,to:number):ModelData; retexture(from:number,to:number):ModelData;
    light(ambient?:number,contrast?:number,x?:number,y?:number,z?:number):Model;
    shallowCopy():ModelData; cloneVertices():ModelData; cloneColors():ModelData; cloneTextures():ModelData; cloneTransparencies(force?:boolean):ModelData;
}
