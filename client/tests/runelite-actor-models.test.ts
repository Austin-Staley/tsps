import assert from "node:assert/strict";
import { test } from "node:test";
import { PlayerEcs } from "../game/ecs/PlayerEcs";
import { NpcEcs } from "../game/ecs/NpcEcs";
import { PlayerAnimController } from "../game/PlayerAnimController";
import { WorldViewManager } from "../game/worldview/WorldViewManager";
import { ClientState } from "../game/ClientState";
import type { OsrsClient } from "../game/OsrsClient";
import { VarManager } from "../rs/config/vartype/VarManager";
import { NpcType } from "../rs/config/npctype/NpcType";
import { SeqType } from "../rs/config/seqtype/SeqType";
import { PlayerAppearance, Gender } from "../rs/config/player/PlayerAppearance";
import { PlayerModelLoader } from "../rs/config/player/PlayerModelLoader";
import { ObjType } from "../rs/config/objtype/ObjType";
import { ModelData } from "../rs/model/ModelData";
import { Model } from "../rs/model/Model";
import { GfxManager } from "../render/gfx/GfxManager";
import { ClientImpl } from "../runelite/impl/ClientImpl";
import { Perspective } from "../runelite/api/Perspective";
import { KitType } from "../runelite/api/kit/KitType";
import { PlayerComposition } from "../runelite/api/PlayerComposition";
import { Point } from "../runelite/awt/Point";
import { FriendImpl, FriendsChatMemberImpl } from "../runelite/impl/SocialState";
import { registerNpcModelOverride } from "../custom/npcs/NpcModelOverrideRegistry";
import { FriendsChatRank } from "../runelite/api/FriendsChatRank";

const info={name:"test",game:"oldschool",environment:"live",revision:235,timestamp:"",size:0} as const;
function mesh():Model {
    const m=new Model();m.verticesCount=4;m.usedVertexCount=4;m.verticesX=new Int32Array([-20,20,20,-20]);m.verticesY=new Int32Array([0,-80,-80,0]);m.verticesZ=new Int32Array([0,0,40,40]);
    m.faceCount=2;m.indices1=new Int32Array([0,0]);m.indices2=new Int32Array([1,2]);m.indices3=new Int32Array([2,3]);
    m.faceColors1=new Int32Array([100,100]);m.faceColors2=new Int32Array([100,100]);m.faceColors3=new Int32Array([100,100]);m.calculateBounds();return m;
}
function fixture() {
    const seq=new SeqType(1,info);seq.frameIds=[1,2,3];seq.frameLengths=[2,3,4];
    const seqLoader={load:()=>seq};
    const playerEcs=new PlayerEcs(),npcEcs=new NpcEcs();
    const type=new NpcType(10,info);type.name="Guard";type.size=1;type.idleSeqId=1;type.walkSeqId=2;type.headIconSpriteIds=[123];type.headIconSpriteIndices=[4];
    const engine={playerEcs,npcEcs,playerAnimController:new PlayerAnimController(playerEcs,seqLoader as any,{} as any),worldViewManager:new WorldViewManager(),varManager:new VarManager({load:()=>undefined} as any),seqTypeLoader:seqLoader,seqFrameLoader:{load:()=>undefined},getNpcModelOverride:()=>undefined,npcTypeLoader:{load:()=>type},renderer:{mapManager:{mapSquares:new Map()},getTileHeightAtPlane:()=>0,playerHealthBars:new Map(),npcHealthBars:new Map()},objTypeLoader:{load:()=>({recolorTo:[100,200],retextureTo:[3]})}} as unknown as OsrsClient;
    const cache={getFrameLengths:()=>[2,3],getFrameCount:()=>2,getDurationTicks:()=>5,getModel:()=>mesh()};
    const manager=new GfxManager({osrsClient:engine,gfxRenderer:{getCache:()=>cache}} as any);
    Object.assign(engine.renderer,{gfxManager:manager,gfxRenderer:{getCache:()=>cache}});
    const client=new ClientImpl(engine);
    ClientState.baseX=0;ClientState.baseY=0;ClientState.plane=0;
    return {engine,client,manager,type};
}
test("actor frames, pose sequences, overhead state and player appearance mutate native state", () => {
    const {engine,client}=fixture(),index=engine.playerEcs.allocatePlayer(42);
    engine.playerEcs.setName(index,"Test Player");engine.playerEcs.teleport(index,5,5);
    const app=new PlayerAppearance(Gender.MALE,[1,2,3,4,5],[0,1,2,3,4,5,6],[-1,-1,-1,100]);engine.playerEcs.setAppearance(index,app);
    const p=client.acquirePlayer(index),composition=p.getPlayerComposition()!;
    p.setAnimation(1);p.setAnimationFrame(2);assert.equal(p.getAnimationFrame(),2);assert.equal(engine.playerAnimController.getSequenceState(42)!.frame,2);
    p.setAnimation(2);assert.equal(p.getAnimationFrame(),2,"API animation setters retain the frame instead of reapplying server packet priority/reset logic");
    p.setPoseAnimation(1);p.setPoseAnimationFrame(1);assert.equal(p.getPoseAnimationFrame(),1);
    p.setWalkAnimation(123);p.setIdlePoseAnimation(-1);assert.equal(engine.playerEcs.getAnimSeq(index,"walk"),123);assert.equal(p.getIdlePoseAnimation(),-1);
    p.setModelHeight(256);assert.equal(p.getModelHeight(),256);assert.equal(engine.playerEcs.getDefaultHeightTiles(index),2);
    assert.equal(composition.getEquipmentId(KitType.WEAPON),100);assert.equal(composition.getKitId(KitType.ARMS),3);
    composition.getEquipmentIds()[KitType.WEAPON]=PlayerComposition.ITEM_OFFSET+200;composition.getEquipmentIds()[KitType.HAIR]=PlayerComposition.KIT_OFFSET+9;
    composition.getEquipmentIds()[KitType.ARMS]=PlayerComposition.ITEM_OFFSET+300;
    assert.equal(app.equip[3],200);assert.equal(app.kits[0],9);assert.equal(composition.getEquipmentId(KitType.ARMS),300);
    composition.getColors()[2]=7;composition.setHash();assert.equal(app.colors[2],7);
    const hash=app.getHash(),override=composition.createColorTextureOverride(KitType.WEAPON,200);
    override.getColorToReplaceWith()![0]=999;assert.notEqual(app.getHash(),hash);assert.equal(app.colorTextureOverrides[3]!.colors![0],999);
    assert.equal(composition.getColorTextureOverride(KitType.WEAPON),override);composition.getColorTextureOverrides()[KitType.HEAD]=override;assert.equal(app.colorTextureOverrides[0]!.colors,override.getColorToReplaceWith());
    composition.setTransformedNpcId(10);assert.equal(app.npcTransformationId,10);composition.removeColorTextureOverride(KitType.WEAPON);assert.equal(composition.getColorTextureOverride(KitType.WEAPON),null);
    engine.playerEcs.setOverheadChat(index,{text:"old",duration:30,color:4});p.setOverheadText("new");p.setOverheadCycle(12);
    assert.equal(engine.playerEcs.getOverheadChat(index)!.text,"new");assert.equal(p.getOverheadCycle(),12);
    p.setOverheadCycle(0);assert.equal(p.getOverheadText(),"new");p.setOverheadCycle(12);
    p.setDead(true);assert(p.isDead());p.setDead(false);assert.equal(p.isDead(),false);
    client.socialState.friends.set("test_player",new FriendImpl("Test Player",null,1,0));assert(p.isFriend());
    client.socialState.members.set("test_player",new FriendsChatMemberImpl("Test Player",FriendsChatRank.FRIEND,1));assert(p.isFriendsChatMember());
    assert.equal(p.getOverheadIcon(),null);p.setSkullIcon(3);assert.equal(engine.playerEcs.getHeadIconPk(index),3);
    p.detach();engine.playerEcs.deallocatePlayer(42);engine.playerEcs.allocatePlayer(42);
    assert.equal(p.getPlayerComposition(),composition);assert.equal(p.getAnimationFrame(),2);assert.equal(p.getOverheadCycle(),12);
});
test("convex hull comes from posed mesh vertices and actor orientation", () => {
    const {engine,client}=fixture(),index=engine.playerEcs.allocatePlayer(42),base=mesh();
    engine.playerEcs.setAppearance(index,new PlayerAppearance(Gender.MALE,[],[]));engine.playerEcs.teleport(index,5,5);
    engine.playerEcs.ensureBaseForIndex=()=>({baseModel:base,baseCenterX:0,baseCenterZ:20,defaultHeightTiles:80/128});
    Perspective.setProjector(client,(x,y,z)=>new Point(x,z+y/4));
    const p=client.acquirePlayer(index);assert(p.getModel());
    const hull=p.getConvexHull()!,bounds=hull.getBounds();
    assert.equal(bounds.width,40);assert.equal(bounds.height,90);assert.equal(hull.npoints,4);
    engine.playerEcs.setRotationImmediate(index,512);
    const turned=p.getConvexHull()!.getBounds();assert.equal(turned.x,bounds.x+40);assert.equal(turned.height,90);
    assert.equal(base.verticesX[0],-20,"mesh projection never rotates the shared cache model");
});
test("spot collections share native instances, slots, frame phase and retained actor identity", () => {
    const {engine,client,manager}=fixture(),index=engine.playerEcs.allocatePlayer(42),p=client.acquirePlayer(index);
    p.createSpotAnim(0,100,64,2);p.createSpotAnim(3,101,128,0);
    const native=[...manager.getActorInstances("player",42)];assert.equal(native.length,2);assert.equal(native[0].startCycle,client.getGameCycle()+2);
    const table=p.getSpotAnims(),spot=table.get(0)!;assert.equal(table.get(0),spot);assert.equal(spot.getHeight(),64);assert.equal(spot.getFrame(),-1);
    spot.setFrame(1);assert.equal(spot.getFrame(),1);assert(spot.getModel());spot.setHeight(192);assert.equal(native[0].yOffsetTiles,1.5);
    spot.setCycle(0);assert.equal(spot.getCycle(),0);spot.setCycle(1);assert.equal(spot.getCycle(),1);
    p.setGraphic(102);assert.equal(table.get(0),spot);assert.equal(spot.getFrame(),1);p.setGraphic(100);
    assert(p.hasSpotAnim(101));assert.equal(p.getGraphic(),100);assert.equal(p.getGraphicHeight(),192);
    p.removeSpotAnim(3);assert.equal([...table].length,1);
    p.detach();manager.removeActorInstances("player",42);manager.spawnAttachedToPlayer(999,42,"ground",undefined,false,0,0);
    assert.equal(table.get(0),spot);assert.equal(table.get(0)!.getId(),100,"removed actor cannot acquire a replacement actor's graphics");
});
test("NPC sequence overrides stay per actor and synthetic model ids do not leak through NPC ids", () => {
    const {engine,client,type}=fixture();
    const index=engine.npcEcs.createNpc(0,0,10,1,640,640,0,0,5,5);engine.npcEcs.setServerMapping(index,8);
    const npc=client.acquireNpc(index);npc.setPoseAnimation(3);npc.setPoseAnimationFrame(2);npc.setWalkAnimation(500);
    assert.equal(npc.getPoseAnimationFrame(),2);assert.equal(npc.getWalkAnimation(),500);assert.equal(type.walkSeqId,2);assert.equal(engine.npcEcs.getMovementOverrides(index)!.walk,500);
    npc.setModelHeight(300);assert.equal(npc.getModelHeight(),300);assert.equal(engine.npcEcs.getModelHeightOverride(index),300);
    assert.deepEqual(npc.getOverheadArchiveIds(),[123]);assert.deepEqual(npc.getOverheadSpriteIds(),[4]);
    const synthetic=registerNpcModelOverride(10,[{slot:0,modelId:12345}]);engine.npcEcs.setNpcTypeId(index,synthetic);assert.equal(npc.getId(),10);
    npc.detach();engine.npcEcs.destroyNpc(index);assert.equal(npc.getWalkAnimation(),500);assert.equal(engine.npcEcs.getMovementOverrides(index),undefined);
});
test("player color and texture overrides reach actual wearable model recoloring", () => {
    const appearance=new PlayerAppearance(Gender.MALE,[],new Array(7).fill(-1));
    appearance.colorTextureOverrides[KitType.WEAPON]={colors:[555],textures:[777]};
    const item=new ObjType(100,info);item.maleModel=1;item.recolorFrom=[100];item.recolorTo=[200];item.retextureFrom=[300];item.retextureTo=[400];
    const colors:number[]=[],textures:number[]=[];
    const data=new ModelData();data.recolor=(_from,to)=>{colors.push(to);};data.retexture=(_from,to)=>{textures.push(to);};
    const original=ModelData.merge;ModelData.merge=()=>({light:()=>({faceCount:0,faceRenderLayers:null})} as unknown as ModelData);
    try {new PlayerModelLoader({} as any,{} as any,{missCount:0,getModel:()=>data} as any,{} as any).buildStaticModel(appearance,[item],[],[KitType.WEAPON]);}
    finally {ModelData.merge=original;}
    assert.deepEqual(colors,[555]);assert.deepEqual(textures,[777]);
});
