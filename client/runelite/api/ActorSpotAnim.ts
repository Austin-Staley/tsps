import type { Renderable } from "./Renderable";
import type { Node } from "./Node";
export interface ActorSpotAnim extends Renderable,Node {
    getId():number; setId(id:number):void; getStartCycle():number; setStartCycle(cycle:number):void;
    getHeight():number; setHeight(height:number):void; getFrame():number; setFrame(frame:number):void;
    getCycle():number; setCycle(cycle:number):void;
}
