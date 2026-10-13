import { strict as assert } from "node:assert";

import { ABYSSAL_WHIP } from "@runelite/api/gameval/ItemID";
import { WORN } from "@runelite/api/gameval/InventoryID";
import { GameState } from "@runelite/api/GameState";
import * as InterfaceID from "@runelite/api/gameval/InterfaceID";

assert.equal(ABYSSAL_WHIP, 4151, "gameval constants keep RuneLite's values");
assert.equal(WORN, 94, "InventoryID matches RuneLite");
assert.equal(GameState.CONNECTION_LOST, 40, "GameState uses RuneLite's enum values");
assert.equal(InterfaceID.ToplevelPreEoc.ICON10, 10747939, "upstream packed widget ID 0x00a4_0023 retains its namespace and hex value");

console.log("runelite gameval tests passed");
