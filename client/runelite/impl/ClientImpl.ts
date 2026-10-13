import { TextureProviderImpl } from "./TextureProviderImpl";
import { VarcMap } from "./VarcMap";
import { transformWorldEntityPoint } from "../../render/WorldEntityProjection";
import type { WorldEntityAnimator } from "../../render/WorldEntityAnimator";
import { MessageHashTable, ChatLineMap } from "./MessageCollections";
import { getGrandExchangeOffers } from "./GrandExchangeOfferImpl";
import { ItemIconRenderer } from "../../ui/item/ItemIconRenderer";
import { applyTransformations } from "./ModelTransforms";
import type { Animation } from "../api/Animation";
import { ClientUiService } from "./ClientUiService";
import type { Preferences } from "../api/Preferences";
import type { Widget } from "../api/widgets/Widget";
import type { MenuAction } from "../api/MenuAction";
import type { DrawCallbackDispatcher } from "./DrawCallbackDispatcher";
import type { DrawCallbacks } from "../api/hooks/DrawCallbacks";
import { SpritePixels as NativeSprite } from "../../rs/sprite/SpritePixels";
import { IndexedSprite as NativeIndexedSprite } from "../../rs/sprite/IndexedSprite";
import { SpriteLoader } from "../../rs/sprite/SpriteLoader";
import type { IndexDataBase } from "../api/IndexDataBase";
import { SpritePixelsImpl } from "./SpritePixelsImpl";
import { IndexedSpriteImpl } from "./IndexedSpriteImpl";
import { queueChangedSkill, queueChangedVarp } from "./events/queuedChanges";
import { PlayerMenuArrays } from "./PlayerMenuArrays";
import { createWorldMapApi } from "./WorldMapApiSource";
import type { Callbacks } from "../api/hooks/Callbacks";
import { ProjectileImpl } from "./ProjectileImpl";
import type { Projectile as NativeProjectile } from "../../render/projectiles/Projectile";
import { socialNameKey } from "./SocialState";
import type { FriendsChatManager } from "../api/FriendsChatManager";
import { SocialState } from "./SocialState";
import { IndexType } from "../../rs/cache/IndexType";
import { ModelData as EngineModelData } from "../../rs/model/ModelData";
import { Model as EngineModel } from "../../rs/model/Model";
import type { Model } from "../api/Model";
import type { ModelData } from "../api/ModelData";
import { ModelDataImpl } from "./ModelDataImpl";
import { ModelImpl } from "./ModelImpl";
import { AnimationImpl } from "./AnimationImpl";
import { IndexDataBaseImpl } from "./IndexDataBaseImpl";
import { Camera } from "../../game/Camera";
import { Dimension } from "../awt/Dimension";
import type { OsrsClient } from "../../game/OsrsClient";
import { markChatTransmit } from "../../game/TransmitCycles";
import { ClientState } from "../../game/ClientState";
import { getClientCycle } from "../../network/ServerConnection";
import { chatHistory } from "../../rs/cs2/ChatHistory";
import type { WidgetNode } from "../../widgets/WidgetNode";
import { hintArrow, clearHintArrow, setHintArrowNpc, setHintArrowPlayer, setHintArrowTile } from "../../game/HintArrow";
import { Client } from "../api/Client";
import { Skill } from "../api/Skill";
import { WorldType } from "../api/WorldType";
import type { Prayer } from "../api/Prayer";
import type { Player } from "../api/Player";
import type { NPC } from "../api/NPC";
import type { ChatMessageType } from "../api/ChatMessageType";
import type { Menu } from "../api/Menu";
import type { MenuEntry } from "../api/MenuEntry";
import { TileItem } from "../api/TileItem";
import { Item } from "../api/Item";
import { ItemContainer } from "../api/ItemContainer";
import { WorldPoint } from "../api/coords/WorldPoint";
import { LocalPoint } from "../api/coords/LocalPoint";
import { Perspective } from "../api/Perspective";
import { Point } from "../awt/Point";
import { toRuneLiteGameState } from "./GameStateMapping";
import { PlayerImpl } from "./PlayerImpl";
import { NpcImpl } from "./NpcImpl";
import { WidgetImpl } from "./WidgetImpl";
import { ItemCompositionImpl } from "./ItemCompositionImpl";
import { NPCCompositionImpl } from "./NPCCompositionImpl";
import { ObjectCompositionImpl } from "./ObjectCompositionImpl";
import { EnumCompositionImpl } from "./EnumCompositionImpl";
import { CompositionImpl } from "./CompositionImpl";
import { MessageNodeImpl } from "./MessageNodeImpl";
import { WorldViewImpl } from "./WorldViewImpl";
import { SceneRegistry } from "./SceneRegistry";
import { TileImpl } from "./TileImpl";
export class ClientImpl extends Client {
    private worldMapApi?: ReturnType<typeof createWorldMapApi>;
    getWorldMap() { return this.worldMapApi ??= createWorldMapApi(this.engine); }
    getRenderOverview() { return this.getWorldMap(); }
    getMapElementConfig(id: number) { return this.getWorldMap().getMapElementConfig(id); }
    private readonly playerMenus = new PlayerMenuArrays();
    queueChangedSkill(skill: Skill): void { queueChangedSkill(skill); }
    queueChangedVarp(varp: number): void { queueChangedVarp(varp); }
    setGeSearchResultCount(count: number): void { this.engine.cs2Vm.itemSearchCount = count; }
    setGeSearchResultIds(ids: Int16Array): void { this.engine.cs2Vm.itemSearchResults = Array.from(ids, id => id & 65535); }
    setGeSearchResultIndex(index: number): void { this.engine.cs2Vm.itemSearchIndex = index; }
    readonly socialState=new SocialState();
    private readonly friendContainer={getCount:()=>this.socialState.friends.size,getMembers:()=>[...this.socialState.friends.values()],findByName:(name:string)=>this.socialState.friends.get(socialNameKey(name)) ?? null};
    private readonly ignoreContainer={getCount:()=>this.socialState.ignores.size,getMembers:()=>[...this.socialState.ignores.values()],findByName:(name:string)=>this.socialState.ignores.get(socialNameKey(name)) ?? null};
    private readonly friendsChatManager:FriendsChatManager={getCount:()=>this.socialState.members.size,getMembers:()=>[...this.socialState.members.values()],findByName:(name:string)=>this.socialState.members.get(socialNameKey(name)) ?? null,getOwner:()=>this.socialState.owner,getName:()=>this.socialState.channelName,getMyRank:()=>this.socialState.myRank,getKickRank:()=>this.socialState.kickRank};
    private readonly compositions=new WeakMap<object,unknown>();
    private composition<T>(source:object,create:()=>T):T { let c=this.compositions.get(source) as T|undefined;if(!c){c=create();this.compositions.set(source,c);}return c; }
    private readonly players=new Map<number,PlayerImpl>();
    private readonly npcs=new Map<number,NpcImpl>();
    private readonly widgets=new WeakMap<WidgetNode,WidgetImpl>();
    private readonly views=new Map<number,WorldViewImpl>();
    private readonly tiles=new Map<string,TileImpl>();
    private readonly tileBases=new Map<number,string>();
    readonly sceneRegistry:SceneRegistry;
    readonly groundItemWrappers=new Map<number,TileItem>();
    wrapGroundItem(stack:{id:number;itemId:number;quantity:number}):TileItem { let item=this.groundItemWrappers.get(stack.id); if(!item){item=new TileItem(stack.itemId,stack.quantity);this.groundItemWrappers.set(stack.id,item);} else item.setQuantity(stack.quantity); return item; }
    private itemIconRenderer:ItemIconRenderer|null=null;
    private itemIconLoader:object|null=null;
    private icons():ItemIconRenderer { const r=this.engine.renderer as unknown as {itemIconRenderer?:ItemIconRenderer;overlays?:{getHost:()=>{itemIconRenderer?:ItemIconRenderer}|undefined}};const icons=r?.itemIconRenderer ?? r?.overlays?.getHost()?.itemIconRenderer;if(icons)return icons;if(this.itemIconLoader!==this.engine.objTypeLoader){this.itemIconLoader=this.engine.objTypeLoader;this.itemIconRenderer=new ItemIconRenderer(this.engine.objTypeLoader,this.engine.modelLoader,this.engine.textureLoader,this.engine.cacheSystem);}return this.itemIconRenderer!; }
    private menu:Menu|null=null;
    private callbacks:Callbacks|null=null;
    private readonly messages=new MessageHashTable();
    private readonly chatLines=new ChatLineMap();
    private tickCount=0;
    private readonly ui:ClientUiService;
    private readonly textures:TextureProviderImpl;
    private readonly varcs:VarcMap;
    private drawCallbackProvider:DrawCallbackDispatcher|null=null;
    setDrawCallbackProvider(value:DrawCallbackDispatcher):void { this.drawCallbackProvider=value; }
    getDrawCallbacks():DrawCallbacks|null { return this.drawCallbackProvider?.getDrawCallbacks() ?? null; }
    setDrawCallbacks(value:DrawCallbacks|null):void { if(!this.drawCallbackProvider)throw new Error("DrawCallbacks provider is not bound");this.drawCallbackProvider.setDrawCallbacks(value); }
    private clientThreadProvider:(()=>boolean)|null=null;
    setClientThreadProvider(provider:()=>boolean):void { this.clientThreadProvider=provider; }
    isClientThread():boolean { if(!this.clientThreadProvider)throw new Error("ClientThread is not bound");return this.clientThreadProvider(); }
    private readonly projectileWrappers=new WeakMap<NativeProjectile,ProjectileImpl>();
    wrapProjectile(p:NativeProjectile):ProjectileImpl { let wrapper=this.projectileWrappers.get(p);if(!wrapper){wrapper=new ProjectileImpl(this,p);this.projectileWrappers.set(p,wrapper);}return wrapper; }
    setCallbacks(value:Callbacks):void { this.callbacks=value; }
    getCallbacks():Callbacks { if(!this.callbacks)throw new Error("RuneLite callbacks are not bound");return this.callbacks; }
    constructor(readonly engine:OsrsClient) { super(); this.varcs=new VarcMap(()=>engine.varManager); this.textures=new TextureProviderImpl(engine); this.ui=new ClientUiService(engine,this); this.sceneRegistry=new SceneRegistry(this);
        Perspective.setProjector(this,(x,y,z,viewId)=>{
            const view=this.getWorldView(viewId); if(!view)return null;
            const r=this.engine.renderer as unknown as {worldEntityAnimator?:WorldEntityAnimator;worldToScreen?:(x:number,y:number,z:number)=>ArrayLike<number>|undefined;overlays?:{getHost:()=>{worldToScreen:(x:number,y:number,z:number)=>ArrayLike<number>|undefined}|undefined}};
            const projector=r.worldToScreen ? r : r.overlays?.getHost();
            const world:[number,number,number]=[view.getBaseX()+x/128,-z/128,view.getBaseY()+y/128];
            const position=viewId===-1 ? world : transformWorldEntityPoint(this.engine.camera.viewMatrix as Float32Array,r.worldEntityAnimator,viewId,...world);
            if(!position)return null;
            const result=projector?.worldToScreen!(...position);
            return result ? new Point(Math.trunc(result[0]),Math.trunc(result[1])) : null;
        }); }
    setMenuService(menu:Menu):void { this.menu=menu; }
    getGameState() { return toRuneLiteGameState(this.engine.gameState); }
    getTickCount():number { return this.tickCount; }
    setTickCount(count:number):void { this.tickCount=count|0; }
    advanceTickCount():void { this.tickCount=(this.tickCount+1)|0; }
    getGameCycle():number { return getClientCycle(); }
    getLocalPlayer():PlayerImpl|null { return this.getPlayerByIndex(this.engine.controlledPlayerServerId); }
    acquirePlayer(index:number):PlayerImpl { const sid=this.engine.playerEcs.getServerIdForIndex(index); if(sid===undefined)throw new Error(`No player at ECS index ${index}`); let a=this.players.get(index); if(a && a.serverIndex!==sid){a.detach();this.players.delete(index);a=undefined;} if(!a){a=new PlayerImpl(this,index,sid);this.players.set(index,a);} return a; }
    acquireNpc(index:number):NpcImpl { const sid=this.engine.npcEcs.getServerId(index); let a=this.npcs.get(index); if(a && a.serverIndex!==sid){a.detach();this.npcs.delete(index);a=undefined;} if(!a){a=new NpcImpl(this,index,sid);this.npcs.set(index,a);} return a; }
    releasePlayer(index:number):PlayerImpl|null { const a=this.players.get(index) ?? this.acquirePlayer(index); a.detach(); this.players.delete(index); return a; }
    releaseNpc(index:number):NpcImpl|null { const a=this.npcs.get(index) ?? this.acquireNpc(index); a.detach(); this.npcs.delete(index); return a; }
    getPlayerByIndex(sid:number):PlayerImpl|null { const i=this.engine.playerEcs.getIndexForServerId(sid); return i===undefined ? null:this.acquirePlayer(i); }
    getNpcByIndex(sid:number):NpcImpl|null { const i=this.engine.npcEcs.getEcsIdForServer(sid); return i===undefined ? null:this.acquireNpc(i); }
    getPlayers():PlayerImpl[] { return [...this.engine.playerEcs.getAllActiveIndices()].map(i=>this.acquirePlayer(i)); }
    getNpcs():NpcImpl[] { return [...this.engine.npcEcs.getServerLinkedEcsIds()].filter(i=>this.engine.npcEcs.isActive(i)).map(i=>this.acquireNpc(i)); }
    resetActors():void { for(const a of this.players.values())a.detach(); for(const a of this.npcs.values())a.detach(); this.players.clear();this.npcs.clear();this.groundItemWrappers.clear();this.tiles.clear();this.tileBases.clear();this.views.clear();this.sceneRegistry.reset(); }
    getPlane():number { return ClientState.plane; } getBaseX():number { return ClientState.baseX; } getBaseY():number { return ClientState.baseY; }
    getVarps():Int32Array { return this.engine.varManager.values; }
    getVar(id:number):number { return this.getVarbitValue(id); } getVarbitValue(id:number):number;
    getVarbitValue(varps:Int32Array,id:number):number;
    getVarbitValue(idOrVarps:number|Int32Array,id?:number):number { if(typeof idOrVarps==="number")return this.engine.varManager.getVarbit(idOrVarps); const d=this.getVarbit(id!); const width=d.getMostSignificantBit()-d.getLeastSignificantBit()+1; const mask=width>=32 ? -1 : (2**width-1)|0; return (idOrVarps[d.getIndex()] >> d.getLeastSignificantBit()) & mask; }
    getVarpValue(id:number):number { return this.engine.varManager.getVarp(id); }
    getVarcIntValue(id:number):number { return this.engine.varManager.getVarcInt(id); }
    getVarcStrValue(id:number):string|null { return this.engine.varManager.getVarcString(id) ?? null; }
    setVarcIntValue(id:number,value:number):void { this.engine.varManager.setVarcInt(id,value); }
    setVarcStrValue(id:number,value:string):void { this.engine.varManager.setVarcString(id,value); }
    setVarbit(id:number,value:number):void { this.engine.varManager.setVarbit(id,value); }
    getVarbit(id:number) { const d=this.engine.varManager.customVarbits.get(id) ?? this.engine.varManager.varbitLoader.load(id); return {getId:()=>id,getIndex:()=>d.baseVar,getLeastSignificantBit:()=>d.startBit,getMostSignificantBit:()=>d.endBit}; }
    getRealSkillLevel(s:Skill):number { return this.engine.cs2Vm.context.getStatBase!(s); }
    getBoostedSkillLevel(s:Skill):number { return this.engine.cs2Vm.context.getStatLevel!(s); }
    getSkillExperience(s:Skill):number { return this.engine.cs2Vm.context.getStatXp!(s); }
    getOverallExperience():number { return this.getSkillExperiences().reduce((a,b)=>a+b,0); }
    getTotalLevel():number { return this.getRealSkillLevels().reduce((a,b)=>a+b,0); }
    getBoostedSkillLevels():number[] { return Skill.values().map(s=>this.getBoostedSkillLevel(s)); }
    getRealSkillLevels():number[] { return Skill.values().map(s=>this.getRealSkillLevel(s)); }
    getSkillExperiences():number[] { return Skill.values().map(s=>this.getSkillExperience(s)); }
    isPrayerActive(p:Prayer):boolean { return this.getVarbitValue(p)===1; }
    getItemContainer(id:number):ItemContainer|null { const inv=this.engine.cs2Vm?.context.inventories?.get(id); return inv ? new ItemContainer(id,inv.getSlots().map(i=>new Item(i.itemId,i.quantity))) : null; }
    wrapWidget(node:WidgetNode):WidgetImpl { let w=this.widgets.get(node); if(!w){w=new WidgetImpl(this,node);this.widgets.set(node,w);} return w; }
    getWidget(id:number,child?:number):WidgetImpl|null { const uid=child===undefined ? id : (id<<16)|child; const w=this.engine.widgetManager?.getWidgetByUid(uid); return w ? this.wrapWidget(w) : null; }
    getWidgetRoots():WidgetImpl[] { return this.engine.widgetManager?.getAllGroupRoots(this.getTopLevelInterfaceId()).map(w=>this.wrapWidget(w)) ?? []; }
    getTopLevelInterfaceId():number { return this.engine.widgetManager?.rootInterface ?? -1; }
    getEnergy():number { return this.engine.cs2Vm.context.getRunEnergy!(); }
    getWeight():number { return this.engine.cs2Vm.context.getWeight!(); }
    getWorld():number { return this.engine.loginState.worldId; }
    getWorldType():Set<WorldType> { return new Set(this.engine.isMembersWorld ? [WorldType.MEMBERS] : []); }
    isInInstancedRegion():boolean { return ClientState.inInstance; }
    getInstanceTemplateChunks():number[][][] { return ClientState.instanceTemplateChunks ?? []; }
    getMapRegions():number[] { const ids=new Set<number>();if(this.isInInstancedRegion()){for(const plane of this.getInstanceTemplateChunks())for(const xs of plane)for(const c of xs)if(c!==-1)ids.add((((c>>14)&1023)>>3)<<8 | (((c>>3)&2047)>>3));}else{const v=this.getTopLevelWorldView();for(let x=v.getBaseX()>>6;x<=(v.getBaseX()+v.getSizeX()-1)>>6;x++)for(let y=v.getBaseY()>>6;y<=(v.getBaseY()+v.getSizeY()-1)>>6;y++)ids.add(x<<8|y);}return [...ids]; }
    getTopLevelWorldView():WorldViewImpl { return this.getWorldView(-1)!; }
    getWorldView(id:number):WorldViewImpl|null { const native=this.engine.worldViewManager.getWorldView(id);if(id!==-1 && !native)return null; let v=this.views.get(id); if(!v || native && !v.matchesNative(native)){v=new WorldViewImpl(this,id,native);this.views.set(id,v);for(const [key,tile] of this.tiles)if(tile.worldViewId===id)this.tiles.delete(key);this.tileBases.delete(id);} return v; }
    findWorldViewFromWorldPoint(p:WorldPoint):WorldViewImpl|null { const v=this.engine.worldViewManager.findWorldViewAt(p.getX(),p.getY()); if(v)return this.getWorldView(v.id); const top=this.getTopLevelWorldView(); return top.contains(p)?top:null; }
    getScene() { return this.getTopLevelWorldView().getScene(); }
    getSceneTile(x:number,y:number,plane:number,view=-1):TileImpl { const v=this.getWorldView(view)!; const base=`${v.getBaseX()}:${v.getBaseY()}`;if(this.tileBases.get(view)!==base){for(const [key,tile] of this.tiles)if(tile.worldViewId===view)this.tiles.delete(key);this.tileBases.set(view,base);}const k=`${view}:${v.getBaseX()}:${v.getBaseY()}:${plane}:${x}:${y}`; let tile=this.tiles.get(k); if(!tile){tile=new TileImpl(this,x-v.getBaseX(),y-v.getBaseY(),plane,view);this.tiles.set(k,tile);} return tile; }
    ensureSceneMaps():void { for(const m of this.engine.renderer?.mapManager.mapSquares.values() ?? [])if(!this.sceneRegistry.hasMap(m))this.sceneRegistry.update(m); }
    getSelectedSceneTile():TileImpl|null { const t=(this.isMenuOpen() ? this.engine.menuTile : this.engine.hoveredTile) ?? this.engine.hoveredTile;if(!t)return null;const view=this.engine.worldViewManager.findWorldViewAt(t.tileX,t.tileY)?.id ?? -1;return this.getSceneTile(t.tileX,t.tileY,t.plane ?? this.getPlane(),view); }
    getLocalDestinationLocation():LocalPoint|null { return ClientState.destinationX===0 ? null : LocalPoint.fromScene(ClientState.destinationX,ClientState.destinationY); }
    getCanvas():HTMLCanvasElement { return this.engine.renderer.canvas; }
    getCanvasWidth():number { return this.getCanvas().width; } getCanvasHeight():number { return this.getCanvas().height; }
    isResized():boolean { return this.engine.cs2Vm.context.windowMode===2; }
    getMouseCanvasPosition():Point { return new Point(this.engine.inputManager.mouseX,this.engine.inputManager.mouseY); }
    getMouseCurrentButton():number { return this.engine.inputManager.clickMode2; }
    getMouseLastPressedMillis():number { return this.engine.inputManager.clickTime; }
    getCameraFpX():number { return (this.engine.camera.pos[0]-this.getBaseX())*128; }
    getCameraFpY():number { return (this.engine.camera.pos[2]-this.getBaseY())*128; }
    getCameraFpZ():number { return -this.engine.camera.pos[1]*128; }
    getCameraX():number { return Math.trunc(this.getCameraFpX()); } getCameraY():number { return Math.trunc(this.getCameraFpY()); } getCameraZ():number { return Math.trunc(this.getCameraFpZ()); }
    getCameraFpPitch():number { return this.engine.camera.getScenePitchAngle()*Math.PI/1024; } getCameraFpYaw():number { return this.engine.camera.yaw*Math.PI/1024; }
    getCameraPitch():number { return (this.engine.camera.getScenePitchAngle()*8)|0; } getCameraYaw():number { return (this.engine.camera.yaw*8)|0; }
    getViewportXOffset():number { return this.engine.camera.viewportXOffset; } getViewportYOffset():number { return this.engine.camera.viewportYOffset; }
    getViewportWidth():number { return this.engine.camera.viewportWidth; } getViewportHeight():number { return this.engine.camera.viewportHeight; }
    getScale():number { return this.engine.camera.viewportZoom; } getMapAngle():number { return this.engine.camera.yaw|0; }
    getTileHeight(x:number,y:number,plane:number,view=-1):number { const v=this.getWorldView(view)!; const r=this.engine.renderer as unknown as {getTileHeightAtPlane?:(x:number,y:number,p:number)=>number;overlays?:{getHost:()=>{getTileHeightAtPlane:(x:number,y:number,p:number)=>number}|undefined}}; const source=r.getTileHeightAtPlane ? r : r.overlays?.getHost()!; return -source.getTileHeightAtPlane!(v.getBaseX()+x/128,v.getBaseY()+y/128,plane)*128; }
    getItemDefinition(id:number):ItemCompositionImpl { const v=this.engine.objTypeLoader.load(id);return this.composition(v,()=>new ItemCompositionImpl(this.engine,v)); }
    getNpcDefinition(id:number):NPCCompositionImpl { const v=this.engine.npcTypeLoader.load(id);return this.composition(v,()=>new NPCCompositionImpl(this.engine,v)); }
    getObjectDefinition(id:number):ObjectCompositionImpl { const v=this.engine.locTypeLoader.load(id);return this.composition(v,()=>new ObjectCompositionImpl(this.engine,v)); }
    getEnum(id:number):EnumCompositionImpl { const v=this.engine.loaderFactory.getEnumTypeLoader()!.load(id);return this.composition(v,()=>new EnumCompositionImpl(v)); }
    getStructComposition(id:number):CompositionImpl { const v=this.engine.loaderFactory.getStructTypeLoader()!.load(id);return this.composition(v,()=>new CompositionImpl(this.engine,v)); }
    getDBTableField(rowId:number,column:number,tupleIndex:number):unknown[] { const repo=this.engine.cs2Vm.context.dbRepository!; const row=repo.getRowById(rowId); const c=row?.getColumn(column); const types=c?.types ?? repo.getTables().get(row?.tableId ?? -1)?.getColumn(column)?.types ?? []; const values=c?.values ?? repo.getTables().get(row?.tableId ?? -1)?.getColumn(column)?.defaultValues ?? []; return tupleIndex===-1 ? values.slice() : values.filter((_,i)=>i%types.length===tupleIndex); }
    getDBTableRows(table:number):number[] { return this.engine.cs2Vm.context.dbRepository!.getRows(table).map(r=>r.id); }
    getDBRowsByValue(table:number,column:number,tupleIndex:number,value:unknown):number[] { return this.getDBTableRows(table).filter(id=>this.getDBTableField(id,column,tupleIndex).includes(value)); }
    runScript(id:number,...args:(number|string|unknown[])[]):void { const script=this.engine.cs2Vm.context.loadScript(id); if(!script)throw new Error(`Client script ${id} is unavailable`); this.engine.cs2Vm.execute(script,args.filter((a):a is number=>typeof a==="number"),args.filter(a=>typeof a!=="number")); }
    getIntStack():Int32Array { return this.engine.cs2Vm.intStack; } getIntStackSize():number { return this.engine.cs2Vm.intStackSize; }
    setIntStackSize(size:number):void { if(!Number.isInteger(size)||size<0||size>this.getIntStack().length)throw new RangeError("Invalid int stack size"); this.engine.cs2Vm.intStackSize=size; }
    getObjectStack():unknown[] { return this.engine.cs2Vm.stringStack; } getObjectStackSize():number { return this.engine.cs2Vm.stringStackSize; }
    setObjectStackSize(size:number):void { if(!Number.isInteger(size)||size<0||size>1000)throw new RangeError("Invalid object stack size"); this.engine.cs2Vm.stringStackSize=size; }
    playSoundEffect(id:number):void { this.engine.cs2Vm.context.playSoundEffect!(id,0,1); }
    addChatMessage(type:ChatMessageType,name:string,message:string,sender:string,postEvent=true):MessageNodeImpl { const uid=chatHistory.addMessage(type,message,name,sender,false,false,postEvent); return MessageNodeImpl.wrap(chatHistory.getByUid(uid)!); }
    refreshChat():void { markChatTransmit(); this.engine.widgetManager.invalidateAll(); }
    hasHintArrow():boolean { return hintArrow.type!==0; } getHintArrowType():number { return hintArrow.type; }
    clearHintArrow():void { clearHintArrow(); }
    setHintArrow(target:WorldPoint|LocalPoint|NPC|Player):void { if(target instanceof LocalPoint)target=WorldPoint.fromLocal(this,target); if(target instanceof WorldPoint)setHintArrowTile(target.getX(),target.getY(),0,(2<<2)|target.getPlane()); else if("getIndex" in target)setHintArrowNpc(target.getIndex()); else setHintArrowPlayer(target.getId()); }
    getHintArrowPoint():WorldPoint|null { return hintArrow.type===2 ? new WorldPoint(hintArrow.x,hintArrow.y,hintArrow.plane) : null; }
    getHintArrowPlayer():Player|null { return hintArrow.type===3 ? this.getPlayerByIndex(hintArrow.playerId):null; }
    getHintArrowNpc():NPC|null { return hintArrow.type===1 ? this.getNpcByIndex(hintArrow.npcId):null; }
    isMenuOpen():boolean { return ClientState.isMenuOpen; } getMenu():Menu { if(!this.menu)throw new Error("RuneLite menu service is not bound"); return this.menu; }
    getMenuEntries():MenuEntry[] { return this.getMenu().getMenuEntries(); } setMenuEntries(entries:MenuEntry[]):void { this.getMenu().setMenuEntries(entries); }
    createMenuEntry(index:number):MenuEntry { return this.getMenu().createMenuEntry(index); }
    getMenuX():number { return this.getMenu().getMenuX(); } getMenuY():number { return this.getMenu().getMenuY(); } getMenuWidth():number { return this.getMenu().getMenuWidth(); } getMenuHeight():number { return this.getMenu().getMenuHeight(); }
    getPlayerOptions() { return this.playerMenus.options; }
    getPlayerOptionsPriorities() { return this.playerMenus.priorities; }
    getPlayerMenuTypes() { return this.playerMenus.types; }
    getUsername():string { return this.engine.loginState.username; } setUsername(v:string):void { this.engine.loginState.username=v; } setPassword(v:string):void { this.engine.loginState.password=v; }
    getCurrentLoginField():number { return this.engine.loginState.currentLoginField; } getLoginIndex():number { return this.engine.loginState.loginIndex; }
    getVarcMap():Map<number,unknown> { return this.varcs; }
    getServerVarps():Int32Array { return this.engine.varManager.serverValues; }
    getServerVarpValue(id:number):number { return this.getServerVarps()[id] ?? 0; }
    getServerVarbitValue(id:number):number { return this.getVarbitValue(this.getServerVarps(),id); }
    setVarbitValue(varps:Int32Array,id:number,value:number):void { const d=this.getVarbit(id),start=d.getLeastSignificantBit(),width=d.getMostSignificantBit()-start+1,mask=width>=32 ? -1 : (2**width-1)|0; if(value<0 || value>mask)value=0; const shifted=mask<<start; varps[d.getIndex()]=(varps[d.getIndex()]&~shifted)|((value<<start)&shifted); }
    getArray(id:number):Int32Array { return this.engine.varManager.arrays[id]; } getArraySizes():Int32Array { return this.engine.varManager.arrayLengths; }
    getItemContainers():Map<number,ItemContainer> { return new Map([...(this.engine.cs2Vm.context.inventories?.keys() ?? [])].map(id=>[id,this.getItemContainer(id)!])); }
    getItemCount():number { return this.engine.objTypeLoader.getCount(); }
    getRevision():number { return this.engine.loadedCache!.info.revision; }
    getFPS():number { return Math.round(this.engine.renderer.stats.frameTimeFps); }
    get3dZoom():number { return this.getScale(); }
    getCenterX():number { return this.getViewportWidth()>>1; } getCenterY():number { return this.getViewportHeight()>>1; }
    getTileHeights():number[][][] { return this.getScene().getTileHeights(); }
    getTileSettings():number[][][] { return this.getWorldViewTileSettings(-1); }
    getWorldViewTileSettings(id:number):number[][][] { return this.getWorldView(id)!.getScene().getTileSettings(); }
    getCollisionMaps() { return this.getWorldViewCollisionMaps(-1); }
    getWorldViewCollisionMaps(id:number) { return this.getWorldView(id)!.getScene().getCollisionMaps(); }
    getSceneMap(wx:number,wy:number,view=-1) { return (view===-1 ? this.engine.renderer.mapManager.getMapForWorldTile(wx,wy) : this.engine.worldViewManager.getOverlayMapSquare(view,this.engine.renderer.mapManager)) as (import("./SceneRegistry").SceneMapData & {tilePresenceByLevel?:Uint8Array[];borderSize?:number;tileRenderFlags?:Uint8Array[][];getCollisionFlag?:(p:number,x:number,y:number)=>number})|undefined; }
    sampleTileSetting(wx:number,wy:number,p:number,view=-1):number { const m=this.getSceneMap(wx,wy,view);return m?.tileRenderFlags?.[p]?.[wx-(m.getRenderBaseTileX?.() ?? m.mapX*64)+(m.borderSize ?? 0)]?.[wy-(m.getRenderBaseTileY?.() ?? m.mapY*64)+(m.borderSize ?? 0)] ?? 0; }
    sampleCollision(wx:number,wy:number,p:number,view=-1):number { const m=this.getSceneMap(wx,wy,view);return m?.getCollisionFlag?.(p,wx-(m.getRenderBaseTileX?.() ?? m.mapX*64),wy-(m.getRenderBaseTileY?.() ?? m.mapY*64)) ?? 0x100; }
    getMinimapBounds() { const w=this.engine.widgetManager?.minimapWidget; return w ? this.wrapWidget(w).getBounds() : null; }
    getMinimapZoom():number { return this.engine.minimapZoom; } isMinimapZoom():boolean { return this.engine.minimapZoomEnabled; }
    setMinimapZoom(value:number|boolean):void { if(typeof value==="boolean"){this.engine.minimapZoomEnabled=value;this.engine.minimapZoom=4;}else this.engine.minimapZoom=Math.max(2,Math.min(8,value)); }
    getCameraYawTarget():number { return this.engine.camera.getTargetYaw()*8|0; } getCameraPitchTarget():number { return Camera.rawPitchToScenePitchAngle(this.engine.camera.getTargetPitch())*8|0; }
    setCameraYawTarget(value:number):void { this.engine.camera.setTargetYaw(value/8); } setCameraPitchTarget(value:number):void { this.engine.camera.setTargetPitch(((value/8)-128)*512/255); }
    getExpandedMapLoading():number { return this.engine.expandedMapLoading; } setExpandedMapLoading(chunks:number):void { this.engine.expandedMapLoading=Math.max(0,Math.min(20,chunks|0)); }
    isKeyPressed(keycode:number):boolean { return this.engine.inputManager.isKeyHeld(keycode); }
    isMouseoverTextEnabled():boolean { return this.engine.showMouseOverText; } setMouseoverTextEnabled(value:boolean):void { this.engine.showMouseOverText=value; }
    getMusicVolume():number { return Math.round(this.engine.cs2Vm.context.getMusicVolume!()*255/127); } setMusicVolume(value:number):void { this.engine.cs2Vm.context.setMusicVolume!(Math.max(0,Math.min(255,value))*127/255); }
    getScriptActiveWidget():WidgetImpl|null { const w=this.engine.cs2Vm.activeWidget; return w ? this.wrapWidget(w):null; }
    getScriptDotWidget():WidgetImpl|null { const w=this.engine.cs2Vm.dotWidget; return w ? this.wrapWidget(w):null; }
    getWidgetFlags(widget:import("../api/widgets/Widget").Widget):number { return this.engine.widgetManager.getWidgetFlags((widget as WidgetImpl).node); }
    getWidgetConfig(widget:import("../api/widgets/Widget").Widget):number { return this.getWidgetFlags(widget); }
    closeInterface(widget:import("../api/widgets/Widget").Widget):void { this.engine.widgetManager.closeSubInterface(widget.getId()); }
    getRealDimensions():Dimension { return new Dimension(this.getCanvasWidth(),this.getCanvasHeight()); }
    setUnlockedFps(unlock:boolean):void { this.engine.renderer.fpsLimit=unlock ? 0 : 50; }
    setUnlockedFpsTarget(fps:number):void { this.engine.renderer.fpsLimit=Math.max(0,fps|0); }
    getCameraMode():number { return this.engine.followPlayerCamera ? 0 : 1; } setCameraMode(mode:number):void { this.engine.followPlayerCamera=mode===0; }
    setCameraSpeed(speed:number):void { this.engine.cameraSpeed=speed; }
    getIndex(id:number):IndexDataBaseImpl { return new IndexDataBaseImpl(this.engine.cacheSystem.getIndex(id)); }
    getIndexSprites():IndexDataBaseImpl { return this.getIndex(IndexType.DAT2.sprites); }
    getIndexScripts():IndexDataBaseImpl { return this.getIndex(IndexType.DAT2.clientScript); }
    getIndexConfig():IndexDataBaseImpl { return this.getIndex(IndexType.DAT2.configs); }
    getDBRowConfig(rowId:number) { const row=this.engine.cs2Vm.context.dbRepository!.getRowById(rowId);return row ? {getTableID:()=>row.tableId} : null; }
    loadAnimation(id:number):AnimationImpl { const v=this.engine.seqTypeLoader.load(id);return this.composition(v,()=>new AnimationImpl(v)); }
    loadModelData(id:number):ModelDataImpl|null { const d=this.engine.modelLoader.getModel(id);return d ? new ModelDataImpl(this.engine,d):null; }
    loadModel(id:number,colorToFind?:number[],colorToReplace?:number[]):ModelImpl|null { let d=this.loadModelData(id);if(!d)return null;if(colorToFind){if(colorToFind.length!==colorToReplace?.length)throw new RangeError("Recolor arrays must have equal lengths");d=d.shallowCopy().cloneColors();colorToFind.forEach((from,i)=>d!.recolor(from,colorToReplace![i]));}return d.light(); }
    mergeModels(models:Model[],length?:number):ModelImpl;
    mergeModels(models:ModelData[],length?:number):ModelDataImpl;
    mergeModels(models:(Model|ModelData)[],length=models.length):ModelImpl|ModelDataImpl { if(length<0 || length>models.length)throw new RangeError("Invalid model merge length");const selected=models.slice(0,length);return selected[0] instanceof ModelImpl ? new ModelImpl(EngineModel.merge(selected.map(m=>(m as ModelImpl).value),length)) : new ModelDataImpl(this.engine,EngineModelData.merge(selected.map(m=>(m as ModelDataImpl).value),length)); }
    getFollower():NpcImpl|null { return this.getNpcByIndex(ClientState.followerIndex); }
    setOtp(otp:string):void { this.engine.loginState.otp=otp; }
    getActorLogicalHeight(kind:"player"|"npc",index:number):number { if(kind==="player")return Math.round((this.engine.playerEcs.getDefaultHeightTiles(index) ?? (this.engine.playerEcs.getBaseModel(index)?.height ?? 0)/128)*128); const id=this.engine.npcEcs.getNpcTypeId(index);const r=this.engine.renderer as unknown as {getNpcDefaultHeight?:(id:number)=>number;overlays?:{getHost:()=>{getNpcDefaultHeight:(id:number)=>number}|undefined}};const source=r.getNpcDefaultHeight ? r:r.overlays?.getHost();return source?.getNpcDefaultHeight!(id) ?? 0; }
    getCameraFocalPointX():number { return (this.engine.camera.focalPoint[0]-this.getBaseX())*128; }
    getCameraFocalPointY():number { return (this.engine.camera.focalPoint[2]-this.getBaseY())*128; }
    getCameraFocalPointZ():number { return -this.engine.camera.focalPoint[1]*128; }
    private moveFocal(x:number,y:number,z:number):void { if(this.getCameraMode()!==1)return;this.engine.camera.moveFocalPoint(this.getBaseX()+x/128,-z/128,this.getBaseY()+y/128); }
    setCameraFocalPointX(x:number):void { this.moveFocal(x,this.getCameraFocalPointY(),this.getCameraFocalPointZ()); }
    setCameraFocalPointY(y:number):void { this.moveFocal(this.getCameraFocalPointX(),y,this.getCameraFocalPointZ()); }
    setCameraFocalPointZ(z:number):void { this.moveFocal(this.getCameraFocalPointX(),this.getCameraFocalPointY(),z); }
    getOculusOrbFocalPointX():number { return this.getCameraFocalPointX()|0; } getOculusOrbFocalPointY():number { return this.getCameraFocalPointY()|0; }
    getFriendContainer() { return this.friendContainer; }
    getIgnoreContainer() { return this.ignoreContainer; }
    getFriendsChatManager():FriendsChatManager|null { return this.socialState.joined ? this.friendsChatManager : null; }
    isFriended(name:string,mustBeLoggedIn:boolean):boolean { const f=this.friendContainer.findByName(name);return f!==null && (!mustBeLoggedIn || f.getWorld()!==0); }
    getProjectiles():ProjectileImpl[] { const manager=this.engine.renderer.getProjectileManager() as (import("../../game/interfaces/IProjectileManager").IProjectileManager & {getProjectiles:()=>NativeProjectile[]})|undefined;return manager ? manager.getProjectiles().map(p=>this.wrapProjectile(p)):[]; }
    createSpritePixels(pixels:Int32Array,width:number,height:number):SpritePixelsImpl { if(!Number.isInteger(width)||!Number.isInteger(height)||width<0||height<0||pixels.length!==width*height)throw new RangeError("Invalid sprite dimensions");return new SpritePixelsImpl(NativeSprite.fromPixels(pixels,width,height)); }
    createIndexedSprite():IndexedSpriteImpl { const s=new NativeIndexedSprite();s.pixels=new Uint8Array();s.palette=new Int32Array();s.width=s.height=s.subWidth=s.subHeight=s.xOffset=s.yOffset=0;return new IndexedSpriteImpl(s); }
    getSprites(source:IndexDataBase,archive:number,file:number):SpritePixelsImpl[]|null { const data=source.loadData(archive,file);if(!data)return null;SpriteLoader.load(data);const sprites=Array.from({length:SpriteLoader.spriteCount},(_,i)=>{const pixels=Int32Array.from(SpriteLoader.pixels![i],v=>SpriteLoader.palette![v]);const sprite=NativeSprite.fromPixels(pixels,SpriteLoader.widths![i],SpriteLoader.heights![i]);sprite.width=SpriteLoader.width;sprite.height=SpriteLoader.height;sprite.xOffset=SpriteLoader.xOffsets![i];sprite.yOffset=SpriteLoader.yOffsets![i];return new SpritePixelsImpl(sprite,SpriteLoader.alphas?.[i]);});SpriteLoader.reset();return sprites; }
    getPreferences():Preferences { return this.ui.preferences; }
    isDraggingWidget():boolean { return this.ui.isDraggingWidget(); }
    getDraggedWidget():Widget|null { return this.ui.getDraggedWidget(); }
    getDraggedOnWidget():Widget|null { return this.ui.getDraggedOnWidget(); }
    setDraggedOnWidget(widget:Widget|null):void { this.ui.setDraggedOnWidget(widget); }
    getDragTime():number { return this.ui.getDragTime(); }
    isWidgetSelected():boolean { return this.ui.isWidgetSelected(); }
    setWidgetSelected(selected:boolean):void { this.ui.setWidgetSelected(selected); }
    getSelectedWidget():Widget|null { return this.ui.getSelectedWidget(); }
    getWorldHost():string { return this.ui.getWorldHost(); }
    menuAction(p0:number,p1:number,type:MenuAction,id:number,itemId:number,option:string,target:string):void { this.ui.menuAction(p0,p1,type,id,itemId,option,target); }
    applyTransformations(model:Model,a:Animation|null,frameA:number,b:Animation|null,frameB:number):ModelImpl { return applyTransformations(this.engine,model as ModelImpl,a,frameA,b,frameB); }
    createItemSprite(id:number,quantity:number,border:number,shadow:number,stackable:number,noted:boolean,scale:number):SpritePixelsImpl|null { const sprite=this.icons().createSprite(id,quantity,border,shadow,stackable,noted,scale);return sprite ? new SpritePixelsImpl(sprite):null; }
    getItemCompositionCache() { return {reset:()=>this.engine.objTypeLoader.clearCache()}; }
    getObjectCompositionCache() { return {reset:()=>this.engine.locTypeLoader.clearCache()}; }
    getStructCompositionCache() { return {reset:()=>this.engine.loaderFactory.getStructTypeLoader()!.clearCache()}; }
    getAnimationCache() { return {reset:()=>{this.engine.seqTypeLoader.clearCache();this.engine.seqFrameLoader.clearCache();this.engine.skeletalSeqLoader?.clearCache();}}; }
    getItemModelCache() { return {reset:()=>this.icons().clearModelCache()}; }
    getItemSpriteCache() { return {reset:()=>this.icons().clearSpriteCache()}; }
    getMessages():MessageHashTable { return this.messages; }
    getChatLineMap():ChatLineMap { return this.chatLines.sync(); }
    getGrandExchangeOffers() { return getGrandExchangeOffers(this.engine.varManager); }
    getTextureProvider():TextureProviderImpl { return this.textures; }
    getActorGraphic(kind:"player"|"npc",sid:number):number { const renderer=this.engine.renderer as unknown as {gfxManager?:{getActorGraphic(kind:"player"|"npc",id:number):number};actors?:{getActorGraphic(kind:"player"|"npc",id:number):number}}; return (renderer.gfxManager ?? renderer.actors)?.getActorGraphic(kind,sid) ?? -1; }
    getActorHealth(kind:"player"|"npc",sid:number):{ratio:number;scale:number} { const r=this.engine.renderer as unknown as {playerHealthBars?:Map<number,{bars:{def:{width:number;int5:number};updates:{cycle:number;health:number;health2:number;cycleOffset:number}[]}[]}>;npcHealthBars?:Map<number,{bars:{def:{width:number;int5:number};updates:{cycle:number;health:number;health2:number;cycleOffset:number}[]}[]}>;overlays?:{getHost:()=>{playerHealthBars?:typeof r.playerHealthBars;npcHealthBars?:typeof r.npcHealthBars}|undefined}}; const source=r.playerHealthBars ? r:r.overlays?.getHost(); const map=kind==="player" ? source?.playerHealthBars : source?.npcHealthBars; for(const bar of map?.get(sid)?.bars ?? []) { const u=bar.updates.filter(u=>u.cycle<=this.getGameCycle()).sort((a,b)=>b.cycle-a.cycle)[0]; if(u && u.cycle+u.cycleOffset+bar.def.int5>this.getGameCycle())return {ratio:u.health2,scale:bar.def.width}; } return {ratio:-1,scale:-1}; }
}
