"use strict";
const C=require('./Common.DukeSucellus');
const Preparation=require('./Preparation.DukeSucellus');
const {Fight}=require('./Fight.DukeSucellus');
const Records=require('./Records.DukeSucellus');
let AreaClass;
function areaClass() {
  if(AreaClass) return AreaClass;
  const {TemplatedInstanceArea}=C.core;
  AreaClass=class DukeAsylum extends TemplatedInstanceArea {
    constructor() { super(C.data.instance.width,C.data.instance.height); this.session=null; }
    getName(){return 'Duke Sucellus asylum';}
    allowSummonPet(){return false;}
    process(mobile) {
      const s=this.session;
      if(s && !s.ended && mobile===s.player && !mobile.isNeedsPlacement() && mobile.getRunningDirection()!==C.core.Direction.NONE) s.ranSinceKill=true;
    }
    canAttack(attacker,target) {
      const s=this.session;
      if(target===s?.boss) return attacker===s.player && s.fight.active && !s.fight.over;
      if(attacker===s?.boss) return target===s.player && s.fight.active && !s.fight.over;
      return null;
    }
    postLeave(mobile,logout) {
      const s=this.session;
      if(s && mobile===s.player) {
        if(logout) mobile.setLocation(new C.core.Location(...C.data.site.outside));
        s.end();
      }
      super.postLeave(mobile,logout);
    }
  };
  return AreaClass;
}
class Session {
  constructor(player) {
    this.player=player; this.area=new (areaClass())(); this.area.session=this;
    this.ended=false; this.tick=0; this.perfectKills=0; this.ranSinceKill=false; this.vats=new Map(); this.tools=new Set();
    this.picks={arder:0,musca:0}; this.meter=0; this.action=null;this.passive=new Set();this.passiveExpiry=new Map();
    const i=C.data.instance;
    for(let x=0;x<i.width;x++) for(let y=0;y<i.height;y++) this.area.setChunk(0,x,y,{sourceChunkX:i.sourceChunkX+x,sourceChunkY:i.sourceChunkY+y,sourcePlane:0,rotation:0});
  }
  tile([x,y,z=0]) { const i=C.data.instance; return this.area.tile(x-i.sourceChunkX*8,y-i.sourceChunkY*8,z); }
  place(id,at,rotation=0) {
    const object=new C.core.GameObject(id,this.tile(at),10,rotation,this.area);
    C.core.ObjectManager.register(object,true); return object;
  }
  spawnPassive(id,tile,face=0) {
    const at=this.tile(tile),npc=C.api.spawnNpc({id,x:at.getX(),y:at.getY(),z:at.getZ(),owner:this.player,wanderRadius:0,face});
    if(!npc)return null;
    npc.__skipDefaultRespawn=true;npc.setScriptedMovement(true);npc.setUntargetable(true);npc.setFlag('combat:no-retaliate');
    this.area.add(npc);this.passive.add(npc);return npc;
  }
  removePassive(npc) {
    if(!npc||!this.passive.delete(npc))return;
    this.passiveExpiry.delete(npc);
    this.area.detach(npc);C.api.removeNpc(npc);
  }
  setExit(active) {
    const object=new C.core.GameObject(active?C.data.site.escape:C.data.site.leave,this.tile(C.data.site.gate),0,3,this.area);
    C.core.ObjectManager.register(object,true);
  }
  reset() {
    if(this.ended) return;
    this.fight?.stop();
    if(this.boss) { this.area.detach(this.boss); C.api.removeNpc(this.boss); }
    const at=this.tile(C.data.site.boss);
    this.boss=C.api.spawnNpc({id:C.data.npcs.awake,x:at.getX(),y:at.getY(),z:at.getZ(),owner:this.player,wanderRadius:0,face:C.core.Direction.SOUTH.getId()});
    if(!this.boss) { this.end(); return; }
    this.boss.__skipDefaultRespawn=true;
    this.boss.setScriptedMovement(true); this.boss.setNpcTransformationId(C.data.npcs.asleep);
    this.boss.setMaxHitpoints(C.data.normal.meter); this.boss.setHitpoints(C.data.normal.meter);
    this.area.add(this.boss);
    this.meter=0;this.wakeAt=null; this.fight=new Fight(this,this.boss); this.boss.__dukeSucellusFight=this.fight;
    this.setExit(false); Preparation.refresh(this);
  }
  process() {
    if(this.ended) return;
    if(!this.player.isRegistered()) { this.end(); return; }
    if(this.player.getHitpoints()<=0) { this.fight?.stop(); return; }
    this.tick++;
    for(const [npc,due] of this.passiveExpiry)if(this.tick>=due)this.removePassive(npc);
    Preparation.process(this); this.fight?.process();
  }
  end() {
    if(this.ended) return;
    this.ended=true; this.action=null; this.fight?.stop(); C.sessions.delete(this.player);
    C.clearSupplies(this.player); this.player.setAttribute(C.INSIDE,false);
    C.api.emitCustomEvent('boss-hud:hide',{player:this.player,fade:false,afterTicks:0});
    if(this.player.getPrivateArea()===this.area) this.area.remove(this.player);
    if(this.boss) { this.area.detach(this.boss); C.api.removeNpc(this.boss); }
    for(const npc of [...this.passive])this.removePassive(npc);
    if(!this.area.isDestroyed()) this.area.destroy();
  }
}
function enter(player) {
  if(C.sessionOf(player)) return false;
  const request={player,key:C.data.quest,complete:false}; C.api.emitCustomEvent('quest:is-complete',request);
  if(!request.complete) return false;
  // An incomplete awakened implementation must never spend an orb or claim parity.
  const session=new Session(player); C.sessions.set(player,session);
  try {
    player.getMovementQueue().reset(); player.getCombat().reset(); session.area.enter(player);
    player.moveTo(session.tile(C.data.site.arrival)); player.setAttribute(C.INSIDE,true); session.reset();
    const {Task,TaskManager}=C.core;
    TaskManager.submit(new(class extends Task { constructor(){super(1,null,false);} execute(){if(session.ended){this.stop();return;} session.process();} })());
    return true;
  } catch(error) { session.end(); player.moveTo(new C.core.Location(...C.data.site.outside)); throw error; }
}
function leave(player) {
  const session=C.sessionOf(player); if(!session) return false;
  player.moveTo(new C.core.Location(...C.data.site.outside)); session.end(); return true;
}
function beforeObject(event) {
  const {player}=event, session=C.sessionOf(player), id=event.objectId ?? event.definition?.id;
  const p=event.location ?? event.object?.getLocation();
  if(!session && id===49513 && (p?.getX?.() ?? p?.x)===2926 && (p?.getY?.() ?? p?.y)===10354 && (p?.getZ?.() ?? p?.z)===0) {
    const request={player,key:C.data.quest,complete:false}; C.api.emitCustomEvent('quest:is-complete',request);
    if(request.complete) {
      // Postquest the heavy door skips the prison, as documented by the Strategies page.
      player.getMovementQueue().reset(); player.getCombat().reset();
      player.moveTo(new C.core.Location(...C.data.site.outside)); event.handled=true;
    }
    return;
  }
  if(session && player.getPrivateArea?.()===session.area) {
    if([C.data.site.escape,C.data.site.leave,C.data.site.entry].includes(id)) { event.handled=leave(player); return; }
    if(Preparation.object(event)) event.handled=true;
    return;
  }
  if(id!==C.data.site.entry) return;
  if((p?.getX?.() ?? p?.x)!==C.data.site.gate[0] || (p?.getY?.() ?? p?.y)!==C.data.site.gate[1] || (p?.getZ?.() ?? p?.z)!==0) return;
  if(enter(player)) event.handled=true;
}
function beforePlayerDeath({player}) {
  const s=C.sessionOf(player);
  if(!s)return;
  C.clearSupplies(player);
  if(!s.deathRecorded){s.deathRecorded=true;Records.died(player);}
}
function disconnect({player}) { C.sessionOf(player)?.end(); }
function login({player}) {
  if(!player.getAttribute(C.INSIDE) || C.sessionOf(player)) return;
  player.setAttribute(C.INSIDE,false); C.clearSupplies(player); player.moveTo(new C.core.Location(...C.data.site.outside));
}
function grave(request) {
  if(!C.sessionOf(request.player)) return;
  const [x,y,z]=C.data.site.outside; request.tile={x,y,z};
  if(C.kills(request.player)<5) request.feeMultiplier=.25;
}
function counts({player,counts}) { const n=C.count(player,C.KILLS); if(n>0) counts['Duke Sucellus']=n; }
function best(request) { if(request.monster==='Duke Sucellus') request.best=C.count(request.player,C.BEST); }
function attach(api) {
  api.persistAttribute(C.INSIDE,false); api.persistAttribute(C.KILLS,0); api.persistAttribute(C.BEST,0);
  api.onBeforeObjectInteraction(beforeObject);
  api.onPlayerBeforeDeath(beforePlayerDeath); api.onPlayerDisconnect(disconnect); api.onPlayerLogin(login);
  api.onCustomEvent('gravestones:grave-location',grave);
  api.onCustomEvent('combat-achievements:kill-count',counts); api.onCustomEvent('combat-achievements:personal-best',best);
}
module.exports={Session,enter,leave,attach,beforeObject,grave,login,beforePlayerDeath};
