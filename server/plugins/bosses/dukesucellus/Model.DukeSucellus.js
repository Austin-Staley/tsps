"use strict";
const data = require('../data/duke-sucellus.json');
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const powderYield = level => clamp(Math.floor((level - 20) / 10), 1, 6);
const saltYield = level => level >= 80 ? 6 : level >= 75 ? 5 : level >= 70 ? 4 : 3;
function feed(meter, amount, maximum) {
  if (meter >= maximum) return { consumed:false, meter:maximum, awake:true };
  const next = Math.min(maximum, meter + amount);
  return { consumed:true, meter:next, awake:next >= maximum };
}
const gasCount = hp => hp <= data.normal.hitpoints / 2 ? 2 : 1;
const attackTicks = hp => hp <= data.normal.enrageHp ? data.normal.enrageTicks : data.normal.attackTicks;
class AttackClock {
  constructor() { this.autos = 0; this.gasAutos = 0; this.seenGaze = false; this.justGazed = false; this.gasInterval = 3; }
  next(hp) {
    if (this.autos === 5) {
      this.autos = 0;
      this.seenGaze = true;
      this.justGazed = true;
      return 'gaze';
    }
    if (this.seenGaze && this.gasAutos >= this.gasInterval && !this.justGazed) {
      this.gasAutos = 0;
      this.gasInterval = hp > data.normal.hitpoints * .75 ? 5 : hp > data.normal.enrageHp ? 4 : 3;
      return 'gas';
    }
    this.autos++;
    if (this.seenGaze) this.gasAutos++;
    this.justGazed = false;
    return 'auto';
  }
}
function rayCrossesBox(from, to, [x,y,w,h]) {
  let low = 0, high = 1;
  for (const [axis, min, max] of [[0,x,x+w],[1,y,y+h]]) {
    const delta = to[axis]-from[axis];
    if (delta === 0) { if(from[axis] < min || from[axis] > max) return false; continue; }
    let a = (min-from[axis])/delta, b=(max-from[axis])/delta;
    if(a>b) [a,b]=[b,a];
    low=Math.max(low,a); high=Math.min(high,b);
    if(low>high) return false;
  }
  return high > 0 && low < 1;
}
function hidden([x,y]) {
  return data.pillars.some(pillar => rayCrossesBox([3039.5,6455.5],[x+.5,y+.5],pillar));
}
function melee([x,y]) { return x>=3035 && x<=3043 && y>=6451 && y<=6459; }
function near([x,y],[tx,ty],distance=1) { return Math.abs(x-tx)<=distance && Math.abs(y-ty)<=distance; }
module.exports = { powderYield, saltYield, feed, gasCount, attackTicks, AttackClock, hidden, melee, near };
