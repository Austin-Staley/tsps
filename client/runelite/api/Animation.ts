export interface Animation {
    getId():number; isMayaAnim():boolean; getNumFrames():number; getRestartMode():number; setRestartMode(mode:number):void;
    getDuration():number; getFrameStep():number; getFrameLengths():number[]|null; getLeftHandItem():number; getRightHandItem():number;
}
