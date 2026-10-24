"use strict";
const data = require('../data/duke-sucellus.json');
const sessions = new Map();
const INSIDE = 'duke-sucellus:inside';
const KILLS = 'duke-sucellus:kills';
const BEST = 'duke-sucellus:best-ticks';
const DEMONBANE = 'combat:demonbane-vulnerability';
let api;
function init(value) { api = value; }
const sessionOf = player => { const s=sessions.get(player); return s && !s.ended ? s : null; };
const random = max => Math.floor(Math.random() * (Math.max(0,max)+1));
const count = (player,key) => Math.max(0,Math.trunc(Number(player.getAttribute(key)) || 0));
function kills(player) {
  const request={player,monster:'Duke Sucellus',total:0}; api.emitCustomEvent('combat-achievements:count',request);
  return Math.max(count(player,KILLS),Math.max(0,Math.trunc(Number(request.total)||0)));
}
function source(session, location) {
  return [(location.getX?.() ?? location.x)-session.area.getBaseX()+data.instance.sourceChunkX*8,
    (location.getY?.() ?? location.y)-session.area.getBaseY()+data.instance.sourceChunkY*8];
}
function protectedFrom(player, prayer) { const p=api.core.PrayerHandler; return p.isActivated(player,p[prayer]); }
function graphic(session, id, tile) {
  const location = tile?.getX ? tile : session.tile(tile);
  session.player.getPacketSender().sendGraphic(new api.core.Graphic(id),location);
}
function give(player,id,amount=1) {
  const item=new api.core.Item(id,amount), inventory=player.getInventory();
  if(inventory.getAddableAmount(item) < amount) { player.sendMessage("You don't have enough inventory space."); return false; }
  inventory.add(item,true);
  return true;
}
function track(fight, part, avoidable, evenZero=false) {
  fight.pending.add(part);
  part.onApplied(amount => {
    fight.pending.delete(part);
    if(fight.over || fight.stopped || fight.session.ended || fight.session.fight!==fight) return;
    if(avoidable && (amount>0 || evenZero)) fight.perfect=false;
  });
}
function hurt(fight,max,{min=0,avoidable=true,evenZero=false}={}) {
  if(fight.over || fight.stopped || fight.session.ended || fight.player.getHitpoints()<=0) return;
  const hit=new api.core.HitDamage(min+random(max-min),api.core.HitMask.RED);
  hit.setSource(fight.boss);
  track(fight,hit,avoidable,evenZero);
  fight.player.getCombat().getHitQueue().addPendingDamage([hit]);
  return hit;
}
const methods = new Map();
function strike(fight,style,max,{accurate=true,avoidable=true,evenZero=false}={}) {
  const { CombatMethod,CombatType,PendingHit,CombatFactory,World }=api.core;
  if(!methods.has(style)) methods.set(style,new(class extends CombatMethod { type(){return style==='magic'?CombatType.MAGIC:CombatType.MELEE;} hits(){return [];} })());
  const hit=new PendingHit(fight.boss,fight.player,methods.get(style),{delay:0,damage:0,rollAccuracy:!accurate,experience:false,handleAfterHitEffects:false});
  CombatFactory.applyStyleDamage(hit,max,{bypassProtectionPrayer:true});
  for(const part of hit.getHits()) track(fight,part,avoidable,evenZero);
  fight.player.getCombat().getHitQueue().addPendingHit(hit,World.getProcessCycle());
  return hit;
}
function cancelPending(fight) { for(const part of fight.pending) part.setDamage(0); fight.pending.clear(); }
function drainPrayer(player,amount) {
  const skills=player.getSkillManager(), prayer=api.core.Skill.PRAYER;
  skills.setCurrentLevels(prayer,Math.max(0,skills.getCurrentLevel(prayer)-amount));
}
function faceCovered(player) {
  const head=player.getEquipment().get(api.core.Equipment.HEAD_SLOT);
  const name=head?.getDefinition?.()?.getName?.()?.toLowerCase() || '';
  return name==='gas mask' || name.includes('slayer helmet');
}
const ephemeral = () => [data.items.arder,data.items.musca,data.items.arderPowder,data.items.muscaPowder,data.items.salt,data.items.poison];
function clearSupplies(player) { for(const id of ephemeral()) player.getInventory().deleteNumber(id,player.getInventory().getAmount(id)); }
module.exports={ init,data,sessions,sessionOf,random,count,kills,source,protectedFrom,graphic,give,hurt,strike,cancelPending,drainPrayer,faceCovered,clearSupplies,INSIDE,KILLS,BEST,DEMONBANE,
  get api(){return api;}, get core(){return api.core;} };
