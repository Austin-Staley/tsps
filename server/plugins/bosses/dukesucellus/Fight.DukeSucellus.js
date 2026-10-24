"use strict";
const C=require('./Common.DukeSucellus');
const M=require('./Model.DukeSucellus');
const Records=require('./Records.DukeSucellus');
const Hazards=require('./Hazards.DukeSucellus');
const Preparation=require('./Preparation.DukeSucellus');
class Fight {
  constructor(session,boss) {
    this.session=session; this.player=session.player; this.boss=boss;
    this.active=false; this.over=false; this.stopped=false; this.perfect=true;
    this.events=[]; this.pending=new Set(); this.clock=new M.AttackClock(); this.nextAttack=Infinity;
    this.started=0; this.respawnAt=Infinity; this.wonAlready=false;
    this.baselineKills=C.kills(this.player);
    this.lastAttackCycle=-1; this.mirror=true; this.coldFeetEligible=false;
  }
  valid() { return !this.over && !this.stopped && !this.session.ended && this.session.fight===this && this.player.getHitpoints()>0; }
  at(delay,action) { this.events.push({due:this.session.tick+delay,action}); }
  wake() {
    if(this.active || !this.valid()) return;
    this.active=true; this.started=C.core.World.getProcessCycle(); this.events=[];
    Hazards.clear(this);
    Preparation.refresh(this.session);
    this.boss.setNpcTransformationId(C.data.npcs.awake);
    this.boss.setCombatOverride({stats:C.data.normal.stats});
    this.boss.setMaxHitpoints(C.data.normal.hitpoints); this.boss.setHitpoints(C.data.normal.hitpoints);
    this.boss.setDisplayedHealth(null);this.boss.removeHeadbar(C.data.meters.poison.id);
    this.boss.performAnimation(new C.core.Animation(C.data.animations.wake));
    this.boss.setAttribute(C.DEMONBANE,.7);
    this.nextAttack=this.session.tick+C.data.timing.wake;
    this.session.setExit(true);
    C.api.emitCustomEvent('boss-hud:show',{player:this.player,npcId:C.data.npcs.awake,current:C.data.normal.hitpoints,maximum:C.data.normal.hitpoints});
  }
  process() {
    if(this.over) {
      if(this.session.tick>=this.respawnAt && !this.session.ended) this.session.reset();
      return;
    }
    if(!this.valid()) return;
    const due=this.events.filter(e=>e.due<=this.session.tick);
    this.events=this.events.filter(e=>e.due>this.session.tick);
    for(const e of due) { if(!this.valid()) break; e.action(); }
    if(!this.valid()) return;
    if(!this.active) { this.preparationHazards(); return; }
    C.api.emitCustomEvent('boss-hud:update',{player:this.player,current:this.boss.getHitpoints()});
    if(this.session.tick<this.nextAttack) return;
    const action=this.clock.next(this.boss.getHitpoints());
    const attackTicks=M.attackTicks(this.boss.getHitpoints());
    if(action==='gaze') this.gaze(); else if(action==='gas') this.gas(); else this.auto();
    const delay=action==='gaze'?C.data.timing.gaze:action==='gas'?(M.gasCount(this.boss.getHitpoints())-1)*C.data.timing.gasSpitInterval+attackTicks-1:attackTicks;
    this.nextAttack=this.session.tick+delay;
  }
  auto() {
    this.lastAttackCycle=C.core.World.getProcessCycle();
    const {normal:n,timing:t,graphics:g,animations:a}=C.data;
    const target=C.source(this.session,this.player.getLocation());
    this.boss.setPositionToFace(this.player.getLocation());
    if(M.melee(target)) {
      this.boss.performAnimation(new C.core.Animation(a.melee));
      this.boss.performGraphic(new C.core.Graphic(g.meleeBody));
      g.meleeRow.forEach((id,index)=>C.graphic(this.session,id,[3036+index,6451]));
      C.strike(this,'melee',C.protectedFrom(this.player,'PROTECT_FROM_MELEE')?n.protectedChip:n.chip,{accurate:false,avoidable:false});
      this.at(t.slam,()=>{
        // The damaging slam is the aimed tile, not the chip's surrounding 3x3.
        if(M.near(C.source(this.session,this.player.getLocation()),target,0) && !M.hidden(target))
          C.strike(this,'melee',C.protectedFrom(this.player,'PROTECT_FROM_MELEE')?n.protectedSlam:n.slam);
      });
    } else {
      this.boss.performAnimation(new C.core.Animation(a.magic));
      const at=this.player.getLocation().clone();
      this.player.getPacketSender().sendProjectile(this.session.tile([3039,6453]),at,0,120,g.magicProjectile,87.5,25,this.player,50,5,32,null);
      this.at(t.magic,()=>{
        this.player.performGraphic(new C.core.Graphic(g.magicImpact));
        C.strike(this,'magic',C.protectedFrom(this.player,'PROTECT_FROM_MAGIC')?n.protectedMagic:n.magic,{evenZero:true});
      });
    }
  }
  gaze() {
    this.lastAttackCycle=C.core.World.getProcessCycle();
    this.boss.performAnimation(new C.core.Animation(C.data.animations.gaze));
    const overlay=C.data.gazeOverlay;
    this.player.getPacketSender().sendSubInterface((overlay.targetGroup<<16)|overlay.targetComponent,overlay.group,1);this.gazeVisible=true;
    this.player.sendMessage('Duke Sucellus turns his gaze upon you...');
    this.at(C.data.timing.gazeWarning,()=>{
      this.hideGaze();
      if(M.hidden(C.source(this.session,this.player.getLocation()))) this.player.sendMessage("You manage to avoid Duke Sucellus' gaze.");
      else C.hurt(this,C.data.normal.gaze);
    });
  }
  hideGaze() {
    if(!this.gazeVisible)return;
    this.gazeVisible=false;
    const overlay=C.data.gazeOverlay,sender=this.player.getPacketSender();
    if(sender.isSubInterfaceOpen(overlay.group)===true)sender.closeSubInterface((overlay.targetGroup<<16)|overlay.targetComponent);
  }
  ignite(tile) {
    Hazards.gas(this,tile,false);
  }
  gas() {
    const amount=M.gasCount(this.boss.getHitpoints());
    const spit=()=>{
      this.lastAttackCycle=C.core.World.getProcessCycle();
      this.boss.performAnimation(new C.core.Animation(C.data.animations.gas));
      const here=C.source(this.session,this.player.getLocation());
      const vents=[...C.data.vents].sort((a,b)=>Math.hypot(a[0]-here[0],a[1]-here[1])-Math.hypot(b[0]-here[0],b[1]-here[1]));
      this.player.getPacketSender().sendProjectile(this.session.tile([3039,6453]),this.session.tile(vents[0]),0,90,C.data.graphics.gasProjectile,87.5,0,null,20,5,32,null);
      this.ignite(vents[0]);
    };
    spit();
    for(let i=1;i<amount;i++) this.at(i*C.data.timing.gasSpitInterval,spit);
  }
  preparationHazards() {
    Hazards.preparation(this);
  }
  fell() {
    if(this.over || this.stopped || !this.active) return;
    // Slayer's death handler may complete the assignment before won() runs.
    const task={player:this.player,npc:this.boss,onTask:false}; C.api.emitCustomEvent('slayer:on-task',task);
    this.completedOnSlayerTask=task.onTask;
    this.over=true; this.events=[]; C.cancelPending(this);
    this.hideGaze();
    Hazards.clear(this);
    this.coldFeetEligible=this.perfect && !this.session.ranSinceKill;
    this.session.ranSinceKill=false;
    this.finishedTicks=Math.max(1,C.core.World.getProcessCycle()-this.started);
    this.respawnAt=this.session.tick+C.data.timing.respawn;
    this.session.setExit(false);
    C.api.emitCustomEvent('boss-hud:update',{player:this.player,current:0});
  }
  won(killer) {
    if(!this.over || this.wonAlready || killer!==this.player || this.session.fight!==this) return;
    this.wonAlready=true;
    const count=Math.max(this.baselineKills+1,C.count(this.player,C.KILLS)+1,C.kills(this.player)), ticks=this.finishedTicks;
    this.player.setAttribute(C.KILLS,count); this.player.getPacketSender().sendConfig(C.data.killCountVarp,count);
    this.player.sendMessage(`Your Duke Sucellus kill count is: ${count}.`);
    const previous=C.count(this.player,C.BEST);
    if(!previous || ticks<previous) this.player.setAttribute(C.BEST,ticks);
    Records.kill(ticks);
    this.player.sendMessage(`Fight duration: ${(ticks*.6).toFixed(1)} seconds.`);
    if(this.perfect) this.session.perfectKills++;
    if(this.coldFeetEligible) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:'Cold Feet'});
    if(this.mirror) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:'Mirror Image'});
    if(this.session.perfectKills>=5) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:'Perfect Duke Sucellus'});
    if(!this.completedOnSlayerTask) for(const [rank,seconds] of [['Trialist',60],['Chaser',50],['Runner',40]]) {
      if(ticks*.6<seconds) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:`Duke Sucellus Speed-${rank}`});
    }
    this.boss.setNpcTransformationId(C.data.npcs.dead);
    C.api.emitCustomEvent('boss-hud:hide',{player:this.player,fade:false,afterTicks:0});
  }
  stop() { this.stopped=true; this.events=[]; C.cancelPending(this);this.hideGaze(); }
}
const fightOf=npc=>npc?.__dukeSucellusFight;
function beforeDeath({npc}) { fightOf(npc)?.fell(); }
function death(event) {
  const f=fightOf(event.npc);
  f?.won(event.killer);
  if(f?.wonAlready && f.player===event.killer && !f.stopped && !f.session.ended)
    event.remains={ticks:Math.max(1,f.respawnAt-f.session.tick),respawnTicks:0};
}
function playerAttack({attacker,target}) {
  const f=fightOf(target);
  if(f && f.boss===target && attacker===f.player && f.active && !f.over && !f.stopped && !f.session.ended && f.session.fight===f && f.lastAttackCycle!==C.core.World.getProcessCycle()) f.mirror=false;
}
function context({player,npc,context}) {
  const f=fightOf(npc);
  if(f?.over && f.boss===npc && !f.stopped && f.player===player && f.session.fight===f && !f.session.ended && npc.getHitpoints()<=0) context.perfectKill=f.perfect;
}
function lootLocation(event) { const f=fightOf(event.npc); if(f && f.boss===event.npc && !f.stopped && !f.session.ended && f.session.fight===f && event.player===f.player) event.location=f.session.tile([3039,6451,0]); }
function noDefaultCombat() {
  const {CombatMethod,CombatType}=C.core;
  return class extends CombatMethod { hits(){return [];} type(){return CombatType.MELEE;} attackSpeed(){return 1;} attackDistance(){return 1;} };
}
function attach(api) {
  api.registerNpcCombatMethodProvider(C.data.npcs.awake,noDefaultCombat());
  api.onNpcBeforeDeath(beforeDeath); api.onNpcDeath(death);
  api.onCombatHitRoll(playerAttack);
  api.onCustomEvent('npc-drops:context',context);
  api.onCustomEvent('npc-drops:location',lootLocation);
}
module.exports={Fight,attach,context,beforeDeath,death};
