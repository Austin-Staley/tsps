import type { SeqType } from "../../rs/config/seqtype/SeqType";
import type { Animation } from "../api/Animation";
export class AnimationImpl implements Animation {
    constructor(readonly value:SeqType) {}
    getId():number { return this.value.id; } isMayaAnim():boolean { return this.value.isSkeletalSeq(); }
    getNumFrames():number { return this.isMayaAnim() ? this.value.getSkeletalDuration() : this.value.frameIds?.length ?? 0; }
    getRestartMode():number { return this.value.replyMode; } setRestartMode(mode:number):void { this.value.replyMode=mode; }
    getDuration():number { return this.isMayaAnim() ? this.value.getSkeletalDuration() : (this.value.frameLengths ?? []).reduce((a,b)=>a+b,0); }
    getFrameStep():number { return this.value.frameStep; } getFrameLengths():number[]|null { return this.isMayaAnim()?null:this.value.frameLengths; }
    getLeftHandItem():number { return this.value.leftHandItem<512 ? -1:this.value.leftHandItem-512; }
    getRightHandItem():number { return this.value.rightHandItem<512 ? -1:this.value.rightHandItem-512; }
}
