import assert from "node:assert/strict";
import { ClientState } from "../game/ClientState";
import { buildPlayerActionEntries, type PlayerMenuActionContext } from "../render/render/interact/playerMenu";
import { PlayerMenuArrays } from "../runelite/impl/PlayerMenuArrays";
import { MenuAction } from "../runelite/api/MenuAction";
import { Client } from "../runelite/api/Client";
import { MenuEntryImpl } from "../runelite/impl/MenuEntryImpl";
import { worldEntriesToSimple } from "../ui/menu/MenuBridge";
import { MenuState } from "../ui/menu/MenuState";
import { setMenuEventHooks, type MenuActionData } from "../ui/menu/menuEvents";
const menus = new PlayerMenuArrays(), calls: unknown[][] = [];
const target: PlayerMenuActionContext = {
    sid: 71, playerLabel: "Test player", localX: 12, localY: 34,
    targetCombatLevel: 80, localCombatLevel: 70, localTeam: 0, targetTeam: 0,
    targetIsClanMember: false, canAttackPlayers: true,
    actions: { option: (...args) => calls.push(["option", ...args]),
        follow: (...args) => calls.push(["follow", ...args]),
        trade: (...args) => calls.push(["trade", ...args]),
        attack: (...args) => calls.push(["attack", ...args]) },
};
const build = () => buildPlayerActionEntries(target);
ClientState.playerOptions.clear();
ClientState.playerAttackOption = 0;
let entries = build();
assert.deepEqual(entries.map(e => e.option), ["Follow", "Trade with", "Attack"]);
assert.deepEqual(entries.map(e => e.deprioritized), [false, true, true]);
const defaultDisplay = worldEntriesToSimple(entries);
const attackRow = defaultDisplay.find(e => e.option === "Attack")!;
assert.equal(attackRow.deprioritized, true);
assert.equal(attackRow.opcode, 2044, "native right-click priority must reach menu sorting");
assert.equal(new MenuEntryImpl(attackRow, {} as Client).isDeprioritized(), true);
entries.forEach(e => e.onClick?.());
assert.deepEqual(calls, [["follow", 71], ["trade", 71], ["attack", 71, 12, 34]]);
calls.length = 0;
// Both native packet options and plugin mutations read the same source in the live render path.
for (let slot = 0; slot < 3; slot++) {
    menus.options[slot] = ["Attack", "Trade with", "Follow"][slot];
    menus.priorities[slot] = false;
    menus.types[slot] = 44 + slot;
}
entries = build();
assert.deepEqual(entries.map(e => e.opcode), [46, 45, 44]);
assert.deepEqual(entries.map(e => e.deprioritized), [false, false, true]);
menus.priorities[2] = true;
assert.equal(build()[0].deprioritized, true, "Follow honors plugin right-click priority");
ClientState.playerAttackOption = 2;
assert.equal(build().find(e => e.option === "Attack")!.deprioritized, false);
menus.priorities[0] = true;
assert.equal(build().find(e => e.option === "Attack")!.deprioritized, true, "Attack combines native and plugin priority");
ClientState.playerAttackOption = 3;
assert.equal(build().some(e => e.option === "Attack"), false, "hidden attack option stays hidden");
ClientState.playerAttackOption = 0;
assert.equal(buildPlayerActionEntries({ ...target, canAttackPlayers: false }).some(e => e.option === "Attack"), false);
assert.equal(buildPlayerActionEntries({ ...target, localTeam: 4, targetTeam: 5 }).find(e => e.option === "Attack")!.deprioritized, true, "plugin priority is retained even when team policy permits attack");
menus.priorities[0] = false;
assert.equal(buildPlayerActionEntries({ ...target, localTeam: 4, targetTeam: 5 }).find(e => e.option === "Attack")!.deprioritized, false);
assert.equal(buildPlayerActionEntries({ ...target, localTeam: 4, targetTeam: 4 }).find(e => e.option === "Attack")!.deprioritized, true);
// All first three slots must permit rename, custom opcodes and removal, just like slots four through eight.
for (let slot = 0; slot < 3; slot++) {
    menus.options[slot] = `Plugin action ${slot}`;
    menus.priorities[slot] = slot === 1;
    menus.types[slot] = MenuAction.RUNELITE_PLAYER.getId() + slot;
}
entries = build();
assert.deepEqual(entries.map(e => e.option), ["Plugin action 2", "Plugin action 1", "Plugin action 0"]);
assert.deepEqual(entries.map(e => e.deprioritized), [false, true, false]);
entries.forEach(e => e.onClick?.());
assert.deepEqual(calls, [["option", 71, 3], ["option", 71, 2], ["option", 71, 1]]);
const state = new MenuState(), display = worldEntriesToSimple(entries, { menuState: state });
assert.equal(display.length, 3);
const dispatched: MenuActionData[] = [];
const dispose = setMenuEventHooks({ build: e => e, opened: e => e, shouldOpen: open => open, click: action => { dispatched.push({ ...action }); return true; } });
for (let i = 0; i < state.actions.length; i++)
    state.invoke(i, 25, 30);
assert.deepEqual(dispatched.map(e => e.opcode).sort(), [1503, 1505, 3504], "menu type overrides and native right-click priority survive the actual bridge and click dispatcher");
assert.ok(dispatched.every(e => e.identifier === 71 && e.param0 === 12 && e.param1 === 34));
assert.ok(dispatched.every(e => e.screenX === 25 && e.screenY === 30));
dispose();
const disposeMutation = setMenuEventHooks({ prepare: rows => {
        const row = rows.find(e => e.option === "Plugin action 0")!;
        new MenuEntryImpl(row, {} as Client).setOption("Changed by plugin").setType(MenuAction.RUNELITE).setParam0(99);
        return rows;
    }, build: e => e, opened: e => e, shouldOpen: open => open, click: action => { dispatched.push({ ...action }); return true; } });
const mutated = worldEntriesToSimple(build(), { menuState: state }).find(e => e.option === "Changed by plugin")!;
assert.equal(mutated.opcode, MenuAction.RUNELITE.getId(), "MenuEntry mutations update the row consumed by MenuBridge");
state.invoke(mutated.menuStateIndex!);
assert.equal(dispatched.at(-1)!.opcode, MenuAction.RUNELITE.getId());
assert.equal(dispatched.at(-1)!.param0, 99);
assert.equal(dispatched.at(-1)!.option, "Changed by plugin");
disposeMutation();
menus.options[0] = null;
menus.options[1] = null;
menus.options[2] = null;
assert.deepEqual(build(), [], "null removes defaults from all first three slots");
ClientState.playerOptions.clear();
ClientState.playerAttackOption = 0;
console.log("RuneLite player-menu mutations use native builder, retain special callbacks and reach click dispatcher");
