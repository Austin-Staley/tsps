import type { Renderable } from "./Renderable";
import type { Mesh } from "./Mesh";
export interface Model extends Mesh<Model>, Renderable { getModelHeight():number; calculateBoundsCylinder():void; getFaceColors1():Int32Array; getFaceColors2():Int32Array; getFaceColors3():Int32Array; }
