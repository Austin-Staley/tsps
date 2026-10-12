/** Optional Wiki reward: Kuradal's notes grant Slayer XP once and unlock demonbane crafting. */
module.exports=function registerRewards({api,stage,held,give,val,play,ATTRIBUTES}){
 const {Skill,Bank}=api.core;
 const NOTES=29596,KURADAL=13623,RECEIVED='while-guthix-sleeps:duradel-notes',READ='while-guthix-sleeps:duradel-notes-read';
 ATTRIBUTES.push(RECEIVED,READ);
 function possessed(p){return held(p,NOTES)||Array.from({length:Bank.TOTAL_BANK_TABS},(_,i)=>p.getBank(i)).some(bank=>bank.contains(NOTES));}
 function talk({player:p,npcId}){if(npcId!==KURADAL||stage(p)<900)return false;play(p,npcId,'post-quest-dialogue-talking-to-kuradal');return true;}
 function condition({player:p,stepId,pages}){
  if(!['omXWyi','yU0Tl1','lIknwQ','vhO3yX','5OgFOR','zVDDzY'].includes(stepId)||stage(p)<900||!pages?.some(v=>v.page.replace(/^Transcript:/,'')==='While Guthix Sleeps'))return;
  const received=val(p,RECEIVED)||possessed(p)||val(p,READ),lost=received&&!val(p,READ)&&!possessed(p),space=p.getInventory().getFreeSlots()>0;
  return {omXWyi:!received,yU0Tl1:!!received&&!lost,lIknwQ:!!lost,vhO3yX:!space,'5OgFOR':space,zVDDzY:!space}[stepId];
 }
 function action(e){if(e.npcId===KURADAL&&e.stepId==='PGNPip'&&stage(e.player)>=900&&!val(e.player,READ)&&!possessed(e.player)&&give(e.player,NOTES)){e.player.setAttribute(RECEIVED,1);e.box={items:[NOTES]};}}
 function read(e){
  const p=e.player;if(e.itemId!==NOTES||String(e.option).toLowerCase()!=='read'||stage(p)<900)return;e.handled=true;
  if(!held(p,NOTES))return;p.getInventory().deleteNumber(NOTES,1);
  if(val(p,READ))return;p.setAttribute(READ,1);p.setAttribute(RECEIVED,1);
  p.getSkillManager().addExperience(Skill.SLAYER,15*p.getSkillManager().getCurrentLevel(Skill.SLAYER));
  p.sendMessage('Duradel’s notes reveal how to create emberlight, the scorching bow and the purging staff from tormented synapses.');
 }
 api.onNpcInteraction('Kuradal',{'Talk-to':talk});api.onNpcDialogueCondition(condition);
 api.onCustomEvent('npc-dialogue:action',action);api.onItemAction(read);
 return {condition,action,read};
};
