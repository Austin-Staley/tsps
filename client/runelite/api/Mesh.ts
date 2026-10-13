export interface Mesh<T> {
    getVerticesCount():number; getVerticesX():Int32Array; getVerticesY():Int32Array; getVerticesZ():Int32Array;
    getFaceCount():number; getFaceIndices1():Int32Array; getFaceIndices2():Int32Array; getFaceIndices3():Int32Array;
    getFaceTransparencies():Int8Array|null; getFaceTextures():Int16Array|null;
    rotateY90Ccw():T; rotateY180Ccw():T; rotateY270Ccw():T; translate(x:number,y:number,z:number):T; scale(x:number,y:number,z:number):T;
}
