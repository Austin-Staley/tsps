"use strict";
const C=require('./Common.DukeSucellus');
const M=require('./Model.DukeSucellus');
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
    this.boss.setNpcTransformationId(C.data.npcs.awake);
    this.boss.setCombatOverride({stats:C.data.normal.stats});
    this.boss.setMaxHitpoints(C.data.normal.hitpoints); this.boss.setHitpoints(C.data.normal.hitpoints);
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
    if(action==='gaze') this.gaze(); else if(action==='gas') this.gas(); else this.auto();
    this.nextAttack=this.session.tick+(action==='gaze'?C.data.timing.gaze:M.attackTicks(this.boss.getHitpoints()));
  }
  auto() {
    this.lastAttackCycle=C.core.World.getProcessCycle();
    const {normal:n,timing:t,graphics:g,animations:a}=C.data;
    const target=C.source(this.session,this.player.getLocation());
    this.boss.setPositionToFace(this.player.getLocation());
    if(M.melee(target)) {
      this.boss.performAnimation(new C.core.Animation(a.melee));
      this.at(t.chip,()=>{
        if(!M.near(C.source(this.session,this.player.getLocation()),target)) return;
        C.graphic(this.session,g.chip,target);
        C.strike(this,'melee',C.protectedFrom(this.player,'PROTECT_FROM_MELEE')?n.protectedChip:n.chip,{accurate:false,avoidable:false});
      });
      this.at(t.slam,()=>{
        C.graphic(this.session,g.slam,target);
        // The damaging slam is the aimed tile, not the chip's surrounding 3x3.
        if(M.near(C.source(this.session,this.player.getLocation()),target,0) && !M.hidden(target))
          C.strike(this,'melee',C.protectedFrom(this.player,'PROTECT_FROM_MELEE')?n.protectedSlam:n.slam);
      });
    } else {
      this.boss.performAnimation(new C.core.Animation(a.magic));
      const at=this.player.getLocation().clone();
      this.player.getPacketSender().sendProjectile(this.boss.getLocation(),at,0,40,g.magicProjectile,36,20,this.player,0,32,64,this.boss);
      this.at(t.magic,()=>{
        this.player.performGraphic(new C.core.Graphic(g.magicImpact));
        C.strike(this,'magic',C.protectedFrom(this.player,'PROTECT_FROM_MAGIC')?n.protectedMagic:n.magic,{evenZero:true});
      });
    }
  }
  gaze() {
    this.lastAttackCycle=C.core.World.getProcessCycle();
    this.boss.performAnimation(new C.core.Animation(C.data.animations.gaze));
    this.player.sendMessage('Duke Sucellus turns his gaze upon you...');
    this.at(C.data.timing.gazeWarning,()=>{
      if(M.hidden(C.source(this.session,this.player.getLocation()))) this.player.sendMessage("You manage to avoid Duke Sucellus' gaze.");
      else C.hurt(this,C.data.normal.gaze);
    });
  }
  ignite(tile,delay=C.data.timing.gasWarning) {
    C.graphic(this.session,C.data.graphics.gasSpawn,tile);
    for(let tick=0;tick<C.data.timing.gasDuration;tick++) this.at(delay+tick,()=>{
      C.graphic(this.session,C.data.graphics.gasIdle,tile);
      if(M.near(C.source(this.session,this.player.getLocation()),tile)) {
        C.hurt(this,C.faceCovered(this.player)?4:12);
        C.drainPrayer(this.player,4);
      }
    });
    this.at(delay+C.data.timing.gasDuration,()=>C.graphic(this.session,C.data.graphics.gasEnd,tile));
  }
  gas() {
    const amount=M.gasCount(this.boss.getHitpoints());
    for(let i=0;i<amount;i++) this.at(i*2,()=>{
      this.lastAttackCycle=C.core.World.getProcessCycle();
      const here=C.source(this.session,this.player.getLocation());
      const vents=[...C.data.vents].sort((a,b)=>Math.hypot(a[0]-here[0],a[1]-here[1])-Math.hypot(b[0]-here[0],b[1]-here[1]));
      this.ignite(vents[0]);
    });
  }
  preparationHazards() {
    const {timing:t}=C.data, tick=this.session.tick;
    if(tick===0 || tick%t.prepCycle!==0) return;
    const column=(Math.floor(tick/t.prepCycle)-1)%3;
    for(const vent of C.data.vents.filter(v=>v[0]===3036+3*column)) this.ignite(vent);
    const ordinal=(Math.floor(tick/t.prepCycle)-1)%3;
    for(const eye of [C.data.extremities[ordinal],C.data.extremities[ordinal+3]]) {
      const object=this.session.place(eye.id+3,eye.tile,eye.face);
      this.at(t.eyeWarning,()=>{
        const [x,y]=C.source(this.session,this.player.getLocation());
        const inFront=eye.face===3?x>=3030&&x<=3032:x>=3046&&x<=3048;
        if(inFront && Math.abs(y-(eye.tile[1]+1))<=1) {
          C.hurt(this,70); C.drainPrayer(this.player,Math.floor(this.player.getSkillManager().getCurrentLevel(C.core.Skill.PRAYER)/4));
          this.player.getTimers().registers(C.core.TimerKey.FREEZE,5);
        }
        this.session.place(eye.id,eye.tile,eye.face);
      });
    }
    const here=C.source(this.session,this.player.getLocation());
    if((here[0]===3031||here[0]===3032||here[0]===3046||here[0]===3047) && here[1]>=6439 && here[1]<=6452) {
      const aim=[...here];
      // Duke's own icicle effect gives the marked tile a visible preparation warning.
      C.graphic(this.session,C.data.graphics.chip,aim);
      this.at(t.iceWarning,()=>{ if(M.near(C.source(this.session,this.player.getLocation()),aim,0)) {
        C.hurt(this,18); this.player.getTimers().registers(C.core.TimerKey.FREEZE,2);
      }});
    }
  }
  fell() {
    if(this.over || this.stopped || !this.active) return;
    this.over=true; this.events=[]; C.cancelPending(this);
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
    this.player.sendMessage(`Fight duration: ${(ticks*.6).toFixed(1)} seconds.`);
    if(this.perfect) this.session.perfectKills++;
    if(this.coldFeetEligible) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:'Cold Feet'});
    if(this.mirror) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:'Mirror Image'});
    if(this.session.perfectKills>=5) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:'Perfect Duke Sucellus'});
    const task={player:this.player,npc:this.boss,onTask:false}; C.api.emitCustomEvent('slayer:on-task',task);
    if(!task.onTask) for(const [rank,seconds] of [['Trialist',60],['Chaser',50],['Runner',40]]) {
      if(ticks*.6<seconds) C.api.emitCustomEvent('combat-achievements:complete',{player:this.player,task:`Duke Sucellus Speed-${rank}`});
    }
    this.boss.setNpcTransformationId(C.data.npcs.dead);
    C.api.emitCustomEvent('boss-hud:hide',{player:this.player,fade:false,afterTicks:0});
  }
  stop() { this.stopped=true; this.events=[]; C.cancelPending(this); }
}
const fightOf=npc=>npc?.__dukeSucellusFight;
function beforeDeath({npc}) { fightOf(npc)?.fell(); }
function death({npc,killer}) { fightOf(npc)?.won(killer); }
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
