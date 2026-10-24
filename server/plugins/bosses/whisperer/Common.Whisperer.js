const data = require('../data/whisperer.json');
const INSIDE_ATTRIBUTE = 'whisperer:inside';
const KILLS_ATTRIBUTE = 'whisperer:kills';
const BEST_ATTRIBUTE = 'whisperer:best-ticks';
const MONSTER = 'Whisperer, The';
let api;
function init(value) { api = value; }
function later(ticks, action) {
    const { Task, TaskManager } = api.core;
    TaskManager.submit(new (class extends Task {
        constructor() { super(Math.max(1, ticks), null, false); }
        execute() { this.stop(); action(); }
    })());
}
const location = ([x, y, z = 0]) => new api.core.Location(x, y, z);
const random = (low, high) => low + Math.floor(Math.random() * (high - low + 1));
function protectedFrom(player, style) {
    const { PrayerHandler } = api.core;
    return PrayerHandler.isActivated(player, PrayerHandler[style === 'magic' ? 'PROTECT_FROM_MAGIC' : style === 'ranged' ? 'PROTECT_FROM_MISSILES' : 'PROTECT_FROM_MELEE']);
}
function damage(fight, amount, sanity = 0, avoidable = true) {
    if (!fight.alive())
        return;
    const { HitDamage, HitMask } = api.core;
    const hit = new HitDamage(amount, amount > 0 ? HitMask.RED : HitMask.BLUE);
    hit.setSource(fight.boss);
    fight.pendingDamage ??= new Set();
    fight.pendingDamage.add(hit);
    hit.onApplied(taken => {
        fight.pendingDamage.delete(hit);
        if (!fight.alive() || taken <= 0)
            return;
        if (avoidable)
            fight.perfectKill = false;
        if (sanity)
            fight.changeSanity(-sanity);
    });
    fight.player.getCombat().getHitQueue().addPendingDamage([hit]);
}
function cancelDamage(fight) {
    for (const hit of fight.pendingDamage ?? [])
        hit.setDamage(0);
    fight.pendingDamage?.clear();
}
function remove(npc) {
    if (npc)
        api.removeNpc(npc);
}
function sync(fight) {
    const { player } = fight;
    const sender = player.getPacketSender();
    sender.sendVarbit(data.sanity.varbit, fight.sanity);
    sender.sendVarbit(data.sanity.realmVarbit, fight.shadow ? 1 : 0);
    sender.sendVarbit(15067, fight.special?.switchAllowed ? 1 : 0);
}
function fragment(fight, glowing) {
    const { ItemIdentifiers: I } = api.core;
    let changed = false;
    for (const item of fight.player.getInventory().getItems())
        if (item.getId() === I.BLACKSTONE_FRAGMENT || item.getId() === I.BLACKSTONE_FRAGMENT_2) {
            const next = glowing ? I.BLACKSTONE_FRAGMENT : I.BLACKSTONE_FRAGMENT_2;
            if (item.getId() !== next) {
                item.setId(next);
                changed = true;
            }
        }
    if (changed)
        fight.player.getInventory().refreshItems();
    sync(fight);
}
module.exports = { data, init, get api() { return api; }, get core() { return api.core; }, later, location, random, protectedFrom, damage, cancelDamage, remove, sync, fragment, INSIDE_ATTRIBUTE, KILLS_ATTRIBUTE, BEST_ATTRIBUTE, MONSTER };
