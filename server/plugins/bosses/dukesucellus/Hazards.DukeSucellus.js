"use strict";
const C=require('./Common.DukeSucellus');
const M=require('./Model.DukeSucellus');

function gas(fight,tile,preparation=false) {
  const s=fight.session,t=C.data.timing,g=C.data.graphics;
  const spawnDelay=preparation?0:2;
  const spawn=()=>{
    const vent=s.spawnPassive(C.data.npcs.vent,[tile[0]-1,tile[1]-1],0);
    if(!vent)return;
    const warning=preparation?4:1,end=preparation?11:t.combatGasMinTicks+C.random(t.combatGasMaxTicks-t.combatGasMinTicks);
    s.passiveExpiry.set(vent,s.tick+end+4);
    vent.performGraphic(new C.core.Graphic(g.gasSpawn,warning*30));
    for(let tick=warning+2;tick<end;tick+=2)fight.at(tick,()=>vent.performGraphic(new C.core.Graphic(g.gasIdle)));
    for(let tick=warning+1;tick<end;tick++)fight.at(tick,()=>{
      if(M.near(C.source(s,s.player.getLocation()),tile)){
        C.hurt(fight,C.faceCovered(s.player)?4:12);C.drainPrayer(s.player,4);
      }
    });
    fight.at(end,()=>vent.performGraphic(new C.core.Graphic(g.gasEnd)));
  };
  if(spawnDelay)fight.at(spawnDelay,spawn);else spawn();
}

function eye(fight,ordinal) {
  const s=fight.session;
  for(const index of [ordinal,ordinal+3]){
    const spec=C.data.extremities[index],west=spec.face===3,variant=west?ordinal:[2,0,1][ordinal];
    const object=s.place(spec.id,spec.tile,spec.face);
    s.player.getPacketSender().sendObjectAnimation(object,new C.core.Animation(10187+variant));
    const cone=s.spawnPassive(C.data.npcs.cones[variant],[west?3028:3046,spec.tile[1]-1],(west?C.core.Direction.EAST:C.core.Direction.WEST).getId());
    if(cone)s.passiveExpiry.set(cone,s.tick+4);
    fight.at(5,()=>{
      if(M.extremityHit(spec,C.source(s,s.player.getLocation()))){
        C.hurt(fight,70);C.drainPrayer(s.player,Math.floor(s.player.getSkillManager().getCurrentLevel(C.core.Skill.PRAYER)/4));
        s.player.getTimers().registers(C.core.TimerKey.FREEZE,5);
      }
      s.player.getPacketSender().sendObjectAnimation(object,new C.core.Animation(C.data.animations.eyeSleep));
    });
  }
}

function ice(fight,tile) {
  const s=fight.session;
  C.graphic(s,C.data.graphics.iceWarning,tile);
  fight.at(C.data.timing.iceWarning,()=>{
    C.graphic(s,C.data.graphics.iceImpact,tile);
    if(M.near(C.source(s,s.player.getLocation()),tile,0)){
      C.hurt(fight,18);s.player.getTimers().registers(C.core.TimerKey.FREEZE,2);
    }
  });
}

function preparation(fight) {
  const s=fight.session,tick=s.tick;
  // Independent room clocks, observed repeatedly in normal captures 1751/1827.
  const eyePhase=(tick-2)%15;
  if(tick>=2&&[0,2,4].includes(eyePhase))eye(fight,eyePhase/2);
  if(tick>=15&&(tick-15)%25===0){
    const phase=Math.floor((tick-15)/25)%3;
    for(let row=0;row<3;row++)gas(fight,[3036+3*((2-row+phase)%3),6442+4*row],true);
  }
  if(tick>=4&&[0,4,5].includes(tick%6)){
    for(const x of [3030,3031,3032,3033,3045,3046,3047,3048])for(let y=6435;y<=6450;y++){
      if(y===6438)continue;
      // The corridor widens by one tile at its southern entrance (1703/1827).
      if((x===3033||x===3045)&&y>6436)continue;
      // Empirical density, not a claim to recover Jagex's unpublished RNG.
      if(C.random(19)===0)ice(fight,[x,y]);
    }
  }
}

function clear(fight) {
  for(const npc of [...fight.session.passive])if(npc.getId()!==C.data.npcs.vatTimer){
    if(npc.getId()===C.data.npcs.vent){
      npc.performGraphic(new C.core.Graphic(C.data.graphics.gasEnd));
      fight.session.passiveExpiry.set(npc,fight.session.tick+4);
    }else fight.session.removePassive(npc);
  }
}
module.exports={gas,eye,ice,preparation,clear};
