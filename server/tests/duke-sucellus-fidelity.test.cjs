const assert=require('node:assert/strict');
const {test,before}=require('node:test');
const H=require('./helpers/duke-sucellus.cjs');
before(H.initialize);

test('left-click Feed falls back to mushroom powder after poisons, never raw mushrooms',t=>{
  const h=H.harness(t),s=h.enter(),i=h.C.data.items;h.move([3039,6451]);
  h.add(i.arder,2);h.add(i.muscaPowder,40);
  h.Prep.feed({player:h.p,npc:s.boss});
  assert.equal(s.meter,5);assert.equal(h.p.getInventory().getAmount(i.muscaPowder),39);
  assert.equal(h.p.getInventory().getAmount(i.arder),2);
  h.add(i.poison);h.Prep.feed({player:h.p,npc:s.boss});
  assert.equal(s.meter,105);assert.equal(h.p.getInventory().getAmount(i.poison),0);
});

test('powder is fed at most once each game cycle and cannot be wasted after waking',t=>{
  const h=H.harness(t),s=h.enter(),i=h.C.data.items;h.move([3039,6451]);h.add(i.arderPowder,45);
  for(let n=0;n<50;n++)h.Prep.feed({player:h.p,npc:s.boss});
  assert.equal(s.meter,5);assert.equal(h.p.getInventory().getAmount(i.arderPowder),44);
  for(let n=0;n<39;n++){h.step();h.Prep.feed({player:h.p,npc:s.boss});}
  assert.equal(s.fight.active,true);assert.equal(h.p.getInventory().getAmount(i.arderPowder),5);
  h.Prep.feed({player:h.p,npc:s.boss});assert.equal(h.p.getInventory().getAmount(i.arderPowder),5);
});

test('mushrooms automatically grind immediately, two ticks later, then every three ticks',t=>{
  const h=H.harness(t),s=h.enter(),i=h.C.data.items;h.add(i.pestle);h.add(i.arder,4);
  h.Prep.grind({player:h.p,usedItemId:i.pestle,usedWithItemId:i.arder});
  assert.equal(h.p.getInventory().getAmount(i.arder),3);
  // A click is received between cycles: the first task cycle is its response cycle.
  h.step(2);assert.equal(h.p.getInventory().getAmount(i.arder),3);
  h.step();assert.equal(h.p.getInventory().getAmount(i.arder),2);
  h.step(2);assert.equal(h.p.getInventory().getAmount(i.arder),2);
  h.step();assert.equal(h.p.getInventory().getAmount(i.arder),1);
  h.Site.leave(h.p);h.step(3);assert.equal(s.ended,true);
  assert.equal(h.p.getInventory().getAmount(i.arderPowder),0);
});

test('last Slayer assignment kill cannot award an off-task Duke speed achievement',t=>{
  const h=H.harness(t);h.enter();let onTask=true;
  h.api.onCustomEvent('slayer:on-task',e=>{e.onTask=onTask;});
  h.fight.wake();h.fight.fell();onTask=false;h.fight.won(h.p);
  assert.equal(h.emitted.some(([name,e])=>name==='combat-achievements:complete'&&e.task.startsWith('Duke Sucellus Speed-')),false);
});

test('Duke scoreboard opens its cache-native interface with persisted personal records',t=>{
  const h=H.harness(t),R=require('../plugins/bosses/dukesucellus/Records.DukeSucellus');
  R.resetWorld();R.attach(h.api);
  h.p.setAttribute(h.C.KILLS,12);h.p.setAttribute(h.C.BEST,73);h.p.setAttribute(R.DEATHS,3);
  assert.equal(R.read({player:h.p,objectId:1}),false);
  assert.equal(R.read({player:h.p,objectId:47563}),true);
  assert.ok(h.packets.some(x=>x[0]==='sendInterface'&&x[1]===828));
  const text=id=>h.packets.find(x=>x[0]==='sendString'&&x[2]===((828<<16)|id))?.[1];
  assert.equal(text(9),'12');assert.equal(text(11),'3');assert.equal(text(13),'0:43.8');
});

test('Duke records count a lethal result and an in-instance player death once each',t=>{
  const h=H.harness(t),R=require('../plugins/bosses/dukesucellus/Records.DukeSucellus');
  R.resetWorld();R.attach(h.api);const s=h.enter();h.fight.wake();h.step(3);h.fight.fell();h.fight.won(h.p);h.fight.won(h.p);
  assert.equal(R.worldRecords().kills,1);assert.equal(R.worldRecords().best,3);
  s.reset();h.Site.beforePlayerDeath({player:h.p});h.Site.beforePlayerDeath({player:h.p});
  assert.equal(h.p.getAttribute(R.DEATHS),1);assert.equal(R.worldRecords().deaths,1);
  h.Site.leave(h.p);h.Site.beforePlayerDeath({player:h.p});assert.equal(R.worldRecords().deaths,1);
});
