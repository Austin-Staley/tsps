/** Postquest public access. The quest retains its own stage-gated routes. */
const Common=require('./Common.Whisperer');
const TELEPORTERS_ATTRIBUTE='whisperer:teleporters';
function complete(player) {
    const event={player,key:Common.data.quest,complete:false};
    Common.api.emitCustomEvent('quest:is-complete',event);
    return event.complete===true;
}
function coordinates(event) {
    const p=event.location??event.object?.getLocation();
    return p?[p.getX?.()??p.x,p.getY?.()??p.y,p.getZ?.()??p.z??0]:[];
}
function route(event) {
    const p=event.object?.getLocation();
    if(!p||event.clickType!==1||!Common.data.travel.ropeIds.includes(event.objectId))return;
    if(p.getX()===2922&&p.getY()===5827&&p.getZ()===0&&complete(event.player))event.destination={x:2922,y:5826,z:0};
}
function landing([x,y,z=0]) {
    const {Location,RegionManager}=Common.core;
    for(const [dx,dy] of [[0,0],[0,-1],[1,0],[-1,0],[0,1]]) {
        const tile=new Location(x+dx,y+dy,z);
        if(!RegionManager.blocked(tile,null))return tile;
    }
    return null;
}
function choose(player,source,destinations,offset=0) {
    const choices=destinations.slice(offset,offset+4).flatMap(target=>[target[0],()=>{
        if(require('./Site.Whisperer').sessionOf(player)||!complete(player)||player.getLocation().getDistance(new Common.core.Location(source[1],source[2],0))>3)return;
        player.getPacketSender().sendInterfaceRemoval();
        const at=landing([target[1],target[2],0]);
        if(at)player.moveTo(at);
    }]);
    if(offset+4<destinations.length)choices.push('More...',()=>choose(player,source,destinations,offset+4));
    if(choices.length)Common.api.sendMultiChatboxPrompt(player,'Choose an active Lassar teleporter',...choices);
}
function travel(event) {
    const {player}=event, id=event.objectId??event.definition?.id;
    const config=Common.data.travel;
    if(!config.ropeIds.includes(id)&&id!==config.returnRope&&!config.teleporters.some(t=>t[3]===id)&&![48201,48202,48203].includes(id))return false;
    if(require('./Site.Whisperer').sessionOf(player)||!complete(player))return false;
    const [x,y,z]=coordinates(event), action=String(event.option??'').toLowerCase();
    if(z!==0)return false;
    if(config.ropeIds.includes(id)&&x===2922&&y===5827&&['climb-rope','climb-down','climb'].includes(action)) {
        const at=landing(config.undercity);if(at)player.moveTo(at);event.handled=true;return true;
    }
    if(id===config.returnRope&&x>=2580&&x<=2595&&y>=6428&&y<=6444&&['climb-up','climb','exit','leave'].includes(action)) {
        player.moveTo(Common.location(Common.data.site.grave));event.handled=true;return true;
    }
    const index=config.teleporters.findIndex(t=>t[1]===x&&t[2]===y&&(t[3]===id||[48201,48202,48203].includes(id)));
    if(index<0||!['activate','travel','use'].includes(action))return false;
    const saved=player.getAttribute(TELEPORTERS_ATTRIBUTE)??[];
    const active=config.teleporters.map((t,i)=>saved.includes(i)||Number(player.getPacketSender().getVarbit(t[4]))>0);
    if(!active[index]) {
        player.setAttribute(TELEPORTERS_ATTRIBUTE,[...new Set([...saved,index])]);
        player.getPacketSender().sendVarbit(config.teleporters[index][4],1);
        player.sendMessage('You activate the Lassar teleporter.');
    } else if(action!=='activate')choose(player,config.teleporters[index],config.teleporters.filter((_,i)=>active[i]));
    event.handled=true;return true;
}
function restore({player}) {
    if(!complete(player))return;
    // DT2 synchronizes its own saved discoveries during login. Apply the
    // postquest discoveries after that hook, without changing quest state.
    Common.later(1,()=>{
        if(!player.isRegistered())return;
        for(const index of player.getAttribute(TELEPORTERS_ATTRIBUTE)??[]) {
            const t=Common.data.travel.teleporters[index];if(t)player.getPacketSender().sendVarbit(t[4],1);
        }
    });
}
function attach(api) {
    api.persistAttribute(TELEPORTERS_ATTRIBUTE,[]);
    api.onObjectRoute(route);
    api.onBeforeObjectInteraction(travel);
    api.onPlayerLogin(restore);
}
module.exports={attach,travel,route,restore,TELEPORTERS_ATTRIBUTE};
