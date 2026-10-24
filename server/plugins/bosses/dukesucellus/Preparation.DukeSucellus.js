"use strict";
const C=require('./Common.DukeSucellus');
const M=require('./Model.DukeSucellus');
const vatKey = tile => `${tile[0]},${tile[1]}`;
function refresh(session) {
  const {objects:o,resources:r}=C.data;
  session.place(o.arder,r.arder); session.place(o.musca,r.musca);
  for(const tile of r.salts) session.place(o.salt,tile);
  for(const tile of r.vats) session.place(session.vats.get(vatKey(tile))?.ready?o.readyVat:o.vat,tile);
  session.place(o.pestle,r.pestle,1); session.place(o.pickaxe,r.pickaxe,1);
}
function near(session,at,range=1) { return M.near(C.source(session,session.player.getLocation()),at,range); }
function pick(session,type) {
  const {resources:r,items,objects}=C.data;
  if(!near(session,r[type])) return false;
  if(session.picks[type]>=r.picks) { session.player.sendMessage('These mushrooms have been picked clean.'); return true; }
  if(C.give(session.player,items[type])) {
    session.picks[type]++;
    if(session.picks[type]===r.picks) session.place(objects[`${type}Depleted`],r[type]);
  }
  return true;
}
function mine(session,at) {
  if(!C.data.resources.salts.some(tile=>M.near(tile,at,0)) || !near(session,at)) return false;
  const request={player:session.player,pickaxe:null};
  C.api.emitCustomEvent('mining:best-pickaxe',request);
  if(!request.pickaxe) { session.player.sendMessage('You need a pickaxe you can use to mine the salt.'); return true; }
  const action={kind:'salt',at,start:C.source(session,session.player.getLocation()),next:session.tick+1,
    interval:Math.max(2,request.pickaxe.attemptIntervalTicks || 4),until:session.tick+500,pickaxe:request.pickaxe};
  session.action=action;
  session.player.getCombat().reset();
  return true;
}
function grind(event) {
  const session=C.sessionOf(event.player);
  if(!session) return false;
  const ids=new Set([event.usedItemId,event.usedWithItemId]), {items}=C.data;
  if(!ids.has(items.pestle)) return false;
  const raw=ids.has(items.arder)?items.arder:ids.has(items.musca)?items.musca:null;
  if(raw==null) return false;
  event.handled=true;
  C.core.TaskManager.cancelTasks(event.player.getIndex());
  if(!grindOne(session,raw)) return true;
  // The click acts immediately; the next response is two ticks after its response
  // cycle, followed by three-tick repeats (current powder creation pages).
  let wait=3;
  C.core.TaskManager.submit(new(class extends C.core.Task {
    constructor(){super(1,event.player.getIndex(),false);}
    execute(){
      if(session.ended || !event.player.isRegistered() || event.player.getHitpoints()<=0) {this.stop();return;}
      if(--wait>0) return;
      wait=3;
      if(!grindOne(session,raw)) this.stop();
    }
  })());
  return true;
}
function grindOne(session,raw) {
  const player=session.player,inventory=player.getInventory(),{items}=C.data;
  if(inventory.getAmount(raw)<1 || inventory.getAmount(items.pestle)<1) return false;
  const result=raw===items.arder?items.arderPowder:items.muscaPowder;
  const amount=M.powderYield(player.getSkillManager().getCurrentLevel(C.core.Skill.HERBLORE));
  const before=inventory.getCopiedItems();
  inventory.deleteNumber(raw,1);
  if(inventory.getAddableAmount(new C.core.Item(result,amount))<amount) {
    inventory.setItems(before); inventory.refreshItems();
    player.sendMessage("You don't have enough inventory space."); return false;
  }
  inventory.add(new C.core.Item(result,amount),true);
  const sequence=C.core.CacheDefinitions.getSeqId('human_herbing_grind');
  player.performAnimation(new C.core.Animation(sequence));
  return true;
}
function fill(session,at) {
  if(!near(session,at)) return false;
  const key=vatKey(at), {resources:r,items}=C.data, p=session.player;
  if(session.vats.has(key)) { p.sendMessage('This vat is already in use.'); return true; }
  const ingredients=[items.arderPowder,items.muscaPowder,items.salt];
  if(ingredients.some(id=>p.getInventory().getAmount(id)<r.ingredients)) {
    p.sendMessage('You need six arder powder, six musca powder and six salax salt.'); return true;
  }
  for(const id of ingredients) p.getInventory().deleteNumber(id,r.ingredients);
  session.vats.set(key,{readyAt:session.tick+r.fermentTicks,ready:false,tile:at});
  p.sendMessage('The mixture begins to ferment.');
  return true;
}
function collect(session,at) {
  if(!near(session,at)) return false;
  const key=vatKey(at), vat=session.vats.get(key);
  if(!vat?.ready) { session.player.sendMessage('The poison is not ready yet.'); return true; }
  if(C.give(session.player,C.data.items.poison)) {
    session.vats.delete(key); session.place(C.data.objects.vat,at);
    session.player.getSkillManager().addExperiences(C.core.Skill.HERBLORE,10);
  }
  return true;
}
function object(event) {
  const session=C.sessionOf(event.player);
  if(!session || event.player.getPrivateArea?.()!==session.area) return false;
  const id=event.objectId ?? event.definition?.id, {objects:o,resources:r,items}=C.data;
  const at=C.source(session,event.location ?? event.object?.getLocation());
  if(id===o.arder) return pick(session,'arder');
  if(id===o.musca) return pick(session,'musca');
  if(id===o.salt) return mine(session,at);
  const vat=r.vats.find(tile=>M.near(tile,at,0));
  if(vat && (id===o.vat || id===o.readyVat)) {
    const option=String(event.definition?.getActions?.()?.[event.clickType-1] ?? event.option ?? '').toLowerCase();
    if(option==='empty') { session.vats.delete(vatKey(vat)); session.place(o.vat,vat); return true; }
    if(option==='check') { event.player.sendMessage(session.vats.get(vatKey(vat))?.ready?'The poison is ready.':'The vat is fermenting or empty.'); return true; }
    return id===o.readyVat?collect(session,vat):fill(session,vat);
  }
  if((id===o.pestle || id===o.pickaxe) && near(session,at) && !session.tools.has(id)) {
    if(C.give(event.player,id===o.pestle?items.pestle:items.ironPickaxe)) { session.tools.add(id); session.place(id===o.pestle?47567:47568,at,1); }
    return true;
  }
  return false;
}
function process(session) {
  for(const vat of session.vats.values()) if(!vat.ready && session.tick>=vat.readyAt) {
    vat.ready=true; session.place(C.data.objects.readyVat,vat.tile);
  }
  const a=session.action;
  if(!a) return;
  const p=session.player, here=C.source(session,p.getLocation());
  if(session.tick>=a.until || !M.near(here,a.start,0) || !near(session,a.at)) { session.action=null; return; }
  if(session.tick<a.next) return;
  a.next=session.tick+a.interval;
  const amount=M.saltYield(p.getSkillManager().getCurrentLevel(C.core.Skill.MINING));
  if(!C.give(p,C.data.items.salt,amount)) { session.action=null; return; }
  p.performAnimation(a.pickaxe.animation);
  p.getSkillManager().addExperiences(C.core.Skill.MINING,5);
}
function feed(event) {
  const session=C.sessionOf(event.player);
  if(!session || (event.npc ?? event.target)!==session.boss || !M.melee(C.source(session,event.player.getLocation()))) return false;
  if(event.itemId!=null && ![C.data.items.poison,C.data.items.arderPowder,C.data.items.muscaPowder].includes(event.itemId)) return false;
  event.handled=true;
  if(session.fight.active || session.fight.over) return true;
  const inventory=event.player.getInventory(),{items}=C.data;
  const powder=inventory.getItems().find(held=>held && held.getAmount()>0 && [items.arderPowder,items.muscaPowder].includes(held.getId()))?.getId();
  const item=event.itemId ?? (inventory.getAmount(items.poison)>0?items.poison:powder);
  if(!item || inventory.getAmount(item)<1) { event.player.sendMessage('You need arder-musca poison to wake the Duke.'); return true; }
  const cycle=C.core.World.getProcessCycle();
  if(item!==items.poison && session.lastPowderCycle===cycle) return true;
  const result=M.feed(session.meter,item===C.data.items.poison?C.data.normal.poison:5,C.data.normal.meter);
  if(!result.consumed) return true;
  inventory.deleteNumber(item,1); session.meter=result.meter;
  if(item!==items.poison) session.lastPowderCycle=cycle;
  event.player.sendMessage(`Duke Sucellus' poison meter: ${session.meter}/${C.data.normal.meter}.`);
  if(result.awake) {
    session.picks={arder:0,musca:0}; refresh(session);
    session.fight.wake();
  }
  return true;
}
function attach(api) {
  api.onItemOnItem('Pestle and mortar','Arder mushroom',grind,{noted:false});
  api.onItemOnItem('Pestle and mortar','Musca mushroom',grind,{noted:false});
  api.onItemOnNpc(feed);
  api.onNpcInteraction('Duke Sucellus',{Feed:feed});
}
module.exports={refresh,pick,mine,grind,fill,collect,object,process,feed,attach};
