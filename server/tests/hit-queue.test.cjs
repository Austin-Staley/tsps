// Run after `yarn build`: node --test tests/hit-queue.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { HitQueue } = require('../dist/game/content/combat/hit/HitQueue');
const { HitDamage } = require('../dist/game/content/combat/hit/HitDamage');
const { HitMask } = require('../dist/game/content/combat/hit/HitMask');

function buildTarget(hp) {
    const shown = [];
    const target = {
        hp,
        shown,
        isRegistered: () => true,
        isPlayer: () => false,
        getHitpoints: () => target.hp,
        decrementHealth: (hit) => {
            if (target.hp <= 0) hit.setDamage(0);
            hit.setDamage(Math.min(hit.getDamage(), target.hp));
            target.hp -= hit.getDamage();
            return hit;
        },
        addTickHit: (hit) => shown.push(hit.getDamage()),
    };
    return target;
}

const hits = (...damage) => damage.map((value) => new HitDamage(value, HitMask.RED));

test('every hit due on a tick lands on that tick', () => {
    const target = buildTarget(120);
    const queue = new HitQueue(target);
    queue.addPendingDamage(hits(10, 10, 10, 10, 10, 10, 10, 10, 10, 10));
    queue.process(1);
    assert.equal(target.hp, 20, 'ten 10s on one tick');
    assert.equal(target.shown.length, 10, 'all ten are sent; the client keeps four on screen');
    assert.equal(queue.hasPendingWork(), false, 'nothing carries over to the next tick');
});

test('hits after a lethal one take nothing more off', () => {
    const target = buildTarget(15);
    const queue = new HitQueue(target);
    queue.addPendingDamage(hits(10, 10, 10));
    queue.process(1);
    assert.equal(target.hp, 0);
    assert.deepEqual(target.shown, [10, 5, 0]);
});

test('applied observers see actual HP loss once before reactive healing',t=>{
    const {CombatFactory}=require('../dist/game/content/combat/CombatFactory');
    const target=buildTarget(5),queue=new HitQueue(target),seen=[];
    t.mock.method(CombatFactory,'handleRedemption',()=>{target.hp+=2;});
    const hit=new HitDamage(10,HitMask.RED).onApplied(amount=>seen.push([amount,target.hp]));
    queue.addPendingDamage([hit]);queue.process(1);
    assert.deepEqual(seen,[[5,0]]);assert.equal(target.hp,2);
    hit.notifyApplied(10);assert.equal(seen.length,1);
});

test('a failing applied observer cannot suppress later observers or reactive healing',t=>{
    const {CombatFactory}=require('../dist/game/content/combat/CombatFactory');
    const target=buildTarget(5),queue=new HitQueue(target),seen=[];
    t.mock.method(console,'error',()=>{});
    t.mock.method(CombatFactory,'handleRedemption',()=>seen.push('healing'));
    queue.addPendingDamage([new HitDamage(2,HitMask.RED)
        .onApplied(()=>{throw new Error('observer fixture');}).onApplied(amount=>seen.push(amount))]);
    queue.process(1);assert.deepEqual(seen,[2,'healing']);
});
