import { Model as NativeModel } from "../../rs/model/Model";
import type { OsrsClient } from "../../game/OsrsClient";
import type { Animation } from "../api/Animation";
import { AnimationImpl } from "./AnimationImpl";
import { ModelImpl } from "./ModelImpl";
/** Uses the same classic-frame and skeletal composition paths as native actor rendering. */
export function applyTransformations(engine:OsrsClient,source:ModelImpl,a:Animation|null,frameA:number,b:Animation|null,frameB:number):ModelImpl {
    const model=NativeModel.copyAnimated(source.value,false,true);
    const definition=(anim:Animation|null)=>anim instanceof AnimationImpl ? anim.value : anim ? engine.seqTypeLoader.load(anim.getId()) : null;
    const sa=definition(a),sb=definition(b);
    const classicA=sa && !sa.isSkeletalSeq() && frameA>=0 ? engine.seqFrameLoader.load(sa.frameIds[frameA]):undefined;
    const classicB=sb && !sb.isSkeletalSeq() && frameB>=0 ? engine.seqFrameLoader.load(sb.frameIds[frameB]):undefined;
    const mayaA=sa?.isSkeletalSeq() && frameA>=0 ? engine.skeletalSeqLoader?.load(sa.skeletalId):undefined;
    const mayaB=sb?.isSkeletalSeq() && frameB>=0 ? engine.skeletalSeqLoader?.load(sb.skeletalId):undefined;
    if(classicA && classicB)model.animateInterleavedFrames(classicA,sa!.op14,classicB,sb!.op14,sa!.masks ?? []);
    else if(mayaA && mayaB)model.animateSkeletalComposite(mayaA,frameA,{masks:sa!.skeletalMasks,overlay:{seq:mayaB,frame:frameB}});
    else if(classicA && mayaB) {
        if(sa?.masks?.length){model.animateSkeletal(mayaB,frameB,{masks:sa.skeletalMasks,maskMatch:true,applyAlpha:false});model.animateInterleavedFrame(classicA,sa.op14,sa.masks,false);}
        else model.animate(classicA,undefined,sa!.op14);
    }
    else if(mayaA && classicB) { model.animateSkeletal(mayaA,frameA,{masks:sa?.skeletalMasks,maskMatch:false});model.animateInterleavedFrame(classicB,sb!.op14,sa?.masks,true); }
    else if(mayaA)model.animateSkeletal(mayaA,frameA);
    else if(mayaB)model.animateSkeletal(mayaB,frameB);
    else if(classicA)model.animate(classicA,undefined,sa!.op14);
    else if(classicB)model.animate(classicB,undefined,sb!.op14);
    return new ModelImpl(model);
}
