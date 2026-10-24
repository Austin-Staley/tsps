// From server/: node --test tests/bank-pin.test.cjs (after yarn build).
//
// The Bank PIN against the OSRS Wiki (Bank_PIN) and the rsprox recordings in
// plugins/interface/data/bank-pin.json: the settings screen for each state, setting, changing,
// deleting and cancelling a PIN, the keypad's answer, the bank's lock, wrong entries and their
// lockouts, the logout behaviour, and the PIN never stored as digits.
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, beforeEach, test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { CachePipeline } = require('../dist/game/cache/CachePipeline');
const core = PluginManager.getCoreApi();

let Common, Keypad, Settings, tasks, time, bankOpen;
const DAY = 24 * 60 * 60 * 1000;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, '..'));
  Common = require('../plugins/interface/bankpin/Common.BankPin');
  Keypad = require('../plugins/interface/bankpin/Keypad.BankPin');
  Settings = require('../plugins/interface/bankpin/Settings.BankPin');
  const api = new Proxy({
    core: {
      ...core,
      TaskManager: { submit: (task) => { task.setRunning(true); tasks.push(task); } },
      Bank: { isOpen: (player) => bankOpen.has(player) },
    },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  Common.init(api);
  Common.setClock(() => time);
});

beforeEach(() => {
  tasks = [];
  time = 1_000_000;
  bankOpen = new Set();
});

function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    const due = tasks;
    tasks = [];
    for (const task of due) if (task.tick()) tasks.push(task);
  }
}

function fakePlayer(name = 'pintest') {
  const player = {
    attributes: {}, messages: [], strings: {}, hidden: {}, interface: -1, amount: null, banksOpened: 0,
    getUsername: () => name,
    getInterfaceId: () => player.interface,
    getAttribute: (k) => player.attributes[k],
    setAttribute: (k, v) => { player.attributes[k] = v; },
    sendMessage: (m) => player.messages.push(m),
    setEnteredAmountAction: (action) => { player.amount = action; },
    getCurrentBankTab: () => 0,
    getBank: () => ({ open: () => { player.banksOpened++; bankOpen.add(player); } }),
    getPacketSender: () => ({
      sendInterfaceRemoval: () => { player.interface = -1; },
      sendInterface: (id) => { player.interface = id; },
      sendString: (text, uid) => { player.strings[uid] = text; },
      sendInterfaceDisplayState: (uid, hide) => { player.hidden[uid] = hide; },
    }),
  };
  return player;
}

const u = () => Common.ids.uids;
/** Answers the open keypad, as the client's script does (one amount for the four digits). */
function enter(player, pin) {
  const action = player.amount;
  assert.ok(action, 'a keypad is waiting');
  player.amount = null;
  action.execute(Number(pin));
}
const click = (player, uid) => {
  const event = { player, groupId: uid >> 16, childId: uid & 0xffff, handled: false };
  Settings.onClick(event);
  return event;
};
const shown = (player, uid) => player.hidden[uid] === false;

/** A player with an active PIN. */
function withPin(pin = '1234') {
  const player = fakePlayer();
  Common.set(player, 'hash', Common.hash(player, pin));
  return player;
}

test('the interfaces and components resolve from the cache', () => {
  assert.deepEqual(Common.ids.groups, { settings: 14, keypad: 213 });
  assert.equal(u().settings.logoutToggle, (14 << 16) | 25, 'the recorded logout button');
  assert.equal(u().keypad.title, (213 << 16) | 2);
});

test('the Banker\'s "check my PIN settings": no PIN shows Set a PIN and the delay', () => {
  const player = fakePlayer();
  const action = { player, action: 'open_interface', target: 'Bank PIN', handled: false };
  Settings.onAction(action);
  assert.deepEqual([action.handled, action.end], [true, true]);
  tick();
  assert.equal(player.interface, 14);
  assert.equal(player.strings[u().settings.status], 'You do not have a PIN');
  assert.equal(player.strings[u().settings.delay], '7 days');
  assert.equal(player.strings[u().settings.logout], 'Always lock');
  assert.equal(player.strings[u().settings.message], Common.data.texts.message);
  assert.equal(shown(player, u().settings.noPin), true);
  assert.equal(shown(player, u().settings.hasPin), false);
  assert.equal(Settings.onAction({ player, action: 'open_interface', target: 'Bank', handled: false }), undefined);
});

test('setting a PIN: entered twice, pending for the delay, then active; a mismatch sets nothing', () => {
  const player = fakePlayer();
  Settings.show(player);
  click(player, u().settings.setPin);
  assert.equal(player.interface, 213);
  assert.equal(player.strings[u().keypad.title], 'Bank of Gielinor');
  enter(player, '0042');
  tick();
  assert.equal(player.strings[u().keypad.instruction], 'Now please enter that number again.');
  enter(player, '0042');
  assert.equal(Common.hasPin(player), false, 'not yet');
  assert.equal(Common.pendingPin(player), true);
  assert.equal(player.strings[u().settings.status], 'PIN coming soon');
  assert.equal(shown(player, u().settings.pending), true);
  assert.equal(player.attributes['bank-pin:pending-hash'].includes('0042'), false, 'never the digits');
  time += 7 * DAY;
  Common.settle(player);
  assert.equal(Common.hasPin(player), true);
  assert.equal(player.messages.at(-1), 'Your Bank PIN is now active.');

  const other = fakePlayer();
  Settings.show(other);
  click(other, u().settings.setPin);
  enter(other, '1111');
  tick();
  enter(other, '2222');
  assert.equal(Common.pendingPin(other), false);
  assert.equal(other.strings[u().settings.message], 'Those numbers did not match. Your PIN has not been set.');
});

test('0000 is a PIN: the keypad takes 0', () => {
  const player = withPin('0000');
  Settings.canBank({ player, allow: null, source: 'open' });
  assert.equal(player.amount.acceptsZero, true);
  enter(player, '0000');
  assert.equal(player.messages.at(-1), 'You have correctly entered your PIN.');
});

test('the bank: locked asks for the PIN, then opens; unlocked until logout; no PIN, no ask', () => {
  const player = withPin('1234');
  const event = { player, allow: null, source: 'open' };
  Settings.canBank(event);
  assert.equal(event.allow, false);
  assert.equal(player.interface, 213);
  enter(player, '1234');
  assert.equal(player.messages.at(-1), 'You have correctly entered your PIN.');
  tick();
  assert.equal(player.banksOpened, 1);
  bankOpen.clear();
  const again = { player, allow: null, source: 'open' };
  Settings.canBank(again);
  assert.equal(again.allow, null, 'unlocked this session');
  Settings.logout({ player });
  const after = { player, allow: null, source: 'open' };
  Settings.canBank(after);
  assert.equal(after.allow, false, 'locked again after logout');

  const free = fakePlayer();
  const none = { player: free, allow: null, source: 'open' };
  Settings.canBank(none);
  assert.equal(none.allow, null);
  const tabs = withPin();
  bankOpen.add(tabs);
  const switching = { player: tabs, allow: null, source: 'open' };
  Settings.canBank(switching);
  assert.equal(switching.allow, null, 'tab switches in an open bank pass');
});

test('wrong entries: a lockout after two, three and four, kept over logout; a right one clears it', () => {
  const player = withPin('1234');
  const wrong = () => {
    Settings.canBank({ player, allow: null, source: 'open' });
    if (player.amount) enter(player, '9999');
  };
  wrong();
  assert.equal(Common.get(player, 'failures'), 1);
  assert.equal(Keypad.lockedSeconds(player), 0);
  wrong();
  assert.equal(Keypad.lockedSeconds(player), 10);
  Settings.canBank({ player, allow: null, source: 'open' });
  assert.equal(player.amount, null, 'no keypad while locked out');
  time += 10_000;
  wrong();
  assert.equal(Keypad.lockedSeconds(player), 15);
  time += 15_000;
  Settings.logout({ player });
  Settings.login({ player });
  wrong();
  assert.equal(Keypad.lockedSeconds(player), 600, 'the fourth: 10 minutes, the count kept over logout');
  time += 600_000;
  Settings.canBank({ player, allow: null, source: 'open' });
  enter(player, '1234');
  assert.equal(Common.get(player, 'failures'), 0);
});

test('change and delete need the current PIN; delete asks yes or no', () => {
  const player = withPin('1234');
  Settings.show(player);
  assert.equal(shown(player, u().settings.hasPin), true);
  click(player, u().settings.changePin);
  enter(player, '1234');
  tick();
  enter(player, '5678');
  tick();
  enter(player, '5678');
  assert.equal(Common.get(player, 'hash'), Common.hash(player, '5678'));
  assert.equal(player.messages.at(-1), 'Your PIN has been changed.');

  click(player, u().settings.deletePin);
  enter(player, '5678');
  tick();
  assert.equal(shown(player, u().settings.warning), true);
  assert.equal(player.strings[u().settings.question], 'Do you really wish to delete your PIN?');
  click(player, u().settings.no);
  assert.equal(Common.hasPin(player), true);
  click(player, u().settings.deletePin);
  enter(player, '5678');
  tick();
  click(player, u().settings.yes);
  assert.equal(Common.hasPin(player), false);
  assert.equal(player.messages.at(-1), 'Your PIN has been deleted.');

  const wrong = withPin('1234');
  Settings.show(wrong);
  click(wrong, u().settings.changePin);
  enter(wrong, '0001');
  assert.equal(Common.get(wrong, 'hash'), Common.hash(wrong, '1234'), 'unchanged');
});

test('"I don\'t know it." deletes the PIN after the delay, unless cancelled', () => {
  const player = withPin('1234');
  Settings.canBank({ player, allow: null, source: 'open' });
  assert.equal(player.hidden[u().keypad.forgotten], false, 'offered');
  enter(player, String(Keypad.FORGOTTEN_ANSWER));
  assert.equal(player.amount, null);
  assert.equal(Common.pendingDelete(player), true);
  Settings.show(player);
  assert.equal(player.strings[u().settings.status], 'PIN being deleted');
  click(player, u().settings.cancelPending);
  enter(player, '1234');
  tick();
  assert.equal(Common.pendingDelete(player), false, 'cancelled, with the PIN');
  Settings.forgot(player);
  time += 7 * DAY;
  Common.settle(player);
  assert.equal(Common.hasPin(player), false);
  assert.equal(player.messages.at(-1), 'Your Bank PIN has now been deleted.');
});

test('the recovery delay and the logout behaviour toggle; stay unlocked within 5 minutes offline', () => {
  const player = withPin('1234');
  Settings.show(player);
  click(player, u().settings.hasPinDelay);
  enter(player, '1234');
  tick();
  assert.equal(player.strings[u().settings.delay], '3 days');
  click(player, u().settings.logoutToggle);
  enter(player, '1234');
  tick();
  assert.equal(player.strings[u().settings.logout], 'Lock after 5 minutes offline');
  Common.unlock(player);
  Settings.logout({ player });
  time += 4 * 60 * 1000;
  Settings.login({ player });
  assert.equal(Common.isUnlocked(player), true, 'back within 5 minutes');
  Settings.logout({ player });
  time += 6 * 60 * 1000;
  Settings.login({ player });
  assert.equal(Common.isUnlocked(player), false);
  click(player, u().settings.logoutToggle);
  enter(player, '1234');
  tick();
  assert.equal(player.strings[u().settings.message], 'On login, your PIN will always be locked.', 'as recorded');
});

test("agent:advance-time brings a pending PIN forward (for testing)", () => {
  const player = fakePlayer();
  Common.set(player, "pendingHash", Common.hash(player, "4321"));
  Common.set(player, "pendingAt", time + 7 * DAY);
  const event = { player, ms: 7 * DAY, handledBy: [] };
  Settings.advanceTime(event);
  assert.equal(Common.hasPin(player), true);
  assert.deepEqual(event.handledBy, ["BankPin"]);
  const idle = { player: fakePlayer(), ms: DAY, handledBy: [] };
  Settings.advanceTime(idle);
  assert.deepEqual(idle.handledBy, [], "nothing timed, not listed");
});

test("deposit boxes need no PIN; any other check while locked is refused; the keypad's Exit does nothing", () => {
  const player = withPin("1234");
  const deposit = { player, allow: null, source: "deposit-box" };
  Settings.canBank(deposit);
  assert.equal(deposit.allow, null);
  const servant = { player, allow: null };
  Settings.canBank(servant);
  assert.equal(servant.allow, false);
  assert.equal(player.interface, -1, "no keypad for a remote check");
  assert.equal(player.messages.at(-1), "You need to enter your Bank PIN at a bank first.");
  Settings.canBank({ player, allow: null, source: "open" });
  enter(player, String(Keypad.EXIT_ANSWER));
  assert.equal(Common.get(player, "failures") || 0, 0, "not a wrong entry");
  assert.equal(Common.isUnlocked(player), false);
});

test("the offline window starts only from a session that entered the PIN", () => {
  const player = withPin("1234");
  Settings.show(player);
  Settings.canBank({ player, allow: null, source: "open" });
  player.interface = 14;
  Common.set(player, "stayUnlocked", true);
  Settings.logout({ player });
  time += 60 * 1000;
  Settings.login({ player });
  assert.equal(Common.isUnlocked(player), false, "a password-only session cannot unlock itself");
});

test("settings buttons act only with the screen open, from the layer shown, and with the PIN", () => {
  const player = withPin("1234");
  click(player, u().settings.hasPinDelay);
  assert.equal(Common.delayDays(player), 7, "screen not open: nothing");
  Settings.show(player);
  click(player, u().settings.setPin);
  assert.equal(player.interface, 14, "Set a PIN is not on the has-a-PIN layer");
  assert.equal(Common.pendingPin(player), false);
  click(player, u().settings.hasPinDelay);
  assert.equal(player.interface, 213, "the PIN first");
  enter(player, "9999");
  assert.equal(Common.delayDays(player), 7, "wrong PIN: unchanged");
});
