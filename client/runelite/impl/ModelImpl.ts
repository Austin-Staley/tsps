import type { Model } from "../api/Model";
import type { Model as EngineModel } from "../../rs/model/Model";
export class ModelImpl implements Model {
    constructor(readonly value:EngineModel) {}
    getModel():this { return this; }
    getVerticesCount():number { return this.value.verticesCount; } getVerticesX():Int32Array { return this.value.verticesX; } getVerticesY():Int32Array { return this.value.verticesY; } getVerticesZ():Int32Array { return this.value.verticesZ; }
    getFaceCount():number { return this.value.faceCount; } getFaceIndices1():Int32Array { return this.value.indices1; } getFaceIndices2():Int32Array { return this.value.indices2; } getFaceIndices3():Int32Array { return this.value.indices3; }
    getFaceTransparencies():Int8Array|null { return this.value.faceAlphas ?? null; } getFaceTextures():Int16Array|null { return this.value.faceTextures ?? null; }
    rotateY90Ccw():this { this.value.rotate90();return this; } rotateY180Ccw():this { this.value.rotate180();return this; } rotateY270Ccw():this { this.value.rotate270();return this; }
    translate(x:number,y:number,z:number):this { this.value.translate(x,y,z);return this; } scale(x:number,y:number,z:number):this { this.value.scale(x,y,z);return this; }
    getModelHeight():number { return this.value.height; } calculateBoundsCylinder():void { this.value.calculateBoundsCylinder(); }
    getFaceColors1():Int32Array { return this.value.faceColors1; } getFaceColors2():Int32Array { return this.value.faceColors2; } getFaceColors3():Int32Array { return this.value.faceColors3; }
}
