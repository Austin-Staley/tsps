import type { OsrsClient } from "../../game/OsrsClient";
import { ModelData as EngineModelData } from "../../rs/model/ModelData";
import type { ModelData } from "../api/ModelData";
import { ModelImpl } from "./ModelImpl";
export class ModelDataImpl implements ModelData {
    constructor(private readonly engine:OsrsClient,readonly value:EngineModelData) {}
    getVerticesCount():number { return this.value.verticesCount; } getVerticesX():Int32Array { return this.value.verticesX; } getVerticesY():Int32Array { return this.value.verticesY; } getVerticesZ():Int32Array { return this.value.verticesZ; }
    getFaceCount():number { return this.value.faceCount; } getFaceIndices1():Int32Array { return this.value.indices1; } getFaceIndices2():Int32Array { return this.value.indices2; } getFaceIndices3():Int32Array { return this.value.indices3; }
    getFaceTransparencies():Int8Array|null { return this.value.faceAlphas ?? null; } getFaceTextures():Int16Array|null { return this.value.faceTextures ?? null; }
    rotateY90Ccw():this { this.value.rotate90();return this; } rotateY180Ccw():this { this.value.rotate180();return this; } rotateY270Ccw():this { this.value.rotate270();return this; }
    translate(x:number,y:number,z:number):this { this.value.translate(x,y,z);return this; } scale(x:number,y:number,z:number):this { this.value.resize(x,y,z);return this; }
    getFaceColors():Uint16Array { return this.value.faceColors; } recolor(from:number,to:number):this { this.value.recolor(from,to);return this; } retexture(from:number,to:number):this { this.value.retexture(from,to);return this; }
    light(ambient=64,contrast=768,x=-50,y=-10,z=-50):ModelImpl { return new ModelImpl(this.value.light(this.engine.textureLoader,ambient,contrast,x,y,z)); }
    shallowCopy():ModelDataImpl { return new ModelDataImpl(this.engine,EngineModelData.copyFrom(this.value,true,true,true,true)); }
    cloneVertices():this { this.value.verticesX=this.value.verticesX.slice();this.value.verticesY=this.value.verticesY.slice();this.value.verticesZ=this.value.verticesZ.slice();return this; }
    cloneColors():this { this.value.faceColors=this.value.faceColors.slice();return this; }
    cloneTextures():this { this.value.faceTextures=this.value.faceTextures?.slice();return this; }
    cloneTransparencies(force=false):this { if(this.value.faceAlphas)this.value.faceAlphas=this.value.faceAlphas.slice();else if(force)this.value.faceAlphas=new Int8Array(this.value.faceCount);return this; }
}
