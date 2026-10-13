import type { ClientImpl } from "./ClientImpl";
import type { ActorImpl } from "./ActorImpl";
import { ModelImpl } from "./ModelImpl";
import { applyTransformations } from "./ModelTransforms";
import { NpcModelLoader } from "../../rs/config/npctype/NpcModelLoader";
import { Perspective } from "../api/Perspective";
import { Polygon } from "../awt/Polygon";
import type { Point } from "../awt/Point";
import { Model as NativeModel } from "../../rs/model/Model";
import { RENDER_CONSTANTS } from "../../render/render/constants";
const npcLoaders=new WeakMap<object,NpcModelLoader>();
export function actorModel(client:ClientImpl,actor:ActorImpl):ModelImpl|null {
    const body=actorBody(client,actor);if(!body)return null;
    const models=[body.value];
    for(const spot of actor.getSpotAnims()) {
        const graphic=spot.getModel();if(!(graphic instanceof ModelImpl))continue;
        const copy=NativeModel.copyAnimated(graphic.value,false,true);copy.translate(0,-spot.getHeight(),0);models.push(copy);
    }
    return models.length===1 ? body:new ModelImpl(NativeModel.merge(models,models.length));
}
function actorBody(client:ClientImpl,actor:ActorImpl):ModelImpl|null {
    const engine=client.engine;
    if(actor.kind==="npc") {
        if(!engine.modelLoader || !engine.npcTypeLoader)return null;
        let loader=npcLoaders.get(engine.modelLoader);
        if(!loader){loader=new NpcModelLoader(engine.npcTypeLoader,engine.modelLoader,engine.textureLoader,engine.seqTypeLoader,engine.seqFrameLoader,engine.skeletalSeqLoader,engine.varManager);npcLoaders.set(engine.modelLoader,loader);}
        const ecs=engine.npcEcs,action=ecs.getSeqDelay(actor.ecsIndex)>0 ? -1:actor.getAnimation();
        const model=loader.getModel(engine.npcTypeLoader.load(ecs.getNpcTypeId(actor.ecsIndex)),action,actor.getAnimationFrame(),actor.getPoseAnimation(),actor.getPoseAnimationFrame(),ecs.getAnimTick(actor.ecsIndex));
        return model ? new ModelImpl(model):null;
    }
    const ecs=engine.playerEcs,appearance=ecs.getAppearance(actor.ecsIndex);
    if(!appearance)return null;
    const rec=ecs.ensureBaseForIndex(actor.ecsIndex,engine);
    const base=rec?.baseModel;if(!base)return null;
    const action=ecs.getAnimSeqDelay(actor.ecsIndex)>0 ? -1:actor.getAnimation(),pose=actor.getPoseAnimation();
    const result=applyTransformations(engine,new ModelImpl(base),action>=0 ? client.loadAnimation(action):null,actor.getAnimationFrame(),pose>=0 ? client.loadAnimation(pose):null,actor.getPoseAnimationFrame());
    // Native player rendering preserves the base pivot after applying a pose.
    result.value.calculateBounds();
    const dx=(rec.baseCenterX|0)-(result.value.xMid|0),dz=(rec.baseCenterZ|0)-(result.value.zMid|0);
    if(dx || dz)result.value.translate(dx,0,dz);
    return result;
}
export function actorModelPoints(client:ClientImpl,actor:ActorImpl,model:ModelImpl):Array<Point|null> {
    const local=actor.getLocalLocation(),plane=actor.getWorldLocation().getPlane();
    const ground=client.getTileHeight(local.getX(),local.getY(),plane,local.getWorldView())-RENDER_CONSTANTS.ACTOR_GROUND_CLEARANCE_MODEL_UNITS;
    const radians=actor.getCurrentOrientation()*Math.PI/1024,sin=Math.sin(radians),cos=Math.cos(radians);
    const xs=model.getVerticesX(),ys=model.getVerticesY(),zs=model.getVerticesZ();
    return Array.from({length:model.getVerticesCount()},(_,i)=>Perspective.localToCanvas(client,local.getWorldView(),Math.round(local.getX()+xs[i]*cos+zs[i]*sin),Math.round(local.getY()+zs[i]*cos-xs[i]*sin),ground+ys[i]));
}
export function convexHull(points:Array<Point|null>):Polygon|null {
    const sorted=points.filter((p):p is Point=>p!==null).sort((a,b)=>a.x-b.x || a.y-b.y);
    const unique=sorted.filter((p,i)=>!i || p.x!==sorted[i-1].x || p.y!==sorted[i-1].y);
    if(unique.length<3)return null;
    const cross=(o:Point,a:Point,b:Point)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
    const lower:Point[]=[],upper:Point[]=[];
    for(const p of unique){while(lower.length>=2 && cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
    for(let i=unique.length-1;i>=0;i--){const p=unique[i];while(upper.length>=2 && cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
    lower.pop();upper.pop();const hull=lower.concat(upper);
    return new Polygon(hull.map(p=>p.x),hull.map(p=>p.y));
}
