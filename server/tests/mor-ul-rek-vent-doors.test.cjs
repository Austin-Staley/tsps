// Run after `yarn build`: node --test tests/mor-ul-rek-vent-doors.test.cjs
//
// Mor Ul Rek's hot vent doors against rsprox (224/01437, 235/03870-03891, 236/03958): Pass steps the
// player through to the far side in one 2-tile step.
const assert = require('node:assert/strict');
const { test, before } = require('node:test');

const { Server } = require('../dist/Server');
Server.installProductionPathResolver();

const { PluginManager } = require('../dist/plugins/PluginManager');
const { Location } = require('../dist/game/model/Location');
const { TaskManager } = require('../dist/game/task/TaskManager');

let pass;

before(() => {
  const handlers = {};
  const api = { core: PluginManager.getCoreApi(), onObjectInteraction: (name, actions) => { handlers[name] = actions; } };
  require('../plugins/areas/MorUiRek.plugin').register(api);
  pass = handlers['Hot vent door'].Pass;
});

function player(x, y) {
  const p = {
    location: new Location(x, y, 0), steps: [],
    flags: new Set(),
    getLocation: () => p.location,
    setFlag(f) { p.flags.add(f); }, removeFlag(f) { p.flags.delete(f); },
    moveTo(l) { p.location = l; },
    getMovementQueue: () => ({ reset() {}, walkStep: (dx, dy) => p.steps.push([dx, dy]) }),
  };
  return p;
}

const door = (x, y, face) => ({ getLocation: () => new Location(x, y, 0), getFace: () => face });

test('north of a rotation-0 door, Pass steps 2 tiles south through it (recorded: 2436,5121 -> 2436,5119)', () => {
  const p = player(2436, 5121);
  assert.equal(pass({ player: p, object: door(2436, 5120, 0) }), true);
  assert.deepEqual(p.steps, [[0, -2]]);
  assert.deepEqual([p.location.getX(), p.location.getY()], [2436, 5121], 'already beside it, no jump');
  assert.ok(p.flags.has('movement:ignore-clipping'), 'the step goes through the door tile');
  for (let i = 0; i < 2; i++) TaskManager.process();
  assert.ok(!p.flags.has('movement:ignore-clipping'), 'clipping is back once through');
});

test('from the south it goes north; a rotation-3 door is passed east-west; a diagonal start is set beside it first', () => {
  const south = player(2457, 5118);
  pass({ player: south, object: door(2457, 5119, 0) });
  assert.deepEqual(south.steps, [[0, 2]]);
  const east = player(2495, 5174);
  pass({ player: east, object: door(2494, 5174, 3) });
  assert.deepEqual(east.steps, [[-2, 0]]);
  const diagonal = player(2437, 5121);
  pass({ player: diagonal, object: door(2436, 5120, 0) });
  assert.deepEqual([diagonal.location.getX(), diagonal.location.getY()], [2436, 5121]);
  assert.deepEqual(diagonal.steps, [[0, -2]]);
});
