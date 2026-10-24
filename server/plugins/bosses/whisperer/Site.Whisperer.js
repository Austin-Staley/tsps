const Common = require('./Common.Whisperer');
const { Fight } = require('./Fight.Whisperer');
const sessions = new Map();
let AreaClass;
function areaClass() {
    if (AreaClass)
        return AreaClass;
    const { PrivateArea, Boundary } = Common.core;
    AreaClass = class WhispererCathedral extends PrivateArea {
        constructor(session) { super([new Boundary(2640, 2676, 6352, 6385, 0), new Boundary(2384, 2420, 6352, 6385, 0)]); this.session = session; }
        getName() { return 'Sunken Cathedral'; }
        isMulti() { return true; }
        allowSummonPet() { return false; }
        canAttack(attacker, target) {
            const { player, fight } = this.session;
            if (attacker === player)
                return target === fight?.boss || (target?.__whispererFight === fight && target.__whispererSoul != null && fight.shadow);
            return target === player && attacker === fight?.boss;
        }
        process(mobile) {
            if (mobile === this.session.player)
                this.session.fight?.process();
        }
        postLeave(mobile, logout) {
            if (mobile === this.session.player) {
                if (logout)
                    mobile.setLocation(Common.location(Common.data.site.outside));
                this.session.end();
            }
            super.postLeave(mobile, logout);
        }
    };
    return AreaClass;
}
class Session {
    constructor(player) { this.player = player; this.ended = false; this.area = new (areaClass())(this); this.fight = null; this.figure = null; }
    spawn(id, x, y) {
        const npc = Common.api.spawnNpc({ id, x, y, z: 0, owner: this.player, ownerOnly: true, wanderRadius: 0 });
        if (!npc)
            return null;
        npc.__skipDefaultRespawn = true;
        npc.setScriptedMovement(true);
        this.area.add(npc);
        return npc;
    }
    start() {
        if (this.ended || this.fight?.alive())
            return;
        Common.remove(this.figure);
        this.figure = null;
        const [x, y] = Common.data.site.boss;
        const npc = this.spawn(Common.data.npcs.boss, x, y);
        if (!npc)
            return;
        npc.setMaxHitpoints(900);
        npc.setHitpoints(900);
        npc.setFlag('combat:freezable', true);
        this.fight = new Fight(this, npc);
        const known={player:this.player,monster:Common.MONSTER,total:0};
        Common.api.emitCustomEvent('combat-achievements:count',known);
        if(Number(known.total)>(Number(this.player.getAttribute(Common.KILLS_ATTRIBUTE))||0))this.player.setAttribute(Common.KILLS_ATTRIBUTE,known.total);
        npc.__whispererFight = this.fight;
        npc.performAnimation(new Common.core.Animation(Common.data.animations.spawn));
        this.player.getPacketSender().sendSubInterface(Common.data.sanity.helper, Common.data.sanity.interface, 1);
        Common.sync(this.fight);
        Common.api.emitCustomEvent('boss-hud:show', { player: this.player, npcId: Common.data.npcs.boss, current: 900, maximum: 900 });
    }
    end() {
        if (this.ended)
            return;
        this.ended = true;
        sessions.delete(this.player);
        this.fight?.stop();
        this.player.setAttribute(Common.INSIDE_ATTRIBUTE, false);
        this.player.getPacketSender().sendVarbit(Common.data.sanity.realmVarbit, 0);
        this.player.getPacketSender().closeSubInterface(Common.data.sanity.helper);
        Common.api.emitCustomEvent('boss-hud:hide', { player: this.player, fade: false, afterTicks: 0 });
        if (!this.area.isDestroyed())
            this.area.destroy();
    }
}
const sessionOf = player => sessions.get(player);
function complete(player) { const request = { player, key: Common.data.quest, complete: false }; Common.api.emitCustomEvent('quest:is-complete', request); return request.complete === true; }
function fragments() { const I = Common.core.ItemIdentifiers; return [I.BLACKSTONE_FRAGMENT, I.BLACKSTONE_FRAGMENT_2]; }
function hasFragment(player) { return fragments().some(id => player.getInventory().contains(id)); }
function disturb({ player, npc }) {
    if (npc?.getId() !== Common.data.npcs.figure)
        return false;
    if (!complete(player))
        return false;
    if (!hasFragment(player)) {
        player.sendMessage('You need a blackstone fragment to fight the Whisperer. Speak to Ketla for a replacement.');
        return true;
    }
    const existing = sessionOf(player);
    if (existing) {
        if (existing.figure === npc)
            existing.start();
        return true;
    }
    const p = npc.getLocation();
    if (p.getX() < 2640 || p.getX() > 2676 || p.getY() < 6352 || p.getY() > 6386)
        return false;
    const session = new Session(player);
    sessions.set(player, session);
    session.area.enter(player);
    player.moveTo(Common.location(Common.data.site.arrival));
    player.setAttribute(Common.INSIDE_ATTRIBUTE, true);
    session.start();
    return true;
}
function leave({ player }) {
    const session = sessionOf(player);
    if (!session)
        return false;
    player.getMovementQueue().reset();
    player.moveTo(Common.location(Common.data.site.outside));
    session.area.leave(player,false);
    return true;
}
function fragmentAction(event) {
    const session = sessionOf(event.player);
    if (!session || !fragments().includes(event.itemId) || !['activate', 'use'].includes(String(event.option).toLowerCase()))
        return false;
    const fight = session.fight;
    if (!fight?.alive())
        return true;
    event.handled = true;
    if (fight.enraged) {
        event.player.sendMessage('You cannot leave the Shadow Realm during the Whisperer\'s final stand.');
        return true;
    }
    if (!fight.special && !fight.shadow) {
        event.player.sendMessage('The fragment is not responding.');
        return true;
    }
    fight.setShadow(!fight.shadow);
    return true;
}
function reclaim({ player }) {
    if (!complete(player))
        return false;
    if (hasFragment(player))
        return false;
    if (player.getInventory().getFreeSlots() <= 0) {
        player.sendMessage('You need an inventory space for the blackstone fragment.');
        return true;
    }
    player.getInventory().adds(Common.core.ItemIdentifiers.BLACKSTONE_FRAGMENT, 1);
    player.sendMessage('Ketla gives you another blackstone fragment.');
    return true;
}
function respawn(session) {
    if (session.ended)
        return;
    session.fight?.stop();
    const [x, y] = Common.data.site.boss;
    session.figure = session.spawn(Common.data.npcs.figure, x, y);
    Common.api.emitCustomEvent('boss-hud:hide', { player: session.player, fade: false, afterTicks: 0 });
}
function recover({ player }) {
    if (player.getAttribute(Common.INSIDE_ATTRIBUTE) && !sessionOf(player)) {
        player.setAttribute(Common.INSIDE_ATTRIBUTE, false);
        player.moveTo(Common.location(Common.data.site.outside));
        player.getPacketSender().sendVarbit(Common.data.sanity.realmVarbit, 0);
        player.getPacketSender().closeSubInterface(Common.data.sanity.helper);
    }
}
function grave(request) {
    if (!sessionOf(request.player))
        return;
    const [x, y, z] = Common.data.site.grave;
    request.tile = { x, y, z };
    if ((Number(request.player.getAttribute(Common.KILLS_ATTRIBUTE)) || 0) < 5)
        request.feeMultiplier = .25;
}
function suppressSpawn(event) {
    const p = event.location;
    if (event.npcId === Common.data.npcs.boss && p?.getX() >= 2640 && p.getX() <= 2676 && p.getY() >= 6352 && p.getY() <= 6386)
        event.allow = false;
}
function startup() { const [x, y, z] = Common.data.site.boss; Common.api.spawnNpc({ id: Common.data.npcs.figure, x, y, z, wanderRadius: 0 }); }
function counts({ player, counts }) { counts[Common.MONSTER] = Number(player.getAttribute(Common.KILLS_ATTRIBUTE)) || 0; }
function best(request) {
    if (request.monster === Common.MONSTER)
        request.best = Number(request.player.getAttribute(Common.BEST_ATTRIBUTE)) || 0;
}
function attach(api) {
    api.persistAttribute(Common.INSIDE_ATTRIBUTE, false);
    api.persistAttribute(Common.KILLS_ATTRIBUTE, 0);
    api.persistAttribute(Common.BEST_ATTRIBUTE, 0);
    api.onCanSpawnNpc(suppressSpawn);
    api.onServerStartup(startup);
    api.onNpcInteraction('Odd Figure', { Disturb: disturb });
    api.onNpcInteraction('Ketla', { 'Talk-to': reclaim });
    api.onObjectInteraction('Tentacle', { Escape: leave, 'Quick-escape': leave, Leave: leave });
    api.onItemAction(fragmentAction);
    api.onPlayerLogin(recover);
    api.onCustomEvent('gravestones:grave-location', grave);
    api.onCustomEvent('combat-achievements:kill-count', counts);
    api.onCustomEvent('combat-achievements:personal-best', best);
}
module.exports = { attach, Session, sessionOf, disturb, leave, fragmentAction, fragments, respawn, grave, suppressSpawn };
