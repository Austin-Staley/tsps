const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const { PluginManager } = require('../dist/plugins/PluginManager');
const { Player } = require('../dist/game/entity/impl/player/Player');
const Common = require('../plugins/bosses/whisperer/Common.Whisperer');
const { Fight, beforeDeath, modifyHit, dropContext, bindingCounter } = require('../plugins/bosses/whisperer/Fight.Whisperer');
const Specials = require('../plugins/bosses/whisperer/Specials.Whisperer');
const Site = require('../plugins/bosses/whisperer/Site.Whisperer');
let core;
before(async () => {
    await CachePipeline.initialize(require('node:path').resolve(__dirname, '..'));
    core = PluginManager.getCoreApi();
    core.RegionManager.init();
    Common.init({ core, emitCustomEvent() { }, removeNpc() { } });
});
function fixture() {
    const player = new Player(null);
    player.setUsername('whisperer-test');
    player.isRegistered = () => true;
    const sender = new Proxy({}, { get: () => () => sender });
    player.getPacketSender = () => sender;
    player.sendMessage = () => { };
    player.getLocation().setX(2656);
    player.getLocation().setY(6380);
    player.getSkillManager().setCurrentLevel(core.Skill.HITPOINTS, 99);
    player.getSkillManager().setMaxLevels(core.Skill.HITPOINTS, 99, false);
    player.getSkillManager().setCurrentLevel(core.Skill.PRAYER, 99);
    const area = new (class extends core.PrivateArea {
    })();
    const session = {
        player, area, ended: false,
        spawn(id, x, y) {
            const npc = core.NPC.create(id, new core.Location(x, y, 0));
            npc.isRegistered = () => true;
            npc.performAnimation = () => { };
            npc.forceChat = () => { };
            npc.setOwner(player);
            area.add(npc);
            return npc;
        },
    };
    area.add(player);
    const boss = session.spawn(Common.data.npcs.boss, 2655, 6369);
    boss.setMaxHitpoints(900);
    boss.setHitpoints(900);
    const fight = session.fight = new Fight(session, boss);
    boss.__whispererFight = fight;
    let cycle = 100;
    const apply = () => player.getCombat().getHitQueue().process(++cycle);
    return { player, session, boss, fight, apply };
}
test('cache identities distinguish spawn, boss, soul, effect and animation', () => {
    assert.equal(core.CacheDefinitions.getNpc(Common.data.npcs.boss).name, 'The Whisperer');
    assert.equal(core.CacheDefinitions.getNpc(Common.data.npcs.figure).name, 'Odd Figure');
    assert.equal(core.CacheDefinitions.getSeqName(Common.data.animations.tentacleSpawn), 'npc_whisperer_tentacle_01_spawn_01');
    assert.equal(core.CacheDefinitions.getInterfaceId('sanity'), 834);
    assert.equal(core.CacheDefinitions.getVarbitId('sanity'), 15064);
});
test('volley patterns progress by completed specials and enrage starts ranged in pairs', () => {
    const { fight } = fixture();
    assert.deepEqual(fight.pattern('magic'), ['magic', 'magic', 'magic']);
    fight.completed = 1;
    assert.deepEqual(fight.pattern('ranged'), ['ranged', 'ranged', 'magic']);
    fight.completed = 3;
    assert.deepEqual(fight.pattern('magic'), ['magic', 'ranged', 'magic']);
    fight.enraged = true;
    assert.deepEqual([0, 1, 2, 3].map(n => { fight.attacks = n; return fight.pattern()[0]; }), ['ranged', 'ranged', 'magic', 'magic']);
});
test('actual applied damage spoils perfect context; immune and zero hits do not', () => {
    const f = fixture();
    Common.damage(f.fight, 0);
    f.apply();
    assert.equal(f.fight.perfectKill, true);
    Common.damage(f.fight, 5);
    f.apply();
    assert.equal(f.player.getHitpoints(), 94);
    assert.equal(f.fight.perfectKill, false);
    f.fight.over = true;
    f.boss.setHitpoints(0);
    const context = {};
    dropContext({ player: f.player, npc: f.boss, context });
    assert.equal(context.perfectKill, false);
});
test('sanity and prayer change every four ticks, and zero sanity starts escalating damage', () => {
    const f = fixture();
    f.fight.shadow = true;
    f.fight.sanity = 50;
    for (let i = 0; i < 4; i++)
        f.fight.sanityTick();
    assert.equal(f.fight.sanity, 47);
    assert.equal(f.player.getSkillManager().getCurrentLevel(core.Skill.PRAYER), 96);
    f.fight.shadow = false;
    for (let i = 0; i < 4; i++)
        f.fight.sanityTick();
    assert.equal(f.fight.sanity, 48);
    f.fight.sanity = 0;
    f.fight.sanityTick();
    f.apply();
    assert.ok(f.player.getHitpoints() < 99);
});
test('normal lethal blow enters 140 HP enrage and only final lethal damage ends fight', () => {
    const f = fixture();
    const event = { npc: f.boss, preventDeath: false };
    beforeDeath(event);
    assert.equal(event.preventDeath, true);
    assert.equal(f.boss.getHitpoints(), 140);
    assert.equal(f.fight.enraged, true);
    assert.equal(f.fight.shadow, true);
    const end = { npc: f.boss, preventDeath: false };
    beforeDeath(end);
    assert.equal(end.preventDeath, false);
    assert.equal(f.fight.over, true);
    assert.equal(f.fight.sanity, 100);
});
test('special incoming damage reduction uses current realm and soul vulnerability', () => {
    const f = fixture();
    f.fight.special = { kind: 'seeds' };
    const hit = { parts: [new core.HitDamage(100, core.HitMask.RED)], getHits() { return this.parts; }, updateTotalDamage() { } };
    modifyHit({ npc: f.boss, hit });
    assert.equal(hit.parts[0].getDamage(), 30);
    f.fight.shadow = true;
    hit.parts[0].setDamage(100);
    modifyHit({ npc: f.boss, hit });
    assert.equal(hit.parts[0].getDamage(), 40);
});
test('seeds finish on all light tiles; dark tile hurts and timeout deals 75', () => {
    const f = fixture();
    Specials.start(f.fight, 'seeds');
    const seeds = [...f.fight.special.seeds];
    const dark = seeds.find(seed => !seed.light);
    f.player.moveTo(new core.Location(dark.x, dark.y, 0));
    Specials.process(f.fight);
    f.apply();
    assert.ok(f.player.getHitpoints() < 99);
    for (const seed of seeds.filter(seed => seed.light)) {
        f.player.moveTo(new core.Location(seed.x, seed.y, 0));
        Specials.process(f.fight);
    }
    assert.equal(f.fight.special, null);
    assert.equal(f.fight.completed, 1);
    const late = fixture();
    Specials.start(late.fight, 'seeds');
    late.fight.special.left = 1;
    Specials.process(late.fight);
    late.apply();
    assert.equal(late.player.getHitpoints(), 24);
});
test('screech cover is exactly the 2x2 behind a column and each blast weakens all columns', () => {
    const f = fixture();
    Specials.start(f.fight, 'screech');
    assert.equal(f.fight.special.columns.length, 8);
    const column = f.fight.special.columns.find(c => c.hp === 20);
    f.player.moveTo(new core.Location(column.x, column.y + 2, 0));
    f.fight.special.left = 1;
    Specials.process(f.fight);
    f.apply();
    assert.equal(f.player.getHitpoints(), 99);
    assert.equal(column.active, false);
    assert.ok(f.fight.special.columns.some(c => c.active && c.hp === 40));
    assert.ok(f.fight.special.columns.every(c => !c.active || [20, 40].includes(c.hp)));
});
test('all four published seed patterns contain their full light and dark layouts', () => {
    assert.deepEqual([0, 1, 2, 3].map(pattern => {
        const seeds = Specials.seedLayout(pattern);
        return [seeds.length, seeds.filter(s => s.light).length];
    }), [[24, 12], [24, 16], [28, 14], [28, 14]]);
});
test('soul sets remain attackable only in shadow and timeout with no full set damages and heals', () => {
    const f = fixture();
    Specials.start(f.fight, 'souls');
    assert.equal(f.fight.special.souls.length, 12);
    const hit = { parts: [new core.HitDamage(10, core.HitMask.RED)], getHits() { return this.parts; }, updateTotalDamage() { } };
    modifyHit({ npc: f.fight.special.souls[0].npc, hit });
    assert.equal(hit.parts[0].getDamage(), 0);
    f.fight.special.left = 1;
    f.boss.setHitpoints(500);
    Specials.process(f.fight);
    f.apply();
    assert.equal(f.player.getHitpoints(), 49);
    assert.equal(f.boss.getHitpoints(), 600);
});
test('final death cancels queued encounter damage instead of hitting after the kill', () => {
    const f = fixture();
    Common.damage(f.fight, 20, 20);
    f.fight.finish();
    f.apply();
    assert.equal(f.player.getHitpoints(), 99);
});
test('projectile prayer is checked at scheduled impact and correct protection prevents recoil too', t => {
    const f = fixture();
    t.mock.method(core.CombatFactory, 'applyStyleDamage', hit => { hit.getHits()[0].setDamage(20); hit.updateTotalDamage(); });
    const hits = [];
    t.mock.method(core.CombatFactory, 'executeHit', hit => {
        hits.push(hit.getTotalDamage());
        f.player.getCombat().getHitQueue().addPendingDamage(hit.getHits());
    });
    f.player.getPrayerActive()[core.PrayerHandler.PROTECT_FROM_MAGIC] = true;
    f.fight.impact('magic');
    f.apply();
    assert.deepEqual(hits, [0]);
    assert.equal(f.player.getHitpoints(), 99);
    f.player.getPrayerActive()[core.PrayerHandler.PROTECT_FROM_MAGIC] = false;
    f.fight.impact('magic');
    f.apply();
    assert.deepEqual(hits, [0, 20]);
    assert.equal(f.player.getHitpoints(), 79);
    assert.equal(f.fight.perfectKill, false);
});
test('a tentacle wave can damage once along its moving path and transfers across realms', () => {
    const f = fixture();
    f.player.moveTo(new core.Location(2656, 6380, 0));
    f.fight.spawnTentacles();
    assert.ok(f.fight.tentacles.length > 0);
    const t = f.fight.tentacles[0];
    t.wait = 0;
    f.player.moveTo(new core.Location(t.x + Math.sign(t.targetX - t.x), t.y + Math.sign(t.targetY - t.y), 0));
    f.fight.processTentacles();
    f.apply();
    assert.equal(f.player.getHitpoints(), 79);
    f.fight.setShadow(true);
    assert.equal(f.player.getLocation().getX(), 2656 - 3 - 256);
    const next = f.fight.tentacles[0];
    f.player.moveTo(new core.Location(next.x + Math.sign(next.targetX - next.x), next.y + Math.sign(next.targetY - next.y), 0));
    f.fight.processTentacles();
    f.apply();
    assert.equal(f.player.getHitpoints(), 79, 'the same wave cannot hit twice');
});
test('soul rewards count a lethal hit before its delayed death event', () => {
    const f = fixture();
    Specials.start(f.fight, 'souls');
    const vita = f.fight.special.souls.filter(s => s.group === 0);
    f.player.setHitpoints(50);
    for (const soul of vita)
        beforeDeath({ npc: soul.npc, preventDeath: false });
    assert.ok(f.fight.special.rewarded.has(0));
    assert.equal(f.player.getHitpoints(), 69, '20 percent of the base hitpoints level');
});
test('postquest entry needs a fragment, owns both realms and cleans actors and UI on leave', () => {
    const f = fixture();
    const removed = [];
    let questComplete = false;
    Common.init({ core,
        emitCustomEvent(name, event) {
            if (name === 'quest:is-complete')
                event.complete = questComplete;
        },
        removeNpc(npc) { removed.push(npc); },
        spawnNpc({ id, x, y, z }) { return f.session.spawn(id, x, y); },
    });
    const figure = f.session.spawn(Common.data.npcs.figure, 2655, 6369);
    assert.equal(Site.disturb({ player: f.player, npc: figure }), false);
    questComplete = true;
    assert.equal(Site.disturb({ player: f.player, npc: figure }), true);
    assert.equal(Site.sessionOf(f.player), undefined, 'missing fragment does not allocate an area');
    f.player.getInventory().adds(core.ItemIdentifiers.BLACKSTONE_FRAGMENT, 1);
    Site.disturb({ player: f.player, npc: figure });
    const session = Site.sessionOf(f.player);
    assert.ok(session);
    const fight = session.fight;
    assert.equal(f.player.getInventory().contains(28357), true, 'entry normalizes a stale glowing fragment from the earlier implementation');
    assert.equal(f.player.getInventory().contains(28356), false);
    assert.equal(session.area.canAttack(f.player, fight.boss), true);
    assert.equal(session.area.canAttack(new Player(null), fight.boss), false);
    Specials.start(fight, 'seeds');
    const event = { player: f.player, itemId: core.ItemIdentifiers.BLACKSTONE_FRAGMENT_2, option: 'Activate' };
    assert.equal(Site.fragmentAction(event), true);
    assert.equal(event.handled, true);
    assert.equal(f.player.getLocation().getX(), 2400);
    const grave = { player: f.player };
    Site.grave(grave);
    assert.deepEqual(grave.tile, { x: 2922, y: 5826, z: 0 });
    assert.equal(grave.feeMultiplier, .25);
    Site.leave({ player: f.player });
    assert.equal(session.ended, true);
    assert.equal(fight.stopped, true);
    assert.equal(Site.sessionOf(f.player), undefined);
    assert.equal(f.player.getPrivateArea(), null, 'leaving detaches the player from the destroyed private area');
    assert.equal(f.player.getAttribute(Common.INSIDE_ATTRIBUTE), false);
    assert.equal(f.player.getLocation().getX(), 2656);
    assert.equal(f.player.getLocation().getY(), 6386);
});
test('the placeholder fragment is not accepted and a real fragment glows only during specials', () => {
    const f = fixture();
    assert.ok(core.CacheDefinitions.getItem(core.ItemIdentifiers.BLACKSTONE_FRAGMENT_3).placeholderTemplate >= 0);
    assert.deepEqual(Site.fragments(), [28356, 28357]);
    assert.equal(core.ItemDefinition.forId(28356).getExamine(), "It's vibrating with energy!");
    assert.equal(core.ItemDefinition.forId(28357).getExamine(), 'A strange shard of dark stone with various modifications.');
    f.player.getInventory().adds(28357, 1);
    Specials.start(f.fight, 'seeds');
    assert.equal(f.player.getInventory().contains(28356), true);
    Specials.clear(f.fight);
    assert.equal(f.player.getInventory().contains(28357), true);
});

test('postquest Ketla replaces a lost fragment with the cache normal version', () => {
    const f = fixture();
    let reclaim;
    const api = new Proxy({ core,
        onNpcInteraction(name, actions) { if (name === 'Ketla') reclaim = actions['Talk-to']; },
        emitCustomEvent(name, event) { if (name === 'quest:is-complete') event.complete = true; },
    }, { get: (object, name) => object[name] ?? (() => {}) });
    Common.init(api);
    Site.attach(api);
    assert.equal(reclaim({ player: f.player }), true);
    assert.equal(f.player.getInventory().getAmount(28357), 1);
    assert.equal(f.player.getInventory().getAmount(28356), 0);
    assert.equal(reclaim({ player: f.player }), false);
});

test('both melee hits grade the damage-roll prayer snapshot and protected chip remains perfect', t => {
    t.mock.method(Math, 'random', () => 0);
    for (const protectedMelee of [false, true]) {
        const f = fixture();
        const prayer = f.player.getPrayerActive();
        prayer[core.PrayerHandler.PROTECT_FROM_MELEE] = protectedMelee;
        f.fight.melee();
        prayer[core.PrayerHandler.PROTECT_FROM_MELEE] = !protectedMelee;
        f.apply();
        const first = 99 - f.player.getHitpoints();
        assert.ok(first > 0, 'protected melee still deals chip');
        assert.equal(f.fight.perfectKill, protectedMelee);
        f.fight.events.shift().action();
        f.apply();
        assert.equal(99 - f.player.getHitpoints(), first * 2);
        assert.equal(f.fight.perfectKill, protectedMelee);
    }
    const cancelled = fixture();
    cancelled.fight.melee();
    Common.cancelDamage(cancelled.fight);
    cancelled.apply();
    assert.equal(cancelled.player.getHitpoints(), 99);
    assert.equal(cancelled.fight.perfectKill, true);
});

test('a threshold crossed mid-volley waits for the next attack and keeps launched impacts', t => {
    const f = fixture();
    f.player.moveTo(new core.Location(2656, 6378, 0));
    let impacts = 0;
    t.mock.method(f.fight, 'impact', () => impacts++);
    t.mock.method(core.Projectile, 'arrivalTicks', () => 2);
    f.fight.volley();
    f.fight.process();
    f.boss.setHitpoints(720);
    f.fight.process();
    assert.equal(f.fight.special === null, true);
    for (let tick = 3; tick <= 9; tick++) f.fight.process();
    assert.equal(impacts, 3);
    assert.equal(f.fight.special === null, true);
    f.fight.process();
    assert.ok(f.fight.special);
    assert.equal(f.fight.startedSpecials, 1);
});

test('only pursuit after the third special stops below 100 HP and leaves the remaining bind', t => {
    for (const [completed, hp, cancelled] of [[2, 99, false], [3, 100, false], [3, 99, true]]) {
        const f = fixture();
        f.fight.completed = completed;
        f.fight.boundUntil = 14;
        f.boss.setHitpoints(hp);
        f.player.getTimers().registers(core.TimerKey.FREEZE, 12);
        let steps = 0, resets = 0;
        t.mock.method(f.boss.getMovementQueue(), 'addStep', () => steps++);
        t.mock.method(f.boss.getMovementQueue(), 'reset', () => resets++);
        f.fight.pursueBound();
        assert.equal(f.fight.boundUntil, 14, 'the existing bind window still permits a later freeze counter');
        assert.equal(steps, cancelled ? 0 : 1);
        assert.equal(resets, cancelled ? 1 : 0);
        assert.equal(f.player.getTimers().has(core.TimerKey.FREEZE), true);
    }
});
test('normal source spawn suppression leaves quest and unrelated spawns untouched', () => {
    for (const [npcId, x, expected] of [[12204, 2655, false], [12206, 2399, null], [12204, 3000, null]]) {
        const event = { npcId, location: new core.Location(x, 6369, 0), allow: null };
        Site.suppressSpawn(event);
        assert.equal(event.allow, expected);
    }
});
test('ice and standard binding spells are guaranteed during pursuit and boss freeze releases the player', () => {
    const f = fixture();
    f.fight.boundUntil = 14;
    f.player.getCombat().setCastSpell(core.CombatSpells.ICE_BARRAGE);
    const event = { attacker: f.player, target: f.boss, combatType: core.CombatType.MAGIC, forceAccurate: false };
    bindingCounter(event);
    assert.equal(event.forceAccurate, true);
    f.player.getTimers().registers(core.TimerKey.FREEZE, 12);
    f.boss.getTimers().registers(core.TimerKey.FREEZE, 20);
    f.fight.pursueBound();
    assert.equal(f.player.getTimers().has(core.TimerKey.FREEZE), false);
    assert.equal(f.fight.boundUntil, 0);
});

test('existing marked Undead Grasp bind releases the player during Whisperer pursuit', t => {
    t.mock.method(Math, 'random', () => .99);
    for (const [marked, lowHealth] of [[false, false], [true, false], [true, true]]) {
        const f = fixture();
        f.fight.boundUntil = 14;
        if (lowHealth) { f.fight.completed = 3; f.boss.setHitpoints(99); }
        f.boss.setFlag('combat:freezable', true);
        f.player.getTimers().registers(core.TimerKey.FREEZE, 12);
        if (marked) core.ArceuusSpells.placeMark(f.player);
        assert.equal(core.ArceuusSpells.hasMark(f.player), marked);
        const spell = core.CombatSpells.UNDEAD_GRASP;
        const hit = { isAccurate: () => true, getAttacker: () => f.player, getTarget: () => f.boss, getTotalDamage: () => 0 };
        spell.onHitCalc(hit);
        spell.finishCast(f.player, f.boss, true, 0);
        assert.equal(f.boss.getTimers().has(core.TimerKey.FREEZE), marked);
        f.fight.pursueBound();
        assert.equal(f.player.getTimers().has(core.TimerKey.FREEZE), !marked);
        assert.equal(f.fight.boundUntil, marked ? 0 : 14);
    }
});

test('low-health pursuit cancellation preserves the launched bind and a later freeze counter', t => {
    const f = fixture();
    f.fight.completed = f.fight.startedSpecials = 3;
    f.boss.setHitpoints(99);
    f.fight.nextAttack = Infinity;
    f.player.moveTo(new core.Location(2656, 6378, 0));
    t.mock.method(f.boss.getMovementQueue(), 'addStep', () => assert.fail('pursuit must stop'));
    f.fight.bind();
    f.fight.process();
    assert.equal(f.player.getTimers().has(core.TimerKey.FREEZE), false);
    f.fight.process();
    assert.equal(f.player.getTimers().has(core.TimerKey.FREEZE), true);
    f.boss.getTimers().registers(core.TimerKey.FREEZE, 4);
    f.fight.process();
    assert.equal(f.player.getTimers().has(core.TimerKey.FREEZE), false);
});
test('running across a seed consumes the intermediate tile as well as the destination', () => {
    const f=fixture();Specials.start(f.fight,'seeds');
    const seed=f.fight.special.seeds.find(s=>s.light);
    f.player.moveTo(new core.Location(seed.x+1,seed.y,0));
    f.player.setRunningDirection(core.Direction.EAST);
    Specials.process(f.fight);
    assert.equal(seed.active,false);
});
test('the boss approaches targets outside ten tiles before launching another volley', t => {
    const f=fixture();f.player.moveTo(new core.Location(2656,6384,0));f.fight.nextAttack=0;
    t.mock.method(f.fight,'volley',()=>{f.fight.attacks++;});
    f.fight.process();assert.equal(f.fight.attacks,0);
});
test('tentacles cannot originate on blocked arena tiles or inside the boss', () => {
    const f=fixture();
    const tile=new core.Location(2652,6376,0);
    f.session.area.setClip(tile,core.RegionManager.BLOCKED_TILE);
    assert.equal(f.fight.validTentacleTile(tile.getX(),tile.getY()),false);
    assert.equal(f.fight.validTentacleTile(2656,6370),false);
});
test('existing Combat Achievements counts a normal kill once and restores the canonical boss key', () => {
    const Data=require('../plugins/achievements/combatachievements/Data.CombatAchievements');
    const Kills=require('../plugins/achievements/combatachievements/Kills.CombatAchievements');
    Data({core});
    assert.equal(Data.monsterNamed('Whisperer, The').byEvent,false);
    const f=fixture(), listeners=new Map(), deaths=[];
    const api=new Proxy({core,
        onNpcDeath(handler){deaths.push(handler);},
        onCustomEvent(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
        emitCustomEvent(name,event){for(const handler of listeners.get(name)||[])handler(event);},
    },{get:(object,key)=>object[key]??(()=>{})});
    Common.init(api);Kills(api);Site.attach(api);require('../plugins/bosses/whisperer/Fight.Whisperer').attach(api);
    f.fight.finish();
    for(const handler of deaths)handler({killer:f.player,npc:f.boss,npcId:12204});
    assert.equal(Kills.counts(f.player)['Whisperer, The'],1);
    assert.equal(f.player.getAttribute(Common.KILLS_ATTRIBUTE),1);
    const restore={player:f.player,counts:{}};api.emitCustomEvent('combat-achievements:kill-count',restore);
    assert.equal(restore.counts['Whisperer, The'],1);
    f.player.setAttribute(Common.BEST_ATTRIBUTE,123);
    const pb={player:f.player,monster:'Whisperer, The'};api.emitCustomEvent('combat-achievements:personal-best',pb);
    assert.equal(pb.best,123);
});
test('ordinary postquest rope and activated teleporter reach the cathedral without a debug teleport', () => {
    const f=fixture(),vars=new Map(),menus=[];let completed=false;
    const sender=new Proxy({}, {get:(_,key)=>key==='getVarbit'?(id=>vars.get(id)||0):key==='sendVarbit'?((id,value)=>{vars.set(id,value);return sender;}):(()=>sender)});
    f.player.getPacketSender=()=>sender;
    Common.init({core,emitCustomEvent(name,event){if(name==='quest:is-complete')event.complete=completed;},
        sendMultiChatboxPrompt(_player,_title,...choices){menus.push(choices);}});
    const entrance={player:f.player,objectId:49477,option:'climb-rope',location:{x:2922,y:5827,z:0},handled:false};
    assert.equal(Site.travel(entrance),false,'the quest retains its incomplete route');
    completed=true;Site.travel(entrance);
    assert.equal(entrance.handled,true);assert.equal(f.player.getLocation().getX(),2587);
    assert.equal(f.player.getLocation().getY(),6435,'the cache rope tile is blocked; arrive beside it');
    f.player.moveTo(new core.Location(2593,6423,0));
    const portal={player:f.player,objectId:49479,option:'activate',location:{x:2593,y:6424,z:0},handled:false};
    Site.travel(portal);assert.equal(vars.get(15088),1);
    vars.set(15090,1);Site.travel({...portal,option:'use'});
    const menu=menus.at(-1), index=menu.findIndex(choice=>choice==='Cathedral');
    assert.ok(index>=0);menu[index+1]();
    assert.equal(f.player.getLocation().getX(),2653);assert.equal(f.player.getLocation().getY(),6405,'the teleporter tile is blocked; arrive beside it');
    const exit={player:f.player,objectId:48198,option:'climb-up',location:{x:2587,y:6436,z:0},handled:false};
    Site.travel(exit);assert.equal(exit.handled,true);
    assert.equal(f.player.getLocation().getX(),2922);assert.equal(f.player.getLocation().getY(),5826);
});
test('lethal damage freezes PB before the death animation and repeated death delivery cannot count twice', t => {
    let cycle=100;t.mock.method(core.World,'getProcessCycle',()=>cycle);
    const f=fixture(),hooks=[];
    const api=new Proxy({core,emitCustomEvent(){},onNpcDeath(handler){hooks.push(handler);}}, {get:(o,key)=>o[key]??(()=>{})});
    Common.init(api);require('../plugins/bosses/whisperer/Fight.Whisperer').attach(api);
    cycle=150;f.fight.finish();cycle=155;
    for(const handler of hooks){handler({npc:f.boss,killer:f.player});handler({npc:f.boss,killer:f.player});}
    assert.equal(f.player.getAttribute(Common.BEST_ATTRIBUTE),50);
    assert.equal(f.player.getAttribute(Common.KILLS_ATTRIBUTE),1);
});
test('postquest teleporter activations restore after quest login varbits are synchronized', t => {
    const Travel=require('../plugins/bosses/whisperer/Travel.Whisperer'),f=fixture(),vars=new Map(),tasks=[];
    f.player.setAttribute(Travel.TELEPORTERS_ATTRIBUTE,[0]);
    f.player.getPacketSender=()=>({sendVarbit:(id,value)=>vars.set(id,value)});
    Common.init({core,emitCustomEvent(name,event){if(name==='quest:is-complete')event.complete=true;}});
    t.mock.method(core.TaskManager,'submit',task=>tasks.push(task));
    Travel.restore({player:f.player});
    vars.set(15088,0); // Existing DT2 login hook runs later with its own saved discovery state.
    for(const task of tasks)task.execute();
    assert.equal(vars.get(15088),1);
});
